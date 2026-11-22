import type {
  Course,
  Department,
  Instructor,
  Room,
  RoomType,
  Section,
  StaffRole,
  StudentGroup
} from '../types/institutional';

export type ImportCategory =
  | 'all'
  | 'departments'
  | 'rooms'
  | 'laboratories'
  | 'instructors'
  | 'courses'
  | 'cohorts'
  | 'enrollments'
  | 'course_assignments';

export type DuplicateHandlingMode = 'skip' | 'update' | 'stop';

export interface ImportFieldDef {
  key: string;
  label: string;
  group: string;
  required: boolean;
  type: string;
  sample: string;
  synonyms: string[];
}

export interface CategorySchemaDef {
  id: ImportCategory;
  title: string;
  shortLabel: string;
  description: string;
  stableKeyLabel: string;
  fields: ImportFieldDef[];
  templateHeaders: string[];
  templateRows: string[][];
}

export type MappingConfidence = 'exact' | 'synonym' | 'uncertain' | 'manual' | 'unmapped';

export interface ColumnMappingDetail {
  header: string;
  targetField: string;
  confidence: MappingConfidence;
  reason: string;
}

export interface ColumnMappingResult {
  mapping: Record<string, string>;
  details: ColumnMappingDetail[];
  missingRequiredFields: Array<{ key: string; label: string }>;
  conflictingMappings: Array<{ targetField: string; headers: string[] }>;
}

export interface ValidationIssue {
  column: string;
  targetField: string;
  kind: 'missing_required' | 'invalid_type' | 'invalid_fk' | 'duplicate' | 'warning';
  message: string;
  suggestion: string;
}

export type ValidatedRowStatus =
  | 'ready'
  | 'warning'
  | 'duplicate_skip'
  | 'duplicate_update'
  | 'error';

export interface FieldDiffEntry {
  row: number;
  identifier: string;
  entity: string;
  diffs: Array<{
    field: string;
    label: string;
    before: string | number | boolean | null | undefined;
    after: string | number | boolean | null | undefined;
  }>;
}

export interface ValidatedRow {
  rowNumber: number;
  identifier: string;
  status: ValidatedRowStatus;
  action: 'create' | 'update' | 'skip' | 'failed';
  originalData: Record<string, string>;
  mappedData: Record<string, string>;
  errors: ValidationIssue[];
  warnings: Array<{ column: string; targetField: string; message: string }>;
}

export interface ValidationSummary {
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  duplicateRows: number;
  createCount: number;
  updateCount: number;
  skipCount: number;
  missingRequiredCount: number;
  invalidTypeCount: number;
  invalidFkCount: number;
}

export interface ValidationReport {
  category: ImportCategory;
  duplicateMode: DuplicateHandlingMode;
  headers: string[];
  mappingInfo: ColumnMappingResult;
  canProceed: boolean;
  blockingReason: string | null;
  summary: ValidationSummary;
  rows: ValidatedRow[];
  fieldDiffs: FieldDiffEntry[];
}

export interface ExistingStoreSnapshot {
  departments: Department[];
  rooms: Room[];
  courses: Course[];
  instructors: Instructor[];
  studentGroups: StudentGroup[];
  sections: Section[];
}

