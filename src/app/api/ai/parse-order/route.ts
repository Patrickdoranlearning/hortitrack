export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { withApiGuard } from '@/server/http/guard';
import { getUserAndOrg } from '@/server/auth/org';
import { parseOrderPdf } from '@/ai/flows/parse-order-pdf';
import { parseOrderCsv } from '@/lib/ai/parse-order-csv';
import { matchExtraction, type MatchedExtraction } from '@/lib/ai/match-extraction';
import { logError } from '@/lib/log';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ACCEPTED_TYPES: Record<string, 'pdf' | 'csv'> = {
  'application/pdf': 'pdf',
  'text/csv': 'csv',
  'text/plain': 'csv', // some systems send CSV as text/plain
  'application/vnd.ms-excel': 'csv',
};

export const POST = withApiGuard({
  method: 'POST',
  requireRole: 'user',
  rate: { max: 30, windowMs: 60_000, keyPrefix: 'parse-order' },
  async handler({ req }) {
    try {
      const { supabase, orgId } = await getUserAndOrg();

      // ── Parse FormData ────────────────────────────────────────────────
      const form = await req.formData();
      const file = form.get('file');

      if (!(file instanceof File)) {
        return NextResponse.json(
          { ok: false, error: { code: 'INVALID_INPUT', message: 'File is required (form field "file")' } },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { ok: false, error: { code: 'FILE_TOO_LARGE', message: 'File must be under 10MB' } },
          { status: 400 }
        );
      }

      // Detect format
      let format: 'pdf' | 'csv' | undefined =
        ACCEPTED_TYPES[file.type] ??
        (file.name.endsWith('.csv') ? 'csv' : undefined) ??
        (file.name.endsWith('.pdf') ? 'pdf' : undefined);

      if (!format) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: 'UNSUPPORTED_TYPE',
              message: `Unsupported file type "${file.type}". Please upload a PDF or CSV file.`,
            },
          },
          { status: 400 }
        );
      }

      // ── Fetch reference data in parallel with extraction ──────────────
      const refDataPromise = Promise.all([
        supabase
          .from('plant_varieties')
          .select('id, name, genus, species, family, colour, rating')
          .eq('is_archived', false)
          .order('name'),
        supabase
          .from('plant_sizes')
          .select('id, name, cell_multiple, container_type')
          .order('name'),
        supabase
          .from('suppliers')
          .select('id, name, producer_code, country_code')
          .order('name'),
      ]);

      // ── Run extraction ────────────────────────────────────────────────
      const buffer = Buffer.from(await file.arrayBuffer());
      let extraction;

      if (format === 'pdf') {
        const base64 = buffer.toString('base64');
        extraction = await parseOrderPdf(base64);
      } else {
        const text = buffer.toString('utf8');
        extraction = parseOrderCsv(text);
      }

      // ── Match against org data ────────────────────────────────────────
      const [varietiesRes, sizesRes, suppliersRes] = await refDataPromise;

      if (varietiesRes.error) {
        logError('Failed to fetch varieties for order matching', { error: varietiesRes.error });
        throw new Error('Failed to load plant varieties');
      }
      if (sizesRes.error) {
        logError('Failed to fetch sizes for order matching', { error: sizesRes.error });
        throw new Error('Failed to load plant sizes');
      }
      if (suppliersRes.error) {
        logError('Failed to fetch suppliers for order matching', { error: suppliersRes.error });
        throw new Error('Failed to load suppliers');
      }

      const matched: MatchedExtraction = matchExtraction(extraction, {
        varieties: varietiesRes.data ?? [],
        sizes: sizesRes.data ?? [],
        suppliers: suppliersRes.data ?? [],
      });

      return NextResponse.json({ ok: true, data: matched, format }, { status: 200 });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to parse order file';
      logError('parse-order API error', { error });
      return NextResponse.json(
        { ok: false, error: { code: 'EXTRACTION_FAILED', message } },
        { status: 500 }
      );
    }
  },
});
