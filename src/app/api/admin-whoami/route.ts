// src/app/api/admin-whoami/route.ts
import 'server-only';
export const runtime = 'nodejs';
import { getApps } from 'firebase-admin/app';

export async function GET() {
  const app = getApps()[0];
  const projectId = app?.options?.projectId ?? process.env.FIREBASE_PROJECT_ID ?? 'unknown';
  return new Response(JSON.stringify({ projectId }), { headers: { 'content-type': 'application/json' } });
}
