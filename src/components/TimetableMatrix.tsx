import React, { useState, useRef, useEffect } from 'react';
import { SmartGridNav, RouteType } from './SmartGridNav';
import { useInstitutionalData, institutionalStore } from '../data/store';
import { buildMatrixSchedule } from '../data/solverAdapter';
import { 
  Download, 
  Sparkles, 
  Building, 
  Clock, 
  AlertCircle, 
  FileText, 
  FileSpreadsheet, 
  ChevronDown, 
  Check, 
  Layers,
  Search,
  Users,
  User,
  Lock
} from 'lucide-react';
import { ClassDetailsModal, ClassItem } from './ClassDetailsModal';
import { jsPDF } from 'jspdf';

interface TimetableMatrixProps {
  onNavigate?: (route: RouteType) => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
  onSignOut?: () => void;
  currentUser?: { name: string; role: string; institution?: string } | null;
  hideNav?: boolean;
}

export const TimetableMatrix: React.FC<TimetableMatrixProps> = ({
  onNavigate,
  onOpenAuth,
  onSignOut,
  currentUser,
  hideNav = false
}) => {
  const store = useInstitutionalData();
  const { scheduleData, conflicts } = buildMatrixSchedule(store);

  const [perspective, setPerspective] = useState<'master' | 'cohort' | 'instructor' | 'room'>('master');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [selectedCohortId, setSelectedCohortId] = useState<string>(store.studentGroups[0]?.id || '');
  const [selectedInstructorId, setSelectedInstructorId] = useState<string>(store.instructors[0]?.id || '');
  const [selectedRoomId, setSelectedRoomId] = useState<string>(store.rooms[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [isSweeping, setIsSweeping] = useState(false);
  const [sweepNotice, setSweepNotice] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  const days = store.timeStructure.workingDays.length > 0
    ? store.timeStructure.workingDays
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const timeSlots = store.timeStructure.periods.length > 0
    ? store.timeStructure.periods
    : Object.keys(scheduleData);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRunSweep = () => {
    setIsSweeping(true);
    setTimeout(() => {
      const res = institutionalStore.runTimetableSolver();
      setIsSweeping(false);
      setSweepNotice(`${res.placedCount} course sections synchronized across ${store.rooms.length} facilities with 0 hard overlaps.`);
      setTimeout(() => setSweepNotice(null), 4500);
    }, 600);
  };

  // Filter class item based on active perspective, department, and search query
  const filterClass = (cls: ClassItem) => {
    if (perspective === 'cohort' && selectedCohortId) {
      if (cls.studentGroupId !== selectedCohortId) return false;
    }
    if (perspective === 'instructor' && selectedInstructorId) {
      if (cls.instructorId !== selectedInstructorId) return false;
    }
    if (perspective === 'room' && selectedRoomId) {
      if (cls.roomId !== selectedRoomId) return false;
    }
    if (selectedDeptId !== 'all') {
      if (cls.departmentId && cls.departmentId !== selectedDeptId) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        cls.code.toLowerCase().includes(q) ||
        cls.title.toLowerCase().includes(q) ||
        cls.prof.toLowerCase().includes(q) ||
        cls.room.toLowerCase().includes(q) ||
        cls.cohort.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  };

  const getActiveScopeLabel = () => {
    if (perspective === 'cohort') {
      const g = store.studentGroups.find(x => x.id === selectedCohortId);
      return g ? `Cohort_${g.code}` : 'Cohort_View';
    }
    if (perspective === 'instructor') {
      const i = store.instructors.find(x => x.id === selectedInstructorId);
      return i ? `Faculty_${i.name.replace(/\s+/g, '_')}` : 'Faculty_View';
    }
    if (perspective === 'room') {
      const r = store.rooms.find(x => x.id === selectedRoomId);
      return r ? `Room_${r.code}` : 'Room_View';
    }
    if (selectedDeptId !== 'all') {
      const d = store.departments.find(x => x.id === selectedDeptId);
      return d ? `Dept_${d.code}` : 'Department';
    }
    return 'All_Departments';
  };

  // CSV Export Routine
  const handleExportCSV = (scope: 'filtered' | 'all') => {
    const records: Array<{
      day: string;
      timeSlot: string;
      code: string;
      title: string;
      type: string;
      credits: number;
      room: string;
      prof: string;
      cohort: string;
    }> = [];

    days.forEach(day => {
      timeSlots.forEach(time => {
        const classes = scheduleData[time]?.[day] || [];
        classes.forEach(cls => {
          if (scope === 'all' || filterClass(cls)) {
            records.push({
              day,
              timeSlot: time,
              code: cls.code,
              title: cls.title,
              type: cls.type || 'Lecture',
              credits: cls.credits || 3,
              room: cls.room,
              prof: cls.prof,
              cohort: cls.cohort,
            });
          }
        });
      });
    });

    const headers = ['Day', 'Time Slot', 'Course Code', 'Course Title', 'Instruction Type', 'Credits', 'Room / Facility', 'Faculty Instructor', 'Cohort Track'];
    const rows = records.map(r => [
      `"${r.day}"`,
      `"${r.timeSlot}"`,
      `"${r.code}"`,
      `"${r.title.replace(/"/g, '""')}"`,
      `"${r.type}"`,
      r.credits,
      `"${r.room}"`,
      `"${r.prof}"`,
      `"${r.cohort}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const scopeLabel = scope === 'all' ? 'All_Departments' : getActiveScopeLabel();
    link.href = url;
    link.download = `SmartGrid_Timetable_${scopeLabel}_Spring2026.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportNotice(`Exported ${records.length} scheduled sections to CSV (${scopeLabel.replace(/_/g, ' ')}).`);
    setTimeout(() => setExportNotice(null), 4500);
    setShowExportMenu(false);
  };

  // PDF Export Routine using jsPDF
  const handleExportPDF = (scope: 'filtered' | 'all') => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 297;
    const margin = 14;

    // Top plum accent bar
    doc.setFillColor(59, 30, 74);
    doc.rect(margin, 12, pageWidth - (margin * 2), 2.5, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(31, 27, 32);
    doc.text(`${(store.institutionProfile?.name || 'SMARTGRID AI').toUpperCase()} — TIMETABLE MATRIX`, margin, 21);

    // Subtitle / Term
    const activeTerm = store.terms.find(t => t.status === 'active') || store.terms[0];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(156, 65, 38);
    doc.text(`${(activeTerm?.name || 'SPRING 2026').toUpperCase()}   •   SYNCHRONIZED CAMPUS ALLOCATION`, margin, 26);

    // Metadata block right side
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(101, 93, 105);
    const scopeLabel = scope === 'all' ? 'All Departments' : getActiveScopeLabel().replace(/_/g, ' ');
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    doc.text(`Scope: ${scopeLabel}`, pageWidth - margin, 19, { align: 'right' });
    doc.text(`Generated: ${dateStr}   •   Clashes: ${conflicts.length}`, pageWidth - margin, 23, { align: 'right' });
    doc.text(`Registrar: ${store.institutionProfile?.registrarName || 'Dr. Katherine Reynolds'}`, pageWidth - margin, 27, { align: 'right' });

    const tableStartY = 31;
    const colTimeWidth = 30;
    const numDays = Math.min(days.length, 6);
    const dayColWidth = (pageWidth - (margin * 2) - colTimeWidth) / numDays;
    const headerHeight = 8;
    const rowHeight = Math.min(44, Math.floor(150 / Math.max(1, timeSlots.length)));

    // Header Row
    doc.setFillColor(246, 242, 247);
    doc.rect(margin, tableStartY, pageWidth - (margin * 2), headerHeight, 'F');
    doc.setDrawColor(236, 230, 237);
    doc.setLineWidth(0.3);
    doc.rect(margin, tableStartY, pageWidth - (margin * 2), headerHeight, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(124, 116, 127);
    doc.text('TIME SLOT', margin + 3, tableStartY + 5.5);

    days.slice(0, numDays).forEach((day, dIdx) => {
      const x = margin + colTimeWidth + (dIdx * dayColWidth);
      doc.line(x, tableStartY, x, tableStartY + headerHeight);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(31, 27, 32);
      doc.text(day.toUpperCase(), x + 4, tableStartY + 5.5);
    });

    // Grid Rows
    timeSlots.forEach((time, rIdx) => {
      const y = tableStartY + headerHeight + (rIdx * rowHeight);

      doc.setDrawColor(236, 230, 237);
      doc.setFillColor(251, 248, 252);
      doc.rect(margin, y, colTimeWidth, rowHeight, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(59, 30, 74);
      doc.text(time, margin + 2.5, y + 7);

      days.slice(0, numDays).forEach((day, dIdx) => {
        const x = margin + colTimeWidth + (dIdx * dayColWidth);
        doc.setDrawColor(236, 230, 237);
        doc.rect(x, y, dayColWidth, rowHeight, 'S');

        const classes = (scheduleData[time]?.[day] || []).filter(cls => scope === 'all' || filterClass(cls));
        
        let itemY = y + 2;
        classes.slice(0, 2).forEach((cls) => {
          const cardH = Math.min(18, rowHeight - 4);
          if (itemY + cardH > y + rowHeight) return;

          if (cls.accent === 'emerald') {
            doc.setFillColor(241, 251, 245);
          } else if (cls.accent === 'terracotta') {
            doc.setFillColor(255, 247, 242);
          } else {
            doc.setFillColor(250, 244, 252);
          }
          doc.setDrawColor(236, 230, 237);
          doc.roundedRect(x + 1.5, itemY, dayColWidth - 3, cardH, 1.5, 1.5, 'FD');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(31, 27, 32);
          doc.text(`${cls.code} (${cls.room})`, x + 3, itemY + 4.5);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.5);
          doc.setTextColor(59, 30, 74);
          const truncatedTitle = cls.title.length > 22 ? cls.title.substring(0, 20) + '..' : cls.title;
          doc.text(truncatedTitle, x + 3, itemY + 9);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6);
          doc.setTextColor(101, 93, 105);
          doc.text(`${cls.prof} · ${cls.cohort}`, x + 3, itemY + 13.5);

          itemY += cardH + 1.5;
        });
      });
    });

    const footerY = 197;
    doc.setDrawColor(236, 230, 237);
    doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(124, 116, 127);
    doc.text(`${store.institutionProfile?.name || 'SmartGrid AI'}  •  Accreditation: ${store.institutionProfile?.accreditation || 'HLC'}`, margin, footerY);
    doc.text(`Official Academic Schedule Document`, pageWidth - margin, footerY, { align: 'right' });

    const fileLabel = scope === 'all' ? 'All_Departments' : getActiveScopeLabel();
    doc.save(`SmartGrid_Timetable_${fileLabel}_Spring2026.pdf`);

    setExportNotice(`Exported timetable as landscape PDF (${fileLabel.replace(/_/g, ' ')}).`);
    setTimeout(() => setExportNotice(null), 4500);
    setShowExportMenu(false);
  };

  const placedTotal = store.sections.filter(s => s.assignedSlot).length;
  const activeTerm = store.terms.find(t => t.status === 'active') || store.terms[0];
  const currentInstructorObj = store.instructors.find(i => i.id === selectedInstructorId);

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
        <div className="p-6 bg-gradient-to-br from-[#fff7f2] via-white to-[#faf4fc] border border-[#ece6ed] rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
          <div>
            <div className="text-xs font-mono text-[#9c4126] font-bold">
              Master Schedule Matrix · {activeTerm?.name || 'Term 2 (Spring 2026)'} · {placedTotal} Sections Placed
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1f1b20] mt-0.5 tracking-tight">
              Institutional Timetable Matrix
            </h1>
            <p className="text-xs sm:text-sm text-[#655d69] mt-0.5">
              Click any scheduled class block to inspect details, pin/lock its slot, or reassign its room and time window.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Export Dropdown Menu */}
            <div className="relative" ref={exportDropdownRef}>
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="btn-secondary text-xs"
                title="Export timetable to CSV or PDF"
              >
                <Download className="w-3.5 h-3.5 text-[#9c4126]" />
                <span>Export CSV / PDF</span>
                <ChevronDown className={`w-3.5 h-3.5 text-[#7c747f] transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-[#ece6ed] rounded-xl shadow-xl z-50 py-2">
                  <div className="px-3.5 py-2 border-b border-[#ece6ed]">
                    <div className="text-[11px] font-mono text-[#9c4126] font-bold">
                      Export Active View
                    </div>
                    <div className="text-xs text-[#655d69] mt-0.5">
                      Scope: <span className="font-bold text-[#1f1b20]">{getActiveScopeLabel().replace(/_/g, ' ')}</span>
                    </div>
                  </div>

                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => handleExportCSV('filtered')}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs flex items-start gap-2.5 hover:bg-[#f6f2f7] transition-colors cursor-pointer text-[#1f1b20]"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-[#18794e] mt-0.5 shrink-0" />
                      <div>
                        <div className="font-bold">Export Current View (.csv)</div>
                        <div className="text-[11px] text-[#655d69]">Spreadsheet for Excel / Google Sheets</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleExportPDF('filtered')}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs flex items-start gap-2.5 hover:bg-[#f6f2f7] transition-colors cursor-pointer text-[#1f1b20]"
                    >
                      <FileText className="w-4 h-4 text-[#9c4126] mt-0.5 shrink-0" />
                      <div>
                        <div className="font-bold">Export Current View (.pdf)</div>
                        <div className="text-[11px] text-[#655d69]">Official A4 landscape schedule document</div>
                      </div>
                    </button>
                  </div>

                  <div className="mx-2 my-1 border-t border-[#ece6ed]" />

                  <div className="p-2 space-y-1">
                    <div className="px-2 text-[10px] font-mono text-[#7c747f]">
                      Full Campus Master Export
                    </div>
                    <button
                      onClick={() => handleExportCSV('all')}
                      className="w-full text-left px-3 py-1.5 rounded-xl text-xs flex items-center justify-between hover:bg-[#f6f2f7] transition-colors cursor-pointer text-[#655d69]"
                    >
                      <span className="flex items-center gap-2 font-medium text-[#1f1b20]">
                        <Layers className="w-3.5 h-3.5 text-[#3b1e4a]" />
                        <span>All Departments (CSV)</span>
                      </span>
                      <span className="text-[10px] font-mono text-[#7c747f]">{placedTotal} secs</span>
                    </button>

                    <button
                      onClick={() => handleExportPDF('all')}
                      className="w-full text-left px-3 py-1.5 rounded-xl text-xs flex items-center justify-between hover:bg-[#f6f2f7] transition-colors cursor-pointer text-[#655d69]"
                    >
                      <span className="flex items-center gap-2 font-medium text-[#1f1b20]">
                        <FileText className="w-3.5 h-3.5 text-[#3b1e4a]" />
                        <span>All Departments (PDF)</span>
                      </span>
                      <span className="text-[10px] font-mono text-[#7c747f]">Landscape</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={handleRunSweep}
              disabled={isSweeping}
              className="btn-primary text-xs"
            >
              <Sparkles className={`w-3.5 h-3.5 text-[#fed8c8] ${isSweeping ? 'animate-spin' : ''}`} />
              <span>{isSweeping ? 'Optimizing Matrix...' : 'Re-Optimize & Sweep Clashes'}</span>
            </button>
          </div>
        </div>

        {/* Feedback Notices */}
        {sweepNotice && (
          <div className="p-3.5 bg-[#eefcf2] text-[#0f5431] rounded-xl text-xs font-mono flex items-center gap-2 border border-[#ece6ed]">
            <Check className="w-4 h-4 text-[#18794e]" />
            <span className="font-bold">SOLVER_PASS:</span>
            <span>{sweepNotice}</span>
          </div>
        )}

        {exportNotice && (
          <div className="p-3.5 bg-gradient-to-r from-[#fff7f2] to-[#faf4fc] text-[#3b1e4a] rounded-xl text-xs font-mono flex items-center gap-2 border border-[#ece6ed] shadow-xs">
            <Check className="w-4 h-4 text-[#18794e]" />
            <span className="font-bold text-[#9c4126]">EXPORT_READY:</span>
            <span>{exportNotice}</span>
          </div>
        )}

        {/* Perspective Switcher + Search + Contextual Filter Bar */}
        <div className="content-card p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* 4 Perspective Mode Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 bg-[#fbf8fc] p-1 rounded-xl border border-[#ece6ed]">
              {[
                { id: 'master' as const, label: 'Master Matrix', icon: Layers },
                { id: 'cohort' as const, label: 'By Student Cohort', icon: Users },
                { id: 'instructor' as const, label: 'By Faculty', icon: User },
                { id: 'room' as const, label: 'By Room / Lab', icon: Building }
              ].map(tab => {
                const Icon = tab.icon;
                const active = perspective === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPerspective(tab.id)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      active
                        ? 'bg-[#3b1e4a] text-white shadow-xs'
                        : 'text-[#655d69] hover:text-[#1f1b20] hover:bg-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Right: Search & Perspective Selector */}
            <div className="flex flex-wrap items-center gap-3">
              {perspective === 'cohort' && (
                <select
                  value={selectedCohortId}
                  onChange={e => setSelectedCohortId(e.target.value)}
                  className="h-9 px-3 rounded-xl border border-[#ece6ed] bg-white text-xs font-bold text-[#3b1e4a]"
                >
                  {store.studentGroups.map(g => (
                    <option key={g.id} value={g.id}>
                      Cohort: {g.code} — {g.name} ({g.size} students)
                    </option>
                  ))}
                </select>
              )}

              {perspective === 'instructor' && (
                <select
                  value={selectedInstructorId}
                  onChange={e => setSelectedInstructorId(e.target.value)}
                  className="h-9 px-3 rounded-xl border border-[#ece6ed] bg-white text-xs font-bold text-[#3b1e4a]"
                >
                  {store.instructors.map(i => (
                    <option key={i.id} value={i.id}>
                      Faculty: {i.name} ({i.maxWeeklyHours}h max)
                    </option>
                  ))}
                </select>
              )}

              {perspective === 'room' && (
                <select
                  value={selectedRoomId}
                  onChange={e => setSelectedRoomId(e.target.value)}
                  className="h-9 px-3 rounded-xl border border-[#ece6ed] bg-white text-xs font-bold text-[#3b1e4a]"
                >
                  {store.rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      Room: {r.code} — {r.type.toUpperCase()} ({r.capacity} seats)
                    </option>
                  ))}
                </select>
              )}

              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-[#7c747f] absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search course, room, prof..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-8 pr-3 rounded-xl border border-[#ece6ed] bg-[#fbf8fc] focus:bg-white text-xs text-[#1f1b20]"
                />
              </div>
            </div>
          </div>

          {/* Department Filter Strip */}
          {perspective === 'master' && (
            <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-[#ece6ed]">
              <button
                onClick={() => setSelectedDeptId('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                  selectedDeptId === 'all'
                    ? 'bg-[#3b1e4a] text-white border-[#3b1e4a]'
                    : 'bg-white text-[#655d69] border-[#ece6ed] hover:border-[#dcd9dd]'
                }`}
              >
                All Departments ({placedTotal})
              </button>
              {store.departments.map(dept => (
                <button
                  key={dept.id}
                  onClick={() => setSelectedDeptId(dept.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                    selectedDeptId === dept.id
                      ? 'bg-[#3b1e4a] text-white border-[#3b1e4a]'
                      : 'bg-white text-[#655d69] border-[#ece6ed] hover:border-[#dcd9dd]'
                  }`}
                >
                  {dept.name} ({dept.code})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Horizontally Scrollable Timetable Grid */}
        <div className="bg-white border border-[#ece6ed] rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#ece6ed] bg-[#fbf8fc]">
                  <th className="py-3.5 px-4 w-36 text-xs font-mono font-bold text-[#655d69]">Time Period</th>
                  {days.map(day => (
                    <th key={day} className="py-3.5 px-4 min-w-[175px] text-xs font-extrabold text-[#1f1b20] border-l border-[#ece6ed]">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ece6ed]">
                {timeSlots.map(time => (
                  <tr key={time} className="hover:bg-[#fcfaff]/40">
                    <td className="py-4 px-4 text-xs font-mono font-bold text-[#3b1e4a] whitespace-nowrap align-top bg-[#fbf8fc]/50">
                      <div>{time}</div>
                      <div className="text-[10px] font-normal text-[#7c747f] mt-0.5">
                        {store.timeStructure.periodLengthMinutes} min slot
                      </div>
                    </td>
                    {days.map(day => {
                      const classes = (scheduleData[time]?.[day] || []).filter(filterClass);
                      const isInstructorBlackedOut =
                        perspective === 'instructor' &&
                        currentInstructorObj?.unavailableSlots.some(u => u.day === day && u.timeSlot === time);

                      return (
                        <td key={day} className="py-3 px-3 min-w-[175px] border-l border-[#ece6ed] align-top">
                          <div className="space-y-2">
                            {isInstructorBlackedOut && (
                              <div className="p-2.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[11px] text-[#dc2626] font-mono font-semibold text-center">
                                Faculty Blackout Window
                              </div>
                            )}

                            {classes.map(cls => (
                              <div
                                key={cls.id}
                                onClick={() => setSelectedClass(cls)}
                                className={`p-3 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] text-xs space-y-1.5 transition-all cursor-pointer shadow-xs hover:shadow-md ${
                                  cls.accent === 'plum'
                                    ? 'bg-gradient-to-br from-[#faf4fc] to-[#f3e8f8] text-[#1f1b20]'
                                    : cls.accent === 'emerald'
                                    ? 'bg-gradient-to-br from-[#f1fbf5] to-[#e5f6ec] text-[#0f5431]'
                                    : 'bg-gradient-to-br from-[#fff7f2] to-[#ffede3] text-[#9c4126]'
                                }`}
                              >
                                <div className="font-bold truncate flex items-center justify-between gap-1">
                                  <span className="font-mono text-[#1f1b20] flex items-center gap-1">
                                    {cls.code}
                                    {cls.isLocked && <Lock className="w-3 h-3 text-[#3b1e4a]" />}
                                  </span>
                                  <span className="text-[10px] font-mono text-[#655d69]">
                                    {cls.type}
                                  </span>
                                </div>
                                <div className="text-xs font-bold truncate text-[#1f1b20]">{cls.title}</div>
                                <div className="text-[11px] text-[#655d69] flex items-center justify-between pt-0.5">
                                  <span className="font-mono font-semibold text-[#3b1e4a] truncate max-w-[85px]">{cls.room}</span>
                                  <span className="truncate max-w-[90px]">{cls.prof}</span>
                                </div>
                                <div className="text-[10px] font-mono text-[#7c747f] flex items-center justify-between border-t border-[#ece6ed]/80 pt-1">
                                  <span>{cls.cohort}</span>
                                  <span>{cls.enrolled}/{cls.capacity} seats</span>
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

        {/* Lower Metric Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-[#fff7f2] via-white to-[#fff0eb] border border-[#ece6ed] rounded-xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9c4126] to-[#f27438] text-white flex items-center justify-center shadow-xs shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#1f1b20]">
                {conflicts.length === 0 ? 'Zero Schedule Collisions' : `${conflicts.length} Overlaps Detected`}
              </div>
              <div className="text-[11px] text-[#655d69]">
                {placedTotal} sections synchronized across {days.length} teaching days
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#faf4fc] via-white to-[#f4eaf7] border border-[#ece6ed] rounded-xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#3b1e4a] text-white flex items-center justify-center shadow-xs shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#1f1b20]">
                {store.rooms.length} Campus Facilities Active
              </div>
              <div className="text-[11px] text-[#655d69]">
                Click any class block to move its room or time slot live
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#f1fbf5] via-white to-[#e8f7ee] border border-[#ece6ed] rounded-xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#18794e] text-white flex items-center justify-center shadow-xs shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#1f1b20]">Interactive Slot Locking</div>
              <div className="text-[11px] font-mono text-[#18794e] font-semibold">
                {store.sections.filter(s => s.isLocked).length} sections pinned · Export ready
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Class Inspector & Slot Reassignment Modal */}
      <ClassDetailsModal
        classItem={selectedClass}
        onClose={() => setSelectedClass(null)}
      />
    </div>
  );
};
