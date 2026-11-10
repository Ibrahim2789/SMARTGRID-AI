import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowRight,
  Coffee,
  FileSpreadsheet,
  Menu,
  X,
  CheckCircle2,
  Sliders,
  Cpu,
  ShieldCheck,
  Layers,
  Clock,
  LogIn
} from 'lucide-react';
import { useInstitutionalData } from '../data/store';
import { buildMatrixSchedule } from '../data/solverAdapter';
import { UNIVERSITY_SLOTS, getLabBlockByStartPeriod } from '../types/institutional';
import { ClassDetailsModal, ClassItem } from './ClassDetailsModal';
import { exportTimetableToGoogleSheetsWorkbook } from '../utils/googleSheetsExport';
import { SmartGridLogo } from './SmartGridLogo';

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

const HOW_IT_WORKS_STEPS = [
  {
    number: '01',
    title: 'Configure University',
    icon: Sliders,
    accentBg: '#B8EEEE',
    accentBorder: '#95DFDF',
    bullets: [
      "Set up the university's academic calendar.",
      'Configure departments, semesters, batches and sections.',
      'Define scheduling policies and resources.'
    ]
  },
  {
    number: '02',
    title: 'Generate Timetable',
    icon: Cpu,
    accentBg: '#F2D8FA',
    accentBorder: '#DFB9EC',
    bullets: [
      'Use the configured university data.',
      'Apply scheduling constraints.',
      'Generate optimized timetables using the existing scheduling engine.'
    ]
  },
  {
    number: '03',
    title: 'Optimize & Manage',
    icon: CheckCircle2,
    accentBg: '#B7F77C',
    accentBorder: '#98DF58',
    bullets: [
      'Review generated schedules.',
      'Identify and resolve conflicts.',
      'Make adjustments and manage timetables.'
    ]
  }
] as const;

const WHY_CHOOSE_BENEFITS = [
  {
    title: 'Intelligent Scheduling',
    description:
      'Generate optimized university timetables using intelligent scheduling algorithms.',
    icon: Cpu,
    accentBg: '#B8EEEE',
    accentBorder: '#95DFDF'
  },
  {
    title: 'Conflict Prevention',
    description:
      'Prevent scheduling clashes involving faculty, classrooms, laboratories and student sections.',
    icon: ShieldCheck,
    accentBg: '#B7F77C',
    accentBorder: '#98DF58'
  },
  {
    title: 'Flexible University Structures',
    description:
      'Support different academic calendars, departments, semesters, batches and university timetable policies.',
    icon: Layers,
    accentBg: '#F2D8FA',
    accentBorder: '#DFB9EC'
  },
  {
    title: 'Save Time',
    description:
      'Reduce manual scheduling effort and simplify timetable management.',
    icon: Clock,
    accentBg: '#B8F2E6',
    accentBorder: '#93DEC9'
  }
] as const;

