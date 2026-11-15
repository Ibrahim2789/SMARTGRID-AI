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
  TimeStructure,
  ConstraintRule,
  TimetableScenario,
  AuditLogEntry
} from '../types/institutional';
import { InstitutionProfile, FeedbackPollItem } from './store';

export const apexInstitutionProfile: InstitutionProfile = {
  name: 'Apex Institute of Science & Technology',
  campusCode: 'AIST-DOWNTOWN-02',
  accreditation: 'ABET & National Board of Accreditation (NBA) Certified',
  registrarName: 'Dr. Arthur Vance',
  registrarEmail: 'registrar@apextech.edu',
  autoConflictSweep: true,
  defaultSessionMinutes: 60,
  timezone: 'America/New_York (EST)'
};

export const apexTerms: AcademicTerm[] = [
  {
    id: 'apex-term-2026-spring',
    name: 'Spring Semester 2026',
    code: 'SPRING-2026',
    startDate: '2026-01-15',
    endDate: '2026-05-28',
    status: 'active',
    weeksCount: 16
  }
];

export const apexCampuses: Campus[] = [
  {
    id: 'apex-campus-main',
    name: 'Downtown Innovation Campus',
    code: 'DIC-01',
    address: '450 Technology Parkway, Innovation District'
  }
];

export const apexBuildings: Building[] = [
  {
    id: 'apex-bld-innovation',
    campusId: 'apex-campus-main',
    name: 'Nikola Tesla Engineering Complex',
    code: 'TEC',
    floors: 4
  },
  {
    id: 'apex-bld-computing',
    campusId: 'apex-campus-main',
    name: 'Ada Lovelace Computing Center',
    code: 'LCC',
    floors: 3
  }
];

export const apexRooms: Room[] = [
  {
    id: 'apex-room-newton-101',
    buildingId: 'apex-bld-innovation',
    name: 'Isaac Newton Lecture Auditorium 101',
    code: 'Newton-101',
    capacity: 65,
    type: 'lecture',
    equipment: ['4K Interactive Laser Projector', 'Dual Whiteboards', 'Surround Sound', 'Podium Mic'],
    isAccessible: true,
    isAvailable: true
  },
  {
    id: 'apex-room-newton-102',
    buildingId: 'apex-bld-innovation',
    name: 'James Watt Lecture Hall 102',
    code: 'Watt-102',
    capacity: 60,
    type: 'lecture',
    equipment: ['High-Definition Projector', 'Acoustic Panel System', 'Whiteboard'],
    isAccessible: true,
    isAvailable: true
  },
  {
    id: 'apex-room-turing-201',
    buildingId: 'apex-bld-computing',
    name: 'Alan Turing AI Theater 201',
    code: 'Turing-201',
    capacity: 70,
    type: 'lecture',
    equipment: ['Dual Projectors', 'Recording Camera', 'Surround Audio', 'Whiteboard'],
    isAccessible: true,
    isAvailable: true
  },
  {
    id: 'apex-room-turing-202',
    buildingId: 'apex-bld-computing',
    name: 'Claude Shannon Seminar Room 202',
    code: 'Shannon-202',
    capacity: 55,
    type: 'lecture',
    equipment: ['Smart Board', 'Video Conferencing Rig'],
    isAccessible: true,
    isAvailable: true
  },
  {
    id: 'apex-room-tesla-lab',
    buildingId: 'apex-bld-innovation',
    name: 'Robotics & Automation Laboratory',
    code: 'Tesla-M1',
    capacity: 45,
    type: 'lab',
    equipment: ['6-Axis Robotic Arms', 'Microcontroller Workstations', 'Oscilloscopes', 'CNC Mill'],
    isAccessible: true,
    isAvailable: true
  },
  {
    id: 'apex-room-curie-lab',
    buildingId: 'apex-bld-innovation',
    name: 'Applied Thermodynamics & Materials Lab',
    code: 'Curie-P1',
    capacity: 40,
    type: 'lab',
    equipment: ['Wind Tunnel', 'Thermal Calibrator', 'Safety Extinguishers'],
    isAccessible: true,
    isAvailable: true
  },
  {
    id: 'apex-room-ada-lab',
    buildingId: 'apex-bld-computing',
    name: 'Data Science & Neural GPU Cluster',
    code: 'Ada-DS1',
    capacity: 50,
    type: 'lab',
    equipment: ['NVIDIA Tensor Core Workstations', 'Gigabit Ethernet', 'Dual 4K Displays'],
    isAccessible: true,
    isAvailable: true
  }
];

