import React, { useState, useRef } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import ExcelJS from 'exceljs';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Download,
  X,
  Check,
  Layers
} from 'lucide-react';
import { institutionalStore } from '../data/store';
import { RoomType, StaffRole } from '../types/institutional';

export type ImportCategory =
  | 'all'
  | 'departments'
  | 'rooms'
  | 'courses'
  | 'instructors'
  | 'cohorts';

interface DataImportWizardProps {
  onClose?: () => void;
  onSuccess?: (summary: string) => void;
  defaultCategory?: ImportCategory;
}

interface FieldDef {
  key: string;
  label: string;
  group: string;
  sample: string;
  synonyms: string[];
}

interface ParsedRow {
  index: number;
  data: Record<string, string>;
  extractedSummary: string[];
  errors: string[];
  isValid: boolean;
}

interface ExtractedPayload {
  departments: Array<{ code: string; name: string; school?: string; subDepartments?: string[] }>;
  rooms: Array<{
    code: string;
    name?: string;
    capacity: number;
    type: RoomType;
    buildingName?: string;
    equipment?: string[];
  }>;
  courses: Array<{
    code: string;
    title: string;
    creditHours?: number;
    lectureCredits?: number;
    labCredits?: number;
    weeklyContactHours?: number;
    isLab?: boolean;
    requiredRoomType?: RoomType;
    departmentKey?: string;
    subDepartment?: string;
    isElective?: boolean;
    electivePoolName?: string;
  }>;
  instructors: Array<{
    name: string;
    email?: string;
    title?: string;
    staffRole?: StaffRole;
    subDepartment?: string;
    qualifiedCourseCodes?: string[];
    maxWeeklyHours?: number;
    departmentKey?: string;
  }>;
  cohorts: Array<{
    code: string;
    name?: string;
    batchCode?: string;
    section?: string;
    size?: number;
    year?: number;
    semester?: number;
    homeRoom?: string;
    departmentKey?: string;
  }>;
  sectionLinks: Array<{
    courseCode: string;
    cohortCode: string;
    instructorName?: string;
    isLab?: boolean;
  }>;
}

const CALM_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const ALL_IN_ONE_FIELDS: FieldDef[] = [
  // Record classification (optional, for mixed stacked CSVs)
  {
    key: 'recordType',
    label: 'Row Entity Type (optional)',
    group: 'Row Classifier',
    sample: '',
    synonyms: ['record_type', 'entity_type', 'category', 'entity', 'kind', 'table', 'section_type']
  },
  {
    key: 'genericCode',
    label: 'Generic Code / ID (if mixed rows)',
    group: 'Row Classifier',
    sample: '',
    synonyms: ['generic_code', 'entity_code', 'record_code']
  },
  {
    key: 'genericName',
    label: 'Generic Name / Title (if mixed rows)',
    group: 'Row Classifier',
    sample: '',
    synonyms: ['generic_name', 'entity_name', 'record_name']
  },
  // Departments
  {
    key: 'deptCode',
    label: 'Department Code',
    group: 'Departments',
    sample: 'CS',
    synonyms: ['dept_code', 'department_code', 'dept', 'department']
  },
  {
    key: 'deptName',
    label: 'Department Name',
    group: 'Departments',
    sample: 'Computer Science',
    synonyms: ['dept_name', 'department_name', 'school_department', 'faculty_dept']
  },
  {
    key: 'school',
    label: 'School / Division',
    group: 'Departments',
    sample: 'School of Computing',
    synonyms: ['school', 'division', 'college', 'faculty_school']
  },
  {
    key: 'subDepartment',
    label: 'Sub-Department / Wing',
    group: 'Departments',
    sample: 'AI & Data Systems',
    synonyms: ['sub_department', 'subdepartment', 'sub_dept', 'subdept', 'specialization', 'wing', 'unit', 'track', 'sub_departments']
  },
  // Rooms & Labs
  {
    key: 'roomCode',
    label: 'Room / Lab Code',
    group: 'Rooms & Labs',
    sample: 'HALL-101',
    synonyms: ['room_code', 'room', 'classroom', 'hall', 'room_no', 'room_number', 'lab_code', 'facility_code']
  },
  {
    key: 'roomName',
    label: 'Room / Facility Name',
    group: 'Rooms & Labs',
    sample: 'Turing Lecture Hall',
    synonyms: ['room_name', 'facility', 'facility_name', 'hall_name']
  },
  {
    key: 'roomCapacity',
    label: 'Room Capacity',
    group: 'Rooms & Labs',
    sample: '60',
    synonyms: ['room_capacity', 'capacity', 'seats', 'max_students', 'cap']
  },
  {
    key: 'roomType',
    label: 'Room Type (lecture/lab)',
    group: 'Rooms & Labs',
    sample: 'lecture',
    synonyms: ['room_type', 'facility_type', 'room_kind']
  },
  {
    key: 'building',
    label: 'Building Name',
    group: 'Rooms & Labs',
    sample: 'Science Complex',
    synonyms: ['building', 'bld', 'building_name', 'block', 'location']
  },
  {
    key: 'equipment',
    label: 'Equipment List',
    group: 'Rooms & Labs',
    sample: 'Projector, Whiteboard',
    synonyms: ['equipment', 'features', 'facilities', 'amenities', 'resources']
  },
  // Courses
  {
    key: 'courseCode',
    label: 'Course Code',
    group: 'Courses',
    sample: 'CS-101',
    synonyms: ['course_code', 'course', 'course_id', 'subject_code', 'course_no', 'subject_id']
  },
  {
    key: 'courseTitle',
    label: 'Course Title',
    group: 'Courses',
    sample: 'Introduction to Computing',
    synonyms: ['course_title', 'course_name', 'subject', 'subject_name', 'subject_title']
  },
  {
    key: 'creditHours',
    label: 'Credit Hours',
    group: 'Courses',
    sample: '3',
    synonyms: ['credit_hours', 'credits', 'credit', 'cr_hrs', 'cr', 'units']
  },
  {
    key: 'lectureCredits',
    label: 'Lecture Credits (1cr = 1h)',
    group: 'Courses',
    sample: '3',
    synonyms: ['lecture_credits', 'theory_credits', 'lec_credits', 'lec_cr', 'theory_cr']
  },
  {
    key: 'labCredits',
    label: 'Lab Credits (1cr = 3h Lab)',
    group: 'Courses',
    sample: '1',
    synonyms: ['lab_credits', 'practical_credits', 'lab_cr', 'practical_cr']
  },
  {
    key: 'weeklyHours',
    label: 'Weekly Contact Hours',
    group: 'Courses',
    sample: '3',
    synonyms: ['weekly_hours', 'contact_hours', 'hours_per_week', 'weekly_contact_hours', 'hours']
  },
  {
    key: 'isLab',
    label: 'Is Lab Course (yes/no)',
    group: 'Courses',
    sample: 'no',
    synonyms: ['is_lab', 'lab', 'practical', 'is_practical']
  },
  {
    key: 'isElective',
    label: 'Is Elective (yes/no)',
    group: 'Courses',
    sample: 'no',
    synonyms: ['is_elective', 'elective', 'optional_course']
  },
  {
    key: 'electivePoolName',
    label: 'Elective Pool Name',
    group: 'Courses',
    sample: 'AI & Security Track',
    synonyms: ['elective_pool', 'elective_pool_name', 'elective_group', 'pool_name']
  },
  // Faculty / Instructors & Lab Engineers
  {
    key: 'instructorName',
    label: 'Instructor / Lab Eng. Name',
    group: 'Faculty',
    sample: 'Dr. Ayesha Khan',
    synonyms: [
      'instructor_name',
      'instructor',
      'faculty_name',
      'faculty',
      'professor',
      'teacher',
      'lecturer',
      'teacher_name',
      'prof',
      'lab_engineer'
    ]
  },
  {
    key: 'instructorEmail',
    label: 'Instructor Email',
    group: 'Faculty',
    sample: 'ayesha.khan@university.edu',
    synonyms: ['instructor_email', 'faculty_email', 'email', 'email_address', 'mail', 'teacher_email']
  },
  {
    key: 'instructorTitle',
    label: 'Academic Rank / Title',
    group: 'Faculty',
    sample: 'Associate Professor',
    synonyms: ['instructor_title', 'designation', 'rank', 'position', 'role']
  },
  {
    key: 'staffRole',
    label: 'Staff Role (faculty/lab_engineer)',
    group: 'Faculty',
    sample: 'faculty',
    synonyms: ['staff_role', 'role_type', 'instructor_role', 'teacher_type']
  },
  {
    key: 'qualifiedCourses',
    label: 'Qualified Course Codes',
    group: 'Faculty',
    sample: 'CS-101; CS-201',
    synonyms: ['qualified_courses', 'eligible_courses', 'qualified_subjects', 'subjects', 'can_teach']
  },
  {
    key: 'maxWeeklyHours',
    label: 'Max Weekly Hours',
    group: 'Faculty',
    sample: '12',
    synonyms: ['max_weekly_hours', 'max_hours', 'weekly_cap', 'workload_cap', 'max_teaching_hours']
  },
  // Cohorts / Batches & Sections
  {
    key: 'cohortCode',
    label: 'Cohort / Section Code',
    group: 'Cohorts & Batches',
    sample: '2K24-BSCS-A',
    synonyms: [
      'cohort_code',
      'section_code',
      'cohort',
      'group',
      'student_group',
      'class',
      'class_code'
    ]
  },
  {
    key: 'batchCode',
    label: 'Batch Name (e.g. 2K24)',
    group: 'Cohorts & Batches',
    sample: '2K24',
    synonyms: ['batch', 'batch_code', 'batch_name', 'intake']
  },
  {
    key: 'sectionLetter',
    label: 'Section(s) (e.g. A or A,B,C)',
    group: 'Cohorts & Batches',
    sample: 'A, B, C',
    synonyms: ['section', 'sections', 'section_letter', 'sec']
  },
  {
    key: 'cohortName',
    label: 'Cohort / Section Name',
    group: 'Cohorts & Batches',
    sample: '2K24 BSCS Section A',
    synonyms: ['cohort_name', 'group_name', 'class_name']
  },
  {
    key: 'cohortSize',
    label: 'Enrollment Size',
    group: 'Cohorts & Batches',
    sample: '45',
    synonyms: ['cohort_size', 'enrollment', 'student_count', 'students', 'size', 'batch_size']
  },
  {
    key: 'cohortYear',
    label: 'Study Year (1-4)',
    group: 'Cohorts & Batches',
    sample: '2',
    synonyms: ['study_year', 'year', 'batch_year', 'academic_year']
  },
  {
    key: 'cohortSemester',
    label: 'Semester Number',
    group: 'Cohorts & Batches',
    sample: '3',
    synonyms: ['semester', 'sem', 'term_number']
  },
  {
    key: 'homeRoom',
    label: 'Home Classroom',
    group: 'Cohorts & Batches',
    sample: 'HALL-101',
    synonyms: ['home_room', 'default_room', 'homeroom']
  }
];

