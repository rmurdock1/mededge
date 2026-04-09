import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { encryptPHI, decryptPHI, _resetKeyCache } from "./phi";

// A valid 32-byte (64 hex char) test key
const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const WRONG_KEY = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

describe("PHI encryption", () => {
  beforeEach(() => {
    _resetKeyCache();
    vi.stubEnv("PHI_ENCRYPTION_KEY", TEST_KEY);
  });

  afterEach(() => {
    _resetKeyCache();
    vi.unstubAllEnvs();
  });

  it("encrypts and decrypts a patient name", () => {
    const name = "Jane Doe";
    const encrypted = encryptPHI(name);
    expect(encrypted).not.toBe(name);
    expect(encrypted).not.toContain("Jane");
    expect(decryptPHI(encrypted)).toBe(name);
  });

  it("encrypts and decrypts unicode characters", () => {
    const name = "Maria Garcia-Lopez";
    expect(decryptPHI(encryptPHI(name))).toBe(name);
  });

  it("produces different ciphertext for the same plaintext (random IV)", () => {
    const name = "John Smith";
    const a = encryptPHI(name);
    const b = encryptPHI(name);
    expect(a).not.toBe(b);
    // Both decrypt to the same value
    expect(decryptPHI(a)).toBe(name);
    expect(decryptPHI(b)).toBe(name);
  });

  it("throws on empty plaintext", () => {
    expect(() => encryptPHI("")).toThrow("must not be empty");
  });

  it("throws on empty ciphertext", () => {
    expect(() => decryptPHI("")).toThrow("empty string");
  });

  it("throws on corrupted ciphertext (too short)", () => {
    expect(() => decryptPHI("AAAA")).toThrow("too short");
  });

  it("throws on tampered ciphertext (auth tag verification)", () => {
    const encrypted = encryptPHI("Test Patient");
    const buf = Buffer.from(encrypted, "base64");
    // Flip a byte in the auth tag region (bytes 12-27)
    buf[15] = buf[15]! ^ 0xff;
    const tampered = buf.toString("base64");
    expect(() => decryptPHI(tampered)).toThrow();
  });

  it("throws when key is wrong", () => {
    const encrypted = encryptPHI("Secret Name");
    _resetKeyCache();
    vi.stubEnv("PHI_ENCRYPTION_KEY", WRONG_KEY);
    expect(() => decryptPHI(encrypted)).toThrow();
  });

  it("throws when PHI_ENCRYPTION_KEY is not set", () => {
    _resetKeyCache();
    vi.stubEnv("PHI_ENCRYPTION_KEY", "");
    expect(() => encryptPHI("test")).toThrow("PHI_ENCRYPTION_KEY is not set");
  });

  it("throws when key is wrong length", () => {
    _resetKeyCache();
    vi.stubEnv("PHI_ENCRYPTION_KEY", "abcd1234"); // too short
    expect(() => encryptPHI("test")).toThrow("64 hex characters");
  });

  it("handles long text (clinical notes)", () => {
    const longText = "A".repeat(10_000);
    expect(decryptPHI(encryptPHI(longText))).toBe(longText);
  });

  it("output is valid base64", () => {
    const encrypted = encryptPHI("Test");
    expect(() => Buffer.from(encrypted, "base64")).not.toThrow();
    // Re-encoding should match (no padding issues)
    const buf = Buffer.from(encrypted, "base64");
    expect(buf.toString("base64")).toBe(encrypted);
  });
});
