ts
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

  if (!