import { useEffect, useRef, useState } from 'react';

// Cloudflare Turnstile widget component
// Site key fetched from backend config endpoint
// Token callback is exposed via onVerify prop

interface TurnstileProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  className?: string;
}

const CONTAINER_ID = 'turnstile-widget';

// Load Turnstile script once globally
let scriptLoading = false;
let scriptLoaded = false;
function loadScript(siteKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (scriptLoaded) { resolve(); return; }
    if (scriptLoading) { waitForLoad(resolve, reject); return; }
    scriptLoading = true;
    const s = document.createElement('script');
    s.src = `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`;
    s.async = true;
    s.defer = true;
    s.onload = () => { scriptLoaded = true; scriptLoading = false; resolve(); };
    s.onerror = () => { scriptLoading = false; reject(new Error('Gagal memuat Turnstile')); };
    document.head.appendChild(s);
  });
}

const waiters: Array<{ ok: () => void; err: (e: any) => void }> = [];
function waitForLoad(ok: () => void, err: (e: any) => void) {
  waiters.push({ ok, err });
  const check = setInterval(() => {
    if (scriptLoaded) { clearInterval(check); waiters.forEach(w => w.ok()); waiters.length = 0; }
  }, 100);
}

export function TurnstileWidget({ onVerify, onExpire, className }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/captcha-config');
        const data = await res.json();
        if (cancelled || !data.enabled || !data.siteKey) { setLoading(false); return; }
        setEnabled(true);
        await loadScript(data.siteKey);
        if (cancelled) return;
        const render = () => {
          if (!containerRef.current || widgetId.current) return;
          const id = (window as any).turnstile.render(containerRef.current, {
            sitekey: data.siteKey,
            callback: (token: string) => onVerify(token),
            'expired-callback': () => { onExpire?.(); onVerify(''); },
            'error-callback': () => setError('CAPTCHA error, refresh halaman'),
          });
          widgetId.current = id;
          setLoading(false);
        };
        if ((window as any).turnstile) { render(); }
        else { setTimeout(render, 500); }
      } catch (e: any) {
        if (!cancelled) { setError(e.message); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!enabled && !loading) return null;

  return (
    <div className={className}>
      {loading && <p className="text-xs text-slate-400">Memuat verifikasi...</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div ref={containerRef} id={CONTAINER_ID} className={loading ? 'h-0 overflow-hidden' : ''} />
    </div>
  );
}
