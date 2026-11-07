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
  X
} from 'lucide-react';

interface SettingsScreenProps {
  onNavigate: (route: RouteType) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onNavigate }) => {
  const store = useInstitutionalData();
  const profile = store.institutionProfile;

  const [name, setName] = useState(profile?.name || 'Western Polytechnic Institute');
  const [campusCode, setCampusCode] = useState(profile?.campusCode || 'WPI-MAIN-01');
  const [accreditation, setAccreditation] = useState(profile?.accreditation || 'Higher Learning Commission (HLC) & ABET');
  const [registrarName, setRegistrarName] = useState(profile?.registrarName || 'Dr. Katherine Reynolds');
  const [registrarEmail, setRegistrarEmail] = useState(profile?.registrarEmail || 'k.reynolds@westernpoly.edu');
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
    showToast('Saved institutional profile and solver configuration.');
  };

  const handleExportJSON = () => {
    const json = institutionalStore.exportStoreJSON();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SmartGrid_Institutional_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Exported complete institutional JSON backup file.');
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="p-6 bg-gradient-to-br from-[#fff7f2] via-white to-[#faf4fc] border border-[#ece6ed] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="text-xs font-mono text-[#9c4126] font-bold">
            System Governance · Institutional Profile & Audit Trail
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1f1b20] tracking-tight mt-0.5">
            Settings & Data Administration
          </h1>
          <p className="text-xs sm:text-sm text-[#655d69] mt-1">
            Configure university accreditation metadata, export full JSON backups, manage sample datasets, and inspect the system audit trail.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportJSON}
            className="btn-secondary text-xs"
          >
            <Download className="w-3.5 h-3.5 text-[#3b1e4a]" />
            <span>Export JSON Backup</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="btn-primary text-xs"
          >
            <span>Return to Home Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {statusNotice && (
        <div className="p-3.5 bg-[#eefcf2] border border-[#ece6ed] rounded-xl text-xs text-[#0f5431] flex items-center gap-2 font-medium">
          <Check className="w-4 h-4 text-[#18794e]" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Confirm Factory Reset Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-[#ece6ed]">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1f1b20]">Reset all institutional data?</h3>
              <button 
                onClick={() => setShowResetConfirm(false)}
                className="text-[#7c747f] hover:text-[#1f1b20] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[#655d69] leading-relaxed">
              This will restore all rooms, courses, faculty, cohorts, and timetable scenarios back to the clean factory seed baseline.
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t border-[#ece6ed]">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-4 py-2 bg-[#dc2626] hover:bg-[#b91c1c] text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
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
          <form onSubmit={handleSaveProfile} className="content-card p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#ece6ed] pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#3b1e4a]" />
                <h2 className="text-base font-bold text-[#1f1b20]">
                  Institutional Profile & Accreditation
                </h2>
              </div>
              <span className="text-xs font-mono text-[#18794e] font-semibold">FERPA Compliant</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">
                  Institution Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="form-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">
                  Campus Code
                </label>
                <input
                  type="text"
                  required
                  value={campusCode}
                  onChange={e => setCampusCode(e.target.value)}
                  className="form-input text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">
                Accreditation Authority (Displayed on PDF Timetable Exports)
              </label>
              <input
                type="text"
                required
                value={accreditation}
                onChange={e => setAccreditation(e.target.value)}
                className="form-input text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">
                  Chief Registrar Name
                </label>
                <input
                  type="text"
                  required
                  value={registrarName}
                  onChange={e => setRegistrarName(e.target.value)}
                  className="form-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">
                  Registrar Contact Email
                </label>
                <input
                  type="email"
                  required
                  value={registrarEmail}
                  onChange={e => setRegistrarEmail(e.target.value)}
                  className="form-input text-xs font-mono"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#fbf8fc] border border-[#ece6ed] flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-[#1f1b20]">Automated Conflict Sweep on Slot Edit</div>
                <div className="text-[11px] text-[#655d69]">
                  Automatically validate room and instructor parity when manually moving classes in the Matrix.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAutoConflictSweep(!autoConflictSweep)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                  autoConflictSweep ? 'bg-[#18794e]' : 'bg-[#dcd9dd]'
                }`}
              >
                <div 
                  className={`bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform ${
                    autoConflictSweep ? 'translate-x-5' : 'translate-x-0'
                  }`} 
                />
              </button>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#ece6ed]">
              <button type="submit" className="btn-primary text-xs">
                <ShieldCheck className="w-4 h-4" />
                <span>Save Institutional Profile</span>
              </button>
            </div>
          </form>

          {/* Sample Data & Reset Controls */}
          <div className="content-card p-6 space-y-4">
            <h3 className="text-base font-bold text-[#1f1b20] border-b border-[#ece6ed] pb-3">
              Dataset & Snapshot Administration
            </h3>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#fbf8fc] border border-[#ece6ed]">
              <div>
                <div className="text-xs font-bold text-[#1f1b20]">Multi-Department University Sample Dataset</div>
                <div className="text-[11px] text-[#655d69] mt-0.5">
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
                className="btn-secondary text-xs shrink-0"
              >
                <Database className="w-3.5 h-3.5 text-[#3b1e4a]" />
                <span>{isSampleLoaded ? 'Remove Sample Data' : 'Load Sample Data'}</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#fff7f2]/60 border border-[#ece6ed]">
              <div>
                <div className="text-xs font-bold text-[#1f1b20]">Restore Factory Baseline</div>
                <div className="text-[11px] text-[#655d69] mt-0.5">
                  Reset all rooms, courses, instructors, cohorts, and scenarios to initial defaults.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="btn-secondary text-xs text-[#dc2626] shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Defaults</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right (6 cols): Searchable Audit Log */}
        <div className="lg:col-span-6">
          <div className="content-card overflow-hidden flex flex-col h-full">
            <div className="p-5 border-b border-[#ece6ed] bg-[#fbf8fc] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#1f1b20]">System Audit Trail</h2>
                  <p className="text-xs text-[#655d69]">Chronological log of all data changes, solver runs, and slot edits</p>
                </div>
                <span className="text-xs font-mono font-bold text-[#3b1e4a]">
                  {filteredLogs.length} events
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-[#7c747f] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Filter logs by user, entity, or summary..."
                    value={logSearch}
                    onChange={e => setLogSearch(e.target.value)}
                    className="w-full h-9 pl-8 pr-3 rounded-xl border border-[#ece6ed] bg-white text-xs text-[#1f1b20]"
                  />
                </div>
                <select
                  value={logActionFilter}
                  onChange={e => setLogActionFilter(e.target.value)}
                  className="h-9 px-3 rounded-xl border border-[#ece6ed] bg-white text-xs font-semibold text-[#3b1e4a]"
                >
                  <option value="all">All Actions</option>
                  <option value="generate">Solver Runs</option>
                  <option value="create">Created Records</option>
                  <option value="update">Updated Records</option>
                  <option value="delete">Deleted Records</option>
                </select>
              </div>
            </div>

            <div className="divide-y divide-[#ece6ed] max-h-[540px] overflow-y-auto bg-white">
              {filteredLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#655d69]">
                  No audit events match your current filter criteria.
                </div>
              ) : (
                filteredLogs.map(log => (
                  <div key={log.id} className="px-5 py-3.5 text-xs hover:bg-[#fbf8fc] transition-colors space-y-1">
                    <div className="flex items-center justify-between text-[#655d69]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#1f1b20]">{log.userName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-[11px] uppercase text-[#9c4126] font-semibold">
                          {log.action} / {log.entityType}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#7c747f] font-mono">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[#655d69] leading-relaxed">{log.summary}</p>
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