export const MAX_CSV_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROW_COUNT = 10_000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeHeaderName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export const CATEGORY_SCHEMAS: Record<ImportCategory, CategorySchemaDef> = {
  departments: {
    id: 'departments',
    title: 'Departments',
    shortLabel: 'Departments',
    description: 'Academic departments, school/faculty groups, department heads, and internal tracks.',
    stableKeyLabel: 'Department Code',
    fields: [
      { key: 'code', label: 'Department Code', group: 'Departments', required: true, type: 'string', sample: 'CS', synonyms: ['dept_code', 'department_code', 'code', 'dept', 'department_id'] },
      { key: 'name', label: 'Department Name', group: 'Departments', required: true, type: 'string', sample: 'Computer Science', synonyms: ['dept_name', 'department_name', 'name', 'department', 'title'] },
      { key: 'school', label: 'School / Faculty', group: 'Departments', required: false, type: 'string', sample: 'School of Computing', synonyms: ['school', 'faculty', 'faculty_name', 'faculty_group', 'division', 'college'] },
      { key: 'headOfDepartment', label: 'Head of Department', group: 'Departments', required: false, type: 'string', sample: 'Dr. Alan Turing', synonyms: ['head_of_department', 'hod', 'chair', 'chairperson', 'head'] },
      { key: 'subDepartments', label: 'Sub-Departments / Tracks', group: 'Departments', required: false, type: 'list', sample: 'AI; Systems', synonyms: ['sub_departments', 'sub_department', 'subdepartments', 'tracks', 'wings', 'specializations'] }
    ],
    templateHeaders: ['code', 'name', 'school', 'head_of_department', 'sub_departments'],
    templateRows: [
      ['CS', 'Computer Science', 'School of Computing', 'Dr. Alan Turing', 'Artificial Intelligence; Systems; Software Engineering'],
      ['EE', 'Electrical Engineering', 'School of Engineering', 'Dr. Nikola Tesla', 'Power Systems; Electronics']
    ]
  },
  rooms: {
    id: 'rooms',
    title: 'Classrooms & Lecture Halls',
    shortLabel: 'Rooms',
    description: 'Physical classrooms, seminar rooms, and lecture auditoriums with capacities and equipment.',
    stableKeyLabel: 'Room Code',
    fields: [
      { key: 'code', label: 'Room Code', group: 'Classrooms', required: true, type: 'string', sample: 'HALL-101', synonyms: ['room_code', 'code', 'room', 'classroom', 'classroom_code', 'hall', 'room_no', 'room_number'] },
      { key: 'name', label: 'Room Name', group: 'Classrooms', required: false, type: 'string', sample: 'Turing Lecture Hall', synonyms: ['room_name', 'name', 'hall_name', 'title', 'classroom_name'] },
      { key: 'capacity', label: 'Seating Capacity', group: 'Classrooms', required: true, type: 'int', sample: '60', synonyms: ['capacity', 'room_capacity', 'seats', 'max_students', 'cap'] },
      { key: 'type', label: 'Room Type (lecture/seminar/auditorium)', group: 'Classrooms', required: false, type: 'enum', sample: 'lecture', synonyms: ['room_type', 'type', 'kind', 'classroom_type'] },
      { key: 'building', label: 'Building Name', group: 'Classrooms', required: false, type: 'string', sample: 'Academic Block A', synonyms: ['building', 'building_name', 'block', 'location', 'wing'] },
      { key: 'floor', label: 'Floor Number', group: 'Classrooms', required: false, type: 'int', sample: '1', synonyms: ['floor', 'floor_no', 'level'] },
      { key: 'equipment', label: 'Equipment List', group: 'Classrooms', required: false, type: 'list', sample: 'Projector; Whiteboard', synonyms: ['equipment', 'features', 'amenities', 'facilities', 'resources'] },
      { key: 'isAvailable', label: 'Is Available (yes/no)', group: 'Classrooms', required: false, type: 'bool', sample: 'yes', synonyms: ['is_available', 'available', 'active', 'status'] }
    ],
    templateHeaders: ['code', 'name', 'building', 'floor', 'capacity', 'type', 'equipment', 'is_available'],
    templateRows: [
      ['HALL-101', 'Alan Turing Lecture Hall', 'Academic Block A', '1', '70', 'lecture', 'Projector; Whiteboard; Audio System', 'yes'],
      ['SEM-204', 'Euler Seminar Room', 'Academic Block A', '2', '35', 'seminar', 'SmartBoard; Projector', 'yes']
    ]
  },
  laboratories: {
    id: 'laboratories',
    title: 'Laboratories',
    shortLabel: 'Laboratories',
    description: 'Computing, engineering, and hardware laboratories with workstation capacity and assigned lab engineers.',
    stableKeyLabel: 'Lab Code',
    fields: [
      { key: 'code', label: 'Lab Code', group: 'Laboratories', required: true, type: 'string', sample: 'LAB-201', synonyms: ['lab_code', 'code', 'room_code', 'laboratory_code', 'lab', 'facility_code'] },
      { key: 'name', label: 'Laboratory Name', group: 'Laboratories', required: true, type: 'string', sample: 'Computing Lab 1', synonyms: ['lab_name', 'name', 'laboratory_name', 'facility_name', 'title'] },
      { key: 'capacity', label: 'Lab Seating Capacity', group: 'Laboratories', required: true, type: 'int', sample: '45', synonyms: ['capacity', 'seats', 'workstations', 'lab_capacity', 'max_students'] },
      { key: 'building', label: 'Building Name', group: 'Laboratories', required: false, type: 'string', sample: 'Engineering Lab Complex', synonyms: ['building', 'building_name', 'block', 'location'] },
      { key: 'labCategory', label: 'Lab Category', group: 'Laboratories', required: false, type: 'string', sample: 'Computing', synonyms: ['lab_category', 'category', 'discipline', 'lab_type'] },
      { key: 'departmentCode', label: 'Department Code', group: 'Laboratories', required: false, type: 'fk', sample: 'CS', synonyms: ['department_code', 'dept_code', 'department', 'dept'] },
      { key: 'assignedLabEngineer', label: 'Assigned Lab Engineer (email or name)', group: 'Laboratories', required: false, type: 'fk', sample: 'bilal.tariq@university.edu', synonyms: ['assigned_lab_engineer', 'lab_engineer', 'lab_engineer_email', 'engineer', 'supervisor'] },
      { key: 'equipment', label: 'Equipment List', group: 'Laboratories', required: false, type: 'list', sample: '45 Workstations; Projector', synonyms: ['equipment', 'resources', 'hardware', 'features'] },
      { key: 'isAvailable', label: 'Is Available (yes/no)', group: 'Laboratories', required: false, type: 'bool', sample: 'yes', synonyms: ['is_available', 'available', 'active'] }
    ],
    templateHeaders: ['code', 'name', 'building', 'capacity', 'lab_category', 'department_code', 'assigned_lab_engineer', 'equipment', 'is_available'],
    templateRows: [
      ['LAB-201', 'Systems & Computing Lab', 'Engineering Lab Complex', '45', 'Computing', 'CS', '', '45 Workstations; Linux Cluster; Projector', 'yes'],
      ['LAB-202', 'Digital Circuits Lab', 'Engineering Lab Complex', '35', 'Electronics', 'EE', '', 'Oscilloscopes; Function Generators', 'yes']
    ]
  },
  instructors: {
    id: 'instructors',
    title: 'Instructors & Lab Engineers',
    shortLabel: 'Instructors',
    description: 'Faculty members and lab engineers with emails, departments, workload caps, and qualified courses.',
    stableKeyLabel: 'Email Address',
    fields: [
      { key: 'name', label: 'Full Name', group: 'Instructors', required: true, type: 'string', sample: 'Dr. Sarah Chen', synonyms: ['instructor_name', 'name', 'faculty_name', 'teacher_name', 'teacher', 'professor', 'lecturer', 'faculty'] },
      { key: 'email', label: 'Institutional Email', group: 'Instructors', required: true, type: 'email', sample: 'sarah.chen@university.edu', synonyms: ['email', 'instructor_email', 'faculty_email', 'teacher_email', 'mail', 'email_address'] },
      { key: 'departmentCode', label: 'Department Code', group: 'Instructors', required: false, type: 'fk', sample: 'CS', synonyms: ['department_code', 'dept_code', 'department', 'dept'] },
      { key: 'title', label: 'Academic Designation / Title', group: 'Instructors', required: false, type: 'string', sample: 'Associate Professor', synonyms: ['title', 'designation', 'rank', 'position', 'academic_rank'] },
      { key: 'staffRole', label: 'Staff Role (faculty/lab_engineer)', group: 'Instructors', required: false, type: 'enum', sample: 'faculty', synonyms: ['staff_role', 'role_type', 'role', 'instructor_role'] },
      { key: 'subDepartment', label: 'Sub-Department / Wing', group: 'Instructors', required: false, type: 'string', sample: 'Artificial Intelligence', synonyms: ['sub_department', 'subdepartment', 'track', 'wing', 'specialization'] },
      { key: 'maxWeeklyHours', label: 'Max Weekly Hours', group: 'Instructors', required: false, type: 'int', sample: '14', synonyms: ['max_weekly_hours', 'weekly_hours', 'max_hours', 'workload_cap', 'weekly_cap'] },
      { key: 'maxDailyClasses', label: 'Max Daily Classes', group: 'Instructors', required: false, type: 'int', sample: '3', synonyms: ['max_daily_classes', 'max_lectures_per_day', 'daily_cap', 'max_daily'] },
      { key: 'qualifiedCourses', label: 'Qualified Course Codes', group: 'Instructors', required: false, type: 'list', sample: 'CS-101; CS-201', synonyms: ['qualified_courses', 'eligible_courses', 'subjects', 'can_teach', 'specializations'] }
    ],
    templateHeaders: ['name', 'email', 'department_code', 'title', 'staff_role', 'sub_department', 'max_weekly_hours', 'max_daily_classes', 'qualified_courses'],
    templateRows: [
      ['Dr. Sarah Chen', 'sarah.chen@university.edu', 'CS', 'Associate Professor', 'faculty', 'Artificial Intelligence', '14', '3', ''],
      ['Engr. Bilal Tariq', 'bilal.tariq@university.edu', 'CS', 'Senior Lab Engineer', 'lab_engineer', 'Systems', '18', '4', '']
    ]
  },
  courses: {
    id: 'courses',
    title: 'Courses',
    shortLabel: 'Courses',
    description: 'Academic courses with lecture/lab credits, department bindings, elective status, and assigned staff.',
    stableKeyLabel: 'Course Code',
    fields: [
      { key: 'code', label: 'Course Code', group: 'Courses', required: true, type: 'string', sample: 'CS-101', synonyms: ['course_code', 'code', 'subject_code', 'course_id', 'course_no', 'subject_id'] },
      { key: 'title', label: 'Course Title', group: 'Courses', required: true, type: 'string', sample: 'Programming Fundamentals', synonyms: ['title', 'course_title', 'course_name', 'subject', 'subject_name', 'name'] },
      { key: 'departmentCode', label: 'Department Code', group: 'Courses', required: true, type: 'fk', sample: 'CS', synonyms: ['department_code', 'dept_code', 'department', 'dept'] },
      { key: 'courseType', label: 'Course Type (lecture/lab/lecture_lab)', group: 'Courses', required: false, type: 'enum', sample: 'lecture_lab', synonyms: ['course_type', 'type', 'category', 'mode'] },
      { key: 'creditHours', label: 'Total Credit Hours', group: 'Courses', required: false, type: 'int', sample: '4', synonyms: ['credit_hours', 'credits', 'credit', 'cr_hrs', 'units'] },
      { key: 'lectureCredits', label: 'Lecture Credits', group: 'Courses', required: false, type: 'int', sample: '3', synonyms: ['lecture_credits', 'theory_credits', 'lec_credits', 'lec_cr', 'lecture_credit_hours'] },
      { key: 'labCredits', label: 'Lab Credits', group: 'Courses', required: false, type: 'int', sample: '1', synonyms: ['lab_credits', 'practical_credits', 'lab_cr', 'lab_credit_hours'] },
      { key: 'labSessionMode', label: 'Lab Session Mode (continuous/split_allowed)', group: 'Courses', required: false, type: 'enum', sample: 'continuous', synonyms: ['lab_session_mode', 'lab_mode'] },
      { key: 'isCompulsory', label: 'Is Compulsory (yes/no)', group: 'Courses', required: false, type: 'bool', sample: 'yes', synonyms: ['is_compulsory', 'compulsory', 'mandatory', 'core'] },
      { key: 'isElective', label: 'Is Elective (yes/no)', group: 'Courses', required: false, type: 'bool', sample: 'no', synonyms: ['is_elective', 'elective', 'optional'] },
      { key: 'electivePoolName', label: 'Elective Pool Name', group: 'Courses', required: false, type: 'string', sample: 'AI Track', synonyms: ['elective_pool', 'elective_pool_name', 'pool_name'] },
      { key: 'assignedInstructor', label: 'Assigned Instructor (email or name)', group: 'Courses', required: false, type: 'fk', sample: 'sarah.chen@university.edu', synonyms: ['assigned_instructor', 'instructor', 'instructor_email', 'instructor_name', 'teacher', 'teacher_name', 'faculty_name'] },
      { key: 'assignedLabEngineer', label: 'Assigned Lab Engineer (email or name)', group: 'Courses', required: false, type: 'fk', sample: 'bilal.tariq@university.edu', synonyms: ['assigned_lab_engineer', 'lab_engineer', 'lab_engineer_email'] },
      { key: 'requiredEquipment', label: 'Required Equipment', group: 'Courses', required: false, type: 'list', sample: 'Projector; Workstations', synonyms: ['required_equipment', 'equipment', 'lab_equipment'] },
      { key: 'subDepartment', label: 'Sub-Department / Wing', group: 'Courses', required: false, type: 'string', sample: 'Systems', synonyms: ['sub_department', 'subdepartment', 'track'] }
    ],
    templateHeaders: ['code', 'title', 'department_code', 'course_type', 'lecture_credits', 'lab_credits', 'is_elective', 'assigned_instructor', 'assigned_lab_engineer', 'required_equipment'],
    templateRows: [
      ['CS-101', 'Programming Fundamentals', 'CS', 'lecture_lab', '3', '1', 'no', '', '', 'Projector; Workstations'],
      ['CS-401', 'Artificial Intelligence', 'CS', 'lecture', '3', '0', 'yes', '', '', 'Projector']
    ]
  },
  cohorts: {
    id: 'cohorts',
    title: 'Batches & Sections',
    shortLabel: 'Batches & Sections',
    description: 'Student batches, degree programs, sections (e.g., 2K24-CS-A), semesters, and class sizes.',
    stableKeyLabel: 'Batch / Section Code',
    fields: [
      { key: 'code', label: 'Cohort / Batch Code', group: 'Batches & Sections', required: true, type: 'string', sample: '2K24-CS-A', synonyms: ['cohort_code', 'batch_code', 'code', 'class_code', 'section_code', 'group_code'] },
      { key: 'name', label: 'Batch / Section Name', group: 'Batches & Sections', required: false, type: 'string', sample: '2K24 CS Section A', synonyms: ['cohort_name', 'batch_name', 'name', 'section_name', 'class_name', 'class', 'student_group'] },
      { key: 'departmentCode', label: 'Department Code', group: 'Batches & Sections', required: true, type: 'fk', sample: 'CS', synonyms: ['department_code', 'dept_code', 'department', 'dept', 'program_code'] },
      { key: 'batchCode', label: 'Intake / Batch Year Code', group: 'Batches & Sections', required: false, type: 'string', sample: '2K24', synonyms: ['intake', 'batch', 'batch_year', 'cohort_year'] },
      { key: 'section', label: 'Section Letter', group: 'Batches & Sections', required: false, type: 'string', sample: 'A', synonyms: ['section', 'section_letter', 'sections', 'sections_list', 'sec'] },
      { key: 'year', label: 'Academic Year (1-8)', group: 'Batches & Sections', required: false, type: 'int', sample: '2', synonyms: ['year', 'study_year', 'academic_year', 'level'] },
      { key: 'semester', label: 'Semester (1-16)', group: 'Batches & Sections', required: false, type: 'int', sample: '3', synonyms: ['semester', 'sem', 'term_number'] },
      { key: 'size', label: 'Student Count', group: 'Batches & Sections', required: true, type: 'int', sample: '45', synonyms: ['student_count', 'size', 'cohort_size', 'students', 'enrollment', 'headcount'] },
      { key: 'homeRoom', label: 'Home Room Code', group: 'Batches & Sections', required: false, type: 'fk', sample: 'HALL-101', synonyms: ['home_room', 'default_room', 'assigned_room'] }
    ],
    templateHeaders: ['code', 'name', 'department_code', 'batch_code', 'section', 'year', 'semester', 'size', 'home_room'],
    templateRows: [
      ['2K24-CS-A', '2K24 CS Section A', 'CS', '2K24', 'A', '2', '3', '45', ''],
      ['2K24-CS-B', '2K24 CS Section B', 'CS', '2K24', 'B', '2', '3', '42', '']
    ]
  },
  enrollments: {
    id: 'enrollments',
    title: 'Student Enrollments',
    shortLabel: 'Enrollments',
    description: 'Course enrollments linking academic batches/sections and optional student registration numbers to courses.',
    stableKeyLabel: 'Course + Batch + Section',
    fields: [
      { key: 'courseCode', label: 'Course Code', group: 'Enrollments', required: true, type: 'fk', sample: 'CS-101', synonyms: ['course_code', 'course', 'subject_code', 'course_id'] },
      { key: 'batchCode', label: 'Batch / Cohort Code', group: 'Enrollments', required: true, type: 'fk', sample: '2K24-CS-A', synonyms: ['batch_code', 'cohort_code', 'batch', 'cohort', 'class_code'] },
      { key: 'section', label: 'Section', group: 'Enrollments', required: false, type: 'string', sample: 'A', synonyms: ['section', 'section_code', 'sec'] },
      { key: 'studentRegistrationNumber', label: 'Student Registration No (optional)', group: 'Enrollments', required: false, type: 'fk', sample: '24-CS-001', synonyms: ['registration_number', 'student_registration_number', 'roll_no', 'roll_number', 'student_id', 'reg_no'] }
    ],
    templateHeaders: ['course_code', 'batch_code', 'section', 'registration_number'],
    templateRows: [
      ['CS-101', '2K24-CS-A', 'A', ''],
      ['CS-401', '2K24-CS-B', 'B', '']
    ]
  },
  course_assignments: {
    id: 'course_assignments',
    title: 'Course Assignments',
    shortLabel: 'Assignments',
    description: 'Teaching assignments linking courses, student batches, instructors, lab engineers, and weekly sessions.',
    stableKeyLabel: 'Course + Batch + Section + Type',
    fields: [
      { key: 'courseCode', label: 'Course Code', group: 'Course Assignments', required: true, type: 'fk', sample: 'CS-101', synonyms: ['course_code', 'course', 'subject_code'] },
      { key: 'batchCode', label: 'Batch / Cohort Code', group: 'Course Assignments', required: true, type: 'fk', sample: '2K24-CS-A', synonyms: ['batch_code', 'cohort_code', 'batch', 'cohort', 'class_code'] },
      { key: 'sectionCode', label: 'Section Code', group: 'Course Assignments', required: false, type: 'string', sample: 'A', synonyms: ['section_code', 'section', 'sec'] },
      { key: 'instructor', label: 'Instructor (email or name)', group: 'Course Assignments', required: true, type: 'fk', sample: 'sarah.chen@university.edu', synonyms: ['instructor', 'instructor_email', 'instructor_name', 'teacher', 'teacher_name', 'faculty', 'faculty_name'] },
      { key: 'labEngineer', label: 'Lab Engineer (email or name)', group: 'Course Assignments', required: false, type: 'fk', sample: 'bilal.tariq@university.edu', synonyms: ['lab_engineer', 'lab_engineer_email', 'lab_engineer_name', 'assigned_lab_engineer'] },
      { key: 'sessionType', label: 'Session Type (Theory/Lab/Tutorial)', group: 'Course Assignments', required: false, type: 'enum', sample: 'Theory', synonyms: ['session_type', 'type', 'component_type'] },
      { key: 'sessionsPerWeek', label: 'Sessions Per Week (1-6)', group: 'Course Assignments', required: false, type: 'int', sample: '3', synonyms: ['sessions_per_week', 'weekly_sessions', 'frequency'] },
      { key: 'durationMinutes', label: 'Duration Minutes (30-300)', group: 'Course Assignments', required: false, type: 'int', sample: '50', synonyms: ['duration_minutes', 'duration', 'minutes'] },
      { key: 'expectedStudents', label: 'Expected Students', group: 'Course Assignments', required: false, type: 'int', sample: '45', synonyms: ['expected_students', 'enrollment', 'student_count', 'size'] },
      { key: 'requiredRoomType', label: 'Required Room Type (lecture/lab/seminar)', group: 'Course Assignments', required: false, type: 'enum', sample: 'lecture', synonyms: ['required_room_type', 'room_type'] }
    ],
    templateHeaders: ['course_code', 'batch_code', 'section_code', 'instructor', 'lab_engineer', 'session_type', 'sessions_per_week', 'duration_minutes', 'expected_students', 'required_room_type'],
    templateRows: [
      ['CS-101', '2K24-CS-A', 'A', 'sarah.chen@university.edu', '', 'Theory', '3', '50', '45', 'lecture'],
      ['CS-101', '2K24-CS-A', 'A', 'bilal.tariq@university.edu', 'bilal.tariq@university.edu', 'Lab', '1', '180', '45', 'lab']
    ]
  },
  all: {
    id: 'all',
    title: 'All-in-One Master CSV',
    shortLabel: 'All-in-One',
    description: 'Combined master CSV creating departments, classrooms, labs, instructors, courses, batches & sections, enrollments, and teaching assignments together.',
    stableKeyLabel: 'Entity Identifiers',
    fields: [
      // Departments
      { key: 'deptCode', label: 'Department Code', group: 'Departments', required: false, type: 'string', sample: 'CS', synonyms: ['dept_code', 'department_code', 'dept', 'department', 'program_code'] },
      { key: 'deptName', label: 'Department Name', group: 'Departments', required: false, type: 'string', sample: 'Computer Science', synonyms: ['dept_name', 'department_name'] },
      { key: 'school', label: 'School / Faculty', group: 'Departments', required: false, type: 'string', sample: 'School of Computing', synonyms: ['school', 'faculty', 'faculty_name', 'faculty_group', 'division', 'college'] },
      { key: 'headOfDepartment', label: 'Head of Department', group: 'Departments', required: false, type: 'string', sample: 'Dr. Alan Turing', synonyms: ['head_of_department', 'hod', 'chair', 'chairperson', 'head'] },
      { key: 'subDepartments', label: 'Sub-Departments / Tracks', group: 'Departments', required: false, type: 'list', sample: 'Artificial Intelligence; Systems', synonyms: ['sub_departments', 'subdepartments', 'tracks', 'wings'] },

      // Rooms & Labs
      { key: 'roomCode', label: 'Room / Lab Code', group: 'Rooms & Labs', required: false, type: 'string', sample: 'HALL-101', synonyms: ['room_code', 'room', 'classroom', 'classroom_code', 'hall', 'room_no', 'room_number', 'lab_code', 'laboratory_code', 'facility_code'] },
      { key: 'roomName', label: 'Room / Lab Name', group: 'Rooms & Labs', required: false, type: 'string', sample: 'Alan Turing Hall', synonyms: ['room_name', 'lab_name', 'hall_name', 'classroom_name', 'laboratory_name', 'facility_name'] },
      { key: 'roomCapacity', label: 'Room / Lab Capacity', group: 'Rooms & Labs', required: false, type: 'int', sample: '70', synonyms: ['room_capacity', 'capacity', 'seats', 'workstations', 'lab_capacity', 'max_students'] },
      { key: 'roomType', label: 'Room Type (lecture/seminar/auditorium/lab)', group: 'Rooms & Labs', required: false, type: 'string', sample: 'lecture', synonyms: ['room_type', 'classroom_type', 'facility_type', 'lab_type'] },
      { key: 'building', label: 'Building Name', group: 'Rooms & Labs', required: false, type: 'string', sample: 'Block A', synonyms: ['building', 'building_name', 'block', 'location'] },
      { key: 'floor', label: 'Floor Number', group: 'Rooms & Labs', required: false, type: 'int', sample: '1', synonyms: ['floor', 'floor_no', 'level'] },
      { key: 'labCategory', label: 'Lab Category', group: 'Rooms & Labs', required: false, type: 'string', sample: 'Computing', synonyms: ['lab_category', 'discipline'] },
      { key: 'roomLabEngineer', label: 'Room / Lab Engineer (email or name)', group: 'Rooms & Labs', required: false, type: 'fk', sample: 'bilal.tariq@university.edu', synonyms: ['room_lab_engineer', 'lab_supervisor', 'supervisor'] },
      { key: 'equipment', label: 'Room / Lab Equipment', group: 'Rooms & Labs', required: false, type: 'list', sample: 'Projector; Whiteboard', synonyms: ['equipment', 'features', 'amenities', 'facilities', 'resources', 'hardware'] },
      { key: 'roomIsAvailable', label: 'Room Is Available (yes/no)', group: 'Rooms & Labs', required: false, type: 'bool', sample: 'yes', synonyms: ['is_available', 'room_is_available', 'available', 'active'] },

      // Instructors & Lab Engineers
      { key: 'instructorName', label: 'Instructor Full Name', group: 'Instructors', required: false, type: 'string', sample: 'Dr. Sarah Chen', synonyms: ['instructor_name', 'instructor', 'faculty_name', 'teacher_name', 'teacher', 'professor', 'lecturer', 'faculty'] },
      { key: 'instructorEmail', label: 'Instructor Institutional Email', group: 'Instructors', required: false, type: 'email', sample: 'sarah.chen@university.edu', synonyms: ['instructor_email', 'email', 'faculty_email', 'teacher_email', 'email_address', 'mail'] },
      { key: 'instructorTitle', label: 'Instructor Designation / Title', group: 'Instructors', required: false, type: 'string', sample: 'Associate Professor', synonyms: ['instructor_title', 'designation', 'rank', 'position', 'academic_rank'] },
      { key: 'staffRole', label: 'Staff Role (faculty/lab_engineer)', group: 'Instructors', required: false, type: 'enum', sample: 'faculty', synonyms: ['staff_role', 'role_type', 'instructor_role'] },
      { key: 'instructorSubDepartment', label: 'Instructor Sub-Department / Wing', group: 'Instructors', required: false, type: 'string', sample: 'Artificial Intelligence', synonyms: ['instructor_sub_department', 'instructor_subdepartment', 'wing'] },
      { key: 'maxWeeklyHours', label: 'Max Weekly Hours', group: 'Instructors', required: false, type: 'int', sample: '14', synonyms: ['max_weekly_hours', 'weekly_hours', 'max_hours', 'workload_cap', 'weekly_cap'] },
      { key: 'maxDailyClasses', label: 'Max Daily Classes', group: 'Instructors', required: false, type: 'int', sample: '3', synonyms: ['max_daily_classes', 'max_lectures_per_day', 'daily_cap', 'max_daily'] },
      { key: 'qualifiedCourses', label: 'Qualified Course Codes', group: 'Instructors', required: false, type: 'list', sample: 'CS-101; CS-201', synonyms: ['qualified_courses', 'eligible_courses', 'subjects', 'can_teach', 'specializations'] },

      // Courses
      { key: 'courseCode', label: 'Course Code', group: 'Courses', required: false, type: 'string', sample: 'CS-101', synonyms: ['course_code', 'course', 'subject_code', 'course_id', 'course_no', 'subject_id'] },
      { key: 'courseTitle', label: 'Course Title', group: 'Courses', required: false, type: 'string', sample: 'Programming Fundamentals', synonyms: ['course_title', 'course_name', 'subject', 'subject_name'] },
      { key: 'courseType', label: 'Course Type (lecture/lab/lecture_lab)', group: 'Courses', required: false, type: 'enum', sample: 'lecture_lab', synonyms: ['course_type', 'course_mode'] },
      { key: 'creditHours', label: 'Total Credit Hours', group: 'Courses', required: false, type: 'int', sample: '4', synonyms: ['credit_hours', 'credits', 'credit', 'cr_hrs', 'units'] },
      { key: 'lectureCredits', label: 'Lecture Credits', group: 'Courses', required: false, type: 'int', sample: '3', synonyms: ['lecture_credits', 'theory_credits', 'lec_credits', 'lec_cr', 'lecture_credit_hours'] },
      { key: 'labCredits', label: 'Lab Credits', group: 'Courses', required: false, type: 'int', sample: '1', synonyms: ['lab_credits', 'practical_credits', 'lab_cr', 'lab_credit_hours'] },
      { key: 'labSessionMode', label: 'Lab Session Mode (continuous/split_allowed)', group: 'Courses', required: false, type: 'enum', sample: 'continuous', synonyms: ['lab_session_mode', 'lab_mode'] },
      { key: 'isCompulsory', label: 'Is Compulsory (yes/no)', group: 'Courses', required: false, type: 'bool', sample: 'yes', synonyms: ['is_compulsory', 'compulsory', 'mandatory', 'core'] },
      { key: 'isElective', label: 'Is Elective (yes/no)', group: 'Courses', required: false, type: 'bool', sample: 'no', synonyms: ['is_elective', 'elective', 'optional'] },
      { key: 'electivePoolName', label: 'Elective Pool Name', group: 'Courses', required: false, type: 'string', sample: 'AI Track', synonyms: ['elective_pool', 'elective_pool_name', 'pool_name'] },
      { key: 'assignedInstructor', label: 'Assigned Course Instructor (email or name)', group: 'Courses', required: false, type: 'fk', sample: 'sarah.chen@university.edu', synonyms: ['assigned_instructor', 'course_instructor'] },
      { key: 'assignedLabEngineer', label: 'Assigned Lab Engineer (email or name)', group: 'Courses', required: false, type: 'fk', sample: 'bilal.tariq@university.edu', synonyms: ['assigned_lab_engineer', 'lab_engineer', 'lab_engineer_email', 'lab_engineer_name', 'engineer'] },
      { key: 'requiredEquipment', label: 'Course Required Equipment', group: 'Courses', required: false, type: 'list', sample: 'Projector; Workstations', synonyms: ['required_equipment', 'lab_equipment'] },
      { key: 'courseSubDepartment', label: 'Course Sub-Department / Track', group: 'Courses', required: false, type: 'string', sample: 'Systems', synonyms: ['course_sub_department', 'sub_department', 'subdepartment', 'track'] },

      // Batches & Sections
      { key: 'cohortCode', label: 'Cohort / Section Full Code (e.g. 2K24-CS-A)', group: 'Batches & Sections', required: false, type: 'string', sample: '2K25-CS-A', synonyms: ['cohort_code', 'class_code', 'group_code', 'cohort', 'student_group'] },
      { key: 'batchCode', label: 'Intake / Batch Code (e.g. 2K24)', group: 'Batches & Sections', required: false, type: 'string', sample: '2K25', synonyms: ['batch_code', 'intake', 'batch', 'batch_year', 'cohort_year'] },
      { key: 'section', label: 'Section of Batch (e.g. A)', group: 'Batches & Sections', required: false, type: 'string', sample: 'A', synonyms: ['section', 'section_letter', 'section_code', 'sections', 'sections_list', 'sec'] },
      { key: 'cohortName', label: 'Batch / Section Name', group: 'Batches & Sections', required: false, type: 'string', sample: '2K25 CS Section A', synonyms: ['cohort_name', 'batch_name', 'section_name', 'class_name'] },
      { key: 'cohortSize', label: 'Batch / Section Student Count', group: 'Batches & Sections', required: false, type: 'int', sample: '45', synonyms: ['cohort_size', 'student_count', 'size', 'students', 'headcount'] },
      { key: 'year', label: 'Academic Year (1-8)', group: 'Batches & Sections', required: false, type: 'int', sample: '1', synonyms: ['year', 'study_year', 'academic_year'] },
      { key: 'semester', label: 'Semester (1-16)', group: 'Batches & Sections', required: false, type: 'int', sample: '1', synonyms: ['semester', 'sem', 'term_number'] },
      { key: 'homeRoom', label: 'Home Room Code', group: 'Batches & Sections', required: false, type: 'fk', sample: 'HALL-101', synonyms: ['home_room', 'default_room', 'assigned_room'] },

      // Course Assignments & Enrollments
      { key: 'sessionType', label: 'Session Type (Theory/Lab/Tutorial)', group: 'Assignments & Enrollments', required: false, type: 'enum', sample: 'Theory', synonyms: ['session_type', 'component_type'] },
      { key: 'sessionsPerWeek', label: 'Sessions Per Week (1-6)', group: 'Assignments & Enrollments', required: false, type: 'int', sample: '3', synonyms: ['sessions_per_week', 'weekly_sessions', 'frequency'] },
      { key: 'durationMinutes', label: 'Session Duration Minutes (30-300)', group: 'Assignments & Enrollments', required: false, type: 'int', sample: '50', synonyms: ['duration_minutes', 'duration', 'minutes'] },
      { key: 'expectedStudents', label: 'Expected Students', group: 'Assignments & Enrollments', required: false, type: 'int', sample: '45', synonyms: ['expected_students', 'enrollment'] },
      { key: 'requiredRoomType', label: 'Required Room Type (lecture/lab/seminar)', group: 'Assignments & Enrollments', required: false, type: 'enum', sample: 'lecture', synonyms: ['required_room_type'] },
      { key: 'studentRegistrationNumber', label: 'Student Registration No (optional)', group: 'Assignments & Enrollments', required: false, type: 'fk', sample: '24-CS-001', synonyms: ['registration_number', 'student_registration_number', 'roll_no', 'roll_number', 'student_id', 'reg_no'] }
    ],
    templateHeaders: [
      'dept_code', 'dept_name', 'school', 'head_of_department', 'sub_departments',
      'room_code', 'room_name', 'room_capacity', 'room_type', 'building', 'floor', 'lab_category', 'room_lab_engineer', 'equipment', 'is_available',
      'instructor_name', 'instructor_email', 'instructor_title', 'staff_role', 'instructor_sub_department', 'max_weekly_hours', 'max_daily_classes', 'qualified_courses',
      'course_code', 'course_title', 'course_type', 'credit_hours', 'lecture_credits', 'lab_credits', 'lab_session_mode', 'is_compulsory', 'is_elective', 'elective_pool_name', 'assigned_instructor', 'assigned_lab_engineer', 'required_equipment', 'course_sub_department',
      'cohort_code', 'batch_code', 'section', 'cohort_name', 'cohort_size', 'year', 'semester', 'home_room',
      'session_type', 'sessions_per_week', 'duration_minutes', 'expected_students', 'required_room_type', 'registration_number'
    ],
    templateRows: [
      [
        'CS', 'Computer Science', 'School of Computing', 'Dr. Alan Turing', 'Artificial Intelligence; Systems',
        'HALL-101', 'Alan Turing Hall', '70', 'lecture', 'Block A', '1', '', '', 'Projector; Whiteboard', 'yes',
        'Dr. Sarah Chen', 'sarah.chen@university.edu', 'Associate Professor', 'faculty', 'Artificial Intelligence', '14', '3', 'CS-101; CS-201',
        'CS-101', 'Programming Fundamentals', 'lecture_lab', '4', '3', '1', 'continuous', 'yes', 'no', '', 'sarah.chen@university.edu', '', 'Projector; Workstations', 'Systems',
        '2K25-CS-A', '2K25', 'A', '2K25 CS Section A', '45', '1', '1', 'HALL-101',
        'Theory', '3', '50', '45', 'lecture', ''
      ],
      [
        'CS', 'Computer Science', 'School of Computing', 'Dr. Alan Turing', 'Artificial Intelligence; Systems',
        'LAB-201', 'Computing Lab 1', '45', 'lab', 'Lab Complex', '2', 'Computing', 'bilal.tariq@university.edu', '45 Workstations; Projector', 'yes',
        'Engr. Bilal Tariq', 'bilal.tariq@university.edu', 'Senior Lab Engineer', 'lab_engineer', 'Systems', '18', '4', 'CS-101; CS-201',
        'CS-201', 'Data Structures', 'lecture_lab', '4', '3', '1', 'continuous', 'yes', 'no', '', 'sarah.chen@university.edu', 'bilal.tariq@university.edu', 'Workstations', 'Systems',
        '2K24-CS-B', '2K24', 'B', '2K24 CS Section B', '42', '2', '3', '',
        'Lab', '1', '180', '42', 'lab', ''
      ]
    ]
  }
};

