'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/config';
import { getIdToken } from 'firebase/auth';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { useAuth } from '@/lib/hooks/useAuth';
import { useGeolocation } from '@/lib/hooks/useGeolocation';
import { getDeviceId } from '@/lib/utils/deviceId';
import { compressImage, CompressionResult } from '@/lib/utils/imageCompressor';
import { presensiService } from '@/lib/services/presensiService';
import {
  playSuccessChime,
  playEmergencyAlarm,
  triggerHaptic,
  speakNotification,
} from '@/lib/utils/feedback';
import { showToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface UnitInfo {
  nama: string;
  latitude: number;
  longitude: number;
  radius: number;
}

interface ActivePresensiDoc {
  id: string;
  nik: string;
  shiftId: string;
  tanggal: string;
  status: 'hadir' | 'terlambat' | 'izin' | 'sakit';
  waktuMasuk?: Timestamp;
  waktuKeluar?: Timestamp;
  fotoMasuk?: string;
  fotoKeluar?: string;
  activityLog?: string;
  activityPhotoUrl?: string;
  activityTime?: Timestamp;
  distanceFromSite?: number;
  isLate?: boolean;
  lateMinutes?: number;
  keterangan?: string;
  suratFotoUrl?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
}

export default function PresensiPage() {
  const { user, claims, unitId, loading: authLoading, logout } = useAuth();
  const [time, setTime] = useState<Date | null>(null);
  const [todayStr, setTodayStr] = useState<string>('');
  const [unit, setUnit] = useState<UnitInfo | null>(null);
  const [activeDoc, setActiveDoc] = useState<ActivePresensiDoc | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal Kamera Selfie / Foto
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraPurpose, setCameraPurpose] = useState<'masuk' | 'keluar' | 'giat' | 'izin'>('masuk');
  const [capturedPhoto, setCapturedPhoto] = useState<CompressionResult | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Modal Input Laporan Giat Patroli
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityText, setActivityText] = useState('');
  const [activityPhotoResult, setActivityPhotoResult] = useState<CompressionResult | null>(null);

  // Modal Pengajuan Izin / Sakit
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveType, setLeaveType] = useState<'izin' | 'sakit'>('izin');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveAttachment, setLeaveAttachment] = useState<CompressionResult | null>(null);

  // Modal SOS Panic Button Lapangan
  const [showSosModal, setShowSosModal] = useState(false);
  const [sosType, setSosType] = useState<string>('kriminal');
  const [sosNotes, setSosNotes] = useState<string>('');
  const [sosSubmitting, setSosSubmitting] = useState(false);
  const [announcement, setAnnouncement] = useState<string>(
    'Tetap siaga patroli keliling pos ronda tiap 2 jam. Catat tamu 1x24 jam dan laporkan jika ada hal mencurigakan.'
  );
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const router = useRouter();

  // Clock & Safe Today String
  useEffect(() => {
    setTime(new Date());
    const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
    setTodayStr(wib.toISOString().split('T')[0]);

    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auth Protection redirect
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  // Load Announcements Realtime dari Posko
  useEffect(() => {
    if (!unitId) return;
    try {
      const q = query(
        collection(db, 'announcements'),
        where('unitId', 'in', [unitId, 'all']),
        where('aktif', '==', true)
      );
      const unsub = onSnapshot(
        q,
        (snap) => {
          if (!snap.empty) {
            const docs = snap.docs.map((d) => d.data());
            docs.sort(
              (a: any, b: any) =>
                (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
            );
            if (docs[0]?.pesan || docs[0]?.text) {
              setAnnouncement(docs[0].pesan || docs[0].text);
            }
          }
        },
        (err) => {
          console.warn('Gagal memuat pengumuman Firestore:', err);
        }
      );
      return () => unsub();
    } catch (e) {
      console.warn('Query announcement fallback:', e);
    }
  }, [unitId]);

  // Load Unit Data
  useEffect(() => {
    if (!unitId) return;

    const fetchUnit = async () => {
      try {
        const snap = await getDoc(doc(db, 'units', unitId));
        if (snap.exists()) {
          const d = snap.data();
          setUnit({
            nama: d.nama || 'Posko Linmas',
            latitude: d.location?.latitude || -6.175392,
            longitude: d.location?.longitude || 106.827153,
            radius: d.radius || 100,
          });
        }
      } catch (err) {
        console.error('Gagal memuat koordinat unit:', err);
      }
    };

    fetchUnit();
  }, [unitId]);

  // Listen Dokumen Presensi Hari Ini Milik Linmas Tersebut
  useEffect(() => {
    const nik = claims?.nik;
    if (!nik || !todayStr) return;

    const q = query(
      collection(db, 'presensi'),
      where('nik', '==', nik),
      where('tanggal', '==', todayStr)
    );

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        // Ambil dokumen terbaru hari ini
        const d = snap.docs[0];
        setActiveDoc({ id: d.id, ...(d.data() as any) });
      } else {
        setActiveDoc(null);
      }
    });

    return () => unsub();
  }, [claims?.nik, todayStr]);

  // Geolocation with target calculation
  const targetLocation = unit
    ? { latitude: unit.latitude, longitude: unit.longitude, radius: unit.radius }
    : null;

  const { coords, loading: locLoading, error: locError, distance, isWithin, accuracyWarning } =
    useGeolocation(targetLocation);

  // Tutup Media Stream Kamera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Buka Media Stream Kamera Depan/Belakang
  const startCamera = useCallback(async (facing: 'user' | 'environment' = 'user') => {
    setCameraError('');
    setCapturedPhoto(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser tidak mendukung akses kamera langsung. Gunakan pilihan tombol ambil foto di bawah.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err: any) {
      console.warn('Gagal stream kamera:', err);
      setCameraError('Kamera tidak dapat diakses langsung. Silakan gunakan tombol Buka Kamera HP di bawah.');
      setCameraActive(false);
    }
  }, []);

  // Buka Modal Kamera Presensi (Masuk/Keluar)
  const openPresensiCamera = (purpose: 'masuk' | 'keluar') => {
    if (!coords) {
      setFeedback({ type: 'error', message: 'Menunggu koordinat GPS Anda...' });
      return;
    }

    if (unit && !isWithin) {
      setFeedback({
        type: 'error',
        message: `Anda berada di luar jangkauan posko (${distance}m dari posko, radius batas ${unit.radius}m).`,
      });
      return;
    }

    setCameraPurpose(purpose);
    setShowCameraModal(true);
    setCapturedPhoto(null);
    setFeedback(null);
    startCamera('user');
  };

  // Tangkap Foto Video Langsung
  const captureFromVideo = async () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCamera();

    canvas.toBlob(async (blob) => {
      if (blob) {
        const compressed = await compressImage(blob, 800, 800, 0.72);
        setCapturedPhoto(compressed);
      }
    }, 'image/jpeg', 0.9);
  };

  // File Input Fallback
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    stopCamera();
    try {
      const compressed = await compressImage(file, 800, 800, 0.72);
      setCapturedPhoto(compressed);
    } catch (err: any) {
      setCameraError('Gagal memproses gambar: ' + err.message);
    }
  };

  // Konfirmasi Presensi Masuk / Keluar
  const handleConfirmPresensi = async () => {
    if (!coords) return alert('GPS belum tersedia.');

    setSubmitting(true);
    try {
      const nik = claims?.nik || 'linmas';
      let fotoUrl: string | null = null;

      if (capturedPhoto) {
        const path = `presensi/${nik}/${todayStr}_${cameraPurpose}_${Date.now()}.jpg`;
        fotoUrl = await presensiService.uploadPhoto(capturedPhoto.blob, path);
      }

      const deviceId = await getDeviceId();
      const token = await getIdToken(user!);

      const result = await presensiService.submitPresensi(
        token,
        cameraPurpose === 'masuk' ? 'masuk' : 'keluar',
        { lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy },
        deviceId,
        fotoUrl
      );

      setShowCameraModal(false);
      setCapturedPhoto(null);
      setFeedback({ type: 'success', message: result.message });
      playSuccessChime();
      triggerHaptic([100, 50, 100]);
      speakNotification(result.message || 'Presensi berhasil dicatat');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Gagal mengirim presensi.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Laporan Giat Patroli
  const handleConfirmActivity = async () => {
    if (!activeDoc) return;
    if (!activityText.trim()) return alert('Mohon isi catatan kegiatan/patroli.');

    setSubmitting(true);
    try {
      let activityPhotoUrl: string | null = null;
      if (activityPhotoResult) {
        const nik = claims?.nik || 'linmas';
        const path = `presensi/${nik}/${todayStr}_giat_${Date.now()}.jpg`;
        activityPhotoUrl = await presensiService.uploadPhoto(activityPhotoResult.blob, path);
      }

      const token = await getIdToken(user!);
      await presensiService.submitActivity(token, activeDoc.id, activityText.trim(), activityPhotoUrl);

      setShowActivityModal(false);
      setActivityText('');
      setActivityPhotoResult(null);
      setFeedback({ type: 'success', message: 'Laporan aktivitas patroli berhasil disimpan.' });
      playSuccessChime();
      triggerHaptic([80]);
      speakNotification('Laporan kegiatan berhasil disimpan');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Gagal menyimpan laporan giat.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Izin / Sakit
  const handleConfirmLeave = async () => {
    if (!leaveReason.trim()) return alert('Mohon tuliskan alasan/keterangan izin.');

    setSubmitting(true);
    try {
      let attachmentUrl: string | null = null;
      if (leaveAttachment) {
        const nik = claims?.nik || 'linmas';
        const path = `leaves/${nik}/${todayStr}_${Date.now()}.jpg`;
        attachmentUrl = await presensiService.uploadPhoto(leaveAttachment.blob, path);
      }

      const token = await getIdToken(user!);
      const res = await presensiService.submitLeave(
        token,
        leaveType,
        leaveReason.trim(),
        todayStr,
        attachmentUrl
      );

      setShowLeaveModal(false);
      setLeaveReason('');
      setLeaveAttachment(null);
      setFeedback({ type: 'success', message: res.message });
      playSuccessChime();
      triggerHaptic([80]);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Gagal mengajukan izin.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Kirim Sinyal Darurat Lapangan (SOS)
  const handleConfirmSos = async () => {
    if (!coords) {
      alert('Sedang membaca sinyal GPS untuk akurasi lokasi darurat...');
      return;
    }

    setSosSubmitting(true);
    try {
      playEmergencyAlarm();
      triggerHaptic([300, 100, 300, 100, 500]);

      const alertRef = doc(collection(db, 'alerts'));
      await setDoc(alertRef, {
        unitId: unitId || 'unknown',
        nik: claims?.nik || 'unknown',
        nama: user?.displayName || claims?.nama || 'Anggota Linmas',
        type: 'SOS_EMERGENCY',
        incidentType: sosType,
        message: `🚨 SINYAL DARURAT [${sosType.toUpperCase()}]: ${
          sosNotes ? sosNotes.trim() : 'Butuh bantuan penanganan darurat segera di lokasi!'
        }`,
        location: {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        },
        read: false,
        status: 'active',
        createdAt: serverTimestamp(),
      });

      setShowSosModal(false);
      setSosNotes('');
      setFeedback({
        type: 'success',
        message: '🚨 Sinyal Darurat SOS Berhasil Dipancarkan ke Posko & Komandan Regu!',
      });
      showToast.success('🚨 Sinyal Darurat SOS Berhasil Dipancarkan ke Posko!');
      speakNotification('Sinyal darurat berhasil dipancarkan ke posko');
    } catch (err: any) {
      showToast.error('Gagal mengirim sinyal SOS: ' + err.message);
    } finally {
      setSosSubmitting(false);
    }
  };

  const handleLogout = async () => {
    stopCamera();
    await logout();
    document.cookie = 'session=; path=/; max-age=0';
    showToast.info('Anda telah keluar dari akun');
    router.push('/login');
  };

  if (authLoading || !user || !time) {
    return (
      <div className="presensi-layout">
        <div
          className="presensi-body presensi-center"
          style={{
            minHeight: '60vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Spinner size="lg" text="Memuat aplikasi presensi Linmas..." />
        </div>
      </div>
    );
  }

  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };

  // Status visual Geofencing
  let statusText = '📍 Membaca koordinat GPS...';
  let statusClass = 'loading';

  if (!locLoading) {
    if (locError) {
      statusText = `❌ ${locError}`;
      statusClass = 'luar-jangkauan';
    } else if (unit) {
      if (isWithin) {
        statusText = `✅ Dalam Jangkauan (${distance}m dari ${unit.nama})`;
        statusClass = 'dalam-jangkauan';
      } else {
        statusText = `❌ Luar Jangkauan Posko (${distance}m, radius batas ${unit.radius}m)`;
        statusClass = 'luar-jangkauan';
      }
    } else if (coords) {
      statusText = `📍 GPS Aktif (Akurasi: ${Math.round(coords.accuracy)}m)`;
      statusClass = 'dalam-jangkauan';
    }
  }

  // STATE MACHINE DERIVATION (SENAPATI PATTERN)
  // 1. LEAVE: jika sudah ada pengajuan izin/sakit
  // 2. DONE: jika sudah check-in dan check-out
  // 3. ACTIVE: jika sudah check-in dan belum check-out
  // 4. CHECKIN: belum ada catatan presensi hari ini
  const isLeave = activeDoc?.status === 'izin' || activeDoc?.status === 'sakit';
  const isDone = Boolean(activeDoc?.waktuMasuk && activeDoc?.waktuKeluar);
  const isActiveDuty = Boolean(activeDoc?.waktuMasuk && !activeDoc?.waktuKeluar && !isLeave);
  const isButtonDisabled = locLoading || !coords || (unit !== null && !isWithin) || submitting;

  return (
    <div className="presensi-layout">
      <header className="presensi-header">
        <div className="presensi-header-inner">
          <div className="presensi-user-info">
            <h1 className="presensi-greeting">
              Hai, {user.displayName || 'Anggota Linmas'}
            </h1>
            <div className="presensi-regu-sub">
              <span className="regu-chip">
                {claims?.regupId
                  ? claims.regupId.startsWith('Regu')
                    ? claims.regupId
                    : `Regu ${claims.regupId}`
                  : 'Regu Piket'}
              </span>
              <span className="nik-chip">NIK: {claims?.nik || '-'}</span>
            </div>
          </div>
          <div className="presensi-header-nav">
            <button
              type="button"
              className="header-pill-btn"
              onClick={() => router.push('/presensi/riwayat')}
              title="Riwayat Presensi"
            >
              📅 Riwayat
            </button>
            <button
              type="button"
              className="header-pill-btn"
              onClick={() => router.push('/presensi/profil')}
              title="Profil Saya"
            >
              👤 Profil
            </button>
          </div>
        </div>
      </header>

      <main className="presensi-body">
        {/* PENGUMUMAN POSKO / INSTRUKSI KOMANDAN */}
        {announcement && (
          <div className="announcement-banner">
            <div className="announcement-header">
              <span className="announcement-title">📢 Instruksi Posko</span>
              <span className="announcement-badge">Penting</span>
            </div>
            <p className="announcement-text">{announcement}</p>
          </div>
        )}

        {/* HERO SECTION JAM & GEOFENCING (BORDERLESS TANPA CARD) */}
        <section className="presensi-hero-section">
          {/* Radar Geofencing Visualizer */}
          <div className="geofence-radar">
            <div className={`radar-wave ${isWithin ? 'in-range' : 'out-range'}`}></div>
            <div className={`radar-center ${isWithin ? 'in-range' : 'out-range'}`}>
              {isWithin ? '✓' : '!'}
            </div>
          </div>

          <div className="date-display">{time.toLocaleDateString('id-ID', dateOptions)}</div>
          <div className="clock-display">
            {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>

          <div className={`location-status ${statusClass}`}>{statusText}</div>

          {/* GPS Signal Strength */}
          {coords && (
            <div className="gps-indicator-row">
              <span className="gps-label">Sinyal GPS:</span>
              <div
                className={`gps-signal-meter ${
                  coords.accuracy <= 20 ? 'strong' : coords.accuracy <= 50 ? 'medium' : 'weak'
                }`}
              >
                <div className="gps-bar"></div>
                <div className="gps-bar"></div>
                <div className="gps-bar"></div>
                <div className="gps-bar"></div>
              </div>
              <span className="gps-value">
                ±{Math.round(coords.accuracy)}m
              </span>
            </div>
          )}

          {accuracyWarning && (
            <p className="gps-warning">⚠️ Akurasi GPS rendah (&gt;50m). Disarankan berpindah ke area terbuka.</p>
          )}

          {unit && distance !== null && (
            <p className="distance-info">
              Posko: {unit.nama} • Jarak: {distance}m (Batas: {unit.radius}m)
            </p>
          )}
        </section>

        {feedback && (
          <div className={`presensi-feedback ${feedback.type === 'success' ? 'badge-success' : 'badge-danger'}`}>
            {feedback.message}
          </div>
        )}

        {/* --- KONDISI 1: STATUS IZIN / SAKIT (BORDERLESS) --- */}
        {isLeave && (
          <section className="duty-status-section">
            <div className="duty-header-row">
              <span className="section-title">Permohonan {activeDoc?.status?.toUpperCase()}</span>
              <span
                className={`badge ${
                  activeDoc?.approvalStatus === 'approved'
                    ? 'badge-success'
                    : activeDoc?.approvalStatus === 'rejected'
                    ? 'badge-danger'
                    : 'badge-warning'
                }`}
              >
                {activeDoc?.approvalStatus === 'approved'
                  ? 'Disetujui Admin'
                  : activeDoc?.approvalStatus === 'rejected'
                  ? 'Ditolak Admin'
                  : 'Menunggu Persetujuan'}
              </span>
            </div>
            <p className="duty-label">Alasan:</p>
            <p className="duty-value">{activeDoc?.keterangan || '-'}</p>
            {activeDoc?.rejectionReason && (
              <p className="form-error">Catatan Penolakan: {activeDoc.rejectionReason}</p>
            )}
            {activeDoc?.suratFotoUrl && (
              <div className="action-cell">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={activeDoc.suratFotoUrl} alt="Surat Lampiran" className="photo-thumb" />
                <span className="nik-subtext">Lampiran Surat Terlampir</span>
              </div>
            )}
          </section>
        )}

        {/* --- KONDISI 2: SEDANG BERTUGAS PIKET (BORDERLESS) --- */}
        {isActiveDuty && (
          <section className="duty-status-section">
            <div className="duty-header-row">
              <div>
                <span className="badge badge-success">● SEDANG BERTUGAS PIKET</span>
                <h3 className="section-title" style={{ marginTop: '4px' }}>
                  {activeDoc?.shiftId}
                </h3>
              </div>
              <span
                className={`badge ${activeDoc?.status === 'terlambat' ? 'badge-warning' : 'badge-success'}`}
              >
                {activeDoc?.status === 'terlambat'
                  ? `Terlambat ${activeDoc.lateMinutes || 0}m`
                  : 'Tepat Waktu'}
              </span>
            </div>

            <div className="duty-info-grid">
              <div className="duty-info-item">
                <span className="duty-label">Jam Masuk</span>
                <span className="duty-value">
                  {activeDoc?.waktuMasuk?.toDate().toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="duty-info-item">
                <span className="duty-label">Jarak Posko</span>
                <span className="duty-value">{activeDoc?.distanceFromSite ?? '-'} m</span>
              </div>
            </div>

            {/* Riwayat Laporan Giat Jika Sudah Ada */}
            {activeDoc?.activityLog ? (
              <div className="activity-summary-box">
                {activeDoc.activityPhotoUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={activeDoc.activityPhotoUrl} alt="Giat Patroli" className="photo-thumb" />
                )}
                <div className="activity-summary-text">
                  <strong>Laporan Giat Tercatat:</strong> {activeDoc.activityLog}
                </div>
              </div>
            ) : null}

            {/* Tombol Lapor Giat Patroli */}
            <button
              className="btn-presensi-giat"
              onClick={() => {
                setActivityText(activeDoc?.activityLog || '');
                setActivityPhotoResult(null);
                setShowActivityModal(true);
              }}
            >
              📸 {activeDoc?.activityLog ? 'UPDATE LAPORAN GIAT PATROLI' : 'LAPOR GIAT / PATROLI POSKO'}
            </button>

            {/* Tombol Selesai Dinas Check-Out */}
            <button
              className="btn-presensi-keluar"
              onClick={() => openPresensiCamera('keluar')}
              disabled={isButtonDisabled}
            >
              🏁 SELESAI DINAS / CHECK-OUT
            </button>
          </section>
        )}

        {/* --- KONDISI 3: SELESAI DINAS HARI INI (BORDERLESS) --- */}
        {isDone && (
          <section className="duty-status-section">
            <div className="duty-header-row">
              <span className="badge badge-success">✓ DINAS PIKET SELESAI</span>
              <span className="nik-subtext">{activeDoc?.shiftId}</span>
            </div>

            <div className="duty-info-grid">
              <div className="duty-info-item">
                <span className="duty-label">Jam Masuk</span>
                <span className="duty-value">
                  {activeDoc?.waktuMasuk?.toDate().toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="duty-info-item">
                <span className="duty-label">Jam Pulang</span>
                <span className="duty-value">
                  {activeDoc?.waktuKeluar?.toDate().toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>

            {/* 3-Point Validation Photos */}
            <div>
              <span className="duty-label">Bukti Visual Dokumentasi Piket (3-Point):</span>
              <div className="three-point-photos">
                <div className="photo-item">
                  {activeDoc?.fotoMasuk ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={activeDoc.fotoMasuk} alt="Check-In" />
                  ) : (
                    <span>-</span>
                  )}
                  <span>1. Check-In</span>
                </div>
                <div className="photo-item">
                  {activeDoc?.activityPhotoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={activeDoc.activityPhotoUrl} alt="Giat Patroli" />
                  ) : (
                    <span>-</span>
                  )}
                  <span>2. Giat Patroli</span>
                </div>
                <div className="photo-item">
                  {activeDoc?.fotoKeluar ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={activeDoc.fotoKeluar} alt="Check-Out" />
                  ) : (
                    <span>-</span>
                  )}
                  <span>3. Check-Out</span>
                </div>
              </div>
            </div>

            {activeDoc?.activityLog && (
              <p className="compression-desc">
                <strong>Catatan Giat:</strong> {activeDoc.activityLog}
              </p>
            )}
          </section>
        )}

        {/* --- KONDISI 4: BELUM PRESENSI MASUK (BORDERLESS ACTIONS) --- */}
        {!activeDoc && (
          <div className="presensi-actions-stack">
            <button
              className="btn-presensi-masuk"
              onClick={() => openPresensiCamera('masuk')}
              disabled={isButtonDisabled}
            >
              📷 MULAI DINAS / CHECK-IN
            </button>

            <button
              className="btn-presensi-leave"
              onClick={() => {
                setLeaveType('izin');
                setLeaveReason('');
                setLeaveAttachment(null);
                setShowLeaveModal(true);
              }}
            >
              📝 AJUKAN IZIN / SAKIT
            </button>
          </div>
        )}

        {/* TOMBOL SOS DARURAT LAPANGAN */}
        <div className="sos-container">
          <button
            type="button"
            className="btn-sos-trigger"
            onClick={() => setShowSosModal(true)}
          >
            🚨 LAPOR DARURAT (SOS POSKO)
          </button>
        </div>

        <button
          type="button"
          className="btn-presensi-logout"
          onClick={() => setShowLogoutModal(true)}
        >
          Keluar dari Akun
        </button>
      </main>

      {/* MODAL 1: KAMERA SELFIE CHECK-IN / CHECK-OUT */}
      {showCameraModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h2 className="modal-title">
                Ambil Foto Selfie ({cameraPurpose === 'masuk' ? 'Presensi Masuk' : 'Presensi Selesai Dinas'})
              </h2>
              {!submitting && (
                <button
                  className="modal-close-btn"
                  onClick={() => {
                    stopCamera();
                    setShowCameraModal(false);
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            <div className="modal-body">
              <div className="camera-box">
                {capturedPhoto ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={capturedPhoto.dataUrl} alt="Hasil Foto" className="camera-preview-img" />
                ) : cameraActive ? (
                  <>
                    <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
                    <button className="camera-capture-btn" onClick={captureFromVideo} title="Ambil Foto" />
                  </>
                ) : (
                  <div className="presensi-center">
                    <p className="text-muted">Kamera Belum Aktif</p>
                  </div>
                )}
              </div>

              {capturedPhoto && (
                <div className="compression-info-card">
                  <p className="compression-success-title">✓ Foto Berhasil Dikompresi Otomatis</p>
                  <p className="compression-desc">
                    Ukuran: {(capturedPhoto.compressedSize / 1024).toFixed(1)} KB (Hemat kuota)
                  </p>
                </div>
              )}

              {cameraError && <p className="form-warning">{cameraError}</p>}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden-input"
                onChange={handleFileInputChange}
              />
            </div>

            <div className="modal-footer">
              {!capturedPhoto ? (
                <>
                  <button
                    className="btn btn-secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={submitting}
                  >
                    📁 Buka Kamera HP
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      stopCamera();
                      setShowCameraModal(false);
                    }}
                    disabled={submitting}
                  >
                    Batal
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="btn btn-secondary"
                    onClick={() => startCamera('user')}
                    disabled={submitting}
                  >
                    🔄 Ambil Ulang
                  </button>
                  <button className="btn btn-primary" onClick={handleConfirmPresensi} disabled={submitting}>
                    {submitting ? 'Mengirim...' : 'Kirim Presensi Sekarang'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: LAPORAN GIAT / PATROLI POSKO (SENAPATI 3-POINT PATTERN) */}
      {showActivityModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h2 className="modal-title">Laporan Giat & Patroli Lapangan</h2>
              <button className="modal-close-btn" onClick={() => setShowActivityModal(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div>
                <label className="form-label">Catatan Situasi / Kegiatan Piket</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Contoh: Patroli keliling pos kamling RT 01-05 bersama warga, situasi kondusif."
                  value={activityText}
                  onChange={(e) => setActivityText(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label">Foto Dokumentasi Kegiatan (Opsional)</label>
                {activityPhotoResult ? (
                  <div className="action-cell">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={activityPhotoResult.dataUrl} alt="Preview Giat" className="photo-thumb" />
                    <span className="nik-subtext">
                      Foto Terpilih ({(activityPhotoResult.compressedSize / 1024).toFixed(1)} KB)
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => setActivityPhotoResult(null)}
                    >
                      Hapus
                    </button>
                  </div>
                ) : (
                  <label className="btn btn-secondary" style={{ width: '100%', cursor: 'pointer' }}>
                    📷 Ambil Foto Dokumentasi Patroli
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden-input"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const comp = await compressImage(file, 800, 800, 0.72);
                          setActivityPhotoResult(comp);
                        }
                      }}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowActivityModal(false)}
                disabled={submitting}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmActivity}
                disabled={submitting}
              >
                {submitting ? 'Menyimpan...' : 'Kirim Laporan Giat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: PENGAJUAN IZIN / SAKIT (LEAVE MANAGEMENT) */}
      {showLeaveModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h2 className="modal-title">Pengajuan Izin / Sakit</h2>
              <button className="modal-close-btn" onClick={() => setShowLeaveModal(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div>
                <label className="form-label">Jenis Permohonan</label>
                <select
                  className="form-select"
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as 'izin' | 'sakit')}
                >
                  <option value="izin">Izin (Keperluan Mendesak/Keluarga)</option>
                  <option value="sakit">Sakit (Kondisi Kesehatan)</option>
                </select>
              </div>

              <div>
                <label className="form-label">Keterangan / Alasan</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Jelaskan alasan permohonan izin Anda..."
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label">Lampiran Bukti (Surat Dokter / Surat Tugas)</label>
                {leaveAttachment ? (
                  <div className="action-cell">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={leaveAttachment.dataUrl} alt="Lampiran" className="photo-thumb" />
                    <span className="nik-subtext">Lampiran siap dikirim</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => setLeaveAttachment(null)}
                    >
                      Ganti
                    </button>
                  </div>
                ) : (
                  <label className="btn btn-secondary btn-upload-file">
                    📎 Unggah Foto Bukti Surat
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden-input"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const comp = await compressImage(file, 800, 800, 0.72);
                          setLeaveAttachment(comp);
                        }
                      }}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowLeaveModal(false)}
                disabled={submitting}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmLeave}
                disabled={submitting}
              >
                {submitting ? 'Mengirim...' : 'Ajukan Permohonan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: LAPORAN DARURAT SOS LAPANGAN */}
      {showSosModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h2 className="modal-title">🚨 Peringatan Darurat Lapangan (SOS)</h2>
              <button className="modal-close-btn" onClick={() => setShowSosModal(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p className="sos-warning-note">
                ⚠️ Sinyal darurat beserta titik koordinat GPS Anda akan langsung disiarkan ke Layar Monitor Posko & Komandan Regu.
              </p>

              <label className="form-label">Pilih Jenis Situasi Darurat:</label>
              <div className="sos-modal-grid">
                <button
                  type="button"
                  className={`sos-type-btn ${sosType === 'kriminal' ? 'active' : ''}`}
                  onClick={() => setSosType('kriminal')}
                >
                  <span className="emoji">🚨</span>
                  <span>Pencurian / Maling</span>
                </button>
                <button
                  type="button"
                  className={`sos-type-btn ${sosType === 'kebakaran' ? 'active' : ''}`}
                  onClick={() => setSosType('kebakaran')}
                >
                  <span className="emoji">🧯</span>
                  <span>Kebakaran</span>
                </button>
                <button
                  type="button"
                  className={`sos-type-btn ${sosType === 'kerusuhan' ? 'active' : ''}`}
                  onClick={() => setSosType('kerusuhan')}
                >
                  <span className="emoji">🥊</span>
                  <span>Tawuran / Keributan</span>
                </button>
                <button
                  type="button"
                  className={`sos-type-btn ${sosType === 'bencana' ? 'active' : ''}`}
                  onClick={() => setSosType('bencana')}
                >
                  <span className="emoji">🌪️</span>
                  <span>Pohon Tumbang / Banjir</span>
                </button>
                <button
                  type="button"
                  className={`sos-type-btn ${sosType === 'medis' ? 'active' : ''}`}
                  onClick={() => setSosType('medis')}
                >
                  <span className="emoji">🚑</span>
                  <span>Medis Darurat</span>
                </button>
                <button
                  type="button"
                  className={`sos-type-btn ${sosType === 'lainnya' ? 'active' : ''}`}
                  onClick={() => setSosType('lainnya')}
                >
                  <span className="emoji">⚠️</span>
                  <span>Situasi Lainnya</span>
                </button>
              </div>

              <label className="form-label">Keterangan Singkat Lokasi / Kejadian:</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Contoh: Depan Pos Kamling RT 02 ada kabel tiang korsleting terbakar..."
                value={sosNotes}
                onChange={(e) => setSosNotes(e.target.value)}
              />
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowSosModal(false)}
                disabled={sosSubmitting}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn-sos-confirm"
                onClick={handleConfirmSos}
                disabled={sosSubmitting}
              >
                {sosSubmitting ? 'Memancarkan Sinyal...' : 'PANCARKAN SINYAL SOS SEKARANG'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI LOGOUT */}
      <Modal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        title="Konfirmasi Keluar Akun"
        maxWidth="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowLogoutModal(false)}>
              Batal
            </Button>
            <Button variant="danger" onClick={handleLogout}>
              Ya, Keluar Akun
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', lineHeight: '1.6' }}>
          Apakah Anda yakin ingin keluar dari akun Presensi Linmas? Anda harus login kembali menggunakan NIK untuk bertugas pada shift berikutnya.
        </p>
      </Modal>
    </div>
  );
}
