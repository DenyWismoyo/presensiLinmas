import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export interface SystemSettings {
  toleransiKeterlambatan: number; // Menit toleransi sebelum dihitung terlambat (default: 15)
  radiusGeofenceDefault: number; // Radius default posko jika tidak ditentukan (meter, default: 100)
  maxGpsAccuracy: number; // Batas akurasi GPS minimum agar valid (meter, default: 50)
  strictAntiMock: boolean; // Aktifkan blokir / peringatan lokasi palsu (default: true)
  requireSelfieCamera: boolean; // Wajib foto selfie kamera saat presensi (default: true)
  minActivityIntervalMinutes: number; // Interval minimal lapor kegiatan patroli (menit, default: 60)
  autoApprovalLeaveDoctor: boolean; // Otomatis setujui sakit jika melampirkan surat dokter (default: false)
}

export const DEFAULT_SETTINGS: SystemSettings = {
  toleransiKeterlambatan: 15,
  radiusGeofenceDefault: 100,
  maxGpsAccuracy: 50,
  strictAntiMock: true,
  requireSelfieCamera: true,
  minActivityIntervalMinutes: 60,
  autoApprovalLeaveDoctor: false,
};

export const settingsService = {
  /**
   * Mengambil konfigurasi sistem terpusat dari Firestore (settings/general)
   */
  getSettings: async (): Promise<SystemSettings> => {
    try {
      const snap = await getDoc(doc(db, 'settings', 'general'));
      if (snap.exists()) {
        return {
          ...DEFAULT_SETTINGS,
          ...(snap.data() as Partial<SystemSettings>),
        };
      }
      return DEFAULT_SETTINGS;
    } catch (err) {
      console.warn('Menggunakan default settings karena gagal memuat dari Firestore:', err);
      return DEFAULT_SETTINGS;
    }
  },

  /**
   * Menyimpan / memperbarui konfigurasi sistem terpusat
   */
  updateSettings: async (newSettings: Partial<SystemSettings>, updatedBy?: string) => {
    const docRef = doc(db, 'settings', 'general');
    await setDoc(
      docRef,
      {
        ...newSettings,
        updatedBy: updatedBy || 'admin',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  },
};
