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
app.use(express.json());

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

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function badRequest(res, message) {
  return res.status(400).json({ ok: false, error: message });
}

app.post('/api/create-verify-code', async (req, res) => {
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

app.post('/api/verify', async (req, res) => {
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

app.post('/api/cleanup', async (req, res) => {
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

    return res.status(200).json({
      ok: true,
      data: { archived: archivedIds.length, deleted: deletedCount },
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[cleanup] error:', err);
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
      if (event.type !== 'message' || event.message.type !== 'text') return;

      const userId = event.source.userId;
      const code = event.message.text.trim();

      if (!userId) return;

      if (/^\d{6}$/.test(code)) {
        try {
          const baseUrl = process.env.API_BASE_URL.replace(/\/$/, '');
          const verifyRes = await fetch(`${baseUrl}/api/verify`, {
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