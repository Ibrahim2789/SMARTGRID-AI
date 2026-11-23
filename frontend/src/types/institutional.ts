export type TermStatus = 'draft' | 'active' | 'archived';
export type TimetableManagementPolicy = 'whole_university' | 'department_wise';
export type RoomType = 'lecture' | 'lab' | 'seminar' | 'studio';
export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type DegreeLevel = 'Undergraduate' | 'Graduate' | 'Postgraduate';
export type ConstraintKind = 'hard' | 'soft';
export type ScenarioStatus = 'draft' | 'published' | 'archived';
export type AuditAction = 'create' | 'update' | 'delete' | 'generate' | 'publish' | 'restore';
export type CourseType = 'lecture' | 'lab' | 'lecture_lab';
export type LabSessionMode = 'continuous' | 'split_allowed';
export type SessionComponentType = 'lecture' | 'lab';

const CANONICAL_DAY_ORDER: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Orders working days so Mon..Thu..Fri always keeps Friday as the rightmost
 * standard weekday column (and Sat/Sun follow after Friday if enabled).
 * If fridayEnabled is false, Friday is excluded cleanly.
 */
export function orderWorkingDaysFridayRightmost(
  days?: Array<DayOfWeek | string> | null,
  fridayEnabled = true
): DayOfWeek[] {
  const raw = Array.isArray(days) && days.length > 0 ? days : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const normalized = new Set<DayOfWeek>();
  raw.forEach(d => {
    const short = String(d).trim().slice(0, 3);
    const match = CANONICAL_DAY_ORDER.find(c => c.toLowerCase() === short.toLowerCase());
    if (match) {
      if (match === 'Fri' && !fridayEnabled) return;
      normalized.add(match);
    }
  });
  return CANONICAL_DAY_ORDER.filter(d => normalized.has(d));
}

export interface BaseEntity {
  is_sample?: boolean;
  isSample?: boolean;
}

export interface AcademicTerm extends BaseEntity {
  id: string;
  name: string;
  code: string;
  academicYear?: string;
  startDate: string; // ISO YYYY-MM-DD
  endDate: string;
  status: TermStatus;
  weeksCount: number;
  departmentIds?: string[];
}

export interface Campus extends BaseEntity {
  id: string;
  name: string;
  code: string;
  address: string;
}

export interface Building extends BaseEntity {
  id: string;
  campusId: string;
  name: string;
  code: string;
  floors: number;
}

export interface RoomAvailabilityWindow {
  day: DayOfWeek;
  startTime: string; // HH:mm
  endTime: string;
}

export interface Room extends BaseEntity {
  id: string;
  buildingId: string;
  code: string;
  name: string;
  capacity: number;
  type: RoomType;
  equipment: string[]; // e.g. ['Projector', 'AC', 'Accessible', 'Workstations']
  isAccessible: boolean;
  isAvailable: boolean;
  assignedLabEngineerId?: string; // Dedicated Lab Engineer supervising this lab room
  availabilityWindows?: RoomAvailabilityWindow[];
}

export interface Department extends BaseEntity {
  id: string;
  name: string;
  code: string;
  school: string;
  colorHex: string;
  subDepartments?: string[]; // Internal divisions/tracks inside this department (where teachers/lab engineers are assigned)
}

export interface Program extends BaseEntity {
  id: string;
  departmentId: string;
  name: string;
  code: string;
  degreeLevel: DegreeLevel;
  totalSemesters: number;
}

export interface Course extends BaseEntity {
  id: string;
  departmentId: string;
  subDepartment?: string; // Optional internal department track/unit
  code: string;
  title: string;
  courseType?: CourseType; // 'lecture' | 'lab' | 'lecture_lab'
  creditHours: number;
  lectureCredits?: number; // 1 credit hour = 1 lecture contact hour/week
  labCredits?: number; // 1 credit hour = 3 continuous lab contact hours/week
  weeklyContactHours: number;
  lectureHours: number;
  labHours: number;
  requiredRoomType: RoomType;
  assignedInstructorId?: string; // Admin-assigned Lecture Instructor (strictly honored)
  assignedLabEngineerId?: string; // Admin-assigned Lab Engineer (strictly honored)
  assignedBatchId?: string;
  enrolledBatchIds?: string[];
  semester?: number;
  labSessionMode?: LabSessionMode; // 'continuous' (default 3h block) | 'split_allowed' (e.g. 1.5h + 1.5h)
  isElective?: boolean;
  electivePoolName?: string;
  description?: string;
}

export type SessionKind = 'Lecture' | 'Lab';

export interface SectionSlotAssignment {
  day: DayOfWeek;
  timeSlot: string; // e.g. '9:00 – 9:50 AM'
  roomId: string;
  durationMinutes?: number; // 50 for regular Lecture, 180 for 3-hour continuous Lab
  sessionType?: SessionKind; // 'Lecture' | 'Lab'
  spanSlots?: number; // 1 for Lecture, 3 for 3-hour continuous Lab
  continuousTimeLabel?: string; // e.g. '9:00 AM – 12:00 PM' or '2:00 PM – 5:00 PM'
  startTime24?: string; // Exact HH:MM start time (e.g. '09:00')
  endTime24?: string; // Exact HH:MM end time (e.g. '12:00')
  startMinutes?: number; // Minutes from midnight
  endMinutes?: number; // Minutes from midnight
  isSplitLab?: boolean;
  slotSource?: 'regular' | 'friday_regular' | 'friday_compressed';
}

export interface Section extends BaseEntity {
  id: string;
  courseId: string;
  termId: string;
  sectionNumber: string; // e.g. '01', 'A', 'A-Lab'
  expectedEnrollment: number;
  instructorId: string;
  labEngineerId?: string; // Dedicated Lab Engineer assigned to supervise Lab sessions
  studentGroupId: string;
  sharedGroupIds?: string[]; // Additional cohorts attending a shared/elective section
  sessionType?: SessionKind; // 'Lecture' | 'Lab'
  componentType?: SessionComponentType; // 'lecture' | 'lab'
  isAtomicSession?: boolean; // True when session cannot be arbitrarily split
  spanSlots?: number; // 1 for Lecture, 3 for Lab
  sessionsPerWeek?: number;
  programId?: string;
  assignedLabId?: string;
  assignmentStatus?: 'unassigned' | 'partial' | 'assigned' | 'invalid';
  validationErrors?: Array<{ code: string; field: string; message: string }>;
  assignedSlot?: SectionSlotAssignment;
  isLocked?: boolean;
}

export interface UniversitySlotMeta {
  slotNumber: number; // 1..N
  session: 'Morning' | 'Afternoon';
  period: string; // e.g. '9:00 – 9:50 AM'
  startTime: string; // e.g. '9:00 AM'
  lectureEndTime: string; // e.g. '9:50 AM'
  cycleEndTime: string; // e.g. '10:00 AM'
  shortBreak: string; // e.g. '9:50 – 10:00 AM' or 'No Break (Back-to-Back)'
  startMinutes?: number;
  lectureEndMinutes?: number;
  cycleEndMinutes?: number;
  basePeriod?: string; // Canonical Mon–Thu row period key for weekly timetable alignment
}