export const apexDepartments: Department[] = [
  {
    id: 'apex-dept-me',
    name: 'Department of Mechanical & Mechatronics Engineering',
    code: 'DME',
    school: 'School of Engineering & Applied Physics',
    colorHex: '#1E3A8A'
  },
  {
    id: 'apex-dept-ds',
    name: 'Department of Applied Data Science & AI',
    code: 'DDSAI',
    school: 'School of Computing & Mathematical Sciences',
    colorHex: '#047857'
  }
];

export const apexPrograms: Program[] = [
  {
    id: 'apex-prog-bme',
    departmentId: 'apex-dept-me',
    name: 'Bachelor of Science in Mechanical Engineering',
    code: 'BME',
    degreeLevel: 'Undergraduate',
    totalSemesters: 8
  },
  {
    id: 'apex-prog-bsds',
    departmentId: 'apex-dept-ds',
    name: 'Bachelor of Science in Data Science & Machine Learning',
    code: 'BSDS',
    degreeLevel: 'Undergraduate',
    totalSemesters: 8
  }
];

export const apexStudentGroups: StudentGroup[] = [
  {
    id: 'apex-grp-2k25-bme-a',
    programId: 'apex-prog-bme',
    name: 'BS Mechanical Engineering — Cohort 2K25 Section A',
    code: '2K25-BME-A',
    year: 2,
    semester: 4,
    section: 'A',
    departmentCode: 'DME',
    academicYear: 2025,
    homeRoom: 'Newton-101',
    size: 45,
    sharedCourseIds: []
  },
  {
    id: 'apex-grp-2k25-bme-b',
    programId: 'apex-prog-bme',
    name: 'BS Mechanical Engineering — Cohort 2K25 Section B',
    code: '2K25-BME-B',
    year: 2,
    semester: 4,
    section: 'B',
    departmentCode: 'DME',
    academicYear: 2025,
    homeRoom: 'Watt-102',
    size: 40,
    sharedCourseIds: []
  },
  {
    id: 'apex-grp-2k25-bsds-a',
    programId: 'apex-prog-bsds',
    name: 'BS Data Science — Cohort 2K25 Section A',
    code: '2K25-BSDS-A',
    year: 2,
    semester: 4,
    section: 'A',
    departmentCode: 'DDSAI',
    academicYear: 2025,
    homeRoom: 'Turing-201',
    size: 50,
    sharedCourseIds: []
  },
  {
    id: 'apex-grp-2k25-bsds-b',
    programId: 'apex-prog-bsds',
    name: 'BS Data Science — Cohort 2K25 Section B',
    code: '2K25-BSDS-B',
    year: 2,
    semester: 4,
    section: 'B',
    departmentCode: 'DDSAI',
    academicYear: 2025,
    homeRoom: 'Shannon-202',
    size: 45,
    sharedCourseIds: []
  }
];

