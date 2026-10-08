'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { APP_CONFIG } from '@/lib/config/appConfig';
import { showToast } from '@/components/ui/Toast';

export default function LoginPage() {
  const [nik, setNik] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nik) {
      setError('Silakan masukkan NIK Anda');
      showToast.warning('Silakan masukkan NIK Anda');
      return;
    }

    if (nik.length !== 16) {
      setError('NIK harus tepat 16 digit angka');
      showToast.warning('NIK harus tepat 16 digit angka');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${APP_CONFIG.functionsBaseUrl}/nikLogin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nik })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal login');
      }

      const userCredential = await signInWithCustomToken(auth, data.token);
      const idToken = await userCredential.user.getIdToken();
      
      // Set cookie for middleware
      document.cookie = `session=${idToken}; path=/; max-age=${60 * 60 * 24 * 7}`;

      showToast.success(`Selamat datang, ${data.linmas?.nama || 'Anggota Linmas'}!`);
      router.push('/presensi');
    } catch (err: any) {
      const msg = err.message || 'Terjadi kesalahan saat login';
      setError(msg);
      showToast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-layout">
      <div className="login-header">
        <h1>🦺 LINMAS</h1>
        <p>Presensi Digital</p>
      </div>

      <form className="login-form" onSubmit={handleLogin}>
        <div className="form-group">
          <label htmlFor="nik">Nomor Induk Kependudukan (NIK)</label>
          <input
            id="nik"
            type="text"
            inputMode="numeric"
            value={nik}
            onChange={(e) => setNik(e.target.value.replace(/\D/g, ''))}
            placeholder="Masukkan NIK Anda"
            disabled={loading}
          />
        </div>
        
        {error && <p className="form-error">{error}</p>}
        
        <button type="submit" className="btn-login" disabled={loading}>
          {loading ? 'Masuk...' : 'MASUK'}
        </button>

        {/* Quick Demo Fill Linmas Tipes */}
        <div className="quick-access-box">
          <span className="quick-access-header">⚡ Pintasan Cepat Linmas Kelurahan Tipes:</span>
          <button
            type="button"
            className="btn-quick-shortcut"
            onClick={() => {
              setNik('3372020211760001');
              setError('');
            }}
          >
            <strong>🦺 HARYANTO (DANTON)</strong>
            <span className="quick-sub">NIK: 3372020211760001 • Regu A</span>
          </button>
          <button
            type="button"
            className="btn-quick-shortcut"
            onClick={() => {
              setNik('3372021108750002');
              setError('');
            }}
          >
            <strong>🦺 AGUS WAHYONO (WADANTON)</strong>
            <span className="quick-sub">NIK: 3372021108750002 • Regu B</span>
          </button>
          <button
            type="button"
            className="btn-quick-shortcut"
            onClick={() => {
              setNik('3372022408910003');
              setError('');
            }}
          >
            <strong>🦺 ANDI PURNOMO (ANGGOTA)</strong>
            <span className="quick-sub">NIK: 3372022408910003 • Regu A</span>
          </button>
        </div>
      </form>

      <div className="login-footer">
        <div className="footer-nav-links">
          <a href="/login/admin">🛡️ Admin Posko</a>
          <span className="footer-nav-dot">•</span>
          <a href="/login/admin?mode=superadmin">⭐ Super Admin</a>
        </div>
      </div>
    </div>
  );
}
