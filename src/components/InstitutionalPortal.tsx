import React, { useState } from 'react';
import { SmartGridNav, RouteType } from './SmartGridNav';
import { 
  Shield, 
  Sparkles, 
  Users, 
  Building, 
  Clock, 
  CheckCircle2, 
  RefreshCw, 
  Sliders, 
  ArrowRight, 
  Check,
  Calendar,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
  onSwitchUser,
  hideNav = false
}) => {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced'>('idle');
  const [exportNotice, setExportNotice] = useState<string | null>(null);

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
      setTimeout(() => setSyncStatus('idle'), 3500);
    }, 1200);
  };

  const handleExport = (format: string) => {
    setExportNotice(`Exported ${format} snapshot for Ellucian Banner / Canvas`);
    setTimeout(() => setExportNotice(null), 3000);
  };

  return (
    <div className="min-h-screen bg-[#fbf8fc] text-[#1f1b20] font-sans antialiased">
      {!hideNav && (
        <SmartGridNav 
          activeRoute="portal" 
          onNavigate={onNavigate} 
          onOpenAuth={onOpenAuth}
          onSignOut={onSignOut}
          currentUser={currentUser}
        />
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {/* Welcome Header */}
        <section className="bg-gradient-to-br from-[#fff7f2] via-white to-[#faf4fc] border border-[#ece6ed] rounded-2xl p-6 lg:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="space-y-2 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#eefcf2] text-[11px] font-mono font-bold text-[#18794e] uppercase tracking-wider border border-[#18794e]/20 shadow-xs">
              <Shield className="w-3.5 h-3.5 text-[#18794e]" />
              Institutional Command Portal • Verified Session
            </div>
            <h1 className="text-2xl lg:text-3xl font-black text-[#1f1b20]">
              Welcome back, {activeUser.name}
            </h1>
            <p className="text-xs text-[#655d69]">
              Role: <span className="font-bold text-[#1f1b20]">{activeUser.role}</span> • Affiliation: <span className="font-mono text-[#3b1e4a] font-bold">{activeUser.institution || 'Western Polytechnic Institute'}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 relative z-10">
            <button
              onClick={handleSyncLMS}
              disabled={syncStatus === 'syncing'}
              className="flex items-center gap-2 bg-white border border-[#ece6ed] hover:border-[#dcd9dd] hover:bg-[#f6f2f7] text-[#3b1e4a] px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin text-[#9c4126]' : ''}`} />
              {syncStatus === 'syncing' ? 'Syncing SIS/LMS...' : syncStatus === 'synced' ? 'SIS Synced! ✓' : 'Sync SIS / LMS'}
            </button>
            <button
              onClick={() => onNavigate?.('generator')}
              className="flex items-center gap-2 bg-gradient-to-r from-[#9c4126] to-[#b3401f] hover:from-[#83341d] hover:to-[#9c4126] text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#fed8c8]" />
              New Solve Run
            </button>
          </div>
        </section>

        {/* Real-Time Campus Operations Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#9c4126] font-bold">System Telemetry</span>
              <h2 className="text-xl font-black text-[#1f1b20]">Active Academic Term State (Term 2)</h2>
            </div>
            <span className="text-xs font-mono text-[#18794e] font-bold bg-[#eefcf2] px-3 py-1 rounded-xl shadow-xs border border-[#18794e]/20">
              EQUILIBRIUM: 100% COLLISION FREE
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1 */}
            <div className="relative bg-gradient-to-br from-[#faf4fc] via-white to-[#f4eaf7] border border-[#ece6ed] hover:border-[#dcd9dd] rounded-2xl p-5 shadow-xs card-lift space-y-1">
              <div className="text-[10px] font-mono uppercase text-[#7c747f] font-bold flex items-center justify-between">
                <span>Enrolled Students</span>
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#3b1e4a] to-[#7209b7] text-white flex items-center justify-center shadow-xs">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black font-mono text-[#3b1e4a]">34,180</div>
              <div className="text-[11px] text-[#7209b7] font-bold">12 Academic Schools</div>
            </div>

            {/* Card 2 */}
            <div className="relative bg-gradient-to-br from-[#fff7f2] via-white to-[#fff0eb] border border-[#ece6ed] hover:border-[#dcd9dd] rounded-2xl p-5 shadow-xs card-lift space-y-1">
              <div className="text-[10px] font-mono uppercase text-[#7c747f] font-bold flex items-center justify-between">
                <span>Lecture & Lab Sections</span>
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#9c4126] to-[#f27438] text-white flex items-center justify-center shadow-xs">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black font-mono text-[#9c4126]">1,420</div>
              <div className="text-[11px] text-[#18794e] font-bold">0 Conflicting Overlaps</div>
            </div>

            {/* Card 3 */}
            <div className="relative bg-gradient-to-br from-[#f1fbf5] via-white to-[#e8f7ee] border border-[#ece6ed] hover:border-[#dcd9dd] rounded-2xl p-5 shadow-xs card-lift space-y-1">
              <div className="text-[10px] font-mono uppercase text-[#7c747f] font-bold flex items-center justify-between">
                <span>Physical Facilities</span>
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#18794e] to-[#25a26c] text-white flex items-center justify-center shadow-xs">
                  <Building className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black font-mono text-[#18794e]">114 Rooms</div>
              <div className="text-[11px] text-[#18794e] font-bold">98.2% Optimal Utilization</div>
            </div>

            {/* Card 4 */}
            <div className="relative bg-gradient-to-br from-[#fffbf0] via-white to-[#fff4df] border border-[#ece6ed] hover:border-[#dcd9dd] rounded-2xl p-5 shadow-xs card-lift space-y-1">
              <div className="text-[10px] font-mono uppercase text-[#7c747f] font-bold flex items-center justify-between">
                <span>Solver Parity Check</span>
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#d97706] to-[#f59e0b] text-white flex items-center justify-center shadow-xs">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black font-mono text-[#d97706]">99.88%</div>
              <div className="text-[11px] font-mono text-[#7c747f]">Pareto Global Maxima</div>
            </div>
          </div>
        </section>

        {/* Operations Hub: Quick Navigation Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div 
            onClick={() => onNavigate?.('timetable')}
            className="relative bg-gradient-to-br from-[#fff8f5] via-white to-[#fff2ec] border border-[#ece6ed] hover:border-[#dcd9dd] rounded-2xl p-6 shadow-sm card-lift cursor-pointer transition-all duration-300 group space-y-4"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#9c4126] to-[#f27438] text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1f1b20] group-hover:text-[#9c4126] transition-colors">
                Timetable Matrix Workspace
              </h3>
              <p className="text-xs text-[#655d69] mt-1 leading-relaxed">
                Inspect the full five-day master schedule, filter by department, review room allocations, and export data.
              </p>
            </div>
            <div className="flex items-center text-xs font-bold uppercase tracking-wider text-[#9c4126] gap-1 pt-1 group-hover:translate-x-1 transition-transform">
              <span>Open Master Matrix</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          <div 
            onClick={() => onNavigate?.('generator')}
            className="relative bg-gradient-to-br from-[#faf5fc] via-white to-[#f4ebf8] border border-[#ece6ed] hover:border-[#dcd9dd] rounded-2xl p-6 shadow-sm card-lift cursor-pointer transition-all duration-300 group space-y-4"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#3b1e4a] to-[#7209b7] text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1f1b20] group-hover:text-[#7209b7] transition-colors">
                Generator Studio
              </h3>
              <p className="text-xs text-[#655d69] mt-1 leading-relaxed">
                Tune constraint scalar multipliers, adjust circadian weighting, and run combinatorial genetic convergence.
              </p>
            </div>
            <div className="flex items-center text-xs font-bold uppercase tracking-wider text-[#7209b7] gap-1 pt-1 group-hover:translate-x-1 transition-transform">
              <span>Open Solver Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          <div 
            onClick={() => onNavigate?.('student-voice')}
            className="relative bg-gradient-to-br from-[#f0fbf4] via-white to-[#e8f8ee] border border-[#ece6ed] hover:border-[#dcd9dd] rounded-2xl p-6 shadow-sm card-lift cursor-pointer transition-all duration-300 group space-y-4"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#18794e] to-[#25a26c] text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1f1b20] group-hover:text-[#18794e] transition-colors">
                Student Voice Telemetry
              </h3>
              <p className="text-xs text-[#655d69] mt-1 leading-relaxed">
                Review verified student referendums, transit buffer thresholds, and circadian peak alertness profiles.
              </p>
            </div>
            <div className="flex items-center text-xs font-bold uppercase tracking-wider text-[#18794e] gap-1 pt-1 group-hover:translate-x-1 transition-transform">
              <span>Inspect Student Input</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </section>

        {/* SIS / LMS Sync & Export Tools */}
        <section className="bg-white border border-[#ece6ed] rounded-2xl p-6 lg:p-8 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#ece6ed] pb-4">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#9c4126] font-bold">Enterprise Integrations</span>
              <h2 className="text-xl font-black text-[#1f1b20]">LMS & SIS Ecosystem Connectors</h2>
            </div>
            <span className="text-xs font-mono text-[#7c747f]">Ellucian Banner v9.4 • Canvas REST API</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gradient-to-b from-[#fdfbfd] to-[#fbf8fc] border border-[#ece6ed] hover:border-[#dcd9dd] rounded-xl space-y-3 card-lift">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1f1b20]">Ellucian Banner SIS</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[#18794e] bg-[#eefcf2] px-2 py-0.5 rounded">
                  <Check className="w-3 h-3" /> Live Sync
                </span>
              </div>
              <p className="text-[11px] text-[#655d69]">
                Course section numbers, CRNs, instructor IDs, and prerequisite chains synchronized.
              </p>
              <button 
                onClick={() => handleExport('Banner XML')}
                className="w-full text-center py-2 text-xs font-bold text-[#3b1e4a] border border-[#ece6ed] hover:border-[#dcd9dd] rounded-xl hover:bg-white transition-colors cursor-pointer"
              >
                Export Banner XML
              </button>
            </div>

            <div className="p-4 bg-gradient-to-b from-[#fdfbfd] to-[#fbf8fc] border border-[#ece6ed] hover:border-[#dcd9dd] rounded-xl space-y-3 card-lift">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1f1b20]">Canvas LMS</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[#18794e] bg-[#eefcf2] px-2 py-0.5 rounded">
                  <Check className="w-3 h-3" /> Published
                </span>
              </div>
              <p className="text-[11px] text-[#655d69]">
                1,420 course shells created with automated student roster syncing.
              </p>
              <button 
                onClick={() => handleExport('Canvas CSV')}
                className="w-full text-center py-2 text-xs font-bold text-[#3b1e4a] border border-[#ece6ed] hover:border-[#dcd9dd] rounded-xl hover:bg-white transition-colors cursor-pointer"
              >
                Export Canvas Roster CSV
              </button>
            </div>

            <div className="p-4 bg-gradient-to-b from-[#fdfbfd] to-[#fbf8fc] border border-[#ece6ed] hover:border-[#dcd9dd] rounded-xl space-y-3 card-lift">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1f1b20]">Campus Facility Access</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[#18794e] bg-[#eefcf2] px-2 py-0.5 rounded">
                  <Check className="w-3 h-3" /> Locks Armed
                </span>
              </div>
              <p className="text-[11px] text-[#655d69]">
                RFID door locks configured to unlock 15 minutes before scheduled laboratory hours.
              </p>
              <button 
                onClick={() => handleExport('Access Control JSON')}
                className="w-full text-center py-2 text-xs font-bold text-[#3b1e4a] border border-[#ece6ed] hover:border-[#dcd9dd] rounded-xl hover:bg-white transition-colors cursor-pointer"
              >
                Export Security Roster
              </button>
            </div>
          </div>

          <AnimatePresence>
            {exportNotice && (
              <motion.div 
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="p-3 bg-[#eefcf2] text-[#0f5431] rounded-xl text-xs font-mono flex items-center justify-between border border-[#18794e]/30 shadow-xs"
              >
                <span>{exportNotice}</span>
                <span className="font-bold">EXPORT_SUCCESS ✓</span>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Accreditation Audit Log */}
        <section className="bg-white border border-[#ece6ed] rounded-2xl p-6 lg:p-8 shadow-sm space-y-4">
          <div className="border-b border-[#ece6ed] pb-3">
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#9c4126] font-bold">Accreditation & Compliance</span>
            <h3 className="text-lg font-black text-[#1f1b20]">Title IV & FERPA Continuous Verification</h3>
          </div>

          <div className="divide-y divide-[#ece6ed] text-xs">
            <div className="py-3 flex items-center justify-between">
              <div>
                <span className="font-bold text-[#1f1b20]">Title IV Credit Hour Minimums:</span>
                <span className="text-[#655d69] ml-2">All 1,420 sections verified for required 45 instructional contact hours per 3-credit unit.</span>
              </div>
              <span className="font-mono text-[#18794e] font-bold bg-[#eaf8f0] px-2 py-0.5 rounded border border-[#ece6ed]">AUDIT_PASS</span>
            </div>
            <div className="py-3 flex items-center justify-between">
              <div>
                <span className="font-bold text-[#1f1b20]">Faculty Workload Caps:</span>
                <span className="text-[#655d69] ml-2">Zero faculty members scheduled over 3 consecutive hours or beyond contractual limits.</span>
              </div>
              <span className="font-mono text-[#18794e] font-bold bg-[#eaf8f0] px-2 py-0.5 rounded border border-[#ece6ed]">AUDIT_PASS</span>
            </div>
            <div className="py-3 flex items-center justify-between">
              <div>
                <span className="font-bold text-[#1f1b20]">ADA Accessible Path Buffers:</span>
                <span className="text-[#655d69] ml-2">100% of mobility-impaired student routes guaranteed elevator transit margins.</span>
              </div>
              <span className="font-mono text-[#18794e] font-bold bg-[#eaf8f0] px-2 py-0.5 rounded border border-[#ece6ed]">AUDIT_PASS</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
