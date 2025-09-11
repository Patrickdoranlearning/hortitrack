# Firestore Rules

**Last updated:** 2025-08-14
**Scope:** Firestore (and Storage, since we attach photos to logs)
**Goal:** Lock down client access, especially the **rate limiter** collection, while keeping day-to-day CRUD sane for signed-in users.

---

## Production Rules (Firestore)

```
ts
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    /* Helpers */
    function isSignedIn() { return request.auth != null; }
    function uid()        { return request.auth.uid; }
    function nowMs()      { return request.time.toMillis(); }

    /* --- Server-only collections (Admin SDK bypasses rules) --- */
    // The Admin SDK ignores rules; to keep clients out entirely, DENY ALL.
    match /rateLimits/{document=**} {
      allow read, write: if false;
    }

    /* --- Application data --- */

    // Batches
    match /batches/{batchId} {
      allow read: if isSignedIn();

      // Create: enforce creator + createdAt semantics (adjust to your schema)
      allow create: if isSignedIn()
        && request.resource.data.createdBy == uid()
        && request.resource.data.createdAt <= request.time;

      // Update: creator immutable; timestamps monotonic
      allow update: if isSignedIn()
        && request.resource.data.createdBy == resource.data.createdBy
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.updatedAt >= resource.data.updatedAt;

      // Protect against accidental deletion (allow via admin tools only)
      allow delete: if false;
    }

    // Action logs under a batch (if you use subcollections like batches/{id}/logs/{logId})
    match /batches/{batchId}/logs/{logId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn()
        && request.resource.data.userId == uid()
        && request.resource.data.timestamp <= request.time;
      allow update: if false;  // logs are append-only (recommended)
      allow delete: if false;
    }

    // Simple reference data — relax if needed; tighten for multi-tenant later
    match /sizes/{id}      { allow read, write: if isSignedIn(); }
    match /suppliers/{id}  { allow read, write: if isSignedIn(); }
    match /varieties/{id}  { allow read, write: if isSignedIn(); }
    match /locations/{id}  { allow read, write: if isSignedIn(); }

    /* Default deny for anything not matched above */
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Notes

*   **Admin SDK bypasses rules.** That’s why `/rateLimits/**` is `deny all` for clients.
*   If you add **tenancy**, require `request.auth.token.tenantId == doc.tenantId`.
*   If clients need limited updates on certain docs, use `diff` checks to allow only specific field changes.

---

## Storage Rules (for log photos)

```
ts
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    function isSignedIn() { return request.auth != null; }
    function uid()        { return request.auth.uid; }

    /* Log images uploaded by authenticated users.
       Path: logs/{batchId}/{filename} */
    match /logs/{batchId}/{fileName} {
      allow read: if isSignedIn();
      allow write: if isSignedIn()
        // size ≤ 10MB (adjust)
        && request.resource.size < 10 * 1024 * 1024
        // must be an image
        && request.resource.contentType.matches('image/.*');
    }

    /* Default deny */
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

---

## TTL & Cleanup

*   Enable **Firestore TTL** on collection **`rateLimits`** field `expireAt`.
    *   Console → Firestore → **TTL** → Add policy → Collection: `rateLimits`, Field: `expireAt`.
*   Old limiter docs are auto-deleted; keep `expireAt` set to `windowStart + 2*windowMs` (already in our implementation).

---

## Local Testing (Emulator)

1.  Start the emulator:

    
```bash
npm run emu:firestore
```

2.  Run limiter tests:

    
```bash
npm run test:rate
```

3.  (Optional) Manual smoke with Node REPL using Admin SDK (points to emulator when `FIRESTORE_EMULATOR_HOST` is set).
    Remember: Admin bypasses rules; to test **rules**, use **client** SDK against the emulator with a mocked auth user.

---

## Hardening Tips

*   **Append-only logs:** Prefer `create` only; avoid `update/delete` on logs.
*   **Field guards:** Lock immutable fields; require monotonic timestamps.
*   **Multi-tenant:** Add `tenantId` to all docs and ensure `request.auth.token.tenantId == doc.tenantId`.
*   **Principle of least privilege:** If a collection is server-only, **deny all** in rules.

---

## Change Control

*   Any rule relaxations require:
    *   A brief ADR (or addendum here).
    *   Emulator tests demonstrating the intended allow/deny behavior.
    *   A rollback plan.
