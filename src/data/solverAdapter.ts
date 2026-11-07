import { ClassItem } from '../components/ClassDetailsModal';
import { InstitutionalDataStore } from './store';
import { DayOfWeek } from '../types/institutional';

export function getDepartmentBlockClass(code: string): string {
  if (code.startsWith('CS')) return 'dept-block-sky';
  if (code.startsWith('BIO')) return 'dept-block-mint';
  if (code.startsWith('CHEM')) return 'dept-block-aqua';
  if (code.startsWith('ENG')) return 'dept-block-peach';
  if (code.startsWith('ARCH')) return 'dept-block-sand';
  if (code.startsWith('MATH')) return 'dept-block-butter';
  if (code.startsWith('HUM')) return 'dept-block-rose';
  return 'dept-block-lime';
}

export function buildMatrixSchedule(store: InstitutionalDataStore): {
  scheduleData: Record<string, Record<string, ClassItem[]>>;
  conflicts: Array<{ id: string; description: string; day: string; time: string }>;
} {
  const scheduleData: Record<string, Record<string, ClassItem[]>> = {};
  const periods = store.timeStructure.periods;
  const days = store.timeStructure.workingDays;

  // Initialize empty grid
  periods.forEach(period => {
    scheduleData[period] = {};
    days.forEach(day => {
      scheduleData[period][day] = [];
    });
  });

  const conflicts: Array<{ id: string; description: string; day: string; time: string }> = [];

  // Map each assigned section
  store.sections.forEach(sec => {
    if (!sec.assignedSlot) return;

    const { day, timeSlot, roomId } = sec.assignedSlot;
    if (!scheduleData[timeSlot]) {
      scheduleData[timeSlot] = {};
    }
    if (!scheduleData[timeSlot][day]) {
      scheduleData[timeSlot][day] = [];
    }

    const course = store.courses.find(c => c.id === sec.courseId);
    const room = store.rooms.find(r => r.id === roomId);
    const instructor = store.instructors.find(i => i.id === sec.instructorId);
    const group = store.studentGroups.find(g => g.id === sec.studentGroupId);

    const code = course?.code || 'CRS-000';
    const title = course?.title || 'Untitled Course';
    const roomCode = room?.code || 'TBD';
    const profName = instructor?.name || 'Unassigned';
    const cohortCode = group?.code || 'General';

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

    // Capacity warning
    const capacity = room?.capacity || 30;
    const enrolled = sec.expectedEnrollment || 25;

    const classItem: ClassItem = {
      id: sec.id,
      code,
      title,
      room: roomCode,
      prof: profName,
      cohort: cohortCode,
      capacity,
      enrolled,
      time: timeSlot,
      day,
      type: course?.requiredRoomType === 'lab' ? 'Laboratory' : (course?.requiredRoomType === 'studio' ? 'Studio' : 'Lecture'),
      credits: course?.creditHours || 3,
      accent: 'emerald',
      constraintStatus: existingInRoom || existingForProf ? 'Soft Penalty Resolved' : 'Optimal'
    };

    scheduleData[timeSlot][day].push(classItem);
  });

  return { scheduleData, conflicts };
}
