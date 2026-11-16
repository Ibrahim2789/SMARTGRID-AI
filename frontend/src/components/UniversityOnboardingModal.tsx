import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import {
  Building2,
  Calendar,
  Clock,
  Coffee,
  Layers,
  ArrowRight,
  ArrowLeft,
  X,
  Upload,
  Check,
  Plus,
  Trash2,
  AlertCircle,
  ChevronDown,
  Sparkles,
  BookOpen,
  DoorOpen,
  Users,
  SlidersHorizontal
} from 'lucide-react';
import { institutionalStore, InstitutionProfile } from '../data/store';
import {
  AcademicTerm,
  DayOfWeek,
  FridayCompressionScope,
  FridayMode,
  TimeBlockBreak,
  TimeStructure,
  TermStatus,
  TimetableManagementPolicy,
  computeAcademicScheduleConfig,
  validateAcademicTimingConfig
} from '../types/institutional';
import { getStoredUser, updateUniversitySettingsBackend } from '../services/votingApi';
import { DataImportWizard } from './DataImportWizard';

interface UniversityOnboardingModalProps {
  onClose: () => void;
  onCompleted?: (newInstitutionId: string) => void;
  existingInstitutionId?: string;
  initialName?: string;
  initialCode?: string;
  initialCampusName?: string;
  initialRegistrarName?: string;
  initialRegistrarEmail?: string;
}

type CalendarSystemType = 'semester' | 'trimester' | 'quarter' | 'custom';
type PresetKey = 'semester-5day' | 'trimester-6day' | 'quarter-block';
type CatalogTab = 'departments' | 'rooms' | 'courses' | 'instructors';

const CALM_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const STEP_META = [
  {
    id: 0,
    title: 'Identity & Policy',
    shortDesc: 'Name, campus & governance',
    eyebrow: 'Institution Identity',
    heading: 'Tell us about your university',
    subtitle:
      'Start with a preset or enter your core campus details. Everything can be adjusted later.'
  },
  {
    id: 1,
    title: 'Academic Calendar',
    shortDesc: 'Terms, year & active dates',
    eyebrow: 'Academic Calendar',
    heading: 'Shape your academic year',
    subtitle:
      'Pick a semester, trimester, or quarter rhythm and mark which terms are active right now.'
  },
  {
    id: 2,
    title: 'Weekly Hours',
    shortDesc: 'Teaching days & daily span',
    eyebrow: 'Operating Schedule',
    heading: 'Set your campus weekly hours',
    subtitle:
      'Choose instructional days, opening and closing times, and any Friday prayer schedule rules.'
  },
  {
    id: 3,
    title: 'Class Pacing',
    shortDesc: 'Period lengths & breaks',
    eyebrow: 'Pacing & Breaks',
    heading: 'Tune class durations and breaks',
    subtitle:
      'Balance lecture lengths, continuous labs, and breathing room between classes with a live preview.'
  },
  {
    id: 4,
    title: 'Catalog & Launch',
    shortDesc: 'Starter structure & review',
    eyebrow: 'Review & Launch',
    heading: 'Review and launch your workspace',
    subtitle:
      'Optionally add starter departments, rooms, or import from CSV — or launch right away.'
  }
];

const stepperContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.08
    }
  }
};

const stepperItemVariants = {
  hidden: { opacity: 0, x: -14 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.34, ease: CALM_EASE }
  }
};

const mobileStepperItemVariants = {
  hidden: { opacity: 0, y: -8, scale: 0.94 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.28, ease: CALM_EASE }
  }
};

const stepHeaderSlideVariants = {
  enter: (direction: number) => ({
    x: direction >= 0 ? 28 : -28,
    opacity: 0
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.3, ease: CALM_EASE }
  },
  exit: (direction: number) => ({
    x: direction >= 0 ? -20 : 20,
    opacity: 0,
    transition: { duration: 0.18, ease: CALM_EASE }
  })
};

const stepSlideVariants = {
  enter: (direction: number) => ({
    x: direction >= 0 ? 40 : -40,
    opacity: 0
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.34, ease: CALM_EASE }
  },
  exit: (direction: number) => ({
    x: direction >= 0 ? -32 : 32,
    opacity: 0,
    transition: { duration: 0.2, ease: CALM_EASE }
  })
};

interface CalmSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}

