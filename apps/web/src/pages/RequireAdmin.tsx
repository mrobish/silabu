import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/** Safely decode JWT payload. Handles base64url (no padding). Returns null on failure. */
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // base64url → base64 with padding
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

/**
 * Route guard for /super-admin.
 * UX-only protection — real security is API 401/403.
 * Decodes JWT to check role before rendering children.
 */
export default function RequireAdmin({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');

    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    const payload = decodeJwtPayload(token);
    if (!payload) {
      // Invalid JWT — clear and redirect
      localStorage.removeItem('accessToken');
      sessionStorage.removeItem('accessToken');
      navigate('/login', { replace: true });
      return;
    }

    // Check expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('accessToken');
      sessionStorage.removeItem('accessToken');
      navigate('/login', { replace: true });
      return;
    }

    if (payload.role !== 'super_admin') {
      navigate('/app', { replace: true });
      return;
    }

    setAllowed(true);
  }, [navigate]);

  // Don't render children until role is verified
  if (!allowed) return null;
  return <>{children}</>;
}
