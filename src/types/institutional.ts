export type TermStatus = 'draft' | 'active' | 'archived';
export type RoomType = 'lecture' | 'lab' | 'seminar' | 'studio';
export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
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
  fridayAfternoonShiftEnabled?: boolean; // default: true
  fridayAfternoonStartTime?: string; // default: '14:30'
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
    | 'fridayAfternoonShiftEnabled'
    | 'fridayAfternoonStartTime'
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
  fridayAfternoonShiftEnabled: true,
  fridayAfternoonStartTime: '14:30'
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
  slots: UniversitySlotMeta[];
  periods: string[];
  continuousLabBlocks: ContinuousLabBlockMeta[];
  firstAfternoonSlotNumber: number | null;
  summaryText: string;
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
    // Automatically place midday break after the morning slot closest to the midpoint of operating hours
    const midPoint = dayStartMins + (dayEndMins - dayStartMins - middayDuration) / 2;
    const morningSlotCount = Math.max(1, Math.round((midPoint - dayStartMins) / Math.max(1, cycleMinutes)));
    middayStartMins = dayStartMins + morningSlotCount * cycleMinutes;
    if (!shortBreakEnabled && includeBreakAfterLastSlot === false) {
      middayStartMins = dayStartMins + morningSlotCount * periodLengthMinutes;
    }
    // Clamp within operating hours
    middayStartMins = Math.max(
      dayStartMins + periodLengthMinutes,
      Math.min(dayEndMins - middayDuration - periodLengthMinutes, middayStartMins)
    );
  }

  const middayEndMins = middayStartMins + middayDuration;

  const slots: UniversitySlotMeta[] = [];
  let slotCounter = 1;

  const generateSessionSlots = (
    sessionStart: number,
    sessionEnd: number,
    sessionName: 'Morning' | 'Afternoon'
  ) => {
    let cur = sessionStart;
    while (cur + periodLengthMinutes <= sessionEnd) {
      const lecEnd = cur + periodLengthMinutes;
      const nextStart = cur + cycleMinutes;
      const hasAnotherSlotInSession = nextStart + periodLengthMinutes <= sessionEnd;
      const hasShortBreakHere =
        shortBreakEnabled &&
        shortBreakMinutes > 0 &&
        (hasAnotherSlotInSession || includeBreakAfterLastSlot || lecEnd + shortBreakMinutes <= sessionEnd);

      const breakEnd = hasShortBreakHere ? Math.min(sessionEnd, lecEnd + shortBreakMinutes) : lecEnd;
      const shortBreakLabel =
        hasShortBreakHere && breakEnd > lecEnd
          ? formatRange12(lecEnd, breakEnd, false)
          : shortBreakEnabled && shortBreakMinutes > 0
          ? 'End of Session'
          : 'No Break';

      slots.push({
        slotNumber: slotCounter++,
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
      if (cycleMinutes <= 0) break;
    }
  };

  if (middayBreakEnabled && middayStartMins > dayStartMins && middayEndMins < dayEndMins) {
    generateSessionSlots(dayStartMins, middayStartMins, 'Morning');
    generateSessionSlots(middayEndMins, dayEndMins, 'Afternoon');
  } else {
    // No midday break: classify slots before 1:00 PM as Morning and after 1:00 PM as Afternoon
    let cur = dayStartMins;
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

  // Calculate how many consecutive slots a continuous lab spans
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

      // Ensure the continuous lab fits within this session without crossing the midday break or closing time
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

  // Fallback if labDurationMinutes is longer than a sub-session but slots exist in the session
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

  const operatingHoursLabel = formatRange12(dayStartMins, dayEndMins, true);
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
    workingDays:
      cfg.workingDays && cfg.workingDays.length > 0
        ? cfg.workingDays
        : DEFAULT_ACADEMIC_TIMING_CONFIG.workingDays,
    periodLengthMinutes,
    shortBreakEnabled,
    shortBreakMinutes,
    includeBreakAfterLastSlot,
    middayBreak: middayBreakObj,
    labDurationMinutes,
    labDurationHoursLabel: labHoursFormatted,
    labSpanSlots,
    fridayAfternoonShiftEnabled: cfg.fridayAfternoonShiftEnabled !== false,
    fridayAfternoonStartTime: cfg.fridayAfternoonStartTime || '14:30',
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
  let middayStart = parseTime24ToMinutes(input.middayBreakStartTime || '13:00', 780);

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
  timeStructure?: Partial<TimeStructure> | null
): ContinuousLabBlockMeta | undefined {
  if (timeStructure) {
    const computed = computeAcademicScheduleConfig(timeStructure);
    const dynamicMatch = computed.continuousLabBlocks.find(b => b.startPeriod === period);
    if (dynamicMatch) return dynamicMatch;
  }
  return VALID_CONTINUOUS_LAB_BLOCKS.find(b => b.startPeriod === period);
}

export function getCoveredPeriodsForAssignment(
  timeSlot: string,
  spanSlots = 1,
  timeStructure?: Partial<TimeStructure> | null
): string[] {
  if (spanSlots <= 1) return [timeSlot];
  const labBlock = getLabBlockByStartPeriod(timeSlot, timeStructure);
  if (labBlock) return [...labBlock.coveredPeriods];
  const activePeriods = timeStructure
    ? computeAcademicScheduleConfig(timeStructure).periods
    : UNIVERSITY_PERIODS;
  const idx = activePeriods.indexOf(timeSlot);
  if (idx === -1) return [timeSlot];
  return activePeriods.slice(idx, idx + spanSlots);
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
