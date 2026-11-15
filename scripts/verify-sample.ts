import { 
  largeSampleRooms, 
  largeSampleCourses, 
  largeSampleInstructors, 
  largeSampleStudentGroups, 
  largeSampleSections, 
  largeSampleDepartments, 
  largeSamplePrograms,
  largeSampleTimeStructure
} from '../frontend/src/data/largeSampleDataset';
import { buildMatrixSchedule } from '../frontend/src/data/solverAdapter';

console.log('--- WPI SAMPLE DATASET AUDIT ---');
console.log('Departments:', largeSampleDepartments.length);
console.log('Programs:', largeSamplePrograms.length);
console.log('Student Groups / Classes:', largeSampleStudentGroups.length);
console.log('Courses:', largeSampleCourses.length);
console.log('Instructors:', largeSampleInstructors.length);
console.log('Rooms:', largeSampleRooms.length);
console.log('Sections Assigned:', largeSampleSections.length);

const lectureRooms = largeSampleRooms.filter(r => r.type === 'lecture');
const labs = largeSampleRooms.filter(r => r.type === 'lab');

// Available hours (35h per room/week: 7h/day * 5 days)
const lectureHoursAvail = lectureRooms.length * 35;
const labHoursAvail = labs.length * 35;
const instHoursAvail = largeSampleInstructors.reduce((sum, i) => sum + i.maxWeeklyHours, 0);

// Used hours
let lectureHoursUsed = 0;
let labHoursUsed = 0;
let instHoursUsed = 0;

largeSampleSections.forEach(s => {
  const room = largeSampleRooms.find(r => r.id === s.assignedSlot?.roomId);
  const dur = (s.assignedSlot?.durationMinutes || 90) / 60;
  if (room?.type === 'lecture') lectureHoursUsed += dur;
  if (room?.type === 'lab') labHoursUsed += dur;
  instHoursUsed += dur;
});

console.log(`Lecture Rooms: ${lectureRooms.length} rooms | Available: ${lectureHoursAvail}h | Used: ${lectureHoursUsed}h | Utilization: ${Math.round((lectureHoursUsed / lectureHoursAvail) * 100)}%`);
console.log(`Laboratories: ${labs.length} labs | Available: ${labHoursAvail}h | Used: ${labHoursUsed}h | Utilization: ${Math.round((labHoursUsed / labHoursAvail) * 100)}%`);
console.log(`Instructors: ${largeSampleInstructors.length} faculty | Available: ${instHoursAvail}h | Used: ${instHoursUsed}h | Utilization: ${Math.round((instHoursUsed / instHoursAvail) * 100)}%`);

const dummyStore = {
  rooms: largeSampleRooms,
  courses: largeSampleCourses,
  instructors: largeSampleInstructors,
  studentGroups: largeSampleStudentGroups,
  sections: largeSampleSections,
  timeStructure: largeSampleTimeStructure,
  terms: [],
  campuses: [],
  buildings: [],
  departments: largeSampleDepartments,
  programs: largeSamplePrograms,
  constraints: [],
  scenarios: [],
  auditLogs: []
};

const { conflicts } = buildMatrixSchedule(dummyStore);
console.log('Clashes / Hard Conflicts:', conflicts.length);
if (conflicts.length > 0) {
  console.log('First conflict sample:', conflicts.slice(0, 3));
} else {
  console.log('SUCCESS: Zero conflicts detected.');
}
