import React, { useState } from 'react';
import { RouteType } from './SmartGridNav';
import { useInstitutionalData, institutionalStore } from '../data/store';
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
  Settings as SettingsIcon
} from 'lucide-react';

interface SettingsScreenProps {
  onNavigate: (route: RouteType) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onNavigate }) => {
  const store = useInstitutionalData();
  const profile = store.institutionProfile;

  const [name, setName] = useState(profile?.name || 'Western Polytechnic Institute');
  const [campusCode, setCampusCode] = useState(profile?.campusCode || 'WPI-MAIN-01');
  const [accreditation, setAccreditation] = useState(
    profile?.accreditation || 'Higher Learning Commission (HLC) & ABET'
  );
  const [registrarName, setRegistrarName] = useState(
    profile?.registrarName || 'Dr. Katherine Reynolds'
  );
  const [registrarEmail, setRegistrarEmail] = useState(
    profile?.registrarEmail || 'k.reynolds@westernpoly.edu'
  );
  const [autoConflictSweep, setAutoConflictSweep] = useState(profile?.autoConflictSweep ?? true);

  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Audit Log filter
  const [logSearch, setLogSearch] = useState('');
  const [logActionFilter, setLogActionFilter] = useState<string>('all');

  const showToast = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(null), 4000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="space-y-6">
      {/* =========================================================
          1. EDITORIAL SERIF PAGE HEADING
         ========================================================= */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-[#E4E2DA]">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#EDEAE0] text-[#171717] text-xs font-semibold mb-2">
            <SettingsIcon className="w-3.5 h-3.5" />
            <span>Workspace Configuration & Audit Trail</span>
          </div>
          <h1 className="font-serif-editorial text-3xl sm:text-4xl text-[#171717] tracking-tight">
            Workspace Settings
          </h1>
          <p className="text-xs sm:text-sm text-[#77766F] mt-1 max-w-2xl">
            Configure academic accreditation metadata, export full JSON backups, manage sample datasets, and inspect the system audit trail.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportJSON}
            className="btn-secondary text-xs h-9"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON Backup</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="btn-primary text-xs h-9"
          >
            <span>Return to Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {statusNotice && (
        <div className="p-3.5 sf-pastel-lime text-xs font-medium flex items-center gap-2">
          <Check className="w-4 h-4 text-[#171717]" />
          <span>{statusNotice}</span>
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
              This will restore all rooms, courses, faculty, cohorts, and timetable builds back to the clean factory seed baseline.
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
          <form onSubmit={handleSaveProfile} className="sf-card-white p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#E4E2DA] pb-3.5">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#171717]" />
                <h2 className="font-serif-editorial text-xl text-[#171717]">
                  Academic Institution Profile
                </h2>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded bg-[#B7F77C] text-[#171717]">
                FERPA Compliant
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                  Institution Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="input-field text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                  Campus Code
                </label>
                <input
                  type="text"
                  required
                  value={campusCode}
                  onChange={e => setCampusCode(e.target.value)}
                  className="input-field text-xs font-mono-tabular"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Accreditation Authority (Displayed on PDF Timetable Exports)
              </label>
              <input
                type="text"
                required
                value={accreditation}
                onChange={e => setAccreditation(e.target.value)}
                className="input-field text-xs"
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
                  value={registrarName}
                  onChange={e => setRegistrarName(e.target.value)}
                  className="input-field text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                  Registrar Contact Email
                </label>
                <input
                  type="email"
                  required
                  value={registrarEmail}
                  onChange={e => setRegistrarEmail(e.target.value)}
                  className="input-field text-xs font-mono-tabular"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-[#171717]">
                  Automated Conflict Sweep on Slot Edit
                </div>
                <div className="text-[11px] text-[#77766F]">
                  Automatically validate room and instructor parity when manually moving classes in My Timetable.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAutoConflictSweep(!autoConflictSweep)}
                className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
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

            <div className="flex justify-end pt-2 border-t border-[#E4E2DA]">
              <button type="submit" className="btn-primary text-xs">
                <ShieldCheck className="w-4 h-4" />
                <span>Save Profile</span>
              </button>
            </div>
          </form>

          {/* Sample Data & Reset Controls */}
          <div className="sf-card-white p-6 space-y-4">
            <h3 className="font-serif-editorial text-xl text-[#171717] border-b border-[#E4E2DA] pb-3">
              Dataset & Snapshot Administration
            </h3>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA]">
              <div>
                <div className="text-xs font-semibold text-[#171717]">
                  Multi-Department University Sample Dataset
                </div>
                <div className="text-[11px] text-[#77766F] mt-0.5">
                  {isSampleLoaded
                    ? 'Realistic sample dataset is currently active alongside your workspace data.'
                    : 'Load a comprehensive multi-department dataset for testing and demonstration.'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isSampleLoaded) {
                    institutionalStore.removeSampleData();
                    showToast('Removed multi-department sample dataset.');
                  } else {
                    institutionalStore.loadSampleData();
                    showToast('Loaded multi-department university sample dataset.');
                  }
                }}
                className="btn-secondary text-xs h-9 shrink-0"
              >
                <Database className="w-3.5 h-3.5" />
                <span>{isSampleLoaded ? 'Remove Sample Data' : 'Load Sample Data'}</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#EDEAE0] border border-[#E4E2DA]">
              <div>
                <div className="text-xs font-semibold text-[#171717]">Restore Factory Baseline</div>
                <div className="text-[11px] text-[#77766F] mt-0.5">
                  Reset all rooms, courses, instructors, cohorts, and scenarios to initial defaults.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="btn-secondary text-xs h-9 shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Defaults</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right (6 cols): Searchable Audit Log */}
        <div className="lg:col-span-6">
          <div className="sf-card-white overflow-hidden flex flex-col h-full">
            <div className="p-5 border-b border-[#E4E2DA] bg-[#F7F6EF] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-serif-editorial text-xl text-[#171717]">
                    System Audit Trail
                  </h2>
                  <p className="text-xs text-[#77766F]">
                    Chronological log of all data changes, solver runs, and slot edits
                  </p>
                </div>
                <span className="text-xs font-mono-tabular font-semibold px-2.5 py-1 rounded bg-white border border-[#E4E2DA]">
                  {filteredLogs.length} events
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-[#77766F] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Filter logs by user, entity, or summary..."
                    value={logSearch}
                    onChange={e => setLogSearch(e.target.value)}
                    className="input-field h-9 pl-8 pr-3 text-xs"
                  />
                </div>
                <select
                  value={logActionFilter}
                  onChange={e => setLogActionFilter(e.target.value)}
                  className="input-field h-9 w-auto text-xs font-medium"
                >
                  <option value="all">All Actions</option>
                  <option value="generate">Solver Runs</option>
                  <option value="create">Created Records</option>
                  <option value="update">Updated Records</option>
                  <option value="delete">Deleted Records</option>
                </select>
              </div>
            </div>

            <div className="divide-y divide-[#E4E2DA] max-h-[540px] overflow-y-auto bg-white">
              {filteredLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#77766F]">
                  No audit events match your current filter criteria.
                </div>
              ) : (
                filteredLogs.map(log => (
                  <div
                    key={log.id}
                    className="px-5 py-3.5 text-xs hover:bg-[#F7F6EF]/60 transition-colors space-y-1"
                  >
                    <div className="flex items-center justify-between text-[#77766F]">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#171717]">{log.userName}</span>
                        <span>·</span>
                        <span className="font-mono-tabular text-[11px] uppercase px-1.5 py-0.5 rounded bg-[#B8EEEE] text-[#171717] font-semibold">
                          {log.action} / {log.entityType}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#77766F] font-mono-tabular">
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className="text-[#77766F] leading-relaxed">{log.summary}</p>
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
