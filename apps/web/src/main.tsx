import React from 'react';
import { createRoot } from 'react-dom/client';
import { ShieldCheck, Building2, FileText, ArrowRight } from 'lucide-react';
import './style.css';

function App() {
  return (
    <main className="page">
      <section className="hero">
        <div className="badge"><ShieldCheck size={16}/> Project baru aktif</div>
        <h1>SILABU DIGI</h1>
        <p className="subtitle">Sistem Laporan BUM Desa Digital. Dibangun ulang dengan struktur bersih, auth aman, dan migrasi fitur bertahap dari Laba BUMDes.</p>
        <div className="cards">
          <div className="card"><ShieldCheck/><h3>Auth Baru</h3><p>OTP, magic link, reset password, session rotation, account linking.</p></div>
          <div className="card"><Building2/><h3>Tenant BUM Desa</h3><p>Profil, legalitas, pelaksana, logo, kop surat.</p></div>
          <div className="card"><FileText/><h3>Migrasi Bertahap</h3><p>Fitur stabil dipindah satu per satu dari lababumdes.</p></div>
        </div>
        <a className="cta" href="/api/health">Cek API <ArrowRight size={18}/></a>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
