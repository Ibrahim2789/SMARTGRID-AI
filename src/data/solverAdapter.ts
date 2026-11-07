import { ClassItem } from '../components/ClassDetailsModal';
import { InstitutionalDataStore } from './store';

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
  const periods = store.timeStructure.periods.length > 0
    ? store.timeStructure.periods
    : ['09:00 - 10:30', '11:00 - 12:30', '13:30 - 15:00', '15:30 - 17:00'];
  const days = store.timeStructure.workingDays.length > 0
    ? store.timeStructure.workingDays
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  periods.forEach(period => {
    scheduleData[period] = {};
    days.forEach(day => {
      scheduleData[period][day] = [];
    });
  });

  const conflicts: Array<{ id: string; description: string; day: string; time: string }> = [];

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

    // Conflict detection: room double-booking
    const existingInRoom = scheduleData[timeSlot][day].find(item => item.room === roomCode);
    if (existingInRoom) {
      conflicts.push({
        id: `conflict-room-${sec.id}-${existingInRoom.id}`,
        description: `Room ${roomCode} double-booked: ${code} and ${existingInRoom.code}`,
        day,
        time: timeSlot
      });
    }

    // Conflict detection: instructor double-booking
    const existingForProf = scheduleData[timeSlot][day].find(item => item.prof === profName);
    if (existingForProf) {
      conflicts.push({
        id: `conflict-prof-${sec.id}-${existingForProf.id}`,
        description: `Instructor ${profName} scheduled twice at ${day} ${timeSlot}`,
        day,
        time: timeSlot
      });
    }

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
      capacity,
      enrolled,
      time: timeSlot,
      day,
      type: course?.requiredRoomType === 'lab'
        ? 'Laboratory'
        : course?.requiredRoomType === 'studio'
        ? 'Studio'
        : course?.requiredRoomType === 'seminar'
        ? 'Recitation'
        : 'Lecture',
      credits: course?.creditHours || 3,
      accent: getDepartmentAccent(code),
      isLocked: sec.isLocked,
      constraintStatus: existingInRoom || existingForProf ? 'Soft Penalty Resolved' : 'Optimal'
    };

    scheduleData[timeSlot][day].push(classItem);
  });

  return { scheduleData, conflicts };
}
