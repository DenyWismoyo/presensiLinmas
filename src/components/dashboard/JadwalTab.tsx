'use client';

import React, { useState, useMemo } from 'react';
import { JadwalItem, ShiftItem, RegupItem } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';
import { db } from '@/lib/firebase/config';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

interface JadwalTabProps {
  jadwalList: JadwalItem[];
  shiftsList: ShiftItem[];
  regupsList: RegupItem[];
  unitId?: string;
  today: string;
}

export function JadwalTab({
  jadwalList,
  shiftsList,
  regupsList,
  unitId,
  today,
}: JadwalTabProps) {
  const [filterRegu, setFilterRegu] = useState('all');
  const [filterTanggal, setFilterTanggal] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Modal State Single
  const [modalOpen, setModalOpen] = useState(false);
  const [formTanggal, setFormTanggal] = useState(today);
  const [formRegu, setFormRegu] = useState(regupsList[0]?.nama || 'Regu A');
  const [formShift, setFormShift] = useState(shiftsList[0]?.nama || 'Pagi');
  const [submitting, setSubmitting] = useState(false);

  // Modal Bulk Range
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkStartDate, setBulkStartDate] = useState(today);
  const [bulkEndDate, setBulkEndDate] = useState(today);
  const [bulkRegu, setBulkRegu] = useState(regupsList[0]?.nama || 'Regu A');
  const [bulkShift, setBulkShift] = useState(shiftsList[0]?.nama || 'Pagi');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Filter Data
  const filteredList = useMemo(() => {
    return jadwalList
      .filter((item) => {
        const matchRegu = filterRegu === 'all' || item.regupId === filterRegu;
        const matchTanggal = !filterTanggal || item.tanggal === filterTanggal;
        return matchRegu && matchTanggal;
      })
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  }, [jadwalList, filterRegu, filterTanggal]);

  const totalPages = Math.ceil(filteredList.length / pageSize) || 1;
  const paginatedList = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, page, pageSize]);

  // Simpan Jadwal Tunggal
  const handleSaveSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTanggal) {
      showToast.warning('Pilih tanggal penugasan');
      return;
    }

    setSubmitting(true);
    try {
      const docId = `jadwal_${formTanggal}_${formRegu.replace(/\s+/g, '_')}`;
      await setDoc(doc(db, 'jadwal', docId), {
        tanggal: formTanggal,
        regupId: formRegu,
        shiftId: formShift,
        unitId: unitId || 'tipes',
        createdAt: serverTimestamp(),
      });

      showToast.success(`Jadwal ${formRegu} tanggal ${formTanggal} berhasil disimpan`);
      setModalOpen(false);
    } catch (err: any) {
      showToast.error(err.message || 'Gagal menyimpan jadwal');
    } finally {
      setSubmitting(false);
    }
  };

  // Simpan Jadwal Bulk Range
  const handleSaveBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkStartDate || !bulkEndDate) {
      showToast.warning('Pilih rentang tanggal mulai dan selesai');
      return;
    }

    const start = new Date(bulkStartDate);
    const end = new Date(bulkEndDate);

    if (start > end) {
      showToast.warning('Tanggal mulai tidak boleh melebihi tanggal selesai');
      return;
    }

    setBulkSubmitting(true);
    try {
      const cur = new Date(start);
      let count = 0;

      while (cur <= end) {
        const dateStr = cur.toISOString().split('T')[0];
        const docId = `jadwal_${dateStr}_${bulkRegu.replace(/\s+/g, '_')}`;

        await setDoc(doc(db, 'jadwal', docId), {
          tanggal: dateStr,
          regupId: bulkRegu,
          shiftId: bulkShift,
          unitId: unitId || 'tipes',
          createdAt: serverTimestamp(),
        });

        count++;
        cur.setDate(cur.getDate() + 1);
      }

      showToast.success(`Berhasil membuat jadwal massal untuk ${count} hari!`);
      setBulkModalOpen(false);
    } catch (err: any) {
      showToast.error(err.message || 'Gagal membuat jadwal massal');
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Hapus Jadwal
  const handleDelete = async (id: string, tanggal: string, regu: string) => {
    if (!confirm(`Hapus jadwal untuk ${regu} pada tanggal ${tanggal}?`)) return;

    try {
      await deleteDoc(doc(db, 'jadwal', id));
      showToast.info('Jadwal berhasil dihapus');
    } catch (err) {
      showToast.error('Gagal menghapus jadwal');
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Filter Tanggal:
            </span>
            <input
              type="date"
              className="form-input"
              value={filterTanggal}
              onChange={(e) => {
                setFilterTanggal(e.target.value);
                setPage(1);
              }}
              style={{ maxWidth: '170px' }}
            />
            {filterTanggal && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setFilterTanggal('')}
                style={{ padding: '4px 8px', fontSize: '11px' }}
              >
                Reset
              </button>
            )}
          </div>

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

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setBulkModalOpen(true)}
          >
            ⚡ Jadwal Massal (Range)
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setModalOpen(true)}
          >
            ➕ Tambah Jadwal
          </button>
        </div>
      </div>

      {/* TABEL JADWAL */}
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
                <th style={{ padding: '12px 16px' }}>Tanggal Tugas</th>
                <th style={{ padding: '12px 16px' }}>Regu Piket</th>
                <th style={{ padding: '12px 16px' }}>Shift Dinas</th>
                <th style={{ padding: '12px 16px' }}>Status Penugasan</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                    <p style={{ fontSize: '24px' }}>📅</p>
                    <p style={{ fontWeight: '600' }}>Tidak ada jadwal penugasan yang sesuai</p>
                  </td>
                </tr>
              ) : (
                paginatedList.map((item, idx) => {
                  const itemIndex = (page - 1) * pageSize + idx + 1;
                  const isToday = item.tanggal === today;

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        background: isToday ? 'rgba(21, 128, 61, 0.04)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)' }}>
                        {itemIndex}
                      </td>

                      <td style={{ padding: '12px 16px', fontWeight: '600' }}>
                        🗓️ {item.tanggal}{' '}
                        {isToday && (
                          <span
                            style={{
                              marginLeft: '6px',
                              padding: '2px 6px',
                              borderRadius: '999px',
                              background: 'var(--color-success-light)',
                              color: 'var(--color-success)',
                              fontSize: '10px',
                            }}
                          >
                            HARI INI
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>
                        {item.regupId}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'var(--color-bg)' }}>
                          ⏰ {item.shiftId}
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>Tercatat Terjadwal</span>
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(item.id, item.tanggal, item.regupId)}
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                        >
                          🗑️ Hapus
                        </button>
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

      {/* MODAL INPUT JADWAL TUNGGAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Tambah Jadwal Penugasan Regu"
        maxWidth="sm"
      >
        <form onSubmit={handleSaveSingle} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label className="form-label">Tanggal Penugasan:</label>
            <input
              type="date"
              className="form-input"
              value={formTanggal}
              onChange={(e) => setFormTanggal(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="form-label">Regu yang Bertugas:</label>
            <select
              className="form-select"
              value={formRegu}
              onChange={(e) => setFormRegu(e.target.value)}
            >
              {regupsList.map((r) => (
                <option key={r.id} value={r.nama}>
                  {r.nama}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Shift Dinas:</label>
            <select
              className="form-select"
              value={formShift}
              onChange={(e) => setFormShift(e.target.value)}
            >
              {shiftsList.map((s) => (
                <option key={s.id} value={s.nama}>
                  {s.nama} ({s.jamMasuk} - {s.jamKeluar})
                </option>
              ))}
            </select>
          </div>

          <div className="modal-footer" style={{ margin: 'var(--space-4) -24px -24px -24px' }}>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Simpan Jadwal
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL JADWAL BULK (RENTANG TANGGAL) */}
      <Modal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title="⚡ Penjadwalan Massal (Rentang Hari)"
        maxWidth="md"
      >
        <form onSubmit={handleSaveBulk} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Fitur ini secara otomatis membuat penugasan regu pada seluruh tanggal dalam rentang yang Anda tentukan.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label className="form-label">Dari Tanggal Mulai:</label>
              <input
                type="date"
                className="form-input"
                value={bulkStartDate}
                onChange={(e) => setBulkStartDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="form-label">Sampai Tanggal Selesai:</label>
              <input
                type="date"
                className="form-input"
                value={bulkEndDate}
                onChange={(e) => setBulkEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label className="form-label">Regu yang Bertugas:</label>
              <select
                className="form-select"
                value={bulkRegu}
                onChange={(e) => setBulkRegu(e.target.value)}
              >
                {regupsList.map((r) => (
                  <option key={r.id} value={r.nama}>
                    {r.nama}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Shift Dinas:</label>
              <select
                className="form-select"
                value={bulkShift}
                onChange={(e) => setBulkShift(e.target.value)}
              >
                {shiftsList.map((s) => (
                  <option key={s.id} value={s.nama}>
                    {s.nama} ({s.jamMasuk} - {s.jamKeluar})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal-footer" style={{ margin: 'var(--space-4) -24px -24px -24px' }}>
            <Button variant="secondary" type="button" onClick={() => setBulkModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" type="submit" loading={bulkSubmitting}>
              Generate Jadwal Massal
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
