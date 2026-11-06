import React, { useState } from 'react';
import { SmartGridNav, RouteType } from './SmartGridNav';
import { Filter, Download, Sparkles, Building, Clock, AlertCircle } from 'lucide-react';
import { ClassDetailsModal, ClassItem } from './ClassDetailsModal';

interface TimetableMatrixProps {
  onNavigate?: (route: RouteType) => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
  onSignOut?: () => void;
  currentUser?: { name: string; role: string; institution?: string } | null;
  hideNav?: boolean;
}

const scheduleData: Record<string, Record<string, ClassItem[]>> = {
  '09:00 - 10:30': {
    Mon: [{ id: '1', code: 'CS-301', title: 'Data Structures', room: 'Hall B3', prof: 'Dr. Evans', cohort: 'CS-Year2', accent: 'plum', credits: 4, type: 'Lecture' }],
    Tue: [{ id: '2', code: 'BIO-210', title: 'Cell Genomics', room: 'Lab 4', prof: 'Dr. Zhao', cohort: 'Bio-Year1', accent: 'emerald', credits: 3, type: 'Laboratory' }],
    Wed: [{ id: '3', code: 'CS-301', title: 'Data Structures', room: 'Hall B3', prof: 'Dr. Evans', cohort: 'CS-Year2', accent: 'plum', credits: 4, type: 'Lecture' }],
    Thu: [{ id: '4', code: 'ENG-102', title: 'Applied Statics', room: 'Quad A', prof: 'Prof. Miller', cohort: 'Eng-Year1', accent: 'terracotta', credits: 3, type: 'Lecture' }],
    Fri: [{ id: '5', code: 'ARCH-405', title: 'Spatial Studio', room: 'Atrium', prof: 'Dr. Vance', cohort: 'Arch-Year3', accent: 'plum', credits: 5, type: 'Studio' }]
  },
  '11:00 - 12:30': {
    Mon: [
      { id: '6', code: 'MATH-204', title: 'Linear Algebra', room: 'Hall A1', prof: 'Dr. Raman', cohort: 'All-STEM', accent: 'plum', credits: 4, type: 'Lecture' },
      { id: '7', code: 'HUM-110', title: 'Ethics in AI', room: 'Annex 2', prof: 'Dr. Gomez', cohort: 'Arts-Year1', accent: 'terracotta', credits: 3, type: 'Recitation' }
    ],
    Tue: [{ id: '8', code: 'CS-412', title: 'Distributed Systems', room: 'Lab 2', prof: 'Dr. Evans', cohort: 'CS-Year4', accent: 'plum', credits: 4, type: 'Lecture' }],
    Wed: [{ id: '9', code: 'BIO-320', title: 'Biomaterials', room: 'Lab 4', prof: 'Dr. Zhao', cohort: 'Bio-Year3', accent: 'emerald', credits: 3, type: 'Laboratory' }],
    Thu: [{ id: '10', code: 'CS-412', title: 'Distributed Systems', room: 'Lab 2', prof: 'Dr. Evans', cohort: 'CS-Year4', accent: 'plum', credits: 4, type: 'Lecture' }],
    Fri: [{ id: '11', code: 'MATH-204', title: 'Linear Algebra', room: 'Hall A1', prof: 'Dr. Raman', cohort: 'All-STEM', accent: 'plum', credits: 4, type: 'Lecture' }]
  },
  '13:30 - 15:00': {
    Mon: [{ id: '12', code: 'CHEM-201', title: 'Organic Chemistry', room: 'Chem Lab B', prof: 'Dr. Scott', cohort: 'Bio-Year2', accent: 'emerald', credits: 4, type: 'Laboratory' }],
    Tue: [{ id: '13', code: 'ENG-302', title: 'Fluid Dynamics', room: 'Eng Hall 1', prof: 'Prof. Miller', cohort: 'Eng-Year3', accent: 'terracotta', credits: 4, type: 'Lecture' }],
    Wed: [{ id: '14', code: 'CHEM-201', title: 'Organic Chemistry', room: 'Chem Lab B', prof: 'Dr. Scott', cohort: 'Bio-Year2', accent: 'emerald', credits: 4, type: 'Laboratory' }],
    Thu: [{ id: '15', code: 'ARCH-405', title: 'Spatial Studio', room: 'Atrium', prof: 'Dr. Vance', cohort: 'Arch-Year3', accent: 'plum', credits: 5, type: 'Studio' }],
    Fri: [{ id: '16', code: 'ENG-302', title: 'Fluid Dynamics', room: 'Eng Hall 1', prof: 'Prof. Miller', cohort: 'Eng-Year3', accent: 'terracotta', credits: 4, type: 'Lecture' }]
  }
};

