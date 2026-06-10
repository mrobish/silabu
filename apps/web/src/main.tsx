import React, { useState, useEffect, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

// ─── API helper ───
const API = '/api';
async function api(path: string, body: any) {
  const r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Request gagal');
  return d;
}

// ─── Lazy pages ───
const Home = React.lazy(() => import('./pages/Home'));
const Login = React.lazy(() => import('./pages/Login'));
const Register = React.lazy(() => import('./pages/Register'));
const Verify = React.lazy(() => import('./pages/Verify'));
const Forgot = React.lazy(() => import('./pages/Forgot'));
const Reset = React.lazy(() => import('./pages/Reset'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));

function Loading() {
  return <div className="loading-screen"><div className="loading-spinner" /></div>;
}

// ─── Page transition ───
function FadeIn({ children, pageKey }: { children: React.ReactNode; pageKey: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(false);
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setShow(true)));
    return () => cancelAnimationFrame(t);
  }, [pageKey]);
  return <div className={`fade-page ${show ? 'fade-in' : 'fade-out'}`}>{children}</div>;
}

// ─── Router ───
type Page = 'home' | 'login' | 'register' | 'verify' | 'forgot' | 'reset' | 'dashboard';

function pageToPath(p: Page): string {
  if (p === 'home') return '/';
  if (p === 'verify') return '/verify-email';
  if (p === 'forgot') return '/forgot-password';
  if (p === 'reset') return '/reset-password';
  return '/' + p;
}

function pathToPage(path: string): Page {
  if (path.includes('login')) return 'login';
  if (path.includes('register')) return 'register';
  if (path.includes('verify')) return 'verify';
  if (path.includes('forgot')) return 'forgot';
  if (path.includes('reset')) return 'reset';
  if (path.includes('dashboard')) return 'dashboard';
  return 'home';
}

function App() {
  const [page, setPageRaw] = useState<Page>(pathToPage(location.pathname));

  const go = (p: Page) => {
    setPageRaw(p);
    history.pushState({ page: p }, '', pageToPath(p));
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    function onPop(e: PopStateEvent) {
      setPageRaw(e.state?.page || pathToPage(location.pathname));
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const render = () => {
    switch (page) {
      case 'login': return <Login go={go} />;
      case 'register': return <Register go={go} />;
      case 'verify': return <Verify go={go} />;
      case 'forgot': return <Forgot go={go} />;
      case 'reset': return <Reset go={go} />;
      case 'dashboard': return <Dashboard go={go} />;
      default: return <Home go={go} />;
    }
  };

  return (
    <FadeIn pageKey={page}>
      <Suspense fallback={<Loading />}>
        {render()}
      </Suspense>
    </FadeIn>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
