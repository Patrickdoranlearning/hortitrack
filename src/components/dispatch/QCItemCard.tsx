'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Package,
  MapPin,
  Hash,
  Flag,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QCPickItem {
  id: string;
  orderItemId: string;
  targetQty: number;
  pickedQty: number;
  status: string;
  description: string | null;
  varietyName: string | null;
  sizeName: string | null;
  batchNumber: string | null;
  locationName: string | null;
}

interface ItemIssue {
  itemId: string;
  issue: string;
  notes: string;
}

interface QCItemCardProps {
  item: QCPickItem;
  issue?: ItemIssue;
  onIssueChange: (issue: string, notes: string) => void;
}

const ISSUE_TYPES = [
  { value: 'wrong_quantity', label: 'Wrong Quantity' },
  { value: 'wrong_variety', label: 'Wrong Variety' },
  { value: 'poor_quality', label: 'Poor Quality' },
  { value: 'wrong_size', label: 'Wrong Pot Size' },
  { value: 'missing_label', label: 'Missing/Wrong Label' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'other', label: 'Other Issue' },
];

export default function QCItemCard({ item, issue, onIssueChange }: QCItemCardProps) {
  const [isExpanded, setIsExpanded] = useState(!!issue);
  const [selectedIssue, setSelectedIssue] = useState(issue?.issue || '');
  const [issueNotes, setIssueNotes] = useState(issue?.notes || '');

  const hasIssue = !!issue;
  const qtyMatch = item.pickedQty === item.targetQty;

  // Build display name
  const displayName = item.varietyName && item.sizeName
    ? `${item.varietyName} ${item.sizeName}`
    : item.description || 'Unknown Product';

  const handleIssueSelect = (value: string) => {
    setSelectedIssue(value);
    onIssueChange(value, issueNotes);
  };

  const handleNotesChange = (notes: string) => {
    setIssueNotes(notes);
    onIssueChange(selectedIssue, notes);
  };

  const clearIssue = () => {
    setSelectedIssue('');
    setIssueNotes('');
    onIssueChange('', '');
    setIsExpanded(false);
  };

  return (
    <div
      className={cn(
        'border rounded-lg transition-colors',
        hasIssue
          ? 'border-red-300 bg-red-50'
          : qtyMatch
          ? 'border-green-200 bg-green-50/50'
          : 'border-amber-300 bg-amber-50'
      )}
    >
      {/* Main Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {hasIssue ? (
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
              ) : qtyMatch ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
              )}
              <h3 className="font-medium truncate">{displayName}</h3>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {item.batchNumber && (
                <div className="flex items-center gap-1">
                  <Hash className="h-3.5 w-3.5" />
                  <span>{item.batchNumber}</span>
                </div>
              )}
              {item.locationName && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{item.locationName}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quantity Display */}
            <div className="text-right">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className={cn(
                  'font-bold text-lg',
                  !qtyMatch && !hasIssue && 'text-amber-600'
                )}>
                  {item.pickedQty}
                </span>
                <span className="text-muted-foreground">/ {item.targetQty}</span>
              </div>
              {!qtyMatch && (
                <Badge variant="outline" className="text-xs bg-amber-100 border-amber-300 text-amber-700">
                  {item.pickedQty > item.targetQty ? 'Over' : 'Short'}
                </Badge>
              )}
            </div>

            {/* Status Badge */}
            {hasIssue ? (
              <Badge variant="destructive">Issue Flagged</Badge>
            ) : (
              <Badge
                variant="outline"
                className={cn(
                  qtyMatch
                    ? 'bg-green-100 border-green-300 text-green-700'
                    : 'bg-amber-100 border-amber-300 text-amber-700'
                )}
              >
                {qtyMatch ? 'OK' : 'Check'}
              </Badge>
            )}
          </div>
        </div>

        {/* Flag Issue Button or Issue Display */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="mt-3 flex items-center gap-2">
            {hasIssue ? (
              <div className="flex items-center gap-2 flex-1">
                <Badge variant="destructive" className="gap-1">
                  <Flag className="h-3 w-3" />
                  {ISSUE_TYPES.find(t => t.value === issue?.issue)?.label || 'Issue'}
                </Badge>
                {issue?.notes && (
                  <span className="text-sm text-red-600 truncate">{issue.notes}</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-100"
                  onClick={clearIssue}
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>
            ) : (
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Flag className="h-4 w-4 mr-1" />
                  Flag Issue
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 ml-1" />
                  ) : (
                    <ChevronDown className="h-4 w-4 ml-1" />
                  )}
                </Button>
              </CollapsibleTrigger>
            )}
          </div>

          <CollapsibleContent className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Issue Type</label>
                <Select value={selectedIssue} onValueChange={handleIssueSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select issue type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ISSUE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Notes</label>
                <Input
                  placeholder="Additional details..."
                  value={issueNotes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}





