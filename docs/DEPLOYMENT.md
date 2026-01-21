# HortiTrack Deployment Guide

## Deployment Platform

HortiTrack is deployed on **Vercel** with the following configuration:
- Region: `dub1` (Dublin, Ireland)
- Framework: Next.js 15
- Database: Supabase (PostgreSQL)

## Pre-Deployment Checklist

Before deploying to production:

- [ ] All tests pass locally
- [ ] No TypeScript errors (`npm run lint`)
- [ ] Environment variables are set in Vercel dashboard
- [ ] Database migrations have been tested on a branch/preview
- [ ] Sentry DSN is configured for error monitoring

## Deployment Process

### Automatic Deployments

Vercel automatically deploys:
- **Production**: Pushes to `main` branch
- **Preview**: Pull requests get preview deployments

### Manual Deployment

```bash
# Deploy to production
vercel --prod

# Deploy preview
vercel
```

## Rollback Procedures

### Option 1: Vercel Instant Rollback (Recommended)

1. Go to [Vercel Dashboard](https://vercel.com) → HortiTrack project
2. Click **Deployments** tab
3. Find the last known good deployment
4. Click the **...** menu → **Promote to Production**

This is instant and requires no code changes.

### Option 2: Git Revert

```bash
# Revert the problematic commit
git revert <commit-hash>
git push origin main

# Or reset to a specific commit (use with caution)
git reset --hard <commit-hash>
git push origin main --force-with-lease
```

### Option 3: Redeploy Previous Commit

```bash
# Checkout the previous working version
git checkout <commit-hash>

# Create a hotfix branch
git checkout -b hotfix/rollback

# Push and deploy
git push origin hotfix/rollback
vercel --prod
```

## Database Rollback

### Supabase Point-in-Time Recovery

For Pro plans, Supabase supports point-in-time recovery:

1. Go to Supabase Dashboard → Project Settings → Database
2. Click **Backups**
3. Select a restore point before the issue
4. Click **Restore**

**Warning**: This restores the entire database state. Data created after the restore point will be lost.

### Manual Migration Rollback

If a specific migration caused issues:

```sql
-- Check recent migrations
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC LIMIT 10;

-- Manually revert changes (write reverse migration)
-- Then delete the migration record
DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20260121XXXXXX';
```

## Environment Variables

Critical environment variables (set in Vercel dashboard):

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE` | Service role key (server-side) | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL (client-side) | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (client-side) | Yes |
| `SENTRY_DSN` | Sentry error tracking | Recommended |
| `NEXT_PUBLIC_APP_URL` | Application URL | Recommended |

See `.env.example` for the full list.

## Monitoring

### Error Tracking

Errors are tracked in [Sentry](https://sentry.io). Check for:
- Spike in error rates after deployment
- New error types not seen before
- Increased response times

### Database Monitoring

Monitor in Supabase Dashboard:
- **Database** → Query Performance
- **Logs** → API logs for errors
- **Reports** → Advisors for security/performance issues

## Incident Response

1. **Detect**: Sentry alert or user report
2. **Assess**: Check error logs, determine impact
3. **Mitigate**: Rollback if necessary (see above)
4. **Communicate**: Update status page/users if widespread
5. **Fix**: Create hotfix branch, test, deploy
6. **Review**: Post-incident review, update procedures

## Contact

- Deployment issues: Check Vercel status at https://vercel-status.com
- Database issues: Check Supabase status at https://status.supabase.com
