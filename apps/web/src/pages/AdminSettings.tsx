import React from 'react';
import { AdminLayout } from './AdminLayout';
import type { AdminPage } from './AdminLayout';
import { Settings, Save } from 'lucide-react';

export default function AdminSettings({ current, onNavigate, onLogout }: {
  current: AdminPage;
  onNavigate: (p: AdminPage) => void;
  onLogout: () => void;
}) {
  return (
    <AdminLayout current={current} onNavigate={onNavigate} onLogout={onLogout}>
      <div className="admin-page">
        <h1 className="admin-title">Settings</h1>
        <p className="admin-subtitle">Configure system settings</p>

        <div className="admin-card">
          <h2>Profile</h2>
          <div className="admin-form">
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" className="admin-input" placeholder="Enter your name" />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" className="admin-input" placeholder="Enter your email" />
            </div>
            <button className="admin-btn primary">
              <Save size={18} />
              Save Changes
            </button>
          </div>
        </div>

        <div className="admin-card">
          <h2>System Configuration</h2>
          <div className="admin-form">
            <div className="form-group">
              <label>Application Name</label>
              <input type="text" className="admin-input" defaultValue="SILABU DIGI" />
            </div>
            <div className="form-group">
              <label>Default Language</label>
              <select className="admin-input">
                <option>Indonesian</option>
                <option>English</option>
              </select>
            </div>
            <button className="admin-btn primary">
              <Save size={18} />
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
