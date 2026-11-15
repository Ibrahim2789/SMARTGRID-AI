import React, { useState } from 'react';
import { SmartGridNav, RouteType } from './SmartGridNav';
import {
  Building,
  Clock,
  CheckCircle2,
  RefreshCw,
  Sliders,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import { showAppPopup } from './ToastPopupHost';

interface InstitutionalPortalProps {
  onNavigate?: (route: RouteType) => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
  onSignOut?: () => void;
  currentUser: { name: string; role: string; email: string; institution?: string } | null;
  onSwitchUser: (user: { name: string; role: string; email: string; institution?: string } | null) => void;
  hideNav?: boolean;
}

export const InstitutionalPortal: React.FC<InstitutionalPortalProps> = ({ 
  onNavigate,
  onOpenAuth,
  onSignOut,
  currentUser,
  hideNav = false
}) => {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced'>('idle');

  const activeUser = currentUser || {
    name: 'Dr. Katherine Reynolds',
    role: 'Chief University Registrar',
    email: 'k.reynolds@westernpoly.edu',
    institution: 'Western Polytechnic Institute'
  };

  const handleSyncLMS = () => {
    setSyncStatus('syncing');
    setTimeout(() => {
      setSyncStatus('synced');
      showAppPopup({
        title: 'SIS / LMS Synced',
        message: 'Institutional schedule records synchronized with SIS & LMS endpoints.',
        variant: 'success'
      });
      setTimeout(() => setSyncStatus('idle'), 3000);
    }, 1000);
  };

  const handleExport = (format: string) => {
    showAppPopup({
      title: 'Snapshot Exported',
      message: `Exported ${format} snapshot for SIS/LMS distribution.`,
      variant: 'success'
    });
  };

  return (
    <div className="min-h-screen bg-app text-primary antialiased">
      {!hideNav && (
        <SmartGridNav 
          activeRoute="portal" 
          onNavigate={onNavigate} 
          onOpenAuth={onOpenAuth}
          onSignOut={onSignOut}
          currentUser={currentUser}
        />
      )}

      <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Plain Human Page Header: Title + Subtitle + Action (No banner card) */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-border">
          <div>
            <div className="text-[13px] text-secondary font-medium mb-1">
              {activeUser.name} • {activeUser.role} • {activeUser.institution || 'Western Polytechnic'}
            </div>
            <h1 className="text-[30px] font-semibold text-primary tracking-tight leading-none">Overview</h1>
            <p className="text-[15px] text-secondary mt-1.5">
              Active academic term state, SIS synchronization, and compliance audit
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncLMS}
              disabled={syncStatus === 'syncing'}
              className="h-10 px-4 rounded-md border border-border bg-surface hover:bg-subtle text-primary text-[14px] font-medium flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 text-secondary ${syncStatus === 'syncing' ? 'animate-spin text-brand' : ''}`} />
              <span>{syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'synced' ? 'SIS synced' : 'Sync SIS / LMS'}</span>
            </button>

            <button
              onClick={() => onNavigate?.('generator')}
              className="h-10 px-4 rounded-md bg-brand hover:bg-brand-hover text-white text-[14px] font-medium flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Sliders className="w-4 h-4" />
              <span>New solve run</span>
            </button>
          </div>
        </div>

        {/* Unified Stat Strip with Dividers & Comparisons (vs last term) */}
        <section className="bg-surface border border-border rounded-lg grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border">
          <div className="p-5 sm:p-6 space-y-1">
            <div className="text-[14px] text-secondary font-medium">Enrolled students</div>
            <div className="text-[34px] font-semibold text-primary tracking-tight tabular-nums">
              34,180
            </div>
            <div className="text-[13px] text-secondary">+4.2% vs last term (12 schools)</div>
          </div>

          <div className="p-5 sm:p-6 space-y-1">
            <div className="text-[14px] text-secondary font-medium">Scheduled sections</div>
            <div className="text-[34px] font-semibold text-primary tracking-tight tabular-nums">
              1,420
            </div>
            <div className="text-[13px] text-success font-medium">0 clashes vs 14 last term</div>
          </div>

          <div className="p-5 sm:p-6 space-y-1">
            <div className="text-[14px] text-secondary font-medium">Facility utilization</div>
            <div className="text-[34px] font-semibold text-primary tracking-tight tabular-nums">
              98.2%
            </div>
            <div className="text-[13px] text-secondary">+6.1% vs last term (114 rooms)</div>
          </div>

          <div className="p-5 sm:p-6 space-y-1">
            <div className="text-[14px] text-secondary font-medium">Solver score</div>
            <div className="text-[34px] font-semibold text-primary tracking-tight tabular-nums">
              99.88%
            </div>
            <div className="text-[13px] text-success font-medium">Deterministic parity verified</div>
          </div>
        </section>

        {/* Varied Layout: Wide Table (LMS/SIS) + Narrow Side Panel (Title IV Audit & Shortcuts) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Wide Table: SIS & LMS Ecosystem Connectors */}
          <section className="lg:col-span-8 bg-surface border border-border rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-semibold text-primary">SIS and LMS synchronization</h2>
                <p className="text-[13px] text-secondary mt-0.5">Automated student roster, section numbering, and door access feeds</p>
              </div>
              <span className="text-[13px] font-mono text-secondary">REST API v2.4</span>
            </div>

            <div className="divide-y divide-border">
              <div className="p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[15px] font-medium text-primary">Ellucian Banner SIS</span>
                    <span className="px-2 py-0.5 rounded text-[13px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-success border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Live sync
                    </span>
                  </div>
                  <p className="text-[14px] text-secondary">
                    Course sections, CRNs, instructor IDs, and prerequisite chains synchronized every 15 minutes.
                  </p>
                </div>
                <button 
                  onClick={() => handleExport('Banner XML')}
                  className="h-9 px-3.5 rounded-md border border-border bg-surface hover:bg-subtle text-[14px] font-medium text-primary transition-colors cursor-pointer shrink-0"
                >
                  Export Banner XML
                </button>
              </div>

              <div className="p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[15px] font-medium text-primary">Canvas LMS</span>
                    <span className="px-2 py-0.5 rounded text-[13px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-success border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Published
                    </span>
                  </div>
                  <p className="text-[14px] text-secondary">
                    1,420 course shells created with automated student enrollment rosters.
                  </p>
                </div>
                <button 
                  onClick={() => handleExport('Canvas CSV')}
                  className="h-9 px-3.5 rounded-md border border-border bg-surface hover:bg-subtle text-[14px] font-medium text-primary transition-colors cursor-pointer shrink-0"
                >
                  Export Canvas CSV
                </button>
              </div>

              <div className="p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[15px] font-medium text-primary">Campus electronic door access</span>
                    <span className="px-2 py-0.5 rounded text-[13px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-success border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Armed
                    </span>
                  </div>
                  <p className="text-[14px] text-secondary">
                    RFID locks configured to unlock 15 minutes prior to scheduled laboratory and lecture hours.
                  </p>
                </div>
                <button 
                  onClick={() => handleExport('Security JSON')}
                  className="h-9 px-3.5 rounded-md border border-border bg-surface hover:bg-subtle text-[14px] font-medium text-primary transition-colors cursor-pointer shrink-0"
                >
                  Export security roster
                </button>
              </div>
            </div>
          </section>

          {/* Narrow Side Column: Title IV Audit & Quick Navigation */}
          <div className="lg:col-span-4 space-y-6">
            {/* Accreditation Audit Card */}
            <section className="bg-surface border border-border rounded-lg p-5 space-y-4">
              <div className="border-b border-border pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-[16px] font-semibold text-primary">Compliance audit</h2>
                  <p className="text-[13px] text-secondary mt-0.5">Continuous Title IV verification</p>
                </div>
                <span className="text-[13px] font-medium text-success flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" />
                  Pass
                </span>
              </div>

              <div className="space-y-3 text-[14px]">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-primary">Title IV credit hours</span>
                    <span className="text-[13px] font-mono font-medium text-success">PASS</span>
                  </div>
                  <p className="text-[13px] text-secondary">
                    All 1,420 sections verified for required 45 instructional contact hours per 3-credit unit.
                  </p>
                </div>

                <div className="h-px bg-border" />

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-primary">Faculty workload caps</span>
                    <span className="text-[13px] font-mono font-medium text-success">PASS</span>
                  </div>
                  <p className="text-[13px] text-secondary">
                    Zero faculty members scheduled over 3 consecutive hours or beyond contractual limits.
                  </p>
                </div>

                <div className="h-px bg-border" />

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-primary">ADA mobility paths</span>
                    <span className="text-[13px] font-mono font-medium text-success">PASS</span>
                  </div>
                  <p className="text-[13px] text-secondary">
                    100% of mobility-impaired student routes guaranteed elevator transit margins.
                  </p>
                </div>
              </div>
            </section>

            {/* Quick Links Card */}
            <section className="bg-surface border border-border rounded-lg p-5 space-y-3">
              <h2 className="text-[15px] font-semibold text-primary">Quick navigation</h2>
              <div className="space-y-1.5">
                <button
                  onClick={() => onNavigate?.('timetable')}
                  className="w-full h-10 px-3 rounded-md border border-border hover:bg-subtle text-left text-[14px] text-primary flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="font-medium">Master timetable grid</span>
                  <ArrowRight className="w-4 h-4 text-secondary" />
                </button>
                <button
                  onClick={() => onNavigate?.('generator')}
                  className="w-full h-10 px-3 rounded-md border border-border hover:bg-subtle text-left text-[14px] text-primary flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="font-medium">Auto-scheduler studio</span>
                  <ArrowRight className="w-4 h-4 text-secondary" />
                </button>
                <button
                  onClick={() => onNavigate?.('student-voice')}
                  className="w-full h-10 px-3 rounded-md border border-border hover:bg-subtle text-left text-[14px] text-primary flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="font-medium">Student feedback & polls</span>
                  <ArrowRight className="w-4 h-4 text-secondary" />
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
