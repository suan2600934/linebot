'use strict';

const express = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');
const { Client, middleware } = require('@line/bot-sdk');
const {
  hmacSha256,
  encrypt,
  decrypt,
  CURRENT_KEY_VERSION,
} = require('./crypto-utils');

const app = express();

app.get('/health', (req, res) => res.json({ ok: true }));

let pool;

async function initPool() {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    throw new Error('Missing DATABASE_URL');
  }
  const re = /^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:\/]+):(\d+)\/([^?]+)$/;
  const match = connStr.match(re);
  if (!match) throw new Error('Invalid DATABASE_URL: ' + connStr);
  pool = new Pool({
    host: match[3],
    port: Number(match[4]),
    user: match[1],
    password: match[2],
    database: match[5],
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  console.log('[pool] initialized, host:', match[3]);
}

const lineClient = new Client({
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const VERIFY_CODE_TTL_MINUTES = parseInt(process.env.VERIFY_CODE_TTL_MINUTES || '5', 10);
const VERIFY_MAX_ATTEMPTS = parseInt(process.env.VERIFY_MAX_ATTEMPTS || '3', 10);
const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:8081').replace(/\/$/, '');

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function badRequest(res, message) {
  return res.status(400).json({ ok: false, error: message });
}

app.post('/api/create-verify-code', express.json(), async (req, res) => {
  const { recno } = req.body || {};

  if (!recno || typeof recno !== 'string') {
    return badRequest(res, '缺少必填欄位 recno');
  }

  const client = await pool.connect();
  try {
    const code = generateCode();
    const codeHash = hmacSha256(code);
    const recnoHash = hmacSha256(recno);
    const { payload: recnoEncrypted } = encrypt(recno);
    const expiresAt = new Date(Date.now() + VERIFY_CODE_TTL_MINUTES * 60 * 1000);

    await client.query('BEGIN');

    await client.query(
      `UPDATE verification_codes
         SET status = 'expired'
       WHERE recno_hash = $1
         AND status = 'pending'`,
      [recnoHash]
    );

    const insertResult = await client.query(
      `INSERT INTO verification_codes
         (code_hash, recno_encrypted, recno_hash, key_version, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, expires_at`,
      [codeHash, recnoEncrypted, recnoHash, CURRENT_KEY_VERSION, expiresAt]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      ok: true,
      data: {
        id: insertResult.rows[0].id,
        code,
        expiresAt: insertResult.rows[0].expires_at,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[create-verify-code] error:', err);
    return res.status(500).json({ ok: false, error: '系統錯誤,請稍後再試' });
  } finally {
    client.release();
  }
});

app.post('/api/verify', express.json(), async (req, res) => {
  const { code, lineUserId } = req.body || {};

  if (!code || !lineUserId) {
    return badRequest(res, '缺少必填欄位 code / lineUserId');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const codeHash = hmacSha256(code);
    const { rows } = await client.query(
      `SELECT id, recno_encrypted, key_version, attempt_count, expires_at, status
         FROM verification_codes
        WHERE code_hash = $1
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE`,
      [codeHash]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, error: '驗證碼錯誤,請重新申請' });
    }

    const row = rows[0];

    if (row.status !== 'pending') {
      await client.query('ROLLBACK');
      const msg = row.status === 'used' ? '驗證碼已使用' : '驗證碼已失效,請重新申請';
      return res.status(400).json({ ok: false, error: msg });
    }

    if (new Date(row.expires_at) < new Date()) {
      await client.query(
        `UPDATE verification_codes SET status = 'expired' WHERE id = $1`,
        [row.id]
      );
      await client.query('COMMIT');
      return res.status(400).json({ ok: false, error: '驗證碼已過期,請重新申請' });
    }

    const decryptedRecno = decrypt(row.recno_encrypted, row.key_version);
    const recnoHash = hmacSha256(decryptedRecno);
    const userIdHash = hmacSha256(lineUserId);
    const { payload: encryptedLineId } = encrypt(lineUserId);
    const { payload: encryptedRecno } = encrypt(decryptedRecno);

    const existing = await client.query(
      `SELECT id FROM line_user_links
         WHERE user_id_hash = $1 AND recno_hash = $2 AND status = 'active'`,
      [userIdHash, recnoHash]
    );

    let linkId;
    if (existing.rows.length > 0) {
      linkId = existing.rows[0].id;
    } else {
      const linkResult = await client.query(
        `INSERT INTO line_user_links
            (encrypted_line_id, encrypted_recno, user_id_hash, recno_hash, key_version, status)
         VALUES ($1, $2, $3, $4, $5, 'active')
         RETURNING id`,
        [encryptedLineId, encryptedRecno, userIdHash, recnoHash, CURRENT_KEY_VERSION]
      );
      linkId = linkResult.rows[0].id;

      await client.query(
        `INSERT INTO line_user_links_history (link_id, user_id_hash, recno_hash, action)
         VALUES ($1, $2, $3, 'bind')`,
        [linkId, userIdHash, recnoHash]
      );
    }

    await client.query(
      `UPDATE verification_codes SET status = 'used', used_at = now() WHERE id = $1`,
      [row.id]
    );

    await client.query('COMMIT');

    return res.status(200).json({ ok: true, data: { linkId } });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[verify] error:', err);
    return res.status(500).json({ ok: false, error: '系統錯誤,請稍後再試' });
  } finally {
    client.release();
  }
});

// ─── Job A: 每 5 分鐘標記過期驗證碼 ───
app.post('/api/cleanup/mark-expired', express.json(), async (req, res) => {
  const providedKey = req.get('x-cleanup-api-key');
  if (!process.env.CLEANUP_API_KEY || providedKey !== process.env.CLEANUP_API_KEY) {
    return res.status(401).json({ ok: false, error: '未授權' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE verification_codes
          SET status = 'expired'
        WHERE status = 'pending'
          AND expires_at < now()`
    );
    return res.status(200).json({ ok: true, data: { updated: result.rowCount } });
  } catch (err) {
    console.error('[mark-expired] error:', err);
    return res.status(500).json({ ok: false, error: '系統錯誤,請稍後再試' });
  } finally {
    client.release();
  }
});

// ─── Job B: 每天搬移舊記錄到 archive ───
app.post('/api/cleanup/archive-old', express.json(), async (req, res) => {
  const providedKey = req.get('x-cleanup-api-key');
  if (!process.env.CLEANUP_API_KEY || providedKey !== process.env.CLEANUP_API_KEY) {
    return res.status(401).json({ ok: false, error: '未授權' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const archiveResult = await client.query(
      `INSERT INTO verification_codes_archive
         (id, code_hash, recno_encrypted, recno_hash, key_version,
          created_at, expires_at, attempt_count, status, used_at)
       SELECT id, code_hash, recno_encrypted, recno_hash, key_version,
              created_at, expires_at, attempt_count, status, used_at
         FROM verification_codes
        WHERE status IN ('used', 'expired', 'failed')
       ON CONFLICT (id) DO NOTHING
       RETURNING id`
    );

    const archivedIds = archiveResult.rows.map((r) => r.id);

    let deletedCount = 0;
    if (archivedIds.length > 0) {
      const deleteResult = await client.query(
        `DELETE FROM verification_codes WHERE id = ANY($1::bigint[])`,
        [archivedIds]
      );
      deletedCount = deleteResult.rowCount;
    }

    await client.query('COMMIT');
    return res.status(200).json({ ok: true, data: { archived: archivedIds.length, deleted: deletedCount } });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[archive-old] error:', err);
    return res.status(500).json({ ok: false, error: '系統錯誤,請稍後再試' });
  } finally {
    client.release();
  }
});

// ─── 舊的 /api/cleanup（保留向後相容）───
app.post('/api/cleanup', express.json(), async (req, res) => {
  const providedKey = req.get('x-cleanup-api-key');
  if (!process.env.CLEANUP_API_KEY || providedKey !== process.env.CLEANUP_API_KEY) {
    return res.status(401).json({ ok: false, error: '未授權' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE verification_codes
          SET status = 'expired'
        WHERE status = 'pending'
          AND expires_at < now()`
    );

    const archiveResult = await client.query(
      `INSERT INTO verification_codes_archive
         (id, code_hash, recno_encrypted, recno_hash, key_version,
          created_at, expires_at, attempt_count, status, used_at)
       SELECT id, code_hash, recno_encrypted, recno_hash, key_version,
              created_at, expires_at, attempt_count, status, used_at
         FROM verification_codes
        WHERE status IN ('used', 'expired', 'failed')
       ON CONFLICT (id) DO NOTHING
       RETURNING id`
    );

    const archivedIds = archiveResult.rows.map((r) => r.id);

    let deletedCount = 0;
    if (archivedIds.length > 0) {
      const deleteResult = await client.query(
        `DELETE FROM verification_codes WHERE id = ANY($1::bigint[])`,
        [archivedIds]
      );
      deletedCount = deleteResult.rowCount;
    }

    await client.query('COMMIT');
    return res.status(200).json({ ok: true, data: { archived: archivedIds.length, deleted: deletedCount } });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[cleanup] error:', err);
    return res.status(500).json({ ok: false, error: '系統錯誤,請稍後再試' });
  } finally {
    client.release();
  }
});

// 查詢綁定資料（供主程式 LINE Bot 呼叫）
app.get('/api/query-bindings', async (req, res) => {
  const { lineUserId } = req.query || {};
  
  if (!lineUserId) {
    return res.status(400).json({ ok: false, error: '缺少 lineUserId' });
  }
  
  const client = await pool.connect();
  try {
    const userIdHash = hmacSha256(lineUserId);
    
    const { rows } = await client.query(
      `SELECT lul.id as link_id, lul.encrypted_recno, lul.key_version, lul.linked_at,
              lul.status
         FROM line_user_links lul
        WHERE lul.user_id_hash = $1
          AND lul.status = 'active'
        ORDER BY lul.linked_at DESC`,
      [userIdHash]
    );
    
    if (rows.length === 0) {
      return res.json({ ok: true, data: [] });
    }
    
    let displayName = 'LINE 用戶';
    try {
      const profile = await lineClient.getProfile(lineUserId);
      displayName = profile.displayName || displayName;
    } catch (profileErr) {
      console.error('[query-bindings] getProfile error:', profileErr.message);
    }
    
    const bindings = rows.map(row => {
      let recno = '********';
      try {
        recno = decrypt(row.encrypted_recno, row.key_version);
        recno = recno.slice(0, 1) + '*****' + recno.slice(-1);
      } catch (e) {
        console.error('[query-bindings] decrypt error:', e.message);
      }
      return {
        link_id: row.link_id,
        recno,
        display_name: displayName,
        linked_at: row.linked_at,
        status: row.status
      };
    });
    
    return res.json({ ok: true, data: bindings });
  } catch (err) {
    console.error('[query-bindings] error:', err);
    return res.status(500).json({ ok: false, error: '系統錯誤,請稍後再試' });
  } finally {
    client.release();
  }
});

// ── LINE Postback 處理 ──
async function handlePostback(event) {
  const userId = event.source.userId;
  if (!userId) return;

  const rawData = event.postback.data || '';
  const params = new URLSearchParams(rawData);
  const action = params.get('action');

  switch (action) {
    case 'query_bindings':
      return handleQueryBindings(event.replyToken, userId);
    case 'unbind_confirm':
      return handleUnbindConfirm(event.replyToken, userId, params.get('link_id'));
    case 'unbind_execute':
      return handleUnbindExecute(event.replyToken, userId, params.get('link_id'));
    case 'unbind_cancel':
      return handleUnbindCancel(event.replyToken);
    default:
      return lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: '未知的操作，請重新點選選單。',
      });
  }
}

async function handleQueryBindings(replyToken, userId) {
  const client = await pool.connect();
  try {
    const userIdHash = hmacSha256(userId);
    const { rows } = await client.query(
      `SELECT id as link_id, encrypted_recno, key_version, linked_at
         FROM line_user_links
        WHERE user_id_hash = $1 AND status = 'active'
        ORDER BY linked_at DESC`,
      [userIdHash]
    );

    let displayName = 'LINE 用戶（名稱取得失敗）';
    try {
      const profile = await lineClient.getProfile(userId);
      displayName = profile.displayName || displayName;
    } catch (e) {
      console.error('[query_bindings] getProfile error:', e.message);
    }

    if (rows.length === 0) {
      return lineClient.replyMessage(replyToken, {
        type: 'text',
        text: '目前沒有綁定任何就醫帳號。\n若有疑問請洽櫃台。',
      });
    }

    const linkedAt = (date) => {
      const d = new Date(date);
      const fmt = (n) => n.toString().padStart(2, '0');
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const hour = d.getHours();
      const min = fmt(d.getMinutes());
      const ampm = hour < 12 ? '上午' : '下午';
      const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${year}年${month}月${day}日 ${ampm}${h12}:${min} 綁定`;
    };

    const bubbles = rows.map((row) => {
      let recnoMasked = '****';
      try {
        const recno = decrypt(row.encrypted_recno, row.key_version);
        recnoMasked = recno.slice(0, 4) + '****' + recno.slice(-2);
      } catch (e) {
        console.error('[query_bindings] decrypt error:', e.message);
      }

      return {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'text', text: displayName, weight: 'bold', size: 'md' },
            { type: 'text', text: `就醫卡號：${recnoMasked}`, margin: '8px', size: 'sm', color: '#555555' },
            { type: 'text', text: linkedAt(row.linked_at), margin: '4px', size: 'xs', color: '#888888' },
            { type: 'text', text: '點「查詢就醫資訊」查看詳情', margin: '12px', size: 'xs', color: '#0088FF' },
          ],
        },
      };
    });

    return lineClient.replyMessage(replyToken, {
      type: 'flex',
      altText: '您的就醫帳號綁定列表',
      contents: { type: 'carousel', contents: bubbles },
    });
  } catch (err) {
    console.error('[query_bindings] error:', err);
    return lineClient.replyMessage(replyToken, {
      type: 'text',
      text: '❌ 系統錯誤，請稍後再試。',
    });
  } finally {
    client.release();
  }
}

async function handleUnbindConfirm(replyToken, userId, linkId) {
  if (!linkId) {
    return lineClient.replyMessage(replyToken, {
      type: 'text',
      text: '❌ 參數錯誤，請重新操作。',
    });
  }

  return lineClient.replyMessage(replyToken, {
    type: 'flex',
    altText: '確認取消綁定',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '⚠️ 確認取消綁定', weight: 'bold', size: 'lg' },
          { type: 'text', text: '解除後將無法透過 LINE 查詢看診進度，需重新至櫃台綁定。', margin: '12px', size: 'sm', color: '#555555', wrap: true },
        ],
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '是，解除綁定',
              displayText: '是，解除綁定',
              data: `action=unbind_execute&link_id=${linkId}`,
            },
            style: 'primary',
            color: '#CC0000',
          },
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '否，返回',
              displayText: '否，返回',
              data: 'action=query_bindings',
            },
            style: 'secondary',
          },
        ],
      },
    },
  });
}

async function handleUnbindExecute(replyToken, userId, linkId) {
  if (!linkId) {
    return lineClient.replyMessage(replyToken, {
      type: 'text',
      text: '❌ 參數錯誤，請重新操作。',
    });
  }

  const client = await pool.connect();
  try {
    const userIdHash = hmacSha256(userId);

    const { rows } = await client.query(
      `SELECT id, user_id_hash FROM line_user_links
        WHERE id = $1 AND status = 'active' FOR UPDATE`,
      [linkId]
    );

    if (rows.length === 0) {
      return lineClient.replyMessage(replyToken, {
        type: 'text',
        text: '❌ 找不到此綁定記錄，可能已解除。',
      });
    }

    if (rows[0].user_id_hash !== userIdHash) {
      return lineClient.replyMessage(replyToken, {
        type: 'text',
        text: '❌ 無權限操作此綁定。',
      });
    }

    await client.query('BEGIN');

    await client.query(
      `UPDATE line_user_links SET status = 'unbound' WHERE id = $1`,
      [linkId]
    );

    await client.query(
      `INSERT INTO line_user_links_history (link_id, user_id_hash, recno_hash, action)
       VALUES ($1, $2, (SELECT recno_hash FROM line_user_links WHERE id = $1), 'unbind')`,
      [linkId, userIdHash]
    );

    await client.query('COMMIT');

    return lineClient.replyMessage(replyToken, {
      type: 'text',
      text: '✅ 已解除綁定。未來如需使用 LINE 查詢功能，請至櫃台重新綁定。',
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[unbind_execute] error:', err);
    return lineClient.replyMessage(replyToken, {
      type: 'text',
      text: '❌ 系統錯誤，請稍後再試。',
    });
  } finally {
    client.release();
  }
}

async function handleUnbindCancel(replyToken) {
  return lineClient.replyMessage(replyToken, {
    type: 'text',
    text: '已取消',
  });
}

// ─── 內部 API：查詢 linkId by recno_hash（供櫃台系統呼叫）───
app.get('/api/admin/links-by-recno-hash', async (req, res) => {
  const providedKey = req.get('x-unbind-api-key');
  if (!process.env.UNBIND_API_KEY || providedKey !== process.env.UNBIND_API_KEY) {
    return res.status(401).json({ ok: false, error: '未授權' });
  }
  const { recno_hash } = req.query || {};
  if (!recno_hash) {
    return badRequest(res, '缺少 recno_hash');
  }
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id as link_id, status, linked_at FROM line_user_links
        WHERE recno_hash = $1 AND status = 'active' LIMIT 1`,
      [recno_hash]
    );
    if (rows.length === 0) {
      return res.json({ ok: true, data: null });
    }
    return res.json({ ok: true, data: { linkId: rows[0].link_id, status: rows[0].status, linked_at: rows[0].linked_at } });
  } catch (err) {
    console.error('[links-by-recno-hash] error:', err);
    return res.status(500).json({ ok: false, error: '系統錯誤,請稍後再試' });
  } finally {
    client.release();
  }
});

// ─── 內部 API：查詢完整 recno by link_id（供 LINE Bot 慢性病查詢用）───
app.get('/api/admin/recno-by-link', async (req, res) => {
  const providedKey = req.get('x-unbind-api-key');
  if (!process.env.UNBIND_API_KEY || providedKey !== process.env.UNBIND_API_KEY) {
    return res.status(401).json({ ok: false, error: '未授權' });
  }
  const { link_id } = req.query || {};
  if (!link_id) {
    return badRequest(res, '缺少 link_id');
  }
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT encrypted_recno, key_version FROM line_user_links
        WHERE id = $1 AND status = 'active' LIMIT 1`,
      [link_id]
    );
    if (rows.length === 0) {
      return res.json({ ok: false, error: '找不到' });
    }
    const recno = decrypt(rows[0].encrypted_recno, rows[0].key_version);
    return res.json({ ok: true, data: { recno } });
  } catch (err) {
    console.error('[recno-by-link] error:', err);
    return res.status(500).json({ ok: false, error: '系統錯誤,請稍後再試' });
  } finally {
    client.release();
  }
});

// ─── 內部 API：取消綁定（供櫃台系統呼叫）───
app.post('/api/admin/unbind', express.json(), async (req, res) => {
  const providedKey = req.get('x-unbind-api-key');
  if (!process.env.UNBIND_API_KEY || providedKey !== process.env.UNBIND_API_KEY) {
    return res.status(401).json({ ok: false, error: '未授權' });
  }
  const { linkId } = req.body || {};
  if (!linkId) {
    return badRequest(res, '缺少 linkId');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id, user_id_hash, recno_hash, status FROM line_user_links WHERE id = $1 FOR UPDATE`,
      [linkId]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, error: '找不到此綁定記錄' });
    }
    if (rows[0].status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, error: `此綁定已於先前解除` });
    }
    await client.query(`UPDATE line_user_links SET status = 'unbound' WHERE id = $1`, [linkId]);
    await client.query(
      `INSERT INTO line_user_links_history (link_id, user_id_hash, recno_hash, action) VALUES ($1, $2, $3, 'unbind')`,
      [linkId, rows[0].user_id_hash, rows[0].recno_hash]
    );
    await client.query('COMMIT');
    return res.json({ ok: true, data: { linkId, status: 'unbound' } });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[admin/unbind] error:', err);
    return res.status(500).json({ ok: false, error: '系統錯誤,請稍後再試' });
  } finally {
    client.release();
  }
});

