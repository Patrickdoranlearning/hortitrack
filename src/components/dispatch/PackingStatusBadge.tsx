'use client';

import { Badge } from '@/components/ui/badge';
import type { PackingStatusType } from '@/lib/dispatch/types';
import {
  PACKING_STATUS_LABELS,
  PACKING_STATUS_COLORS,
} from '@/server/dispatch/status';

interface PackingStatusBadgeProps {
  status: PackingStatusType;
}

export default function PackingStatusBadge({ status }: PackingStatusBadgeProps) {
  return (
    <Badge variant={PACKING_STATUS_COLORS[status]}>
      {PACKING_STATUS_LABELS[status]}
    </Badge>
  );
}
