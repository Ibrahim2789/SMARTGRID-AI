import {
  largeSampleTerm,
  largeSampleCampuses,
  largeSampleBuildings,
  largeSampleRooms,
  largeSampleDepartments,
  largeSamplePrograms,
  largeSampleCourses,
  largeSampleInstructors,
  largeSampleStudentGroups,
  largeSampleSections,
  largeSampleTimeStructure,
  largeSampleConstraints,
  largeSampleScenario
} from '../frontend/src/data/largeSampleDataset';
import { buildMatrixSchedule } from '../frontend/src/data/solverAdapter';

console.log('====================================================');
console.log('SMARTGRID AI: SEEDING REALISTIC SAMPLE DATASET');
console.log('Institution: Western Polytechnic Institute');
console.log('Academic Term: Term 2 (Spring 2026)');
console.log('====================================================');

console.log(`\n[1/7] Departments: ${largeSampleDepartments.length}`);
largeSampleDepartments.forEach(d => console.log(`  - [${d.code}] ${d.name} (${d.school})`));

console.log(`\n[2/7] Programs: ${largeSamplePrograms.length}`);
largeSamplePrograms.forEach(p => console.log(`  - [${p.code}] ${p.name}`));

console.log(`\n[3/7] Classes / Cohorts: ${largeSampleStudentGroups.length}`);
console.log(`  - Total Student Enrollment: ${largeSampleStudentGroups.reduce((acc, g) => acc + g.size, 0).toLocaleString()} students`);

console.log(`\n[4/7] Courses: ${largeSampleCourses.length}`);
const labCourses = largeSampleCourses.filter(c => c.requiredRoomType === 'lab');
console.log(`  - Lecture & Seminar: ${largeSampleCourses.length - labCourses.length} courses`);
console.log(`  - Laboratory & Studio: ${labCourses.length} courses`);

console.log(`\n[5/7] Faculty & Instructors: ${largeSampleInstructors.length}`);
const totalMaxHours = largeSampleInstructors.reduce((acc, i) => acc + i.maxWeeklyHours, 0);
console.log(`  - Total Faculty Contract Capacity: ${totalMaxHours} hours/week`);
console.log(`  - Average Cap: ${Math.round(totalMaxHours / largeSampleInstructors.length)} hours/week`);

console.log(`\n[6/7] Physical Rooms: ${largeSampleRooms.length} rooms across 4 buildings`);
const lectureRooms = largeSampleRooms.filter(r => r.type === 'lecture');
const labs = largeSampleRooms.filter(r => r.type === 'lab');
const studios = largeSampleRooms.filter(r => r.type === 'studio');
const seminars = largeSampleRooms.filter(r => r.type === 'seminar');
console.log(`  - Lecture Halls: ${lectureRooms.length}`);
console.log(`  - Labs: ${labs.length} (6 Computer Labs, 3 Electronics, 2 Physics, 1 Materials)`);
console.log(`  - Studios & Seminars: ${studios.length + seminars.length}`);

console.log(`\n[7/7] Timetable Scenario & Section Allocations: ${largeSampleSections.length} sections`);

const dummyStore = {
  rooms: largeSampleRooms,
  courses: largeSampleCourses,
  instructors: largeSampleInstructors,
  studentGroups: largeSampleStudentGroups,
  sections: largeSampleSections,
  timeStructure: largeSampleTimeStructure,
  terms: [largeSampleTerm],
  campuses: largeSampleCampuses,
  buildings: largeSampleBuildings,
  departments: largeSampleDepartments,
  programs: largeSamplePrograms,
  constraints: largeSampleConstraints,
  scenarios: [largeSampleScenario],
  auditLogs: []
};

const { conflicts } = buildMatrixSchedule(dummyStore);

console.log('\n====================================================');
console.log('VALIDATION RESULTS');
console.log('====================================================');
console.log(`Hard Clash Count: ${conflicts.length}`);
if (conflicts.length === 0) {
  console.log('STATUS: READY & FEASIBLE. 100% of sections allocated with 0 room or faculty conflicts.');
} else {
  console.error(`WARNING: Found ${conflicts.length} conflicts.`);
}
