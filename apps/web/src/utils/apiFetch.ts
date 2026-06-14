/**
 * Shared API helper — uniform error handling for all fetch calls.
 * Handles: 401 auto-logout, 413 Payload Too Large, 400 Array Limit, network errors.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiFetch(url: string, options: RequestInit): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
  }

  // 413 — Fastify body limit exceeded
  if (res.status === 413) {
    throw new Error('Data yang dikirim terlalu besar. Kurangi jumlah baris/item.');
  }

  // 401 — Token invalid/expired → auto-logout + redirect
  if (res.status === 401) {
    try {
      localStorage.removeItem('accessToken');
      sessionStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      sessionStorage.removeItem('refreshToken');
    } catch {}
    // Redirect to login with message
    const loginUrl = '/login/email?reason=session_expired';
    if (typeof window !== 'undefined') {
      window.location.href = loginUrl;
    }
    throw new Error('Sesi Anda sudah berakhir, silakan login kembali.');
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Server error (${res.status}). Silakan coba lagi.`);
  }

  if (!res.ok) {
    throw new Error(data.error || data.message || `Gagal (${res.status})`);
  }

  return data;
}
