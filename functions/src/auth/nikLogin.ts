import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';

export const nikLogin = onRequest({ cors: true }, async (req, res) => {
  try {
    const { nik } = req.body;
    if (!nik) {
      res.status(400).json({ error: 'NIK diperlukan' });
      return;
    }

    const linmasRef = admin.firestore().collection('linmas').doc(nik);
    const linmasSnap = await linmasRef.get();

    if (!linmasSnap.exists) {
      res.status(404).json({ error: 'NIK tidak ditemukan' });
      return;
    }

    const linmasData = linmasSnap.data()!;
    if (!linmasData.aktif) {
      res.status(403).json({ error: 'Akun tidak aktif' });
      return;
    }

    const uid = `linmas_${nik}`;
    // Pastikan user Firebase Auth ada
    try {
      await admin.auth().getUser(uid);
    } catch {
      await admin.auth().createUser({ uid, displayName: linmasData.nama });
    }

    const customToken = await admin.auth().createCustomToken(uid, {
      role: 'user',
      nik,
      unitId: linmasData.unitId || null,
      regupId: linmasData.regupId || null,
    });

    res.json({ token: customToken, linmas: linmasData });
  } catch (error: any) {
    console.error('Error during NIK login:', error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server' });
  }
});
