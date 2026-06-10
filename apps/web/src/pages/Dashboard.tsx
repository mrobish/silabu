import React, { useState, Suspense, useEffect } from 'react';
import '../admin.css';
import type { AdminPage } from './AdminLayout';
import type { Page } from './shared';
import { Building2, Save } from 'lucide-react';

const AdminDashboard = React.lazy(() => import('./AdminDashboard'));
const AdminTenants = React.lazy(() => import('./AdminTenants'));
const AdminUsers = React.lazy(() => import('./AdminUsers'));
const AdminLogs = React.lazy(() => import('./AdminLogs'));
const AdminSettings = React.lazy(() => import('./AdminSettings'));

function Loading() {
  return <div className="loading-screen"><div className="loading-spinner" /></div>;
}

function NoTenantPage({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({ nama_bumdes: '', alamat: '', npwp: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const r = await fetch('/api/tenant/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || 'Gagal membuat profil');
      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="setup-shell">
      <div className="setup-card">
        <div className="setup-icon"><Building2 size={36} /></div>
        <h1>Lengkapi Profil BUM Desa</h1>
        <p className="setup-desc">Satu langkah lagi untuk mulai menggunakan SILABU DIGI. Isi data BUM Desa Anda.</p>

        {error && <div className="settings-alert error"><span>{error}</span></div>}

        <form className="setup-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nama BUM Desa *</label>
            <input className="admin-input" value={form.nama_bumdes} onChange={e => setForm({...form, nama_bumdes: e.target.value})} placeholder="BUM Desa Banda Urang" required />
          </div>
          <div className="form-group">
            <label>Alamat *</label>
            <textarea className="admin-input setup-textarea" value={form.alamat} onChange={e => setForm({...form, alamat: e.target.value})} placeholder="Jl. Raya Desa No. 1, Kec. X, Kab. Y" required />
          </div>
          <div className="form-group">
            <label>NPWP (opsional)</label>
            <input className="admin-input" value={form.npwp} onChange={e => setForm({...form, npwp: e.target.value})} placeholder="00.000.000.0-000.000" />
          </div>
          <button type="submit" className="auth-submit primary" disabled={loading} style={{marginTop:8}}>
            <Save size={20} /> {loading ? 'Menyimpan...' : 'Simpan & Mulai'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Dashboard({ go }: { go: (p: Page) => void }) {
  const [adminPage, setAdminPage] = useState<AdminPage>('dashboard');
  const [tenantStatus, setTenantStatus] = useState<'loading'|'ok'|'no-tenant'>('loading');

  function checkTenant() {
    const token = localStorage.getItem('accessToken');
    if (!token) { go('login'); return; }
    fetch('/api/tenant/profile/check', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.error && d.statusCode === 401) { go('login'); return; }
        setTenantStatus(d.hasTenant ? 'ok' : 'no-tenant');
      })
      .catch(() => setTenantStatus('no-tenant'));
  }

  useEffect(checkTenant, [go]);

  if (tenantStatus === 'loading') return <Loading />;
  if (tenantStatus === 'no-tenant') return <NoTenantPage onCreated={checkTenant} />;

  function onLogout() {
    localStorage.clear();
    go('login');
  }

  const props = { current: adminPage, onNavigate: setAdminPage, onLogout };

  return (
    <Suspense fallback={<Loading />}>
      {adminPage === 'dashboard' && <AdminDashboard {...props} />}
      {adminPage === 'tenants' && <AdminTenants {...props} />}
      {adminPage === 'users' && <AdminUsers {...props} />}
      {adminPage === 'logs' && <AdminLogs {...props} />}
      {adminPage === 'settings' && <AdminSettings {...props} />}
    </Suspense>
  );
}