export const UNIVERSITY_SLOTS: UniversitySlotMeta[] = [
  {
    slotNumber: 1,
    session: 'Morning',
    period: '9:00 – 9:50 AM',
    startTime: '9:00 AM',
    lectureEndTime: '9:50 AM',
    cycleEndTime: '10:00 AM',
    shortBreak: '9:50 – 10:00 AM',
    startMinutes: 540,
    lectureEndMinutes: 590,
    cycleEndMinutes: 600
  },
  {
    slotNumber: 2,
    session: 'Morning',
    period: '10:00 – 10:50 AM',
    startTime: '10:00 AM',
    lectureEndTime: '10:50 AM',
    cycleEndTime: '11:00 AM',
    shortBreak: '10:50 – 11:00 AM',
    startMinutes: 600,
    lectureEndMinutes: 650,
    cycleEndMinutes: 660
  },
  {
    slotNumber: 3,
    session: 'Morning',
    period: '11:00 – 11:50 AM',
    startTime: '11:00 AM',
    lectureEndTime: '11:50 AM',
    cycleEndTime: '12:00 PM',
    shortBreak: '11:50 AM – 12:00 PM',
    startMinutes: 660,
    lectureEndMinutes: 710,
    cycleEndMinutes: 720
  },
  {
    slotNumber: 4,
    session: 'Morning',
    period: '12:00 – 12:50 PM',
    startTime: '12:00 PM',
    lectureEndTime: '12:50 PM',
    cycleEndTime: '1:00 PM',
    shortBreak: '12:50 – 1:00 PM',
    startMinutes: 720,
    lectureEndMinutes: 770,
    cycleEndMinutes: 780
  },
  {
    slotNumber: 5,
    session: 'Afternoon',
    period: '2:00 – 2:50 PM',
    startTime: '2:00 PM',
    lectureEndTime: '2:50 PM',
    cycleEndTime: '3:00 PM',
    shortBreak: '2:50 – 3:00 PM',
    startMinutes: 840,
    lectureEndMinutes: 890,
    cycleEndMinutes: 900
  },
  {
    slotNumber: 6,
    session: 'Afternoon',
    period: '3:00 – 3:50 PM',
    startTime: '3:00 PM',
    lectureEndTime: '3:50 PM',
    cycleEndTime: '4:00 PM',
    shortBreak: '3:50 – 4:00 PM',
    startMinutes: 900,
    lectureEndMinutes: 950,
    cycleEndMinutes: 960
  },
  {
    slotNumber: 7,
    session: 'Afternoon',
    period: '4:00 – 4:50 PM',
    startTime: '4:00 PM',
    lectureEndTime: '4:50 PM',
    cycleEndTime: '5:00 PM',
    shortBreak: '4:50 – 5:00 PM',
    startMinutes: 960,
    lectureEndMinutes: 1010,
    cycleEndMinutes: 1020
  }
];

export const UNIVERSITY_PERIODS: string[] = UNIVERSITY_SLOTS.map(s => s.period);

export interface ContinuousLabBlockMeta {
  startPeriod: string;
  coveredPeriods: string[];
  continuousLabel: string;
  startTime: string;
  endTime: string;
  session: 'Morning' | 'Afternoon';
  spanSlots?: number;
  durationMinutes?: number;
}

export const VALID_CONTINUOUS_LAB_BLOCKS: ContinuousLabBlockMeta[] = [
  {
    startPeriod: '9:00 – 9:50 AM',
    coveredPeriods: ['9:00 – 9:50 AM', '10:00 – 10:50 AM', '11:00 – 11:50 AM'],
    continuousLabel: '9:00 AM – 12:00 PM',
    startTime: '9:00 AM',
    endTime: '12:00 PM',
    session: 'Morning',
    spanSlots: 3,
    durationMinutes: 180
  },
  {
    startPeriod: '10:00 – 10:50 AM',
    coveredPeriods: ['10:00 – 10:50 AM', '11:00 – 11:50 AM', '12:00 – 12:50 PM'],
    continuousLabel: '10:00 AM – 1:00 PM',
    startTime: '10:00 AM',
    endTime: '1:00 PM',
    session: 'Morning',
    spanSlots: 3,
    durationMinutes: 180
  },
  {
    startPeriod: '2:00 – 2:50 PM',
    coveredPeriods: ['2:00 – 2:50 PM', '3:00 – 3:50 PM', '4:00 – 4:50 PM'],
    continuousLabel: '2:00 PM – 5:00 PM',
    startTime: '2:00 PM',
    endTime: '5:00 PM',
    session: 'Afternoon',
    spanSlots: 3,
    durationMinutes: 180
  }
];

export interface InstructorUnavailableSlot {
  day: DayOfWeek;
  timeSlot: string; // e.g. '09:00 - 10:30'
  reason?: string;
}

export type StaffRole = 'faculty' | 'lab_engineer';

export interface Instructor extends BaseEntity {
  id: string;
  departmentId: string;
  subDepartment?: string; // Internal division/track inside their department
  staffRole?: StaffRole; // 'faculty' for lectures (1cr=1hr), 'lab_engineer' for 3hr labs (1cr=3hr)
  staffCode?: string;
  isActive?: boolean;
  qualifiedCourseIds?: string[]; // Courses this instructor/lab engineer is qualified to teach/supervise
  name: string;
  email: string;
  title: string;
  maxWeeklyHours: number;
  maxConsecutiveHours: number;
  preferredDays: DayOfWeek[];
  unavailableSlots: InstructorUnavailableSlot[];
}

export interface StudentGroup extends BaseEntity {
  id: string;
  programId: string;
  departmentId?: string;
  termId?: string;
  batchCode?: string;
  name: string;
  code: string; // e.g. '2K24-BEE-A' or '2K25-BSCS-A'
  year: number; // 1, 2, 3, 4
  semester?: number; // 1 to 8
  section?: string; // 'A', 'B', 'C', 'D', 'E'
  departmentCode?: string;
  academicYear?: number;
  homeRoom?: string; // e.g. 'CR-18-IAEC'
  size: number;
  sharedCourseIds: string[];
}

export interface TimeBlockBreak {
  id: string;
  name: string; // e.g. 'Lunch break', 'Friday Prayer'
  startTime: string; // HH:mm
  endTime: string;
  days: DayOfWeek[];
}

export type FridayMode = 'standard' | 'jummah_break' | 'morning_only';
export type FridayCompressionScope = 'none' | 'before_jummah' | 'after_jummah' | 'all_day';

export interface TimeStructure extends BaseEntity {
  id: string;
  name: string;
  workingDays: DayOfWeek[];
  periodLengthMinutes: number; // Duration of 1 regular lecture in minutes (default: 50)
  dayStartTime: string; // HH:mm e.g. '09:00'
  dayEndTime: string;   // HH:mm e.g. '17:00'
  periods: string[];    // Array of formatted period strings
  breaks: TimeBlockBreak[];
  // Admin-configurable Academic Timing & Break settings
  shortBreakEnabled?: boolean; // default: true
  shortBreakMinutes?: number;  // default: 10
  includeBreakAfterLastSlot?: boolean; // default: false
  middayBreakEnabled?: boolean; // default: true
  middayBreakMode?: 'fixed' | 'auto'; // default: 'fixed'
  middayBreakStartTime?: string; // HH:mm default: '13:00'
  middayBreakDurationMinutes?: number; // default: 60
  labDurationMinutes?: number; // default: 180 (3 hours continuous)
  fridayAfternoonShiftEnabled?: boolean; // legacy compatibility flag
  fridayAfternoonStartTime?: string; // legacy compatibility ('14:30')
  // Enhanced Friday / Jummah Prayer Policy
  fridayEnabled?: boolean; // Explicit toggle to enable/disable Friday classes
  fridayStartTime?: string; // Custom Friday start time (defaults to dayStartTime)
  fridayEndTime?: string;   // Custom Friday closing time (defaults to dayEndTime)
  fridayAllowedBatches?: string[]; // Optional batch codes/IDs permitted on Friday (empty = all)
  fridayAllowedDepartments?: string[]; // Optional department codes/IDs permitted on Friday (empty = all)
  labSplitAllowed?: boolean; // Default false: labs are continuous 3h blocks unless split allowed
  fridayMode?: FridayMode; // 'standard' | 'jummah_break' | 'morning_only'
  fridayBreakStartTime?: string; // HH:mm default: '13:00' (when Jummah prayer break starts)
  fridayBreakEndTime?: string;   // HH:mm default: '14:30' (when Friday afternoon resumes)
  fridayClosingTime?: string;    // HH:mm default: '13:00' (used when fridayMode === 'morning_only')
  fridayCompressionScope?: FridayCompressionScope; // 'none' | 'before_jummah' | 'after_jummah' | 'all_day'
  fridayPeriodLengthMinutes?: number; // reduced Friday lecture length in minutes (e.g., 45)
  fridayShortBreakMinutes?: number;   // optional reduced Friday inter-class break (e.g., 5)
}

export const DEFAULT_ACADEMIC_TIMING_CONFIG: Required<
  Pick<
    TimeStructure,
    | 'workingDays'
    | 'dayStartTime'
    | 'dayEndTime'
    | 'periodLengthMinutes'
    | 'shortBreakEnabled'
    | 'shortBreakMinutes'
    | 'includeBreakAfterLastSlot'
    | 'middayBreakEnabled'
    | 'middayBreakMode'
    | 'middayBreakStartTime'
    | 'middayBreakDurationMinutes'
    | 'labDurationMinutes'
    | 'labSplitAllowed'
    | 'fridayEnabled'
    | 'fridayStartTime'
    | 'fridayEndTime'
    | 'fridayAllowedBatches'
    | 'fridayAllowedDepartments'
    | 'fridayAfternoonShiftEnabled'
    | 'fridayAfternoonStartTime'
    | 'fridayMode'
    | 'fridayBreakStartTime'
    | 'fridayBreakEndTime'
    | 'fridayClosingTime'
    | 'fridayCompressionScope'
    | 'fridayPeriodLengthMinutes'
    | 'fridayShortBreakMinutes'
  >
