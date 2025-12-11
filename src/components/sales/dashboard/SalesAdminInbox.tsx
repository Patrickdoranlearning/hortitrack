'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ShoppingCart, 
  Printer, 
  FileEdit, 
  ArrowRight, 
  CheckCircle2,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { sendOrderConfirmation, dispatchAndInvoice } from '@/app/sales/actions';
import { toast } from 'sonner';
import { useState } from 'react';

export interface AdminTask {
  reference_id: string;
  org_id: string;
  task_type: 'webshop_approval' | 'dispatch_prep' | 'stale_draft';
  title: string;
  description: string;
  task_date: string;
  priority: number;
  link_url: string;
  action_label: string;
  customer_name: string;
  order_number: string;
  total_inc_vat: number | null;
}

interface SalesAdminInboxProps {
  tasks: AdminTask[];
}

const TASK_ICONS = {
  webshop_approval: ShoppingCart,
  dispatch_prep: Printer,
  stale_draft: FileEdit,
};

const TASK_COLORS = {
  webshop_approval: 'bg-blue-100 text-blue-600',
  dispatch_prep: 'bg-purple-100 text-purple-600',
  stale_draft: 'bg-amber-100 text-amber-600',
};

const PRIORITY_BADGES = {
  3: { label: 'Urgent', className: 'bg-red-100 text-red-700 border-red-200' },
  2: { label: 'Today', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  1: { label: 'Low', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export function SalesAdminInbox({ tasks }: SalesAdminInboxProps) {
  const router = useRouter();
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);

  const handleQuickAction = async (task: AdminTask, e: React.MouseEvent) => {
    e.stopPropagation();
    setLoadingTaskId(task.reference_id);

    try {
      if (task.task_type === 'webshop_approval') {
        const result = await sendOrderConfirmation(task.reference_id);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success(result.message || 'Order confirmed');
          router.refresh();
        }
      } else if (task.task_type === 'dispatch_prep') {
        // Navigate to print docket
        router.push(`/sales/orders/${task.reference_id}/docket`);
      } else {
        // Navigate to order for stale drafts
        router.push(task.link_url);
      }
    } catch (error) {
      toast.error('Action failed');
    } finally {
      setLoadingTaskId(null);
    }
  };

  const handleDispatchAndInvoice = async (task: AdminTask, e: React.MouseEvent) => {
    e.stopPropagation();
    setLoadingTaskId(task.reference_id);

    try {
      const result = await dispatchAndInvoice(task.reference_id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Order dispatched and invoice generated');
        router.refresh();
      }
    } catch (error) {
      toast.error('Failed to dispatch order');
    } finally {
      setLoadingTaskId(null);
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-slate-50 border border-dashed rounded-lg text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
        <h3 className="text-lg font-medium text-slate-900">All Clear!</h3>
        <p className="text-slate-500 max-w-xs mx-auto mt-2">
          No pending webshop orders or immediate dispatch paperwork required.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const Icon = TASK_ICONS[task.task_type] || FileEdit;
        const colorClass = TASK_COLORS[task.task_type] || 'bg-slate-100 text-slate-600';
        const priorityBadge = PRIORITY_BADGES[task.priority as keyof typeof PRIORITY_BADGES];
        const isLoading = loadingTaskId === task.reference_id;

        return (
          <Card 
            key={`${task.task_type}-${task.reference_id}`}
            className="group hover:border-green-500 transition-all cursor-pointer"
            onClick={() => router.push(task.link_url)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                {/* Icon */}
                <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                  <Icon className="h-6 w-6" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-slate-900 truncate">
                      {task.title}
                    </h4>
                    {priorityBadge && task.priority >= 2 && (
                      <Badge variant="outline" className={`h-5 text-[10px] ${priorityBadge.className}`}>
                        {priorityBadge.label}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 truncate">{task.description}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-slate-400">
                      #{task.order_number}
                    </span>
                    {task.total_inc_vat && (
                      <span className="text-xs font-medium text-slate-600">
                        €{task.total_inc_vat.toFixed(2)}
                      </span>
                    )}
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(task.task_date), { addSuffix: true })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {task.task_type === 'dispatch_prep' && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="text-xs hidden sm:flex"
                      onClick={(e) => handleDispatchAndInvoice(task, e)}
                      disabled={isLoading}
                    >
                      Dispatch & Invoice
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="text-xs gap-1 group-hover:bg-green-50 group-hover:text-green-700"
                    onClick={(e) => handleQuickAction(task, e)}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Loading...' : task.action_label}
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default SalesAdminInbox;
