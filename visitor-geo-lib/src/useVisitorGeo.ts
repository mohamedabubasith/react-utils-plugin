import { useEffect, useState } from 'react';

type VisitorGeo = {
  ip: string | null;
  error: string | null;
  loading: boolean;
  // include all fields coming from ipapi.co payload; keep them typed as unknown or specific partials
  // so consumers can narrow as needed.
  [key: string]: unknown;
};

export function useVisitorGeo(): VisitorGeo {
  const [state, setState] = useState<VisitorGeo>({
    ip: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        // 1) Get public IP
        const ipRes = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
        if (!ipRes.ok) throw new Error('Failed to fetch IP');
        const ipJson: { ip: string } = await ipRes.json();

        if (cancelled) return;

        // 2) Geolocate IP (ipapi.co returns many fields)
        const geoRes = await fetch(`https://ipapi.co/${encodeURIComponent(ipJson.ip)}/json/`, { cache: 'no-store' });
        if (!geoRes.ok) throw new Error('Failed to geolocate IP');
        const geoJson = await geoRes.json();

        if (cancelled) return;

        // Return all geodata alongside ip
        setState({
          ip: ipJson.ip ?? null,
          error: null,
          loading: false,
          ...geoJson,
        });
      } catch (e: any) {
        if (!cancelled) {
          setState(s => ({
            ...s,
            error: e?.message || 'Failed to get IP/geolocation',
            loading: false,
          }));
        }
      }
    }

    run();
    return () => { cancelled = true; };
  }, []);

  return state;
}
