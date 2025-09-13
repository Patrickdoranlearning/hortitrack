
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { updateProfile } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export default function AccountPage() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [displayName, setDisplayName] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
    }
  }, [user]);
  
  React.useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);


  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    try {
      await updateProfile(user, { displayName });
      toast({ title: 'Profile Updated', description: 'Your display name has been updated.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (loading || !user) {
    return (
        <PageFrame companyName="Doran Nurseries" moduleKey="production">
            <div className="space-y-6">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-8 w-96" />
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-6 w-full" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                         <div className="space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <div className="flex justify-end">
                            <Skeleton className="h-10 w-24" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </PageFrame>
    );
  }

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="production">
      <div className="space-y-6">
        <ModulePageHeader 
            title="My Account"
            description="Manage your personal information and application settings."
        />
        <Card>
            <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Update your display name and email address.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" value={user.email || ''} disabled />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="displayName">Display Name</Label>
                        <Input 
                            id="displayName" 
                            value={displayName} 
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Your Name"
                        />
                    </div>
                    <div className="flex justify-end">
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
      </div>
    </PageFrame>
  );
}
