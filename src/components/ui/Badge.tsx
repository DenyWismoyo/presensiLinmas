'use client';

import React from 'react';

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'primary';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  icon?: React.ReactNode;
  className?: string;
}

export function Badge({
  children,
  variant = 'neutral',
  icon,
  className = '',
}: BadgeProps) {
  return (
    <span className={`badge badge-${variant} ${className}`.trim()}>
      {icon && <span className="badge-icon">{icon}</span>}
      {children}
    </span>
  );
}

// Preset Helper Badge untuk Status Presensi
export function PresensiStatusBadge({ status }: { status: string }) {
  switch (status?.toLowerCase()) {
    case 'hadir':
      return <Badge variant="success">✅ Hadir Tepat Waktu</Badge>;
    case 'terlambat':
      return <Badge variant="warning">⚠️ Terlambat</Badge>;
    case 'izin':
      return <Badge variant="info">📝 Izin</Badge>;
    case 'sakit':
      return <Badge variant="warning">🏥 Sakit</Badge>;
    case 'alpa':
      return <Badge variant="danger">❌ Alpa</Badge>;
    default:
      return <Badge variant="neutral">{status || '-'}</Badge>;
  }
}

// Preset Helper Badge untuk Status Cuti/Izin
export function LeaveStatusBadge({ status }: { status: string }) {
  switch (status?.toLowerCase()) {
    case 'approved':
      return <Badge variant="success">✅ Disetujui</Badge>;
    case 'rejected':
      return <Badge variant="danger">❌ Ditolak</Badge>;
    case 'pending':
    default:
      return <Badge variant="warning">⏳ Menunggu</Badge>;
  }
}
