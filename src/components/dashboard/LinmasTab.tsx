'use client';

import React, { useState, useMemo } from 'react';
import { LinmasItem, RegupItem } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';
import { db } from '@/lib/firebase/config';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface LinmasTabProps {
  linmasList: LinmasItem[];
  regupsList: RegupItem[];
  unitId?: string;
}

export function LinmasTab({ linmasList, regupsList, unitId }: LinmasTabProps) {
  const [search, setSearch] = useState('');
  const [filterRegu, setFilterRegu] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LinmasItem | null>(null);
  const [formNik, setFormNik] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formJabatan, setFormJabatan] = useState('Anggota');
  const [formRegup, setFormRegup] = useState('Regu A');
  const [formTelepon, setFormTelepon] = useState('');
  const [formAktif, setFormAktif] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filter Data
  const filteredList = useMemo(() => {
    return linmasList.filter((item) => {
      const matchSearch =
        item.nama?.toLowerCase().includes(search.toLowerCase()) ||
        item.nik?.includes(search);
      const matchRegu =
        filterRegu === 'all' || item.regupId === filterRegu;
      return matchSearch && matchRegu;
    });
  }, [linmasList, search, filterRegu]);

  const totalPages = Math.ceil(filteredList.length / pageSize) || 1;
  const paginatedList = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, page, pageSize]);

  // Open Form
  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormNik('');
    setFormNama('');
    setFormJabatan('Anggota');
    setFormRegup(regupsList[0]?.nama || 'Regu A');
    setFormTelepon('');
    setFormAktif(true);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: LinmasItem) => {
    setEditingItem(item);
    setFormNik(item.nik);
    setFormNama(item.nama);
    setFormJabatan(item.jabatan || 'Anggota');
    setFormRegup(item.regupId || 'Regu A');
    setFormTelepon(item.telepon || '');
    setFormAktif(item.aktif ?? true);
    setModalOpen(true);
  };

  // Simpan Data Anggota
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNik = formNik.trim().replace(/\D/g, '');

    if (cleanNik.length !== 16) {
      showToast.warning('NIK harus tepat 16 digit angka');
      return;
    }
    if (!formNama.trim()) {
      showToast.warning('Nama lengkap wajib diisi');
      return;
    }

    setSubmitting(true);
    try {
      const docRef = doc(db, 'linmas', cleanNik);
      if (editingItem) {
        // Update
        await updateDoc(docRef, {
          nama: formNama.trim(),
          jabatan: formJabatan,
          regupId: formRegup,
          telepon: formTelepon.trim(),
          aktif: formAktif,
          updatedAt: serverTimestamp(),
        });
        showToast.success(`Data ${formNama} berhasil diperbarui`);
      } else {
        // Create new
        await setDoc(docRef, {
          nik: cleanNik,
          nama: formNama.trim(),
          jabatan: formJabatan,
          regupId: formRegup,
          unitId: unitId || 'tipes',
          telepon: formTelepon.trim(),
          aktif: formAktif,
          deviceIds: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast.success(`Anggota baru ${formNama} berhasil ditambahkan`);
      }
      setModalOpen(false);
    } catch (err: any) {
      showToast.error(err.message || 'Gagal menyimpan data anggota');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset Fingerprint HP
  const handleResetDevice = async (item: LinmasItem) => {
    if (
      !confirm(
        `Reset data HP terdaftar untuk ${item.nama}? Perangkat baru yang dipakai anggota akan otomatis didaftarkan ulang.`
      )
    ) {
      return;
    }

    try {
      await updateDoc(doc(db, 'linmas', item.nik), {
        deviceIds: [],
        updatedAt: serverTimestamp(),
      });
      showToast.success(`Perangkat HP ${item.nama} berhasil di-reset`);
    } catch (err: any) {
      showToast.error('Gagal mereset perangkat');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* ACTION BAR */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--color-surface)',
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div style={{ display: 'flex', gap: 'var(--space-3)', flex: 1 }}>
          <input
            type="text"
            className="form-input"
            placeholder="🔍 Cari nama atau NIK anggota..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{ maxWidth: '280px' }}
          />

          <select
            className="form-select"
            value={filterRegu}
            onChange={(e) => {
              setFilterRegu(e.target.value);
              setPage(1);
            }}
            style={{ maxWidth: '170px' }}
          >
            <option value="all">Semua Regu</option>
            {regupsList.map((r) => (
              <option key={r.id} value={r.nama}>
                {r.nama}
              </option>
            ))}
          </select>
        </div>

        <button type="button" className="btn btn-primary btn-sm" onClick={handleOpenAdd}>
          ➕ Tambah Anggota
        </button>
      </div>

      {/* TABEL DATA ANGGOTA */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--text-xs)' }}>
            <thead>
              <tr
                style={{
                  background: 'var(--color-bg)',
                  borderBottom: '1px solid var(--color-border)',
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                <th style={{ padding: '12px 16px' }}>No</th>
                <th style={{ padding: '12px 16px' }}>NIK</th>
                <th style={{ padding: '12px 16px' }}>Nama Lengkap</th>
                <th style={{ padding: '12px 16px' }}>Jabatan</th>
                <th style={{ padding: '12px 16px' }}>Regu Piket</th>
                <th style={{ padding: '12px 16px' }}>Status Akun</th>
                <th style={{ padding: '12px 16px' }}>HP Terdaftar</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                    <p style={{ fontSize: '24px' }}>🦺</p>
                    <p style={{ fontWeight: '600' }}>Tidak ada anggota yang sesuai</p>
                  </td>
                </tr>
              ) : (
                paginatedList.map((item, idx) => {
                  const itemIndex = (page - 1) * pageSize + idx + 1;
                  const deviceCount = item.deviceIds?.length || 0;

                  return (
                    <tr
                      key={item.nik}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        transition: 'background-color 150ms ease',
                      }}
                    >
                      <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)' }}>
                        {itemIndex}
                      </td>

                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {item.nik}
                      </td>

                      <td style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--color-text)' }}>
                        {item.nama}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            fontWeight: item.jabatan === 'Danton' || item.jabatan === 'Danru' ? 'bold' : 'normal',
                          }}
                        >
                          {item.jabatan || 'Anggota'}
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px' }}>{item.regupId || '-'}</td>

                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: item.aktif ? 'var(--color-success-light)' : 'var(--color-danger-light)',
                            color: item.aktif ? 'var(--color-success)' : 'var(--color-danger)',
                          }}
                        >
                          {item.aktif ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <span>📱 {deviceCount} HP</span>
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEdit(item)}
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            title="Edit identitas anggota"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-warning btn-sm"
                            onClick={() => handleResetDevice(item)}
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            title="Reset perangkat jika ganti HP"
                          >
                            🔄 Reset HP
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="table-pagination">
          <span>
            Halaman {page} dari {totalPages}
          </span>
          <div className="pagination-controls">
            <button
              type="button"
              className="btn-page"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              ← Sebelumnya
            </button>
            <button
              type="button"
              className="btn-page"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Berikutnya →
            </button>
          </div>
        </div>
      </div>

      {/* MODAL FORM TAMBAH / EDIT ANGGOTA */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit Data Anggota Linmas' : 'Tambah Anggota Linmas Baru'}
        maxWidth="md"
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label className="form-label">Nomor Induk Kependudukan (NIK - 16 Digit):</label>
            <input
              type="text"
              className="form-input"
              value={formNik}
              onChange={(e) => setFormNik(e.target.value.replace(/\D/g, ''))}
              placeholder="Contoh: 3372020211760001"
              maxLength={16}
              disabled={Boolean(editingItem)}
              required
            />
            {editingItem && (
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                NIK tidak dapat diubah setelah terdaftar.
              </span>
            )}
          </div>

          <div>
            <label className="form-label">Nama Lengkap Anggota:</label>
            <input
              type="text"
              className="form-input"
              value={formNama}
              onChange={(e) => setFormNama(e.target.value)}
              placeholder="Contoh: SUHARYANTO"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label className="form-label">Jabatan:</label>
              <select
                className="form-select"
                value={formJabatan}
                onChange={(e) => setFormJabatan(e.target.value)}
              >
                <option value="Danton">Komandan Pleton (Danton)</option>
                <option value="Wadanton">Wakil Danton (Wadanton)</option>
                <option value="Danru">Komandan Regu (Danru)</option>
                <option value="Wadanru">Wakil Danru</option>
                <option value="Anggota">Anggota Satlinmas</option>
              </select>
            </div>

            <div>
              <label className="form-label">Penugasan Regu:</label>
              <select
                className="form-select"
                value={formRegup}
                onChange={(e) => setFormRegup(e.target.value)}
              >
                {regupsList.map((r) => (
                  <option key={r.id} value={r.nama}>
                    {r.nama}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Nomor WhatsApp / HP (Opsional):</label>
            <input
              type="tel"
              className="form-input"
              value={formTelepon}
              onChange={(e) => setFormTelepon(e.target.value)}
              placeholder="Contoh: 08123456789"
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <input
              type="checkbox"
              id="formAktif"
              checked={formAktif}
              onChange={(e) => setFormAktif(e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            <label htmlFor="formAktif" style={{ fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
              Status Akun Aktif (Dapat Login & Presensi)
            </label>
          </div>

          <div className="modal-footer" style={{ margin: 'var(--space-4) -24px -24px -24px' }}>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              {editingItem ? 'Simpan Perubahan' : 'Daftarkan Anggota'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
