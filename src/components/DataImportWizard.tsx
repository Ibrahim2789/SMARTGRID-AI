import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Download,
  X,
  RefreshCw,
  Table,
  Check
} from 'lucide-react';
import { institutionalStore, useInstitutionalData } from '../data/store';
import { Room, Course, Instructor, StudentGroup, RoomType } from '../types/institutional';

export type ImportCategory = 'rooms' | 'courses' | 'instructors' | 'cohorts';

interface DataImportWizardProps {
  onClose?: () => void;
  onSuccess?: (summary: string) => void;
  defaultCategory?: ImportCategory;
}

interface ColumnMapping {
  csvHeader: string;
  targetField: string;
}

interface ParsedRow {
  index: number;
  data: Record<string, string>;
  errors: string[];
  isValid: boolean;
}

const CATEGORY_SCHEMAS: Record<
  ImportCategory,
  {
    title: string;
    description: string;
    requiredFields: Array<{ key: string; label: string; sample: string; synonyms: string[] }>;
    optionalFields: Array<{ key: string; label: string; sample: string; synonyms: string[] }>;
  }
> = {
  rooms: {
    title: 'Rooms & Laboratories',
    description: 'Classrooms, lecture halls, computer labs, and specialized workshops.',
    requiredFields: [
      { key: 'code', label: 'Room Code / Number', sample: 'HALL-101', synonyms: ['room', 'room_code', 'code', 'room_number', 'classroom', 'hall', 'room_no'] },
      { key: 'capacity', label: 'Seating Capacity', sample: '60', synonyms: ['capacity', 'seats', 'size', 'max_students', 'cap'] }
    ],
    optionalFields: [
      { key: 'name', label: 'Facility Name', sample: 'Turing Lecture Hall', synonyms: ['name', 'room_name', 'facility', 'description', 'title'] },
      { key: 'type', label: 'Facility Type (lecture/lab/studio/seminar)', sample: 'lecture', synonyms: ['type', 'room_type', 'kind', 'category'] },
      { key: 'building', label: 'Building Name', sample: 'Science Complex', synonyms: ['building', 'bld', 'building_name', 'block', 'location'] },
      { key: 'equipment', label: 'Equipment / Facilities', sample: 'Projector, Audio', synonyms: ['equipment', 'features', 'facilities', 'amenities', 'resources'] }
    ]
  },
  courses: {
    title: 'Courses & Curriculum',
    description: 'Academic subjects, course codes, credit hours, and lecture/lab breakdown.',
    requiredFields: [
      { key: 'code', label: 'Course Code', sample: 'CS-101', synonyms: ['code', 'course_code', 'course_id', 'subject_code', 'course_no', 'id'] },
      { key: 'title', label: 'Course Title', sample: 'Introduction to Computing', synonyms: ['title', 'name', 'course_title', 'course_name', 'subject', 'description'] }
    ],
    optionalFields: [
      { key: 'creditHours', label: 'Credit Hours', sample: '3', synonyms: ['credit_hours', 'credits', 'credit', 'cr_hrs', 'units'] },
      { key: 'weeklyHours', label: 'Weekly Contact Hours', sample: '3', synonyms: ['weekly_hours', 'contact_hours', 'hours_per_week', 'weekly_contact_hours', 'duration'] },
      { key: 'roomType', label: 'Required Room Type (lecture/lab)', sample: 'lecture', synonyms: ['room_type', 'required_room', 'room_kind', 'facility_type'] },
      { key: 'department', label: 'Department Code / Name', sample: 'CS', synonyms: ['department', 'dept', 'dept_code', 'department_name'] },
      { key: 'isLab', label: 'Is Practical Lab (yes/no)', sample: 'no', synonyms: ['is_lab', 'lab', 'practical', 'is_practical'] }
    ]
  },
  instructors: {
    title: 'Faculty & Instructors',
    description: 'Professors, lecturers, teaching loads, and institutional emails.',
    requiredFields: [
      { key: 'name', label: 'Full Name', sample: 'Dr. Alan Turing', synonyms: ['name', 'instructor_name', 'faculty_name', 'full_name', 'professor', 'teacher'] }
    ],
    optionalFields: [
      { key: 'email', label: 'Email Address', sample: 'a.turing@univ.edu', synonyms: ['email', 'email_address', 'mail', 'institutional_email'] },
      { key: 'title', label: 'Academic Title / Designation', sample: 'Associate Professor', synonyms: ['title', 'designation', 'rank', 'position', 'role'] },
      { key: 'department', label: 'Department Code / Name', sample: 'CS', synonyms: ['department', 'dept', 'dept_code', 'department_name'] },
      { key: 'maxWeeklyHours', label: 'Max Weekly Teaching Hours', sample: '12', synonyms: ['max_weekly_hours', 'max_hours', 'weekly_cap', 'workload_cap', 'max_teaching_hours'] }
    ]
  },
  cohorts: {
    title: 'Student Cohorts & Batches',
    description: 'Degree sections, enrollment sizes, and designated home classrooms.',
    requiredFields: [
      { key: 'code', label: 'Cohort / Section Code', sample: '2K25-BSCS-A', synonyms: ['code', 'cohort_code', 'section_code', 'batch_code', 'cohort', 'section', 'group'] }
    ],
    optionalFields: [
      { key: 'name', label: 'Cohort Name', sample: 'BS CS 2K25 Section A', synonyms: ['name', 'cohort_name', 'batch_name', 'group_name', 'description'] },
      { key: 'size', label: 'Class Enrollment Size', sample: '45', synonyms: ['size', 'enrollment', 'student_count', 'students', 'capacity'] },
      { key: 'year', label: 'Study Year (1-4)', sample: '2', synonyms: ['year', 'batch_year', 'academic_year'] },
      { key: 'homeRoom', label: 'Designated Home Classroom', sample: 'HALL-101', synonyms: ['home_room', 'default_room', 'homeroom', 'classroom', 'room'] },
      { key: 'department', label: 'Department Code / Name', sample: 'CS', synonyms: ['department', 'dept', 'dept_code', 'program'] }
    ]
  }
};

