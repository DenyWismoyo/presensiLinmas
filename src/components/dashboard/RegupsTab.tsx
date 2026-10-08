'use client';

import React, { useState } from 'react';
import { RegupItem, LinmasItem } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';
import { db } from '@/lib/firebase/config';
import { doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

interface RegupsTabProps {
  regupsList: RegupItem[];
  linmasList: LinmasItem[];
  unitId?: string;
}

export function RegupsTab({ regupsList, linmasList, unitId }: RegupsTabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RegupItem | null>(null);
  const [formNama, setFormNama] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormNama('');
    setModalOpen(true);
  };

  const handleOpenEdit = (item: RegupItem) => {
    setEditingItem(item);
    setFormNama(item.nama);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNama.trim()) {
      showToast.warning('Nama regu wajib diisi');
      return;
    }

    setSubmitting(true);
    try {
      const docId = editingItem ? editingItem.id : `regu_${formNama.toLowerCase().replace(/\s+/g, '_')}`;
      const docRef = doc(db, 'regups', docId);

      const payload = {
        nama: formNama.trim(),
        unitId: unitId || 'tipes',
      };

      if (editingItem) {
        await updateDoc(docRef, payload);
        showToast.success(`Regu ${formNama} berhasil diperbarui`);
      } else {
        await setDoc(docRef, payload);
        showToast.success(`Regu ${formNama} berhasil ditambahkan`);
      }
      setModalOpen(false);
    } catch (err: any) {
      showToast.error(err.message || 'Gagal menyimpan regu');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: RegupItem) => {
    const members = linmasList.filter((l) => l.regupId === item.nama);
    if (members.length > 0) {
      showToast.warning(`Tidak dapat menghapus regu yang masih memiliki ${members.length} anggota`);
      return;
    }

    if (!confirm(`Hapus ${item.nama}?`)) return;
    try {
      await deleteDoc(doc(db, 'regups', item.id));
      showToast.info(`Regu ${item.nama} telah dihapus`);
    } catch {
      showToast.error('Gagal menghapus regu');
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
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'bold' }}>🛡️ Pembagian Regu Satlinmas</h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Kelola satuan regu operasional patroli dan penugasan posko
          </p>
        </div>

        <button type="button" className="btn btn-primary btn-sm" onClick={handleOpenAdd}>
          ➕ Tambah Regu
        </button>
      </div>

      {/* GRID REGU */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {regupsList.map((regu) => {
          const members = linmasList.filter((l) => l.regupId === regu.nama);
          const activeMembers = members.filter((m) => m.aktif).length;

          return (
            <div key={regu.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold' }}>{regu.nama}</h4>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: '600',
                    background: 'var(--color-primary-light)',
                    color: 'var(--color-primary)',
                  }}
                >
                  {members.length} Personel
                </span>
              </div>

              <div
                style={{
                  background: 'var(--color-bg)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--space-3)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-muted)',
                }}
              >
                <div>Personel Aktif: <strong style={{ color: 'var(--color-success)' }}>{activeMembers}</strong></div>
                <div>Personel Nonaktif: <strong>{members.length - activeMembers}</strong></div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleOpenEdit(regu)}
                >
                  ✏️ Edit
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(regu)}
                >
                  🗑️ Hapus
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL EDIT / TAMBAH REGU */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit Nama Regu' : 'Tambah Regu Linmas Baru'}
        maxWidth="sm"
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label className="form-label">Nama Regu:</label>
            <input
              type="text"
              className="form-input"
              value={formNama}
              onChange={(e) => setFormNama(e.target.value)}
              placeholder="Contoh: Regu A / Regu B / Regu Patroli Khusus"
              required
            />
          </div>

          <div className="modal-footer" style={{ margin: 'var(--space-4) -24px -24px -24px' }}>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Simpan Regu
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
