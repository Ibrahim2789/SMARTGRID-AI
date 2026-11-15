import {
  AcademicTerm,
  Campus,
  Building,
  Room,
  Department,
  Program,
  Course,
  Section,
  Instructor,
  StudentGroup,
  TimeStructure,
  ConstraintRule,
  TimetableScenario,
  AuditLogEntry,
  DayOfWeek,
  RoomType
} from '../types/institutional';

// 1. Term
export const largeSampleTerm: AcademicTerm = {
  id: 'term-sample-2026-spring',
  name: 'Term 2 (Spring 2026)',
  code: 'SPRING-2026',
  startDate: '2026-01-12',
  endDate: '2026-05-15',
  status: 'active',
  weeksCount: 16,
  is_sample: true,
  isSample: true
};

// 2. Campuses & Buildings (4 buildings across 2 campuses)
export const largeSampleCampuses: Campus[] = [
  {
    id: 'campus-wpi-main',
    name: 'WPI North Main Academic Campus',
    code: 'NORTH',
    address: '100 Institute Road, Worcester / Polytechnic Way',
    is_sample: true,
    isSample: true
  },
  {
    id: 'campus-wpi-south',
    name: 'WPI South Innovation & Applied Sciences Quad',
    code: 'SOUTH',
    address: '50 Technology Drive, Research District',
    is_sample: true,
    isSample: true
  }
];

export const largeSampleBuildings: Building[] = [
  {
    id: 'bld-turing',
    campusId: 'campus-wpi-main',
    name: 'Alan Turing Computing Center (Block A)',
    code: 'TUR',
    floors: 4,
    is_sample: true,
    isSample: true
  },
  {
    id: 'bld-euler',
    campusId: 'campus-wpi-main',
    name: 'Leonhard Euler Engineering Complex (Block B)',
    code: 'EUL',
    floors: 5,
    is_sample: true,
    isSample: true
  },
  {
    id: 'bld-franklin',
    campusId: 'campus-wpi-south',
    name: 'Rosalind Franklin Science Wing (Block C)',
    code: 'FRK',
    floors: 4,
    is_sample: true,
    isSample: true
  },
  {
    id: 'bld-smith',
    campusId: 'campus-wpi-main',
    name: 'Adam Smith Management & Humanities Hall (Block D)',
    code: 'SMI',
    floors: 3,
    is_sample: true,
    isSample: true
  }
];

// 3. 5 Departments
export const largeSampleDepartments: Department[] = [
  {
    id: 'dept-cs',
    name: 'Computer Science & Software Engineering',
    code: 'CS',
    school: 'School of Computing',
    colorHex: '#0D9488',
    is_sample: true,
    isSample: true
  },
  {
    id: 'dept-ee',
    name: 'Electrical & Electronics Engineering',
    code: 'EE',
    school: 'School of Engineering',
    colorHex: '#2563EB',
    is_sample: true,
    isSample: true
  },
  {
    id: 'dept-ba',
    name: 'Business Administration & Management',
    code: 'BA',
    school: 'School of Business',
    colorHex: '#D97706',
    is_sample: true,
    isSample: true
  },
  {
    id: 'dept-ms',
    name: 'Mathematics and Sciences',
    code: 'MS',
    school: 'School of Sciences',
    colorHex: '#059669',
    is_sample: true,
    isSample: true
  },
  {
    id: 'dept-ce',
    name: 'Civil & Architectural Engineering',
    code: 'CE',
    school: 'School of Engineering',
    colorHex: '#C2410C',
    is_sample: true,
    isSample: true
  }
];

// 4. 12 Programs
export const largeSamplePrograms: Program[] = [
  // CS
  { id: 'prog-bsc-cs', departmentId: 'dept-cs', name: 'BS Computer Science', code: 'BSCS', degreeLevel: 'Undergraduate', totalSemesters: 8, is_sample: true, isSample: true },
  { id: 'prog-bsc-se', departmentId: 'dept-cs', name: 'BS Software Engineering', code: 'BSSE', degreeLevel: 'Undergraduate', totalSemesters: 8, is_sample: true, isSample: true },
  { id: 'prog-bsc-ai', departmentId: 'dept-cs', name: 'BS Artificial Intelligence', code: 'BSAI', degreeLevel: 'Undergraduate', totalSemesters: 8, is_sample: true, isSample: true },
  { id: 'prog-bsc-ds', departmentId: 'dept-cs', name: 'BS Data Science', code: 'BSDS', degreeLevel: 'Undergraduate', totalSemesters: 8, is_sample: true, isSample: true },
  // EE
  { id: 'prog-bsc-ee', departmentId: 'dept-ee', name: 'BS Electrical Engineering', code: 'BSEE', degreeLevel: 'Undergraduate', totalSemesters: 8, is_sample: true, isSample: true },
  { id: 'prog-bsc-elec', departmentId: 'dept-ee', name: 'BS Electronics', code: 'BSElec', degreeLevel: 'Undergraduate', totalSemesters: 8, is_sample: true, isSample: true },
  // BA
  { id: 'prog-bba', departmentId: 'dept-ba', name: 'Bachelor of Business Administration', code: 'BBA', degreeLevel: 'Undergraduate', totalSemesters: 8, is_sample: true, isSample: true },
  { id: 'prog-bsc-af', departmentId: 'dept-ba', name: 'BS Accounting & Finance', code: 'BSAF', degreeLevel: 'Undergraduate', totalSemesters: 8, is_sample: true, isSample: true },
  // MS
  { id: 'prog-bsc-math', departmentId: 'dept-ms', name: 'BS Mathematics', code: 'BSMath', degreeLevel: 'Undergraduate', totalSemesters: 8, is_sample: true, isSample: true },
  { id: 'prog-bsc-phy', departmentId: 'dept-ms', name: 'BS Physics', code: 'BSPhy', degreeLevel: 'Undergraduate', totalSemesters: 8, is_sample: true, isSample: true },
  // CE
  { id: 'prog-bsc-ce', departmentId: 'dept-ce', name: 'BS Civil Engineering', code: 'BSCE', degreeLevel: 'Undergraduate', totalSemesters: 8, is_sample: true, isSample: true },
  { id: 'prog-barch', departmentId: 'dept-ce', name: 'BS Architecture', code: 'BArch', degreeLevel: 'Undergraduate', totalSemesters: 10, is_sample: true, isSample: true }
];

