"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Leaf } from "lucide-react";
import { workerLogin } from "./actions";

/**
 * Worker Login Page
 *
 * Mobile-optimized login for field workers.
 * - Touch-friendly inputs (min 48px height)
 * - Simple email/password form
 * - Green theme matching worker app
 * - No org selector or SSO - just login
 */
export default function WorkerLoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    setError(null);

    const res = await workerLogin(formData);
    if (res?.error) {
      setError(res.error);
      setLoading(false);
    }
    // If success, server action redirects to /worker
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-green-50 to-white px-6 py-8">
      {/* Logo/Brand */}
      <div className="mb-8 flex flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-600 shadow-lg">
          <Leaf className="h-9 w-9 text-white" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">HortiTrack</h1>
        <p className="mt-1 text-sm text-gray-500">Worker App</p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm">
        <div className="rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="mb-6 text-center text-xl font-semibold text-gray-800">
            Sign In
          </h2>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form action={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                autoCapitalize="none"
                required
                disabled={loading}
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={loading}
                className="h-12 text-base"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full bg-green-600 text-base font-medium hover:bg-green-700"
            >
              {loading ? "Signing In..." : "Sign In"}
            </Button>
          </form>
        </div>

        {/* Help text */}
        <p className="mt-6 text-center text-xs text-gray-400">
          Contact your manager if you need help signing in.
        </p>
      </div>
    </div>
  );
}