export function generateTemplateCsv(category: ImportCategory): string {
  const schema = CATEGORY_SCHEMAS[category];
  const escape = (val: string) => {
    if (/[",\n\r]/.test(val)) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };
  const lines = [
    schema.templateHeaders.map(escape).join(','),
    ...schema.templateRows.map(r => r.map(escape).join(','))
  ];
  return lines.join('\n') + '\n';
}

export class CsvFormatError extends Error {
  line?: number;
  constructor(message: string, line?: number) {
    super(message);
    this.name = 'CsvFormatError';
    this.line = line;
  }
}

export function detectDelimiterChar(sampleLine: string): ',' | ';' | '\t' {
  const candidates: Array<',' | ';' | '\t'> = [',', '\t', ';'];
  let best: ',' | ';' | '\t' = ',';
  let bestCount = -1;
  for (const delim of candidates) {
    let inQuotes = false;
    let count = 0;
    for (let i = 0; i < sampleLine.length; i++) {
      const ch = sampleLine[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === delim && !inQuotes) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = delim;
    }
  }
  return best;
}

export function parseCsvTextStrict(rawInput: string): {
  headers: string[];
  rows: string[][];
} {
  if (!rawInput || !rawInput.trim()) {
    throw new CsvFormatError('The uploaded file is empty.');
  }
  const byteSize = new TextEncoder().encode(rawInput).length;
  if (byteSize > MAX_CSV_FILE_BYTES) {
    throw new CsvFormatError(`File size exceeds maximum limit of ${MAX_CSV_FILE_BYTES / (1024 * 1024)} MB.`);
  }
  if (rawInput.includes('\u0000')) {
    throw new CsvFormatError('Binary or corrupted file content detected. Please upload a valid UTF-8 CSV or .xlsx file.');
  }

  const text = rawInput.charCodeAt(0) === 0xfeff ? rawInput.slice(1) : rawInput;
  const firstNl = text.indexOf('\n');
  const firstLine = firstNl === -1 ? text : text.slice(0, firstNl);
  const delimiter = detectDelimiterChar(firstLine);

  const matrix: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  let quoteStartLine = 1;
  let lineNum = 1;
  let atFieldStart = true;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = false;
          // Check next non-space char is delimiter, newline, or EOF
          let j = i + 1;
          while (j < text.length && text[j] === ' ') j++;
          if (j < text.length && text[j] !== delimiter && text[j] !== '\r' && text[j] !== '\n') {
            throw new CsvFormatError(
              `Malformed CSV on line ${lineNum}: unexpected character "${text[j]}" after closing quote.`,
              lineNum
            );
          }
        }
      } else {
        if (ch === '\n') lineNum++;
        currentCell += ch;
      }
      continue;
    }

    if (ch === '"') {
      if (!atFieldStart && currentCell.trim().length > 0) {
        throw new CsvFormatError(
          `Malformed CSV on line ${lineNum}: unescaped quotation mark inside an unquoted field.`,
          lineNum
        );
      }
      inQuotes = true;
      quoteStartLine = lineNum;
      atFieldStart = false;
    } else if (ch === delimiter) {
      currentRow.push(currentCell.trim());
      currentCell = '';
      atFieldStart = true;
    } else if (ch === '\r') {
      if (next === '\n') i++;
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c !== '')) matrix.push(currentRow);
      currentRow = [];
      currentCell = '';
      lineNum++;
      atFieldStart = true;
    } else if (ch === '\n') {
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c !== '')) matrix.push(currentRow);
      currentRow = [];
      currentCell = '';
      lineNum++;
      atFieldStart = true;
    } else {
      currentCell += ch;
      if (ch !== ' ') atFieldStart = false;
    }
  }

  if (inQuotes) {
    throw new CsvFormatError(
      `Malformed CSV: unclosed quoted field starting on line ${quoteStartLine}.`,
      quoteStartLine
    );
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(c => c !== '')) matrix.push(currentRow);
  }

  if (matrix.length === 0) {
    throw new CsvFormatError('No header or data rows were found.');
  }

  const rawHeaders = matrix[0].map((h, idx) => h.trim() || `Column_${idx + 1}`);
  const hdrCounts = new Map<string, number>();
  const uniqueHeaders = rawHeaders.map(h => {
    const cnt = (hdrCounts.get(h) || 0) + 1;
    hdrCounts.set(h, cnt);
    return cnt === 1 ? h : `${h} (${cnt})`;
  });

  const dataRows = matrix.slice(1).filter(r => r.some(cell => cell !== ''));
  if (dataRows.length === 0) {
    throw new CsvFormatError('Header row detected, but there are 0 data rows to import.');
  }
  if (dataRows.length > MAX_IMPORT_ROW_COUNT) {
    throw new CsvFormatError(
      `File contains ${dataRows.length} rows, exceeding the maximum supported batch size of ${MAX_IMPORT_ROW_COUNT} rows.`
    );
  }

  const normalizedRows = dataRows.map(r => {
    const out = r.slice(0, uniqueHeaders.length);
    while (out.length < uniqueHeaders.length) out.push('');
    return out;
  });

  return { headers: uniqueHeaders, rows: normalizedRows };
}

