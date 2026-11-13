import React, { useState } from 'react';
import { RouteType } from './SmartGridNav';
import { useInstitutionalData, institutionalStore } from '../data/store';
import { computeAcademicScheduleConfig, isUserAdminRole } from '../types/institutional';
import {
  RotateCcw,
  Check,
  Download,
  Database,
  Building2,
  ShieldCheck,
  Search,
  ArrowRight,
  X,
  Clock,
  Calendar,
  Lock
} from 'lucide-react';

interface SettingsScreenProps {
  onNavigate: (route: RouteType) => void;
  currentUser?: {
    name: string;
    role: string;
    email: string;
    institution?: string;
  } | null;
  onSwitchUser?: (user: {
    name: string;
    role: string;
    email: string;
    institution?: string;
  }) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onNavigate,
  currentUser,
  onSwitchUser
}) => {
  const store = useInstitutionalData();
  const profile = store.institutionProfile;
  const activeTiming = computeAcademicScheduleConfig(store.timeStructure);

  const isAdmin = isUserAdminRole(currentUser?.role || 'Registrar');

  // --- Institution Profile State ---
  const [name, setName] = useState(profile?.name || 'University of Engineering & Computing');
  const [campusCode, setCampusCode] = useState(profile?.campusCode || 'UEC-MAIN-01');
  const [accreditation, setAccreditation] = useState(
    profile?.accreditation || 'PEC & NCEAC Accredited Programs (BEE, BCE, BESE, BSCS)'
  );
  const [registrarName, setRegistrarName] = useState(
    profile?.registrarName || 'Dr. Katherine Reynolds'
  );
  const [registrarEmail, setRegistrarEmail] = useState(
    profile?.registrarEmail || 'registrar@university.edu'
  );
  const [autoConflictSweep, setAutoConflictSweep] = useState(profile?.autoConflictSweep ?? true);

  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Audit Log filter
  const [logSearch, setLogSearch] = useState('');
  const [logActionFilter, setLogActionFilter] = useState<string>('all');

  const showToast = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(null), 5000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    institutionalStore.updateInstitutionProfile({
      name: name.trim(),
      campusCode: campusCode.trim(),
      accreditation: accreditation.trim(),
      registrarName: registrarName.trim(),
      registrarEmail: registrarEmail.trim(),
      autoConflictSweep
    });
    showToast('Saved institutional profile and workspace settings.');
  };

  const handleExportJSON = () => {
    const json = institutionalStore.exportStoreJSON();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SmartGrid_Workspace_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Exported complete workspace JSON backup file.');
  };

  const handleConfirmReset = () => {
    if (!isAdmin) return;
    institutionalStore.resetToDefaults();
    setShowResetConfirm(false);
    showToast('All institutional master records restored to factory baseline.');
  };

  const isSampleLoaded = institutionalStore.isSampleDataLoaded();

  const filteredLogs = store.auditLogs.filter(log => {
    if (logActionFilter !== 'all' && log.action !== logActionFilter) return false;
    if (logSearch.trim()) {
      const q = logSearch.toLowerCase();
      return (
        log.summary.toLowerCase().includes(q) ||
        log.userName.toLowerCase().includes(q) ||
        log.entityType.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-8">
      {/* 1. PAGE HEADING */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-[#E4E2DA]">
        <div>
          <h1 className="font-serif-editorial text-3xl sm:text-4xl text-[#171717] tracking-tight">
            Workspace Settings
          </h1>
          <p className="text-xs sm:text-sm text-[#77766F] mt-1">
            {name} · {isAdmin ? currentUser?.role || 'Registrar' : `Read-Only (${currentUser?.role})`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('academic-config')}
            className="btn-secondary text-xs h-9 px-3.5"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Academic Config</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('timetables')}
            className="btn-primary text-xs h-9 px-3.5"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>View Timetables</span>
          </button>
        </div>
      </header>

      {/* Role-Based Access Notice for Non-Admin Users */}
      {!isAdmin && (
        <div className="p-4 rounded-2xl bg-[#F2D8FA]/60 border border-[#DFB9EC] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Lock className="w-4 h-4 text-[#171717] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-[#171717]">
                Read-Only Workspace Settings ({currentUser?.role})
              </div>
              <p className="text-xs text-[#77766F]">
                Only authorized administrators (Registrar / Admin) can modify institutional settings.
              </p>
            </div>
          </div>
          {onSwitchUser && (
            <button
              type="button"
              onClick={() =>
                onSwitchUser({
                  name: 'Dr. Katherine Reynolds',
                  role: 'Registrar',
                  email: 'k.reynolds@westernpoly.edu',
                  institution: name
                })
              }
              className="btn-primary text-xs h-9 px-3.5 shrink-0"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Switch to Registrar (Admin)</span>
            </button>
          )}
        </div>
      )}

      {/* Toast Notification Banner */}
      {statusNotice && (
        <div className="p-4 sf-pastel-lime rounded-2xl text-xs font-medium flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Check className="w-4 h-4 text-[#171717] shrink-0" />
            <span className="text-[#171717] font-semibold">{statusNotice}</span>
          </div>
        </div>
      )}

      {/* Confirm Factory Reset Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-[#E4E2DA]">
            <div className="flex items-center justify-between">
              <h3 className="font-serif-editorial text-xl text-[#171717]">
                Reset all workspace data?
              </h3>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="text-[#77766F] hover:text-[#171717] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[#77766F] leading-relaxed">
              This will restore all rooms, courses, faculty, cohorts, academic timings, and timetable builds back to the clean factory seed baseline.
            </p>
            <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E4E2DA]">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="btn-secondary text-xs h-9"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="btn-primary text-xs h-9"
              >
                Confirm Factory Reset
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left (6 cols): Institutional Profile Form */}
        <div className="lg:col-span-6 space-y-6">
          <form onSubmit={handleSaveProfile} className="sf-card-white p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#E4E2DA] pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#171717]" />
                <h2 className="font-serif-editorial text-xl text-[#171717]">
                  Institution Profile
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                  Institution Name
                </label>
                <input
                  type="text"
                  required
                  disabled={!isAdmin}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="input-field text-xs disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                  Campus Code
                </label>
                <input
                  type="text"
                  required
                  disabled={!isAdmin}
                  value={campusCode}
                  onChange={e => setCampusCode(e.target.value)}
                  className="input-field text-xs font-mono-tabular disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Accreditation Authority
              </label>
              <input
                type="text"
                required
                disabled={!isAdmin}
                value={accreditation}
                onChange={e => setAccreditation(e.target.value)}
                className="input-field text-xs disabled:opacity-60"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                  Chief Registrar Name
                </label>
                <input
                  type="text"
                  required
                  disabled={!isAdmin}
                  value={registrarName}
                  onChange={e => setRegistrarName(e.target.value)}
                  className="input-field text-xs disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                  Registrar Contact Email
                </label>
                <input
                  type="email"
                  required
                  disabled={!isAdmin}
                  value={registrarEmail}
                  onChange={e => setRegistrarEmail(e.target.value)}
                  className="input-field text-xs font-mono-tabular disabled:opacity-60"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-[#E4E2DA] flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-[#171717]">
                  Auto-Sweep on Slot Edit
                </div>
                <div className="text-[11px] text-[#77766F]">
                  Validate room and instructor parity when manually moving classes
                </div>
              </div>
              <button
                type="button"
                disabled={!isAdmin}
                onClick={() => setAutoConflictSweep(!autoConflictSweep)}
                className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 disabled:opacity-60 ${
                  autoConflictSweep ? 'bg-[#171717]' : 'bg-[#D6D3C9]'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full transition-transform ${
                    autoConflictSweep ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-[#E4E2DA]">
              <button
                type="button"
                onClick={handleExportJSON}
                className="btn-secondary text-xs h-9 px-3.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON</span>
              </button>

              <button
                type="submit"
                disabled={!isAdmin}
                className="btn-primary text-xs h-9 px-4 disabled:opacity-50"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Save Profile</span>
              </button>
            </div>
          </form>

          {/* Dataset & Reset Controls — Clean Hairline Rows */}
          <div className="sf-card-white p-5 sm:p-6 space-y-4">
            <h3 className="font-serif-editorial text-xl text-[#171717] border-b border-[#E4E2DA] pb-3">
              Data &amp; Baseline
            </h3>

            <div className="divide-y divide-[#E4E2DA]">
              <div className="py-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-[#171717]">
                    Sample University Dataset
                  </div>
                  <div className="text-[11px] text-[#77766F]">
                    {isSampleLoaded ? 'Loaded in current workspace' : 'Load multi-department test records'}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => {
                    if (isSampleLoaded) {
                      institutionalStore.removeSampleData();
                      showToast('Removed multi-department sample dataset.');
                    } else {
                      institutionalStore.loadSampleData();
                      showToast('Loaded multi-department university sample dataset.');
                    }
                  }}
                  className="btn-secondary text-xs h-8 px-3 shrink-0 disabled:opacity-50"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>{isSampleLoaded ? 'Remove Sample' : 'Load Sample'}</span>
                </button>
              </div>

              <div className="py-3 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-[#171717]">Factory Baseline</div>
                  <div className="text-[11px] text-[#77766F]">
                    Restore default rooms, courses, instructors, and schedules
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => setShowResetConfirm(true)}
                  className="btn-secondary text-xs h-8 px-3 shrink-0 disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Defaults</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right (6 cols): Searchable Audit Log */}
        <div className="lg:col-span-6">
          <div className="sf-card-white overflow-hidden flex flex-col h-full">
            <div className="p-5 border-b border-[#E4E2DA] space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-serif-editorial text-xl text-[#171717]">
                  Audit Log
                </h2>
                <span className="text-xs font-mono-tabular text-[#77766F]">
                  {filteredLogs.length} events
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="input-group-field h-9 px-3 gap-2.5 flex-1">
                  <Search className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                  <input
                    type="text"
                    placeholder="Filter logs..."
                    value={logSearch}
                    onChange={e => setLogSearch(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <select
                  value={logActionFilter}
                  onChange={e => setLogActionFilter(e.target.value)}
                  className="input-field h-9 sm:w-auto text-xs font-medium shrink-0"
                >
                  <option value="all">All Actions</option>
                  <option value="generate">Solver Runs</option>
                  <option value="create">Created</option>
                  <option value="update">Updated</option>
                  <option value="delete">Deleted</option>
                </select>
              </div>
            </div>

            <div className="divide-y divide-[#E4E2DA] max-h-[540px] overflow-y-auto bg-white">
              {filteredLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#77766F]">
                  No audit events match your filter.
                </div>
              ) : (
                filteredLogs.map(log => (
                  <div
                    key={log.id}
                    className="px-5 py-3 text-xs hover:bg-[#F7F6EF]/60 transition-colors space-y-1"
                  >
                    <div className="flex items-center justify-between text-[#77766F]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-[#171717] truncate">{log.userName}</span>
                        <span>·</span>
                        <span className="font-mono-tabular text-[11px] uppercase text-[#57564F]">
                          {log.action} {log.entityType}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#77766F] font-mono-tabular shrink-0 ml-2">
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className="text-[#57564F] leading-relaxed">{log.summary}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
