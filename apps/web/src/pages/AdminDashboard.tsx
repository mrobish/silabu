import React from 'react';
import { AdminLayout } from './AdminLayout';
import type { AdminPage } from './AdminLayout';
import { Building2, Users, FileText, Activity } from 'lucide-react';

export default function AdminDashboard({ current, onNavigate, onLogout }: {
  current: AdminPage;
  onNavigate: (p: AdminPage) => void;
  onLogout: () => void;
}) {
  const stats = [
    { label: 'Total Tenants', value: '0', icon: <Building2 size={24} />, color: '#3b82f6' },
    { label: 'Total Users', value: '0', icon: <Users size={24} />, color: '#10b981' },
    { label: 'Transactions', value: '0', icon: <FileText size={24} />, color: '#f59e0b' },
    { label: 'System Status', value: 'Active', icon: <Activity size={24} />, color: '#06b6d4' },
  ];

  return (
    <AdminLayout current={current} onNavigate={onNavigate} onLogout={onLogout}>
      <div className="admin-page">
        <h1 className="admin-title">Dashboard</h1>
        <p className="admin-subtitle">Welcome to SILABU DIGI Admin Panel</p>

        <div className="admin-stats">
          {stats.map((stat, idx) => (
            <div key={idx} className="stat-card" style={{ animationDelay: `${idx * 0.05}s` }}>
              <div className="stat-icon" style={{ color: stat.color }}>
                {stat.icon}
              </div>
              <div className="stat-info">
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="admin-card">
          <h2>Recent Activity</h2>
          <div className="admin-empty">
            <Activity size={48} />
            <p>No recent activity</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