export const DataImportWizard: React.FC<DataImportWizardProps> = ({
  onClose,
  onSuccess,
  defaultCategory = 'rooms'
}) => {
  const store = useInstitutionalData();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<ImportCategory>(defaultCategory);
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'completed'>('upload');
  const [rawText, setRawText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importResult, setImportResult] = useState<{ count: number; category: string } | null>(null);

  const currentSchema = CATEGORY_SCHEMAS[category];

  // Auto-detect mappings when headers are parsed
  const autoDetectMappings = (headers: string[]) => {
    const mappings: Record<string, string> = {};
    const allFields = [...currentSchema.requiredFields, ...currentSchema.optionalFields];

    headers.forEach(h => {
      const cleanHeader = h.trim().toLowerCase().replace(/[\s\-_]/g, '');
      const match = allFields.find(f => {
        const cleanKey = f.key.toLowerCase().replace(/[\s\-_]/g, '');
        if (cleanKey === cleanHeader) return true;
        return f.synonyms.some(s => s.toLowerCase().replace(/[\s\-_]/g, '') === cleanHeader);
      });
      if (match) {
        mappings[h] = match.key;
      } else {
        mappings[h] = '';
      }
    });

    setColumnMappings(mappings);
    return mappings;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = evt => {
      const text = (evt.target?.result as string) || '';
      processCSVContent(text);
    };
    reader.readAsText(file);
  };

  const parseCSVLines = (text: string): string[][] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    return lines.map(line => {
      // Split respecting simple commas and quotes
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });
  };

  const processCSVContent = (content: string) => {
    setRawText(content);
    const matrix = parseCSVLines(content);
    if (matrix.length < 2) {
      alert('The provided file appears empty or lacks data rows.');
      return;
    }
    const headers = matrix[0].map(h => h.trim());
    const dataRows = matrix.slice(1);
    setCsvHeaders(headers);
    setRawRows(dataRows);

    const initialMappings = autoDetectMappings(headers);
    validateAndBuildPreview(headers, dataRows, initialMappings);
    setStep('mapping');
  };

  const handleUpdateMapping = (header: string, targetKey: string) => {
    const updated = { ...columnMappings, [header]: targetKey };
    setColumnMappings(updated);
    validateAndBuildPreview(csvHeaders, rawRows, updated);
  };

  const validateAndBuildPreview = (
    headers: string[],
    rows: string[][],
    mappings: Record<string, string>
  ) => {
    const parsed: ParsedRow[] = rows.map((row, rIdx) => {
      const rowData: Record<string, string> = {};
      const errors: string[] = [];

      headers.forEach((h, hIdx) => {
        const target = mappings[h];
        if (target) {
          rowData[target] = row[hIdx] ? row[hIdx].replace(/^["']|["']$/g, '').trim() : '';
        }
      });

      // Check required fields
      currentSchema.requiredFields.forEach(req => {
        const val = rowData[req.key];
        if (!val || val.length === 0) {
          errors.push(`Missing mandatory field "${req.label}"`);
        }
      });

      // Specific validation per category
      if (category === 'rooms' && rowData.capacity) {
        const cap = Number(rowData.capacity);
        if (Number.isNaN(cap) || cap <= 0) {
          errors.push('Capacity must be a positive number');
        }
      }

      return {
        index: rIdx + 1,
        data: rowData,
        errors,
        isValid: errors.length === 0
      };
    });

    setParsedData(parsed);
  };

  const handleDownloadSampleTemplate = (cat: ImportCategory) => {
    const schema = CATEGORY_SCHEMAS[cat];
    const headers = [...schema.requiredFields, ...schema.optionalFields];
    const headerRow = headers.map(h => h.key).join(',');
    const sampleRow = headers.map(h => `"${h.sample}"`).join(',');
    const csvContent = `data:text/csv;charset=utf-8,${headerRow}\n${sampleRow}\n`;
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `smartgrid_${cat}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCommitImport = () => {
    const validRows = parsedData.filter(r => r.isValid);
    if (validRows.length === 0) {
      alert('No valid rows available to import. Please check mapping and correct data errors.');
      return;
    }

    if (category === 'rooms') {
      const newRooms: Room[] = validRows.map((r, i) => {
        const d = r.data;
        const rawType = (d.type || 'lecture').toLowerCase();
        const type: RoomType = rawType.includes('lab')
          ? 'lab'
          : rawType.includes('studio')
          ? 'studio'
          : rawType.includes('seminar')
          ? 'seminar'
          : 'lecture';

        return {
          id: `room-imp-${Date.now()}-${i}`,
          name: d.name || `Room ${d.code}`,
          code: d.code,
          capacity: Number(d.capacity) || 50,
          type,
          buildingId: store.buildings[0]?.id || 'bld-main',
          equipment: d.equipment ? d.equipment.split(',').map(s => s.trim()) : ['Projector', 'Whiteboard'],
          isAccessible: true,
          isAvailable: true
        };
      });

      if (importMode === 'replace') {
        store.rooms = newRooms;
      } else {
        // Merge without duplicate codes
        const existingCodes = new Set(store.rooms.map(rm => rm.code.toUpperCase()));
        const uniqueNew = newRooms.filter(rm => !existingCodes.has(rm.code.toUpperCase()));
        store.rooms = [...store.rooms, ...uniqueNew];
      }
      institutionalStore.addAuditLog('create', 'room', 'bulk-import', `Imported ${newRooms.length} room facilities via university data wizard.`);
    } else if (category === 'courses') {
      const defaultDept = store.departments[0]?.id || 'dept-gen';
      const newCourses: Course[] = validRows.map((r, i) => {
        const d = r.data;
        const isLab = (d.isLab && d.isLab.toLowerCase().startsWith('y')) || d.code.toUpperCase().endsWith('-L');
        return {
          id: `crs-imp-${Date.now()}-${i}`,
          departmentId: defaultDept,
          code: d.code,
          title: d.title,
          creditHours: Number(d.creditHours) || (isLab ? 1 : 3),
          lectureHours: isLab ? 0 : Number(d.weeklyHours) || 3,
          labHours: isLab ? Number(d.weeklyHours) || 2 : 0,
          weeklyContactHours: Number(d.weeklyHours) || (isLab ? 2 : 3),
          requiredRoomType: isLab ? 'lab' : 'lecture',
          isElective: false
        };
      });

      if (importMode === 'replace') {
        store.courses = newCourses;
      } else {
        const existingCodes = new Set(store.courses.map(c => c.code.toUpperCase()));
        const uniqueNew = newCourses.filter(c => !existingCodes.has(c.code.toUpperCase()));
        store.courses = [...store.courses, ...uniqueNew];
      }
      institutionalStore.addAuditLog('create', 'course', 'bulk-import', `Imported ${newCourses.length} courses into the university academic catalog.`);
    } else if (category === 'instructors') {
      const defaultDept = store.departments[0]?.id || 'dept-gen';
      const newInstructors: Instructor[] = validRows.map((r, i) => {
        const d = r.data;
        return {
          id: `inst-imp-${Date.now()}-${i}`,
          departmentId: defaultDept,
          name: d.name,
          email: d.email || `${d.name.toLowerCase().replace(/[^a-z]/g, '.')}@university.edu`,
          title: d.title || 'Assistant Professor',
          maxWeeklyHours: Number(d.maxWeeklyHours) || 14,
          maxConsecutiveHours: 3,
          preferredDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          unavailableSlots: []
        };
      });

      if (importMode === 'replace') {
        store.instructors = newInstructors;
      } else {
        const existingNames = new Set(store.instructors.map(inst => inst.name.toUpperCase()));
        const uniqueNew = newInstructors.filter(inst => !existingNames.has(inst.name.toUpperCase()));
        store.instructors = [...store.instructors, ...uniqueNew];
      }
      institutionalStore.addAuditLog('create', 'instructor', 'bulk-import', `Imported ${newInstructors.length} faculty instructors.`);
    } else if (category === 'cohorts') {
      const defaultProg = store.programs[0]?.id || 'prog-gen';
      const newCohorts: StudentGroup[] = validRows.map((r, i) => {
        const d = r.data;
        return {
          id: `grp-imp-${Date.now()}-${i}`,
          programId: defaultProg,
          name: d.name || `Cohort ${d.code}`,
          code: d.code,
          year: Number(d.year) || 1,
          size: Number(d.size) || 45,
          homeRoom: d.homeRoom || undefined,
          sharedCourseIds: []
        };
      });

      if (importMode === 'replace') {
        store.studentGroups = newCohorts;
      } else {
        const existingCodes = new Set(store.studentGroups.map(g => g.code.toUpperCase()));
        const uniqueNew = newCohorts.filter(g => !existingCodes.has(g.code.toUpperCase()));
        store.studentGroups = [...store.studentGroups, ...uniqueNew];
      }
      institutionalStore.addAuditLog('create', 'studentGroup', 'bulk-import', `Imported ${newCohorts.length} student cohort sections.`);
    }

    setImportResult({ count: validRows.length, category: currentSchema.title });
    setStep('completed');
    onSuccess?.(`Successfully imported ${validRows.length} ${currentSchema.title}.`);
  };

  const validCount = parsedData.filter(r => r.isValid).length;
  const invalidCount = parsedData.length - validCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-white border border-[#E4E2DA] rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-[#F7F6EF] border-b border-[#E4E2DA] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#171717] text-white flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif-editorial text-lg text-[#171717] font-semibold leading-tight">
                Universal Academic Data Importer
              </h2>
              <p className="text-xs text-[#77766F] mt-0.5">
                Import CSV or tabular datasets with dynamic column detection and validation
              </p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#77766F] hover:text-[#171717] hover:bg-black/5 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Category Tabs */}
        {step !== 'completed' && (
          <div className="px-6 py-2.5 bg-white border-b border-[#E4E2DA] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] text-xs font-medium">
              {(
                [
                  { id: 'rooms' as const, label: 'Rooms & Labs' },
                  { id: 'courses' as const, label: 'Course Catalog' },
                  { id: 'instructors' as const, label: 'Faculty Roster' },
                  { id: 'cohorts' as const, label: 'Cohorts & Sections' }
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
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
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
              className="btn-secondary h-8 px-3 text-xs inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV Template</span>
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-[#B8EEEE]/30 border border-[#95DFDF] text-xs text-[#171717]">
                <strong className="font-semibold">Flexible University Mapping:</strong> Your CSV does not need to match exact column names. The importer automatically detects synonyms like <em>"Room Code"</em>, <em>"Classroom"</em>, <em>"Instructor"</em>, <em>"Faculty"</em>, or <em>"Max Seats"</em>, and allows custom re-mapping before saving.
              </div>

              {/* Drag/Drop Box */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#E4E2DA] hover:border-[#171717] rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-3 bg-[#F7F6EF]/50 hover:bg-[#F7F6EF] transition-all cursor-pointer"
              >
                <div className="w-12 h-12 rounded-2xl bg-white border border-[#E4E2DA] flex items-center justify-center text-[#171717] shadow-2xs">
                  <FileSpreadsheet className="w-6 h-6 text-[#171717]" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#171717]">
                    Click to select CSV file, or drag and drop here
                  </div>
                  <div className="text-xs text-[#77766F] mt-1">
                    Accepts .csv or comma-delimited spreadsheets for {currentSchema.title}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Or paste CSV text */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#171717] flex items-center justify-between">
                  <span>Or paste CSV / tabular text directly:</span>
                  <span className="text-[11px] text-[#77766F]">Headers in line 1</span>
                </label>
                <textarea
                  rows={4}
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  placeholder={`code,capacity,name,type\nHALL-101,60,Newton Lecture Hall,lecture\nLAB-201,45,Tesla Robotics Lab,lab`}
                  className="input-field text-xs font-mono-tabular"
                />
                <button
                  type="button"
                  disabled={!rawText.trim()}
                  onClick={() => processCSVContent(rawText)}
                  className="btn-primary h-9 text-xs"
                >
                  <span>Parse Tabular Data</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {step === 'mapping' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#E4E2DA]">
                <div>
                  <h3 className="font-serif-editorial text-base text-[#171717] font-semibold">
                    Field Mapping for {currentSchema.title}
                  </h3>
                  <p className="text-xs text-[#77766F]">
                    File: <strong className="text-[#171717]">{fileName || 'Pasted Data'}</strong> ({rawRows.length} rows found)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep('upload')}
                    className="btn-secondary h-8 px-3 text-xs"
                  >
                    Change File
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('preview')}
                    className="btn-primary h-8 px-4 text-xs"
                  >
                    <span>Preview & Validate ({parsedData.length} rows)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {csvHeaders.map(header => {
                  const currentMapped = columnMappings[header] || '';
                  const allSchemaFields = [...currentSchema.requiredFields, ...currentSchema.optionalFields];

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
                        className="input-field h-8 text-xs w-48 bg-white"
                      >
                        <option value="">(Ignore / Skip Column)</option>
                        <optgroup label="Required Fields">
                          {currentSchema.requiredFields.map(f => (
                            <option key={f.key} value={f.key}>
                              * {f.label}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Optional Fields">
                          {currentSchema.optionalFields.map(f => (
                            <option key={f.key} value={f.key}>
                              {f.label}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-5">
              {/* Validation Summary Bar */}
              <div className="p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 bg-[#F7F6EF] border-[#E4E2DA]">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#2E7D32]" />
                    <span className="font-semibold text-[#171717]">{validCount} valid records</span>
                  </div>
                  {invalidCount > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#D32F2F]" />
                      <span className="font-semibold text-[#D32F2F]">{invalidCount} with issues</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-[#77766F]">
                    <span>Import Mode:</span>
                    <select
                      value={importMode}
                      onChange={e => setImportMode(e.target.value as any)}
                      className="input-field h-8 text-xs py-0 px-2 w-auto bg-white"
                    >
                      <option value="merge">Merge (Keep existing & add new)</option>
                      <option value="replace">Replace (Clear catalog & overwrite)</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleCommitImport}
                    disabled={validCount === 0}
                    className="btn-primary h-8 px-4 text-xs font-semibold"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Commit {validCount} Records</span>
                  </button>
                </div>
              </div>

              {/* Data Table Preview */}
              <div className="border border-[#E4E2DA] rounded-xl overflow-hidden overflow-x-auto max-h-72">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#F7F6EF] border-b border-[#E4E2DA] sticky top-0">
                    <tr>
                      <th className="py-2 px-3 font-semibold text-[#77766F] w-12">#</th>
                      <th className="py-2 px-3 font-semibold text-[#77766F]">Status</th>
                      {currentSchema.requiredFields.map(f => (
                        <th key={f.key} className="py-2 px-3 font-semibold text-[#171717]">
                          * {f.label}
                        </th>
                      ))}
                      {currentSchema.optionalFields.map(f => (
                        <th key={f.key} className="py-2 px-3 font-semibold text-[#77766F]">
                          {f.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E2DA]">
                    {parsedData.slice(0, 50).map(row => (
                      <tr key={row.index} className={row.isValid ? 'hover:bg-black/2' : 'bg-[#FEE2E2]/35'}>
                        <td className="py-2 px-3 font-mono-tabular text-[#77766F]">{row.index}</td>
                        <td className="py-2 px-3">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2E7D32]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Valid</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#D32F2F]">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>{row.errors[0]}</span>
                            </span>
                          )}
                        </td>
                        {currentSchema.requiredFields.map(f => (
                          <td key={f.key} className="py-2 px-3 font-mono-tabular font-medium text-[#171717]">
                            {row.data[f.key] || <span className="text-[#D32F2F] italic">Missing</span>}
                          </td>
                        ))}
                        {currentSchema.optionalFields.map(f => (
                          <td key={f.key} className="py-2 px-3 text-[#77766F] truncate max-w-xs">
                            {row.data[f.key] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedData.length > 50 && (
                <div className="text-center text-xs text-[#77766F]">
                  Showing first 50 rows of {parsedData.length} records.
                </div>
              )}
            </div>
          )}

          {step === 'completed' && (
            <div className="py-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-[#B7F77C]/30 text-[#171717] border border-[#98DF58] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 text-[#2E7D32]" />
              </div>
              <h3 className="font-serif-editorial text-2xl text-[#171717]">
                Import Completed Successfully
              </h3>
              <p className="text-sm text-[#77766F] max-w-md mx-auto">
                Successfully imported <strong>{importResult?.count}</strong> records into{' '}
                <strong>{importResult?.category}</strong>. The university academic structure has been updated and synchronized with the scheduling engine.
              </p>
              <div className="pt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep('upload');
                    setParsedData([]);
                    setCsvHeaders([]);
                  }}
                  className="btn-secondary h-9 text-xs"
                >
                  Import Another Dataset
                </button>
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn-primary h-9 text-xs font-semibold"
                  >
                    Return to Management Panel
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
