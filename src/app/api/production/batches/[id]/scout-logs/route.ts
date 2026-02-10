import { NextRequest, NextResponse } from 'next/server';
import { getUserAndOrg } from '@/server/auth/org';
import { getFullBatchScoutHistory } from '@/server/batches/scout-history';
import { logger } from '@/server/utils/logger';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params;
    if (!batchId) {
      return NextResponse.json({ error: 'Missing batch ID' }, { status: 400 });
    }

    const { orgId } = await getUserAndOrg();
    const scouts = await getFullBatchScoutHistory(batchId, orgId);

    return NextResponse.json({ logs: scouts }, { status: 200 });
  } catch (error) {
    logger.production.error('Failed to fetch scout logs', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}
