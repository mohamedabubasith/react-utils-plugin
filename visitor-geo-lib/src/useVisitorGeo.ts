import { useEffect, useState } from 'react';

type VisitorGeo = {
  ip: string | null;
  error: string | null;
  loading: boolean;
  [key: string]: unknown;
};

// Utility to extract a message from an unknown error
function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

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
        const ipRes = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
        if (!ipRes.ok) throw new Error('Failed to fetch IP');

        const ipJson: { ip: string } = await ipRes.json();
        if (cancelled) return;

        const geoRes = await fetch(`https://ipapi.co/${encodeURIComponent(ipJson.ip)}/json/`, { cache: 'no-store' });
        if (!geoRes.ok) throw new Error('Failed to geolocate IP');

        const geoJson = await geoRes.json();
        if (cancelled) return;

        setState({
          ip: ipJson.ip ?? null,
          error: null,
          loading: false,
          ...geoJson,
        });
      } catch (e) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            error: getErrorMessage(e),
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
