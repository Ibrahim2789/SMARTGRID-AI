import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  Coffee,
  FileSpreadsheet,
  Menu,
  X,
  Sparkles,
  ChevronRight,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { motion, useReducedMotion, AnimatePresence } from 'motion/react';
import { useInstitutionalData } from '../data/store';
import { buildMatrixSchedule } from '../data/solverAdapter';
import { UNIVERSITY_SLOTS, getLabBlockByStartPeriod } from '../types/institutional';
import { ClassDetailsModal, ClassItem } from './ClassDetailsModal';
import { exportTimetableToGoogleSheetsWorkbook } from '../utils/googleSheetsExport';

interface PublicLandingPageProps {
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
}

const PASTEL_PALETTE = [
  { bg: '#B8EEEE', border: '#95DFDF' },
  { bg: '#F2D8FA', border: '#DFB9EC' },
  { bg: '#B8F2E6', border: '#93DEC9' },
  { bg: '#B7F77C', border: '#98DF58' },
  { bg: '#E8D36B', border: '#D4BC4C' }
];

function getCoursePastel(code: string) {
  const clean = code.replace(/-L$/i, '');
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
  }
  return PASTEL_PALETTE[hash % PASTEL_PALETTE.length];
}

const RevealSection: React.FC<{
  children: React.ReactNode;
  className?: string;
  delay?: number;
}> = ({ children, className = '', delay = 0 }) => {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.16 }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export const PublicLandingPage: React.FC<PublicLandingPageProps> = ({ onOpenAuth }) => {
  const store = useInstitutionalData();
  const { scheduleData } = buildMatrixSchedule(store);
  const shouldReduceMotion = useReducedMotion();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);

  // Featured class sections for the interactive product demonstration
  const featuredSections = [
    store.studentGroups.find(g => g.code === '2K24-BEE-A'),
    store.studentGroups.find(g => g.code === '2K25-BSCS-A'),
    store.studentGroups.find(g => g.code === '2K24-BESE-A'),
    store.studentGroups.find(g => g.code === '2K25-BCE-A')
  ].filter(Boolean) as typeof store.studentGroups;

  const fallbackGroups =
    featuredSections.length > 0 ? featuredSections : store.studentGroups.slice(0, 4);

  const [activeDemoGroupId, setActiveDemoGroupId] = useState<string>(
    fallbackGroups[0]?.id || store.studentGroups[0]?.id || ''
  );

  // Problem Section interactive comparison toggle
  const [problemView, setProblemView] = useState<'conflict' | 'resolved'>('conflict');

  // Solution Section interactive optimization sweep feedback
  const [isOptimizingDemo, setIsOptimizingDemo] = useState(false);
  const [demoOptimized, setDemoOptimized] = useState(false);
  const [isExportingSample, setIsExportingSample] = useState(false);

  // How It Works active step highlight
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);

  const activeDemoGroup =
    store.studentGroups.find(g => g.id === activeDemoGroupId) || store.studentGroups[0];
  const activeDemoProg = store.programs.find(p => p.id === activeDemoGroup?.programId);
  const activeDemoDept = store.departments.find(d => d.id === activeDemoProg?.departmentId);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  const handleRunDemoOptimization = () => {
    setIsOptimizingDemo(true);
    setDemoOptimized(false);
    setTimeout(() => {
      setIsOptimizingDemo(false);
      setDemoOptimized(true);
      setTimeout(() => setDemoOptimized(false), 4500);
    }, 550);
  };

  const handleDownloadSampleSheets = async () => {
    if (!activeDemoGroup) return;
    try {
      setIsExportingSample(true);
      await exportTimetableToGoogleSheetsWorkbook({
        store,
        scheduleData,
        filterClass: cls => cls.studentGroupId === activeDemoGroup.id,
        scope: 'filtered',
        scopeLabel: `Class_${activeDemoGroup.code}`,
        studentOrUserName: 'Public Preview'
      });
    } finally {
      setIsExportingSample(false);
    }
  };

  // Precompute 3-hour continuous Lab rowSpans for the active demo class section
  const previewDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const skippedCells = new Set<string>();
  const labSpanByCell = new Map<
    string,
    {
      labItem: ClassItem;
      continuousWindow: string;
    }
  >();

  previewDays.forEach(day => {
    UNIVERSITY_SLOTS.forEach((slotMeta, sIdx) => {
      const cellKey = `${day}__${slotMeta.slotNumber}`;
      if (skippedCells.has(cellKey)) return;

      const classesAtStart = (scheduleData[slotMeta.period]?.[day] || []).filter(
        c => c.studentGroupId === activeDemoGroup?.id
      );
      const labItem = classesAtStart.find(c => c.sessionType === 'Lab' || c.spanSlots === 3);

      const canSpanThreeRows =
        Boolean(labItem) &&
        ((slotMeta.slotNumber >= 1 && slotMeta.slotNumber <= 2) || slotMeta.slotNumber === 5) &&
        sIdx + 2 < UNIVERSITY_SLOTS.length;

      if (labItem && canSpanThreeRows) {
        const slot2Meta = UNIVERSITY_SLOTS[sIdx + 1];
        const slot3Meta = UNIVERSITY_SLOTS[sIdx + 2];
        skippedCells.add(`${day}__${slot2Meta.slotNumber}`);
        skippedCells.add(`${day}__${slot3Meta.slotNumber}`);

        const labBlock = getLabBlockByStartPeriod(slotMeta.period);
        const continuousWindow =
          labItem.continuousTimeLabel ||
          labBlock?.continuousLabel ||
          (day === 'Fri' && slotMeta.slotNumber === 5 ? '2:30 PM – 4:55 PM' : '9:00 AM – 11:50 AM');

        labSpanByCell.set(cellKey, {
          labItem,
          continuousWindow
        });
      }
    });
  });

  const howItWorksSteps = [
    {
      number: '01',
      title: 'Configure Academic Catalog, Rooms & Cohorts',
      summary:
        'Define university departments, degree programs, lecture halls, specialized laboratories, faculty rosters, and student sections.',
      detailTitle: '4 Departments · 45 Class Sections · 38 Rooms & Labs',
      detailItems: [
        'Electrical, Computer, Software Engineering & Computer Science cohorts (2K22–2K25)',
        'Dedicated lecture halls matched to section enrollment capacities',
        'Specialized laboratories reserved for 3-hour practical coursework'
      ],
      accentBg: '#B8EEEE'
    },
    {
      number: '02',
      title: 'Enforce University Timing & Hard Constraints',
      summary:
        'Lock university-wide operating hours, fixed lunch windows, 50-minute lecture intervals, and uninterrupted 3-hour laboratory blocks.',
      detailTitle: '9:00 AM – 5:00 PM Academic Day Structure',
      detailItems: [
        'Morning Session (Slots 1–4: 9:00 AM – 1:00 PM) with 10-minute short breaks',
        'Fixed University Lunch & Prayer Break (1:00 PM – 2:00 PM) protected across all cohorts',
        'Afternoon Session (Slots 5–7: 2:00 PM – 5:00 PM, Friday shift 2:30 PM – 4:55 PM)'
      ],
      accentBg: '#F2D8FA'
    },
    {
      number: '03',
      title: 'Generate & Export Individual Class Timetables',
      summary:
        'Synthesize zero-clash weekly schedules for every class section and export landscape-formatted Google Sheets workbooks in one click.',
      detailTitle: 'Weekly Overview + 1 Worksheet Per Class/Section',
      detailItems: [
        'Instant section-by-section timetable switching on a zero-scroll weekly grid',
        'Vertically merged 3-hour continuous lab blocks on screen and in spreadsheets',
        'Print-ready landscape Google Sheets (.xlsx) and PDF exports fitted to a single page'
      ],
      accentBg: '#B7F77C'
    }
  ];

  return (
    <div className="min-h-screen bg-[#F7F6EF] text-[#171717] antialiased selection:bg-[#B8EEEE] selection:text-[#171717]">
      {/* Interactive Session Inspector Modal */}
      <ClassDetailsModal
        classItem={selectedClass}
        onClose={() => setSelectedClass(null)}
      />

      {/* =====================================================================
          STICKY NAVIGATION HEADER
         ===================================================================== */}
      <header className="sticky top-0 z-50 h-16 bg-[#F7F6EF]/92 backdrop-blur-md border-b border-[#E4E2DA] px-4 sm:px-8">
        <div className="max-w-[1280px] mx-auto h-full flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="#top"
            onClick={e => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: shouldReduceMotion ? 'auto' : 'smooth' });
            }}
            className="flex items-center gap-2.5 text-[#171717] whitespace-nowrap shrink-0"
          >
            <span className="w-8 h-8 rounded-lg bg-[#171717] text-white font-serif-editorial text-lg flex items-center justify-center">
              S
            </span>
            <span className="font-serif-editorial text-xl tracking-tight">SmartGrid AI</span>
          </a>

          {/* Zone 2: Concise Single-Line Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#77766F]">
            <button
              type="button"
              onClick={() => scrollToSection('problem')}
              className="hover:text-[#171717] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              The Problem
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('solution')}
              className="hover:text-[#171717] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Product Demo
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('capabilities')}
              className="hover:text-[#171717] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Capabilities
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="hover:text-[#171717] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              How It Works
            </button>
          </nav>

          {/* Zone 3: Auth Actions */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onOpenAuth('signin')}
              className="px-3.5 py-2 text-sm font-medium text-[#171717] hover:text-[#77766F] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('signup')}
              className="btn-primary h-10 px-5 text-sm whitespace-nowrap shrink-0"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg border border-[#E4E2DA] bg-white text-[#171717] cursor-pointer"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="md:hidden absolute top-16 left-0 right-0 bg-white border-b border-[#E4E2DA] px-6 py-5 space-y-3 shadow-lg"
            >
              <div className="flex flex-col space-y-2 text-sm font-medium text-[#171717]">
                <button
                  type="button"
                  onClick={() => scrollToSection('problem')}
                  className="text-left py-2 hover:text-[#77766F]"
                >
                  The Problem
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('solution')}
                  className="text-left py-2 hover:text-[#77766F]"
                >
                  Product Demo
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('capabilities')}
                  className="text-left py-2 hover:text-[#77766F]"
                >
                  Capabilities
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('how-it-works')}
                  className="text-left py-2 hover:text-[#77766F]"
                >
                  How It Works
                </button>
              </div>
              <div className="pt-3 border-t border-[#E4E2DA] flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth('signin');
                  }}
                  className="btn-secondary w-full h-10 text-sm"
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth('signup');
                  }}
                  className="btn-primary w-full h-10 text-sm"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main id="top">
        {/* ===================================================================
            SECTION 1 — HERO (ONE CLEAR VALUE PROPOSITION & DOMINANT CTA)
           =================================================================== */}
        <section className="pt-14 pb-24 sm:pt-20 sm:pb-32 px-4 sm:px-8">
          <div className="max-w-[1200px] mx-auto space-y-14">
            {/* Hero Focal Copy & Primary Action */}
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-3xl mx-auto text-center space-y-6"
            >
              <div className="text-xs sm:text-sm font-medium text-[#77766F] tracking-wide">
                University Scheduling & Timetable Optimization Platform
              </div>

              <h1
                className="font-serif-editorial text-[#171717] tracking-tight leading-[1.06] text-balance"
                style={{ fontSize: 'clamp(2.5rem, 4.8vw, 4.25rem)' }}
              >
                Conflict-free university timetables for every class section, generated in seconds.
              </h1>

              <p className="text-base sm:text-lg text-[#77766F] max-w-2xl mx-auto leading-relaxed">
                Coordinate 50-minute lectures, uninterrupted three-hour laboratories, faculty availability, and fixed campus lunch breaks across dozens of degree cohorts—without a single room or instructor overlap.
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => onOpenAuth('signup')}
                  className="h-12 px-7 rounded-xl bg-[#171717] hover:bg-[#292929] text-white text-sm font-semibold inline-flex items-center gap-2.5 transition-all cursor-pointer shadow-xs"
                >
                  <span>Create Your Schedule</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => scrollToSection('how-it-works')}
                  className="h-12 px-6 rounded-xl bg-transparent hover:bg-[#EDEAE0] text-[#171717] text-sm font-medium inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <span>See How It Works</span>
                </button>
              </div>
            </motion.div>

            {/* Hero Visual Anchor: Interactive Live Class Timetable Preview */}
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white border border-[#E4E2DA] rounded-2xl overflow-hidden shadow-xs"
            >
              {/* Preview Window Top Bar */}
              <div className="px-4 sm:px-6 py-3.5 bg-[#171717] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-white/25" />
                    <span className="w-2.5 h-2.5 rounded-full bg-white/25" />
                    <span className="w-2.5 h-2.5 rounded-full bg-white/25" />
                  </div>
                  <span className="text-xs font-mono-tabular text-white/90 font-medium">
                    Class Section Timetable — {activeDemoGroup?.code} ({activeDemoGroup?.name})
                  </span>
                </div>

                {/* Quick Section Switcher inside the Hero Preview */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-white/60 mr-1 hidden md:inline">
                    Switch section:
                  </span>
                  {fallbackGroups.map(grp => {
                    const active = grp.id === activeDemoGroup?.id;
                    return (
                      <button
                        key={grp.id}
                        type="button"
                        onClick={() => setActiveDemoGroupId(grp.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono-tabular transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#B7F77C] text-[#171717] font-bold'
                            : 'bg-[#292929] text-white/80 hover:text-white'
                        }`}
                      >
                        {grp.code}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Compact Zero-Scroll 5-Day Timetable Matrix */}
              <div className="p-3 sm:p-5 overflow-x-auto">
                <table className="w-full table-fixed border-collapse text-left min-w-[680px]">
                  <colgroup>
                    <col className="w-[13%]" />
                    {previewDays.map(d => (
                      <col key={d} className="w-[17.4%]" />
                    ))}
                  </colgroup>
                  <thead>
                    <tr className="border-b border-[#E4E2DA] bg-[#F7F6EF]">
                      <th className="py-2 px-2.5 text-[11px] font-semibold text-[#77766F]">
                        Time Slot
                      </th>
                      {previewDays.map(day => (
                        <th
                          key={day}
                          className="py-2 px-2.5 text-xs font-serif-editorial text-[#171717] border-l border-[#E4E2DA] text-center"
                        >
                          {day === 'Fri' ? 'Fri (PM 2:30)' : day}
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
                          {isFirstAfternoon && (
                            <tr className="bg-[#F7F6EF] border-y border-[#E4E2DA]">
                              <td className="py-1.5 px-2.5 border-r border-[#E4E2DA] bg-[#E8D36B]/40 text-center">
                                <div className="text-[10.5px] font-mono-tabular font-bold text-[#171717]">
                                  1:00 – 2:00 PM
                                </div>
                              </td>
                              <td
                                colSpan={previewDays.length}
                                className="py-1.5 px-3 text-center text-[11px] font-medium text-[#171717]"
                              >
                                <span className="inline-flex items-center gap-1.5">
                                  <Coffee className="w-3.5 h-3.5 text-[#171717]" />
                                  <span>
                                    Fixed University Lunch & Prayer Break (1:00 PM – 2:00 PM)
                                  </span>
                                </span>
                              </td>
                            </tr>
                          )}

                          <tr>
                            <td className="py-1.5 px-2.5 text-[10.5px] font-mono-tabular bg-[#F7F6EF]/50 text-center align-middle">
                              <div className="font-semibold text-[#171717] leading-tight">
                                {slotMeta.period.replace(' AM', '').replace(' PM', '')}
                              </div>
                              <div className="text-[9.5px] text-[#77766F]">
                                Slot {slotMeta.slotNumber}
                              </div>
                            </td>

                            {previewDays.map(day => {
                              const cellKey = `${day}__${slotMeta.slotNumber}`;
                              if (skippedCells.has(cellKey)) return null;

                              const labSpanInfo = labSpanByCell.get(cellKey);
                              if (labSpanInfo) {
                                const { labItem, continuousWindow } = labSpanInfo;
                                const pastel = getCoursePastel(labItem.code);
                                return (
                                  <td
                                    key={day}
                                    rowSpan={3}
                                    className="p-1 border-l border-[#E4E2DA] align-stretch bg-white"
                                  >
                                    <div
                                      onClick={() => setSelectedClass(labItem)}
                                      style={{
                                        backgroundColor: pastel.bg,
                                        borderColor: pastel.border
                                      }}
                                      className="h-full p-2 rounded-xl border text-[#171717] flex flex-col items-center justify-center text-center gap-1 cursor-pointer hover:-translate-y-0.5 transition-transform"
                                    >
                                      <div className="text-[9.5px] font-mono-tabular font-bold px-1.5 py-0.5 rounded bg-white/80">
                                        {labItem.code} · LAB 3H
                                      </div>
                                      <div className="font-serif-editorial text-xs font-semibold leading-snug line-clamp-2">
                                        {labItem.title}
                                      </div>
                                      <div className="text-[10px] text-[#171717]/80 pt-1 border-t border-black/10 w-full">
                                        <div className="truncate">{labItem.prof}</div>
                                        <div className="font-mono-tabular font-semibold truncate">
                                          {labItem.room} · {continuousWindow}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                );
                              }

                              const cellClasses = (scheduleData[time]?.[day] || []).filter(
                                c => c.studentGroupId === activeDemoGroup?.id
                              );
                              const cls = cellClasses[0];

                              return (
                                <td
                                  key={day}
                                  className="p-1 border-l border-[#E4E2DA] align-middle"
                                >
                                  {cls ? (
                                    <div
                                      onClick={() => setSelectedClass(cls)}
                                      style={{
                                        backgroundColor: getCoursePastel(cls.code).bg,
                                        borderColor: getCoursePastel(cls.code).border
                                      }}
                                      className="px-2 py-1.5 rounded-xl border text-[#171717] flex flex-col items-center justify-center text-center gap-0.5 cursor-pointer hover:-translate-y-0.5 transition-transform"
                                    >
                                      <div className="font-semibold text-[11px] leading-tight truncate w-full">
                                        {cls.title}
                                      </div>
                                      <div className="text-[9.5px] font-mono-tabular font-bold text-[#171717]/75">
                                        {cls.code}
                                      </div>
                                      <div className="text-[9.5px] text-[#171717]/80 pt-0.5 border-t border-black/10 w-full truncate">
                                        {cls.prof} · <span className="font-mono-tabular font-semibold">{cls.room}</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="h-11" />
                                  )}
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

              {/* Subtle Footer Caption inside Preview */}
              <div className="px-4 sm:px-6 py-3 bg-[#F7F6EF] border-t border-[#E4E2DA] flex flex-wrap items-center justify-between gap-2 text-xs text-[#77766F]">
                <span>
                  Live preview of <strong className="text-[#171717]">{activeDemoGroup?.code}</strong> ({activeDemoDept?.name || 'Engineering & Computing'}) · Click any course block to inspect details
                </span>
                <span className="font-mono-tabular text-[#171717] font-medium">
                  0 Clashes · 50m Lectures · 3h Continuous Labs
                </span>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ===================================================================
            SECTION 2 — THE PROBLEM (WHY MANUAL SCHEDULING BREAKS)
           =================================================================== */}
        <section id="problem" className="py-24 sm:py-32 px-4 sm:px-8 border-t border-[#E4E2DA]">
          <div className="max-w-[1200px] mx-auto">
            <RevealSection className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
              {/* Left Column: Focused Narrative */}
              <div className="lg:col-span-5 space-y-6">
                <div className="text-xs font-mono-tabular text-[#77766F]">
                  01 · The Scheduling Bottleneck
                </div>

                <h2 className="font-serif-editorial text-3xl sm:text-4xl lg:text-[42px] text-[#171717] leading-[1.12] tracking-tight text-balance">
                  Forty-five class sections. Shared labs. Zero room for error.
                </h2>

                <p className="text-base text-[#77766F] leading-relaxed">
                  Building a university timetable by hand in spreadsheets means juggling hundreds of interdependent constraints. Moving a single three-hour laboratory session triggers a chain reaction of instructor double-bookings, split lunch hours, and overcrowded lecture halls.
                </p>

                <div className="pt-2 space-y-3 border-t border-[#E4E2DA] text-sm text-[#171717]">
                  <div className="flex items-baseline justify-between py-1">
                    <span className="text-[#77766F]">Active degree cohorts scheduled simultaneously</span>
                    <span className="font-mono-tabular font-semibold">{store.studentGroups.length} Sections</span>
                  </div>
                  <div className="flex items-baseline justify-between py-1 border-t border-[#E4E2DA]/70">
                    <span className="text-[#77766F]">Continuous laboratory duration required</span>
                    <span className="font-mono-tabular font-semibold">180 Mins (3 Slots)</span>
                  </div>
                  <div className="flex items-baseline justify-between py-1 border-t border-[#E4E2DA]/70">
                    <span className="text-[#77766F]">Permitted faculty or room collisions</span>
                    <span className="font-mono-tabular font-semibold">0 Overlaps</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Single Visual Focal Comparison */}
              <div className="lg:col-span-7">
                <div className="bg-white border border-[#E4E2DA] rounded-2xl p-6 sm:p-8 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[#E4E2DA]">
                    <div>
                      <h3 className="font-serif-editorial text-xl text-[#171717]">
                        {problemView === 'conflict'
                          ? 'Manual Spreadsheet Failure Modes'
                          : 'SmartGrid Automated Resolution'}
                      </h3>
                      <p className="text-xs text-[#77766F] mt-0.5">
                        Compare typical manual scheduling collisions with constraint-verified output
                      </p>
                    </div>

                    <div className="inline-flex p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] self-start">
                      <button
                        type="button"
                        onClick={() => setProblemView('conflict')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                          problemView === 'conflict'
                            ? 'bg-[#171717] text-white'
                            : 'text-[#77766F] hover:text-[#171717]'
                        }`}
                      >
                        Manual Conflicts
                      </button>
                      <button
                        type="button"
                        onClick={() => setProblemView('resolved')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                          problemView === 'resolved'
                            ? 'bg-[#171717] text-white'
                            : 'text-[#77766F] hover:text-[#171717]'
                        }`}
                      >
                        SmartGrid Solved
                      </button>
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {problemView === 'conflict' ? (
                      <motion.div
                        key="conflict"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-3.5"
                      >
                        <div className="p-4 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="text-xs font-mono-tabular font-semibold text-[#171717] flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-[#171717]" />
                              <span>Collision 01 · Instructor Double-Booked (Tue 10:00 AM)</span>
                            </div>
                            <p className="text-xs text-[#77766F]">
                              Dr. Kamran Munir assigned simultaneously to <strong className="text-[#171717]">2K24-BEE-A (LH-101)</strong> and <strong className="text-[#171717]">2K24-BEE-B (LH-102)</strong> during Slot 2.
                            </p>
                          </div>
                          <span className="text-xs font-mono-tabular font-semibold text-[#171717] shrink-0">
                            Clash
                          </span>
                        </div>

                        <div className="p-4 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="text-xs font-mono-tabular font-semibold text-[#171717] flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-[#171717]" />
                              <span>Collision 02 · 3-Hour Lab Broken Across Lunch (Wed 12:00 PM)</span>
                            </div>
                            <p className="text-xs text-[#77766F]">
                              Digital Logic Design Lab started at Slot 4 (12:00 PM), colliding directly with the fixed <strong className="text-[#171717]">1:00 – 2:00 PM University Lunch Break</strong>.
                            </p>
                          </div>
                          <span className="text-xs font-mono-tabular font-semibold text-[#171717] shrink-0">
                            Invalid Window
                          </span>
                        </div>

                        <div className="p-4 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="text-xs font-mono-tabular font-semibold text-[#171717] flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-[#171717]" />
                              <span>Collision 03 · Shared Laboratory Overwrite (Thu 2:00 PM)</span>
                            </div>
                            <p className="text-xs text-[#77766F]">
                              Two sections (<strong className="text-[#171717]">2K25-BSCS-A</strong> and <strong className="text-[#171717]">2K25-BSCS-B</strong>) scheduled into Programming Lab 1 at the same time.
                            </p>
                          </div>
                          <span className="text-xs font-mono-tabular font-semibold text-[#171717] shrink-0">
                            Room Overlap
                          </span>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="resolved"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-3.5"
                      >
                        <div className="p-4 rounded-xl bg-[#B8F2E6]/55 border border-[#93DEC9] flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="text-xs font-mono-tabular font-semibold text-[#171717] flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#171717]" />
                              <span>Verified · Faculty Assignments Staggered Across Slots 1–4</span>
                            </div>
                            <p className="text-xs text-[#171717]/80">
                              Dr. Kamran Munir teaches <strong>2K24-BEE-A</strong> at 9:00 AM and <strong>2K24-BEE-B</strong> at 10:00 AM with a 10-minute transition buffer.
                            </p>
                          </div>
                          <span className="text-xs font-mono-tabular font-semibold text-[#171717] shrink-0">
                            0 Clashes
                          </span>
                        </div>

                        <div className="p-4 rounded-xl bg-[#B8EEEE]/60 border border-[#95DFDF] flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="text-xs font-mono-tabular font-semibold text-[#171717] flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#171717]" />
                              <span>Verified · Continuous 3-Hour Lab Blocks Locked</span>
                            </div>
                            <p className="text-xs text-[#171717]/80">
                              All 180-minute labs are placed strictly in valid continuous windows (<strong>9:00–11:50 AM</strong>, <strong>10:00–12:50 PM</strong>, or <strong>2:00–4:50 PM</strong>), never crossing 1:00 PM lunch.
                            </p>
                          </div>
                          <span className="text-xs font-mono-tabular font-semibold text-[#171717] shrink-0">
                            3h Continuous
                          </span>
                        </div>

                        <div className="p-4 rounded-xl bg-[#B7F77C]/55 border border-[#98DF58] flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="text-xs font-mono-tabular font-semibold text-[#171717] flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#171717]" />
                              <span>Verified · Dedicated Room & Lab Isolation</span>
                            </div>
                            <p className="text-xs text-[#171717]/80">
                              Every lecture hall and specialized engineering lab is uniquely locked per time slot across all {store.studentGroups.length} university sections.
                            </p>
                          </div>
                          <span className="text-xs font-mono-tabular font-semibold text-[#171717] shrink-0">
                            100% Isolated
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </RevealSection>
          </div>
        </section>

        {/* ===================================================================
            SECTION 3 — THE SOLUTION (INTERACTIVE PRODUCT DEMONSTRATION)
           =================================================================== */}
        <section id="solution" className="py-24 sm:py-32 px-4 sm:px-8 bg-white border-t border-[#E4E2DA]">
          <div className="max-w-[1200px] mx-auto space-y-12">
            <RevealSection className="max-w-3xl mx-auto text-center space-y-4">
              <div className="text-xs font-mono-tabular text-[#77766F]">
                02 · The SmartGrid AI Solution
              </div>

              <h2 className="font-serif-editorial text-3xl sm:text-4xl lg:text-[44px] text-[#171717] leading-[1.1] tracking-tight text-balance">
                One intelligent solver for the entire university—and a dedicated timetable for every class.
              </h2>

              <p className="text-base text-[#77766F] leading-relaxed">
                Explore how SmartGrid AI organizes courses, instructors, rooms, and continuous 3-hour labs for individual sections across Electrical, Computer, Software Engineering, and Computer Science.
              </p>
            </RevealSection>

            {/* Interactive Demonstration Container */}
            <RevealSection
              delay={0.08}
              className="rounded-2xl border border-[#E4E2DA] bg-[#F7F6EF] p-5 sm:p-8 space-y-6"
            >
              {/* Top Controls Bar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#E4E2DA]">
                <div className="space-y-1">
                  <div className="text-xs text-[#77766F] font-medium">
                    Select a University Class / Section to Inspect:
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {store.departments.map(dept => {
                      const deptGroups = store.studentGroups.filter(g => {
                        const p = store.programs.find(pr => pr.id === g.programId);
                        return p?.departmentId === dept.id;
                      });
                      const sampleGrp = deptGroups[0];
                      if (!sampleGrp) return null;
                      const isSelected = activeDemoDept?.id === dept.id;
                      return (
                        <button
                          key={dept.id}
                          type="button"
                          onClick={() => setActiveDemoGroupId(sampleGrp.id)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#171717] text-white'
                              : 'bg-white text-[#171717] border border-[#E4E2DA] hover:border-[#171717]'
                          }`}
                        >
                          {dept.code} · {sampleGrp.code}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleRunDemoOptimization}
                    disabled={isOptimizingDemo}
                    className="btn-secondary bg-white h-10 px-4 text-xs"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isOptimizingDemo ? 'animate-spin' : ''}`} />
                    <span>
                      {isOptimizingDemo
                        ? 'Verifying Constraints...'
                        : demoOptimized
                        ? 'Verified: 0 Clashes ✓'
                        : 'Verify Section Constraints'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadSampleSheets}
                    disabled={isExportingSample}
                    className="h-10 px-4 rounded-xl bg-[#B7F77C] hover:bg-[#a6ec68] border border-[#98DF58] text-[#171717] text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>
                      {isExportingSample
                        ? 'Preparing .xlsx...'
                        : `Download ${activeDemoGroup?.code} Google Sheet (.xlsx)`}
                    </span>
                  </button>
                </div>
              </div>

              {/* Section Summary & Assigned Courses Showcase */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-4 bg-white border border-[#E4E2DA] rounded-2xl p-5 space-y-4">
                  <div>
                    <div className="text-xs font-mono-tabular text-[#77766F]">
                      Active Cohort Profile
                    </div>
                    <h3 className="font-serif-editorial text-2xl text-[#171717] mt-0.5">
                      {activeDemoGroup?.code}
                    </h3>
                    <p className="text-xs text-[#77766F] mt-0.5">
                      {activeDemoGroup?.name}
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-3 border-t border-[#E4E2DA] text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#77766F]">Department</span>
                      <span className="font-semibold text-[#171717]">
                        {activeDemoDept?.name || 'Engineering'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#77766F]">Designated Home Room</span>
                      <span className="font-mono-tabular font-semibold text-[#171717]">
                        {activeDemoGroup?.homeRoom || 'LH-101'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#77766F]">Operating Window</span>
                      <span className="font-mono-tabular text-[#171717]">09:00 AM – 05:00 PM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#77766F]">Fixed Lunch Break</span>
                      <span className="font-mono-tabular text-[#171717]">01:00 PM – 02:00 PM</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => onOpenAuth('signup')}
                      className="btn-primary w-full h-10 text-xs"
                    >
                      <span>Open Full Interactive Timetable</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Assigned Courses & Continuous Labs for this Section */}
                <div className="lg:col-span-8 bg-white border border-[#E4E2DA] rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#E4E2DA] pb-3">
                    <div>
                      <h4 className="font-serif-editorial text-lg text-[#171717]">
                        Scheduled Lectures & 3-Hour Laboratories for {activeDemoGroup?.code}
                      </h4>
                      <p className="text-xs text-[#77766F]">
                        Every session below is isolated from other cohorts and matched to instructor and room capacity
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {previewDays
                      .flatMap(day =>
                        UNIVERSITY_SLOTS.flatMap(slotMeta =>
                          (scheduleData[slotMeta.period]?.[day] || [])
                            .filter(c => c.studentGroupId === activeDemoGroup?.id)
                            .map(cls => ({ cls, day, slotMeta }))
                        )
                      )
                      .slice(0, 6)
                      .map(({ cls, day, slotMeta }) => {
                        const isLab = cls.sessionType === 'Lab' || cls.spanSlots === 3;
                        const pastel = getCoursePastel(cls.code);
                        const timeLabel = isLab
                          ? cls.continuousTimeLabel ||
                            getLabBlockByStartPeriod(slotMeta.period)?.continuousLabel ||
                            slotMeta.period
                          : slotMeta.period;
                        return (
                          <div
                            key={`${day}-${slotMeta.slotNumber}-${cls.id}`}
                            onClick={() => setSelectedClass(cls)}
                            style={{ backgroundColor: pastel.bg, borderColor: pastel.border }}
                            className="p-3.5 rounded-xl border text-[#171717] cursor-pointer hover:-translate-y-0.5 transition-transform space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-[11px] font-mono-tabular">
                              <span className="font-bold">
                                {cls.code} · {isLab ? 'LAB (3H)' : 'LECTURE (50M)'}
                              </span>
                              <span>
                                {day} · {timeLabel}
                              </span>
                            </div>
                            <div className="font-serif-editorial text-sm font-semibold leading-snug truncate">
                              {cls.title}
                            </div>
                            <div className="text-[11px] text-[#171717]/80 flex items-center justify-between pt-1 border-t border-black/10">
                              <span className="truncate">{cls.prof}</span>
                              <span className="font-mono-tabular font-semibold">{cls.room}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </RevealSection>
          </div>
        </section>

        {/* ===================================================================
            SECTION 4 — KEY CAPABILITIES (ASYMMETRIC EDITORIAL BENTO)
           =================================================================== */}
        <section id="capabilities" className="py-24 sm:py-32 px-4 sm:px-8 border-t border-[#E4E2DA]">
          <div className="max-w-[1200px] mx-auto space-y-14">
            <RevealSection className="max-w-2xl space-y-4">
              <div className="text-xs font-mono-tabular text-[#77766F]">
                03 · Core Capabilities
              </div>

              <h2 className="font-serif-editorial text-3xl sm:text-4xl lg:text-[42px] text-[#171717] leading-[1.1] tracking-tight text-balance">
                Purpose-built around the real structure of university academics.
              </h2>
            </RevealSection>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Capability 1: Span 7 */}
              <RevealSection className="lg:col-span-7 bg-white border border-[#E4E2DA] rounded-2xl p-7 sm:p-9 flex flex-col justify-between space-y-6">
                <div className="space-y-3">
                  <div className="text-xs font-mono-tabular text-[#77766F]">
                    01 · Combinatorial Constraint Engine
                  </div>
                  <h3 className="font-serif-editorial text-2xl sm:text-3xl text-[#171717]">
                    Conflict-free room, faculty, and section allocation
                  </h3>
                  <p className="text-sm sm:text-base text-[#77766F] leading-relaxed">
                    SmartGrid AI evaluates room seating capacities, specialized laboratory requirements, instructor teaching windows, and cohort schedules simultaneously—preventing double-bookings before they happen.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[#E4E2DA] text-left">
                  <div>
                    <div className="font-mono-tabular text-xl sm:text-2xl font-semibold text-[#171717]">
                      {store.studentGroups.length}
                    </div>
                    <div className="text-xs text-[#77766F] mt-0.5">Class Sections</div>
                  </div>
                  <div>
                    <div className="font-mono-tabular text-xl sm:text-2xl font-semibold text-[#171717]">
                      {store.rooms.length}
                    </div>
                    <div className="text-xs text-[#77766F] mt-0.5">Halls & Labs</div>
                  </div>
                  <div>
                    <div className="font-mono-tabular text-xl sm:text-2xl font-semibold text-[#171717]">
                      0
                    </div>
                    <div className="text-xs text-[#77766F] mt-0.5">Hard Overlaps</div>
                  </div>
                </div>
              </RevealSection>

              {/* Capability 2: Span 5 */}
              <RevealSection
                delay={0.08}
                className="lg:col-span-5 sf-pastel-cyan p-7 sm:p-9 flex flex-col justify-between space-y-6"
              >
                <div className="space-y-3">
                  <div className="text-xs font-mono-tabular text-[#171717]/75">
                    02 · Laboratory Continuity
                  </div>
                  <h3 className="font-serif-editorial text-2xl sm:text-3xl text-[#171717]">
                    Uninterrupted three-hour laboratory blocks
                  </h3>
                  <p className="text-sm sm:text-base text-[#171717]/80 leading-relaxed">
                    Engineering and computing labs require three consecutive hours. SmartGrid schedules 180-minute lab blocks across three contiguous slots without internal breaks and never splits a lab across the 1:00–2:00 PM lunch hour.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white/80 border border-black/10 text-xs font-mono-tabular text-[#171717] flex items-center justify-between">
                  <span>Valid Lab Windows:</span>
                  <span className="font-bold">09:00–11:50 · 10:00–12:50 · 14:00–16:50</span>
                </div>
              </RevealSection>

              {/* Capability 3: Span 5 */}
              <RevealSection
                delay={0.05}
                className="lg:col-span-5 sf-pastel-lime p-7 sm:p-9 flex flex-col justify-between space-y-6"
              >
                <div className="space-y-3">
                  <div className="text-xs font-mono-tabular text-[#171717]/75">
                    03 · Print-Ready Spreadsheets
                  </div>
                  <h3 className="font-serif-editorial text-2xl sm:text-3xl text-[#171717]">
                    Compact landscape Google Sheets export
                  </h3>
                  <p className="text-sm sm:text-base text-[#171717]/80 leading-relaxed">
                    Export a multi-tab `.xlsx` workbook containing a Master Weekly Overview plus a dedicated worksheet for every class section—formatted in landscape orientation to fit on a single laptop screen and printed page.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white/80 border border-black/10 text-xs font-mono-tabular text-[#171717] flex items-center justify-between">
                  <span>Workbook Structure:</span>
                  <span className="font-bold">1 Overview + {store.studentGroups.length} Class Tabs</span>
                </div>
              </RevealSection>

              {/* Capability 4: Span 7 */}
              <RevealSection
                delay={0.12}
                className="lg:col-span-7 bg-white border border-[#E4E2DA] rounded-2xl p-7 sm:p-9 flex flex-col justify-between space-y-6"
              >
                <div className="space-y-3">
                  <div className="text-xs font-mono-tabular text-[#77766F]">
                    04 · Institutional Rhythm & Student Wellbeing
                  </div>
                  <h3 className="font-serif-editorial text-2xl sm:text-3xl text-[#171717]">
                    50-minute lectures, 10-minute transitions, and protected lunch breaks
                  </h3>
                  <p className="text-sm sm:text-base text-[#77766F] leading-relaxed">
                    Respects human cognitive limits and campus transit times with four morning slots (9:00 AM – 1:00 PM), a universal 1:00 PM – 2:00 PM lunch and prayer break, and three afternoon slots with automatic Friday afternoon timing adjustments.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[#E4E2DA] text-left">
                  <div>
                    <div className="font-mono-tabular text-xl sm:text-2xl font-semibold text-[#171717]">
                      50m + 10m
                    </div>
                    <div className="text-xs text-[#77766F] mt-0.5">Lecture + Short Break</div>
                  </div>
                  <div>
                    <div className="font-mono-tabular text-xl sm:text-2xl font-semibold text-[#171717]">
                      1:00 – 2:00
                    </div>
                    <div className="text-xs text-[#77766F] mt-0.5">Fixed Campus Lunch</div>
                  </div>
                  <div>
                    <div className="font-mono-tabular text-xl sm:text-2xl font-semibold text-[#171717]">
                      7 Columns
                    </div>
                    <div className="text-xs text-[#77766F] mt-0.5">Zero-Scroll Weekly Fit</div>
                  </div>
                </div>
              </RevealSection>
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION 5 — HOW IT WORKS (CONNECTED 3-STEP SEQUENCE)
           =================================================================== */}
        <section id="how-it-works" className="py-24 sm:py-32 px-4 sm:px-8 bg-white border-t border-[#E4E2DA]">
          <div className="max-w-[1200px] mx-auto space-y-14">
            <RevealSection className="max-w-2xl space-y-4">
              <div className="text-xs font-mono-tabular text-[#77766F]">
                04 · How It Works
              </div>

              <h2 className="font-serif-editorial text-3xl sm:text-4xl lg:text-[42px] text-[#171717] leading-[1.1] tracking-tight text-balance">
                From academic catalog to published class schedules in three steps.
              </h2>
            </RevealSection>

            <RevealSection className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              {/* Left: 3 Connected Steps */}
              <div className="lg:col-span-6 space-y-4">
                {howItWorksSteps.map((step, idx) => {
                  const isActive = activeStepIndex === idx;
                  return (
                    <button
                      key={step.number}
                      type="button"
                      onClick={() => setActiveStepIndex(idx)}
                      className={`w-full text-left p-6 rounded-2xl border transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#F7F6EF] border-[#171717]'
                          : 'bg-white border-[#E4E2DA] hover:border-[#77766F]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="text-xs font-mono-tabular font-bold text-[#77766F]">
                            Step {step.number}
                          </div>
                          <h3 className="font-serif-editorial text-xl sm:text-2xl text-[#171717]">
                            {step.title}
                          </h3>
                          <p className="text-sm text-[#77766F] leading-relaxed">
                            {step.summary}
                          </p>
                        </div>
                        <ChevronRight
                          className={`w-5 h-5 shrink-0 mt-1 transition-transform ${
                            isActive ? 'text-[#171717] translate-x-0.5' : 'text-[#77766F]'
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right: Active Step Visual Detail Card */}
              <div className="lg:col-span-6 flex">
                <div
                  style={{ backgroundColor: howItWorksSteps[activeStepIndex].accentBg }}
                  className="w-full rounded-2xl border border-black/10 p-8 sm:p-10 flex flex-col justify-between space-y-8"
                >
                  <div className="space-y-4">
                    <div className="text-xs font-mono-tabular font-bold text-[#171717]/75">
                      Step {howItWorksSteps[activeStepIndex].number} Breakdown
                    </div>
                    <h3 className="font-serif-editorial text-2xl sm:text-3xl text-[#171717]">
                      {howItWorksSteps[activeStepIndex].detailTitle}
                    </h3>
                    <div className="space-y-3 pt-2">
                      {howItWorksSteps[activeStepIndex].detailItems.map((item, i) => (
                        <div
                          key={i}
                          className="p-4 rounded-xl bg-white/85 border border-black/8 flex items-start gap-3 text-sm text-[#171717]"
                        >
                          <Check className="w-4 h-4 text-[#171717] shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-black/10 flex items-center justify-between">
                    <span className="text-xs font-mono-tabular text-[#171717]/80">
                      Ready to try Step {howItWorksSteps[activeStepIndex].number} in the workspace?
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenAuth('signup')}
                      className="btn-primary h-10 px-5 text-xs"
                    >
                      <span>Open Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </RevealSection>
          </div>
        </section>

        {/* ===================================================================
            SECTION 6 — FINAL CALL TO ACTION
           =================================================================== */}
        <section className="py-24 sm:py-32 px-4 sm:px-8 border-t border-[#E4E2DA]">
          <div className="max-w-[1120px] mx-auto">
            <RevealSection className="rounded-3xl bg-[#171717] text-white px-6 py-16 sm:px-14 sm:py-20 text-center space-y-8">
              <div className="max-w-2xl mx-auto space-y-4">
                <h2
                  className="font-serif-editorial text-white tracking-tight leading-[1.08] text-balance"
                  style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}
                >
                  Ready to generate your university’s conflict-free timetable?
                </h2>
                <p className="text-sm sm:text-base text-white/75 leading-relaxed">
                  Launch the SmartGrid AI workspace to inspect all {store.studentGroups.length} pre-configured class sections, run the constraint solver, or export print-ready Google Sheets schedules.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => onOpenAuth('signup')}
                  className="h-12 px-7 rounded-xl bg-[#B7F77C] hover:bg-[#a6ec68] text-[#171717] text-sm font-semibold inline-flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <span>Get Started Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onOpenAuth('signin')}
                  className="h-12 px-6 rounded-xl bg-[#292929] hover:bg-[#383838] text-white text-sm font-medium inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Sign In to Workspace</span>
                </button>
              </div>
            </RevealSection>
          </div>
        </section>
      </main>

      {/* =====================================================================
          QUIET FOOTER
         ===================================================================== */}
      <footer className="border-t border-[#E4E2DA] bg-[#F7F6EF] px-4 sm:px-8 py-12">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-[#77766F]">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-md bg-[#171717] text-white font-serif-editorial text-sm flex items-center justify-center">
              S
            </span>
            <span className="font-serif-editorial text-base text-[#171717]">SmartGrid AI</span>
            <span>·</span>
            <span>University Timetable Scheduling & Optimization</span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <button
              type="button"
              onClick={() => scrollToSection('problem')}
              className="hover:text-[#171717] transition-colors cursor-pointer"
            >
              The Problem
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('solution')}
              className="hover:text-[#171717] transition-colors cursor-pointer"
            >
              Product Demo
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('capabilities')}
              className="hover:text-[#171717] transition-colors cursor-pointer"
            >
              Capabilities
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="hover:text-[#171717] transition-colors cursor-pointer"
            >
              How It Works
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('signin')}
              className="text-[#171717] font-semibold hover:underline cursor-pointer"
            >
              Log in
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
