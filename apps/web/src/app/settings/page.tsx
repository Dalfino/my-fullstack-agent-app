'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MfaSetupResponse } from '@talentshowcase/types';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SettingsPage() {
  const { token, user, loading, refreshUser, logout } = useAuth();
  const router = useRouter();
  const [setup, setSetup] = useState<MfaSetupResponse | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !token) router.push('/login');
  }, [loading, token, router]);

  const beginSetup = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      const res = await apiClient.post<MfaSetupResponse>('/auth/mfa/setup', {}, token);
      setSetup(res);
      setMessage('Scan the QR code with your authenticator app, then enter the 6-digit code.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MFA setup failed');
    } finally {
      setBusy(false);
    }
  }, [token]);

  async function confirmEnable(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !setup) return;
    setBusy(true);
    setError('');
    try {
      await apiClient.post('/auth/mfa/enable', { secret: setup.secret, code }, token);
      setMessage('MFA is now enabled for your account.');
      setSetup(null);
      setCode('');
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setBusy(false);
    }
  }

  async function disableMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      await apiClient.post('/auth/mfa/disable', { code }, token);
      setMessage('MFA has been disabled.');
      setCode('');
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-3xl font-bold">Settings</h1>

        <div className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p><span className="font-medium">Name:</span> {user.name}</p>
              <p><span className="font-medium">Email:</span> {user.email}</p>
              <p><span className="font-medium">Department:</span> {user.department ?? '—'}</p>
              <p>
                <span className="font-medium">Role:</span> {user.role}{' '}
                <Badge variant="secondary" className="ml-2">
                  MFA {user.mfaEnabled ? 'enabled' : 'disabled'}
                </Badge>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Two-Factor Authentication (TOTP)</CardTitle>
              <CardDescription>
                Add a second factor with any authenticator app (Google Authenticator, 1Password, Authy).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {message && <p className="mb-3 text-sm text-primary">{message}</p>}
              {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

              {!user.mfaEnabled && !setup && (
                <Button onClick={beginSetup} disabled={busy}>
                  Set up MFA
                </Button>
              )}

              {setup && (
                <div className="space-y-4">
                  <img
                    src={setup.qrDataUrl}
                    alt="MFA QR code"
                    className="rounded border bg-white p-2"
                    width={200}
                    height={200}
                  />
                  <p className="text-xs text-muted-foreground">
                    Or enter this secret manually: <code className="font-mono">{setup.secret}</code>
                  </p>
                  <form onSubmit={confirmEnable} className="flex max-w-xs gap-2">
                    <input
                      inputMode="numeric"
                      maxLength={6}
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      className="w-32 rounded border border-input bg-background px-2 py-1.5 text-center text-lg tracking-widest"
                      placeholder="000000"
                    />
                    <Button type="submit" disabled={busy || code.length !== 6}>
                      Verify &amp; enable
                    </Button>
                  </form>
                </div>
              )}

              {user.mfaEnabled && !setup && (
                <form onSubmit={disableMfa} className="flex max-w-md items-center gap-2">
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    className="w-32 rounded border border-input bg-background px-2 py-1.5 text-center text-lg tracking-widest"
                    placeholder="000000"
                  />
                  <Button type="submit" variant="destructive" disabled={busy || code.length !== 6}>
                    Disable MFA
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
