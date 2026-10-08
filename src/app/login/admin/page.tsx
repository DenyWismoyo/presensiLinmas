'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, getIdTokenResult } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';

export default function AdminLoginPage() {
  const [mode, setMode] = useState<'admin' | 'superadmin'>('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'superadmin') {
        setMode('superadmin');
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Silakan masukkan email dan password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const tokenResult = await getIdTokenResult(userCredential.user, true);
      const idToken = tokenResult.token;
      const role = tokenResult.claims.role || (email.includes('superadmin') ? 'superadmin' : 'admin');

      // Set cookie for middleware
      document.cookie = `session=${idToken}; path=/; max-age=${60 * 60 * 24 * 7}`;

      // Pintasan routing otomatis berdasarkan role
      if (role === 'superadmin' || mode === 'superadmin') {
        router.push('/superadmin');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      let errorMsg = 'Terjadi kesalahan saat login';
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        errorMsg = 'Email atau password salah';
      } else if (err.code === 'auth/too-many-requests') {
        errorMsg = 'Terlalu banyak percobaan. Coba lagi nanti.';
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Quick fill shortcut
  const handleQuickFill = (targetRole: 'admin' | 'superadmin') => {
    if (targetRole === 'superadmin') {
      setMode('superadmin');
      setEmail('superadmin@test.com');
      setPassword('password123');
      setError('');
    } else {
      setMode('admin');
      setEmail('admin@test.com');
      setPassword('password123');
      setError('');
    }
  };

  return (
    <div className="login-layout">
      <div className="login-header">
        <h1>{mode === 'superadmin' ? '⭐ SUPER ADMIN' : '🛡️ ADMIN POSKO'}</h1>
        <p>
          {mode === 'superadmin'
            ? 'Portal Kontrol Wilayah & Geotagging'
            : 'Login Pengelola Unit & Presensi Linmas'}
        </p>
      </div>

      <div className="login-form">
        {/* Role Mode Tabs */}
        <div className="role-tabs">
          <button
            type="button"
            className={`role-tab-btn ${mode === 'admin' ? 'active' : ''}`}
            onClick={() => {
              setMode('admin');
              setError('');
            }}
          >
            🛡️ Admin Posko
          </button>
          <button
            type="button"
            className={`role-tab-btn ${mode === 'superadmin' ? 'active' : ''}`}
            onClick={() => {
              setMode('superadmin');
              setError('');
            }}
          >
            ⭐ Super Admin
          </button>
        </div>

        <form onSubmit={handleLogin} className="form-group">
          <div className="form-group">
            <label htmlFor="email">
              {mode === 'superadmin' ? 'Email Super Admin' : 'Email Admin Posko'}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={mode === 'superadmin' ? 'superadmin@test.com' : 'admin@test.com'}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              required
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <button
            type="submit"
            className={`btn-login ${mode === 'superadmin' ? 'btn-superadmin' : 'btn-admin'}`}
            disabled={loading}
          >
            {loading
              ? 'Memverifikasi...'
              : mode === 'superadmin'
              ? '⭐ MASUK SEBAGAI SUPER ADMIN'
              : '🛡️ MASUK SEBAGAI ADMIN POSKO'}
          </button>
        </form>

        {/* Pintasan Akses Cepat (Quick Login Demo) */}
        <div className="quick-access-box">
          <span className="quick-access-header">⚡ Pintasan Masuk Cepat (Akun Uji):</span>
          <div className="quick-btn-grid">
            <button
              type="button"
              className="btn-quick-shortcut superadmin-quick"
              onClick={() => handleQuickFill('superadmin')}
              title="Isi otomatis kredensial Super Admin"
            >
              <strong>⭐ Super Admin</strong>
              <span className="quick-sub">superadmin@test.com</span>
            </button>
            <button
              type="button"
              className="btn-quick-shortcut"
              onClick={() => handleQuickFill('admin')}
              title="Isi otomatis kredensial Admin Posko"
            >
              <strong>🛡️ Admin Posko</strong>
              <span className="quick-sub">admin@test.com</span>
            </button>
          </div>
        </div>
      </div>

      <div className="login-footer">
        <div className="footer-nav-links">
          <a href="/login" className="link-dark">
            ← Login Linmas (NIK)
          </a>
          <span className="footer-nav-dot">•</span>
          {mode === 'admin' ? (
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setMode('superadmin');
              }}
            >
              Pintasan Super Admin
            </a>
          ) : (
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setMode('admin');
              }}
            >
              Pintasan Admin Posko
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

