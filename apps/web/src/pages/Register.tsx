import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TurnstileWidget } from './TurnstileWidget';



export default function Register() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    // Step 1
    email: '',
    password: '',
    confirmPassword: '',
    nama_lengkap: '',
    // Step 2
    nama_bumdes: '',
    provinsi: '',
    kabupaten: '',
    kecamatan: '',
    desa: '',
    tahun_berdiri: '',
    // Step 3
    nama_penasihat: '',
    nama_direktur: '',
    nama_sekretaris: '',
    nama_bendahara: '',
    nama_pengawas_1: '',
    nama_pengawas_2: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');

  const update = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateStep1 = () => {
    if (!formData.email.includes('@')) return 'Email tidak valid';
    if (formData.password.length < 8) return 'Password minimal 8 karakter';
    if (formData.password !== formData.confirmPassword) return 'Password tidak sama';
    if (!formData.nama_lengkap.trim()) return 'Nama lengkap wajib diisi';
    return null;
  };

  const validateStep2 = () => {
    const required = ['nama_bumdes', 'provinsi', 'kabupaten', 'kecamatan', 'desa', 'tahun_berdiri'];
    for (const field of required) {
      if (!formData[field as keyof typeof formData].trim()) {
        const labels: Record<string, string> = {
          nama_bumdes: 'Nama BUM Desa',
          provinsi: 'Provinsi',
          kabupaten: 'Kabupaten/Kota',
          kecamatan: 'Kecamatan',
          desa: 'Desa',
          tahun_berdiri: 'Tahun Berdiri',
        };
        return `${labels[field]} wajib diisi`;
      }
    }
    const tahun = parseInt(formData.tahun_berdiri);
    if (isNaN(tahun) || tahun < 1900 || tahun > new Date().getFullYear()) {
      return 'Tahun berdiri tidak valid';
    }
    return null;
  };

  const validateStep3 = () => {
    const required = ['nama_penasihat', 'nama_direktur', 'nama_sekretaris', 'nama_bendahara', 'nama_pengawas_1'];
    for (const field of required) {
      if (!formData[field as keyof typeof formData].trim()) {
        const labels: Record<string, string> = {
          nama_penasihat: 'Nama Penasihat',
          nama_direktur: 'Nama Direktur',
          nama_sekretaris: 'Nama Sekretaris',
          nama_bendahara: 'Nama Bendahara',
          nama_pengawas_1: 'Nama Pengawas 1',
        };
        return `${labels[field]} wajib diisi`;
      }
    }
    return null;
  };

  const nextStep = () => {
    const validation = step === 1 ? validateStep1() : step === 2 ? validateStep2() : null;
    if (validation) {
      setError(validation);
      return;
    }
    setStep(step + 1);
  };

  const prevStep = () => {
    setStep(step - 1);
    setError('');
  };

  const handleSubmit = async () => {
    const validation = validateStep3();
    if (validation) {
      setError(validation);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, captchaToken }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registrasi gagal');
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Registrasi Berhasil!</h2>
          <p className="text-slate-600 mb-6">
            Kami telah mengirim link verifikasi ke <strong>{formData.email}</strong>. 
            Silakan cek email Anda dan klik link tersebut untuk mengaktifkan akun.
          </p>
          <Link
            to="/login"
            className="inline-block px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg transition"
          >
            Lanjut ke Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 to-white py-8 sm:py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6 sm:mb-8">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-cyan-600 transition-colors mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Kembali ke Beranda
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Daftar SILABU DIGI</h1>
          <p className="text-sm sm:text-base text-slate-600">Platform digital untuk BUM Desa se-Indonesia</p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                step >= s ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white' : 'bg-slate-200 text-slate-500'
              }`}>
                {s}
              </div>
              {s < 3 && <div className={`w-16 h-1 ${step > s ? 'bg-gradient-to-r from-cyan-600 to-blue-600' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Informasi Akun</h2>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => update('email', e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="nama@contoh.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nama Lengkap *</label>
                <input
                  type="text"
                  value={formData.nama_lengkap}
                  onChange={(e) => update('nama_lengkap', e.target.value)}
                  autoComplete="off"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="Nama lengkap PIC"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Password *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => update('password', e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="Minimal 8 karakter"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Konfirmasi Password *</label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => update('confirmPassword', e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="Ulangi password"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Data BUM Desa</h2>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nama BUM Desa *</label>
                <input
                  type="text"
                  value={formData.nama_bumdes}
                  onChange={(e) => update('nama_bumdes', e.target.value)}
                  autoComplete="off"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="Contoh: BUM Desa Maju Bersama"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Provinsi *</label>
                  <input
                    type="text"
                    value={formData.provinsi}
                    onChange={(e) => update('provinsi', e.target.value)}
                    autoComplete="off"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Contoh: Jawa Barat"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Kabupaten/Kota *</label>
                  <input
                    type="text"
                    value={formData.kabupaten}
                    onChange={(e) => update('kabupaten', e.target.value)}
                    autoComplete="off"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Contoh: Kab. Bandung"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Kecamatan *</label>
                  <input
                    type="text"
                    value={formData.kecamatan}
                    onChange={(e) => update('kecamatan', e.target.value)}
                    autoComplete="off"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Contoh: Cileunyi"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Desa *</label>
                  <input
                    type="text"
                    value={formData.desa}
                    onChange={(e) => update('desa', e.target.value)}
                    autoComplete="off"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Contoh: Cibiru Wetan"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tahun Berdiri *</label>
                <input
                  type="number"
                  value={formData.tahun_berdiri}
                  onChange={(e) => update('tahun_berdiri', e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="Contoh: 2020"
                  min="1900"
                  max={new Date().getFullYear()}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Pelaksana Operasional</h2>
              <p className="text-sm text-slate-600 mb-4">
                Isi nama lengkap pengurus sesuai jabatan masing-masing. Penasihat biasanya = Kepala Desa.
              </p>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Penasihat (Kepala Desa) *</label>
                <input
                  type="text"
                  value={formData.nama_penasihat}
                  onChange={(e) => update('nama_penasihat', e.target.value)}
                  autoComplete="off"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="Contoh: H. Ahmad Suhendra"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Direktur *</label>
                <input
                  type="text"
                  value={formData.nama_direktur}
                  onChange={(e) => update('nama_direktur', e.target.value)}
                  autoComplete="off"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="Nama lengkap direktur"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Sekretaris *</label>
                  <input
                    type="text"
                    value={formData.nama_sekretaris}
                    onChange={(e) => update('nama_sekretaris', e.target.value)}
                    autoComplete="off"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Nama lengkap sekretaris"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Bendahara *</label>
                  <input
                    type="text"
                    value={formData.nama_bendahara}
                    onChange={(e) => update('nama_bendahara', e.target.value)}
                    autoComplete="off"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Nama lengkap bendahara"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Pengawas 1 *</label>
                  <input
                    type="text"
                    value={formData.nama_pengawas_1}
                    onChange={(e) => update('nama_pengawas_1', e.target.value)}
                    autoComplete="off"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Nama pengawas pertama"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Pengawas 2 <span className="text-slate-400">(opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.nama_pengawas_2}
                    onChange={(e) => update('nama_pengawas_2', e.target.value)}
                    autoComplete="off"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Nama pengawas kedua"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <TurnstileWidget onVerify={t => setCaptchaToken(t)} className="flex justify-center mt-6" />
          )}

          <div className="flex gap-4 mt-8">
            {step > 1 && (
              <button
                onClick={prevStep}
                className="px-6 py-3 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition"
                disabled={loading}
              >
                Kembali
              </button>
            )}
            
            {step < 3 ? (
              <button
                onClick={nextStep}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg transition"
              >
                Lanjut
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Mendaftar...' : 'Daftar Sekarang'}
              </button>
            )}
          </div>

          <p className="text-center text-sm text-slate-600 mt-6">
            Sudah punya akun?{' '}
            <Link to="/login" className="text-cyan-600 font-semibold hover:underline">
              Login di sini
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
