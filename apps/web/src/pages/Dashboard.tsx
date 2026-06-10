import React, { useState, Suspense } from 'react';
import '../admin.css';
import type { AdminPage } from './AdminLayout';
import type { Page } from './shared';

const AdminDashboard = React.lazy(() => import('./AdminDashboard'));
const AdminTenants = React.lazy(() => import('./AdminTenants'));
const AdminUsers = React.lazy(() => import('./AdminUsers'));
const AdminLogs = React.lazy(() => import('./AdminLogs'));
const AdminSettings = React.lazy(() => import('./AdminSettings'));

function Loading() {
  return <div className="loading-screen"><div className="loading-spinner" /></div>;
}

export default function Dashboard({ go }: { go: (p: Page) => void }) {
  const [adminPage, setAdminPage] = useState<AdminPage>('dashboard');

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
