'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const { login, verifyMfa } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaTicket, setMfaTicket] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(email, password);
      if (res.mfaRequired && res.mfaTicket) {
        setMfaTicket(res.mfaTicket); // stay on page, show MFA step
      } else {
        router.push('/discover');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaTicket) return;
    setError('');
    setLoading(true);
    try {
      await verifyMfa(mfaTicket, mfaCode);
      router.push('/discover');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid MFA code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">TalentShowcase</CardTitle>
          <CardDescription>
            Enterprise internal talent showcase &amp; AI-powered review
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!mfaTicket ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="you@company.com"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="••••••••"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Demo accounts (password123): alice@company.com · carol@company.com · dave@company.com · bob@company.com (HR)
              </p>
            </form>
          ) : (
            <form onSubmit={handleMfa} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="mfa" className="text-sm font-medium">
                  Two-factor authentication
                </label>
                <input
                  id="mfa"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  autoFocus
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-center text-2xl tracking-[0.5em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="000000"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the 6-digit code from your authenticator app.
                </p>
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={loading || mfaCode.length !== 6}>
                {loading ? 'Verifying...' : 'Verify code'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setMfaTicket(null);
                  setMfaCode('');
                  setError('');
                }}
              >
                Back to login
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
