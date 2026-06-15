import './style.css';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import Home from './pages/Home';
import RegisterChoice from './pages/RegisterChoice';
import RegisterEmail from './pages/RegisterEmail';
import VerifyOTP from './pages/VerifyOTP';
import SetPassword from './pages/SetPassword';
import DataBumdes from './pages/DataBumdes';
import LoginChoice from './pages/LoginChoice';
import LoginEmail from './pages/LoginEmail';
import LoginCallback from './pages/LoginCallback';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AppDashboard from './pages/AppDashboard';
import SuperAdmin from './pages/SuperAdmin';
import RequireAdmin from './pages/RequireAdmin';
import ChangePassword from './pages/ChangePassword';
import InvoicePage from './pages/InvoicePage';
import FAQ from './pages/FAQ';
import VerifyOtpPage from './pages/VerifyOtpPage';

// ── Global 401 interceptor ──────────────────────────────────
// Wraps native fetch to auto-logout on 401 (token invalid/expired).
// ONLY intercepts API requests (URL contains '/api/'), not all fetch calls.
const originalFetch = window.fetch;
window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
  const res = await originalFetch(...args);
  
  // Only handle 401 for API requests
  const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof URL ? args[0].href : args[0]?.url || '';
  const isApiRequest = url.includes('/api/');
  
  if (res.status === 401 && isApiRequest) {
    // Only redirect if we're not already on a login/register page
    const path = window.location.pathname;
    const isPublicPage = path === '/' || path.startsWith('/login') || path.startsWith('/register') || path.startsWith('/forgot') || path.startsWith('/reset') || path.startsWith('/verify-otp');
    if (!isPublicPage) {
      try {
        localStorage.removeItem('accessToken');
        sessionStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        sessionStorage.removeItem('refreshToken');
      } catch {}
      window.location.href = '/login/email?reason=session_expired';
    }
  }
  return res;
};

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  // Registration flow
  { path: '/register', element: <RegisterChoice /> },
  { path: '/register/email', element: <RegisterEmail /> },
  { path: '/register/verify-otp', element: <VerifyOTP /> },
  { path: '/register/set-password', element: <SetPassword /> },
  { path: '/register/data-bumdes', element: <DataBumdes /> },
  // Login flow
  { path: '/login', element: <LoginChoice /> },
  { path: '/login/email', element: <LoginEmail /> },
  { path: '/login/callback', element: <LoginCallback /> },
  { path: '/verify-otp', element: <VerifyOtpPage /> },
  // Password recovery
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/reset-password', element: <ResetPassword /> },
  // App
  { path: '/app', element: <AppDashboard /> },
  { path: '/super-admin', element: <RequireAdmin><SuperAdmin /></RequireAdmin> },
  { path: '/change-password', element: <ChangePassword /> },
  { path: '/invoice/:paymentId', element: <InvoicePage /> },
  { path: '/faq', element: <FAQ /> },
]);

createRoot(document.getElementById('root')!).render(
  <RouterProvider router={router} />
);