export const apexCourses: Course[] = [
  {
    id: 'apex-crs-me201',
    departmentId: 'apex-dept-me',
    code: 'ME-201',
    title: 'Thermodynamics & Energy Conversion',
    creditHours: 3,
    lectureHours: 3,
    labHours: 0,
    weeklyContactHours: 3,
    requiredRoomType: 'lecture'
  },
  {
    id: 'apex-crs-me201-l',
    departmentId: 'apex-dept-me',
    code: 'ME-201-L',
    title: 'Applied Thermodynamics Practical Workshop',
    creditHours: 1,
    lectureHours: 0,
    labHours: 2,
    weeklyContactHours: 2,
    requiredRoomType: 'lab'
  },
  {
    id: 'apex-crs-me204',
    departmentId: 'apex-dept-me',
    code: 'ME-204',
    title: 'Kinematics & Industrial Robotics',
    creditHours: 3,
    lectureHours: 3,
    labHours: 0,
    weeklyContactHours: 3,
    requiredRoomType: 'lecture'
  },
  {
    id: 'apex-crs-me204-l',
    departmentId: 'apex-dept-me',
    code: 'ME-204-L',
    title: 'Robotics & Control Systems Lab',
    creditHours: 1,
    lectureHours: 0,
    labHours: 2,
    weeklyContactHours: 2,
    requiredRoomType: 'lab'
  },
  {
    id: 'apex-crs-ds210',
    departmentId: 'apex-dept-ds',
    code: 'DS-210',
    title: 'Machine Learning Algorithms & Optimization',
    creditHours: 3,
    lectureHours: 3,
    labHours: 0,
    weeklyContactHours: 3,
    requiredRoomType: 'lecture'
  },
  {
    id: 'apex-crs-ds210-l',
    departmentId: 'apex-dept-ds',
    code: 'DS-210-L',
    title: 'Deep Learning & Neural Architectures Lab',
    creditHours: 1,
    lectureHours: 0,
    labHours: 2,
    weeklyContactHours: 2,
    requiredRoomType: 'lab'
  },
  {
    id: 'apex-crs-ds215',
    departmentId: 'apex-dept-ds',
    code: 'DS-215',
    title: 'Distributed Big Data Systems',
    creditHours: 3,
    lectureHours: 3,
    labHours: 0,
    weeklyContactHours: 3,
    requiredRoomType: 'lecture'
  },
  {
    id: 'apex-crs-ds215-l',
    departmentId: 'apex-dept-ds',
    code: 'DS-215-L',
    title: 'Big Data Pipeline Engineering Lab',
    creditHours: 1,
    lectureHours: 0,
    labHours: 2,
    weeklyContactHours: 2,
    requiredRoomType: 'lab'
  },
  {
    id: 'apex-crs-math220',
    departmentId: 'apex-dept-ds',
    code: 'MATH-220',
    title: 'Statistical Inference & Linear Matrix Algebra',
    creditHours: 3,
    lectureHours: 3,
    labHours: 0,
    weeklyContactHours: 3,
    requiredRoomType: 'lecture'
  }
];

export const apexInstructors: Instructor[] = [
  {
    id: 'apex-inst-m-vance',
    departmentId: 'apex-dept-me',
    name: 'Dr. Marcus Vance',
    email: 'm.vance@apextech.edu',
    title: 'Professor & Department Chair',
    maxWeeklyHours: 14,
    maxConsecutiveHours: 3,
    preferredDays: ['Mon', 'Tue', 'Wed', 'Thu'],
    unavailableSlots: []
  },
  {
    id: 'apex-inst-e-rostova',
    departmentId: 'apex-dept-ds',
    name: 'Prof. Elena Rostova',
    email: 'e.rostova@apextech.edu',
    title: 'Professor of Artificial Intelligence',
    maxWeeklyHours: 16,
    maxConsecutiveHours: 3,
    preferredDays: ['Mon', 'Wed', 'Fri', 'Sat'],
    unavailableSlots: []
  },
  {
    id: 'apex-inst-j-okafor',
    departmentId: 'apex-dept-me',
    name: 'Dr. Jide Okafor',
    email: 'j.okafor@apextech.edu',
    title: 'Associate Professor of Robotics',
    maxWeeklyHours: 15,
    maxConsecutiveHours: 3,
    preferredDays: ['Tue', 'Thu', 'Fri', 'Sat'],
    unavailableSlots: []
  },
  {
    id: 'apex-inst-s-nair',
    departmentId: 'apex-dept-ds',
    name: 'Dr. Sunita Nair',
    email: 's.nair@apextech.edu',
    title: 'Senior Lecturer in Mathematical Optimization',
    maxWeeklyHours: 14,
    maxConsecutiveHours: 3,
    preferredDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    unavailableSlots: []
  }
];

