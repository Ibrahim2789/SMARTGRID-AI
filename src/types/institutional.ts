export type TermStatus = 'draft' | 'active' | 'archived';
export type RoomType = 'lecture' | 'lab' | 'seminar' | 'studio';
export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';
export type DegreeLevel = 'Undergraduate' | 'Graduate' | 'Postgraduate';
export type ConstraintKind = 'hard' | 'soft';
export type ScenarioStatus = 'draft' | 'published' | 'archived';
export type AuditAction = 'create' | 'update' | 'delete' | 'generate' | 'publish' | 'restore';

export interface BaseEntity {
  is_sample?: boolean;
  isSample?: boolean;
}

export interface AcademicTerm extends BaseEntity {
  id: string;
  name: string;
  code: string;
  startDate: string; // ISO YYYY-MM-DD
  endDate: string;
  status: TermStatus;
  weeksCount: number;
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
  availabilityWindows?: RoomAvailabilityWindow[];
}

export interface Department extends BaseEntity {
  id: string;
  name: string;
  code: string;
  school: string;
  colorHex: string;
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
  code: string;
  title: string;
  creditHours: number;
  weeklyContactHours: number;
  lectureHours: number;
  labHours: number;
  requiredRoomType: RoomType;
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
}

export interface Section extends BaseEntity {
  id: string;
  courseId: string;
  termId: string;
  sectionNumber: string; // e.g. '01', 'A', 'A-Lab'
  expectedEnrollment: number;
  instructorId: string;
  studentGroupId: string;
  sessionType?: SessionKind; // 'Lecture' | 'Lab'
  spanSlots?: number; // 1 for Lecture, 3 for Lab
  assignedSlot?: SectionSlotAssignment;
  isLocked?: boolean;
}

export interface UniversitySlotMeta {
  slotNumber: number; // 1..7
  session: 'Morning' | 'Afternoon';
  period: string; // e.g. '9:00 – 9:50 AM'
  startTime: string; // e.g. '9:00 AM'
  lectureEndTime: string; // e.g. '9:50 AM'
  cycleEndTime: string; // e.g. '10:00 AM'
  shortBreak: string; // e.g. '9:50 – 10:00 AM'
}

export const UNIVERSITY_SLOTS: UniversitySlotMeta[] = [
  {
    slotNumber: 1,
    session: 'Morning',
    period: '9:00 – 9:50 AM',
    startTime: '9:00 AM',
    lectureEndTime: '9:50 AM',
    cycleEndTime: '10:00 AM',
    shortBreak: '9:50 – 10:00 AM'
  },
  {
    slotNumber: 2,
    session: 'Morning',
    period: '10:00 – 10:50 AM',
    startTime: '10:00 AM',
    lectureEndTime: '10:50 AM',
    cycleEndTime: '11:00 AM',
    shortBreak: '10:50 – 11:00 AM'
  },
  {
    slotNumber: 3,
    session: 'Morning',
    period: '11:00 – 11:50 AM',
    startTime: '11:00 AM',
    lectureEndTime: '11:50 AM',
    cycleEndTime: '12:00 PM',
    shortBreak: '11:50 AM – 12:00 PM'
  },
  {
    slotNumber: 4,
    session: 'Morning',
    period: '12:00 – 12:50 PM',
    startTime: '12:00 PM',
    lectureEndTime: '12:50 PM',
    cycleEndTime: '1:00 PM',
    shortBreak: '12:50 – 1:00 PM'
  },
  {
    slotNumber: 5,
    session: 'Afternoon',
    period: '2:00 – 2:50 PM',
    startTime: '2:00 PM',
    lectureEndTime: '2:50 PM',
    cycleEndTime: '3:00 PM',
    shortBreak: '2:50 – 3:00 PM'
  },
  {
    slotNumber: 6,
    session: 'Afternoon',
    period: '3:00 – 3:50 PM',
    startTime: '3:00 PM',
    lectureEndTime: '3:50 PM',
    cycleEndTime: '4:00 PM',
    shortBreak: '3:50 – 4:00 PM'
  },
  {
    slotNumber: 7,
    session: 'Afternoon',
    period: '4:00 – 4:50 PM',
    startTime: '4:00 PM',
    lectureEndTime: '4:50 PM',
    cycleEndTime: '5:00 PM',
    shortBreak: '4:50 – 5:00 PM'
  }
];

