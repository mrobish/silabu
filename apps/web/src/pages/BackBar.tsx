import { Link } from 'react-router-dom';

export default function BackBar() {
  return (
    <div className="sticky top-0 z-50 flex items-center gap-3 px-4 py-3 bg-white/80 backdrop-blur-sm border-b border-slate-100">
      <Link to="/" className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-cyan-600 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span>Beranda</span>
      </Link>
      <div className="flex-1" />
      <Link to="/" className="flex items-center">
        <img src="/logo.png" alt="SILABU DIGI" className="h-7 w-auto" />
      </Link>
    </div>
  );
}