export const PublicLandingPage: React.FC<PublicLandingPageProps> = ({ onOpenAuth }) => {
  const store = useInstitutionalData();
  const { scheduleData } = buildMatrixSchedule(store);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [isExportingSample, setIsExportingSample] = useState(false);

  // Scroll-aware animated navbar state
  const [isScrolled, setIsScrolled] = useState(false);
  const [hoveredNavIndex, setHoveredNavIndex] = useState<number | null>(null);

  // Automatic display-only "How SmartGrid AI Works" step animation state
  const [activeProcessStep, setActiveProcessStep] = useState<number>(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Automatic non-interactive loop for "How SmartGrid AI Works"
  useEffect(() => {
    if (prefersReducedMotion) return;
    const interval = window.setInterval(() => {
      setActiveProcessStep(prev => (prev + 1) % HOW_IT_WORKS_STEPS.length);
    }, 3000);
    return () => window.clearInterval(interval);
  }, [prefersReducedMotion]);

  // Featured class sections for the realistic live timetable preview
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
  const [demoDeptFilter, setDemoDeptFilter] = useState<'ALL' | 'BEE' | 'BSCS' | 'BESE' | 'BCE'>('ALL');

  const visibleDemoGroups = useMemo(() => {
    if (demoDeptFilter === 'ALL') {
      return fallbackGroups;
    }
    const matching = store.studentGroups.filter(g => g.code.includes(`-${demoDeptFilter}-`));
    return matching.length > 0 ? matching.slice(0, 4) : fallbackGroups;
  }, [demoDeptFilter, fallbackGroups, store.studentGroups]);

  const handleSelectDept = (dept: 'ALL' | 'BEE' | 'BSCS' | 'BESE' | 'BCE') => {
    setDemoDeptFilter(dept);
    if (dept === 'ALL') {
      if (!fallbackGroups.some(g => g.id === activeDemoGroupId)) {
        setActiveDemoGroupId(fallbackGroups[0]?.id || '');
      }
    } else {
      const matching = store.studentGroups.filter(g => g.code.includes(`-${dept}-`));
      if (matching.length > 0 && !matching.some(g => g.id === activeDemoGroupId)) {
        setActiveDemoGroupId(matching[0].id);
      }
    }
  };

  const activeDemoGroup =
    store.studentGroups.find(g => g.id === activeDemoGroupId) || store.studentGroups[0];

  const scrollToId = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
        studentOrUserName: 'University Timetable Preview'
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

  const navLinks = [
    { label: 'Timetable Preview', target: 'timetable-preview' },
    { label: 'How It Works', target: 'how-it-works' },
    { label: 'Why SmartGrid AI', target: 'why-choose-smartgrid' }
  ];

  // Progress percentage for the connecting line in "How SmartGrid AI Works"
  const progressPercentage = prefersReducedMotion
    ? 100
    : activeProcessStep === 0
    ? 18
    : activeProcessStep === 1
    ? 54
    : 100;

  return (
    <div className="min-h-screen bg-[#F7F6EF] text-[#171717] antialiased selection:bg-[#B8EEEE] selection:text-[#171717]">
      <ClassDetailsModal
        classItem={selectedClass}
        onClose={() => setSelectedClass(null)}
      />

      {/* =====================================================================
          1. ANIMATED PRE-LOGIN NAVIGATION BAR
          Smoothly morphs between wide header and floating glassmorphic pill on scroll
         ===================================================================== */}
      <header
        className={`sticky top-0 z-50 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isScrolled ? 'pt-3 px-4 sm:px-8' : 'pt-0 px-0'
        }`}
      >
        <div
          className={`mx-auto transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isScrolled
              ? 'max-w-[1120px] h-14 px-4 sm:px-6 rounded-2xl bg-white/90 backdrop-blur-xl border border-[#E4E2DA] shadow-[0_12px_32px_-12px_rgba(23,23,23,0.12)]'
              : 'max-w-[1240px] h-16 px-4 sm:px-8 bg-[#F7F6EF]/95 backdrop-blur-md border-b border-[#E4E2DA]'
          } flex items-center justify-between gap-6`}
        >
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2 text-[#171717] whitespace-nowrap shrink-0 cursor-pointer group"
          >
            <div className="transition-transform duration-300 group-hover:scale-[1.02]">
              <SmartGridLogo variant="primary" theme="light" size="sm" />
            </div>
          </button>

          {/* Zone 2: Animated Navigation Links with Hover Pill */}
          <nav
            aria-label="Primary Navigation"
            onMouseLeave={() => setHoveredNavIndex(null)}
            className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-[#EDEAE0]/70 border border-[#E4E2DA]/80"
          >
            {navLinks.map((item, idx) => {
              const isHovered = hoveredNavIndex === idx;
              return (
                <button
                  key={item.target}
                  type="button"
                  onMouseEnter={() => setHoveredNavIndex(idx)}
                  onClick={() => scrollToId(item.target)}
                  className={`relative px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                    isHovered
                      ? 'bg-white text-[#171717] shadow-2xs'
                      : 'text-[#57564F] hover:text-[#171717]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Log In Button + Prominent Get Started CTA */}
          <div className="hidden md:flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onOpenAuth('signin')}
              className="btn-secondary h-9 px-4 text-xs sm:text-sm whitespace-nowrap shrink-0 hover:-translate-y-0.5 transition-all duration-200"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Log In</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenAuth('signup')}
              className="btn-primary h-9 px-4 sm:px-5 text-xs sm:text-sm whitespace-nowrap shrink-0 hover:-translate-y-0.5 transition-all duration-200"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg border border-[#E4E2DA] bg-white text-[#171717] cursor-pointer"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-2 mx-4 rounded-2xl bg-white border border-[#E4E2DA] px-5 py-4 space-y-3 shadow-lg">
            <div className="flex flex-col space-y-1.5 text-sm font-medium text-[#171717]">
              {navLinks.map(item => (
                <button
                  key={item.target}
                  type="button"
                  onClick={() => scrollToId(item.target)}
                  className="text-left py-1.5 px-2 rounded-lg hover:bg-[#F7F6EF] cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="pt-2 border-t border-[#E4E2DA] grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth('signin');
                }}
                className="btn-secondary w-full h-10 text-xs sm:text-sm"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Log In</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth('signup');
                }}
                className="btn-primary w-full h-10 text-xs sm:text-sm"
              >
                <span>Get Started</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ===================================================================
            2. HERO SECTION & REALISTIC TIMETABLE INTERFACE PREVIEW
            Preserves headline: "Ready to generate your university's conflict-free timetable?"
           =================================================================== */}
        <section className="pt-10 pb-14 sm:pt-14 sm:pb-16 px-4 sm:px-8">
          <div className="max-w-[1240px] mx-auto space-y-8">
            {/* Preserved Hero Banner & Identity */}
            <div className="rounded-3xl bg-[#171717] text-white px-6 py-11 sm:px-12 sm:py-14 text-center space-y-6">
              <div className="max-w-3xl mx-auto space-y-4">
                <div className="text-xs font-mono-tabular uppercase tracking-wider text-[#B8EEEE]">
                  University Scheduling &amp; Timetable Management Platform
                </div>
                <h1
                  className="font-serif-editorial text-white tracking-tight leading-[1.08] text-balance"
                  style={{ fontSize: 'clamp(2.15rem, 4.2vw, 3.6rem)' }}
                >
                  Ready to generate your university&apos;s conflict-free timetable?
                </h1>
                <p className="text-sm sm:text-base text-white/80 max-w-2xl mx-auto leading-relaxed">
                  SmartGrid AI synthesizes conflict-free schedules across departments, active semesters, student batches, faculty rosters, classrooms, and continuous 3-hour laboratories.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3.5 pt-1">
                <button
                  type="button"
                  onClick={() => onOpenAuth('signup')}
                  className="h-11 px-6 rounded-xl bg-[#B7F77C] hover:bg-[#a6ec68] text-[#171717] text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>Create Your Timetable</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onOpenAuth('signin')}
                  className="h-11 px-5 rounded-xl bg-[#292929] hover:bg-[#383838] text-white text-sm font-medium inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Log In to Workspace</span>
                </button>
              </div>
            </div>

            {/* Realistic Interactive Preview of the Actual Timetable Interface */}
            <div
              id="timetable-preview"
              className="scroll-mt-20 bg-white border border-[#E4E2DA] rounded-2xl overflow-hidden"
            >
              {/* Preview Toolbar */}
              <div className="px-4 sm:px-6 py-3.5 bg-[#F7F6EF] border-b border-[#E4E2DA] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-xs font-semibold text-[#171717]">
                    Live Section Timetable Preview:
                  </span>
                  <span className="text-xs font-mono-tabular px-2.5 py-0.5 rounded bg-white border border-[#E4E2DA] text-[#171717] font-semibold">
                    {activeDemoGroup?.code} — {activeDemoGroup?.name}
                  </span>
                  <span className="text-xs text-[#77766F] hidden sm:inline">
                    · Click any lecture or 3-hour lab block to inspect
                  </span>
                </div>

                {/* Department Filter & Section Switcher */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center p-0.5 rounded-lg bg-[#EDEAE0] border border-[#E4E2DA] text-[11px] font-mono-tabular">
                    {(['ALL', 'BEE', 'BSCS', 'BESE', 'BCE'] as const).map(deptKey => {
                      const isDeptActive = demoDeptFilter === deptKey;
                      return (
                        <button
                          key={deptKey}
                          type="button"
                          onClick={() => handleSelectDept(deptKey)}
                          className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                            isDeptActive
                              ? 'bg-[#171717] text-white font-semibold'
                              : 'text-[#57564F] hover:text-[#171717]'
                          }`}
                        >
                          {deptKey}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    {visibleDemoGroups.map(grp => {
                      const active = grp.id === activeDemoGroup?.id;
                      return (
                        <button
                          key={grp.id}
                          type="button"
                          onClick={() => setActiveDemoGroupId(grp.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono-tabular transition-colors cursor-pointer whitespace-nowrap ${
                            active
                              ? 'bg-[#B7F77C] text-[#171717] font-bold border border-[#98DF58]'
                              : 'bg-white text-[#57564F] border border-[#E4E2DA] hover:text-[#171717]'
                          }`}
                        >
                          {grp.code}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadSampleSheets}
                    disabled={isExportingSample}
                    className="h-7 px-2.5 rounded-lg bg-white hover:bg-[#EDEAE0] border border-[#E4E2DA] text-[#171717] text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>{isExportingSample ? 'Exporting...' : 'Export .xlsx'}</span>
                  </button>
                </div>
              </div>

              {/* 5-Day Timetable Matrix */}
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
                                    Protected University Midday &amp; Prayer Break (1:00 PM – 2:00 PM)
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
                                      className="h-full min-h-[126px] rounded-xl p-2.5 border flex flex-col justify-between cursor-pointer hover:brightness-95 transition-all"
                                    >
                                      <div className="space-y-1">
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="text-[9.5px] font-mono-tabular font-bold px-1.5 py-0.5 rounded bg-[#171717] text-white">
                                            3-HR LAB
                                          </span>
                                          <span className="text-[9.5px] font-mono-tabular font-semibold text-[#171717]/80">
                                            {labItem.room}
                                          </span>
                                        </div>
                                        <div className="font-serif-editorial text-xs font-medium text-[#171717] leading-snug">
                                          {labItem.title}
                                        </div>
                                      </div>

                                      <div className="pt-1.5 border-t border-[#171717]/10 flex items-center justify-between text-[9.5px] text-[#171717]/80">
                                        <span className="truncate">{labItem.prof}</span>
                                        <span className="font-mono-tabular shrink-0 ml-1">
                                          {continuousWindow.replace(' AM', '').replace(' PM', '')}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                );
                              }

                              const cellClasses = (scheduleData[time]?.[day] || []).filter(
                                c => c.studentGroupId === activeDemoGroup?.id
                              );
                              const item = cellClasses[0];

                              if (!item) {
                                return (
                                  <td
                                    key={day}
                                    className="p-1 border-l border-[#E4E2DA] h-[44px] bg-white"
                                  />
                                );
                              }

                              const pastel = getCoursePastel(item.code);
                              return (
                                <td
                                  key={day}
                                  className="p-1 border-l border-[#E4E2DA] align-top bg-white"
                                >
                                  <div
                                    onClick={() => setSelectedClass(item)}
                                    style={{
                                      backgroundColor: pastel.bg,
                                      borderColor: pastel.border
                                    }}
                                    className="rounded-lg p-1.5 border cursor-pointer hover:brightness-95 transition-all"
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="text-[10px] font-mono-tabular font-bold text-[#171717]">
                                        {item.code}
                                      </span>
                                      <span className="text-[9.5px] font-mono-tabular text-[#171717]/75">
                                        {item.room}
                                      </span>
                                    </div>
                                    <div className="text-[10.5px] font-medium text-[#171717] truncate mt-0.5">
                                      {item.title}
                                    </div>
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
          </div>
        </section>

        {/* ===================================================================
            3. SECTION 1: HOW SMARTGRID AI WORKS
            Automatic, display-only (non-interactive) 3-step sequential animation
           =================================================================== */}
        <section
          id="how-it-works"
          aria-label="How SmartGrid AI Works"
          className="scroll-mt-20 py-14 sm:py-16 px-4 sm:px-8 bg-white border-t border-[#E4E2DA]"
        >
          <div className="max-w-[1240px] mx-auto space-y-10">
            <div className="max-w-2xl space-y-2">
              <div className="text-xs font-mono-tabular uppercase tracking-wider text-[#77766F]">
                Automated Scheduling Workflow
              </div>
              <h2 className="font-serif-editorial text-2xl sm:text-3xl text-[#171717] tracking-tight">
                How SmartGrid AI Works
              </h2>
              <p className="text-xs sm:text-sm text-[#57564F] leading-relaxed">
                From university structure configuration to conflict-free timetable publication in three streamlined stages.
              </p>
            </div>

            {/* Display-Only Automated 3-Step Pipeline (Non-Interactive) */}
            <div
              aria-live="off"
              className="relative pointer-events-none select-none"
            >
              {/* Desktop Horizontal Animated Progress Line (connects all 3 step nodes) */}
              <div
                aria-hidden="true"
                className="hidden lg:block absolute top-11 left-[16%] right-[16%] h-1 rounded-full bg-[#E4E2DA] overflow-hidden z-0"
              >
                {/* Sequential Progress Fill */}
                <div
                  className="h-full bg-[#171717] transition-all duration-700 ease-in-out relative overflow-hidden"
                  style={{ width: `${progressPercentage}%` }}
                >
                  {/* Flowing Luminous Particle Stream */}
                  {!prefersReducedMotion && (
                    <div
                      className="sg-flow-particle absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-[#B7F77C] to-transparent"
                    />
                  )}
                </div>
              </div>

              {/* Mobile / Tablet Vertical Animated Connector Line */}
              <div
                aria-hidden="true"
                className="lg:hidden absolute top-10 bottom-10 left-7 w-0.5 bg-[#E4E2DA] overflow-hidden z-0"
              >
                <div
                  className="w-full bg-[#171717] transition-all duration-700 ease-in-out"
                  style={{ height: `${progressPercentage}%` }}
                />
              </div>

              {/* Three Simultaneous Step Panels */}
              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {HOW_IT_WORKS_STEPS.map((step, index) => {
                  const Icon = step.icon;
                  const isStepActive = prefersReducedMotion || activeProcessStep === index;
                  const isStepCompleted = !prefersReducedMotion && activeProcessStep > index;

                  return (
                    <div
                      key={step.number}
                      className={`rounded-2xl p-6 border transition-colors duration-500 flex flex-col justify-between ${
                        isStepActive
                          ? 'bg-[#F7F6EF] border-[#171717] shadow-[0_10px_28px_-14px_rgba(23,23,23,0.16)]'
                          : 'bg-white border-[#E4E2DA]'
                      }`}
                    >
                      <div className="space-y-4">
                        {/* Step Header: Animated Icon Node + Step Badge */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              style={{
                                backgroundColor: isStepActive
                                  ? step.accentBg
                                  : isStepCompleted
                                  ? '#EDEAE0'
                                  : '#F7F6EF',
                                borderColor: isStepActive ? '#171717' : '#E4E2DA'
                              }}
                              className={`w-11 h-11 rounded-xl border flex items-center justify-center text-[#171717] transition-colors duration-500 ${
                                isStepActive && !prefersReducedMotion ? 'sg-step-icon-active' : ''
                              }`}
                            >
                              <Icon className="w-5 h-5 text-[#171717]" />
                            </div>

                            <div>
                              <div className="text-[11px] font-mono-tabular font-bold uppercase tracking-wider text-[#77766F]">
                                Step {step.number}
                              </div>
                              <h3 className="font-serif-editorial text-xl text-[#171717] leading-snug">
                                {step.number} — {step.title}
                              </h3>
                            </div>
                          </div>

                          {/* Subtle Status Dot (Fixed size — zero layout shift) */}
                          <span
                            className={`w-2.5 h-2.5 rounded-full transition-colors duration-500 shrink-0 ${
                              isStepActive
                                ? 'bg-[#171717] ring-4 ring-[#B7F77C]/50'
                                : isStepCompleted
                                ? 'bg-[#171717]/60'
                                : 'bg-[#D6D3C9]'
                            }`}
                          />
                        </div>

                        {/* Step Bullet Points */}
                        <ul className="space-y-2 pt-2 border-t border-[#E4E2DA]">
                          {step.bullets.map(bullet => (
                            <li
                              key={bullet}
                              className="flex items-start gap-2.5 text-xs sm:text-[13px] text-[#57564F] leading-relaxed"
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 transition-colors duration-500 ${
                                  isStepActive ? 'bg-[#171717]' : 'bg-[#9E9D96]'
                                }`}
                              />
                              <span
                                className={`transition-colors duration-500 ${
                                  isStepActive ? 'text-[#171717] font-medium' : 'text-[#57564F]'
                                }`}
                              >
                                {bullet}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Bottom Progress Bar Indicator inside each step */}
                      <div className="pt-4 mt-5 border-t border-[#E4E2DA]/80 flex items-center justify-between text-[11px] font-mono-tabular text-[#77766F]">
                        <span>Stage {step.number} of 03</span>
                        <span
                          className={`font-semibold transition-colors duration-500 ${
                            isStepActive ? 'text-[#171717]' : 'text-[#77766F]'
                          }`}
                        >
                          {isStepActive
                            ? 'Active Stage'
                            : isStepCompleted
                            ? 'Completed'
                            : 'Queued'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            4. SECTION 2: WHY CHOOSE SMARTGRID AI?
            Clean 4-column compact benefit grid with subtle hover animations
           =================================================================== */}
        <section
          id="why-choose-smartgrid"
          aria-label="Why Choose SmartGrid AI"
          className="scroll-mt-20 py-14 sm:py-16 px-4 sm:px-8 bg-[#F7F6EF] border-y border-[#E4E2DA]"
        >
          <div className="max-w-[1240px] mx-auto space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-1.5">
                <div className="text-xs font-mono-tabular uppercase tracking-wider text-[#77766F]">
                  Platform Capabilities
                </div>
                <h2 className="font-serif-editorial text-2xl sm:text-3xl text-[#171717] tracking-tight">
                  Why Choose SmartGrid AI?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onOpenAuth('signup')}
                className="text-xs font-semibold text-[#171717] hover:underline inline-flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <span>Get started with your university</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {WHY_CHOOSE_BENEFITS.map(item => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="bg-white border border-[#E4E2DA] rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:border-[#171717]/40 hover:shadow-[0_10px_24px_-14px_rgba(23,23,23,0.14)]"
                  >
                    <div className="space-y-3.5">
                      <div
                        style={{
                          backgroundColor: item.accentBg,
                          borderColor: item.accentBorder
                        }}
                        className="w-10 h-10 rounded-xl border flex items-center justify-center text-[#171717]"
                      >
                        <Icon className="w-5 h-5 text-[#171717]" />
                      </div>

                      <div className="space-y-1.5">
                        <h3 className="font-serif-editorial text-lg text-[#171717] leading-snug">
                          {item.title}
                        </h3>
                        <p className="text-xs sm:text-[13px] text-[#57564F] leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ===================================================================
            5. COMPACT FINAL GET STARTED CTA
           =================================================================== */}
        <section className="py-12 sm:py-14 px-4 sm:px-8">
          <div className="max-w-[1240px] mx-auto">
            <div className="rounded-2xl bg-white border border-[#E4E2DA] px-6 py-7 sm:px-10 sm:py-9 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-1.5 max-w-xl">
                <h2 className="font-serif-editorial text-2xl sm:text-3xl text-[#171717] tracking-tight">
                  Start scheduling your university semester today.
                </h2>
                <p className="text-xs sm:text-sm text-[#57564F]">
                  Configure your academic calendar, choose department-wise or whole-university scheduling, and generate conflict-free timetables in seconds.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenAuth('signup')}
                  className="btn-primary h-11 px-6 text-sm whitespace-nowrap"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth('signin')}
                  className="btn-secondary h-11 px-5 text-sm whitespace-nowrap"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Log In</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* =====================================================================
          QUIET FOOTER
         ===================================================================== */}
      <footer className="border-t border-[#E4E2DA] bg-[#F7F6EF] px-4 sm:px-8 py-7">
        <div className="max-w-[1240px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#77766F]">
          <div className="flex items-center gap-2.5">
            <SmartGridLogo variant="primary" theme="light" size="xs" />
            <span>·</span>
            <span>University Timetable Scheduling &amp; Academic Resource Platform</span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <button
              type="button"
              onClick={() => scrollToId('timetable-preview')}
              className="hover:text-[#171717] transition-colors cursor-pointer"
            >
              Timetable Preview
            </button>
            <button
              type="button"
              onClick={() => scrollToId('how-it-works')}
              className="hover:text-[#171717] transition-colors cursor-pointer"
            >
              How It Works
            </button>
            <button
              type="button"
              onClick={() => scrollToId('why-choose-smartgrid')}
              className="hover:text-[#171717] transition-colors cursor-pointer"
            >
              Why SmartGrid AI
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('signin')}
              className="text-[#171717] font-semibold hover:underline cursor-pointer"
            >
              Log In
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
