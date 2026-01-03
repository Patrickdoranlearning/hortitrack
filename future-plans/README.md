# HortiTrack Future Plans

This directory consolidates all planning documents, roadmaps, and feature proposals for HortiTrack.

---

## 📋 Quick Links

| Document | Description |
|----------|-------------|
| [Roadmap](./roadmap.md) | High-level feature roadmap and module overview |
| [Deployment](./deployment.md) | Production deployment checklist |
| [Review Checklist](./review-checklist.md) | Comprehensive application review plan |
| [Improvement Suggestions](./suggestions.md) | AI-generated improvement recommendations |

---

## 📁 Feature Plans

Detailed planning documents for specific features:

| Feature | Status | Document |
|---------|--------|----------|
| Production Recipes | Phase 1 ✅, Phase 2 📋 Planned | [features/recipes.md](./features/recipes.md) |
| Sales Module | ✅ Complete | [features/sales-module.md](./features/sales-module.md) |
| Product Aliases | ✅ Complete | [features/product-aliases.md](./features/product-aliases.md) |
| Enhanced Orders | ✅ Complete | [features/enhanced-orders.md](./features/enhanced-orders.md) |

---

## 🏗️ Module Status Overview

| Module | Status | Notes |
|--------|--------|-------|
| **Production** | ✅ Complete | Batch tracking, propagation, transplanting, protocols |
| **Sales** | ✅ Complete | Orders, customers, pricing, invoicing, product aliases |
| **B2B Portal** | ✅ Complete | Customer ordering, catalog, checkout wizard |
| **Dispatch** | ✅ Complete | Picking, packing, QC, delivery runs, trolleys, driver view |
| **Plant Health/IPM** | ✅ Complete | Scouting, treatments, trials, programs, compliance |
| **Tasks** | ✅ Complete | Job management, team assignments, kanban |
| **Materials** | ✅ Complete | Catalog, stock tracking, purchase orders |
| **Recipes** | Phase 1 ✅ | Library, editor, planning integration |
| **AI Features** | ⏸️ Built, Disabled | Care recommendations, batch chat, protocols |
| **Media/Photos** | ✅ Complete | Upload, gallery, attachments |
| **Labels** | ✅ Complete | Batch, sale, trolley, location labels |

---

## ✅ Completed Features (from original plans)

These features were planned and have been **fully implemented**:

### Core Modules
- [x] Production batch tracking (create, edit, log, transplant)
- [x] User authentication (Supabase Auth)
- [x] Multi-tenant organizations with RLS
- [x] Role-based access control (owner, admin, grower, sales, viewer)
- [x] Batch photos (grower + sales photos)
- [x] Label printing (batch, sale, trolley, location)
- [x] QR code scanning

### Sales Module
- [x] Order management (CRUD, status workflow)
- [x] Customer management (addresses, contacts)
- [x] Product catalog with SKU linking
- [x] Product aliases (customer-specific naming/pricing)
- [x] Price lists and customer pricing
- [x] Enhanced orders (batch-specific ordering)
- [x] Order events logging
- [x] Order exceptions handling
- [x] Invoice generation
- [x] Invoice PDF (B2B portal)

### Dispatch Module
- [x] Picking lists and workflow
- [x] Bulk picking by batch
- [x] QC review workflow
- [x] Packing workflow
- [x] Delivery runs
- [x] Driver view
- [x] Trolley tracking

### B2B Portal
- [x] Customer authentication
- [x] Product browsing
- [x] Order placement
- [x] Checkout wizard
- [x] Invoice PDF download

### Plant Health/IPM
- [x] Scouting module
- [x] Treatment tracking
- [x] Trial management
- [x] Programs management

### Tasks
- [x] Task creation and assignment
- [x] Jobs kanban board
- [x] Employee schedules

### Materials
- [x] Material catalog
- [x] Stock tracking
- [x] Purchase orders

---

## 📋 Planned but NOT Yet Implemented

These features are documented but still need development:

### Recipes Phase 2
- [ ] Size flow builder (container progression)
- [ ] Target week ranges planning
- [ ] Performance tracking (planned vs actual duration)
- [ ] Sales correlation analytics

### AI Enhancements
- [ ] Real weather API integration (currently simulated)
- [ ] AI photo health analysis (Gemini Vision)
- [ ] AI-assisted task creation from recommendations

### Analytics & Insights
- [ ] Recipe performance tracking table
- [ ] Sales analytics dashboard
- [ ] Production efficiency metrics
- [ ] Demand forecasting

### User Experience
- [ ] Push notifications
- [ ] Offline write queue (currently read-only)
- [ ] Enhanced dashboard with alerts

### Technical
- [ ] General audit log table
- [ ] Enhanced feature flags (per-org, rollout percentage)
- [ ] API response caching (Redis/Upstash)

---

## 💡 New Suggestions (Not in Original Plans)

From our [suggestions document](./suggestions.md):

- Dashboard overhaul with key metrics and quick actions
- Customer purchase history view
- Weather widget on dashboard
- Mobile-optimized scanner mode
- Voice feedback for scanning

---

## 📅 Planning Guidelines

When adding new plans:

1. **Feature Plans**: Create in `features/` directory
2. **Naming**: Use `feature-name.md` format
3. **Structure**: Include:
   - Overview
   - Current state
   - Proposed changes
   - Data model (if applicable)
   - UI/UX notes
   - Implementation priority

---

**Last Updated**: January 2026
