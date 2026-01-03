# HortiTrack Deployment Plan

This document outlines the steps to prepare HortiTrack for a live production environment.

---

## Phase 1: Security & Core Features ✅

### 1.1 User Authentication
**Status**: ✅ Complete

- [x] Supabase Authentication integration
- [x] Sign In / Sign Up pages
- [x] Session management
- [x] Protected routes with middleware
- [x] Multi-tenant organization support

### 1.2 Security Rules
**Status**: ✅ Complete

- [x] Row-Level Security (RLS) on all tables
- [x] Organization-based data isolation
- [x] Role-based access control
- [x] API route protection

### 1.3 Batch Photos
**Status**: ✅ Complete

- [x] Photo upload from device camera
- [x] Supabase Storage bucket (`batch-photos`)
- [x] Grower and sales photo types
- [x] Photo display on batch cards

### 1.4 Label Printing
**Status**: ✅ Complete

- [x] Print-ready PDF generation
- [x] QR code generation
- [x] Batch labels
- [x] Sale labels
- [x] Trolley labels

---

## Phase 2: Data & Deployment Readiness

### 2.1 Reference Data Setup
**Status**: 🔄 Ongoing

**Action Required**: Review and finalize data lists:
- [ ] Plant Varieties - complete catalog
- [ ] Plant Sizes - all container types
- [ ] Nursery Locations - all sites and zones
- [ ] Suppliers - vendor list

### 2.2 Environment Configuration

**Required Environment Variables**:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE=xxx

# Application
NEXT_PUBLIC_APP_URL=https://your-domain.com
ALLOWED_ORIGINS=https://your-domain.com

# Optional: AI Features
GOOGLE_API_KEY=xxx
```

### 2.3 Supabase Production Setup

- [ ] Create production project in Supabase
- [ ] Run all migrations against production
- [ ] Configure authentication settings
- [ ] Set up storage buckets
- [ ] Configure RLS policies
- [ ] Set up database backups

### 2.4 Vercel Deployment

1. Connect repository to Vercel
2. Configure environment variables
3. Set up custom domain
4. Enable analytics
5. Configure deployment protection (optional)

**Deploy Command**:
```bash
vercel --prod
```

---

## Phase 3: Go-Live Checklist

### Pre-Launch

- [ ] All environment variables configured
- [ ] Production database seeded with reference data
- [ ] SSL certificate active
- [ ] Custom domain configured
- [ ] Error monitoring set up (optional: Sentry)
- [ ] Analytics configured
- [ ] User accounts created for team

### Security Verification

- [ ] Test RLS policies work correctly
- [ ] Verify users can only see their org's data
- [ ] Test authentication flows
- [ ] Verify API endpoints are protected
- [ ] Check for exposed secrets

### Performance Verification

- [ ] Test load times acceptable
- [ ] Database queries optimized
- [ ] Images loading correctly
- [ ] Mobile responsiveness verified

### Backup & Recovery

- [ ] Database backup schedule configured
- [ ] Backup restoration tested
- [ ] Recovery procedures documented

---

## Post-Launch

### Monitoring

- [ ] Set up uptime monitoring
- [ ] Configure error alerting
- [ ] Monitor database performance
- [ ] Track API response times

### User Training

- [ ] Create user guides
- [ ] Conduct team training sessions
- [ ] Document common workflows
- [ ] Set up support channel

### Ongoing Maintenance

- [ ] Schedule regular security updates
- [ ] Plan for feature releases
- [ ] Monitor storage usage
- [ ] Review and optimize as needed

---

## Rollback Plan

If issues arise post-deployment:

1. **Immediate**: Revert to previous Vercel deployment
2. **Database**: Restore from most recent backup
3. **Investigation**: Review logs and identify issue
4. **Fix**: Apply fix in staging first
5. **Redeploy**: After verification

---

## Cost Estimate

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| Supabase | Pro | $25 |
| Vercel | Pro | $20 |
| Google AI | Usage | $10-30 |
| **Total** | | **~$55-75** |

For 500 users with 1TB storage: ~$75-95/month

---

**Last Updated**: January 2026

