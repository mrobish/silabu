import React, { useState } from 'react';
import { Building2, LayoutDashboard, Users, FileText, Settings, History, LogOut, ChevronLeft, Menu } from 'lucide-react';
import type { Page } from './shared';

export type AdminPage = 'dashboard' | 'tenants' | 'users' | 'logs' | 'settings';

export function AdminSidebar({ current, onNavigate, onLogout }: {
  current: AdminPage;
  onNavigate: (p: AdminPage) => void;
  onLogout: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const items: { id: AdminPage; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'tenants', label: 'Tenants', icon: <Building2 size={20} /> },
    { id: 'users', label: 'Users', icon: <Users size={20} /> },
    { id: 'logs', label: 'Audit Logs', icon: <History size={20} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
  ];

  return (
    <aside className={`admin-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header" onClick={() => setCollapsed(!collapsed)}>
        <img src="/logo.png" alt="SILABU DIGI" className="sidebar-logo" />
        <ChevronLeft size={18} className="sidebar-toggle-icon" />
      </div>
      <nav className="sidebar-nav">
        {items.map(item => (
          <button
            key={item.id}
            className={`sidebar-link ${current === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button className="sidebar-link logout" onClick={onLogout}>
          <LogOut size={20} />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
}

export function AdminLayout({ current, onNavigate, onLogout, children }: {
  current: AdminPage;
  onNavigate: (p: AdminPage) => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="admin-layout">
      <div className={`admin-mobile-overlay ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(false)} />

      <aside className={`admin-sidebar-mobile ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <img src="/logo.png" alt="SILABU DIGI" className="sidebar-logo" />
          <button onClick={() => setMobileOpen(false)} className="sidebar-close">
            <ChevronLeft size={18} />
          </button>
        </div>
        <nav className="sidebar-nav">
          {(['dashboard', 'tenants', 'users', 'logs', 'settings'] as AdminPage[]).map(id => (
            <button key={id} className={`sidebar-link ${current === id ? 'active' : ''}`} onClick={() => { onNavigate(id); setMobileOpen(false); }}>
              {id === 'dashboard' && <LayoutDashboard size={20} />}
              {id === 'tenants' && <Building2 size={20} />}
              {id === 'users' && <Users size={20} />}
              {id === 'logs' && <History size={20} />}
              {id === 'settings' && <Settings size={20} />}
              <span>{id.charAt(0).toUpperCase() + id.slice(1)}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="sidebar-link logout" onClick={onLogout}>
            <LogOut size={20} />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <button className="admin-menu-btn" onClick={() => setMobileOpen(true)}>
            <Menu size={24} />
          </button>
          <AdminSidebar current={current} onNavigate={onNavigate} onLogout={onLogout} />
          <div className="admin-topbar-spacer" />
        </header>
        <main className="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}
