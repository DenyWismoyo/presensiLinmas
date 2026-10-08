import fpPromise from '@fingerprintjs/fingerprintjs';

let cachedDeviceId: string | null = null;

/**
 * Mendapatkan deviceId unik (fingerprint browser/perangkat)
 */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  try {
    const fp = await fpPromise.load();
    const result = await fp.get();
    cachedDeviceId = result.visitorId;
    return cachedDeviceId;
  } catch (err) {
    console.error('Gagal mengambil fingerprint perangkat:', err);
    // Fallback uuid sederhana tersimpan di localStorage jika fingerprintjs gagal
    let fallbackId = typeof window !== 'undefined' ? localStorage.getItem('_linmas_device_id') : null;
    if (!fallbackId) {
      fallbackId = 'dev_' + Math.random().toString(36).substring(2, 15);
      if (typeof window !== 'undefined') {
        localStorage.setItem('_linmas_device_id', fallbackId);
      }
    }
    return fallbackId;
  }
}