const CATEGORY_SCHEMAS: Record<
  Exclude<ImportCategory, 'all'>,
  {
    title: string;
    description: string;
    requiredFields: Array<{ key: string; label: string; sample: string; synonyms: string[] }>;
    optionalFields: Array<{ key: string; label: string; sample: string; synonyms: string[] }>;
  }
> = {
  departments: {
    title: 'Academic Departments',
    description: 'Academic departments, short codes, and parent schools or divisions.',
    requiredFields: [
      {
        key: 'code',
        label: 'Department Code',
        sample: 'CS',
        synonyms: ['code', 'dept_code', 'department_code', 'dept']
      },
      {
        key: 'name',
        label: 'Department Name',
        sample: 'Computer Science',
        synonyms: ['name', 'dept_name', 'department_name', 'department', 'title']
      }
    ],
    optionalFields: [
      {
        key: 'school',
        label: 'School / Faculty',
        sample: 'School of Computing',
        synonyms: ['school', 'division', 'college', 'faculty']
      },
      {
        key: 'subDepartments',
        label: 'Sub-Departments (semicolon/comma)',
        sample: 'AI & ML; Networks & Security',
        synonyms: ['sub_departments', 'subdepartments', 'sub_department', 'divisions', 'tracks', 'units']
      }
    ]
  },
  rooms: {
    title: 'Rooms & Laboratories',
    description: 'Classrooms, lecture halls, computer labs, and specialized workshops.',
    requiredFields: [
      {
        key: 'code',
        label: 'Room Code / Number',
        sample: 'HALL-101',
        synonyms: ['room', 'room_code', 'code', 'room_number', 'classroom', 'hall', 'room_no']
      },
      {
        key: 'capacity',
        label: 'Seating Capacity',
        sample: '60',
        synonyms: ['capacity', 'seats', 'size', 'max_students', 'cap']
      }
    ],
    optionalFields: [
      {
        key: 'name',
        label: 'Facility Name',
        sample: 'Turing Lecture Hall',
        synonyms: ['name', 'room_name', 'facility', 'description', 'title']
      },
      {
        key: 'type',
        label: 'Facility Type (lecture/lab/studio/seminar)',
        sample: 'lecture',
        synonyms: ['type', 'room_type', 'kind', 'category']
      },
      {
        key: 'building',
        label: 'Building Name',
        sample: 'Science Complex',
        synonyms: ['building', 'bld', 'building_name', 'block', 'location']
      },
      {
        key: 'equipment',
        label: 'Equipment / Facilities',
        sample: 'Projector, Audio',
        synonyms: ['equipment', 'features', 'facilities', 'amenities', 'resources']
      }
    ]
  },
  courses: {
    title: 'Courses & Curriculum',
    description: 'Academic subjects, course codes, credit hours, and lecture/lab breakdown.',
    requiredFields: [
      {
        key: 'code',
        label: 'Course Code',
        sample: 'CS-101',
        synonyms: ['code', 'course_code', 'course_id', 'subject_code', 'course_no', 'id']
      },
      {
        key: 'title',
        label: 'Course Title',
        sample: 'Introduction to Computing',
        synonyms: ['title', 'name', 'course_title', 'course_name', 'subject', 'description']
      }
    ],
    optionalFields: [
      {
        key: 'creditHours',
        label: 'Credit Hours',
        sample: '3',
        synonyms: ['credit_hours', 'credits', 'credit', 'cr_hrs', 'units']
      },
      {
        key: 'lectureCredits',
        label: 'Lecture Credits (1cr = 1h/wk)',
        sample: '3',
        synonyms: ['lecture_credits', 'theory_credits', 'lec_credits', 'lec_cr']
      },
      {
        key: 'labCredits',
        label: 'Lab Credits (1cr = 3h lab/wk)',
        sample: '1',
        synonyms: ['lab_credits', 'practical_credits', 'lab_cr', 'practical_cr']
      },
      {
        key: 'weeklyHours',
        label: 'Weekly Contact Hours',
        sample: '6',
        synonyms: [
          'weekly_hours',
          'contact_hours',
          'hours_per_week',
          'weekly_contact_hours',
          'duration',
          'hours'
        ]
      },
      {
        key: 'roomType',
        label: 'Required Room Type (lecture/lab)',
        sample: 'lecture',
        synonyms: ['room_type', 'required_room', 'room_kind', 'facility_type']
      },
      {
        key: 'department',
        label: 'Department Code / Name',
        sample: 'CS',
        synonyms: ['department', 'dept', 'dept_code', 'department_name']
      },
      {
        key: 'isLab',
        label: 'Is Practical Lab (yes/no)',
        sample: 'no',
        synonyms: ['is_lab', 'lab', 'practical', 'is_practical']
      },
      {
        key: 'isElective',
        label: 'Is Elective Course (yes/no)',
        sample: 'no',
        synonyms: ['is_elective', 'elective', 'optional']
      },
      {
        key: 'electivePoolName',
        label: 'Elective Pool / Track Name',
        sample: 'AI Track',
        synonyms: ['elective_pool', 'elective_pool_name', 'elective_group', 'pool_name']
      }
    ]
  },
  instructors: {
    title: 'Faculty & Lab Engineers',
    description: 'Professors, lecturers, lab engineers, sub-departments, and qualified subjects.',
    requiredFields: [
      {
        key: 'name',
        label: 'Full Name',
        sample: 'Dr. Ayesha Khan',
        synonyms: [
          'name',
          'instructor_name',
          'faculty_name',
          'full_name',
          'professor',
          'teacher',
          'instructor',
          'lecturer',
          'lab_engineer'
        ]
      }
    ],
    optionalFields: [
      {
        key: 'email',
        label: 'Email Address',
        sample: 'faculty@university.edu',
        synonyms: ['email', 'email_address', 'mail', 'institutional_email', 'instructor_email']
      },
      {
        key: 'title',
        label: 'Academic Title / Designation',
        sample: 'Associate Professor',
        synonyms: ['title', 'designation', 'rank', 'position', 'role']
      },
      {
        key: 'staffRole',
        label: 'Staff Role (faculty/lab_engineer)',
        sample: 'faculty',
        synonyms: ['staff_role', 'role_type', 'instructor_role', 'teacher_type']
      },
      {
        key: 'department',
        label: 'Department Code / Name',
        sample: 'CS',
        synonyms: ['department', 'dept', 'dept_code', 'department_name']
      },
      {
        key: 'subDepartment',
        label: 'Sub-Department / Wing',
        sample: 'AI & ML',
        synonyms: ['sub_department', 'subdepartment', 'sub_dept', 'track', 'unit', 'wing']
      },
      {
        key: 'qualifiedCourses',
        label: 'Qualified Course Codes',
        sample: 'CS-101; CS-201',
        synonyms: ['qualified_courses', 'eligible_courses', 'qualified_subjects', 'subjects', 'can_teach']
      },
      {
        key: 'maxWeeklyHours',
        label: 'Max Weekly Teaching Hours',
        sample: '12',
        synonyms: [
          'max_weekly_hours',
          'max_hours',
          'weekly_cap',
          'workload_cap',
          'max_teaching_hours'
        ]
      }
    ]
  },
  cohorts: {
    title: 'Batches, Fields & Sections',
    description: 'Degree batches (e.g. 2K24), fields (e.g. BSCS), and sections (A, B, C). Each section gets its own timetable.',
    requiredFields: [
      {
        key: 'code',
        label: 'Batch / Section Code',
        sample: '2K24-BSCS-A',
        synonyms: [
          'code',
          'cohort_code',
          'section_code',
          'batch_code',
          'cohort',
          'batch',
          'group'
        ]
      }
    ],
    optionalFields: [
      {
        key: 'sectionLetter',
        label: 'Section(s) (e.g. A or A,B,C)',
        sample: 'A, B, C',
        synonyms: ['section', 'sections', 'section_letter', 'sec']
      },
      {
        key: 'name',
        label: 'Cohort Name',
        sample: '2K24 BSCS Section A',
        synonyms: ['name', 'cohort_name', 'batch_name', 'group_name', 'description']
      },
      {
        key: 'size',
        label: 'Class Enrollment Size',
        sample: '45',
        synonyms: ['size', 'enrollment', 'student_count', 'students', 'capacity']
      },
      {
        key: 'year',
        label: 'Study Year (1-4)',
        sample: '2',
        synonyms: ['year', 'batch_year', 'academic_year', 'study_year']
      },
      {
        key: 'homeRoom',
        label: 'Designated Home Classroom',
        sample: 'HALL-101',
        synonyms: ['home_room', 'default_room', 'homeroom', 'classroom', 'room']
      },
      {
        key: 'department',
        label: 'Field / Department Code',
        sample: 'BSCS',
        synonyms: ['department', 'dept', 'dept_code', 'program', 'field']
      }
    ]
  }
};

function normalizeHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-_/]+/g, '');
}

function detectDelimiter(text: string): ',' | ';' | '\t' {
  const firstLine = text.split(/\r?\n/).find(l => l.trim().length > 0) || '';
  let commas = 0;
  let semis = 0;
  let tabs = 0;
  let inQuotes = false;
  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (ch === ',') commas++;
      else if (ch === ';') semis++;
      else if (ch === '\t') tabs++;
    }
  }
  if (tabs > commas && tabs >= semis) return '\t';
  if (semis > commas) return ';';
  return ',';
}

function parseDelimitedMatrix(raw: string): string[][] {
  const cleanText = raw.replace(/^\uFEFF/, '');
  if (!cleanText.trim()) return [];
  const delimiter = detectDelimiter(cleanText);

  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i];
    const next = cleanText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"' && current.trim().length === 0) {
        current = '';
        inQuotes = true;
      } else if (ch === delimiter) {
        row.push(current.trim());
        current = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(current.trim());
        if (row.some(cell => cell.length > 0)) rows.push(row);
        row = [];
        current = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        row.push(current.trim());
        if (row.some(cell => cell.length > 0)) rows.push(row);
        row = [];
        current = '';
      } else {
        current += ch;
      }
    }
  }

  row.push(current.trim());
  if (row.some(cell => cell.length > 0)) {
    rows.push(row);
  }
  return rows;
}

function parseRoomType(raw?: string): RoomType {
  const v = (raw || 'lecture').toLowerCase();
  if (v.includes('lab')) return 'lab';
  if (v.includes('studio')) return 'studio';
  if (v.includes('seminar')) return 'seminar';
  return 'lecture';
}

function excelCellToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    if (Array.isArray(obj.richText)) {
      return obj.richText
        .map(part => (typeof part === 'object' && part && 'text' in part ? String((part as { text: unknown }).text) : ''))
        .join('')
        .trim();
    }
    if ('text' in obj) return String(obj.text ?? '').trim();
    if ('result' in obj) return String(obj.result ?? '').trim();
  }
  return String(v).trim();
}

function inferSheetCategory(sheetName: string): Exclude<ImportCategory, 'all'> | null {
  const lower = sheetName.toLowerCase();
  if (lower.includes('dept') || lower.includes('department')) return 'departments';
  if (lower.includes('room') || lower.includes('lab') || lower.includes('hall')) return 'rooms';
  if (lower.includes('course') || lower.includes('subject')) return 'courses';
  if (lower.includes('inst') || lower.includes('facul') || lower.includes('teach')) return 'instructors';
  if (lower.includes('cohort') || lower.includes('batch') || lower.includes('section') || lower.includes('group')) {
    return 'cohorts';
  }
  return null;
}

