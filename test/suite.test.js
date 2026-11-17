import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  hashPassword,
  verifyPassword,
  tokenHash,
  newToken,
  readToken
} from '../backend/src/security.js';

import {
  validatePhotos
} from '../backend/src/photos.js';

import {
  validateRegistrationInput,
  validateOfferLimits,
  validateAddressLimits,
  LIMITS
} from '../backend/src/validation.js';

describe('Owl Pai Lei Test Suite — CBE205 Week 13', () => {

  // ── REQ1: Password Boundaries & Length Constraints ────────────────────────
  describe('REQ1 — Registration Password Boundaries', () => {
    test('TC1 (Negative Boundary): Rejects password shorter than 8 characters', () => {
      const result = validateRegistrationInput({
        full_name: 'Somchai Jaidee',
        email: 'somchai@example.com',
        password: 'a'.repeat(7) // 7 chars -> Boundary negative
      });
      assert.equal(result.valid, false);
      assert.match(result.error, /at least 8 characters/i);
    });

    test('TC2 (Positive Boundary): Accepts password of exactly 8 characters', () => {
      const result = validateRegistrationInput({
        full_name: 'Somchai Jaidee',
        email: 'somchai@example.com',
        password: 'a'.repeat(8) // 8 chars -> Boundary positive
      });
      assert.equal(result.valid, true);
    });

    test('TC3 (Positive Boundary): Accepts password of exactly 200 characters', () => {
      const result = validateRegistrationInput({
        full_name: 'Somchai Jaidee',
        email: 'somchai@example.com',
        password: 'a'.repeat(200) // 200 chars -> Boundary positive
      });
      assert.equal(result.valid, true);
    });

    test('TC4 (Negative Boundary): Rejects password exceeding 200 characters', () => {
      const result = validateRegistrationInput({
        full_name: 'Somchai Jaidee',
        email: 'somchai@example.com',
        password: 'a'.repeat(201) // 201 chars -> Boundary negative
      });
      assert.equal(result.valid, false);
      assert.match(result.error, /200 characters or fewer/i);
    });
  });

  // ── REQ2: Cryptographic Password Hashing & Verification ───────────────────
  describe('REQ2 — Password Hashing & Constant-Time Verification', () => {
    test('Malformed or missing stored passwords fail without throwing', () => {
      for (const stored of [null, undefined, '', 'broken', 'salt:zz', 'a:b:c']) {
        assert.equal(verifyPassword('TestPassword123!', stored), false);
      }
    });

    test('TC5 (Positive): Correctly hashes and verifies a valid password', () => {
      const plain = 'SuperSecret123!';
      const hash = hashPassword(plain);
      assert.ok(hash.includes(':'), 'Hash must contain salt delimiter');
      const isValid = verifyPassword(plain, hash);
      assert.equal(isValid, true);
    });

    test('TC6 (Negative): Rejects incorrect password verification', () => {
      const hash = hashPassword('CorrectPass123');
      const isValid = verifyPassword('WrongPass456', hash);
      assert.equal(isValid, false);
    });

    test('TC7 (Negative): Rejects tampered salt/hash verification', () => {
      const hash = hashPassword('CorrectPass123');
      const [salt, hex] = hash.split(':');
      const tamperedHex = hex.slice(0, -2) + 'ff';
      assert.equal(verifyPassword('CorrectPass123', `${salt}:${tamperedHex}`), false);
    });
  });

  // ── REQ3: Email Format and Boundary Constraints ───────────────────────────
  describe('REQ3 — Email Validation Boundaries', () => {
    test('TC8 (Negative): Rejects email lacking @ or domain', () => {
      assert.equal(validateRegistrationInput({ full_name: 'User', email: 'invalid-email', password: 'password123' }).valid, false);
      assert.equal(validateRegistrationInput({ full_name: 'User', email: 'user@', password: 'password123' }).valid, false);
      assert.equal(validateRegistrationInput({ full_name: 'User', email: '@domain.com', password: 'password123' }).valid, false);
    });

    test('TC9 (Boundary Negative): Rejects email exceeding 254 characters', () => {
      const longEmail = 'a'.repeat(245) + '@test.com'; // 254 characters
      const overLongEmail = 'a'.repeat(246) + '@test.com'; // 255 characters
      assert.equal(validateRegistrationInput({ full_name: 'User', email: longEmail, password: 'password123' }).valid, true);
      assert.equal(validateRegistrationInput({ full_name: 'User', email: overLongEmail, password: 'password123' }).valid, false);
    });
  });

  // ── REQ4: Seller Offer Price & Quantity Boundaries ────────────────────────
  describe('REQ4 — Seller Offer Price & Quantity Boundaries', () => {
    test('TC10 (Boundary Negative): Rejects non-positive or zero price', () => {
      assert.equal(validateOfferLimits({ price: 0, quantity: 1 }).valid, false);
      assert.equal(validateOfferLimits({ price: -10, quantity: 1 }).valid, false);
    });

    test('TC11 (Boundary Positive): Accepts valid positive price and quantity', () => {
      assert.equal(validateOfferLimits({ price: 3499.00, quantity: 1 }).valid, true);
      assert.equal(validateOfferLimits({ price: 0.01, quantity: 1 }).valid, true);
      assert.equal(validateOfferLimits({ price: 9999999999.00, quantity: 100000 }).valid, true);
    });

    test('TC12 (Boundary Negative): Rejects fractional quantity or quantity exceeding 100,000', () => {
      assert.equal(validateOfferLimits({ price: 100, quantity: 0 }).valid, false);
      assert.equal(validateOfferLimits({ price: 100, quantity: 1.5 }).valid, false);
      assert.equal(validateOfferLimits({ price: 100, quantity: 100001 }).valid, false);
    });

    test('TC13 (Precision Negative): Rejects prices with more than 2 decimal places', () => {
      assert.equal(validateOfferLimits({ price: 12.345, quantity: 1 }).valid, false);
      assert.equal(validateOfferLimits({ price: 12.34, quantity: 1 }).valid, true);
    });
  });

  // ── REQ5: Photo Upload Security & Boundaries ──────────────────────────────
  describe('REQ5 — Photo Upload Boundaries & MIME Validation', () => {
    const validPngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]).toString('base64');
    const validPngPhoto = `data:image/png;base64,${validPngHeader}`;

    test('TC14 (Boundary Negative): Rejects attaching more than 3 photos', () => {
      const fourPhotos = [
        validPngPhoto,
        `data:image/png;base64,${Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]).toString('base64')}`,
        `data:image/png;base64,${Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 2]).toString('base64')}`,
        `data:image/png;base64,${Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 3]).toString('base64')}`
      ];
      assert.throws(() => validatePhotos(fourPhotos), /Attach up to 3 photos/);
    });

    test('TC15 (Negative): Rejects duplicate identical photos', () => {
      assert.throws(() => validatePhotos([validPngPhoto, validPngPhoto]), /attached twice/);
    });

    test('TC16 (Negative Security): Rejects file where content does not match MIME magic bytes', () => {
      const spoofedPhoto = 'data:image/png;base64,' + Buffer.from('NOT_A_REAL_PNG').toString('base64');
      assert.throws(() => validatePhotos([spoofedPhoto]), /does not match its file type/);
    });
  });

  // ── REQ6: Authentication Token Extraction ─────────────────────────────────
  describe('REQ6 — Session Token Extraction & Integrity', () => {
    test('TC17 (Positive): Extracts Bearer token from authorization header', () => {
      const req = { headers: { authorization: 'Bearer secret_token_abc' } };
      assert.equal(readToken(req), 'secret_token_abc');
    });

    test('TC18 (Positive): Extracts token from cookie without collision', () => {
      const req = { headers: { cookie: 'other=123; owl_session=my_session_token; theme=dark' } };
      assert.equal(readToken(req), 'my_session_token');
    });

    test('TC19 (Negative): Returns empty string when neither bearer nor cookie is present', () => {
      assert.equal(readToken({ headers: {} }), '');
    });

    test('TC20 (Integrity): Generates deterministic SHA-256 token hash', () => {
      const token = 'sample_token_value';
      const hash1 = tokenHash(token);
      const hash2 = tokenHash(token);
      assert.equal(hash1, hash2);
      assert.equal(hash1.length, 64);
    });
  });

  // ── REQ7: Home Address Validation ─────────────────────────────────────────
  describe('REQ7 — Home Address Field Validation', () => {
    test('TC21 (Positive): Validates complete home address', () => {
      const addr = {
        recipientName: 'Somchai Jaidee',
        phone: '0812345678',
        addressLine: '123/4 Rama IV Road',
        district: 'Bang Rak',
        province: 'Bangkok',
        postalCode: '10500'
      };
      assert.equal(validateAddressLimits(addr).valid, true);
    });

    test('TC22 (Negative): Rejects incomplete address missing required fields', () => {
      const incomplete = { recipientName: 'Somchai', phone: '0812345678' };
      assert.equal(validateAddressLimits(incomplete).valid, false);
    });
  });
});
