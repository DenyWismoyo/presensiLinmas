// Centralized TypeScript Interfaces for Presensi Linmas Enterprise

export type UserRole = 'user' | 'admin' | 'superadmin';

export type PresensiStatus = 'hadir' | 'terlambat' | 'izin' | 'sakit' | 'alpa';

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export type IncidentType =
  | 'KAMTIBMAS'
  | 'KEBAKARAN'
  | 'BENCANA_ALAM'
  | 'MEDIS_DARURAT'
  | 'KECELAKAAN'
  | 'LAINNYA';

export interface AuthClaims {
  role?: UserRole;
  nik?: string;
  unitId?: string;
  regupId?: string;
}

export interface UnitLocation {
  latitude: number;
  longitude: number;
}

export interface UnitItem {
  id: string;
  nama: string;
  alamat?: string;
  kode?: string;
  location: UnitLocation;
  radius: number;
  adminUid?: string;
  createdAt?: any;
}

export interface LinmasItem {
  nik: string;
  nama: string;
  jabatan: string; // 'Danton' | 'Wadanton' | 'Danru' | 'Anggota'
  unitId: string;
  regupId: string;
  telepon?: string;
  alamat?: string;
  aktif: boolean;
  deviceIds?: string[];
  fotoUrl?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ShiftItem {
  id: string;
  nama: string;
  jamMasuk: string; // 'HH:mm'
  jamKeluar: string; // 'HH:mm'
  toleransiMenit?: number;
  keterangan?: string;
  unitId?: string;
}

export interface RegupItem {
  id: string;
  nama: string;
  komandan?: string;
  unitId?: string;
  jumlahAnggota?: number;
}

export interface JadwalItem {
  id: string;
  tanggal: string; // 'YYYY-MM-DD'
  unitId: string;
  regupId: string;
  shiftId: string;
  keterangan?: string;
  createdAt?: any;
}

export interface PresensiItem {
  id: string;
  nik: string;
  nama: string;
  unitId: string;
  regupId?: string;
  shiftId?: string;
  tanggal: string; // 'YYYY-MM-DD'
  status: PresensiStatus;
  jamMasuk?: string;
  jamKeluar?: string;
  lokasiMasuk?: {
    lat: number;
    lng: number;
    accuracy?: number;
    jarakMeter?: number;
  };
  lokasiKeluar?: {
    lat: number;
    lng: number;
    accuracy?: number;
    jarakMeter?: number;
  };
  fotoMasukUrl?: string;
  fotoKeluarUrl?: string;
  deviceId?: string;
  antiManipulasi?: {
    diffWaktuDetik?: number;
    accuracy?: number;
    isMockLocation?: boolean;
  };
  createdAt?: any;
  updatedAt?: any;
}

export interface LeaveItem {
  id: string;
  nik: string;
  nama: string;
  unitId: string;
  tipe: 'izin' | 'sakit' | 'cuti';
  tanggalMulai: string;
  tanggalSelesai: string;
  alasan: string;
  suratUrl?: string;
  status: LeaveStatus;
  approvedBy?: string;
  approvedAt?: any;
  rejectionReason?: string;
  createdAt?: any;
}

export interface ActivityItem {
  id: string;
  nik: string;
  nama: string;
  unitId: string;
  regupId?: string;
  tipe: string; // 'patroli' | 'pengamanan' | 'sambang' | 'poskamling' | 'insiden'
  judul: string;
  deskripsi: string;
  fotoUrl?: string;
  lokasi?: {
    lat: number;
    lng: number;
  };
  createdAt?: any;
}

export interface AlertItem {
  id: string;
  unitId: string;
  nik: string;
  nama: string;
  type: 'PANIC_SOS' | 'NEW_DEVICE' | 'GEOFENCE_BREACH' | 'LATE_EXTREME';
  message: string;
  lokasi?: {
    lat: number;
    lng: number;
  };
  incidentType?: IncidentType;
  deviceId?: string;
  read: boolean;
  resolved?: boolean;
  resolvedBy?: string;
  resolvedAt?: any;
  createdAt?: any;
}

export interface AnnouncementItem {
  id: string;
  unitId: string;
  judul: string;
  pesan: string;
  tipe: 'info' | 'penting' | 'darurat';
  aktif: boolean;
  dibuatOleh: string;
  createdAt?: any;
}

export interface SettingsGeneral {
  toleransiKeterlambatan: number; // dalam menit
  radiusGeofenceDefault: number; // dalam meter
  jamBatasPresensiMasuk?: string; // e.g. '30' menit sebelum shift
  autoMarkAlpaJam?: string; // e.g. '02:00' setelah shift berakhir
  honorHadirPerShift: number; // Rupiah
  potonganTerlambat: number; // Rupiah
  allowMultipleDevice: boolean;
  unitId?: string;
  updatedAt?: any;
}

export interface AttendanceSummary {
  totalAnggota: number;
  hadir: number;
  terlambat: number;
  izinSakit: number;
  alpa: number;
  attendanceRate: number; // persentase 0-100
}
