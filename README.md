# 🦺 Presensi Linmas (Sistem Keamanan & Presensi Operasional)

Aplikasi Presensi Digital PWA (Progressive Web App) dan Sistem Manajemen Operasional Satlinmas (Satuan Perlindungan Masyarakat) berbasis Next.js 16, React 19, Firebase Firestore, dan Cloud Functions.

---

## 🌟 Fitur Utama

- **PWA Mobile-First Presensi**: Tampilan borderless yang elegan dan thumb-friendly untuk personel Linmas di lapangan.
- **Geofencing & Validasi Lokasi GPS**: Menggunakan kalkulasi Haversine Formula terverifikasi server untuk mencegah spoofing/mock location.
- **Dokumentasi Visual 3-Point (SENAPATI Pattern)**: Validasi selfie check-in, giat patroli posko, dan selfie check-out dinas.
- **Kartu Tanda Anggota (KTA) Digital**: Profil anggota lengkap dengan verifikasi QR Code resmi.
- **Sinyal Darurat Lapangan (SOS Panic Button)**: Mengirimkan peringatan bahaya/insiden secara instan ke Admin Posko.
- **Dashboard Admin & Super Admin**:
  - Ringkasan KPI dan grafik analitik kehadiran.
  - Log kehadiran dengan foto verifikasi selfie.
  - Manajemen jadwal piket dan pembagian regu dinas.
  - Rekapitulasi honorarium otomatis per shift dengan ekspor laporan.
  - Pemantauan dan penanganan alert darurat real-time.
  - Siaran pengumuman dan instruksi resmi posko.

---

## 🏗️ Tech Stack

- **Frontend**: Next.js 16 (App Router, Turbopack), React 19, TypeScript
- **Styling**: Vanilla CSS (Custom Enterprise Design System, Strictly No Tailwind/MUI)
- **Backend & Database**: Firebase Firestore (Native Mode), Firebase Auth, Firebase Storage, Cloud Functions v2
- **Keamanan**: Role-Based Access Control (RBAC), Custom Claims, Strict Security Rules, Anti-manipulasi server timestamps

---

## 🚀 Memulai Pengembangan

### 1. Prasyarat
- Node.js versi 20+
- Akun Firebase dengan project aktif

### 2. Instalasi Dependensi
```bash
# Instal dependensi aplikasi utama
npm install

# Instal dependensi Cloud Functions
cd functions
npm install
cd ..
```

### 3. Menjalankan Server Pengembangan
```bash
npm run dev
```
Buka [http://localhost:3000](http://localhost:3000) pada browser Anda.

### 4. Build Produksi
```bash
npm run build
npm start
```

---

## 🔒 Keamanan & Kebijakan Data

File kredensial sensitif seperti `serviceAccountKey.json`, private keys, dan file environment tidak disertakan dalam repositori ini demi keamanan data operasional.