// Distinct 6-day (Mon-Sat), 60-minute class duration, 8:30 AM to 4:30 PM time structure
export const apexTimeStructure: TimeStructure = {
  id: 'apex-time-structure-v1',
  name: 'Apex Standard 6-Day Schedule',
  workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  dayStartTime: '08:30',
  dayEndTime: '16:30',
  periodLengthMinutes: 60,
  shortBreakEnabled: true,
  shortBreakMinutes: 15,
  includeBreakAfterLastSlot: false,
  middayBreakEnabled: true,
  middayBreakMode: 'fixed',
  middayBreakStartTime: '12:15',
  middayBreakDurationMinutes: 45,
  labDurationMinutes: 120, // 2-hour continuous laboratories!
  fridayAfternoonShiftEnabled: false,
  fridayAfternoonStartTime: '13:00',
  periods: [
    '8:30 – 9:30 AM',
    '9:45 – 10:45 AM',
    '11:00 – 12:00 PM',
    '1:00 – 2:00 PM',
    '2:15 – 3:15 PM',
    '3:30 – 4:30 PM'
  ],
  breaks: [
    {
      id: 'apex-break-lunch',
      name: 'Campus Midday Lunch & Refreshment Break',
      startTime: '12:15',
      endTime: '13:00',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    }
  ]
};

export const apexConstraintRules: ConstraintRule[] = [
  {
    id: 'apex-rule-no-room-clash',
    code: 'HARD_NO_ROOM_CLASH',
    name: 'Zero Room Double-Bookings',
    description: 'Enforces that no classroom or specialized laboratory hosts more than one course simultaneously.',
    kind: 'hard',
    weight: 100,
    category: 'room',
    enabled: true
  },
  {
    id: 'apex-rule-no-faculty-clash',
    code: 'HARD_NO_FACULTY_CLASH',
    name: 'Zero Faculty Overlaps',
    description: 'No professor or instructor can be scheduled for concurrent lectures or labs.',
    kind: 'hard',
    weight: 100,
    category: 'instructor',
    enabled: true
  },
  {
    id: 'apex-rule-continuous-labs',
    code: 'HARD_CONTINUOUS_LABS',
    name: '2-Hour Continuous Lab Guarantee',
    description: 'Ensures all laboratory sessions run uninterrupted for 2 hours (120 mins).',
    kind: 'hard',
    weight: 100,
    category: 'facility',
    enabled: true
  },
  {
    id: 'apex-rule-lunch-protection',
    code: 'HARD_PROTECTED_LUNCH',
    name: 'Protected 12:15 – 13:00 Campus Lunch Break',
    description: 'Guarantees the 45-minute midday break is kept clear across all Mechanical and Data Science cohorts.',
    kind: 'hard',
    weight: 100,
    category: 'temporal',
    enabled: true
  }
];

