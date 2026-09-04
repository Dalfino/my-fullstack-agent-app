'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

/**
 * Renders a project file (image) that lives behind JWT auth: fetches the raw
 * bytes with the auth header, then displays them via an object URL.
 * Object URLs are cached per (fileId, token) for the session lifetime.
 */
const cache = new Map<string, string>();

export function AuthedImage({
  projectId,
  fileId,
  alt,
  className,
}: {
  projectId: string;
  fileId: string;
  alt?: string;
  className?: string;
}) {
  const { token } = useAuth();
  const [src, setSrc] = useState<string | null>(cache.get(fileId) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (src || !token || failed) return;
    let revoke: string | null = null;
    const key = `${fileId}`;
    fetchRaw().then((url) => {
      if (url) {
        cache.set(key, url);
        setSrc(url);
      } else {
        setFailed(true);
      }
    });

    async function fetchRaw(): Promise<string | null> {
      try {
        const base = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';
        const res = await fetch(`${base}/projects/${projectId}/files/${fileId}/raw`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return null;
        const blob = await res.blob();
        revoke = URL.createObjectURL(blob);
        return revoke;
      } catch {
        return null;
      }
    }

    return () => {
      // keep the cache warm; individual object URLs are tiny relative to images
      if (revoke && !cache.has(key)) URL.revokeObjectURL(revoke);
    };
  }, [projectId, fileId, token, src, failed]);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-muted text-xs text-muted-foreground ${className ?? ''}`}
      >
        preview unavailable
      </div>
    );
  }
  if (!src) {
    return <div className={`animate-pulse bg-muted ${className ?? ''}`} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt ?? 'project visual'} className={className} />;
}
