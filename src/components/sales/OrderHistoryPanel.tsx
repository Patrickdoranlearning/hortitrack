'use client';

import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  History, 
  CheckCircle2, 
  Package, 
  FileText, 
  AlertCircle, 
  Edit, 
  Trash2,
  User,
  Clock,
  Receipt
} from 'lucide-react';
import type { OrderEvent } from './OrderDetailPage';

interface OrderHistoryPanelProps {
  events: OrderEvent[];
}

const EVENT_ICONS: Record<string, React.ElementType> = {
  order_created: Package,
  status_changed: CheckCircle2,
  item_updated: Edit,
  item_deleted: Trash2,
  invoice_generated: FileText,
  qc_note_added: AlertCircle,
  credit_note_created: Receipt,
};

const EVENT_COLORS: Record<string, string> = {
  order_created: 'bg-green-100 text-green-600',
  status_changed: 'bg-blue-100 text-blue-600',
  item_updated: 'bg-yellow-100 text-yellow-600',
  item_deleted: 'bg-red-100 text-red-600',
  invoice_generated: 'bg-purple-100 text-purple-600',
  qc_note_added: 'bg-orange-100 text-orange-600',
  credit_note_created: 'bg-pink-100 text-pink-600',
};

export default function OrderHistoryPanel({ events }: OrderHistoryPanelProps) {
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const getEventIcon = (eventType: string) => {
    return EVENT_ICONS[eventType] || History;
  };

  const getEventColor = (eventType: string) => {
    return EVENT_COLORS[eventType] || 'bg-gray-100 text-gray-600';
  };

  const formatEventType = (eventType: string) => {
    return eventType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Order History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-8">
            <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No history events recorded yet
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

              {/* Events */}
              <div className="space-y-6">
                {sortedEvents.map((event) => {
                  const Icon = getEventIcon(event.event_type);
                  const colorClass = getEventColor(event.event_type);

                  return (
                    <div key={event.id} className="relative pl-12">
                      {/* Icon */}
                      <div className={`absolute left-0 w-10 h-10 rounded-full flex items-center justify-center ${colorClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>

                      {/* Content */}
                      <div className="bg-muted/30 rounded-lg p-4">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <Badge variant="outline" className="mb-1">
                              {formatEventType(event.event_type)}
                            </Badge>
                            <p className="font-medium">{event.description}</p>
                          </div>
                        </div>

                        {/* Metadata */}
                        {event.metadata && Object.keys(event.metadata).length > 0 && (
                          <div className="text-sm text-muted-foreground bg-background rounded p-2 mt-2">
                            <pre className="whitespace-pre-wrap text-xs">
                              {JSON.stringify(event.metadata, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(event.created_at), 'PPp')}
                          </div>
                          {event.profile && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {event.profile.display_name || event.profile.email || 'System'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}





