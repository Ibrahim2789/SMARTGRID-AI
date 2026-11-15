import {
  AcademicTerm,
  Campus,
  Building,
  Room,
  Department,
  Program,
  Course,
  Instructor,
  StudentGroup,
  Section,
  DayOfWeek
} from '../types/institutional';

export const universityTerms: AcademicTerm[] = [
  {
    id: 'term-2026-fall',
    name: 'Fall Semester 2026',
    code: 'FALL-2026',
    startDate: '2026-09-01',
    endDate: '2026-12-31',
    status: 'active',
    weeksCount: 16,
    is_sample: true,
    isSample: true
  },
  {
    id: 'term-2026-spring',
    name: 'Spring Semester 2026',
    code: 'SPRING-2026',
    startDate: '2026-01-12',
    endDate: '2026-05-15',
    status: 'archived',
    weeksCount: 16,
    is_sample: true,
    isSample: true
  }
];

export const universityCampuses: Campus[] = [
  {
    id: 'campus-main',
    name: 'Main Engineering & Computing Campus',
    code: 'MAIN',
    address: 'Sector H-12 Academic Complex',
    is_sample: true,
    isSample: true
  }
];

export const universityBuildings: Building[] = [
  { id: 'bld-iaec', campusId: 'campus-main', name: 'IAEC Engineering Wing', code: 'IAEC', floors: 4, is_sample: true, isSample: true },
  { id: 'bld-acad', campusId: 'campus-main', name: 'Central Academic Block', code: 'ACAD', floors: 4, is_sample: true, isSample: true },
  { id: 'bld-ug', campusId: 'campus-main', name: 'Undergraduate Studies Block', code: 'UG', floors: 3, is_sample: true, isSample: true },
  { id: 'bld-pg', campusId: 'campus-main', name: 'Postgraduate & Research Block', code: 'PG', floors: 3, is_sample: true, isSample: true },
  { id: 'bld-smrimms', campusId: 'campus-main', name: 'SMRIMMS Computing & Media Wing', code: 'SMRIMMS', floors: 3, is_sample: true, isSample: true }
];

export const universityDepartments: Department[] = [
  {
    id: 'dept-bee',
    name: 'Electrical Engineering',
    code: 'BEE',
    school: 'School of Electrical & Computer Engineering',
    colorHex: '#0D9488',
    is_sample: true,
    isSample: true
  },
  {
    id: 'dept-bce',
    name: 'Computer Engineering',
    code: 'BCE',
    school: 'School of Electrical & Computer Engineering',
    colorHex: '#D97706',
    is_sample: true,
    isSample: true
  },
  {
    id: 'dept-bese',
    name: 'Software Engineering',
    code: 'BESE',
    school: 'School of Computing & Software Systems',
    colorHex: '#7C3AED',
    is_sample: true,
    isSample: true
  },
  {
    id: 'dept-bscs',
    name: 'Computer Science',
    code: 'BSCS',
    school: 'School of Computing & Software Systems',
    colorHex: '#2563EB',
    is_sample: true,
    isSample: true
  }
];

export const universityPrograms: Program[] = [
  {
    id: 'prog-bee',
    departmentId: 'dept-bee',
    name: 'BS in Electrical Engineering',
    code: 'BEE',
    degreeLevel: 'Undergraduate',
    totalSemesters: 8,
    is_sample: true,
    isSample: true
  },
  {
    id: 'prog-bce',
    departmentId: 'dept-bce',
    name: 'BS in Computer Engineering',
    code: 'BCE',
    degreeLevel: 'Undergraduate',
    totalSemesters: 8,
    is_sample: true,
    isSample: true
  },
  {
    id: 'prog-bese',
    departmentId: 'dept-bese',
    name: 'BS in Software Engineering',
    code: 'BESE',
    degreeLevel: 'Undergraduate',
    totalSemesters: 8,
    is_sample: true,
    isSample: true
  },
  {
    id: 'prog-bscs',
    departmentId: 'dept-bscs',
    name: 'BS in Computer Science',
    code: 'BSCS',
    degreeLevel: 'Undergraduate',
    totalSemesters: 8,
    is_sample: true,
    isSample: true
  }
];

// Raw room & lab codes from the attached university dataset
const RAW_ROOMS: Array<{ code: string; name: string; type: 'lecture' | 'lab'; bld: string; cap: number }> = [
  // Classrooms
  { code: 'CR-18-IAEC', name: 'Classroom 18 (IAEC Wing)', type: 'lecture', bld: 'bld-iaec', cap: 55 },
  { code: 'CR-19-IAEC', name: 'Classroom 19 (IAEC Wing)', type: 'lecture', bld: 'bld-iaec', cap: 55 },
  { code: 'CR-30-Acad', name: 'Classroom 30 (Academic Block)', type: 'lecture', bld: 'bld-acad', cap: 55 },
  { code: 'CR-31-Acad', name: 'Classroom 31 (Academic Block)', type: 'lecture', bld: 'bld-acad', cap: 55 },
  { code: 'CR-32-Acad', name: 'Classroom 32 (Academic Block)', type: 'lecture', bld: 'bld-acad', cap: 55 },
  { code: 'CR-33-Acad', name: 'Classroom 33 (Academic Block)', type: 'lecture', bld: 'bld-acad', cap: 55 },
  { code: 'CR-34-Acad', name: 'Classroom 34 (Academic Block)', type: 'lecture', bld: 'bld-acad', cap: 55 },
  { code: 'CR-23-Acad', name: 'Classroom 23 (Academic Block)', type: 'lecture', bld: 'bld-acad', cap: 55 },
  { code: 'CR-24-Acad', name: 'Classroom 24 (Academic Block)', type: 'lecture', bld: 'bld-acad', cap: 55 },
  { code: 'CR-25-Acad', name: 'Classroom 25 (Academic Block)', type: 'lecture', bld: 'bld-acad', cap: 55 },
  { code: 'CR-26-Acad', name: 'Classroom 26 (Academic Block)', type: 'lecture', bld: 'bld-acad', cap: 55 },
  { code: 'CR-27-Acad', name: 'Classroom 27 (Academic Block)', type: 'lecture', bld: 'bld-acad', cap: 55 },
  { code: 'CR-28-Acad', name: 'Classroom 28 (Academic Block)', type: 'lecture', bld: 'bld-acad', cap: 55 },
  { code: 'CR-29-Acad', name: 'Classroom 29 (Academic Block)', type: 'lecture', bld: 'bld-acad', cap: 55 },
  { code: 'CR-01-UG', name: 'Classroom 01 (UG Block)', type: 'lecture', bld: 'bld-ug', cap: 60 },
  { code: 'CR-02-UG', name: 'Classroom 02 (UG Block)', type: 'lecture', bld: 'bld-ug', cap: 60 },
  { code: 'CR-03-UG', name: 'Classroom 03 (UG Block)', type: 'lecture', bld: 'bld-ug', cap: 60 },
  { code: 'CR-04-UG', name: 'Classroom 04 (UG Block)', type: 'lecture', bld: 'bld-ug', cap: 60 },
  { code: 'CR-05-UG', name: 'Classroom 05 (UG Block)', type: 'lecture', bld: 'bld-ug', cap: 60 },
  { code: 'CR-06-UG', name: 'Classroom 06 (UG Block)', type: 'lecture', bld: 'bld-ug', cap: 55 },
  { code: 'CR-07-UG', name: 'Classroom 07 (UG Block)', type: 'lecture', bld: 'bld-ug', cap: 55 },
  { code: 'CR-08-UG', name: 'Classroom 08 (UG Block)', type: 'lecture', bld: 'bld-ug', cap: 55 },
  { code: 'CR-09-UG', name: 'Classroom 09 (UG Block)', type: 'lecture', bld: 'bld-ug', cap: 55 },
  { code: 'CR-10-UG', name: 'Classroom 10 (UG Block)', type: 'lecture', bld: 'bld-ug', cap: 55 },
  { code: 'CR-11-UG', name: 'Classroom 11 (UG Block)', type: 'lecture', bld: 'bld-ug', cap: 55 },
  { code: 'CR-12-UG', name: 'Classroom 12 (UG Block)', type: 'lecture', bld: 'bld-ug', cap: 55 },
  { code: 'CR-13-UG', name: 'Classroom 13 (UG Block)', type: 'lecture', bld: 'bld-ug', cap: 55 },
  { code: 'CR-14-UG', name: 'Classroom 14 (UG Block)', type: 'lecture', bld: 'bld-ug', cap: 55 },
  { code: 'CR-15-UG', name: 'Classroom 15 (UG Block)', type: 'lecture', bld: 'bld-ug', cap: 55 },
  { code: 'CR-16-PG', name: 'Classroom 16 (PG Block)', type: 'lecture', bld: 'bld-pg', cap: 55 },
  { code: 'CR-17-PG', name: 'Classroom 17 (PG Block)', type: 'lecture', bld: 'bld-pg', cap: 55 },
  { code: 'CR-20-SMRIMMS', name: 'Classroom 20 (SMRIMMS Wing)', type: 'lecture', bld: 'bld-smrimms', cap: 55 },
  { code: 'CR-21-SMRIMMS', name: 'Classroom 21 (SMRIMMS Wing)', type: 'lecture', bld: 'bld-smrimms', cap: 55 },
  { code: 'CR-22-SMRIMMS', name: 'Classroom 22 (SMRIMMS Wing)', type: 'lecture', bld: 'bld-smrimms', cap: 55 },
  // Laboratories
  { code: 'EMS Lab-UG', name: 'Electrical Machines & Systems Lab (UG)', type: 'lab', bld: 'bld-ug', cap: 40 },
  { code: 'MDA Lab-SMRIMMS', name: 'Microprocessor & Digital Applications Lab', type: 'lab', bld: 'bld-smrimms', cap: 40 },
  { code: 'DSP & Comm Lab-UG', name: 'DSP & Communication Systems Lab (UG)', type: 'lab', bld: 'bld-ug', cap: 40 },
  { code: 'Digital Systems Lab-I-UG', name: 'Digital Systems Laboratory I (UG)', type: 'lab', bld: 'bld-ug', cap: 40 },
  { code: 'Digital Systems-II-Acad', name: 'Digital Systems Laboratory II (Acad)', type: 'lab', bld: 'bld-acad', cap: 40 },
  { code: 'Advanced Electronics Lab-IAEC', name: 'Advanced Electronics Lab (IAEC)', type: 'lab', bld: 'bld-iaec', cap: 40 },
  { code: 'Basic Electronics Lab-UG', name: 'Basic Electronics & Measurement Lab (UG)', type: 'lab', bld: 'bld-ug', cap: 40 },
  { code: 'Control Systems Lab-UG', name: 'Feedback Control Systems Lab (UG)', type: 'lab', bld: 'bld-ug', cap: 40 },
  { code: 'Embedded Systems Lab-PG', name: 'Embedded Systems & IoT Lab (PG)', type: 'lab', bld: 'bld-pg', cap: 40 },
  { code: 'Engineering Workshop-UG', name: 'Engineering Practice Workshop (UG)', type: 'lab', bld: 'bld-ug', cap: 40 },
  { code: 'Physics Lab-UG', name: 'Applied Physics Laboratory (UG)', type: 'lab', bld: 'bld-ug', cap: 40 },
  { code: 'CL-01-UG', name: 'Computing Lab 01 (UG Block)', type: 'lab', bld: 'bld-ug', cap: 45 },
  { code: 'CL-02-UG', name: 'Computing Lab 02 (UG Block)', type: 'lab', bld: 'bld-ug', cap: 45 },
  { code: 'CL-03-UG', name: 'Computing Lab 03 (UG Block)', type: 'lab', bld: 'bld-ug', cap: 45 },
  { code: 'CL-04-UG', name: 'Computing Lab 04 (UG Block)', type: 'lab', bld: 'bld-ug', cap: 45 },
  { code: 'CL-05-UG', name: 'Computing Lab 05 (UG Block)', type: 'lab', bld: 'bld-ug', cap: 45 },
  { code: 'CL-06-UG', name: 'Computing Lab 06 (UG Block)', type: 'lab', bld: 'bld-ug', cap: 45 },
  { code: 'CL-07-PG', name: 'Computing Lab 07 (PG Block)', type: 'lab', bld: 'bld-pg', cap: 45 },
  { code: 'CL-08-PG', name: 'Computing Lab 08 (PG Block)', type: 'lab', bld: 'bld-pg', cap: 45 },
  { code: 'CL-09-Acad', name: 'Computing Lab 09 (Academic Block)', type: 'lab', bld: 'bld-acad', cap: 45 },
  { code: 'CL-10-Acad', name: 'Computing Lab 10 (Academic Block)', type: 'lab', bld: 'bld-acad', cap: 45 },
  { code: 'CL-11-Acad', name: 'Computing Lab 11 (Academic Block)', type: 'lab', bld: 'bld-acad', cap: 45 },
  { code: 'CL-12-Acad', name: 'Computing Lab 12 (Academic Block)', type: 'lab', bld: 'bld-acad', cap: 45 }
];

