import { ClassItem } from '../components/ClassDetailsModal';
import { InstitutionalDataStore } from './store';
import {
  UNIVERSITY_PERIODS,
  computeAcademicScheduleConfig,
  getLabBlockByStartPeriod,
  getEffectiveSlotDisplayForDay,
  orderWorkingDaysFridayRightmost,
  minutesToTime24,
  parseTime24ToMinutes
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

interface IntervalRecord {
  secId: string;
  code: string;
  startMinutes: number;
  endMinutes: number;
  label: string;
}

function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
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

  const fridayEnabled = store.timeStructure.fridayEnabled !== false;
  const scheduledDays = store.sections
    .map(s => s.assignedSlot?.day)
    .filter((d): d is NonNullable<typeof d> => Boolean(d));
  const days = orderWorkingDaysFridayRightmost(
    Array.from(new Set([...(computedTiming.workingDays || []), ...scheduledDays])),
    fridayEnabled || scheduledDays.includes('Fri')
  );

  periods.forEach(period => {
    scheduleData[period] = {};
    days.forEach(day => {
      scheduleData[period][day] = [];
    });
  });

  const conflicts: Array<{ id: string; description: string; day: string; time: string }> = [];

  // Track exact clock-interval occupancy per day for rooms, instructors, lab engineers, and student cohorts
  const roomIntervals = new Map<string, IntervalRecord[]>();
  const instIntervals = new Map<string, IntervalRecord[]>();
  const engIntervals = new Map<string, IntervalRecord[]>();
  const groupIntervals = new Map<string, IntervalRecord[]>();

  const checkAndRecord = (
    map: Map<string, IntervalRecord[]>,
    key: string,
    record: IntervalRecord,
    buildMessage: (other: IntervalRecord) => string,
    conflictPrefix: string,
    day: string,
    timeLabel: string
  ): boolean => {
    const existingList = map.get(key) || [];
    let collided = false;
    existingList.forEach(other => {
      if (other.secId !== record.secId && intervalsOverlap(record.startMinutes, record.endMinutes, other.startMinutes, other.endMinutes)) {
        collided = true;
        conflicts.push({
          id: `conflict-${conflictPrefix}-${record.secId}-${other.secId}`,
          description: buildMessage(other),
          day,
          time: timeLabel
        });
      }
    });
    existingList.push(record);
    map.set(key, existingList);
    return collided;
  };

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
    const instructor = store.instructors.find(i => i.id === (sec.instructorId || course?.assignedInstructorId));
    const group = store.studentGroups.find(g => g.id === sec.studentGroupId);
    const sharedGroups = (sec.sharedGroupIds || [])
      .map(id => store.studentGroups.find(g => g.id === id))
      .filter((g): g is NonNullable<typeof g> => Boolean(g));
    const dept = store.departments.find(d => d.id === course?.departmentId);

    const isLab =
      sec.sessionType === 'Lab' ||
      (sec.spanSlots && sec.spanSlots > 1) ||
      sec.assignedSlot.sessionType === 'Lab' ||
      (sec.assignedSlot.spanSlots && sec.assignedSlot.spanSlots > 1) ||
      sec.componentType === 'lab' ||
      sec.sectionNumber.toLowerCase().includes('lab');

    const resolvedLabEngId = isLab
      ? sec.labEngineerId || course?.assignedLabEngineerId || room?.assignedLabEngineerId || ''
      : '';
    const labEngineer = resolvedLabEngId
      ? store.instructors.find(i => i.id === resolvedLabEngId)
      : undefined;

    const code = course?.code || 'CRS-101';
    const title = course?.title || 'Academic Seminar';
    const roomCode = room?.code || 'Hall A1';
    const profName = instructor?.name || 'Staff Faculty';
    const labEngineerName = labEngineer?.name;
    const cohortCode =
      sharedGroups.length > 0
        ? `${group?.code || 'Cohort'} + ${sharedGroups.map(g => g.code).join(', ')}`
        : group?.code || 'All-STEM';

    const labBlockMeta = isLab ? getLabBlockByStartPeriod(timeSlot, store.timeStructure, day) : undefined;
    const effectiveDaySlot = getEffectiveSlotDisplayForDay(day, timeSlot, computedTiming);
    const baseSlotMeta = computedTiming.slots.find(s => s.period === timeSlot);

    const spanSlots = isLab
      ? (sec.assignedSlot.spanSlots || labBlockMeta?.spanSlots || computedTiming.labSpanSlots || 3)
      : 1;
    const sessionType: 'Lecture' | 'Lab' = isLab ? 'Lab' : 'Lecture';

    const resolvedDurationMinutes = isLab
      ? (sec.assignedSlot.durationMinutes || labBlockMeta?.durationMinutes || computedTiming.labDurationMinutes || 180)
      : (sec.assignedSlot.durationMinutes || (effectiveDaySlot.isOpen ? effectiveDaySlot.durationMinutes : computedTiming.periodLengthMinutes || 50));

    const startMinutes =
      sec.assignedSlot.startMinutes ??
      (sec.assignedSlot.startTime24 ? parseTime24ToMinutes(sec.assignedSlot.startTime24, 540) : undefined) ??
      effectiveDaySlot.slot?.startMinutes ??
      baseSlotMeta?.startMinutes ??
      540;
    const endMinutes =
      sec.assignedSlot.endMinutes ??
      (sec.assignedSlot.endTime24 ? parseTime24ToMinutes(sec.assignedSlot.endTime24, startMinutes + resolvedDurationMinutes) : undefined) ??
      startMinutes + resolvedDurationMinutes;
    const startTime24 = sec.assignedSlot.startTime24 || minutesToTime24(startMinutes);
    const endTime24 = sec.assignedSlot.endTime24 || minutesToTime24(endMinutes);

    const continuousTimeLabel = isLab
      ? (sec.assignedSlot.continuousTimeLabel ||
          (day === 'Fri' ? labBlockMeta?.continuousLabel : undefined) ||
          labBlockMeta?.continuousLabel ||
          computedTiming.continuousLabBlocks[0]?.continuousLabel ||
          `${startTime24} – ${endTime24}`)
      : undefined;

    const effectiveDisplayTime = isLab
      ? continuousTimeLabel || timeSlot
      : effectiveDaySlot.isOpen && effectiveDaySlot.isFridaySpecial
      ? effectiveDaySlot.period
      : timeSlot;

    let hasConflict = false;
    if (room?.id || roomCode) {
      if (
        checkAndRecord(
          roomIntervals,
          `${day}__${room?.id || roomCode}`,
          { secId: sec.id, code, startMinutes, endMinutes, label: roomCode },
          other => `Room ${roomCode} double-booked on ${day}: ${code} (${startTime24}–${endTime24}) overlaps ${other.code}`,
          'room',
          day,
          effectiveDisplayTime
        )
      ) {
        hasConflict = true;
      }
    }

    if (instructor?.id) {
      if (
        checkAndRecord(
          instIntervals,
          `${day}__${instructor.id}`,
          { secId: sec.id, code, startMinutes, endMinutes, label: profName },
          other => `Instructor ${profName} double-booked on ${day} (${startTime24}–${endTime24}): ${code} and ${other.code}`,
          'prof',
          day,
          effectiveDisplayTime
        )
      ) {
        hasConflict = true;
      }
    }

    if (labEngineer?.id && labEngineer.id !== instructor?.id) {
      if (
        checkAndRecord(
          engIntervals,
          `${day}__${labEngineer.id}`,
          { secId: sec.id, code, startMinutes, endMinutes, label: labEngineer.name },
          other => `Lab Engineer ${labEngineer.name} double-booked on ${day} (${startTime24}–${endTime24}): ${code} and ${other.code}`,
          'eng',
          day,
          effectiveDisplayTime
        )
      ) {
        hasConflict = true;
      }
    }

    const allGroupIds = Array.from(new Set([sec.studentGroupId, ...(sec.sharedGroupIds || [])].filter(Boolean)));
    allGroupIds.forEach(gid => {
      const grp = store.studentGroups.find(g => g.id === gid);
      if (
        checkAndRecord(
          groupIntervals,
          `${day}__${gid}`,
          { secId: sec.id, code, startMinutes, endMinutes, label: grp?.code || gid },
          other => `Cohort ${grp?.code || gid} has overlapping classes on ${day} (${startTime24}–${endTime24}): ${code} and ${other.code}`,
          'cohort',
          day,
          effectiveDisplayTime
        )
      ) {
        hasConflict = true;
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
      labEngineerId: labEngineer?.id,
      labEngineerName,
      cohort: cohortCode,
      studentGroupId: group?.id,
      sharedGroupIds: sec.sharedGroupIds,
      departmentId: dept?.id,
      departmentName: dept?.name || 'General Sciences',
      sectionNumber: sec.sectionNumber,
      capacity,
      enrolled,
      time: timeSlot,
      effectiveTime: effectiveDisplayTime,
      startTime24,
      endTime24,
      startMinutes,
      endMinutes,
      isSplitLab: sec.assignedSlot.isSplitLab,
      slotSource: sec.assignedSlot.slotSource,
      day,
      type: isLab ? 'Lab' : 'Lecture',
      sessionType,
      componentType: isLab ? 'lab' : 'lecture',
      spanSlots,
      durationMinutes: resolvedDurationMinutes,
      continuousTimeLabel,
      credits: course?.creditHours || 3,
      accent: getDepartmentAccent(code),
      isLocked: sec.isLocked,
      hasConflict,
      constraintStatus: hasConflict ? 'Soft Penalty Resolved' : 'Optimal'
    };

    scheduleData[timeSlot][day].push(classItem);
  });

  return { scheduleData, conflicts };
}

