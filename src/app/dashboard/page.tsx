'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/config';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  PresensiItem,
  LinmasItem,
  ShiftItem,
  RegupItem,
  JadwalItem,
  AlertItem,
} from '@/types';
import { showToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

// Komponen Tab Dashboard Modular
import { OverviewTab } from '@/components/dashboard/OverviewTab';
import { PresensiTab } from '@/components/dashboard/PresensiTab';
import { LeavesTab } from '@/components/dashboard/LeavesTab';
import { LinmasTab } from '@/components/dashboard/LinmasTab';
import { JadwalTab } from '@/components/dashboard/JadwalTab';
import { ShiftsTab } from '@/components/dashboard/ShiftsTab';
import { RegupsTab } from '@/components/dashboard/RegupsTab';
import { HonorariumTab } from '@/components/dashboard/HonorariumTab';
import { AlertsTab } from '@/components/dashboard/AlertsTab';
import { SettingsTab } from '@/components/dashboard/SettingsTab';

export type DashboardTabType =
  | 'overview'
  | 'presensi'
  | 'leaves'
  | 'linmas'
  | 'jadwal'
  | 'shifts'
  | 'regups'
  | 'honorarium'
  | 'alerts'
  | 'settings';

export default function DashboardPage() {
  const router = useRouter();
  const { user, role, unitId, loading: authLoading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<DashboardTabType>('overview');
  const [today, setToday] = useState<string>('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Data Collections State
  const [presensiList, setPresensiList] = useState<PresensiItem[]>([]);
  const [leavesList, setLeavesList] = useState<PresensiItem[]>([]);
  const [linmasList, setLinmasList] = useState<LinmasItem[]>([]);
  const [shiftsList, setShiftsList] = useState<ShiftItem[]>([]);
  const [regupsList, setRegupsList] = useState<RegupItem[]>([]);
  const [jadwalList, setJadwalList] = useState<JadwalItem[]>([]);
  const [alertsList, setAlertsList] = useState<AlertItem[]>([]);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [unitInfo, setUnitInfo] = useState<any>(null);

  // Set Today String
  useEffect(() => {
    const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
    setToday(wib.toISOString().split('T')[0]);
  }, []);

  // Auth Protection
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login/admin');
    }
  }, [user, authLoading, router]);

  // Load Unit & Settings
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const sSnap = await getDoc(doc(db, 'settings', 'general'));
        if (sSnap.exists()) {
          setSystemSettings(sSnap.data());
        }

        if (unitId) {
          const uSnap = await getDoc(doc(db, 'units', unitId));
          if (uSnap.exists()) {
            setUnitInfo(uSnap.data());
          }
        }
      } catch (err) {
        console.warn('Gagal memuat setting posko:', err);
      }
    };
    loadConfig();
  }, [unitId]);

  // Listeners Data Realtime Posko
  useEffect(() => {
    if (!today) return;

    // 1. Presensi Hari Ini
    const qPresensi = query(
      collection(db, 'presensi'),
      where('tanggal', '==', today)
    );
    const unsubPresensi = onSnapshot(qPresensi, (snap) => {
      const items: PresensiItem[] = [];
      const leaves: PresensiItem[] = [];
      snap.forEach((d) => {
        const data = { id: d.id, ...d.data() } as PresensiItem;
        items.push(data);
        if (data.status === 'izin' || data.status === 'sakit') {
          leaves.push(data);
        }
      });
      setPresensiList(items);
      setLeavesList(leaves);
    });

    // 2. Data Anggota Linmas
    const qLinmas = query(collection(db, 'linmas'));
    const unsubLinmas = onSnapshot(qLinmas, (snap) => {
      const items: LinmasItem[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, nik: d.id, ...d.data() } as unknown as LinmasItem);
      });
      setLinmasList(items);
    });

    // 3. Shift Operasional
    const qShifts = query(collection(db, 'shifts'));
    const unsubShifts = onSnapshot(qShifts, (snap) => {
      const items: ShiftItem[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as ShiftItem);
      });
      setShiftsList(items);
    });

    // 4. Regu
    const qRegups = query(collection(db, 'regups'));
    const unsubRegups = onSnapshot(qRegups, (snap) => {
      const items: RegupItem[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as RegupItem);
      });
      setRegupsList(items);
    });

    // 5. Jadwal Penugasan
    const qJadwal = query(collection(db, 'jadwal'));
    const unsubJadwal = onSnapshot(qJadwal, (snap) => {
      const items: JadwalItem[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as JadwalItem);
      });
      setJadwalList(items);
    });

    // 6. Alerts & Insiden Darurat
    const qAlerts = query(collection(db, 'alerts'));
    const unsubAlerts = onSnapshot(qAlerts, (snap) => {
      const items: AlertItem[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as AlertItem);
      });
      items.sort((a: any, b: any) => {
        const tA = a.createdAt?.toMillis?.() || 0;
        const tB = b.createdAt?.toMillis?.() || 0;
        return tB - tA;
      });
      setAlertsList(items);
    });

    return () => {
      unsubPresensi();
      unsubLinmas();
      unsubShifts();
      unsubRegups();
      unsubJadwal();
      unsubAlerts();
    };
  }, [today]);

  const handleLogout = async () => {
    try {
      await logout();
      document.cookie = 'session=; path=/; max-age=0';
      showToast.info('Anda telah keluar dari dashboard posko');
      router.push('/login/admin');
    } catch {
      showToast.error('Gagal keluar');
    }
  };

  if (authLoading || !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size="lg" text="Memuat Dashboard Posko Linmas..." />
      </div>
    );
  }

  // Active SOS alert count
  const activeAlertCount = alertsList.filter((a) => !a.resolved).length;
  const pendingLeavesCount = leavesList.filter(
    (l) => (l as any).approvalStatus === 'pending'
  ).length;

  const navTabs = [
    { id: 'overview', label: '📊 Ringkasan & Tren', badge: null },
    { id: 'presensi', label: '📋 Presensi Harian', badge: presensiList.length },
    { id: 'leaves', label: '📝 Izin & Sakit', badge: pendingLeavesCount || null },
    { id: 'linmas', label: '🦺 Data Anggota', badge: linmasList.length },
    { id: 'jadwal', label: '📅 Jadwal Tugas', badge: null },
    { id: 'shifts', label: '⏰ Shift Dinas', badge: null },
    { id: 'regups', label: '🛡️ Pembagian Regu', badge: null },
    { id: 'honorarium', label: '💰 Rekap Honor', badge: null },
    { id: 'alerts', label: '🚨 Pantauan Alerts', badge: activeAlertCount || null, alert: activeAlertCount > 0 },
    { id: 'settings', label: '⚙️ Pengaturan Posko', badge: null },
  ];

  const currentTabObj = navTabs.find((t) => t.id === activeTab);

  return (
    <div className="dashboard-layout">
      {/* SIDEBAR DASHBOARD DESKTOP */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #15803d 0%, #166534 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              flexShrink: 0,
            }}
          >
            🛡️
          </div>
          <div>
            <h2>SATLINMAS</h2>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              {unitInfo?.nama || 'Posko Wilayah'}
            </span>
          </div>
        </div>

        {/* SIDEBAR NAVIGATION ITEMS */}
        <nav className="sidebar-nav">
          {navTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id as DashboardTabType)}
            >
              <span>{tab.label}</span>
              {tab.badge !== null && tab.badge > 0 && (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    padding: '2px 7px',
                    borderRadius: '999px',
                    background: tab.alert ? 'var(--color-danger)' : 'rgba(255, 255, 255, 0.25)',
                    color: 'white',
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* USER INFO & LOGOUT */}
        <div className="sidebar-user">
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user.email}</span>
            <span className="sidebar-user-role">● Pengelola Posko</span>
          </div>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => setShowLogoutModal(true)}
            style={{ padding: '4px 8px', fontSize: '11px' }}
          >
            Keluar
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="dashboard-main">
        {/* TOPBAR */}
        <header className="dashboard-topbar">
          <div className="topbar-title">
            <h1>{currentTabObj?.label.replace(/^[^\w\s]+\s*/, '')}</h1>
            <p>
              Tanggal Hari Ini: <strong>{today}</strong> • Posko Unit: {unitInfo?.nama || 'Kelurahan Tipes'}
            </p>
          </div>

          <div className="topbar-actions">
            <span
              style={{
                fontSize: 'var(--text-xs)',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-success-light)',
                color: 'var(--color-success)',
                fontWeight: '600',
              }}
            >
              ● Sistem Siaga Operasional
            </span>
          </div>
        </header>

        {/* CONTENT TAB */}
        <main className="dashboard-content">
          {activeTab === 'overview' && (
            <OverviewTab
              presensiList={presensiList}
              linmasList={linmasList}
              alertsList={alertsList}
              shiftsList={shiftsList}
              today={today}
              onNavigateTab={(t) => setActiveTab(t)}
            />
          )}

          {activeTab === 'presensi' && (
            <PresensiTab
              presensiList={presensiList}
              shiftsList={shiftsList}
              regupsList={regupsList}
              today={today}
            />
          )}

          {activeTab === 'leaves' && (
            <LeavesTab leavesList={leavesList} today={today} />
          )}

          {activeTab === 'linmas' && (
            <LinmasTab
              linmasList={linmasList}
              regupsList={regupsList}
              unitId={unitId || undefined}
            />
          )}

          {activeTab === 'jadwal' && (
            <JadwalTab
              jadwalList={jadwalList}
              shiftsList={shiftsList}
              regupsList={regupsList}
              unitId={unitId || undefined}
              today={today}
            />
          )}

          {activeTab === 'shifts' && (
            <ShiftsTab shiftsList={shiftsList} unitId={unitId || undefined} />
          )}

          {activeTab === 'regups' && (
            <RegupsTab
              regupsList={regupsList}
              linmasList={linmasList}
              unitId={unitId || undefined}
            />
          )}

          {activeTab === 'honorarium' && (
            <HonorariumTab
              linmasList={linmasList}
              systemSettings={systemSettings}
              unitId={unitId || undefined}
            />
          )}

          {activeTab === 'alerts' && (
            <AlertsTab alertsList={alertsList} unitId={unitId || undefined} />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              systemSettings={systemSettings}
              unitId={unitId || undefined}
              onRefreshSettings={() => {
                getDoc(doc(db, 'settings', 'general')).then((s) => {
                  if (s.exists()) setSystemSettings(s.data());
                });
              }}
            />
          )}
        </main>
      </div>

      {/* MODAL KONFIRMASI LOGOUT */}
      <Modal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        title="Konfirmasi Keluar Dashboard"
        maxWidth="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowLogoutModal(false)}>
              Batal
            </Button>
            <Button variant="danger" onClick={handleLogout}>
              Ya, Keluar Akun
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 'var(--text-sm)' }}>
          Apakah Anda yakin ingin keluar dari sesi Dashboard Posko Satlinmas?
        </p>
      </Modal>
    </div>
  );
}