export const UNIVERSITY_PERIODS: string[] = UNIVERSITY_SLOTS.map(s => s.period);

export interface ContinuousLabBlockMeta {
  startPeriod: string;
  coveredPeriods: [string, string, string];
  continuousLabel: string;
  startTime: string;
  endTime: string;
  session: 'Morning' | 'Afternoon';
}

export const VALID_CONTINUOUS_LAB_BLOCKS: ContinuousLabBlockMeta[] = [
  {
    startPeriod: '9:00 – 9:50 AM',
    coveredPeriods: ['9:00 – 9:50 AM', '10:00 – 10:50 AM', '11:00 – 11:50 AM'],
    continuousLabel: '9:00 AM – 12:00 PM',
    startTime: '9:00 AM',
    endTime: '12:00 PM',
    session: 'Morning'
  },
  {
    startPeriod: '10:00 – 10:50 AM',
    coveredPeriods: ['10:00 – 10:50 AM', '11:00 – 11:50 AM', '12:00 – 12:50 PM'],
    continuousLabel: '10:00 AM – 1:00 PM',
    startTime: '10:00 AM',
    endTime: '1:00 PM',
    session: 'Morning'
  },
  {
    startPeriod: '2:00 – 2:50 PM',
    coveredPeriods: ['2:00 – 2:50 PM', '3:00 – 3:50 PM', '4:00 – 4:50 PM'],
    continuousLabel: '2:00 PM – 5:00 PM',
    startTime: '2:00 PM',
    endTime: '5:00 PM',
    session: 'Afternoon'
  }
];

export function getLabBlockByStartPeriod(period: string): ContinuousLabBlockMeta | undefined {
  return VALID_CONTINUOUS_LAB_BLOCKS.find(b => b.startPeriod === period);
}

export function getCoveredPeriodsForAssignment(timeSlot: string, spanSlots = 1): string[] {
  if (spanSlots <= 1) return [timeSlot];
  const labBlock = getLabBlockByStartPeriod(timeSlot);
  if (labBlock) return [...labBlock.coveredPeriods];
  const idx = UNIVERSITY_PERIODS.indexOf(timeSlot);
  if (idx === -1) return [timeSlot];
  return UNIVERSITY_PERIODS.slice(idx, idx + spanSlots);
}

export interface InstructorUnavailableSlot {
  day: DayOfWeek;
  timeSlot: string; // e.g. '09:00 - 10:30'
  reason?: string;
}

export interface Instructor extends BaseEntity {
  id: string;
  departmentId: string;
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
  name: string;
  code: string; // e.g. '2K24-BEE-A' or '2K25-BSCS-A'
  year: number; // 1, 2, 3, 4
  semester?: number; // 1 to 8
  section?: string; // 'A', 'B', 'C', 'D', 'E'
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

export interface TimeStructure extends BaseEntity {
  id: string;
  name: string;
  workingDays: DayOfWeek[];
  periodLengthMinutes: number;
  dayStartTime: string; // HH:mm e.g. '09:00'
  dayEndTime: string;   // HH:mm e.g. '17:00'
  periods: string[];    // Array of formatted period strings
  breaks: TimeBlockBreak[];
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
}

export interface AuditLogEntry extends BaseEntity {
  id: string;
  timestamp: string; // ISO string
  userId: string;
  userName: string;
  action: AuditAction;
  entityType: 'term' | 'campus' | 'building' | 'room' | 'department' | 'program' | 'course' | 'section' | 'instructor' | 'group' | 'time' | 'constraint' | 'scenario';
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
