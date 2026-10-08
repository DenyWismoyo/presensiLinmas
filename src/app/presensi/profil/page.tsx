'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/hooks/useAuth';
import { LinmasItem, UnitItem } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { showToast } from '@/components/ui/Toast';

export default function ProfilLinmasPage() {
  const router = useRouter();
  const { user, claims, loading: authLoading, logout } = useAuth();
  const [linmas, setLinmas] = useState<LinmasItem | null>(null);
  const [unit, setUnit] = useState<UnitItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user && claims?.nik) {
      loadProfile(claims.nik, claims.unitId);
    }
  }, [user, claims, authLoading]);

  const loadProfile = async (nik: string, unitId?: string) => {
    setLoading(true);
    try {
      const docSnap = await getDoc(doc(db, 'linmas', nik));
      if (docSnap.exists()) {
        const data = docSnap.data() as LinmasItem;
        setLinmas(data);

        // Fetch Unit info
        const targetUnitId = data.unitId || unitId;
        if (targetUnitId) {
          const unitSnap = await getDoc(doc(db, 'units', targetUnitId));
          if (unitSnap.exists()) {
            setUnit({ id: unitSnap.id, ...unitSnap.data() } as UnitItem);
          }
        }
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      showToast.error('Gagal memuat profil anggota');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      document.cookie = 'session=; path=/; max-age=0';
      showToast.info('Anda telah keluar dari akun');
      router.push('/login');
    } catch (err) {
      showToast.error('Gagal keluar');
    }
  };

  return (
    <div className="presensi-layout">
      {/* Header Bar */}
      <div className="presensi-header" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => router.push('/presensi')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              fontWeight: '600',
              fontSize: '11px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            ← Kembali
          </button>
          <div style={{ textAlign: 'left' }}>
            <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold', margin: 0, lineHeight: 1.2 }}>
              👤 Profil Anggota
            </h1>
            <p style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.85)', margin: 0, marginTop: '2px' }}>
              Identitas & Satuan Pengamanan Linmas
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <Spinner text="Memuat profil..." />
      ) : linmas ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Card Kartu Identitas */}
          <div
            style={{
              background: 'linear-gradient(135deg, #15803d 0%, #166534 100%)',
              color: 'white',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-5)',
              boxShadow: 'var(--shadow-md)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 'var(--space-4)',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    opacity: 0.85,
                  }}
                >
                  KARTU TANDA ANGGOTA SATLINMAS
                </span>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', marginTop: '2px' }}>
                  {linmas.nama}
                </h2>
                <p style={{ fontSize: 'var(--text-xs)', opacity: 0.9 }}>
                  {linmas.jabatan || 'Anggota'} • {linmas.regupId?.startsWith('Regu') ? linmas.regupId : `Regu ${linmas.regupId || '-'}`}
                </p>
              </div>
              <div
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  borderRadius: 'var(--radius-full)',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '600',
                }}
              >
                {linmas.aktif ? '✅ AKTIF' : '❌ NONAKTIF'}
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 'var(--space-3)' }}>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>NOMOR INDUK KEPENDUDUKAN (NIK)</div>
              <div style={{ fontSize: 'var(--text-base)', fontFamily: 'monospace', fontWeight: 'bold' }}>
                {linmas.nik}
              </div>
            </div>
          </div>

          {/* Card Detail Penugasan */}
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-4)',
              border: '1px solid var(--color-border)',
            }}
          >
            <h3
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 'bold',
                marginBottom: 'var(--space-3)',
                borderBottom: '1px solid var(--color-border)',
                paddingBottom: 'var(--space-2)',
              }}
            >
              🏢 Unit Posko & Penugasan
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--text-xs)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Posko Kelurahan:</span>
                <span style={{ fontWeight: '600' }}>{unit?.nama || linmas.unitId || '-'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Alamat Posko:</span>
                <span style={{ fontWeight: '500', textAlign: 'right', maxWidth: '60%' }}>
                  {unit?.alamat || '-'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Radius Geofence:</span>
                <span style={{ fontWeight: '600' }}>{unit?.radius || 100} meter</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Nomor HP:</span>
                <span style={{ fontWeight: '600' }}>{linmas.telepon || '-'}</span>
              </div>
            </div>
          </div>

          {/* Card Info Perangkat */}
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-4)',
              border: '1px solid var(--color-border)',
            }}
          >
            <h3
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 'bold',
                marginBottom: 'var(--space-3)',
                borderBottom: '1px solid var(--color-border)',
                paddingBottom: 'var(--space-2)',
              }}
            >
              📱 Keamanan Perangkat
            </h3>

            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
              Jumlah HP Terdaftar: <strong>{linmas.deviceIds?.length || 1} Perangkat</strong>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Sistem menggunakan identifikasi unik perangkat (FingerprintJS) untuk mencegah kecurangan titip presensi antar anggota.
            </div>
          </div>

          {/* Tombol Logout */}
          <button
            type="button"
            className="btn-presensi-logout"
            onClick={handleLogout}
          >
            🚪 Keluar dari Akun
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <p>Data profil tidak ditemukan</p>
        </div>
      )}
    </div>
  );
}
