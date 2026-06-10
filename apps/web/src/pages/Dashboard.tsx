import { FileText, BarChart3, Users, CheckCircle2 } from 'lucide-react';
import type { Page } from "./shared";
import { Navbar } from "./shared";

export default function Dashboard() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const dashCards = [
    {
      icon: <FileText size={32} />,
      title: 'Profil BUM Desa',
      description: 'Kelola data profil dan identitas BUM Desa Anda.',
      status: 'Segera',
    },
    {
      icon: <BarChart3 size={32} />,
      title: 'Laporan Keuangan',
      description: 'Pantau arus kas dan laporan keuangan secara berkala.',
      status: 'Segera',
    },
    {
      icon: <Users size={32} />,
      title: 'Pengguna',
      description: 'Atur akses dan kelola pengguna sistem.',
      status: 'Segera',
    },
  ];

  return (
    <>
      <Navbar loggedIn />
      <Page>
        <div className="dash-page">
          <div className="dash-hero">
            <div className="dash-avatar">
              {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="dash-welcome">
              <h1>Selamat datang, {user.email || 'Pengguna'}!</h1>
              <span className="role-badge">{user.role || 'User'}</span>
            </div>
          </div>

          <div className="dash-grid">
            {dashCards.map((card, idx) => (
              <div className="dash-card" key={idx}>
                <div className="dash-card-icon">{card.icon}</div>
                <h3>{card.title}</h3>
                <p className="dash-card-desc">{card.description}</p>
                <span className="dash-card-status">{card.status}</span>
              </div>
            ))}
          </div>

          <div className="dash-notice">
            <CheckCircle2 size={20} />
            <span>Auth aktif — pondasi siap. Fitur tenant sedang dibangun.</span>
          </div>
        </div>
      </Page>
    </>
  );
}
