'use strict';

const crypto = require('crypto');

const CURRENT_KEY_VERSION = parseInt(process.env.APP_KEY_CURRENT_VERSION || '1', 10);

function loadKey(version) {
  const envName = `APP_KEY_V${version}`;
  const raw = process.env[envName];
  if (!raw) {
    throw new Error(`缺少金鑰設定: 找不到環境變數 ${envName} (key_version=${version})`);
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(`金鑰長度錯誤: ${envName} 解碼後應為 32 bytes,實際為 ${key.length} bytes`);
  }
  return key;
}

const _keyCache = new Map();
function getKey(version) {
  if (!_keyCache.has(version)) {
    _keyCache.set(version, loadKey(version));
  }
  return _keyCache.get(version);
}

function sha256(data) {
  if (data === undefined || data === null) {
    throw new Error('sha256: data 不可為空');
  }
  return crypto.createHash('sha256').update(String(data), 'utf8').digest('hex');
}

function hmacSha256(data, keyVersion = CURRENT_KEY_VERSION) {
  if (data === undefined || data === null) {
    throw new Error('hmacSha256: data 不可為空');
  }
  const key = getKey(keyVersion);
  return crypto.createHmac('sha256', key).update(String(data), 'utf8').digest('hex');
}

function verifyHash(data, expectedHashHex, keyVersion = CURRENT_KEY_VERSION) {
  const actual = Buffer.from(hmacSha256(data, keyVersion), 'hex');
  const expected = Buffer.from(expectedHashHex, 'hex');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;

function encrypt(plaintext, keyVersion = CURRENT_KEY_VERSION) {
  if (plaintext === undefined || plaintext === null) {
    throw new Error('encrypt: plaintext 不可為空');
  }
  const key = getKey(keyVersion);
  const iv = crypto.randomBytes(GCM_IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: GCM_TAG_LENGTH });

  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const payload = [
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');

  return { payload, keyVersion };
}

function decrypt(payload, keyVersion) {
  if (!payload || typeof payload !== 'string') {
    throw new Error('decrypt: payload 格式錯誤');
  }
  if (keyVersion === undefined || keyVersion === null) {
    throw new Error('decrypt: 必須提供該筆資料的 key_version');
  }

  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('decrypt: payload 格式錯誤,應為 "iv:authTag:ciphertext"');
  }
  const [ivB64, tagB64, dataB64] = parts;

  const key = getKey(keyVersion);
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(dataB64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, { authTagLength: GCM_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

module.exports = {
  CURRENT_KEY_VERSION,
  sha256,
  hmacSha256,
  verifyHash,
  encrypt,
  decrypt,
};