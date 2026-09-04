'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  mfaEnabled: boolean;
  lastLogin?: string;
}

interface AuditEntry {
  id: string;
  actorEmail?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  context: Record<string, unknown>;
  createdAt: string;
}

export default function AdminPage() {
  const { token, user, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [actionFilter, setActionFilter] = useState('');
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  const isAdmin = user?.role === 'HR_ADMIN' || user?.role === 'DEPT_HEAD';

  const load = useCallback(async () => {
    if (!token || !isAdmin) return;
    try {
      const [u, s] = await Promise.all([
        apiClient.get<{ items: AdminUser[] }>(`/admin/users?pageSize=50&page=${page}`, token),
        apiClient.get<Record<string, number>>('/admin/stats', token),
      ]);
      setUsers(u.items);
      setStats(s);
      const a = await apiClient.get<{ items: AuditEntry[] }>(
        `/admin/audit-logs?pageSize=25${actionFilter ? `&action=${actionFilter}` : ''}`,
        token,
      );
      setAudit(a.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin data');
    }
  }, [token, isAdmin, page, actionFilter]);

  useEffect(() => {
    if (!loading && !token) router.push('/login');
  }, [loading, token, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeRole(userId: string, role: string) {
    if (!token) return;
    try {
      await apiClient.patch(`/admin/users/${userId}/role`, { role }, token);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Role change failed');
    }
  }

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold">Admin dashboard</h1>
          <p className="mt-2 text-muted-foreground">Only HR administrators can access this page.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

        {stats && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(stats).map(([k, v]) => (
              <Card key={k}>
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl font-bold">{v}</div>
                  <div className="text-xs capitalize text-muted-foreground">{k}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>Manage roles across the organisation</CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Role</th>
                    <th className="pb-2">MFA</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b py-1">
                      <td className="py-2">
                        <div className="font-medium">{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="py-2">
                        <select
                          value={u.role}
                          onChange={(e) => changeRole(u.id, e.target.value)}
                          className="rounded border border-input bg-background px-1.5 py-1 text-xs"
                        >
                          <option value="TALENT">TALENT</option>
                          <option value="REVIEWER">REVIEWER</option>
                          <option value="DEPT_HEAD">DEPT_HEAD</option>
                          <option value="HR_ADMIN">HR_ADMIN</option>
                        </select>
                      </td>
                      <td className="py-2">
                        <Badge variant={u.mfaEnabled ? 'secondary' : 'outline'}>
                          {u.mfaEnabled ? 'on' : 'off'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Prev
                </Button>
                <Button size="sm" variant="outline" disabled={users.length < 50} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Audit Log</CardTitle>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="rounded border border-input bg-background px-2 py-1 text-xs"
                >
                  <option value="">All actions</option>
                  <option value="USER_LOGIN">USER_LOGIN</option>
                  <option value="USER_LOGIN_FAILED">USER_LOGIN_FAILED</option>
                  <option value="PROJECT_STATUS_CHANGED">PROJECT_STATUS_CHANGED</option>
                  <option value="REVIEW_CREATED">REVIEW_CREATED</option>
                  <option value="FILE_UPLOADED">FILE_UPLOADED</option>
                  <option value="AI_REPORT_COMPLETED">AI_REPORT_COMPLETED</option>
                  <option value="USER_ROLE_CHANGED">USER_ROLE_CHANGED</option>
                </select>
              </div>
              <CardDescription>Immutable compliance trail (latest first)</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-xs">
                {audit.map((a) => (
                  <li key={a.id} className="rounded border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-medium">{a.action}</span>
                      <span className="text-muted-foreground">
                        {new Date(a.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-0.5 text-muted-foreground">
                      {a.actorEmail ?? 'system'} · {a.entityType ?? '—'}{' '}
                      {Object.keys(a.context ?? {}).length > 0 && (
                        <span className="font-mono">{JSON.stringify(a.context).slice(0, 120)}</span>
                      )}
                    </div>
                  </li>
                ))}
                {audit.length === 0 && <li className="text-muted-foreground">No audit entries yet.</li>}
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
