import { NextResponse } from 'next/server';

export async function POST() {
  // Consolidate duplicate endpoints: redirect to the production version
  return NextResponse.redirect(new URL('/api/production/batches/propagate', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'), { status: 301 });
}
