import { ClassItem } from '../components/ClassDetailsModal';
import { InstitutionalDataStore } from './store';
import {
  UNIVERSITY_PERIODS,
  computeAcademicScheduleConfig,
  getLabBlockByStartPeriod,
  getCoveredPeriodsForAssignment
} from '../types/institutional';

export function getDepartmentBlockClass(code: string): string {
  const upper = code.toUpperCase();
  if (upper.startsWith('CS') || upper.startsWith('MATH')) return 'dept-block-plum';
  if (upper.startsWith('BIO') || upper.startsWith('CHEM')) return 'dept-block-emerald';
  if (upper.startsWith('ENG') || upper.startsWith('MECH')) return 'dept-block-terracotta';
  if (upper.startsWith('ARCH')) return 'dept-block-amber';
  return 'dept-block-rose';
}

export function getDepartmentAccent(code: string): 'plum' | 'emerald' | 'terracotta' {
  const upper = code.toUpperCase();
  if (upper.startsWith('BIO') || upper.startsWith('CHEM')) return 'emerald';
  if (upper.startsWith('ENG') || upper.startsWith('MECH') || upper.startsWith('HUM')) return 'terracotta';
  return 'plum';
}

export function buildMatrixSchedule(store: InstitutionalDataStore): {
  scheduleData: Record<string, Record<string, ClassItem[]>>;
  conflicts: Array<{ id: string; description: string; day: string; time: string }>;
} {
  const scheduleData: Record<string, Record<string, ClassItem[]>> = {};
  const computedTiming = computeAcademicScheduleConfig(store.timeStructure);
  const periods =
    computedTiming.periods.length > 0
      ? computedTiming.periods
      : store.timeStructure.periods.length > 0
      ? store.timeStructure.periods
      : UNIVERSITY_PERIODS;
  const allWeekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const days = Array.from(new Set([...(store.timeStructure.workingDays || []), ...allWeekDays]));

  periods.forEach(period => {
    scheduleData[period] = {};
    days.forEach(day => {
      scheduleData[period][day] = [];
    });
  });

  const conflicts: Array<{ id: string; description: string; day: string; time: string }> = [];

  // Track room and instructor occupancy across all covered slots (including continuous labs)
  const occupiedRoomByDaySlot = new Map<string, { secId: string; code: string; roomCode: string }>();
  const occupiedProfByDaySlot = new Map<string, { secId: string; code: string; profName: string }>();

  store.sections.forEach(sec => {
    if (!sec.assignedSlot) return;

    const { day, timeSlot, roomId } = sec.assignedSlot;
    if (!scheduleData[timeSlot]) {
      scheduleData[timeSlot] = {};
      days.forEach(d => {
        scheduleData[timeSlot][d] = [];
      });
    }
    if (!scheduleData[timeSlot][day]) {
      scheduleData[timeSlot][day] = [];
    }

    const course = store.courses.find(c => c.id === sec.courseId);
    const room = store.rooms.find(r => r.id === roomId);
    const instructor = store.instructors.find(i => i.id === sec.instructorId);
    const group = store.studentGroups.find(g => g.id === sec.studentGroupId);
    const dept = store.departments.find(d => d.id === course?.departmentId);

    const code = course?.code || 'CRS-101';
    const title = course?.title || 'Academic Seminar';
    const roomCode = room?.code || 'Hall A1';
    const profName = instructor?.name || 'Staff Faculty';
    const cohortCode = group?.code || 'All-STEM';

    const isLab =
      sec.sessionType === 'Lab' ||
      (sec.spanSlots && sec.spanSlots > 1) ||
      sec.assignedSlot.sessionType === 'Lab' ||
      (sec.assignedSlot.spanSlots && sec.assignedSlot.spanSlots > 1) ||
      sec.sectionNumber.toLowerCase().includes('lab');

    const labBlockMeta = isLab ? getLabBlockByStartPeriod(timeSlot, store.timeStructure) : undefined;
    const spanSlots = isLab
      ? (sec.assignedSlot.spanSlots || labBlockMeta?.spanSlots || computedTiming.labSpanSlots || 3)
      : 1;
    const sessionType: 'Lecture' | 'Lab' = isLab ? 'Lab' : 'Lecture';
    const continuousTimeLabel = isLab
      ? (sec.assignedSlot.continuousTimeLabel || labBlockMeta?.continuousLabel || computedTiming.continuousLabBlocks[0]?.continuousLabel || timeSlot)
      : undefined;

    const coveredPeriods = getCoveredPeriodsForAssignment(timeSlot, spanSlots, store.timeStructure);
    let hasConflict = false;

    coveredPeriods.forEach(covPeriod => {
      const slotKey = `${day}__${covPeriod}`;
      const existingRoom = occupiedRoomByDaySlot.get(`${slotKey}__${roomCode}`);
      if (existingRoom && existingRoom.secId !== sec.id) {
        hasConflict = true;
        conflicts.push({
          id: `conflict-room-${sec.id}-${existingRoom.secId}-${covPeriod}`,
          description: `Room ${roomCode} double-booked: ${code} and ${existingRoom.code}`,
          day,
          time: covPeriod
        });
      } else {
        occupiedRoomByDaySlot.set(`${slotKey}__${roomCode}`, { secId: sec.id, code, roomCode });
      }

      const existingProf = occupiedProfByDaySlot.get(`${slotKey}__${profName}`);
      if (existingProf && existingProf.secId !== sec.id) {
        hasConflict = true;
        conflicts.push({
          id: `conflict-prof-${sec.id}-${existingProf.secId}-${covPeriod}`,
          description: `Instructor ${profName} scheduled twice at ${day} ${covPeriod}`,
          day,
          time: covPeriod
        });
      } else {
        occupiedProfByDaySlot.set(`${slotKey}__${profName}`, { secId: sec.id, code, profName });
      }
    });

    const capacity = room?.capacity || 40;
    const enrolled = sec.expectedEnrollment || group?.size || 30;

    const classItem: ClassItem = {
      id: sec.id,
      code,
      title,
      room: roomCode,
      roomId: room?.id,
      prof: profName,
      instructorId: instructor?.id,
      cohort: cohortCode,
      studentGroupId: group?.id,
      departmentId: dept?.id,
      departmentName: dept?.name || 'General Sciences',
      sectionNumber: sec.sectionNumber,
      capacity,
      enrolled,
      time: timeSlot,
      day,
      type: isLab ? 'Lab' : 'Lecture',
      sessionType,
      spanSlots,
      durationMinutes: isLab
        ? (sec.assignedSlot.durationMinutes || computedTiming.labDurationMinutes || 180)
        : (sec.assignedSlot.durationMinutes || computedTiming.periodLengthMinutes || 50),
      continuousTimeLabel,
      credits: course?.creditHours || 3,
      accent: getDepartmentAccent(code),
      isLocked: sec.isLocked,
      constraintStatus: hasConflict ? 'Soft Penalty Resolved' : 'Optimal'
    };

    scheduleData[timeSlot][day].push(classItem);
  });

  return { scheduleData, conflicts };
}

