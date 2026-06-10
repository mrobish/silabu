import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import AppDashboard from './pages/AppDashboard';
import SuperAdmin from './pages/SuperAdmin';
import './style.css';

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/app/*" element={<AppDashboard />} />
      <Route path="/super-admin/*" element={<SuperAdmin />} />
    </Routes>
  </BrowserRouter>
);
