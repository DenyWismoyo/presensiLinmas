'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { LinmasItem, PresensiItem, SettingsGeneral } from '@/types';
import { Spinner } from '@/components/ui/Spinner';
import { showToast } from '@/components/ui/Toast';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface HonorariumTabProps {
  linmasList: LinmasItem[];
  systemSettings: any;
  unitId?: string;
}

export function HonorariumTab({
  linmasList,
  systemSettings,
  unitId,
}: HonorariumTabProps) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [monthlyPresensi, setMonthlyPresensi] = useState<PresensiItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Ambil Tarif dari Settings
  const honorPerShift = systemSettings?.honorHadirPerShift || 75000;
  const potonganTerlambat = systemSettings?.potonganTerlambat || 10000;

  // Fetch data presensi bulanan
  useEffect(() => {
    fetchMonthlyData();
  }, [selectedMonth, selectedYear, unitId]);

  const fetchMonthlyData = async () => {
    setLoading(true);
    try {
      const monthStr = String(selectedMonth).padStart(2, '0');
      const startDay = `${selectedYear}-${monthStr}-01`;
      const endDay = `${selectedYear}-${monthStr}-31`;

      const q = query(
        collection(db, 'presensi'),
        where('tanggal', '>=', startDay),
        where('tanggal', '<=', endDay)
      );

      const snap = await getDocs(q);
      const items: PresensiItem[] = [];
      snap.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as PresensiItem);
      });
      setMonthlyPresensi(items);
    } catch (err: any) {
      console.error('Error fetching monthly honorarium data:', err);
      showToast.error('Gagal mengambil data presensi bulan ini');
    } finally {
      setLoading(false);
    }
  };

  // Kalkulasi Rekap per Anggota
  const honorSummary = useMemo(() => {
    return linmasList.map((linmas) => {
      const memberRecords = monthlyPresensi.filter((p) => p.nik === linmas.nik);
      const hadirTepat = memberRecords.filter((p) => p.status === 'hadir').length;
      const terlambat = memberRecords.filter((p) => p.status === 'terlambat').length;
      const totalHadir = hadirTepat + terlambat;

      const grossHonor = totalHadir * honorPerShift;
      const totalPotongan = terlambat * potonganTerlambat;
      const netHonor = Math.max(0, grossHonor - totalPotongan);

      return {
        nik: linmas.nik,
        nama: linmas.nama,
        jabatan: linmas.jabatan || 'Anggota',
        regup: linmas.regupId || '-',
        hadirTepat,
        terlambat,
        totalHadir,
        grossHonor,
        totalPotongan,
        netHonor,
      };
    });
  }, [linmasList, monthlyPresensi, honorPerShift, potonganTerlambat]);

  const totalPengeluaran = honorSummary.reduce((sum, item) => sum + item.netHonor, 0);
  const totalShiftAll = honorSummary.reduce((sum, item) => sum + item.totalHadir, 0);

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  // Export Excel
  const handleExportExcel = () => {
    const dataToExport = honorSummary.map((item, idx) => ({
      No: idx + 1,
      NIK: item.nik,
      'Nama Anggota': item.nama,
      Jabatan: item.jabatan,
      Regu: item.regup,
      'Hadir Tepat': item.hadirTepat,
      Terlambat: item.terlambat,
      'Total Shift': item.totalHadir,
      'Honor Kotor (Rp)': item.grossHonor,
      'Potongan (Rp)': item.totalPotongan,
      'Honor Bersih (Rp)': item.netHonor,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap_Honor');
    XLSX.writeFile(wb, `Rekap_Honorarium_Linmas_${monthNames[selectedMonth - 1]}_${selectedYear}.xlsx`);
  };

  // Export PDF Slip Tanda Terima
  const handleExportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(13);
    doc.text('DAFTAR PENERIMAAN HONORARIUM OPERASIONAL SATLINMAS', 14, 15);
    doc.setFontSize(10);
    doc.text(
      `Periode: ${monthNames[selectedMonth - 1]} ${selectedYear} | Tarif: Rp ${honorPerShift.toLocaleString('id-ID')}/shift`,
      14,
      22
    );

    const tableData = honorSummary.map((item, idx) => [
      idx + 1,
      item.nama,
      item.jabatan,
      item.regup,
      `${item.totalHadir} shift`,
      `Rp ${item.totalPotongan.toLocaleString('id-ID')}`,
      `Rp ${item.netHonor.toLocaleString('id-ID')}`,
      '...............',
    ]);

    autoTable(doc, {
      startY: 28,
      head: [['No', 'Nama Anggota', 'Jabatan', 'Regu', 'Total Shift', 'Potongan', 'Jumlah Diterima', 'Tanda Tangan']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [21, 128, 61] },
      styles: { fontSize: 8 },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 150;
    doc.setFontSize(9);
    doc.text(`Total Anggaran Honor: Rp ${totalPengeluaran.toLocaleString('id-ID')}`, 14, finalY + 10);
    doc.text('Mengetahui / Menyetujui,', 140, finalY + 18);
    doc.text('Kepala Satuan Posko Linmas', 140, finalY + 23);
    doc.text('( ......................................... )', 140, finalY + 45);

    doc.save(`Honorarium_Linmas_${monthNames[selectedMonth - 1]}_${selectedYear}.pdf`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* ACTION & PERIOD SELECTOR */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'bold' }}>🗓️ Periode Rekap:</span>
          <select
            className="form-select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            style={{ width: '130px' }}
          >
            {monthNames.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>

          <select
            className="form-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={{ width: '90px' }}
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchMonthlyData}
            title="Refresh data periode"
          >
            🔄 Muat Ulang
          </button>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportExcel}
          >
            📊 Export Excel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleExportPdf}
          >
            📄 Cetak Slip PDF
          </button>
        </div>
      </div>

      {/* SUMMARY STATS CARD */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-3)',
        }}
      >
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Total Estimasi Honorarium
          </div>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', color: 'var(--color-success)' }}>
            Rp {totalPengeluaran.toLocaleString('id-ID')}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            Periode {monthNames[selectedMonth - 1]} {selectedYear}
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Total Akumulasi Shift
          </div>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', color: 'var(--color-primary)' }}>
            {totalShiftAll} Shift
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            Tarif: Rp {honorPerShift.toLocaleString('id-ID')} / shift
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Potongan Keterlambatan
          </div>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', color: 'var(--color-warning)' }}>
            Rp {potonganTerlambat.toLocaleString('id-ID')}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            Per insiden keterlambatan
          </div>
        </div>
      </div>

      {/* TABEL REKAP HONORARIUM */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
        {loading ? (
          <Spinner text="Menghitung rekapitulasi honorarium..." />
        ) : (
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
                  <th style={{ padding: '12px 16px' }}>Jabatan</th>
                  <th style={{ padding: '12px 16px' }}>Regu</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Hadir Tepat</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Terlambat</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Total Shift</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Honor Bersih</th>
                </tr>
              </thead>
              <tbody>
                {honorSummary.map((item, idx) => (
                  <tr
                    key={item.nik}
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      transition: 'background-color 150ms ease',
                    }}
                  >
                    <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)' }}>
                      {idx + 1}
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: '600', color: 'var(--color-text)' }}>
                        {item.nama}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                        NIK: {item.nik}
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px' }}>{item.jabatan}</td>
                    <td style={{ padding: '12px 16px' }}>{item.regup}</td>

                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--color-success)', fontWeight: 'bold' }}>
                      {item.hadirTepat}
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--color-warning)' }}>
                      {item.terlambat}
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold' }}>
                      {item.totalHadir}
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 'bold', color: 'var(--color-success)' }}>
                      Rp {item.netHonor.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
