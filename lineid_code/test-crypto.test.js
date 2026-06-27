'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

const KEY_V1_BASE64 = Buffer.alloc(32, 'a1').toString('base64');
const KEY_V2_BASE64 = Buffer.alloc(32, 'b2').toString('base64');

const originalEnv = { ...process.env };

function setupEnv() {
  process.env.APP_KEY_V1 = KEY_V1_BASE64;
  process.env.APP_KEY_V2 = KEY_V2_BASE64;
  process.env.APP_KEY_CURRENT_VERSION = '1';
}

function restoreEnv() {
  process.env = { ...originalEnv };
}

before(() => {
  setupEnv();
  delete require.cache[require.resolve('./crypto-utils.js')];
});

after(() => {
  restoreEnv();
});

const { sha256, hmacSha256, verifyHash, encrypt, decrypt, CURRENT_KEY_VERSION } = require('./crypto-utils.js');

describe('sha256', () => {
  it('given normal string, returns 64-char hex', () => {
    const result = sha256('hello');
    assert.strictEqual(result.length, 64);
    assert.match(result, /^[a-f0-9]{64}$/);
  });

  it('given same input, returns same output', () => {
    const r1 = sha256('test');
    const r2 = sha256('test');
    assert.strictEqual(r1, r2);
  });

  it('given different inputs, returns different outputs', () => {
    const r1 = sha256('a');
    const r2 = sha256('b');
    assert.notStrictEqual(r1, r2);
  });

  it('throws if data is null', () => {
    assert.throws(() => sha256(null), /不可為空/);
  });

  it('throws if data is undefined', () => {
    assert.throws(() => sha256(undefined), /不可為空/);
  });
});

describe('hmacSha256', () => {
  it('returns 64-char hex', () => {
    const result = hmacSha256('003245');
    assert.strictEqual(result.length, 64);
  });

  it('same input + same key = same output', () => {
    const r1 = hmacSha256('003245', 1);
    const r2 = hmacSha256('003245', 1);
    assert.strictEqual(r1, r2);
  });

  it('different input = different output', () => {
    const r1 = hmacSha256('003245', 1);
    const r2 = hmacSha256('003246', 1);
    assert.notStrictEqual(r1, r2);
  });

  it('different key version = different output', () => {
    const r1 = hmacSha256('003245', 1);
    const r2 = hmacSha256('003245', 2);
    assert.notStrictEqual(r1, r2);
  });

  it('uses CURRENT_KEY_VERSION by default', () => {
    const explicit = hmacSha256('test', CURRENT_KEY_VERSION);
    const implicit = hmacSha256('test');
    assert.strictEqual(explicit, implicit);
  });

  it('throws if data is null', () => {
    assert.throws(() => hmacSha256(null, 1), /不可為空/);
  });

  it('throws if data is undefined', () => {
    assert.throws(() => hmacSha256(undefined, 1), /不可為空/);
  });

  it('empty string is allowed (code does not forbid it)', () => {
    assert.strictEqual(hmacSha256('', 1).length, 64);
  });
});

describe('verifyHash', () => {
  it('returns true for matching data', () => {
    const hash = hmacSha256('123456', 1);
    assert.strictEqual(verifyHash('123456', hash, 1), true);
  });

  it('returns false for non-matching data', () => {
    const hash = hmacSha256('123456', 1);
    assert.strictEqual(verifyHash('654321', hash, 1), false);
  });

  it('returns false for wrong key version', () => {
    const hash = hmacSha256('123456', 1);
    assert.strictEqual(verifyHash('123456', hash, 2), false);
  });

  it('returns false for hash of different length', () => {
    assert.strictEqual(verifyHash('data', 'nota64characterhexstring', 1), false);
  });
});

describe('encrypt / decrypt', () => {
  it('encrypt returns { payload, keyVersion }', () => {
    const result = encrypt('003245', 1);
    assert.ok(result.payload);
    assert.ok(result.keyVersion !== undefined);
    assert.strictEqual(result.keyVersion, 1);
  });

  it('payload format is iv:authTag:ciphertext (2 colons)', () => {
    const { payload } = encrypt('test', 1);
    const parts = payload.split(':');
    assert.strictEqual(parts.length, 3);
    parts.forEach(p => assert.ok(Buffer.from(p, 'base64').length > 0));
  });

  it('encrypt is deterministic (different IV each time)', () => {
    const r1 = encrypt('003245', 1);
    const r2 = encrypt('003245', 1);
    assert.notStrictEqual(r1.payload, r2.payload);
  });

  it('decrypt returns original plaintext', () => {
    const plaintext = '003245';
    const { payload, keyVersion } = encrypt(plaintext, 1);
    const decrypted = decrypt(payload, keyVersion);
    assert.strictEqual(decrypted, plaintext);
  });

  it('decrypt works with keyVersion 2', () => {
    const plaintext = 'U123456789';
    const { payload, keyVersion } = encrypt(plaintext, 2);
    const decrypted = decrypt(payload, keyVersion);
    assert.strictEqual(decrypted, plaintext);
  });

  it('encrypted data with v1 can be decrypted with v1', () => {
    const { payload, keyVersion } = encrypt('recno-data', 1);
    assert.strictEqual(decrypt(payload, 1), 'recno-data');
  });

  it('encrypted data with v2 can be decrypted with v2', () => {
    const { payload, keyVersion } = encrypt('recno-data', 2);
    assert.strictEqual(decrypt(payload, 2), 'recno-data');
  });

  it('wrong key version fails to decrypt', () => {
    const { payload } = encrypt('secret', 1);
    assert.throws(() => decrypt(payload, 2), /authenticate/i);
  });

  it('throws if payload format is wrong', () => {
    assert.throws(() => decrypt('not-colons', 1), /格式錯誤/);
  });

  it('throws if payload has wrong number of parts', () => {
    assert.throws(() => decrypt('a:b', 1), /格式錯誤/);
  });

  it('throws if payload is empty string', () => {
    assert.throws(() => decrypt('', 1), /格式錯誤/);
  });

  it('throws if keyVersion not provided to decrypt', () => {
    const { payload } = encrypt('test', 1);
    assert.throws(() => decrypt(payload, null), /key_version/);
    assert.throws(() => decrypt(payload, undefined), /key_version/);
  });
});

describe('key rotation', () => {
  it('different key versions produce different hashes', () => {
    const v1 = hmacSha256('003245', 1);
    const v2 = hmacSha256('003245', 2);
    assert.notStrictEqual(v1, v2);
  });

  it('data encrypted with v1 cannot be decrypted with v2', () => {
    const { payload } = encrypt('secret', 1);
    assert.throws(() => decrypt(payload, 2), /authenticate/i);
  });

  it('data encrypted with v2 cannot be decrypted with v1', () => {
    const { payload } = encrypt('secret', 2);
    assert.throws(() => decrypt(payload, 1), /authenticate/i);
  });
});

describe('edge cases', () => {
  it('handles unicode characters', () => {
    const plaintext = '病歷號 003245';
    const { payload, keyVersion } = encrypt(plaintext, 1);
    assert.strictEqual(decrypt(payload, keyVersion), plaintext);
  });

  it('handles empty string encrypt', () => {
    const { payload, keyVersion } = encrypt('', 1);
    assert.strictEqual(decrypt(payload, keyVersion), '');
  });

  it('sha256 handles numeric input', () => {
    const result = sha256(12345);
    assert.strictEqual(result.length, 64);
  });

  it('hmacSha256 handles numeric input', () => {
    const result = hmacSha256(12345, 1);
    assert.strictEqual(result.length, 64);
  });
});