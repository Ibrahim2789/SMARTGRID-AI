import React, { useState } from 'react';
import { RouteType } from './SmartGridNav';
import { useInstitutionalData, institutionalStore } from '../data/store';
import { RotateCcw, Check } from 'lucide-react';

interface SettingsScreenProps {
  onNavigate: (route: RouteType) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = () => {
  const store = useInstitutionalData();
  const [resetDone, setResetDone] = useState(false);

  const handleResetData = () => {
    if (confirm('Reset all institutional data back to the realistic default seed?')) {
      institutionalStore.resetToDefaults();
      setResetDone(true);
      setTimeout(() => setResetDone(false), 3000);
    }
  };

  return (
    <div className="max-w-[760px] mx-auto px-6 py-10 md:py-12 space-y-8">
      <div>
        <h1 className="text-[28px] font-semibold text-[#1B2430] tracking-tight">
          Settings
        </h1>
        <p className="text-[16px] text-[#556070] mt-1.5">
          System configurations, audit logs, and sample data management.
        </p>
      </div>

      {resetDone && (
        <div className="p-4 bg-[#F0FDF4] border border-[#BBF7D0] rounded-md text-[15px] text-[#15803D] flex items-center gap-2">
          <Check className="w-5 h-5 stroke-[3]" />
          <span>All institutional master records reset to defaults.</span>
        </div>
      )}

      {/* Institution Info Card */}
      <div className="content-card p-6 space-y-4">
        <h2 className="text-[18px] font-semibold text-[#1B2430] border-b border-[#E8EAEE] pb-3">
          Institutional profile
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[15px]">
          <div>
            <div className="text-[13px] text-[#7A8594]">Institution</div>
            <div className="font-medium text-[#1B2430]">Western Polytechnic Institute</div>
          </div>
          <div>
            <div className="text-[13px] text-[#7A8594]">Accreditation</div>
            <div className="font-medium text-[#1B2430]">Higher Learning Commission (HLC)</div>
          </div>
          <div>
            <div className="text-[13px] text-[#7A8594]">Active Term</div>
            <div className="font-medium text-[#1B2430]">Term 2 (Spring 2026)</div>
          </div>
          <div>
            <div className="text-[13px] text-[#7A8594]">Solver Engine</div>
            <div className="font-medium text-[#1B2430]">Deterministic SAT + Heuristic Pruning</div>
          </div>
        </div>
      </div>

      {/* Audit Log Card */}
      <div className="content-card overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E8EAEE] bg-[#F6F7F9] flex items-center justify-between">
          <span className="text-[15px] font-semibold text-[#1B2430]">Audit log</span>
          <span className="text-[13px] text-[#7A8594]">{store.auditLogs.length} recent changes</span>
        </div>
        <div className="divide-y divide-[#E8EAEE] max-h-72 overflow-y-auto">
          {store.auditLogs.map(log => (
            <div key={log.id} className="px-6 py-3 text-[14px] hover:bg-[#F6F7F9]">
              <div className="flex items-center justify-between text-[#556070]">
                <span className="font-medium text-[#1B2430]">{log.userName}</span>
                <span className="text-[12px] text-[#7A8594] font-mono">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-[#556070] mt-0.5">{log.summary}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Reset Seed Data */}
      <div className="content-card p-6 flex items-center justify-between">
        <div>
          <h3 className="text-[16px] font-semibold text-[#1B2430]">Reset sample data</h3>
          <p className="text-[14px] text-[#556070] mt-0.5">
            Restore all 20 rooms, 30 courses, 15 instructors, and 8 cohorts to factory sample.
          </p>
        </div>
        <button
          type="button"
          onClick={handleResetData}
          className="btn-secondary"
        >
          <RotateCcw className="w-4 h-4 text-[#556070]" />
          <span>Reset data</span>
        </button>
      </div>
    </div>
  );
};