// ─── 舊的 /api/unbind（維持無 key，給 LINE Webhook 用）───
app.post('/api/unbind', express.json(), async (req, res) => {
  const { linkId } = req.body || {};

  if (!linkId) {
    return badRequest(res, '缺少必填欄位 linkId');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT id, user_id_hash, recno_hash, status FROM line_user_links
        WHERE id = $1 FOR UPDATE`,
      [linkId]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, error: '找不到此綁定記錄' });
    }

    if (rows[0].status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, error: `此綁定已於先前解除（status=${rows[0].status}）` });
    }

    await client.query(
      `UPDATE line_user_links SET status = 'unbound' WHERE id = $1`,
      [linkId]
    );

    await client.query(
      `INSERT INTO line_user_links_history (link_id, user_id_hash, recno_hash, action)
       VALUES ($1, $2, $3, 'unbind')`,
      [linkId, rows[0].user_id_hash, rows[0].recno_hash]
    );

    await client.query('COMMIT');

    return res.json({ ok: true, data: { linkId, status: 'unbound' } });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[unbind] error:', err);
    return res.status(500).json({ ok: false, error: '系統錯誤,請稍後再試' });
  } finally {
    client.release();
  }
});

app.post('/api/line-webhook',
  middleware({ channelSecret: process.env.LINE_CHANNEL_SECRET }),
  async (req, res) => {
    const events = req.body.events || [];

    const results = await Promise.all(events.map(async (event) => {
      if (event.type === 'postback') {
        return handlePostback(event);
      }
      if (event.type !== 'message' || event.message.type !== 'text') return;

      const userId = event.source.userId;
      const code = event.message.text.trim();

      if (!userId) return;

      if (/^\d{6}$/.test(code)) {
        try {
          const verifyRes = await fetch(`${API_BASE_URL}/api/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, lineUserId: userId }),
          });
          const result = await verifyRes.json();
          const msg = result.ok
            ? '✅ 綁定成功！您的手機已與診所系統連結，未來可透過 LINE 查詢看診進度。'
            : `❌ 綁定失敗：${result.error}`;
          await lineClient.replyMessage(event.replyToken, { type: 'text', text: msg });
        } catch (err) {
          console.error('[line-webhook] verify error:', err);
          await lineClient.replyMessage(event.replyToken, {
            type: 'text',
            text: '❌ 系統錯誤，請稍後再試或聯繫診所。',
          });
        }
      } else {
        await lineClient.replyMessage(event.replyToken, {
          type: 'text',
          text: '請輸入收到的 6 位數驗證碼，若無驗證碼請至櫃台索取。',
        });
      }
    }));

    res.json({ ok: true });
  }
);

const PORT = parseInt(process.env.PORT || '8081', 10);
if (require.main === module) {
  initPool().then(() => {
    app.listen(PORT, () => {
      console.log(`LINE 帳號綁定 API 已啟動,監聽埠號 ${PORT}`);
    });
  }).catch((err) => {
    console.error('[initPool] failed:', err);
    process.exit(1);
  });
}

module.exports = app;