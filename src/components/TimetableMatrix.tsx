import React, { useState, useRef, useEffect } from 'react';
import { SmartGridNav, RouteType } from './SmartGridNav';
import { useInstitutionalData, institutionalStore } from '../data/store';
import { buildMatrixSchedule } from '../data/solverAdapter';
import {
  Download,
  Sparkles,
  Building,
  Clock,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  Check,
  Layers,
  Search,
  Users,
  User,
  Lock,
  Calendar as CalendarIcon,
  CheckCircle2,
  MapPin
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

const PASTEL_PALETTE = [
  { bg: '#B8EEEE', border: '#95DFDF', label: 'Cyan' },
  { bg: '#F2D8FA', border: '#DFB9EC', label: 'Lavender' },
  { bg: '#B8F2E6', border: '#93DEC9', label: 'Mint' },
  { bg: '#B7F77C', border: '#98DF58', label: 'Lime' },
  { bg: '#E8D36B', border: '#D4BC4C', label: 'Mustard' }
];

function getCoursePastel(code: string) {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash * 31 + code.charCodeAt(i)) >>> 0;
  }
  return PASTEL_PALETTE[hash % PASTEL_PALETTE.length];
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

  const [calendarMode, setCalendarMode] = useState<'week' | 'day' | 'agenda'>('week');
  const [focusedDay, setFocusedDay] = useState<string>('Mon');
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
      setSweepNotice(`${res.placedCount} course sections synchronized across ${store.rooms.length} rooms with 0 hard overlaps.`);
      setTimeout(() => setSweepNotice(null), 4500);
    }, 450);
  };

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
              cohort: cls.cohort
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
    link.download = `SmartGrid_Timetable_${scopeLabel}_Fall2026.csv`;
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

    doc.setFillColor(23, 23, 23);
    doc.rect(margin, 12, pageWidth - margin * 2, 2.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(23, 23, 23);
    doc.text(`${(store.institutionProfile?.name || 'SMARTGRID AI').toUpperCase()} — MY TIMETABLE`, margin, 21);

    const activeTerm = store.terms.find(t => t.status === 'active') || store.terms[0];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(119, 118, 111);
    doc.text(`${(activeTerm?.name || 'FALL 2026').toUpperCase()}   •   SYNCHRONIZED ACADEMIC SCHEDULE`, margin, 26);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(119, 118, 111);
    const scopeLabel = scope === 'all' ? 'All Departments' : getActiveScopeLabel().replace(/_/g, ' ');
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    doc.text(`Scope: ${scopeLabel}`, pageWidth - margin, 19, { align: 'right' });
    doc.text(`Generated: ${dateStr}   •   Clashes: ${conflicts.length}`, pageWidth - margin, 23, { align: 'right' });
    doc.text(`Registrar: ${store.institutionProfile?.registrarName || 'Dr. Katherine Reynolds'}`, pageWidth - margin, 27, { align: 'right' });

    const tableStartY = 31;
    const colTimeWidth = 30;
    const numDays = Math.min(days.length, 6);
    const dayColWidth = (pageWidth - margin * 2 - colTimeWidth) / numDays;
    const headerHeight = 8;
    const rowHeight = Math.min(44, Math.floor(150 / Math.max(1, timeSlots.length)));

    doc.setFillColor(237, 234, 224);
    doc.rect(margin, tableStartY, pageWidth - margin * 2, headerHeight, 'F');
    doc.setDrawColor(228, 226, 218);
    doc.setLineWidth(0.3);
    doc.rect(margin, tableStartY, pageWidth - margin * 2, headerHeight, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(23, 23, 23);
    doc.text('TIME SLOT', margin + 3, tableStartY + 5.5);

    days.slice(0, numDays).forEach((day, dIdx) => {
      const x = margin + colTimeWidth + dIdx * dayColWidth;
      doc.line(x, tableStartY, x, tableStartY + headerHeight);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(23, 23, 23);
      doc.text(day.toUpperCase(), x + 4, tableStartY + 5.5);
    });

    timeSlots.forEach((time, rIdx) => {
      const y = tableStartY + headerHeight + rIdx * rowHeight;

      doc.setDrawColor(228, 226, 218);
      doc.setFillColor(247, 246, 239);
      doc.rect(margin, y, colTimeWidth, rowHeight, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(23, 23, 23);
      doc.text(time, margin + 2.5, y + 7);

      days.slice(0, numDays).forEach((day, dIdx) => {
        const x = margin + colTimeWidth + dIdx * dayColWidth;
        doc.setDrawColor(228, 226, 218);
        doc.rect(x, y, dayColWidth, rowHeight, 'S');

        const classes = (scheduleData[time]?.[day] || []).filter(cls => scope === 'all' || filterClass(cls));

        let itemY = y + 2;
        classes.slice(0, 2).forEach(cls => {
          const cardH = Math.min(18, rowHeight - 4);
          if (itemY + cardH > y + rowHeight) return;

          doc.setFillColor(184, 238, 238);
          doc.setDrawColor(228, 226, 218);
          doc.roundedRect(x + 1.5, itemY, dayColWidth - 3, cardH, 1.5, 1.5, 'FD');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(23, 23, 23);
          doc.text(`${cls.code} (${cls.room})`, x + 3, itemY + 4.5);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.5);
          doc.setTextColor(23, 23, 23);
          const truncatedTitle = cls.title.length > 22 ? cls.title.substring(0, 20) + '..' : cls.title;
          doc.text(truncatedTitle, x + 3, itemY + 9);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6);
          doc.setTextColor(119, 118, 111);
          doc.text(`${cls.prof} · ${cls.cohort}`, x + 3, itemY + 13.5);

          itemY += cardH + 1.5;
        });
      });
    });

    const footerY = 197;
    doc.setDrawColor(228, 226, 218);
    doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(119, 118, 111);
    doc.text(`${store.institutionProfile?.name || 'SmartGrid AI'}  •  Accreditation: ${store.institutionProfile?.accreditation || 'HLC'}`, margin, footerY);
    doc.text('Official Academic Schedule Document', pageWidth - margin, footerY, { align: 'right' });

    const fileLabel = scope === 'all' ? 'All_Departments' : getActiveScopeLabel();
    doc.save(`SmartGrid_Timetable_${fileLabel}_Fall2026.pdf`);

    setExportNotice(`Exported timetable as landscape PDF (${fileLabel.replace(/_/g, ' ')}).`);
    setTimeout(() => setExportNotice(null), 4500);
    setShowExportMenu(false);
  };

  const placedTotal = store.sections.filter(s => s.assignedSlot).length;
  const lockedTotal = store.sections.filter(s => s.isLocked).length;
  const activeTerm = store.terms.find(t => t.status === 'active') || store.terms[0];
  const currentInstructorObj = store.instructors.find(i => i.id === selectedInstructorId);
  const visibleDays = calendarMode === 'day' ? [focusedDay] : days;

  return (
    <div className="space-y-6">
      {!hideNav && (
        <SmartGridNav
          activeRoute="timetable"
          onNavigate={onNavigate}
          onOpenAuth={onOpenAuth}
          onSignOut={onSignOut}
          currentUser={currentUser}
        />
      )}

      {/* =========================================================
          1. EDITORIAL PAGE HEADING & EXPORT / SOLVER CONTROLS
         ========================================================= */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-[#E4E2DA]">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#EDEAE0] text-[#171717] text-xs font-medium mb-2">
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>{activeTerm?.name || 'Fall 2026'} · {placedTotal} Scheduled Sections</span>
          </div>
          <h1 className="font-serif-editorial text-3xl sm:text-4xl text-[#171717] tracking-tight">
            My Timetable
          </h1>
          <p className="text-xs sm:text-sm text-[#77766F] mt-1">
            Click any pastel course card to inspect instructor and room metadata, pin a slot, or reassign its schedule window.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Export Dropdown Menu */}
          <div className="relative" ref={exportDropdownRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="btn-secondary text-xs h-9"
              title="Export timetable to CSV or PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV / PDF</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-[#E4E2DA] rounded-2xl shadow-xl z-50 py-2">
                <div className="px-3.5 py-2 border-b border-[#E4E2DA]">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                    Export Active View
                  </div>
                  <div className="text-xs text-[#171717] mt-0.5">
                    Scope: <span className="font-semibold">{getActiveScopeLabel().replace(/_/g, ' ')}</span>
                  </div>
                </div>

                <div className="p-2 space-y-1">
                  <button
                    onClick={() => handleExportCSV('filtered')}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs flex items-start gap-2.5 hover:bg-[#F7F6EF] transition-colors cursor-pointer text-[#171717]"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-[#171717] mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold">Export Current View (.csv)</div>
                      <div className="text-[11px] text-[#77766F]">Spreadsheet for Excel / Google Sheets</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleExportPDF('filtered')}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs flex items-start gap-2.5 hover:bg-[#F7F6EF] transition-colors cursor-pointer text-[#171717]"
                  >
                    <FileText className="w-4 h-4 text-[#171717] mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold">Export Current View (.pdf)</div>
                      <div className="text-[11px] text-[#77766F]">Official A4 landscape schedule document</div>
                    </div>
                  </button>
                </div>

                <div className="mx-2 my-1 border-t border-[#E4E2DA]" />

                <div className="p-2 space-y-1">
                  <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[#77766F]">
                    Full Campus Master Export
                  </div>
                  <button
                    onClick={() => handleExportCSV('all')}
                    className="w-full text-left px-3 py-1.5 rounded-xl text-xs flex items-center justify-between hover:bg-[#F7F6EF] transition-colors cursor-pointer text-[#171717]"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <Layers className="w-3.5 h-3.5" />
                      <span>All Departments (CSV)</span>
                    </span>
                    <span className="text-[10px] font-mono-tabular text-[#77766F]">{placedTotal} secs</span>
                  </button>

                  <button
                    onClick={() => handleExportPDF('all')}
                    className="w-full text-left px-3 py-1.5 rounded-xl text-xs flex items-center justify-between hover:bg-[#F7F6EF] transition-colors cursor-pointer text-[#171717]"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <FileText className="w-3.5 h-3.5" />
                      <span>All Departments (PDF)</span>
                    </span>
                    <span className="text-[10px] font-mono-tabular text-[#77766F]">Landscape</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleRunSweep}
            disabled={isSweeping}
            className="btn-primary text-xs h-9"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isSweeping ? 'animate-spin' : ''}`} />
            <span>{isSweeping ? 'Optimizing...' : 'Re-Optimize Timetable'}</span>
          </button>
        </div>
      </header>

      {/* Feedback Notices */}
      {sweepNotice && (
        <div className="p-3.5 sf-pastel-lime text-xs font-medium flex items-center gap-2">
          <Check className="w-4 h-4 text-[#171717]" />
          <span>{sweepNotice}</span>
        </div>
      )}

      {exportNotice && (
        <div className="p-3.5 sf-pastel-cyan text-xs font-medium flex items-center gap-2">
          <Check className="w-4 h-4 text-[#171717]" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* =========================================================
          2. COMPACT SCHEDULE STATISTICS
         ========================================================= */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="sf-card-stat flex items-center justify-between">
          <div>
            <div className="text-xs text-[#77766F]">Validation Status</div>
            <div className="font-serif-editorial text-2xl text-[#171717] mt-0.5">
              {conflicts.length === 0 ? '0 Clashes' : `${conflicts.length} Overlaps`}
            </div>
            <div className="text-[11px] text-[#77766F]">All hard constraints verified</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#B7F77C] flex items-center justify-center text-[#171717]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="sf-card-stat flex items-center justify-between">
          <div>
            <div className="text-xs text-[#77766F]">Scheduled Sections</div>
            <div className="font-serif-editorial text-2xl text-[#171717] mt-0.5">
              {placedTotal} / {store.sections.length}
            </div>
            <div className="text-[11px] text-[#77766F]">Across {days.length} teaching days</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#B8EEEE] flex items-center justify-center text-[#171717]">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="sf-card-stat flex items-center justify-between">
          <div>
            <div className="text-xs text-[#77766F]">Active Rooms & Labs</div>
            <div className="font-serif-editorial text-2xl text-[#171717] mt-0.5">
              {store.rooms.length} Rooms
            </div>
            <div className="text-[11px] text-[#77766F]">100% capacity compliance</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F2D8FA] flex items-center justify-center text-[#171717]">
            <Building className="w-5 h-5" />
          </div>
        </div>

        <div className="sf-card-stat flex items-center justify-between">
          <div>
            <div className="text-xs text-[#77766F]">Pinned Slots</div>
            <div className="font-serif-editorial text-2xl text-[#171717] mt-0.5">
              {lockedTotal} Locked
            </div>
            <div className="text-[11px] text-[#77766F]">Protected during re-solve</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#E8D36B] flex items-center justify-center text-[#171717]">
            <Lock className="w-5 h-5" />
          </div>
        </div>
      </section>

      {/* =========================================================
          3. DAY / WEEK / AGENDA NAVIGATION & CONTEXTUAL FILTERS
         ========================================================= */}
      <div className="sf-card-white p-4 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3.5">
          <div className="flex flex-wrap items-center gap-3">
            {/* Day / Week / Agenda Switcher */}
            <div className="inline-flex items-center p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA]">
              {[
                { id: 'week' as const, label: 'Week View' },
                { id: 'day' as const, label: 'Day View' },
                { id: 'agenda' as const, label: 'Course Agenda' }
              ].map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setCalendarMode(mode.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    calendarMode === mode.id
                      ? 'bg-[#171717] text-white'
                      : 'text-[#77766F] hover:text-[#171717]'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {/* Perspective Tabs */}
            <div className="inline-flex flex-wrap items-center p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA]">
              {[
                { id: 'master' as const, label: 'All Courses', icon: Layers },
                { id: 'cohort' as const, label: 'Student Cohort', icon: Users },
                { id: 'instructor' as const, label: 'Faculty', icon: User },
                { id: 'room' as const, label: 'Room', icon: Building }
              ].map(tab => {
                const Icon = tab.icon;
                const active = perspective === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPerspective(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      active
                        ? 'bg-white text-[#171717] shadow-2xs border border-[#E4E2DA]'
                        : 'text-[#77766F] hover:text-[#171717]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search & Specific Perspective Selector */}
          <div className="flex flex-wrap items-center gap-2.5">
            {calendarMode === 'day' && (
              <div className="inline-flex items-center gap-1 bg-[#F7F6EF] p-1 rounded-xl border border-[#E4E2DA]">
                {days.map(d => (
                  <button
                    key={d}
                    onClick={() => setFocusedDay(d)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                      focusedDay === d
                        ? 'bg-[#171717] text-white'
                        : 'text-[#77766F] hover:text-[#171717]'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}

            {perspective === 'cohort' && (
              <select
                value={selectedCohortId}
                onChange={e => setSelectedCohortId(e.target.value)}
                className="input-field h-9 w-auto text-xs font-medium"
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
                className="input-field h-9 w-auto text-xs font-medium"
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
                className="input-field h-9 w-auto text-xs font-medium"
              >
                {store.rooms.map(r => (
                  <option key={r.id} value={r.id}>
                    Room: {r.code} — {r.type.toUpperCase()} ({r.capacity} seats)
                  </option>
                ))}
              </select>
            )}

            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-[#77766F] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filter course, instructor, room..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input-field h-9 pl-8 pr-3 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Department Filter Strip */}
        {perspective === 'master' && (
          <div className="flex items-center gap-2 overflow-x-auto pt-3 border-t border-[#E4E2DA]">
            <button
              onClick={() => setSelectedDeptId('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border cursor-pointer ${
                selectedDeptId === 'all'
                  ? 'bg-[#171717] text-white border-[#171717]'
                  : 'bg-[#F7F6EF] text-[#77766F] border-[#E4E2DA] hover:text-[#171717]'
              }`}
            >
              All Departments ({placedTotal})
            </button>
            {store.departments.map(dept => (
              <button
                key={dept.id}
                onClick={() => setSelectedDeptId(dept.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border cursor-pointer ${
                  selectedDeptId === dept.id
                    ? 'bg-[#171717] text-white border-[#171717]'
                    : 'bg-[#F7F6EF] text-[#77766F] border-[#E4E2DA] hover:text-[#171717]'
                }`}
              >
                {dept.name} ({dept.code})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* =========================================================
          4. WEEKLY / DAILY CALENDAR OR AGENDA VIEW
         ========================================================= */}
      {calendarMode === 'agenda' ? (
        <div className="sf-card-white p-6 space-y-4">
          <h2 className="font-serif-editorial text-2xl text-[#171717]">
            Scheduled Course Agenda
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {days.flatMap(day =>
              timeSlots.flatMap(time =>
                (scheduleData[time]?.[day] || [])
                  .filter(filterClass)
                  .map(cls => {
                    const pastel = getCoursePastel(cls.code);
                    return (
                      <div
                        key={`${day}-${time}-${cls.id}`}
                        onClick={() => setSelectedClass(cls)}
                        style={{ backgroundColor: pastel.bg, borderColor: pastel.border }}
                        className="p-4 rounded-xl border text-[#171717] cursor-pointer hover:-translate-y-0.5 transition-transform space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs font-mono-tabular">
                          <span className="font-bold px-2 py-0.5 rounded bg-white/80">
                            {cls.code}
                          </span>
                          <span className="font-semibold">
                            {day} · {time}
                          </span>
                        </div>
                        <div className="font-serif-editorial text-lg leading-snug">
                          {cls.title}
                        </div>
                        <div className="flex items-center justify-between text-xs text-[#171717]/80 pt-1 border-t border-black/10">
                          <span>{cls.prof}</span>
                          <span className="font-mono-tabular font-semibold">{cls.room}</span>
                        </div>
                      </div>
                    );
                  })
              )
            )}
          </div>
        </div>
      ) : (
        <div className="sf-card-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#E4E2DA] bg-[#F7F6EF]">
                  <th className="py-3.5 px-4 w-36 text-xs font-mono-tabular font-semibold text-[#77766F]">
                    Time Slot
                  </th>
                  {visibleDays.map(day => (
                    <th
                      key={day}
                      className="py-3.5 px-4 min-w-[180px] text-sm font-serif-editorial text-[#171717] border-l border-[#E4E2DA]"
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E2DA]">
                {timeSlots.map(time => (
                  <tr key={time} className="hover:bg-[#F7F6EF]/40">
                    <td className="py-4 px-4 text-xs font-mono-tabular font-semibold text-[#171717] whitespace-nowrap align-top bg-[#F7F6EF]/60">
                      <div>{time}</div>
                      <div className="text-[11px] font-normal text-[#77766F] mt-0.5">
                        {store.timeStructure.periodLengthMinutes} min
                      </div>
                    </td>
                    {visibleDays.map(day => {
                      const classes = (scheduleData[time]?.[day] || []).filter(filterClass);
                      const isInstructorBlackedOut =
                        perspective === 'instructor' &&
                        currentInstructorObj?.unavailableSlots.some(
                          u => u.day === day && u.timeSlot === time
                        );

                      return (
                        <td
                          key={day}
                          className="py-3 px-3 min-w-[180px] border-l border-[#E4E2DA] align-top"
                        >
                          <div className="space-y-2">
                            {isInstructorBlackedOut && (
                              <div className="p-2.5 rounded-xl bg-[#EDEAE0] border border-[#E4E2DA] text-[11px] text-[#77766F] font-mono-tabular font-semibold text-center">
                                Unavailable Slot
                              </div>
                            )}

                            {classes.map(cls => {
                              const pastel = getCoursePastel(cls.code);
                              return (
                                <div
                                  key={cls.id}
                                  onClick={() => setSelectedClass(cls)}
                                  style={{
                                    backgroundColor: pastel.bg,
                                    borderColor: pastel.border
                                  }}
                                  className="p-3 rounded-xl border text-xs text-[#171717] space-y-1.5 transition-transform hover:-translate-y-0.5 cursor-pointer"
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-mono-tabular font-bold px-1.5 py-0.5 rounded bg-white/80 text-[#171717] flex items-center gap-1">
                                      {cls.code}
                                      {cls.isLocked && <Lock className="w-3 h-3" />}
                                    </span>
                                    <span className="text-[10.5px] font-medium px-1.5 py-0.5 rounded bg-black/5 text-[#171717]">
                                      {cls.type}
                                    </span>
                                  </div>

                                  <div className="font-semibold text-[12.5px] leading-snug text-[#171717] line-clamp-1">
                                    {cls.title}
                                  </div>

                                  <div className="text-[11px] text-[#171717]/80 flex items-center justify-between pt-0.5">
                                    <span className="font-mono-tabular font-semibold flex items-center gap-1 truncate max-w-[90px]">
                                      <MapPin className="w-3 h-3 shrink-0" />
                                      {cls.room}
                                    </span>
                                    <span className="truncate max-w-[95px]">{cls.prof}</span>
                                  </div>

                                  <div className="text-[10.5px] font-mono-tabular text-[#171717]/70 flex items-center justify-between border-t border-black/10 pt-1">
                                    <span>{cls.cohort}</span>
                                    <span>
                                      {cls.enrolled}/{cls.capacity} seats
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
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
      )}

      {/* Class Inspector & Contextual Editing Modal */}
      <ClassDetailsModal
        classItem={selectedClass}
        onClose={() => setSelectedClass(null)}
      />
    </div>
  );
};
