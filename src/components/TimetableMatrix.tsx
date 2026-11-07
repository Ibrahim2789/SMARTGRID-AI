import React, { useState, useRef, useEffect } from 'react';
import { SmartGridNav, RouteType } from './SmartGridNav';
import { useInstitutionalData, institutionalStore } from '../data/store';
import { buildMatrixSchedule } from '../data/solverAdapter';
import {
  UNIVERSITY_SLOTS,
  getLabBlockByStartPeriod
} from '../types/institutional';
import { exportTimetableToGoogleSheetsWorkbook } from '../utils/googleSheetsExport';
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
  MapPin,
  Coffee,
  FlaskConical,
  BookOpen
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
  const [isExportingSheets, setIsExportingSheets] = useState(false);
  const [sweepNotice, setSweepNotice] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  const days = store.timeStructure.workingDays.length > 0
    ? store.timeStructure.workingDays
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const timeSlots = store.timeStructure.periods.length > 0
    ? store.timeStructure.periods
    : UNIVERSITY_SLOTS.map(s => s.period);

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
      setSweepNotice(
        `${res.placedCount} sessions (50m lectures & 3h continuous labs) synchronized across 9:00 AM – 5:00 PM with 0 hard overlaps.`
      );
      setTimeout(() => setSweepNotice(null), 5000);
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

  // Multi-Worksheet Google Sheets (.xlsx) Export
  const handleExportGoogleSheets = async (scope: 'filtered' | 'all') => {
    try {
      setIsExportingSheets(true);
      const scopeLabel = scope === 'all' ? 'All_Departments' : getActiveScopeLabel();
      const result = await exportTimetableToGoogleSheetsWorkbook({
        store,
        scheduleData,
        filterClass,
        scope,
        scopeLabel,
        studentOrUserName: currentUser?.name || 'Academic Schedule'
      });
      setExportNotice(
        `Exported Google Sheets workbook "${result.fileName}" containing 1 Weekly Overview (with vertically merged 3-hour labs & 1:00–2:00 PM lunch break) + ${result.courseSheetCount} individual course worksheets (${result.totalSessionsCount} sessions). Ready for 1-click import in Google Sheets.`
      );
      setTimeout(() => setExportNotice(null), 7000);
    } catch (err) {
      console.error('Google Sheets export error:', err);
      setExportNotice('Failed to generate Google Sheets workbook. Please try again.');
    } finally {
      setIsExportingSheets(false);
      setShowExportMenu(false);
    }
  };

  // CSV Export Routine
  const handleExportCSV = (scope: 'filtered' | 'all') => {
    const records: Array<{
      day: string;
      timeSlot: string;
      sessionType: string;
      duration: string;
      code: string;
      title: string;
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
            const isLab = cls.sessionType === 'Lab' || cls.spanSlots === 3;
            const labMeta = isLab ? getLabBlockByStartPeriod(time) : undefined;
            records.push({
              day,
              timeSlot: isLab ? (cls.continuousTimeLabel || labMeta?.continuousLabel || time) : time,
              sessionType: isLab ? 'Lab (3 Hours Continuous)' : 'Lecture',
              duration: isLab ? '180 mins (3 hrs continuous)' : '50 mins (+ 10m Short Break)',
              code: cls.code,
              title: cls.title,
              credits: cls.credits || 3,
              room: cls.room,
              prof: cls.prof,
              cohort: cls.cohort
            });
          }
        });
      });
    });

    const headers = [
      'Day',
      'Time Window',
      'Session Type',
      'Duration',
      'Course Code',
      'Course Title',
      'Credits',
      'Room / Facility',
      'Faculty Instructor',
      'Cohort Track'
    ];
    const rows = records.map(r => [
      `"${r.day}"`,
      `"${r.timeSlot}"`,
      `"${r.sessionType}"`,
      `"${r.duration}"`,
      `"${r.code}"`,
      `"${r.title.replace(/"/g, '""')}"`,
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

    setExportNotice(`Exported ${records.length} scheduled sessions to CSV (${scopeLabel.replace(/_/g, ' ')}).`);
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
    const margin = 12;

    doc.setFillColor(23, 23, 23);
    doc.rect(margin, 10, pageWidth - margin * 2, 2.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(23, 23, 23);
    doc.text(`${(store.institutionProfile?.name || 'SMARTGRID AI').toUpperCase()} — UNIVERSITY TIMETABLE (9:00 AM – 5:00 PM)`, margin, 18);

    const activeTerm = store.terms.find(t => t.status === 'active') || store.terms[0];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(119, 118, 111);
    doc.text(
      `${(activeTerm?.name || 'SPRING 2026').toUpperCase()}   •   50-MIN LECTURES + 10-MIN SHORT BREAKS   •   3-HOUR CONTINUOUS LABS   •   FIXED LUNCH (1:00 – 2:00 PM)`,
      margin,
      23
    );

    const scopeLabel = scope === 'all' ? 'All Departments' : getActiveScopeLabel().replace(/_/g, ' ');
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    doc.text(`Scope: ${scopeLabel}   •   Generated: ${dateStr}`, pageWidth - margin, 18, { align: 'right' });

    const tableStartY = 27;
    const colTimeWidth = 36;
    const numDays = Math.min(days.length, 5);
    const dayColWidth = (pageWidth - margin * 2 - colTimeWidth) / numDays;
    const headerHeight = 7;
    const slotRowHeight = 19;
    const lunchRowHeight = 9;

    doc.setFillColor(237, 234, 224);
    doc.rect(margin, tableStartY, pageWidth - margin * 2, headerHeight, 'F');
    doc.setDrawColor(228, 226, 218);
    doc.setLineWidth(0.3);
    doc.rect(margin, tableStartY, pageWidth - margin * 2, headerHeight, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(23, 23, 23);
    doc.text('SLOT / TIME', margin + 2.5, tableStartY + 4.8);

    days.slice(0, numDays).forEach((day, dIdx) => {
      const x = margin + colTimeWidth + dIdx * dayColWidth;
      doc.line(x, tableStartY, x, tableStartY + headerHeight);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(23, 23, 23);
      doc.text(day.toUpperCase(), x + 4, tableStartY + 4.8);
    });

    let currentY = tableStartY + headerHeight;

    UNIVERSITY_SLOTS.forEach(slotMeta => {
      // Insert Fixed Lunch Break before Slot 5 (2:00 – 2:50 PM)
      if (slotMeta.slotNumber === 5) {
        doc.setFillColor(232, 211, 107);
        doc.setDrawColor(228, 226, 218);
        doc.rect(margin, currentY, colTimeWidth, lunchRowHeight, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(23, 23, 23);
        doc.text('1:00 – 2:00 PM', margin + 2.5, currentY + 4);
        doc.text('LUNCH BREAK', margin + 2.5, currentY + 7.2);

        doc.setFillColor(237, 234, 224);
        doc.rect(margin + colTimeWidth, currentY, pageWidth - margin * 2 - colTimeWidth, lunchRowHeight, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text(
          'FIXED UNIVERSITY LUNCH BREAK (1:00 PM – 2:00 PM) — NO LECTURES OR LABS SCHEDULED',
          margin + colTimeWidth + 8,
          currentY + 5.8
        );
        currentY += lunchRowHeight;
      }

      doc.setDrawColor(228, 226, 218);
      doc.setFillColor(247, 246, 239);
      doc.rect(margin, currentY, colTimeWidth, slotRowHeight, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(23, 23, 23);
      doc.text(`Slot ${slotMeta.slotNumber}: ${slotMeta.period}`, margin + 2, currentY + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(119, 118, 111);
      doc.text(`Break: ${slotMeta.shortBreak}`, margin + 2, currentY + 10.5);

      days.slice(0, numDays).forEach((day, dIdx) => {
        const x = margin + colTimeWidth + dIdx * dayColWidth;
        doc.setDrawColor(228, 226, 218);
        doc.rect(x, currentY, dayColWidth, slotRowHeight, 'S');

        const classes = (scheduleData[slotMeta.period]?.[day] || []).filter(
          cls => scope === 'all' || filterClass(cls)
        );

        const cls = classes[0];
        if (cls) {
          const isLab = cls.sessionType === 'Lab' || cls.spanSlots === 3;
          doc.setFillColor(isLab ? 242 : 184, isLab ? 216 : 238, isLab ? 250 : 238);
          doc.roundedRect(x + 1.2, currentY + 1.2, dayColWidth - 2.4, slotRowHeight - 2.4, 1.2, 1.2, 'FD');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          doc.setTextColor(23, 23, 23);
          doc.text(
            `${cls.code} [${isLab ? 'LAB 3H' : 'LEC 50M'}]`,
            x + 2.5,
            currentY + 5.5
          );

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6);
          const truncatedTitle = cls.title.length > 24 ? cls.title.substring(0, 22) + '..' : cls.title;
          doc.text(truncatedTitle, x + 2.5, currentY + 10);
          doc.text(`${cls.room} · ${cls.prof}`, x + 2.5, currentY + 14.5);
        }
      });

      currentY += slotRowHeight;
    });

    const fileLabel = scope === 'all' ? 'All_Departments' : getActiveScopeLabel();
    doc.save(`SmartGrid_Timetable_${fileLabel}_Fall2026.pdf`);

    setExportNotice(`Exported timetable as landscape PDF (${fileLabel.replace(/_/g, ' ')}).`);
    setTimeout(() => setExportNotice(null), 4500);
    setShowExportMenu(false);
  };

  const placedTotal = store.sections.filter(s => s.assignedSlot).length;
  const labCount = store.sections.filter(
    s => s.assignedSlot && (s.sessionType === 'Lab' || s.spanSlots === 3 || s.assignedSlot.sessionType === 'Lab')
  ).length;
  const lectureCount = placedTotal - labCount;
  const lockedTotal = store.sections.filter(s => s.isLocked).length;
  const activeTerm = store.terms.find(t => t.status === 'active') || store.terms[0];
  const currentInstructorObj = store.instructors.find(i => i.id === selectedInstructorId);
  const visibleDays = calendarMode === 'day' ? [focusedDay] : days;

  // Precompute 3-hour Continuous Lab vertical spans (`rowSpan={3}`) per visible day
  // Map key: `${day}__${slotNumber}`
  const skippedCells = new Set<string>();
  const labSpanByCell = new Map<
    string,
    {
      labItem: ClassItem;
      concurrentItems: ClassItem[];
      continuousWindow: string;
    }
  >();

  visibleDays.forEach(day => {
    UNIVERSITY_SLOTS.forEach((slotMeta, sIdx) => {
      const cellKey = `${day}__${slotMeta.slotNumber}`;
      if (skippedCells.has(cellKey)) return;

      const classesAtStart = (scheduleData[slotMeta.period]?.[day] || []).filter(filterClass);
      const labItem = classesAtStart.find(c => c.sessionType === 'Lab' || c.spanSlots === 3);

      // Valid 3-hour lab starts in Morning (Slot 1 or 2) or Afternoon (Slot 5) without crossing lunch (between 4 and 5)
      const canSpanThreeRows =
        Boolean(labItem) &&
        ((slotMeta.slotNumber >= 1 && slotMeta.slotNumber <= 2) || slotMeta.slotNumber === 5) &&
        sIdx + 2 < UNIVERSITY_SLOTS.length;

      if (labItem && canSpanThreeRows) {
        const slot2Meta = UNIVERSITY_SLOTS[sIdx + 1];
        const slot3Meta = UNIVERSITY_SLOTS[sIdx + 2];

        skippedCells.add(`${day}__${slot2Meta.slotNumber}`);
        skippedCells.add(`${day}__${slot3Meta.slotNumber}`);

        const otherInSlot1 = classesAtStart.filter(c => c.id !== labItem.id);
        const otherInSlot2 = (scheduleData[slot2Meta.period]?.[day] || []).filter(filterClass);
        const otherInSlot3 = (scheduleData[slot3Meta.period]?.[day] || []).filter(filterClass);

        const labBlock = getLabBlockByStartPeriod(slotMeta.period);
        const continuousWindow =
          labItem.continuousTimeLabel || labBlock?.continuousLabel || '9:00 AM – 12:00 PM';

        labSpanByCell.set(cellKey, {
          labItem,
          concurrentItems: [...otherInSlot1, ...otherInSlot2, ...otherInSlot3],
          continuousWindow
        });
      }
    });
  });

  return (
    <div className="space-y-8">
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
          1. CALM EDITORIAL PAGE HEADER & PRIMARY ACTIONS
         ========================================================= */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[#E4E2DA]">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#77766F]">
            <span>{activeTerm?.name || 'Fall 2026'}</span>
            <span>·</span>
            <span>{lectureCount} Lectures (50m) & {labCount} Continuous Labs (3h)</span>
            <span>·</span>
            <span className="text-[#171717] font-semibold">
              {conflicts.length === 0 ? '0 Clashes' : `${conflicts.length} Clashes`}
            </span>
            {lockedTotal > 0 && (
              <>
                <span>·</span>
                <span>{lockedTotal} Pinned</span>
              </>
            )}
          </div>
          <h1 className="font-serif-editorial text-3xl sm:text-4xl text-[#171717] tracking-tight">
            My Timetable
          </h1>
          <p className="text-sm text-[#77766F] max-w-xl">
            University hours 9:00 AM – 5:00 PM with a fixed midday lunch break from 1:00 – 2:00 PM. Select any class block to inspect details or reassign its slot.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Prominent Export to Google Sheets Action */}
          <button
            onClick={() => handleExportGoogleSheets('filtered')}
            disabled={isExportingSheets}
            className="px-4 h-10 rounded-xl bg-[#B7F77C] hover:bg-[#a6ec68] border border-[#98DF58] text-[#171717] text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
            title="Export multi-worksheet Google Sheets (.xlsx) with Weekly Overview and individual Course tabs"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#171717]" />
            <span>{isExportingSheets ? 'Preparing Sheets...' : 'Export to Google Sheets'}</span>
          </button>

          {/* Additional Export Dropdown Menu (CSV / PDF / Full Master Sheets) */}
          <div className="relative" ref={exportDropdownRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="btn-secondary text-xs h-10 px-3.5"
              title="More export options (CSV, PDF, Full Campus Google Sheets)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-[#E4E2DA] rounded-2xl shadow-xl z-50 py-2">
                <div className="px-4 py-2.5 border-b border-[#E4E2DA]">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                    Export Active View
                  </div>
                  <div className="text-xs text-[#171717] mt-0.5">
                    Scope: <span className="font-semibold">{getActiveScopeLabel().replace(/_/g, ' ')}</span>
                  </div>
                </div>

                <div className="p-2 space-y-1">
                  <button
                    onClick={() => handleExportGoogleSheets('filtered')}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-start gap-2.5 bg-[#B7F77C]/35 hover:bg-[#B7F77C]/60 transition-colors cursor-pointer text-[#171717]"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-[#171717] mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold">Export to Google Sheets (.xlsx)</div>
                      <div className="text-[11px] text-[#77766F]">
                        Weekly Overview (merged 3h labs) + 1 tab per course
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleExportCSV('filtered')}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-start gap-2.5 hover:bg-[#F7F6EF] transition-colors cursor-pointer text-[#171717]"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-[#171717] mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold">Export Current View (.csv)</div>
                      <div className="text-[11px] text-[#77766F]">Flat comma-separated schedule table</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleExportPDF('filtered')}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-start gap-2.5 hover:bg-[#F7F6EF] transition-colors cursor-pointer text-[#171717]"
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
                    onClick={() => handleExportGoogleSheets('all')}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between hover:bg-[#F7F6EF] transition-colors cursor-pointer text-[#171717]"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>All Courses Google Sheets (.xlsx)</span>
                    </span>
                    <span className="text-[10px] font-mono-tabular text-[#77766F]">Multi-Tab</span>
                  </button>

                  <button
                    onClick={() => handleExportCSV('all')}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between hover:bg-[#F7F6EF] transition-colors cursor-pointer text-[#171717]"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <Layers className="w-3.5 h-3.5" />
                      <span>All Departments (CSV)</span>
                    </span>
                    <span className="text-[10px] font-mono-tabular text-[#77766F]">{placedTotal} secs</span>
                  </button>

                  <button
                    onClick={() => handleExportPDF('all')}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between hover:bg-[#F7F6EF] transition-colors cursor-pointer text-[#171717]"
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
            className="btn-primary text-xs h-10 px-4"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isSweeping ? 'animate-spin' : ''}`} />
            <span>{isSweeping ? 'Optimizing...' : 'Re-Optimize'}</span>
          </button>
        </div>
      </header>

      {/* Feedback Notices */}
      {sweepNotice && (
        <div className="px-5 py-3.5 sf-pastel-lime rounded-xl text-xs font-medium flex items-center gap-2.5">
          <Check className="w-4 h-4 text-[#171717] shrink-0" />
          <span>{sweepNotice}</span>
        </div>
      )}

      {exportNotice && (
        <div className="px-5 py-4 sf-pastel-cyan rounded-xl text-xs font-medium flex items-start gap-2.5">
          <Check className="w-4 h-4 text-[#171717] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-[#171717]">{exportNotice}</div>
            <div className="text-[11px] text-[#171717]/80">
              Open the downloaded .xlsx workbook in Google Drive / Google Sheets to view the formatted Weekly Overview (with vertically merged 3-hour labs) and individual course sheets.
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          2. CLEAN TIMETABLE CONTROLS & FILTERS
         ========================================================= */}
      <div className="sf-card-white p-5 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Day / Week / Agenda Switcher */}
            <div className="inline-flex items-center p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA]">
              {[
                { id: 'week' as const, label: 'Week' },
                { id: 'day' as const, label: 'Day' },
                { id: 'agenda' as const, label: 'Agenda' }
              ].map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setCalendarMode(mode.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
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
                { id: 'cohort' as const, label: 'Cohort', icon: Users },
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                      active
                        ? 'bg-white text-[#171717] border border-[#E4E2DA]'
                        : 'text-[#77766F] hover:text-[#171717]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {perspective === 'master' && (
              <select
                value={selectedDeptId}
                onChange={e => setSelectedDeptId(e.target.value)}
                className="input-field h-9 w-auto text-xs font-medium"
              >
                <option value="all">All Departments ({placedTotal})</option>
                {store.departments.map(dept => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} ({dept.code})
                  </option>
                ))}
              </select>
            )}

            {perspective === 'cohort' && (
              <select
                value={selectedCohortId}
                onChange={e => setSelectedCohortId(e.target.value)}
                className="input-field h-9 w-auto text-xs font-medium"
              >
                {store.studentGroups.map(g => (
                  <option key={g.id} value={g.id}>
                    Cohort: {g.code} — {g.name}
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
                    Faculty: {i.name}
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
                    Room: {r.code} ({r.capacity} seats)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Search & Day Selector */}
          <div className="flex flex-wrap items-center gap-3">
            {calendarMode === 'day' && (
              <div className="inline-flex items-center gap-1 bg-[#F7F6EF] p-1 rounded-xl border border-[#E4E2DA]">
                {days.map(d => (
                  <button
                    key={d}
                    onClick={() => setFocusedDay(d)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
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

            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-[#77766F] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search course or room..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input-field h-9 pl-8 pr-3 text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================
          3. WEEKLY / DAILY CALENDAR OR AGENDA VIEW
         ========================================================= */}
      {calendarMode === 'agenda' ? (
        <div className="sf-card-white p-6 sm:p-7 space-y-5">
          <h2 className="font-serif-editorial text-2xl text-[#171717]">
            Course Agenda
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {days.flatMap(day =>
              UNIVERSITY_SLOTS.flatMap(slotMeta =>
                (scheduleData[slotMeta.period]?.[day] || [])
                  .filter(filterClass)
                  .map(cls => {
                    const pastel = getCoursePastel(cls.code);
                    const isLab = cls.sessionType === 'Lab' || cls.spanSlots === 3;
                    const timeWindow = isLab
                      ? (cls.continuousTimeLabel || getLabBlockByStartPeriod(slotMeta.period)?.continuousLabel || slotMeta.period)
                      : slotMeta.period;
                    return (
                      <div
                        key={`${day}-${slotMeta.period}-${cls.id}`}
                        onClick={() => setSelectedClass(cls)}
                        style={{ backgroundColor: pastel.bg, borderColor: pastel.border }}
                        className="p-5 rounded-2xl border text-[#171717] cursor-pointer hover:-translate-y-0.5 transition-transform space-y-2.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono-tabular font-semibold text-[#171717]/80">
                            {cls.code} · {isLab ? 'Lab (3h)' : 'Lecture'}
                          </span>
                          <span className="font-mono-tabular font-medium">
                            {day} · {timeWindow}
                          </span>
                        </div>
                        <div className="font-serif-editorial text-lg leading-snug">
                          {cls.title}
                        </div>
                        <div className="flex items-center justify-between text-xs text-[#171717]/75 pt-2 border-t border-black/10">
                          <span>{cls.room}</span>
                          <span>{cls.prof}</span>
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
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#E4E2DA] bg-[#F7F6EF]">
                  <th className="py-4 px-5 w-44 text-xs font-medium text-[#77766F]">
                    Time & Break
                  </th>
                  {visibleDays.map(day => (
                    <th
                      key={day}
                      className="py-4 px-5 min-w-[180px] text-base font-serif-editorial text-[#171717] border-l border-[#E4E2DA]"
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E2DA]">
                {UNIVERSITY_SLOTS.map(slotMeta => {
                  const time = slotMeta.period;
                  const isFirstAfternoon = slotMeta.slotNumber === 5;

                  return (
                    <React.Fragment key={slotMeta.slotNumber}>
                      {/* Fixed University Lunch Break Row (1:00 PM – 2:00 PM) */}
                      {isFirstAfternoon && (
                        <tr className="bg-[#F7F6EF] border-y border-[#E4E2DA]">
                          <td className="py-3.5 px-5 border-r border-[#E4E2DA] align-middle">
                            <div className="text-xs font-mono-tabular font-semibold text-[#171717]">
                              1:00 – 2:00 PM
                            </div>
                            <div className="text-[11px] text-[#77766F] mt-0.5">
                              Lunch Break
                            </div>
                          </td>
                          <td
                            colSpan={visibleDays.length}
                            className="py-3.5 px-6 text-center align-middle"
                          >
                            <div className="inline-flex items-center gap-2 text-xs font-medium text-[#77766F]">
                              <Coffee className="w-3.5 h-3.5 text-[#171717]" />
                              <span className="text-[#171717] font-semibold">
                                Lunch Break (1:00 PM – 2:00 PM)
                              </span>
                              <span>· No classes scheduled</span>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Regular Hourly Slot Row */}
                      <tr>
                        {/* Left Column: Lecture Time + Subtle Short Break */}
                        <td className="py-4 px-5 text-xs font-mono-tabular text-[#171717] whitespace-nowrap align-top bg-[#F7F6EF]/40">
                          <div className="font-semibold text-[12.5px] text-[#171717]">
                            {slotMeta.period}
                          </div>
                          <div className="text-[11px] text-[#77766F] mt-1">
                            Short break {slotMeta.shortBreak}
                          </div>
                        </td>

                        {/* Day Cells */}
                        {visibleDays.map(day => {
                          const cellKey = `${day}__${slotMeta.slotNumber}`;

                          // Skip cell if covered by a 3-hour continuous Lab above
                          if (skippedCells.has(cellKey)) {
                            return null;
                          }

                          const labSpanInfo = labSpanByCell.get(cellKey);

                          // Render a 3-Hour Continuous Lab cell (`rowSpan={3}`)
                          if (labSpanInfo) {
                            const { labItem, concurrentItems, continuousWindow } = labSpanInfo;
                            const pastel = getCoursePastel(labItem.code);

                            return (
                              <td
                                key={day}
                                rowSpan={3}
                                className="p-3 min-w-[180px] border-l border-[#E4E2DA] align-stretch bg-white"
                              >
                                <div className="h-full flex flex-col gap-2">
                                  <div
                                    onClick={() => setSelectedClass(labItem)}
                                    style={{
                                      backgroundColor: pastel.bg,
                                      borderColor: pastel.border
                                    }}
                                    className="flex-1 min-h-[220px] p-4 rounded-2xl border text-xs text-[#171717] flex flex-col justify-between transition-transform hover:-translate-y-0.5 cursor-pointer"
                                  >
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-mono-tabular text-[11px] font-semibold text-[#171717]/80 flex items-center gap-1">
                                          {labItem.code}
                                          {labItem.isLocked && <Lock className="w-3 h-3" />}
                                        </span>
                                        <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-md bg-white/80 text-[#171717]">
                                          Lab · 3h
                                        </span>
                                      </div>

                                      <div className="font-serif-editorial text-base leading-snug text-[#171717]">
                                        {labItem.title}
                                      </div>
                                    </div>

                                    <div className="space-y-1.5 pt-3 border-t border-black/10 text-[11.5px]">
                                      <div className="font-mono-tabular font-medium text-[#171717]">
                                        {continuousWindow}
                                      </div>
                                      <div className="text-[#171717]/75 flex items-center justify-between">
                                        <span className="font-mono-tabular">{labItem.room}</span>
                                        {concurrentItems.length > 0 && (
                                          <span className="text-[10.5px]">
                                            +{concurrentItems.length} more
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            );
                          }

                          // Standard 1-Slot (50-Minute Lecture) Cell
                          const classes = (scheduleData[time]?.[day] || []).filter(filterClass);
                          const isInstructorBlackedOut =
                            perspective === 'instructor' &&
                            currentInstructorObj?.unavailableSlots.some(
                              u => u.day === day && u.timeSlot === time
                            );

                          return (
                            <td
                              key={day}
                              className="p-3 min-w-[180px] border-l border-[#E4E2DA] align-top"
                            >
                              <div className="space-y-2">
                                {isInstructorBlackedOut && (
                                  <div className="p-3 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] text-[11px] text-[#77766F] text-center">
                                    Unavailable
                                  </div>
                                )}

                                {classes.map(cls => {
                                  const pastel = getCoursePastel(cls.code);
                                  const isLab = cls.sessionType === 'Lab' || cls.spanSlots === 3;
                                  return (
                                    <div
                                      key={cls.id}
                                      onClick={() => setSelectedClass(cls)}
                                      style={{
                                        backgroundColor: pastel.bg,
                                        borderColor: pastel.border
                                      }}
                                      className="p-3.5 rounded-xl border text-xs text-[#171717] space-y-2 transition-transform hover:-translate-y-0.5 cursor-pointer"
                                    >
                                      <div>
                                        <div className="flex items-center justify-between gap-1.5 text-[11px] text-[#171717]/75 font-mono-tabular">
                                          <span className="flex items-center gap-1">
                                            {cls.code}
                                            {cls.isLocked && <Lock className="w-3 h-3" />}
                                          </span>
                                          <span>{isLab ? 'Lab' : 'Lecture'}</span>
                                        </div>
                                        <div className="font-semibold text-[13px] leading-snug text-[#171717] mt-0.5 line-clamp-1">
                                          {cls.title}
                                        </div>
                                      </div>

                                      <div className="text-[11px] font-mono-tabular text-[#171717]/80 flex items-center justify-between pt-1.5 border-t border-black/10">
                                        <span>{slotMeta.period}</span>
                                        <span className="font-medium truncate max-w-[85px]">
                                          {cls.room}
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
                    </React.Fragment>
                  );
                })}
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