export function detectImportColumnMappings(
  headers: string[],
  category: ImportCategory,
  manualOverrides?: Record<string, string>
): ColumnMappingResult {
  const fields = CATEGORY_SCHEMAS[category].fields;
  const fieldByKey = new Map(fields.map(f => [f.key, f]));
  const mapping: Record<string, string> = {};
  const details: ColumnMappingDetail[] = [];
  const usedTargets = new Set<string>();

  if (manualOverrides) {
    headers.forEach(hdr => {
      if (hdr in manualOverrides) {
        const chosen = (manualOverrides[hdr] || '').trim();
        if (chosen === '') {
          mapping[hdr] = '';
        } else if (fieldByKey.has(chosen)) {
          mapping[hdr] = chosen;
          usedTargets.add(chosen);
        }
      }
    });
  }

  headers.forEach(hdr => {
    if (hdr in mapping) {
      const target = mapping[hdr];
      details.push({
        header: hdr,
        targetField: target,
        confidence: target ? 'manual' : 'unmapped',
        reason: target ? 'Manually assigned' : 'Skipped / ignored column'
      });
      return;
    }

    const normH = normalizeHeaderName(hdr);
    let matchedTarget = '';
    let confidence: MappingConfidence = 'unmapped';
    let reason = 'No matching schema field detected';

    for (const f of fields) {
      if (usedTargets.has(f.key)) continue;
      if (normH === normalizeHeaderName(f.key) || normH === normalizeHeaderName(f.label)) {
        matchedTarget = f.key;
        confidence = 'exact';
        reason = `Exact match to ${f.label}`;
        break;
      }
    }

    if (!matchedTarget) {
      for (const f of fields) {
        if (usedTargets.has(f.key)) continue;
        if (f.synonyms.some(syn => normalizeHeaderName(syn) === normH)) {
          matchedTarget = f.key;
          confidence = 'synonym';
          reason = `Synonym match for ${f.label}`;
          break;
        }
      }
    }

    if (!matchedTarget && normH.length >= 3) {
      const hTokens = new Set(normH.split('_').filter(Boolean));
      let bestScore = 0;
      let bestField: ImportFieldDef | null = null;
      for (const f of fields) {
        if (usedTargets.has(f.key)) continue;
        const candidates = [f.key, f.label, ...f.synonyms];
        for (const cand of candidates) {
          const nc = normalizeHeaderName(cand);
          if (!nc) continue;
          const cTokens = new Set(nc.split('_').filter(Boolean));
          let overlap = 0;
          hTokens.forEach(t => {
            if (cTokens.has(t)) overlap++;
          });
          if (overlap > 0) {
            const score = overlap / Math.max(hTokens.size, cTokens.size);
            if (score > bestScore) {
              bestScore = score;
              bestField = f;
            }
          }
        }
      }
      if (bestField && bestScore >= 0.5) {
        matchedTarget = bestField.key;
        confidence = 'uncertain';
        reason = `Uncertain partial match to ${bestField.label} — verify before continuing`;
      }
    }

    mapping[hdr] = matchedTarget;
    if (matchedTarget) usedTargets.add(matchedTarget);
    details.push({ header: hdr, targetField: matchedTarget, confidence, reason });
  });

  const mappedSet = new Set(Object.values(mapping).filter(Boolean));
  const missingRequiredFields = fields
    .filter(f => f.required && !mappedSet.has(f.key))
    .map(f => ({ key: f.key, label: f.label }));

  const targetToHeaders = new Map<string, string[]>();
  Object.entries(mapping).forEach(([hdr, tgt]) => {
    if (!tgt) return;
    const list = targetToHeaders.get(tgt) || [];
    list.push(hdr);
    targetToHeaders.set(tgt, list);
  });
  const conflictingMappings: Array<{ targetField: string; headers: string[] }> = [];
  targetToHeaders.forEach((hdrs, targetField) => {
    if (hdrs.length > 1) conflictingMappings.push({ targetField, headers: hdrs });
  });

  return {
    mapping,
    details,
    missingRequiredFields,
    conflictingMappings
  };
}

function parseStrictBool(raw: string, fallback: boolean): boolean {
  const s = raw.trim().toLowerCase();
  if (!s) return fallback;
  if (['true', 'yes', '1', 'y', 't'].includes(s)) return true;
  if (['false', 'no', '0', 'n', 'f'].includes(s)) return false;
  throw new Error(`Invalid boolean "${raw}". Expected yes/no or true/false.`);
}

function parseStrictInt(raw: string, label: string, min: number, max: number): number {
  const s = raw.trim();
  if (!/^[+-]?\d+$/.test(s)) {
    throw new Error(`${label} must be an integer (received "${raw}").`);
  }
  const val = Number(s);
  if (val < min || val > max) {
    throw new Error(`${label} must be between ${min} and ${max} (received ${val}).`);
  }
  return val;
}

function splitList(raw: string): string[] {
  return raw
    .split(/[;|,]/)
    .map(s => s.trim())
    .filter(Boolean);
}