> = {
  workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  dayStartTime: '09:00',
  dayEndTime: '17:00',
  periodLengthMinutes: 50,
  shortBreakEnabled: true,
  shortBreakMinutes: 10,
  includeBreakAfterLastSlot: false,
  middayBreakEnabled: true,
  middayBreakMode: 'fixed',
  middayBreakStartTime: '13:00',
  middayBreakDurationMinutes: 60,
  labDurationMinutes: 180,
  labSplitAllowed: false,
  fridayEnabled: true,
  fridayStartTime: '09:00',
  fridayEndTime: '17:00',
  fridayAllowedBatches: [],
  fridayAllowedDepartments: [],
  fridayAfternoonShiftEnabled: true,
  fridayAfternoonStartTime: '14:30',
  fridayMode: 'jummah_break',
  fridayBreakStartTime: '13:00',
  fridayBreakEndTime: '14:30',
  fridayClosingTime: '13:00',
  fridayCompressionScope: 'after_jummah',
  fridayPeriodLengthMinutes: 45,
  fridayShortBreakMinutes: 5
};

export function isUserAdminRole(role?: string): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return r.includes('registrar') || r.includes('admin') || r.includes('director') || r.includes('dean');
}

export function parseTime24ToMinutes(hhmm: string, fallbackMinutes = 540): number {
  if (!hhmm || typeof hhmm !== 'string') return fallbackMinutes;
  const parts = hhmm.trim().split(':');
  if (parts.length < 2) return fallbackMinutes;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return fallbackMinutes;
  return h * 60 + m;
}

