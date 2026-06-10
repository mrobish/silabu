import { ArrowRight, Sparkles, ShieldCheck, KeyRound, CheckCircle2, FileText, BarChart3, Users, Building2 } from 'lucide-react';
import type { Page } from "./shared";
import { Navbar } from "./shared";
interface HomeProps {
  go: (p: Page) => void;
}

export default function Home({ go }: HomeProps) {
  return (
    <div className="home-page">
      <Navbar go={go} />

      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">
            <Sparkles size={16} />
            Platform Baru — Arsitektur Modern
          </div>
          <h1 className="hero-title">
            Sistem Laporan{' '}
            <span className="gradient-text">BUM Desa Digital</span>
          </h1>
          <p className="hero-desc">
            Kelola keuangan BUMDes dengan mudah, aman, dan transparan.
            Platform akuntansi digital yang dirancang khusus untuk Badan Usaha Milik Desa
            dengan standar keamanan modern dan laporan yang komprehensif.
          </p>
          <div className="hero-cta">
            <button className="btn-primary btn-lg" onClick={() => go('register')}>
              Mulai Sekarang <ArrowRight size={18} />
            </button>
            <button className="btn-ghost btn-lg" onClick={() => go('login')}>
              Sudah punya akun? Masuk
            </button>
          </div>
        </div>
      </section>

      <section className="features-section">
        <h2 className="section-title">Keamanan Terdepan</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon cyan">
              <CheckCircle2 size={28} />
            </div>
            <h3>Email Terverifikasi</h3>
            <p>Setiap akun diverifikasi melalui email untuk memastikan identitas pengguna yang sah.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon blue">
              <KeyRound size={28} />
            </div>
            <h3>Session Rotation</h3>
            <p>Token sesi dirotasi secara otomatis untuk mencegah pembajakan sesi dan akses tidak sah.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon green">
              <ShieldCheck size={28} />
            </div>
            <h3>Audit Log Lengkap</h3>
            <p>Semua aktivitas tercatat dalam audit log untuk transparansi dan akuntabilitas penuh.</p>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <img src="/logo.png" alt="SILABU DIGI" className="footer-logo" />
        <p>&copy; {new Date().getFullYear()} SILABU DIGI. Hak cipta dilindungi.</p>
      </footer>
    </div>
  );
}