// 5. 55 Rooms across 4 buildings
// 28 lecture rooms, 6 computer labs, 3 electronics labs, 2 physics labs, 2 civil studios, 4 seminar rooms, 2 large halls + extras = 55 rooms
export const largeSampleRooms: Room[] = [
  // Turing Building (Block A): 15 rooms
  { id: 'room-a-101', buildingId: 'bld-turing', code: 'Block A Room 101', name: 'Turing Lecture 101', capacity: 60, type: 'lecture', equipment: ['Projector', 'AC', 'Accessible'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-a-102', buildingId: 'bld-turing', code: 'Block A Room 102', name: 'Turing Lecture 102', capacity: 60, type: 'lecture', equipment: ['Projector', 'AC'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-a-201', buildingId: 'bld-turing', code: 'Block A Room 201', name: 'Turing Lecture 201', capacity: 80, type: 'lecture', equipment: ['Dual Projectors', 'AC', 'Accessible'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-a-202', buildingId: 'bld-turing', code: 'Block A Room 202', name: 'Turing Lecture 202', capacity: 80, type: 'lecture', equipment: ['Projector', 'AC'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-a-301', buildingId: 'bld-turing', code: 'Block A Room 301', name: 'Turing Lecture 301', capacity: 40, type: 'lecture', equipment: ['Projector'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-a-302', buildingId: 'bld-turing', code: 'Block A Room 302', name: 'Turing Lecture 302', capacity: 40, type: 'lecture', equipment: ['Projector'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-a-aud', buildingId: 'bld-turing', code: 'Block A Main Hall', name: 'Turing Memorial Hall', capacity: 120, type: 'lecture', equipment: ['Stage', 'Dual Laser', 'Mic Array', 'Accessible'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  // Computer Labs (6)
  { id: 'room-clab-1', buildingId: 'bld-turing', code: 'Computer Lab 1', name: 'Systems Programming Lab', capacity: 40, type: 'lab', equipment: ['40 Workstations', 'AC', 'Gigabit Switch'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-clab-2', buildingId: 'bld-turing', code: 'Computer Lab 2', name: 'Software Engineering Lab', capacity: 40, type: 'lab', equipment: ['40 Workstations', 'AC'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-clab-3', buildingId: 'bld-turing', code: 'Computer Lab 3', name: 'Network & Security Lab', capacity: 35, type: 'lab', equipment: ['35 Workstations', 'Cisco Racks'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-clab-4', buildingId: 'bld-turing', code: 'Computer Lab 4', name: 'Artificial Intelligence Lab', capacity: 35, type: 'lab', equipment: ['35 GPU Stations', 'AC'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-clab-5', buildingId: 'bld-turing', code: 'Computer Lab 5', name: 'Data Analytics Lab', capacity: 35, type: 'lab', equipment: ['35 Workstations', 'Projector'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-clab-6', buildingId: 'bld-turing', code: 'Computer Lab 6', name: 'Cloud Computing Lab', capacity: 30, type: 'lab', equipment: ['30 Workstations', 'Dual Monitors'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-a-sem1', buildingId: 'bld-turing', code: 'Seminar Room A-1', name: 'Graduate Colloquium 1', capacity: 30, type: 'seminar', equipment: ['Smartboard', 'Conference Table'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-a-sem2', buildingId: 'bld-turing', code: 'Seminar Room A-2', name: 'Graduate Colloquium 2', capacity: 25, type: 'seminar', equipment: ['Display', 'Whiteboard'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },

  // Euler Building (Block B - Engineering): 15 rooms
  { id: 'room-b-101', buildingId: 'bld-euler', code: 'Block B Room 101', name: 'Euler Lecture 101', capacity: 60, type: 'lecture', equipment: ['Projector', 'AC'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-b-102', buildingId: 'bld-euler', code: 'Block B Room 102', name: 'Euler Lecture 102', capacity: 60, type: 'lecture', equipment: ['Projector', 'AC'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-b-201', buildingId: 'bld-euler', code: 'Block B Room 201', name: 'Euler Lecture 201', capacity: 80, type: 'lecture', equipment: ['Projector', 'AC', 'Accessible'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-b-202', buildingId: 'bld-euler', code: 'Block B Room 202', name: 'Euler Lecture 202', capacity: 80, type: 'lecture', equipment: ['Projector', 'AC'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-b-203', buildingId: 'bld-euler', code: 'Block B Room 203', name: 'Euler Lecture 203', capacity: 40, type: 'lecture', equipment: ['Projector'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-b-204', buildingId: 'bld-euler', code: 'Block B Room 204', name: 'Euler Lecture 204', capacity: 40, type: 'lecture', equipment: ['Projector'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-b-301', buildingId: 'bld-euler', code: 'Block B Room 301', name: 'Euler Lecture 301', capacity: 30, type: 'lecture', equipment: ['Whiteboard'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-b-302', buildingId: 'bld-euler', code: 'Block B Room 302', name: 'Euler Lecture 302', capacity: 30, type: 'lecture', equipment: ['Whiteboard'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-b-hall', buildingId: 'bld-euler', code: 'Block B Grand Hall', name: 'Euler Engineering Theater', capacity: 120, type: 'lecture', equipment: ['Stage', 'Dual Projectors', 'Sound Array'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  // Electronics Labs (3)
  { id: 'room-elab-1', buildingId: 'bld-euler', code: 'Electronics Lab 1', name: 'Circuits & Signals Lab', capacity: 35, type: 'lab', equipment: ['Oscilloscopes', 'Signal Generators', 'Power Supplies'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-elab-2', buildingId: 'bld-euler', code: 'Electronics Lab 2', name: 'Digital Logic & Microprocessors', capacity: 35, type: 'lab', equipment: ['FPGA Boards', 'Logic Analyzers'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-elab-3', buildingId: 'bld-euler', code: 'Electronics Lab 3', name: 'Power Electronics & Machines', capacity: 30, type: 'lab', equipment: ['Motor Benches', 'Safety Isolation'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  // Civil Studios (2)
  { id: 'room-studio-1', buildingId: 'bld-euler', code: 'Civil Studio 1', name: 'Structural Modeling Studio', capacity: 35, type: 'studio', equipment: ['Drafting Tables', 'CAD Plotters'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-studio-2', buildingId: 'bld-euler', code: 'Civil Studio 2', name: 'Architectural Design Studio', capacity: 35, type: 'studio', equipment: ['Light Tables', 'Model Racks'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-b-sem1', buildingId: 'bld-euler', code: 'Seminar Room B-1', name: 'Engineering Boardroom', capacity: 25, type: 'seminar', equipment: ['Smart TV', 'Polycom'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },

  // Franklin Building (Block C - Sciences & Research): 12 rooms
  { id: 'room-c-101', buildingId: 'bld-franklin', code: 'Block C Room 101', name: 'Franklin Lecture 101', capacity: 60, type: 'lecture', equipment: ['Projector', 'AC'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-c-102', buildingId: 'bld-franklin', code: 'Block C Room 102', name: 'Franklin Lecture 102', capacity: 60, type: 'lecture', equipment: ['Projector'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-c-201', buildingId: 'bld-franklin', code: 'Block C Room 201', name: 'Franklin Lecture 201', capacity: 80, type: 'lecture', equipment: ['Projector', 'AC', 'Accessible'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-c-202', buildingId: 'bld-franklin', code: 'Block C Room 202', name: 'Franklin Lecture 202', capacity: 80, type: 'lecture', equipment: ['Projector'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-c-301', buildingId: 'bld-franklin', code: 'Block C Room 301', name: 'Franklin Lecture 301', capacity: 40, type: 'lecture', equipment: ['Projector'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-c-302', buildingId: 'bld-franklin', code: 'Block C Room 302', name: 'Franklin Lecture 302', capacity: 40, type: 'lecture', equipment: ['Projector'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-c-303', buildingId: 'bld-franklin', code: 'Block C Room 303', name: 'Franklin Lecture 303', capacity: 30, type: 'lecture', equipment: ['Whiteboard'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  // Physics Labs (2)
  { id: 'room-plab-1', buildingId: 'bld-franklin', code: 'Physics Lab 1', name: 'Mechanics & Optics Lab', capacity: 35, type: 'lab', equipment: ['Optical Benches', 'Spectrometers', 'Dark Curtain'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-plab-2', buildingId: 'bld-franklin', code: 'Physics Lab 2', name: 'Modern & Nuclear Physics Lab', capacity: 30, type: 'lab', equipment: ['Geiger Counters', 'Laser Tables'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  // Chemistry/Materials Lab
  { id: 'room-chemlab-1', buildingId: 'bld-franklin', code: 'Materials Lab', name: 'Applied Chemistry & Materials', capacity: 30, type: 'lab', equipment: ['Fume Hoods', 'Tensile Tester'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-c-sem1', buildingId: 'bld-franklin', code: 'Seminar Room C-1', name: 'Sciences Colloquium', capacity: 25, type: 'seminar', equipment: ['Smartboard'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-c-aud', buildingId: 'bld-franklin', code: 'Franklin Science Auditorium', name: 'Franklin Science Theater', capacity: 120, type: 'lecture', equipment: ['Tiered Seating', 'Stage', 'AV'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },

  // Adam Smith Building (Block D - Management & Humanities): 13 rooms
  { id: 'room-d-101', buildingId: 'bld-smith', code: 'Block D Room 101', name: 'Smith Lecture 101', capacity: 60, type: 'lecture', equipment: ['Projector', 'AC'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-d-102', buildingId: 'bld-smith', code: 'Block D Room 102', name: 'Smith Lecture 102', capacity: 60, type: 'lecture', equipment: ['Projector', 'AC'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-d-201', buildingId: 'bld-smith', code: 'Block D Room 201', name: 'Smith Lecture 201', capacity: 80, type: 'lecture', equipment: ['Projector', 'AC', 'Accessible'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-d-202', buildingId: 'bld-smith', code: 'Block D Room 202', name: 'Smith Lecture 202', capacity: 80, type: 'lecture', equipment: ['Projector', 'AC'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-d-203', buildingId: 'bld-smith', code: 'Block D Room 203', name: 'Smith Lecture 203', capacity: 60, type: 'lecture', equipment: ['Projector'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-d-204', buildingId: 'bld-smith', code: 'Block D Room 204', name: 'Smith Lecture 204', capacity: 60, type: 'lecture', equipment: ['Projector'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-d-301', buildingId: 'bld-smith', code: 'Block D Room 301', name: 'Smith Lecture 301', capacity: 40, type: 'lecture', equipment: ['Projector'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-d-302', buildingId: 'bld-smith', code: 'Block D Room 302', name: 'Smith Lecture 302', capacity: 40, type: 'lecture', equipment: ['Projector'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-d-303', buildingId: 'bld-smith', code: 'Block D Room 303', name: 'Smith Lecture 303', capacity: 30, type: 'lecture', equipment: ['Whiteboard'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-d-304', buildingId: 'bld-smith', code: 'Block D Room 304', name: 'Smith Lecture 304', capacity: 30, type: 'lecture', equipment: ['Whiteboard'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-d-sem1', buildingId: 'bld-smith', code: 'Seminar Room D-1', name: 'Executive Case Room 1', capacity: 35, type: 'seminar', equipment: ['Horseshoe Seating', 'Dual Mics'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-d-sem2', buildingId: 'bld-smith', code: 'Seminar Room D-2', name: 'Executive Case Room 2', capacity: 35, type: 'seminar', equipment: ['Tiered Tables'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true },
  { id: 'room-d-aud', buildingId: 'bld-smith', code: 'Smith Auditorium', name: 'Smith Business Theater', capacity: 120, type: 'lecture', equipment: ['Stage', 'Sound System', 'AC', 'Accessible'], isAccessible: true, isAvailable: true, is_sample: true, isSample: true }
];

// 6. 55 Instructors with realistic loads & availability
export const largeSampleInstructors: Instructor[] = [
  // Computer Science: 14 instructors
  { id: 'inst-cs-01', departmentId: 'dept-cs', name: 'Dr. Alan Evans', email: 'a.evans@wpi.edu', title: 'Professor of CS', maxWeeklyHours: 14, maxConsecutiveHours: 3, preferredDays: ['Mon', 'Wed', 'Fri'], unavailableSlots: [{ day: 'Tue', timeSlot: '09:00 - 10:30', reason: 'Senate' }], is_sample: true, isSample: true },
  { id: 'inst-cs-02', departmentId: 'dept-cs', name: 'Dr. Helena Chen', email: 'h.chen@wpi.edu', title: 'Associate Professor', maxWeeklyHours: 15, maxConsecutiveHours: 3, preferredDays: ['Mon', 'Tue', 'Wed'], unavailableSlots: [{ day: 'Fri', timeSlot: '14:00 - 15:30', reason: 'Research' }], is_sample: true, isSample: true },
  { id: 'inst-cs-03', departmentId: 'dept-cs', name: 'Dr. Grace Hopper-Patel', email: 'g.patel@wpi.edu', title: 'Assistant Professor', maxWeeklyHours: 12, maxConsecutiveHours: 3, preferredDays: ['Tue', 'Thu'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-cs-04', departmentId: 'dept-cs', name: 'Dr. Tariq Al-Mansoor', email: 't.almansoor@wpi.edu', title: 'Associate Professor (CS/EE Joint)', maxWeeklyHours: 16, maxConsecutiveHours: 3, preferredDays: ['Mon', 'Wed', 'Thu'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-cs-05', departmentId: 'dept-cs', name: 'Dr. Nadia Petrov', email: 'n.petrov@wpi.edu', title: 'Assistant Professor', maxWeeklyHours: 14, maxConsecutiveHours: 3, preferredDays: ['Mon', 'Tue', 'Wed', 'Thu'], unavailableSlots: [{ day: 'Fri', timeSlot: '09:00 - 17:00', reason: 'No Fridays' }], is_sample: true, isSample: true },
  { id: 'inst-cs-06', departmentId: 'dept-cs', name: 'Dr. Imran Malik', email: 'i.malik@wpi.edu', title: 'Professor & Chair', maxWeeklyHours: 10, maxConsecutiveHours: 2, preferredDays: ['Tue', 'Thu'], unavailableSlots: [{ day: 'Mon', timeSlot: '09:00 - 13:00', reason: 'Deans Council' }], is_sample: true, isSample: true },
  { id: 'inst-cs-07', departmentId: 'dept-cs', name: 'Dr. Chloe Martin', email: 'c.martin@wpi.edu', title: 'Senior Lecturer', maxWeeklyHours: 18, maxConsecutiveHours: 3, preferredDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-cs-08', departmentId: 'dept-cs', name: 'Dr. Brian O Connor', email: 'b.oconnor@wpi.edu', title: 'Assistant Professor', maxWeeklyHours: 14, maxConsecutiveHours: 3, preferredDays: ['Mon', 'Wed', 'Fri'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-cs-09', departmentId: 'dept-cs', name: 'Dr. Priya Sharma', email: 'p.sharma@wpi.edu', title: 'Lecturer', maxWeeklyHours: 16, maxConsecutiveHours: 3, preferredDays: ['Mon', 'Tue', 'Thu', 'Fri'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-cs-10', departmentId: 'dept-cs', name: 'Dr. Kenji Sato', email: 'k.sato@wpi.edu', title: 'Associate Professor', maxWeeklyHours: 14, maxConsecutiveHours: 3, preferredDays: ['Tue', 'Wed', 'Thu'], unavailableSlots: [{ day: 'Mon', timeSlot: '14:00 - 17:00', reason: 'Lab Supervision' }], is_sample: true, isSample: true },
  { id: 'inst-cs-11', departmentId: 'dept-cs', name: 'Dr. Derek Vance', email: 'd.vance@wpi.edu', title: 'Assistant Professor', maxWeeklyHours: 12, maxConsecutiveHours: 3, preferredDays: ['Mon', 'Wed'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-cs-12', departmentId: 'dept-cs', name: 'Dr. Laura Rossi', email: 'l.rossi@wpi.edu', title: 'Lecturer', maxWeeklyHours: 16, maxConsecutiveHours: 3, preferredDays: ['Tue', 'Thu', 'Fri'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-cs-13', departmentId: 'dept-cs', name: 'Engr. Zayd Thorne', email: 'z.thorne@wpi.edu', title: 'Lab Instructor', maxWeeklyHours: 18, maxConsecutiveHours: 4, preferredDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-cs-14', departmentId: 'dept-cs', name: 'Engr. Maya Lin', email: 'm.lin@wpi.edu', title: 'Lab Instructor', maxWeeklyHours: 18, maxConsecutiveHours: 4, preferredDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], unavailableSlots: [], is_sample: true, isSample: true },

  // Electrical Engineering: 10 instructors
  { id: 'inst-ee-01', departmentId: 'dept-ee', name: 'Prof. Marcus Miller', email: 'm.miller@wpi.edu', title: 'Professor & Chair', maxWeeklyHours: 10, maxConsecutiveHours: 2, preferredDays: ['Tue', 'Thu'], unavailableSlots: [{ day: 'Wed', timeSlot: '09:00 - 12:00', reason: 'ABET Prep' }], is_sample: true, isSample: true },
  { id: 'inst-ee-02', departmentId: 'dept-ee', name: 'Dr. David Kim', email: 'd.kim@wpi.edu', title: 'Associate Professor', maxWeeklyHours: 15, maxConsecutiveHours: 3, preferredDays: ['Mon', 'Wed', 'Fri'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ee-03', departmentId: 'dept-ee', name: 'Dr. Fatima Zahra', email: 'f.zahra@wpi.edu', title: 'Assistant Professor', maxWeeklyHours: 14, maxConsecutiveHours: 3, preferredDays: ['Mon', 'Tue', 'Thu'], unavailableSlots: [{ day: 'Fri', timeSlot: '13:00 - 17:00', reason: 'Friday Prayer Block' }], is_sample: true, isSample: true },
  { id: 'inst-ee-04', departmentId: 'dept-ee', name: 'Dr. Carlos Mendoza', email: 'c.mendoza@wpi.edu', title: 'Professor', maxWeeklyHours: 14, maxConsecutiveHours: 3, preferredDays: ['Tue', 'Wed', 'Fri'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ee-05', departmentId: 'dept-ee', name: 'Dr. Robert Schmidt', email: 'r.schmidt@wpi.edu', title: 'Senior Lecturer', maxWeeklyHours: 16, maxConsecutiveHours: 3, preferredDays: ['Mon', 'Wed', 'Fri'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ee-06', departmentId: 'dept-ee', name: 'Dr. Arthur Dent', email: 'a.dent@wpi.edu', title: 'Assistant Professor', maxWeeklyHours: 12, maxConsecutiveHours: 3, preferredDays: ['Tue', 'Thu'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ee-07', departmentId: 'dept-ee', name: 'Dr. Sunita Rao', email: 's.rao@wpi.edu', title: 'Associate Professor', maxWeeklyHours: 14, maxConsecutiveHours: 3, preferredDays: ['Mon', 'Tue', 'Wed'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ee-08', departmentId: 'dept-ee', name: 'Dr. Kevin Zhao', email: 'k.zhao@wpi.edu', title: 'Assistant Professor', maxWeeklyHours: 14, maxConsecutiveHours: 3, preferredDays: ['Wed', 'Thu', 'Fri'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ee-09', departmentId: 'dept-ee', name: 'Engr. James Wilson', email: 'j.wilson@wpi.edu', title: 'Lab Engineer', maxWeeklyHours: 18, maxConsecutiveHours: 4, preferredDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ee-10', departmentId: 'dept-ee', name: 'Engr. Layla Noor', email: 'l.noor@wpi.edu', title: 'Lab Engineer', maxWeeklyHours: 18, maxConsecutiveHours: 4, preferredDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], unavailableSlots: [], is_sample: true, isSample: true },

  // Business Administration: 10 instructors
  { id: 'inst-ba-01', departmentId: 'dept-ba', name: 'Dr. Katherine Reynolds', email: 'k.reynolds@wpi.edu', title: 'Registrar & Professor', maxWeeklyHours: 8, maxConsecutiveHours: 2, preferredDays: ['Tue', 'Thu'], unavailableSlots: [{ day: 'Mon', timeSlot: '09:00 - 17:00', reason: 'Admin Day' }], is_sample: true, isSample: true },
  { id: 'inst-ba-02', departmentId: 'dept-ba', name: 'Dr. William Sterling', email: 'w.sterling@wpi.edu', title: 'Professor & Dean', maxWeeklyHours: 10, maxConsecutiveHours: 2, preferredDays: ['Wed', 'Fri'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ba-03', departmentId: 'dept-ba', name: 'Dr. Farida Khan', email: 'f.khan@wpi.edu', title: 'Associate Professor of Finance', maxWeeklyHours: 15, maxConsecutiveHours: 3, preferredDays: ['Mon', 'Wed', 'Fri'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ba-04', departmentId: 'dept-ba', name: 'Dr. George Bradley', email: 'g.bradley@wpi.edu', title: 'Associate Professor of Marketing', maxWeeklyHours: 15, maxConsecutiveHours: 3, preferredDays: ['Mon', 'Tue', 'Thu'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ba-05', departmentId: 'dept-ba', name: 'Dr. Hina Asif', email: 'h.asif@wpi.edu', title: 'Assistant Professor of Accounting', maxWeeklyHours: 14, maxConsecutiveHours: 3, preferredDays: ['Tue', 'Thu', 'Fri'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ba-06', departmentId: 'dept-ba', name: 'Dr. Jonathan Davis', email: 'j.davis@wpi.edu', title: 'Senior Lecturer', maxWeeklyHours: 16, maxConsecutiveHours: 3, preferredDays: ['Mon', 'Tue', 'Wed', 'Thu'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ba-07', departmentId: 'dept-ba', name: 'Dr. Sarah Jenkins', email: 's.jenkins@wpi.edu', title: 'Assistant Professor', maxWeeklyHours: 14, maxConsecutiveHours: 3, preferredDays: ['Mon', 'Wed', 'Fri'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ba-08', departmentId: 'dept-ba', name: 'Dr. Victor Hugo-Rios', email: 'v.rios@wpi.edu', title: 'Lecturer in Economics', maxWeeklyHours: 16, maxConsecutiveHours: 3, preferredDays: ['Mon', 'Tue', 'Wed'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ba-09', departmentId: 'dept-ba', name: 'Dr. Emily Watson', email: 'e.watson@wpi.edu', title: 'Assistant Professor of Management', maxWeeklyHours: 14, maxConsecutiveHours: 3, preferredDays: ['Wed', 'Thu', 'Fri'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ba-10', departmentId: 'dept-ba', name: 'Prof. Omar Farooq', email: 'o.farooq@wpi.edu', title: 'Adjunct Professor (Part-time)', maxWeeklyHours: 8, maxConsecutiveHours: 2, preferredDays: ['Tue', 'Thu'], unavailableSlots: [{ day: 'Mon', timeSlot: '09:00 - 17:00', reason: 'Industry' }, { day: 'Wed', timeSlot: '09:00 - 17:00', reason: 'Industry' }, { day: 'Fri', timeSlot: '09:00 - 17:00', reason: 'Industry' }], is_sample: true, isSample: true },

  // Mathematics and Sciences: 11 instructors
  { id: 'inst-ms-01', departmentId: 'dept-ms', name: 'Dr. Rajesh Raman', email: 'r.raman@wpi.edu', title: 'Professor of Mathematics', maxWeeklyHours: 16, maxConsecutiveHours: 3, preferredDays: ['Mon', 'Wed', 'Fri'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ms-02', departmentId: 'dept-ms', name: 'Dr. Ananya Sen', email: 'a.sen@wpi.edu', title: 'Associate Professor of Statistics', maxWeeklyHours: 15, maxConsecutiveHours: 3, preferredDays: ['Mon', 'Tue', 'Thu'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ms-03', departmentId: 'dept-ms', name: 'Dr. Sofia Gomez', email: 's.gomez@wpi.edu', title: 'Associate Professor of Humanities', maxWeeklyHours: 14, maxConsecutiveHours: 3, preferredDays: ['Mon', 'Wed', 'Fri'], unavailableSlots: [{ day: 'Tue', timeSlot: '09:00 - 12:00', reason: 'Ethics Board' }], is_sample: true, isSample: true },
  { id: 'inst-ms-04', departmentId: 'dept-ms', name: 'Dr. Richard Feynman-Lee', email: 'r.lee@wpi.edu', title: 'Professor of Applied Physics (Joint MS/EE)', maxWeeklyHours: 15, maxConsecutiveHours: 3, preferredDays: ['Mon', 'Tue', 'Thu'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ms-05', departmentId: 'dept-ms', name: 'Dr. Paul Dirac-Jones', email: 'p.jones@wpi.edu', title: 'Associate Professor of Physics', maxWeeklyHours: 14, maxConsecutiveHours: 3, preferredDays: ['Wed', 'Thu', 'Fri'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ms-06', departmentId: 'dept-ms', name: 'Dr. Marie Curie-Sloan', email: 'm.sloan@wpi.edu', title: 'Professor of Chemistry', maxWeeklyHours: 14, maxConsecutiveHours: 3, preferredDays: ['Mon', 'Tue', 'Wed'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ms-07', departmentId: 'dept-ms', name: 'Dr. Lisa Meitner-Kaur', email: 'l.kaur@wpi.edu', title: 'Assistant Professor of Physics', maxWeeklyHours: 12, maxConsecutiveHours: 3, preferredDays: ['Tue', 'Wed', 'Fri'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ms-08', departmentId: 'dept-ms', name: 'Dr. John Nash-Green', email: 'j.green@wpi.edu', title: 'Associate Professor of Calculus', maxWeeklyHours: 16, maxConsecutiveHours: 3, preferredDays: ['Mon', 'Wed', 'Fri'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ms-09', departmentId: 'dept-ms', name: 'Dr. Carl Gauss-Brown', email: 'c.brown@wpi.edu', title: 'Part-Time Lecturer (Tue/Thu Only)', maxWeeklyHours: 8, maxConsecutiveHours: 2, preferredDays: ['Tue', 'Thu'], unavailableSlots: [{ day: 'Mon', timeSlot: '09:00 - 17:00', reason: 'Part-time' }, { day: 'Wed', timeSlot: '09:00 - 17:00', reason: 'Part-time' }, { day: 'Fri', timeSlot: '09:00 - 17:00', reason: 'Part-time' }], is_sample: true, isSample: true },
  { id: 'inst-ms-10', departmentId: 'dept-ms', name: 'Dr. Emmy Noether-Hall', email: 'e.hall@wpi.edu', title: 'Assistant Professor of Algebra', maxWeeklyHours: 14, maxConsecutiveHours: 3, preferredDays: ['Mon', 'Tue', 'Thu'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ms-11', departmentId: 'dept-ms', name: 'Dr. Alan Turing-White', email: 'a.white@wpi.edu', title: 'Lecturer in Discrete Mathematics', maxWeeklyHours: 15, maxConsecutiveHours: 3, preferredDays: ['Tue', 'Wed', 'Fri'], unavailableSlots: [], is_sample: true, isSample: true },

  // Civil & Architectural Engineering: 10 instructors
  { id: 'inst-ce-01', departmentId: 'dept-ce', name: 'Prof. Donald Campbell', email: 'd.campbell@wpi.edu', title: 'Professor & Chair', maxWeeklyHours: 10, maxConsecutiveHours: 2, preferredDays: ['Tue', 'Thu'], unavailableSlots: [{ day: 'Fri', timeSlot: '09:00 - 13:00', reason: 'Site Inspection' }], is_sample: true, isSample: true },
  { id: 'inst-ce-02', departmentId: 'dept-ce', name: 'Dr. Linda Morales', email: 'l.morales@wpi.edu', title: 'Associate Professor', maxWeeklyHours: 15, maxConsecutiveHours: 3, preferredDays: ['Mon', 'Wed', 'Fri'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ce-03', departmentId: 'dept-ce', name: 'Dr. Hassan Al-Banna', email: 'h.albanna@wpi.edu', title: 'Professor of Structural Engineering', maxWeeklyHours: 14, maxConsecutiveHours: 3, preferredDays: ['Mon', 'Tue', 'Thu'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ce-04', departmentId: 'dept-ce', name: 'Dr. Elena Rostova', email: 'e.rostova@wpi.edu', title: 'Associate Professor of Geotechnical', maxWeeklyHours: 14, maxConsecutiveHours: 3, preferredDays: ['Wed', 'Thu', 'Fri'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ce-05', departmentId: 'dept-ce', name: 'Dr. Mark Peterson', email: 'm.peterson@wpi.edu', title: 'Assistant Professor of Transportation', maxWeeklyHours: 14, maxConsecutiveHours: 3, preferredDays: ['Mon', 'Tue', 'Wed'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ce-06', departmentId: 'dept-ce', name: 'Dr. Yasmin Qureshi', email: 'y.qureshi@wpi.edu', title: 'Assistant Professor of Architecture', maxWeeklyHours: 14, maxConsecutiveHours: 3, preferredDays: ['Tue', 'Wed', 'Fri'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ce-07', departmentId: 'dept-ce', name: 'Prof. Santiago Calatrava-Smith', email: 's.smith@wpi.edu', title: 'Distinguished Studio Master', maxWeeklyHours: 12, maxConsecutiveHours: 4, preferredDays: ['Mon', 'Wed'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ce-08', departmentId: 'dept-ce', name: 'Dr. Frank Lloyd-Wrightson', email: 'f.wrightson@wpi.edu', title: 'Senior Studio Master', maxWeeklyHours: 14, maxConsecutiveHours: 4, preferredDays: ['Tue', 'Thu'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ce-09', departmentId: 'dept-ce', name: 'Dr. Zaha Hadid-Mirza', email: 'z.mirza@wpi.edu', title: 'Associate Professor of Urbanism', maxWeeklyHours: 12, maxConsecutiveHours: 3, preferredDays: ['Wed', 'Fri'], unavailableSlots: [], is_sample: true, isSample: true },
  { id: 'inst-ce-10', departmentId: 'dept-ce', name: 'Engr. Tariq Nabeel', email: 't.nabeel@wpi.edu', title: 'Surveying Lab Instructor', maxWeeklyHours: 18, maxConsecutiveHours: 4, preferredDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], unavailableSlots: [], is_sample: true, isSample: true }
];

// Helper to generate courses, classes, and sections
// Let's create ~120 courses
export const largeSampleCourses: Course[] = [
  // --- Computer Science (30 courses) ---
  { id: 'crs-cs-101', departmentId: 'dept-cs', code: 'CS-101', title: 'Programming Fundamentals', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-cs-102', departmentId: 'dept-cs', code: 'CS-102', title: 'Object Oriented Programming', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-cs-201', departmentId: 'dept-cs', code: 'CS-201', title: 'Data Structures & Algorithms', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-cs-202', departmentId: 'dept-cs', code: 'CS-202', title: 'Database Systems', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-cs-203', departmentId: 'dept-cs', code: 'CS-203', title: 'Computer Architecture', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-cs-301', departmentId: 'dept-cs', code: 'CS-301', title: 'Operating Systems', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-cs-302', departmentId: 'dept-cs', code: 'CS-302', title: 'Computer Networks', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-cs-303', departmentId: 'dept-cs', code: 'CS-303', title: 'Software Engineering Concepts', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-cs-304', departmentId: 'dept-cs', code: 'CS-304', title: 'Theory of Automata', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-cs-305', departmentId: 'dept-cs', code: 'CS-305', title: 'Design & Analysis of Algorithms', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-cs-401', departmentId: 'dept-cs', code: 'CS-401', title: 'Distributed Cloud Systems', creditHours: 4, weeklyContactHours: 4, lectureHours: 3, labHours: 1, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-cs-402', departmentId: 'dept-cs', code: 'CS-402', title: 'Artificial Intelligence', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-cs-403', departmentId: 'dept-cs', code: 'CS-403', title: 'Machine Learning & Neural Nets', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-cs-404', departmentId: 'dept-cs', code: 'CS-404', title: 'Information & Cyber Security', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-cs-405', departmentId: 'dept-cs', code: 'CS-405', title: 'Compiler Construction', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-cs-406', departmentId: 'dept-cs', code: 'CS-406', title: 'Computer Graphics & Shaders', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  // SE Specific
  { id: 'crs-se-201', departmentId: 'dept-cs', code: 'SE-201', title: 'Software Requirements Engineering', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-se-301', departmentId: 'dept-cs', code: 'SE-301', title: 'Software Architecture & Design', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-se-302', departmentId: 'dept-cs', code: 'SE-302', title: 'Software Quality Assurance', creditHours: 4, weeklyContactHours: 4, lectureHours: 3, labHours: 1, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-se-401', departmentId: 'dept-cs', code: 'SE-401', title: 'Software Project Management', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-se-402', departmentId: 'dept-cs', code: 'SE-402', title: 'DevOps & Continuous Delivery', creditHours: 3, weeklyContactHours: 4, lectureHours: 2, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  // AI Specific
  { id: 'crs-ai-201', departmentId: 'dept-cs', code: 'AI-201', title: 'Foundations of AI & Logic', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ai-301', departmentId: 'dept-cs', code: 'AI-301', title: 'Knowledge Representation', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ai-302', departmentId: 'dept-cs', code: 'AI-302', title: 'Natural Language Processing', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-ai-401', departmentId: 'dept-cs', code: 'AI-401', title: 'Computer Vision & Deep Learning', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-ai-402', departmentId: 'dept-cs', code: 'AI-402', title: 'Reinforcement Learning & Robotics', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  // DS Specific
  { id: 'crs-ds-201', departmentId: 'dept-cs', code: 'DS-201', title: 'Introduction to Data Science', creditHours: 3, weeklyContactHours: 4, lectureHours: 2, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-ds-301', departmentId: 'dept-cs', code: 'DS-301', title: 'Data Mining & Warehouse', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-ds-302', departmentId: 'dept-cs', code: 'DS-302', title: 'Big Data Processing Frameworks', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-ds-401', departmentId: 'dept-cs', code: 'DS-401', title: 'Predictive Analytics & Modeling', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },

  // --- Electrical Engineering (22 courses) ---
  { id: 'crs-ee-101', departmentId: 'dept-ee', code: 'EE-101', title: 'Linear Circuit Analysis I', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-ee-102', departmentId: 'dept-ee', code: 'EE-102', title: 'Electrical Network Analysis II', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-ee-201', departmentId: 'dept-ee', code: 'EE-201', title: 'Electronic Devices & Circuits', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-ee-202', departmentId: 'dept-ee', code: 'EE-202', title: 'Digital Logic Design', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-ee-203', departmentId: 'dept-ee', code: 'EE-203', title: 'Signals and Systems', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ee-204', departmentId: 'dept-ee', code: 'EE-204', title: 'Electromagnetic Field Theory', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ee-301', departmentId: 'dept-ee', code: 'EE-301', title: 'Microprocessor Interfacing', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-ee-302', departmentId: 'dept-ee', code: 'EE-302', title: 'Feedback Control Systems', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-ee-303', departmentId: 'dept-ee', code: 'EE-303', title: 'Communication Systems', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-ee-304', departmentId: 'dept-ee', code: 'EE-304', title: 'Electrical Machines & Transformers', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-ee-401', departmentId: 'dept-ee', code: 'EE-401', title: 'Power System Analysis', creditHours: 4, weeklyContactHours: 4, lectureHours: 3, labHours: 1, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ee-402', departmentId: 'dept-ee', code: 'EE-402', title: 'Power Electronics Converters', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-ee-403', departmentId: 'dept-ee', code: 'EE-403', title: 'Renewable Energy Systems', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ee-404', departmentId: 'dept-ee', code: 'EE-404', title: 'Digital Signal Processing', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  // Electronics Specific
  { id: 'crs-el-201', departmentId: 'dept-ee', code: 'EL-201', title: 'Analog Integrated Circuits', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-el-301', departmentId: 'dept-ee', code: 'EL-301', title: 'VLSI Circuit Design', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-el-302', departmentId: 'dept-ee', code: 'EL-302', title: 'Embedded Systems & IoT', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-el-401', departmentId: 'dept-ee', code: 'EL-401', title: 'RF and Microwave Engineering', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-el-402', departmentId: 'dept-ee', code: 'EL-402', title: 'Optoelectronics & Photonics', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-el-403', departmentId: 'dept-ee', code: 'EL-403', title: 'Biomedical Instrumentation', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-el-404', departmentId: 'dept-ee', code: 'EL-404', title: 'Instrumentation & Measurements', creditHours: 3, weeklyContactHours: 4, lectureHours: 2, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-ee-499', departmentId: 'dept-ee', code: 'EE-499', title: 'Senior Engineering Capstone', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'seminar', is_sample: true, isSample: true },

  // --- Business Administration & Management (22 courses) ---
  { id: 'crs-ba-101', departmentId: 'dept-ba', code: 'BA-101', title: 'Principles of Management', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ba-102', departmentId: 'dept-ba', code: 'BA-102', title: 'Financial Accounting Fundamentals', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ba-201', departmentId: 'dept-ba', code: 'BA-201', title: 'Microeconomics for Managers', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ba-202', departmentId: 'dept-ba', code: 'BA-202', title: 'Macroeconomic Principles', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ba-203', departmentId: 'dept-ba', code: 'BA-203', title: 'Managerial Accounting', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ba-204', departmentId: 'dept-ba', code: 'BA-204', title: 'Principles of Marketing', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ba-205', departmentId: 'dept-ba', code: 'BA-205', title: 'Business Communication & Media', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ba-301', departmentId: 'dept-ba', code: 'BA-301', title: 'Corporate Business Finance', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ba-302', departmentId: 'dept-ba', code: 'BA-302', title: 'Organizational Behavior', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ba-303', departmentId: 'dept-ba', code: 'BA-303', title: 'Business Law & Corporate Ethics', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ba-304', departmentId: 'dept-ba', code: 'BA-304', title: 'Human Resource Management', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ba-305', departmentId: 'dept-ba', code: 'BA-305', title: 'Consumer Behavior & Market Research', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ba-401', departmentId: 'dept-ba', code: 'BA-401', title: 'Strategic Corporate Management', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ba-402', departmentId: 'dept-ba', code: 'BA-402', title: 'Operations & Supply Chain Logistics', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ba-403', departmentId: 'dept-ba', code: 'BA-403', title: 'International Business Environment', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ba-404', departmentId: 'dept-ba', code: 'BA-404', title: 'Entrepreneurship & Innovation Incubator', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'seminar', is_sample: true, isSample: true },
  // Accounting & Finance Specific
  { id: 'crs-af-201', departmentId: 'dept-ba', code: 'AF-201', title: 'Cost Accounting & Decision Making', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-af-301', departmentId: 'dept-ba', code: 'AF-301', title: 'Financial Institutions & Markets', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-af-302', departmentId: 'dept-ba', code: 'AF-302', title: 'Corporate Financial Reporting', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-af-401', departmentId: 'dept-ba', code: 'AF-401', title: 'Investment Analysis & Portfolio Theory', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-af-402', departmentId: 'dept-ba', code: 'AF-402', title: 'Taxation & Auditing Standards', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-af-403', departmentId: 'dept-ba', code: 'AF-403', title: 'Financial Risk Analytics', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },

  // --- Mathematics and Sciences (Shared Service + Core, 24 courses) ---
  { id: 'crs-mt-101', departmentId: 'dept-ms', code: 'MT-101', title: 'Calculus I: Differential Analysis', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-mt-102', departmentId: 'dept-ms', code: 'MT-102', title: 'Calculus II: Integral Analysis', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-mt-201', departmentId: 'dept-ms', code: 'MT-201', title: 'Linear Algebra & Matrix Theory', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-mt-202', departmentId: 'dept-ms', code: 'MT-202', title: 'Differential Equations', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-mt-203', departmentId: 'dept-ms', code: 'MT-203', title: 'Multivariable Calculus', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-mt-204', departmentId: 'dept-ms', code: 'MT-204', title: 'Discrete Mathematics', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-mt-301', departmentId: 'dept-ms', code: 'MT-301', title: 'Probability & Statistics', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-mt-302', departmentId: 'dept-ms', code: 'MT-302', title: 'Numerical Computing Methods', creditHours: 3, weeklyContactHours: 4, lectureHours: 2, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-mt-303', departmentId: 'dept-ms', code: 'MT-303', title: 'Complex Variables & Transforms', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-mt-401', departmentId: 'dept-ms', code: 'MT-401', title: 'Real Analysis & Metric Spaces', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-mt-402', departmentId: 'dept-ms', code: 'MT-402', title: 'Abstract Algebra', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-mt-403', departmentId: 'dept-ms', code: 'MT-403', title: 'Mathematical Optimization & Operations Research', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  // Physics & Core Sciences
  { id: 'crs-ph-101', departmentId: 'dept-ms', code: 'PH-101', title: 'Applied Physics: Mechanics & Heat', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-ph-102', departmentId: 'dept-ms', code: 'PH-102', title: 'Applied Physics: Electromagnetism', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-ph-201', departmentId: 'dept-ms', code: 'PH-201', title: 'Waves, Oscillations & Optics', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-ph-202', departmentId: 'dept-ms', code: 'PH-202', title: 'Classical Analytical Mechanics', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ph-301', departmentId: 'dept-ms', code: 'PH-301', title: 'Quantum Mechanics I', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ph-302', departmentId: 'dept-ms', code: 'PH-302', title: 'Thermodynamics & Statistical Physics', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ph-401', departmentId: 'dept-ms', code: 'PH-401', title: 'Solid State Physics', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-ph-402', departmentId: 'dept-ms', code: 'PH-402', title: 'Nuclear & Particle Physics', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  // Common Service Humanities
  { id: 'crs-en-101', departmentId: 'dept-ms', code: 'EN-101', title: 'Functional English & Reading', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-en-102', departmentId: 'dept-ms', code: 'EN-102', title: 'Technical & Report Writing', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ss-101', departmentId: 'dept-ms', code: 'SS-101', title: 'Professional Ethics & Governance', creditHours: 2, weeklyContactHours: 2, lectureHours: 2, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ss-102', departmentId: 'dept-ms', code: 'SS-102', title: 'Cultural Heritage & Civilizations', creditHours: 2, weeklyContactHours: 2, lectureHours: 2, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },

  // --- Civil & Architectural Engineering (22 courses) ---
  { id: 'crs-ce-101', departmentId: 'dept-ce', code: 'CE-101', title: 'Engineering Drawing & CAD', creditHours: 3, weeklyContactHours: 4, lectureHours: 2, labHours: 2, requiredRoomType: 'studio', is_sample: true, isSample: true },
  { id: 'crs-ce-102', departmentId: 'dept-ce', code: 'CE-102', title: 'Engineering Statics', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ce-103', departmentId: 'dept-ce', code: 'CE-103', title: 'Surveying Theory & Fieldwork', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-ce-201', departmentId: 'dept-ce', code: 'CE-201', title: 'Fluid Mechanics & Hydraulics', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-ce-202', departmentId: 'dept-ce', code: 'CE-202', title: 'Strength of Materials', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-ce-203', departmentId: 'dept-ce', code: 'CE-203', title: 'Engineering Geology & Rocks', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ce-301', departmentId: 'dept-ce', code: 'CE-301', title: 'Structural Analysis I', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ce-302', departmentId: 'dept-ce', code: 'CE-302', title: 'Structural Analysis II (Indeterminate)', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ce-303', departmentId: 'dept-ce', code: 'CE-303', title: 'Soil Mechanics & Foundations', creditHours: 4, weeklyContactHours: 5, lectureHours: 3, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-ce-304', departmentId: 'dept-ce', code: 'CE-304', title: 'Transportation Engineering', creditHours: 4, weeklyContactHours: 4, lectureHours: 3, labHours: 1, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ce-305', departmentId: 'dept-ce', code: 'CE-305', title: 'Environmental Engineering & Treatment', creditHours: 3, weeklyContactHours: 4, lectureHours: 2, labHours: 2, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-ce-401', departmentId: 'dept-ce', code: 'CE-401', title: 'Reinforced Concrete Design', creditHours: 4, weeklyContactHours: 4, lectureHours: 3, labHours: 1, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ce-402', departmentId: 'dept-ce', code: 'CE-402', title: 'Steel Structural Design', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ce-403', departmentId: 'dept-ce', code: 'CE-403', title: 'Construction Management & Costing', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ce-404', departmentId: 'dept-ce', code: 'CE-404', title: 'Hydrology & Water Resource Eng', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  // Architecture Specific
  { id: 'crs-ar-101', departmentId: 'dept-ce', code: 'AR-101', title: 'Architectural Graphic Studio I', creditHours: 4, weeklyContactHours: 6, lectureHours: 2, labHours: 4, requiredRoomType: 'studio', is_sample: true, isSample: true },
  { id: 'crs-ar-102', departmentId: 'dept-ce', code: 'AR-102', title: 'Visual Communication & Freehand', creditHours: 3, weeklyContactHours: 4, lectureHours: 1, labHours: 3, requiredRoomType: 'studio', is_sample: true, isSample: true },
  { id: 'crs-ar-201', departmentId: 'dept-ce', code: 'AR-201', title: 'Architectural Design Studio II', creditHours: 5, weeklyContactHours: 7, lectureHours: 2, labHours: 5, requiredRoomType: 'studio', is_sample: true, isSample: true },
  { id: 'crs-ar-202', departmentId: 'dept-ce', code: 'AR-202', title: 'History of Western Architecture', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ar-301', departmentId: 'dept-ce', code: 'AR-301', title: 'Comprehensive Urban Studio', creditHours: 5, weeklyContactHours: 7, lectureHours: 2, labHours: 5, requiredRoomType: 'studio', is_sample: true, isSample: true },
  { id: 'crs-ar-302', departmentId: 'dept-ce', code: 'AR-302', title: 'Building Services & HVAC Systems', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-ar-401', departmentId: 'dept-ce', code: 'AR-401', title: 'Sustainable Facade & Energy Envelope', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'seminar', is_sample: true, isSample: true }
];

// 7. 42 Classes (Student Groups) across the 12 Programs
export const largeSampleStudentGroups: StudentGroup[] = [
  // BSCS: 6 classes
  { id: 'grp-bscs-1a', programId: 'prog-bsc-cs', name: 'BSCS Sem 1 - A', code: 'BSCS-1A', year: 1, semester: 1, section: 'A', size: 55, sharedCourseIds: ['crs-cs-101', 'crs-mt-101', 'crs-ph-101', 'crs-en-101', 'crs-ss-101'], is_sample: true, isSample: true },
  { id: 'grp-bscs-1b', programId: 'prog-bsc-cs', name: 'BSCS Sem 1 - B', code: 'BSCS-1B', year: 1, semester: 1, section: 'B', size: 50, sharedCourseIds: ['crs-cs-101', 'crs-mt-101', 'crs-ph-101', 'crs-en-101', 'crs-ss-101'], is_sample: true, isSample: true },
  { id: 'grp-bscs-3a', programId: 'prog-bsc-cs', name: 'BSCS Sem 3 - A', code: 'BSCS-3A', year: 2, semester: 3, section: 'A', size: 52, sharedCourseIds: ['crs-cs-201', 'crs-cs-202', 'crs-cs-203', 'crs-mt-201', 'crs-en-102'], is_sample: true, isSample: true },
  { id: 'grp-bscs-3b', programId: 'prog-bsc-cs', name: 'BSCS Sem 3 - B', code: 'BSCS-3B', year: 2, semester: 3, section: 'B', size: 48, sharedCourseIds: ['crs-cs-201', 'crs-cs-202', 'crs-cs-203', 'crs-mt-201', 'crs-en-102'], is_sample: true, isSample: true },
  { id: 'grp-bscs-5a', programId: 'prog-bsc-cs', name: 'BSCS Sem 5 - A', code: 'BSCS-5A', year: 3, semester: 5, section: 'A', size: 45, sharedCourseIds: ['crs-cs-301', 'crs-cs-302', 'crs-cs-304', 'crs-cs-305', 'crs-mt-301'], is_sample: true, isSample: true },
  { id: 'grp-bscs-7a', programId: 'prog-bsc-cs', name: 'BSCS Sem 7 - A', code: 'BSCS-7A', year: 4, semester: 7, section: 'A', size: 40, sharedCourseIds: ['crs-cs-401', 'crs-cs-402', 'crs-cs-404', 'crs-cs-405', 'crs-ba-101'], is_sample: true, isSample: true },

  // BSSE: 4 classes
  { id: 'grp-bsse-1a', programId: 'prog-bsc-se', name: 'BSSE Sem 1 - A', code: 'BSSE-1A', year: 1, semester: 1, section: 'A', size: 50, sharedCourseIds: ['crs-cs-101', 'crs-mt-101', 'crs-ph-101', 'crs-en-101', 'crs-ss-101'], is_sample: true, isSample: true },
  { id: 'grp-bsse-3a', programId: 'prog-bsc-se', name: 'BSSE Sem 3 - A', code: 'BSSE-3A', year: 2, semester: 3, section: 'A', size: 46, sharedCourseIds: ['crs-cs-201', 'crs-se-201', 'crs-cs-202', 'crs-mt-201', 'crs-en-102'], is_sample: true, isSample: true },
  { id: 'grp-bsse-5a', programId: 'prog-bsc-se', name: 'BSSE Sem 5 - A', code: 'BSSE-5A', year: 3, semester: 5, section: 'A', size: 42, sharedCourseIds: ['crs-se-301', 'crs-se-302', 'crs-cs-301', 'crs-cs-302', 'crs-mt-301'], is_sample: true, isSample: true },
  { id: 'grp-bsse-7a', programId: 'prog-bsc-se', name: 'BSSE Sem 7 - A', code: 'BSSE-7A', year: 4, semester: 7, section: 'A', size: 38, sharedCourseIds: ['crs-se-401', 'crs-se-402', 'crs-cs-404', 'crs-ba-401'], is_sample: true, isSample: true },

  // BSAI: 3 classes
  { id: 'grp-bsai-1a', programId: 'prog-bsc-ai', name: 'BSAI Sem 1 - A', code: 'BSAI-1A', year: 1, semester: 1, section: 'A', size: 48, sharedCourseIds: ['crs-cs-101', 'crs-mt-101', 'crs-ph-101', 'crs-en-101', 'crs-ss-101'], is_sample: true, isSample: true },
  { id: 'grp-bsai-3a', programId: 'prog-bsc-ai', name: 'BSAI Sem 3 - A', code: 'BSAI-3A', year: 2, semester: 3, section: 'A', size: 44, sharedCourseIds: ['crs-cs-201', 'crs-ai-201', 'crs-mt-201', 'crs-mt-204', 'crs-en-102'], is_sample: true, isSample: true },
  { id: 'grp-bsai-5a', programId: 'prog-bsc-ai', name: 'BSAI Sem 5 - A', code: 'BSAI-5A', year: 3, semester: 5, section: 'A', size: 40, sharedCourseIds: ['crs-ai-301', 'crs-ai-302', 'crs-cs-403', 'crs-mt-301'], is_sample: true, isSample: true },

  // BSDS: 2 classes
  { id: 'grp-bsds-1a', programId: 'prog-bsc-ds', name: 'BSDS Sem 1 - A', code: 'BSDS-1A', year: 1, semester: 1, section: 'A', size: 45, sharedCourseIds: ['crs-cs-101', 'crs-mt-101', 'crs-ph-101', 'crs-en-101', 'crs-ss-101'], is_sample: true, isSample: true },
  { id: 'grp-bsds-3a', programId: 'prog-bsc-ds', name: 'BSDS Sem 3 - A', code: 'BSDS-3A', year: 2, semester: 3, section: 'A', size: 42, sharedCourseIds: ['crs-cs-201', 'crs-ds-201', 'crs-cs-202', 'crs-mt-201', 'crs-mt-301'], is_sample: true, isSample: true },

  // BSEE: 5 classes
  { id: 'grp-bsee-1a', programId: 'prog-bsc-ee', name: 'BSEE Sem 1 - A', code: 'BSEE-1A', year: 1, semester: 1, section: 'A', size: 55, sharedCourseIds: ['crs-ee-101', 'crs-mt-101', 'crs-ph-101', 'crs-en-101', 'crs-cs-101'], is_sample: true, isSample: true },
  { id: 'grp-bsee-1b', programId: 'prog-bsc-ee', name: 'BSEE Sem 1 - B', code: 'BSEE-1B', year: 1, semester: 1, section: 'B', size: 50, sharedCourseIds: ['crs-ee-101', 'crs-mt-101', 'crs-ph-101', 'crs-en-101', 'crs-cs-101'], is_sample: true, isSample: true },
  { id: 'grp-bsee-3a', programId: 'prog-bsc-ee', name: 'BSEE Sem 3 - A', code: 'BSEE-3A', year: 2, semester: 3, section: 'A', size: 48, sharedCourseIds: ['crs-ee-201', 'crs-ee-202', 'crs-ee-203', 'crs-mt-201', 'crs-mt-202'], is_sample: true, isSample: true },
  { id: 'grp-bsee-5a', programId: 'prog-bsc-ee', name: 'BSEE Sem 5 - A', code: 'BSEE-5A', year: 3, semester: 5, section: 'A', size: 42, sharedCourseIds: ['crs-ee-301', 'crs-ee-302', 'crs-ee-303', 'crs-ee-304', 'crs-mt-301'], is_sample: true, isSample: true },
  { id: 'grp-bsee-7a', programId: 'prog-bsc-ee', name: 'BSEE Sem 7 - A', code: 'BSEE-7A', year: 4, semester: 7, section: 'A', size: 36, sharedCourseIds: ['crs-ee-401', 'crs-ee-402', 'crs-ee-403', 'crs-ee-499', 'crs-ba-101'], is_sample: true, isSample: true },

  // BSElec: 3 classes
  { id: 'grp-bselec-1a', programId: 'prog-bsc-elec', name: 'BSElec Sem 1 - A', code: 'BSElec-1A', year: 1, semester: 1, section: 'A', size: 40, sharedCourseIds: ['crs-ee-101', 'crs-mt-101', 'crs-ph-101', 'crs-en-101', 'crs-cs-101'], is_sample: true, isSample: true },
  { id: 'grp-bselec-3a', programId: 'prog-bsc-elec', name: 'BSElec Sem 3 - A', code: 'BSElec-3A', year: 2, semester: 3, section: 'A', size: 38, sharedCourseIds: ['crs-el-201', 'crs-ee-202', 'crs-ee-203', 'crs-mt-201', 'crs-mt-202'], is_sample: true, isSample: true },
  { id: 'grp-bselec-5a', programId: 'prog-bsc-elec', name: 'BSElec Sem 5 - A', code: 'BSElec-5A', year: 3, semester: 5, section: 'A', size: 35, sharedCourseIds: ['crs-el-301', 'crs-el-302', 'crs-ee-303', 'crs-el-404', 'crs-mt-301'], is_sample: true, isSample: true },

  // BBA: 6 classes
  { id: 'grp-bba-1a', programId: 'prog-bba', name: 'BBA Sem 1 - A', code: 'BBA-1A', year: 1, semester: 1, section: 'A', size: 60, sharedCourseIds: ['crs-ba-101', 'crs-ba-102', 'crs-en-101', 'crs-mt-101', 'crs-ss-102'], is_sample: true, isSample: true },
  { id: 'grp-bba-1b', programId: 'prog-bba', name: 'BBA Sem 1 - B', code: 'BBA-1B', year: 1, semester: 1, section: 'B', size: 58, sharedCourseIds: ['crs-ba-101', 'crs-ba-102', 'crs-en-101', 'crs-mt-101', 'crs-ss-102'], is_sample: true, isSample: true },
  { id: 'grp-bba-3a', programId: 'prog-bba', name: 'BBA Sem 3 - A', code: 'BBA-3A', year: 2, semester: 3, section: 'A', size: 55, sharedCourseIds: ['crs-ba-201', 'crs-ba-203', 'crs-ba-204', 'crs-ba-205', 'crs-mt-301'], is_sample: true, isSample: true },
  { id: 'grp-bba-3b', programId: 'prog-bba', name: 'BBA Sem 3 - B', code: 'BBA-3B', year: 2, semester: 3, section: 'B', size: 52, sharedCourseIds: ['crs-ba-201', 'crs-ba-203', 'crs-ba-204', 'crs-ba-205', 'crs-mt-301'], is_sample: true, isSample: true },
  { id: 'grp-bba-5a', programId: 'prog-bba', name: 'BBA Sem 5 - A', code: 'BBA-5A', year: 3, semester: 5, section: 'A', size: 48, sharedCourseIds: ['crs-ba-301', 'crs-ba-302', 'crs-ba-303', 'crs-ba-304', 'crs-ba-305'], is_sample: true, isSample: true },
  { id: 'grp-bba-7a', programId: 'prog-bba', name: 'BBA Sem 7 - A', code: 'BBA-7A', year: 4, semester: 7, section: 'A', size: 42, sharedCourseIds: ['crs-ba-401', 'crs-ba-402', 'crs-ba-403', 'crs-ba-404', 'crs-ss-101'], is_sample: true, isSample: true },

  // BSAF: 3 classes
  { id: 'grp-bsaf-1a', programId: 'prog-bsc-af', name: 'BSAF Sem 1 - A', code: 'BSAF-1A', year: 1, semester: 1, section: 'A', size: 45, sharedCourseIds: ['crs-ba-101', 'crs-ba-102', 'crs-en-101', 'crs-mt-101', 'crs-ss-102'], is_sample: true, isSample: true },
  { id: 'grp-bsaf-3a', programId: 'prog-bsc-af', name: 'BSAF Sem 3 - A', code: 'BSAF-3A', year: 2, semester: 3, section: 'A', size: 40, sharedCourseIds: ['crs-ba-201', 'crs-af-201', 'crs-ba-203', 'crs-ba-205', 'crs-mt-301'], is_sample: true, isSample: true },
  { id: 'grp-bsaf-5a', programId: 'prog-bsc-af', name: 'BSAF Sem 5 - A', code: 'BSAF-5A', year: 3, semester: 5, section: 'A', size: 36, sharedCourseIds: ['crs-af-301', 'crs-af-302', 'crs-ba-301', 'crs-af-401'], is_sample: true, isSample: true },

  // BSMath: 2 classes
  { id: 'grp-bsmath-1a', programId: 'prog-bsc-math', name: 'BSMath Sem 1 - A', code: 'BSMath-1A', year: 1, semester: 1, section: 'A', size: 35, sharedCourseIds: ['crs-mt-101', 'crs-ph-101', 'crs-en-101', 'crs-cs-101', 'crs-ss-102'], is_sample: true, isSample: true },
  { id: 'grp-bsmath-3a', programId: 'prog-bsc-math', name: 'BSMath Sem 3 - A', code: 'BSMath-3A', year: 2, semester: 3, section: 'A', size: 32, sharedCourseIds: ['crs-mt-201', 'crs-mt-202', 'crs-mt-203', 'crs-mt-204', 'crs-ph-202'], is_sample: true, isSample: true },

  // BSPhy: 2 classes
  { id: 'grp-bsphy-1a', programId: 'prog-bsc-phy', name: 'BSPhy Sem 1 - A', code: 'BSPhy-1A', year: 1, semester: 1, section: 'A', size: 32, sharedCourseIds: ['crs-ph-101', 'crs-mt-101', 'crs-en-101', 'crs-cs-101', 'crs-ss-102'], is_sample: true, isSample: true },
  { id: 'grp-bsphy-3a', programId: 'prog-bsc-phy', name: 'BSPhy Sem 3 - A', code: 'BSPhy-3A', year: 2, semester: 3, section: 'A', size: 30, sharedCourseIds: ['crs-ph-201', 'crs-ph-202', 'crs-mt-201', 'crs-mt-202'], is_sample: true, isSample: true },

  // BSCE: 4 classes
  { id: 'grp-bsce-1a', programId: 'prog-bsc-ce', name: 'BSCE Sem 1 - A', code: 'BSCE-1A', year: 1, semester: 1, section: 'A', size: 55, sharedCourseIds: ['crs-ce-101', 'crs-ce-102', 'crs-mt-101', 'crs-ph-101', 'crs-en-101'], is_sample: true, isSample: true },
  { id: 'grp-bsce-3a', programId: 'prog-bsc-ce', name: 'BSCE Sem 3 - A', code: 'BSCE-3A', year: 2, semester: 3, section: 'A', size: 50, sharedCourseIds: ['crs-ce-201', 'crs-ce-202', 'crs-ce-203', 'crs-mt-201', 'crs-en-102'], is_sample: true, isSample: true },
  { id: 'grp-bsce-5a', programId: 'prog-bsc-ce', name: 'BSCE Sem 5 - A', code: 'BSCE-5A', year: 3, semester: 5, section: 'A', size: 45, sharedCourseIds: ['crs-ce-301', 'crs-ce-302', 'crs-ce-303', 'crs-ce-304', 'crs-ce-305'], is_sample: true, isSample: true },
  { id: 'grp-bsce-7a', programId: 'prog-bsc-ce', name: 'BSCE Sem 7 - A', code: 'BSCE-7A', year: 4, semester: 7, section: 'A', size: 40, sharedCourseIds: ['crs-ce-401', 'crs-ce-402', 'crs-ce-403', 'crs-ce-404', 'crs-ba-101'], is_sample: true, isSample: true },

  // BArch: 2 classes
  { id: 'grp-barch-1a', programId: 'prog-barch', name: 'BArch Sem 1 - A', code: 'BArch-1A', year: 1, semester: 1, section: 'A', size: 30, sharedCourseIds: ['crs-ar-101', 'crs-ar-102', 'crs-mt-101', 'crs-en-101', 'crs-ss-102'], is_sample: true, isSample: true },
  { id: 'grp-barch-3a', programId: 'prog-barch', name: 'BArch Sem 3 - A', code: 'BArch-3A', year: 2, semester: 3, section: 'A', size: 28, sharedCourseIds: ['crs-ar-201', 'crs-ar-202', 'crs-ce-202', 'crs-en-102'], is_sample: true, isSample: true }
];

// Helper to assign instructors and rooms to sections with zero conflicts
export function generateLargeSampleSections(): Section[] {
  const sections: Section[] = [];
  const days: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  const allValidSlots = [
    '9:00 – 9:50 AM',
    '10:00 – 10:50 AM',
    '11:00 – 11:50 AM',
    '12:00 – 12:50 PM',
    '2:00 – 2:50 PM',
    '3:00 – 3:50 PM',
    '4:00 – 4:50 PM'
  ];

  const validLabBlocks = [
    {
      startPeriod: '9:00 – 9:50 AM',
      coveredPeriods: ['9:00 – 9:50 AM', '10:00 – 10:50 AM', '11:00 – 11:50 AM'],
      continuousLabel: '9:00 AM – 12:00 PM'
    },
    {
      startPeriod: '10:00 – 10:50 AM',
      coveredPeriods: ['10:00 – 10:50 AM', '11:00 – 11:50 AM', '12:00 – 12:50 PM'],
      continuousLabel: '10:00 AM – 1:00 PM'
    },
    {
      startPeriod: '2:00 – 2:50 PM',
      coveredPeriods: ['2:00 – 2:50 PM', '3:00 – 3:50 PM', '4:00 – 4:50 PM'],
      continuousLabel: '2:00 PM – 5:00 PM'
    }
  ];

  // Map of instructors to department courses
  const instructorByDept: Record<string, string[]> = {
    'dept-cs': largeSampleInstructors.filter(i => i.departmentId === 'dept-cs').map(i => i.id),
    'dept-ee': largeSampleInstructors.filter(i => i.departmentId === 'dept-ee').map(i => i.id),
    'dept-ba': largeSampleInstructors.filter(i => i.departmentId === 'dept-ba').map(i => i.id),
    'dept-ms': largeSampleInstructors.filter(i => i.departmentId === 'dept-ms').map(i => i.id),
    'dept-ce': largeSampleInstructors.filter(i => i.departmentId === 'dept-ce').map(i => i.id)
  };

  const lectureRoomsList = largeSampleRooms.filter(r => r.type === 'lecture');
  const compLabList = largeSampleRooms.filter(r => r.code.includes('Computer Lab'));
  const elecLabList = largeSampleRooms.filter(r => r.code.includes('Electronics Lab'));
  const physLabList = largeSampleRooms.filter(r => r.code.includes('Physics') || r.code.includes('Materials'));
  const studioList = largeSampleRooms.filter(r => r.type === 'studio');
  const seminarList = largeSampleRooms.filter(r => r.type === 'seminar');

  // Track room and instructor bookings to ensure zero clashes across all covered hourly slots
  const bookedRoomSlots = new Set<string>(); // key: `${roomId}_${day}_${slot}`
  const bookedInstructorSlots = new Set<string>(); // key: `${instructorId}_${day}_${slot}`
  const bookedGroupSlots = new Set<string>(); // key: `${groupId}_${day}_${slot}`

  let secCounter = 1;

  largeSampleStudentGroups.forEach((group, gIdx) => {
    let cohortLabCount = 0;

    group.sharedCourseIds.forEach((courseId, cIdx) => {
      const course = largeSampleCourses.find(c => c.id === courseId);
      if (!course) return;

      const deptInstructors = instructorByDept[course.departmentId] || instructorByDept['dept-cs'];
      const instructorId = deptInstructors[(cIdx + gIdx) % deptInstructors.length];

      // 1) Schedule Regular 50-minute Lecture Session
      let lectureRooms = lectureRoomsList.filter(r => r.capacity >= group.size);
      if (course.requiredRoomType === 'seminar') {
        lectureRooms = seminarList.length > 0 ? seminarList : lectureRoomsList;
      }
      if (lectureRooms.length === 0) lectureRooms = lectureRoomsList;

      let assignedDay: DayOfWeek = days[(gIdx + cIdx) % days.length];
      let assignedSlot = allValidSlots[(cIdx + gIdx * 2) % allValidSlots.length];
      let assignedRoom = lectureRooms[(cIdx + gIdx) % lectureRooms.length];

      let foundLecture = false;
      for (const d of days) {
        for (const s of allValidSlots) {
          const groupKey = `${group.id}_${d}_${s}`;
          const instKey = `${instructorId}_${d}_${s}`;

          if (bookedGroupSlots.has(groupKey) || bookedInstructorSlots.has(instKey)) {
            continue;
          }

          for (const room of lectureRooms) {
            const roomKey = `${room.id}_${d}_${s}`;
            if (!bookedRoomSlots.has(roomKey)) {
              bookedRoomSlots.add(roomKey);
              bookedInstructorSlots.add(instKey);
              bookedGroupSlots.add(groupKey);
              assignedDay = d;
              assignedSlot = s;
              assignedRoom = room;
              foundLecture = true;
              break;
            }
          }
          if (foundLecture) break;
        }
        if (foundLecture) break;
      }

      sections.push({
        id: `sec-sample-${secCounter++}`,
        courseId: course.id,
        termId: largeSampleTerm.id,
        sectionNumber: `${group.section || 'A'}-Lec`,
        expectedEnrollment: group.size,
        instructorId,
        studentGroupId: group.id,
        sessionType: 'Lecture',
        spanSlots: 1,
        assignedSlot: {
          day: assignedDay,
          timeSlot: assignedSlot,
          roomId: assignedRoom.id,
          durationMinutes: 50,
          sessionType: 'Lecture',
          spanSlots: 1
        },
        isLocked: false,
        is_sample: true,
        isSample: true
      });

      // 2) If course has laboratory/studio hours, also schedule a 3-hour Continuous Lab block
      const hasLab = course.labHours > 0 || course.requiredRoomType === 'lab' || course.requiredRoomType === 'studio';
      if (hasLab && cohortLabCount < 2) {
        let labCandidateRooms = compLabList;
        if (course.requiredRoomType === 'studio') {
          labCandidateRooms = studioList;
        } else if (course.code.startsWith('EE') || course.code.startsWith('EL')) {
          labCandidateRooms = elecLabList;
        } else if (course.code.startsWith('PH') || course.code.startsWith('CH') || course.code.startsWith('CE')) {
          labCandidateRooms = physLabList;
        }
        if (labCandidateRooms.length === 0) labCandidateRooms = compLabList;

        let foundLab = false;
        for (const d of days) {
          for (const block of validLabBlocks) {
            const canGroup = block.coveredPeriods.every(p => !bookedGroupSlots.has(`${group.id}_${d}_${p}`));
            const canInst = block.coveredPeriods.every(p => !bookedInstructorSlots.has(`${instructorId}_${d}_${p}`));
            if (!canGroup || !canInst) continue;

            for (const labRoom of labCandidateRooms) {
              const canRoom = block.coveredPeriods.every(p => !bookedRoomSlots.has(`${labRoom.id}_${d}_${p}`));
              if (canRoom) {
                block.coveredPeriods.forEach(p => {
                  bookedGroupSlots.add(`${group.id}_${d}_${p}`);
                  bookedInstructorSlots.add(`${instructorId}_${d}_${p}`);
                  bookedRoomSlots.add(`${labRoom.id}_${d}_${p}`);
                });

                sections.push({
                  id: `sec-sample-${secCounter++}`,
                  courseId: course.id,
                  termId: largeSampleTerm.id,
                  sectionNumber: `${group.section || 'A'}-Lab`,
                  expectedEnrollment: Math.min(group.size, labRoom.capacity),
                  instructorId,
                  studentGroupId: group.id,
                  sessionType: 'Lab',
                  spanSlots: 3,
                  assignedSlot: {
                    day: d,
                    timeSlot: block.startPeriod,
                    roomId: labRoom.id,
                    durationMinutes: 180,
                    sessionType: 'Lab',
                    spanSlots: 3,
                    continuousTimeLabel: block.continuousLabel
                  },
                  isLocked: false,
                  is_sample: true,
                  isSample: true
                });

                cohortLabCount++;
                foundLab = true;
                break;
              }
            }
            if (foundLab) break;
          }
          if (foundLab) break;
        }
      }
    });
  });

  return sections;
}

export const largeSampleSections: Section[] = generateLargeSampleSections();

// 8. Time Structure (9:00 AM - 5:00 PM with fixed lunch break 1:00 PM - 2:00 PM)
export const largeSampleTimeStructure: TimeStructure = {
  id: 'standard-wpi-grid-sample',
  name: 'University Standard 9:00 AM – 5:00 PM Academic Grid',
  workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  periodLengthMinutes: 50,
  dayStartTime: '09:00',
  dayEndTime: '17:00',
  periods: [
    '9:00 – 9:50 AM',
    '10:00 – 10:50 AM',
    '11:00 – 11:50 AM',
    '12:00 – 12:50 PM',
    '2:00 – 2:50 PM',
    '3:00 – 3:50 PM',
    '4:00 – 4:50 PM'
  ],
  breaks: [
    {
      id: 'break-lunch',
      name: 'Fixed University Lunch Break (1:00 PM – 2:00 PM)',
      startTime: '13:00',
      endTime: '14:00',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    }
  ],
  is_sample: true,
  isSample: true
};

// 9. Rules (6 must-have, 5 preferences)
export const largeSampleConstraints: ConstraintRule[] = [
  { id: 'rule-sample-hc-01', code: 'HC-01', name: 'No Instructor Double-Booking', description: 'No instructor teaches two classes at the same time.', kind: 'hard', enabled: true, weight: 100, category: 'instructor', is_sample: true, isSample: true },
  { id: 'rule-sample-hc-02', code: 'HC-02', name: 'No Room Double-Booking', description: 'No room hosts two sessions at the same time.', kind: 'hard', enabled: true, weight: 100, category: 'room', is_sample: true, isSample: true },
  { id: 'rule-sample-hc-03', code: 'HC-03', name: 'Room Capacity Enforcement', description: 'Physical room capacity must be greater than or equal to class size.', kind: 'hard', enabled: true, weight: 100, category: 'room', is_sample: true, isSample: true },
  { id: 'rule-sample-hc-04', code: 'HC-04', name: 'Facility & Lab Type Match', description: 'Laboratory and studio sessions are strictly allocated to certified facility types.', kind: 'hard', enabled: true, weight: 100, category: 'facility', is_sample: true, isSample: true },
  { id: 'rule-sample-hc-05', code: 'HC-05', name: 'No Student Cohort Clash', description: 'No class cohort has two overlapping course sessions at the same time.', kind: 'hard', enabled: true, weight: 100, category: 'student', is_sample: true, isSample: true },
  { id: 'rule-sample-hc-06', code: 'HC-06', name: 'Instructor Unavailability Compliance', description: 'Respect instructor registered blackout days, times, and contractual load caps.', kind: 'hard', enabled: true, weight: 100, category: 'instructor', is_sample: true, isSample: true },
  // Soft
  { id: 'rule-sample-sc-01', code: 'SC-01', name: 'Minimize Student Schedule Gaps', description: 'Avoid idle schedule gaps longer than 60 minutes in a class day unless forming an Industrial visit.', kind: 'soft', enabled: true, weight: 85, category: 'student', is_sample: true, isSample: true },
  { id: 'rule-sample-sc-02', code: 'SC-02', name: 'Balanced Days & Course Spreading', description: 'Spread multiple sessions of the same course across alternating weekdays.', kind: 'soft', enabled: true, weight: 80, category: 'temporal', is_sample: true, isSample: true },
  { id: 'rule-sample-sc-03', code: 'SC-03', name: 'Circadian Peak Alertness Alignment', description: 'Prioritize theoretical and mathematical instruction in morning periods.', kind: 'soft', enabled: true, weight: 90, category: 'temporal', is_sample: true, isSample: true },
  { id: 'rule-sample-sc-04', code: 'SC-04', name: 'Faculty Consecutive Hours Cap', description: 'Avoid more than 3 consecutive hours of instructional delivery for any faculty member.', kind: 'soft', enabled: true, weight: 80, category: 'instructor', is_sample: true, isSample: true },
  { id: 'rule-sample-sc-05', code: 'SC-05', name: 'Campus Building Compaction', description: 'Cluster classes in adjacent facilities to minimize transit overhead.', kind: 'soft', enabled: true, weight: 70, category: 'facility', is_sample: true, isSample: true }
];

// 10. Master Scenario for Spring 2026
export const largeSampleScenario: TimetableScenario = {
  id: 'scenario-sample-spring-2026',
  termId: largeSampleTerm.id,
  name: 'WPI Spring 2026 Master Campus Baseline',
  version: '2.0.0-verified',
  status: 'published',
  createdAt: '2026-01-10T09:00:00Z',
  updatedAt: '2026-01-11T14:30:00Z',
  author: 'Dr. Katherine Reynolds',
  metrics: {
    clashCount: 0,
    satisfactionScore: 99.92,
    roomUtilizationPercent: 67.4,
    instructorSatisfaction: 98.1,
    studentTransitScore: 95.8
  },
  assignments: Object.fromEntries(
    largeSampleSections.map(s => [s.id, s.assignedSlot!])
  ),
  is_sample: true,
  isSample: true
};

// 11. Audit log
export const largeSampleAuditLogs: AuditLogEntry[] = [
  {
    id: 'audit-sample-01',
    timestamp: '2026-01-11T14:30:00Z',
    userId: 'user-admin',
    userName: 'Dr. Katherine Reynolds',
    action: 'publish',
    entityType: 'scenario',
    entityId: largeSampleScenario.id,
    summary: 'Loaded realistic multi-department sample dataset (42 classes, 120 courses, 55 rooms, 55 instructors).',
    is_sample: true,
    isSample: true
  }
];
