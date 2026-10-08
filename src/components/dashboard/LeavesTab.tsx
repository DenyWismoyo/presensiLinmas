'use client';

import React, { useState, useMemo } from 'react';
import { PresensiItem } from '@/types';
import { LeaveStatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';
import { presensiService } from '@/lib/services/presensiService';
import { auth } from '@/lib/firebase/config';

interface LeavesTabProps {
  leavesList: PresensiItem[];
  today: string;
}

export function LeavesTab({ leavesList, today }: LeavesTabProps) {
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Modal Preview Surat
  const [previewSurat, setPreviewSurat] = useState<{
    url: string;
    nama: string;
    alasan: string;
  } | null>(null);

  // Modal Penolakan
  const [rejectItem, setRejectItem] = useState<PresensiItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const filteredList = useMemo(() => {
    return leavesList.filter((item) => {
      const matchSearch =
        item.nama?.toLowerCase().includes(search.toLowerCase()) ||
        item.nik?.includes(search);
      const appStatus = (item as any).approvalStatus || 'pending';
      const matchStatus =
        filterStatus === 'all' || appStatus === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [leavesList, search, filterStatus]);

  const totalPages = Math.ceil(filteredList.length / pageSize) || 1;
  const paginatedList = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, page, pageSize]);

  // Handle Approve
  const handleApprove = async (item: PresensiItem) => {
    if (!auth.currentUser) {
      showToast.error('Sesi login admin tidak valid');
      return;
    }
    setActionLoading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      await presensiService.approveLeave(item.id, token);
      showToast.success(`Izin untuk ${item.nama} berhasil disetujui`);
    } catch (err: any) {
      showToast.error(err.message || 'Gagal menyetujui izin');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Confirm Reject
  const handleConfirmReject = async () => {
    if (!rejectItem || !rejectReason.trim()) {
      showToast.warning('Silakan masukkan alasan penolakan');
      return;
    }
    if (!auth.currentUser) {
      showToast.error('Sesi login admin tidak valid');
      return;
    }
    setActionLoading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      await presensiService.rejectLeave(rejectItem.id, rejectReason.trim(), token);
      showToast.info(`Izin untuk ${rejectItem.nama} telah ditolak`);
      setRejectItem(null);
      setRejectReason('');
    } catch (err: any) {
      showToast.error(err.message || 'Gagal menolak izin');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* FILTER & SEARCH BAR */}
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
            placeholder="🔍 Cari nama atau NIK pemohon..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{ maxWidth: '280px' }}
          />

          <select
            className="form-select"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value as any);
              setPage(1);
            }}
            style={{ maxWidth: '180px' }}
          >
            <option value="all">Semua Status</option>
            <option value="pending">Menunggu Persetujuan</option>
            <option value="approved">Telah Disetujui</option>
            <option value="rejected">Ditolak</option>
          </select>
        </div>

        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          Total Pengajuan: <strong>{filteredList.length}</strong>
        </div>
      </div>

      {/* TABEL IZIN / SAKIT */}
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
                <th style={{ padding: '12px 16px' }}>Anggota Linmas</th>
                <th style={{ padding: '12px 16px' }}>Tipe</th>
                <th style={{ padding: '12px 16px' }}>Tanggal</th>
                <th style={{ padding: '12px 16px' }}>Alasan / Keterangan</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Surat Dokter</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Aksi Pimpinan</th>
              </tr>
            </thead>
            <tbody>
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                    <p style={{ fontSize: '24px' }}>📝</p>
                    <p style={{ fontWeight: '600' }}>Tidak ada pengajuan izin/sakit</p>
                  </td>
                </tr>
              ) : (
                paginatedList.map((item, idx) => {
                  const itemIndex = (page - 1) * pageSize + idx + 1;
                  const appStatus = (item as any).approvalStatus || 'pending';
                  const suratUrl =
                    (item as any).suratFotoUrl || (item as any).attachmentUrl;
                  const alasan = (item as any).reason || (item as any).keterangan || '-';

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        transition: 'background-color 150ms ease',
                      }}
                    >
                      <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)' }}>
                        {itemIndex}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: '600', color: 'var(--color-text)' }}>
                          {item.nama}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                          NIK: {item.nik}
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            color: item.status === 'sakit' ? 'var(--color-warning)' : 'var(--color-primary)',
                          }}
                        >
                          {item.status}
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px' }}>{item.tanggal}</td>

                      <td style={{ padding: '12px 16px', maxWidth: '240px' }}>
                        <p style={{ margin: 0, wordBreak: 'break-word' }}>{alasan}</p>
                        {appStatus === 'rejected' && (item as any).rejectionReason && (
                          <span
                            style={{
                              display: 'block',
                              fontSize: '11px',
                              color: 'var(--color-danger)',
                              marginTop: '2px',
                            }}
                          >
                            Catatan: {(item as any).rejectionReason}
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {suratUrl ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() =>
                              setPreviewSurat({
                                url: suratUrl,
                                nama: item.nama,
                                alasan,
                              })
                            }
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                          >
                            📄 Bukti
                          </button>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            Tidak ada
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <LeaveStatusBadge status={appStatus} />
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {appStatus === 'pending' ? (
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn btn-success btn-sm"
                              onClick={() => handleApprove(item)}
                              disabled={actionLoading}
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                            >
                              ✓ Setujui
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => {
                                setRejectItem(item);
                                setRejectReason('');
                              }}
                              disabled={actionLoading}
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                            >
                              ✕ Tolak
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            Selesai diproses
                          </span>
                        )}
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

      {/* MODAL PREVIEW SURAT DOKTER */}
      <Modal
        isOpen={Boolean(previewSurat)}
        onClose={() => setPreviewSurat(null)}
        title={`Bukti Surat: ${previewSurat?.nama || ''}`}
        maxWidth="md"
      >
        {previewSurat && (
          <div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
              Alasan pengajuan: <em>{previewSurat.alasan}</em>
            </p>
            <img src={previewSurat.url} alt="Surat Keterangan" className="photo-large" />
          </div>
        )}
      </Modal>

      {/* MODAL TOLAK IZIN */}
      <Modal
        isOpen={Boolean(rejectItem)}
        onClose={() => setRejectItem(null)}
        title="Tolak Permohonan Izin / Sakit"
        maxWidth="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectItem(null)}>
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmReject}
              loading={actionLoading}
            >
              Konfirmasi Tolak
            </Button>
          </>
        }
      >
        {rejectItem && (
          <div>
            <p style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
              Masukkan alasan penolakan izin untuk <strong>{rejectItem.nama}</strong>:
            </p>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Contoh: Jadwal patroli vital dan kekurangan personel regu..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
