# ADR 001: Firestore-backed Rate Limiter

**Date:** 2025-08-14
**Status:** Accepted
**Authors:** Patrick, ChatGPT (Reviewer & Co-Author)
**Related Links:**

* Implementation PR: *\[link to GitHub PR]*
* Firestore Rules: see `/docs/firestore-rules.md`
* Tests: `src/server/security/__tests__/rateLimit.test.ts`

---

## Context

We need to implement rate limiting for our API endpoints to protect against abuse, ensure fair usage of resources, and maintain application stability.
The initial plan suggested a basic rate limiting hook, but a more robust, production-ready solution was required.

Given our existing use of Firebase and the nature of our application's expected traffic, we need a rate limiting solution that is **scalable**, **persistent across server instances**, and **easy to integrate**.

---

## Options Considered

1. **In-memory Rate Limiter**

   * ✅ Simple to implement
   * ❌ Not suitable for production in a stateless or horizontally scaled environment — no shared state, resets on restarts/deploys.
   * Initially considered, but rejected based on review.

2. **Redis-backed Rate Limiter**

   * ✅ High performance and widely used.
   * ❌ Requires setting up and managing a Redis instance (self-hosted or managed like AWS ElastiCache, Google Cloud Memorystore).

3. **Upstash Redis-backed Rate Limiter**

   * ✅ Serverless Redis option with simplified setup.
   * ❌ Still introduces a new dependency; potential vendor lock-in.

4. **Firestore-backed Rate Limiter**

   * ✅ Leverages our existing Firestore database.
   * ✅ Persistent and consistent across multiple server instances.
   * ✅ Transactional updates prevent race conditions.
   * ❌ Slightly more complex to implement than in-memory.
   * ❌ Higher latency than Redis in some cases.

---

## Decision

We chose to implement a **Firestore-backed rate limiter** because:

* **Leverages existing infrastructure** — no new services to manage.
* **Persistence** — state survives restarts/deploys and is consistent across instances.
* **Scalability** — Firestore is a managed, horizontally scalable NoSQL store.
* **Transactional safety** — we can safely increment counts and manage expiration using Firestore transactions.

---

## Consequences

**Pros:**

* Integrated with our existing Firebase setup.
* Easy to deploy without new infrastructure.
* Works across multiple instances without additional coordination layers.

**Cons:**

* Implementation complexity is higher than in-memory.
* Potential write contention for hot keys.
* Read/write costs for Firestore usage.
* Latency higher than in-memory Redis.

---

## Mitigation

* **Monitoring:** Track Firestore reads/writes and latency for `rateLimits`.
* **Optimization:** For hot keys, consider key sharding or a per-window document model.
* **Testing:** Emulator-backed tests to validate concurrency handling and expiration logic.
* **Cleanup:** Use Firestore TTL on `expireAt` field to remove stale documents automatically.

---

## Future Considerations

* Investigate sliding window algorithms for finer-grained limits.
* Consider Redis/Upstash if latency or cost becomes a bottleneck.
* Add per-endpoint or per-role rate limits if needed.