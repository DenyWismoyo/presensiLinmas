'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';
import { db } from '@/lib/firebase/config';
import { doc, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';

interface SettingsTabProps {
  systemSettings: any;
  unitId?: string;
  onRefreshSettings?: () => void;
}

export function SettingsTab({
  systemSettings,
  unitId,
  onRefreshSettings,
}: SettingsTabProps) {
  // State Konfigurasi
  const [toleransi, setToleransi] = useState<number>(
    systemSettings?.toleransiKeterlambatan ?? 15
  );
  const [radius, setRadius] = useState<number>(
    systemSettings?.radiusGeofenceDefault ?? 100
  );
  const [honorPerShift, setHonorPerShift] = useState<number>(
    systemSettings?.honorHadirPerShift ?? 75000
  );
  const [potonganTerlambat, setPotonganTerlambat] = useState<number>(
    systemSettings?.potonganTerlambat ?? 10000
  );
  const [savingSettings, setSavingSettings] = useState(false);

  // State Broadcast Pengumuman
  const [broadcastJudul, setBroadcastJudul] = useState('');
  const [broadcastPesan, setBroadcastPesan] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  // Simpan Pengaturan
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await setDoc(
        doc(db, 'settings', 'general'),
        {
          toleransiKeterlambatan: Number(toleransi),
          radiusGeofenceDefault: Number(radius),
          honorHadirPerShift: Number(honorPerShift),
          potonganTerlambat: Number(potonganTerlambat),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      showToast.success('Konfigurasi sistem berhasil disimpan ke Firestore');
      if (onRefreshSettings) onRefreshSettings();
    } catch (err: any) {
      showToast.error(err.message || 'Gagal menyimpan pengaturan');
    } finally {
      setSavingSettings(false);
    }
  };

  // Broadcast Pengumuman Posko
  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastPesan.trim()) {
      showToast.warning('Silakan masukkan isi instruksi pengumuman');
      return;
    }

    setBroadcasting(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        unitId: unitId || 'tipes',
        judul: broadcastJudul.trim() || 'Instruksi Posko',
        pesan: broadcastPesan.trim(),
        aktif: true,
        createdAt: serverTimestamp(),
      });

      showToast.success('Pengumuman posko berhasil disiarkan ke seluruh HP anggota!');
      setBroadcastJudul('');
      setBroadcastPesan('');
    } catch (err: any) {
      showToast.error(err.message || 'Gagal memancarkan pengumuman');
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: 'var(--space-6)',
      }}
    >
      {/* FORM PENGATURAN UMUM */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">⚙️ Konfigurasi Operasional Presensi</h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Pengaturan toleransi jam masuk, geofencing, dan tarif honor
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label className="form-label">Toleransi Keterlambatan Masuk (Menit):</label>
            <input
              type="number"
              className="form-input"
              value={toleransi}
              onChange={(e) => setToleransi(Number(e.target.value))}
              min={0}
              max={120}
              required
            />
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Presensi melewati jam shift + nilai ini akan ditandai terlambat secara otomatis oleh server.
            </span>
          </div>

          <div>
            <label className="form-label">Radius Geofencing Posko Default (Meter):</label>
            <input
              type="number"
              className="form-input"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              min={20}
              max={1000}
              required
            />
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Jarak maksimum anggota Linmas dari koordinat posko untuk diperbolehkan presensi.
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label className="form-label">Honor Per Shift (Rp):</label>
              <input
                type="number"
                className="form-input"
                value={honorPerShift}
                onChange={(e) => setHonorPerShift(Number(e.target.value))}
                min={0}
                step={5000}
                required
              />
            </div>

            <div>
              <label className="form-label">Potongan Terlambat (Rp):</label>
              <input
                type="number"
                className="form-input"
                value={potonganTerlambat}
                onChange={(e) => setPotonganTerlambat(Number(e.target.value))}
                min={0}
                step={1000}
                required
              />
            </div>
          </div>

          <Button variant="primary" type="submit" loading={savingSettings} style={{ marginTop: 'var(--space-2)' }}>
            Simpan Konfigurasi Sistem
          </Button>
        </form>
      </div>

      {/* BROADCAST PENGUMUMAN POSKO */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">📢 Broadcast Instruksi Posko Linmas</h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Pesan instruksi komandan yang langsung muncul di layar presensi HP seluruh anggota
            </p>
          </div>
        </div>

        <form onSubmit={handleBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label className="form-label">Judul Instruksi / Pengumuman:</label>
            <input
              type="text"
              className="form-input"
              value={broadcastJudul}
              onChange={(e) => setBroadcastJudul(e.target.value)}
              placeholder="Contoh: Kesiapsiagaan Patroli Malam Hari"
            />
          </div>

          <div>
            <label className="form-label">Isi Instruksi Posko:</label>
            <textarea
              className="form-textarea"
              rows={4}
              value={broadcastPesan}
              onChange={(e) => setBroadcastPesan(e.target.value)}
              placeholder="Contoh: Seluruh regu piket malam wajib patroli pos ronda setiap 2 jam sekali. Waspadai titik rawan..."
              required
            />
          </div>

          <Button variant="success" type="submit" loading={broadcasting} style={{ marginTop: 'var(--space-2)' }}>
            📢 Siarkan Instruksi Sekarang
          </Button>
        </form>
      </div>
    </div>
  );
}
