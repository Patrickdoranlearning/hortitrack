# HortiTrack Improvement Suggestions

AI-generated recommendations based on application review (January 2026).

---

## Executive Summary

HortiTrack is a **comprehensive and largely complete** nursery management application with:
- 171+ API routes
- 105 database migrations
- Full production, sales, dispatch, and IPM modules
- AI features (currently disabled)
- Offline capability (read-only)
- Multi-tenant architecture

**Estimated running cost**: ~€1,000-1,500/year for 500 users

---

## ✅ What's Already Built

Based on codebase review, these planned features are **complete**:

| Feature | Status |
|---------|--------|
| Production batch tracking | ✅ Complete |
| User authentication (Supabase) | ✅ Complete |
| Multi-tenant with RLS | ✅ Complete |
| Role-based access control | ✅ Complete |
| Batch photos (grower + sales) | ✅ Complete |
| Label printing (batch, sale, trolley) | ✅ Complete |
| QR code scanning | ✅ Complete |
| Sales orders & customers | ✅ Complete |
| Product catalog & SKUs | ✅ Complete |
| **Product aliases** | ✅ Complete |
| **Enhanced orders (batch-specific)** | ✅ Complete |
| Price lists & customer pricing | ✅ Complete |
| Order events & exceptions | ✅ Complete |
| Invoice generation | ✅ Complete |
| Invoice PDF (B2B) | ✅ Complete |
| B2B portal with checkout | ✅ Complete |
| Dispatch (picking, packing, QC) | ✅ Complete |
| Delivery runs & driver view | ✅ Complete |
| Trolley tracking | ✅ Complete |
| Plant health/IPM module | ✅ Complete |
| Tasks & jobs management | ✅ Complete |
| Materials & purchase orders | ✅ Complete |
| Recipe library (Phase 1) | ✅ Complete |
| Media/photo gallery | ✅ Complete |

---

## 📋 Still Outstanding (from Original Plans)

### Recipes Phase 2
- [ ] Size flow builder (container progression)
- [ ] Target week ranges planning
- [ ] Performance tracking (planned vs actual)

### AI Features
- [ ] **Enable AI care recommendations** (built but disabled)
- [ ] Real weather API integration (currently simulated)
- [ ] AI photo health analysis (Gemini Vision)

---

## 🚀 New Improvement Suggestions

These are **new recommendations** not in the original plans:

### 1. Enable AI Features (Quick Win)

**Current State**: AI flows are built but disabled

```typescript
// src/config/features.ts
export const features = {
  aiCare: false, // ← Enable this!
} as const;
```

**Recommendations**:
- Enable for power users first to test value
- Add response caching to reduce costs 50-70%
- Monitor usage before full rollout

**Effort**: Low | **Impact**: High

---

### 2. Real Weather Integration

**Current State**: Weather returns simulated data

```typescript
// Care recommendations uses fake weather
return {
  temperature: 25,
  humidity: 60,
  precipitationForecast: 'No rain expected...',
};
```

**Recommendation**: Integrate Open-Meteo API (free, no API key)

```typescript
const response = await fetch(
  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,precipitation_sum&forecast_days=7`
);
```

**Benefits**:
- More relevant care recommendations
- Frost warnings → protect tender stock
- Heat wave warnings → irrigation reminders

**Effort**: Low | **Impact**: Medium

---

### 3. Dashboard Enhancement

**Current State**: Dashboard shows batch distribution charts

**Recommended Additions**:

| Card | Description |
|------|-------------|
| Ready for Sale | Count of saleable batches |
| Orders Pending | Orders awaiting dispatch |
| Dispatch Today | Deliveries scheduled for today |
| Low Stock Alerts | Products below threshold |
| Overdue Tasks | Tasks past due date |
| Weather Widget | Today's conditions + growing alerts |

**Quick Actions**:
- Scan batch (camera shortcut)
- Create order
- View today's tasks

**Effort**: Medium | **Impact**: High

---

### 4. Push Notifications

**Current State**: PWA exists but no push notifications

**Use Cases**:
| Notification | Trigger |
|--------------|---------|
| Task due reminder | 1 hour before due time |
| Order ready | Status → ready_for_dispatch |
| Low stock alert | Product below threshold |
| Frost warning | Weather API predicts <2°C |

**Implementation**:
- Service Worker exists (`public/sw.js`)
- Add `PushManager` subscription
- Backend notification triggers
- User preferences

**Effort**: Medium | **Impact**: High

---

### 5. Offline Write Queue

**Current State**: Offline mode is read-only (batch lookup)

**Enhancement**:
- Queue actions while offline (check-in, log, status)
- Sync when reconnected
- Show pending sync count
- Handle conflicts

**Effort**: Medium | **Impact**: Medium

---

### 6. Recipe Performance Tracking

**Status**: Planned in recipes Phase 3

```sql
CREATE TABLE protocol_performance (
  protocol_id uuid,
  batch_id uuid,
  planned_duration_days integer,
  actual_duration_days integer,
  yield_pct numeric,
  completed_at timestamptz
);
```

**Benefits**:
- Identify unrealistic recipes
- Track yield rates
- Discover seasonal patterns

**Effort**: High | **Impact**: High

---

### 7. Sales Analytics Dashboard

**Metrics to Add**:
- Revenue trends (weekly/monthly)
- Top customers by volume
- Product performance
- Seasonal demand patterns

**Effort**: Medium | **Impact**: Medium

---

### 8. Customer Purchase History

**Current State**: Customer detail page exists

**Enhancement**: Add timeline showing:
- Past orders
- Total spend
- Most purchased products
- Order frequency

**Effort**: Low | **Impact**: Medium

---

## 🎯 Priority Implementation Order

### Immediate (This Week)
1. **Enable AI features** - flip the flag, test with one org
2. **Weather API** - replace simulated data

### Short Term (This Month)
3. **Dashboard enhancements** - key metrics cards
4. **Customer purchase history** - add to customer detail

### Medium Term (Next Quarter)
5. **Push notifications** - task reminders, alerts
6. **Recipe Phase 2** - size flow builder
7. **Sales analytics** - basic reporting

### Future
8. **Offline write queue** - full offline capability
9. **Recipe performance** - tracking and analytics
10. **Demand forecasting** - AI predictions

---

## 💰 Cost Considerations

| Enhancement | Cost Impact |
|-------------|-------------|
| Enable AI features | May increase AI costs ~$10-30/mo |
| Weather API | Free (Open-Meteo) |
| Push notifications | Free tier usually sufficient |
| Redis caching | ~$10/mo (Upstash) - reduces AI costs |

**Net impact**: Minimal if caching is implemented

---

## Summary

Your application is **remarkably complete**. The main opportunities are:

1. **Enable what's built** - AI features are ready, just disabled
2. **Polish the dashboard** - make it actionable
3. **Add notifications** - keep users engaged
4. **Complete Recipes Phase 2** - the planned enhancements

You've built a production-grade application. These suggestions are refinements, not necessities.

---

**Generated**: January 2026
**Based On**: Full codebase review