function slugify(val: string): string {
  return val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export const universityRooms: Room[] = RAW_ROOMS.map(r => ({
  id: `room-${slugify(r.code)}`,
  buildingId: r.bld,
  code: r.code,
  name: r.name,
  capacity: r.cap,
  type: r.type,
  equipment: r.type === 'lab'
    ? ['Lab Workstations', 'Oscilloscopes / Dev Kits', 'Smart Projector']
    : ['Multimedia Projector', 'Whiteboard', 'Audio System'],
  isAccessible: true,
  isAvailable: true,
  is_sample: true,
  isSample: true
}));

function getRoomIdByCode(code: string): string {
  const found = universityRooms.find(r => r.code.toLowerCase() === code.toLowerCase());
  return found ? found.id : universityRooms[0].id;
}

// University Courses Catalog (Real Courses from Prompt)
export const universityCourses: Course[] = [
  // BEE 5th Sem (2K24-BEE)
  { id: 'crs-bee-em', departmentId: 'dept-bee', code: 'EE-311', title: 'Electrical Machines', creditHours: 4, weeklyContactHours: 6, lectureHours: 3, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-bee-mp', departmentId: 'dept-bee', code: 'EE-321', title: 'Microprocessor & Interfacing', creditHours: 4, weeklyContactHours: 6, lectureHours: 3, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-bee-ss', departmentId: 'dept-bee', code: 'EE-331', title: 'Signals and Systems', creditHours: 4, weeklyContactHours: 6, lectureHours: 3, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-bee-eft', departmentId: 'dept-bee', code: 'EE-341', title: 'Electromagnetic Field Theory', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-bee-ps', departmentId: 'dept-bee', code: 'MT-301', title: 'Probability & Statistics', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },

  // BEE 3rd Sem (2K25-BEE)
  { id: 'crs-bee-dld', departmentId: 'dept-bee', code: 'EE-221', title: 'Digital Logic Design', creditHours: 4, weeklyContactHours: 6, lectureHours: 3, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-bee-edc', departmentId: 'dept-bee', code: 'EE-211', title: 'Electronic Devices and Circuits', creditHours: 4, weeklyContactHours: 6, lectureHours: 3, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-bee-ena', departmentId: 'dept-bee', code: 'EE-201', title: 'Electrical Network Analysis', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-bee-dsa', departmentId: 'dept-bee', code: 'CS-211', title: 'Data Structures and Algorithms', creditHours: 4, weeklyContactHours: 5, lectureHours: 2, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-bee-cvt', departmentId: 'dept-bee', code: 'MT-203', title: 'Complex Variables and Transforms', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-bee-ode', departmentId: 'dept-bee', code: 'MT-202', title: 'Differential Equations', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },

  // BEE 1st Sem (2K26-BEE)
  { id: 'crs-bee-lca', departmentId: 'dept-bee', code: 'EE-101', title: 'Linear Circuit Analysis', creditHours: 4, weeklyContactHours: 6, lectureHours: 3, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-bee-ap', departmentId: 'dept-bee', code: 'PH-101', title: 'Applied Physics', creditHours: 4, weeklyContactHours: 6, lectureHours: 3, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-bee-calc', departmentId: 'dept-bee', code: 'MT-101', title: 'Calculus & Analytical Geometry', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-bee-fe', departmentId: 'dept-bee', code: 'HU-101', title: 'Functional English', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-bee-ew', departmentId: 'dept-bee', code: 'EE-102', title: 'Engineering Workshop', creditHours: 1, weeklyContactHours: 3, lectureHours: 0, labHours: 3, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-bee-icp', departmentId: 'dept-bee', code: 'HU-102', title: 'Ideology & Constitution of Pakistan', creditHours: 2, weeklyContactHours: 2, lectureHours: 2, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-bee-is', departmentId: 'dept-bee', code: 'HU-103', title: 'Islamic Studies / Ethics', creditHours: 2, weeklyContactHours: 2, lectureHours: 2, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },

  // BEE 7th Sem (2K23-BEE)
  { id: 'crs-bee-psa', departmentId: 'dept-bee', code: 'EE-411', title: 'Power System Analysis & Protection', creditHours: 4, weeklyContactHours: 6, lectureHours: 3, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-bee-lcs', departmentId: 'dept-bee', code: 'EE-421', title: 'Linear Control Systems', creditHours: 4, weeklyContactHours: 6, lectureHours: 3, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-bee-dsp', departmentId: 'dept-bee', code: 'EE-431', title: 'Digital Signal Processing', creditHours: 4, weeklyContactHours: 6, lectureHours: 3, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-bee-emg', departmentId: 'dept-bee', code: 'MG-401', title: 'Engineering Management & Economics', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },

  // BCE 3rd Sem (2K25-BCE) & 1st Sem (2K26-BCE)
  { id: 'crs-bce-ca', departmentId: 'dept-bce', code: 'CE-211', title: 'Computer Architecture', creditHours: 4, weeklyContactHours: 6, lectureHours: 3, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-bce-oop', departmentId: 'dept-bce', code: 'CE-112', title: 'Object Oriented Programming', creditHours: 4, weeklyContactHours: 6, lectureHours: 3, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-bce-esw', departmentId: 'dept-bce', code: 'CE-221', title: 'Embedded Systems Workshop', creditHours: 1, weeklyContactHours: 3, lectureHours: 0, labHours: 3, requiredRoomType: 'lab', is_sample: true, isSample: true },
  { id: 'crs-bce-la', departmentId: 'dept-bce', code: 'MT-201', title: 'Linear Algebra', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-bce-pf', departmentId: 'dept-bce', code: 'CE-101', title: 'Programming Fundamentals', creditHours: 4, weeklyContactHours: 6, lectureHours: 3, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-bce-ict', departmentId: 'dept-bce', code: 'CE-102', title: 'Applications of ICT', creditHours: 3, weeklyContactHours: 5, lectureHours: 2, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },

  // BESE 5th Sem (2K24-BESE), 3rd Sem (2K25-BESE), 7th Sem (2K23-BESE), 1st Sem (2K26-BESE)
  { id: 'crs-se-cc', departmentId: 'dept-bese', code: 'SE-311', title: 'Cloud Computing', creditHours: 3, weeklyContactHours: 5, lectureHours: 2, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-se-scd', departmentId: 'dept-bese', code: 'SE-321', title: 'Software Construction & Development', creditHours: 4, weeklyContactHours: 5, lectureHours: 2, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-se-ml', departmentId: 'dept-bese', code: 'SE-331', title: 'Machine Learning', creditHours: 4, weeklyContactHours: 5, lectureHours: 2, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-se-spm', departmentId: 'dept-bese', code: 'SE-341', title: 'Software Project Management', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-se-tbw', departmentId: 'dept-bese', code: 'HU-301', title: 'Technical & Business Writing', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-se-se', departmentId: 'dept-bese', code: 'SE-201', title: 'Software Engineering', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-se-ds', departmentId: 'dept-bese', code: 'SE-202', title: 'Discrete Structures', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-se-pp', departmentId: 'dept-bese', code: 'HU-202', title: 'Professional Practices', creditHours: 2, weeklyContactHours: 2, lectureHours: 2, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-se-sqe', departmentId: 'dept-bese', code: 'SE-411', title: 'Software Quality Engineering & Testing', creditHours: 4, weeklyContactHours: 5, lectureHours: 2, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-se-devops', departmentId: 'dept-bese', code: 'SE-421', title: 'DevOps & Continuous Engineering', creditHours: 4, weeklyContactHours: 5, lectureHours: 2, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-se-sda', departmentId: 'dept-bese', code: 'SE-431', title: 'Software Design & Architecture', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },

  // BSCS 3rd Sem (2K25-BSCS), 5th Sem (2K24-BSCS), 7th Sem (2K23-BSCS), 1st Sem (2K26-BSCS)
  { id: 'crs-cs-dsa', departmentId: 'dept-bscs', code: 'CS-201', title: 'Data Structures & Algorithms', creditHours: 4, weeklyContactHours: 6, lectureHours: 3, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-cs-coal', departmentId: 'dept-bscs', code: 'CS-221', title: 'Computer Organization & Assembly Language', creditHours: 4, weeklyContactHours: 5, lectureHours: 2, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-cs-AI', departmentId: 'dept-bscs', code: 'CS-231', title: 'Artificial Intelligence', creditHours: 3, weeklyContactHours: 5, lectureHours: 2, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-cs-cn', departmentId: 'dept-bscs', code: 'CS-241', title: 'Computer Networks', creditHours: 4, weeklyContactHours: 5, lectureHours: 2, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-cs-isec', departmentId: 'dept-bscs', code: 'CS-251', title: 'Information Security', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-cs-mvc', departmentId: 'dept-bscs', code: 'MT-204', title: 'Multivariable Calculus', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-cs-os', departmentId: 'dept-bscs', code: 'CS-311', title: 'Operating Systems', creditHours: 4, weeklyContactHours: 6, lectureHours: 3, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-cs-db', departmentId: 'dept-bscs', code: 'CS-321', title: 'Database Management Systems', creditHours: 4, weeklyContactHours: 6, lectureHours: 3, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-cs-daa', departmentId: 'dept-bscs', code: 'CS-331', title: 'Design & Analysis of Algorithms', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-cs-automata', departmentId: 'dept-bscs', code: 'CS-341', title: 'Theory of Automata', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-cs-compiler', departmentId: 'dept-bscs', code: 'CS-411', title: 'Compiler Construction', creditHours: 4, weeklyContactHours: 6, lectureHours: 3, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-cs-dl', departmentId: 'dept-bscs', code: 'CS-421', title: 'Deep Learning & Neural Vision', creditHours: 4, weeklyContactHours: 6, lectureHours: 3, labHours: 3, requiredRoomType: 'lecture', is_sample: true, isSample: true },
  { id: 'crs-cs-pdc', departmentId: 'dept-bscs', code: 'CS-431', title: 'Parallel & Distributed Computing', creditHours: 3, weeklyContactHours: 3, lectureHours: 3, labHours: 0, requiredRoomType: 'lecture', is_sample: true, isSample: true }
];

// Real University Instructors from the Prompt
const RAW_INSTRUCTORS: Array<{ name: string; dept: string; title: string; email?: string }> = [
  // BEE Faculty & Lab Engineers
  { name: 'Dr.Jehanzeb Ahmad', dept: 'dept-bee', title: 'Professor', email: 'jehanzeb.ahmad@westernpoly.edu' },
  { name: 'Dr.Noman Mujeeb', dept: 'dept-bee', title: 'Associate Professor' },
  { name: 'Mr.Zia Ur Rehman', dept: 'dept-bee', title: 'Assistant Professor' },
  { name: 'Mr.M.Shujaat', dept: 'dept-bee', title: 'Lecturer' },
  { name: 'Dr.Sajjad A.Haider', dept: 'dept-bee', title: 'Professor' },
  { name: 'Dr.Imtiaz Alam', dept: 'dept-bee', title: 'Associate Professor' },
  { name: 'Dr.Anjum', dept: 'dept-bee', title: 'Associate Professor' },
  { name: 'Dr.Ehtasham', dept: 'dept-bee', title: 'Assistant Professor' },
  { name: 'Dr.Farzana Kulsoom', dept: 'dept-bee', title: 'Associate Professor' },
  { name: 'Dr.Wasim', dept: 'dept-bee', title: 'Assistant Professor' },
  { name: 'Dr.Saeed', dept: 'dept-bee', title: 'Professor' },
  { name: 'Dr.Saqib', dept: 'dept-bee', title: 'Associate Professor' },
  { name: 'Mr.Rashid', dept: 'dept-bee', title: 'Lecturer' },
  { name: 'Dr.Adnan', dept: 'dept-bee', title: 'Assistant Professor' },
  { name: 'Ms.Tabinda', dept: 'dept-bee', title: 'Lecturer' },
  { name: 'Dr.Jawad', dept: 'dept-bee', title: 'Assistant Professor' },
  { name: 'Mr.M.Ajmal', dept: 'dept-bee', title: 'Lecturer' },
  { name: 'Ms.Rubab', dept: 'dept-bee', title: 'Lecturer' },
  { name: 'Engr.M.Farooq', dept: 'dept-bee', title: 'Lab Engineer' },
  { name: 'Engr.Zainab', dept: 'dept-bee', title: 'Lab Engineer' },
  { name: 'Engr.Hammad', dept: 'dept-bee', title: 'Lab Engineer' },
  { name: 'Engr.Ayesha', dept: 'dept-bee', title: 'Lab Engineer' },
  { name: 'Engr.M.Umair', dept: 'dept-bee', title: 'Lab Engineer' },
  { name: 'Engr.Fizza', dept: 'dept-bee', title: 'Lab Engineer' },
  { name: 'Engr.Sadia', dept: 'dept-bee', title: 'Lab Engineer' },
  { name: 'Engr.Wajeeha', dept: 'dept-bee', title: 'Lab Engineer' },

  // BCE Faculty & Lab Engineers
  { name: 'Dr.M.Imran', dept: 'dept-bce', title: 'Associate Professor' },
  { name: 'Dr.Waqas', dept: 'dept-bce', title: 'Assistant Professor' },
  { name: 'Ms.Sana', dept: 'dept-bce', title: 'Lecturer' },
  { name: 'Mr.Salman', dept: 'dept-bce', title: 'Lecturer' },
  { name: 'Engr.Ahsan', dept: 'dept-bce', title: 'Lab Engineer' },
  { name: 'Engr.M.Ali', dept: 'dept-bce', title: 'Lab Engineer' },
  { name: 'Engr.Komal', dept: 'dept-bce', title: 'Lab Engineer' },
  { name: 'Engr.Bilal', dept: 'dept-bce', title: 'Lab Engineer' },

  // BESE Faculty & Lab Engineers
  { name: 'Dr.Faisal', dept: 'dept-bese', title: 'Professor' },
  { name: 'Mr.Aamir', dept: 'dept-bese', title: 'Assistant Professor' },
  { name: 'Dr.Hina', dept: 'dept-bese', title: 'Associate Professor' },
  { name: 'Ms.Madiha', dept: 'dept-bese', title: 'Lecturer' },
  { name: 'Ms.Nadia', dept: 'dept-bese', title: 'Lecturer' },
  { name: 'Ms.Hira', dept: 'dept-bese', title: 'Lecturer' },
  { name: 'Dr.Tariq', dept: 'dept-bese', title: 'Associate Professor' },
  { name: 'Mr.Usman', dept: 'dept-bese', title: 'Lecturer' },
  { name: 'Ms.Zارا', dept: 'dept-bese', title: 'Lecturer' },
  { name: 'Ms.Zara', dept: 'dept-bese', title: 'Lecturer' },
  { name: 'Mr.Kamran', dept: 'dept-bese', title: 'Lecturer' },
  { name: 'Dr.Nadia', dept: 'dept-bese', title: 'Assistant Professor' },
  { name: 'Mr.Rizwan', dept: 'dept-bese', title: 'Lecturer' },
  { name: 'Engr.Sana', dept: 'dept-bese', title: 'Lab Engineer' },
  { name: 'Engr.Tahir', dept: 'dept-bese', title: 'Lab Engineer' },
  { name: 'Engr.Noman', dept: 'dept-bese', title: 'Lab Engineer' },
  { name: 'Engr.M.uzair', dept: 'dept-bese', title: 'Lab Engineer' },
  { name: 'Engr.Zeeshan', dept: 'dept-bese', title: 'Lab Engineer' },
  { name: 'Engr.Rabia', dept: 'dept-bese', title: 'Lab Engineer' },

  // BSCS Faculty & Lab Engineers
  { name: 'Prof. Alan Turing', dept: 'dept-bscs', title: 'Professor', email: 'a.turing@westernpoly.edu' },
  { name: 'Dr.Kashif', dept: 'dept-bscs', title: 'Professor' },
  { name: 'Mr.Junaid', dept: 'dept-bscs', title: 'Assistant Professor' },
  { name: 'Dr.Samina', dept: 'dept-bscs', title: 'Associate Professor' },
  { name: 'Mr.Asif', dept: 'dept-bscs', title: 'Lecturer' },
  { name: 'Dr.Zubair', dept: 'dept-bscs', title: 'Associate Professor' },
  { name: 'Dr.Amina', dept: 'dept-bscs', title: 'Assistant Professor' },
  { name: 'Dr.Hassan', dept: 'dept-bscs', title: 'Professor' },
  { name: 'Ms.Saima', dept: 'dept-bscs', title: 'Lecturer' },
  { name: 'Dr.Adeel', dept: 'dept-bscs', title: 'Associate Professor' },
  { name: 'Mr.Waqar', dept: 'dept-bscs', title: 'Lecturer' },
  { name: 'Ms.Farah', dept: 'dept-bscs', title: 'Lecturer' },
  { name: 'Mr.Babar', dept: 'dept-bscs', title: 'Lecturer' },
  { name: 'Engr.Haris', dept: 'dept-bscs', title: 'Lab Engineer' },
  { name: 'Engr.M.Saad', dept: 'dept-bscs', title: 'Lab Engineer' },
  { name: 'Engr.Kiran', dept: 'dept-bscs', title: 'Lab Engineer' },
  { name: 'Engr.Talha', dept: 'dept-bscs', title: 'Lab Engineer' },
  { name: 'Engr.Danish', dept: 'dept-bscs', title: 'Lab Engineer' },
  { name: 'Engr.Nida', dept: 'dept-bscs', title: 'Lab Engineer' },
  { name: 'Engr.Fahad', dept: 'dept-bscs', title: 'Lab Engineer' },
  { name: 'Engr.Maham', dept: 'dept-bscs', title: 'Lab Engineer' },
  { name: 'Engr.Umer', dept: 'dept-bscs', title: 'Lab Engineer' }
];

export const universityInstructors: Instructor[] = RAW_INSTRUCTORS.map(inst => ({
  id: `inst-${slugify(inst.name)}`,
  departmentId: inst.dept,
  name: inst.name,
  email: inst.email || `${slugify(inst.name)}@university.edu.pk`,
  title: inst.title,
  maxWeeklyHours: 16,
  maxConsecutiveHours: 3,
  preferredDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  unavailableSlots: [],
  is_sample: true,
  isSample: true
}));

function getInstructorIdByName(name: string): string {
  const found = universityInstructors.find(i => i.name.toLowerCase() === name.toLowerCase());
  return found ? found.id : universityInstructors[0].id;
}

// ============================================================================
// ALL 31 UNIVERSITY CLASSES / SECTIONS (StudentGroups) FROM PROMPT
// ============================================================================
export const universityStudentGroups: StudentGroup[] = [
  // 1. Electrical Engineering (BEE) — 16 Sections
  { id: 'grp-2k24-bee-a', programId: 'prog-bee', code: '2K24-BEE-A', name: 'BEE 5th Sem — Section A', year: 3, semester: 5, section: 'A', homeRoom: 'CR-18-IAEC', size: 48, sharedCourseIds: ['crs-bee-em', 'crs-bee-mp', 'crs-bee-ss', 'crs-bee-eft', 'crs-bee-ps'], is_sample: true, isSample: true },
  { id: 'grp-2k24-bee-b', programId: 'prog-bee', code: '2K24-BEE-B', name: 'BEE 5th Sem — Section B', year: 3, semester: 5, section: 'B', homeRoom: 'CR-18-IAEC', size: 46, sharedCourseIds: ['crs-bee-em', 'crs-bee-mp', 'crs-bee-ss', 'crs-bee-eft', 'crs-bee-ps'], is_sample: true, isSample: true },
  { id: 'grp-2k24-bee-c', programId: 'prog-bee', code: '2K24-BEE-C', name: 'BEE 5th Sem — Section C', year: 3, semester: 5, section: 'C', homeRoom: 'CR-19-IAEC', size: 45, sharedCourseIds: ['crs-bee-em', 'crs-bee-mp', 'crs-bee-ss', 'crs-bee-eft', 'crs-bee-ps'], is_sample: true, isSample: true },
  { id: 'grp-2k24-bee-d', programId: 'prog-bee', code: '2K24-BEE-D', name: 'BEE 5th Sem — Section D', year: 3, semester: 5, section: 'D', homeRoom: 'CR-19-IAEC', size: 44, sharedCourseIds: ['crs-bee-em', 'crs-bee-mp', 'crs-bee-ss', 'crs-bee-eft', 'crs-bee-ps'], is_sample: true, isSample: true },

  { id: 'grp-2k25-bee-a', programId: 'prog-bee', code: '2K25-BEE-A', name: 'BEE 3rd Sem — Section A', year: 2, semester: 3, section: 'A', homeRoom: 'CR-30-Acad', size: 50, sharedCourseIds: ['crs-bee-dld', 'crs-bee-edc', 'crs-bee-ena', 'crs-bee-dsa', 'crs-bee-cvt'], is_sample: true, isSample: true },
  { id: 'grp-2k25-bee-b', programId: 'prog-bee', code: '2K25-BEE-B', name: 'BEE 3rd Sem — Section B', year: 2, semester: 3, section: 'B', homeRoom: 'CR-30-Acad', size: 48, sharedCourseIds: ['crs-bee-dld', 'crs-bee-edc', 'crs-bee-ena', 'crs-bee-dsa', 'crs-bee-cvt'], is_sample: true, isSample: true },
  { id: 'grp-2k25-bee-c', programId: 'prog-bee', code: '2K25-BEE-C', name: 'BEE 3rd Sem — Section C', year: 2, semester: 3, section: 'C', homeRoom: 'CR-31-Acad', size: 47, sharedCourseIds: ['crs-bee-dld', 'crs-bee-edc', 'crs-bee-ena', 'crs-bee-dsa', 'crs-bee-ode'], is_sample: true, isSample: true },
  { id: 'grp-2k25-bee-d', programId: 'prog-bee', code: '2K25-BEE-D', name: 'BEE 3rd Sem — Section D', year: 2, semester: 3, section: 'D', homeRoom: 'CR-32-Acad', size: 45, sharedCourseIds: ['crs-bee-dld', 'crs-bee-edc', 'crs-bee-ena', 'crs-bee-dsa', 'crs-bee-ode'], is_sample: true, isSample: true },

  { id: 'grp-2k26-bee-a', programId: 'prog-bee', code: '2K26-BEE-A', name: 'BEE 1st Sem — Section A', year: 1, semester: 1, section: 'A', homeRoom: 'CR-06-UG', size: 52, sharedCourseIds: ['crs-bee-lca', 'crs-bee-ap', 'crs-bee-calc', 'crs-bee-fe', 'crs-bee-ew', 'crs-bee-icp'], is_sample: true, isSample: true },
  { id: 'grp-2k26-bee-b', programId: 'prog-bee', code: '2K26-BEE-B', name: 'BEE 1st Sem — Section B', year: 1, semester: 1, section: 'B', homeRoom: 'CR-06-UG', size: 50, sharedCourseIds: ['crs-bee-lca', 'crs-bee-ap', 'crs-bee-calc', 'crs-bee-fe', 'crs-bee-ew', 'crs-bee-icp'], is_sample: true, isSample: true },
  { id: 'grp-2k26-bee-c', programId: 'prog-bee', code: '2K26-BEE-C', name: 'BEE 1st Sem — Section C', year: 1, semester: 1, section: 'C', homeRoom: 'CR-07-UG', size: 50, sharedCourseIds: ['crs-bee-lca', 'crs-bee-ap', 'crs-bee-calc', 'crs-bee-fe', 'crs-bee-ew', 'crs-bee-is'], is_sample: true, isSample: true },
  { id: 'grp-2k26-bee-d', programId: 'prog-bee', code: '2K26-BEE-D', name: 'BEE 1st Sem — Section D', year: 1, semester: 1, section: 'D', homeRoom: 'CR-07-UG', size: 48, sharedCourseIds: ['crs-bee-lca', 'crs-bee-ap', 'crs-bee-calc', 'crs-bee-fe', 'crs-bee-ew', 'crs-bee-is'], is_sample: true, isSample: true },

  { id: 'grp-2k23-bee-a', programId: 'prog-bee', code: '2K23-BEE-A', name: 'BEE 7th Sem — Section A', year: 4, semester: 7, section: 'A', homeRoom: 'CR-16-PG', size: 42, sharedCourseIds: ['crs-bee-psa', 'crs-bee-lcs', 'crs-bee-dsp', 'crs-bee-emg'], is_sample: true, isSample: true },
  { id: 'grp-2k23-bee-b', programId: 'prog-bee', code: '2K23-BEE-B', name: 'BEE 7th Sem — Section B', year: 4, semester: 7, section: 'B', homeRoom: 'CR-16-PG', size: 40, sharedCourseIds: ['crs-bee-psa', 'crs-bee-lcs', 'crs-bee-dsp', 'crs-bee-emg'], is_sample: true, isSample: true },
  { id: 'grp-2k23-bee-c', programId: 'prog-bee', code: '2K23-BEE-C', name: 'BEE 7th Sem — Section C', year: 4, semester: 7, section: 'C', homeRoom: 'CR-17-PG', size: 40, sharedCourseIds: ['crs-bee-psa', 'crs-bee-lcs', 'crs-bee-dsp', 'crs-bee-emg'], is_sample: true, isSample: true },
  { id: 'grp-2k23-bee-d', programId: 'prog-bee', code: '2K23-BEE-D', name: 'BEE 7th Sem — Section D', year: 4, semester: 7, section: 'D', homeRoom: 'CR-17-PG', size: 38, sharedCourseIds: ['crs-bee-psa', 'crs-bee-lcs', 'crs-bee-dsp', 'crs-bee-emg'], is_sample: true, isSample: true },

  // 2. Computer Engineering (BCE) — 2 Sections
  { id: 'grp-2k25-bce-a', programId: 'prog-bce', code: '2K25-BCE-A', name: 'BCE 3rd Sem — Section A', year: 2, semester: 3, section: 'A', homeRoom: 'CR-34-Acad', size: 46, sharedCourseIds: ['crs-bce-ca', 'crs-bce-oop', 'crs-bee-ss', 'crs-bce-esw', 'crs-bce-la'], is_sample: true, isSample: true },
  { id: 'grp-2k26-bce-a', programId: 'prog-bce', code: '2K26-BCE-A', name: 'BCE 1st Sem — Section A', year: 1, semester: 1, section: 'A', homeRoom: 'CR-13-UG', size: 50, sharedCourseIds: ['crs-bce-pf', 'crs-bee-lca', 'crs-bce-ict', 'crs-bee-calc', 'crs-bee-fe', 'crs-bee-icp'], is_sample: true, isSample: true },

  // 3. Software Engineering (BESE) — 8 Sections
  { id: 'grp-2k24-bese-a', programId: 'prog-bese', code: '2K24-BESE-A', name: 'BESE 5th Sem — Section A', year: 3, semester: 5, section: 'A', homeRoom: 'CR-21-SMRIMMS', size: 48, sharedCourseIds: ['crs-se-cc', 'crs-se-scd', 'crs-se-ml', 'crs-se-spm', 'crs-se-tbw'], is_sample: true, isSample: true },
  { id: 'grp-2k24-bese-b', programId: 'prog-bese', code: '2K24-BESE-B', name: 'BESE 5th Sem — Section B', year: 3, semester: 5, section: 'B', homeRoom: 'CR-22-SMRIMMS', size: 46, sharedCourseIds: ['crs-se-cc', 'crs-se-scd', 'crs-se-ml', 'crs-se-spm', 'crs-se-tbw'], is_sample: true, isSample: true },
  { id: 'grp-2k25-bese-a', programId: 'prog-bese', code: '2K25-BESE-A', name: 'BESE 3rd Sem — Section A', year: 2, semester: 3, section: 'A', homeRoom: 'CR-23-Acad', size: 50, sharedCourseIds: ['crs-cs-dsa', 'crs-cs-coal', 'crs-se-se', 'crs-se-ds', 'crs-bce-la', 'crs-se-pp'], is_sample: true, isSample: true },
  { id: 'grp-2k25-bese-b', programId: 'prog-bese', code: '2K25-BESE-B', name: 'BESE 3rd Sem — Section B', year: 2, semester: 3, section: 'B', homeRoom: 'CR-23-Acad', size: 48, sharedCourseIds: ['crs-cs-dsa', 'crs-cs-coal', 'crs-se-se', 'crs-se-ds', 'crs-bce-la', 'crs-se-pp'], is_sample: true, isSample: true },
  { id: 'grp-2k23-bese-a', programId: 'prog-bese', code: '2K23-BESE-A', name: 'BESE 7th Sem — Section A', year: 4, semester: 7, section: 'A', homeRoom: 'CR-09-UG', size: 44, sharedCourseIds: ['crs-se-sqe', 'crs-se-devops', 'crs-se-sda', 'crs-bee-emg'], is_sample: true, isSample: true },
  { id: 'grp-2k23-bese-b', programId: 'prog-bese', code: '2K23-BESE-B', name: 'BESE 7th Sem — Section B', year: 4, semester: 7, section: 'B', homeRoom: 'CR-10-UG', size: 42, sharedCourseIds: ['crs-se-sqe', 'crs-se-devops', 'crs-se-sda', 'crs-bee-emg'], is_sample: true, isSample: true },
  { id: 'grp-2k26-bese-a', programId: 'prog-bese', code: '2K26-BESE-A', name: 'BESE 1st Sem — Section A', year: 1, semester: 1, section: 'A', homeRoom: 'CR-14-UG', size: 52, sharedCourseIds: ['crs-bce-pf', 'crs-bce-ict', 'crs-bee-ap', 'crs-bee-calc', 'crs-bee-fe'], is_sample: true, isSample: true },
  { id: 'grp-2k26-bese-b', programId: 'prog-bese', code: '2K26-BESE-B', name: 'BESE 1st Sem — Section B', year: 1, semester: 1, section: 'B', homeRoom: 'CR-15-UG', size: 50, sharedCourseIds: ['crs-bce-pf', 'crs-bce-ict', 'crs-bee-ap', 'crs-bee-calc', 'crs-bee-fe'], is_sample: true, isSample: true },

  // 4. Computer Science (BSCS) — 19 Sections
  { id: 'grp-2k25-bscs-a', programId: 'prog-bscs', code: '2K25-BSCS-A', name: 'BSCS 3rd Sem — Section A', year: 2, semester: 3, section: 'A', homeRoom: 'CR-24-Acad', size: 52, sharedCourseIds: ['crs-cs-dsa', 'crs-cs-coal', 'crs-cs-AI', 'crs-cs-cn', 'crs-cs-isec', 'crs-cs-mvc'], is_sample: true, isSample: true },
  { id: 'grp-2k25-bscs-b', programId: 'prog-bscs', code: '2K25-BSCS-B', name: 'BSCS 3rd Sem — Section B', year: 2, semester: 3, section: 'B', homeRoom: 'CR-25-Acad', size: 50, sharedCourseIds: ['crs-cs-dsa', 'crs-cs-coal', 'crs-cs-AI', 'crs-cs-cn', 'crs-cs-isec', 'crs-cs-mvc'], is_sample: true, isSample: true },
  { id: 'grp-2k25-bscs-c', programId: 'prog-bscs', code: '2K25-BSCS-C', name: 'BSCS 3rd Sem — Section C', year: 2, semester: 3, section: 'C', homeRoom: 'CR-26-Acad', size: 50, sharedCourseIds: ['crs-cs-dsa', 'crs-cs-coal', 'crs-cs-AI', 'crs-cs-cn', 'crs-cs-isec', 'crs-cs-mvc'], is_sample: true, isSample: true },
  { id: 'grp-2k25-bscs-d', programId: 'prog-bscs', code: '2K25-BSCS-D', name: 'BSCS 3rd Sem — Section D', year: 2, semester: 3, section: 'D', homeRoom: 'CR-27-Acad', size: 48, sharedCourseIds: ['crs-cs-dsa', 'crs-cs-coal', 'crs-cs-AI', 'crs-cs-cn', 'crs-cs-isec', 'crs-cs-mvc'], is_sample: true, isSample: true },
  { id: 'grp-2k25-bscs-e', programId: 'prog-bscs', code: '2K25-BSCS-E', name: 'BSCS 3rd Sem — Section E', year: 2, semester: 3, section: 'E', homeRoom: 'CR-28-Acad', size: 48, sharedCourseIds: ['crs-cs-dsa', 'crs-cs-coal', 'crs-cs-AI', 'crs-cs-cn', 'crs-cs-isec', 'crs-cs-mvc'], is_sample: true, isSample: true },

  { id: 'grp-2k24-bscs-a', programId: 'prog-bscs', code: '2K24-BSCS-A', name: 'BSCS 5th Sem — Section A', year: 3, semester: 5, section: 'A', homeRoom: 'CR-01-UG', size: 48, sharedCourseIds: ['crs-cs-os', 'crs-cs-db', 'crs-cs-daa', 'crs-cs-automata', 'crs-bee-ps'], is_sample: true, isSample: true },
  { id: 'grp-2k24-bscs-b', programId: 'prog-bscs', code: '2K24-BSCS-B', name: 'BSCS 5th Sem — Section B', year: 3, semester: 5, section: 'B', homeRoom: 'CR-02-UG', size: 46, sharedCourseIds: ['crs-cs-os', 'crs-cs-db', 'crs-cs-daa', 'crs-cs-automata', 'crs-bee-ps'], is_sample: true, isSample: true },
  { id: 'grp-2k24-bscs-c', programId: 'prog-bscs', code: '2K24-BSCS-C', name: 'BSCS 5th Sem — Section C', year: 3, semester: 5, section: 'C', homeRoom: 'CR-03-UG', size: 46, sharedCourseIds: ['crs-cs-os', 'crs-cs-db', 'crs-cs-daa', 'crs-cs-automata', 'crs-bee-ps'], is_sample: true, isSample: true },
  { id: 'grp-2k24-bscs-d', programId: 'prog-bscs', code: '2K24-BSCS-D', name: 'BSCS 5th Sem — Section D', year: 3, semester: 5, section: 'D', homeRoom: 'CR-04-UG', size: 45, sharedCourseIds: ['crs-cs-os', 'crs-cs-db', 'crs-cs-daa', 'crs-cs-automata', 'crs-bee-ps'], is_sample: true, isSample: true },

  { id: 'grp-2k23-bscs-a', programId: 'prog-bscs', code: '2K23-BSCS-A', name: 'BSCS 7th Sem — Section A', year: 4, semester: 7, section: 'A', homeRoom: 'CR-05-UG', size: 44, sharedCourseIds: ['crs-cs-compiler', 'crs-cs-dl', 'crs-cs-pdc', 'crs-se-tbw'], is_sample: true, isSample: true },
  { id: 'grp-2k23-bscs-b', programId: 'prog-bscs', code: '2K23-BSCS-B', name: 'BSCS 7th Sem — Section B', year: 4, semester: 7, section: 'B', homeRoom: 'CR-08-UG', size: 42, sharedCourseIds: ['crs-cs-compiler', 'crs-cs-dl', 'crs-cs-pdc', 'crs-se-tbw'], is_sample: true, isSample: true },
  { id: 'grp-2k23-bscs-c', programId: 'prog-bscs', code: '2K23-BSCS-C', name: 'BSCS 7th Sem — Section C', year: 4, semester: 7, section: 'C', homeRoom: 'CR-11-UG', size: 42, sharedCourseIds: ['crs-cs-compiler', 'crs-cs-dl', 'crs-cs-pdc', 'crs-se-tbw'], is_sample: true, isSample: true },
  { id: 'grp-2k23-bscs-d', programId: 'prog-bscs', code: '2K23-BSCS-D', name: 'BSCS 7th Sem — Section D', year: 4, semester: 7, section: 'D', homeRoom: 'CR-12-UG', size: 40, sharedCourseIds: ['crs-cs-compiler', 'crs-cs-dl', 'crs-cs-pdc', 'crs-se-tbw'], is_sample: true, isSample: true },
  { id: 'grp-2k23-bscs-e', programId: 'prog-bscs', code: '2K23-BSCS-E', name: 'BSCS 7th Sem — Section E', year: 4, semester: 7, section: 'E', homeRoom: 'CR-20-SMRIMMS', size: 40, sharedCourseIds: ['crs-cs-compiler', 'crs-cs-dl', 'crs-cs-pdc', 'crs-se-tbw'], is_sample: true, isSample: true },

  { id: 'grp-2k26-bscs-a', programId: 'prog-bscs', code: '2K26-BSCS-A', name: 'BSCS 1st Sem — Section A', year: 1, semester: 1, section: 'A', homeRoom: 'CR-29-Acad', size: 54, sharedCourseIds: ['crs-bce-pf', 'crs-bce-ict', 'crs-bee-ap', 'crs-bee-calc', 'crs-bee-fe'], is_sample: true, isSample: true },
  { id: 'grp-2k26-bscs-b', programId: 'prog-bscs', code: '2K26-BSCS-B', name: 'BSCS 1st Sem — Section B', year: 1, semester: 1, section: 'B', homeRoom: 'CR-33-Acad', size: 52, sharedCourseIds: ['crs-bce-pf', 'crs-bce-ict', 'crs-bee-ap', 'crs-bee-calc', 'crs-bee-fe'], is_sample: true, isSample: true },
  { id: 'grp-2k26-bscs-c', programId: 'prog-bscs', code: '2K26-BSCS-C', name: 'BSCS 1st Sem — Section C', year: 1, semester: 1, section: 'C', homeRoom: 'CR-01-UG', size: 52, sharedCourseIds: ['crs-bce-pf', 'crs-bce-ict', 'crs-bee-ap', 'crs-bee-calc', 'crs-bee-fe'], is_sample: true, isSample: true },
  { id: 'grp-2k26-bscs-d', programId: 'prog-bscs', code: '2K26-BSCS-D', name: 'BSCS 1st Sem — Section D', year: 1, semester: 1, section: 'D', homeRoom: 'CR-02-UG', size: 50, sharedCourseIds: ['crs-bce-pf', 'crs-bce-ict', 'crs-bee-ap', 'crs-bee-calc', 'crs-bee-fe'], is_sample: true, isSample: true },
  { id: 'grp-2k26-bscs-e', programId: 'prog-bscs', code: '2K26-BSCS-E', name: 'BSCS 1st Sem — Section E', year: 1, semester: 1, section: 'E', homeRoom: 'CR-03-UG', size: 50, sharedCourseIds: ['crs-bce-pf', 'crs-bce-ict', 'crs-bee-ap', 'crs-bee-calc', 'crs-bee-fe'], is_sample: true, isSample: true }
];

const SLOT_MAP: Record<number, string> = {
  1: '9:00 – 9:50 AM',
  2: '10:00 – 10:50 AM',
  3: '11:00 – 11:50 AM',
  4: '12:00 – 12:50 PM',
  5: '2:00 – 2:50 PM',
  6: '3:00 – 3:50 PM',
  7: '4:00 – 4:50 PM'
};

interface RawSchedEntry {
  groupId: string;
  courseId: string;
  day: DayOfWeek;
  slots: number[]; // e.g. [1, 2] for 0900-1050 lecture, [1] for 0900-0950 lecture, [2, 3, 4] for 1000-1250 3h Lab
  isLab?: boolean;
  instName: string;
  roomCode: string;
  customWindow?: string;
}

const EXACT_SCHEDULES: RawSchedEntry[] = [
  // =========================================================================
  // 2K24-BEE-A (5th Sem, Home Room: CR-18-IAEC)
  // =========================================================================
  { groupId: 'grp-2k24-bee-a', courseId: 'crs-bee-em', day: 'Mon', slots: [1, 2], instName: 'Dr.Jehanzeb Ahmad', roomCode: 'CR-18-IAEC' },
  { groupId: 'grp-2k24-bee-a', courseId: 'crs-bee-mp', day: 'Mon', slots: [3, 4], instName: 'Dr.Noman Mujeeb', roomCode: 'CR-18-IAEC' },
  { groupId: 'grp-2k24-bee-a', courseId: 'crs-bee-eft', day: 'Tue', slots: [1], instName: 'Mr.Zia Ur Rehman', roomCode: 'CR-18-IAEC' },
  { groupId: 'grp-2k24-bee-a', courseId: 'crs-bee-em', day: 'Tue', slots: [2, 3, 4], isLab: true, instName: 'Engr.M.Farooq', roomCode: 'EMS Lab-UG', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k24-bee-a', courseId: 'crs-bee-em', day: 'Wed', slots: [1], instName: 'Dr.Jehanzeb Ahmad', roomCode: 'CR-18-IAEC' },
  { groupId: 'grp-2k24-bee-a', courseId: 'crs-bee-mp', day: 'Wed', slots: [2], instName: 'Dr.Noman Mujeeb', roomCode: 'CR-18-IAEC' },
  { groupId: 'grp-2k24-bee-a', courseId: 'crs-bee-eft', day: 'Wed', slots: [3, 4], instName: 'Mr.Zia Ur Rehman', roomCode: 'CR-18-IAEC' },
  { groupId: 'grp-2k24-bee-a', courseId: 'crs-bee-ps', day: 'Wed', slots: [6, 7], instName: 'Mr.M.Shujaat', roomCode: 'CR-18-IAEC' },
  { groupId: 'grp-2k24-bee-a', courseId: 'crs-bee-ss', day: 'Thu', slots: [1, 2], instName: 'Dr.Sajjad A.Haider', roomCode: 'CR-18-IAEC' },
  { groupId: 'grp-2k24-bee-a', courseId: 'crs-bee-ps', day: 'Thu', slots: [3], instName: 'Mr.M.Shujaat', roomCode: 'CR-18-IAEC' },
  { groupId: 'grp-2k24-bee-a', courseId: 'crs-bee-mp', day: 'Thu', slots: [5, 6, 7], isLab: true, instName: 'Engr.Zainab', roomCode: 'MDA Lab-SMRIMMS', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k24-bee-a', courseId: 'crs-bee-ss', day: 'Fri', slots: [1, 2, 3], isLab: true, instName: 'Engr.Hammad', roomCode: 'DSP & Comm Lab-UG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k24-bee-a', courseId: 'crs-bee-ss', day: 'Fri', slots: [4], instName: 'Dr.Sajjad A.Haider', roomCode: 'CR-18-IAEC' },

  // =========================================================================
  // 2K24-BEE-B (5th Sem, Home Room: CR-18-IAEC)
  // =========================================================================
  { groupId: 'grp-2k24-bee-b', courseId: 'crs-bee-em', day: 'Mon', slots: [1, 2, 3], isLab: true, instName: 'Engr.M.Farooq', roomCode: 'EMS Lab-UG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k24-bee-b', courseId: 'crs-bee-em', day: 'Mon', slots: [5], instName: 'Dr.Jehanzeb Ahmad', roomCode: 'CR-18-IAEC' },
  { groupId: 'grp-2k24-bee-b', courseId: 'crs-bee-eft', day: 'Mon', slots: [6, 7], instName: 'Mr.Zia Ur Rehman', roomCode: 'CR-18-IAEC' },
  { groupId: 'grp-2k24-bee-b', courseId: 'crs-bee-mp', day: 'Tue', slots: [2, 3], instName: 'Dr.Noman Mujeeb', roomCode: 'CR-18-IAEC' },
  { groupId: 'grp-2k24-bee-b', courseId: 'crs-bee-ss', day: 'Tue', slots: [4], instName: 'Dr.Sajjad A.Haider', roomCode: 'CR-18-IAEC' },
  { groupId: 'grp-2k24-bee-b', courseId: 'crs-bee-em', day: 'Tue', slots: [5, 6], instName: 'Dr.Jehanzeb Ahmad', roomCode: 'CR-18-IAEC' },
  { groupId: 'grp-2k24-bee-b', courseId: 'crs-bee-ps', day: 'Tue', slots: [7], instName: 'Mr.M.Shujaat', roomCode: 'CR-18-IAEC' },
  { groupId: 'grp-2k24-bee-b', courseId: 'crs-bee-mp', day: 'Wed', slots: [1, 2, 3], isLab: true, instName: 'Engr.Zainab', roomCode: 'MDA Lab-SMRIMMS', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k24-bee-b', courseId: 'crs-bee-eft', day: 'Wed', slots: [5], instName: 'Mr.Zia Ur Rehman', roomCode: 'CR-18-IAEC' },
  { groupId: 'grp-2k24-bee-b', courseId: 'crs-bee-ss', day: 'Thu', slots: [1, 2, 3], isLab: true, instName: 'Engr.Hammad', roomCode: 'DSP & Comm Lab-UG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k24-bee-b', courseId: 'crs-bee-ps', day: 'Thu', slots: [4], instName: 'Mr.M.Shujaat', roomCode: 'CR-18-IAEC' },
  { groupId: 'grp-2k24-bee-b', courseId: 'crs-bee-ps', day: 'Thu', slots: [5], instName: 'Mr.M.Shujaat', roomCode: 'CR-18-IAEC' },
  { groupId: 'grp-2k24-bee-b', courseId: 'crs-bee-ss', day: 'Fri', slots: [1, 2], instName: 'Dr.Sajjad A.Haider', roomCode: 'CR-18-IAEC' },
  { groupId: 'grp-2k24-bee-b', courseId: 'crs-bee-mp', day: 'Fri', slots: [3], instName: 'Dr.Noman Mujeeb', roomCode: 'CR-18-IAEC' },

  // =========================================================================
  // 2K24-BEE-C (5th Sem, Home Room: CR-19-IAEC)
  // =========================================================================
  { groupId: 'grp-2k24-bee-c', courseId: 'crs-bee-ss', day: 'Mon', slots: [1, 2, 3], isLab: true, instName: 'Engr.Hammad', roomCode: 'DSP & Comm Lab-UG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k24-bee-c', courseId: 'crs-bee-ps', day: 'Mon', slots: [4], instName: 'Mr.M.Shujaat', roomCode: 'CR-19-IAEC' },
  { groupId: 'grp-2k24-bee-c', courseId: 'crs-bee-ps', day: 'Mon', slots: [5], instName: 'Mr.M.Shujaat', roomCode: 'CR-19-IAEC' },
  { groupId: 'grp-2k24-bee-c', courseId: 'crs-bee-mp', day: 'Tue', slots: [1, 2, 3], isLab: true, instName: 'Engr.Zainab', roomCode: 'MDA Lab-SMRIMMS', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k24-bee-c', courseId: 'crs-bee-eft', day: 'Tue', slots: [5, 6], instName: 'Mr.Zia Ur Rehman', roomCode: 'CR-19-IAEC' },
  { groupId: 'grp-2k24-bee-c', courseId: 'crs-bee-ss', day: 'Tue', slots: [7], instName: 'Dr.Imtiaz Alam', roomCode: 'CR-19-IAEC' },
  { groupId: 'grp-2k24-bee-c', courseId: 'crs-bee-mp', day: 'Wed', slots: [1], instName: 'Dr.Noman Mujeeb', roomCode: 'CR-19-IAEC' },
  { groupId: 'grp-2k24-bee-c', courseId: 'crs-bee-em', day: 'Wed', slots: [2, 3], instName: 'Dr.Anjum', roomCode: 'CR-19-IAEC' },
  { groupId: 'grp-2k24-bee-c', courseId: 'crs-bee-ps', day: 'Wed', slots: [4], instName: 'Mr.M.Shujaat', roomCode: 'CR-19-IAEC' },
  { groupId: 'grp-2k24-bee-c', courseId: 'crs-bee-mp', day: 'Thu', slots: [1, 2], instName: 'Dr.Noman Mujeeb', roomCode: 'CR-19-IAEC' },
  { groupId: 'grp-2k24-bee-c', courseId: 'crs-bee-ss', day: 'Thu', slots: [3, 4], instName: 'Dr.Imtiaz Alam', roomCode: 'CR-19-IAEC' },
  { groupId: 'grp-2k24-bee-c', courseId: 'crs-bee-em', day: 'Thu', slots: [5, 6, 7], isLab: true, instName: 'Engr.Ayesha', roomCode: 'EMS Lab-UG', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k24-bee-c', courseId: 'crs-bee-em', day: 'Fri', slots: [1], instName: 'Dr.Anjum', roomCode: 'CR-19-IAEC' },
  { groupId: 'grp-2k24-bee-c', courseId: 'crs-bee-eft', day: 'Fri', slots: [2], instName: 'Mr.Zia Ur Rehman', roomCode: 'CR-19-IAEC' },

  // =========================================================================
  // 2K24-BEE-D (5th Sem, Home Room: CR-19-IAEC)
  // =========================================================================
  { groupId: 'grp-2k24-bee-d', courseId: 'crs-bee-eft', day: 'Mon', slots: [1, 2], instName: 'Dr.Ehtasham', roomCode: 'CR-19-IAEC' },
  { groupId: 'grp-2k24-bee-d', courseId: 'crs-bee-em', day: 'Mon', slots: [3], instName: 'Dr.Anjum', roomCode: 'CR-19-IAEC' },
  { groupId: 'grp-2k24-bee-d', courseId: 'crs-bee-mp', day: 'Mon', slots: [5, 6, 7], isLab: true, instName: 'Engr.Zainab', roomCode: 'MDA Lab-SMRIMMS', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k24-bee-d', courseId: 'crs-bee-mp', day: 'Tue', slots: [1], instName: 'Dr.Noman Mujeeb', roomCode: 'CR-19-IAEC' },
  { groupId: 'grp-2k24-bee-d', courseId: 'crs-bee-ss', day: 'Tue', slots: [2, 3], instName: 'Dr.Imtiaz Alam', roomCode: 'CR-19-IAEC' },
  { groupId: 'grp-2k24-bee-d', courseId: 'crs-bee-eft', day: 'Tue', slots: [4], instName: 'Dr.Ehtasham', roomCode: 'CR-19-IAEC' },
  { groupId: 'grp-2k24-bee-d', courseId: 'crs-bee-ss', day: 'Wed', slots: [1, 2, 3], isLab: true, instName: 'Engr.Hammad', roomCode: 'DSP & Comm Lab-UG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k24-bee-d', courseId: 'crs-bee-em', day: 'Wed', slots: [5, 6], instName: 'Dr.Anjum', roomCode: 'CR-19-IAEC' },
  { groupId: 'grp-2k24-bee-d', courseId: 'crs-bee-ss', day: 'Wed', slots: [7], instName: 'Dr.Imtiaz Alam', roomCode: 'CR-19-IAEC' },
  { groupId: 'grp-2k24-bee-d', courseId: 'crs-bee-ps', day: 'Thu', slots: [5, 6], instName: 'Mr.M.Shujaat', roomCode: 'CR-19-IAEC' },
  { groupId: 'grp-2k24-bee-d', courseId: 'crs-bee-mp', day: 'Fri', slots: [3, 4], instName: 'Dr.Noman Mujeeb', roomCode: 'CR-19-IAEC' },
  { groupId: 'grp-2k24-bee-d', courseId: 'crs-bee-em', day: 'Fri', slots: [5, 6, 7], isLab: true, instName: 'Engr.Ayesha', roomCode: 'EMS Lab-UG', customWindow: '2:30 PM – 4:55 PM' },

  // =========================================================================
  // 2K25-BEE-A (3rd Sem, Home Room: CR-30-Acad)
  // =========================================================================
  { groupId: 'grp-2k25-bee-a', courseId: 'crs-bee-dld', day: 'Mon', slots: [1, 2], instName: 'Dr.Farzana Kulsoom', roomCode: 'CR-30-Acad' },
  { groupId: 'grp-2k25-bee-a', courseId: 'crs-bee-edc', day: 'Mon', slots: [3, 4], instName: 'Dr.Wasim', roomCode: 'CR-30-Acad' },
  { groupId: 'grp-2k25-bee-a', courseId: 'crs-bee-dld', day: 'Mon', slots: [5, 6, 7], isLab: true, instName: 'Engr.M.Umair', roomCode: 'Digital Systems Lab-I-UG', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k25-bee-a', courseId: 'crs-bee-ena', day: 'Tue', slots: [1], instName: 'Dr.Saeed', roomCode: 'CR-30-Acad' },
  { groupId: 'grp-2k25-bee-a', courseId: 'crs-bee-edc', day: 'Tue', slots: [2, 3, 4], isLab: true, instName: 'Engr.Fizza', roomCode: 'Advanced Electronics Lab-IAEC', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k25-bee-a', courseId: 'crs-bee-dsa', day: 'Wed', slots: [1, 2], instName: 'Ms.Rubab', roomCode: 'CR-30-Acad' },
  { groupId: 'grp-2k25-bee-a', courseId: 'crs-bee-cvt', day: 'Wed', slots: [3, 4], instName: 'Mr.M.Ajmal', roomCode: 'CR-30-Acad' },
  { groupId: 'grp-2k25-bee-a', courseId: 'crs-bee-dld', day: 'Thu', slots: [1], instName: 'Dr.Farzana Kulsoom', roomCode: 'CR-30-Acad' },
  { groupId: 'grp-2k25-bee-a', courseId: 'crs-bee-edc', day: 'Thu', slots: [2], instName: 'Dr.Wasim', roomCode: 'CR-30-Acad' },
  { groupId: 'grp-2k25-bee-a', courseId: 'crs-bee-ena', day: 'Thu', slots: [3, 4], instName: 'Dr.Saeed', roomCode: 'CR-30-Acad' },
  { groupId: 'grp-2k25-bee-a', courseId: 'crs-bee-cvt', day: 'Fri', slots: [1], instName: 'Mr.M.Ajmal', roomCode: 'CR-30-Acad' },
  { groupId: 'grp-2k25-bee-a', courseId: 'crs-bee-dsa', day: 'Fri', slots: [2, 3, 4], isLab: true, instName: 'Ms.Rubab', roomCode: 'CL-10-Acad', customWindow: '10:00 AM – 12:50 PM' },

  // =========================================================================
  // 2K25-BEE-B (3rd Sem, Home Room: CR-30-Acad)
  // =========================================================================
  { groupId: 'grp-2k25-bee-b', courseId: 'crs-bee-dld', day: 'Mon', slots: [2, 3, 4], isLab: true, instName: 'Engr.M.Umair', roomCode: 'Digital Systems Lab-I-UG', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k25-bee-b', courseId: 'crs-bee-edc', day: 'Mon', slots: [5, 6], instName: 'Dr.Wasim', roomCode: 'CR-30-Acad' },
  { groupId: 'grp-2k25-bee-b', courseId: 'crs-bee-dld', day: 'Mon', slots: [7], instName: 'Dr.Farzana Kulsoom', roomCode: 'CR-30-Acad' },
  { groupId: 'grp-2k25-bee-b', courseId: 'crs-bee-cvt', day: 'Tue', slots: [2, 3], instName: 'Mr.M.Ajmal', roomCode: 'CR-30-Acad' },
  { groupId: 'grp-2k25-bee-b', courseId: 'crs-bee-ena', day: 'Tue', slots: [4], instName: 'Dr.Saeed', roomCode: 'CR-30-Acad' },
  { groupId: 'grp-2k25-bee-b', courseId: 'crs-bee-dld', day: 'Tue', slots: [5, 6], instName: 'Dr.Farzana Kulsoom', roomCode: 'CR-30-Acad' },
  { groupId: 'grp-2k25-bee-b', courseId: 'crs-bee-edc', day: 'Wed', slots: [2, 3, 4], isLab: true, instName: 'Engr.Fizza', roomCode: 'Advanced Electronics Lab-IAEC', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k25-bee-b', courseId: 'crs-bee-ena', day: 'Wed', slots: [5, 6], instName: 'Dr.Saeed', roomCode: 'CR-30-Acad' },
  { groupId: 'grp-2k25-bee-b', courseId: 'crs-bee-cvt', day: 'Wed', slots: [7], instName: 'Mr.M.Ajmal', roomCode: 'CR-30-Acad' },
  { groupId: 'grp-2k25-bee-b', courseId: 'crs-bee-dsa', day: 'Thu', slots: [2, 3, 4], isLab: true, instName: 'Ms.Rubab', roomCode: 'CL-10-Acad', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k25-bee-b', courseId: 'crs-bee-edc', day: 'Thu', slots: [5], instName: 'Dr.Wasim', roomCode: 'CR-30-Acad' },
  { groupId: 'grp-2k25-bee-b', courseId: 'crs-bee-dsa', day: 'Fri', slots: [2, 3], instName: 'Ms.Rubab', roomCode: 'CR-30-Acad' },

  // =========================================================================
  // 2K25-BEE-C (3rd Sem, Home Room: CR-31-Acad)
  // =========================================================================
  { groupId: 'grp-2k25-bee-c', courseId: 'crs-bee-edc', day: 'Mon', slots: [1, 2], instName: 'Dr.Saqib', roomCode: 'CR-31-Acad' },
  { groupId: 'grp-2k25-bee-c', courseId: 'crs-bee-dld', day: 'Mon', slots: [3, 4], instName: 'Mr.Rashid', roomCode: 'CR-31-Acad' },
  { groupId: 'grp-2k25-bee-c', courseId: 'crs-bee-edc', day: 'Mon', slots: [5, 6, 7], isLab: true, instName: 'Engr.Sadia', roomCode: 'Advanced Electronics Lab-IAEC', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k25-bee-c', courseId: 'crs-bee-ode', day: 'Tue', slots: [1, 2], instName: 'Dr.Jawad', roomCode: 'CR-31-Acad' },
  { groupId: 'grp-2k25-bee-c', courseId: 'crs-bee-ena', day: 'Tue', slots: [3, 4], instName: 'Dr.Adnan', roomCode: 'CR-31-Acad' },
  { groupId: 'grp-2k25-bee-c', courseId: 'crs-bee-dld', day: 'Wed', slots: [2, 3, 4], isLab: true, instName: 'Engr.Wajeeha', roomCode: 'Digital Systems Lab-I-UG', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k25-bee-c', courseId: 'crs-bee-dsa', day: 'Wed', slots: [5, 6], instName: 'Ms.Tabinda', roomCode: 'CR-31-Acad' },
  { groupId: 'grp-2k25-bee-c', courseId: 'crs-bee-edc', day: 'Thu', slots: [1], instName: 'Dr.Saqib', roomCode: 'CR-31-Acad' },
  { groupId: 'grp-2k25-bee-c', courseId: 'crs-bee-dld', day: 'Thu', slots: [2], instName: 'Mr.Rashid', roomCode: 'CR-31-Acad' },
  { groupId: 'grp-2k25-bee-c', courseId: 'crs-bee-ode', day: 'Thu', slots: [3], instName: 'Dr.Jawad', roomCode: 'CR-31-Acad' },
  { groupId: 'grp-2k25-bee-c', courseId: 'crs-bee-ena', day: 'Fri', slots: [1], instName: 'Dr.Adnan', roomCode: 'CR-31-Acad' },
  { groupId: 'grp-2k25-bee-c', courseId: 'crs-bee-dsa', day: 'Fri', slots: [5, 6, 7], isLab: true, instName: 'Ms.Tabinda', roomCode: 'CL-10-Acad', customWindow: '2:30 PM – 4:55 PM' },

  // =========================================================================
  // 2K25-BEE-D (3rd Sem, Home Room: CR-32-Acad)
  // =========================================================================
  { groupId: 'grp-2k25-bee-d', courseId: 'crs-bee-dld', day: 'Mon', slots: [1, 2], instName: 'Mr.Rashid', roomCode: 'CR-32-Acad' },
  { groupId: 'grp-2k25-bee-d', courseId: 'crs-bee-ena', day: 'Mon', slots: [3, 4], instName: 'Dr.Adnan', roomCode: 'CR-32-Acad' },
  { groupId: 'grp-2k25-bee-d', courseId: 'crs-bee-dsa', day: 'Tue', slots: [1, 2, 3], isLab: true, instName: 'Ms.Tabinda', roomCode: 'CL-10-Acad', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k25-bee-d', courseId: 'crs-bee-edc', day: 'Tue', slots: [5, 6], instName: 'Dr.Saqib', roomCode: 'CR-32-Acad' },
  { groupId: 'grp-2k25-bee-d', courseId: 'crs-bee-ode', day: 'Wed', slots: [1, 2], instName: 'Dr.Jawad', roomCode: 'CR-32-Acad' },
  { groupId: 'grp-2k25-bee-d', courseId: 'crs-bee-dsa', day: 'Wed', slots: [3, 4], instName: 'Ms.Tabinda', roomCode: 'CR-32-Acad' },
  { groupId: 'grp-2k25-bee-d', courseId: 'crs-bee-dld', day: 'Thu', slots: [1, 2, 3], isLab: true, instName: 'Engr.Wajeeha', roomCode: 'Digital Systems Lab-I-UG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k25-bee-d', courseId: 'crs-bee-edc', day: 'Thu', slots: [5, 6, 7], isLab: true, instName: 'Engr.Sadia', roomCode: 'Advanced Electronics Lab-IAEC', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k25-bee-d', courseId: 'crs-bee-dld', day: 'Fri', slots: [1], instName: 'Mr.Rashid', roomCode: 'CR-32-Acad' },
  { groupId: 'grp-2k25-bee-d', courseId: 'crs-bee-edc', day: 'Fri', slots: [2], instName: 'Dr.Saqib', roomCode: 'CR-32-Acad' },
  { groupId: 'grp-2k25-bee-d', courseId: 'crs-bee-ena', day: 'Fri', slots: [3], instName: 'Dr.Adnan', roomCode: 'CR-32-Acad' },
  { groupId: 'grp-2k25-bee-d', courseId: 'crs-bee-ode', day: 'Fri', slots: [4], instName: 'Dr.Jawad', roomCode: 'CR-32-Acad' },

  // =========================================================================
  // 2K26-BEE-A..D (1st Sem, Home Rooms: CR-06-UG & CR-07-UG)
  // =========================================================================
  { groupId: 'grp-2k26-bee-a', courseId: 'crs-bee-lca', day: 'Mon', slots: [1, 2], instName: 'Dr.Saeed', roomCode: 'CR-06-UG' },
  { groupId: 'grp-2k26-bee-a', courseId: 'crs-bee-ap', day: 'Mon', slots: [3, 4], instName: 'Dr.Ehtasham', roomCode: 'CR-06-UG' },
  { groupId: 'grp-2k26-bee-a', courseId: 'crs-bee-lca', day: 'Tue', slots: [1, 2, 3], isLab: true, instName: 'Engr.M.Farooq', roomCode: 'Basic Electronics Lab-UG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k26-bee-a', courseId: 'crs-bee-calc', day: 'Wed', slots: [1, 2], instName: 'Mr.M.Ajmal', roomCode: 'CR-06-UG' },
  { groupId: 'grp-2k26-bee-a', courseId: 'crs-bee-fe', day: 'Wed', slots: [3, 4], instName: 'Ms.Rubab', roomCode: 'CR-06-UG' },
  { groupId: 'grp-2k26-bee-a', courseId: 'crs-bee-ew', day: 'Thu', slots: [1, 2, 3], isLab: true, instName: 'Engr.Wajeeha', roomCode: 'Engineering Workshop-UG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k26-bee-a', courseId: 'crs-bee-icp', day: 'Thu', slots: [5, 6], instName: 'Ms.Tabinda', roomCode: 'CR-06-UG' },
  { groupId: 'grp-2k26-bee-a', courseId: 'crs-bee-ap', day: 'Fri', slots: [1, 2, 3], isLab: true, instName: 'Engr.Sadia', roomCode: 'Physics Lab-UG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k26-bee-a', courseId: 'crs-bee-lca', day: 'Fri', slots: [4], instName: 'Dr.Saeed', roomCode: 'CR-06-UG' },

  { groupId: 'grp-2k26-bee-b', courseId: 'crs-bee-ap', day: 'Mon', slots: [1, 2, 3], isLab: true, instName: 'Engr.Sadia', roomCode: 'Physics Lab-UG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k26-bee-b', courseId: 'crs-bee-lca', day: 'Tue', slots: [2, 3], instName: 'Dr.Saeed', roomCode: 'CR-06-UG' },
  { groupId: 'grp-2k26-bee-b', courseId: 'crs-bee-calc', day: 'Tue', slots: [5, 6], instName: 'Mr.M.Ajmal', roomCode: 'CR-06-UG' },
  { groupId: 'grp-2k26-bee-b', courseId: 'crs-bee-lca', day: 'Wed', slots: [1, 2, 3], isLab: true, instName: 'Engr.M.Farooq', roomCode: 'Basic Electronics Lab-UG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k26-bee-b', courseId: 'crs-bee-ap', day: 'Thu', slots: [1, 2], instName: 'Dr.Ehtasham', roomCode: 'CR-06-UG' },
  { groupId: 'grp-2k26-bee-b', courseId: 'crs-bee-fe', day: 'Thu', slots: [3, 4], instName: 'Ms.Rubab', roomCode: 'CR-06-UG' },
  { groupId: 'grp-2k26-bee-b', courseId: 'crs-bee-ew', day: 'Fri', slots: [1, 2, 3], isLab: true, instName: 'Engr.Wajeeha', roomCode: 'Engineering Workshop-UG', customWindow: '9:00 AM – 11:50 AM' },

  { groupId: 'grp-2k26-bee-c', courseId: 'crs-bee-lca', day: 'Mon', slots: [1, 2], instName: 'Dr.Adnan', roomCode: 'CR-07-UG' },
  { groupId: 'grp-2k26-bee-c', courseId: 'crs-bee-calc', day: 'Mon', slots: [3, 4], instName: 'Dr.Jawad', roomCode: 'CR-07-UG' },
  { groupId: 'grp-2k26-bee-c', courseId: 'crs-bee-ew', day: 'Tue', slots: [1, 2, 3], isLab: true, instName: 'Engr.Wajeeha', roomCode: 'Engineering Workshop-UG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k26-bee-c', courseId: 'crs-bee-ap', day: 'Wed', slots: [1, 2], instName: 'Dr.Ehtasham', roomCode: 'CR-07-UG' },
  { groupId: 'grp-2k26-bee-c', courseId: 'crs-bee-is', day: 'Wed', slots: [3, 4], instName: 'Ms.Tabinda', roomCode: 'CR-07-UG' },
  { groupId: 'grp-2k26-bee-c', courseId: 'crs-bee-lca', day: 'Thu', slots: [1, 2, 3], isLab: true, instName: 'Engr.Fizza', roomCode: 'Basic Electronics Lab-UG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k26-bee-c', courseId: 'crs-bee-ap', day: 'Fri', slots: [5, 6, 7], isLab: true, instName: 'Engr.Sadia', roomCode: 'Physics Lab-UG', customWindow: '2:30 PM – 4:55 PM' },

  { groupId: 'grp-2k26-bee-d', courseId: 'crs-bee-ew', day: 'Mon', slots: [1, 2, 3], isLab: true, instName: 'Engr.Wajeeha', roomCode: 'Engineering Workshop-UG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k26-bee-d', courseId: 'crs-bee-lca', day: 'Tue', slots: [1, 2], instName: 'Dr.Adnan', roomCode: 'CR-07-UG' },
  { groupId: 'grp-2k26-bee-d', courseId: 'crs-bee-ap', day: 'Tue', slots: [3, 4], instName: 'Dr.Ehtasham', roomCode: 'CR-07-UG' },
  { groupId: 'grp-2k26-bee-d', courseId: 'crs-bee-ap', day: 'Wed', slots: [5, 6, 7], isLab: true, instName: 'Engr.Sadia', roomCode: 'Physics Lab-UG', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k26-bee-d', courseId: 'crs-bee-calc', day: 'Thu', slots: [1, 2], instName: 'Dr.Jawad', roomCode: 'CR-07-UG' },
  { groupId: 'grp-2k26-bee-d', courseId: 'crs-bee-fe', day: 'Thu', slots: [3, 4], instName: 'Ms.Rubab', roomCode: 'CR-07-UG' },
  { groupId: 'grp-2k26-bee-d', courseId: 'crs-bee-lca', day: 'Fri', slots: [1, 2, 3], isLab: true, instName: 'Engr.Fizza', roomCode: 'Basic Electronics Lab-UG', customWindow: '9:00 AM – 11:50 AM' },

  // =========================================================================
  // 2K23-BEE-A..D (7th Sem, Home Rooms: CR-16-PG & CR-17-PG)
  // =========================================================================
  { groupId: 'grp-2k23-bee-a', courseId: 'crs-bee-psa', day: 'Mon', slots: [1, 2], instName: 'Dr.Jehanzeb Ahmad', roomCode: 'CR-16-PG' },
  { groupId: 'grp-2k23-bee-a', courseId: 'crs-bee-lcs', day: 'Mon', slots: [3, 4], instName: 'Dr.Imtiaz Alam', roomCode: 'CR-16-PG' },
  { groupId: 'grp-2k23-bee-a', courseId: 'crs-bee-lcs', day: 'Tue', slots: [1, 2, 3], isLab: true, instName: 'Engr.Ayesha', roomCode: 'Control Systems Lab-UG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k23-bee-a', courseId: 'crs-bee-dsp', day: 'Wed', slots: [1, 2], instName: 'Dr.Sajjad A.Haider', roomCode: 'CR-16-PG' },
  { groupId: 'grp-2k23-bee-a', courseId: 'crs-bee-emg', day: 'Wed', slots: [3, 4], instName: 'Mr.Zia Ur Rehman', roomCode: 'CR-16-PG' },
  { groupId: 'grp-2k23-bee-a', courseId: 'crs-bee-dsp', day: 'Thu', slots: [2, 3, 4], isLab: true, instName: 'Engr.Hammad', roomCode: 'DSP & Comm Lab-UG', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k23-bee-a', courseId: 'crs-bee-psa', day: 'Fri', slots: [1, 2, 3], isLab: true, instName: 'Engr.M.Farooq', roomCode: 'EMS Lab-UG', customWindow: '9:00 AM – 11:50 AM' },

  { groupId: 'grp-2k23-bee-b', courseId: 'crs-bee-lcs', day: 'Mon', slots: [5, 6, 7], isLab: true, instName: 'Engr.Ayesha', roomCode: 'Control Systems Lab-UG', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k23-bee-b', courseId: 'crs-bee-psa', day: 'Tue', slots: [1, 2], instName: 'Dr.Jehanzeb Ahmad', roomCode: 'CR-16-PG' },
  { groupId: 'grp-2k23-bee-b', courseId: 'crs-bee-dsp', day: 'Tue', slots: [3, 4], instName: 'Dr.Sajjad A.Haider', roomCode: 'CR-16-PG' },
  { groupId: 'grp-2k23-bee-b', courseId: 'crs-bee-psa', day: 'Wed', slots: [5, 6, 7], isLab: true, instName: 'Engr.M.Farooq', roomCode: 'EMS Lab-UG', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k23-bee-b', courseId: 'crs-bee-lcs', day: 'Thu', slots: [1, 2], instName: 'Dr.Imtiaz Alam', roomCode: 'CR-16-PG' },
  { groupId: 'grp-2k23-bee-b', courseId: 'crs-bee-emg', day: 'Thu', slots: [3, 4], instName: 'Mr.Zia Ur Rehman', roomCode: 'CR-16-PG' },
  { groupId: 'grp-2k23-bee-b', courseId: 'crs-bee-dsp', day: 'Fri', slots: [5, 6, 7], isLab: true, instName: 'Engr.Hammad', roomCode: 'DSP & Comm Lab-UG', customWindow: '2:30 PM – 4:55 PM' },

  { groupId: 'grp-2k23-bee-c', courseId: 'crs-bee-dsp', day: 'Mon', slots: [1, 2], instName: 'Dr.Anjum', roomCode: 'CR-17-PG' },
  { groupId: 'grp-2k23-bee-c', courseId: 'crs-bee-emg', day: 'Mon', slots: [3, 4], instName: 'Mr.Rashid', roomCode: 'CR-17-PG' },
  { groupId: 'grp-2k23-bee-c', courseId: 'crs-bee-dsp', day: 'Tue', slots: [5, 6, 7], isLab: true, instName: 'Engr.Hammad', roomCode: 'DSP & Comm Lab-UG', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k23-bee-c', courseId: 'crs-bee-psa', day: 'Wed', slots: [1, 2], instName: 'Dr.Saqib', roomCode: 'CR-17-PG' },
  { groupId: 'grp-2k23-bee-c', courseId: 'crs-bee-lcs', day: 'Wed', slots: [3, 4], instName: 'Dr.Wasim', roomCode: 'CR-17-PG' },
  { groupId: 'grp-2k23-bee-c', courseId: 'crs-bee-lcs', day: 'Thu', slots: [1, 2, 3], isLab: true, instName: 'Engr.Ayesha', roomCode: 'Control Systems Lab-UG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k23-bee-c', courseId: 'crs-bee-psa', day: 'Fri', slots: [2, 3, 4], isLab: true, instName: 'Engr.M.Farooq', roomCode: 'EMS Lab-UG', customWindow: '10:00 AM – 12:50 PM' },

  { groupId: 'grp-2k23-bee-d', courseId: 'crs-bee-psa', day: 'Mon', slots: [5, 6], instName: 'Dr.Saqib', roomCode: 'CR-17-PG' },
  { groupId: 'grp-2k23-bee-d', courseId: 'crs-bee-lcs', day: 'Tue', slots: [1, 2], instName: 'Dr.Wasim', roomCode: 'CR-17-PG' },
  { groupId: 'grp-2k23-bee-d', courseId: 'crs-bee-emg', day: 'Tue', slots: [3, 4], instName: 'Mr.Rashid', roomCode: 'CR-17-PG' },
  { groupId: 'grp-2k23-bee-d', courseId: 'crs-bee-lcs', day: 'Wed', slots: [1, 2, 3], isLab: true, instName: 'Engr.Ayesha', roomCode: 'Control Systems Lab-UG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k23-bee-d', courseId: 'crs-bee-dsp', day: 'Thu', slots: [1, 2], instName: 'Dr.Anjum', roomCode: 'CR-17-PG' },
  { groupId: 'grp-2k23-bee-d', courseId: 'crs-bee-psa', day: 'Thu', slots: [5, 6, 7], isLab: true, instName: 'Engr.M.Farooq', roomCode: 'EMS Lab-UG', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k23-bee-d', courseId: 'crs-bee-dsp', day: 'Fri', slots: [1, 2, 3], isLab: true, instName: 'Engr.Hammad', roomCode: 'DSP & Comm Lab-UG', customWindow: '9:00 AM – 11:50 AM' },

  // =========================================================================
  // 2K25-BCE-A (3rd Sem, Home Room: CR-34-Acad) — Exact from Prompt
  // =========================================================================
  { groupId: 'grp-2k25-bce-a', courseId: 'crs-bce-ca', day: 'Mon', slots: [1, 2], instName: 'Dr.M.Imran', roomCode: 'CR-34-Acad' },
  { groupId: 'grp-2k25-bce-a', courseId: 'crs-bce-oop', day: 'Mon', slots: [3, 4], instName: 'Ms.Sana', roomCode: 'CR-34-Acad' },
  { groupId: 'grp-2k25-bce-a', courseId: 'crs-bce-ca', day: 'Mon', slots: [5, 6, 7], isLab: true, instName: 'Engr.Ahsan', roomCode: 'MDA Lab-SMRIMMS', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k25-bce-a', courseId: 'crs-bee-ss', day: 'Tue', slots: [1, 2], instName: 'Dr.Waqas', roomCode: 'CR-34-Acad' },
  { groupId: 'grp-2k25-bce-a', courseId: 'crs-bce-la', day: 'Tue', slots: [3, 4], instName: 'Mr.Salman', roomCode: 'CR-34-Acad' },
  { groupId: 'grp-2k25-bce-a', courseId: 'crs-bce-oop', day: 'Wed', slots: [2, 3, 4], isLab: true, instName: 'Engr.M.Ali', roomCode: 'CL-08-PG', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k25-bce-a', courseId: 'crs-bce-ca', day: 'Wed', slots: [5], instName: 'Dr.M.Imran', roomCode: 'CR-34-Acad' },
  { groupId: 'grp-2k25-bce-a', courseId: 'crs-bce-oop', day: 'Wed', slots: [6], instName: 'Ms.Sana', roomCode: 'CR-34-Acad' },
  { groupId: 'grp-2k25-bce-a', courseId: 'crs-bce-esw', day: 'Thu', slots: [1, 2, 3], isLab: true, instName: 'Engr.Komal', roomCode: 'Control Systems Lab-UG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k25-bce-a', courseId: 'crs-bee-ss', day: 'Thu', slots: [4], instName: 'Dr.Waqas', roomCode: 'CR-34-Acad' },
  { groupId: 'grp-2k25-bce-a', courseId: 'crs-bce-la', day: 'Fri', slots: [1], instName: 'Mr.Salman', roomCode: 'CR-34-Acad' },
  { groupId: 'grp-2k25-bce-a', courseId: 'crs-bee-ss', day: 'Fri', slots: [2, 3, 4], isLab: true, instName: 'Engr.Bilal', roomCode: 'DSP & Comm Lab-UG', customWindow: '10:00 AM – 12:50 PM' },

  // =========================================================================
  // 2K26-BCE-A (1st Sem, Home Room: CR-13-UG)
  // =========================================================================
  { groupId: 'grp-2k26-bce-a', courseId: 'crs-bce-pf', day: 'Mon', slots: [1, 2], instName: 'Ms.Sana', roomCode: 'CR-13-UG' },
  { groupId: 'grp-2k26-bce-a', courseId: 'crs-bee-lca', day: 'Mon', slots: [3, 4], instName: 'Dr.Waqas', roomCode: 'CR-13-UG' },
  { groupId: 'grp-2k26-bce-a', courseId: 'crs-bce-pf', day: 'Tue', slots: [2, 3, 4], isLab: true, instName: 'Engr.M.Ali', roomCode: 'CL-08-PG', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k26-bce-a', courseId: 'crs-bce-ict', day: 'Wed', slots: [1, 2], instName: 'Dr.M.Imran', roomCode: 'CR-13-UG' },
  { groupId: 'grp-2k26-bce-a', courseId: 'crs-bee-calc', day: 'Wed', slots: [3, 4], instName: 'Mr.Salman', roomCode: 'CR-13-UG' },
  { groupId: 'grp-2k26-bce-a', courseId: 'crs-bee-lca', day: 'Thu', slots: [2, 3, 4], isLab: true, instName: 'Engr.Ahsan', roomCode: 'Basic Electronics Lab-UG', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k26-bce-a', courseId: 'crs-bee-fe', day: 'Thu', slots: [5, 6], instName: 'Ms.Rubab', roomCode: 'CR-13-UG' },
  { groupId: 'grp-2k26-bce-a', courseId: 'crs-bce-ict', day: 'Fri', slots: [1, 2, 3], isLab: true, instName: 'Engr.Komal', roomCode: 'CL-08-PG', customWindow: '9:00 AM – 11:50 AM' },

  // =========================================================================
  // 2K24-BESE-A (5th Sem, Home Room: CR-21-SMRIMMS) — Exact from Prompt
  // =========================================================================
  { groupId: 'grp-2k24-bese-a', courseId: 'crs-se-cc', day: 'Mon', slots: [1, 2], instName: 'Dr.Faisal', roomCode: 'CR-21-SMRIMMS' },
  { groupId: 'grp-2k24-bese-a', courseId: 'crs-se-scd', day: 'Mon', slots: [3, 4], instName: 'Mr.Aamir', roomCode: 'CR-21-SMRIMMS' },
  { groupId: 'grp-2k24-bese-a', courseId: 'crs-se-ml', day: 'Tue', slots: [1, 2], instName: 'Dr.Hina', roomCode: 'CR-21-SMRIMMS' },
  { groupId: 'grp-2k24-bese-a', courseId: 'crs-se-scd', day: 'Tue', slots: [5, 6, 7], isLab: true, instName: 'Engr.Sana', roomCode: 'CL-04-UG', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k24-bese-a', courseId: 'crs-se-spm', day: 'Wed', slots: [1, 2], instName: 'Ms.Madiha', roomCode: 'CR-21-SMRIMMS' },
  { groupId: 'grp-2k24-bese-a', courseId: 'crs-se-tbw', day: 'Wed', slots: [3, 4], instName: 'Ms.Nadia', roomCode: 'CR-21-SMRIMMS' },
  { groupId: 'grp-2k24-bese-a', courseId: 'crs-se-ml', day: 'Thu', slots: [1, 2, 3], isLab: true, instName: 'Engr.Tahir', roomCode: 'CL-02-UG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k24-bese-a', courseId: 'crs-se-spm', day: 'Thu', slots: [5], instName: 'Ms.Madiha', roomCode: 'CR-21-SMRIMMS' },
  { groupId: 'grp-2k24-bese-a', courseId: 'crs-se-tbw', day: 'Thu', slots: [6], instName: 'Ms.Nadia', roomCode: 'CR-21-SMRIMMS' },
  { groupId: 'grp-2k24-bese-a', courseId: 'crs-se-cc', day: 'Fri', slots: [2, 3, 4], isLab: true, instName: 'Engr.Noman', roomCode: 'Embedded Systems Lab-PG', customWindow: '10:00 AM – 12:50 PM' },

  // =========================================================================
  // 2K24-BESE-B (5th Sem, Home Room: CR-22-SMRIMMS) — Exact from Prompt
  // =========================================================================
  { groupId: 'grp-2k24-bese-b', courseId: 'crs-se-scd', day: 'Mon', slots: [2, 3, 4], isLab: true, instName: 'Engr.Sana', roomCode: 'CL-04-UG', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k24-bese-b', courseId: 'crs-se-cc', day: 'Mon', slots: [5, 6], instName: 'Dr.Faisal', roomCode: 'CR-22-SMRIMMS' },
  { groupId: 'grp-2k24-bese-b', courseId: 'crs-se-spm', day: 'Tue', slots: [1, 2], instName: 'Ms.Madiha', roomCode: 'CR-22-SMRIMMS' },
  { groupId: 'grp-2k24-bese-b', courseId: 'crs-se-ml', day: 'Tue', slots: [3, 4], instName: 'Dr.Hina', roomCode: 'CR-22-SMRIMMS' },
  { groupId: 'grp-2k24-bese-b', courseId: 'crs-se-ml', day: 'Wed', slots: [2, 3, 4], isLab: true, instName: 'Engr.Tahir', roomCode: 'CL-02-UG', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k24-bese-b', courseId: 'crs-se-scd', day: 'Wed', slots: [5, 6], instName: 'Mr.Aamir', roomCode: 'CR-22-SMRIMMS' },
  { groupId: 'grp-2k24-bese-b', courseId: 'crs-se-tbw', day: 'Thu', slots: [1, 2], instName: 'Ms.Hira', roomCode: 'CR-22-SMRIMMS' },
  { groupId: 'grp-2k24-bese-b', courseId: 'crs-se-spm', day: 'Thu', slots: [3], instName: 'Ms.Madiha', roomCode: 'CR-22-SMRIMMS' },
  { groupId: 'grp-2k24-bese-b', courseId: 'crs-se-cc', day: 'Thu', slots: [5, 6, 7], isLab: true, instName: 'Engr.Noman', roomCode: 'Embedded Systems Lab-PG', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k24-bese-b', courseId: 'crs-se-tbw', day: 'Fri', slots: [1], instName: 'Ms.Hira', roomCode: 'CR-22-SMRIMMS' },

  // =========================================================================
  // 2K25-BESE-A (3rd Sem, Home Room: CR-23-Acad) — Exact from Prompt
  // =========================================================================
  { groupId: 'grp-2k25-bese-a', courseId: 'crs-cs-dsa', day: 'Mon', slots: [1, 2], instName: 'Dr.Tariq', roomCode: 'CR-23-Acad' },
  { groupId: 'grp-2k25-bese-a', courseId: 'crs-se-se', day: 'Mon', slots: [3, 4], instName: 'Mr.Usman', roomCode: 'CR-23-Acad' },
  { groupId: 'grp-2k25-bese-a', courseId: 'crs-cs-coal', day: 'Tue', slots: [1, 2], instName: 'Ms.Zara', roomCode: 'CR-23-Acad' },
  { groupId: 'grp-2k25-bese-a', courseId: 'crs-cs-dsa', day: 'Tue', slots: [5, 6, 7], isLab: true, instName: 'Engr.M.uzair', roomCode: 'CL-11-Acad', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k25-bese-a', courseId: 'crs-se-ds', day: 'Wed', slots: [1, 2], instName: 'Mr.Kamran', roomCode: 'CR-23-Acad' },
  { groupId: 'grp-2k25-bese-a', courseId: 'crs-bce-la', day: 'Wed', slots: [3, 4], instName: 'Dr.Nadia', roomCode: 'CR-23-Acad' },
  { groupId: 'grp-2k25-bese-a', courseId: 'crs-cs-coal', day: 'Thu', slots: [2, 3, 4], isLab: true, instName: 'Engr.Zeeshan', roomCode: 'Digital Systems Lab-I-UG', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k25-bese-a', courseId: 'crs-cs-dsa', day: 'Thu', slots: [5], instName: 'Dr.Tariq', roomCode: 'CR-23-Acad' },
  { groupId: 'grp-2k25-bese-a', courseId: 'crs-se-se', day: 'Thu', slots: [6], instName: 'Mr.Usman', roomCode: 'CR-23-Acad' },
  { groupId: 'grp-2k25-bese-a', courseId: 'crs-se-pp', day: 'Fri', slots: [1, 2], instName: 'Mr.Rizwan', roomCode: 'CR-23-Acad' },
  { groupId: 'grp-2k25-bese-a', courseId: 'crs-se-ds', day: 'Fri', slots: [3], instName: 'Mr.Kamran', roomCode: 'CR-23-Acad' },
  { groupId: 'grp-2k25-bese-a', courseId: 'crs-bce-la', day: 'Fri', slots: [4], instName: 'Dr.Nadia', roomCode: 'CR-23-Acad' },

  // =========================================================================
  // 2K25-BESE-B (3rd Sem, Home Room: CR-23-Acad) — Exact from Prompt
  // =========================================================================
  { groupId: 'grp-2k25-bese-b', courseId: 'crs-cs-dsa', day: 'Mon', slots: [2, 3, 4], isLab: true, instName: 'Engr.M.uzair', roomCode: 'CL-11-Acad', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k25-bese-b', courseId: 'crs-cs-dsa', day: 'Mon', slots: [5, 6], instName: 'Dr.Tariq', roomCode: 'CR-23-Acad' },
  { groupId: 'grp-2k25-bese-b', courseId: 'crs-se-se', day: 'Tue', slots: [3, 4], instName: 'Mr.Usman', roomCode: 'CR-23-Acad' },
  { groupId: 'grp-2k25-bese-b', courseId: 'crs-se-ds', day: 'Tue', slots: [5, 6], instName: 'Mr.Kamran', roomCode: 'CR-23-Acad' },
  { groupId: 'grp-2k25-bese-b', courseId: 'crs-cs-coal', day: 'Wed', slots: [2, 3, 4], isLab: true, instName: 'Engr.Rabia', roomCode: 'Digital Systems Lab-I-UG', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k25-bese-b', courseId: 'crs-cs-coal', day: 'Wed', slots: [5, 6], instName: 'Ms.Zara', roomCode: 'CR-23-Acad' },
  { groupId: 'grp-2k25-bese-b', courseId: 'crs-bce-la', day: 'Thu', slots: [1, 2], instName: 'Dr.Nadia', roomCode: 'CR-23-Acad' },
  { groupId: 'grp-2k25-bese-b', courseId: 'crs-se-pp', day: 'Thu', slots: [3, 4], instName: 'Mr.Rizwan', roomCode: 'CR-23-Acad' },
  { groupId: 'grp-2k25-bese-b', courseId: 'crs-cs-dsa', day: 'Fri', slots: [5], instName: 'Dr.Tariq', roomCode: 'CR-23-Acad' },
  { groupId: 'grp-2k25-bese-b', courseId: 'crs-se-se', day: 'Fri', slots: [6], instName: 'Mr.Usman', roomCode: 'CR-23-Acad' },
  { groupId: 'grp-2k25-bese-b', courseId: 'crs-se-ds', day: 'Fri', slots: [7], instName: 'Mr.Kamran', roomCode: 'CR-23-Acad' },

  // =========================================================================
  // 2K23-BESE-A & B (7th Sem) and 2K26-BESE-A & B (1st Sem)
  // =========================================================================
  { groupId: 'grp-2k23-bese-a', courseId: 'crs-se-sqe', day: 'Mon', slots: [1, 2], instName: 'Dr.Faisal', roomCode: 'CR-09-UG' },
  { groupId: 'grp-2k23-bese-a', courseId: 'crs-se-sda', day: 'Mon', slots: [3, 4], instName: 'Dr.Hina', roomCode: 'CR-09-UG' },
  { groupId: 'grp-2k23-bese-a', courseId: 'crs-se-sqe', day: 'Tue', slots: [2, 3, 4], isLab: true, instName: 'Engr.Sana', roomCode: 'CL-04-UG', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k23-bese-a', courseId: 'crs-se-devops', day: 'Wed', slots: [1, 2], instName: 'Mr.Aamir', roomCode: 'CR-09-UG' },
  { groupId: 'grp-2k23-bese-a', courseId: 'crs-bee-emg', day: 'Wed', slots: [3, 4], instName: 'Ms.Madiha', roomCode: 'CR-09-UG' },
  { groupId: 'grp-2k23-bese-a', courseId: 'crs-se-devops', day: 'Thu', slots: [5, 6, 7], isLab: true, instName: 'Engr.Tahir', roomCode: 'CL-02-UG', customWindow: '2:00 PM – 4:50 PM' },

  { groupId: 'grp-2k23-bese-b', courseId: 'crs-se-devops', day: 'Mon', slots: [1, 2], instName: 'Mr.Aamir', roomCode: 'CR-10-UG' },
  { groupId: 'grp-2k23-bese-b', courseId: 'crs-se-sqe', day: 'Tue', slots: [1, 2], instName: 'Dr.Faisal', roomCode: 'CR-10-UG' },
  { groupId: 'grp-2k23-bese-b', courseId: 'crs-se-devops', day: 'Wed', slots: [5, 6, 7], isLab: true, instName: 'Engr.Tahir', roomCode: 'CL-02-UG', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k23-bese-b', courseId: 'crs-se-sda', day: 'Thu', slots: [1, 2], instName: 'Dr.Hina', roomCode: 'CR-10-UG' },
  { groupId: 'grp-2k23-bese-b', courseId: 'crs-se-sqe', day: 'Fri', slots: [1, 2, 3], isLab: true, instName: 'Engr.Sana', roomCode: 'CL-04-UG', customWindow: '9:00 AM – 11:50 AM' },

  { groupId: 'grp-2k26-bese-a', courseId: 'crs-bce-pf', day: 'Mon', slots: [1, 2], instName: 'Mr.Usman', roomCode: 'CR-14-UG' },
  { groupId: 'grp-2k26-bese-a', courseId: 'crs-bce-ict', day: 'Mon', slots: [3, 4], instName: 'Ms.Zara', roomCode: 'CR-14-UG' },
  { groupId: 'grp-2k26-bese-a', courseId: 'crs-bce-pf', day: 'Tue', slots: [1, 2, 3], isLab: true, instName: 'Engr.M.uzair', roomCode: 'CL-11-Acad', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k26-bese-a', courseId: 'crs-bee-calc', day: 'Wed', slots: [1, 2], instName: 'Dr.Nadia', roomCode: 'CR-14-UG' },
  { groupId: 'grp-2k26-bese-a', courseId: 'crs-bee-fe', day: 'Wed', slots: [3, 4], instName: 'Ms.Nadia', roomCode: 'CR-14-UG' },
  { groupId: 'grp-2k26-bese-a', courseId: 'crs-bce-ict', day: 'Thu', slots: [2, 3, 4], isLab: true, instName: 'Engr.Rabia', roomCode: 'CL-04-UG', customWindow: '10:00 AM – 12:50 PM' },

  { groupId: 'grp-2k26-bese-b', courseId: 'crs-bce-pf', day: 'Mon', slots: [5, 6, 7], isLab: true, instName: 'Engr.M.uzair', roomCode: 'CL-11-Acad', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k26-bese-b', courseId: 'crs-bce-pf', day: 'Tue', slots: [1, 2], instName: 'Mr.Usman', roomCode: 'CR-15-UG' },
  { groupId: 'grp-2k26-bese-b', courseId: 'crs-bce-ict', day: 'Tue', slots: [3, 4], instName: 'Ms.Zara', roomCode: 'CR-15-UG' },
  { groupId: 'grp-2k26-bese-b', courseId: 'crs-bce-ict', day: 'Wed', slots: [1, 2, 3], isLab: true, instName: 'Engr.Rabia', roomCode: 'CL-04-UG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k26-bese-b', courseId: 'crs-bee-calc', day: 'Thu', slots: [1, 2], instName: 'Dr.Nadia', roomCode: 'CR-15-UG' },
  { groupId: 'grp-2k26-bese-b', courseId: 'crs-bee-fe', day: 'Fri', slots: [1, 2], instName: 'Ms.Hira', roomCode: 'CR-15-UG' },

  // =========================================================================
  // 2K25-BSCS-A (3rd Sem, Home Room: CR-24-Acad) — Exact from Prompt
  // =========================================================================
  { groupId: 'grp-2k25-bscs-a', courseId: 'crs-cs-dsa', day: 'Mon', slots: [1, 2], instName: 'Dr.Kashif', roomCode: 'CR-24-Acad' },
  { groupId: 'grp-2k25-bscs-a', courseId: 'crs-cs-coal', day: 'Mon', slots: [3, 4], instName: 'Mr.Junaid', roomCode: 'CR-24-Acad' },
  { groupId: 'grp-2k25-bscs-a', courseId: 'crs-cs-AI', day: 'Tue', slots: [1, 2], instName: 'Prof. Alan Turing', roomCode: 'CR-24-Acad' },
  { groupId: 'grp-2k25-bscs-a', courseId: 'crs-cs-dsa', day: 'Tue', slots: [5, 6, 7], isLab: true, instName: 'Engr.Haris', roomCode: 'CL-12-Acad', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k25-bscs-a', courseId: 'crs-cs-cn', day: 'Wed', slots: [1, 2], instName: 'Mr.Asif', roomCode: 'CR-24-Acad' },
  { groupId: 'grp-2k25-bscs-a', courseId: 'crs-cs-isec', day: 'Wed', slots: [3, 4], instName: 'Dr.Zubair', roomCode: 'CR-24-Acad' },
  { groupId: 'grp-2k25-bscs-a', courseId: 'crs-cs-AI', day: 'Wed', slots: [5, 6, 7], isLab: true, instName: 'Engr.M.Saad', roomCode: 'CL-05-UG', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k25-bscs-a', courseId: 'crs-cs-coal', day: 'Thu', slots: [2, 3, 4], isLab: true, instName: 'Engr.Kiran', roomCode: 'Digital Systems-II-Acad', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k25-bscs-a', courseId: 'crs-cs-mvc', day: 'Thu', slots: [5, 6], instName: 'Dr.Amina', roomCode: 'CR-24-Acad' },
  { groupId: 'grp-2k25-bscs-a', courseId: 'crs-cs-dsa', day: 'Fri', slots: [1], instName: 'Dr.Kashif', roomCode: 'CR-24-Acad' },
  { groupId: 'grp-2k25-bscs-a', courseId: 'crs-cs-mvc', day: 'Fri', slots: [2], instName: 'Dr.Amina', roomCode: 'CR-24-Acad' },
  { groupId: 'grp-2k25-bscs-a', courseId: 'crs-cs-isec', day: 'Fri', slots: [3], instName: 'Dr.Zubair', roomCode: 'CR-24-Acad' },
  { groupId: 'grp-2k25-bscs-a', courseId: 'crs-cs-cn', day: 'Fri', slots: [5, 6, 7], isLab: true, instName: 'Engr.Talha', roomCode: 'CL-01-UG', customWindow: '2:30 PM – 4:55 PM' },

  // =========================================================================
  // 2K25-BSCS-B (3rd Sem, Home Room: CR-25-Acad) — Exact from Prompt
  // =========================================================================
  { groupId: 'grp-2k25-bscs-b', courseId: 'crs-cs-dsa', day: 'Mon', slots: [2, 3, 4], isLab: true, instName: 'Engr.Haris', roomCode: 'CL-12-Acad', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k25-bscs-b', courseId: 'crs-cs-AI', day: 'Mon', slots: [5, 6], instName: 'Prof. Alan Turing', roomCode: 'CR-25-Acad' },
  { groupId: 'grp-2k25-bscs-b', courseId: 'crs-cs-dsa', day: 'Tue', slots: [1, 2], instName: 'Dr.Kashif', roomCode: 'CR-25-Acad' },
  { groupId: 'grp-2k25-bscs-b', courseId: 'crs-cs-cn', day: 'Tue', slots: [3, 4], instName: 'Mr.Asif', roomCode: 'CR-25-Acad' },
  { groupId: 'grp-2k25-bscs-b', courseId: 'crs-cs-AI', day: 'Tue', slots: [5, 6, 7], isLab: true, instName: 'Engr.M.Saad', roomCode: 'CL-05-UG', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k25-bscs-b', courseId: 'crs-cs-coal', day: 'Wed', slots: [2, 3, 4], isLab: true, instName: 'Engr.Kiran', roomCode: 'Digital Systems-II-Acad', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k25-bscs-b', courseId: 'crs-cs-coal', day: 'Wed', slots: [5, 6], instName: 'Mr.Junaid', roomCode: 'CR-25-Acad' },
  { groupId: 'grp-2k25-bscs-b', courseId: 'crs-cs-isec', day: 'Thu', slots: [1, 2], instName: 'Dr.Zubair', roomCode: 'CR-25-Acad' },
  { groupId: 'grp-2k25-bscs-b', courseId: 'crs-cs-mvc', day: 'Thu', slots: [3, 4], instName: 'Dr.Amina', roomCode: 'CR-25-Acad' },
  { groupId: 'grp-2k25-bscs-b', courseId: 'crs-cs-cn', day: 'Thu', slots: [5, 6, 7], isLab: true, instName: 'Engr.Talha', roomCode: 'CL-01-UG', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k25-bscs-b', courseId: 'crs-cs-dsa', day: 'Fri', slots: [2], instName: 'Dr.Kashif', roomCode: 'CR-25-Acad' },
  { groupId: 'grp-2k25-bscs-b', courseId: 'crs-cs-mvc', day: 'Fri', slots: [3], instName: 'Dr.Amina', roomCode: 'CR-25-Acad' },
  { groupId: 'grp-2k25-bscs-b', courseId: 'crs-cs-isec', day: 'Fri', slots: [4], instName: 'Dr.Zubair', roomCode: 'CR-25-Acad' },

  // =========================================================================
  // 2K25-BSCS-C (3rd Sem, Home Room: CR-26-Acad) — Exact from Prompt
  // =========================================================================
  { groupId: 'grp-2k25-bscs-c', courseId: 'crs-cs-cn', day: 'Mon', slots: [1, 2], instName: 'Mr.Asif', roomCode: 'CR-26-Acad' },
  { groupId: 'grp-2k25-bscs-c', courseId: 'crs-cs-isec', day: 'Mon', slots: [3, 4], instName: 'Dr.Zubair', roomCode: 'CR-26-Acad' },
  { groupId: 'grp-2k25-bscs-c', courseId: 'crs-cs-cn', day: 'Mon', slots: [5, 6, 7], isLab: true, instName: 'Engr.Talha', roomCode: 'CL-01-UG', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k25-bscs-c', courseId: 'crs-cs-coal', day: 'Tue', slots: [2, 3, 4], isLab: true, instName: 'Engr.Kiran', roomCode: 'Digital Systems-II-Acad', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k25-bscs-c', courseId: 'crs-cs-dsa', day: 'Tue', slots: [5, 6], instName: 'Dr.Hassan', roomCode: 'CR-26-Acad' },
  { groupId: 'grp-2k25-bscs-c', courseId: 'crs-cs-AI', day: 'Wed', slots: [1, 2], instName: 'Ms.Saima', roomCode: 'CR-26-Acad' },
  { groupId: 'grp-2k25-bscs-c', courseId: 'crs-cs-coal', day: 'Wed', slots: [3, 4], instName: 'Mr.Junaid', roomCode: 'CR-26-Acad' },
  { groupId: 'grp-2k25-bscs-c', courseId: 'crs-cs-dsa', day: 'Thu', slots: [2, 3, 4], isLab: true, instName: 'Engr.Danish', roomCode: 'CL-12-Acad', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k25-bscs-c', courseId: 'crs-cs-mvc', day: 'Thu', slots: [5, 6], instName: 'Dr.Amina', roomCode: 'CR-26-Acad' },
  { groupId: 'grp-2k25-bscs-c', courseId: 'crs-cs-dsa', day: 'Thu', slots: [7], instName: 'Dr.Hassan', roomCode: 'CR-26-Acad' },
  { groupId: 'grp-2k25-bscs-c', courseId: 'crs-cs-AI', day: 'Fri', slots: [2, 3, 4], isLab: true, instName: 'Engr.Nida', roomCode: 'CL-05-UG', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k25-bscs-c', courseId: 'crs-cs-isec', day: 'Fri', slots: [5], instName: 'Dr.Zubair', roomCode: 'CR-26-Acad' },
  { groupId: 'grp-2k25-bscs-c', courseId: 'crs-cs-mvc', day: 'Fri', slots: [6], instName: 'Dr.Amina', roomCode: 'CR-26-Acad' },

  // =========================================================================
  // 2K25-BSCS-D (3rd Sem, Home Room: CR-27-Acad) — Exact from Prompt
  // =========================================================================
  { groupId: 'grp-2k25-bscs-d', courseId: 'crs-cs-coal', day: 'Mon', slots: [2, 3, 4], isLab: true, instName: 'Engr.Kiran', roomCode: 'Digital Systems-II-Acad', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k25-bscs-d', courseId: 'crs-cs-dsa', day: 'Mon', slots: [5, 6], instName: 'Dr.Hassan', roomCode: 'CR-27-Acad' },
  { groupId: 'grp-2k25-bscs-d', courseId: 'crs-cs-AI', day: 'Tue', slots: [1, 2], instName: 'Ms.Saima', roomCode: 'CR-27-Acad' },
  { groupId: 'grp-2k25-bscs-d', courseId: 'crs-cs-mvc', day: 'Tue', slots: [3, 4], instName: 'Dr.Adeel', roomCode: 'CR-27-Acad' },
  { groupId: 'grp-2k25-bscs-d', courseId: 'crs-cs-cn', day: 'Tue', slots: [5, 6, 7], isLab: true, instName: 'Engr.Fahad', roomCode: 'CL-01-UG', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k25-bscs-d', courseId: 'crs-cs-dsa', day: 'Wed', slots: [2, 3, 4], isLab: true, instName: 'Engr.Danish', roomCode: 'CL-12-Acad', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k25-bscs-d', courseId: 'crs-cs-cn', day: 'Wed', slots: [5, 6], instName: 'Mr.Waqar', roomCode: 'CR-27-Acad' },
  { groupId: 'grp-2k25-bscs-d', courseId: 'crs-cs-coal', day: 'Thu', slots: [1, 2], instName: 'Ms.Farah', roomCode: 'CR-27-Acad' },
  { groupId: 'grp-2k25-bscs-d', courseId: 'crs-cs-isec', day: 'Thu', slots: [3, 4], instName: 'Mr.Babar', roomCode: 'CR-27-Acad' },
  { groupId: 'grp-2k25-bscs-d', courseId: 'crs-cs-AI', day: 'Thu', slots: [5, 6, 7], isLab: true, instName: 'Engr.Nida', roomCode: 'CL-05-UG', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k25-bscs-d', courseId: 'crs-cs-dsa', day: 'Fri', slots: [1], instName: 'Dr.Hassan', roomCode: 'CR-27-Acad' },
  { groupId: 'grp-2k25-bscs-d', courseId: 'crs-cs-mvc', day: 'Fri', slots: [2], instName: 'Dr.Adeel', roomCode: 'CR-27-Acad' },
  { groupId: 'grp-2k25-bscs-d', courseId: 'crs-cs-isec', day: 'Fri', slots: [3], instName: 'Mr.Babar', roomCode: 'CR-27-Acad' },

  // =========================================================================
  // 2K25-BSCS-E (3rd Sem, Home Room: CR-28-Acad) — Exact from Prompt
  // =========================================================================
  { groupId: 'grp-2k25-bscs-e', courseId: 'crs-cs-AI', day: 'Mon', slots: [2, 3, 4], isLab: true, instName: 'Engr.Nida', roomCode: 'CL-05-UG', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k25-bscs-e', courseId: 'crs-cs-cn', day: 'Mon', slots: [5, 6], instName: 'Mr.Waqar', roomCode: 'CR-28-Acad' },
  { groupId: 'grp-2k25-bscs-e', courseId: 'crs-cs-coal', day: 'Tue', slots: [1, 2], instName: 'Ms.Farah', roomCode: 'CR-28-Acad' },
  { groupId: 'grp-2k25-bscs-e', courseId: 'crs-cs-isec', day: 'Tue', slots: [3, 4], instName: 'Mr.Babar', roomCode: 'CR-28-Acad' },
  { groupId: 'grp-2k25-bscs-e', courseId: 'crs-cs-coal', day: 'Tue', slots: [5, 6, 7], isLab: true, instName: 'Engr.Maham', roomCode: 'Digital Systems-II-Acad', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k25-bscs-e', courseId: 'crs-cs-dsa', day: 'Wed', slots: [1, 2], instName: 'Dr.Hassan', roomCode: 'CR-28-Acad' },
  { groupId: 'grp-2k25-bscs-e', courseId: 'crs-cs-mvc', day: 'Wed', slots: [3, 4], instName: 'Dr.Adeel', roomCode: 'CR-28-Acad' },
  { groupId: 'grp-2k25-bscs-e', courseId: 'crs-cs-cn', day: 'Wed', slots: [5, 6, 7], isLab: true, instName: 'Engr.Fahad', roomCode: 'CL-01-UG', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k25-bscs-e', courseId: 'crs-cs-AI', day: 'Thu', slots: [1, 2], instName: 'Ms.Saima', roomCode: 'CR-28-Acad' },
  { groupId: 'grp-2k25-bscs-e', courseId: 'crs-cs-dsa', day: 'Thu', slots: [3], instName: 'Dr.Hassan', roomCode: 'CR-28-Acad' },
  { groupId: 'grp-2k25-bscs-e', courseId: 'crs-cs-mvc', day: 'Thu', slots: [4], instName: 'Dr.Adeel', roomCode: 'CR-28-Acad' },
  { groupId: 'grp-2k25-bscs-e', courseId: 'crs-cs-dsa', day: 'Fri', slots: [2, 3, 4], isLab: true, instName: 'Engr.Umer', roomCode: 'CL-12-Acad', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k25-bscs-e', courseId: 'crs-cs-isec', day: 'Fri', slots: [5], instName: 'Mr.Babar', roomCode: 'CR-28-Acad' },

  // =========================================================================
  // 2K24-BSCS-A..D (5th Sem), 2K23-BSCS-A..E (7th Sem), 2K26-BSCS-A..E (1st Sem)
  // =========================================================================
  { groupId: 'grp-2k24-bscs-a', courseId: 'crs-cs-os', day: 'Mon', slots: [1, 2], instName: 'Dr.Kashif', roomCode: 'CR-01-UG' },
  { groupId: 'grp-2k24-bscs-a', courseId: 'crs-cs-db', day: 'Mon', slots: [3, 4], instName: 'Dr.Samina', roomCode: 'CR-01-UG' },
  { groupId: 'grp-2k24-bscs-a', courseId: 'crs-cs-os', day: 'Tue', slots: [1, 2, 3], isLab: true, instName: 'Engr.Haris', roomCode: 'CL-03-UG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k24-bscs-a', courseId: 'crs-cs-daa', day: 'Wed', slots: [1, 2], instName: 'Prof. Alan Turing', roomCode: 'CR-01-UG' },
  { groupId: 'grp-2k24-bscs-a', courseId: 'crs-cs-automata', day: 'Wed', slots: [3, 4], instName: 'Mr.Junaid', roomCode: 'CR-01-UG' },
  { groupId: 'grp-2k24-bscs-a', courseId: 'crs-cs-db', day: 'Thu', slots: [2, 3, 4], isLab: true, instName: 'Engr.M.Saad', roomCode: 'CL-06-UG', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k24-bscs-a', courseId: 'crs-bee-ps', day: 'Fri', slots: [1, 2], instName: 'Dr.Amina', roomCode: 'CR-01-UG' },

  { groupId: 'grp-2k24-bscs-b', courseId: 'crs-cs-db', day: 'Mon', slots: [1, 2], instName: 'Dr.Samina', roomCode: 'CR-02-UG' },
  { groupId: 'grp-2k24-bscs-b', courseId: 'crs-cs-os', day: 'Mon', slots: [5, 6, 7], isLab: true, instName: 'Engr.Haris', roomCode: 'CL-03-UG', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k24-bscs-b', courseId: 'crs-cs-os', day: 'Tue', slots: [1, 2], instName: 'Dr.Kashif', roomCode: 'CR-02-UG' },
  { groupId: 'grp-2k24-bscs-b', courseId: 'crs-cs-daa', day: 'Tue', slots: [3, 4], instName: 'Dr.Hassan', roomCode: 'CR-02-UG' },
  { groupId: 'grp-2k24-bscs-b', courseId: 'crs-cs-db', day: 'Wed', slots: [2, 3, 4], isLab: true, instName: 'Engr.M.Saad', roomCode: 'CL-06-UG', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k24-bscs-b', courseId: 'crs-cs-automata', day: 'Thu', slots: [1, 2], instName: 'Mr.Junaid', roomCode: 'CR-02-UG' },
  { groupId: 'grp-2k24-bscs-b', courseId: 'crs-bee-ps', day: 'Fri', slots: [3, 4], instName: 'Dr.Amina', roomCode: 'CR-02-UG' },

  { groupId: 'grp-2k24-bscs-c', courseId: 'crs-cs-daa', day: 'Mon', slots: [1, 2], instName: 'Dr.Hassan', roomCode: 'CR-03-UG' },
  { groupId: 'grp-2k24-bscs-c', courseId: 'crs-cs-automata', day: 'Mon', slots: [3, 4], instName: 'Mr.Asif', roomCode: 'CR-03-UG' },
  { groupId: 'grp-2k24-bscs-c', courseId: 'crs-cs-db', day: 'Tue', slots: [5, 6, 7], isLab: true, instName: 'Engr.Danish', roomCode: 'CL-06-UG', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k24-bscs-c', courseId: 'crs-cs-os', day: 'Wed', slots: [1, 2], instName: 'Dr.Zubair', roomCode: 'CR-03-UG' },
  { groupId: 'grp-2k24-bscs-c', courseId: 'crs-cs-db', day: 'Wed', slots: [3, 4], instName: 'Ms.Saima', roomCode: 'CR-03-UG' },
  { groupId: 'grp-2k24-bscs-c', courseId: 'crs-cs-os', day: 'Thu', slots: [1, 2, 3], isLab: true, instName: 'Engr.Talha', roomCode: 'CL-03-UG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k24-bscs-c', courseId: 'crs-bee-ps', day: 'Fri', slots: [1, 2], instName: 'Dr.Adeel', roomCode: 'CR-03-UG' },

  { groupId: 'grp-2k24-bscs-d', courseId: 'crs-cs-os', day: 'Mon', slots: [1, 2, 3], isLab: true, instName: 'Engr.Talha', roomCode: 'CL-03-UG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k24-bscs-d', courseId: 'crs-cs-os', day: 'Tue', slots: [1, 2], instName: 'Dr.Zubair', roomCode: 'CR-04-UG' },
  { groupId: 'grp-2k24-bscs-d', courseId: 'crs-cs-db', day: 'Tue', slots: [3, 4], instName: 'Ms.Saima', roomCode: 'CR-04-UG' },
  { groupId: 'grp-2k24-bscs-d', courseId: 'crs-cs-daa', day: 'Wed', slots: [1, 2], instName: 'Dr.Hassan', roomCode: 'CR-04-UG' },
  { groupId: 'grp-2k24-bscs-d', courseId: 'crs-cs-automata', day: 'Thu', slots: [1, 2], instName: 'Mr.Asif', roomCode: 'CR-04-UG' },
  { groupId: 'grp-2k24-bscs-d', courseId: 'crs-cs-db', day: 'Fri', slots: [1, 2, 3], isLab: true, instName: 'Engr.Danish', roomCode: 'CL-06-UG', customWindow: '9:00 AM – 11:50 AM' },

  // 2K23-BSCS-A..E (7th Sem)
  { groupId: 'grp-2k23-bscs-a', courseId: 'crs-cs-compiler', day: 'Mon', slots: [1, 2], instName: 'Dr.Kashif', roomCode: 'CR-05-UG' },
  { groupId: 'grp-2k23-bscs-a', courseId: 'crs-cs-dl', day: 'Mon', slots: [3, 4], instName: 'Dr.Samina', roomCode: 'CR-05-UG' },
  { groupId: 'grp-2k23-bscs-a', courseId: 'crs-cs-compiler', day: 'Tue', slots: [2, 3, 4], isLab: true, instName: 'Engr.Kiran', roomCode: 'CL-07-PG', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k23-bscs-a', courseId: 'crs-cs-pdc', day: 'Wed', slots: [1, 2], instName: 'Dr.Zubair', roomCode: 'CR-05-UG' },
  { groupId: 'grp-2k23-bscs-a', courseId: 'crs-cs-dl', day: 'Thu', slots: [5, 6, 7], isLab: true, instName: 'Engr.Nida', roomCode: 'CL-05-UG', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k23-bscs-a', courseId: 'crs-se-tbw', day: 'Fri', slots: [1, 2], instName: 'Ms.Nadia', roomCode: 'CR-05-UG' },

  { groupId: 'grp-2k23-bscs-b', courseId: 'crs-cs-dl', day: 'Mon', slots: [1, 2], instName: 'Dr.Samina', roomCode: 'CR-08-UG' },
  { groupId: 'grp-2k23-bscs-b', courseId: 'crs-cs-compiler', day: 'Tue', slots: [1, 2], instName: 'Dr.Kashif', roomCode: 'CR-08-UG' },
  { groupId: 'grp-2k23-bscs-b', courseId: 'crs-cs-dl', day: 'Wed', slots: [1, 2, 3], isLab: true, instName: 'Engr.Nida', roomCode: 'CL-05-UG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k23-bscs-b', courseId: 'crs-cs-pdc', day: 'Thu', slots: [1, 2], instName: 'Dr.Zubair', roomCode: 'CR-08-UG' },
  { groupId: 'grp-2k23-bscs-b', courseId: 'crs-cs-compiler', day: 'Fri', slots: [1, 2, 3], isLab: true, instName: 'Engr.Kiran', roomCode: 'CL-07-PG', customWindow: '9:00 AM – 11:50 AM' },

  { groupId: 'grp-2k23-bscs-c', courseId: 'crs-cs-compiler', day: 'Mon', slots: [1, 2, 3], isLab: true, instName: 'Engr.Kiran', roomCode: 'CL-07-PG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k23-bscs-c', courseId: 'crs-cs-pdc', day: 'Tue', slots: [1, 2], instName: 'Mr.Waqar', roomCode: 'CR-11-UG' },
  { groupId: 'grp-2k23-bscs-c', courseId: 'crs-cs-compiler', day: 'Wed', slots: [1, 2], instName: 'Ms.Farah', roomCode: 'CR-11-UG' },
  { groupId: 'grp-2k23-bscs-c', courseId: 'crs-cs-dl', day: 'Thu', slots: [1, 2], instName: 'Ms.Saima', roomCode: 'CR-11-UG' },
  { groupId: 'grp-2k23-bscs-c', courseId: 'crs-cs-dl', day: 'Fri', slots: [5, 6, 7], isLab: true, instName: 'Engr.Nida', roomCode: 'CL-05-UG', customWindow: '2:30 PM – 4:55 PM' },

  { groupId: 'grp-2k23-bscs-d', courseId: 'crs-cs-pdc', day: 'Mon', slots: [1, 2], instName: 'Mr.Waqar', roomCode: 'CR-12-UG' },
  { groupId: 'grp-2k23-bscs-d', courseId: 'crs-cs-dl', day: 'Tue', slots: [1, 2, 3], isLab: true, instName: 'Engr.Nida', roomCode: 'CL-05-UG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k23-bscs-d', courseId: 'crs-cs-dl', day: 'Wed', slots: [1, 2], instName: 'Ms.Saima', roomCode: 'CR-12-UG' },
  { groupId: 'grp-2k23-bscs-d', courseId: 'crs-cs-compiler', day: 'Thu', slots: [1, 2, 3], isLab: true, instName: 'Engr.Kiran', roomCode: 'CL-07-PG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k23-bscs-d', courseId: 'crs-cs-compiler', day: 'Fri', slots: [1, 2], instName: 'Ms.Farah', roomCode: 'CR-12-UG' },

  { groupId: 'grp-2k23-bscs-e', courseId: 'crs-cs-compiler', day: 'Mon', slots: [5, 6], instName: 'Ms.Farah', roomCode: 'CR-20-SMRIMMS' },
  { groupId: 'grp-2k23-bscs-e', courseId: 'crs-cs-dl', day: 'Tue', slots: [3, 4], instName: 'Dr.Samina', roomCode: 'CR-20-SMRIMMS' },
  { groupId: 'grp-2k23-bscs-e', courseId: 'crs-cs-compiler', day: 'Wed', slots: [5, 6, 7], isLab: true, instName: 'Engr.Kiran', roomCode: 'CL-07-PG', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k23-bscs-e', courseId: 'crs-cs-pdc', day: 'Thu', slots: [3, 4], instName: 'Mr.Waqar', roomCode: 'CR-20-SMRIMMS' },
  { groupId: 'grp-2k23-bscs-e', courseId: 'crs-cs-dl', day: 'Fri', slots: [1, 2, 3], isLab: true, instName: 'Engr.M.Saad', roomCode: 'CL-09-Acad', customWindow: '9:00 AM – 11:50 AM' },

  // 2K26-BSCS-A..E (1st Sem)
  { groupId: 'grp-2k26-bscs-a', courseId: 'crs-bce-pf', day: 'Mon', slots: [1, 2], instName: 'Mr.Junaid', roomCode: 'CR-29-Acad' },
  { groupId: 'grp-2k26-bscs-a', courseId: 'crs-bce-ict', day: 'Mon', slots: [3, 4], instName: 'Mr.Asif', roomCode: 'CR-29-Acad' },
  { groupId: 'grp-2k26-bscs-a', courseId: 'crs-bce-pf', day: 'Tue', slots: [1, 2, 3], isLab: true, instName: 'Engr.Umer', roomCode: 'CL-09-Acad', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k26-bscs-a', courseId: 'crs-bee-calc', day: 'Wed', slots: [1, 2], instName: 'Dr.Amina', roomCode: 'CR-29-Acad' },
  { groupId: 'grp-2k26-bscs-a', courseId: 'crs-bce-ict', day: 'Thu', slots: [1, 2, 3], isLab: true, instName: 'Engr.Fahad', roomCode: 'CL-01-UG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k26-bscs-a', courseId: 'crs-bee-fe', day: 'Fri', slots: [1, 2], instName: 'Ms.Hira', roomCode: 'CR-29-Acad' },

  { groupId: 'grp-2k26-bscs-b', courseId: 'crs-bce-pf', day: 'Mon', slots: [2, 3, 4], isLab: true, instName: 'Engr.Umer', roomCode: 'CL-09-Acad', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k26-bscs-b', courseId: 'crs-bce-pf', day: 'Tue', slots: [1, 2], instName: 'Mr.Junaid', roomCode: 'CR-33-Acad' },
  { groupId: 'grp-2k26-bscs-b', courseId: 'crs-bce-ict', day: 'Wed', slots: [1, 2], instName: 'Mr.Asif', roomCode: 'CR-33-Acad' },
  { groupId: 'grp-2k26-bscs-b', courseId: 'crs-bee-calc', day: 'Thu', slots: [1, 2], instName: 'Dr.Amina', roomCode: 'CR-33-Acad' },
  { groupId: 'grp-2k26-bscs-b', courseId: 'crs-bce-ict', day: 'Fri', slots: [1, 2, 3], isLab: true, instName: 'Engr.Fahad', roomCode: 'CL-01-UG', customWindow: '9:00 AM – 11:50 AM' },

  { groupId: 'grp-2k26-bscs-c', courseId: 'crs-bce-ict', day: 'Mon', slots: [1, 2, 3], isLab: true, instName: 'Engr.Fahad', roomCode: 'CL-01-UG', customWindow: '9:00 AM – 11:50 AM' },
  { groupId: 'grp-2k26-bscs-c', courseId: 'crs-bce-pf', day: 'Tue', slots: [5, 6], instName: 'Mr.Babar', roomCode: 'CR-01-UG' },
  { groupId: 'grp-2k26-bscs-c', courseId: 'crs-bce-pf', day: 'Wed', slots: [2, 3, 4], isLab: true, instName: 'Engr.Umer', roomCode: 'CL-09-Acad', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k26-bscs-c', courseId: 'crs-bee-calc', day: 'Thu', slots: [5, 6], instName: 'Dr.Adeel', roomCode: 'CR-01-UG' },
  { groupId: 'grp-2k26-bscs-c', courseId: 'crs-bce-ict', day: 'Fri', slots: [3, 4], instName: 'Mr.Waqar', roomCode: 'CR-01-UG' },

  { groupId: 'grp-2k26-bscs-d', courseId: 'crs-bce-pf', day: 'Mon', slots: [5, 6], instName: 'Mr.Babar', roomCode: 'CR-02-UG' },
  { groupId: 'grp-2k26-bscs-d', courseId: 'crs-bce-ict', day: 'Tue', slots: [5, 6], instName: 'Mr.Waqar', roomCode: 'CR-02-UG' },
  { groupId: 'grp-2k26-bscs-d', courseId: 'crs-bee-calc', day: 'Wed', slots: [5, 6], instName: 'Dr.Adeel', roomCode: 'CR-02-UG' },
  { groupId: 'grp-2k26-bscs-d', courseId: 'crs-bce-pf', day: 'Thu', slots: [2, 3, 4], isLab: true, instName: 'Engr.Umer', roomCode: 'CL-09-Acad', customWindow: '10:00 AM – 12:50 PM' },
  { groupId: 'grp-2k26-bscs-d', courseId: 'crs-bce-ict', day: 'Fri', slots: [2, 3, 4], isLab: true, instName: 'Engr.Maham', roomCode: 'CL-02-UG', customWindow: '10:00 AM – 12:50 PM' },

  { groupId: 'grp-2k26-bscs-e', courseId: 'crs-bce-pf', day: 'Mon', slots: [5, 6, 7], isLab: true, instName: 'Engr.Umer', roomCode: 'CL-09-Acad', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k26-bscs-e', courseId: 'crs-bce-pf', day: 'Tue', slots: [5, 6], instName: 'Ms.Farah', roomCode: 'CR-03-UG' },
  { groupId: 'grp-2k26-bscs-e', courseId: 'crs-bce-ict', day: 'Wed', slots: [5, 6], instName: 'Mr.Waqar', roomCode: 'CR-03-UG' },
  { groupId: 'grp-2k26-bscs-e', courseId: 'crs-bce-ict', day: 'Thu', slots: [5, 6, 7], isLab: true, instName: 'Engr.Maham', roomCode: 'CL-03-UG', customWindow: '2:00 PM – 4:50 PM' },
  { groupId: 'grp-2k26-bscs-e', courseId: 'crs-bee-calc', day: 'Fri', slots: [3, 4], instName: 'Dr.Adeel', roomCode: 'CR-03-UG' }
];

// Expand raw schedule entries into Section records
function buildUniversitySections(): Section[] {
  const result: Section[] = [];
  let counter = 1;

  EXACT_SCHEDULES.forEach(entry => {
    const instId = getInstructorIdByName(entry.instName);
    const roomId = getRoomIdByCode(entry.roomCode);
    const grp = universityStudentGroups.find(g => g.id === entry.groupId);
    const enrollment = grp?.size || 45;

    if (entry.isLab) {
      const startSlotNum = entry.slots[0] || 1;
      const startPeriod = SLOT_MAP[startSlotNum] || '9:00 – 9:50 AM';
      const continuousLabel =
        entry.customWindow ||
        (startSlotNum === 1
          ? '9:00 AM – 11:50 AM'
          : startSlotNum === 2
          ? '10:00 AM – 12:50 PM'
          : entry.day === 'Fri'
          ? '2:30 PM – 4:55 PM'
          : '2:00 PM – 4:50 PM');

      result.push({
        id: `univ-sec-lab-${counter++}`,
        courseId: entry.courseId,
        termId: 'term-2026-fall',
        sectionNumber: `${grp?.code || 'SEC'}-Lab`,
        expectedEnrollment: enrollment,
        instructorId: instId,
        studentGroupId: entry.groupId,
        sessionType: 'Lab',
        spanSlots: 3,
        isLocked: true,
        is_sample: true,
        isSample: true,
        assignedSlot: {
          day: entry.day,
          timeSlot: startPeriod,
          roomId,
          durationMinutes: 180,
          sessionType: 'Lab',
          spanSlots: 3,
          continuousTimeLabel: continuousLabel
        }
      });
    } else {
      entry.slots.forEach((slotNum, idx) => {
        const period = SLOT_MAP[slotNum] || '9:00 – 9:50 AM';
        result.push({
          id: `univ-sec-lec-${counter++}`,
          courseId: entry.courseId,
          termId: 'term-2026-fall',
          sectionNumber: `${grp?.code || 'SEC'}-L${idx + 1}`,
          expectedEnrollment: enrollment,
          instructorId: instId,
          studentGroupId: entry.groupId,
          sessionType: 'Lecture',
          spanSlots: 1,
          isLocked: true,
          is_sample: true,
          isSample: true,
          assignedSlot: {
            day: entry.day,
            timeSlot: period,
            roomId,
            durationMinutes: 50,
            sessionType: 'Lecture',
            spanSlots: 1
          }
        });
      });
    }
  });

  return result;
}

export const universitySections: Section[] = buildUniversitySections();
