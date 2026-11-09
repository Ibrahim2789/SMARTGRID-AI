import React, { useState } from 'react';
import {
  Building2,
  Calendar,
  Clock,
  Coffee,
  Layers,
  DoorOpen,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Upload,
  Sparkles,
  Check,
  Plus,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { institutionalStore, InstitutionProfile } from '../data/store';
import {
  AcademicTerm,
  DayOfWeek,
  TimeBlockBreak,
  TimeStructure,
  TermStatus,
  computeAcademicScheduleConfig,
  validateAcademicTimingConfig
} from '../types/institutional';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  // =========================================================
  // STEP 0: Institution Identity & Profile
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
  const [timezone, setTimezone] = useState(
    existingSnapshot.institutionProfile?.timezone || 'UTC'
  );
  const [accreditation, setAccreditation] = useState(
    existingSnapshot.institutionProfile?.accreditation ||
      'National Higher Education Accreditation Council'
  );
  const [registrarName, setRegistrarName] = useState(
    initialRegistrarName || existingSnapshot.institutionProfile?.registrarName || 'Academic Registrar'
  );
  const [registrarEmail, setRegistrarEmail] = useState(
    initialRegistrarEmail ||
      existingSnapshot.institutionProfile?.registrarEmail ||
      'registrar@university.edu'
  );

  // =========================================================
  // STEP 1: Custom Academic Calendar (Terms / Semesters)
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
  const [newTermStart, setNewTermStart] = useState('2027-06-01');
  const [newTermEnd, setNewTermEnd] = useState('2027-08-01');
  const [newTermWeeks, setNewTermWeeks] = useState<number>(8);

  // =========================================================
  // STEP 2: Operating Hours & Standard Course Durations
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
  const [periodLengthMinutes, setPeriodLengthMinutes] = useState<number>(
    isEditingExisting ? existingSnapshot.timeStructure.periodLengthMinutes || 50 : 50
  );
  const [labDurationMinutes, setLabDurationMinutes] = useState<number>(
    isEditingExisting ? existingSnapshot.timeStructure.labDurationMinutes || 180 : 180
  );
  const [defaultLectureHoursPerWeek, setDefaultLectureHoursPerWeek] = useState<number>(3);
  const [defaultLabHoursPerWeek, setDefaultLabHoursPerWeek] = useState<number>(3);

  // =========================================================
  // STEP 3: Break Structures & Protected Windows
  // =========================================================
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
  const [fridayAfternoonShiftEnabled, setFridayAfternoonShiftEnabled] = useState<boolean>(
    isEditingExisting ? Boolean(existingSnapshot.timeStructure.fridayAfternoonShiftEnabled) : false
  );
  const [fridayAfternoonStartTime, setFridayAfternoonStartTime] = useState<string>(
    isEditingExisting ? existingSnapshot.timeStructure.fridayAfternoonStartTime || '14:30' : '14:30'
  );

  // Custom Additional Institutional Breaks (e.g., Morning Tea, Friday Assembly, Senate Hour)
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
  // STEP 4: Academic Structure (Departments & Cohorts)
  // =========================================================
  const [departments, setDepartments] = useState<
    Array<{ name: string; code: string; school: string }>
  >([
    { name: 'Department of Computer Science', code: 'CS', school: 'School of Computing' },
    { name: 'Department of Electrical Engineering', code: 'EE', school: 'School of Engineering' }
  ]);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');

  // =========================================================
  // STEP 5: Campus Facilities & Curriculum
  // =========================================================
  const [rooms, setRooms] = useState<
    Array<{ code: string; capacity: number; type: 'lecture' | 'lab' }>
  >([
    { code: 'HALL-A', capacity: 60, type: 'lecture' },
    { code: 'HALL-B', capacity: 60, type: 'lecture' },
    { code: 'LAB-01', capacity: 45, type: 'lab' }
  ]);
  const [newRoomCode, setNewRoomCode] = useState('');
  const [newRoomCap, setNewRoomCap] = useState(50);
  const [newRoomType, setNewRoomType] = useState<'lecture' | 'lab'>('lecture');

  const [courses, setCourses] = useState<
    Array<{ code: string; title: string; cr: number; isLab: boolean }>
  >([
    { code: 'CS-101', title: 'Foundations of Computer Systems', cr: 3, isLab: false },
    { code: 'CS-101-L', title: 'Systems Programming Laboratory', cr: 1, isLab: true },
    { code: 'EE-201', title: 'Circuit Analysis & Electronics', cr: 3, isLab: false }
  ]);
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseCr, setNewCourseCr] = useState<number>(3);
  const [newCourseIsLab, setNewCourseIsLab] = useState<boolean>(false);

  const [instructors, setInstructors] = useState<
    Array<{ name: string; title: string; email: string }>
  >([
    { name: 'Dr. Michael Chen', title: 'Professor', email: 'm.chen@university.edu' },
    { name: 'Prof. Sarah Jenkins', title: 'Associate Professor', email: 's.jenkins@university.edu' }
  ]);
  const [newInstName, setNewInstName] = useState('');
  const [newInstTitle, setNewInstTitle] = useState('Associate Professor');
  const [newInstEmail, setNewInstEmail] = useState('');

  // =========================================================
  // HELPER ACTIONS & PRESETS
  // =========================================================
  const applyInstitutionPreset = (preset: 'semester-5day' | 'trimester-6day' | 'quarter-block') => {
    setOnboardingError(null);
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
      startDate: newTermStart || '2026-09-01',
      endDate: newTermEnd || '2026-12-20',
      status: terms.length === 0 ? 'active' : 'draft',
      weeksCount: Math.max(1, Number(newTermWeeks) || 16)
    };
    setTerms([...terms, created]);
    setNewTermName('');
    setNewTermCode('');
  };

  const handleSetActiveTerm = (termId: string) => {
    setTerms(
      terms.map(t => ({
        ...t,
        status: (t.id === termId ? 'active' : t.status === 'active' ? 'draft' : t.status) as TermStatus
      }))
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
        cr: Math.max(1, Number(newCourseCr) || 3),
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
        title: newInstTitle.trim() || 'Faculty',
        email: newInstEmail.trim().toLowerCase()
      }
    ]);
    setNewInstName('');
    setNewInstEmail('');
  };

  const timingCandidate: Partial<TimeStructure> = {
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
    fridayAfternoonShiftEnabled,
    fridayAfternoonStartTime
  };

  const computedPreview = computeAcademicScheduleConfig(timingCandidate);
  const timingValidation = validateAcademicTimingConfig(timingCandidate);
  const activeTermObj = terms.find(t => t.status === 'active') || terms[0];

  const handleFinalizeOnboarding = () => {
    if (!name.trim() || !code.trim()) {
      setActiveStep(0);
      setOnboardingError('Please provide a university name and acronym code.');
      return;
    }

    if (terms.length === 0) {
      setActiveStep(1);
      setOnboardingError('Please configure at least one academic term or semester.');
      return;
    }

    if (!timingValidation.valid) {
      setActiveStep(2);
      setOnboardingError(timingValidation.errors[0] || 'Invalid operating hours or break configuration.');
      return;
    }

    setOnboardingError(null);
    setIsSubmitting(true);

    try {
      const newInstId =
        existingInstitutionId ||
        `inst-${code.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;

      const profile: InstitutionProfile = {
        id: newInstId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        campusCode: `${code.toUpperCase()}-MAIN-01`,
        campusName: campusName.trim(),
        accreditation: accreditation.trim(),
        academicYear: academicYear.trim(),
        currentTermName: activeTermObj?.name || 'Fall Semester 2026',
        registrarName: registrarName.trim(),
        registrarEmail: registrarEmail.trim(),
        autoConflictSweep: true,
        defaultSessionMinutes: periodLengthMinutes,
        timezone: timezone || 'UTC',
        isSample: false
      };

      const allBreaks: TimeBlockBreak[] = [
        ...(computedPreview.middayBreak.enabled
          ? [
              {
                id: `break-${newInstId}-lunch`,
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

      // 1. Save institution profile, custom academic calendar terms, operating hours, course durations & break structures into institutionalStore
      institutionalStore.registerNewInstitution(profile, timeConfig, terms);
      institutionalStore.setTerms(terms);
      institutionalStore.updateTimeStructure(timeConfig);

      // 2. Populate configured departments, rooms, courses, and instructors
      const current = institutionalStore.get();
      const bldId = current.buildings[0]?.id || 'bld-main';

      departments.forEach((d, i) => {
        institutionalStore.addDepartment({
          id: `dept-${d.code.toLowerCase()}-${i}`,
          code: d.code,
          name: d.name,
          school: d.school,
          colorHex: i === 0 ? '#1E3A8A' : i === 1 ? '#047857' : '#B45309'
        });
      });

      const updatedStore = institutionalStore.get();
      const firstDeptId = updatedStore.departments[0]?.id || 'dept-gen';

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

      institutionalStore.addStudentGroup({
        id: `group-2k26-${code.toLowerCase()}-a`,
        programId: updatedStore.programs[0]?.id || 'prog-gen',
        name: `${code.toUpperCase()} First Year Cohort A`,
        code: `2K26-${code.toUpperCase()}-A`,
        year: 1,
        size: 40,
        homeRoom: rooms[0]?.code || 'HALL-A',
        sharedCourseIds: []
      });

      // 3. Run configuration-driven solver using the newly saved operating hours, durations, and break structures
      institutionalStore.runTimetableSolver({
        forceRescheduleAll: true,
        strategyName: `${activeTermObj?.name || 'Inaugural'} Timetable`
      });

      setIsSubmitting(false);
      onCompleted?.(newInstId);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setOnboardingError(`Setup encountered an error: ${err?.message || err}`);
    }
  };

  const steps = [
    { title: '1. Identity', icon: Building2 },
    { title: '2. Academic Calendar', icon: Calendar },
    { title: '3. Hours & Durations', icon: Clock },
    { title: '4. Break Structures', icon: Coffee },
    { title: '5. Departments', icon: Layers },
    { title: '6. Facilities & Courses', icon: DoorOpen },
    { title: '7. Review & Save', icon: Sparkles }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs">
      {showImportWizard && (
        <DataImportWizard
          onClose={() => setShowImportWizard(false)}
          onSuccess={() => {
            setShowImportWizard(false);
          }}
        />
      )}

      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-white border border-[#E4E2DA] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-[#F7F6EF] border-b border-[#E4E2DA] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#171717] text-white flex items-center justify-center shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-serif-editorial text-lg text-[#171717] font-semibold">
                  University Setup &amp; Configuration Wizard
                </h2>
                <span className="text-[10px] font-mono-tabular font-bold px-2 py-0.5 rounded-full bg-[#B8EEEE] text-[#171717] border border-[#95DFDF]">
                  Dynamic Multi-Tenant Engine
                </span>
              </div>
              <p className="text-xs text-[#77766F] mt-0.5">
                Define your custom academic calendar, operating hours, course durations, and break structures in institutionalStore.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#77766F] hover:text-[#171717] hover:bg-black/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Multi-Step Stepper Bar */}
        <div className="px-6 py-2.5 bg-white border-b border-[#E4E2DA] overflow-x-auto">
          <div className="flex items-center justify-between min-w-[680px] gap-1.5">
            {steps.map((st, sIdx) => {
              const Icon = st.icon;
              const isActive = activeStep === sIdx;
              const isPast = activeStep > sIdx;
              return (
                <button
                  key={st.title}
                  type="button"
                  onClick={() => {
                    setOnboardingError(null);
                    setActiveStep(sIdx);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] transition-colors cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-[#171717] text-white font-semibold shadow-xs'
                      : isPast
                      ? 'bg-[#B7F77C]/30 text-[#171717] font-medium border border-[#98DF58]'
                      : 'text-[#77766F] hover:text-[#171717] hover:bg-[#F7F6EF]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{st.title}</span>
                  {isPast && <Check className="w-3 h-3 text-[#2E7D32]" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {onboardingError && (
            <div className="px-3.5 py-2.5 rounded-xl bg-[#FDE8E8] border border-[#F5B5B5] text-[#8B1E1E] text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{onboardingError}</span>
            </div>
          )}

          {/* =========================================================
              STEP 0: Institution Identity & Quick Architecture Presets
             ========================================================= */}
          {activeStep === 0 && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-[#E4E2DA]">
                <div>
                  <h3 className="font-serif-editorial text-lg text-[#171717] font-semibold">
                    1. Institution Identity &amp; Campus Profile
                  </h3>
                  <p className="text-xs text-[#77766F] mt-0.5">
                    Configure your university branding, timezone, and administrative contact, or start from an academic preset.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => applyInstitutionPreset('semester-5day')}
                    className="px-2.5 py-1 rounded-lg bg-[#F7F6EF] hover:bg-[#EDEAE0] border border-[#E4E2DA] text-[10.5px] font-semibold text-[#171717] cursor-pointer"
                  >
                    5-Day Semester Preset
                  </button>
                  <button
                    type="button"
                    onClick={() => applyInstitutionPreset('trimester-6day')}
                    className="px-2.5 py-1 rounded-lg bg-[#F7F6EF] hover:bg-[#EDEAE0] border border-[#E4E2DA] text-[10.5px] font-semibold text-[#171717] cursor-pointer"
                  >
                    6-Day Trimester Preset
                  </button>
                  <button
                    type="button"
                    onClick={() => applyInstitutionPreset('quarter-block')}
                    className="px-2.5 py-1 rounded-lg bg-[#F7F6EF] hover:bg-[#EDEAE0] border border-[#E4E2DA] text-[10.5px] font-semibold text-[#171717] cursor-pointer"
                  >
                    Quarter (75m) Preset
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#171717]">
                    University Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Apex Institute of Science & Technology"
                    className="input-field text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#171717]">
                    University Acronym / Short Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. AIST, MIT, NUST"
                    className="input-field text-xs font-mono-tabular uppercase"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#171717]">
                    Main Campus Name
                  </label>
                  <input
                    type="text"
                    value={campusName}
                    onChange={e => setCampusName(e.target.value)}
                    placeholder="e.g. Downtown Innovation Campus"
                    className="input-field text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#171717]">
                    Institution Timezone
                  </label>
                  <select
                    value={timezone}
                    onChange={e => setTimezone(e.target.value)}
                    className="input-field text-xs bg-white"
                  >
                    <option value="UTC">UTC (Coordinated Universal Time)</option>
                    <option value="America/New_York">America/New_York (EST/EDT)</option>
                    <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                    <option value="Europe/Berlin">Europe/Berlin (CET/CEST)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                    <option value="Asia/Karachi">Asia/Karachi (PKT)</option>
                    <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                    <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                  </select>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-semibold text-[#171717]">
                    Accreditation &amp; Governance Body
                  </label>
                  <input
                    type="text"
                    value={accreditation}
                    onChange={e => setAccreditation(e.target.value)}
                    placeholder="e.g. ABET, PEC, NCEAC, AACSB"
                    className="input-field text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#171717]">
                    Registrar / Administrator Name
                  </label>
                  <input
                    type="text"
                    value={registrarName}
                    onChange={e => setRegistrarName(e.target.value)}
                    placeholder="Dr. Katherine Reynolds"
                    className="input-field text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#171717]">
                    Registrar Official Email
                  </label>
                  <input
                    type="email"
                    value={registrarEmail}
                    onChange={e => setRegistrarEmail(e.target.value)}
                    placeholder="registrar@university.edu"
                    className="input-field text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              STEP 1: Custom Academic Calendar (Terms / Semesters)
             ========================================================= */}
          {activeStep === 1 && (
            <div className="space-y-5">
              <div>
                <h3 className="font-serif-editorial text-lg text-[#171717] font-semibold">
                  2. Custom Academic Calendar (Terms, Semesters &amp; Sessions)
                </h3>
                <p className="text-xs text-[#77766F] mt-0.5">
                  Define your academic year and term structure (Semesters, Trimesters, Quarters, or Custom Blocks). Saved directly into institutionalStore.
                </p>
              </div>

              {/* Calendar Model & Academic Year */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA]">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-[#171717]">
                    Academic Calendar Structure
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(
                      [
                        { id: 'semester', label: 'Semester (2/Yr)' },
                        { id: 'trimester', label: 'Trimester (3/Yr)' },
                        { id: 'quarter', label: 'Quarter (4/Yr)' },
                        { id: 'custom', label: 'Custom Terms' }
                      ] as Array<{ id: CalendarSystemType; label: string }>
                    ).map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectCalendarSystem(opt.id)}
                        className={`px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                          calendarSystem === opt.id
                            ? 'bg-[#171717] text-white border-[#171717]'
                            : 'bg-white text-[#57564F] border-[#E4E2DA] hover:text-[#171717]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#171717]">
                    Academic Year Label
                  </label>
                  <input
                    type="text"
                    value={academicYear}
                    onChange={e => setAcademicYear(e.target.value)}
                    placeholder="2026–2027"
                    className="input-field text-xs font-mono-tabular bg-white"
                  />
                </div>
              </div>

              {/* Configured Terms Table/List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#171717]">
                    Configured Academic Terms ({terms.length})
                  </span>
                  <span className="text-[11px] text-[#77766F]">
                    Click <strong>Set Active</strong> to mark the current scheduling term
                  </span>
                </div>

                <div className="space-y-2">
                  {terms.map((term, idx) => {
                    const isCurrentActive = term.status === 'active';
                    return (
                      <div
                        key={term.id}
                        className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                          isCurrentActive
                            ? 'bg-[#B7F77C]/20 border-[#98DF58]'
                            : 'bg-white border-[#E4E2DA]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <span className="px-2 py-1 rounded-md bg-[#171717] text-white text-[10px] font-mono-tabular font-bold">
                            {term.code}
                          </span>
                          <div>
                            <div className="text-xs font-semibold text-[#171717] flex items-center gap-2">
                              <span>{term.name}</span>
                              {isCurrentActive && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#171717] text-[#B7F77C]">
                                  Active Term
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#77766F] font-mono-tabular">
                              {term.startDate} → {term.endDate} · {term.weeksCount} instructional weeks
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {!isCurrentActive && (
                            <button
                              type="button"
                              onClick={() => handleSetActiveTerm(term.id)}
                              className="px-2.5 py-1 rounded-lg bg-[#F7F6EF] hover:bg-[#EDEAE0] border border-[#E4E2DA] text-[11px] font-semibold text-[#171717] cursor-pointer"
                            >
                              Set Active
                            </button>
                          )}
                          {terms.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const remaining = terms.filter((_, i) => i !== idx);
                                if (isCurrentActive && remaining.length > 0) {
                                  remaining[0].status = 'active';
                                }
                                setTerms(remaining);
                              }}
                              className="p-1.5 text-[#77766F] hover:text-red-600 cursor-pointer"
                              title="Remove term"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add Custom Term Form */}
              <div className="p-3.5 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF]/50 space-y-3">
                <div className="text-xs font-semibold text-[#171717]">
                  Add Academic Term / Semester / Summer Session
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                  <input
                    type="text"
                    placeholder="Term Name (e.g. Summer 2027)"
                    value={newTermName}
                    onChange={e => setNewTermName(e.target.value)}
                    className="input-field h-9 text-xs bg-white sm:col-span-2"
                  />
                  <input
                    type="text"
                    placeholder="Code (SUM-27)"
                    value={newTermCode}
                    onChange={e => setNewTermCode(e.target.value.toUpperCase())}
                    className="input-field h-9 text-xs font-mono-tabular uppercase bg-white"
                  />
                  <input
                    type="date"
                    value={newTermStart}
                    onChange={e => setNewTermStart(e.target.value)}
                    className="input-field h-9 text-xs font-mono-tabular bg-white"
                  />
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={52}
                      value={newTermWeeks}
                      onChange={e => setNewTermWeeks(Number(e.target.value))}
                      className="input-field h-9 text-xs font-mono-tabular bg-white w-16"
                      title="Weeks count"
                    />
                    <button
                      type="button"
                      onClick={handleAddTerm}
                      disabled={!newTermName.trim() || !newTermCode.trim()}
                      className="btn-primary h-9 px-3 text-xs font-semibold shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              STEP 2: Operating Hours & Standard Course Durations
             ========================================================= */}
          {activeStep === 2 && (
            <div className="space-y-5">
              <div>
                <h3 className="font-serif-editorial text-lg text-[#171717] font-semibold">
                  3. Operating Hours &amp; Standard Course Durations
                </h3>
                <p className="text-xs text-[#77766F] mt-0.5">
                  Replace any fixed 9–5 or 50-minute assumptions with your institution's exact operating window and course/lab durations.
                </p>
              </div>

              {/* Working Days Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#171717]">
                  University Working Days
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as DayOfWeek[]).map(d => {
                    const active = workingDays.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(d)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-mono-tabular transition-colors cursor-pointer border ${
                          active
                            ? 'bg-[#171717] text-white border-[#171717] font-bold'
                            : 'bg-[#F7F6EF] text-[#77766F] border-[#E4E2DA] hover:text-[#171717]'
                        }`}
                      >
                        {d} {active && '✓'}
                      </button>
                    );
                  })}
                </div>
                <div className="text-[11px] text-[#77766F]">
                  Active operating week: <strong>{workingDays.join(', ')}</strong> ({workingDays.length} days/week)
                </div>
              </div>

              {/* Daily Operating Window */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#171717]">
                    Daily Opening Time (First Period Start)
                  </label>
                  <input
                    type="time"
                    value={dayStartTime}
                    onChange={e => setDayStartTime(e.target.value)}
                    className="input-field text-xs font-mono-tabular"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#171717]">
                    Daily Closing Time (Campus Day End)
                  </label>
                  <input
                    type="time"
                    value={dayEndTime}
                    onChange={e => setDayEndTime(e.target.value)}
                    className="input-field text-xs font-mono-tabular"
                  />
                </div>
              </div>

              {/* Standard Lecture & Lab Durations (Presets + Custom Input) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA]">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[#171717] flex items-center justify-between">
                    <span>Standard Lecture Slot Duration (Minutes)</span>
                    <span className="font-mono-tabular text-[#171717] font-bold">
                      {periodLengthMinutes} mins
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[45, 50, 60, 75, 90, 120].map(mins => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setPeriodLengthMinutes(mins)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono-tabular border cursor-pointer ${
                          periodLengthMinutes === mins
                            ? 'bg-[#171717] text-white border-[#171717] font-semibold'
                            : 'bg-white text-[#57564F] border-[#E4E2DA] hover:text-[#171717]'
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-[#77766F]">Custom minutes:</span>
                    <input
                      type="number"
                      min={20}
                      max={240}
                      value={periodLengthMinutes}
                      onChange={e => setPeriodLengthMinutes(Math.max(20, Number(e.target.value) || 50))}
                      className="input-field h-8 w-24 text-xs font-mono-tabular bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[#171717] flex items-center justify-between">
                    <span>Continuous Laboratory Duration (Minutes)</span>
                    <span className="font-mono-tabular text-[#171717] font-bold">
                      {labDurationMinutes} mins ({computedPreview.labDurationHoursLabel})
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[100, 120, 150, 180, 240].map(mins => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setLabDurationMinutes(mins)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono-tabular border cursor-pointer ${
                          labDurationMinutes === mins
                            ? 'bg-[#171717] text-white border-[#171717] font-semibold'
                            : 'bg-white text-[#57564F] border-[#E4E2DA] hover:text-[#171717]'
                        }`}
                      >
                        {mins}m ({(mins / 60).toFixed(mins % 60 === 0 ? 0 : 1)}h)
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-[#77766F]">Custom lab minutes:</span>
                    <input
                      type="number"
                      min={45}
                      max={360}
                      value={labDurationMinutes}
                      onChange={e => setLabDurationMinutes(Math.max(45, Number(e.target.value) || 180))}
                      className="input-field h-8 w-24 text-xs font-mono-tabular bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Standard Weekly Course Contact Hours Defaults */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#171717]">
                    Default Weekly Contact Hours (Theory Course)
                  </label>
                  <select
                    value={defaultLectureHoursPerWeek}
                    onChange={e => setDefaultLectureHoursPerWeek(Number(e.target.value))}
                    className="input-field text-xs bg-white"
                  >
                    <option value={2}>2 Contact Hours / Week</option>
                    <option value={3}>3 Contact Hours / Week (Standard)</option>
                    <option value={4}>4 Contact Hours / Week</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#171717]">
                    Default Weekly Contact Hours (Laboratory Course)
                  </label>
                  <select
                    value={defaultLabHoursPerWeek}
                    onChange={e => setDefaultLabHoursPerWeek(Number(e.target.value))}
                    className="input-field text-xs bg-white"
                  >
                    <option value={2}>2 Lab Hours / Week</option>
                    <option value={3}>3 Lab Hours / Week (Standard)</option>
                    <option value={4}>4 Lab Hours / Week</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              STEP 3: Break Structures & Protected Windows
             ========================================================= */}
          {activeStep === 3 && (
            <div className="space-y-5">
              <div>
                <h3 className="font-serif-editorial text-lg text-[#171717] font-semibold">
                  4. Break Structures &amp; Protected Institutional Windows
                </h3>
                <p className="text-xs text-[#77766F] mt-0.5">
                  Configure short inter-class transition breaks, midday lunch windows, Friday afternoon shifts, and custom institutional breaks.
                </p>
              </div>

              {/* 1. Short Inter-Class Break */}
              <div className="p-4 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF]/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-[#171717]">
                      Short Inter-Class Transition Break
                    </div>
                    <div className="text-[11px] text-[#77766F]">
                      Buffer time between consecutive lecture periods for room transitions
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={shortBreakEnabled}
                    onChange={e => {
                      setShortBreakEnabled(e.target.checked);
                      if (!e.target.checked) setShortBreakMinutes(0);
                      else if (shortBreakMinutes === 0) setShortBreakMinutes(10);
                    }}
                    className="w-4 h-4 accent-[#171717]"
                  />
                </div>

                {shortBreakEnabled && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E4E2DA]">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#77766F]">Transition Duration:</span>
                      {[5, 10, 15, 20].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setShortBreakMinutes(m)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono-tabular border cursor-pointer ${
                            shortBreakMinutes === m
                              ? 'bg-[#171717] text-white border-[#171717]'
                              : 'bg-white text-[#57564F] border-[#E4E2DA]'
                          }`}
                        >
                          {m} mins
                        </button>
                      ))}
                    </div>

                    <label className="inline-flex items-center gap-2 text-[11px] text-[#57564F] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeBreakAfterLastSlot}
                        onChange={e => setIncludeBreakAfterLastSlot(e.target.checked)}
                        className="w-3.5 h-3.5 accent-[#171717]"
                      />
                      <span>Include break after final slot before lunch/closing</span>
                    </label>
                  </div>
                )}
              </div>

              {/* 2. Midday Lunch & Rest Break */}
              <div className="p-4 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF]/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-[#171717]">
                      University Midday / Lunch Break Window
                    </div>
                    <div className="text-[11px] text-[#77766F]">
                      Protected midday window across all departments where no lectures or labs are placed
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={middayBreakEnabled}
                    onChange={e => setMiddayBreakEnabled(e.target.checked)}
                    className="w-4 h-4 accent-[#171717]"
                  />
                </div>

                {middayBreakEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#E4E2DA]">
                    <div className="space-y-1">
                      <label className="text-[11px] text-[#77766F]">Placement Mode</label>
                      <select
                        value={middayBreakMode}
                        onChange={e => setMiddayBreakMode(e.target.value as 'fixed' | 'auto')}
                        className="input-field h-8 text-xs bg-white"
                      >
                        <option value="fixed">Fixed Start Time</option>
                        <option value="auto">Auto-Center After Morning Slots</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-[#77766F]">Lunch Start Time</label>
                      <input
                        type="time"
                        value={middayBreakStartTime}
                        onChange={e => setMiddayBreakStartTime(e.target.value)}
                        className="input-field h-8 text-xs font-mono-tabular bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-[#77766F]">Lunch Duration</label>
                      <select
                        value={middayBreakDurationMinutes}
                        onChange={e => setMiddayBreakDurationMinutes(Number(e.target.value))}
                        className="input-field h-8 text-xs bg-white"
                      >
                        <option value={30}>30 Minutes</option>
                        <option value={45}>45 Minutes</option>
                        <option value={60}>60 Minutes (1 Hour)</option>
                        <option value={75}>75 Minutes</option>
                        <option value={90}>90 Minutes</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Friday Afternoon Shift & Custom Protected Breaks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl border border-[#E4E2DA] bg-white space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-[#171717]">
                        Friday Extended Midday / Prayer Shift
                      </div>
                      <div className="text-[10.5px] text-[#77766F]">
                        Shifts Friday afternoon session start time
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={fridayAfternoonShiftEnabled}
                      onChange={e => setFridayAfternoonShiftEnabled(e.target.checked)}
                      className="w-4 h-4 accent-[#171717]"
                    />
                  </div>
                  {fridayAfternoonShiftEnabled && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-[#57564F]">Friday Afternoon Start:</span>
                      <input
                        type="time"
                        value={fridayAfternoonStartTime}
                        onChange={e => setFridayAfternoonStartTime(e.target.value)}
                        className="input-field h-8 w-28 text-xs font-mono-tabular"
                      />
                    </div>
                  )}
                </div>

                {/* Add Custom Named Break Window */}
                <div className="p-3.5 rounded-xl border border-[#E4E2DA] bg-white space-y-2">
                  <div className="text-xs font-semibold text-[#171717]">
                    Additional Institutional Break Windows ({customBreaks.length})
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="e.g. Convocation / Assembly Hour"
                      value={newBreakName}
                      onChange={e => setNewBreakName(e.target.value)}
                      className="input-field h-8 text-xs flex-1"
                    />
                    <input
                      type="time"
                      value={newBreakStart}
                      onChange={e => setNewBreakStart(e.target.value)}
                      className="input-field h-8 w-22 text-xs font-mono-tabular"
                    />
                    <input
                      type="time"
                      value={newBreakEnd}
                      onChange={e => setNewBreakEnd(e.target.value)}
                      className="input-field h-8 w-22 text-xs font-mono-tabular"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomBreak}
                      disabled={!newBreakName.trim()}
                      className="btn-primary h-8 px-2.5 text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {workingDays.map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleNewBreakDay(d)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono-tabular cursor-pointer ${
                          newBreakDays.includes(d)
                            ? 'bg-[#171717] text-white'
                            : 'bg-[#F7F6EF] text-[#77766F]'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  {customBreaks.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {customBreaks.map((cb, idx) => (
                        <div
                          key={cb.id}
                          className="px-2.5 py-1 rounded-lg bg-[#F7F6EF] flex items-center justify-between text-[11px]"
                        >
                          <span>
                            <strong>{cb.name}</strong> ({cb.startTime}–{cb.endTime} · {cb.days.join(', ')})
                          </span>
                          <button
                            type="button"
                            onClick={() => setCustomBreaks(customBreaks.filter((_, i) => i !== idx))}
                            className="text-[#77766F] hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Dynamic Computed Schedule Slots Preview */}
              <div className="p-3.5 rounded-xl bg-[#B7F77C]/25 border border-[#98DF58] space-y-2">
                <div className="flex items-center justify-between text-xs text-[#171717]">
                  <span className="font-semibold">
                    Live Generated Daily Period Grid ({computedPreview.slots.length} Slots · {computedPreview.continuousLabBlocks.length} Lab Windows)
                  </span>
                  <span className="font-mono-tabular text-[11px]">
                    {computedPreview.operatingHoursLabel}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {computedPreview.slots.map(slot => (
                    <span
                      key={slot.slotNumber}
                      className="px-2 py-1 rounded-md bg-white border border-[#98DF58] text-[10.5px] font-mono-tabular text-[#171717]"
                    >
                      S{slot.slotNumber}: {slot.period}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              STEP 4: Academic Structure & Departments
             ========================================================= */}
          {activeStep === 4 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif-editorial text-lg text-[#171717] font-semibold">
                    5. Academic Structure &amp; Departments
                  </h3>
                  <p className="text-xs text-[#77766F] mt-0.5">
                    Define faculties, degree programs, and initial student cohorts, or bulk import via CSV.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowImportWizard(true)}
                  className="btn-secondary h-8 px-3 text-xs inline-flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Bulk Import via CSV</span>
                </button>
              </div>

              <div className="space-y-2">
                {departments.map((d, i) => (
                  <div
                    key={d.code}
                    className="p-3 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF]/40 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-md bg-[#171717] text-white text-[10px] font-mono-tabular font-bold flex items-center justify-center">
                        {d.code}
                      </span>
                      <div>
                        <div className="text-xs font-semibold text-[#171717]">{d.name}</div>
                        <div className="text-[11px] text-[#77766F]">{d.school}</div>
                      </div>
                    </div>
                    {departments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setDepartments(departments.filter((_, idx) => idx !== i))}
                        className="text-[#77766F] hover:text-red-600 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl border border-[#E4E2DA] bg-white flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Department Name (e.g. Mechanical Engineering)"
                  value={newDeptName}
                  onChange={e => setNewDeptName(e.target.value)}
                  className="input-field text-xs flex-1 min-w-[200px]"
                />
                <input
                  type="text"
                  placeholder="Code (ME)"
                  value={newDeptCode}
                  onChange={e => setNewDeptCode(e.target.value)}
                  className="input-field text-xs w-24 font-mono-tabular uppercase"
                />
                <button
                  type="button"
                  onClick={handleAddDept}
                  disabled={!newDeptName.trim() || !newDeptCode.trim()}
                  className="btn-primary h-9 px-3 text-xs inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Department</span>
                </button>
              </div>
            </div>
          )}

          {/* =========================================================
              STEP 5: Campus Facilities, Curriculum & Faculty
             ========================================================= */}
          {activeStep === 5 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif-editorial text-lg text-[#171717] font-semibold">
                    6. Campus Facilities, Course Catalog &amp; Faculty
                  </h3>
                  <p className="text-xs text-[#77766F] mt-0.5">
                    Configure classrooms, laboratories, initial courses, and instructors.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowImportWizard(true)}
                  className="btn-secondary h-8 px-3 text-xs inline-flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Bulk CSV Import</span>
                </button>
              </div>

              {/* Rooms Section */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-[#171717]">
                  Classrooms &amp; Laboratories ({rooms.length})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {rooms.map((r, i) => (
                    <div
                      key={r.code}
                      className="p-2.5 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF]/50 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-mono-tabular font-bold text-[#171717]">
                          {r.code}
                        </div>
                        <div className="text-[11px] text-[#77766F]">
                          {r.type === 'lab' ? 'Laboratory' : 'Lecture Hall'} · {r.capacity} Seats
                        </div>
                      </div>
                      {rooms.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setRooms(rooms.filter((_, idx) => idx !== i))}
                          className="text-[#77766F] hover:text-red-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Room Code (HALL-101)"
                    value={newRoomCode}
                    onChange={e => setNewRoomCode(e.target.value)}
                    className="input-field h-8 text-xs font-mono-tabular flex-1 min-w-[130px]"
                  />
                  <input
                    type="number"
                    placeholder="Seats"
                    value={newRoomCap}
                    onChange={e => setNewRoomCap(Number(e.target.value))}
                    className="input-field h-8 text-xs w-20 font-mono-tabular"
                  />
                  <select
                    value={newRoomType}
                    onChange={e => setNewRoomType(e.target.value as 'lecture' | 'lab')}
                    className="input-field h-8 text-xs w-28 bg-white"
                  >
                    <option value="lecture">Lecture Hall</option>
                    <option value="lab">Laboratory</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddRoom}
                    disabled={!newRoomCode.trim()}
                    className="btn-primary h-8 px-3 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Room</span>
                  </button>
                </div>
              </div>

              {/* Courses & Faculty Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#E4E2DA]">
                {/* Courses Column */}
                <div className="space-y-2 border border-[#E4E2DA] p-3 rounded-xl bg-[#F7F6EF]/30">
                  <div className="text-xs font-semibold text-[#171717]">
                    Course Catalog ({courses.length})
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {courses.map((c, idx) => (
                      <div
                        key={c.code}
                        className="p-2 rounded-lg bg-white border border-[#E4E2DA] flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-mono-tabular font-bold text-[#171717]">{c.code}</div>
                          <div className="text-[11px] text-[#77766F] truncate">{c.title}</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono-tabular px-1.5 py-0.5 rounded bg-[#F7F6EF]">
                            {c.isLab ? `Lab (${defaultLabHoursPerWeek}h)` : `${c.cr} Cr (${defaultLectureHoursPerWeek}h)`}
                          </span>
                          {courses.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setCourses(courses.filter((_, i) => i !== idx))}
                              className="text-[#77766F] hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="Code (CS-202)"
                      value={newCourseCode}
                      onChange={e => setNewCourseCode(e.target.value)}
                      className="input-field h-8 text-xs w-24 font-mono-tabular uppercase bg-white"
                    />
                    <input
                      type="text"
                      placeholder="Course Title"
                      value={newCourseTitle}
                      onChange={e => setNewCourseTitle(e.target.value)}
                      className="input-field h-8 text-xs flex-1 bg-white"
                    />
                    <label className="text-[10.5px] flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newCourseIsLab}
                        onChange={e => setNewCourseIsLab(e.target.checked)}
                      />
                      Lab
                    </label>
                    <button
                      type="button"
                      onClick={handleAddCourse}
                      disabled={!newCourseCode.trim() || !newCourseTitle.trim()}
                      className="btn-primary h-8 px-2.5 text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Faculty Column */}
                <div className="space-y-2 border border-[#E4E2DA] p-3 rounded-xl bg-[#F7F6EF]/30">
                  <div className="text-xs font-semibold text-[#171717]">
                    Faculty Roster ({instructors.length})
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {instructors.map((inst, idx) => (
                      <div
                        key={inst.email}
                        className="p-2 rounded-lg bg-white border border-[#E4E2DA] flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-[#171717]">{inst.name}</div>
                          <div className="text-[11px] text-[#77766F] truncate">{inst.email}</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#B8EEEE]/40 text-[#171717]">
                            {inst.title}
                          </span>
                          {instructors.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setInstructors(instructors.filter((_, i) => i !== idx))}
                              className="text-[#77766F] hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="Dr. Alan Grant"
                      value={newInstName}
                      onChange={e => setNewInstName(e.target.value)}
                      className="input-field h-8 text-xs flex-1 bg-white"
                    />
                    <input
                      type="email"
                      placeholder="grant@univ.edu"
                      value={newInstEmail}
                      onChange={e => setNewInstEmail(e.target.value)}
                      className="input-field h-8 text-xs flex-1 bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddInstructor}
                      disabled={!newInstName.trim() || !newInstEmail.trim()}
                      className="btn-primary h-8 px-2.5 text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              STEP 6: Review, Save to institutionalStore & Synthesize
             ========================================================= */}
          {activeStep === 6 && (
            <div className="space-y-5 py-2">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-[#171717] text-white flex items-center justify-center mx-auto shadow-md">
                  <Sparkles className="w-6 h-6 text-[#B7F77C]" />
                </div>
                <h3 className="font-serif-editorial text-2xl text-[#171717]">
                  Save Configuration for {name || 'Your University'}
                </h3>
                <p className="text-xs text-[#77766F] max-w-lg mx-auto">
                  Review your custom academic calendar, operating hours, course durations, and break structures before saving to institutionalStore and generating the timetable.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
                <div className="p-3 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF]">
                  <div className="text-[10.5px] text-[#77766F]">Academic Calendar</div>
                  <div className="font-mono-tabular font-bold text-xs text-[#171717] mt-0.5">
                    {terms.length} Terms ({activeTermObj?.code})
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF]">
                  <div className="text-[10.5px] text-[#77766F]">Operating Window</div>
                  <div className="font-mono-tabular font-bold text-xs text-[#171717] mt-0.5">
                    {workingDays.length}d · {dayStartTime}–{dayEndTime}
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF]">
                  <div className="text-[10.5px] text-[#77766F]">Course &amp; Lab Durations</div>
                  <div className="font-mono-tabular font-bold text-xs text-[#171717] mt-0.5">
                    {periodLengthMinutes}m Class · {computedPreview.labDurationHoursLabel} Lab
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF]">
                  <div className="text-[10.5px] text-[#77766F]">Break Structures</div>
                  <div className="font-mono-tabular font-bold text-xs text-[#171717] mt-0.5">
                    {shortBreakEnabled ? `${shortBreakMinutes}m Short` : '0m'} ·{' '}
                    {middayBreakEnabled ? `${middayBreakDurationMinutes}m Lunch` : 'No Lunch'}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#B7F77C]/30 border border-[#98DF58] text-xs text-[#171717] max-w-xl mx-auto flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#2E7D32] shrink-0 mt-0.5" />
                <div>
                  <strong>Zero Hardcoded Assumptions:</strong> Saving this wizard writes your custom academic calendar ({terms.map(t => t.code).join(', ')}), {computedPreview.slots.length} daily lecture slots ({periodLengthMinutes}m each), {computedPreview.continuousLabBlocks.length} continuous lab windows, and {customBreaks.length + (middayBreakEnabled ? 1 : 0)} protected break windows directly into <code>institutionalStore</code>.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 bg-[#F7F6EF] border-t border-[#E4E2DA] flex items-center justify-between">
          <button
            type="button"
            disabled={activeStep === 0}
            onClick={() => {
              setOnboardingError(null);
              setActiveStep(Math.max(0, activeStep - 1));
            }}
            className="btn-secondary h-9 px-4 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Previous Step</span>
          </button>

          <div className="flex items-center gap-2">
            {activeStep < steps.length - 1 ? (
              <button
                type="button"
                onClick={() => {
                  if (activeStep === 0 && (!name.trim() || !code.trim())) {
                    setOnboardingError('Please enter a university name and acronym code to continue.');
                    return;
                  }
                  if (activeStep === 1 && terms.length === 0) {
                    setOnboardingError('Please define at least one academic term or semester.');
                    return;
                  }
                  if ((activeStep === 2 || activeStep === 3) && !timingValidation.valid) {
                    setOnboardingError(timingValidation.errors[0]);
                    return;
                  }
                  setOnboardingError(null);
                  setActiveStep(activeStep + 1);
                }}
                className="btn-primary h-9 px-5 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinalizeOnboarding}
                className="btn-primary h-10 px-6 text-xs font-bold inline-flex items-center gap-2 shadow-xs"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Saving & Synthesizing...'
                    : 'Save Configuration & Generate Timetable'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