export function validateImportPreviewLocal(params: {
  category: ImportCategory;
  duplicateMode: DuplicateHandlingMode;
  headers: string[];
  rows: string[][];
  columnMappings: Record<string, string>;
  storeSnapshot: ExistingStoreSnapshot;
}): ValidationReport {
  const { category, duplicateMode, headers, rows, columnMappings, storeSnapshot } = params;
  const mappingInfo = detectImportColumnMappings(headers, category, columnMappings);
  const activeMap = mappingInfo.mapping;

  if (mappingInfo.conflictingMappings.length > 0) {
    const conflicts = mappingInfo.conflictingMappings
      .map(c => `${c.targetField} (${c.headers.join(', ')})`)
      .join('; ');
    return {
      category,
      duplicateMode,
      headers,
      mappingInfo,
      canProceed: false,
      blockingReason: `Conflicting mappings: ${conflicts}. Map each column to a distinct target field.`,
      summary: {
        totalRows: rows.length,
        validRows: 0,
        warningRows: 0,
        errorRows: rows.length,
        duplicateRows: 0,
        createCount: 0,
        updateCount: 0,
        skipCount: 0,
        missingRequiredCount: mappingInfo.missingRequiredFields.length,
        invalidTypeCount: 0,
        invalidFkCount: 0
      },
      rows: [],
      fieldDiffs: []
    };
  }

  if (mappingInfo.missingRequiredFields.length > 0) {
    return {
      category,
      duplicateMode,
      headers,
      mappingInfo,
      canProceed: false,
      blockingReason: `Missing required column mappings: ${mappingInfo.missingRequiredFields.map(f => f.label).join(', ')}.`,
      summary: {
        totalRows: rows.length,
        validRows: 0,
        warningRows: 0,
        errorRows: rows.length,
        duplicateRows: 0,
        createCount: 0,
        updateCount: 0,
        skipCount: 0,
        missingRequiredCount: mappingInfo.missingRequiredFields.length,
        invalidTypeCount: 0,
        invalidFkCount: 0
      },
      rows: [],
      fieldDiffs: []
    };
  }

  const headerIndex = new Map(headers.map((h, i) => [h, i]));
  const targetToHeader = new Map<string, string>();
  Object.entries(activeMap).forEach(([h, t]) => {
    if (t) targetToHeader.set(t, h);
  });
  const srcCol = (k: string) => targetToHeader.get(k) || k;

  const existingDeptsByCode = new Map(storeSnapshot.departments.map(d => [d.code.trim().toUpperCase(), d]));
  const existingDeptsByName = new Map(storeSnapshot.departments.map(d => [d.name.trim().toLowerCase(), d]));
  const existingRoomsByCode = new Map(storeSnapshot.rooms.filter(r => r.type !== 'lab').map(r => [r.code.trim().toUpperCase(), r]));
  const existingLabsByCode = new Map(storeSnapshot.rooms.filter(r => r.type === 'lab').map(r => [r.code.trim().toUpperCase(), r]));
  const existingAllRoomsByCode = new Map(storeSnapshot.rooms.map(r => [r.code.trim().toUpperCase(), r]));
  const existingInstByEmail = new Map(storeSnapshot.instructors.map(i => [i.email.trim().toLowerCase(), i]));
  const existingInstByName = new Map(storeSnapshot.instructors.map(i => [i.name.trim().toLowerCase(), i]));
  const existingCoursesByCode = new Map(storeSnapshot.courses.map(c => [c.code.trim().toUpperCase(), c]));
  const existingGroupsByCode = new Map(storeSnapshot.studentGroups.map(g => [g.code.trim().toUpperCase(), g]));
  const existingSectionsByKey = new Map(
    storeSnapshot.sections.map(s => {
      const cCode = storeSnapshot.courses.find(c => c.id === s.courseId)?.code.toUpperCase() || s.courseId;
      const gCode = storeSnapshot.studentGroups.find(g => g.id === s.studentGroupId)?.code.toUpperCase() || s.studentGroupId;
      return [`${cCode}::${gCode}::${s.sectionNumber.toUpperCase()}::${(s.sessionType || 'Lecture').toLowerCase()}`, s];
    })
  );

  // Staged within-file lookups so multi-row imports resolve intra-file keys accurately
  const stagedDeptCodes = new Set(existingDeptsByCode.keys());
  const stagedDeptNames = new Set(existingDeptsByName.keys());
  const stagedCourseCodes = new Set(existingCoursesByCode.keys());
  const stagedGroupCodes = new Set(existingGroupsByCode.keys());
  const stagedInstKeys = new Set([...existingInstByEmail.keys(), ...existingInstByName.keys()]);
  const inFileKeys = new Map<string, number>();

  const hasDept = (k: string) => stagedDeptCodes.has(k.trim().toUpperCase()) || stagedDeptNames.has(k.trim().toLowerCase());
  const hasInst = (k: string) => stagedInstKeys.has(k.trim().toLowerCase());

  const validatedRows: ValidatedRow[] = [];
  const fieldDiffs: FieldDiffEntry[] = [];

  let missingRequiredCount = 0;
  let invalidTypeCount = 0;
  let invalidFkCount = 0;
  let duplicateRows = 0;
  let warningRows = 0;
  let errorRows = 0;
  let createCount = 0;
  let updateCount = 0;
  let skipCount = 0;

  rows.forEach((rawCells, idx) => {
    const rowNumber = idx + 2;
    const originalData: Record<string, string> = {};
    headers.forEach((h, i) => {
      originalData[h] = rawCells[i] ?? '';
    });
    const mappedData: Record<string, string> = {};
    Object.entries(activeMap).forEach(([h, tgt]) => {
      if (tgt) {
        const cIdx = headerIndex.get(h) ?? -1;
        mappedData[tgt] = cIdx >= 0 ? (rawCells[cIdx] ?? '').trim() : '';
      }
    });

    const errors: ValidationIssue[] = [];
    const warnings: Array<{ column: string; targetField: string; message: string }> = [];

    const addErr = (
      targetField: string,
      kind: ValidationIssue['kind'],
      message: string,
      suggestion: string
    ) => {
      if (kind === 'missing_required') missingRequiredCount++;
      else if (kind === 'invalid_type') invalidTypeCount++;
      else if (kind === 'invalid_fk') invalidFkCount++;
      errors.push({ column: srcCol(targetField), targetField, kind, message, suggestion });
    };

    const addWarn = (targetField: string, message: string) => {
      warnings.push({ column: srcCol(targetField), targetField, message });
    };

    let action: ValidatedRow['action'] = 'create';
    let identifier = `Row ${rowNumber}`;

    if (category === 'departments') {
      const code = (mappedData.code || '').toUpperCase();
      const name = mappedData.name || '';
      const school = mappedData.school || 'Engineering & Computing';
      identifier = code || name || identifier;

      if (!code) addErr('code', 'missing_required', 'Department code is required.', 'Enter a short department code (e.g., CS).');
      if (!name) addErr('name', 'missing_required', 'Department name is required.', 'Enter the full department title.');

      if (code) {
        const dupKey = `dept:${code}`;
        if (inFileKeys.has(dupKey)) {
          duplicateRows++;
          if (duplicateMode === 'stop') {
            addErr('code', 'duplicate', `Duplicate department "${code}" already appears on row ${inFileKeys.get(dupKey)}.`, 'Remove duplicate row or choose Skip/Update mode.');
          } else if (duplicateMode === 'skip') {
            action = 'skip';
            addWarn('code', `Duplicate in CSV (first seen at line ${inFileKeys.get(dupKey)}); row will be skipped.`);
          }
        } else {
          inFileKeys.set(dupKey, rowNumber);
        }

        const ex = existingDeptsByCode.get(code);
        if (errors.length === 0 && ex && action !== 'skip') {
          duplicateRows++;
          if (duplicateMode === 'stop') {
            addErr('code', 'duplicate', `Department "${code}" already exists in catalog.`, 'Switch duplicate handling to Skip or Update.');
          } else if (duplicateMode === 'skip') {
            action = 'skip';
            addWarn('code', `Department "${code}" already exists; row skipped.`);
          } else {
            action = 'update';
            const diffs = [
              ...(ex.name !== name ? [{ field: 'name', label: 'Department Name', before: ex.name, after: name }] : []),
              ...(ex.school !== school ? [{ field: 'school', label: 'School / Faculty', before: ex.school, after: school }] : [])
            ];
            fieldDiffs.push({ row: rowNumber, identifier: code, entity: 'Department', diffs });
          }
        } else if (errors.length === 0 && action === 'create') {
          stagedDeptCodes.add(code);
          stagedDeptNames.add(name.toLowerCase());
        }
      }
    } else if (category === 'rooms') {
      const code = (mappedData.code || '').toUpperCase();
      const name = mappedData.name || code;
      const capRaw = mappedData.capacity || '';
      const typeRaw = (mappedData.type || 'lecture').toLowerCase();
      const availRaw = mappedData.isAvailable || '';
      identifier = code || identifier;

      if (!code) addErr('code', 'missing_required', 'Room code is required.', 'Provide a room code (e.g., HALL-101).');
      let cap = 60;
      if (!capRaw) {
        addErr('capacity', 'missing_required', 'Seating capacity is required.', 'Enter a positive integer capacity.');
      } else {
        try {
          cap = parseStrictInt(capRaw, 'Seating capacity', 1, 2000);
          if (cap > 500) addWarn('capacity', `Unusually large room capacity (${cap} seats).`);
        } catch (e) {
          addErr('capacity', 'invalid_type', (e as Error).message, 'Use an integer between 1 and 2000.');
        }
      }
      if (mappedData.floor) {
        try {
          parseStrictInt(mappedData.floor, 'Floor', -5, 100);
        } catch (e) {
          addErr('floor', 'invalid_type', (e as Error).message, 'Enter a valid floor integer.');
        }
      }
      if (typeRaw && !['lecture', 'classroom', 'hall', 'theory', 'seminar', 'tutorial', 'auditorium', 'amphitheater'].includes(typeRaw)) {
        if (typeRaw.includes('lab')) {
          addErr('type', 'invalid_type', `"${typeRaw}" should be imported under the Laboratories category.`, 'Use lecture/seminar/auditorium or switch category to Laboratories.');
        } else {
          addErr('type', 'invalid_type', `Unsupported room type "${typeRaw}".`, 'Allowed: lecture, seminar, auditorium.');
        }
      }
      if (availRaw) {
        try {
          parseStrictBool(availRaw, true);
        } catch (e) {
          addErr('isAvailable', 'invalid_type', (e as Error).message, 'Use yes/no or true/false.');
        }
      }

      if (code) {
        const dupKey = `room:${code}`;
        if (inFileKeys.has(dupKey)) {
          duplicateRows++;
          if (duplicateMode === 'stop') addErr('code', 'duplicate', `Duplicate room "${code}" on row ${inFileKeys.get(dupKey)}.`, 'Remove duplicate or choose Skip/Update.');
          else if (duplicateMode === 'skip') { action = 'skip'; addWarn('code', `Duplicate in CSV (line ${inFileKeys.get(dupKey)}); skipped.`); }
        } else inFileKeys.set(dupKey, rowNumber);

        const ex = existingRoomsByCode.get(code);
        if (errors.length === 0 && ex && action !== 'skip') {
          duplicateRows++;
          if (duplicateMode === 'stop') addErr('code', 'duplicate', `Room "${code}" already exists.`, 'Switch duplicate handling to Skip or Update.');
          else if (duplicateMode === 'skip') { action = 'skip'; addWarn('code', `Room "${code}" already exists; skipped.`); }
          else {
            action = 'update';
            const diffs = [
              ...(ex.name !== name ? [{ field: 'name', label: 'Room Name', before: ex.name, after: name }] : []),
              ...(ex.capacity !== cap ? [{ field: 'capacity', label: 'Capacity', before: ex.capacity, after: cap }] : [])
            ];
            fieldDiffs.push({ row: rowNumber, identifier: code, entity: 'Classroom', diffs });
          }
        }
      }
    } else if (category === 'laboratories') {
      const code = (mappedData.code || '').toUpperCase();
      const name = mappedData.name || '';
      const capRaw = mappedData.capacity || '';
      const deptRaw = mappedData.departmentCode || '';
      const engRaw = mappedData.assignedLabEngineer || '';
      const availRaw = mappedData.isAvailable || '';
      identifier = code || identifier;

      if (!code) addErr('code', 'missing_required', 'Lab code is required.', 'Provide a unique laboratory code (e.g., LAB-201).');
      if (!name) addErr('name', 'missing_required', 'Laboratory name is required.', 'Provide a descriptive lab name.');
      let cap = 40;
      if (!capRaw) {
        addErr('capacity', 'missing_required', 'Lab capacity is required.', 'Enter workstation/seating count.');
      } else {
        try {
          cap = parseStrictInt(capRaw, 'Lab capacity', 1, 500);
        } catch (e) {
          addErr('capacity', 'invalid_type', (e as Error).message, 'Use an integer between 1 and 500.');
        }
      }
      if (availRaw) {
        try {
          parseStrictBool(availRaw, true);
        } catch (e) {
          addErr('isAvailable', 'invalid_type', (e as Error).message, 'Use yes/no or true/false.');
        }
      }
      if (deptRaw && !hasDept(deptRaw)) {
        addErr('departmentCode', 'invalid_fk', `Department "${deptRaw}" does not exist.`, 'Create or import departments first.');
      }
      if (engRaw && !hasInst(engRaw)) {
        addErr('assignedLabEngineer', 'invalid_fk', `Lab engineer "${engRaw}" was not found.`, 'Import instructors first or enter a valid email/name.');
      }

      if (code) {
        const dupKey = `lab:${code}`;
        if (inFileKeys.has(dupKey)) {
          duplicateRows++;
          if (duplicateMode === 'stop') addErr('code', 'duplicate', `Duplicate lab "${code}" on row ${inFileKeys.get(dupKey)}.`, 'Remove duplicate row or select Skip/Update.');
          else if (duplicateMode === 'skip') { action = 'skip'; addWarn('code', `Duplicate in CSV (line ${inFileKeys.get(dupKey)}); skipped.`); }
        } else inFileKeys.set(dupKey, rowNumber);

        const ex = existingLabsByCode.get(code);
        if (errors.length === 0 && ex && action !== 'skip') {
          duplicateRows++;
          if (duplicateMode === 'stop') addErr('code', 'duplicate', `Laboratory "${code}" already exists.`, 'Switch duplicate handling to Skip or Update.');
          else if (duplicateMode === 'skip') { action = 'skip'; addWarn('code', `Laboratory "${code}" already exists; skipped.`); }
          else {
            action = 'update';
            const diffs = [
              ...(ex.name !== name ? [{ field: 'name', label: 'Lab Name', before: ex.name, after: name }] : []),
              ...(ex.capacity !== cap ? [{ field: 'capacity', label: 'Capacity', before: ex.capacity, after: cap }] : [])
            ];
            fieldDiffs.push({ row: rowNumber, identifier: code, entity: 'Laboratory', diffs });
          }
        }
      }
    } else if (category === 'instructors') {
      const name = mappedData.name || '';
      const email = (mappedData.email || '').toLowerCase();
      const deptRaw = mappedData.departmentCode || '';
      const title = mappedData.title || 'Assistant Professor';
      const roleRaw = (mappedData.staffRole || 'faculty').toLowerCase();
      const wkRaw = mappedData.maxWeeklyHours || '';
      const dayRaw = mappedData.maxDailyClasses || '';
      const qualRaw = splitList(mappedData.qualifiedCourses || '');
      identifier = email || name || identifier;

      if (!name) addErr('name', 'missing_required', 'Instructor name is required.', 'Provide full name.');
      if (!email) addErr('email', 'missing_required', 'Institutional email is required.', 'Provide unique email address.');
      else if (!EMAIL_REGEX.test(email)) addErr('email', 'invalid_type', `"${email}" is not a valid email address.`, 'Use format name@university.edu.');

      if (roleRaw && !['faculty', 'professor', 'lecturer', 'instructor', 'teacher', 'lab_engineer', 'lab engineer', 'engineer', 'demonstrator', 'ta'].includes(roleRaw)) {
        addErr('staffRole', 'invalid_type', `Unsupported staff role "${roleRaw}".`, 'Use faculty or lab_engineer.');
      }
      let maxWk = 15;
      if (wkRaw) {
        try {
          maxWk = parseStrictInt(wkRaw, 'Max weekly hours', 1, 45);
        } catch (e) {
          addErr('maxWeeklyHours', 'invalid_type', (e as Error).message, 'Enter integer 1–45.');
        }
      }
      if (dayRaw) {
        try {
          parseStrictInt(dayRaw, 'Max daily classes', 1, 10);
        } catch (e) {
          addErr('maxDailyClasses', 'invalid_type', (e as Error).message, 'Enter integer 1–10.');
        }
      }
      if (deptRaw && !hasDept(deptRaw)) {
        addErr('departmentCode', 'invalid_fk', `Department "${deptRaw}" does not exist.`, 'Import departments first.');
      }
      for (const cc of qualRaw) {
        if (!stagedCourseCodes.has(cc.toUpperCase())) {
          addErr('qualifiedCourses', 'invalid_fk', `Qualified course "${cc}" was not found in catalog.`, 'Import courses first or verify course code.');
        }
      }

      if (email) {
        const dupKey = `inst:${email}`;
        if (inFileKeys.has(dupKey)) {
          duplicateRows++;
          if (duplicateMode === 'stop') addErr('email', 'duplicate', `Duplicate email "${email}" on row ${inFileKeys.get(dupKey)}.`, 'Remove duplicate email row or choose Skip/Update.');
          else if (duplicateMode === 'skip') { action = 'skip'; addWarn('email', `Duplicate email in CSV (line ${inFileKeys.get(dupKey)}); skipped.`); }
        } else inFileKeys.set(dupKey, rowNumber);

        const ex = existingInstByEmail.get(email);
        if (errors.length === 0 && ex && action !== 'skip') {
          duplicateRows++;
          if (duplicateMode === 'stop') addErr('email', 'duplicate', `Instructor "${email}" already exists.`, 'Switch duplicate handling to Skip or Update.');
          else if (duplicateMode === 'skip') { action = 'skip'; addWarn('email', `Instructor "${email}" already exists; skipped.`); }
          else {
            action = 'update';
            const diffs = [
              ...(ex.name !== name ? [{ field: 'name', label: 'Full Name', before: ex.name, after: name }] : []),
              ...(ex.title !== title ? [{ field: 'title', label: 'Designation', before: ex.title, after: title }] : []),
              ...(wkRaw && ex.maxWeeklyHours !== maxWk ? [{ field: 'maxWeeklyHours', label: 'Max Weekly Hours', before: ex.maxWeeklyHours, after: maxWk }] : [])
            ];
            fieldDiffs.push({ row: rowNumber, identifier: email, entity: 'Instructor', diffs });
          }
        } else if (errors.length === 0 && action === 'create') {
          stagedInstKeys.add(email);
          if (name) stagedInstKeys.add(name.toLowerCase());
        }
      }
    } else if (category === 'courses') {
      const code = (mappedData.code || '').toUpperCase();
      const title = mappedData.title || '';
      const deptRaw = mappedData.departmentCode || '';
      const ctypeRaw = (mappedData.courseType || '').toLowerCase();
      const crRaw = mappedData.creditHours || '';
      const lecRaw = mappedData.lectureCredits || '';
      const labRaw = mappedData.labCredits || '';
      const instRaw = mappedData.assignedInstructor || '';
      const engRaw = mappedData.assignedLabEngineer || '';
      identifier = code || identifier;

      if (!code) addErr('code', 'missing_required', 'Course code is required.', 'Enter a unique course code (e.g., CS-101).');
      if (!title) addErr('title', 'missing_required', 'Course title is required.', 'Enter the full course title.');
      if (!deptRaw) addErr('departmentCode', 'missing_required', 'Department code is required.', 'Provide an existing department code.');
      else if (!hasDept(deptRaw)) addErr('departmentCode', 'invalid_fk', `Department "${deptRaw}" does not exist.`, 'Create or import the department first.');

      if (ctypeRaw && !['lecture', 'theory', 'lab', 'lecture_lab', 'lecture+lab', 'both'].includes(ctypeRaw)) {
        addErr('courseType', 'invalid_type', `Invalid course type "${ctypeRaw}".`, 'Use lecture, lab, or lecture_lab.');
      }
      if (mappedData.labSessionMode && !['continuous', 'split_allowed'].includes(mappedData.labSessionMode.toLowerCase())) {
        addErr('labSessionMode', 'invalid_type', `Invalid lab session mode "${mappedData.labSessionMode}".`, 'Use continuous or split_allowed.');
      }
      if (crRaw) {
        try {
          parseStrictInt(crRaw, 'Credit hours', 1, 6);
        } catch (e) {
          addErr('creditHours', 'invalid_type', (e as Error).message, 'Enter integer 1–6.');
        }
      }
      if (lecRaw) {
        try {
          parseStrictInt(lecRaw, 'Lecture credits', 0, 6);
        } catch (e) {
          addErr('lectureCredits', 'invalid_type', (e as Error).message, 'Enter integer 0–6.');
        }
      }
      if (labRaw) {
        try {
          parseStrictInt(labRaw, 'Lab credits', 0, 4);
        } catch (e) {
          addErr('labCredits', 'invalid_type', (e as Error).message, 'Enter integer 0–4.');
        }
      }
      if (mappedData.isCompulsory) {
        try {
          parseStrictBool(mappedData.isCompulsory, true);
        } catch (e) {
          addErr('isCompulsory', 'invalid_type', (e as Error).message, 'Use yes/no or true/false.');
        }
      }
      if (mappedData.isElective) {
        try {
          parseStrictBool(mappedData.isElective, false);
        } catch (e) {
          addErr('isElective', 'invalid_type', (e as Error).message, 'Use yes/no or true/false.');
        }
      }
      if (instRaw && !hasInst(instRaw)) {
        addErr('assignedInstructor', 'invalid_fk', `Assigned instructor "${instRaw}" was not found.`, 'Import instructors first or verify email/name.');
      }
      if (engRaw && !hasInst(engRaw)) {
        addErr('assignedLabEngineer', 'invalid_fk', `Lab engineer "${engRaw}" was not found.`, 'Import instructors first or verify email/name.');
      }

      if (code) {
        const dupKey = `course:${code}`;
        if (inFileKeys.has(dupKey)) {
          duplicateRows++;
          if (duplicateMode === 'stop') addErr('code', 'duplicate', `Duplicate course "${code}" on row ${inFileKeys.get(dupKey)}.`, 'Remove duplicate row or select Skip/Update.');
          else if (duplicateMode === 'skip') { action = 'skip'; addWarn('code', `Duplicate in CSV (line ${inFileKeys.get(dupKey)}); skipped.`); }
        } else inFileKeys.set(dupKey, rowNumber);

        const ex = existingCoursesByCode.get(code);
        if (errors.length === 0 && ex && action !== 'skip') {
          duplicateRows++;
          if (duplicateMode === 'stop') addErr('code', 'duplicate', `Course "${code}" already exists.`, 'Switch duplicate handling to Skip or Update.');
          else if (duplicateMode === 'skip') { action = 'skip'; addWarn('code', `Course "${code}" already exists; skipped.`); }
          else {
            action = 'update';
            const nextCr = crRaw ? Number(crRaw) : ex.creditHours;
            const diffs = [
              ...(ex.title !== title ? [{ field: 'title', label: 'Course Title', before: ex.title, after: title }] : []),
              ...(ex.creditHours !== nextCr ? [{ field: 'creditHours', label: 'Credit Hours', before: ex.creditHours, after: nextCr }] : [])
            ];
            fieldDiffs.push({ row: rowNumber, identifier: code, entity: 'Course', diffs });
          }
        } else if (errors.length === 0 && action === 'create') {
          stagedCourseCodes.add(code);
        }
      }
    } else if (category === 'cohorts') {
      const code = (mappedData.code || '').toUpperCase();
      const name = mappedData.name || `Cohort ${code}`;
      const deptRaw = (mappedData.departmentCode || '').toUpperCase();
      const sizeRaw = mappedData.size || '';
      const homeRoom = (mappedData.homeRoom || '').toUpperCase();
      identifier = code || identifier;

      if (!code) addErr('code', 'missing_required', 'Batch/section code is required.', 'Enter code (e.g., 2K24-CS-A).');
      if (!deptRaw) addErr('departmentCode', 'missing_required', 'Department code is required.', 'Enter an existing department code.');
      else if (!hasDept(deptRaw)) addErr('departmentCode', 'invalid_fk', `Department "${deptRaw}" does not exist.`, 'Import departments first.');

      let size = 45;
      if (!sizeRaw) addErr('size', 'missing_required', 'Student count is required.', 'Enter integer >= 1.');
      else {
        try {
          size = parseStrictInt(sizeRaw, 'Student count', 1, 1000);
        } catch (e) {
          addErr('size', 'invalid_type', (e as Error).message, 'Enter integer 1–1000.');
        }
      }
      if (mappedData.year) {
        try {
          parseStrictInt(mappedData.year, 'Academic year', 1, 8);
        } catch (e) {
          addErr('year', 'invalid_type', (e as Error).message, 'Enter integer 1–8.');
        }
      }
      if (mappedData.semester) {
        try {
          parseStrictInt(mappedData.semester, 'Semester', 1, 16);
        } catch (e) {
          addErr('semester', 'invalid_type', (e as Error).message, 'Enter integer 1–16.');
        }
      }
      if (homeRoom && !existingAllRoomsByCode.has(homeRoom)) {
        addErr('homeRoom', 'invalid_fk', `Home room "${homeRoom}" does not exist.`, 'Import rooms/labs first or clear home_room.');
      }

      if (code) {
        const dupKey = `batch:${code}`;
        if (inFileKeys.has(dupKey)) {
          duplicateRows++;
          if (duplicateMode === 'stop') addErr('code', 'duplicate', `Duplicate batch "${code}" on row ${inFileKeys.get(dupKey)}.`, 'Remove duplicate row or choose Skip/Update.');
          else if (duplicateMode === 'skip') { action = 'skip'; addWarn('code', `Duplicate in CSV (line ${inFileKeys.get(dupKey)}); skipped.`); }
        } else inFileKeys.set(dupKey, rowNumber);

        const ex = existingGroupsByCode.get(code);
        if (errors.length === 0 && ex && action !== 'skip') {
          duplicateRows++;
          if (duplicateMode === 'stop') addErr('code', 'duplicate', `Batch "${code}" already exists.`, 'Switch duplicate handling to Skip or Update.');
          else if (duplicateMode === 'skip') { action = 'skip'; addWarn('code', `Batch "${code}" already exists; skipped.`); }
          else {
            action = 'update';
            const diffs = [
              ...(ex.name !== name ? [{ field: 'name', label: 'Batch Name', before: ex.name, after: name }] : []),
              ...(ex.size !== size ? [{ field: 'size', label: 'Student Count', before: ex.size, after: size }] : [])
            ];
            fieldDiffs.push({ row: rowNumber, identifier: code, entity: 'Batch & Section', diffs });
          }
        } else if (errors.length === 0 && action === 'create') {
          stagedGroupCodes.add(code);
        }
      }
    } else if (category === 'enrollments') {
      const courseCode = (mappedData.courseCode || '').toUpperCase();
      const batchCode = (mappedData.batchCode || '').toUpperCase();
      const section = (mappedData.section || 'A').toUpperCase();
      const regNo = (mappedData.studentRegistrationNumber || '').toUpperCase();
      identifier = `${courseCode || '?'} -> ${batchCode || '?'}-${section}`;

      if (!courseCode) addErr('courseCode', 'missing_required', 'Course code is required.', 'Enter existing course code.');
      else if (!stagedCourseCodes.has(courseCode)) addErr('courseCode', 'invalid_fk', `Course "${courseCode}" does not exist.`, 'Import courses first.');

      if (!batchCode) addErr('batchCode', 'missing_required', 'Batch code is required.', 'Enter existing batch code.');
      else if (!stagedGroupCodes.has(batchCode)) addErr('batchCode', 'invalid_fk', `Batch "${batchCode}" does not exist.`, 'Import batches/sections first.');

      if (courseCode && batchCode) {
        const dupKey = `enr:${courseCode}:${batchCode}:${section}:${regNo}`;
        if (inFileKeys.has(dupKey)) {
          duplicateRows++;
          if (duplicateMode === 'stop') addErr('courseCode', 'duplicate', `Duplicate enrollment (${identifier}) on row ${inFileKeys.get(dupKey)}.`, 'Remove duplicate row.');
          else if (duplicateMode === 'skip') { action = 'skip'; addWarn('courseCode', `Duplicate enrollment in CSV; skipped.`); }
        } else inFileKeys.set(dupKey, rowNumber);
      }
    } else if (category === 'course_assignments') {
      const courseCode = (mappedData.courseCode || '').toUpperCase();
      const batchCode = (mappedData.batchCode || '').toUpperCase();
      const sectionCode = (mappedData.sectionCode || 'A').toUpperCase();
      const instRaw = mappedData.instructor || '';
      const engRaw = mappedData.labEngineer || '';
      const sessType = mappedData.sessionType || 'Theory';
      identifier = `${courseCode || '?'}/${batchCode || '?'}-${sectionCode}`;

      if (!courseCode) addErr('courseCode', 'missing_required', 'Course code is required.', 'Enter existing course code.');
      else if (!stagedCourseCodes.has(courseCode)) addErr('courseCode', 'invalid_fk', `Course "${courseCode}" does not exist.`, 'Import courses first.');

      if (!batchCode) addErr('batchCode', 'missing_required', 'Batch code is required.', 'Enter existing batch code.');
      else if (!stagedGroupCodes.has(batchCode)) addErr('batchCode', 'invalid_fk', `Batch "${batchCode}" does not exist.`, 'Import batches first.');

      if (!instRaw) addErr('instructor', 'missing_required', 'Instructor is required.', 'Provide instructor email or name.');
      else if (!hasInst(instRaw)) addErr('instructor', 'invalid_fk', `Instructor "${instRaw}" not found.`, 'Import instructors first.');

      if (engRaw && !hasInst(engRaw)) addErr('labEngineer', 'invalid_fk', `Lab engineer "${engRaw}" not found.`, 'Import instructors first.');

      if (sessType && !['theory', 'lecture', 'lab', 'tutorial'].includes(sessType.toLowerCase())) {
        addErr('sessionType', 'invalid_type', `Invalid session type "${sessType}".`, 'Use Theory, Lab, or Tutorial.');
      }
      if (mappedData.sessionsPerWeek) {
        try {
          parseStrictInt(mappedData.sessionsPerWeek, 'Sessions per week', 1, 6);
        } catch (e) {
          addErr('sessionsPerWeek', 'invalid_type', (e as Error).message, 'Enter integer 1–6.');
        }
      }
      if (mappedData.durationMinutes) {
        try {
          parseStrictInt(mappedData.durationMinutes, 'Duration minutes', 30, 300);
        } catch (e) {
          addErr('durationMinutes', 'invalid_type', (e as Error).message, 'Enter integer 30–300.');
        }
      }
      if (mappedData.expectedStudents) {
        try {
          parseStrictInt(mappedData.expectedStudents, 'Expected students', 1, 1000);
        } catch (e) {
          addErr('expectedStudents', 'invalid_type', (e as Error).message, 'Enter integer 1–1000.');
        }
      }

      if (courseCode && batchCode) {
        const normType = sessType.toLowerCase() === 'lab' ? 'lab' : 'lecture';
        const secKey = `${courseCode}::${batchCode}::${sectionCode}::${normType}`;
        const dupKey = `assign:${secKey}`;
        if (inFileKeys.has(dupKey)) {
          duplicateRows++;
          if (duplicateMode === 'stop') addErr('courseCode', 'duplicate', `Duplicate assignment (${identifier}) on row ${inFileKeys.get(dupKey)}.`, 'Remove duplicate row.');
          else if (duplicateMode === 'skip') { action = 'skip'; addWarn('courseCode', `Duplicate assignment in CSV; skipped.`); }
        } else inFileKeys.set(dupKey, rowNumber);

        const ex = existingSectionsByKey.get(secKey);
        if (errors.length === 0 && ex && action !== 'skip') {
          duplicateRows++;
          if (duplicateMode === 'stop') addErr('courseCode', 'duplicate', `Assignment ${identifier} already exists.`, 'Select Skip or Update.');
          else if (duplicateMode === 'skip') { action = 'skip'; addWarn('courseCode', `Assignment already exists; skipped.`); }
          else {
            action = 'update';
            const oldInstName = storeSnapshot.instructors.find(i => i.id === ex.instructorId)?.name || ex.instructorId;
            fieldDiffs.push({
              row: rowNumber,
              identifier,
              entity: 'Course Assignment',
              diffs: oldInstName !== instRaw ? [{ field: 'instructor', label: 'Instructor', before: oldInstName, after: instRaw }] : []
            });
          }
        }
      }
    } else if (category === 'all') {
      const hasAnyId = Boolean(
        mappedData.deptCode ||
          mappedData.roomCode ||
          mappedData.courseCode ||
          mappedData.instructorName ||
          mappedData.instructorEmail ||
          mappedData.cohortCode ||
          mappedData.batchCode
      );
      identifier = mappedData.courseCode || mappedData.roomCode || mappedData.cohortCode || mappedData.batchCode || mappedData.instructorEmail || mappedData.deptCode || identifier;
      if (!hasAnyId) {
        addErr('courseCode', 'missing_required', 'Row has no department, room, course, instructor, or batch/cohort value.', 'Populate at least one entity.');
      }
      if (mappedData.roomCapacity) {
        try {
          parseStrictInt(mappedData.roomCapacity, 'Room capacity', 1, 2000);
        } catch (e) {
          addErr('roomCapacity', 'invalid_type', (e as Error).message, 'Enter integer 1–2000.');
        }
      }
      if (mappedData.floor) {
        try {
          parseStrictInt(mappedData.floor, 'Floor', -5, 100);
        } catch (e) {
          addErr('floor', 'invalid_type', (e as Error).message, 'Enter integer -5–100.');
        }
      }
      if (mappedData.cohortSize) {
        try {
          parseStrictInt(mappedData.cohortSize, 'Cohort size', 1, 1000);
        } catch (e) {
          addErr('cohortSize', 'invalid_type', (e as Error).message, 'Enter integer 1–1000.');
        }
      }
      if (mappedData.year) {
        try {
          parseStrictInt(mappedData.year, 'Academic year', 1, 8);
        } catch (e) {
          addErr('year', 'invalid_type', (e as Error).message, 'Enter integer 1–8.');
        }
      }
      if (mappedData.semester) {
        try {
          parseStrictInt(mappedData.semester, 'Semester', 1, 16);
        } catch (e) {
          addErr('semester', 'invalid_type', (e as Error).message, 'Enter integer 1–16.');
        }
      }
      if (mappedData.instructorEmail && !EMAIL_REGEX.test(mappedData.instructorEmail)) {
        addErr('instructorEmail', 'invalid_type', `Invalid email "${mappedData.instructorEmail}".`, 'Provide valid email.');
      }
      if (mappedData.maxWeeklyHours) {
        try {
          parseStrictInt(mappedData.maxWeeklyHours, 'Max weekly hours', 1, 45);
        } catch (e) {
          addErr('maxWeeklyHours', 'invalid_type', (e as Error).message, 'Enter integer 1–45.');
        }
      }
      if (mappedData.maxDailyClasses) {
        try {
          parseStrictInt(mappedData.maxDailyClasses, 'Max daily classes', 1, 10);
        } catch (e) {
          addErr('maxDailyClasses', 'invalid_type', (e as Error).message, 'Enter integer 1–10.');
        }
      }
      if (mappedData.isElective) {
        try {
          parseStrictBool(mappedData.isElective, false);
        } catch (e) {
          addErr('isElective', 'invalid_type', (e as Error).message, 'Use yes/no or true/false.');
        }
      }
      if (mappedData.isCompulsory) {
        try {
          parseStrictBool(mappedData.isCompulsory, true);
        } catch (e) {
          addErr('isCompulsory', 'invalid_type', (e as Error).message, 'Use yes/no or true/false.');
        }
      }
      if (mappedData.roomIsAvailable) {
        try {
          parseStrictBool(mappedData.roomIsAvailable, true);
        } catch (e) {
          addErr('roomIsAvailable', 'invalid_type', (e as Error).message, 'Use yes/no or true/false.');
        }
      }
      if (mappedData.sessionsPerWeek) {
        try {
          parseStrictInt(mappedData.sessionsPerWeek, 'Sessions per week', 1, 6);
        } catch (e) {
          addErr('sessionsPerWeek', 'invalid_type', (e as Error).message, 'Enter integer 1–6.');
        }
      }
      if (mappedData.durationMinutes) {
        try {
          parseStrictInt(mappedData.durationMinutes, 'Duration minutes', 30, 300);
        } catch (e) {
          addErr('durationMinutes', 'invalid_type', (e as Error).message, 'Enter integer 30–300.');
        }
      }
      if (mappedData.expectedStudents) {
        try {
          parseStrictInt(mappedData.expectedStudents, 'Expected students', 1, 1000);
        } catch (e) {
          addErr('expectedStudents', 'invalid_type', (e as Error).message, 'Enter integer 1–1000.');
        }
      }
    }

    let status: ValidatedRowStatus = 'ready';
    if (errors.length > 0) {
      status = 'error';
      action = 'failed';
      errorRows++;
    } else if (action === 'skip') {
      status = 'duplicate_skip';
      skipCount++;
      if (warnings.length > 0) warningRows++;
    } else if (action === 'update') {
      status = 'duplicate_update';
      updateCount++;
      if (warnings.length > 0) warningRows++;
    } else {
      status = warnings.length > 0 ? 'warning' : 'ready';
      createCount++;
      if (warnings.length > 0) warningRows++;
    }

    validatedRows.push({
      rowNumber,
      identifier,
      status,
      action,
      originalData,
      mappedData,
      errors,
      warnings
    });
  });

  const canProceed =
    duplicateMode === 'stop'
      ? errorRows === 0
      : createCount + updateCount > 0 || errorRows === 0;

  let blockingReason: string | null = null;
  if (duplicateMode === 'stop' && errorRows > 0) {
    blockingReason = `${errorRows} row(s) have blocking errors or duplicate conflicts under Stop & Resolve mode.`;
  } else if (createCount + updateCount === 0 && errorRows > 0) {
    blockingReason = 'All rows failed validation; fix the highlighted errors or download the Error CSV.';
  }

  return {
    category,
    duplicateMode,
    headers,
    mappingInfo,
    canProceed,
    blockingReason,
    summary: {
      totalRows: rows.length,
      validRows: createCount + updateCount,
      warningRows,
      errorRows,
      duplicateRows,
      createCount,
      updateCount,
      skipCount,
      missingRequiredCount,
      invalidTypeCount,
      invalidFkCount
    },
    rows: validatedRows,
    fieldDiffs
  };
}

