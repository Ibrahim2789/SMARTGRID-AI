import { 
  largeSampleRooms, 
  largeSampleCourses, 
  largeSampleInstructors, 
  largeSampleStudentGroups, 
  largeSampleSections 
} from '../src/data/largeSampleDataset';

const lectureRooms = largeSampleRooms.filter(r => r.type === 'lecture');
const labRooms = largeSampleRooms.filter(r => r.type === 'lab');
const workingDaysCount = 5;
const hoursPerRoomPerWeek = 7 * workingDaysCount; // 35

const lectureRoomsAvail = lectureRooms.length * hoursPerRoomPerWeek;
const labsAvail = labRooms.length * hoursPerRoomPerWeek;
const totalInstructorLoad = largeSampleInstructors.reduce((acc, i) => acc + (i.maxWeeklyHours || 0), 0);

const lectureHoursNeeded = largeSampleSections.reduce((sum, sec) => {
  const c = largeSampleCourses.find(item => item.id === sec.courseId);
  return sum + (c ? (c.requiredRoomType === 'lab' ? 0 : (c.lectureHours || c.weeklyContactHours)) : 3);
}, 0);

const labHoursNeeded = largeSampleSections.reduce((sum, sec) => {
  const c = largeSampleCourses.find(item => item.id === sec.courseId);
  return sum + (c ? (c.requiredRoomType === 'lab' ? c.weeklyContactHours : (c.labHours || 0)) : 0);
}, 0);

const instructorHoursNeeded = largeSampleSections.reduce((sum, sec) => {
  const c = largeSampleCourses.find(item => item.id === sec.courseId);
  return sum + (c?.weeklyContactHours || 3);
}, 0);

const lecturePct = Math.round((lectureHoursNeeded / lectureRoomsAvail) * 100);
const labPct = Math.round((labHoursNeeded / labsAvail) * 100);
const instPct = Math.round((instructorHoursNeeded / totalInstructorLoad) * 100);

console.log('Home Chart Percentages:');
console.log(`Lecture rooms: ${lecturePct}% (${lectureHoursNeeded}h / ${lectureRoomsAvail}h)`);
console.log(`Labs: ${labPct}% (${labHoursNeeded}h / ${labsAvail}h)`);
console.log(`Instructors: ${instPct}% (${instructorHoursNeeded}h / ${totalInstructorLoad}h)`);
