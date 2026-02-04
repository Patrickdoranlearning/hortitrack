'use client';

import { useState, useMemo } from 'react';
import { format, isToday, isYesterday, isThisWeek, parseISO } from 'date-fns';
import {
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { CustomerInteraction } from '@/app/sales/customers/[customerId]/types';

interface ActivityTimelineProps {
  interactions: CustomerInteraction[];
  emptyMessage?: string;
}

const TYPE_CONFIG = {
  call: { icon: Phone, label: 'Phone Call', color: 'text-blue-600' },
  email: { icon: Mail, label: 'Email', color: 'text-green-600' },
  visit: { icon: MapPin, label: 'Site Visit', color: 'text-purple-600' },
  whatsapp: { icon: MessageCircle, label: 'WhatsApp', color: 'text-emerald-600' },
  other: { icon: MoreHorizontal, label: 'Other', color: 'text-gray-600' },
} as const;

const OUTCOME_LABELS: Record<string, string> = {
  order_placed: 'Order Placed',
  will_order_later: 'Will Order Later',
  fully_stocked: 'Fully Stocked',
  no_answer: 'No Answer',
  left_voicemail: 'Left Voicemail',
  not_interested: 'Not Interested',
  follow_up_needed: 'Follow Up Needed',
  other: 'Other',
};

const OUTCOME_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  order_placed: 'default',
  will_order_later: 'secondary',
  fully_stocked: 'secondary',
  no_answer: 'outline',
  left_voicemail: 'outline',
  not_interested: 'destructive',
  follow_up_needed: 'secondary',
  other: 'outline',
};

function getDateGroup(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isThisWeek(date)) return 'This Week';
  return 'Earlier';
}

function InteractionCard({ interaction }: { interaction: CustomerInteraction }) {
  const [expanded, setExpanded] = useState(false);
  const config = TYPE_CONFIG[interaction.type] || TYPE_CONFIG.other;
  const Icon = config.icon;
  const notesTruncated = interaction.notes && interaction.notes.length > 150;
  const displayNotes = notesTruncated && !expanded
    ? interaction.notes!.slice(0, 150) + '...'
    : interaction.notes;

  return (
    <div className="flex gap-3 py-3">
      {/* Icon */}
      <div className={`flex-shrink-0 mt-0.5 ${config.color}`}>
        <Icon className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{config.label}</span>
            {interaction.outcome && (
              <Badge variant={OUTCOME_VARIANTS[interaction.outcome] || 'outline'} className="text-xs">
                {OUTCOME_LABELS[interaction.outcome] || interaction.outcome}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
            <Clock className="h-3 w-3" />
            {format(parseISO(interaction.createdAt), 'HH:mm')}
          </div>
        </div>

        {displayNotes && (
          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
            {displayNotes}
          </p>
        )}

        {notesTruncated && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 mt-1 text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show more
              </>
            )}
          </Button>
        )}

        <p className="text-xs text-muted-foreground mt-2">
          Logged by {interaction.userName || interaction.userEmail || 'Unknown user'}
        </p>
      </div>
    </div>
  );
}

export function ActivityTimeline({ interactions, emptyMessage = 'No interactions recorded yet' }: ActivityTimelineProps) {
  // Group interactions by date category
  const groupedInteractions = useMemo(() => {
    const groups: Record<string, CustomerInteraction[]> = {
      'Today': [],
      'Yesterday': [],
      'This Week': [],
      'Earlier': [],
    };

    for (const interaction of interactions) {
      const group = getDateGroup(interaction.createdAt);
      groups[group].push(interaction);
    }

    // Return only non-empty groups in order
    return Object.entries(groups).filter(([_, items]) => items.length > 0);
  }, [interactions]);

  if (interactions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Clock className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {groupedInteractions.map(([groupName, items]) => (
        <div key={groupName}>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {groupName}
            </h3>
            <div className="flex-1 h-px bg-border" />
          </div>
          <Card>
            <CardContent className="py-2 divide-y">
              {items.map((interaction) => (
                <InteractionCard key={interaction.id} interaction={interaction} />
              ))}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}

export default ActivityTimeline;
