/**
 * Konfigurasi Aplikasi Presensi Linmas
 */
export const APP_CONFIG = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'Presensi Digital Linmas',
  appVersion: process.env.NEXT_PUBLIC_APP_VERSION || '1.2.0',
  defaultPoskoName: process.env.NEXT_PUBLIC_DEFAULT_POSKO_NAME || 'Posko Linmas Kelurahan Tipes',
  defaultKota: process.env.NEXT_PUBLIC_DEFAULT_KOTA || 'Kota Surakarta',
  functionsBaseUrl: process.env.NEXT_PUBLIC_FUNCTIONS_URL || '',
};
