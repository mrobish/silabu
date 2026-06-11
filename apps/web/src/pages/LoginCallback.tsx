import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function LoginCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get('token');
    const role = params.get('role') || 'bumdes';
    if (token) {
      localStorage.setItem('accessToken', token);
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => {
          if (d.user) {
            localStorage.setItem('user', JSON.stringify(d.user));
            navigate(d.user.role === 'super_admin' ? '/super-admin' : '/app');
          } else {
            navigate('/login');
          }
        })
        .catch(() => navigate('/login'));
    } else {
      navigate('/login');
    }
  }, []);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
      <p className="text-sm text-slate-500">Mengalihkan...</p>
    </div>
  );
}