export const apexSections: Section[] = [
  // 2K25-BME-A Sessions
  {
    id: 'apex-sec-bme-a-me201',
    courseId: 'apex-crs-me201',
    termId: 'apex-term-2026-spring',
    sectionNumber: '01-Lec',
    expectedEnrollment: 45,
    instructorId: 'apex-inst-m-vance',
    studentGroupId: 'apex-grp-2k25-bme-a',
    sessionType: 'Lecture',
    spanSlots: 1,
    assignedSlot: {
      day: 'Mon',
      timeSlot: '8:30 – 9:30 AM',
      roomId: 'apex-room-newton-101',
      sessionType: 'Lecture',
      spanSlots: 1,
      durationMinutes: 60
    }
  },
  {
    id: 'apex-sec-bme-a-me204',
    courseId: 'apex-crs-me204',
    termId: 'apex-term-2026-spring',
    sectionNumber: '01-Lec',
    expectedEnrollment: 45,
    instructorId: 'apex-inst-j-okafor',
    studentGroupId: 'apex-grp-2k25-bme-a',
    sessionType: 'Lecture',
    spanSlots: 1,
    assignedSlot: {
      day: 'Tue',
      timeSlot: '9:45 – 10:45 AM',
      roomId: 'apex-room-newton-101',
      sessionType: 'Lecture',
      spanSlots: 1,
      durationMinutes: 60
    }
  },
  {
    id: 'apex-sec-bme-a-me204-l',
    courseId: 'apex-crs-me204-l',
    termId: 'apex-term-2026-spring',
    sectionNumber: '01-Lab',
    expectedEnrollment: 40,
    instructorId: 'apex-inst-j-okafor',
    studentGroupId: 'apex-grp-2k25-bme-a',
    sessionType: 'Lab',
    spanSlots: 2,
    assignedSlot: {
      day: 'Wed',
      timeSlot: '1:00 – 2:00 PM',
      roomId: 'apex-room-tesla-lab',
      sessionType: 'Lab',
      spanSlots: 2,
      durationMinutes: 120,
      continuousTimeLabel: '1:00 PM – 3:15 PM'
    }
  },
  {
    id: 'apex-sec-bme-a-me201-l',
    courseId: 'apex-crs-me201-l',
    termId: 'apex-term-2026-spring',
    sectionNumber: '01-Lab',
    expectedEnrollment: 40,
    instructorId: 'apex-inst-m-vance',
    studentGroupId: 'apex-grp-2k25-bme-a',
    sessionType: 'Lab',
    spanSlots: 2,
    assignedSlot: {
      day: 'Thu',
      timeSlot: '8:30 – 9:30 AM',
      roomId: 'apex-room-curie-lab',
      sessionType: 'Lab',
      spanSlots: 2,
      durationMinutes: 120,
      continuousTimeLabel: '8:30 AM – 10:45 AM'
    }
  },
  {
    id: 'apex-sec-bme-a-math220',
    courseId: 'apex-crs-math220',
    termId: 'apex-term-2026-spring',
    sectionNumber: '01-Lec',
    expectedEnrollment: 45,
    instructorId: 'apex-inst-s-nair',
    studentGroupId: 'apex-grp-2k25-bme-a',
    sessionType: 'Lecture',
    spanSlots: 1,
    assignedSlot: {
      day: 'Fri',
      timeSlot: '11:00 – 12:00 PM',
      roomId: 'apex-room-newton-101',
      sessionType: 'Lecture',
      spanSlots: 1,
      durationMinutes: 60
    }
  },

  // 2K25-BSDS-A Sessions
  {
    id: 'apex-sec-bsds-a-ds210',
    courseId: 'apex-crs-ds210',
    termId: 'apex-term-2026-spring',
    sectionNumber: '01-Lec',
    expectedEnrollment: 50,
    instructorId: 'apex-inst-e-rostova',
    studentGroupId: 'apex-grp-2k25-bsds-a',
    sessionType: 'Lecture',
    spanSlots: 1,
    assignedSlot: {
      day: 'Mon',
      timeSlot: '9:45 – 10:45 AM',
      roomId: 'apex-room-turing-201',
      sessionType: 'Lecture',
      spanSlots: 1,
      durationMinutes: 60
    }
  },
  {
    id: 'apex-sec-bsds-a-ds210-l',
    courseId: 'apex-crs-ds210-l',
    termId: 'apex-term-2026-spring',
    sectionNumber: '01-Lab',
    expectedEnrollment: 45,
    instructorId: 'apex-inst-e-rostova',
    studentGroupId: 'apex-grp-2k25-bsds-a',
    sessionType: 'Lab',
    spanSlots: 2,
    assignedSlot: {
      day: 'Tue',
      timeSlot: '1:00 – 2:00 PM',
      roomId: 'apex-room-ada-lab',
      sessionType: 'Lab',
      spanSlots: 2,
      durationMinutes: 120,
      continuousTimeLabel: '1:00 PM – 3:15 PM'
    }
  },
  {
    id: 'apex-sec-bsds-a-ds215',
    courseId: 'apex-crs-ds215',
    termId: 'apex-term-2026-spring',
    sectionNumber: '01-Lec',
    expectedEnrollment: 50,
    instructorId: 'apex-inst-s-nair',
    studentGroupId: 'apex-grp-2k25-bsds-a',
    sessionType: 'Lecture',
    spanSlots: 1,
    assignedSlot: {
      day: 'Wed',
      timeSlot: '8:30 – 9:30 AM',
      roomId: 'apex-room-turing-201',
      sessionType: 'Lecture',
      spanSlots: 1,
      durationMinutes: 60
    }
  },
  {
    id: 'apex-sec-bsds-a-ds215-l',
    courseId: 'apex-crs-ds215-l',
    termId: 'apex-term-2026-spring',
    sectionNumber: '01-Lab',
    expectedEnrollment: 45,
    instructorId: 'apex-inst-s-nair',
    studentGroupId: 'apex-grp-2k25-bsds-a',
    sessionType: 'Lab',
    spanSlots: 2,
    assignedSlot: {
      day: 'Thu',
      timeSlot: '1:00 – 2:00 PM',
      roomId: 'apex-room-ada-lab',
      sessionType: 'Lab',
      spanSlots: 2,
      durationMinutes: 120,
      continuousTimeLabel: '1:00 PM – 3:15 PM'
    }
  },
  {
    id: 'apex-sec-bsds-a-math220',
    courseId: 'apex-crs-math220',
    termId: 'apex-term-2026-spring',
    sectionNumber: '01-Lec',
    expectedEnrollment: 50,
    instructorId: 'apex-inst-s-nair',
    studentGroupId: 'apex-grp-2k25-bsds-a',
    sessionType: 'Lecture',
    spanSlots: 1,
    assignedSlot: {
      day: 'Sat',
      timeSlot: '9:45 – 10:45 AM',
      roomId: 'apex-room-turing-201',
      sessionType: 'Lecture',
      spanSlots: 1,
      durationMinutes: 60
    }
  }
];

