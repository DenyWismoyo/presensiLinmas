'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/hooks/useAuth';
import { PresensiItem } from '@/types';
import { PresensiStatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { showToast } from '@/components/ui/Toast';

export default function RiwayatPresensiPage() {
  const router = useRouter();
  const { user, claims, loading: authLoading } = useAuth();
  const [presensiList, setPresensiList] = useState<PresensiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user && claims?.nik) {
      loadRiwayat(claims.nik);
    }
  }, [user, claims, authLoading]);

  const loadRiwayat = async (nik: string) => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'presensi'),
        where('nik', '==', nik),
        orderBy('tanggal', 'desc'),
        limit(30)
      );

      const snap = await getDocs(q);
      const items: PresensiItem[] = [];
      snap.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as PresensiItem);
      });
      setPresensiList(items);
    } catch (err: any) {
      console.error('Error fetching riwayat:', err);
      // Fallback query tanpa orderBy jika index belum aktif
      try {
        const fallbackQ = query(
          collection(db, 'presensi'),
          where('nik', '==', nik),
          limit(30)
        );
        const snap = await getDocs(fallbackQ);
        const items: PresensiItem[] = [];
        snap.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as PresensiItem);
        });
        items.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
        setPresensiList(items);
      } catch (fallbackErr: any) {
        showToast.error('Gagal memuat riwayat presensi');
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = presensiList.filter((item) => {
    if (filterStatus === 'all') return true;
    return item.status === filterStatus;
  });

  const totalHadir = presensiList.filter((i) => i.status === 'hadir').length;
  const totalTerlambat = presensiList.filter((i) => i.status === 'terlambat').length;
  const totalIzin = presensiList.filter((i) => i.status === 'izin' || i.status === 'sakit').length;

  return (
    <div className="presensi-layout">
      {/* Header Bar */}
      <div className="presensi-header" style={{ marginBottom: 'var(--space-3)' }}>
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
              📅 Riwayat Presensi
            </h1>
            <p style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.85)', margin: 0, marginTop: '2px' }}>
              Catatan kehadiran 30 hari terakhir
            </p>
          </div>
        </div>
      </div>

      {/* Mini Stats Card */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <div
          style={{
            background: 'var(--color-surface)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
            border: '1px solid var(--color-border)',
          }}
        >
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', color: 'var(--color-success)' }}>
            {totalHadir}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Hadir</div>
        </div>

        <div
          style={{
            background: 'var(--color-surface)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
            border: '1px solid var(--color-border)',
          }}
        >
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', color: 'var(--color-warning)' }}>
            {totalTerlambat}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Terlambat</div>
        </div>

        <div
          style={{
            background: 'var(--color-surface)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
            border: '1px solid var(--color-border)',
          }}
        >
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', color: 'var(--color-primary)' }}>
            {totalIzin}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Izin/Sakit</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-1)',
          marginBottom: 'var(--space-4)',
          background: 'var(--color-surface)',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
        }}
      >
        {[
          { id: 'all', label: 'Semua' },
          { id: 'hadir', label: 'Hadir' },
          { id: 'terlambat', label: 'Terlambat' },
          { id: 'izin', label: 'Izin/Sakit' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterStatus(tab.id)}
            style={{
              flex: 1,
              padding: '6px 4px',
              fontSize: 'var(--text-xs)',
              fontWeight: filterStatus === tab.id ? '600' : '500',
              border: 'none',
              background: filterStatus === tab.id ? 'var(--color-primary)' : 'transparent',
              color: filterStatus === tab.id ? 'white' : 'var(--color-text-muted)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List Items */}
      {loading ? (
        <Spinner text="Memuat riwayat kehadiran..." />
      ) : filteredItems.length === 0 ? (
        <div
          style={{
            background: 'var(--color-surface)',
            padding: 'var(--space-8)',
            textAlign: 'center',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
          }}
        >
          <p style={{ fontSize: '32px', marginBottom: 'var(--space-2)' }}>📋</p>
          <p style={{ fontWeight: '600', color: 'var(--color-text)' }}>Belum Ada Catatan</p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Data presensi untuk filter ini tidak ditemukan.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {filteredItems.map((item) => (
            <div
              key={item.id}
              style={{
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-4)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 'var(--space-2)',
                }}
              >
                <div style={{ fontWeight: '600', fontSize: 'var(--text-sm)' }}>
                  🗓️ {item.tanggal}
                </div>
                <PresensiStatusBadge status={item.status} />
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 'var(--space-2)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-muted)',
                  marginBottom: 'var(--space-3)',
                }}
              >
                <div>
                  <span style={{ display: 'block', color: 'var(--color-text)' }}>
                    🕒 Masuk: <strong>{item.jamMasuk || '-'}</strong>
                  </span>
                  {item.lokasiMasuk?.jarakMeter !== undefined && (
                    <span style={{ fontSize: '11px' }}>
                      📍 Radius: {item.lokasiMasuk.jarakMeter}m
                    </span>
                  )}
                </div>

                <div>
                  <span style={{ display: 'block', color: 'var(--color-text)' }}>
                    🚪 Keluar: <strong>{item.jamKeluar || '-'}</strong>
                  </span>
                  {item.lokasiKeluar?.jarakMeter !== undefined && (
                    <span style={{ fontSize: '11px' }}>
                      📍 Radius: {item.lokasiKeluar.jarakMeter}m
                    </span>
                  )}
                </div>
              </div>

              {/* Foto Geotag Bukti */}
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                {item.fotoMasukUrl && (
                  <button
                    type="button"
                    onClick={() => setSelectedPhoto(item.fotoMasukUrl!)}
                    style={{
                      border: '1px solid var(--color-border)',
                      background: 'none',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 6px',
                      fontSize: '11px',
                    }}
                  >
                    <img
                      src={item.fotoMasukUrl}
                      alt="Foto Masuk"
                      style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '2px' }}
                    />
                    <span>Foto Masuk</span>
                  </button>
                )}

                {item.fotoKeluarUrl && (
                  <button
                    type="button"
                    onClick={() => setSelectedPhoto(item.fotoKeluarUrl!)}
                    style={{
                      border: '1px solid var(--color-border)',
                      background: 'none',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 6px',
                      fontSize: '11px',
                    }}
                  >
                    <img
                      src={item.fotoKeluarUrl}
                      alt="Foto Keluar"
                      style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '2px' }}
                    />
                    <span>Foto Keluar</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Foto Besar */}
      <Modal
        isOpen={Boolean(selectedPhoto)}
        onClose={() => setSelectedPhoto(null)}
        title="Bukti Foto Presensi Geotag"
      >
        {selectedPhoto && (
          <img
            src={selectedPhoto}
            alt="Bukti Presensi Geotag"
            className="photo-large"
          />
        )}
      </Modal>
    </div>
  );
}