export function buildErrorReportCsv(headers: string[], rows: ValidatedRow[]): string {
  const escape = (v: unknown) => {
    const str = String(v ?? '');
    if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  const headerLine = ['row_number', 'status', 'error_columns', 'problem', 'suggested_correction', ...headers]
    .map(escape)
    .join(',');
  const errorLines = rows
    .filter(r => r.status === 'error' || r.errors.length > 0)
    .map(r => {
      const cols = Array.from(new Set(r.errors.map(e => e.column).filter(Boolean))).join('; ');
      const problems = r.errors.map(e => e.message).join(' | ');
      const fixes = Array.from(new Set(r.errors.map(e => e.suggestion).filter(Boolean))).join(' | ');
      return [
        r.rowNumber,
        r.status,
        cols,
        problems,
        fixes,
        ...headers.map(h => r.originalData[h] ?? '')
      ]
        .map(escape)
        .join(',');
    });
  return [headerLine, ...errorLines].join('\n') + '\n';
}

export function buildStorePayloadFromValidatedRows(report: ValidationReport): {
  duplicateMode: DuplicateHandlingMode;
  departments: Array<{ code: string; name: string; school?: string; subDepartments?: string[] }>;
  rooms: Array<{ code: string; name?: string; capacity: number; type: RoomType; buildingName?: string; equipment?: string[]; isAvailable?: boolean; assignedLabEngineerKey?: string }>;
  laboratories: Array<{ code: string; name: string; capacity: number; buildingName?: string; labCategory?: string; departmentKey?: string; assignedLabEngineerKey?: string; equipment?: string[]; isAvailable?: boolean }>;
  courses: Array<{ code: string; title: string; creditHours?: number; lectureCredits?: number; labCredits?: number; isElective?: boolean; electivePoolName?: string; departmentKey?: string; subDepartment?: string; assignedInstructorKey?: string; assignedLabEngineerKey?: string; requiredRoomType?: RoomType; labSessionMode?: 'continuous' | 'split_allowed' }>;
  instructors: Array<{ name: string; email: string; title?: string; staffRole?: StaffRole; subDepartment?: string; qualifiedCourseCodes?: string[]; maxWeeklyHours?: number; departmentKey?: string }>;
  cohorts: Array<{ code: string; name?: string; batchCode?: string; section?: string; size?: number; year?: number; semester?: number; homeRoom?: string; departmentKey?: string }>;
  enrollments: Array<{ courseCode: string; batchCode: string; section?: string }>;
  courseAssignments: Array<{ courseCode: string; batchCode: string; sectionCode?: string; instructorKey: string; labEngineerKey?: string; sessionType?: 'Lecture' | 'Lab'; sessionsPerWeek?: number; expectedStudents?: number }>;
} {
  const departments: Array<{ code: string; name: string; school?: string; subDepartments?: string[] }> = [];
  const rooms: Array<{ code: string; name?: string; capacity: number; type: RoomType; buildingName?: string; equipment?: string[]; isAvailable?: boolean; assignedLabEngineerKey?: string }> = [];
  const laboratories: Array<{ code: string; name: string; capacity: number; buildingName?: string; labCategory?: string; departmentKey?: string; assignedLabEngineerKey?: string; equipment?: string[]; isAvailable?: boolean }> = [];
  const courses: Array<{ code: string; title: string; creditHours?: number; lectureCredits?: number; labCredits?: number; isElective?: boolean; electivePoolName?: string; departmentKey?: string; subDepartment?: string; assignedInstructorKey?: string; assignedLabEngineerKey?: string; requiredRoomType?: RoomType; labSessionMode?: 'continuous' | 'split_allowed' }> = [];
  const instructors: Array<{ name: string; email: string; title?: string; staffRole?: StaffRole; subDepartment?: string; qualifiedCourseCodes?: string[]; maxWeeklyHours?: number; departmentKey?: string }> = [];
  const cohorts: Array<{ code: string; name?: string; batchCode?: string; section?: string; size?: number; year?: number; semester?: number; homeRoom?: string; departmentKey?: string }> = [];
  const enrollments: Array<{ courseCode: string; batchCode: string; section?: string }> = [];
  const courseAssignments: Array<{ courseCode: string; batchCode: string; sectionCode?: string; instructorKey: string; labEngineerKey?: string; sessionType?: 'Lecture' | 'Lab'; sessionsPerWeek?: number; expectedStudents?: number }> = [];

  report.rows
    .filter(r => r.action === 'create' || r.action === 'update')
    .forEach(r => {
      const m = r.mappedData;
      if (report.category === 'departments') {
        departments.push({
          code: (m.code || '').toUpperCase(),
          name: m.name || '',
          school: m.school || undefined,
          subDepartments: m.subDepartments ? splitList(m.subDepartments) : undefined
        });
      } else if (report.category === 'rooms') {
        const rawT = (m.type || 'lecture').toLowerCase();
        const type: RoomType = rawT === 'seminar' ? 'seminar' : 'lecture';
        rooms.push({
          code: (m.code || '').toUpperCase(),
          name: m.name || undefined,
          capacity: Number(m.capacity) || 60,
          type,
          buildingName: m.building || undefined,
          equipment: m.equipment ? splitList(m.equipment) : undefined,
          isAvailable: m.isAvailable ? ['true', 'yes', '1', 'y'].includes(m.isAvailable.toLowerCase()) : true
        });
      } else if (report.category === 'laboratories') {
        laboratories.push({
          code: (m.code || '').toUpperCase(),
          name: m.name || m.code || '',
          capacity: Number(m.capacity) || 40,
          buildingName: m.building || undefined,
          labCategory: m.labCategory || 'Computing',
          departmentKey: m.departmentCode || undefined,
          assignedLabEngineerKey: m.assignedLabEngineer || undefined,
          equipment: m.equipment ? splitList(m.equipment) : undefined,
          isAvailable: m.isAvailable ? ['true', 'yes', '1', 'y'].includes(m.isAvailable.toLowerCase()) : true
        });
      } else if (report.category === 'instructors') {
        const roleRaw = (m.staffRole || 'faculty').toLowerCase();
        const staffRole: StaffRole = roleRaw.includes('lab') || roleRaw.includes('eng') ? 'lab_engineer' : 'faculty';
        instructors.push({
          name: m.name || '',
          email: (m.email || '').toLowerCase(),
          title: m.title || undefined,
          staffRole,
          subDepartment: m.subDepartment || undefined,
          qualifiedCourseCodes: m.qualifiedCourses ? splitList(m.qualifiedCourses) : undefined,
          maxWeeklyHours: m.maxWeeklyHours ? Number(m.maxWeeklyHours) : undefined,
          departmentKey: m.departmentCode || undefined
        });
      } else if (report.category === 'courses') {
        const lecCr = m.lectureCredits ? Number(m.lectureCredits) : undefined;
        const labCr = m.labCredits ? Number(m.labCredits) : undefined;
        const isElec = m.isElective
          ? ['true', 'yes', '1', 'y'].includes(m.isElective.toLowerCase())
          : m.isCompulsory
          ? !['true', 'yes', '1', 'y'].includes(m.isCompulsory.toLowerCase())
          : false;
        courses.push({
          code: (m.code || '').toUpperCase(),
          title: m.title || '',
          creditHours: m.creditHours ? Number(m.creditHours) : undefined,
          lectureCredits: lecCr,
          labCredits: labCr,
          isElective: isElec,
          electivePoolName: m.electivePoolName || undefined,
          departmentKey: m.departmentCode || undefined,
          subDepartment: m.subDepartment || undefined,
          assignedInstructorKey: m.assignedInstructor || undefined,
          assignedLabEngineerKey: m.assignedLabEngineer || undefined,
          requiredRoomType: m.courseType?.toLowerCase() === 'lab' ? 'lab' : 'lecture',
          labSessionMode: m.labSessionMode?.toLowerCase() === 'split_allowed' ? 'split_allowed' : 'continuous'
        });
      } else if (report.category === 'cohorts') {
        cohorts.push({
          code: (m.code || '').toUpperCase(),
          name: m.name || undefined,
          batchCode: m.batchCode ? m.batchCode.toUpperCase() : undefined,
          section: m.section ? m.section.toUpperCase() : undefined,
          size: Number(m.size) || 45,
          year: m.year ? Number(m.year) : undefined,
          semester: m.semester ? Number(m.semester) : undefined,
          homeRoom: m.homeRoom || undefined,
          departmentKey: m.departmentCode || undefined
        });
      } else if (report.category === 'enrollments') {
        enrollments.push({
          courseCode: (m.courseCode || '').toUpperCase(),
          batchCode: (m.batchCode || '').toUpperCase(),
          section: (m.section || 'A').toUpperCase()
        });
      } else if (report.category === 'course_assignments') {
        const isLab = (m.sessionType || '').toLowerCase() === 'lab';
        courseAssignments.push({
          courseCode: (m.courseCode || '').toUpperCase(),
          batchCode: (m.batchCode || '').toUpperCase(),
          sectionCode: (m.sectionCode || 'A').toUpperCase(),
          instructorKey: m.instructor || '',
          labEngineerKey: m.labEngineer || undefined,
          sessionType: isLab ? 'Lab' : 'Lecture',
          sessionsPerWeek: m.sessionsPerWeek ? Number(m.sessionsPerWeek) : undefined,
          expectedStudents: m.expectedStudents ? Number(m.expectedStudents) : undefined
        });
      } else if (report.category === 'all') {
        if (m.deptCode) {
          departments.push({
            code: m.deptCode.toUpperCase(),
            name: m.deptName || m.deptCode,
            school: m.school || undefined,
            subDepartments: m.subDepartments ? splitList(m.subDepartments) : undefined
          });
        }
        if (m.roomCode) {
          const isLab = (m.roomType || '').toLowerCase().includes('lab') || m.roomCode.toLowerCase().includes('lab') || Boolean(m.labCategory && !m.roomType);
          rooms.push({
            code: m.roomCode.toUpperCase(),
            name: m.roomName || m.roomCode,
            capacity: Number(m.roomCapacity) || 50,
            type: isLab ? 'lab' : (m.roomType?.toLowerCase() === 'seminar' ? 'seminar' : 'lecture'),
            buildingName: m.building || undefined,
            equipment: m.equipment ? splitList(m.equipment) : undefined,
            isAvailable: m.roomIsAvailable ? ['true', 'yes', '1', 'y'].includes(m.roomIsAvailable.toLowerCase()) : true,
            assignedLabEngineerKey: m.roomLabEngineer || undefined
          });
        }
        if (m.instructorName || m.instructorEmail) {
          const name = m.instructorName || m.instructorEmail.split('@')[0];
          const email = (m.instructorEmail || `${name.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@university.edu`).toLowerCase();
          instructors.push({
            name,
            email,
            title: m.instructorTitle || undefined,
            staffRole: (m.staffRole || '').toLowerCase().includes('lab') ? 'lab_engineer' : 'faculty',
            subDepartment: m.instructorSubDepartment || undefined,
            qualifiedCourseCodes: m.qualifiedCourses ? splitList(m.qualifiedCourses) : undefined,
            maxWeeklyHours: m.maxWeeklyHours ? Number(m.maxWeeklyHours) : undefined,
            departmentKey: m.deptCode || undefined
          });
        }
        if (m.courseCode) {
          const isElec = m.isElective
            ? ['true', 'yes', '1', 'y'].includes(m.isElective.toLowerCase())
            : m.isCompulsory
            ? !['true', 'yes', '1', 'y'].includes(m.isCompulsory.toLowerCase())
            : false;
          courses.push({
            code: m.courseCode.toUpperCase(),
            title: m.courseTitle || m.courseCode,
            creditHours: m.creditHours ? Number(m.creditHours) : undefined,
            lectureCredits: m.lectureCredits ? Number(m.lectureCredits) : undefined,
            labCredits: m.labCredits ? Number(m.labCredits) : undefined,
            isElective: isElec,
            electivePoolName: m.electivePoolName || undefined,
            departmentKey: m.deptCode || undefined,
            subDepartment: m.courseSubDepartment || undefined,
            assignedInstructorKey: m.assignedInstructor || m.instructorEmail || undefined,
            assignedLabEngineerKey: m.assignedLabEngineer || undefined,
            requiredRoomType: m.courseType?.toLowerCase() === 'lab' ? 'lab' : 'lecture',
            labSessionMode: m.labSessionMode?.toLowerCase() === 'split_allowed' ? 'split_allowed' : 'continuous'
          });
        }
        const cohortRaw = (m.cohortCode || '').toUpperCase();
        const batchRaw = (m.batchCode || '').toUpperCase();
        const secRaw = (m.section || '').toUpperCase();
        const resolvedCohort =
          cohortRaw ||
          (batchRaw
            ? batchRaw.includes('-') && batchRaw.split('-').length >= 3
              ? batchRaw
              : `${batchRaw}${m.deptCode && !batchRaw.includes('-') ? `-${m.deptCode.toUpperCase()}` : ''}-${secRaw || 'A'}`
            : '');
        if (resolvedCohort) {
          cohorts.push({
            code: resolvedCohort,
            name: m.cohortName || undefined,
            batchCode: batchRaw || (resolvedCohort.includes('-') ? resolvedCohort.split('-')[0] : resolvedCohort),
            section: secRaw || (resolvedCohort.includes('-') ? resolvedCohort.split('-').slice(-1)[0] : 'A'),
            size: m.cohortSize ? Number(m.cohortSize) : 45,
            year: m.year ? Number(m.year) : undefined,
            semester: m.semester ? Number(m.semester) : undefined,
            homeRoom: m.homeRoom || undefined,
            departmentKey: m.deptCode || undefined
          });
        }
        if (m.courseCode && resolvedCohort) {
          enrollments.push({
            courseCode: m.courseCode.toUpperCase(),
            batchCode: resolvedCohort,
            section: secRaw || 'A'
          });
          const assignInst = m.assignedInstructor || m.instructorEmail || m.instructorName;
          if (assignInst || m.sessionType || m.sessionsPerWeek) {
            courseAssignments.push({
              courseCode: m.courseCode.toUpperCase(),
              batchCode: resolvedCohort,
              sectionCode: secRaw || 'A',
              instructorKey: assignInst || '',
              labEngineerKey: m.assignedLabEngineer || undefined,
              sessionType: (m.sessionType || '').toLowerCase() === 'lab' ? 'Lab' : 'Lecture',
              sessionsPerWeek: m.sessionsPerWeek ? Number(m.sessionsPerWeek) : undefined,
              expectedStudents: m.expectedStudents ? Number(m.expectedStudents) : undefined
            });
          }
        }
      }
    });

  return {
    duplicateMode: report.duplicateMode,
    departments,
    rooms,
    laboratories,
    courses,
    instructors,
    cohorts,
    enrollments,
    courseAssignments
  };
}
