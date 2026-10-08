import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';
import { APP_CONFIG } from '@/lib/config/appConfig';

const FUNCTIONS_BASE_URL = APP_CONFIG.functionsBaseUrl;

export interface LocationPayload {
  lat: number;
  lng: number;
  accuracy: number;
}

export const presensiService = {
  /**
   * Upload foto terkompresi ke Firebase Storage
   */
  uploadPhoto: async (file: File | Blob, path: string): Promise<string> => {
    const storageRef = ref(storage, path);
    const metadata = {
      contentType: file.type || 'image/jpeg',
      cacheControl: 'public, max-age=31536000',
    };
    await uploadBytes(storageRef, file, metadata);
    return await getDownloadURL(storageRef);
  },

  /**
   * Presensi Check-In / Check-Out
   */
  submitPresensi: async (
    token: string,
    type: 'masuk' | 'keluar',
    location: LocationPayload,
    deviceId: string,
    fotoUrl?: string | null
  ) => {
    const res = await fetch(`${FUNCTIONS_BASE_URL}/submitPresensi`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type,
        location,
        clientTime: Date.now(),
        deviceId,
        fotoUrl: fotoUrl || null,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Gagal melakukan presensi ${type}.`);
    return data;
  },

  /**
   * Submit Laporan Giat / Patroli Lapangan (SENAPATI 3-point pattern)
   */
  submitActivity: async (
    token: string,
    docId: string,
    activityLog: string,
    activityPhotoUrl?: string | null
  ) => {
    const res = await fetch(`${FUNCTIONS_BASE_URL}/submitActivity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        docId,
        activityLog,
        activityPhotoUrl: activityPhotoUrl || null,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menyimpan laporan kegiatan.');
    return data;
  },

  /**
   * Pengajuan Izin atau Sakit Mandiri oleh Anggota
   */
  submitLeave: async (
    token: string,
    type: 'izin' | 'sakit',
    reason: string,
    tanggal: string,
    attachmentUrl?: string | null
  ) => {
    const res = await fetch(`${FUNCTIONS_BASE_URL}/submitLeave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type,
        reason,
        tanggal,
        attachmentUrl: attachmentUrl || null,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal mengajukan izin.');
    return data;
  },

  /**
   * Persetujuan (Approval) Izin oleh Admin
   */
  processLeaveApproval: async (
    token: string,
    presensiId: string,
    action: 'approved' | 'rejected',
    rejectionReason?: string
  ) => {
    const res = await fetch(`${FUNCTIONS_BASE_URL}/processLeaveApproval`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        presensiId,
        action,
        rejectionReason: rejectionReason || null,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal memproses persetujuan izin.');
    return data;
  },

  approveLeave: async (presensiId: string, token: string) => {
    return presensiService.processLeaveApproval(token, presensiId, 'approved');
  },

  rejectLeave: async (presensiId: string, rejectionReason: string, token: string) => {
    return presensiService.processLeaveApproval(token, presensiId, 'rejected', rejectionReason);
  },
};
