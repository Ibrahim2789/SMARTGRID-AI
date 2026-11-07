export type TermStatus = 'draft' | 'active' | 'archived';
export type RoomType = 'lecture' | 'lab' | 'seminar' | 'studio';
export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';
export type DegreeLevel = 'Undergraduate' | 'Graduate' | 'Postgraduate';
export type ConstraintKind = 'hard' | 'soft';
export type ScenarioStatus = 'draft' | 'published' | 'archived';
export type AuditAction = 'create' | 'update' | 'delete' | 'generate' | 'publish' | 'restore';

export interface AcademicTerm {
  id: string;
  name: string;
  code: string;
  startDate: string; // ISO YYYY-MM-DD
  endDate: string;
  status: TermStatus;
  weeksCount: number;
}

export interface Campus {
  id: string;
  name: string;
  code: string;
  address: string;
}

export interface Building {
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

export interface Room {
  id: string;
  buildingId: string;
  code: string;
  name: string;
  capacity: number;
  type: RoomType;
  equipment: string[]; // e.g. ['Projector', 'Fume Hood', 'Workstations', 'Sound System']
  isAccessible: boolean;
  isAvailable: boolean;
  availabilityWindows?: RoomAvailabilityWindow[];
}

export interface Department {
  id: string;
  name: string;
  code: string;
  school: string;
  colorHex: string;
}

export interface Program {
  id: string;
  departmentId: string;
  name: string;
  code: string;
  degreeLevel: DegreeLevel;
  totalSemesters: number;
}

export interface Course {
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
  timeSlot: string; // e.g. '09:00 - 10:30'
  roomId: string;
}

export interface Section {
  id: string;
  courseId: string;
  termId: string;
  sectionNumber: string; // e.g. '01', '02'
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

export interface Instructor {
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

export interface StudentGroup {
  id: string;
  programId: string;
  name: string;
  code: string; // e.g. 'CS-Year2'
  year: number; // 1, 2, 3, 4
  size: number;
  sharedCourseIds: string[];
}

export interface TimeBlockBreak {
  id: string;
  name: string; // e.g. 'Mid-day Lunch', 'Friday Prayer'
  startTime: string; // HH:mm
  endTime: string;
  days: DayOfWeek[];
}

export interface TimeStructure {
  id: string;
  name: string;
  workingDays: DayOfWeek[];
  periodLengthMinutes: number;
  dayStartTime: string; // HH:mm e.g. '08:30'
  dayEndTime: string;   // HH:mm e.g. '17:30'
  periods: string[];    // Array of formatted period strings: ['09:00 - 10:30', '11:00 - 12:30', ...]
  breaks: TimeBlockBreak[];
}

export interface ConstraintRule {
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

export interface TimetableScenario {
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

export interface AuditLogEntry {
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
