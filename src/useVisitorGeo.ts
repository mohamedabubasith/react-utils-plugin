import { useEffect, useRef, useState } from 'react';

export type VisitorGeo = {
  ip: string | null;
  country: string | null;
  countryCode: string | null;
  timezone: string | null;
  error: string | null;
  loading: boolean;
};

export type UseVisitorGeoOptions = {
  // Optional: custom fetch implementations or endpoints
  fetchIp?: () => Promise<{ ip: string }>;
  fetchGeo?: (ip: string) => Promise<{
    country_name?: string;
    country?: string;
    timezone?: string;
  }>;
  // Optional: run only when a condition is true (e.g., consent)
  enabled?: boolean;
  // Optional: cache key and ttl (ms) to minimize API calls
  cacheKey?: string;
  cacheTtlMs?: number;
  // Optional: timeout for each request
  timeoutMs?: number;
};

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function defaultFetchIp(timeoutMs?: number) {
  const req = fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
  const res = await (timeoutMs ? withTimeout(req, timeoutMs) : req);
  if (!('ok' in res) || !res.ok) throw new Error('ipify failed');
  const json = await res.json() as { ip: string };
  if (!json?.ip) throw new Error('ip missing');
  return json;
}

async function defaultFetchGeo(ip: string, timeoutMs?: number) {
  const url = `https://ipapi.co/${encodeURIComponent(ip)}/json/`;
  const req = fetch(url, { cache: 'no-store' });
  const res = await (timeoutMs ? withTimeout(req, timeoutMs) : req);
  if (!('ok' in res) || !res.ok) throw new Error('ipapi failed');
  return res.json() as Promise<{ country_name?: string; country?: string; timezone?: string }>;
}

function readCache(key: string) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; data: VisitorGeo };
    if (!parsed?.ts || !parsed?.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: VisitorGeo) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // ignore
  }
}

export function useVisitorGeo(options: UseVisitorGeoOptions = {}): VisitorGeo {
  const {
    fetchIp = () => defaultFetchIp(options.timeoutMs),
    fetchGeo = (ip) => defaultFetchGeo(ip, options.timeoutMs),
    enabled = true,
    cacheKey = 'useVisitorGeo:v1',
    cacheTtlMs = 6 * 60 * 60 * 1000, // 6h
  } = options;

  const [state, setState] = useState<VisitorGeo>({
    ip: null,
    country: null,
    countryCode: null,
    timezone: null,
    error: null,
    loading: enabled,
  });

  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    // Try cache
    const cached = readCache(cacheKey);
    if (cached && Date.now() - cached.ts < cacheTtlMs) {
      setState({ ...cached.data, loading: false, error: null });
      return;
    }

    let cancelled = false;

    async function run() {
      try {
        const ipJson = await fetchIp();
        if (cancelled) return;
        const geoJson = await fetchGeo(ipJson.ip);
        if (cancelled) return;

        const next: VisitorGeo = {
          ip: ipJson.ip ?? null,
          country: geoJson?.country_name ?? null,
          countryCode: geoJson?.country ?? null,
          timezone: geoJson?.timezone ?? null,
          error: null,
          loading: false,
        };

        writeCache(cacheKey, next);
        if (mounted.current && !cancelled) setState(next);
      } catch (e: any) {
        if (mounted.current && !cancelled) {
          setState((s) => ({
            ...s,
            error: e?.message || 'Failed to resolve IP/geolocation',
            loading: false,
          }));
        }
      }
    }

    setState((s) => ({ ...s, loading: true, error: null }));
    run();

    return () => { cancelled = true; };
  }, [enabled, cacheKey, cacheTtlMs, fetchIp, fetchGeo]);

  return state;
}

export default useVisitorGeo;
