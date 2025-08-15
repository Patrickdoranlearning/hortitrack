// @ts-nocheck
/**
 * Integration tests for Firestore-backed rate limiter.
 *
 * Requires Firestore Emulator running on 127.0.0.1:8080 (default).
 * Start it in a separate terminal:
 *   npm run emu:firestore
 */

import { Timestamp } from "firebase-admin/firestore";
import { checkRateLimit } from "../rateLimit";

// Mock the admin DB to point at the emulator.
jest.mock("@/server/db/admin", () => {
  // Lazy-require inside the mock so Jest can control module load order
  // and so process.env is set before init.
  process.env.FIRESTORE_EMULATOR_HOST =
    process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";

  const { initializeApp, getApps } = require("firebase-admin/app");
  const { getFirestore } = require("firebase-admin/firestore");

  if (!getApps().length) {
    initializeApp();
  }
  return { adminDb: getFirestore() };
});

describe('checkRateLimit', () => {
  const ip = "127.0.0.1";
  const action = "test-action";
  const windowMs = 5 * 60 * 1000; // 5 minutes
  const max = 3;

  beforeEach(async () => {
    // Clear the test collection before each test
    const collectionRef = require("firebase-admin/firestore").getFirestore().collection("rateLimits");
    const docs = await collectionRef.listDocuments();
    for (const doc of docs) {
      await doc.delete();
    }
  });

  test("should allow requests within the limit", async () => {
    await checkRateLimit(ip, action, windowMs, max);
    await checkRateLimit(ip, action, windowMs, max);
    expect(await checkRateLimit(ip, action, windowMs, max)).toBe(true);
  });

  test("should block requests exceeding the limit", async () => {
    await checkRateLimit(ip, action, windowMs, max);
    await checkRateLimit(ip, action, windowMs, max);
    await checkRateLimit(ip, action, windowMs, max);
    expect(await checkRateLimit(ip, action, windowMs, max)).toBe(false);
  });

  test("should reset after the windowMs", async () => {
    await checkRateLimit(ip, action, 100, 1); // 100ms window, 1 max
    expect(await checkRateLimit(ip, action, 100, 1)).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 150)); // Wait for window to pass

    expect(await checkRateLimit(ip, action, 100, 1)).toBe(true);
  });

  test("should handle different IPs and actions independently", async () => {
    await checkRateLimit("192.168.1.1", "login", windowMs, max);
    await checkRateLimit("192.168.1.2", "login", windowMs, max);
    await checkRateLimit("192.168.1.1", "signup", windowMs, max);

    expect(await checkRateLimit("192.168.1.1", "login", windowMs, max)).toBe(true);
    expect(await checkRateLimit("192.168.1.2", "login", windowMs, max)).toBe(true);
    expect(await checkRateLimit("192.168.1.1", "signup", windowMs, max)).toBe(true);
  });
});