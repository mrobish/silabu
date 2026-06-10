import React, { useState, Suspense, useEffect } from 'react';
import '../admin.css';
import type { AdminPage } from './AdminLayout';
import type { Page } from './shared';
import { Building2 } from 'lucide-react';

const AdminDashboard = React.lazy(() => import('./AdminDashboard'));
const AdminTenants = React.lazy(() => import('./AdminTenants'));
const AdminUsers = React.lazy(() => import('./AdminUsers'));
const AdminLogs = React.lazy(() => import('./AdminLogs'));
const AdminSettings = React.lazy(() => import('./AdminSettings'));

function Loading() {
  return <div className="loading-screen"><div className="loading-spinner" /></div>;
}

function NoTenantPage({ go }: { go: (p: Page) => void }) {
  return (
    <div className="auth-shell">
      <div className="auth-card" style={{maxWidth:480}}>
        <div style={{display:'grid',placeItems:'center',marginBottom:16}}>
          <div style={{width:64,height:64,borderRadius:16,background:'linear-gradient(135deg,#0891b2,#2563eb)',display:'grid',placeItems:'center',color:'white'}}><Building2 size={32}/></div>
        </div>
        <h1 style={{margin:0,fontSize:26}}>Profil belum tersedia</h1>
        <p style={{color:'#64748b',margin:'12px 0 24px',lineHeight:1.6}}>
          Akun Anda belum memiliki profil BUM Desa. Silakan hubungi admin untuk membuat profil organisasi Anda.
        </p>
        <button className="auth-submit primary" onClick={() => { localStorage.clear(); go('login'); }}>
          Logout
        </button>
      </div>
    </div>
  );
}

export default function Dashboard({ go }: { go: (p: Page) => void }) {
  const [adminPage, setAdminPage] = useState<AdminPage>('dashboard');
  const [tenantStatus, setTenantStatus] = useState<'loading'|'ok'|'no-tenant'>('loading');

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { go('login'); return; }
    fetch('/api/tenant/profile/check', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.error && d.statusCode === 401) { go('login'); return; }
        setTenantStatus(d.hasTenant ? 'ok' : 'no-tenant');
      })
      .catch(() => setTenantStatus('no-tenant'));
  }, [go]);

  if (tenantStatus === 'loading') return <Loading />;
  if (tenantStatus === 'no-tenant') return <NoTenantPage go={go} />;

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