export const apexFeedbackPolls: FeedbackPollItem[] = [
  {
    id: 'apex-poll-1',
    title: 'Maintain 45-Minute Protected Midday Lunch Window (12:15 – 13:00)',
    category: 'Student Wellbeing',
    description: 'Ensure neither Mechanical Engineering nor Data Science students have lectures or labs during the 12:15–13:00 break.',
    targetSlot: '12:15 - 13:00',
    votesApprove: 320,
    votesRevise: 12,
    userVote: null,
    status: 'Implemented',
    submittedBy: 'AIST Student Council',
    createdAt: '2026-02-15'
  },
  {
    id: 'apex-poll-2',
    title: 'Saturday High-Performance GPU Cluster Dedicated Office Hours',
    category: 'Lab Continuity',
    description: 'Reserve Saturday afternoons (14:15–16:30) for senior capstone machine learning experiments in Ada-DS1.',
    targetSlot: 'Sat 14:15 - 16:30',
    votesApprove: 285,
    votesRevise: 19,
    userVote: null,
    status: 'Active',
    submittedBy: 'Data Science Society',
    createdAt: '2026-02-22'
  }
];

export const apexAuditLogs: AuditLogEntry[] = [
  {
    id: 'apex-audit-1',
    timestamp: '2026-02-01T09:00:00.000Z',
    userId: 'apex-admin',
    userName: 'Dr. Arthur Vance (Provost)',
    action: 'create',
    entityType: 'term',
    entityId: 'apex-term-2026-spring',
    summary: 'Initialized Spring Semester 2026 (Mon–Sat, 60m class periods, 2h continuous labs).'
  }
];
