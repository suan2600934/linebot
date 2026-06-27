'use strict';

const express = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');
const {
  hmacSha256,
  encrypt,
  decrypt,
  CURRENT_KEY_VERSION,
} = require('./crypto-utils');

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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
  const { recno, code, lineUserId } = req.body || {};

  if (!recno || !code || !lineUserId) {
    return badRequest(res, '缺少必填欄位 recno / code / lineUserId');
  }

  const client = await pool.connect();
  try {
    const recnoHash = hmacSha256(recno);

    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT id, code_hash, recno_encrypted, key_version, attempt_count, expires_at
         FROM verification_codes
        WHERE recno_hash = $1
          AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE`,
      [recnoHash]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, error: '找不到有效的驗證碼,請重新申請' });
    }

    const row = rows[0];

    if (new Date(row.expires_at) < new Date()) {
      await client.query(
        `UPDATE verification_codes SET status = 'expired' WHERE id = $1`,
        [row.id]
      );
      await client.query('COMMIT');
      return res.status(400).json({ ok: false, error: '驗證碼已過期,請重新申請' });
    }

    const inputCodeHash = hmacSha256(code, row.key_version);
    const isMatch =
      inputCodeHash.length === row.code_hash.length &&
      crypto.timingSafeEqual(Buffer.from(inputCodeHash, 'hex'), Buffer.from(row.code_hash, 'hex'));

    if (!isMatch) {
      const newAttemptCount = row.attempt_count + 1;
      const reachedLimit = newAttemptCount >= VERIFY_MAX_ATTEMPTS;

      await client.query(
        `UPDATE verification_codes
            SET attempt_count = $1,
                status = $2
          WHERE id = $3`,
        [newAttemptCount, reachedLimit ? 'failed' : 'pending', row.id]
      );
      await client.query('COMMIT');

      if (reachedLimit) {
        return res.status(400).json({ ok: false, error: '驗證碼錯誤次數過多,請重新申請' });
      }
      return res.status(400).json({
        ok: false,
        error: '驗證碼錯誤',
        remainingAttempts: VERIFY_MAX_ATTEMPTS - newAttemptCount,
      });
    }

    const decryptedRecno = decrypt(row.recno_encrypted, row.key_version);
    if (decryptedRecno !== recno) {
      await client.query('ROLLBACK');
      console.error('[verify] recno mismatch after decrypt, id=', row.id);
      return res.status(500).json({ ok: false, error: '系統錯誤,請稍後再試' });
    }

    const userIdHash = hmacSha256(lineUserId);
    const { payload: encryptedLineId } = encrypt(lineUserId);
    const { payload: encryptedRecno } = encrypt(recno);

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
      `UPDATE verification_codes
          SET status = 'used', used_at = now()
        WHERE id = $1`,
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

const PORT = parseInt(process.env.PORT || '3000', 10);
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`LINE 帳號綁定 API 已啟動,監聽埠號 ${PORT}`);
  });
}

module.exports = app;