const CalmSwitch: React.FC<CalmSwitchProps> = ({ checked, onChange, ariaLabel }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors cursor-pointer ${
      checked
        ? 'bg-[#171717] border-[#171717]'
        : 'bg-[#EDEAE0] border-[#D6D3C9] hover:border-[#77766F]'
    }`}
  >
    <motion.span
      layout
      transition={{ type: 'spring', stiffness: 500, damping: 34 }}
      className={`inline-block h-4 w-4 rounded-full bg-white shadow-xs ${
        checked ? 'ml-[22px]' : 'ml-[3px]'
      }`}
    />
  </button>
);

function parseMinutesSafe(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(n => Number(n));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function formatDurationSpan(start: string, end: string): string {
  const diff = parseMinutesSafe(end) - parseMinutesSafe(start);
  if (diff <= 0) return 'Invalid span';
  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;
  return mins > 0 ? `${hrs}h ${mins}m campus day` : `${hrs}h campus day`;
}

export const UniversityOnboardingModal: React.FC<UniversityOnboardingModalProps> = ({
  onClose,
  onCompleted,
  existingInstitutionId,
  initialName = '',
  initialCode = '',
  initialCampusName = 'Main Campus',
  initialRegistrarName = 'Academic Registrar',
  initialRegistrarEmail = 'registrar@university.edu'
}) => {
  const existingSnapshot = institutionalStore.get();
  const isEditingExisting = Boolean(existingInstitutionId);

  const [activeStep, setActiveStep] = useState<number>(0);
  const [direction, setDirection] = useState<number>(1);
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(() => new Set([0]));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedInstId, setCompletedInstId] = useState<string>('');
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [stepSavedToast, setStepSavedToast] = useState<string | null>(null);

  // Subtle progressive disclosure toggles to keep every step airy & calm
  const [selectedPreset, setSelectedPreset] = useState<PresetKey | null>(null);
  const [showMoreIdentity, setShowMoreIdentity] = useState(false);
  const [showAddTermDrawer, setShowAddTermDrawer] = useState(false);
  const [showFridayCompression, setShowFridayCompression] = useState(false);
  const [showCustomBreaksDrawer, setShowCustomBreaksDrawer] = useState(false);
  const [activeCatalogTab, setActiveCatalogTab] = useState<CatalogTab>('departments');

  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const completionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (completionTimerRef.current) {
        window.clearTimeout(completionTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (bodyScrollRef.current) {
      bodyScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeStep]);

  // =========================================================
  // STEP 1: Institution Identity & Governance
  // =========================================================
  const [name, setName] = useState(
    initialName || (isEditingExisting ? existingSnapshot.institutionProfile?.name || '' : '')
  );
  const [code, setCode] = useState(
    initialCode || (isEditingExisting ? existingSnapshot.institutionProfile?.code || 'UNIV' : '')
  );
  const [campusName, setCampusName] = useState(
    initialCampusName || existingSnapshot.institutionProfile?.campusName || 'Main Campus'
  );
  const [campusCode, setCampusCode] = useState(
    isEditingExisting
      ? existingSnapshot.institutionProfile?.campusCode || 'MAIN-01'
      : `${(initialCode || 'UNIV').toUpperCase()}-MAIN-01`
  );
  const [timezone, setTimezone] = useState(
    existingSnapshot.institutionProfile?.timezone || 'UTC'
  );
  const [accreditation, setAccreditation] = useState(
    existingSnapshot.institutionProfile?.accreditation ||
      'National Higher Education Accreditation Council'
  );
  const [registrarName, setRegistrarName] = useState(
    initialRegistrarName ||
      existingSnapshot.institutionProfile?.registrarName ||
      'Academic Registrar'
  );
  const [registrarEmail, setRegistrarEmail] = useState(
    initialRegistrarEmail ||
      existingSnapshot.institutionProfile?.registrarEmail ||
      'registrar@university.edu'
  );
  const [autoConflictSweep, setAutoConflictSweep] = useState<boolean>(
    existingSnapshot.institutionProfile?.autoConflictSweep !== false
  );
  const [timetableManagementPolicy, setTimetableManagementPolicy] =
    useState<TimetableManagementPolicy>(
      existingSnapshot.institutionProfile?.timetableManagementPolicy || 'whole_university'
    );

  // =========================================================
  // STEP 2: Academic Calendar Structure
  // =========================================================
  const [calendarSystem, setCalendarSystem] = useState<CalendarSystemType>('semester');
  const [academicYear, setAcademicYear] = useState(
    existingSnapshot.institutionProfile?.academicYear || '2026–2027'
  );
  const [terms, setTerms] = useState<AcademicTerm[]>(() => {
    if (isEditingExisting && existingSnapshot.terms.length > 0) {
      return existingSnapshot.terms.map(t => ({ ...t }));
    }
    return [
      {
        id: 'term-fall-2026',
        name: 'Fall Semester 2026',
        code: 'FALL-2026',
        startDate: '2026-09-01',
        endDate: '2026-12-20',
        status: 'active',
        weeksCount: 16
      },
      {
        id: 'term-spring-2027',
        name: 'Spring Semester 2027',
        code: 'SPR-2027',
        startDate: '2027-01-18',
        endDate: '2027-05-14',
        status: 'draft',
        weeksCount: 16
      }
    ];
  });

  const [newTermName, setNewTermName] = useState('');
  const [newTermCode, setNewTermCode] = useState('');
  const [newTermAcademicYear, setNewTermAcademicYear] = useState('2026–2027');
  const [newTermStart, setNewTermStart] = useState('2027-06-01');
  const [newTermEnd, setNewTermEnd] = useState('2027-08-01');
  const [newTermWeeks, setNewTermWeeks] = useState<number>(8);
  const [newTermActive, setNewTermActive] = useState<boolean>(true);

  // =========================================================
  // STEP 3: Daily Operating Hours
  // =========================================================
  const [workingDays, setWorkingDays] = useState<DayOfWeek[]>(() =>
    isEditingExisting && existingSnapshot.timeStructure.workingDays?.length
      ? [...existingSnapshot.timeStructure.workingDays]
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  );
  const [dayStartTime, setDayStartTime] = useState(
    isEditingExisting ? existingSnapshot.timeStructure.dayStartTime || '09:00' : '09:00'
  );
  const [dayEndTime, setDayEndTime] = useState(
    isEditingExisting ? existingSnapshot.timeStructure.dayEndTime || '17:00' : '17:00'
  );
  const [fridayMode, setFridayMode] = useState<FridayMode>(() => {
    if (isEditingExisting) {
      if (existingSnapshot.timeStructure.fridayMode) {
        return existingSnapshot.timeStructure.fridayMode;
      }
      return existingSnapshot.timeStructure.fridayAfternoonShiftEnabled
        ? 'jummah_break'
        : 'standard';
    }
    return 'jummah_break';
  });
  const [fridayBreakStartTime, setFridayBreakStartTime] = useState<string>(
    isEditingExisting ? existingSnapshot.timeStructure.fridayBreakStartTime || '13:00' : '13:00'
  );
  const [fridayBreakEndTime, setFridayBreakEndTime] = useState<string>(
    isEditingExisting
      ? existingSnapshot.timeStructure.fridayBreakEndTime ||
          existingSnapshot.timeStructure.fridayAfternoonStartTime ||
          '14:30'
      : '14:30'
  );
  const [fridayClosingTime, setFridayClosingTime] = useState<string>(
    isEditingExisting ? existingSnapshot.timeStructure.fridayClosingTime || '13:00' : '13:00'
  );
  const [fridayCompressionScope, setFridayCompressionScope] = useState<FridayCompressionScope>(
    isEditingExisting
      ? existingSnapshot.timeStructure.fridayCompressionScope || 'after_jummah'
      : 'after_jummah'
  );
  const [fridayPeriodLengthMinutes, setFridayPeriodLengthMinutes] = useState<number>(
    isEditingExisting
      ? existingSnapshot.timeStructure.fridayPeriodLengthMinutes || 45
      : 45
  );
  const [fridayShortBreakMinutes, setFridayShortBreakMinutes] = useState<number>(
    isEditingExisting ? existingSnapshot.timeStructure.fridayShortBreakMinutes ?? 5 : 5
  );

  // =========================================================
  // STEP 4: Session Duration & Break Policy
  // =========================================================
  const [periodLengthMinutes, setPeriodLengthMinutes] = useState<number>(
    isEditingExisting ? existingSnapshot.timeStructure.periodLengthMinutes || 50 : 50
  );
  const [labDurationMinutes, setLabDurationMinutes] = useState<number>(
    isEditingExisting ? existingSnapshot.timeStructure.labDurationMinutes || 180 : 180
  );
  const [defaultLectureHoursPerWeek, setDefaultLectureHoursPerWeek] = useState<number>(3);
  const [defaultLabHoursPerWeek, setDefaultLabHoursPerWeek] = useState<number>(3);

  const [shortBreakEnabled, setShortBreakEnabled] = useState<boolean>(
    isEditingExisting ? existingSnapshot.timeStructure.shortBreakEnabled !== false : true
  );
  const [shortBreakMinutes, setShortBreakMinutes] = useState<number>(
    isEditingExisting ? existingSnapshot.timeStructure.shortBreakMinutes ?? 10 : 10
  );
  const [includeBreakAfterLastSlot, setIncludeBreakAfterLastSlot] = useState<boolean>(
    isEditingExisting ? Boolean(existingSnapshot.timeStructure.includeBreakAfterLastSlot) : false
  );
  const [middayBreakEnabled, setMiddayBreakEnabled] = useState<boolean>(
    isEditingExisting ? existingSnapshot.timeStructure.middayBreakEnabled !== false : true
  );
  const [middayBreakMode, setMiddayBreakMode] = useState<'fixed' | 'auto'>(
    isEditingExisting ? existingSnapshot.timeStructure.middayBreakMode || 'fixed' : 'fixed'
  );
  const [middayBreakStartTime, setMiddayBreakStartTime] = useState(
    isEditingExisting ? existingSnapshot.timeStructure.middayBreakStartTime || '13:00' : '13:00'
  );
  const [middayBreakDurationMinutes, setMiddayBreakDurationMinutes] = useState<number>(
    isEditingExisting ? existingSnapshot.timeStructure.middayBreakDurationMinutes || 60 : 60
  );

  const [customBreaks, setCustomBreaks] = useState<TimeBlockBreak[]>(() => {
    if (isEditingExisting && existingSnapshot.timeStructure.breaks?.length) {
      return existingSnapshot.timeStructure.breaks.filter(
        b => !b.id.includes('lunch') && !b.name.toLowerCase().includes('lunch')
      );
    }
    return [];
  });
  const [newBreakName, setNewBreakName] = useState('');
  const [newBreakStart, setNewBreakStart] = useState('10:50');
  const [newBreakEnd, setNewBreakEnd] = useState('11:10');
  const [newBreakDays, setNewBreakDays] = useState<DayOfWeek[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);

  // =========================================================
  // STEP 5: Optional Starter Catalog (Clean slate — zero fake accounts)
  // =========================================================
  const [departments, setDepartments] = useState<
    Array<{ name: string; code: string; school: string }>
  >(() =>
    isEditingExisting
      ? existingSnapshot.departments.map(d => ({
          name: d.name,
          code: d.code,
          school: d.school || 'Academic Division'
        }))
      : []
  );
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');

  const [rooms, setRooms] = useState<
    Array<{ code: string; capacity: number; type: 'lecture' | 'lab' }>
  >(() =>
    isEditingExisting
      ? existingSnapshot.rooms.map(r => ({
          code: r.code,
          capacity: r.capacity,
          type: r.type === 'lab' ? 'lab' : 'lecture'
        }))
      : []
  );
  const [newRoomCode, setNewRoomCode] = useState('');
  const [newRoomCap, setNewRoomCap] = useState(50);
  const [newRoomType, setNewRoomType] = useState<'lecture' | 'lab'>('lecture');

  const [courses, setCourses] = useState<
    Array<{ code: string; title: string; cr: number; isLab: boolean }>
  >(() =>
    isEditingExisting
      ? existingSnapshot.courses.map(c => ({
          code: c.code,
          title: c.title,
          cr: c.creditHours,
          isLab: c.requiredRoomType === 'lab' || c.labHours > 0
        }))
      : []
  );
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseIsLab, setNewCourseIsLab] = useState<boolean>(false);

  const [instructors, setInstructors] = useState<
    Array<{ name: string; title: string; email: string }>
  >(() =>
    isEditingExisting
      ? existingSnapshot.instructors.map(i => ({
          name: i.name,
          title: i.title,
          email: i.email
        }))
      : []
  );
  const [newInstName, setNewInstName] = useState('');
  const [newInstEmail, setNewInstEmail] = useState('');

  // =========================================================
  // PRESET & HELPER HANDLERS
  // =========================================================
  const applyInstitutionPreset = (preset: PresetKey) => {
    setOnboardingError(null);
    setSelectedPreset(preset);
    if (preset === 'semester-5day') {
      setCalendarSystem('semester');
      setTerms([
        {
          id: 'term-fall-2026',
          name: 'Fall Semester 2026',
          code: 'FALL-2026',
          startDate: '2026-09-01',
          endDate: '2026-12-20',
          status: 'active',
          weeksCount: 16
        },
        {
          id: 'term-spring-2027',
          name: 'Spring Semester 2027',
          code: 'SPR-2027',
          startDate: '2027-01-18',
          endDate: '2027-05-14',
          status: 'draft',
          weeksCount: 16
        }
      ]);
      setWorkingDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
      setDayStartTime('09:00');
      setDayEndTime('17:00');
      setPeriodLengthMinutes(50);
      setShortBreakEnabled(true);
      setShortBreakMinutes(10);
      setMiddayBreakEnabled(true);
      setMiddayBreakStartTime('13:00');
      setMiddayBreakDurationMinutes(60);
      setLabDurationMinutes(180);
      setStepSavedToast('Applied 5-Day Semester schedule defaults — customize anything below.');
    } else if (preset === 'trimester-6day') {
      setCalendarSystem('trimester');
      setTerms([
        {
          id: 'term-t1-2026',
          name: 'Autumn Trimester T1',
          code: 'TRI-1-2026',
          startDate: '2026-09-01',
          endDate: '2026-11-28',
          status: 'active',
          weeksCount: 12
        },
        {
          id: 'term-t2-2027',
          name: 'Winter Trimester T2',
          code: 'TRI-2-2027',
          startDate: '2026-12-07',
          endDate: '2027-03-06',
          status: 'draft',
          weeksCount: 12
        },
        {
          id: 'term-t3-2027',
          name: 'Spring Trimester T3',
          code: 'TRI-3-2027',
          startDate: '2027-03-15',
          endDate: '2027-06-12',
          status: 'draft',
          weeksCount: 12
        }
      ]);
      setWorkingDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
      setDayStartTime('08:30');
      setDayEndTime('16:30');
      setPeriodLengthMinutes(60);
      setShortBreakEnabled(false);
      setShortBreakMinutes(0);
      setMiddayBreakEnabled(true);
      setMiddayBreakStartTime('12:30');
      setMiddayBreakDurationMinutes(60);
      setLabDurationMinutes(120);
      setStepSavedToast('Applied 6-Day Trimester schedule defaults — customize anything below.');
    } else {
      setCalendarSystem('quarter');
      setTerms([
        {
          id: 'term-q1-2026',
          name: 'Fall Quarter 2026',
          code: 'Q1-FALL26',
          startDate: '2026-09-21',
          endDate: '2026-12-04',
          status: 'active',
          weeksCount: 10
        },
        {
          id: 'term-q2-2027',
          name: 'Winter Quarter 2027',
          code: 'Q2-WIN27',
          startDate: '2027-01-04',
          endDate: '2027-03-19',
          status: 'draft',
          weeksCount: 10
        },
        {
          id: 'term-q3-2027',
          name: 'Spring Quarter 2027',
          code: 'Q3-SPR27',
          startDate: '2027-03-29',
          endDate: '2027-06-11',
          status: 'draft',
          weeksCount: 10
        }
      ]);
      setWorkingDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
      setDayStartTime('08:00');
      setDayEndTime('17:30');
      setPeriodLengthMinutes(75);
      setShortBreakEnabled(true);
      setShortBreakMinutes(15);
      setMiddayBreakEnabled(true);
      setMiddayBreakStartTime('12:30');
      setMiddayBreakDurationMinutes(60);
      setLabDurationMinutes(150);
      setStepSavedToast('Applied Quarter Block (75 min) defaults — customize anything below.');
    }
  };

  const handleSelectCalendarSystem = (sys: CalendarSystemType) => {
    setCalendarSystem(sys);
    if (sys === 'semester') {
      setTerms([
        {
          id: 'term-fall-2026',
          name: 'Fall Semester 2026',
          code: 'FALL-2026',
          startDate: '2026-09-01',
          endDate: '2026-12-20',
          status: 'active',
          weeksCount: 16
        },
        {
          id: 'term-spring-2027',
          name: 'Spring Semester 2027',
          code: 'SPR-2027',
          startDate: '2027-01-18',
          endDate: '2027-05-14',
          status: 'draft',
          weeksCount: 16
        }
      ]);
    } else if (sys === 'trimester') {
      setTerms([
        {
          id: 'term-tri-1',
          name: 'Trimester 1 (Autumn)',
          code: 'TRI-1',
          startDate: '2026-09-01',
          endDate: '2026-11-28',
          status: 'active',
          weeksCount: 12
        },
        {
          id: 'term-tri-2',
          name: 'Trimester 2 (Winter)',
          code: 'TRI-2',
          startDate: '2026-12-07',
          endDate: '2027-03-06',
          status: 'draft',
          weeksCount: 12
        },
        {
          id: 'term-tri-3',
          name: 'Trimester 3 (Spring)',
          code: 'TRI-3',
          startDate: '2027-03-15',
          endDate: '2027-06-12',
          status: 'draft',
          weeksCount: 12
        }
      ]);
    } else if (sys === 'quarter') {
      setTerms([
        {
          id: 'term-q1',
          name: 'Autumn Quarter',
          code: 'AUT-Q1',
          startDate: '2026-09-21',
          endDate: '2026-12-04',
          status: 'active',
          weeksCount: 10
        },
        {
          id: 'term-q2',
          name: 'Winter Quarter',
          code: 'WIN-Q2',
          startDate: '2027-01-04',
          endDate: '2027-03-19',
          status: 'draft',
          weeksCount: 10
        },
        {
          id: 'term-q3',
          name: 'Spring Quarter',
          code: 'SPR-Q3',
          startDate: '2027-03-29',
          endDate: '2027-06-11',
          status: 'draft',
          weeksCount: 10
        },
        {
          id: 'term-q4',
          name: 'Summer Quarter',
          code: 'SUM-Q4',
          startDate: '2027-06-21',
          endDate: '2027-08-27',
          status: 'draft',
          weeksCount: 10
        }
      ]);
    }
  };

  const handleAddTerm = () => {
    if (!newTermName.trim() || !newTermCode.trim()) return;
    const created: AcademicTerm = {
      id: `term-custom-${Date.now().toString(36)}`,
      name: newTermName.trim(),
      code: newTermCode.trim().toUpperCase(),
      academicYear: newTermAcademicYear.trim() || academicYear.trim(),
      startDate: newTermStart || '2026-09-01',
      endDate: newTermEnd || '2026-12-20',
      status: terms.length === 0 || newTermActive ? 'active' : 'draft',
      weeksCount: Math.max(1, Number(newTermWeeks) || 16)
    };
    setTerms([...terms, created]);
    setNewTermName('');
    setNewTermCode('');
    setShowAddTermDrawer(false);
  };

  const handleToggleTermActive = (termId: string) => {
    const activeCount = terms.filter(t => t.status === 'active').length;
    setTerms(
      terms.map(t => {
        if (t.id !== termId) return t;
        const isCurrentActive = t.status === 'active';
        if (isCurrentActive && activeCount <= 1) {
          return t;
        }
        return {
          ...t,
          status: (isCurrentActive ? 'draft' : 'active') as TermStatus
        };
      })
    );
  };

  const handleAddCustomBreak = () => {
    if (!newBreakName.trim() || newBreakDays.length === 0) return;
    const item: TimeBlockBreak = {
      id: `brk-custom-${Date.now().toString(36)}`,
      name: newBreakName.trim(),
      startTime: newBreakStart,
      endTime: newBreakEnd,
      days: [...newBreakDays]
    };
    setCustomBreaks([...customBreaks, item]);
    setNewBreakName('');
  };

  const toggleDay = (day: DayOfWeek) => {
    if (workingDays.includes(day)) {
      if (workingDays.length > 1) {
        setWorkingDays(workingDays.filter(d => d !== day));
      }
    } else {
      setWorkingDays([...workingDays, day]);
    }
  };

  const toggleNewBreakDay = (day: DayOfWeek) => {
    if (newBreakDays.includes(day)) {
      if (newBreakDays.length > 1) {
        setNewBreakDays(newBreakDays.filter(d => d !== day));
      }
    } else {
      setNewBreakDays([...newBreakDays, day]);
    }
  };

  const handleAddDept = () => {
    if (!newDeptName.trim() || !newDeptCode.trim()) return;
    setDepartments([
      ...departments,
      {
        name: newDeptName.trim(),
        code: newDeptCode.trim().toUpperCase(),
        school: 'Academic Division'
      }
    ]);
    setNewDeptName('');
    setNewDeptCode('');
  };

  const handleAddRoom = () => {
    if (!newRoomCode.trim()) return;
    setRooms([
      ...rooms,
      { code: newRoomCode.trim().toUpperCase(), capacity: newRoomCap, type: newRoomType }
    ]);
    setNewRoomCode('');
  };

  const handleAddCourse = () => {
    if (!newCourseCode.trim() || !newCourseTitle.trim()) return;
    setCourses([
      ...courses,
      {
        code: newCourseCode.trim().toUpperCase(),
        title: newCourseTitle.trim(),
        cr: newCourseIsLab ? 1 : 3,
        isLab: newCourseIsLab
      }
    ]);
    setNewCourseCode('');
    setNewCourseTitle('');
  };

  const handleAddInstructor = () => {
    if (!newInstName.trim() || !newInstEmail.trim()) return;
    setInstructors([
      ...instructors,
      {
        name: newInstName.trim(),
        title: 'Associate Professor',
        email: newInstEmail.trim().toLowerCase()
      }
    ]);
    setNewInstName('');
    setNewInstEmail('');
  };

  const timingCandidate: Partial<TimeStructure> = useMemo(
    () => ({
      workingDays,
      dayStartTime,
      dayEndTime,
      periodLengthMinutes,
      shortBreakEnabled,
      shortBreakMinutes,
      includeBreakAfterLastSlot,
      middayBreakEnabled,
      middayBreakMode,
      middayBreakStartTime,
      middayBreakDurationMinutes,
      labDurationMinutes,
      fridayAfternoonShiftEnabled: fridayMode !== 'standard',
      fridayAfternoonStartTime: fridayBreakEndTime,
      fridayMode,
      fridayBreakStartTime,
      fridayBreakEndTime,
      fridayClosingTime,
      fridayCompressionScope,
      fridayPeriodLengthMinutes,
      fridayShortBreakMinutes
    }),
    [
      workingDays,
      dayStartTime,
      dayEndTime,
      periodLengthMinutes,
      shortBreakEnabled,
      shortBreakMinutes,
      includeBreakAfterLastSlot,
      middayBreakEnabled,
      middayBreakMode,
      middayBreakStartTime,
      middayBreakDurationMinutes,
      labDurationMinutes,
      fridayMode,
      fridayBreakStartTime,
      fridayBreakEndTime,
      fridayClosingTime,
      fridayCompressionScope,
      fridayPeriodLengthMinutes,
      fridayShortBreakMinutes
    ]
  );

  const computedPreview = useMemo(
    () => computeAcademicScheduleConfig(timingCandidate),
    [timingCandidate]
  );
  const timingValidation = useMemo(
    () => validateAcademicTimingConfig(timingCandidate),
    [timingCandidate]
  );
  const activeTermObj = terms.find(t => t.status === 'active') || terms[0];

  // =========================================================
  // STEP VALIDATION & NAVIGATION
  // =========================================================
  const persistCurrentStepToStore = (stepIndex: number): boolean => {
    setOnboardingError(null);
    setStepSavedToast(null);

    if (stepIndex === 0) {
      if (!name.trim() || !code.trim()) {
        setOnboardingError('Please enter your university name and short code before continuing.');
        return false;
      }
      if (isEditingExisting) {
        institutionalStore.saveProfileConfig({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          campusName: campusName.trim() || 'Main Campus',
          campusCode: campusCode.trim().toUpperCase() || `${code.trim().toUpperCase()}-MAIN-01`,
          accreditation: accreditation.trim(),
          registrarName: registrarName.trim(),
          registrarEmail: registrarEmail.trim(),
          timezone: timezone || 'UTC',
          autoConflictSweep,
          timetableManagementPolicy
        });
      }
      return true;
    }

    if (stepIndex === 1) {
      if (terms.length === 0) {
        setOnboardingError('Please keep at least one academic semester or term.');
        return false;
      }
      const activeNames = terms.filter(t => t.status === 'active').map(t => t.name);
      if (isEditingExisting) {
        institutionalStore.saveAcademicCalendarConfig({
          academicYear: academicYear.trim(),
          currentTermName: activeNames.join(' + ') || activeTermObj?.name || terms[0].name,
          terms
        });
      }
      return true;
    }

    if (stepIndex === 2) {
      if (workingDays.length === 0) {
        setOnboardingError('Please select at least one operating day.');
        return false;
      }
      if (dayEndTime <= dayStartTime) {
        setOnboardingError('Daily closing time must be later than daily opening time.');
        return false;
      }
      if (isEditingExisting) {
        institutionalStore.saveOperatingHoursConfig({
          workingDays,
          dayStartTime,
          dayEndTime,
          fridayAfternoonShiftEnabled: fridayMode !== 'standard',
          fridayAfternoonStartTime: fridayBreakEndTime,
          fridayMode,
          fridayBreakStartTime,
          fridayBreakEndTime,
          fridayClosingTime,
          fridayCompressionScope,
          fridayPeriodLengthMinutes,
          fridayShortBreakMinutes
        });
      }
      return true;
    }

    if (stepIndex === 3) {
      if (!timingValidation.valid) {
        setOnboardingError(
          timingValidation.errors[0] || 'Please adjust session duration or break settings.'
        );
        return false;
      }
      if (isEditingExisting) {
        const res = institutionalStore.saveSessionAndBreakPolicyConfig({
          ...timingCandidate,
          breaks: customBreaks
        });
        if (!res.success) {
          setOnboardingError(res.errors[0] || 'Could not save session and break settings.');
          return false;
        }
      }
      return true;
    }

    return true;
  };

  const goToStep = (targetStep: number) => {
    if (targetStep === activeStep || isCompleted) return;
    if (targetStep > activeStep) {
      const ok = persistCurrentStepToStore(activeStep);
      if (!ok) return;
    } else {
      setOnboardingError(null);
      setStepSavedToast(null);
    }
    setDirection(targetStep > activeStep ? 1 : -1);
    setVisitedSteps(prev => {
      const next = new Set(prev);
      next.add(activeStep);
      next.add(targetStep);
      return next;
    });
    setActiveStep(targetStep);
  };

  const handleAdvanceStep = () => {
    const ok = persistCurrentStepToStore(activeStep);
    if (!ok) return;
    const nextStep = Math.min(STEP_META.length - 1, activeStep + 1);
    setDirection(1);
    setVisitedSteps(prev => {
      const next = new Set(prev);
      next.add(activeStep);
      next.add(nextStep);
      return next;
    });
    setActiveStep(nextStep);
  };

  const handlePreviousStep = () => {
    if (activeStep === 0) return;
    setOnboardingError(null);
    setStepSavedToast(null);
    setDirection(-1);
    setActiveStep(Math.max(0, activeStep - 1));
  };

  const handleFinalizeOnboarding = async () => {
    if (!name.trim() || !code.trim()) {
      setDirection(-1);
      setActiveStep(0);
      setOnboardingError('Please provide your university name and short code.');
      return;
    }

    if (terms.length === 0) {
      setDirection(-1);
      setActiveStep(1);
      setOnboardingError('Please configure at least one academic term.');
      return;
    }

    if (!timingValidation.valid) {
      setDirection(-1);
      setActiveStep(3);
      setOnboardingError(
        timingValidation.errors[0] || 'Please fix operating hours or break settings.'
      );
      return;
    }

    setOnboardingError(null);
    setIsSubmitting(true);

    try {
      const targetInstId =
        existingInstitutionId ||
        `inst-${code.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;

      const activeNames = terms.filter(t => t.status === 'active').map(t => t.name);
      const profile: InstitutionProfile = {
        id: targetInstId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        campusCode: campusCode.trim().toUpperCase() || `${code.toUpperCase()}-MAIN-01`,
        campusName: campusName.trim() || 'Main Campus',
        accreditation: accreditation.trim(),
        academicYear: academicYear.trim(),
        currentTermName:
          activeNames.join(' + ') || activeTermObj?.name || terms[0]?.name || 'Configured Semester',
        activeTermIds: terms.filter(t => t.status === 'active').map(t => t.id),
        timetableManagementPolicy,
        registrarName: registrarName.trim(),
        registrarEmail: registrarEmail.trim(),
        autoConflictSweep,
        defaultSessionMinutes: periodLengthMinutes,
        timezone: timezone || 'UTC',
        isSample: false
      };

      const allBreaks: TimeBlockBreak[] = [
        ...(computedPreview.middayBreak.enabled
          ? [
              {
                id: `break-${targetInstId}-lunch`,
                name: 'University Midday / Lunch Break',
                startTime: computedPreview.middayBreak.startTime24,
                endTime: computedPreview.middayBreak.endTime24,
                days: workingDays
              }
            ]
          : []),
        ...customBreaks
      ];

      const timeConfig: Partial<TimeStructure> = {
        ...timingCandidate,
        periods: computedPreview.periods,
        breaks: allBreaks
      };

      if (!isEditingExisting) {
        institutionalStore.registerNewInstitution(profile, timeConfig, terms);
      }
      institutionalStore.saveProfileConfig(profile);
      institutionalStore.saveAcademicCalendarConfig({
        academicYear: academicYear.trim(),
        currentTermName: activeTermObj?.name || terms[0].name,
        terms
      });
      institutionalStore.saveOperatingHoursConfig({
        workingDays,
        dayStartTime,
        dayEndTime,
        fridayAfternoonShiftEnabled: fridayMode !== 'standard',
        fridayAfternoonStartTime: fridayBreakEndTime,
        fridayMode,
        fridayBreakStartTime,
        fridayBreakEndTime,
        fridayClosingTime,
        fridayCompressionScope,
        fridayPeriodLengthMinutes,
        fridayShortBreakMinutes
      });
      institutionalStore.saveSessionAndBreakPolicyConfig({
        ...timeConfig,
        breaks: customBreaks
      });

      // Only add catalog items explicitly created by the user during onboarding
      const current = institutionalStore.get();
      if (current.departments.length === 0 && departments.length > 0) {
        departments.forEach((d, i) => {
          institutionalStore.addDepartment({
            id: `dept-${d.code.toLowerCase()}-${i}`,
            code: d.code,
            name: d.name,
            school: d.school,
            colorHex: i === 0 ? '#1E3A8A' : i === 1 ? '#047857' : '#B45309'
          });
        });
      }

      const afterDepts = institutionalStore.get();
      const bldId = afterDepts.buildings[0]?.id || 'bld-main';
      const firstDeptId = afterDepts.departments[0]?.id || 'dept-gen';

      if (afterDepts.rooms.length === 0 && rooms.length > 0) {
        rooms.forEach((r, i) => {
          institutionalStore.addRoom({
            id: `room-${r.code.toLowerCase()}-${i}`,
            code: r.code,
            name: `${r.code} (${r.type === 'lab' ? 'Laboratory' : 'Lecture Hall'})`,
            buildingId: bldId,
            capacity: r.capacity,
            type: r.type,
            equipment:
              r.type === 'lab'
                ? ['Specialized Workstations', 'Safety System']
                : ['Projector', 'Whiteboard'],
            isAccessible: true,
            isAvailable: true
          });
        });
      }

      if (afterDepts.courses.length === 0 && courses.length > 0) {
        courses.forEach((c, i) => {
          institutionalStore.addCourse({
            id: `course-${c.code.toLowerCase()}-${i}`,
            departmentId: firstDeptId,
            code: c.code,
            title: c.title,
            creditHours: c.cr,
            lectureHours: c.isLab ? 0 : defaultLectureHoursPerWeek,
            labHours: c.isLab ? defaultLabHoursPerWeek : 0,
            weeklyContactHours: c.isLab ? defaultLabHoursPerWeek : defaultLectureHoursPerWeek,
            requiredRoomType: c.isLab ? 'lab' : 'lecture'
          });
        });
      }

      if (afterDepts.instructors.length === 0 && instructors.length > 0) {
        instructors.forEach((inst, i) => {
          institutionalStore.addInstructor({
            id: `instructor-${Date.now()}-${i}`,
            departmentId: firstDeptId,
            name: inst.name,
            email: inst.email,
            title: inst.title,
            maxWeeklyHours: 14,
            maxConsecutiveHours: 3,
            preferredDays: workingDays,
            unavailableSlots: []
          });
        });
      }

      // Sync saved academy settings to Supabase backend when logged in
      const storedUser = getStoredUser();
      if (storedUser?.token) {
        const targetSyncId = storedUser.institutionId || targetInstId;
        void updateUniversitySettingsBackend(storedUser, targetSyncId, {
          workingDays,
          dayStartTime,
          dayEndTime,
          periodLengthMinutes,
          shortBreakMinutes: shortBreakEnabled ? shortBreakMinutes : 0,
          middayBreakEnabled,
          middayBreakStart: middayBreakStartTime,
          middayBreakDuration: middayBreakDurationMinutes,
          labDurationMinutes
        }).catch(() => {});
        void institutionalStore.syncToBackend(storedUser);
      }

      setIsSubmitting(false);
      setCompletedInstId(targetInstId);
      setIsCompleted(true);

      completionTimerRef.current = window.setTimeout(() => {
        onCompleted?.(targetInstId);
        onClose();
      }, 1350);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setIsSubmitting(false);
      setOnboardingError(`Could not save setup: ${message}`);
    }
  };

  const finishImmediately = () => {
    if (completionTimerRef.current) {
      window.clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }
    if (completedInstId) {
      onCompleted?.(completedInstId);
    }
    onClose();
  };

  const currentMeta = STEP_META[activeStep];
  const progressFraction = (activeStep + 1) / STEP_META.length;
  const stepIcons = [Building2, Calendar, Clock, Coffee, Layers];

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: CALM_EASE }}
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#171717]/45 backdrop-blur-xs"
      >
        {showImportWizard && (
          <DataImportWizard
            onClose={() => setShowImportWizard(false)}
            onSuccess={() => {
              setShowImportWizard(false);
            }}
          />
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.3, ease: CALM_EASE }}
          role="dialog"
          aria-modal="true"
          aria-label="Academy Configuration Wizard"
          className="w-full max-w-5xl h-[min(88vh,740px)] flex flex-col lg:flex-row bg-white border border-[#E4E2DA] rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* =========================================================
              LEFT CALM GUIDED STEP RAIL (Desktop)
             ========================================================= */}
          <aside className="hidden lg:flex lg:w-[272px] shrink-0 flex-col justify-between bg-[#F7F6EF] border-r border-[#E4E2DA] p-6">
            <div className="space-y-6">
              {/* Academy Brand Preview */}
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: CALM_EASE }}
                className="space-y-1.5 pb-5 border-b border-[#E4E2DA]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#171717] text-white flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-mono-tabular uppercase tracking-wider text-[#77766F]">
                      Academy Setup
                    </div>
                    <div className="text-sm font-semibold text-[#171717] truncate">
                      {code ? `${code} · ${name || 'University'}` : name || 'New University'}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Vertical Stepper with Staggered Entrance */}
              <motion.nav
                aria-label="Setup Steps"
                variants={stepperContainerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-1.5"
              >
                {STEP_META.map((st, idx) => {
                  const Icon = stepIcons[idx];
                  const isActive = activeStep === idx && !isCompleted;
                  const isDone = isCompleted || (visitedSteps.has(idx) && idx < activeStep);

                  return (
                    <motion.button
                      key={st.id}
                      type="button"
                      variants={stepperItemVariants}
                      whileHover={isCompleted ? undefined : { x: 2 }}
                      whileTap={isCompleted ? undefined : { scale: 0.985 }}
                      onClick={() => goToStep(idx)}
                      disabled={isCompleted}
                      className="relative w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 cursor-pointer transition-colors disabled:cursor-default group"
                    >
                      {isActive && (
                        <motion.div
                          layoutId="onboarding-rail-active"
                          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                          className="absolute inset-0 bg-white border border-[#E4E2DA] rounded-xl shadow-2xs"
                        />
                      )}

                      <div
                        className={`relative z-10 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono-tabular transition-colors shrink-0 ${
                          isActive
                            ? 'bg-[#171717] text-white'
                            : isDone
                            ? 'bg-[#B8F2E6] text-[#171717]'
                            : 'bg-[#EDEAE0] text-[#77766F] group-hover:text-[#171717]'
                        }`}
                      >
                        {isDone ? (
                          <motion.span
                            initial={{ scale: 0.6, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.22, ease: CALM_EASE }}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          </motion.span>
                        ) : (
                          <Icon className="w-3.5 h-3.5" />
                        )}
                      </div>

                      <div className="relative z-10 min-w-0">
                        <div
                          className={`text-xs font-semibold truncate ${
                            isActive
                              ? 'text-[#171717]'
                              : isDone
                              ? 'text-[#171717]'
                              : 'text-[#57564F] group-hover:text-[#171717]'
                          }`}
                        >
                          {st.title}
                        </div>
                        <div className="text-[11px] text-[#77766F] truncate">{st.shortDesc}</div>
                      </div>
                    </motion.button>
                  );
                })}
              </motion.nav>
            </div>

            {/* Calm Progress & Reassurance */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.25, ease: CALM_EASE }}
              className="pt-5 border-t border-[#E4E2DA] space-y-2.5"
            >
              <div className="flex items-center justify-between text-[11px] font-mono-tabular text-[#57564F]">
                <span>{isCompleted ? 'Completed' : `Step ${activeStep + 1} of ${STEP_META.length}`}</span>
                <span>{isCompleted ? '100%' : `${Math.round(progressFraction * 100)}%`}</span>
              </div>
              <div className="h-1.5 w-full bg-[#E4E2DA] rounded-sm overflow-hidden">
                <motion.div
                  className="h-full bg-[#171717] origin-left"
                  initial={false}
                  animate={{ scaleX: isCompleted ? 1 : progressFraction }}
                  transition={{ duration: 0.38, ease: CALM_EASE }}
                />
              </div>
              <p className="text-[11px] text-[#77766F] leading-relaxed">
                Take your time. Every rule can be refined later in Academic Configuration.
              </p>
            </motion.div>
          </aside>

          {/* =========================================================
              MOBILE TOP STEP STRIP (Below lg)
             ========================================================= */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: CALM_EASE }}
            className="lg:hidden bg-[#F7F6EF] border-b border-[#E4E2DA] px-4 py-3 space-y-2.5 shrink-0"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#171717] text-white flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#171717] truncate">
                    {code ? `${code} · ${name || 'Academy Setup'}` : 'Academy Setup'}
                  </div>
                  <div className="text-[11px] font-mono-tabular text-[#77766F]">
                    Step {activeStep + 1} of {STEP_META.length} · {currentMeta.title}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close setup wizard"
                className="p-1.5 rounded-lg text-[#77766F] hover:text-[#171717] hover:bg-black/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="h-1.5 w-full bg-[#E4E2DA] rounded-sm overflow-hidden">
              <motion.div
                className="h-full bg-[#171717] origin-left"
                initial={false}
                animate={{ scaleX: isCompleted ? 1 : progressFraction }}
                transition={{ duration: 0.35, ease: CALM_EASE }}
              />
            </div>

            <motion.div
              variants={stepperContainerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-5 gap-1.5"
            >
              {STEP_META.map((st, idx) => {
                const isActive = activeStep === idx && !isCompleted;
                const isDone = isCompleted || (visitedSteps.has(idx) && idx < activeStep);
                return (
                  <motion.button
                    key={st.id}
                    type="button"
                    variants={mobileStepperItemVariants}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => goToStep(idx)}
                    className={`h-7 rounded-lg text-[11px] font-mono-tabular font-semibold transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#171717] text-white'
                        : isDone
                        ? 'bg-[#B8F2E6] text-[#171717]'
                        : 'bg-white text-[#77766F] border border-[#E4E2DA]'
                    }`}
                  >
                    {isDone ? '✓' : idx + 1}
                  </motion.button>
                );
              })}
            </motion.div>
          </motion.div>

          {/* =========================================================
              RIGHT WORKSPACE PANE
             ========================================================= */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white">
            {/* Completion Celebration State */}
            {isCompleted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, ease: CALM_EASE }}
                className="flex-1 flex flex-col items-center justify-center text-center p-8 sm:p-12 space-y-5"
              >
                <div className="w-16 h-16 rounded-2xl bg-[#B8F2E6] border border-[#8FDCC9] flex items-center justify-center">
                  <svg
                    viewBox="0 0 24 24"
                    className="w-8 h-8 text-[#171717]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <motion.path
                      d="M5 13l4 4L19 7"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.45, ease: CALM_EASE }}
                    />
                  </svg>
                </div>

                <div className="space-y-2 max-w-md">
                  <div className="text-[11px] font-mono-tabular uppercase tracking-wider text-[#77766F]">
                    Configuration Saved
                  </div>
                  <h2 className="font-serif-editorial text-2xl sm:text-3xl text-[#171717] font-semibold">
                    {name || 'Your academy'} is ready
                  </h2>
                  <p className="text-xs sm:text-sm text-[#57564F] leading-relaxed">
                    Saved {terms.length} academic {terms.length === 1 ? 'term' : 'terms'},{' '}
                    {workingDays.length}-day weekly hours ({dayStartTime} – {dayEndTime}), and{' '}
                    {computedPreview.slots.length} daily lecture periods.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={finishImmediately}
                  className="btn-primary h-10 px-6 text-xs font-semibold"
                >
                  <span>Enter Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ) : (
              <>
                {/* Desktop Step Header with Synchronized Horizontal Slide */}
                <header className="hidden lg:flex items-start justify-between gap-4 px-8 pt-6 pb-4 border-b border-[#E4E2DA] shrink-0 overflow-x-hidden">
                  <div className="min-w-0 flex-1">
                    <AnimatePresence mode="wait" custom={direction}>
                      <motion.div
                        key={`header-${activeStep}`}
                        custom={direction}
                        variants={stepHeaderSlideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                      >
                        <div className="text-[11px] font-mono-tabular uppercase tracking-wider text-[#77766F]">
                          Step {activeStep + 1} of {STEP_META.length} · {currentMeta.eyebrow}
                        </div>
                        <h2 className="font-serif-editorial text-2xl text-[#171717] font-semibold mt-0.5">
                          {currentMeta.heading}
                        </h2>
                        <p className="text-xs text-[#77766F] mt-1">{currentMeta.subtitle}</p>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close setup wizard"
                    className="p-2 rounded-lg text-[#77766F] hover:text-[#171717] hover:bg-[#F7F6EF] transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </header>

                {/* Step Scrollable Body */}
                <div
                  ref={bodyScrollRef}
                  className="flex-1 overflow-y-auto overflow-x-hidden px-5 sm:px-8 py-6"
                >
                  <AnimatePresence mode="wait">
                    {onboardingError && (
                      <motion.div
                        key="onboarding-error"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2, ease: CALM_EASE }}
                        className="mb-5 px-4 py-3 rounded-xl bg-[#FEF2F2] border border-[#F5B5B5] text-[#8B1E1E] text-xs font-medium flex items-center gap-2.5"
                      >
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{onboardingError}</span>
                      </motion.div>
                    )}

                    {stepSavedToast && !onboardingError && (
                      <motion.div
                        key="onboarding-toast"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2, ease: CALM_EASE }}
                        className="mb-5 px-4 py-2.5 rounded-xl bg-[#B8F2E6]/45 border border-[#8FDCC9] text-[#171717] text-xs font-medium flex items-center justify-between gap-2"
                      >
                        <span className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-[#1E5631] shrink-0" />
                          <span>{stepSavedToast}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setStepSavedToast(null)}
                          className="text-[#57564F] hover:text-[#171717] cursor-pointer"
                          aria-label="Dismiss notice"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                      key={activeStep}
                      custom={direction}
                      variants={stepSlideVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      className="space-y-6"
                    >
                      {/* =================================================
                          STEP 1: IDENTITY & GOVERNANCE
                         ================================================= */}
                      {activeStep === 0 && (
                        <>
                          {/* Quick-Start Templates */}
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-[#171717]">
                                Quick-Start Schedule Template
                              </span>
                              <span className="text-[11px] text-[#77766F]">
                                Optional — fills calendar &amp; hours automatically
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                              {(
                                [
                                  {
                                    id: 'semester-5day',
                                    title: '5-Day Semester',
                                    meta: 'Mon–Fri · 50m classes'
                                  },
                                  {
                                    id: 'trimester-6day',
                                    title: '6-Day Trimester',
                                    meta: 'Mon–Sat · 60m classes'
                                  },
                                  {
                                    id: 'quarter-block',
                                    title: 'Quarter System',
                                    meta: '4 Terms · 75m blocks'
                                  }
                                ] as Array<{ id: PresetKey; title: string; meta: string }>
                              ).map(preset => {
                                const active = selectedPreset === preset.id;
                                return (
                                  <motion.button
                                    key={preset.id}
                                    type="button"
                                    whileTap={{ scale: 0.985 }}
                                    onClick={() => applyInstitutionPreset(preset.id)}
                                    className={`relative p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                                      active
                                        ? 'bg-[#171717] text-white border-[#171717]'
                                        : 'bg-[#F7F6EF]/70 text-[#171717] border-[#E4E2DA] hover:bg-[#F7F6EF] hover:border-[#CFCBC0]'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs font-semibold">{preset.title}</span>
                                      {active && <Check className="w-3.5 h-3.5 text-[#B7F77C]" />}
                                    </div>
                                    <div
                                      className={`text-[11px] mt-1 font-mono-tabular ${
                                        active ? 'text-white/75' : 'text-[#77766F]'
                                      }`}
                                    >
                                      {preset.meta}
                                    </div>
                                  </motion.button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Core University Identity */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-[#171717] block">
                                University Full Name <span className="text-red-600">*</span>
                              </label>
                              <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. National Institute of Technology"
                                className="input-field h-10 text-xs"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-[#171717] block">
                                Acronym / Short Code <span className="text-red-600">*</span>
                              </label>
                              <input
                                type="text"
                                value={code}
                                onChange={e => {
                                  const val = e.target.value.toUpperCase();
                                  setCode(val);
                                  setCampusCode(`${val || 'UNIV'}-MAIN-01`);
                                }}
                                placeholder="e.g. NIT, MIT, NUST"
                                className="input-field h-10 text-xs font-mono-tabular uppercase"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-[#171717] block">
                                Primary Campus Name
                              </label>
                              <input
                                type="text"
                                value={campusName}
                                onChange={e => setCampusName(e.target.value)}
                                placeholder="e.g. Main Campus"
                                className="input-field h-10 text-xs"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-[#171717] block">
                                Campus Timezone
                              </label>
                              <select
                                value={timezone}
                                onChange={e => setTimezone(e.target.value)}
                                className="input-field h-10 text-xs bg-white"
                              >
                                <option value="UTC">UTC (Coordinated Universal Time)</option>
                                <option value="America/New_York">America/New_York (EST/EDT)</option>
                                <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                                <option value="America/Los_Angeles">
                                  America/Los_Angeles (PST/PDT)
                                </option>
                                <option value="Europe/London">Europe/London (GMT/BST)</option>
                                <option value="Europe/Berlin">Europe/Berlin (CET/CEST)</option>
                                <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                                <option value="Asia/Karachi">Asia/Karachi (PKT)</option>
                                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                                <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                                <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                              </select>
                            </div>
                          </div>

                          {/* Collapsible Campus & Registrar Details */}
                          <div className="border border-[#E4E2DA] rounded-xl overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setShowMoreIdentity(v => !v)}
                              className="w-full px-4 py-3 bg-[#F7F6EF]/60 hover:bg-[#F7F6EF] flex items-center justify-between text-xs font-medium text-[#171717] transition-colors cursor-pointer"
                            >
                              <span>Campus code, accreditation &amp; registrar contact</span>
                              <motion.span
                                animate={{ rotate: showMoreIdentity ? 180 : 0 }}
                                transition={{ duration: 0.2, ease: CALM_EASE }}
                              >
                                <ChevronDown className="w-4 h-4 text-[#77766F]" />
                              </motion.span>
                            </button>

                            <AnimatePresence initial={false}>
                              {showMoreIdentity && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.22, ease: CALM_EASE }}
                                  className="overflow-hidden"
                                >
                                  <div className="p-4 pt-3 border-t border-[#E4E2DA] grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white">
                                    <div className="space-y-1.5">
                                      <label className="text-xs font-medium text-[#57564F] block">
                                        Campus Identifier Code
                                      </label>
                                      <input
                                        type="text"
                                        value={campusCode}
                                        onChange={e => setCampusCode(e.target.value.toUpperCase())}
                                        className="input-field h-9 text-xs font-mono-tabular uppercase"
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-xs font-medium text-[#57564F] block">
                                        Accreditation Body
                                      </label>
                                      <input
                                        type="text"
                                        value={accreditation}
                                        onChange={e => setAccreditation(e.target.value)}
                                        className="input-field h-9 text-xs"
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-xs font-medium text-[#57564F] block">
                                        Registrar / Lead Name
                                      </label>
                                      <input
                                        type="text"
                                        value={registrarName}
                                        onChange={e => setRegistrarName(e.target.value)}
                                        className="input-field h-9 text-xs"
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-xs font-medium text-[#57564F] block">
                                        Registrar Official Email
                                      </label>
                                      <input
                                        type="email"
                                        value={registrarEmail}
                                        onChange={e => setRegistrarEmail(e.target.value)}
                                        className="input-field h-9 text-xs"
                                      />
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Scheduling Policy */}
                          <div className="space-y-2.5">
                            <div className="text-xs font-semibold text-[#171717]">
                              Scheduling Governance Model
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={() => setTimetableManagementPolicy('whole_university')}
                                className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                                  timetableManagementPolicy === 'whole_university'
                                    ? 'bg-[#171717] text-white border-[#171717]'
                                    : 'bg-white text-[#171717] border-[#E4E2DA] hover:bg-[#F7F6EF]'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold">
                                    Whole-University Matrix
                                  </span>
                                  {timetableManagementPolicy === 'whole_university' && (
                                    <Check className="w-3.5 h-3.5 text-[#B7F77C]" />
                                  )}
                                </div>
                                <p
                                  className={`text-[11px] mt-1 leading-relaxed ${
                                    timetableManagementPolicy === 'whole_university'
                                      ? 'text-white/75'
                                      : 'text-[#77766F]'
                                  }`}
                                >
                                  Schedule all departments together to prevent shared room and
                                  faculty collisions.
                                </p>
                              </button>

                              <button
                                type="button"
                                onClick={() => setTimetableManagementPolicy('department_wise')}
                                className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                                  timetableManagementPolicy === 'department_wise'
                                    ? 'bg-[#171717] text-white border-[#171717]'
                                    : 'bg-white text-[#171717] border-[#E4E2DA] hover:bg-[#F7F6EF]'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold">
                                    Department-Wise Autonomy
                                  </span>
                                  {timetableManagementPolicy === 'department_wise' && (
                                    <Check className="w-3.5 h-3.5 text-[#B7F77C]" />
                                  )}
                                </div>
                                <p
                                  className={`text-[11px] mt-1 leading-relaxed ${
                                    timetableManagementPolicy === 'department_wise'
                                      ? 'text-white/75'
                                      : 'text-[#77766F]'
                                  }`}
                                >
                                  Each department generates its own timetable with dedicated rooms
                                  and faculty.
                                </p>
                              </button>
                            </div>
                          </div>

                          {/* Conflict Sweep Toggle */}
                          <div className="px-4 py-3.5 rounded-xl bg-[#F7F6EF]/70 border border-[#E4E2DA] flex items-center justify-between gap-4">
                            <div>
                              <div className="text-xs font-semibold text-[#171717]">
                                Automatic Conflict Sweep
                              </div>
                              <div className="text-[11px] text-[#77766F]">
                                Continuously check room, instructor, and cohort overlaps whenever
                                settings change.
                              </div>
                            </div>
                            <CalmSwitch
                              checked={autoConflictSweep}
                              onChange={setAutoConflictSweep}
                              ariaLabel="Toggle automatic conflict sweep"
                            />
                          </div>
                        </>
                      )}

                      {/* =================================================
                          STEP 2: ACADEMIC CALENDAR
                         ================================================= */}
                      {activeStep === 1 && (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div className="md:col-span-2 space-y-1.5">
                              <label className="text-xs font-semibold text-[#171717] block">
                                Calendar Rhythm
                              </label>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA]">
                                {(
                                  [
                                    { id: 'semester', label: 'Semester (2)' },
                                    { id: 'trimester', label: 'Trimester (3)' },
                                    { id: 'quarter', label: 'Quarter (4)' },
                                    { id: 'custom', label: 'Custom' }
                                  ] as Array<{ id: CalendarSystemType; label: string }>
                                ).map(opt => {
                                  const selected = calendarSystem === opt.id;
                                  return (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      onClick={() => handleSelectCalendarSystem(opt.id)}
                                      className={`relative h-8 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                                        selected
                                          ? 'text-white'
                                          : 'text-[#57564F] hover:text-[#171717]'
                                      }`}
                                    >
                                      {selected && (
                                        <motion.span
                                          layoutId="calendar-rhythm-indicator"
                                          transition={{
                                            type: 'spring',
                                            stiffness: 450,
                                            damping: 34
                                          }}
                                          className="absolute inset-0 bg-[#171717] rounded-lg"
                                        />
                                      )}
                                      <span className="relative z-10">{opt.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-[#171717] block">
                                Academic Year
                              </label>
                              <input
                                type="text"
                                value={academicYear}
                                onChange={e => setAcademicYear(e.target.value)}
                                placeholder="2026–2027"
                                className="input-field h-10 text-xs font-mono-tabular"
                              />
                            </div>
                          </div>

                          {/* Terms List */}
                          <div className="space-y-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-[#171717]">
                                Configured Terms ({terms.length})
                              </span>
                              <span className="text-[11px] text-[#77766F]">
                                Active:{' '}
                                <strong className="text-[#171717]">
                                  {terms
                                    .filter(t => t.status === 'active')
                                    .map(t => t.code)
                                    .join(', ') || 'None'}
                                </strong>
                              </span>
                            </div>

                            <div className="space-y-2">
                              <AnimatePresence initial={false}>
                                {terms.map((term, idx) => {
                                  const isCurrentActive = term.status === 'active';
                                  return (
                                    <motion.div
                                      key={term.id}
                                      layout
                                      initial={{ opacity: 0, y: 8 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -8 }}
                                      transition={{ duration: 0.2, ease: CALM_EASE }}
                                      className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 transition-colors ${
                                        isCurrentActive
                                          ? 'bg-[#B8F2E6]/25 border-[#8FDCC9]'
                                          : 'bg-white border-[#E4E2DA]'
                                      }`}
                                    >
                                      <div className="flex items-center gap-3 min-w-[210px]">
                                        <span className="px-2.5 py-1 rounded-lg bg-[#171717] text-white text-[11px] font-mono-tabular font-semibold">
                                          {term.code}
                                        </span>
                                        <div>
                                          <div className="text-xs font-semibold text-[#171717] flex items-center gap-2 flex-wrap">
                                            <span>{term.name}</span>
                                            <span className="text-[11px] font-normal text-[#57564F] inline-flex items-center gap-1.5">
                                              <span
                                                className={`w-1.5 h-1.5 rounded-full ${
                                                  isCurrentActive ? 'bg-[#1E7A4C]' : 'bg-[#9E9D96]'
                                                }`}
                                              />
                                              {isCurrentActive ? 'Active' : 'Draft'}
                                            </span>
                                          </div>
                                          <div className="text-[11px] text-[#77766F] font-mono-tabular mt-0.5">
                                            {term.startDate} to {term.endDate} · {term.weeksCount}{' '}
                                            weeks
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleTermActive(term.id)}
                                          className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors ${
                                            isCurrentActive
                                              ? 'bg-white hover:bg-[#F7F6EF] border-[#E4E2DA] text-[#171717]'
                                              : 'bg-[#171717] hover:bg-[#2E2E2E] text-white border-[#171717]'
                                          }`}
                                        >
                                          {isCurrentActive ? 'Set as Draft' : 'Set Active'}
                                        </button>
                                        {terms.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const remaining = terms.filter((_, i) => i !== idx);
                                              if (
                                                !remaining.some(r => r.status === 'active') &&
                                                remaining.length > 0
                                              ) {
                                                remaining[0].status = 'active';
                                              }
                                              setTerms(remaining);
                                            }}
                                            className="p-1.5 rounded-lg text-[#77766F] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                            aria-label={`Remove ${term.name}`}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </motion.div>
                                  );
                                })}
                              </AnimatePresence>
                            </div>
                          </div>

                          {/* Collapsible Add Term Drawer */}
                          <div className="border border-[#E4E2DA] rounded-xl overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setShowAddTermDrawer(v => !v)}
                              className="w-full px-4 py-3 bg-[#F7F6EF]/60 hover:bg-[#F7F6EF] flex items-center justify-between text-xs font-semibold text-[#171717] transition-colors cursor-pointer"
                            >
                              <span className="inline-flex items-center gap-2">
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add another semester or summer session</span>
                              </span>
                              <motion.span
                                animate={{ rotate: showAddTermDrawer ? 180 : 0 }}
                                transition={{ duration: 0.2, ease: CALM_EASE }}
                              >
                                <ChevronDown className="w-4 h-4 text-[#77766F]" />
                              </motion.span>
                            </button>

                            <AnimatePresence initial={false}>
                              {showAddTermDrawer && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.22, ease: CALM_EASE }}
                                  className="overflow-hidden"
                                >
                                  <div className="p-4 border-t border-[#E4E2DA] space-y-3 bg-white">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                      <input
                                        type="text"
                                        placeholder="Term Name (e.g. Summer 2027)"
                                        value={newTermName}
                                        onChange={e => setNewTermName(e.target.value)}
                                        className="input-field h-9 text-xs"
                                      />
                                      <input
                                        type="text"
                                        placeholder="Code (SUM-27)"
                                        value={newTermCode}
                                        onChange={e =>
                                          setNewTermCode(e.target.value.toUpperCase())
                                        }
                                        className="input-field h-9 text-xs font-mono-tabular uppercase"
                                      />
                                      <input
                                        type="text"
                                        placeholder="Academic Year"
                                        value={newTermAcademicYear}
                                        onChange={e => setNewTermAcademicYear(e.target.value)}
                                        className="input-field h-9 text-xs font-mono-tabular"
                                      />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                                      <input
                                        type="date"
                                        value={newTermStart}
                                        onChange={e => setNewTermStart(e.target.value)}
                                        className="input-field h-9 text-xs font-mono-tabular"
                                      />
                                      <input
                                        type="date"
                                        value={newTermEnd}
                                        onChange={e => setNewTermEnd(e.target.value)}
                                        className="input-field h-9 text-xs font-mono-tabular"
                                      />
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="number"
                                          min={1}
                                          max={52}
                                          value={newTermWeeks}
                                          onChange={e => setNewTermWeeks(Number(e.target.value))}
                                          className="input-field h-9 text-xs font-mono-tabular w-20"
                                          title="Weeks"
                                        />
                                        <span className="text-[11px] text-[#77766F] shrink-0">
                                          wks
                                        </span>
                                        <button
                                          type="button"
                                          onClick={handleAddTerm}
                                          disabled={!newTermName.trim() || !newTermCode.trim()}
                                          className="btn-primary h-9 px-3.5 text-xs ml-auto shrink-0"
                                        >
                                          Add Term
                                        </button>
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-1">
                                      <span className="text-xs text-[#57564F]">
                                        Activate this term immediately
                                      </span>
                                      <CalmSwitch
                                        checked={newTermActive}
                                        onChange={setNewTermActive}
                                        ariaLabel="Activate new term immediately"
                                      />
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </>
                      )}

                      {/* =================================================
                          STEP 3: WEEKLY OPERATING HOURS
                         ================================================= */}
                      {activeStep === 2 && (
                        <>
                          {/* Working Days Selector */}
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-[#171717]">
                                Instructional Weekdays
                              </span>
                              <span className="text-[11px] font-mono-tabular text-[#77766F]">
                                {workingDays.length} days selected
                              </span>
                            </div>

                            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                              {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as DayOfWeek[]).map(
                                d => {
                                  const active = workingDays.includes(d);
                                  return (
                                    <motion.button
                                      key={d}
                                      type="button"
                                      whileTap={{ scale: 0.94 }}
                                      onClick={() => toggleDay(d)}
                                      className={`h-11 rounded-xl text-xs font-mono-tabular transition-colors cursor-pointer border flex flex-col items-center justify-center ${
                                        active
                                          ? 'bg-[#171717] text-white border-[#171717] font-semibold'
                                          : 'bg-white text-[#77766F] border-[#E4E2DA] hover:text-[#171717] hover:bg-[#F7F6EF]'
                                      }`}
                                    >
                                      <span>{d}</span>
                                    </motion.button>
                                  );
                                }
                              )}
                            </div>
                          </div>

                          {/* Daily Campus Opening & Closing */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl border border-[#E4E2DA] bg-white space-y-2">
                              <label className="text-xs font-semibold text-[#171717] block">
                                Daily Opening Time
                              </label>
                              <input
                                type="time"
                                value={dayStartTime}
                                onChange={e => setDayStartTime(e.target.value)}
                                className="input-field h-10 text-sm font-mono-tabular"
                              />
                              <p className="text-[11px] text-[#77766F]">
                                Earliest time classes or labs can begin.
                              </p>
                            </div>

                            <div className="p-4 rounded-xl border border-[#E4E2DA] bg-white space-y-2">
                              <label className="text-xs font-semibold text-[#171717] block">
                                Daily Closing Time
                              </label>
                              <input
                                type="time"
                                value={dayEndTime}
                                onChange={e => setDayEndTime(e.target.value)}
                                className="input-field h-10 text-sm font-mono-tabular"
                              />
                              <p className="text-[11px] text-[#77766F]">
                                All lectures and lab blocks conclude by this time.
                              </p>
                            </div>
                          </div>

                          {/* Calm Visual Day Span Strip */}
                          <div className="p-4 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="font-semibold text-[#171717]">
                                Daily Operating Span ·{' '}
                                <span className="font-mono-tabular">
                                  {formatDurationSpan(dayStartTime, dayEndTime)}
                                </span>
                              </span>
                              <span className="font-mono-tabular text-[11px] text-[#171717] font-semibold">
                                {computedPreview.slots.length} teaching periods / day
                              </span>
                            </div>

                            <div className="h-2.5 w-full bg-[#E4E2DA] rounded-sm overflow-hidden flex items-center">
                              <motion.div
                                layout
                                transition={{ duration: 0.3, ease: CALM_EASE }}
                                className="h-full bg-[#B8EEEE] border-r border-[#171717]/20"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.max(
                                      18,
                                      ((parseMinutesSafe(dayEndTime) -
                                        parseMinutesSafe(dayStartTime)) /
                                        720) *
                                        100
                                    )
                                  )}%`
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[11px] font-mono-tabular text-[#77766F]">
                              <span>Opens {dayStartTime}</span>
                              <span>{computedPreview.operatingHoursLabel}</span>
                              <span>Closes {dayEndTime}</span>
                            </div>
                          </div>

                          {/* Friday & Jummah Policy */}
                          <div className="p-4 rounded-xl border border-[#E4E2DA] bg-white space-y-3.5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div>
                                <div className="text-xs font-semibold text-[#171717]">
                                  Friday Schedule Policy
                                </div>
                                <div className="text-[11px] text-[#77766F]">
                                  Reserve a Jummah prayer window, close early, or match regular
                                  days.
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] shrink-0">
                                {(
                                  [
                                    { id: 'jummah_break', label: 'Jummah Break' },
                                    { id: 'morning_only', label: 'Morning Only' },
                                    { id: 'standard', label: 'Standard' }
                                  ] as const
                                ).map(opt => {
                                  const selected = fridayMode === opt.id;
                                  return (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      onClick={() => setFridayMode(opt.id)}
                                      className={`relative px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                                        selected
                                          ? 'text-white'
                                          : 'text-[#57564F] hover:text-[#171717]'
                                      }`}
                                    >
                                      {selected && (
                                        <motion.span
                                          layoutId="friday-mode-indicator"
                                          transition={{
                                            type: 'spring',
                                            stiffness: 450,
                                            damping: 34
                                          }}
                                          className="absolute inset-0 bg-[#171717] rounded-lg"
                                        />
                                      )}
                                      <span className="relative z-10">{opt.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <AnimatePresence initial={false}>
                              {fridayMode === 'jummah_break' && (
                                <motion.div
                                  initial={{ opacity: 0, y: -6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -6 }}
                                  transition={{ duration: 0.2, ease: CALM_EASE }}
                                  className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#E4E2DA]"
                                >
                                  <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-[#57564F] block">
                                      Prayer Break Starts
                                    </label>
                                    <input
                                      type="time"
                                      value={fridayBreakStartTime}
                                      onChange={e => setFridayBreakStartTime(e.target.value)}
                                      className="input-field h-9 text-xs font-mono-tabular"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-[#57564F] block">
                                      Afternoon Classes Resume
                                    </label>
                                    <input
                                      type="time"
                                      value={fridayBreakEndTime}
                                      onChange={e => setFridayBreakEndTime(e.target.value)}
                                      className="input-field h-9 text-xs font-mono-tabular"
                                    />
                                  </div>
                                </motion.div>
                              )}

                              {fridayMode === 'morning_only' && (
                                <motion.div
                                  initial={{ opacity: 0, y: -6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -6 }}
                                  transition={{ duration: 0.2, ease: CALM_EASE }}
                                  className="flex items-center justify-between pt-3 border-t border-[#E4E2DA]"
                                >
                                  <span className="text-xs text-[#57564F]">
                                    Friday Classes Conclude At
                                  </span>
                                  <input
                                    type="time"
                                    value={fridayClosingTime}
                                    onChange={e => setFridayClosingTime(e.target.value)}
                                    className="input-field h-9 w-32 text-xs font-mono-tabular"
                                  />
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {fridayMode !== 'standard' && (
                              <div className="pt-2 border-t border-[#E4E2DA]">
                                <button
                                  type="button"
                                  onClick={() => setShowFridayCompression(v => !v)}
                                  className="text-[11px] font-medium text-[#57564F] hover:text-[#171717] inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                  <SlidersHorizontal className="w-3 h-3" />
                                  <span>
                                    {showFridayCompression
                                      ? 'Hide Friday period compression options'
                                      : 'Customize shortened Friday lecture durations'}
                                  </span>
                                </button>

                                <AnimatePresence initial={false}>
                                  {showFridayCompression && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.2, ease: CALM_EASE }}
                                      className="overflow-hidden"
                                    >
                                      <div className="pt-3 space-y-3">
                                        <div className="flex flex-wrap gap-1.5">
                                          {(
                                            [
                                              { id: 'none', label: 'Same Length' },
                                              { id: 'before_jummah', label: 'Before Jummah' },
                                              ...(fridayMode === 'jummah_break'
                                                ? [{ id: 'after_jummah', label: 'After Jummah' }]
                                                : []),
                                              { id: 'all_day', label: 'All Friday' }
                                            ] as { id: FridayCompressionScope; label: string }[]
                                          ).map(scope => (
                                            <button
                                              key={scope.id}
                                              type="button"
                                              onClick={() => setFridayCompressionScope(scope.id)}
                                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors ${
                                                fridayCompressionScope === scope.id
                                                  ? 'bg-[#171717] text-white border-[#171717]'
                                                  : 'bg-[#F7F6EF] text-[#57564F] border-[#E4E2DA] hover:text-[#171717]'
                                              }`}
                                            >
                                              {scope.label}
                                            </button>
                                          ))}
                                        </div>

                                        {fridayCompressionScope !== 'none' && (
                                          <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                              <label className="text-[11px] text-[#57564F] block">
                                                Friday Lecture (mins)
                                              </label>
                                              <input
                                                type="number"
                                                min={25}
                                                max={90}
                                                step={5}
                                                value={fridayPeriodLengthMinutes}
                                                onChange={e =>
                                                  setFridayPeriodLengthMinutes(
                                                    Math.max(
                                                      25,
                                                      Math.min(90, Number(e.target.value) || 45)
                                                    )
                                                  )
                                                }
                                                className="input-field h-8 text-xs font-mono-tabular"
                                              />
                                            </div>
                                            <div className="space-y-1">
                                              <label className="text-[11px] text-[#57564F] block">
                                                Friday Transition (mins)
                                              </label>
                                              <input
                                                type="number"
                                                min={0}
                                                max={20}
                                                step={5}
                                                value={fridayShortBreakMinutes}
                                                onChange={e =>
                                                  setFridayShortBreakMinutes(
                                                    Math.max(
                                                      0,
                                                      Math.min(20, Number(e.target.value) || 0)
                                                    )
                                                  )
                                                }
                                                className="input-field h-8 text-xs font-mono-tabular"
                                              />
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {/* =================================================
                          STEP 4: CLASS PACING & BREAKS
                         ================================================= */}
                      {activeStep === 3 && (
                        <>
                          {/* Lecture & Lab Durations */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl bg-[#F7F6EF]/70 border border-[#E4E2DA] space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-[#171717]">
                                  Lecture Duration
                                </span>
                                <span className="text-xs font-mono-tabular font-bold text-[#171717]">
                                  {periodLengthMinutes} min
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-1.5">
                                {[45, 50, 60, 75, 90, 120].map(mins => (
                                  <button
                                    key={mins}
                                    type="button"
                                    onClick={() => setPeriodLengthMinutes(mins)}
                                    className={`h-8 rounded-lg text-xs font-mono-tabular border cursor-pointer transition-colors ${
                                      periodLengthMinutes === mins
                                        ? 'bg-[#171717] text-white border-[#171717] font-semibold'
                                        : 'bg-white text-[#57564F] border-[#E4E2DA] hover:text-[#171717]'
                                    }`}
                                  >
                                    {mins}m
                                  </button>
                                ))}
                              </div>
                              <div className="flex items-center justify-between gap-2 pt-1">
                                <span className="text-[11px] text-[#77766F]">Custom length</span>
                                <input
                                  type="number"
                                  min={20}
                                  max={240}
                                  value={periodLengthMinutes}
                                  onChange={e =>
                                    setPeriodLengthMinutes(
                                      Math.max(20, Number(e.target.value) || 50)
                                    )
                                  }
                                  className="input-field h-8 w-24 text-xs font-mono-tabular bg-white"
                                />
                              </div>
                            </div>

                            <div className="p-4 rounded-xl bg-[#F7F6EF]/70 border border-[#E4E2DA] space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-[#171717]">
                                  Continuous Lab Block
                                </span>
                                <span className="text-xs font-mono-tabular font-bold text-[#171717]">
                                  {computedPreview.labDurationHoursLabel} ({labDurationMinutes}m)
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-1.5">
                                {[100, 120, 150, 180, 240].map(mins => (
                                  <button
                                    key={mins}
                                    type="button"
                                    onClick={() => setLabDurationMinutes(mins)}
                                    className={`h-8 rounded-lg text-xs font-mono-tabular border cursor-pointer transition-colors ${
                                      labDurationMinutes === mins
                                        ? 'bg-[#171717] text-white border-[#171717] font-semibold'
                                        : 'bg-white text-[#57564F] border-[#E4E2DA] hover:text-[#171717]'
                                    }`}
                                  >
                                    {(mins / 60).toFixed(mins % 60 === 0 ? 0 : 1)}h
                                  </button>
                                ))}
                              </div>
                              <div className="flex items-center justify-between gap-2 pt-1">
                                <span className="text-[11px] text-[#77766F]">Weekly defaults</span>
                                <div className="flex items-center gap-1.5">
                                  <select
                                    value={defaultLectureHoursPerWeek}
                                    onChange={e =>
                                      setDefaultLectureHoursPerWeek(Number(e.target.value))
                                    }
                                    className="input-field h-8 text-[11px] bg-white w-24"
                                    title="Default weekly theory contact hours"
                                  >
                                    <option value={2}>2h Lec</option>
                                    <option value={3}>3h Lec</option>
                                    <option value={4}>4h Lec</option>
                                  </select>
                                  <select
                                    value={defaultLabHoursPerWeek}
                                    onChange={e =>
                                      setDefaultLabHoursPerWeek(Number(e.target.value))
                                    }
                                    className="input-field h-8 text-[11px] bg-white w-24"
                                    title="Default weekly lab contact hours"
                                  >
                                    <option value={2}>2h Lab</option>
                                    <option value={3}>3h Lab</option>
                                    <option value={4}>4h Lab</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Inter-Class Break Toggle */}
                          <div className="p-4 rounded-xl border border-[#E4E2DA] bg-white space-y-3">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <div className="text-xs font-semibold text-[#171717]">
                                  Short Break Between Classes
                                </div>
                                <div className="text-[11px] text-[#77766F]">
                                  Gives students and faculty passing time between consecutive
                                  sessions.
                                </div>
                              </div>
                              <CalmSwitch
                                checked={shortBreakEnabled}
                                onChange={next => {
                                  setShortBreakEnabled(next);
                                  if (!next) setShortBreakMinutes(0);
                                  else if (shortBreakMinutes === 0) setShortBreakMinutes(10);
                                }}
                                ariaLabel="Toggle short break between classes"
                              />
                            </div>

                            <AnimatePresence initial={false}>
                              {shortBreakEnabled && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2, ease: CALM_EASE }}
                                  className="overflow-hidden"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E4E2DA]">
                                    <div className="flex items-center gap-1.5">
                                      {[5, 10, 15, 20].map(m => (
                                        <button
                                          key={m}
                                          type="button"
                                          onClick={() => setShortBreakMinutes(m)}
                                          className={`px-3 py-1 rounded-lg text-xs font-mono-tabular border cursor-pointer transition-colors ${
                                            shortBreakMinutes === m
                                              ? 'bg-[#171717] text-white border-[#171717] font-semibold'
                                              : 'bg-[#F7F6EF] text-[#57564F] border-[#E4E2DA] hover:text-[#171717]'
                                          }`}
                                        >
                                          {m}m
                                        </button>
                                      ))}
                                    </div>

                                    <label className="inline-flex items-center gap-2 text-[11px] text-[#57564F] cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={includeBreakAfterLastSlot}
                                        onChange={e =>
                                          setIncludeBreakAfterLastSlot(e.target.checked)
                                        }
                                        className="w-3.5 h-3.5 accent-[#171717]"
                                      />
                                      <span>Include buffer after final period</span>
                                    </label>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Midday / Lunch Break Toggle */}
                          <div className="p-4 rounded-xl border border-[#E4E2DA] bg-white space-y-3">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <div className="text-xs font-semibold text-[#171717]">
                                  Protected Midday / Lunch Window
                                </div>
                                <div className="text-[11px] text-[#77766F]">
                                  Keeps a campus-wide midday pause free of lectures and labs.
                                </div>
                              </div>
                              <CalmSwitch
                                checked={middayBreakEnabled}
                                onChange={setMiddayBreakEnabled}
                                ariaLabel="Toggle midday lunch window"
                              />
                            </div>

                            <AnimatePresence initial={false}>
                              {middayBreakEnabled && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2, ease: CALM_EASE }}
                                  className="overflow-hidden"
                                >
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#E4E2DA]">
                                    <div className="space-y-1">
                                      <label className="text-[11px] text-[#57564F] block">
                                        Placement
                                      </label>
                                      <select
                                        value={middayBreakMode}
                                        onChange={e =>
                                          setMiddayBreakMode(e.target.value as 'fixed' | 'auto')
                                        }
                                        className="input-field h-9 text-xs bg-white"
                                      >
                                        <option value="fixed">Fixed Start Time</option>
                                        <option value="auto">Auto-Center Midday</option>
                                      </select>
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[11px] text-[#57564F] block">
                                        Start Time
                                      </label>
                                      <input
                                        type="time"
                                        value={middayBreakStartTime}
                                        onChange={e => setMiddayBreakStartTime(e.target.value)}
                                        className="input-field h-9 text-xs font-mono-tabular"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[11px] text-[#57564F] block">
                                        Duration
                                      </label>
                                      <select
                                        value={middayBreakDurationMinutes}
                                        onChange={e =>
                                          setMiddayBreakDurationMinutes(Number(e.target.value))
                                        }
                                        className="input-field h-9 text-xs bg-white"
                                      >
                                        <option value={30}>30 Minutes</option>
                                        <option value={45}>45 Minutes</option>
                                        <option value={60}>60 Minutes</option>
                                        <option value={75}>75 Minutes</option>
                                        <option value={90}>90 Minutes</option>
                                      </select>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Optional Additional Breaks */}
                          <div className="border border-[#E4E2DA] rounded-xl overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setShowCustomBreaksDrawer(v => !v)}
                              className="w-full px-4 py-3 bg-[#F7F6EF]/60 hover:bg-[#F7F6EF] flex items-center justify-between text-xs font-medium text-[#171717] transition-colors cursor-pointer"
                            >
                              <span className="inline-flex items-center gap-2">
                                <Plus className="w-3.5 h-3.5" />
                                <span>
                                  Additional protected breaks{' '}
                                  {customBreaks.length > 0 ? `(${customBreaks.length})` : '(optional)'}
                                </span>
                              </span>
                              <motion.span
                                animate={{ rotate: showCustomBreaksDrawer ? 180 : 0 }}
                                transition={{ duration: 0.2, ease: CALM_EASE }}
                              >
                                <ChevronDown className="w-4 h-4 text-[#77766F]" />
                              </motion.span>
                            </button>

                            <AnimatePresence initial={false}>
                              {showCustomBreaksDrawer && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2, ease: CALM_EASE }}
                                  className="overflow-hidden"
                                >
                                  <div className="p-4 border-t border-[#E4E2DA] space-y-3 bg-white">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <input
                                        type="text"
                                        placeholder="Break label (e.g. Assembly / Tea)"
                                        value={newBreakName}
                                        onChange={e => setNewBreakName(e.target.value)}
                                        className="input-field h-9 text-xs flex-1 min-w-[160px]"
                                      />
                                      <input
                                        type="time"
                                        value={newBreakStart}
                                        onChange={e => setNewBreakStart(e.target.value)}
                                        className="input-field h-9 w-28 text-xs font-mono-tabular"
                                      />
                                      <input
                                        type="time"
                                        value={newBreakEnd}
                                        onChange={e => setNewBreakEnd(e.target.value)}
                                        className="input-field h-9 w-28 text-xs font-mono-tabular"
                                      />
                                      <button
                                        type="button"
                                        onClick={handleAddCustomBreak}
                                        disabled={!newBreakName.trim()}
                                        className="btn-primary h-9 px-3 text-xs shrink-0"
                                      >
                                        Add
                                      </button>
                                    </div>

                                    <div className="flex flex-wrap gap-1.5">
                                      {workingDays.map(d => (
                                        <button
                                          key={d}
                                          type="button"
                                          onClick={() => toggleNewBreakDay(d)}
                                          className={`px-2.5 py-1 rounded-md text-[11px] font-mono-tabular cursor-pointer border ${
                                            newBreakDays.includes(d)
                                              ? 'bg-[#171717] text-white border-[#171717]'
                                              : 'bg-[#F7F6EF] text-[#77766F] border-[#E4E2DA]'
                                          }`}
                                        >
                                          {d}
                                        </button>
                                      ))}
                                    </div>

                                    {customBreaks.length > 0 && (
                                      <div className="space-y-1.5 pt-1">
                                        {customBreaks.map((cb, idx) => (
                                          <div
                                            key={cb.id}
                                            className="px-3 py-2 rounded-lg bg-[#F7F6EF] border border-[#E4E2DA] flex items-center justify-between text-xs"
                                          >
                                            <span>
                                              <strong>{cb.name}</strong> ·{' '}
                                              <span className="font-mono-tabular">
                                                {cb.startTime}–{cb.endTime}
                                              </span>{' '}
                                              ({cb.days.join(', ')})
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setCustomBreaks(
                                                  customBreaks.filter((_, i) => i !== idx)
                                                )
                                              }
                                              className="text-[#77766F] hover:text-red-600 cursor-pointer"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Live Calm Daily Rhythm Preview */}
                          <div className="p-4 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="font-semibold text-[#171717]">
                                Live Daily Rhythm Preview
                              </span>
                              <span className="font-mono-tabular text-[11px] text-[#57564F]">
                                {computedPreview.slots.length} lecture slots ·{' '}
                                {computedPreview.continuousLabBlocks.length} lab blocks
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                              {computedPreview.slots.map(slot => (
                                <motion.div
                                  key={slot.slotNumber}
                                  layout
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ duration: 0.18, ease: CALM_EASE }}
                                  className="px-2.5 py-1.5 rounded-lg bg-white border border-[#E4E2DA] text-[11px] font-mono-tabular text-[#171717]"
                                >
                                  <span className="text-[#77766F] mr-1">P{slot.slotNumber}</span>
                                  <span>{slot.period}</span>
                                </motion.div>
                              ))}
                              {computedPreview.middayBreak.enabled && (
                                <div className="px-2.5 py-1.5 rounded-lg bg-[#B8F2E6]/50 border border-[#8FDCC9] text-[11px] font-mono-tabular text-[#171717]">
                                  Midday · {computedPreview.middayBreak.timeRangeLabel}
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}

                      {/* =================================================
                          STEP 5: STARTER CATALOG & LAUNCH
                         ================================================= */}
                      {activeStep === 4 && (
                        <>
                          {/* Clean Interactive 4-Tile Configuration Summary */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            {[
                              {
                                step: 0,
                                label: 'Identity',
                                value: `${name || 'University'} (${code || 'UNIV'})`,
                                sub: `${campusName} · ${timezone}`
                              },
                              {
                                step: 1,
                                label: 'Calendar',
                                value: `${academicYear} · ${terms.length} Terms`,
                                sub: `Active: ${activeTermObj?.code || 'None'}`
                              },
                              {
                                step: 2,
                                label: 'Weekly Hours',
                                value: `${dayStartTime} – ${dayEndTime}`,
                                sub: `${workingDays.length} days (${workingDays.join(', ')})`
                              },
                              {
                                step: 3,
                                label: 'Class Pacing',
                                value: `${periodLengthMinutes}m Lec · ${computedPreview.labDurationHoursLabel} Lab`,
                                sub: `${
                                  shortBreakEnabled ? `${shortBreakMinutes}m break` : 'No short break'
                                } · ${
                                  middayBreakEnabled
                                    ? `${middayBreakDurationMinutes}m lunch`
                                    : 'No lunch'
                                }`
                              }
                            ].map(item => (
                              <div
                                key={item.label}
                                className="p-3.5 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] flex flex-col justify-between gap-2"
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-mono-tabular uppercase tracking-wide text-[#77766F]">
                                      {item.label}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => goToStep(item.step)}
                                      className="text-[11px] font-semibold text-[#171717] underline hover:opacity-75 cursor-pointer"
                                    >
                                      Edit
                                    </button>
                                  </div>
                                  <div className="text-xs font-semibold text-[#171717] mt-1 truncate">
                                    {item.value}
                                  </div>
                                  <div className="text-[11px] text-[#57564F] truncate mt-0.5">
                                    {item.sub}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Optional Tabbed Starter Catalog */}
                          <div className="border border-[#E4E2DA] rounded-xl overflow-hidden bg-white">
                            <div className="px-4 py-3 bg-[#F7F6EF]/70 border-b border-[#E4E2DA] flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="text-xs font-semibold text-[#171717]">
                                  Starter Academic Catalog (Optional)
                                </div>
                                <div className="text-[11px] text-[#77766F]">
                                  Add a few starter records now, import CSV spreadsheets, or skip
                                  and set up later.
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => setShowImportWizard(true)}
                                className="btn-secondary h-8 px-3 text-xs shrink-0"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                <span>Import CSV / Excel</span>
                              </button>
                            </div>

                            {/* Segmented Catalog Tabs */}
                            <div className="px-4 pt-3 border-b border-[#E4E2DA] flex items-center gap-1 overflow-x-auto">
                              {(
                                [
                                  {
                                    id: 'departments',
                                    label: 'Departments',
                                    count: departments.length,
                                    icon: Layers
                                  },
                                  {
                                    id: 'rooms',
                                    label: 'Rooms & Labs',
                                    count: rooms.length,
                                    icon: DoorOpen
                                  },
                                  {
                                    id: 'courses',
                                    label: 'Courses',
                                    count: courses.length,
                                    icon: BookOpen
                                  },
                                  {
                                    id: 'instructors',
                                    label: 'Faculty',
                                    count: instructors.length,
                                    icon: Users
                                  }
                                ] as Array<{
                                  id: CatalogTab;
                                  label: string;
                                  count: number;
                                  icon: typeof Layers;
                                }>
                              ).map(tab => {
                                const TabIcon = tab.icon;
                                const active = activeCatalogTab === tab.id;
                                return (
                                  <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveCatalogTab(tab.id)}
                                    className={`relative px-3 pb-2.5 pt-1 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
                                      active
                                        ? 'text-[#171717] font-semibold'
                                        : 'text-[#77766F] hover:text-[#171717]'
                                    }`}
                                  >
                                    <TabIcon className="w-3.5 h-3.5" />
                                    <span>{tab.label}</span>
                                    <span className="font-mono-tabular text-[11px] text-[#77766F]">
                                      · {tab.count}
                                    </span>
                                    {active && (
                                      <motion.span
                                        layoutId="catalog-tab-underline"
                                        transition={{
                                          type: 'spring',
                                          stiffness: 460,
                                          damping: 34
                                        }}
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#171717]"
                                      />
                                    )}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Active Catalog Tab Content */}
                            <div className="p-4">
                              <AnimatePresence mode="wait">
                                {activeCatalogTab === 'departments' && (
                                  <motion.div
                                    key="tab-departments"
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.18, ease: CALM_EASE }}
                                    className="space-y-3"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <input
                                        type="text"
                                        placeholder="Department Name (e.g. Computer Science)"
                                        value={newDeptName}
                                        onChange={e => setNewDeptName(e.target.value)}
                                        className="input-field h-9 text-xs flex-1 min-w-[200px]"
                                      />
                                      <input
                                        type="text"
                                        placeholder="Code (CS)"
                                        value={newDeptCode}
                                        onChange={e => setNewDeptCode(e.target.value.toUpperCase())}
                                        className="input-field h-9 text-xs w-24 font-mono-tabular uppercase"
                                      />
                                      <button
                                        type="button"
                                        onClick={handleAddDept}
                                        disabled={!newDeptName.trim() || !newDeptCode.trim()}
                                        className="btn-primary h-9 px-3.5 text-xs shrink-0"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Add Department</span>
                                      </button>
                                    </div>

                                    {departments.length === 0 ? (
                                      <p className="text-xs text-[#77766F] py-3 text-center">
                                        No departments added yet. Add one above or skip to configure
                                        later.
                                      </p>
                                    ) : (
                                      <div className="divide-y divide-[#E4E2DA] border border-[#E4E2DA] rounded-lg">
                                        {departments.map((d, idx) => (
                                          <div
                                            key={`${d.code}-${idx}`}
                                            className="px-3 py-2 flex items-center justify-between text-xs"
                                          >
                                            <span>
                                              <span className="font-mono-tabular font-semibold mr-2">
                                                {d.code}
                                              </span>
                                              {d.name}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setDepartments(
                                                  departments.filter((_, i) => i !== idx)
                                                )
                                              }
                                              className="text-[#77766F] hover:text-red-600 cursor-pointer"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </motion.div>
                                )}

                                {activeCatalogTab === 'rooms' && (
                                  <motion.div
                                    key="tab-rooms"
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.18, ease: CALM_EASE }}
                                    className="space-y-3"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <input
                                        type="text"
                                        placeholder="Room Code (e.g. HALL-101)"
                                        value={newRoomCode}
                                        onChange={e => setNewRoomCode(e.target.value.toUpperCase())}
                                        className="input-field h-9 text-xs flex-1 min-w-[160px] font-mono-tabular uppercase"
                                      />
                                      <input
                                        type="number"
                                        min={5}
                                        max={500}
                                        value={newRoomCap}
                                        onChange={e => setNewRoomCap(Number(e.target.value))}
                                        className="input-field h-9 text-xs w-20 font-mono-tabular"
                                        title="Seating capacity"
                                      />
                                      <select
                                        value={newRoomType}
                                        onChange={e =>
                                          setNewRoomType(e.target.value as 'lecture' | 'lab')
                                        }
                                        className="input-field h-9 text-xs w-28 bg-white"
                                      >
                                        <option value="lecture">Lecture</option>
                                        <option value="lab">Lab</option>
                                      </select>
                                      <button
                                        type="button"
                                        onClick={handleAddRoom}
                                        disabled={!newRoomCode.trim()}
                                        className="btn-primary h-9 px-3.5 text-xs shrink-0"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Add Room</span>
                                      </button>
                                    </div>

                                    {rooms.length === 0 ? (
                                      <p className="text-xs text-[#77766F] py-3 text-center">
                                        No rooms added yet. Add halls or labs above, or import via
                                        CSV.
                                      </p>
                                    ) : (
                                      <div className="divide-y divide-[#E4E2DA] border border-[#E4E2DA] rounded-lg">
                                        {rooms.map((r, idx) => (
                                          <div
                                            key={`${r.code}-${idx}`}
                                            className="px-3 py-2 flex items-center justify-between text-xs"
                                          >
                                            <span>
                                              <span className="font-mono-tabular font-semibold mr-2">
                                                {r.code}
                                              </span>
                                              {r.type === 'lab' ? 'Laboratory' : 'Lecture Hall'} ·{' '}
                                              <span className="font-mono-tabular">
                                                {r.capacity} seats
                                              </span>
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setRooms(rooms.filter((_, i) => i !== idx))
                                              }
                                              className="text-[#77766F] hover:text-red-600 cursor-pointer"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </motion.div>
                                )}

                                {activeCatalogTab === 'courses' && (
                                  <motion.div
                                    key="tab-courses"
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.18, ease: CALM_EASE }}
                                    className="space-y-3"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <input
                                        type="text"
                                        placeholder="Code (CS-101)"
                                        value={newCourseCode}
                                        onChange={e =>
                                          setNewCourseCode(e.target.value.toUpperCase())
                                        }
                                        className="input-field h-9 text-xs w-28 font-mono-tabular uppercase"
                                      />
                                      <input
                                        type="text"
                                        placeholder="Course Title"
                                        value={newCourseTitle}
                                        onChange={e => setNewCourseTitle(e.target.value)}
                                        className="input-field h-9 text-xs flex-1 min-w-[180px]"
                                      />
                                      <label className="text-xs text-[#57564F] inline-flex items-center gap-1.5 px-2 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={newCourseIsLab}
                                          onChange={e => setNewCourseIsLab(e.target.checked)}
                                          className="w-3.5 h-3.5 accent-[#171717]"
                                        />
                                        <span>Lab</span>
                                      </label>
                                      <button
                                        type="button"
                                        onClick={handleAddCourse}
                                        disabled={!newCourseCode.trim() || !newCourseTitle.trim()}
                                        className="btn-primary h-9 px-3.5 text-xs shrink-0"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Add Course</span>
                                      </button>
                                    </div>

                                    {courses.length === 0 ? (
                                      <p className="text-xs text-[#77766F] py-3 text-center">
                                        No courses added yet. Add courses above or set them up in
                                        your workspace.
                                      </p>
                                    ) : (
                                      <div className="divide-y divide-[#E4E2DA] border border-[#E4E2DA] rounded-lg">
                                        {courses.map((c, idx) => (
                                          <div
                                            key={`${c.code}-${idx}`}
                                            className="px-3 py-2 flex items-center justify-between text-xs"
                                          >
                                            <span>
                                              <span className="font-mono-tabular font-semibold mr-2">
                                                {c.code}
                                              </span>
                                              {c.title} ·{' '}
                                              <span className="text-[#77766F]">
                                                {c.isLab ? 'Lab' : 'Lecture'} ({c.cr} cr)
                                              </span>
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setCourses(courses.filter((_, i) => i !== idx))
                                              }
                                              className="text-[#77766F] hover:text-red-600 cursor-pointer"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </motion.div>
                                )}

                                {activeCatalogTab === 'instructors' && (
                                  <motion.div
                                    key="tab-instructors"
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.18, ease: CALM_EASE }}
                                    className="space-y-3"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <input
                                        type="text"
                                        placeholder="Faculty Member Name"
                                        value={newInstName}
                                        onChange={e => setNewInstName(e.target.value)}
                                        className="input-field h-9 text-xs flex-1 min-w-[160px]"
                                      />
                                      <input
                                        type="email"
                                        placeholder="faculty@university.edu"
                                        value={newInstEmail}
                                        onChange={e => setNewInstEmail(e.target.value)}
                                        className="input-field h-9 text-xs flex-1 min-w-[180px]"
                                      />
                                      <button
                                        type="button"
                                        onClick={handleAddInstructor}
                                        disabled={!newInstName.trim() || !newInstEmail.trim()}
                                        className="btn-primary h-9 px-3.5 text-xs shrink-0"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Add Faculty</span>
                                      </button>
                                    </div>

                                    {instructors.length === 0 ? (
                                      <p className="text-xs text-[#77766F] py-3 text-center">
                                        No faculty members added yet. Add instructors above or invite
                                        them later.
                                      </p>
                                    ) : (
                                      <div className="divide-y divide-[#E4E2DA] border border-[#E4E2DA] rounded-lg">
                                        {instructors.map((inst, idx) => (
                                          <div
                                            key={`${inst.email}-${idx}`}
                                            className="px-3 py-2 flex items-center justify-between text-xs"
                                          >
                                            <span>
                                              <strong className="font-semibold">{inst.name}</strong>{' '}
                                              · <span className="text-[#77766F]">{inst.email}</span>
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setInstructors(
                                                  instructors.filter((_, i) => i !== idx)
                                                )
                                              }
                                              className="text-[#77766F] hover:text-red-600 cursor-pointer"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Calm Sticky Footer */}
                <footer className="px-5 sm:px-8 py-4 bg-[#F7F6EF]/75 border-t border-[#E4E2DA] flex items-center justify-between gap-3 shrink-0">
                  <button
                    type="button"
                    disabled={activeStep === 0}
                    onClick={handlePreviousStep}
                    className="btn-secondary h-9 px-4 text-xs font-semibold"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>

                  <div className="flex items-center gap-2.5">
                    {activeStep < STEP_META.length - 1 ? (
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onClick={handleAdvanceStep}
                        className="btn-primary h-9 px-5 text-xs font-semibold"
                      >
                        <span>{isEditingExisting ? 'Save & Continue' : 'Continue'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </motion.button>
                    ) : (
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        disabled={isSubmitting}
                        onClick={() => void handleFinalizeOnboarding()}
                        className="btn-primary h-10 px-6 text-xs font-semibold"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>
                          {isSubmitting ? 'Saving Workspace...' : 'Complete Setup & Launch'}
                        </span>
                      </motion.button>
                    )}
                  </div>
                </footer>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </MotionConfig>
  );
};
