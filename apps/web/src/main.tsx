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
import ChangePassword from './pages/ChangePassword';
import InvoicePage from './pages/InvoicePage';
import FAQ from './pages/FAQ';

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
  // Password recovery
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/reset-password', element: <ResetPassword /> },
  // App
  { path: '/app', element: <AppDashboard /> },
  { path: '/super-admin', element: <SuperAdmin /> },
  { path: '/change-password', element: <ChangePassword /> },
  { path: '/invoice/:paymentId', element: <InvoicePage /> },
  { path: '/faq', element: <FAQ /> },
]);

createRoot(document.getElementById('root')!).render(
  <RouterProvider router={router} />
);
