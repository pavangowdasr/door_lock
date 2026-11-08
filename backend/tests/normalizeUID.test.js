import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUID, isValidHexUID } from '../src/utils/normalizeUID.js';

describe('normalizeUID Utility', () => {
  it('should normalize lowercase hex string to uppercase', () => {
    assert.equal(normalizeUID('cee4e857'), 'CEE4E857');
  });

  it('should strip internal and surrounding whitespace', () => {
    assert.equal(normalizeUID('  ce e4  e8 57  '), 'CEE4E857');
  });

  it('should strip colons and hyphens', () => {
    assert.equal(normalizeUID('ce:e4:e8:57'), 'CEE4E857');
    assert.equal(normalizeUID('CE-E4-E8-57'), 'CEE4E857');
  });

  it('should support 7-byte (14 hex chars) and 10-byte (20 hex chars) UIDs', () => {
    assert.equal(normalizeUID('04:53:e8:a2:1c:5b:80'), '0453E8A21C5B80');
    assert.equal(normalizeUID('01:02:03:04:05:06:07:08:09:0A'), '0102030405060708090A');
  });

  it('should throw for non-hex characters', () => {
    assert.throws(() => normalizeUID('CEE4E85G'), /Invalid RFID UID format/);
    assert.throws(() => normalizeUID('HELLO_WORLD'), /Invalid RFID UID format/);
  });

  it('should throw for empty or whitespace-only strings', () => {
    assert.throws(() => normalizeUID(''), /RFID UID cannot be empty/);
    assert.throws(() => normalizeUID('   '), /RFID UID cannot be empty/);
  });

  it('should throw for missing or non-string inputs', () => {
    assert.throws(() => normalizeUID(null), /must be a string/);
    assert.throws(() => normalizeUID(undefined), /must be a string/);
    assert.throws(() => normalizeUID(12345), /must be a string/);
    assert.throws(() => normalizeUID({}), /must be a string/);
  });

  it('isValidHexUID should return true for valid and false for invalid', () => {
    assert.equal(isValidHexUID('CEE4E857'), true);
    assert.equal(isValidHexUID('cee4 e857'), true);
    assert.equal(isValidHexUID('invalid!'), false);
    assert.equal(isValidHexUID(null), false);
  });
});
