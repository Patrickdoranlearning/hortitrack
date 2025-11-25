
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/logo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { login } from './actions';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    setError(null);
    
    const res = await login(formData);
    if (res?.error) {
        setError(res.error);
        setLoading(false);
    }
    // If success, server action redirects
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
            <Logo />
        </div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-headline">Welcome Back</CardTitle>
            <CardDescription>Sign in to access the HortiTrack dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
             {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Sign-in Failed</AlertTitle>
                  <AlertDescription>
                    {error}
                  </AlertDescription>
                </Alert>
              )}
            <form action={handleSubmit}>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="manager@dorannurseries.com"
                        required
                        disabled={loading}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                        id="password"
                        name="password"
                        type="password"
                        required
                        disabled={loading}
                        />
                    </div>
                     <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? 'Signing In...' : 'Sign In with Email'}
                    </Button>
                </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
