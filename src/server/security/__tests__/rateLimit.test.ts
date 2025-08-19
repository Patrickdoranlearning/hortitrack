// @ts-nocheck
import { checkRateLimit } from "../rateLimit";

// Point admin to emulator in test env
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";

describe("checkRateLimit", () => {
  const windowMs = 200;
  const max = 2;

  beforeEach(async () => {
    const { initializeApp, getApps } = require("firebase-admin/app");
    const { getFirestore } = require("firebase-admin/firestore");
    if (!getApps().length) {
        initializeApp();
    }
    const db = getFirestore();
    const docs = await db.collection("rateLimits").listDocuments();
    for (const d of docs) await d.delete();
  });

  it("allows up to max within window", async () => {
    const r1 = await checkRateLimit({ key: "t:1", windowMs, max });
    const r2 = await checkRateLimit({ key: "t:1", windowMs, max });
    const r3 = await checkRateLimit({ key: "t:1", windowMs, max });
    expect([r1.allowed, r2.allowed, r3.allowed]).toEqual([true, true, false]);
  });

  it("resets in next window", async () => {
    await checkRateLimit({ key: "t:2", windowMs, max });
    await checkRateLimit({ key: "t:2", windowMs, max });
    await new Promise((r) => setTimeout(r, windowMs + 20));
    const r = await checkRateLimit({ key: "t:2", windowMs, max });
    expect(r.allowed).toBe(true);
  });
});
