'use client';

import React, { useState } from 'react';
import { ShiftItem } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';
import { db } from '@/lib/firebase/config';
import { doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

interface ShiftsTabProps {
  shiftsList: ShiftItem[];
  unitId?: string;
}

export function ShiftsTab({ shiftsList, unitId }: ShiftsTabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShiftItem | null>(null);
  const [formNama, setFormNama] = useState('');
  const [formJamMasuk, setFormJamMasuk] = useState('07:00');
  const [formJamKeluar, setFormJamKeluar] = useState('15:00');
  const [formToleransi, setFormToleransi] = useState(15);
  const [submitting, setSubmitting] = useState(false);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormNama('');
    setFormJamMasuk('07:00');
    setFormJamKeluar('15:00');
    setFormToleransi(15);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: ShiftItem) => {
    setEditingItem(item);
    setFormNama(item.nama);
    setFormJamMasuk(item.jamMasuk);
    setFormJamKeluar(item.jamKeluar);
    setFormToleransi(item.toleransiMenit ?? 15);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNama.trim()) {
      showToast.warning('Nama shift wajib diisi');
      return;
    }

    setSubmitting(true);
    try {
      const docId = editingItem ? editingItem.id : `shift_${formNama.toLowerCase().replace(/\s+/g, '_')}`;
      const docRef = doc(db, 'shifts', docId);

      const payload = {
        nama: formNama.trim(),
        jamMasuk: formJamMasuk,
        jamKeluar: formJamKeluar,
        toleransiMenit: Number(formToleransi),
        unitId: unitId || 'tipes',
      };

      if (editingItem) {
        await updateDoc(docRef, payload);
        showToast.success(`Shift ${formNama} berhasil diperbarui`);
      } else {
        await setDoc(docRef, payload);
        showToast.success(`Shift ${formNama} berhasil ditambahkan`);
      }
      setModalOpen(false);
    } catch (err: any) {
      showToast.error(err.message || 'Gagal menyimpan shift');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: ShiftItem) => {
    if (!confirm(`Hapus konfigurasi shift ${item.nama}?`)) return;
    try {
      await deleteDoc(doc(db, 'shifts', item.id));
      showToast.info(`Shift ${item.nama} telah dihapus`);
    } catch {
      showToast.error('Gagal menghapus shift');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* ACTION BAR */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--color-surface)',
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div>
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'bold' }}>⏰ Pengaturan Shift Dinas</h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Tentukan jam operasional masuk, jam keluar, dan batas toleransi keterlambatan
          </p>
        </div>

        <button type="button" className="btn btn-primary btn-sm" onClick={handleOpenAdd}>
          ➕ Tambah Shift
        </button>
      </div>

      {/* SHIFT CARDS GRID */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {shiftsList.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', gridColumn: '1 / -1' }}>
            <p style={{ fontSize: '24px' }}>⏰</p>
            <p style={{ fontWeight: '600' }}>Belum ada data shift</p>
          </div>
        ) : (
          shiftsList.map((shift) => (
            <div key={shift.id} className="card" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                <div>
                  <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold' }}>{shift.nama}</h4>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                    ID: {shift.id}
                  </span>
                </div>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: '600',
                    background: 'var(--color-primary-light)',
                    color: 'var(--color-primary)',
                  }}
                >
                  Toleransi: {shift.toleransiMenit || 15} Menit
                </span>
              </div>

              <div
                style={{
                  background: 'var(--color-bg)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--space-4)',
                  display: 'flex',
                  justifyContent: 'space-around',
                  textAlign: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Jam Masuk</div>
                  <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold', color: 'var(--color-success)' }}>
                    {shift.jamMasuk}
                  </div>
                </div>

                <div style={{ borderLeft: '1px solid var(--color-border)' }}></div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Jam Keluar</div>
                  <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold', color: 'var(--color-text)' }}>
                    {shift.jamKeluar}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleOpenEdit(shift)}
                >
                  ✏️ Edit
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(shift)}
                >
                  🗑️ Hapus
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL EDIT / TAMBAH SHIFT */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit Konfigurasi Shift' : 'Tambah Shift Dinas Baru'}
        maxWidth="sm"
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label className="form-label">Nama Shift:</label>
            <input
              type="text"
              className="form-input"
              value={formNama}
              onChange={(e) => setFormNama(e.target.value)}
              placeholder="Contoh: Pagi / Siang / Malam / Khusus"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label className="form-label">Jam Masuk (HH:mm):</label>
              <input
                type="time"
                className="form-input"
                value={formJamMasuk}
                onChange={(e) => setFormJamMasuk(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="form-label">Jam Keluar (HH:mm):</label>
              <input
                type="time"
                className="form-input"
                value={formJamKeluar}
                onChange={(e) => setFormJamKeluar(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="form-label">Toleransi Keterlambatan (Menit):</label>
            <input
              type="number"
              className="form-input"
              value={formToleransi}
              onChange={(e) => setFormToleransi(Number(e.target.value))}
              min={0}
              max={120}
              required
            />
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Presensi yang melewati jam masuk + toleransi ini akan otomatis berstatus Terlambat.
            </span>
          </div>

          <div className="modal-footer" style={{ margin: 'var(--space-4) -24px -24px -24px' }}>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Simpan Shift
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
