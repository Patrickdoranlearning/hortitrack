'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { LogOut, User } from 'lucide-react';
import { startImpersonation, endImpersonation } from './actions';
import { toast } from 'sonner';
import { format } from 'date-fns';

type Customer = {
  id: string;
  name: string;
  code: string | null;
  accounts_email: string | null;
  store: string | null;
};

type ActiveSession = {
  id: string;
  customer_id: string;
  started_at: string;
  notes: string | null;
  customers: {
    id: string;
    name: string;
    code: string | null;
  } | null;
} | null;

type ImpersonateClientProps = {
  customers: Customer[];
  activeSession: ActiveSession;
};

export function ImpersonateClient({ customers, activeSession }: ImpersonateClientProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleStartImpersonation = async () => {
    if (!selectedCustomerId) return;

    setIsLoading(true);
    const formData = new FormData();
    formData.append('customerId', selectedCustomerId);
    formData.append('notes', notes);

    const result = await startImpersonation(formData);

    if (result?.error) {
      toast.error(result.error);
      setIsLoading(false);
    }
  };

  const handleEndImpersonation = async () => {
    setIsLoading(true);
    await endImpersonation();
  };

  return (
    <div className="space-y-6">

      {activeSession && activeSession.customers && (
        <Alert>
          <AlertDescription className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>
                Currently acting as: <strong>{activeSession.customers.name}</strong>
                {activeSession.customers.code && ` (${activeSession.customers.code})`}
              </span>
              <Badge variant="secondary">Active</Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEndImpersonation}
              disabled={isLoading}
            >
              <LogOut className="mr-2 h-4 w-4" />
              End Session
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!activeSession && (
        <Card>
          <CardHeader>
            <CardTitle>Start Customer Session</CardTitle>
            <CardDescription>
              Select a customer to place an order on their behalf
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer">Select Customer</Label>
              <Select
                value={selectedCustomerId}
                onValueChange={setSelectedCustomerId}
                disabled={isLoading}
              >
                <SelectTrigger id="customer">
                  <SelectValue placeholder="Choose a customer..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                      {customer.code && ` (${customer.code})`}
                      {customer.store && ` - ${customer.store}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="e.g., Phone order with John"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <Button
              onClick={handleStartImpersonation}
              disabled={!selectedCustomerId || isLoading}
              className="w-full"
            >
              Start Session
            </Button>
          </CardContent>
        </Card>
      )}

      {activeSession && (
        <Card>
          <CardHeader>
            <CardTitle>Session Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Started:</span>
              <span>{format(new Date(activeSession.started_at), 'dd/MM/yyyy HH:mm')}</span>
            </div>
            {activeSession.notes && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Notes:</span>
                <span>{activeSession.notes}</span>
              </div>
            )}
            <div className="pt-4">
              <Button asChild variant="secondary" className="w-full">
                <a href="/b2b/dashboard">Go to Customer Portal</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
