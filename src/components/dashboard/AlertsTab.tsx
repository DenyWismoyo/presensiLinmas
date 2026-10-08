'use client';

import React, { useState, useMemo } from 'react';
import { AlertItem } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { showToast } from '@/components/ui/Toast';
import { db } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface AlertsTabProps {
  alertsList: AlertItem[];
  unitId?: string;
}

export function AlertsTab({ alertsList, unitId }: AlertsTabProps) {
  const [filterType, setFilterType] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Filter
  const filteredList = useMemo(() => {
    return alertsList.filter((item) => {
      if (filterType === 'sos') {
        return item.type === 'PANIC_SOS' || item.type === 'SOS_EMERGENCY' as any;
      }
      if (filterType === 'device') {
        return item.type === 'NEW_DEVICE';
      }
      if (filterType === 'unresolved') {
        return !item.resolved;
      }
      return true;
    });
  }, [alertsList, filterType]);

  const totalPages = Math.ceil(filteredList.length / pageSize) || 1;
  const paginatedList = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, page, pageSize]);

  // Selesaikan alert
  const handleResolve = async (item: AlertItem) => {
    try {
      await updateDoc(doc(db, 'alerts', item.id), {
        resolved: true,
        resolvedAt: serverTimestamp(),
      });
      showToast.success('Alert darurat telah ditandai selesai ditangani');
    } catch {
      showToast.error('Gagal memperbarui status alert');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* FILTER BAR */}
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
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {[
            { id: 'all', label: 'Semua Alerts' },
            { id: 'unresolved', label: '🚨 Belum Ditangani' },
            { id: 'sos', label: '🆘 Sinyal SOS Darurat' },
            { id: 'device', label: '📱 Deteksi HP Baru' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`btn btn-sm ${filterType === tab.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setFilterType(tab.id);
                setPage(1);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          Total Alert: <strong>{filteredList.length}</strong>
        </span>
      </div>

      {/* LIST ALERTS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {paginatedList.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
            <p style={{ fontSize: '28px' }}>🛡️</p>
            <p style={{ fontWeight: '600' }}>Situasi Aman & Terkendali</p>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Tidak ada notifikasi insiden darurat atau peringatan keamanan pada filter ini.
            </p>
          </div>
        ) : (
          paginatedList.map((item) => {
            const isSos = item.type === 'PANIC_SOS' || item.type === 'SOS_EMERGENCY' as any;
            const isResolved = item.resolved ?? false;

            return (
              <div
                key={item.id}
                className="card"
                style={{
                  borderLeft: `4px solid ${
                    isSos ? (isResolved ? 'var(--color-border)' : 'var(--color-danger)') : 'var(--color-warning)'
                  }`,
                  background: isResolved ? 'var(--color-surface)' : isSos ? '#fff5f5' : 'var(--color-surface)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 'var(--space-2)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ fontSize: '22px' }}>{isSos ? '🚨' : '📱'}</span>
                    <div>
                      <h4 style={{ fontWeight: 'bold', fontSize: 'var(--text-sm)', color: isSos && !isResolved ? 'var(--color-danger)' : 'var(--color-text)' }}>
                        {isSos ? `DARURAT: ${item.incidentType?.toUpperCase() || 'INSIDEN LAPANGAN'}` : 'PERINGATAN PERANGKAT BARU'}
                      </h4>
                      <p style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        Pelapor: <strong>{item.nama}</strong> (NIK: {item.nik})
                      </p>
                    </div>
                  </div>

                  <div>
                    {isResolved ? (
                      <Badge variant="success">✓ Selesai Ditangani</Badge>
                    ) : (
                      <Badge variant={isSos ? 'danger' : 'warning'}>
                        {isSos ? '⚠️ Butuh Penanganan' : 'Tercatat'}
                      </Badge>
                    )}
                  </div>
                </div>

                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text)', marginBottom: 'var(--space-3)' }}>
                  {item.message}
                </p>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid var(--color-border)',
                    paddingTop: 'var(--space-2)',
                    fontSize: '11px',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  <div>
                    {item.lokasi && (
                      <a
                        href={`https://www.google.com/maps?q=${
                          item.lokasi.lat ?? (item.lokasi as any).latitude
                        },${
                          item.lokasi.lng ?? (item.lokasi as any).longitude
                        }`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--color-primary)', fontWeight: '600', textDecoration: 'underline' }}
                      >
                        📍 Buka Peta Lokasi Insiden →
                      </a>
                    )}
                  </div>

                  {!isResolved && (
                    <button
                      type="button"
                      className="btn btn-success btn-sm"
                      onClick={() => handleResolve(item)}
                      style={{ padding: '3px 8px', fontSize: '11px' }}
                    >
                      ✓ Tandai Ditangani
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="table-pagination" style={{ borderRadius: 'var(--radius-lg)' }}>
          <span>Halaman {page} dari {totalPages}</span>
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
      )}
    </div>
  );
}
