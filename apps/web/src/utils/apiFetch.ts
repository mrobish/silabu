/**
 * Shared API helper — uniform error handling for all fetch calls.
 * Handles: 413 Payload Too Large, 400 Array Limit, network errors.
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
