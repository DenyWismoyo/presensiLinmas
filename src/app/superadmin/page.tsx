'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { db } from '@/lib/firebase/config';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  GeoPoint,
  getDocs,
} from 'firebase/firestore';
import { useAuth } from '@/lib/hooks/useAuth';
import { showToast } from '@/components/ui/Toast';

const LeafletGeotagMap = dynamic(() => import('@/lib/components/LeafletGeotagMap'), {
  ssr: false,
  loading: () => (
    <div className="leaflet-map-loading">
      <span>Memuat Peta Denah Interaktif Leaflet...</span>
    </div>
  ),
});

interface UnitData {
  id: string;
  nama: string;
  alamat: string;
  radius: number;
  adminUid: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export default function SuperAdminPage() {
  const { user, role, loading: authLoading, logout } = useAuth();
  const [units, setUnits] = useState<UnitData[]>([]);
  const [totalLinmasGlobal, setTotalLinmasGlobal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);

  // Form State
  const [nama, setNama] = useState('');
  const [alamat, setAlamat] = useState('');
  const [radius, setRadius] = useState<number>(100);
  const [adminUid, setAdminUid] = useState('');
  const [latitude, setLatitude] = useState<number>(-7.578884);
  const [longitude, setLongitude] = useState<number>(110.813872);
  const [locating, setLocating] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();

  // Role Protection
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login/admin');
      } else if (role !== 'superadmin') {
        router.push('/dashboard');
      }
    }
  }, [authLoading, user, role, router]);

  // Real-time Units Listener
  useEffect(() => {
    if (role !== 'superadmin') return;

    const unsub = onSnapshot(collection(db, 'units'), (snapshot) => {
      const items: UnitData[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        items.push({
          id: d.id,
          nama: data.nama || 'Posko Tanpa Nama',
          alamat: data.alamat || '-',
          radius: data.radius || 100,
          adminUid: data.adminUid || '-',
          location: data.location
            ? {
                latitude: data.location.latitude,
                longitude: data.location.longitude,
              }
            : undefined,
        });
      });
      setUnits(items);
      setLoading(false);
    });

    // Global Linmas Count
    getDocs(collection(db, 'linmas')).then((snap) => {
      setTotalLinmasGlobal(snap.size);
    });

    return () => unsub();
  }, [role]);

  // Geotagging Otomatis dari GPS Browser Super Admin
  const handleGetDeviceLocation = () => {
    if (!navigator.geolocation) {
      setFormError('Browser tidak mendukung pembacaan GPS.');
      return;
    }

    setLocating(true);
    setFormError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setFormError('Gagal membaca GPS: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Pintasan Pusatkan ke Kantor Kelurahan Tipes Kota Surakarta
  const handleCenterToTipes = () => {
    setLatitude(-7.578884);
    setLongitude(110.813872);
  };

  const openAddModal = () => {
    setEditingUnitId(null);
    setNama('');
    setAlamat('');
    setRadius(100);
    setAdminUid('');
    setLatitude(-7.578884);
    setLongitude(110.813872);
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (u: UnitData) => {
    setEditingUnitId(u.id);
    setNama(u.nama);
    setAlamat(u.alamat);
    setRadius(u.radius || 100);
    setAdminUid(u.adminUid || '');
    setLatitude(u.location?.latitude || -7.578884);
    setLongitude(u.location?.longitude || 110.813872);
    setFormError('');
    setModalOpen(true);
  };

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama) {
      setFormError('Nama Posko Unit wajib diisi.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const unitDocId = editingUnitId || `unit_${Date.now()}`;
      await setDoc(
        doc(db, 'units', unitDocId),
        {
          nama,
          alamat,
          radius: Number(radius) || 100,
          adminUid: adminUid.trim() || 'unassigned',
          location: new GeoPoint(Number(latitude), Number(longitude)),
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      showToast.success(`Posko unit "${nama}" berhasil disimpan`);
      setModalOpen(false);
    } catch (err: any) {
      const msg = 'Gagal menyimpan unit: ' + err.message;
      setFormError(msg);
      showToast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUnit = async (unitId: string, unitName: string) => {
    if (!confirm(`Hapus Posko "${unitName}"? Pastikan tidak ada anggota yang tertaut.`)) return;

    try {
      await deleteDoc(doc(db, 'units', unitId));
      showToast.info(`Posko "${unitName}" telah dihapus`);
    } catch (err: any) {
      showToast.error('Gagal menghapus unit: ' + err.message);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login/admin');
  };

  if (authLoading || role !== 'superadmin') {
    return <div className="table-empty">Memverifikasi hak akses Super Admin...</div>;
  }

  return (
    <div className="dashboard-layout">
      {/* Sidebar Super Admin */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <h2>⭐ SUPER ADMIN</h2>
        </div>

        <nav className="sidebar-nav">
          <button className="nav-item active">📍 Geotagging & Posko Unit</button>
          <button className="nav-item" onClick={() => router.push('/dashboard')}>
            📊 Dashboard Posko Unit
          </button>
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.email}</span>
            <span className="sidebar-user-role">Role: SUPER ADMIN</span>
          </div>
          <button className="btn btn-sm btn-danger" onClick={handleLogout}>
            Keluar
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="topbar-title">
            <h1>Geotagging & Manajemen Posko Linmas</h1>
            <p>Pengaturan Titik Koordinat GPS, Radius Geofencing, dan Pengelola Unit</p>
          </div>

          <div className="topbar-actions">
            <button className="btn btn-primary" onClick={openAddModal}>
              ➕ Tambah Posko Unit
            </button>
          </div>
        </header>

        <main className="dashboard-content">
          {/* Metrik Global */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon primary">📍</div>
              <div className="stat-info">
                <span className="stat-value">{units.length}</span>
                <span className="stat-label">Total Posko Terdaftar</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon success">👥</div>
              <div className="stat-info">
                <span className="stat-value">{totalLinmasGlobal}</span>
                <span className="stat-label">Total Anggota Linmas Global</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon warning">🛡️</div>
              <div className="stat-info">
                <span className="stat-value">Aktif</span>
                <span className="stat-label">Sistem Anti-Manipulasi</span>
              </div>
            </div>
          </div>

          {/* List Unit Cards */}
          <div className="unit-card-grid">
            {loading ? (
              <p className="text-muted">Memuat data posko...</p>
            ) : units.length > 0 ? (
              units.map((u) => (
                <div key={u.id} className="unit-card">
                  <div className="card-header">
                    <h3 className="card-title">{u.nama}</h3>
                    <span className="badge badge-info">{u.id}</span>
                  </div>

                  <p className="text-muted">{u.alamat}</p>

                  <div className="geotag-box">
                    <div>
                      <span className="form-label">Koordinat GPS Posko:</span>
                      {u.location ? (
                        <div className="action-cell">
                          <span className="coord-badge">
                            {u.location.latitude.toFixed(6)}, {u.location.longitude.toFixed(6)}
                          </span>
                          <a
                            href={`https://www.google.com/maps?q=${u.location.latitude},${u.location.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="external-map-link"
                          >
                            🗺️ Google Maps
                          </a>
                        </div>
                      ) : (
                        <span className="badge badge-warning">Koordinat Belum Diatur</span>
                      )}
                    </div>

                    <div>
                      <span className="form-label">Radius Geofencing Presensi:</span>
                      <span className="badge badge-success">{u.radius} meter</span>
                    </div>

                    <div>
                      <span className="form-label">Admin UID:</span>
                      <span className="nik-subtext">{u.adminUid}</span>
                    </div>
                  </div>

                  <div className="action-cell">
                    <button className="btn btn-sm btn-secondary" onClick={() => openEditModal(u)}>
                      ✏️ Edit Geotag
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDeleteUnit(u.id, u.nama)}
                    >
                      🗑️ Hapus
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="table-card">
                <div className="table-empty">Belum ada unit/posko terdaftar. Klik tombol Tambah Posko Unit.</div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modal Geotagging & CRUD Unit */}
      {modalOpen && (
        <div className="modal-backdrop">
          <div className="modal-box modal-lg">
            <div className="modal-header">
              <h2 className="modal-title">
                {editingUnitId ? 'Edit Posko & Geotagging Lokasi' : 'Tambah Posko Linmas Baru'}
              </h2>
              <button className="modal-close-btn" onClick={() => setModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUnit}>
              <div className="modal-body">
                {formError && <p className="form-error">{formError}</p>}

                <div className="form-grid">
                  <div>
                    <label className="form-label">Nama Posko / Unit</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Contoh: Posko Linmas Menteng"
                      value={nama}
                      onChange={(e) => setNama(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label">UID Admin Posko</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="UID Admin pengelola unit"
                      value={adminUid}
                      onChange={(e) => setAdminUid(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Alamat Lengkap</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Jalan, RT/RW, Kelurahan, Kecamatan"
                    value={alamat}
                    onChange={(e) => setAlamat(e.target.value)}
                  />
                </div>

                {/* Bagian Geotagging Interaktif dengan Leaflet Map */}
                <div className="geotag-box">
                  <div className="card-header">
                    <div>
                      <h4 className="card-title">📍 Denah & Geotagging Titik Posko Presisi</h4>
                      <p className="nik-subtext">Geser pin merah atau klik peta OpenStreetMap untuk menyesuaikan denah lokasi secara presisi</p>
                    </div>
                  </div>

                  {/* Leaflet Map Card Container */}
                  <div className="leaflet-map-wrapper">
                    <div className="map-toolbar-geotag">
                      <span className="map-instruction-tag">
                        👆 <b>Presisi:</b> Klik peta atau geser pin merah untuk menempatkan titik posko.
                      </span>
                      <div className="map-toolbar-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={handleCenterToTipes}
                          title="Pusatkan peta ke Kantor Kelurahan Tipes Kota Surakarta"
                        >
                          🎯 Ke Kantor Kelurahan Tipes
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={handleGetDeviceLocation}
                          disabled={locating}
                        >
                          {locating ? 'Membaca GPS...' : '🛰️ Deteksi GPS Saya'}
                        </button>
                      </div>
                    </div>

                    {modalOpen && (
                      <LeafletGeotagMap
                        latitude={latitude}
                        longitude={longitude}
                        radius={radius}
                        onChangeLocation={(lat, lng) => {
                          setLatitude(lat);
                          setLongitude(lng);
                        }}
                      />
                    )}

                    <div className="map-info-badge">
                      <span>
                        Koordinat Denah: <strong className="map-coords-pill">{latitude.toFixed(6)}, {longitude.toFixed(6)}</strong>
                      </span>
                      <span>
                        Radius Geofence: <strong>{radius} Meter</strong>
                      </span>
                    </div>
                  </div>

                  <div className="form-grid">
                    <div>
                      <label className="form-label">Latitude</label>
                      <input
                        type="number"
                        step="any"
                        className="form-input"
                        value={latitude}
                        onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
                        required
                      />
                    </div>

                    <div>
                      <label className="form-label">Longitude</label>
                      <input
                        type="number"
                        step="any"
                        className="form-input"
                        value={longitude}
                        onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
                        required
                      />
                    </div>

                    <div>
                      <label className="form-label">Radius Geofencing (Meter)</label>
                      <input
                        type="number"
                        min="20"
                        max="5000"
                        className="form-input"
                        value={radius}
                        onChange={(e) => setRadius(parseInt(e.target.value, 10) || 100)}
                        required
                      />
                    </div>
                  </div>

                  <div className="action-cell">
                    <span className="nik-subtext">Verifikasi Titik:</span>
                    <a
                      href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="external-map-link"
                    >
                      🗺️ Buka di Google Maps untuk Memastikan Akurasi Eksternal
                    </a>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModalOpen(false)}
                  disabled={submitting}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Menyimpan...' : 'Simpan Posko & Geotag'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
