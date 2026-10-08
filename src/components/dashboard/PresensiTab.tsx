'use client';

import React, { useState, useMemo } from 'react';
import { PresensiItem, ShiftItem, RegupItem } from '@/types';
import { PresensiStatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PresensiTabProps {
  presensiList: PresensiItem[];
  shiftsList: ShiftItem[];
  regupsList: RegupItem[];
  today: string;
}

export function PresensiTab({
  presensiList,
  shiftsList,
  regupsList,
  today,
}: PresensiTabProps) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRegu, setFilterRegu] = useState<string>('all');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [selectedPhoto, setSelectedPhoto] = useState<{
    url: string;
    title: string;
    subtitle: string;
  } | null>(null);

  // Filter Data
  const filteredList = useMemo(() => {
    return presensiList.filter((item) => {
      const matchSearch =
        item.nama?.toLowerCase().includes(search.toLowerCase()) ||
        item.nik?.includes(search);
      const matchStatus =
        filterStatus === 'all' || item.status === filterStatus;
      const matchRegu =
        filterRegu === 'all' || item.regupId === filterRegu;
      return matchSearch && matchStatus && matchRegu;
    });
  }, [presensiList, search, filterStatus, filterRegu]);

  // Pagination Slice
  const totalPages = Math.ceil(filteredList.length / pageSize) || 1;
  const paginatedList = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, page, pageSize]);

  // Export Excel
  const handleExportExcel = () => {
    const dataToExport = filteredList.map((p, idx) => ({
      No: idx + 1,
      NIK: p.nik,
      Nama: p.nama,
      Tanggal: p.tanggal,
      Shift: p.shiftId || '-',
      Regu: p.regupId || '-',
      Status: p.status.toUpperCase(),
      'Jam Masuk': p.jamMasuk || (p as any).waktuMasuk ? formatTime((p as any).waktuMasuk) : '-',
      'Jam Keluar': p.jamKeluar || (p as any).waktuKeluar ? formatTime((p as any).waktuKeluar) : '-',
      'Jarak (m)': p.lokasiMasuk?.jarakMeter ?? (p as any).distanceFromSite ?? '-',
      Terlambat: (p as any).isLate ? `${(p as any).lateMinutes || 0} Menit` : 'Tepat Waktu',
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Presensi_Linmas');
    XLSX.writeFile(wb, `Rekap_Presensi_Linmas_${today}.xlsx`);
  };

  // Export PDF Resmi
  const handleExportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('DAFTAR HADIR SATUAN PERLINDUNGAN MASYARAKAT (SATLINMAS)', 14, 15);
    doc.setFontSize(10);
    doc.text(`Tanggal Rekap: ${today} | Waktu Cetak: ${new Date().toLocaleTimeString('id-ID')}`, 14, 22);

    const tableData = filteredList.map((p, idx) => [
      idx + 1,
      p.nik,
      p.nama,
      p.regupId || '-',
      p.status.toUpperCase(),
      p.jamMasuk || ((p as any).waktuMasuk ? formatTime((p as any).waktuMasuk) : '-'),
      p.jamKeluar || ((p as any).waktuKeluar ? formatTime((p as any).waktuKeluar) : '-'),
      p.lokasiMasuk?.jarakMeter ?? (p as any).distanceFromSite ? `${p.lokasiMasuk?.jarakMeter ?? (p as any).distanceFromSite}m` : '-',
    ]);

    autoTable(doc, {
      startY: 28,
      head: [['No', 'NIK', 'Nama Anggota', 'Regu', 'Status', 'Masuk', 'Keluar', 'Jarak Posko']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [21, 128, 61] },
      styles: { fontSize: 8 },
    });

    doc.save(`Presensi_Linmas_${today}.pdf`);
  };

  const formatTime = (ts: any) => {
    if (!ts) return '-';
    if (typeof ts === 'string') return ts;
    if (ts.toDate) {
      return ts.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
    return '-';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* ACTION BAR: SEARCH, FILTER & EXPORT */}
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
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
            style={{ maxWidth: '170px' }}
          >
            <option value="all">Semua Status</option>
            <option value="hadir">Hadir Tepat Waktu</option>
            <option value="terlambat">Terlambat</option>
            <option value="izin">Izin</option>
            <option value="sakit">Sakit</option>
          </select>

          <select
            className="form-select"
            value={filterRegu}
            onChange={(e) => {
              setFilterRegu(e.target.value);
              setPage(1);
            }}
            style={{ maxWidth: '150px' }}
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
            onClick={handleExportExcel}
            title="Download Spreadsheet Excel"
          >
            📊 Export Excel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleExportPdf}
            title="Cetak Format Dokumen PDF"
          >
            📄 Cetak PDF
          </button>
        </div>
      </div>

      {/* TABEL PRESENSI */}
      <div
        className="card"
        style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--color-border)' }}
      >
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
                <th style={{ padding: '12px 16px' }}>Regu & Shift</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Jam Masuk</th>
                <th style={{ padding: '12px 16px' }}>Jam Keluar</th>
                <th style={{ padding: '12px 16px' }}>Jarak Posko</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Foto Selfie</th>
              </tr>
            </thead>
            <tbody>
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                    <p style={{ fontSize: '24px' }}>📋</p>
                    <p style={{ fontWeight: '600' }}>Tidak ada data presensi yang sesuai</p>
                  </td>
                </tr>
              ) : (
                paginatedList.map((item, idx) => {
                  const itemIndex = (page - 1) * pageSize + idx + 1;
                  const distanceM =
                    item.lokasiMasuk?.jarakMeter ?? (item as any).distanceFromSite;
                  const fotoMasukUrl =
                    item.fotoMasukUrl || (item as any).fotoMasuk;
                  const fotoKeluarUrl =
                    item.fotoKeluarUrl || (item as any).fotoKeluar;

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
                        <div>{item.regupId || '-'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          {item.shiftId || 'Shift Reguler'}
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <PresensiStatusBadge status={item.status} />
                        {(item as any).isLate && (item as any).lateMinutes && (
                          <span
                            style={{
                              display: 'block',
                              fontSize: '11px',
                              color: 'var(--color-warning)',
                              marginTop: '2px',
                            }}
                          >
                            +{(item as any).lateMinutes} mnt
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        {item.jamMasuk || formatTime((item as any).waktuMasuk)}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        {item.jamKeluar || formatTime((item as any).waktuKeluar)}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        {distanceM !== undefined ? (
                          <span
                            style={{
                              fontWeight: '600',
                              color: distanceM <= 100 ? 'var(--color-success)' : 'var(--color-warning)',
                            }}
                          >
                            📍 {distanceM}m
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'center' }}>
                          {fotoMasukUrl ? (
                            <img
                              src={fotoMasukUrl}
                              alt="Foto Masuk"
                              className="photo-thumb"
                              onClick={() =>
                                setSelectedPhoto({
                                  url: fotoMasukUrl,
                                  title: `Foto Masuk: ${item.nama}`,
                                  subtitle: `Presensi Masuk • NIK ${item.nik}`,
                                })
                              }
                              title="Klik untuk perbesar foto masuk"
                            />
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>-</span>
                          )}

                          {fotoKeluarUrl && (
                            <img
                              src={fotoKeluarUrl}
                              alt="Foto Keluar"
                              className="photo-thumb"
                              onClick={() =>
                                setSelectedPhoto({
                                  url: fotoKeluarUrl,
                                  title: `Foto Selesai: ${item.nama}`,
                                  subtitle: `Presensi Keluar • NIK ${item.nik}`,
                                })
                              }
                              title="Klik untuk perbesar foto keluar"
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION CONTROLS */}
        <div className="table-pagination">
          <span>
            Menampilkan{' '}
            <strong>
              {filteredList.length === 0 ? 0 : (page - 1) * pageSize + 1} -{' '}
              {Math.min(page * pageSize, filteredList.length)}
            </strong>{' '}
            dari <strong>{filteredList.length}</strong> data presensi
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
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: '600', margin: '0 4px' }}>
              Halaman {page} / {totalPages}
            </span>
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

      {/* MODAL FOTO BESAR */}
      <Modal
        isOpen={Boolean(selectedPhoto)}
        onClose={() => setSelectedPhoto(null)}
        title={selectedPhoto?.title || 'Foto Bukti Presensi'}
        maxWidth="md"
      >
        {selectedPhoto && (
          <div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
              {selectedPhoto.subtitle}
            </p>
            <img src={selectedPhoto.url} alt="Selfie Bukti" className="photo-large" />
          </div>
        )}
      </Modal>
    </div>
  );
}
