import React, { useState } from 'react';
import { AdminLayout } from './AdminLayout';
import type { AdminPage } from './AdminLayout';
import { History, Filter } from 'lucide-react';

export default function AdminLogs({ current, onNavigate, onLogout }: {
  current: AdminPage;
  onNavigate: (p: AdminPage) => void;
  onLogout: () => void;
}) {
  const [logs] = useState<any[]>([]);

  return (
    <AdminLayout current={current} onNavigate={onNavigate} onLogout={onLogout}>
      <div className="admin-page">
        <div className="admin-header">
          <div>
            <h1 className="admin-title">Audit Logs</h1>
            <p className="admin-subtitle">System activity and audit trail</p>
          </div>
          <button className="admin-btn">
            <Filter size={18} />
            Filter
          </button>
        </div>

        <div className="admin-card">
          {logs.length === 0 ? (
            <div className="admin-empty">
              <History size={48} />
              <p>No audit logs yet</p>
            </div>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, idx) => (
                    <tr key={idx}>
                      <td>{new Date(log.timestamp).toLocaleString()}</td>
                      <td>{log.user}</td>
                      <td>{log.action}</td>
                      <td>{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
