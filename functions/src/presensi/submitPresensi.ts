import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';

export function isWithinRadius(
  userLat: number,
  userLng: number,
  unitLat: number,
  unitLng: number,
  radiusMeters: number
): boolean {
  const distance = getDistanceMeters(userLat, userLng, unitLat, unitLng);
  return distance <= radiusMeters;
}

export function getDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // radius bumi dalam meter
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// 1. FUNGSI UTAMA: SUBMIT PRESENSI (CHECK-IN & CHECK-OUT)
export const submitPresensi = onRequest({ cors: true }, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token otentikasi tidak valid atau tidak ditemukan' });
      return;
    }

    const token = authHeader.split('Bearer ')[1];
    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch {
      res.status(401).json({ error: 'Sesi token telah kedaluwarsa. Silakan login kembali.' });
      return;
    }

    const { role, nik, unitId, regupId } = decoded as any;
    if (role !== 'user' || !nik) {
      res.status(403).json({ error: 'Akses ditolak: hanya anggota Linmas yang dapat melakukan presensi.' });
      return;
    }

    const { type, location, clientTime, deviceId, fotoUrl } = req.body;
    if (!type || !location || !clientTime || !deviceId) {
      res.status(400).json({ error: 'Data presensi tidak lengkap (type, location, clientTime, deviceId wajib ada).' });
      return;
    }

    if (type !== 'masuk' && type !== 'keluar') {
      res.status(400).json({ error: 'Tipe presensi tidak valid. Pilih "masuk" atau "keluar".' });
      return;
    }

    // Validasi sinkronisasi waktu client vs server
    const serverNow = Date.now();
    const diff = Math.abs(serverNow - clientTime);
    if (diff > 5 * 60 * 1000) {
      res.status(400).json({
        error: 'Waktu perangkat Anda berbeda > 5 menit dengan jam server. Harap atur waktu HP ke otomatis.'
      });
      return;
    }

    // Ambil data unit & validasi Geofencing
    const unitSnap = await admin.firestore().collection('units').doc(unitId).get();
    if (!unitSnap.exists) {
      res.status(404).json({ error: 'Posko unit Linmas Anda tidak ditemukan.' });
      return;
    }
    const unit = unitSnap.data()!;
    const unitLoc = unit.location;
    const unitRadius = unit.radius || 100;

    const distanceFromSite = getDistanceMeters(
      location.lat,
      location.lng,
      unitLoc.latitude,
      unitLoc.longitude
    );

    const within = distanceFromSite <= unitRadius;
    if (!within) {
      res.status(400).json({
        error: `Lokasi Anda berada di luar jangkauan posko (jarak ${distanceFromSite}m, radius batas ${unitRadius}m). Dekati posko sebelum presensi.`
      });
      return;
    }

    // Tentukan tanggal & shift aktif (WIB UTC+7)
    const wibDate = new Date(serverNow + 7 * 60 * 60 * 1000);
    const today = wibDate.toISOString().split('T')[0];
    const hourWib = wibDate.getUTCHours();
    const minuteWib = wibDate.getUTCMinutes();

    let shiftId = 'shift_pagi';
    let shiftData: any = null;

    // Cek jadwal hari ini jika ada
    if (regupId) {
      const jadwalSnap = await admin.firestore().collection('jadwal')
        .where('unitId', '==', unitId)
        .where('regupId', '==', regupId)
        .where('tanggal', '==', today)
        .limit(1)
        .get();

      if (!jadwalSnap.empty) {
        shiftId = jadwalSnap.docs[0].data().shiftId;
      }
    }

    // Ambil data detail shift jika tersimpan
    const shiftSnap = await admin.firestore().collection('shifts').doc(shiftId).get();
    if (shiftSnap.exists) {
      shiftData = shiftSnap.data();
    } else {
      if (hourWib >= 7 && hourWib < 15) {
        shiftId = 'shift_pagi';
        shiftData = { nama: 'Pagi', jamMasuk: '07:00', jamKeluar: '15:00', toleransiMenit: 30 };
      } else if (hourWib >= 15 && hourWib < 23) {
        shiftId = 'shift_siang';
        shiftData = { nama: 'Siang', jamMasuk: '15:00', jamKeluar: '23:00', toleransiMenit: 30 };
      } else {
        shiftId = 'shift_malam';
        shiftData = { nama: 'Malam', jamMasuk: '23:00', jamKeluar: '07:00', toleransiMenit: 30 };
      }
    }

    // Hitung status hadir vs terlambat secara presisi (SENAPATI pattern)
    let statusPresensi: 'hadir' | 'terlambat' = 'hadir';
    let lateMinutes = 0;
    let isLate = false;

    // Ambil konfigurasi toleransi dari settings/general jika tersedia
    let toleransi = shiftData?.toleransiMenit || 15;
    try {
      const settingsSnap = await admin.firestore().collection('settings').doc('general').get();
      if (settingsSnap.exists) {
        const sData = settingsSnap.data();
        if (typeof sData?.toleransiKeterlambatan === 'number') {
          toleransi = sData.toleransiKeterlambatan;
        }
      }
    } catch {
      // Tetap gunakan toleransi default
    }

    if (shiftData?.jamMasuk) {
      const [shH, shM] = shiftData.jamMasuk.split(':').map(Number);
      const currentTotalMin = hourWib * 60 + minuteWib;
      const shiftStartMin = shH * 60 + shM;

      if (currentTotalMin > shiftStartMin + toleransi) {
        statusPresensi = 'terlambat';
        lateMinutes = currentTotalMin - shiftStartMin;
        isLate = true;
      }
    }

    // Deterministic Doc ID
    const presensiDocId = `${nik}_${today}_${shiftId}`;
    const presensiDocRef = admin.firestore().collection('presensi').doc(presensiDocId);
    const linmasRef = admin.firestore().collection('linmas').doc(nik);

    // Jalankan Firestore Transaction
    await admin.firestore().runTransaction(async (t) => {
      const linmasDoc = await t.get(linmasRef);
      if (!linmasDoc.exists) {
        throw new Error('LINMAS_NOT_FOUND');
      }
      const linmasData = linmasDoc.data()!;
      if (!linmasData.aktif) {
        throw new Error('ACCOUNT_INACTIVE');
      }

      const namaAnggota = linmasData.nama || 'Anggota Linmas';
      const knownDevices: string[] = linmasData.deviceIds || [];
      const isNewDevice = !knownDevices.includes(deviceId);

      if (isNewDevice) {
        t.update(linmasRef, {
          deviceIds: admin.firestore.FieldValue.arrayUnion(deviceId),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const alertDocRef = admin.firestore().collection('alerts').doc();
        t.set(alertDocRef, {
          unitId,
          nik,
          nama: namaAnggota,
          type: 'NEW_DEVICE',
          message: `Anggota ${namaAnggota} (${nik}) presensi dari perangkat baru (${deviceId.substring(0, 8)}...).`,
          deviceId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          read: false
        });
      }

      const presensiDoc = await t.get(presensiDocRef);

      if (type === 'masuk') {
        if (presensiDoc.exists) {
          throw new Error('ALREADY_EXISTS');
        }

        t.set(presensiDocRef, {
          nik,
          nama: namaAnggota,
          unitId,
          regupId: regupId || 'default',
          shiftId,
          tanggal: today,
          waktuMasuk: admin.firestore.FieldValue.serverTimestamp(),
          lokasiMasuk: new admin.firestore.GeoPoint(location.lat, location.lng),
          akurasiMasuk: location.accuracy,
          distanceFromSite,
          status: statusPresensi,
          isLate,
          lateMinutes,
          fotoMasuk: fotoUrl || null,
          activityLog: null,
          activityPhotoUrl: null,
          activityTime: null,
          antiManipulasi: {
            deviceId,
            isMockLocation: location.accuracy > 50,
            accuracy: location.accuracy,
            clientTimeDiff: diff,
            isNewDevice
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else if (type === 'keluar') {
        if (!presensiDoc.exists) {
          throw new Error('NO_PRESENSI_MASUK');
        }
        const existingData = presensiDoc.data()!;
        if (existingData.waktuKeluar) {
          throw new Error('ALREADY_CHECKOUT');
        }

        t.update(presensiDocRef, {
          waktuKeluar: admin.firestore.FieldValue.serverTimestamp(),
          lokasiKeluar: new admin.firestore.GeoPoint(location.lat, location.lng),
          akurasiKeluar: location.accuracy,
          distanceFromSiteKeluar: distanceFromSite,
          fotoKeluar: fotoUrl || null
        });
      }
    });

    res.json({
      success: true,
      message: `Presensi ${type} berhasil dicatat (${statusPresensi.toUpperCase()}${isLate ? `, Terlambat ${lateMinutes} menit` : ''}).`,
      data: {
        docId: presensiDocId,
        nik,
        tanggal: today,
        shiftId,
        status: statusPresensi,
        distanceFromSite,
        isLate,
        lateMinutes
      }
    });
  } catch (error: any) {
    console.error('Error saat submit presensi:', error);
    if (error.message === 'ALREADY_EXISTS') {
      res.status(400).json({ error: 'Anda sudah melakukan presensi masuk untuk shift ini hari ini.' });
    } else if (error.message === 'NO_PRESENSI_MASUK') {
      res.status(400).json({ error: 'Anda belum melakukan presensi masuk untuk shift hari ini.' });
    } else if (error.message === 'ALREADY_CHECKOUT') {
      res.status(400).json({ error: 'Anda sudah melakukan presensi keluar sebelumnya.' });
    } else if (error.message === 'ACCOUNT_INACTIVE') {
      res.status(403).json({ error: 'Akun Anda telah dinonaktifkan.' });
    } else if (error.message === 'LINMAS_NOT_FOUND') {
      res.status(404).json({ error: 'Data anggota Linmas tidak ditemukan.' });
    } else {
      res.status(500).json({ error: 'Terjadi kesalahan sistem saat memproses presensi.' });
    }
  }
});

// 2. FUNGSI: LAPORAN KEGIATAN / PATROLI LAPANGAN (SENAPATI PATTERN)
export const submitActivity = onRequest({ cors: true }, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token tidak valid' });
      return;
    }

    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    const { nik } = decoded as any;

    const { docId, activityLog, activityPhotoUrl } = req.body;
    if (!docId || !activityLog) {
      res.status(400).json({ error: 'ID Presensi dan Catatan Kegiatan wajib diisi.' });
      return;
    }

    const presensiRef = admin.firestore().collection('presensi').doc(docId);
    const docSnap = await presensiRef.get();

    if (!docSnap.exists) {
      res.status(404).json({ error: 'Dokumen presensi tidak ditemukan.' });
      return;
    }

    if (docSnap.data()?.nik !== nik) {
      res.status(403).json({ error: 'Anda tidak memiliki akses ke presensi ini.' });
      return;
    }

    await presensiRef.update({
      activityLog,
      activityPhotoUrl: activityPhotoUrl || null,
      activityTime: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      message: 'Laporan aktivitas giat patroli berhasil disimpan.'
    });
  } catch (error: any) {
    console.error('Error submit activity:', error);
    res.status(500).json({ error: error.message || 'Gagal menyimpan aktivitas.' });
  }
});

