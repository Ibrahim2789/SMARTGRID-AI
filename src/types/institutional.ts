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

export interface SectionSlotAssignment {
  day: DayOfWeek;
  timeSlot: string; // e.g. '09:00 - 10:30' or '09:00 - 10:00'
  roomId: string;
  durationMinutes?: number;
}

export interface Section extends BaseEntity {
  id: string;
  courseId: string;
  termId: string;
  sectionNumber: string; // e.g. '01', 'A', 'B'
  expectedEnrollment: number;
  instructorId: string;
  studentGroupId: string;
  assignedSlot?: SectionSlotAssignment;
  isLocked?: boolean;
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
  code: string; // e.g. 'BSCS-3A' or 'BSCS Sem 3 - A'
  year: number; // 1, 2, 3, 4
  semester?: number; // 1 to 8
  section?: string; // 'A', 'B', 'C'
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