export const DataImportWizard: React.FC<DataImportWizardProps> = ({
  onClose,
  onSuccess,
  defaultCategory = 'all'
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<ImportCategory>(defaultCategory);
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'completed'>('upload');
  const [rawText, setRawText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [extractedPreview, setExtractedPreview] = useState<ExtractedPayload>({
    departments: [],
    rooms: [],
    courses: [],
    instructors: [],
    cohorts: [],
    sectionLinks: []
  });
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importResult, setImportResult] = useState<{
    summary: string;
    departmentsAdded: number;
    roomsAdded: number;
    coursesAdded: number;
    instructorsAdded: number;
    cohortsAdded: number;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const getFieldsForCategory = (cat: ImportCategory) => {
    if (cat === 'all') return ALL_IN_ONE_FIELDS;
    const schema = CATEGORY_SCHEMAS[cat];
    return [
      ...schema.requiredFields.map(f => ({ ...f, group: 'Required' })),
      ...schema.optionalFields.map(f => ({ ...f, group: 'Optional' }))
    ];
  };

  const autoDetectMappingsFor = (headers: string[], cat: ImportCategory) => {
    const mappings: Record<string, string> = {};
    const fields = getFieldsForCategory(cat);
    const usedTargets = new Set<string>();

    // Pass 1: Exact or strong partial synonym match
    headers.forEach(h => {
      const cleanHeader = normalizeHeader(h);
      if (!cleanHeader) {
        mappings[h] = '';
        return;
      }

      let match = fields.find(f => {
        if (usedTargets.has(f.key)) return false;
        const cleanKey = normalizeHeader(f.key);
        if (cleanKey === cleanHeader) return true;
        return f.synonyms.some(s => normalizeHeader(s) === cleanHeader);
      });

      if (!match && cat === 'all') {
        match = fields.find(f => {
          if (usedTargets.has(f.key)) return false;
          return f.synonyms.some(s => {
            const ns = normalizeHeader(s);
            return ns.length >= 4 && (cleanHeader.includes(ns) || ns.includes(cleanHeader));
          });
        });
      }

      if (match) {
        mappings[h] = match.key;
        usedTargets.add(match.key);
      } else {
        mappings[h] = '';
      }
    });

    // Pass 2 (All-in-One): Disambiguate bare headers like code, name, title, type, id
    if (cat === 'all') {
      const hasMapped = (k: string) => usedTargets.has(k);
      const isStackedMixed = hasMapped('recordType');

      const assignIfAvailable = (header: string, targetKey: string) => {
        if (!usedTargets.has(targetKey)) {
          mappings[header] = targetKey;
          usedTargets.add(targetKey);
          return true;
        }
        return false;
      };

      headers.forEach(h => {
        if (mappings[h]) return;
        const clean = normalizeHeader(h);
        if (!clean) return;

        if (isStackedMixed) {
          if (clean === 'code' || clean === 'id' || clean === 'shortcode') {
            assignIfAvailable(h, 'genericCode');
          } else if (clean === 'name' || clean === 'title' || clean === 'fullname' || clean === 'label') {
            assignIfAvailable(h, 'genericName');
          } else if (clean === 'type') {
            assignIfAvailable(h, 'recordType');
          }
          return;
        }

        // Single-entity CSV uploaded under All-in-One tab: infer entity from sibling headers
        const looksRoom = hasMapped('roomCapacity') || hasMapped('roomType') || hasMapped('building') || hasMapped('equipment');
        const looksCourse = hasMapped('creditHours') || hasMapped('weeklyHours') || hasMapped('isLab') || hasMapped('courseTitle');
        const looksInstructor = hasMapped('instructorEmail') || hasMapped('maxWeeklyHours') || hasMapped('instructorTitle');
        const looksCohort = hasMapped('cohortSize') || hasMapped('cohortYear') || hasMapped('cohortSemester') || hasMapped('homeRoom');

        if (clean === 'code' || clean === 'id') {
          if (looksRoom && !hasMapped('roomCode')) assignIfAvailable(h, 'roomCode');
          else if (looksCourse && !hasMapped('courseCode')) assignIfAvailable(h, 'courseCode');
          else if (looksCohort && !hasMapped('cohortCode')) assignIfAvailable(h, 'cohortCode');
          else if (!hasMapped('deptCode')) assignIfAvailable(h, 'deptCode');
        } else if (clean === 'name' || clean === 'fullname') {
          if (looksInstructor && !hasMapped('instructorName')) assignIfAvailable(h, 'instructorName');
          else if (looksRoom && !hasMapped('roomName')) assignIfAvailable(h, 'roomName');
          else if (looksCohort && !hasMapped('cohortName')) assignIfAvailable(h, 'cohortName');
          else if (looksCourse && !hasMapped('courseTitle')) assignIfAvailable(h, 'courseTitle');
          else if (!hasMapped('deptName')) assignIfAvailable(h, 'deptName');
        } else if (clean === 'title') {
          if (looksCourse && !hasMapped('courseTitle')) assignIfAvailable(h, 'courseTitle');
          else if (looksInstructor && !hasMapped('instructorTitle')) assignIfAvailable(h, 'instructorTitle');
          else if (!hasMapped('courseTitle')) assignIfAvailable(h, 'courseTitle');
        } else if (clean === 'type') {
          if ((looksRoom || hasMapped('roomCode')) && !hasMapped('roomType')) {
            assignIfAvailable(h, 'roomType');
          } else if (!hasMapped('recordType')) {
            assignIfAvailable(h, 'recordType');
          }
        }
      });
    }

    return mappings;
  };

  const buildExtractionAndPreview = (
    cat: ImportCategory,
    headers: string[],
    rows: string[][],
    mappings: Record<string, string>
  ) => {
    const deptsMap = new Map<string, ExtractedPayload['departments'][number]>();
    const roomsMap = new Map<string, ExtractedPayload['rooms'][number]>();
    const coursesMap = new Map<string, ExtractedPayload['courses'][number]>();
    const instructorsMap = new Map<string, ExtractedPayload['instructors'][number]>();
    const cohortsMap = new Map<string, ExtractedPayload['cohorts'][number]>();
    const sectionLinksMap = new Map<string, ExtractedPayload['sectionLinks'][number]>();

    const parseBoolFlag = (v?: string) => {
      const s = (v || '').trim().toLowerCase();
      return s === 'yes' || s === 'true' || s === '1' || s === 'y' || s === 'elective';
    };

    const parseStaffRoleVal = (roleRaw?: string, titleRaw?: string): StaffRole => {
      const combined = `${roleRaw || ''} ${titleRaw || ''}`.toLowerCase();
      return combined.includes('lab') || combined.includes('engineer') ? 'lab_engineer' : 'faculty';
    };

    const parseCourseSpec = (
      code: string,
      title: string,
      rowObj: {
        creditHours?: string;
        lectureCredits?: string;
        labCredits?: string;
        weeklyHours?: string;
        isLab?: string;
        roomType?: string;
      departmentKey?: string;
      isElective?: string;
      electivePoolName?: string;
    }
    ): ExtractedPayload['courses'][number] => {
      const explicitLabFlag =
        parseBoolFlag(rowObj.isLab) ||
        code.endsWith('-L') ||
        (rowObj.roomType || '').toLowerCase().includes('lab');
      const hasExplicitLec = rowObj.lectureCredits !== undefined && rowObj.lectureCredits !== '';
      const hasExplicitLab = rowObj.labCredits !== undefined && rowObj.labCredits !== '';
      const lecCr = hasExplicitLec
        ? Math.max(0, Number(rowObj.lectureCredits) || 0)
        : explicitLabFlag
          ? 0
          : Number(rowObj.creditHours) || 3;
      const labCr = hasExplicitLab
        ? Math.max(0, Number(rowObj.labCredits) || 0)
        : explicitLabFlag
          ? Number(rowObj.creditHours) || 1
          : 0;
      const totalCr = lecCr + labCr || Number(rowObj.creditHours) || (explicitLabFlag ? 1 : 3);
      const calcContact = lecCr * 1 + labCr * 3;
      const weeklyContactHours = Number(rowObj.weeklyHours) || calcContact || (explicitLabFlag ? 3 : 3);
      const isPureLab = labCr > 0 && lecCr === 0;
      return {
        code,
        title,
        creditHours: totalCr,
        lectureCredits: lecCr,
        labCredits: labCr,
        weeklyContactHours,
        isLab: isPureLab || explicitLabFlag,
        requiredRoomType: isPureLab || explicitLabFlag ? 'lab' : 'lecture',
        departmentKey: rowObj.departmentKey,
        isElective: parseBoolFlag(rowObj.isElective),
        electivePoolName: rowObj.electivePoolName || undefined
      };
    };

    const expandCohortEntries = (opts: {
      rawCode?: string;
      batchCode?: string;
      sectionLetter?: string;
      deptKey?: string;
      name?: string;
      size?: number;
      year?: number;
      semester?: number;
      homeRoom?: string;
    }): ExtractedPayload['cohorts'][number][] => {
      const baseCode = (opts.rawCode || '').trim().toUpperCase();
      const rawBatch = (opts.batchCode || '').trim().toUpperCase();
      const rawDept = (opts.deptKey || '').trim().toUpperCase();
      const secList = (opts.sectionLetter || '')
        .split(/[;,/]/)
        .map(s => s.trim().toUpperCase())
        .filter(Boolean);

      if (secList.length > 0 && (rawBatch || (baseCode && !baseCode.includes('-')))) {
        const batch = rawBatch || baseCode;
        return secList.map(sec => {
          const fullCode = rawDept ? `${batch}-${rawDept}-${sec}` : `${batch}-${sec}`;
          return {
            code: fullCode,
            batchCode: batch,
            section: sec,
            name: opts.name && secList.length === 1 ? opts.name : `${batch} ${rawDept} Section ${sec}`.trim(),
            size: opts.size || 45,
            year: opts.year || 1,
            semester: opts.semester,
            homeRoom: opts.homeRoom,
            departmentKey: opts.deptKey
          };
        });
      }

      const finalCode = baseCode || (rawBatch && rawDept ? `${rawBatch}-${rawDept}-A` : rawBatch);
      if (!finalCode) return [];
      const parts = finalCode.split('-');
      return [
        {
          code: finalCode,
          batchCode: rawBatch || (parts.length >= 2 ? parts[0] : undefined),
          section: secList[0] || (parts.length >= 3 ? parts[2] : undefined),
          name: opts.name || `Cohort ${finalCode}`,
          size: opts.size || 45,
          year: opts.year || 1,
          semester: opts.semester,
          homeRoom: opts.homeRoom,
          departmentKey: opts.deptKey || (parts.length >= 2 ? parts[1] : undefined)
        }
      ];
    };

    const parsed: ParsedRow[] = rows.map((row, rIdx) => {
      const rowData: Record<string, string> = {};
      const errors: string[] = [];
      const extractedSummary: string[] = [];

      headers.forEach((h, hIdx) => {
        const target = mappings[h];
        if (target) {
          rowData[target] = (row[hIdx] ?? '').trim();
        }
      });

      if (cat === 'all') {
        const rowType = (rowData.recordType || '').toLowerCase().trim();
        const fallbackCode = (rowData.genericCode || '').trim();
        const fallbackName = (rowData.genericName || '').trim();

        // Support stacked/typed rows using generic fallback columns if present
        if (rowType.includes('dept') || rowType.includes('department')) {
          const code = (rowData.deptCode || fallbackCode || rowData.courseCode || rowData.roomCode || '').toUpperCase();
          const name = rowData.deptName || fallbackName || rowData.courseTitle || rowData.roomName || code;
          if (code || name) {
            const key = (code || name).toUpperCase();
            const subs = rowData.subDepartment
              ? rowData.subDepartment.split(/[;,]/).map(s => s.trim()).filter(Boolean)
              : undefined;
            deptsMap.set(key, { code: code || key.slice(0, 6), name, school: rowData.school, subDepartments: subs });
            extractedSummary.push(`Dept ${code || name}`);
          }
        } else if (rowType.includes('room') || rowType.includes('lab') || rowType.includes('hall')) {
          const code = (rowData.roomCode || fallbackCode || rowData.courseCode || rowData.cohortCode || '').toUpperCase();
          if (code) {
            const cap = Number(rowData.roomCapacity || rowData.cohortSize || 50);
            if (Number.isNaN(cap) || cap <= 0) errors.push('Invalid room capacity');
            else {
              roomsMap.set(code, {
                code,
                name: rowData.roomName || fallbackName,
                capacity: cap,
                type: parseRoomType(rowData.roomType),
                buildingName: rowData.building,
                equipment: rowData.equipment
                  ? rowData.equipment.split(/[;,]/).map(s => s.trim()).filter(Boolean)
                  : undefined
              });
              extractedSummary.push(`Room ${code}`);
            }
          }
        } else if (rowType.includes('course') || rowType.includes('subject')) {
          const code = (rowData.courseCode || fallbackCode || rowData.roomCode || '').toUpperCase();
          const title = rowData.courseTitle || fallbackName || code;
          if (code) {
            coursesMap.set(
              code,
              parseCourseSpec(code, title, {
                creditHours: rowData.creditHours,
                lectureCredits: rowData.lectureCredits,
                labCredits: rowData.labCredits,
                weeklyHours: rowData.weeklyHours,
                isLab: rowData.isLab,
                roomType: rowData.roomType,
                departmentKey: rowData.deptCode || rowData.deptName,
                isElective: rowData.isElective,
                electivePoolName: rowData.electivePoolName
              })
            );
            extractedSummary.push(`Course ${code}`);
          }
        } else if (
          rowType.includes('inst') ||
          rowType.includes('facul') ||
          rowType.includes('teach') ||
          rowType.includes('prof') ||
          rowType.includes('engineer')
        ) {
          const name = rowData.instructorName || fallbackName || rowData.courseTitle || '';
          if (name) {
            const staffRole = parseStaffRoleVal(rowData.staffRole, rowData.instructorTitle);
            instructorsMap.set(name.toLowerCase(), {
              name,
              email: rowData.instructorEmail,
              title: rowData.instructorTitle || (staffRole === 'lab_engineer' ? 'Lab Engineer' : undefined),
              staffRole,
              subDepartment: rowData.subDepartment || undefined,
              qualifiedCourseCodes: rowData.qualifiedCourses
                ? rowData.qualifiedCourses.split(/[;,]/).map(s => s.trim().toUpperCase()).filter(Boolean)
                : undefined,
              maxWeeklyHours: Number(rowData.maxWeeklyHours) || 14,
              departmentKey: rowData.deptCode || rowData.deptName
            });
            extractedSummary.push(`${staffRole === 'lab_engineer' ? 'Lab Eng.' : 'Faculty'} ${name}`);
          }
        } else if (
          rowType.includes('cohort') ||
          rowType.includes('batch') ||
          rowType.includes('section') ||
          rowType.includes('group')
        ) {
          const entries = expandCohortEntries({
            rawCode: rowData.cohortCode || fallbackCode || rowData.courseCode,
            batchCode: rowData.batchCode,
            sectionLetter: rowData.sectionLetter,
            deptKey: rowData.deptCode || rowData.deptName,
            name: rowData.cohortName || fallbackName,
            size: Number(rowData.cohortSize || 45) || 45,
            year: Number(rowData.cohortYear || 1) || 1,
            semester: rowData.cohortSemester ? Number(rowData.cohortSemester) : undefined,
            homeRoom: rowData.homeRoom || rowData.roomCode
          });
          entries.forEach(entry => {
            cohortsMap.set(entry.code, entry);
            extractedSummary.push(`Cohort ${entry.code}`);
          });
        } else {
          // Combined master row: extract EVERY mapped entity present in this row
          if (rowData.deptCode || rowData.deptName) {
            const code = (rowData.deptCode || rowData.deptName).trim().toUpperCase();
            const name = (rowData.deptName || rowData.deptCode).trim();
            const existingDept = deptsMap.get(code);
            const subDept = rowData.subDepartment?.trim();
            if (!existingDept) {
              deptsMap.set(code, {
                code: code.length <= 8 ? code : code.slice(0, 6),
                name,
                school: rowData.school,
                subDepartments: subDept ? [subDept] : undefined
              });
              extractedSummary.push(`Dept ${code}`);
            } else if (subDept && !(existingDept.subDepartments || []).includes(subDept)) {
              existingDept.subDepartments = [...(existingDept.subDepartments || []), subDept];
            }
          }

          if (rowData.roomCode) {
            const code = rowData.roomCode.toUpperCase();
            const rawCap = rowData.roomCapacity;
            const cap = rawCap ? Number(rawCap) : 50;
            if (rawCap && (Number.isNaN(cap) || cap <= 0)) {
              errors.push(`Invalid room capacity "${rawCap}"`);
            } else if (!roomsMap.has(code)) {
              roomsMap.set(code, {
                code,
                name: rowData.roomName,
                capacity: cap,
                type: parseRoomType(rowData.roomType),
                buildingName: rowData.building,
                equipment: rowData.equipment
                  ? rowData.equipment.split(/[;,]/).map(s => s.trim()).filter(Boolean)
                  : undefined
              });
              extractedSummary.push(`Room ${code}`);
            }
          }

          let extractedCourseCode = '';
          let extractedIsLab = false;
          if (rowData.courseCode || rowData.courseTitle) {
            const code = (
              rowData.courseCode ||
              rowData.courseTitle.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8)
            ).toUpperCase();
            extractedCourseCode = code;
            const title = rowData.courseTitle || code;
            const parsedCourse = parseCourseSpec(code, title, {
              creditHours: rowData.creditHours,
              lectureCredits: rowData.lectureCredits,
              labCredits: rowData.labCredits,
              weeklyHours: rowData.weeklyHours,
              isLab: rowData.isLab,
              roomType: rowData.roomType,
              departmentKey: rowData.deptCode || rowData.deptName,
              isElective: rowData.isElective,
              electivePoolName: rowData.electivePoolName
            });
            extractedIsLab = Boolean(parsedCourse.isLab);
            if (code && !coursesMap.has(code)) {
              coursesMap.set(code, parsedCourse);
              extractedSummary.push(`Course ${code}`);
            }
          }

          if (rowData.instructorName) {
            const name = rowData.instructorName.trim();
            const staffRole = parseStaffRoleVal(rowData.staffRole, rowData.instructorTitle);
            if (name && !instructorsMap.has(name.toLowerCase())) {
              instructorsMap.set(name.toLowerCase(), {
                name,
                email: rowData.instructorEmail,
                title: rowData.instructorTitle || (staffRole === 'lab_engineer' ? 'Lab Engineer' : undefined),
                staffRole,
                subDepartment: rowData.subDepartment || undefined,
                qualifiedCourseCodes: rowData.qualifiedCourses
                  ? rowData.qualifiedCourses.split(/[;,]/).map(s => s.trim().toUpperCase()).filter(Boolean)
                  : extractedCourseCode
                    ? [extractedCourseCode]
                    : undefined,
                maxWeeklyHours: Number(rowData.maxWeeklyHours) || 14,
                departmentKey: rowData.deptCode || rowData.deptName
              });
              extractedSummary.push(`${staffRole === 'lab_engineer' ? 'Lab Eng.' : 'Faculty'} ${name}`);
            } else if (name && extractedCourseCode) {
              const existingInst = instructorsMap.get(name.toLowerCase());
              if (existingInst) {
                const prev = existingInst.qualifiedCourseCodes || [];
                if (!prev.includes(extractedCourseCode)) {
                  existingInst.qualifiedCourseCodes = [...prev, extractedCourseCode];
                }
              }
            }
          }

          if (rowData.cohortCode || rowData.batchCode) {
            const entries = expandCohortEntries({
              rawCode: rowData.cohortCode,
              batchCode: rowData.batchCode,
              sectionLetter: rowData.sectionLetter,
              deptKey: rowData.deptCode || rowData.deptName,
              name: rowData.cohortName,
              size: Number(rowData.cohortSize || 45) || 45,
              year: Number(rowData.cohortYear || 1) || 1,
              semester: rowData.cohortSemester ? Number(rowData.cohortSemester) : undefined,
              homeRoom: rowData.homeRoom || rowData.roomCode
            });
            entries.forEach(entry => {
              if (!cohortsMap.has(entry.code)) {
                cohortsMap.set(entry.code, entry);
                extractedSummary.push(`Cohort ${entry.code}`);
              }
              if (extractedCourseCode) {
                const linkKey = `${extractedCourseCode}::${entry.code}::${extractedIsLab ? 'lab' : 'lec'}`;
                if (!sectionLinksMap.has(linkKey)) {
                  sectionLinksMap.set(linkKey, {
                    courseCode: extractedCourseCode,
                    cohortCode: entry.code,
                    instructorName: rowData.instructorName?.trim() || undefined,
                    isLab: extractedIsLab
                  });
                }
              }
            });
          }
        }

        if (extractedSummary.length === 0 && errors.length === 0) {
          errors.push('No recognized fields mapped in this row');
        }
      } else {
        const schema = CATEGORY_SCHEMAS[cat];
        schema.requiredFields.forEach(req => {
          const val = rowData[req.key];
          if (!val || val.length === 0) {
            errors.push(`Missing "${req.label}"`);
          }
        });

        if (cat === 'rooms' && rowData.capacity) {
          const cap = Number(rowData.capacity);
          if (Number.isNaN(cap) || cap <= 0) {
            errors.push('Capacity must be a positive number');
          }
        }

        if (errors.length === 0) {
          if (cat === 'departments') {
            const code = rowData.code.toUpperCase();
            const subs = rowData.subDepartments
              ? rowData.subDepartments.split(/[;,]/).map(s => s.trim()).filter(Boolean)
              : undefined;
            deptsMap.set(code, { code, name: rowData.name, school: rowData.school, subDepartments: subs });
            extractedSummary.push(`Dept ${code}`);
          } else if (cat === 'rooms') {
            const code = rowData.code.toUpperCase();
            roomsMap.set(code, {
              code,
              name: rowData.name,
              capacity: Number(rowData.capacity) || 50,
              type: parseRoomType(rowData.type),
              buildingName: rowData.building,
              equipment: rowData.equipment
                ? rowData.equipment.split(/[;,]/).map(s => s.trim()).filter(Boolean)
                : undefined
            });
            extractedSummary.push(`Room ${code}`);
          } else if (cat === 'courses') {
            const code = rowData.code.toUpperCase();
            coursesMap.set(
              code,
              parseCourseSpec(code, rowData.title, {
                creditHours: rowData.creditHours,
                lectureCredits: rowData.lectureCredits,
                labCredits: rowData.labCredits,
                weeklyHours: rowData.weeklyHours,
                isLab: rowData.isLab,
                roomType: rowData.roomType,
                departmentKey: rowData.department,
                isElective: rowData.isElective,
                electivePoolName: rowData.electivePoolName
              })
            );
            extractedSummary.push(`Course ${code}`);
          } else if (cat === 'instructors') {
            const name = rowData.name.trim();
            const staffRole = parseStaffRoleVal(rowData.staffRole, rowData.title);
            instructorsMap.set(name.toLowerCase(), {
              name,
              email: rowData.email,
              title: rowData.title || (staffRole === 'lab_engineer' ? 'Lab Engineer' : undefined),
              staffRole,
              subDepartment: rowData.subDepartment || undefined,
              qualifiedCourseCodes: rowData.qualifiedCourses
                ? rowData.qualifiedCourses.split(/[;,]/).map(s => s.trim().toUpperCase()).filter(Boolean)
                : undefined,
              maxWeeklyHours: Number(rowData.maxWeeklyHours) || 14,
              departmentKey: rowData.department
            });
            extractedSummary.push(`${staffRole === 'lab_engineer' ? 'Lab Eng.' : 'Faculty'} ${name}`);
          } else if (cat === 'cohorts') {
            const entries = expandCohortEntries({
              rawCode: rowData.code,
              batchCode: rowData.batchCode,
              sectionLetter: rowData.sectionLetter,
              deptKey: rowData.department,
              name: rowData.name,
              size: Number(rowData.size) || 45,
              year: Number(rowData.year) || 1,
              homeRoom: rowData.homeRoom
            });
            entries.forEach(entry => {
              cohortsMap.set(entry.code, entry);
              extractedSummary.push(`Cohort ${entry.code}`);
            });
          }
        }
      }

      return {
        index: rIdx + 1,
        data: rowData,
        extractedSummary,
        errors,
        isValid: errors.length === 0
      };
    });

    setParsedData(parsed);
    setExtractedPreview({
      departments: Array.from(deptsMap.values()),
      rooms: Array.from(roomsMap.values()),
      courses: Array.from(coursesMap.values()),
      instructors: Array.from(instructorsMap.values()),
      cohorts: Array.from(cohortsMap.values()),
      sectionLinks: Array.from(sectionLinksMap.values())
    });
  };

  const processCSVContent = (content: string, catOverride?: ImportCategory) => {
    const activeCat = catOverride ?? category;
    setRawText(content);
    setImportError(null);
    const matrix = parseDelimitedMatrix(content);
    if (matrix.length < 2) {
      setImportError('The file appears empty or does not have a header row plus data rows.');
      return;
    }

    const headers = matrix[0].map(h => h.replace(/^\uFEFF/, '').trim());
    const dataRows = matrix.slice(1);
    setCsvHeaders(headers);
    setRawRows(dataRows);

    const detected = autoDetectMappingsFor(headers, activeCat);
    setColumnMappings(detected);
    buildExtractionAndPreview(activeCat, headers, dataRows, detected);
    setStep('mapping');
  };

  const processExcelWorkbook = async (buffer: ArrayBuffer, name: string) => {
    setImportError(null);
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);

      const nonEmptySheets = wb.worksheets.filter(ws => ws.rowCount >= 2);
      if (nonEmptySheets.length === 0) {
        setImportError('No data rows found in the uploaded Excel workbook.');
        return;
      }

      // Single sheet: go through normal mapping + preview wizard
      if (nonEmptySheets.length === 1) {
        const ws = nonEmptySheets[0];
        const matrix: string[][] = [];
        ws.eachRow({ includeEmpty: false }, row => {
          const vals = Array.isArray(row.values) ? row.values.slice(1) : [];
          matrix.push(vals.map(excelCellToString));
        });

        const csvLike = matrix
          .map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(','))
          .join('\n');
        setFileName(name);
        processCSVContent(csvLike, category);
        return;
      }

      // Multi-sheet workbook: extract every sheet automatically into unified All-in-One preview
      const combinedDepts: ExtractedPayload['departments'] = [];
      const combinedRooms: ExtractedPayload['rooms'] = [];
      const combinedCourses: ExtractedPayload['courses'] = [];
      const combinedInstructors: ExtractedPayload['instructors'] = [];
      const combinedCohorts: ExtractedPayload['cohorts'] = [];
      const combinedSectionLinks: ExtractedPayload['sectionLinks'] = [];
      const previewRows: ParsedRow[] = [];

      nonEmptySheets.forEach(ws => {
        const matrix: string[][] = [];
        ws.eachRow({ includeEmpty: false }, row => {
          const vals = Array.isArray(row.values) ? row.values.slice(1) : [];
          matrix.push(vals.map(excelCellToString));
        });
        if (matrix.length < 2) return;
        const sheetCat: ImportCategory = inferSheetCategory(ws.name) || 'all';
        const headers = matrix[0];
        const rows = matrix.slice(1);
        const mappings = autoDetectMappingsFor(headers, sheetCat);

        rows.forEach(r => {
          const rowData: Record<string, string> = {};
          headers.forEach((h, hIdx) => {
            const target = mappings[h];
            if (target) rowData[target] = (r[hIdx] ?? '').trim();
          });

          const summary: string[] = [];
          if (sheetCat === 'departments' && (rowData.code || rowData.name)) {
            const code = (rowData.code || rowData.name).toUpperCase();
            const subs = rowData.subDepartments
              ? rowData.subDepartments.split(/[;,]/).map(s => s.trim()).filter(Boolean)
              : undefined;
            combinedDepts.push({ code, name: rowData.name || code, school: rowData.school, subDepartments: subs });
            summary.push(`Dept ${code}`);
          } else if (sheetCat === 'rooms' && rowData.code) {
            const code = rowData.code.toUpperCase();
            combinedRooms.push({
              code,
              name: rowData.name,
              capacity: Number(rowData.capacity) || 50,
              type: parseRoomType(rowData.type),
              buildingName: rowData.building
            });
            summary.push(`Room ${code}`);
          } else if (sheetCat === 'courses' && rowData.code) {
            const code = rowData.code.toUpperCase();
            const isLab =
              (rowData.isLab && rowData.isLab.toLowerCase().startsWith('y')) ||
              code.endsWith('-L');
            const lecCr = rowData.lectureCredits ? Number(rowData.lectureCredits) : isLab ? 0 : Number(rowData.creditHours) || 3;
            const labCr = rowData.labCredits ? Number(rowData.labCredits) : isLab ? Number(rowData.creditHours) || 1 : 0;
            combinedCourses.push({
              code,
              title: rowData.title || code,
              creditHours: lecCr + labCr || Number(rowData.creditHours) || (isLab ? 1 : 3),
              lectureCredits: lecCr,
              labCredits: labCr,
              weeklyContactHours: Number(rowData.weeklyHours) || lecCr * 1 + labCr * 3 || 3,
              isLab,
              requiredRoomType: isLab ? 'lab' : 'lecture',
              departmentKey: rowData.department,
              subDepartment: rowData.subDepartment || undefined,
              isElective: (rowData.isElective || '').toLowerCase().startsWith('y'),
              electivePoolName: rowData.electivePoolName || undefined
            });
            summary.push(`Course ${code}`);
          } else if (sheetCat === 'instructors' && rowData.name) {
            const isLabEng = `${rowData.staffRole || ''} ${rowData.title || ''}`.toLowerCase().includes('lab') ||
              `${rowData.staffRole || ''} ${rowData.title || ''}`.toLowerCase().includes('engineer');
            combinedInstructors.push({
              name: rowData.name,
              email: rowData.email,
              title: rowData.title || (isLabEng ? 'Lab Engineer' : undefined),
              staffRole: isLabEng ? 'lab_engineer' : 'faculty',
              subDepartment: rowData.subDepartment || undefined,
              qualifiedCourseCodes: rowData.qualifiedCourses
                ? rowData.qualifiedCourses.split(/[;,]/).map(s => s.trim().toUpperCase()).filter(Boolean)
                : undefined,
              maxWeeklyHours: Number(rowData.maxWeeklyHours) || 14,
              departmentKey: rowData.department
            });
            summary.push(`${isLabEng ? 'Lab Eng.' : 'Faculty'} ${rowData.name}`);
          } else if (sheetCat === 'cohorts' && rowData.code) {
            const code = rowData.code.toUpperCase();
            combinedCohorts.push({
              code,
              name: rowData.name,
              size: Number(rowData.size) || 45,
              year: Number(rowData.year) || 1,
              homeRoom: rowData.homeRoom,
              departmentKey: rowData.department
            });
            summary.push(`Cohort ${code}`);
          } else if (sheetCat === 'all') {
            if (rowData.deptCode || rowData.deptName) {
              const code = (rowData.deptCode || rowData.deptName).toUpperCase();
              const subDept = rowData.subDepartment?.trim();
              combinedDepts.push({
                code: code.slice(0, 8),
                name: rowData.deptName || code,
                school: rowData.school,
                subDepartments: subDept ? [subDept] : undefined
              });
              summary.push(`Dept ${code}`);
            }
            if (rowData.roomCode) {
              const code = rowData.roomCode.toUpperCase();
              combinedRooms.push({
                code,
                name: rowData.roomName,
                capacity: Number(rowData.roomCapacity) || 50,
                type: parseRoomType(rowData.roomType),
                buildingName: rowData.building
              });
              summary.push(`Room ${code}`);
            }
            if (rowData.courseCode || rowData.courseTitle) {
              const code = (rowData.courseCode || rowData.courseTitle).toUpperCase();
              const isLab =
                (rowData.isLab && rowData.isLab.toLowerCase().startsWith('y')) || code.endsWith('-L');
              const lecCr = rowData.lectureCredits ? Number(rowData.lectureCredits) : isLab ? 0 : Number(rowData.creditHours) || 3;
              const labCr = rowData.labCredits ? Number(rowData.labCredits) : isLab ? Number(rowData.creditHours) || 1 : 0;
              combinedCourses.push({
                code,
                title: rowData.courseTitle || code,
                creditHours: lecCr + labCr || Number(rowData.creditHours) || (isLab ? 1 : 3),
                lectureCredits: lecCr,
                labCredits: labCr,
                weeklyContactHours: Number(rowData.weeklyHours) || lecCr * 1 + labCr * 3 || 3,
                isLab,
                requiredRoomType: isLab ? 'lab' : 'lecture',
                departmentKey: rowData.deptCode || rowData.deptName,
                subDepartment: rowData.subDepartment || undefined,
                isElective: (rowData.isElective || '').toLowerCase().startsWith('y'),
                electivePoolName: rowData.electivePoolName || undefined
              });
              summary.push(`Course ${code}`);
            }
            if (rowData.instructorName) {
              const isLabEng = `${rowData.staffRole || ''} ${rowData.instructorTitle || ''}`.toLowerCase().includes('lab') ||
                `${rowData.staffRole || ''} ${rowData.instructorTitle || ''}`.toLowerCase().includes('engineer');
              combinedInstructors.push({
                name: rowData.instructorName,
                email: rowData.instructorEmail,
                title: rowData.instructorTitle || (isLabEng ? 'Lab Engineer' : undefined),
                staffRole: isLabEng ? 'lab_engineer' : 'faculty',
                subDepartment: rowData.subDepartment || undefined,
                qualifiedCourseCodes: rowData.qualifiedCourses
                  ? rowData.qualifiedCourses.split(/[;,]/).map(s => s.trim().toUpperCase()).filter(Boolean)
                  : undefined,
                maxWeeklyHours: Number(rowData.maxWeeklyHours) || 14,
                departmentKey: rowData.deptCode || rowData.deptName
              });
              summary.push(`${isLabEng ? 'Lab Eng.' : 'Faculty'} ${rowData.instructorName}`);
            }
            if (rowData.cohortCode) {
              const code = rowData.cohortCode.toUpperCase();
              combinedCohorts.push({
                code,
                name: rowData.cohortName,
                size: Number(rowData.cohortSize) || 45,
                year: Number(rowData.cohortYear) || 1,
                homeRoom: rowData.homeRoom || rowData.roomCode,
                departmentKey: rowData.deptCode || rowData.deptName
              });
              summary.push(`Cohort ${code}`);
              if (rowData.courseCode) {
                combinedSectionLinks.push({
                  courseCode: rowData.courseCode.toUpperCase(),
                  cohortCode: code,
                  instructorName: rowData.instructorName || undefined,
                  isLab: Boolean(rowData.isLab && rowData.isLab.toLowerCase().startsWith('y'))
                });
              }
            }
          }

          if (summary.length > 0) {
            previewRows.push({
              index: previewRows.length + 1,
              data: { ...rowData, _sheet: ws.name },
              extractedSummary: summary,
              errors: [],
              isValid: true
            });
          }
        });
      });

      setCategory('all');
      setFileName(name);
      setCsvHeaders(['_sheet']);
      setRawRows([]);
      setParsedData(previewRows);
      setExtractedPreview({
        departments: combinedDepts,
        rooms: combinedRooms,
        courses: combinedCourses,
        instructors: combinedInstructors,
        cohorts: combinedCohorts,
        sectionLinks: combinedSectionLinks
      });
      setStep('preview');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setImportError(`Could not read Excel file: ${msg}`);
    }
  };

  const handleFileObject = (file: File) => {
    setFileName(file.name);
    setImportError(null);
    const lower = file.name.toLowerCase();

    if (lower.endsWith('.xlsx')) {
      const reader = new FileReader();
      reader.onload = evt => {
        const buffer = evt.target?.result;
        if (buffer instanceof ArrayBuffer) {
          void processExcelWorkbook(buffer, file.name);
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = evt => {
      const text = (evt.target?.result as string) || '';
      processCSVContent(text);
    };
    reader.readAsText(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    handleFileObject(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileObject(file);
    }
  };

  const handleUpdateMapping = (header: string, targetKey: string) => {
    const updated = { ...columnMappings, [header]: targetKey };
    setColumnMappings(updated);
    buildExtractionAndPreview(category, csvHeaders, rawRows, updated);
  };

  const handleDownloadSampleTemplate = (cat: ImportCategory) => {
    let headerRow = '';
    let sampleRows: string[] = [];

    if (cat === 'all') {
      headerRow =
        'dept_code,dept_name,sub_department,course_code,course_title,lecture_credits,lab_credits,is_elective,instructor_name,staff_role,qualified_courses,instructor_email,room_code,room_capacity,room_type,cohort_code,cohort_size,year';
      sampleRows = [
        'CS,Computer Science,AI & Data Systems,CS-101,Foundations of Computing,3,0,no,Dr. Ayesha Khan,faculty,CS-101,ayesha.khan@university.edu,HALL-101,60,lecture,2K26-CS-A,45,1',
        'CS,Computer Science,AI & Data Systems,CS-101-L,Computing Lab,0,1,no,Engr. Bilal Ahmed,lab_engineer,CS-101-L,bilal.ahmed@university.edu,LAB-01,40,lab,2K26-CS-A,45,1'
      ];
    } else {
      const schema = CATEGORY_SCHEMAS[cat];
      const headers = [...schema.requiredFields, ...schema.optionalFields];
      headerRow = headers.map(h => h.key).join(',');
      sampleRows = [headers.map(h => `"${h.sample}"`).join(',')];
    }

    const blob = new Blob([`${headerRow}\n${sampleRows.join('\n')}\n`], {
      type: 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smartgrid_${cat}_template.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCommitImport = () => {
    setImportError(null);
    const hasExtracted =
      extractedPreview.departments.length > 0 ||
      extractedPreview.rooms.length > 0 ||
      extractedPreview.courses.length > 0 ||
      extractedPreview.instructors.length > 0 ||
      extractedPreview.cohorts.length > 0;

    if (!hasExtracted) {
      setImportError('No valid records were extracted. Please check your column mapping.');
      return;
    }

    const res = institutionalStore.importBulkCatalogData({
      mode: importMode,
      departments: extractedPreview.departments,
      rooms: extractedPreview.rooms,
      courses: extractedPreview.courses,
      instructors: extractedPreview.instructors,
      cohorts: extractedPreview.cohorts,
      sectionLinks: extractedPreview.sectionLinks
    });

    const parts: string[] = [];
    if (res.departmentsAdded > 0) parts.push(`${res.departmentsAdded} departments`);
    if (res.roomsAdded > 0) parts.push(`${res.roomsAdded} rooms`);
    if (res.coursesAdded > 0) parts.push(`${res.coursesAdded} courses`);
    if (res.instructorsAdded > 0) parts.push(`${res.instructorsAdded} faculty`);
    if (res.cohortsAdded > 0) parts.push(`${res.cohortsAdded} cohorts`);

    const summaryText =
      parts.length > 0
        ? `Imported ${parts.join(', ')}.`
        : 'All records matched existing entries (no duplicates added).';

    setImportResult({
      summary: summaryText,
      departmentsAdded: res.departmentsAdded,
      roomsAdded: res.roomsAdded,
      coursesAdded: res.coursesAdded,
      instructorsAdded: res.instructorsAdded,
      cohortsAdded: res.cohortsAdded
    });
    setStep('completed');
    onSuccess?.(summaryText);
  };

  const validCount = parsedData.filter(r => r.isValid).length;
  const invalidCount = parsedData.length - validCount;
  const currentFields = getFieldsForCategory(category);
  const groupedFieldNames = Array.from(new Set(currentFields.map(f => f.group)));

  const totalExtractedCount =
    extractedPreview.departments.length +
    extractedPreview.rooms.length +
    extractedPreview.courses.length +
    extractedPreview.instructors.length +
    extractedPreview.cohorts.length;

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: CALM_EASE }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#171717]/45 backdrop-blur-xs"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.26, ease: CALM_EASE }}
          className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-white border border-[#E4E2DA] rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#E4E2DA] flex items-center justify-between bg-[#F7F6EF]/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#171717] text-white flex items-center justify-center">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-serif-editorial text-lg text-[#171717] font-semibold leading-tight">
                  Academic Data Importer
                </h2>
                <p className="text-[11px] text-[#77766F]">
                  Import a unified CSV/Excel file for everything or choose a specific catalog table.
                </p>
              </div>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-[#77766F] hover:text-[#171717] hover:bg-black/5 cursor-pointer"
                aria-label="Close importer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          {step !== 'completed' && (
            <div className="px-6 py-2.5 bg-white border-b border-[#E4E2DA] flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] text-xs font-medium">
                {(
                  [
                    { id: 'all' as const, label: 'All-in-One CSV' },
                    { id: 'departments' as const, label: 'Departments' },
                    { id: 'rooms' as const, label: 'Rooms & Labs' },
                    { id: 'courses' as const, label: 'Courses' },
                    { id: 'instructors' as const, label: 'Faculty' },
                    { id: 'cohorts' as const, label: 'Cohorts' }
                  ] as const
                ).map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setCategory(t.id);
                      setStep('upload');
                      setParsedData([]);
                      setCsvHeaders([]);
                      setRawRows([]);
                      setImportError(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      category === t.id
                        ? 'bg-[#171717] text-white font-semibold'
                        : 'text-[#77766F] hover:text-[#171717]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleDownloadSampleTemplate(category)}
                className="btn-secondary h-8 px-3 text-xs inline-flex items-center gap-1.5 shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Sample CSV</span>
              </button>
            </div>
          )}

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {importError && (
              <div className="px-4 py-2.5 rounded-xl bg-[#FEF2F2] border border-[#F5B5B5] text-[#8B1E1E] text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            <AnimatePresence mode="wait">
              {step === 'upload' && (
                <motion.div
                  key="import-upload"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.22, ease: CALM_EASE }}
                  className="space-y-5"
                >
                  {/* Drag/Drop Box */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragging(true);
                    }}
                    onDragLeave={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragging(false);
                    }}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-9 text-center flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${
                      isDragging
                        ? 'border-[#171717] bg-[#B8EEEE]/25'
                        : 'border-[#E4E2DA] hover:border-[#171717] bg-[#F7F6EF]/50 hover:bg-[#F7F6EF]'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-white border border-[#E4E2DA] flex items-center justify-center text-[#171717] shadow-2xs">
                      <FileSpreadsheet className="w-6 h-6 text-[#171717]" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#171717]">
                        Click to select CSV or Excel (.xlsx), or drag and drop here
                      </div>
                      <div className="text-xs text-[#77766F] mt-1">
                        {category === 'all'
                          ? 'Accepts one master CSV/Excel containing departments, rooms, courses, faculty, and cohorts together.'
                          : `Accepts .csv, .tsv, or .xlsx files for ${CATEGORY_SCHEMAS[category].title}.`}
                      </div>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.tsv,.txt,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>

                  {/* Or paste CSV text */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[#171717] flex items-center justify-between">
                      <span>Or paste CSV / tab-separated spreadsheet rows directly:</span>
                      <span className="text-[11px] text-[#77766F]">Headers in line 1</span>
                    </label>
                    <textarea
                      rows={4}
                      value={rawText}
                      onChange={e => setRawText(e.target.value)}
                      placeholder={
                        category === 'all'
                          ? `dept_code,course_code,course_title,instructor_name,room_code,room_capacity,cohort_code,cohort_size\nCS,CS-101,Intro to Computing,Dr. Ayesha Khan,HALL-101,60,2K26-CS-A,45`
                          : `code,capacity,name,type\nHALL-101,60,Lecture Hall A,lecture`
                      }
                      className="input-field min-h-[104px] py-2.5 text-xs font-mono-tabular"
                    />
                    <button
                      type="button"
                      disabled={!rawText.trim()}
                      onClick={() => processCSVContent(rawText)}
                      className="btn-primary h-9 text-xs"
                    >
                      <span>Inspect &amp; Map Columns</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 'mapping' && (
                <motion.div
                  key="import-mapping"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.24, ease: CALM_EASE }}
                  className="space-y-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E4E2DA]">
                    <div>
                      <h3 className="font-serif-editorial text-base text-[#171717] font-semibold">
                        Column Mapping ·{' '}
                        {category === 'all' ? 'All-in-One Master File' : CATEGORY_SCHEMAS[category].title}
                      </h3>
                      <p className="text-xs text-[#77766F]">
                        File: <strong className="text-[#171717]">{fileName || 'Pasted Data'}</strong>{' '}
                        ({rawRows.length} rows detected · {totalExtractedCount} unique records ready)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setStep('upload')}
                        className="btn-secondary h-8 px-3 text-xs"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep('preview')}
                        className="btn-primary h-8 px-4 text-xs"
                      >
                        <span>Preview ({totalExtractedCount} records)</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Extracted Entity Summary Bar */}
                  <div className="p-3 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] flex flex-wrap items-center gap-3 text-xs font-mono-tabular text-[#171717]">
                    <span className="font-sans font-semibold text-[#57564F]">Detected:</span>
                    <span>{extractedPreview.departments.length} Depts</span>
                    <span>·</span>
                    <span>{extractedPreview.rooms.length} Rooms</span>
                    <span>·</span>
                    <span>{extractedPreview.courses.length} Courses</span>
                    <span>·</span>
                    <span>{extractedPreview.instructors.length} Faculty</span>
                    <span>·</span>
                    <span>{extractedPreview.cohorts.length} Cohorts</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {csvHeaders.map(header => {
                      const currentMapped = columnMappings[header] || '';
                      return (
                        <div
                          key={header}
                          className="p-3 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF]/50 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-mono-tabular font-bold text-[#171717] truncate">
                              {header}
                            </div>
                            <div className="text-[11px] text-[#77766F] truncate">
                              Sample: {rawRows[0]?.[csvHeaders.indexOf(header)] || '—'}
                            </div>
                          </div>

                          <select
                            value={currentMapped}
                            onChange={e => handleUpdateMapping(header, e.target.value)}
                            className="input-field h-8 text-xs w-52 bg-white shrink-0"
                          >
                            <option value="">(Ignore / Skip Column)</option>
                            {groupedFieldNames.map(group => (
                              <optgroup key={group} label={group}>
                                {currentFields
                                  .filter(f => f.group === group)
                                  .map(f => (
                                    <option key={f.key} value={f.key}>
                                      {f.label}
                                    </option>
                                  ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {step === 'preview' && (
                <motion.div
                  key="import-preview"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.24, ease: CALM_EASE }}
                  className="space-y-5"
                >
                  {/* Validation Summary Bar */}
                  <div className="p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 bg-[#F7F6EF] border-[#E4E2DA]">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <span className="font-semibold text-[#171717]">
                          {validCount} valid rows · {totalExtractedCount} unique records extracted
                        </span>
                        {invalidCount > 0 && (
                          <span className="font-semibold text-[#D32F2F]">
                            {invalidCount} rows with issues
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono-tabular text-[#57564F]">
                        {extractedPreview.departments.length} Depts · {extractedPreview.rooms.length}{' '}
                        Rooms · {extractedPreview.courses.length} Courses ·{' '}
                        {extractedPreview.instructors.length} Faculty ·{' '}
                        {extractedPreview.cohorts.length} Cohorts
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <select
                        value={importMode}
                        onChange={e => setImportMode(e.target.value as 'merge' | 'replace')}
                        className="input-field h-8 text-xs py-0 px-2.5 w-auto bg-white"
                      >
                        <option value="merge">Merge (Add new &amp; keep existing)</option>
                        <option value="replace">Replace imported categories</option>
                      </select>

                      {csvHeaders.length > 0 && csvHeaders[0] !== '_sheet' && (
                        <button
                          type="button"
                          onClick={() => setStep('mapping')}
                          className="btn-secondary h-8 px-3 text-xs"
                        >
                          Edit Mapping
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleCommitImport}
                        disabled={totalExtractedCount === 0}
                        className="btn-primary h-8 px-4 text-xs font-semibold"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Import {totalExtractedCount} Records</span>
                      </button>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="border border-[#E4E2DA] rounded-xl overflow-hidden overflow-x-auto max-h-72">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-[#F7F6EF] border-b border-[#E4E2DA] sticky top-0">
                        <tr>
                          <th className="py-2 px-3 font-semibold text-[#77766F] w-12">#</th>
                          <th className="py-2 px-3 font-semibold text-[#77766F]">Status</th>
                          <th className="py-2 px-3 font-semibold text-[#171717]">
                            Extracted Entities
                          </th>
                          <th className="py-2 px-3 font-semibold text-[#77766F]">Values</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E4E2DA]">
                        {parsedData.slice(0, 60).map(row => (
                          <tr
                            key={row.index}
                            className={row.isValid ? 'hover:bg-black/2' : 'bg-[#FEE2E2]/35'}
                          >
                            <td className="py-2 px-3 font-mono-tabular text-[#77766F]">
                              {row.index}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              {row.isValid ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2E7D32]">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Ready</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#D32F2F]">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>{row.errors[0]}</span>
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-mono-tabular text-[11px] text-[#171717]">
                              {row.extractedSummary.join(' · ') || '—'}
                            </td>
                            <td className="py-2 px-3 text-[11px] text-[#57564F] truncate max-w-md">
                              {Object.entries(row.data)
                                .filter(([k, v]) => v && k !== '_sheet')
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(' | ') || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedData.length > 60 && (
                    <div className="text-center text-xs text-[#77766F]">
                      Showing first 60 rows of {parsedData.length} rows.
                    </div>
                  )}
                </motion.div>
              )}

              {step === 'completed' && (
                <motion.div
                  key="import-completed"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.25, ease: CALM_EASE }}
                  className="py-10 text-center space-y-4"
                >
                  <div className="w-14 h-14 rounded-2xl bg-[#B8F2E6] text-[#171717] border border-[#8FDCC9] flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7 text-[#1E5631]" />
                  </div>
                  <h3 className="font-serif-editorial text-2xl text-[#171717]">
                    Catalog Import Completed
                  </h3>
                  <p className="text-sm text-[#57564F] max-w-md mx-auto">
                    {importResult?.summary}
                  </p>
                  <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] text-xs text-[#57564F]">
                    <Layers className="w-3.5 h-3.5 text-[#171717]" />
                    <span>
                      Your catalog is saved. Go to <strong>Generate Timetable</strong> when you are
                      ready to build your schedule.
                    </span>
                  </div>
                  <div className="pt-3 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('upload');
                        setParsedData([]);
                        setCsvHeaders([]);
                        setRawRows([]);
                        setRawText('');
                      }}
                      className="btn-secondary h-9 text-xs"
                    >
                      Import Another File
                    </button>
                    {onClose && (
                      <button
                        type="button"
                        onClick={onClose}
                        className="btn-primary h-9 text-xs font-semibold"
                      >
                        Done
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </MotionConfig>
  );
};
