import './style.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      {/* Registration flow */}
      <Route path="/register" element={<RegisterChoice />} />
      <Route path="/register/email" element={<RegisterEmail />} />
      <Route path="/register/verify-otp" element={<VerifyOTP />} />
      <Route path="/register/set-password" element={<SetPassword />} />
      <Route path="/register/data-bumdes" element={<DataBumdes />} />
      {/* Login flow */}
      <Route path="/login" element={<LoginChoice />} />
      <Route path="/login/email" element={<LoginEmail />} />
      <Route path="/login/callback" element={<LoginCallback />} />
      {/* Password recovery */}
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* App */}
      <Route path="/app" element={<AppDashboard />} />
      <Route path="/super-admin" element={<SuperAdmin />} />
      <Route path="/change-password" element={<ChangePassword />} />
    </Routes>
  </BrowserRouter>
);