export const TimetableMatrix: React.FC<TimetableMatrixProps> = ({
  onNavigate,
  onOpenAuth,
  onSignOut,
  currentUser,
  hideNav = false
}) => {
  const [selectedCohort, setSelectedCohort] = useState('All Departments');
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [isSweeping, setIsSweeping] = useState(false);
  const [sweepNotice, setSweepNotice] = useState<string | null>(null);

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const timeSlots = Object.keys(scheduleData);

  const handleRunSweep = () => {
    setIsSweeping(true);
    setTimeout(() => {
      setIsSweeping(false);
      setSweepNotice('1,420 lectures synchronized with zero instructor overlap. Parity verified.');
      setTimeout(() => setSweepNotice(null), 4000);
    }, 1000);
  };

  const filterClass = (cls: ClassItem) => {
    if (selectedCohort === 'Computer Science' && !cls.cohort.includes('CS') && !cls.code.includes('CS') && !cls.cohort.includes('All')) return false;
    if (selectedCohort === 'Bioengineering' && !cls.cohort.includes('Bio') && !cls.code.includes('BIO') && !cls.code.includes('CHEM') && !cls.cohort.includes('All')) return false;
    if (selectedCohort === 'Architecture' && !cls.cohort.includes('Arch') && !cls.code.includes('ARCH') && !cls.cohort.includes('All')) return false;
    if (selectedCohort === 'Mechanical Engineering' && !cls.cohort.includes('Eng') && !cls.code.includes('ENG') && !cls.cohort.includes('All')) return false;
    return true;
  };

  return (
    <div className="min-h-screen bg-[#fbf8fc] text-[#1f1b20] font-sans antialiased">
      {!hideNav && (
        <SmartGridNav 
          activeRoute="timetable" 
          onNavigate={onNavigate} 
          onOpenAuth={onOpenAuth}
          onSignOut={onSignOut}
          currentUser={currentUser}
        />
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Workspace Subheader with Atmospheric Peach Wash */}
        <div className="p-6 bg-gradient-to-br from-[#fff7f2] via-white to-[#faf4fc] border border-[#ece6ed] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-widest text-[#9c4126] font-bold">
              Master Schedule Matrix • Term 2 (2025/2026)
            </div>
            <h1 className="text-2xl font-black text-[#1f1b20] mt-1">Institutional Timetable Matrix</h1>
            <p className="text-xs text-[#655d69] mt-0.5">5-day synchronized campus allocation with zero lecture overlaps</p>
          </div>

          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 bg-white border border-[#ece6ed] hover:border-[#dcd9dd] text-[#3b1e4a] px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xs hover:bg-[#f6f2f7] transition-all cursor-pointer">
              <Download className="w-3.5 h-3.5" />
              Export CSV / iCal
            </button>
            <button 
              onClick={handleRunSweep}
              disabled={isSweeping}
              className="flex items-center gap-2 bg-gradient-to-r from-[#9c4126] to-[#f27438] hover:from-[#83341d] hover:to-[#ea580c] text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all active:scale-95 disabled:opacity-75 cursor-pointer"
            >
              <Sparkles className={`w-3.5 h-3.5 text-[#fed8c8] ${isSweeping ? 'animate-spin' : ''}`} />
              {isSweeping ? 'Running Sweep...' : 'Run Conflict Sweep'}
            </button>
          </div>
        </div>

        {sweepNotice && (
          <div className="p-3 bg-[#eefcf2] text-[#0f5431] rounded-xl text-xs font-mono flex items-center gap-2 animate-in fade-in border border-[#ece6ed]">
            <span className="font-bold">SWEEP_PASS:</span>
            <span>{sweepNotice}</span>
          </div>
        )}

        {/* Filter Tabs with rounded-xl and clean borders */}
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          {['All Departments', 'Computer Science', 'Bioengineering', 'Architecture', 'Mechanical Engineering'].map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedCohort(tag)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                selectedCohort === tag
                  ? 'bg-[#3b1e4a] text-white border-[#3b1e4a] shadow-xs'
                  : 'bg-white text-[#655d69] border-[#ece6ed] hover:border-[#dcd9dd]'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Horizontally Scrollable Timetable Grid (Min Col Width 160px) - Strictly Neutral Border with Rich Pastel Fills */}
        <div className="bg-white border border-[#ece6ed] rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#ece6ed] bg-[#fbf8fc]">
                  <th className="py-3 px-4 w-36 text-[10px] font-mono uppercase tracking-wider text-[#7c747f]">Time Window</th>
                  {days.map(day => (
                    <th key={day} className="py-3 px-4 min-w-[160px] text-xs font-bold text-[#1f1b20] border-l border-[#ece6ed]">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ece6ed]">
                {timeSlots.map(time => (
                  <tr key={time} className="hover:bg-[#fcfaff]/50">
                    <td className="py-4 px-4 text-xs font-mono font-medium text-[#655d69] whitespace-nowrap align-top">
                      {time}
                    </td>
                    {days.map(day => {
                      const classes = (scheduleData[time]?.[day] || []).filter(filterClass);
                      return (
                        <td key={day} className="py-3 px-3 min-w-[160px] border-l border-[#ece6ed] align-top">
                          <div className="space-y-2">
                            {classes.map(cls => (
                              <div
                                key={cls.id}
                                onClick={() => setSelectedClass({ ...cls, day, time })}
                                className={`p-3 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] text-xs space-y-1.5 transition-all cursor-pointer shadow-xs hover:shadow-md ${
                                  cls.accent === 'plum'
                                    ? 'bg-gradient-to-br from-[#faf4fc] to-[#f4eaf7] text-[#1f1b20]'
                                    : cls.accent === 'emerald'
                                    ? 'bg-gradient-to-br from-[#f1fbf5] to-[#e8f7ee] text-[#0f5431]'
                                    : 'bg-gradient-to-br from-[#fff7f2] to-[#fff0eb] text-[#9c4126]'
                                }`}
                              >
                                <div className="font-bold truncate flex items-center justify-between">
                                  <span>{cls.code}</span>
                                  <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                                    cls.accent === 'plum' ? 'bg-[#ede0f2] text-[#3b1e4a]' : cls.accent === 'emerald' ? 'bg-[#d2f3dd] text-[#18794e]' : 'bg-[#fed8c8] text-[#9c4126]'
                                  }`}>
                                    {cls.type}
                                  </span>
                                </div>
                                <div className="text-[11px] font-medium truncate text-[#1f1b20]">{cls.title}</div>
                                <div className="text-[10px] text-[#7c747f] flex items-center justify-between pt-0.5">
                                  <span className="truncate max-w-[90px]">{cls.room}</span>
                                  <span className="font-mono">{cls.prof}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lower Metric Bar - Distinct Atmospheric Tints & Neutral Borders */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-[#fff7f2] via-white to-[#fff0eb] border border-[#ece6ed] rounded-xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9c4126] to-[#f27438] text-white flex items-center justify-center shadow-xs shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#1f1b20]">Zero Schedule Collisions</div>
              <div className="text-[11px] text-[#7c747f]">1,420 lectures synchronized with zero instructor overlap</div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#faf4fc] via-white to-[#f4eaf7] border border-[#ece6ed] rounded-xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3b1e4a] to-[#7209b7] text-white flex items-center justify-center shadow-xs shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#1f1b20]">98.2% Room Utilization</div>
              <div className="text-[11px] text-[#7c747f]">Cleanroom & lab space allocated during optimal student hours</div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#f1fbf5] via-white to-[#e8f7ee] border border-[#ece6ed] rounded-xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#18794e] to-[#25a26c] text-white flex items-center justify-center shadow-xs shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#1f1b20]">Deterministic Parity</div>
              <div className="text-[11px] font-mono text-[#18794e] font-semibold">SOLVER_PASS_STABLE // 99.98%</div>
            </div>
          </div>
        </div>
      </main>

      {/* Class Inspector Modal */}
      <ClassDetailsModal
        classItem={selectedClass}
        onClose={() => setSelectedClass(null)}
      />
    </div>
  );
};