// 3. FUNGSI: PENGAJUAN IZIN / SAKIT (LEAVE MANAGEMENT)
export const submitLeave = onRequest({ cors: true }, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token tidak valid' });
      return;
    }

    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    const { nik, unitId, regupId } = decoded as any;

    const { type, reason, attachmentUrl, tanggal } = req.body;
    if (!type || !reason || !tanggal) {
      res.status(400).json({ error: 'Jenis izin, alasan, dan tanggal wajib diisi.' });
      return;
    }

    // Ambil nama anggota
    const linmasSnap = await admin.firestore().collection('linmas').doc(nik).get();
    const namaAnggota = linmasSnap.exists ? linmasSnap.data()?.nama : 'Anggota Linmas';

    const leaveDocId = `leave_${nik}_${tanggal}`;
    const leaveRef = admin.firestore().collection('presensi').doc(leaveDocId);

    await leaveRef.set({
      nik,
      nama: namaAnggota,
      unitId,
      regupId: regupId || 'default',
      shiftId: 'izin_sakit',
      tanggal,
      status: type, // 'izin' atau 'sakit'
      keterangan: reason,
      suratFotoUrl: attachmentUrl || null,
      approvalStatus: 'pending',
      reviewedBy: null,
      rejectionReason: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    res.json({
      success: true,
      message: `Permohonan ${type} berhasil diajukan dan menunggu persetujuan admin posko.`
    });
  } catch (error: any) {
    console.error('Error submit leave:', error);
    res.status(500).json({ error: error.message || 'Gagal mengajukan izin.' });
  }
});

// 4. FUNGSI: APPROVAL IZIN OLEH ADMIN POSKO
export const processLeaveApproval = onRequest({ cors: true }, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token tidak valid' });
      return;
    }

    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    const { role } = decoded as any;

    if (role !== 'admin' && role !== 'superadmin') {
      res.status(403).json({ error: 'Hanya Admin atau Super Admin yang dapat menyetujui izin.' });
      return;
    }

    const { presensiId, action, rejectionReason } = req.body;
    if (!presensiId || (action !== 'approved' && action !== 'rejected')) {
      res.status(400).json({ error: 'ID Presensi dan aksi (approved/rejected) wajib diisi.' });
      return;
    }

    const docRef = admin.firestore().collection('presensi').doc(presensiId);
    await docRef.update({
      approvalStatus: action,
      rejectionReason: action === 'rejected' ? (rejectionReason || 'Alasan tidak disebutkan') : null,
      reviewedBy: decoded.email || decoded.uid,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      message: `Permohonan izin berhasil di-${action === 'approved' ? 'setujui' : 'tolak'}.`
    });
  } catch (error: any) {
    console.error('Error process leave approval:', error);
    res.status(500).json({ error: error.message || 'Gagal memproses persetujuan izin.' });
  }
});