export function minutesToTime24(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatMinutes12(totalMinutes: number, includeSuffix = true): string {
  const clamped = Math.max(0, Math.round(totalMinutes));
  const h24 = Math.floor(clamped / 60) % 24;
  const m = clamped % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const timePart = `${h12}:${String(m).padStart(2, '0')}`;
  return includeSuffix ? `${timePart} ${suffix}` : timePart;
}

export function formatRange12(startMins: number, endMins: number, alwaysShowStartSuffix = false): string {
  const startH24 = Math.floor(Math.max(0, Math.round(startMins)) / 60) % 24;
  const endH24 = Math.floor(Math.max(0, Math.round(endMins)) / 60) % 24;
  const startSuffix = startH24 >= 12 ? 'PM' : 'AM';
  const endSuffix = endH24 >= 12 ? 'PM' : 'AM';

  if (alwaysShowStartSuffix || startSuffix !== endSuffix) {
    return `${formatMinutes12(startMins, true)} – ${formatMinutes12(endMins, true)}`;
  }
  return `${formatMinutes12(startMins, false)} – ${formatMinutes12(endMins, true)}`;
}

export interface ComputedMiddayBreak {
  enabled: boolean;
  mode: 'fixed' | 'auto';
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  startTime24: string;
  endTime24: string;
  timeRangeLabel: string; // e.g. '1:00 – 2:00 PM'
  fullRangeLabel: string; // e.g. '1:00 PM – 2:00 PM'
}

export interface ComputedFridaySchedule {
  mode: FridayMode;
  isFridayWorkingDay: boolean;
  operatingHoursLabel: string;
  closingTime24: string;
  jummahBreak: {
    enabled: boolean;
    startMinutes: number;
    endMinutes: number;
    durationMinutes: number;
    startTime24: string;
    endTime24: string;
    timeRangeLabel: string; // e.g. '1:00 – 2:30 PM'
    fullRangeLabel: string; // e.g. '1:00 PM – 2:30 PM'
  };
  compressionScope: FridayCompressionScope;
  fridayPeriodLengthMinutes: number;
  fridayShortBreakMinutes: number;
  morningPeriodLengthMinutes: number;
  morningShortBreakMinutes: number;
  afternoonPeriodLengthMinutes: number;
  afternoonShortBreakMinutes: number;
  slots: UniversitySlotMeta[];
  slotByBasePeriod: Record<string, UniversitySlotMeta>;
  validBasePeriods: string[];
  continuousLabBlocks: ContinuousLabBlockMeta[];
  firstAfternoonSlotNumber: number | null;
  summaryText: string;
}

export interface ComputedAcademicScheduleConfig {
  dayStartTime: string;
  dayEndTime: string;
  operatingHoursLabel: string; // e.g. '9:00 AM – 5:00 PM'
  workingDays: DayOfWeek[];
  periodLengthMinutes: number;
  shortBreakEnabled: boolean;
  shortBreakMinutes: number;
  includeBreakAfterLastSlot: boolean;
  middayBreak: ComputedMiddayBreak;
  labDurationMinutes: number;
  labDurationHoursLabel: string; // e.g. '3h' or '2h' or '150m'
  labSpanSlots: number;
  fridayAfternoonShiftEnabled: boolean;
  fridayAfternoonStartTime: string;
  fridaySchedule: ComputedFridaySchedule;
  slots: UniversitySlotMeta[];
  periods: string[];
  continuousLabBlocks: ContinuousLabBlockMeta[];
  firstAfternoonSlotNumber: number | null;
  summaryText: string;
}

function buildSessionSlotsList(params: {
  sessionStart: number;
  sessionEnd: number;
  sessionName: 'Morning' | 'Afternoon';
  periodMins: number;
  shortBreakMins: number;
  shortBreakEnabled: boolean;
  includeBreakAfterLastSlot: boolean;
  startingSlotNumber: number;
}): UniversitySlotMeta[] {
  const {
    sessionStart,
    sessionEnd,
    sessionName,
    periodMins,
    shortBreakMins,
    shortBreakEnabled,
    includeBreakAfterLastSlot,
    startingSlotNumber
  } = params;
  const out: UniversitySlotMeta[] = [];
  const safePeriod = Math.max(15, periodMins);
  const safeBreak = shortBreakEnabled ? Math.max(0, shortBreakMins) : 0;
  const cycleMins = safePeriod + safeBreak;
  if (cycleMins <= 0) return out;

  let cur = sessionStart;
  let counter = startingSlotNumber;
  while (cur + safePeriod <= sessionEnd) {
    const lecEnd = cur + safePeriod;
    const nextStart = cur + cycleMins;
    const hasAnotherSlotInSession = nextStart + safePeriod <= sessionEnd;
    const hasShortBreakHere =
      shortBreakEnabled &&
      safeBreak > 0 &&
      (hasAnotherSlotInSession || includeBreakAfterLastSlot || lecEnd + safeBreak <= sessionEnd);

    const breakEnd = hasShortBreakHere ? Math.min(sessionEnd, lecEnd + safeBreak) : lecEnd;
    const shortBreakLabel =
      hasShortBreakHere && breakEnd > lecEnd
        ? formatRange12(lecEnd, breakEnd, false)
        : shortBreakEnabled && safeBreak > 0
        ? 'End of Session'
        : 'No Break';

    out.push({
      slotNumber: counter++,
      session: sessionName,
      period: formatRange12(cur, lecEnd, false),
      startTime: formatMinutes12(cur, true),
      lectureEndTime: formatMinutes12(lecEnd, true),
      cycleEndTime: formatMinutes12(breakEnd, true),
      shortBreak: shortBreakLabel,
      startMinutes: cur,
      lectureEndMinutes: lecEnd,
      cycleEndMinutes: breakEnd
    });
    cur = nextStart;
  }
  return out;
}

export function computeAcademicScheduleConfig(
  timeStructure?: Partial<TimeStructure> | null
): ComputedAcademicScheduleConfig {
  const cfg = {
    ...DEFAULT_ACADEMIC_TIMING_CONFIG,
    ...(timeStructure || {})
  };

  const dayStartMins = parseTime24ToMinutes(cfg.dayStartTime, 540);
  const dayEndMins = parseTime24ToMinutes(cfg.dayEndTime, 1020);
  const periodLengthMinutes = Math.max(15, Math.round(Number(cfg.periodLengthMinutes) || 50));
  const shortBreakEnabled = cfg.shortBreakEnabled !== false;
  const shortBreakMinutes = shortBreakEnabled
    ? Math.max(0, Math.round(Number(cfg.shortBreakMinutes ?? 10)))
    : 0;
  const includeBreakAfterLastSlot = Boolean(cfg.includeBreakAfterLastSlot);
  const cycleMinutes = periodLengthMinutes + shortBreakMinutes;

  const middayBreakEnabled = cfg.middayBreakEnabled !== false;
  const middayBreakMode: 'fixed' | 'auto' = cfg.middayBreakMode === 'auto' ? 'auto' : 'fixed';
  const middayDuration = middayBreakEnabled
    ? Math.max(15, Math.round(Number(cfg.middayBreakDurationMinutes) || 60))
    : 0;

  let middayStartMins = parseTime24ToMinutes(cfg.middayBreakStartTime || '13:00', 780);
  if (middayBreakEnabled && middayBreakMode === 'auto') {
    const midPoint = dayStartMins + (dayEndMins - dayStartMins - middayDuration) / 2;
    const morningSlotCount = Math.max(1, Math.round((midPoint - dayStartMins) / Math.max(1, cycleMinutes)));
    middayStartMins = dayStartMins + morningSlotCount * cycleMinutes;
    if (!shortBreakEnabled && includeBreakAfterLastSlot === false) {
      middayStartMins = dayStartMins + morningSlotCount * periodLengthMinutes;
    }
    middayStartMins = Math.max(
      dayStartMins + periodLengthMinutes,
      Math.min(dayEndMins - middayDuration - periodLengthMinutes, middayStartMins)
    );
  }

  const middayEndMins = middayStartMins + middayDuration;

  const slots: UniversitySlotMeta[] = [];
  if (middayBreakEnabled && middayStartMins > dayStartMins && middayEndMins < dayEndMins) {
    const morningList = buildSessionSlotsList({
      sessionStart: dayStartMins,
      sessionEnd: middayStartMins,
      sessionName: 'Morning',
      periodMins: periodLengthMinutes,
      shortBreakMins: shortBreakMinutes,
      shortBreakEnabled,
      includeBreakAfterLastSlot,
      startingSlotNumber: 1
    });
    const afternoonList = buildSessionSlotsList({
      sessionStart: middayEndMins,
      sessionEnd: dayEndMins,
      sessionName: 'Afternoon',
      periodMins: periodLengthMinutes,
      shortBreakMins: shortBreakMinutes,
      shortBreakEnabled,
      includeBreakAfterLastSlot,
      startingSlotNumber: morningList.length + 1
    });
    slots.push(...morningList, ...afternoonList);
  } else {
    let cur = dayStartMins;
    let slotCounter = 1;
    while (cur + periodLengthMinutes <= dayEndMins) {
      const lecEnd = cur + periodLengthMinutes;
      const nextStart = cur + cycleMinutes;
      const hasAnotherSlot = nextStart + periodLengthMinutes <= dayEndMins;
      const hasShortBreakHere =
        shortBreakEnabled &&
        shortBreakMinutes > 0 &&
        (hasAnotherSlot || includeBreakAfterLastSlot || lecEnd + shortBreakMinutes <= dayEndMins);
      const breakEnd = hasShortBreakHere ? Math.min(dayEndMins, lecEnd + shortBreakMinutes) : lecEnd;
      const shortBreakLabel =
        hasShortBreakHere && breakEnd > lecEnd
          ? formatRange12(lecEnd, breakEnd, false)
          : shortBreakEnabled && shortBreakMinutes > 0
          ? 'End of Day'
          : 'No Break';

      slots.push({
        slotNumber: slotCounter++,
        session: cur < 780 ? 'Morning' : 'Afternoon',
        period: formatRange12(cur, lecEnd, false),
        startTime: formatMinutes12(cur, true),
        lectureEndTime: formatMinutes12(lecEnd, true),
        cycleEndTime: formatMinutes12(breakEnd, true),
        shortBreak: shortBreakLabel,
        startMinutes: cur,
        lectureEndMinutes: lecEnd,
        cycleEndMinutes: breakEnd
      });
      cur = nextStart;
      if (cycleMinutes <= 0) break;
    }
  }

  const labDurationMinutes = Math.max(
    periodLengthMinutes,
    Math.round(Number(cfg.labDurationMinutes) || 180)
  );

  const rawSpanSlots = Math.max(
    1,
    Math.ceil((labDurationMinutes - periodLengthMinutes) / Math.max(1, cycleMinutes)) + 1
  );

  const continuousLabBlocks: ContinuousLabBlockMeta[] = [];

  (['Morning', 'Afternoon'] as const).forEach(sessionName => {
    const sessionSlots = slots.filter(s => s.session === sessionName);
    const sessionEndLimit =
      sessionName === 'Morning' && middayBreakEnabled ? middayStartMins : dayEndMins;

    for (let i = 0; i < sessionSlots.length; i++) {
      const startSlot = sessionSlots[i];
      const startMins = startSlot.startMinutes ?? dayStartMins;
      const targetEndMins = startMins + labDurationMinutes;

      if (i + rawSpanSlots <= sessionSlots.length) {
        const coveredSlice = sessionSlots.slice(i, i + rawSpanSlots);
        const lastCoveredSlot = coveredSlice[coveredSlice.length - 1];
        const lastLectureEnd = lastCoveredSlot.lectureEndMinutes ?? targetEndMins;

        if (lastLectureEnd <= sessionEndLimit && targetEndMins <= sessionEndLimit + shortBreakMinutes) {
          const displayEndMins = Math.min(sessionEndLimit, Math.max(lastLectureEnd, targetEndMins));
          continuousLabBlocks.push({
            startPeriod: startSlot.period,
            coveredPeriods: coveredSlice.map(s => s.period),
            continuousLabel: formatRange12(startMins, displayEndMins, true),
            startTime: formatMinutes12(startMins, true),
            endTime: formatMinutes12(displayEndMins, true),
            session: sessionName,
            spanSlots: coveredSlice.length,
            durationMinutes: labDurationMinutes
          });
        }
      }
    }
  });

  if (continuousLabBlocks.length === 0 && slots.length > 0) {
    const fallbackSpan = Math.min(rawSpanSlots, slots.length);
    const coveredSlice = slots.slice(0, fallbackSpan);
    const first = coveredSlice[0];
    const last = coveredSlice[coveredSlice.length - 1];
    continuousLabBlocks.push({
      startPeriod: first.period,
      coveredPeriods: coveredSlice.map(s => s.period),
      continuousLabel: `${first.startTime} – ${last.cycleEndTime}`,
      startTime: first.startTime,
      endTime: last.cycleEndTime,
      session: first.session,
      spanSlots: coveredSlice.length,
      durationMinutes: labDurationMinutes
    });
  }

  const labSpanSlots = continuousLabBlocks[0]?.spanSlots || rawSpanSlots;
  const labHoursFormatted =
    labDurationMinutes % 60 === 0
      ? `${labDurationMinutes / 60}h`
      : `${(labDurationMinutes / 60).toFixed(1)}h`;

  const firstAfternoonSlot = middayBreakEnabled
    ? slots.find(s => s.session === 'Afternoon')
    : undefined;

  const middayBreakObj: ComputedMiddayBreak = {
    enabled: middayBreakEnabled,
    mode: middayBreakMode,
    startMinutes: middayStartMins,
    endMinutes: middayEndMins,
    durationMinutes: middayDuration,
    startTime24: minutesToTime24(middayStartMins),
    endTime24: minutesToTime24(middayEndMins),
    timeRangeLabel: formatRange12(middayStartMins, middayEndMins, false),
    fullRangeLabel: formatRange12(middayStartMins, middayEndMins, true)
  };

  // =========================================================
  // FRIDAY / JUMMAH PRAYER SCHEDULE ENGINE
  // =========================================================
  const rawWorkingDays =
    cfg.workingDays && cfg.workingDays.length > 0
      ? cfg.workingDays
      : DEFAULT_ACADEMIC_TIMING_CONFIG.workingDays;
  const fridayEnabledFlag =
    timeStructure?.fridayEnabled !== undefined
      ? Boolean(timeStructure.fridayEnabled) && rawWorkingDays.includes('Fri')
      : rawWorkingDays.includes('Fri');
  const resolvedWorkingDays = orderWorkingDaysFridayRightmost(rawWorkingDays, fridayEnabledFlag);
  const isFridayWorkingDay = fridayEnabledFlag && resolvedWorkingDays.includes('Fri');

  const inferredFridayMode: FridayMode =
    timeStructure?.fridayMode ||
    (timeStructure?.fridayAfternoonShiftEnabled === false ? 'standard' : 'jummah_break');

  const rawCompressionScope: FridayCompressionScope =
    inferredFridayMode === 'standard'
      ? 'none'
      : cfg.fridayCompressionScope || 'after_jummah';

  const fridayPeriodMins = Math.max(
    15,
    Math.min(periodLengthMinutes, Math.round(Number(cfg.fridayPeriodLengthMinutes) || 45))
  );
  const fridayShortBreakMins = shortBreakEnabled
    ? Math.max(0, Math.round(Number(cfg.fridayShortBreakMinutes ?? Math.min(shortBreakMinutes, 5))))
    : 0;

  const compressMorning =
    rawCompressionScope === 'before_jummah' || rawCompressionScope === 'all_day';
  const compressAfternoon =
    rawCompressionScope === 'after_jummah' || rawCompressionScope === 'all_day';

  const morningFriPeriod = compressMorning ? fridayPeriodMins : periodLengthMinutes;
  const morningFriBreak = compressMorning ? fridayShortBreakMins : shortBreakMinutes;
  const afternoonFriPeriod = compressAfternoon ? fridayPeriodMins : periodLengthMinutes;
  const afternoonFriBreak = compressAfternoon ? fridayShortBreakMins : shortBreakMinutes;

  const fridayStartMins = parseTime24ToMinutes(
    timeStructure?.fridayStartTime || cfg.dayStartTime || '09:00',
    dayStartMins
  );
  const fridayBaseEndMins = parseTime24ToMinutes(
    timeStructure?.fridayEndTime || cfg.dayEndTime || '17:00',
    dayEndMins
  );

  const rawJummahStart = parseTime24ToMinutes(
    timeStructure?.fridayBreakStartTime || cfg.middayBreakStartTime || '13:00',
    middayStartMins
  );
  const rawJummahEnd = parseTime24ToMinutes(
    timeStructure?.fridayBreakEndTime || timeStructure?.fridayAfternoonStartTime || '14:30',
    870
  );
  const rawFridayClosing = parseTime24ToMinutes(
    timeStructure?.fridayClosingTime || timeStructure?.fridayEndTime || timeStructure?.fridayBreakStartTime || '13:00',
    780
  );

  let fridaySlots: UniversitySlotMeta[] = [];
  const fridaySlotByBasePeriod: Record<string, UniversitySlotMeta> = {};
  const fridayContinuousLabBlocks: ContinuousLabBlockMeta[] = [];
  let jummahEnabled = false;
  let jummahStartMins = middayStartMins;
  let jummahEndMins = middayEndMins;
  let fridayEndEffectiveMins = fridayBaseEndMins;

  const morningBaseSlots = slots.filter(s => s.session === 'Morning');
  const afternoonBaseSlots = slots.filter(s => s.session === 'Afternoon');

  if (!isFridayWorkingDay) {
    jummahEnabled = false;
    fridayEndEffectiveMins = fridayStartMins;
  } else if (inferredFridayMode === 'standard') {
    jummahEnabled = middayBreakEnabled;
    jummahStartMins = middayStartMins;
    jummahEndMins = middayEndMins;
    if (fridayStartMins === dayStartMins && fridayBaseEndMins === dayEndMins) {
      fridaySlots = slots.map(s => {
        const mapped = { ...s, basePeriod: s.period };
        fridaySlotByBasePeriod[s.period] = mapped;
        return mapped;
      });
      continuousLabBlocks.forEach(b => fridayContinuousLabBlocks.push({ ...b }));
    } else {
      const friMorning = buildSessionSlotsList({
        sessionStart: fridayStartMins,
        sessionEnd: middayBreakEnabled ? Math.min(middayStartMins, fridayBaseEndMins) : fridayBaseEndMins,
        sessionName: 'Morning',
        periodMins: periodLengthMinutes,
        shortBreakMins: shortBreakMinutes,
        shortBreakEnabled,
        includeBreakAfterLastSlot,
        startingSlotNumber: 1
      });
      const friAfternoon = middayBreakEnabled && middayEndMins < fridayBaseEndMins
        ? buildSessionSlotsList({
            sessionStart: middayEndMins,
            sessionEnd: fridayBaseEndMins,
            sessionName: 'Afternoon',
            periodMins: periodLengthMinutes,
            shortBreakMins: shortBreakMinutes,
            shortBreakEnabled,
            includeBreakAfterLastSlot,
            startingSlotNumber: friMorning.length + 1
          })
        : [];
      friMorning.forEach((s, idx) => {
        const base = morningBaseSlots[idx];
        const mapped = { ...s, basePeriod: base?.period || s.period };
        fridaySlots.push(mapped);
        if (mapped.basePeriod) fridaySlotByBasePeriod[mapped.basePeriod] = mapped;
      });
      friAfternoon.forEach((s, idx) => {
        const base = afternoonBaseSlots[idx];
        const mapped = { ...s, basePeriod: base?.period || s.period };
        fridaySlots.push(mapped);
        if (mapped.basePeriod) fridaySlotByBasePeriod[mapped.basePeriod] = mapped;
      });
    }
  } else if (inferredFridayMode === 'morning_only') {
    jummahEnabled = true;
    fridayEndEffectiveMins = Math.max(
      fridayStartMins + morningFriPeriod,
      Math.min(fridayBaseEndMins, rawFridayClosing)
    );
    jummahStartMins = fridayEndEffectiveMins;
    jummahEndMins = fridayEndEffectiveMins;

    const friMorning = buildSessionSlotsList({
      sessionStart: fridayStartMins,
      sessionEnd: fridayEndEffectiveMins,
      sessionName: 'Morning',
      periodMins: morningFriPeriod,
      shortBreakMins: morningFriBreak,
      shortBreakEnabled,
      includeBreakAfterLastSlot,
      startingSlotNumber: 1
    });

    friMorning.forEach((s, idx) => {
      const base = morningBaseSlots[idx];
      const mapped: UniversitySlotMeta = { ...s, basePeriod: base?.period };
      fridaySlots.push(mapped);
      if (base) {
        fridaySlotByBasePeriod[base.period] = mapped;
      }
    });

    const mappedMorning = fridaySlots.filter(s => Boolean(s.basePeriod));
    const friMorningSpan = rawSpanSlots;
    for (let i = 0; i + friMorningSpan <= mappedMorning.length; i++) {
      const slice = mappedMorning.slice(i, i + friMorningSpan);
      const first = slice[0];
      const last = slice[slice.length - 1];
      const startM = first.startMinutes ?? fridayStartMins;
      const lastLecEnd = last.lectureEndMinutes ?? fridayEndEffectiveMins;
      const targetEnd = startM + labDurationMinutes;

      if (compressMorning) {
        if (lastLecEnd <= fridayEndEffectiveMins) {
          fridayContinuousLabBlocks.push({
            startPeriod: first.basePeriod!,
            coveredPeriods: slice.map(x => x.basePeriod!),
            continuousLabel: formatRange12(startM, lastLecEnd, true),
            startTime: formatMinutes12(startM, true),
            endTime: formatMinutes12(lastLecEnd, true),
            session: 'Morning',
            spanSlots: slice.length,
            durationMinutes: lastLecEnd - startM
          });
        }
      } else if (lastLecEnd <= fridayEndEffectiveMins && targetEnd <= fridayEndEffectiveMins + morningFriBreak) {
        const displayEnd = Math.min(fridayEndEffectiveMins, Math.max(lastLecEnd, targetEnd));
        fridayContinuousLabBlocks.push({
          startPeriod: first.basePeriod!,
          coveredPeriods: slice.map(x => x.basePeriod!),
          continuousLabel: formatRange12(startM, displayEnd, true),
          startTime: formatMinutes12(startM, true),
          endTime: formatMinutes12(displayEnd, true),
          session: 'Morning',
          spanSlots: slice.length,
          durationMinutes: labDurationMinutes
        });
      }
    }
  } else {
    // 'jummah_break'
    jummahEnabled = true;
    jummahStartMins = Math.max(fridayStartMins + morningFriPeriod, Math.min(fridayBaseEndMins - afternoonFriPeriod, rawJummahStart));
    jummahEndMins = Math.max(jummahStartMins + 15, Math.min(fridayBaseEndMins, rawJummahEnd));

    const friMorning = buildSessionSlotsList({
      sessionStart: fridayStartMins,
      sessionEnd: jummahStartMins,
      sessionName: 'Morning',
      periodMins: morningFriPeriod,
      shortBreakMins: morningFriBreak,
      shortBreakEnabled,
      includeBreakAfterLastSlot,
      startingSlotNumber: 1
    });

    const friAfternoon = buildSessionSlotsList({
      sessionStart: jummahEndMins,
      sessionEnd: fridayBaseEndMins,
      sessionName: 'Afternoon',
      periodMins: afternoonFriPeriod,
      shortBreakMins: afternoonFriBreak,
      shortBreakEnabled,
      includeBreakAfterLastSlot,
      startingSlotNumber: friMorning.length + 1
    });

    friMorning.forEach((s, idx) => {
      const base = morningBaseSlots[idx];
      const mapped: UniversitySlotMeta = { ...s, basePeriod: base?.period };
      fridaySlots.push(mapped);
      if (base) {
        fridaySlotByBasePeriod[base.period] = mapped;
      }
    });

    friAfternoon.forEach((s, idx) => {
      const base = afternoonBaseSlots[idx];
      const mapped: UniversitySlotMeta = { ...s, basePeriod: base?.period };
      fridaySlots.push(mapped);
      if (base) {
        fridaySlotByBasePeriod[base.period] = mapped;
      }
    });

    (['Morning', 'Afternoon'] as const).forEach(sessionName => {
      const isCompressed = sessionName === 'Morning' ? compressMorning : compressAfternoon;
      const sBreak = sessionName === 'Morning' ? morningFriBreak : afternoonFriBreak;
      const sessionEndLimit = sessionName === 'Morning' ? jummahStartMins : fridayBaseEndMins;
      const sessionMapped = fridaySlots.filter(s => s.session === sessionName && Boolean(s.basePeriod));

      for (let i = 0; i + rawSpanSlots <= sessionMapped.length; i++) {
        const slice = sessionMapped.slice(i, i + rawSpanSlots);
        const first = slice[0];
        const last = slice[slice.length - 1];
        const startM = first.startMinutes ?? fridayStartMins;
        const lastLecEnd = last.lectureEndMinutes ?? sessionEndLimit;
        const targetEnd = startM + labDurationMinutes;

        if (isCompressed) {
          if (lastLecEnd <= sessionEndLimit) {
            fridayContinuousLabBlocks.push({
              startPeriod: first.basePeriod!,
              coveredPeriods: slice.map(x => x.basePeriod!),
              continuousLabel: formatRange12(startM, lastLecEnd, true),
              startTime: formatMinutes12(startM, true),
              endTime: formatMinutes12(lastLecEnd, true),
              session: sessionName,
              spanSlots: slice.length,
              durationMinutes: lastLecEnd - startM
            });
          }
        } else if (lastLecEnd <= sessionEndLimit && targetEnd <= sessionEndLimit + sBreak) {
          const displayEnd = Math.min(sessionEndLimit, Math.max(lastLecEnd, targetEnd));
          fridayContinuousLabBlocks.push({
            startPeriod: first.basePeriod!,
            coveredPeriods: slice.map(x => x.basePeriod!),
            continuousLabel: formatRange12(startM, displayEnd, true),
            startTime: formatMinutes12(startM, true),
            endTime: formatMinutes12(displayEnd, true),
            session: sessionName,
            spanSlots: slice.length,
            durationMinutes: labDurationMinutes
          });
        }
      }
    });
  }

  const operatingHoursLabel = formatRange12(dayStartMins, dayEndMins, true);
  const firstFriAfternoon = fridaySlots.find(s => s.session === 'Afternoon');
  const friHoursLabel = !isFridayWorkingDay
    ? 'Friday Disabled (No Classes)'
    : formatRange12(
        fridayStartMins,
        inferredFridayMode === 'morning_only' ? fridayEndEffectiveMins : fridayBaseEndMins,
        true
      );

  const fridaySummaryParts: string[] = [];
  if (!isFridayWorkingDay) {
    fridaySummaryParts.push('Friday Disabled (0 Sessions)');
  } else if (inferredFridayMode === 'standard') {
    fridaySummaryParts.push(`Friday Active (${friHoursLabel})`);
  } else if (inferredFridayMode === 'morning_only') {
    fridaySummaryParts.push(`Morning Only (${friHoursLabel} · Closed for Jummah)`);
  } else {
    fridaySummaryParts.push(`Jummah Break ${formatRange12(jummahStartMins, jummahEndMins, false)}`);
  }
  if (isFridayWorkingDay && rawCompressionScope !== 'none') {
    const scopeLabel =
      rawCompressionScope === 'before_jummah'
        ? 'Before Jummah'
        : rawCompressionScope === 'after_jummah'
        ? 'After Jummah'
        : 'All Friday';
    fridaySummaryParts.push(`${fridayPeriodMins}m slots (${scopeLabel})`);
  }

  const fridaySchedule: ComputedFridaySchedule = {
    mode: inferredFridayMode,
    isFridayWorkingDay,
    operatingHoursLabel: friHoursLabel,
    closingTime24: minutesToTime24(
      inferredFridayMode === 'morning_only' ? fridayEndEffectiveMins : fridayBaseEndMins
    ),
    jummahBreak: {
      enabled: jummahEnabled,
      startMinutes: jummahStartMins,
      endMinutes: jummahEndMins,
      durationMinutes: Math.max(0, jummahEndMins - jummahStartMins),
      startTime24: minutesToTime24(jummahStartMins),
      endTime24: minutesToTime24(jummahEndMins),
      timeRangeLabel: formatRange12(jummahStartMins, jummahEndMins, false),
      fullRangeLabel: formatRange12(jummahStartMins, jummahEndMins, true)
    },
    compressionScope: rawCompressionScope,
    fridayPeriodLengthMinutes: fridayPeriodMins,
    fridayShortBreakMinutes: fridayShortBreakMins,
    morningPeriodLengthMinutes: morningFriPeriod,
    morningShortBreakMinutes: morningFriBreak,
    afternoonPeriodLengthMinutes: afternoonFriPeriod,
    afternoonShortBreakMinutes: afternoonFriBreak,
    slots: fridaySlots,
    slotByBasePeriod: fridaySlotByBasePeriod,
    validBasePeriods: Object.keys(fridaySlotByBasePeriod),
    continuousLabBlocks: fridayContinuousLabBlocks,
    firstAfternoonSlotNumber: firstFriAfternoon ? firstFriAfternoon.slotNumber : null,
    summaryText: fridaySummaryParts.join(' · ')
  };

  const breakPart =
    shortBreakEnabled && shortBreakMinutes > 0
      ? `+ ${shortBreakMinutes}m Break`
      : 'Back-to-Back (0m Break)';
  const lunchPart = middayBreakEnabled
    ? `Lunch ${middayBreakObj.timeRangeLabel}`
    : 'No Midday Break';

  return {
    dayStartTime: minutesToTime24(dayStartMins),
    dayEndTime: minutesToTime24(dayEndMins),
    operatingHoursLabel,
    workingDays: resolvedWorkingDays,
    periodLengthMinutes,
    shortBreakEnabled,
    shortBreakMinutes,
    includeBreakAfterLastSlot,
    middayBreak: middayBreakObj,
    labDurationMinutes,
    labDurationHoursLabel: labHoursFormatted,
    labSpanSlots,
    fridayAfternoonShiftEnabled: inferredFridayMode !== 'standard',
    fridayAfternoonStartTime:
      inferredFridayMode === 'jummah_break'
        ? minutesToTime24(jummahEndMins)
        : cfg.fridayAfternoonStartTime || '14:30',
    fridaySchedule,
    slots,
    periods: slots.map(s => s.period),
    continuousLabBlocks,
    firstAfternoonSlotNumber: firstAfternoonSlot ? firstAfternoonSlot.slotNumber : null,
    summaryText: `${operatingHoursLabel} · ${periodLengthMinutes}m Lectures (${breakPart}) · ${labHoursFormatted} Continuous Labs · ${lunchPart}`
  };
}

export interface TimingValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateAcademicTimingConfig(
  input: Partial<TimeStructure>
): TimingValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const workingDays = input.workingDays || DEFAULT_ACADEMIC_TIMING_CONFIG.workingDays;
  if (!workingDays || workingDays.length === 0) {
    errors.push('Select at least one academic working day.');
  }

  const startMins = parseTime24ToMinutes(input.dayStartTime || '09:00', -1);
  const endMins = parseTime24ToMinutes(input.dayEndTime || '17:00', -1);

  if (startMins < 0 || endMins < 0) {
    errors.push('Enter valid university opening and closing times (HH:MM).');
  } else if (endMins <= startMins) {
    errors.push('University closing time must be later than the opening time.');
  }

  const classMins = Number(input.periodLengthMinutes);
  if (!Number.isFinite(classMins) || classMins <= 0) {
    errors.push('Regular class duration must be greater than 0 minutes.');
  } else if (classMins < 20) {
    errors.push('Regular class duration must be at least 20 minutes.');
  } else if (classMins > 240) {
    errors.push('Regular class duration cannot exceed 240 minutes.');
  }

  const shortBreakEnabled = input.shortBreakEnabled !== false;
  const shortBreakMins = Number(input.shortBreakMinutes ?? 10);
  if (shortBreakEnabled) {
    if (!Number.isFinite(shortBreakMins) || shortBreakMins < 0) {
      errors.push('Break duration between classes cannot be negative.');
    } else if (shortBreakMins > 60) {
      errors.push('Short break between classes cannot exceed 60 minutes.');
    }
  }

  if (endMins > startMins && classMins > 0 && endMins - startMins < classMins) {
    errors.push('University operating hours are shorter than a single regular class duration.');
  }

  const middayEnabled = input.middayBreakEnabled !== false;
  const middayMode = input.middayBreakMode || 'fixed';
  const middayDuration = Number(input.middayBreakDurationMinutes ?? 60);
  const middayStart = parseTime24ToMinutes(input.middayBreakStartTime || '13:00', 780);

  if (middayEnabled) {
    if (!Number.isFinite(middayDuration) || middayDuration <= 0) {
      errors.push('Midday / lunch break duration must be greater than 0 minutes.');
    } else if (middayDuration > 180) {
      errors.push('Midday / lunch break duration cannot exceed 180 minutes.');
    }

    if (middayMode === 'fixed' && startMins >= 0 && endMins > startMins) {
      const middayEnd = middayStart + middayDuration;
      if (middayStart < startMins + classMins || middayEnd > endMins - classMins) {
        errors.push(
          'Midday break must fall within university operating hours with enough time for at least one class before and after.'
        );
      }
    }
  }

  // Validate Friday / Jummah configuration if Friday is a working day
  const fridayActive = input.fridayEnabled !== false && workingDays.includes('Fri');
  const fridayMode: FridayMode =
    input.fridayMode ||
    (input.fridayAfternoonShiftEnabled === false ? 'standard' : 'jummah_break');

  const friStartMins = parseTime24ToMinutes(input.fridayStartTime || input.dayStartTime || '09:00', startMins);
  const friEndMins = parseTime24ToMinutes(input.fridayEndTime || input.dayEndTime || '17:00', endMins);

  if (fridayActive && (friStartMins < 0 || friEndMins < 0 || friEndMins <= friStartMins)) {
    errors.push('Friday end time must be later than Friday start time.');
  }

  if (fridayActive && fridayMode !== 'standard' && friStartMins >= 0 && friEndMins > friStartMins) {
    const compressionScope = input.fridayCompressionScope || 'after_jummah';
    const friClassMins = Number(input.fridayPeriodLengthMinutes ?? 45);

    if (compressionScope !== 'none') {
      if (!Number.isFinite(friClassMins) || friClassMins < 20) {
        errors.push('Reduced Friday class duration must be at least 20 minutes.');
      } else if (friClassMins > classMins) {
        errors.push('Reduced Friday class duration cannot exceed the regular Mon–Thu class duration.');
      }
    }

    const effMorningLen =
      compressionScope === 'before_jummah' || compressionScope === 'all_day'
        ? friClassMins
        : classMins;
    const effAfternoonLen =
      compressionScope === 'after_jummah' || compressionScope === 'all_day'
        ? friClassMins
        : classMins;

    if (fridayMode === 'jummah_break') {
      const jStart = parseTime24ToMinutes(input.fridayBreakStartTime || '13:00', -1);
      const jEnd = parseTime24ToMinutes(
        input.fridayBreakEndTime || input.fridayAfternoonStartTime || '14:30',
        -1
      );
      if (jStart < 0 || jEnd < 0) {
        errors.push('Enter valid Jummah break start and end times.');
      } else if (jEnd <= jStart) {
        errors.push('Friday Jummah resume time must be later than Jummah break start time.');
      } else if (jStart < friStartMins + effMorningLen) {
        errors.push('Jummah break start leaves no room for morning Friday classes.');
      } else if (jEnd + effAfternoonLen > friEndMins) {
        errors.push('Friday afternoon resume time leaves no room for any afternoon class before Friday closing.');
      }
    } else if (fridayMode === 'morning_only') {
      const friClose = parseTime24ToMinutes(
        input.fridayClosingTime || input.fridayEndTime || input.fridayBreakStartTime || '13:00',
        -1
      );
      if (friClose < 0) {
        errors.push('Enter a valid Friday early closing time.');
      } else if (friClose < friStartMins + effMorningLen) {
        errors.push('Friday closing time must allow at least one morning session.');
      } else if (friClose > friEndMins) {
        errors.push('Friday early closing time cannot exceed configured Friday end time.');
      }
    }
  }

  const labMins = Number(input.labDurationMinutes ?? 180);
  if (!Number.isFinite(labMins) || labMins <= 0) {
    errors.push('Laboratory duration must be greater than 0 minutes.');
  } else if (labMins < classMins) {
    errors.push('Laboratory duration must be at least as long as one regular class duration.');
  } else if (startMins >= 0 && endMins > startMins) {
    const computed = computeAcademicScheduleConfig(input);
    const morningWindow = middayEnabled
      ? computed.middayBreak.startMinutes - startMins
      : endMins - startMins;
    const afternoonWindow = middayEnabled
      ? endMins - computed.middayBreak.endMinutes
      : endMins - startMins;
    const maxUninterruptedWindow = Math.max(morningWindow, afternoonWindow);

    if (labMins > maxUninterruptedWindow) {
      errors.push(
        `Laboratory duration (${labMins} mins) exceeds the longest uninterrupted session window (${maxUninterruptedWindow} mins). Reduce lab duration, adjust the midday break, or extend university operating hours.`
      );
    } else if (computed.continuousLabBlocks.length === 0) {
      errors.push(
        'Laboratory duration does not fit into any uninterrupted session window without crossing the midday break or closing time.'
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function getLabBlockByStartPeriod(
  period: string,
  timeStructure?: Partial<TimeStructure> | null,
  day?: string
): ContinuousLabBlockMeta | undefined {
  if (timeStructure) {
    const computed = computeAcademicScheduleConfig(timeStructure);
    if (day === 'Fri') {
      const friMatch = computed.fridaySchedule.continuousLabBlocks.find(
        b => b.startPeriod === period
      );
      if (friMatch) return friMatch;
    }
    const dynamicMatch = computed.continuousLabBlocks.find(b => b.startPeriod === period);
    if (dynamicMatch) return dynamicMatch;
  }
  return VALID_CONTINUOUS_LAB_BLOCKS.find(b => b.startPeriod === period);
}

export function getCoveredPeriodsForAssignment(
  timeSlot: string,
  spanSlots = 1,
  timeStructure?: Partial<TimeStructure> | null,
  day?: string
): string[] {
  if (spanSlots <= 1) return [timeSlot];
  const labBlock = getLabBlockByStartPeriod(timeSlot, timeStructure, day);
  if (labBlock) return [...labBlock.coveredPeriods];
  const activePeriods = timeStructure
    ? computeAcademicScheduleConfig(timeStructure).periods
    : UNIVERSITY_PERIODS;
  const idx = activePeriods.indexOf(timeSlot);
  if (idx === -1) return [timeSlot];
  return activePeriods.slice(idx, idx + spanSlots);
}

export interface EffectiveDaySlotInfo {
  isOpen: boolean;
  isFridaySpecial: boolean;
  period: string;
  shortBreak: string;
  durationMinutes: number;
  slot?: UniversitySlotMeta;
  closedReason?: string;
}

export function getEffectiveSlotDisplayForDay(
  day: string,
  basePeriod: string,
  computed: ComputedAcademicScheduleConfig
): EffectiveDaySlotInfo {
  if (day !== 'Fri') {
    const baseSlot = computed.slots.find(s => s.period === basePeriod);
    return {
      isOpen: Boolean(baseSlot),
      isFridaySpecial: false,
      period: baseSlot?.period || basePeriod,
      shortBreak: baseSlot?.shortBreak || 'No Break',
      durationMinutes: computed.periodLengthMinutes,
      slot: baseSlot
    };
  }

  const fri = computed.fridaySchedule;
  if (fri.mode === 'standard') {
    const baseSlot = computed.slots.find(s => s.period === basePeriod);
    return {
      isOpen: Boolean(baseSlot),
      isFridaySpecial: false,
      period: baseSlot?.period || basePeriod,
      shortBreak: baseSlot?.shortBreak || 'No Break',
      durationMinutes: computed.periodLengthMinutes,
      slot: baseSlot
    };
  }

  const matched = fri.slotByBasePeriod[basePeriod];
  if (matched) {
    const isAfternoon = matched.session === 'Afternoon';
    const dur = isAfternoon ? fri.afternoonPeriodLengthMinutes : fri.morningPeriodLengthMinutes;
    return {
      isOpen: true,
      isFridaySpecial: matched.period !== basePeriod || dur !== computed.periodLengthMinutes,
      period: matched.period,
      shortBreak: matched.shortBreak,
      durationMinutes: dur,
      slot: matched
    };
  }

  return {
    isOpen: false,
    isFridaySpecial: true,
    period: basePeriod,
    shortBreak: 'Closed',
    durationMinutes: 0,
    closedReason:
      fri.mode === 'morning_only'
        ? `Closed (${fri.operatingHoursLabel})`
        : `Jummah / Timing Adjustment`
  };
}


export interface ConstraintRule extends BaseEntity {
  id: string;
  code: string;
  name: string;
  description: string;
  kind: ConstraintKind;
  enabled: boolean;
  weight: number; // 0-100 (for soft constraints)
  category: 'instructor' | 'room' | 'student' | 'facility' | 'temporal';
}

export interface TimetableScenarioMetrics {
  clashCount: number;
  satisfactionScore: number; // e.g. 99.88
  roomUtilizationPercent: number;
  instructorSatisfaction: number;
  studentTransitScore: number;
}

export interface TimetableScenario extends BaseEntity {
  id: string;
  termId: string;
  name: string;
  version: string;
  status: ScenarioStatus;
  createdAt: string;
  updatedAt: string;
  author: string;
  metrics: TimetableScenarioMetrics;
  assignments: Record<string, SectionSlotAssignment>; // sectionId -> assignment
  timetableEntries?: Array<Record<string, unknown>>;
}

export interface AuditLogEntry extends BaseEntity {
  id: string;
  timestamp: string; // ISO string
  userId: string;
  userName: string;
  action: AuditAction;
  entityType: 'term' | 'campus' | 'building' | 'room' | 'department' | 'program' | 'course' | 'section' | 'instructor' | 'group' | 'time' | 'constraint' | 'scenario' | 'assignment';
  entityId: string;
  summary: string;
  previousValue?: string;
  newValue?: string;
}

export interface SetupReadinessItem {
  id: string;
  category: string;
  title: string;
  description: string;
  isComplete: boolean;
  count: number;
  requiredCount?: number;
  severity: 'error' | 'warning' | 'info';
  actionRoute?: string;
}

export interface AssignmentIssueDTO {
  code: string;
  field: string;
  message: string;
}

export interface AssignmentTimetableImpactDTO {
  hasPublishedImpact: boolean;
  hasDraftImpact: boolean;
  hasLockedSlot: boolean;
  affectedEntriesCount: number;
  affectedVersions: Array<{
    versionId: string;
    name: string;
    status: string;
  }>;
}

export interface AssignmentValidationResultDTO {
  valid: boolean;
  staffReady: boolean;
  status: 'unassigned' | 'partial' | 'assigned' | 'invalid';
  errors: AssignmentIssueDTO[];
  warnings: AssignmentIssueDTO[];
  missingFields: string[];
  timetableImpact: AssignmentTimetableImpactDTO;
}

export interface AssignmentOfferingDTO {
  id: string;
  primarySessionId: string;
  lectureSessionId: string | null;
  labSessionId: string | null;
  termId: string;
  termName: string;
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  cohortCode: string;
  programId: string;
  programCode: string;
  programName: string;
  batchId: string;
  batchCode: string;
  sectionCode: string;
  sectionLabel: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  courseType: CourseType;
  creditHours: number;
  lectureCredits: number;
  labCredits: number;
  lectureHours: number;
  labHours: number;
  totalWeeklyHours: number;
  expectedStudents: number;
  requiredEquipment: string[];
  requiresLecture: boolean;
  requiresLab: boolean;
  instructorId: string | null;
  instructorName: string;
  instructorCode: string;
  labEngineerId: string | null;
  labEngineerName: string;
  labEngineerCode: string;
  assignedLabId: string | null;
  assignedLabCode: string;
  assignedLabName: string;
  assignmentStatus: 'unassigned' | 'partial' | 'assigned' | 'invalid';
  staffReady: boolean;
  valid: boolean;
  validationErrors: AssignmentIssueDTO[];
  validationWarnings: AssignmentIssueDTO[];
  missingFields: string[];
  timetableImpact: AssignmentTimetableImpactDTO;
  isLocked: boolean;
  assignedBy?: string | null;
  assignedAt?: string | null;
}

export interface StaffWorkloadDTO {
  id: string;
  name: string;
  email: string;
  staffCode: string;
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  designation: string;
  staffRole: StaffRole;
  isActive: boolean;
  qualifiedCourseIds: string[];
  specializations: string[];
  maxWeeklyHours: number;
  maxDailyClasses: number;
  currentLectureHours: number;
  currentLabHours: number;
  currentWeeklyHours: number;
  remainingCapacityHours: number;
  utilizationPct: number;
  assignedCoursesCount: number;
  assignedSections: string[];
  assignedCourses: string[];
  assignedOfferings: Array<{
    offeringId: string;
    courseId: string;
    courseCode: string;
    courseTitle: string;
    sectionLabel: string;
    role: string;
    hours: number;
  }>;
  unavailableSlots: Array<{ day: string; startTime: string; endTime: string }>;
  committedPublishedSlots: Array<{ day: string; startTime: string; endTime: string; courseCode: string; sectionCode: string }>;
}

export interface AssignmentLaboratoryDTO {
  id: string;
  code: string;
  name: string;
  building: string;
  departmentId: string;
  departmentCode: string;
  capacity: number;
  labCategory: string;
  equipment: string[];
  isAvailable: boolean;
  isAccessible: boolean;
  assignedLabEngineerId: string | null;
  assignedCoursesCount: number;
}

export interface AssignmentWorkspaceSummaryDTO {
  totalOfferings: number;
  completeCount: number;
  generationReadyCount: number;
  missingInstructorCount: number;
  missingLabEngineerCount: number;
  missingLaboratoryCount: number;
  invalidCount: number;
  partialCount: number;
  unassignedCount: number;
  labOfferingsCount: number;
  unsyncedOfferingsCount: number;
}

export interface AssignmentWorkspaceResponseDTO {
  universityId: string;
  offerings: AssignmentOfferingDTO[];
  summary: AssignmentWorkspaceSummaryDTO;
  staffDirectory: StaffWorkloadDTO[];
  laboratories: AssignmentLaboratoryDTO[];
  hierarchy: {
    terms: Array<{ id: string; code: string; name: string }>;
    departments: Array<{ id: string; code: string; name: string }>;
    cohorts: string[];
    programs: Array<{ id: string; code: string; name: string; departmentId: string }>;
    sections: Array<{
      id: string;
      code: string;
      name: string;
      sectionCode: string;
      departmentId: string;
      cohortCode: string;
      programId: string;
      studentCount: number;
    }>;
  };
}

export interface BulkPreviewRowDTO {
  offeringId: string;
  courseCode: string;
  courseTitle: string;
  sectionLabel: string;
  previousInstructorName: string;
  nextInstructorName: string;
  previousLabEngineerName: string;
  nextLabEngineerName: string;
  previousLabName: string;
  nextLabName: string;
  changedFields: string[];
  overwriteFields: string[];
  skippedReasons: string[];
  valid: boolean;
  errors: AssignmentIssueDTO[];
  warnings: AssignmentIssueDTO[];
  timetableImpact: AssignmentTimetableImpactDTO;
}

export interface BulkPreviewResponseDTO {
  universityId: string;
  missingIds: string[];
  previewRows: BulkPreviewRowDTO[];
  applicableCount: number;
  overwriteCount: number;
  invalidCount: number;
  publishedImpactCount: number;
  staffWorkloadAfterBulk: Record<string, StaffWorkloadDTO>;
}

export interface CopySectionPreviewItemDTO {
  offeringId: string;
  courseCode: string;
  sectionLabel: string;
  changedFields: string[];
  overwriteFields: string[];
  valid: boolean;
  errors: AssignmentIssueDTO[];
  timetableImpact: AssignmentTimetableImpactDTO;
}

export interface CopySectionResponseDTO {
  previewOnly?: boolean;
  matchedOfferings?: number;
  willApplyCount?: number;
  overwriteCount?: number;
  invalidCount?: number;
  publishedImpactCount?: number;
  items?: CopySectionPreviewItemDTO[];
  message?: string;
  copiedCount?: number;
}

