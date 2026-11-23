import { useState, useEffect } from 'react';
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
  StaffRole,
  StudentGroup, 
  TimeStructure, 
  ConstraintRule, 
  TimetableScenario, 
  AuditLogEntry,
  DayOfWeek,
  TimetableManagementPolicy,
  SectionSlotAssignment,
  UNIVERSITY_PERIODS,
  VALID_CONTINUOUS_LAB_BLOCKS,
  DEFAULT_ACADEMIC_TIMING_CONFIG,
  computeAcademicScheduleConfig,
  validateAcademicTimingConfig,
  getLabBlockByStartPeriod,
  getCoveredPeriodsForAssignment,
  getEffectiveSlotDisplayForDay,
  parseTime24ToMinutes,
  minutesToTime24,
  orderWorkingDaysFridayRightmost,
  ContinuousLabBlockMeta
} from '../types/institutional';
import {
  RegisteredInstitutionDTO,
  BackendOptimizationAssignment,
  BackendOptimizationEntry,
  BackendFitnessBreakdown,
  getStoredUser
} from '../services/votingApi';

export function stripDegreePrefix(code: string): string {
  const clean = String(code || '').trim().toUpperCase();
  const prefixes = ['BS-', 'BE-', 'MS-', 'ME-', 'PHD-', 'BSC-', 'MSC-', 'BS', 'BE', 'MS', 'ME', 'PHD', 'BSC', 'MSC'];
  for (const prefix of prefixes) {
    if (clean.startsWith(prefix) && clean.length > prefix.length) {
      return clean.slice(prefix.length).replace(/^-+/, '');
    }
  }
  return clean;
}

export function resolveGroupDepartmentId(
  group: Pick<StudentGroup, 'programId' | 'departmentId' | 'departmentCode' | 'code'>,
  departments: Department[],
  programs: Program[]
): string {
  if (!departments || departments.length === 0) return '';
  const deptById = new Map(departments.map(d => [d.id, d]));
  const deptByCode = new Map(
    departments.filter(d => d.code).map(d => [d.code.trim().toUpperCase(), d])
  );

  // 1. Exact departmentCode match
  const rawDeptCode = String(group.departmentCode || '').trim().toUpperCase();
  if (rawDeptCode && deptByCode.has(rawDeptCode)) {
    return deptByCode.get(rawDeptCode)!.id;
  }

  // 2. Explicit departmentId resolved on group
  if (group.departmentId && deptById.has(group.departmentId)) {
    return group.departmentId;
  }

  // 3. Batch code segments (e.g. '2K24-CS-A' -> 'CS')
  const parts = String(group.code || '').toUpperCase().replace(/_/g, '-').split('-').filter(Boolean);
  for (const part of parts) {
    if (deptByCode.has(part)) {
      return deptByCode.get(part)!.id;
    }
  }

  // 4. Program -> department link
  if (group.programId) {
    const prog = programs.find(p => p.id === group.programId);
    if (prog?.departmentId && deptById.has(prog.departmentId)) {
      return prog.departmentId;
    }
  }

  // 5. Degree-prefix stripped match (e.g. BSCS <-> CS)
  const stripped = stripDegreePrefix(rawDeptCode);
  if (stripped) {
    const matchedDept = departments.find(d => stripDegreePrefix(d.code) === stripped);
    if (matchedDept) return matchedDept.id;
  }
  for (const part of parts) {
    const strippedPart = stripDegreePrefix(part);
    if (strippedPart) {
      const matchedDept = departments.find(d => stripDegreePrefix(d.code) === strippedPart);
      if (matchedDept) return matchedDept.id;
    }
  }

  // 6. Single-department fallback when group department is empty or GEN
  if (departments.length === 1 && (rawDeptCode === '' || rawDeptCode === 'GEN')) {
    return departments[0].id;
  }
  return '';
}

export function doesGroupMatchDepartment(
  group: Pick<StudentGroup, 'programId' | 'departmentId' | 'departmentCode' | 'code'>,
  dept: Department | string,
  programs: Program[],
  allDepartments: Department[]
): boolean {
  const deptId = typeof dept === 'string' ? dept : dept.id;
  if (!deptId || deptId === 'all') return true;
  const resolved = resolveGroupDepartmentId(group, allDepartments, programs);
  if (resolved) return resolved === deptId;
  const deptObj = typeof dept === 'string' ? allDepartments.find(d => d.id === dept) : dept;
  if (deptObj?.code) {
    const targetCode = deptObj.code.trim().toUpperCase();
    const rawDeptCode = String(group.departmentCode || '').trim().toUpperCase();
    if (
      rawDeptCode === targetCode ||
      (rawDeptCode !== '' && stripDegreePrefix(rawDeptCode) === stripDegreePrefix(targetCode))
    ) {
      return true;
    }
  }
  return false;
}

export function doesCourseMatchDepartment(
  course: Pick<Course, 'departmentId' | 'code'>,
  deptId: string,
  allDepartments: Department[]
): boolean {
  if (!deptId || deptId === 'all') return true;
  if (course.departmentId === deptId) return true;
  if (!course.departmentId && allDepartments.length <= 1) return true;
  const deptObj = allDepartments.find(d => d.id === deptId);
  if (!course.departmentId && deptObj?.code) {
    const prefix = String(course.code || '').toUpperCase().split(/[-_\s]/)[0];
    return (
      prefix === deptObj.code.trim().toUpperCase() ||
      stripDegreePrefix(prefix) === stripDegreePrefix(deptObj.code)
    );
  }
  return false;
}

const DEFAULT_TIME_STRUCTURE: TimeStructure = {
  id: 'standard-campus-grid',
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
  ]
};

const DEFAULT_CONSTRAINT_RULES: ConstraintRule[] = [
  {
    id: 'rule-hard-no-prof-clash',
    code: 'HC-01',
    name: 'No Instructor Double-Booking',
    description: 'An instructor cannot be scheduled to teach more than one section at the same day and time slot.',
    kind: 'hard',
    enabled: true,
    weight: 100,
    category: 'instructor'
  },
  {
    id: 'rule-hard-no-room-clash',
    code: 'HC-02',
    name: 'No Room Double-Booking',
    description: 'A room cannot host two separate courses simultaneously across lectures or 3-hour labs.',
    kind: 'hard',
    enabled: true,
    weight: 100,
    category: 'room'
  },
  {
    id: 'rule-hard-no-cohort-clash',
    code: 'HC-03',
    name: 'No Student Cohort Clash',
    description: 'Required cohort classes for the same year and degree track cannot overlap in time.',
    kind: 'hard',
    enabled: true,
    weight: 100,
    category: 'student'
  },
  {
    id: 'rule-hard-room-capacity',
    code: 'HC-04',
    name: 'Strict Room Capacity Enforcement',
    description: 'Expected enrollment cannot exceed the physical room seating capacity.',
    kind: 'hard',
    enabled: true,
    weight: 100,
    category: 'room'
  },
  {
    id: 'rule-hard-room-type-match',
    code: 'HC-05',
    name: 'Continuous Lab & Facility Enforcement',
    description: 'Laboratory sessions occupy continuous hourly cycles without crossing protected midday breaks.',
    kind: 'hard',
    enabled: true,
    weight: 100,
    category: 'facility'
  },
  {
    id: 'rule-hard-prof-unavailability',
    code: 'HC-06',
    name: 'Instructor Unavailability Compliance',
    description: 'Sections cannot be assigned during an instructor’s formally registered unavailability slots.',
    kind: 'hard',
    enabled: true,
    weight: 100,
    category: 'instructor'
  },
  {
    id: 'rule-soft-commuter-transit',
    code: 'SC-01',
    name: 'Short Break & Transit Buffer Weight',
    description: 'Preserves short breaks between lectures and respects the midday break.',
    kind: 'soft',
    enabled: true,
    weight: 85,
    category: 'facility'
  },
  {
    id: 'rule-soft-circadian',
    code: 'SC-02',
    name: 'Circadian Alertness Curve Alignment',
    description: 'Prioritizes theoretical lectures into morning session slots.',
    kind: 'soft',
    enabled: true,
    weight: 90,
    category: 'temporal'
  },
  {
    id: 'rule-soft-room-compaction',
    code: 'SC-03',
    name: 'Facility Space Compaction',
    description: 'Concentrates building utilization across active instructional wings.',
    kind: 'soft',
    enabled: true,
    weight: 70,
    category: 'room'
  },
  {
    id: 'rule-soft-faculty-consecutive',
    code: 'SC-04',
    name: 'Faculty Workload & Consecutive Hour Cap',
    description: 'Enforces break intervals after consecutive instructional hours.',
    kind: 'soft',
    enabled: true,
    weight: 80,
    category: 'instructor'
  },
  {
    id: 'rule-soft-student-gaps',
    code: 'SC-05',
    name: 'Minimize Idle Student Schedule Gaps',
    description: 'Prevents fragmented schedules with isolated classes separated by long gaps.',
    kind: 'soft',
    enabled: true,
    weight: 75,
    category: 'student'
  }
];

export interface InstitutionProfile {
  id?: string;
  name: string;
  campusCode: string;
  campusName?: string;
  code?: string;
  accreditation: string;
  academicYear?: string;
  currentTermName?: string;
  activeTermIds?: string[];
  timetableManagementPolicy?: TimetableManagementPolicy;
  registrarName: string;
  registrarEmail: string;
  autoConflictSweep: boolean;
  defaultSessionMinutes: number;
  timezone: string;
  isSample?: boolean;
}

export interface InstitutionSummary {
  id: string;
  name: string;
  code: string;
  campusName: string;
  accreditation?: string;
  isSample: boolean;
  workingDays: DayOfWeek[];
  dayStartTime: string;
  dayEndTime: string;
  periodLengthMinutes: number;
  shortBreakMinutes: number;
  middayBreakEnabled: boolean;
  middayBreakStart: string;
  middayBreakDuration: number;
  labDurationMinutes: number;
  isDemoTemplate?: boolean;
}

export interface FeedbackPollItem {
  id: string;
  title: string;
  category: string;
  description: string;
  targetSlot: string;
  votesApprove: number;
  votesRevise: number;
  userVote?: 'approve' | 'revise' | null;
  status: 'Active' | 'Implemented' | 'Under Review';
  submittedBy: string;
  createdAt: string;
}

export interface LocalImportHistoryRecord {
  id: string;
  institutionId: string;
  userName: string;
  userEmail: string;
  category: string;
  fileName: string;
  duplicateMode: 'skip' | 'update' | 'stop';
  status: 'completed' | 'partial' | 'failed' | 'rolled_back';
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  durationMs: number;
  createdAt: string;
}

export interface InstitutionalDataStore {
  institutionProfile?: InstitutionProfile;
  selectedClassGroupId?: string;
  terms: AcademicTerm[];
  campuses: Campus[];
  buildings: Building[];
  rooms: Room[];
  departments: Department[];
  programs: Program[];
  courses: Course[];
  instructors: Instructor[];
  studentGroups: StudentGroup[];
  sections: Section[];
  timeStructure: TimeStructure;
  constraints: ConstraintRule[];
  scenarios: TimetableScenario[];
  auditLogs: AuditLogEntry[];
  feedbackPolls?: FeedbackPollItem[];
  importHistory?: LocalImportHistoryRecord[];
}

const LEGACY_SAMPLE_INST_IDS = new Set(['inst-western-poly', 'inst-apex-tech']);
const institutionStoresMap = new Map<string, InstitutionalDataStore>();
const registeredInstitutionsMap = new Map<string, InstitutionSummary>();

export function getBlankInitialData(): InstitutionalDataStore {
  return {
    institutionProfile: {
      name: '',
      campusCode: '',
      campusName: '',
      code: '',
      accreditation: '',
      academicYear: '2026–2027',
      currentTermName: '',
      timetableManagementPolicy: 'whole_university',
      registrarName: '',
      registrarEmail: '',
      autoConflictSweep: true,
      defaultSessionMinutes: 50,
      timezone: 'UTC',
      isSample: false
    },
    selectedClassGroupId: '',
    terms: [],
    campuses: [],
    buildings: [],
    rooms: [],
    departments: [],
    programs: [],
    courses: [],
    instructors: [],
    studentGroups: [],
    sections: [],
    timeStructure: DEFAULT_TIME_STRUCTURE,
    constraints: DEFAULT_CONSTRAINT_RULES,
    scenarios: [],
    auditLogs: [],
    feedbackPolls: [],
    importHistory: []
  };
}

function loadDataForInstitution(instId: string): InstitutionalDataStore {
  if (!instId || LEGACY_SAMPLE_INST_IDS.has(instId)) {
    return getBlankInitialData();
  }
  const cached = institutionStoresMap.get(instId);
  if (cached && !cached.institutionProfile?.isSample) {
    return {
      ...cached,
      institutionProfile: cached.institutionProfile || getBlankInitialData().institutionProfile,
      selectedClassGroupId: cached.selectedClassGroupId || cached.studentGroups?.[0]?.id || ''
    };
  }
  return getBlankInitialData();
}

let currentInstitutionId = '';
let currentStore: InstitutionalDataStore = getBlankInitialData();
const listeners = new Set<() => void>();

function notifyListeners() {
  if (currentInstitutionId && !LEGACY_SAMPLE_INST_IDS.has(currentInstitutionId)) {
    institutionStoresMap.set(currentInstitutionId, currentStore);
    const prof = currentStore.institutionProfile;
    const ts = currentStore.timeStructure;
    if (prof && prof.name && ts && !prof.isSample) {
      const computed = computeAcademicScheduleConfig(ts);
      const updatedSummary: InstitutionSummary = {
        id: currentInstitutionId,
        name: prof.name,
        code: prof.code || prof.campusCode?.split('-')[0] || 'UNIV',
        campusName: prof.campusName || 'Main Campus',
        accreditation: prof.accreditation,
        isSample: false,
        workingDays: computed.workingDays,
        dayStartTime: computed.dayStartTime,
        dayEndTime: computed.dayEndTime,
        periodLengthMinutes: computed.periodLengthMinutes,
        shortBreakMinutes: computed.shortBreakMinutes,
        middayBreakEnabled: computed.middayBreak.enabled,
        middayBreakStart: computed.middayBreak.startTime24,
        middayBreakDuration: computed.middayBreak.durationMinutes,
        labDurationMinutes: computed.labDurationMinutes
      };
      registeredInstitutionsMap.set(currentInstitutionId, updatedSummary);
    }
  }
  listeners.forEach(fn => fn());
}

export const institutionalStore = {
  get(): InstitutionalDataStore {
    return currentStore;
  },

  getCurrentInstitutionId(): string {
    return currentInstitutionId;
  },

  getAvailableInstitutions(): InstitutionSummary[] {
    return Array.from(registeredInstitutionsMap.values()).filter(
      p =>
        Boolean(p && p.id && p.name) &&
        !LEGACY_SAMPLE_INST_IDS.has(p.id) &&
        !p.isSample &&
        !p.isDemoTemplate
    );
  },

  switchInstitution(institutionId: string) {
    if (!institutionId || LEGACY_SAMPLE_INST_IDS.has(institutionId)) return;
    if (institutionId === currentInstitutionId) return;
    if (currentInstitutionId && !LEGACY_SAMPLE_INST_IDS.has(currentInstitutionId)) {
      institutionStoresMap.set(currentInstitutionId, currentStore);
    }

    currentInstitutionId = institutionId;
    currentStore = loadDataForInstitution(institutionId);
    notifyListeners();
  },

  resetWorkspaceSession() {
    institutionStoresMap.clear();
    registeredInstitutionsMap.clear();
    currentInstitutionId = '';
    currentStore = getBlankInitialData();
    listeners.forEach(fn => fn());
  },

  registerNewInstitution(
    profile: InstitutionProfile,
    config: Partial<TimeStructure>,
    customTerms?: AcademicTerm[]
  ): string {
    const instId = profile.id || `inst-${(profile.code || 'univ').toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;
    const fullProfile: InstitutionProfile = {
      ...profile,
      id: instId,
      isSample: false
    };

    const computed = computeAcademicScheduleConfig(config);
    const newSummary: InstitutionSummary = {
      id: instId,
      name: fullProfile.name,
      code: fullProfile.code || 'UNIV',
      campusName: fullProfile.campusName || 'Main Campus',
      accreditation: fullProfile.accreditation,
      isSample: false,
      workingDays: computed.workingDays,
      dayStartTime: computed.dayStartTime,
      dayEndTime: computed.dayEndTime,
      periodLengthMinutes: computed.periodLengthMinutes,
      shortBreakMinutes: computed.shortBreakMinutes,
      middayBreakEnabled: computed.middayBreak.enabled,
      middayBreakStart: computed.middayBreak.startTime24,
      middayBreakDuration: computed.middayBreak.durationMinutes,
      labDurationMinutes: computed.labDurationMinutes
    };
    registeredInstitutionsMap.set(instId, newSummary);

    const resolvedTerms: AcademicTerm[] =
      customTerms && customTerms.length > 0
        ? customTerms.map((t, idx) => ({
            ...t,
            id: t.id || `term-${instId}-${idx + 1}`,
            isSample: false,
            is_sample: false
          }))
        : [
            {
              id: `term-${instId}-1`,
              name: fullProfile.currentTermName || 'Fall Semester 2026',
              code: 'TERM-2026-1',
              startDate: '2026-09-01',
              endDate: '2026-12-31',
              status: 'active',
              weeksCount: 16
            }
          ];

    const defaultLunchBreak = computed.middayBreak.enabled
      ? [
          {
            id: `break-${instId}-lunch`,
            name: 'University Midday / Lunch Break',
            startTime: computed.middayBreak.startTime24,
            endTime: computed.middayBreak.endTime24,
            days: computed.workingDays
          }
        ]
      : [];

    const customAdditionalBreaks = (config.breaks || []).filter(
      b => b.id !== `break-${instId}-lunch` && b.id !== 'brk-lunch'
    );

    const freshData: InstitutionalDataStore = {
      institutionProfile: fullProfile,
      selectedClassGroupId: '',
      terms: resolvedTerms,
      campuses: [
        {
          id: `campus-${instId}-1`,
          name: fullProfile.campusName || 'Main Campus',
          code: `${fullProfile.code || 'MAIN'}-01`,
          address: `${fullProfile.name} Main Campus`
        }
      ],
      buildings: [
        {
          id: `bld-${instId}-1`,
          campusId: `campus-${instId}-1`,
          name: 'Main Academic Complex',
          code: `${fullProfile.code || 'AC'}-01`,
          floors: 3
        }
      ],
      rooms: [],
      departments: [],
      programs: [],
      courses: [],
      instructors: [],
      studentGroups: [],
      sections: [],
      timeStructure: {
        id: `time-${instId}-1`,
        name: `${fullProfile.name} Time Structure`,
        workingDays: computed.workingDays,
        dayStartTime: computed.dayStartTime,
        dayEndTime: computed.dayEndTime,
        periodLengthMinutes: computed.periodLengthMinutes,
        shortBreakEnabled: computed.shortBreakEnabled,
        shortBreakMinutes: computed.shortBreakMinutes,
        includeBreakAfterLastSlot: Boolean(config.includeBreakAfterLastSlot),
        middayBreakEnabled: computed.middayBreak.enabled,
        middayBreakMode: computed.middayBreak.mode,
        middayBreakStartTime: computed.middayBreak.startTime24,
        middayBreakDurationMinutes: computed.middayBreak.durationMinutes,
        labDurationMinutes: computed.labDurationMinutes,
        fridayAfternoonShiftEnabled: computed.fridayAfternoonShiftEnabled,
        fridayAfternoonStartTime: computed.fridayAfternoonStartTime,
        fridayMode: computed.fridaySchedule.mode,
        fridayBreakStartTime: computed.fridaySchedule.jummahBreak.startTime24,
        fridayBreakEndTime: computed.fridaySchedule.jummahBreak.endTime24,
        fridayClosingTime: computed.fridaySchedule.closingTime24,
        fridayCompressionScope: computed.fridaySchedule.compressionScope,
        fridayPeriodLengthMinutes: computed.fridaySchedule.fridayPeriodLengthMinutes,
        fridayShortBreakMinutes: computed.fridaySchedule.fridayShortBreakMinutes,
        periods: computed.periods,
        breaks: [...defaultLunchBreak, ...customAdditionalBreaks]
      },
      constraints: [
        {
          id: `rule-${instId}-no-room-clash`,
          code: 'HARD_NO_ROOM_CLASH',
          name: 'Zero Room Double-Bookings',
          description: 'Enforces that no classroom or specialized laboratory hosts more than one course simultaneously.',
          kind: 'hard',
          weight: 100,
          category: 'room',
          enabled: true
        },
        {
          id: `rule-${instId}-no-faculty-clash`,
          code: 'HARD_NO_FACULTY_CLASH',
          name: 'Zero Faculty Overlaps',
          description: 'No professor or instructor can be scheduled for concurrent lectures or labs.',
          kind: 'hard',
          weight: 100,
          category: 'instructor',
          enabled: true
        }
      ],
      scenarios: [],
      auditLogs: [
        {
          id: `audit-${instId}-init`,
          timestamp: new Date().toISOString(),
          userId: 'user-admin',
          userName: fullProfile.registrarName,
          action: 'create',
          entityType: 'term',
          entityId: resolvedTerms[0]?.id || `term-${instId}-1`,
          summary: `Initialized institutional configuration for ${fullProfile.name} (${computed.summaryText}).`
        }
      ],
      feedbackPolls: []
    };

    currentInstitutionId = instId;
    currentStore = freshData;
    notifyListeners();
    return instId;
  },

  setTerms(terms: AcademicTerm[]) {
    currentStore = {
      ...currentStore,
      terms
    };
    this.addAuditLog('update', 'term', terms[0]?.id || 'terms', `Updated academic calendar (${terms.length} terms configured).`);
    notifyListeners();
  },

  clearCatalogToCleanSlate() {
    currentStore = {
      ...currentStore,
      rooms: [],
      departments: [],
      programs: [],
      courses: [],
      instructors: [],
      studentGroups: [],
      sections: [],
      scenarios: []
    };
    this.addAuditLog('delete', 'scenario', 'clean-slate', 'Cleared all academic catalog items to clean slate.');
    notifyListeners();
  },

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  setSelectedClassGroupId(groupId: string) {
    currentStore = {
      ...currentStore,
      selectedClassGroupId: groupId
    };
    notifyListeners();
  },

  resetToDefaults() {
    const blank = getBlankInitialData();
    const currentProfile = currentStore.institutionProfile;
    currentStore = {
      ...blank,
      institutionProfile: currentProfile?.name ? currentProfile : blank.institutionProfile
    };
    this.addAuditLog('restore', 'scenario', 'clean-reset', 'Reset all workspace rooms, courses, faculty, cohorts, and schedules to a clean baseline.');
    notifyListeners();
  },

  updateInstitutionProfile(updated: Partial<InstitutionProfile>) {
    const baseProfile = currentStore.institutionProfile || getBlankInitialData().institutionProfile!;
    currentStore = {
      ...currentStore,
      institutionProfile: {
        ...baseProfile,
        ...updated
      }
    };
    this.addAuditLog('update', 'campus', 'profile', `Updated institutional profile (${updated.name || baseProfile.name || 'Workspace'}).`);
    notifyListeners();
  },

  saveProfileConfig(profile: Partial<InstitutionProfile>) {
    this.updateInstitutionProfile(profile);
  },

  saveAcademicCalendarConfig(calendar: {
    academicYear: string;
    currentTermName: string;
    terms: AcademicTerm[];
  }) {
    const baseProfile = currentStore.institutionProfile || getBlankInitialData().institutionProfile!;
    currentStore = {
      ...currentStore,
      institutionProfile: {
        ...baseProfile,
        academicYear: calendar.academicYear,
        currentTermName: calendar.currentTermName
      },
      terms: calendar.terms.map((t, idx) => ({
        ...t,
        id: t.id || `term-${currentInstitutionId || 'inst'}-${idx + 1}`,
        isSample: false,
        is_sample: false
      }))
    };
    this.addAuditLog(
      'update',
      'term',
      calendar.terms[0]?.id || 'calendar',
      `Saved academic calendar (${calendar.academicYear}, active term: ${calendar.currentTermName}, ${calendar.terms.length} terms).`
    );
    notifyListeners();
  },

  saveOperatingHoursConfig(hours: Partial<TimeStructure>) {
    this.updateTimeStructure({
      workingDays: hours.workingDays,
      dayStartTime: hours.dayStartTime,
      dayEndTime: hours.dayEndTime,
      fridayAfternoonShiftEnabled: hours.fridayAfternoonShiftEnabled,
      fridayAfternoonStartTime: hours.fridayAfternoonStartTime,
      fridayMode: hours.fridayMode,
      fridayBreakStartTime: hours.fridayBreakStartTime,
      fridayBreakEndTime: hours.fridayBreakEndTime,
      fridayClosingTime: hours.fridayClosingTime,
      fridayCompressionScope: hours.fridayCompressionScope,
      fridayPeriodLengthMinutes: hours.fridayPeriodLengthMinutes,
      fridayShortBreakMinutes: hours.fridayShortBreakMinutes
    });
  },

  saveSessionAndBreakPolicyConfig(policy: Partial<TimeStructure>): {
    success: boolean;
    errors: string[];
    placedCount?: number;
    summaryText?: string;
  } {
    if (policy.periodLengthMinutes) {
      const baseProfile = currentStore.institutionProfile || getBlankInitialData().institutionProfile!;
      currentStore = {
        ...currentStore,
        institutionProfile: {
          ...baseProfile,
          defaultSessionMinutes: policy.periodLengthMinutes
        }
      };
    }
    return this.saveAcademicTimingConfig(policy);
  },

  exportStoreJSON(): string {
    return JSON.stringify(currentStore, null, 2);
  },

  importStoreJSON(jsonStr: string): { success: boolean; message: string } {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed || !Array.isArray(parsed.rooms) || !Array.isArray(parsed.courses)) {
        return { success: false, message: 'Invalid backup file structure: missing rooms or courses arrays.' };
      }
      currentStore = {
        ...currentStore,
        ...parsed,
        institutionProfile: parsed.institutionProfile || currentStore.institutionProfile,
        feedbackPolls: parsed.feedbackPolls || currentStore.feedbackPolls
      };
      this.addAuditLog('restore', 'scenario', 'json-import', `Imported institutional backup (${parsed.rooms.length} rooms, ${parsed.courses.length} courses).`);
      notifyListeners();
      return { success: true, message: `Restored ${parsed.rooms.length} rooms, ${parsed.courses.length} courses, and ${parsed.sections?.length || 0} sections.` };
    } catch {
      return { success: false, message: 'Could not parse JSON file. Please verify the file format.' };
    }
  },

  hasRealData(): boolean {
    return (
      currentStore.rooms.length > 0 ||
      currentStore.courses.length > 0 ||
      currentStore.instructors.length > 0 ||
      currentStore.studentGroups.length > 0
    );
  },

  // 1. Time Structure & Term (Admin-Controlled Academic Timing & Break Configuration)
  updateTimeStructure(updated: Partial<TimeStructure>) {
    const merged: TimeStructure = {
      ...currentStore.timeStructure,
      ...updated
    };
    const computed = computeAcademicScheduleConfig(merged);
    const updatedPeriods = updated.periods || computed.periods;
    const updatedBreaks = updated.breaks || [
      ...(computed.middayBreak.enabled
        ? [
            {
              id: 'brk-lunch',
              name: 'University Midday / Lunch Break',
              startTime: computed.middayBreak.startTime24,
              endTime: computed.middayBreak.endTime24,
              days: computed.workingDays
            }
          ]
        : [])
    ];

    currentStore = {
      ...currentStore,
      timeStructure: {
        ...merged,
        periods: updatedPeriods,
        breaks: updatedBreaks
      }
    };
    this.addAuditLog('update', 'time', currentStore.timeStructure.id, `Updated academic timing configuration (${computed.summaryText}).`);
    notifyListeners();
  },

  saveAcademicTimingConfig(newConfig: Partial<TimeStructure>): {
    success: boolean;
    errors: string[];
    placedCount?: number;
    summaryText?: string;
  } {
    const candidateConfig: Partial<TimeStructure> = {
      ...currentStore.timeStructure,
      ...newConfig
    };

    const validation = validateAcademicTimingConfig(candidateConfig);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    const computed = computeAcademicScheduleConfig(candidateConfig);
    const customBreaks = (newConfig.breaks || currentStore.timeStructure.breaks || []).filter(
      b => b.id !== 'brk-lunch' && !b.id.endsWith('-lunch') && b.id !== 'brk-jummah'
    );
    const jummahDays: DayOfWeek[] = computed.workingDays.includes('Fri') ? ['Fri'] : [];
    const standardBreakDays: DayOfWeek[] = computed.workingDays.filter(
      d => d !== 'Fri' || computed.fridaySchedule.mode === 'standard'
    );
    const updatedBreaks = [
      ...(computed.middayBreak.enabled && standardBreakDays.length > 0
        ? [
            {
              id: 'brk-lunch',
              name: 'University Midday / Lunch Break',
              startTime: computed.middayBreak.startTime24,
              endTime: computed.middayBreak.endTime24,
              days: standardBreakDays
            }
          ]
        : []),
      ...(jummahDays.length > 0 && computed.fridaySchedule.mode === 'jummah_break'
        ? [
            {
              id: 'brk-jummah',
              name: 'Friday Jummah Prayer Break',
              startTime: computed.fridaySchedule.jummahBreak.startTime24,
              endTime: computed.fridaySchedule.jummahBreak.endTime24,
              days: jummahDays
            }
          ]
        : []),
      ...customBreaks
    ];

    currentStore = {
      ...currentStore,
      timeStructure: {
        ...currentStore.timeStructure,
        ...newConfig,
        workingDays: computed.workingDays,
        dayStartTime: computed.dayStartTime,
        dayEndTime: computed.dayEndTime,
        periodLengthMinutes: computed.periodLengthMinutes,
        shortBreakEnabled: computed.shortBreakEnabled,
        shortBreakMinutes: computed.shortBreakMinutes,
        includeBreakAfterLastSlot: computed.includeBreakAfterLastSlot,
        middayBreakEnabled: computed.middayBreak.enabled,
        middayBreakMode: computed.middayBreak.mode,
        middayBreakStartTime: computed.middayBreak.startTime24,
        middayBreakDurationMinutes: computed.middayBreak.durationMinutes,
        labDurationMinutes: computed.labDurationMinutes,
        labSplitAllowed: Boolean(candidateConfig.labSplitAllowed),
        fridayEnabled: candidateConfig.fridayEnabled !== false && computed.workingDays.includes('Fri'),
        fridayStartTime: candidateConfig.fridayStartTime || computed.dayStartTime,
        fridayEndTime: candidateConfig.fridayEndTime || computed.dayEndTime,
        fridayAllowedBatches: candidateConfig.fridayAllowedBatches || [],
        fridayAllowedDepartments: candidateConfig.fridayAllowedDepartments || [],
        fridayAfternoonShiftEnabled: computed.fridayAfternoonShiftEnabled,
        fridayAfternoonStartTime: computed.fridayAfternoonStartTime,
        fridayMode: computed.fridaySchedule.mode,
        fridayBreakStartTime: computed.fridaySchedule.jummahBreak.startTime24,
        fridayBreakEndTime: computed.fridaySchedule.jummahBreak.endTime24,
        fridayClosingTime: computed.fridaySchedule.closingTime24,
        fridayCompressionScope: computed.fridaySchedule.compressionScope,
        fridayPeriodLengthMinutes: computed.fridaySchedule.fridayPeriodLengthMinutes,
        fridayShortBreakMinutes: computed.fridaySchedule.fridayShortBreakMinutes,
        periods: computed.periods,
        breaks: updatedBreaks
      }
    };

    const placedExisting = currentStore.sections.filter(s => Boolean(s.assignedSlot)).length;

    this.addAuditLog(
      'update',
      'time',
      currentStore.timeStructure.id,
      `Saved academic timing configuration: ${computed.summaryText}.`
    );
    notifyListeners();

    return {
      success: true,
      errors: [],
      placedCount: placedExisting,
      summaryText: computed.summaryText
    };
  },

  resetAcademicTimingConfig(): {
    placedCount: number;
    summaryText: string;
  } {
    const computed = computeAcademicScheduleConfig(DEFAULT_ACADEMIC_TIMING_CONFIG);
    currentStore = {
      ...currentStore,
      timeStructure: {
        ...DEFAULT_TIME_STRUCTURE,
        ...DEFAULT_ACADEMIC_TIMING_CONFIG,
        periods: computed.periods
      }
    };

    const placedExisting = currentStore.sections.filter(s => Boolean(s.assignedSlot)).length;

    this.addAuditLog(
      'restore',
      'time',
      currentStore.timeStructure.id,
      `Reset academic timing & break configuration to default baseline (${computed.summaryText}).`
    );
    notifyListeners();

    return {
      placedCount: placedExisting,
      summaryText: computed.summaryText
    };
  },

  updateTerm(id: string, updated: Partial<AcademicTerm>) {
    currentStore = {
      ...currentStore,
      terms: currentStore.terms.map(t => t.id === id ? { ...t, ...updated } : t)
    };
    this.addAuditLog('update', 'term', id, `Updated academic term parameters.`);
    notifyListeners();
  },

  addTerm(term: AcademicTerm) {
    currentStore = {
      ...currentStore,
      terms: [...currentStore.terms, term]
    };
    this.addAuditLog('create', 'term', term.id, `Created academic term ${term.name}.`);
    notifyListeners();
  },

  toggleTermActiveStatus(termId: string) {
    const target = currentStore.terms.find(t => t.id === termId);
    if (!target) return;
    const isCurrentlyActive = target.status === 'active';
    const activeCount = currentStore.terms.filter(t => t.status === 'active').length;
    if (isCurrentlyActive && activeCount <= 1) {
      // Ensure at least one semester remains active
      return;
    }
    const nextStatus = isCurrentlyActive ? 'draft' : 'active';
    const nextTerms = currentStore.terms.map(t =>
      t.id === termId ? { ...t, status: nextStatus as AcademicTerm['status'] } : t
    );
    const activeNames = nextTerms.filter(t => t.status === 'active').map(t => t.name);
    const baseProfile = currentStore.institutionProfile || getBlankInitialData().institutionProfile!;
    currentStore = {
      ...currentStore,
      terms: nextTerms,
      institutionProfile: {
        ...baseProfile,
        currentTermName: activeNames.join(' + ') || baseProfile.currentTermName,
        activeTermIds: nextTerms.filter(t => t.status === 'active').map(t => t.id)
      }
    };
    this.addAuditLog(
      'update',
      'term',
      termId,
      `${nextStatus === 'active' ? 'Activated' : 'Deactivated'} academic semester "${target.name}" (${activeNames.length} active semester(s)).`
    );
    notifyListeners();
  },

  deleteTerm(termId: string) {
    if (currentStore.terms.length <= 1) return;
    const target = currentStore.terms.find(t => t.id === termId);
    let remaining = currentStore.terms.filter(t => t.id !== termId);
    if (!remaining.some(t => t.status === 'active') && remaining.length > 0) {
      remaining = remaining.map((t, i) => (i === 0 ? { ...t, status: 'active' } : t));
    }
    const activeNames = remaining.filter(t => t.status === 'active').map(t => t.name);
    const baseProfile = currentStore.institutionProfile || getBlankInitialData().institutionProfile!;
    currentStore = {
      ...currentStore,
      terms: remaining,
      institutionProfile: {
        ...baseProfile,
        currentTermName: activeNames.join(' + ') || remaining[0]?.name,
        activeTermIds: remaining.filter(t => t.status === 'active').map(t => t.id)
      }
    };
    this.addAuditLog('delete', 'term', termId, `Deleted academic semester "${target?.name || termId}".`);
    notifyListeners();
  },

  setTimetableManagementPolicy(policy: TimetableManagementPolicy) {
    const baseProfile = currentStore.institutionProfile || getBlankInitialData().institutionProfile!;
    currentStore = {
      ...currentStore,
      institutionProfile: {
        ...baseProfile,
        timetableManagementPolicy: policy
      }
    };
    this.addAuditLog(
      'update',
      'campus',
      'timetable-policy',
      `Updated university timetable management policy to ${policy === 'whole_university' ? 'Whole-University Integrated Scheduling' : 'Department-wise Timetable Management'}.`
    );
    notifyListeners();
  },

  // 2. Departments & Programs
  addDepartment(dept: Department) {
    currentStore = {
      ...currentStore,
      departments: [...currentStore.departments, dept]
    };
    this.addAuditLog('create', 'department', dept.id, `Added academic department ${dept.name} (${dept.code}).`);
    notifyListeners();
  },

  updateDepartment(id: string, updated: Partial<Department>) {
    currentStore = {
      ...currentStore,
      departments: currentStore.departments.map(d => d.id === id ? { ...d, ...updated } : d)
    };
    this.addAuditLog('update', 'department', id, `Updated department ${updated.name || id}.`);
    notifyListeners();
  },

  deleteDepartment(id: string) {
    const target = currentStore.departments.find(d => d.id === id);
    currentStore = {
      ...currentStore,
      departments: currentStore.departments.filter(d => d.id !== id)
    };
    this.addAuditLog('delete', 'department', id, `Removed department ${target?.code || id}.`);
    notifyListeners();
  },

  // 3. Rooms
  addRoom(room: Room) {
    currentStore = {
      ...currentStore,
      rooms: [...currentStore.rooms, room]
    };
    this.addAuditLog('create', 'room', room.id, `Created room ${room.code} (${room.capacity} seats).`);
    notifyListeners();
  },

  updateRoom(id: string, updated: Partial<Room>) {
    currentStore = {
      ...currentStore,
      rooms: currentStore.rooms.map(r => r.id === id ? { ...r, ...updated } : r)
    };
    this.addAuditLog('update', 'room', id, `Updated room ${updated.code || id}.`);
    notifyListeners();
  },

  deleteRoom(id: string) {
    const target = currentStore.rooms.find(r => r.id === id);
    currentStore = {
      ...currentStore,
      rooms: currentStore.rooms.filter(r => r.id !== id)
    };
    this.addAuditLog('delete', 'room', id, `Deleted room ${target?.code || id}.`);
    notifyListeners();
  },

  // 4. Courses
  addCourse(course: Course) {
    currentStore = {
      ...currentStore,
      courses: [...currentStore.courses, course]
    };
    this.addAuditLog('create', 'course', course.id, `Created course ${course.code} — ${course.title}.`);
    notifyListeners();
  },

  updateCourse(id: string, updated: Partial<Course>) {
    currentStore = {
      ...currentStore,
      courses: currentStore.courses.map(c => c.id === id ? { ...c, ...updated } : c)
    };
    this.addAuditLog('update', 'course', id, `Updated course ${updated.code || id}.`);
    notifyListeners();
  },

  deleteCourse(id: string) {
    const target = currentStore.courses.find(c => c.id === id);
    currentStore = {
      ...currentStore,
      courses: currentStore.courses.filter(c => c.id !== id),
      sections: currentStore.sections.filter(s => s.courseId !== id)
    };
    this.addAuditLog('delete', 'course', id, `Deleted course ${target?.code || id}.`);
    notifyListeners();
  },

  // 5. Instructors
  addInstructor(instructor: Instructor) {
    currentStore = {
      ...currentStore,
      instructors: [...currentStore.instructors, instructor]
    };
    this.addAuditLog('create', 'instructor', instructor.id, `Added faculty instructor ${instructor.name}.`);
    notifyListeners();
  },

  updateInstructor(id: string, updated: Partial<Instructor>) {
    currentStore = {
      ...currentStore,
      instructors: currentStore.instructors.map(i => i.id === id ? { ...i, ...updated } : i)
    };
    this.addAuditLog('update', 'instructor', id, `Updated instructor profile & availability.`);
    notifyListeners();
  },

  deleteInstructor(id: string) {
    const target = currentStore.instructors.find(i => i.id === id);
    currentStore = {
      ...currentStore,
      instructors: currentStore.instructors.filter(i => i.id !== id)
    };
    this.addAuditLog('delete', 'instructor', id, `Deleted instructor ${target?.name || id}.`);
    notifyListeners();
  },

  toggleInstructorAvailability(instructorId: string, day: DayOfWeek, timeSlot: string) {
    const inst = currentStore.instructors.find(i => i.id === instructorId);
    if (!inst) return;

    const exists = inst.unavailableSlots.some(s => s.day === day && s.timeSlot === timeSlot);
    let updatedSlots = [...inst.unavailableSlots];

    if (exists) {
      updatedSlots = updatedSlots.filter(s => !(s.day === day && s.timeSlot === timeSlot));
    } else {
      updatedSlots.push({ day, timeSlot, reason: 'Faculty blackout' });
    }

    this.updateInstructor(instructorId, { unavailableSlots: updatedSlots });
  },

  // 6. Student Groups
  addStudentGroup(group: StudentGroup) {
    currentStore = {
      ...currentStore,
      studentGroups: [...currentStore.studentGroups, group]
    };
    this.addAuditLog('create', 'group', group.id, `Created student cohort ${group.code} (${group.size} students).`);
    notifyListeners();
  },

  updateStudentGroup(id: string, updated: Partial<StudentGroup>) {
    currentStore = {
      ...currentStore,
      studentGroups: currentStore.studentGroups.map(g => g.id === id ? { ...g, ...updated } : g)
    };
    this.addAuditLog('update', 'group', id, `Updated student group ${updated.code || id}.`);
    notifyListeners();
  },

  deleteStudentGroup(id: string) {
    const target = currentStore.studentGroups.find(g => g.id === id);
    currentStore = {
      ...currentStore,
      studentGroups: currentStore.studentGroups.filter(g => g.id !== id),
      sections: currentStore.sections.filter(s => s.studentGroupId !== id)
    };
    this.addAuditLog('delete', 'group', id, `Deleted student group ${target?.code || id}.`);
    notifyListeners();
  },

  // 7. Sections (Curriculum Mapping)
  addSection(section: Section) {
    currentStore = {
      ...currentStore,
      sections: [...currentStore.sections, section]
    };
    const course = currentStore.courses.find(c => c.id === section.courseId);
    const group = currentStore.studentGroups.find(g => g.id === section.studentGroupId);
    this.addAuditLog('create', 'section', section.id, `Created section ${course?.code || section.courseId} for cohort ${group?.code || section.studentGroupId}.`);
    notifyListeners();
  },

  deleteSection(id: string) {
    currentStore = {
      ...currentStore,
      sections: currentStore.sections.filter(s => s.id !== id)
    };
    this.addAuditLog('delete', 'section', id, `Removed section ${id}.`);
    notifyListeners();
  },

  recordImportHistory(entry: Omit<LocalImportHistoryRecord, 'id' | 'institutionId' | 'createdAt'>): LocalImportHistoryRecord {
    const record: LocalImportHistoryRecord = {
      ...entry,
      id: `imp-loc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      institutionId: currentInstitutionId,
      createdAt: new Date().toISOString()
    };
    currentStore = {
      ...currentStore,
      importHistory: [record, ...(currentStore.importHistory || [])].slice(0, 50)
    };
    notifyListeners();
    return record;
  },

  importBulkCatalogData(payload: {
    mode?: 'merge' | 'replace';
    duplicateMode?: 'skip' | 'update' | 'stop';
    skipSync?: boolean;
    departments?: Array<{ code: string; name: string; school?: string; subDepartments?: string[] }>;
    rooms?: Array<{
      code: string;
      name?: string;
      capacity: number;
      type: Room['type'];
      buildingName?: string;
      equipment?: string[];
      isAvailable?: boolean;
      assignedLabEngineerKey?: string;
    }>;
    laboratories?: Array<{
      code: string;
      name: string;
      capacity: number;
      buildingName?: string;
      labCategory?: string;
      departmentKey?: string;
      assignedLabEngineerKey?: string;
      equipment?: string[];
      isAvailable?: boolean;
    }>;
    courses?: Array<{
      code: string;
      title: string;
      creditHours?: number;
      lectureCredits?: number;
      labCredits?: number;
      weeklyContactHours?: number;
      isLab?: boolean;
      requiredRoomType?: Room['type'];
      departmentKey?: string;
      subDepartment?: string;
      assignedInstructorKey?: string;
      assignedLabEngineerKey?: string;
      labSessionMode?: Course['labSessionMode'];
      isElective?: boolean;
      electivePoolName?: string;
    }>;
    instructors?: Array<{
      name: string;
      email?: string;
      title?: string;
      staffRole?: Instructor['staffRole'];
      subDepartment?: string;
      qualifiedCourseCodes?: string[];
      maxWeeklyHours?: number;
      departmentKey?: string;
    }>;
    cohorts?: Array<{
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
    enrollments?: Array<{
      courseCode: string;
      batchCode: string;
      section?: string;
    }>;
    courseAssignments?: Array<{
      courseCode: string;
      batchCode: string;
      sectionCode?: string;
      instructorKey: string;
      labEngineerKey?: string;
      sessionType?: 'Lecture' | 'Lab';
      sessionsPerWeek?: number;
      expectedStudents?: number;
    }>;
    sectionLinks?: Array<{
      courseCode: string;
      cohortCode: string;
      instructorName?: string;
      isLab?: boolean;
    }>;
  }): {
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    departmentsAdded: number;
    roomsAdded: number;
    laboratoriesAdded: number;
    coursesAdded: number;
    instructorsAdded: number;
    cohortsAdded: number;
    enrollmentsAdded: number;
    assignmentsAdded: number;
    totalImported: number;
  } {
    const mode = payload.mode || 'merge';
    const duplicateMode: 'skip' | 'update' | 'stop' =
      payload.duplicateMode || (mode === 'replace' ? 'update' : 'skip');
    const now = Date.now();
    const palette = ['#1E3A8A', '#047857', '#B45309', '#6D28D9', '#0F766E', '#BE123C'];

    let nextDepartments = mode === 'replace' && payload.departments?.length ? [] : [...currentStore.departments];
    let nextPrograms = mode === 'replace' && payload.departments?.length ? [] : [...currentStore.programs];
    let nextBuildings = [...currentStore.buildings];
    let nextRooms = mode === 'replace' && (payload.rooms?.length || payload.laboratories?.length) ? [] : [...currentStore.rooms];
    let nextCourses = mode === 'replace' && payload.courses?.length ? [] : [...currentStore.courses];
    let nextInstructors = mode === 'replace' && payload.instructors?.length ? [] : [...currentStore.instructors];
    let nextGroups = mode === 'replace' && payload.cohorts?.length ? [] : [...currentStore.studentGroups];
    let nextSections = [...currentStore.sections];

    const ensureBuilding = (buildingName?: string): string => {
      const targetName = (buildingName || '').trim();
      if (!targetName) return nextBuildings[0]?.id || 'bld-main';
      const existing = nextBuildings.find(
        b => b.name.toLowerCase() === targetName.toLowerCase() || b.code.toLowerCase() === targetName.toLowerCase()
      );
      if (existing) return existing.id;
      const created: Building = {
        id: `bld-imp-${now}-${nextBuildings.length}`,
        campusId: currentStore.campuses[0]?.id || 'campus-main',
        name: targetName,
        code: targetName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) || `BLD${nextBuildings.length + 1}`,
        floors: 3
      };
      nextBuildings = [...nextBuildings, created];
      return created.id;
    };

    const findDept = (deptKey?: string): Department | undefined => {
      const raw = (deptKey || '').trim();
      if (!raw) return undefined;
      const low = raw.toLowerCase();
      return nextDepartments.find(d => d.code.toLowerCase() === low || d.name.toLowerCase() === low);
    };

    const ensureDepartment = (deptKey?: string, explicitName?: string, school?: string): string => {
      const rawKey = (deptKey || '').trim();
      if (!rawKey && !explicitName) {
        return nextDepartments[0]?.id || 'dept-gen';
      }
      const normKey = rawKey.toLowerCase();
      const found = nextDepartments.find(
        d =>
          d.code.toLowerCase() === normKey ||
          d.name.toLowerCase() === normKey ||
          (explicitName ? d.name.toLowerCase() === explicitName.trim().toLowerCase() : false)
      );
      if (found) return found.id;

      const cleanCode =
        (rawKey.length <= 8 ? rawKey : rawKey.split(/\s+/).map(w => w[0]).join(''))
          .replace(/[^A-Za-z0-9]/g, '')
          .toUpperCase() || `DEPT${nextDepartments.length + 1}`;
      const deptId = `dept-imp-${cleanCode.toLowerCase()}-${nextDepartments.length}`;
      nextDepartments = [
        ...nextDepartments,
        {
          id: deptId,
          code: cleanCode,
          name: (explicitName || rawKey || cleanCode).trim(),
          school: (school || 'Academic Division').trim(),
          colorHex: palette[nextDepartments.length % palette.length]
        }
      ];
      return deptId;
    };

    const ensureProgramForDept = (deptId: string): string => {
      const existing = nextPrograms.find(p => p.departmentId === deptId);
      if (existing) return existing.id;
      const dept = nextDepartments.find(d => d.id === deptId);
      const progId = `prog-imp-${dept?.code.toLowerCase() || 'gen'}-${nextPrograms.length}`;
      nextPrograms = [
        ...nextPrograms,
        {
          id: progId,
          departmentId: deptId,
          code: `BS-${dept?.code || 'GEN'}`,
          name: `${dept?.name || 'General'} Program`,
          degreeLevel: 'Undergraduate',
          totalSemesters: 8
        }
      ];
      return progId;
    };

    const findInstructor = (key?: string): Instructor | undefined => {
      const clean = (key || '').trim().toLowerCase();
      if (!clean) return undefined;
      return (
        nextInstructors.find(i => i.email.trim().toLowerCase() === clean) ||
        nextInstructors.find(i => i.name.trim().toLowerCase() === clean)
      );
    };

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const failed = 0;

    // 1. Departments
    let departmentsAdded = 0;
    (payload.departments || []).forEach(d => {
      const code = d.code.trim().toUpperCase();
      const name = d.name.trim();
      if (!code && !name) return;
      const existing = nextDepartments.find(ex => ex.code.toUpperCase() === code);
      if (!existing) {
        const createdId = ensureDepartment(code || name, name || code, d.school);
        if (d.subDepartments && d.subDepartments.length > 0) {
          nextDepartments = nextDepartments.map(dep =>
            dep.id === createdId
              ? { ...dep, subDepartments: Array.from(new Set(d.subDepartments)) }
              : dep
          );
        }
        departmentsAdded++;
        created++;
      } else if (duplicateMode === 'update') {
        const mergedSubs =
          d.subDepartments && d.subDepartments.length > 0
            ? Array.from(new Set([...(existing.subDepartments || []), ...d.subDepartments]))
            : existing.subDepartments;
        nextDepartments = nextDepartments.map(dep =>
          dep.id === existing.id
            ? {
                ...dep,
                name: name || dep.name,
                school: d.school?.trim() || dep.school,
                subDepartments: mergedSubs
              }
            : dep
        );
        updated++;
      } else {
        skipped++;
      }
    });

    // 2. Classrooms & Laboratories
    let roomsAdded = 0;
    let laboratoriesAdded = 0;
    const combinedRooms = [
      ...(payload.rooms || []).map(r => ({ ...r, _isLabCategory: r.type === 'lab' })),
      ...(payload.laboratories || []).map(l => ({
        code: l.code,
        name: l.name,
        capacity: l.capacity,
        type: 'lab' as Room['type'],
        buildingName: l.buildingName,
        equipment: l.equipment,
        isAvailable: l.isAvailable,
        assignedLabEngineerKey: l.assignedLabEngineerKey,
        _isLabCategory: true
      }))
    ];

    combinedRooms.forEach((r, idx) => {
      const code = r.code.trim().toUpperCase();
      if (!code) return;
      const bldId = ensureBuilding(r.buildingName);
      const engObj = findInstructor(r.assignedLabEngineerKey);
      const existing = nextRooms.find(ex => ex.code.toUpperCase() === code);

      if (!existing) {
        nextRooms = [
          ...nextRooms,
          {
            id: `${r._isLabCategory ? 'lab' : 'room'}-imp-${now}-${idx}`,
            name: (r.name || `${code} (${r.type === 'lab' ? 'Laboratory' : 'Lecture Hall'})`).trim(),
            code,
            capacity: Math.max(1, Number(r.capacity) || 50),
            type: r.type || 'lecture',
            buildingId: bldId,
            equipment:
              r.equipment && r.equipment.length > 0
                ? r.equipment
                : r.type === 'lab'
                ? ['Specialized Workstations', 'Safety System']
                : ['Projector', 'Whiteboard'],
            isAccessible: true,
            isAvailable: r.isAvailable ?? true,
            assignedLabEngineerId: engObj?.id
          }
        ];
        if (r._isLabCategory) laboratoriesAdded++;
        else roomsAdded++;
        created++;
      } else if (duplicateMode === 'update') {
        nextRooms = nextRooms.map(rm =>
          rm.id === existing.id
            ? {
                ...rm,
                name: (r.name || rm.name).trim(),
                capacity: Math.max(1, Number(r.capacity) || rm.capacity),
                type: r.type || rm.type,
                buildingId: bldId || rm.buildingId,
                equipment: r.equipment && r.equipment.length > 0 ? r.equipment : rm.equipment,
                isAvailable: r.isAvailable ?? rm.isAvailable,
                assignedLabEngineerId: engObj?.id ?? rm.assignedLabEngineerId
              }
            : rm
        );
        updated++;
      } else {
        skipped++;
      }
    });

    // 3. Instructors (match by email first, never fragile name alone when email exists)
    let instructorsAdded = 0;
    (payload.instructors || []).forEach((inst, idx) => {
      const name = inst.name.trim();
      const explicitEmail = inst.email?.trim().toLowerCase();
      if (!name && !explicitEmail) return;
      const email =
        explicitEmail ||
        `${name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')}@university.edu`;
      const existing = explicitEmail
        ? nextInstructors.find(i => i.email.trim().toLowerCase() === explicitEmail)
        : nextInstructors.find(i => i.name.trim().toLowerCase() === name.toLowerCase());

      const deptId = findDept(inst.departmentKey)?.id || ensureDepartment(inst.departmentKey);
      if (inst.subDepartment?.trim()) {
        const subName = inst.subDepartment.trim();
        nextDepartments = nextDepartments.map(dep =>
          dep.id === deptId
            ? { ...dep, subDepartments: Array.from(new Set([...(dep.subDepartments || []), subName])) }
            : dep
        );
      }
      const lowerTitle = (inst.title || '').toLowerCase();
      const inferredRole: StaffRole =
        inst.staffRole ||
        (lowerTitle.includes('lab') || lowerTitle.includes('demonstrator')
          ? 'lab_engineer'
          : 'faculty');
      const qualifiedIds = (inst.qualifiedCourseCodes || [])
        .map(cc => nextCourses.find(c => c.code.toUpperCase() === cc.trim().toUpperCase())?.id)
        .filter((id): id is string => Boolean(id));

      if (!existing) {
        nextInstructors = [
          ...nextInstructors,
          {
            id: `inst-imp-${now}-${idx}`,
            departmentId: deptId,
            subDepartment: inst.subDepartment?.trim() || undefined,
            staffRole: inferredRole,
            qualifiedCourseIds: qualifiedIds,
            name: name || email.split('@')[0],
            email,
            title: inst.title?.trim() || (inferredRole === 'lab_engineer' ? 'Lab Engineer' : 'Assistant Professor'),
            maxWeeklyHours: Math.max(1, Number(inst.maxWeeklyHours) || (inferredRole === 'lab_engineer' ? 18 : 14)),
            maxConsecutiveHours: 3,
            preferredDays:
              currentStore.timeStructure.workingDays?.length > 0
                ? [...currentStore.timeStructure.workingDays]
                : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            unavailableSlots: []
          }
        ];
        instructorsAdded++;
        created++;
      } else if (duplicateMode === 'update') {
        nextInstructors = nextInstructors.map(cur =>
          cur.id === existing.id
            ? {
                ...cur,
                name: name || cur.name,
                departmentId: deptId || cur.departmentId,
                subDepartment: inst.subDepartment?.trim() || cur.subDepartment,
                staffRole: inst.staffRole || cur.staffRole,
                title: inst.title?.trim() || cur.title,
                maxWeeklyHours: inst.maxWeeklyHours ? Math.max(1, Number(inst.maxWeeklyHours)) : cur.maxWeeklyHours,
                qualifiedCourseIds: qualifiedIds.length > 0 ? qualifiedIds : cur.qualifiedCourseIds
              }
            : cur
        );
        updated++;
      } else {
        skipped++;
      }
    });

    // 4. Courses
    let coursesAdded = 0;
    (payload.courses || []).forEach((c, idx) => {
      const code = c.code.trim().toUpperCase();
      const title = c.title.trim();
      if (!code) return;
      const existing = nextCourses.find(ex => ex.code.toUpperCase() === code);
      const deptId = findDept(c.departmentKey)?.id || ensureDepartment(c.departmentKey);
      const isPureLab = Boolean(c.isLab || c.requiredRoomType === 'lab' || code.endsWith('-L'));
      const lecCr =
        c.lectureCredits !== undefined
          ? Math.max(0, Number(c.lectureCredits) || 0)
          : isPureLab
          ? 0
          : Math.max(1, Number(c.creditHours) || 3);
      const labCr =
        c.labCredits !== undefined
          ? Math.max(0, Number(c.labCredits) || 0)
          : isPureLab
          ? Math.max(1, Number(c.creditHours) || 1)
          : 0;
      const lecHours = lecCr * 1;
      const labHours = labCr * 3;
      const totalCr = Math.max(1, lecCr + labCr);
      const weekly = Math.max(1, Number(c.weeklyContactHours) || lecHours + labHours);
      const assignedInst = findInstructor(c.assignedInstructorKey);
      const assignedLabEng = findInstructor(c.assignedLabEngineerKey);

      if (!existing) {
        nextCourses = [
          ...nextCourses,
          {
            id: `crs-imp-${now}-${idx}`,
            departmentId: deptId,
            subDepartment: c.subDepartment?.trim() || undefined,
            code,
            title: title || code,
            courseType: lecCr > 0 && labCr > 0 ? 'lecture_lab' : labCr > 0 ? 'lab' : 'lecture',
            creditHours: totalCr,
            lectureCredits: lecCr,
            labCredits: labCr,
            lectureHours: lecHours,
            labHours: labHours,
            weeklyContactHours: weekly,
            requiredRoomType: c.requiredRoomType || (isPureLab && lecCr === 0 ? 'lab' : 'lecture'),
            assignedInstructorId: assignedInst?.id,
            assignedLabEngineerId: assignedLabEng?.id,
            labSessionMode: c.labSessionMode || 'continuous',
            isElective: Boolean(c.isElective),
            electivePoolName: c.electivePoolName?.trim() || undefined
          }
        ];
        coursesAdded++;
        created++;
      } else if (duplicateMode === 'update') {
        nextCourses = nextCourses.map(cur =>
          cur.id === existing.id
            ? {
                ...cur,
                title: title || cur.title,
                departmentId: deptId || cur.departmentId,
                subDepartment: c.subDepartment?.trim() || cur.subDepartment,
                creditHours: totalCr,
                lectureCredits: lecCr,
                labCredits: labCr,
                lectureHours: lecHours,
                labHours: labHours,
                weeklyContactHours: weekly,
                assignedInstructorId: assignedInst?.id ?? cur.assignedInstructorId,
                assignedLabEngineerId: assignedLabEng?.id ?? cur.assignedLabEngineerId,
                isElective: c.isElective !== undefined ? Boolean(c.isElective) : cur.isElective,
                electivePoolName: c.electivePoolName?.trim() || cur.electivePoolName
              }
            : cur
        );
        updated++;
      } else {
        skipped++;
      }
    });

    // 5. Cohorts / Batches & Sections
    let cohortsAdded = 0;
    (payload.cohorts || []).forEach((g, idx) => {
      const code = g.code.trim().toUpperCase();
      if (!code) return;
      const existing = nextGroups.find(ex => ex.code.toUpperCase() === code);
      const codeParts = code.split('-');
      const deptId = findDept(g.departmentKey)?.id || ensureDepartment(g.departmentKey || (codeParts.length >= 2 ? codeParts[1] : undefined));
      const deptObj = nextDepartments.find(d => d.id === deptId);
      const programId = ensureProgramForDept(deptId);
      const batchCode = (g.batchCode || (codeParts.length >= 2 ? codeParts[0] : '')).trim().toUpperCase() || undefined;
      const section = (g.section || (codeParts.length >= 3 ? codeParts[2] : '')).trim().toUpperCase() || undefined;
      const departmentCode = (g.departmentKey || deptObj?.code || (codeParts.length >= 2 ? codeParts[1] : '')).trim().toUpperCase() || undefined;
      const resolvedName = (g.name || (batchCode && section ? `${batchCode} ${departmentCode || ''} Section ${section}`.trim() : `Cohort ${code}`)).trim();

      if (!existing) {
        nextGroups = [
          ...nextGroups,
          {
            id: `grp-imp-${now}-${idx}`,
            programId,
            batchCode,
            departmentCode,
            section,
            name: resolvedName,
            code,
            year: Math.max(1, Number(g.year) || 1),
            semester: g.semester ? Math.max(1, Number(g.semester)) : undefined,
            size: Math.max(1, Number(g.size) || 45),
            homeRoom: g.homeRoom?.trim() || undefined,
            sharedCourseIds: []
          }
        ];
        cohortsAdded++;
        created++;
      } else if (duplicateMode === 'update') {
        nextGroups = nextGroups.map(cur =>
          cur.id === existing.id
            ? {
                ...cur,
                name: g.name?.trim() || cur.name,
                departmentCode: departmentCode || cur.departmentCode,
                year: g.year ? Math.max(1, Number(g.year)) : cur.year,
                semester: g.semester ? Math.max(1, Number(g.semester)) : cur.semester,
                size: g.size ? Math.max(1, Number(g.size)) : cur.size,
                homeRoom: g.homeRoom?.trim() || cur.homeRoom
              }
            : cur
        );
        updated++;
      } else {
        skipped++;
      }
    });

    // 6. Enrollments (link courses onto studentGroups.sharedCourseIds cleanly)
    let enrollmentsAdded = 0;
    (payload.enrollments || []).forEach(enr => {
      const course = nextCourses.find(c => c.code.toUpperCase() === enr.courseCode.trim().toUpperCase());
      const group = nextGroups.find(g => g.code.toUpperCase() === enr.batchCode.trim().toUpperCase());
      if (!course || !group) return;
      const hasCourse = (group.sharedCourseIds || []).includes(course.id);
      if (!hasCourse) {
        nextGroups = nextGroups.map(g =>
          g.id === group.id
            ? { ...g, sharedCourseIds: [...(g.sharedCourseIds || []), course.id] }
            : g
        );
        enrollmentsAdded++;
        created++;
      } else {
        skipped++;
      }
    });

    // 7. Course Assignments & Section Links
    let assignmentsAdded = 0;
    const activeTerm = currentStore.terms.find(t => t.status === 'active') || currentStore.terms[0];
    const termId = activeTerm?.id || 'term-spring-2026';

    (payload.courseAssignments || []).forEach((assign, idx) => {
      const course = nextCourses.find(c => c.code.toUpperCase() === assign.courseCode.trim().toUpperCase());
      const group = nextGroups.find(g => g.code.toUpperCase() === assign.batchCode.trim().toUpperCase());
      const inst = findInstructor(assign.instructorKey);
      if (!course || !group || !inst) return;
      const labEng = findInstructor(assign.labEngineerKey);
      const secCode = (assign.sectionCode || group.section || 'A').toUpperCase();
      const sType = assign.sessionType === 'Lab' ? 'Lab' : 'Lecture';

      const existing = nextSections.find(
        s =>
          s.courseId === course.id &&
          s.studentGroupId === group.id &&
          s.sectionNumber.toUpperCase() === secCode &&
          (s.sessionType || 'Lecture') === sType
      );
      if (!existing) {
        nextSections = [
          ...nextSections,
          {
            id: `sec-imp-${now}-${idx}`,
            courseId: course.id,
            termId,
            sectionNumber: secCode,
            expectedEnrollment: assign.expectedStudents || group.size || 45,
            instructorId: inst.id,
            labEngineerId: labEng?.id,
            studentGroupId: group.id,
            sessionType: sType,
            spanSlots: sType === 'Lab' ? 3 : 1
          }
        ];
        assignmentsAdded++;
        created++;
      } else if (duplicateMode === 'update') {
        nextSections = nextSections.map(s =>
          s.id === existing.id
            ? {
                ...s,
                instructorId: inst.id,
                labEngineerId: labEng?.id ?? s.labEngineerId,
                expectedEnrollment: assign.expectedStudents || s.expectedEnrollment
              }
            : s
        );
        updated++;
      } else {
        skipped++;
      }
    });

    if (activeTerm && payload.sectionLinks && payload.sectionLinks.length > 0) {
      const existingPairKeys = new Set(
        nextSections.map(s => `${s.courseId}::${s.studentGroupId}::${s.sessionType || 'Lecture'}`)
      );
      payload.sectionLinks.forEach((link, idx) => {
        const course = nextCourses.find(c => c.code.toUpperCase() === link.courseCode.trim().toUpperCase());
        const group = nextGroups.find(g => g.code.toUpperCase() === link.cohortCode.trim().toUpperCase());
        if (!course || !group) return;
        const matchedInst = link.instructorName
          ? nextInstructors.find(i => i.name.toLowerCase() === link.instructorName!.trim().toLowerCase())
          : undefined;
        const isLab = Boolean(link.isLab || course.requiredRoomType === 'lab');
        const sessionType = isLab ? 'Lab' : 'Lecture';
        const pairKey = `${course.id}::${group.id}::${sessionType}`;
        if (existingPairKeys.has(pairKey)) return;
        existingPairKeys.add(pairKey);
        nextSections = [
          ...nextSections,
          {
            id: `sec-lnk-${now}-${idx}`,
            courseId: course.id,
            termId: activeTerm.id,
            sectionNumber: isLab ? '01-Lab' : '01-Lec',
            expectedEnrollment: Math.min(group.size, isLab ? 35 : 55),
            instructorId: isLab ? '' : (matchedInst?.id || ''),
            labEngineerId: isLab ? (matchedInst?.id || undefined) : undefined,
            assignmentStatus: matchedInst ? 'assigned' : 'unassigned',
            studentGroupId: group.id,
            sessionType,
            spanSlots: isLab ? 3 : 1
          }
        ];
      });
    }

    currentStore = {
      ...currentStore,
      buildings: nextBuildings,
      departments: nextDepartments,
      programs: nextPrograms,
      rooms: nextRooms,
      courses: nextCourses,
      instructors: nextInstructors,
      studentGroups: nextGroups,
      sections: nextSections
    };

    const totalImported = created + updated;
    this.addAuditLog(
      'create',
      'scenario',
      'bulk-csv-import',
      `Imported catalog data (${created} created, ${updated} updated, ${skipped} skipped). No timetable generated automatically.`
    );
    notifyListeners();

    return {
      created,
      updated,
      skipped,
      failed,
      departmentsAdded,
      roomsAdded,
      laboratoriesAdded,
      coursesAdded,
      instructorsAdded,
      cohortsAdded,
      enrollmentsAdded,
      assignmentsAdded,
      totalImported
    };
  },

  autoGenerateMissingSections(): number {
    let activeTerm = currentStore.terms.find(t => t.status === 'active') || currentStore.terms[0];
    if (!activeTerm) {
      activeTerm = {
        id: `term-default-1`,
        name: 'Fall Semester 2026',
        code: 'TERM-2026-1',
        startDate: '2026-09-01',
        endDate: '2026-12-31',
        status: 'active',
        weeksCount: 16
      };
      currentStore = {
        ...currentStore,
        terms: [activeTerm, ...currentStore.terms]
      };
    }
    if (currentStore.courses.length === 0 || currentStore.studentGroups.length === 0) {
      return 0;
    }

    let createdCount = 0;
    const newSections: Section[] = [...currentStore.sections];
    const now = Date.now();

    // Only honor explicit admin-assigned staff on the Course; NEVER auto-assign random or default instructors/lab engineers.
    const pickStaffForCourse = (course: Course, isLab: boolean): Instructor | undefined => {
      if (isLab && course.assignedLabEngineerId) {
        return currentStore.instructors.find(i => i.id === course.assignedLabEngineerId && i.isActive !== false);
      }
      if (!isLab && course.assignedInstructorId) {
        return currentStore.instructors.find(i => i.id === course.assignedInstructorId && i.isActive !== false);
      }
      return undefined;
    };

    const resolveGroupsForCoreCourse = (course: Course): StudentGroup[] => {
      if (course.assignedBatchId) {
        const explicitGroup = currentStore.studentGroups.find(g => g.id === course.assignedBatchId);
        if (explicitGroup) return [explicitGroup];
      }
      if (course.enrolledBatchIds && course.enrolledBatchIds.length > 0) {
        const enrSet = new Set(course.enrolledBatchIds);
        const enrGroups = currentStore.studentGroups.filter(g => enrSet.has(g.id));
        if (enrGroups.length > 0) return enrGroups;
      }

      let matched: StudentGroup[];
      if (!course.departmentId) {
        matched = currentStore.studentGroups;
      } else {
        const courseDept = currentStore.departments.find(d => d.id === course.departmentId);
        const deptMatched = currentStore.studentGroups.filter(g =>
          doesGroupMatchDepartment(
            g,
            courseDept || course.departmentId,
            currentStore.programs,
            currentStore.departments
          )
        );
        if (deptMatched.length > 0) {
          matched = deptMatched;
        } else if (currentStore.departments.length <= 1) {
          matched = currentStore.studentGroups;
        } else {
          const anyDeptMatched = currentStore.studentGroups.some(g =>
            Boolean(resolveGroupDepartmentId(g, currentStore.departments, currentStore.programs))
          );
          matched = anyDeptMatched ? [] : currentStore.studentGroups;
        }
      }

      if (course.semester && course.semester > 0 && matched.length > 0) {
        const groupsWithSem = matched.filter(g => (g.semester || 0) > 0);
        if (groupsWithSem.length > 0) {
          return groupsWithSem.filter(g => g.semester === course.semester);
        }
      }
      return matched;
    };

    // Sync explicit course instructor / lab engineer onto existing auto-generated sections so admin updates apply immediately
    newSections.forEach((sec, sIdx) => {
      const course = currentStore.courses.find(c => c.id === sec.courseId);
      if (!course) return;
      const secIsLab = sec.sessionType === 'Lab' || (sec.spanSlots && sec.spanSlots > 1);
      if (secIsLab && course.assignedLabEngineerId && sec.labEngineerId !== course.assignedLabEngineerId) {
        newSections[sIdx] = {
          ...sec,
          labEngineerId: course.assignedLabEngineerId,
          instructorId: sec.instructorId || course.assignedInstructorId || ''
        };
      } else if (!secIsLab && course.assignedInstructorId && sec.instructorId !== course.assignedInstructorId) {
        newSections[sIdx] = {
          ...sec,
          instructorId: course.assignedInstructorId
        };
      }
    });

    currentStore.courses.forEach((course, idx) => {
      const isPureLabCourse =
        course.courseType === 'lab' ||
        course.requiredRoomType === 'lab' ||
        course.code.endsWith('-L');
      const lecCredits =
        course.courseType === 'lab'
          ? 0
          : course.lectureCredits !== undefined
          ? Math.max(0, course.lectureCredits)
          : isPureLabCourse
          ? 0
          : Math.max(1, course.lectureHours > 0 ? course.lectureHours : course.creditHours || 3);
      const labCredits =
        course.courseType === 'lecture'
          ? 0
          : course.labCredits !== undefined
          ? Math.max(0, course.labCredits)
          : isPureLabCourse
          ? Math.max(1, course.creditHours || 1)
          : course.labHours > 0
          ? Math.max(1, Math.round(course.labHours / 3))
          : 0;

      if (course.isElective) {
        // Electives schedule only for enrolled cohorts (shared across all enrolled cohorts if not already mapped)
        const existingForCourse = newSections.filter(s => s.courseId === course.id);
        if (existingForCourse.length > 0) return;

        const enrolledGroups = currentStore.studentGroups.filter(g =>
          g.sharedCourseIds?.includes(course.id)
        );
        if (enrolledGroups.length === 0) return;
        const primaryGroup = enrolledGroups[0];
        const sharedGroupIds = enrolledGroups.length > 1 ? enrolledGroups.slice(1).map(g => g.id) : undefined;
        const totalEnrolled = enrolledGroups.reduce((acc, g) => acc + g.size, 0);

        const lecInst = lecCredits > 0 ? pickStaffForCourse(course, false) : undefined;
        if (lecCredits > 0) {
          const lecSlots = Math.min(6, lecCredits);
          for (let lIdx = 0; lIdx < lecSlots; lIdx++) {
            newSections.push({
              id: `sec-auto-lec-${now}-${idx}-${lIdx}`,
              courseId: course.id,
              termId: activeTerm.id,
              sectionNumber: lecSlots > 1 ? `01-Lec-${lIdx + 1}` : '01-Lec',
              expectedEnrollment: Math.min(totalEnrolled, 60),
              instructorId: lecInst?.id || '',
              assignmentStatus: lecInst ? 'assigned' : 'unassigned',
              studentGroupId: primaryGroup.id,
              sharedGroupIds,
              sessionType: 'Lecture',
              componentType: 'lecture',
              isAtomicSession: true,
              spanSlots: 1
            });
            createdCount++;
          }
        }
        if (labCredits > 0 || course.requiredRoomType === 'studio') {
          const labEng = pickStaffForCourse(course, true);
          const labBlocksCount = Math.max(1, Math.min(3, labCredits || 1));
          for (let bIdx = 0; bIdx < labBlocksCount; bIdx++) {
            newSections.push({
              id: `sec-auto-lab-${now}-${idx}-${bIdx}`,
              courseId: course.id,
              termId: activeTerm.id,
              sectionNumber: labBlocksCount > 1 ? `01-Lab-${bIdx + 1}` : '01-Lab',
              expectedEnrollment: Math.min(totalEnrolled, 40),
              instructorId: lecInst?.id || '',
              labEngineerId: labEng?.id,
              assignmentStatus: labEng ? 'partial' : 'unassigned',
              studentGroupId: primaryGroup.id,
              sharedGroupIds,
              sessionType: 'Lab',
              componentType: 'lab',
              isAtomicSession: true,
              spanSlots: 3
            });
            createdCount++;
          }
        }
        return;
      }

      // Core course: generate independent sections for matching semester/enrolled cohorts (never cross-multiply onto unrelated semesters)
      const existingExplicitForCourse = newSections.filter(
        s => s.courseId === course.id && !s.id.startsWith('sec-auto-')
      );
      const explicitGroupIds = new Set<string>();
      existingExplicitForCourse.forEach(s => {
        if (s.studentGroupId) explicitGroupIds.add(s.studentGroupId);
        s.sharedGroupIds?.forEach(gid => explicitGroupIds.add(gid));
      });
      const targetGroups =
        explicitGroupIds.size > 0
          ? currentStore.studentGroups.filter(g => explicitGroupIds.has(g.id))
          : resolveGroupsForCoreCourse(course);
      targetGroups.forEach((group, gIdx) => {
        const hasLectureSections = newSections.some(
          s =>
            s.courseId === course.id &&
            (s.studentGroupId === group.id || s.sharedGroupIds?.includes(group.id)) &&
            s.sessionType !== 'Lab' &&
            !(s.spanSlots && s.spanSlots > 1)
        );
        const hasLabSections = newSections.some(
          s =>
            s.courseId === course.id &&
            (s.studentGroupId === group.id || s.sharedGroupIds?.includes(group.id)) &&
            (s.sessionType === 'Lab' || (s.spanSlots && s.spanSlots > 1))
        );
        const secTag = group.section || `0${gIdx + 1}`;

        const lecInst = lecCredits > 0 ? pickStaffForCourse(course, false) : undefined;
        if (lecCredits > 0 && !hasLectureSections) {
          const lecSlots = Math.min(6, lecCredits);
          for (let lIdx = 0; lIdx < lecSlots; lIdx++) {
            newSections.push({
              id: `sec-auto-lec-${now}-${idx}-${gIdx}-${lIdx}`,
              courseId: course.id,
              termId: activeTerm.id,
              sectionNumber: lecSlots > 1 ? `${secTag}-Lec-${lIdx + 1}` : `${secTag}-Lec`,
              expectedEnrollment: Math.min(group.size, 60),
              instructorId: lecInst?.id || '',
              assignmentStatus: lecInst ? 'assigned' : 'unassigned',
              studentGroupId: group.id,
              programId: group.programId,
              sessionType: 'Lecture',
              componentType: 'lecture',
              isAtomicSession: true,
              spanSlots: 1
            });
            createdCount++;
          }
        }

        if ((labCredits > 0 || course.requiredRoomType === 'studio') && !hasLabSections) {
          const labEng = pickStaffForCourse(course, true);
          const labBlocksCount = Math.max(1, Math.min(3, labCredits || 1));
          for (let bIdx = 0; bIdx < labBlocksCount; bIdx++) {
            newSections.push({
              id: `sec-auto-lab-${now}-${idx}-${gIdx}-${bIdx}`,
              courseId: course.id,
              termId: activeTerm.id,
              sectionNumber: labBlocksCount > 1 ? `${secTag}-Lab-${bIdx + 1}` : `${secTag}-Lab`,
              expectedEnrollment: Math.min(group.size, 40),
              instructorId: lecInst?.id || '',
              labEngineerId: labEng?.id,
              assignmentStatus: labEng ? 'partial' : 'unassigned',
              studentGroupId: group.id,
              programId: group.programId,
              sessionType: 'Lab',
              componentType: 'lab',
              isAtomicSession: true,
              spanSlots: 3
            });
            createdCount++;
          }
        }
      });
    });

    if (createdCount > 0) {
      currentStore = {
        ...currentStore,
        sections: newSections
      };
      this.addAuditLog(
        'create',
        'section',
        'auto-sync',
        `Auto-generated ${createdCount} curriculum sections across student sections (1 cr lecture = 1h/wk faculty; 1 cr lab = 3h/wk lab engineer).`
      );
      notifyListeners();
    } else {
      currentStore = {
        ...currentStore,
        sections: newSections
      };
    }
    return createdCount;
  },

  // 8. Student-Centric Combinatorial Solver Engine (Gap Minimization, Academic Credit Rules, Friday Policy & Zero Clashes)
  runTimetableSolver(options?: {
    termId?: string;
    termIds?: string[];
    policyMode?: TimetableManagementPolicy;
    departmentId?: string;
    selectedGroupIds?: string[];
    strategyName?: string;
    forceRescheduleAll?: boolean;
  }): {
    placedCount: number;
    unplacedCount: number;
    conflictCount: number;
    roomUtilization: number;
    scenario: TimetableScenario;
  } {
    this.autoGenerateMissingSections();

    const computedTiming = computeAcademicScheduleConfig(currentStore.timeStructure);
    const days = computedTiming.workingDays.length > 0
      ? orderWorkingDaysFridayRightmost(
          computedTiming.workingDays,
          currentStore.timeStructure.fridayEnabled !== false
        )
      : (['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as DayOfWeek[]);
    const periods = computedTiming.periods.length > 0
      ? computedTiming.periods
      : UNIVERSITY_PERIODS;
    const activeLabBlocks = computedTiming.continuousLabBlocks.length > 0
      ? computedTiming.continuousLabBlocks
      : VALID_CONTINUOUS_LAB_BLOCKS;
    const fridayLabBlocks = computedTiming.fridaySchedule.isFridayWorkingDay
      ? computedTiming.fridaySchedule.continuousLabBlocks
      : [];
    const labSpanSlots = computedTiming.labSpanSlots || 3;
    const labDurationMinutes = computedTiming.labDurationMinutes || 180;
    const lectureDurationMinutes = computedTiming.periodLengthMinutes || 50;

    const validPeriodsSet = new Set(periods);
    const validFridayPeriodsSet = new Set(
      computedTiming.fridaySchedule.isFridayWorkingDay
        ? computedTiming.fridaySchedule.validBasePeriods
        : []
    );
    const validFridayLabStartsSet = new Set(fridayLabBlocks.map(b => b.startPeriod));
    const validDaysSet = new Set(days);
    const groupFilter = options?.selectedGroupIds ? new Set(options.selectedGroupIds) : null;
    const targetDeptId =
      options?.policyMode === 'department_wise' && options?.departmentId && options.departmentId !== 'all'
        ? options.departmentId
        : options?.departmentId && options.departmentId !== 'all'
        ? options.departmentId
        : null;

    const allowedFridayBatches = new Set(
      (currentStore.timeStructure.fridayAllowedBatches || []).map(x => x.toUpperCase())
    );
    const allowedFridayDepts = new Set(
      (currentStore.timeStructure.fridayAllowedDepartments || []).map(x => x.toUpperCase())
    );

    const isFridayAllowedForSection = (sec: Section): boolean => {
      if (!computedTiming.fridaySchedule.isFridayWorkingDay) return false;
      if (allowedFridayDepts.size > 0) {
        const course = currentStore.courses.find(c => c.id === sec.courseId);
        const dept = currentStore.departments.find(d => d.id === course?.departmentId);
        const matchesDept =
          (course?.departmentId && allowedFridayDepts.has(course.departmentId.toUpperCase())) ||
          (dept?.code && allowedFridayDepts.has(dept.code.toUpperCase()));
        if (!matchesDept) return false;
      }
      if (allowedFridayBatches.size > 0) {
        const gIds = [sec.studentGroupId, ...(sec.sharedGroupIds || [])].filter(Boolean);
        const matchesBatch = gIds.some(gid => {
          const grp = currentStore.studentGroups.find(g => g.id === gid);
          return (
            allowedFridayBatches.has(gid.toUpperCase()) ||
            (grp?.code && allowedFridayBatches.has(grp.code.toUpperCase())) ||
            (grp?.batchCode && allowedFridayBatches.has(grp.batchCode.toUpperCase()))
          );
        });
        if (!matchesBatch) return false;
      }
      return true;
    };

    const isSectionInDepartment = (sec: Section, deptId: string): boolean => {
      const group = currentStore.studentGroups.find(g => g.id === sec.studentGroupId);
      const prog = currentStore.programs.find(p => p.id === group?.programId);
      if (prog?.departmentId === deptId) return true;
      const course = currentStore.courses.find(c => c.id === sec.courseId);
      return course?.departmentId === deptId;
    };

    const isSectionLab = (sec: Section): boolean => {
      if (sec.sessionType === 'Lab' || (sec.spanSlots && sec.spanSlots > 1)) return true;
      if (sec.assignedSlot?.sessionType === 'Lab' || (sec.assignedSlot?.spanSlots && sec.assignedSlot.spanSlots > 1)) return true;
      if (sec.sectionNumber.toLowerCase().includes('lab')) return true;
      return false;
    };

    const getSectionGroupIds = (sec: Section): string[] => {
      const ids = [sec.studentGroupId, ...(sec.sharedGroupIds || [])].filter(Boolean);
      return Array.from(new Set(ids));
    };

    const getEffectiveLabEngineerId = (sec: Section): string => {
      const course = currentStore.courses.find(c => c.id === sec.courseId);
      if (sec.labEngineerId) return sec.labEngineerId;
      if (course?.assignedLabEngineerId) return course.assignedLabEngineerId;
      if (isSectionLab(sec)) return sec.instructorId || '';
      return '';
    };

    const sectionsToSolve: Section[] = [];
    const fixedSections: Section[] = [];

    currentStore.sections.forEach(sec => {
      const secGroups = getSectionGroupIds(sec);
      const matchesGroup = !groupFilter || secGroups.some(gid => groupFilter.has(gid));
      const matchesDept = !targetDeptId || isSectionInDepartment(sec, targetDeptId);
      const inScope = matchesGroup && matchesDept;
      const secIsLab = isSectionLab(sec);
      const slotDay = sec.assignedSlot?.day;
      const slotTime = sec.assignedSlot?.timeSlot || '';
      const hasValidExistingSlot =
        Boolean(sec.assignedSlot) &&
        validDaysSet.has(slotDay!) &&
        (slotDay === 'Fri'
          ? (isFridayAllowedForSection(sec) &&
              (secIsLab ? validFridayLabStartsSet.has(slotTime) : validFridayPeriodsSet.has(slotTime)))
          : validPeriodsSet.has(slotTime));

      if (!inScope && hasValidExistingSlot) {
        fixedSections.push(sec);
      } else if (options?.forceRescheduleAll || !hasValidExistingSlot) {
        sectionsToSolve.push(sec);
      } else if (sec.isLocked && sec.assignedSlot) {
        fixedSections.push(sec);
      } else if (inScope) {
        sectionsToSolve.push(sec);
      } else if (sec.assignedSlot) {
        fixedSections.push(sec);
      } else {
        sectionsToSolve.push(sec);
      }
    });

    // Constraint-tightness ordering (Labs first, shared electives next, then cohort/enrollment count)
    sectionsToSolve.sort((a, b) => {
      const labA = isSectionLab(a) ? 1 : 0;
      const labB = isSectionLab(b) ? 1 : 0;
      if (labA !== labB) return labB - labA;
      const sharedA = a.sharedGroupIds?.length || 0;
      const sharedB = b.sharedGroupIds?.length || 0;
      if (sharedA !== sharedB) return sharedB - sharedA;
      return (b.expectedEnrollment || 30) - (a.expectedEnrollment || 30);
    });

    // Track occupancy across covered period indices & exact clock intervals
    const usedRooms = new Map<string, Set<string>>();
    const usedInstructors = new Map<string, Set<string>>();
    const usedLabEngineers = new Map<string, Set<string>>();
    const usedGroups = new Map<string, Set<string>>();
    const groupDailySlotIndices = new Map<string, number[]>(); // `${groupId}__${day}` -> sorted period indices
    const groupDailyLoad = new Map<string, number>();
    const courseCohortDays = new Map<string, Set<DayOfWeek>>();

    const periodIndexMap = new Map<string, number>();
    periods.forEach((p, i) => periodIndexMap.set(p, i));

    const markSingleSlot = (
      day: DayOfWeek,
      period: string,
      roomId: string,
      instId: string,
      labEngId: string,
      groupIds: string[],
      courseId?: string
    ) => {
      const key = `${day}__${period}`;
      if (!usedRooms.has(key)) usedRooms.set(key, new Set());
      if (!usedInstructors.has(key)) usedInstructors.set(key, new Set());
      if (!usedLabEngineers.has(key)) usedLabEngineers.set(key, new Set());
      if (!usedGroups.has(key)) usedGroups.set(key, new Set());
      usedRooms.get(key)!.add(roomId);
      if (instId) usedInstructors.get(key)!.add(instId);
      if (labEngId) usedLabEngineers.get(key)!.add(labEngId);

      const pIdx = periodIndexMap.get(period);
      groupIds.forEach(groupId => {
        usedGroups.get(key)!.add(groupId);
        const dayKey = `${groupId}__${day}`;
        groupDailyLoad.set(dayKey, (groupDailyLoad.get(dayKey) || 0) + 1);
        if (pIdx !== undefined) {
          const arr = groupDailySlotIndices.get(dayKey) || [];
          if (!arr.includes(pIdx)) {
            arr.push(pIdx);
            arr.sort((a, b) => a - b);
            groupDailySlotIndices.set(dayKey, arr);
          }
        }
        if (courseId) {
          const ccKey = `${courseId}__${groupId}`;
          if (!courseCohortDays.has(ccKey)) courseCohortDays.set(ccKey, new Set());
          courseCohortDays.get(ccKey)!.add(day);
        }
      });
    };

    const markCoveredSlots = (
      day: DayOfWeek,
      startPeriod: string,
      spanSlots: number,
      roomId: string,
      instId: string,
      labEngId: string,
      groupIds: string[],
      courseId?: string
    ) => {
      const covered = getCoveredPeriodsForAssignment(startPeriod, spanSlots, currentStore.timeStructure, day);
      covered.forEach(p => markSingleSlot(day, p, roomId, instId, labEngId, groupIds, courseId));
    };

    const evaluateStudentGapScore = (groupIds: string[], day: DayOfWeek, coveredIndices: number[]): number => {
      if (coveredIndices.length === 0) return 0;
      const cMin = Math.min(...coveredIndices);
      const cMax = Math.max(...coveredIndices);
      let deltaScore = 0;

      groupIds.forEach(gid => {
        const existing = groupDailySlotIndices.get(`${gid}__${day}`) || [];
        if (existing.length === 0) {
          // Slight encouragement to reuse days if they already have < 4 classes, else neutral
          deltaScore += 4;
          return;
        }
        const eMin = existing[0];
        const eMax = existing[existing.length - 1];
        const isAdjacent = existing.some(e => e === cMin - 1 || e === cMax + 1);
        if (isAdjacent) {
          deltaScore += 65; // Huge reward for directly adjacent zero-gap block!
        } else {
          // Distance outside current span introduces idle gap
          const dist = cMin > eMax ? cMin - eMax - 1 : eMin > cMax ? eMin - cMax - 1 : 0;
          deltaScore -= dist * 42;
        }

        // Penalize long continuous marathon (>4 slots) without midday relief
        const projectedCount = existing.length + coveredIndices.length;
        if (projectedCount > 5) {
          deltaScore -= (projectedCount - 5) * 28;
        }
        // Slight preference for compact days (< 4 classes) before opening a 5th active day
        if (existing.length > 0 && existing.length <= 4) {
          deltaScore += 18;
        }
      });

      // Avoid very early / very late slots unless needed
      if (cMin === 0 && parseTime24ToMinutes(computedTiming.dayStartTime, 540) < 510) {
        deltaScore -= 12;
      }
      if (cMax >= periods.length - 1 && parseTime24ToMinutes(computedTiming.dayEndTime, 1020) >= 990) {
        deltaScore -= 15;
      }

      return deltaScore;
    };

    fixedSections.forEach(sec => {
      if (sec.assignedSlot) {
        const span = sec.assignedSlot.spanSlots || sec.spanSlots || (isSectionLab(sec) ? labSpanSlots : 1);
        markCoveredSlots(
          sec.assignedSlot.day,
          sec.assignedSlot.timeSlot,
          span,
          sec.assignedSlot.roomId,
          sec.instructorId,
          getEffectiveLabEngineerId(sec),
          getSectionGroupIds(sec),
          sec.courseId
        );
      }
    });

    const updatedAssignments = new Map<string, SectionSlotAssignment | undefined>();
    let placedCount = fixedSections.length;
    let unplacedCount = 0;

    const getClockBounds = (day: DayOfWeek, period: string, durMins: number) => {
      const eff = getEffectiveSlotDisplayForDay(day, period, computedTiming);
      const startMins = eff.slot?.startMinutes ?? computedTiming.slots.find(s => s.period === period)?.startMinutes ?? 540;
      const endMins = startMins + durMins;
      return {
        startMinutes: startMins,
        endMinutes: endMins,
        startTime24: minutesToTime24(startMins),
        endTime24: minutesToTime24(endMins),
        slotSource: (day === 'Fri'
          ? eff.isFridaySpecial
            ? 'friday_compressed'
            : 'friday_regular'
          : 'regular') as 'regular' | 'friday_regular' | 'friday_compressed'
      };
    };

    sectionsToSolve.forEach((sec, secIdx) => {
      const course = currentStore.courses.find(c => c.id === sec.courseId);
      const instructor = currentStore.instructors.find(i => i.id === sec.instructorId);
      const labEngId = getEffectiveLabEngineerId(sec);
      const labEngineer = labEngId ? currentStore.instructors.find(i => i.id === labEngId) : undefined;
      const secGroupIds = getSectionGroupIds(sec);
      const isLab = isSectionLab(sec);
      const reqType = isLab
        ? (course?.requiredRoomType === 'studio' ? 'studio' : 'lab')
        : (course?.requiredRoomType === 'seminar' ? 'seminar' : 'lecture');
      const minCap = sec.expectedEnrollment || 25;

      // Strict room type and capacity compliance (no placing Labs in lecture halls if labs exist, and enforce capacity)
      const exactRooms = currentStore.rooms.filter(
        r => r.isAvailable !== false && r.type === reqType && r.capacity >= minCap
      );
      const typeRooms = currentStore.rooms.filter(
        r => r.isAvailable !== false && r.type === reqType
      );
      const candidateRooms = exactRooms.length > 0
        ? exactRooms
        : typeRooms.length > 0
        ? typeRooms
        : currentStore.rooms.filter(r => r.isAvailable !== false && r.capacity >= minCap);

      const sortedRooms = [...candidateRooms].sort((a, b) => a.capacity - b.capacity);
      const friAllowed = isFridayAllowedForSection(sec);

      let assigned: SectionSlotAssignment | undefined = undefined;

      if (isLab) {
        const labCandidates: Array<{ day: DayOfWeek; block: ContinuousLabBlockMeta; score: number }> = [];
        days.forEach((day, dIdx) => {
          if (day === 'Fri' && !friAllowed) return;
          const dayBlocks = day === 'Fri' ? fridayLabBlocks : activeLabBlocks;
          dayBlocks.forEach((block, bIdx) => {
            const covIndices = block.coveredPeriods
              .map(p => periodIndexMap.get(p))
              .filter((idx): idx is number => idx !== undefined);
            let score = 100 + evaluateStudentGapScore(secGroupIds, day, covIndices);
            const maxDayLoad = Math.max(...secGroupIds.map(gid => groupDailyLoad.get(`${gid}__${day}`) || 0), 0);
            score -= maxDayLoad * 12;
            score += ((secIdx + dIdx * 3 + bIdx * 5) % 7);
            labCandidates.push({ day, block, score });
          });
        });
        labCandidates.sort((a, b) => b.score - a.score);

        for (const cand of labCandidates) {
          const block = cand.block;
          const covered = block.coveredPeriods;
          const blockSpan = block.spanSlots || covered.length || labSpanSlots;

          const instBlackout = instructor?.unavailableSlots.some(
            u => u.day === cand.day && covered.includes(u.timeSlot)
          );
          const engBlackout = labEngineer?.unavailableSlots.some(
            u => u.day === cand.day && covered.includes(u.timeSlot)
          );
          if (instBlackout || engBlackout) continue;

          const instBusy = sec.instructorId
            ? covered.some(p => usedInstructors.get(`${cand.day}__${p}`)?.has(sec.instructorId))
            : false;
          const engBusy = labEngId
            ? covered.some(p => usedLabEngineers.get(`${cand.day}__${p}`)?.has(labEngId) || usedInstructors.get(`${cand.day}__${p}`)?.has(labEngId))
            : false;
          if (instBusy || engBusy) continue;

          const groupBusy = covered.some(p =>
            secGroupIds.some(gid => usedGroups.get(`${cand.day}__${p}`)?.has(gid))
          );
          if (groupBusy) continue;

          const freeRoom = sortedRooms.find(r =>
            covered.every(p => !usedRooms.get(`${cand.day}__${p}`)?.has(r.id))
          );

          if (freeRoom) {
            const dur = block.durationMinutes || labDurationMinutes;
            const clock = getClockBounds(cand.day, block.startPeriod, dur);
            assigned = {
              day: cand.day,
              timeSlot: block.startPeriod,
              roomId: freeRoom.id,
              durationMinutes: dur,
              sessionType: 'Lab',
              spanSlots: blockSpan,
              continuousTimeLabel: block.continuousLabel,
              ...clock
            };
            markCoveredSlots(cand.day, block.startPeriod, blockSpan, freeRoom.id, sec.instructorId, labEngId, secGroupIds, sec.courseId);
            break;
          }
        }
      } else {
        const slotCandidates: Array<{ day: DayOfWeek; period: string; durationMinutes: number; score: number }> = [];
        days.forEach((day, dIdx) => {
          if (day === 'Fri' && !friAllowed) return;
          const dayPeriods =
            day === 'Fri'
              ? computedTiming.fridaySchedule.validBasePeriods
              : periods;
          const alreadyHasSameCourseOnDay = secGroupIds.some(gid =>
            courseCohortDays.get(`${sec.courseId}__${gid}`)?.has(day)
          );
          dayPeriods.forEach((period, pIdx) => {
            const eff = getEffectiveSlotDisplayForDay(day, period, computedTiming);
            if (!eff.isOpen) return;
            const mapIdx = periodIndexMap.get(period) ?? pIdx;
            let score = 100 + evaluateStudentGapScore(secGroupIds, day, [mapIdx]);
            const maxDayLoad = Math.max(...secGroupIds.map(gid => groupDailyLoad.get(`${gid}__${day}`) || 0), 0);
            score -= maxDayLoad * 8;
            if (alreadyHasSameCourseOnDay) score -= 65;
            if (pIdx <= 3) score += 10;
            score += ((secIdx + dIdx * 3 + pIdx * 2) % 7);
            slotCandidates.push({ day, period, durationMinutes: eff.durationMinutes || lectureDurationMinutes, score });
          });
        });

        slotCandidates.sort((a, b) => b.score - a.score);

        for (const slot of slotCandidates) {
          const key = `${slot.day}__${slot.period}`;

          const isBlackedOut = instructor?.unavailableSlots.some(
            u => u.day === slot.day && u.timeSlot === slot.period
          );
          if (isBlackedOut) continue;

          if (sec.instructorId && usedInstructors.get(key)?.has(sec.instructorId)) continue;
          if (secGroupIds.some(gid => usedGroups.get(key)?.has(gid))) continue;

          const freeRoom = sortedRooms.find(r => !usedRooms.get(key)?.has(r.id));
          if (freeRoom) {
            const clock = getClockBounds(slot.day, slot.period, slot.durationMinutes);
            assigned = {
              day: slot.day,
              timeSlot: slot.period,
              roomId: freeRoom.id,
              durationMinutes: slot.durationMinutes,
              sessionType: 'Lecture',
              spanSlots: 1,
              ...clock
            };
            markSingleSlot(slot.day, slot.period, freeRoom.id, sec.instructorId, labEngId, secGroupIds, sec.courseId);
            break;
          }
        }
      }

      if (assigned) {
        placedCount++;
        updatedAssignments.set(sec.id, assigned);
      } else {
        unplacedCount++;
        updatedAssignments.set(sec.id, undefined);
      }
    });

    const newSections = currentStore.sections.map(sec => {
      if (updatedAssignments.has(sec.id)) {
        const assigned = updatedAssignments.get(sec.id);
        return {
          ...sec,
          sessionType: assigned?.sessionType || sec.sessionType || 'Lecture',
          spanSlots: assigned?.spanSlots || sec.spanSlots || 1,
          assignedSlot: assigned
        };
      }
      return sec;
    });

    // Compute genuine average student idle gap & compactness score across scheduled cohorts
    let totalGapSlots = 0;
    let totalCohortDays = 0;
    groupDailySlotIndices.forEach(indices => {
      if (indices.length <= 1) return;
      totalCohortDays++;
      for (let i = 1; i < indices.length; i++) {
        const diff = indices[i] - indices[i - 1] - 1;
        if (diff > 0) totalGapSlots += diff;
      }
    });
    const avgGapSlots = totalCohortDays > 0 ? totalGapSlots / totalCohortDays : 0;
    const transitCompactness = Math.max(40, Math.min(100, Number((100 - avgGapSlots * 18).toFixed(1))));

    const totalPossibleRoomSlots = Math.max(1, currentStore.rooms.length * days.length * periods.length);
    const roomUtilization = Math.min(98.4, Math.max(12.0, Number(((placedCount / totalPossibleRoomSlots) * 100).toFixed(1))));
    const conflictCount = unplacedCount;
    const isFeasible = conflictCount === 0 && unplacedCount === 0;
    const satisfactionScore = isFeasible
      ? Math.max(60, Math.min(99.8, Number((90 + transitCompactness * 0.095).toFixed(1))))
      : Math.max(30, Number((75 - unplacedCount * 8).toFixed(1)));

    const activeTerm = currentStore.terms.find(t => t.id === options?.termId) ||
      currentStore.terms.find(t => t.status === 'active') ||
      currentStore.terms[0];

    const assignmentsMap: Record<string, SectionSlotAssignment> = {};
    newSections.forEach(s => {
      if (s.assignedSlot) assignmentsMap[s.id] = s.assignedSlot;
    });

    const newScenario: TimetableScenario = {
      id: `scen-${Date.now()}`,
      termId: activeTerm?.id || 'term-spring-2026',
      name: options?.strategyName || `Master Allocation Run #${currentStore.scenarios.length + 1}`,
      version: `v${currentStore.scenarios.length + 1}.0`,
      status: isFeasible ? 'published' : 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: currentStore.institutionProfile?.registrarName || getStoredUser()?.name || 'Administrator',
      metrics: {
        clashCount: conflictCount,
        satisfactionScore,
        roomUtilizationPercent: roomUtilization,
        instructorSatisfaction: isFeasible ? 97.5 : 80.0,
        studentTransitScore: transitCompactness
      },
      assignments: assignmentsMap
    };

    currentStore = {
      ...currentStore,
      sections: newSections,
      scenarios: [newScenario, ...currentStore.scenarios]
    };

    this.addAuditLog(
      'generate',
      'scenario',
      newScenario.id,
      `Generated timetable "${newScenario.name}": ${placedCount} sections placed, ${unplacedCount} unplaced, ${conflictCount} conflicts (${isFeasible ? 'published' : 'draft'}).`
    );
    notifyListeners();

    return {
      placedCount,
      unplacedCount,
      conflictCount,
      roomUtilization,
      scenario: newScenario
    };
  },

  restoreScenario(scenarioId: string): { success: boolean; message: string } {
    const target = currentStore.scenarios.find(sc => sc.id === scenarioId);
    if (!target) return { success: false, message: 'Timetable version not found.' };

    if ((target.metrics?.clashCount ?? 0) > 0) {
      return {
        success: false,
        message: `Cannot publish "${target.name}" (${target.version}) while ${target.metrics.clashCount} hard conflict(s) remain. Resolve conflicts first.`
      };
    }

    const hasAssignments = target.assignments && Object.keys(target.assignments).length > 0;
    const updatedSections = hasAssignments
      ? currentStore.sections.map(sec => {
          const savedSlot = target.assignments[sec.id];
          return savedSlot ? { ...sec, assignedSlot: savedSlot } : sec;
        })
      : currentStore.sections;

    const updatedScenarios = currentStore.scenarios.map(sc => {
      if (sc.id === scenarioId) {
        return { ...sc, status: 'published' as const, updatedAt: new Date().toISOString() };
      }
      if (sc.status === 'published') {
        return { ...sc, status: 'archived' as const };
      }
      return sc;
    });

    currentStore = {
      ...currentStore,
      sections: updatedSections,
      scenarios: updatedScenarios
    };

    this.addAuditLog(
      'restore',
      'scenario',
      scenarioId,
      `Restored timetable version "${target.name}" (${target.version}) as active published baseline.`
    );
    notifyListeners();
    return {
      success: true,
      message: `Restored ${target.version} (${target.name}) as the active published timetable baseline.`
    };
  },

  // 9. Constraints & Rules
  toggleConstraint(id: string, enabled: boolean) {
    currentStore = {
      ...currentStore,
      constraints: currentStore.constraints.map(c => c.id === id ? { ...c, enabled } : c)
    };
    this.addAuditLog('update', 'constraint', id, `${enabled ? 'Enabled' : 'Disabled'} scheduling rule.`);
    notifyListeners();
  },

  updateConstraintWeight(id: string, weight: number) {
    currentStore = {
      ...currentStore,
      constraints: currentStore.constraints.map(c => c.id === id ? { ...c, weight } : c)
    };
    notifyListeners();
  },

  addConstraint(rule: ConstraintRule) {
    currentStore = {
      ...currentStore,
      constraints: [...currentStore.constraints, rule]
    };
    this.addAuditLog('create', 'constraint', rule.id, `Added custom scheduling rule "${rule.name}".`);
    notifyListeners();
  },

  // 10. Section assignments (Moving/editing blocks in Timetable)
  updateSectionSlot(sectionId: string, slot?: { day: DayOfWeek; timeSlot: string; roomId: string }) {
    const computedTiming = computeAcademicScheduleConfig(currentStore.timeStructure);
    const activeLabBlocks = computedTiming.continuousLabBlocks.length > 0
      ? computedTiming.continuousLabBlocks
      : VALID_CONTINUOUS_LAB_BLOCKS;

    currentStore = {
      ...currentStore,
      sections: currentStore.sections.map(s => {
        if (s.id !== sectionId) return s;
        if (!slot) return { ...s, assignedSlot: undefined };

        const isLab =
          s.sessionType === 'Lab' ||
          (s.spanSlots && s.spanSlots > 1) ||
          s.assignedSlot?.sessionType === 'Lab' ||
          (s.assignedSlot?.spanSlots && s.assignedSlot.spanSlots > 1);
        if (isLab) {
          const dayBlocks =
            slot.day === 'Fri' && computedTiming.fridaySchedule.continuousLabBlocks.length > 0
              ? computedTiming.fridaySchedule.continuousLabBlocks
              : activeLabBlocks;
          const matchedLabBlock =
            getLabBlockByStartPeriod(slot.timeSlot, currentStore.timeStructure, slot.day) ||
            dayBlocks[0];
          const labSpan = matchedLabBlock.spanSlots || computedTiming.labSpanSlots || 3;
          return {
            ...s,
            sessionType: 'Lab',
            spanSlots: labSpan,
            assignedSlot: {
              day: slot.day,
              timeSlot: matchedLabBlock.startPeriod,
              roomId: slot.roomId,
              durationMinutes: matchedLabBlock.durationMinutes || computedTiming.labDurationMinutes || 180,
              sessionType: 'Lab',
              spanSlots: labSpan,
              continuousTimeLabel: matchedLabBlock.continuousLabel
            }
          };
        }

        const effSlot = getEffectiveSlotDisplayForDay(slot.day, slot.timeSlot, computedTiming);
        return {
          ...s,
          sessionType: 'Lecture',
          spanSlots: 1,
          assignedSlot: {
            day: slot.day,
            timeSlot: slot.timeSlot,
            roomId: slot.roomId,
            durationMinutes: effSlot.durationMinutes || computedTiming.periodLengthMinutes || 50,
            sessionType: 'Lecture',
            spanSlots: 1
          }
        };
      })
    };

    this._syncLatestScenarioFromSections();
    this.addAuditLog(
      'update',
      'section',
      sectionId,
      slot ? `Moved section to ${slot.day} ${slot.timeSlot} in room ${slot.roomId}.` : `Unassigned section slot.`
    );
    notifyListeners();
  },

  _syncLatestScenarioFromSections() {
    if (currentStore.scenarios.length === 0) return;
    const computedTiming = computeAcademicScheduleConfig(currentStore.timeStructure);
    const placedMap: Record<string, SectionSlotAssignment> = {};
    const occupiedIntervals: Array<{
      secId: string;
      day: DayOfWeek;
      start: number;
      end: number;
      roomId: string;
      staffIds: string[];
      groupIds: string[];
    }> = [];

    currentStore.sections.forEach(sec => {
      if (!sec.assignedSlot) return;
      placedMap[sec.id] = sec.assignedSlot;
      const isLab = sec.sessionType === 'Lab' || sec.assignedSlot.sessionType === 'Lab' || (sec.spanSlots || 1) > 1;
      const eff = getEffectiveSlotDisplayForDay(sec.assignedSlot.day, sec.assignedSlot.timeSlot, computedTiming);
      const start =
        eff.slot?.startMinutes ??
        computedTiming.slots.find(s => s.period === sec.assignedSlot!.timeSlot)?.startMinutes ??
        540;
      const dur = sec.assignedSlot.durationMinutes || (isLab ? computedTiming.labDurationMinutes : computedTiming.periodLengthMinutes);
      const staffIds = isLab
        ? Array.from(new Set([sec.labEngineerId || sec.instructorId].filter(Boolean))) as string[]
        : Array.from(new Set([sec.instructorId].filter(Boolean))) as string[];
      const groupIds = Array.from(new Set([sec.studentGroupId, ...(sec.sharedGroupIds || [])].filter(Boolean)));
      occupiedIntervals.push({
        secId: sec.id,
        day: sec.assignedSlot.day,
        start,
        end: start + dur,
        roomId: sec.assignedSlot.roomId,
        staffIds,
        groupIds
      });
    });

    let clashCount = 0;
    for (let i = 0; i < occupiedIntervals.length; i++) {
      const a = occupiedIntervals[i];
      for (let j = i + 1; j < occupiedIntervals.length; j++) {
        const b = occupiedIntervals[j];
        if (a.day !== b.day) continue;
        if (!(a.start < b.end && b.start < a.end)) continue;
        if (a.roomId && a.roomId === b.roomId) clashCount++;
        if (a.staffIds.some(id => b.staffIds.includes(id))) clashCount++;
        if (a.groupIds.some(id => b.groupIds.includes(id))) clashCount++;
      }
    }

    const head = currentStore.scenarios[0];
    currentStore = {
      ...currentStore,
      scenarios: [
        {
          ...head,
          updatedAt: new Date().toISOString(),
          assignments: placedMap,
          metrics: {
            ...head.metrics,
            clashCount
          }
        },
        ...currentStore.scenarios.slice(1)
      ]
    };
  },

  toggleSectionLock(sectionId: string) {
    currentStore = {
      ...currentStore,
      sections: currentStore.sections.map(s => s.id === sectionId ? { ...s, isLocked: !s.isLocked } : s)
    };
    notifyListeners();
  },

  // 11. Feedback Polls & Requests
  voteFeedbackPoll(pollId: string, vote: 'approve' | 'revise') {
    const currentPolls = currentStore.feedbackPolls || [];
    currentStore = {
      ...currentStore,
      feedbackPolls: currentPolls.map(p => {
        if (p.id !== pollId) return p;
        if (p.userVote === vote) return p;
        const prev = p.userVote;
        return {
          ...p,
          userVote: vote,
          votesApprove: vote === 'approve' ? p.votesApprove + 1 : (prev === 'approve' ? p.votesApprove - 1 : p.votesApprove),
          votesRevise: vote === 'revise' ? p.votesRevise + 1 : (prev === 'revise' ? p.votesRevise - 1 : p.votesRevise)
        };
      })
    };
    notifyListeners();
  },

  addFeedbackPoll(item: Omit<FeedbackPollItem, 'id' | 'votesApprove' | 'votesRevise' | 'createdAt' | 'userVote'>) {
    const currentPolls = currentStore.feedbackPolls || [];
    const newPoll: FeedbackPollItem = {
      ...item,
      id: `poll-${Date.now()}`,
      votesApprove: 1,
      votesRevise: 0,
      userVote: 'approve',
      createdAt: new Date().toISOString().split('T')[0]
    };
    currentStore = {
      ...currentStore,
      feedbackPolls: [newPoll, ...currentPolls]
    };
    notifyListeners();
  },

  // 11b. Interactive Swap & Drag Validation
  swapSectionSlots(sectionIdA: string, sectionIdB: string): { success: boolean; message: string } {
    const secA = currentStore.sections.find(s => s.id === sectionIdA);
    const secB = currentStore.sections.find(s => s.id === sectionIdB);
    if (!secA || !secB) return { success: false, message: 'Sections not found.' };

    const slotA = secA.assignedSlot;
    const slotB = secB.assignedSlot;

    currentStore = {
      ...currentStore,
      sections: currentStore.sections.map(s => {
        if (s.id === sectionIdA) {
          if (!slotB) return { ...s, assignedSlot: undefined };
          return {
            ...s,
            assignedSlot: {
              ...slotB,
              roomId: slotB.roomId || s.assignedSlot?.roomId || '',
              sessionType: s.sessionType || slotB.sessionType,
              spanSlots: s.spanSlots || slotB.spanSlots
            }
          };
        }
        if (s.id === sectionIdB) {
          if (!slotA) return { ...s, assignedSlot: undefined };
          return {
            ...s,
            assignedSlot: {
              ...slotA,
              roomId: slotA.roomId || s.assignedSlot?.roomId || '',
              sessionType: s.sessionType || slotA.sessionType,
              spanSlots: s.spanSlots || slotA.spanSlots
            }
          };
        }
        return s;
      })
    };
    this._syncLatestScenarioFromSections();
    const courseA = currentStore.courses.find(c => c.id === secA.courseId)?.code || secA.courseId;
    const courseB = currentStore.courses.find(c => c.id === secB.courseId)?.code || secB.courseId;
    this.addAuditLog('update', 'section', `${sectionIdA}_${sectionIdB}`, `Swapped slots between ${courseA} and ${courseB}.`);
    notifyListeners();
    return { success: true, message: `Successfully swapped ${courseA} and ${courseB}.` };
  },

  validateSlotMoveOrSwap(
    sectionId: string,
    targetDay: DayOfWeek,
    targetPeriod: string,
    targetRoomId?: string,
    swapTargetSectionId?: string
  ): {
    valid: boolean;
    hasConflicts: boolean;
    conflicts: Array<{ type: 'instructor' | 'cohort' | 'room' | 'lunch' | 'lab_boundary'; message: string; severity: 'hard' | 'warning' }>;
  } {
    const sec = currentStore.sections.find(s => s.id === sectionId);
    if (!sec) return { valid: false, hasConflicts: true, conflicts: [{ type: 'cohort', message: 'Section not found', severity: 'hard' }] };

    const conflicts: Array<{ type: 'instructor' | 'cohort' | 'room' | 'lunch' | 'lab_boundary'; message: string; severity: 'hard' | 'warning' }> = [];
    const instructor = currentStore.instructors.find(i => i.id === sec.instructorId);
    const cohort = currentStore.studentGroups.find(g => g.id === sec.studentGroupId);
    const room = currentStore.rooms.find(r => r.id === targetRoomId);
    const isLab = sec.sessionType === 'Lab' || Boolean(sec.spanSlots && sec.spanSlots > 1);

    const computedTiming = computeAcademicScheduleConfig(currentStore.timeStructure);

    // 1. Check Midday Lunch Break & Friday / Jummah Prayer Restrictions
    if (targetDay === 'Fri') {
      const friInfo = getEffectiveSlotDisplayForDay('Fri', targetPeriod, computedTiming);
      if (!friInfo.isOpen) {
        const fri = computedTiming.fridaySchedule;
        conflicts.push({
          type: 'lunch',
          message:
            fri.mode === 'morning_only'
              ? `Friday is Morning-Only (${fri.operatingHoursLabel}) — afternoon slots are closed before Jummah Prayer.`
              : `Slot "${targetPeriod}" is unavailable on Friday due to the Jummah Prayer break (${fri.jummahBreak.fullRangeLabel}) / Friday schedule limits.`,
          severity: 'hard'
        });
      }
    } else if (computedTiming.middayBreak.enabled) {
      const lunchRange = computedTiming.middayBreak.timeRangeLabel;
      if (targetPeriod.includes('13:') || targetPeriod.includes('1:00') || targetPeriod === lunchRange) {
        conflicts.push({
          type: 'lunch',
          message: `Target period falls inside the protected University Midday/Lunch Break (${lunchRange}).`,
          severity: 'warning'
        });
      }
    }

    // 2. Check Continuous Lab boundary (respecting Friday Jummah split)
    if (isLab) {
      const validLabBlock = getLabBlockByStartPeriod(targetPeriod, currentStore.timeStructure, targetDay);
      if (!validLabBlock) {
        conflicts.push({
          type: 'lab_boundary',
          message:
            targetDay === 'Fri'
              ? `Selected period "${targetPeriod}" cannot host a continuous lab on Friday without crossing the Jummah Prayer break or closing time.`
              : `Selected period "${targetPeriod}" is not a standard continuous lab start block.`,
          severity: 'warning'
        });
      }
    }

    // Other scheduled sections occupying this slot (excluding self and swap target)
    const sectionsAtTarget = currentStore.sections.filter(s => {
      if (s.id === sectionId || s.id === swapTargetSectionId) return false;
      if (!s.assignedSlot) return false;
      if (s.assignedSlot.day !== targetDay) return false;
      const covered = getCoveredPeriodsForAssignment(
        s.assignedSlot.timeSlot,
        s.assignedSlot.spanSlots || (s.sessionType === 'Lab' ? 3 : 1),
        currentStore.timeStructure,
        targetDay
      );
      return covered.includes(targetPeriod);
    });

    // 3. Check Instructor & Lab Engineer Collision
    const secCourse = currentStore.courses.find(c => c.id === sec.courseId);
    const secLabEngId = sec.labEngineerId || secCourse?.assignedLabEngineerId || (isLab ? sec.instructorId : '');
    const labEng = secLabEngId ? currentStore.instructors.find(i => i.id === secLabEngId) : undefined;

    if (sec.instructorId) {
      const instConflict = sectionsAtTarget.find(
        s => s.instructorId === sec.instructorId || s.labEngineerId === sec.instructorId
      );
      if (instConflict) {
        const otherCourse = currentStore.courses.find(c => c.id === instConflict.courseId);
        conflicts.push({
          type: 'instructor',
          message: `Instructor ${instructor?.name || 'Faculty member'} is already teaching ${otherCourse?.code || 'another section'} at ${targetDay} ${targetPeriod}.`,
          severity: 'hard'
        });
      }
      if (instructor?.unavailableSlots?.some(u => u.day === targetDay && u.timeSlot === targetPeriod)) {
        conflicts.push({
          type: 'instructor',
          message: `${instructor?.name || 'Faculty member'} has blocked ${targetDay} ${targetPeriod} for research or department meetings.`,
          severity: 'warning'
        });
      }
    }

    if (secLabEngId) {
      const engConflict = sectionsAtTarget.find(
        s => s.labEngineerId === secLabEngId || s.instructorId === secLabEngId
      );
      if (engConflict) {
        const otherCourse = currentStore.courses.find(c => c.id === engConflict.courseId);
        conflicts.push({
          type: 'instructor',
          message: `Lab Engineer ${labEng?.name || 'Staff'} is already supervising ${otherCourse?.code || 'another lab'} at ${targetDay} ${targetPeriod}.`,
          severity: 'hard'
        });
      }
    }

    // 4. Check Cohort Collision (including sharedGroupIds for cross-cohort electives)
    const secGroups = [sec.studentGroupId, ...(sec.sharedGroupIds || [])].filter(Boolean);
    if (secGroups.length > 0) {
      const cohortConflict = sectionsAtTarget.find(s => {
        const otherGroups = [s.studentGroupId, ...(s.sharedGroupIds || [])].filter(Boolean);
        return otherGroups.some(og => secGroups.includes(og));
      });
      if (cohortConflict) {
        const otherCourse = currentStore.courses.find(c => c.id === cohortConflict.courseId);
        const overlappingGroupId = [cohortConflict.studentGroupId, ...(cohortConflict.sharedGroupIds || [])].find(og =>
          secGroups.includes(og)
        );
        const overlappingCohort = currentStore.studentGroups.find(g => g.id === overlappingGroupId) || cohort;
        conflicts.push({
          type: 'cohort',
          message: `Cohort ${overlappingCohort?.code || 'Class'} already has ${otherCourse?.code || 'another session'} scheduled at ${targetDay} ${targetPeriod}.`,
          severity: 'hard'
        });
      }
    }

    // 5. Check Room Collision
    if (targetRoomId) {
      const roomConflict = sectionsAtTarget.find(s => s.assignedSlot?.roomId === targetRoomId);
      if (roomConflict) {
        const otherCourse = currentStore.courses.find(c => c.id === roomConflict.courseId);
        const otherCohort = currentStore.studentGroups.find(g => g.id === roomConflict.studentGroupId);
        conflicts.push({
          type: 'room',
          message: `Room ${room?.code || targetRoomId} is occupied by ${otherCourse?.code || 'another section'} (${otherCohort?.code || ''}) at ${targetDay} ${targetPeriod}.`,
          severity: 'hard'
        });
      }
      if (room && isLab && room.type !== 'lab' && room.type !== 'studio') {
        conflicts.push({
          type: 'room',
          message: `Selected room "${room.code}" is a standard lecture hall, but this course requires a specialized Laboratory.`,
          severity: 'warning'
        });
      }
    }

    return {
      valid: conflicts.filter(c => c.severity === 'hard').length === 0,
      hasConflicts: conflicts.length > 0,
      conflicts
    };
  },

  updateInstructorPreferences(instructorId: string, updates: Partial<Instructor>) {
    currentStore = {
      ...currentStore,
      instructors: currentStore.instructors.map(i => {
        if (i.id !== instructorId) return i;
        return {
          ...i,
          ...updates
        };
      })
    };
    const inst = currentStore.instructors.find(i => i.id === instructorId);
    this.addAuditLog('update', 'instructor', instructorId, `Updated teaching preferences & availability for ${inst?.name || instructorId}.`);
    notifyListeners();
  },

  // 12. Audit Logs
  addAuditLog(action: any, entityType: any, entityId: string, summary: string) {
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      userId: getStoredUser()?.id || 'user-admin',
      userName: currentStore?.institutionProfile?.registrarName || getStoredUser()?.name || 'Administrator',
      action,
      entityType,
      entityId,
      summary
    };
    currentStore = {
      ...currentStore,
      auditLogs: [entry, ...currentStore.auditLogs.slice(0, 99)]
    };
  },

  // 13. Backend Sync & Hydration Helpers
  registerRemoteInstitutions(remoteInstitutions: RegisteredInstitutionDTO[], replaceExisting = false) {
    if (!Array.isArray(remoteInstitutions)) return;
    if (replaceExisting) {
      registeredInstitutionsMap.clear();
    }
    remoteInstitutions.forEach(remote => {
      if (!remote.id || !remote.name || LEGACY_SAMPLE_INST_IDS.has(remote.id) || remote.isSample || remote.isDemoTemplate) return;
      const prev = registeredInstitutionsMap.get(remote.id);
      registeredInstitutionsMap.set(remote.id, {
        id: remote.id,
        name: remote.name,
        code: remote.code || prev?.code || 'UNIV',
        campusName: remote.campusName || prev?.campusName || 'Main Campus',
        accreditation: remote.accreditation || prev?.accreditation,
        isSample: false,
        workingDays: (remote.workingDays as DayOfWeek[] | undefined) || prev?.workingDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        dayStartTime: remote.dayStartTime || prev?.dayStartTime || '09:00',
        dayEndTime: remote.dayEndTime || prev?.dayEndTime || '17:00',
        periodLengthMinutes: remote.periodLengthMinutes || prev?.periodLengthMinutes || 50,
        shortBreakMinutes: remote.shortBreakMinutes ?? prev?.shortBreakMinutes ?? 10,
        middayBreakEnabled: remote.middayBreakEnabled ?? prev?.middayBreakEnabled ?? true,
        middayBreakStart: remote.middayBreakStart || prev?.middayBreakStart || '13:00',
        middayBreakDuration: remote.middayBreakDuration || prev?.middayBreakDuration || 60,
        labDurationMinutes: remote.labDurationMinutes || prev?.labDurationMinutes || 180,
        isDemoTemplate: false
      });
    });
    listeners.forEach(fn => fn());
  },

  setConstraints(constraints: ConstraintRule[]) {
    currentStore = {
      ...currentStore,
      constraints
    };
    notifyListeners();
  },

  setFeedbackPolls(polls: FeedbackPollItem[]) {
    currentStore = {
      ...currentStore,
      feedbackPolls: polls
    };
    notifyListeners();
  },

  upsertFeedbackPoll(poll: FeedbackPollItem) {
    const existing = currentStore.feedbackPolls || [];
    const idx = existing.findIndex(p => p.id === poll.id);
    currentStore = {
      ...currentStore,
      feedbackPolls: idx >= 0 ? existing.map(p => (p.id === poll.id ? poll : p)) : [poll, ...existing]
    };
    notifyListeners();
  },

  hydrateInstitutionData(instId: string, payload: Partial<InstitutionalDataStore> | null) {
    if (!instId || LEGACY_SAMPLE_INST_IDS.has(instId)) return;
    if (!payload || typeof payload !== 'object') return;
    const base = loadDataForInstitution(instId);
    const blankProfile = getBlankInitialData().institutionProfile!;
    const merged: InstitutionalDataStore = {
      ...base,
      ...payload,
      institutionProfile: payload.institutionProfile
        ? { ...(base.institutionProfile || blankProfile), ...payload.institutionProfile, id: instId, isSample: false }
        : base.institutionProfile,
      terms: Array.isArray(payload.terms) && payload.terms.length > 0 ? payload.terms : base.terms,
      rooms: Array.isArray(payload.rooms) ? payload.rooms : base.rooms,
      departments: Array.isArray(payload.departments) ? payload.departments : base.departments,
      programs: Array.isArray(payload.programs) ? payload.programs : base.programs,
      courses: Array.isArray(payload.courses) ? payload.courses : base.courses,
      instructors: Array.isArray(payload.instructors) ? payload.instructors : base.instructors,
      studentGroups: Array.isArray(payload.studentGroups) ? payload.studentGroups : base.studentGroups,
      sections: Array.isArray(payload.sections) ? payload.sections : base.sections,
      timeStructure: payload.timeStructure ? { ...base.timeStructure, ...payload.timeStructure } : base.timeStructure,
      constraints: Array.isArray(payload.constraints) && payload.constraints.length > 0 ? payload.constraints : base.constraints,
      scenarios: Array.isArray(payload.scenarios) ? payload.scenarios : base.scenarios,
      auditLogs: Array.isArray(payload.auditLogs) ? payload.auditLogs : base.auditLogs,
      feedbackPolls: Array.isArray(payload.feedbackPolls) ? payload.feedbackPolls : base.feedbackPolls,
      importHistory: Array.isArray(payload.importHistory) ? payload.importHistory : base.importHistory
    };

    institutionStoresMap.set(instId, merged);

    if (instId === currentInstitutionId) {
      currentStore = merged;
      listeners.forEach(fn => fn());
    }
  },

  hydrateFromWorkspacePayload(instId: string, workspace: Record<string, unknown>, currentUserId?: string) {
    if (!instId || LEGACY_SAMPLE_INST_IDS.has(instId) || !workspace || typeof workspace !== 'object') return;

    const rawInst = (workspace.institution || {}) as Record<string, unknown>;
    const rawTs = (workspace.timeStructure || {}) as Partial<TimeStructure>;
    const mergedTsBase: TimeStructure = {
      ...DEFAULT_TIME_STRUCTURE,
      ...rawTs
    };
    const computedTs = computeAcademicScheduleConfig(mergedTsBase);
    const hydratedTimeStructure: TimeStructure = {
      ...mergedTsBase,
      workingDays: computedTs.workingDays,
      periods: rawTs.periods && rawTs.periods.length > 0 ? rawTs.periods : computedTs.periods
    };

    const mapPeriodFromStart = (day: DayOfWeek, rawStart: string): string => {
      if (!/^\d{1,2}:\d{2}$/.test(rawStart.trim())) return rawStart;
      const slots = computedTs.slots || [];
      if (slots.length === 0) return rawStart;
      const targetMins = parseTime24ToMinutes(rawStart, 540);
      let best = slots[0];
      let bestDiff = Math.abs((best.startMinutes ?? 540) - targetMins);
      for (const slot of slots) {
        const diff = Math.abs((slot.startMinutes ?? 540) - targetMins);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = slot;
        }
      }
      return best.basePeriod || best.period;
    };

    const wsTerms = Array.isArray(workspace.terms) ? (workspace.terms as AcademicTerm[]) : [];
    const wsCourses = Array.isArray(workspace.courses) ? (workspace.courses as Course[]) : [];
    const wsGroups = Array.isArray(workspace.studentGroups) ? (workspace.studentGroups as StudentGroup[]) : [];
    const activeLabBlocks = computedTs.continuousLabBlocks.length > 0
      ? computedTs.continuousLabBlocks
      : VALID_CONTINUOUS_LAB_BLOCKS;

    const rawSections = Array.isArray(workspace.sections) ? (workspace.sections as Section[]) : [];
    const baseSections: Section[] = rawSections.map(sec => {
      if (!sec.assignedSlot) return sec;
      const day = (String(sec.assignedSlot.day || 'Mon').slice(0, 3) as DayOfWeek) || 'Mon';
      const tsStr = String(sec.assignedSlot.timeSlot || sec.assignedSlot.startTime24 || '');
      const normalizedPeriod = /^\d{1,2}:\d{2}$/.test(tsStr.trim()) ? mapPeriodFromStart(day, tsStr) : tsStr;
      return {
        ...sec,
        assignedSlot: {
          ...sec.assignedSlot,
          day,
          timeSlot: normalizedPeriod
        }
      };
    });

    const rawScenarios = Array.isArray(workspace.scenarios) ? (workspace.scenarios as TimetableScenario[]) : [];
    const hydratedScenarios: TimetableScenario[] = rawScenarios.map(scen => {
      const normalizedAssigns: Record<string, SectionSlotAssignment> = {};
      Object.entries(scen.assignments || {}).forEach(([secId, assign]) => {
        const day = (String(assign.day || 'Mon').slice(0, 3) as DayOfWeek) || 'Mon';
        const rawTime = String(assign.startTime24 || assign.timeSlot || '');
        const mappedPeriod = /^\d{1,2}:\d{2}$/.test(rawTime.trim())
          ? mapPeriodFromStart(day, rawTime)
          : assign.timeSlot;
        normalizedAssigns[secId] = {
          ...assign,
          day,
          timeSlot: mappedPeriod
        };
      });
      return {
        ...scen,
        assignments: normalizedAssigns
      };
    });

    // Reconcile the active/latest scenario's timetableEntries onto hydratedSections so multi-meeting
    // courses and auto-generated sessions always hydrate cleanly from Supabase across reloads.
    const displayScenario =
      hydratedScenarios.find(s => s.status === 'published') || hydratedScenarios[0];
    const displayEntries = Array.isArray(displayScenario?.timetableEntries)
      ? displayScenario.timetableEntries
      : [];

    const buildAssignedSlotFromDbEntry = (
      entry: Record<string, unknown>,
      fallbackSlot?: SectionSlotAssignment
    ): SectionSlotAssignment => {
      const day = (String(entry.day_of_week || entry.day || fallbackSlot?.day || 'Mon').slice(0, 3) as DayOfWeek) || 'Mon';
      const rawStart = String(entry.start_time || entry.startTime24 || entry.startTime || fallbackSlot?.startTime24 || '09:00');
      const period = /^\d{1,2}:\d{2}$/.test(rawStart.trim())
        ? mapPeriodFromStart(day, rawStart)
        : String(fallbackSlot?.timeSlot || UNIVERSITY_PERIODS[0]);
      const isLab =
        String(entry.session_type || '').toLowerCase() === 'lab' ||
        String(entry.component_type || '').toLowerCase() === 'lab' ||
        fallbackSlot?.sessionType === 'Lab';
      const startMinutes = parseTime24ToMinutes(rawStart, 540);
      const defaultDur = isLab
        ? computedTs.labDurationMinutes || 180
        : (getEffectiveSlotDisplayForDay(day, period, computedTs).durationMinutes || computedTs.periodLengthMinutes || 50);
      const durationMinutes = Number(entry.duration_minutes ?? fallbackSlot?.durationMinutes ?? defaultDur);
      const endTime24 = String(entry.end_time || fallbackSlot?.endTime24 || minutesToTime24(startMinutes + durationMinutes));
      const endMinutes = parseTime24ToMinutes(endTime24, startMinutes + durationMinutes);
      const roomId = String(entry.room_id || fallbackSlot?.roomId || '');
      const slotSource = (String(entry.slot_source || fallbackSlot?.slotSource || (day === 'Fri' ? 'friday_compressed' : 'regular')) as SectionSlotAssignment['slotSource']);

      if (isLab) {
        const matchedBlock =
          getLabBlockByStartPeriod(period, hydratedTimeStructure, day) ||
          (day === 'Fri' && computedTs.fridaySchedule.continuousLabBlocks[0]) ||
          activeLabBlocks[0];
        const span = matchedBlock?.spanSlots || computedTs.labSpanSlots || 3;
        return {
          day,
          timeSlot: matchedBlock?.startPeriod || period,
          roomId,
          durationMinutes,
          sessionType: 'Lab',
          spanSlots: span,
          continuousTimeLabel: matchedBlock?.continuousLabel || `${rawStart} – ${endTime24}`,
          startTime24: rawStart,
          endTime24,
          startMinutes,
          endMinutes,
          slotSource
        };
      }

      return {
        day,
        timeSlot: period,
        roomId,
        durationMinutes,
        sessionType: 'Lecture',
        spanSlots: 1,
        startTime24: rawStart,
        endTime24,
        startMinutes,
        endMinutes,
        slotSource
      };
    };

    let hydratedSections: Section[] = baseSections;
    if (displayEntries.length > 0) {
      const entriesBySessionId = new Map<string, Array<{ idx: number; entry: Record<string, unknown> }>>();
      displayEntries.forEach((entry, idx) => {
        const csId = String(entry.course_session_id || '');
        if (!csId) return;
        const list = entriesBySessionId.get(csId) || [];
        list.push({ idx, entry });
        entriesBySessionId.set(csId, list);
      });

      const consumedEntryIndices = new Set<number>();
      const reconciled: Section[] = [];

      baseSections.forEach(sec => {
        const matched = entriesBySessionId.get(sec.id);
        if (!matched || matched.length === 0) {
          reconciled.push(sec);
          return;
        }
        matched.forEach(({ idx, entry }, mIdx) => {
          consumedEntryIndices.add(idx);
          const slot = buildAssignedSlotFromDbEntry(entry, sec.assignedSlot);
          const isLab = slot.sessionType === 'Lab';
          reconciled.push({
            ...sec,
            id: mIdx === 0 ? sec.id : `${sec.id}__m${mIdx}`,
            sectionNumber: matched.length > 1 ? `${sec.sectionNumber}-M${mIdx + 1}` : sec.sectionNumber,
            instructorId: String(entry.instructor_id || sec.instructorId || ''),
            labEngineerId: String(entry.lab_engineer_id || sec.labEngineerId || '') || undefined,
            assignedLabId: sec.assignedLabId || (isLab && entry.room_id ? String(entry.room_id) : undefined),
            sessionType: isLab ? 'Lab' : 'Lecture',
            componentType: isLab ? 'lab' : 'lecture',
            isAtomicSession: true,
            sessionsPerWeek: 1,
            spanSlots: slot.spanSlots || (isLab ? 3 : 1),
            assignedSlot: slot
          });
        });
      });

      const defaultTermId = displayScenario?.termId || wsTerms[0]?.id || 'term-default';
      displayEntries.forEach((entry, idx) => {
        if (consumedEntryIndices.has(idx)) return;
        const courseCodeUpper = String(entry.course_code || '').trim().toUpperCase();
        const matchedCourse = wsCourses.find(c => c.code.trim().toUpperCase() === courseCodeUpper);
        const batchId = String(entry.batch_id || '');
        const matchedGroup = wsGroups.find(g => g.id === batchId) || wsGroups[0];
        if (!matchedCourse || !matchedGroup) return;

        const slot = buildAssignedSlotFromDbEntry(entry);
        const isLab = slot.sessionType === 'Lab';
        const csId = String(entry.course_session_id || '');
        reconciled.push({
          id: csId ? `${csId}__syn_${idx}` : `sec-syn-${idx}`,
          courseId: matchedCourse.id,
          termId: defaultTermId,
          sectionNumber: String(entry.section_code || matchedGroup.section || 'A'),
          expectedEnrollment: Math.min(matchedGroup.size || 45, 60),
          instructorId: String(entry.instructor_id || matchedCourse.assignedInstructorId || ''),
          labEngineerId: String(entry.lab_engineer_id || matchedCourse.assignedLabEngineerId || '') || undefined,
          assignedLabId: isLab && entry.room_id ? String(entry.room_id) : undefined,
          programId: matchedGroup.programId,
          studentGroupId: matchedGroup.id,
          sessionType: isLab ? 'Lab' : 'Lecture',
          componentType: isLab ? 'lab' : 'lecture',
          isAtomicSession: true,
          sessionsPerWeek: 1,
          spanSlots: slot.spanSlots || (isLab ? 3 : 1),
          assignedSlot: slot,
          isLocked: Boolean(entry.is_locked)
        });
      });

      hydratedSections = reconciled;
    }

    const rawFeedback = Array.isArray(workspace.feedbackPolls)
      ? (workspace.feedbackPolls as Array<Record<string, unknown>>)
      : [];
    const hydratedPolls: FeedbackPollItem[] = rawFeedback.map(fp => {
      const voters = (fp.voters && typeof fp.voters === 'object' ? fp.voters : {}) as Record<string, 'approve' | 'revise'>;
      const statusRaw = String(fp.status || 'Open');
      const status: FeedbackPollItem['status'] =
        statusRaw === 'Implemented' ? 'Implemented' : statusRaw === 'Under Review' ? 'Under Review' : 'Active';
      return {
        id: String(fp.id || ''),
        title: String(fp.title || ''),
        category: String(fp.category || 'General'),
        description: String(fp.description || ''),
        targetSlot: String(fp.targetSlot || ''),
        votesApprove: Number(fp.votesApprove ?? 0),
        votesRevise: Number(fp.votesRevise ?? 0),
        userVote: currentUserId ? voters[currentUserId] || null : null,
        status,
        submittedBy: String(fp.submittedBy || 'Campus Member'),
        createdAt: String(fp.createdAt || '').split('T')[0] || ''
      };
    });

    const rawImportHistory = Array.isArray(workspace.importHistory)
      ? (workspace.importHistory as Array<Record<string, unknown>>)
      : [];
    const hydratedImports: LocalImportHistoryRecord[] = rawImportHistory.map(row => ({
      id: String(row.id || ''),
      institutionId: String(row.institutionId ?? row.institution_id ?? instId),
      userName: String(row.userName ?? row.user_name ?? 'Administrator'),
      userEmail: String(row.userEmail ?? row.user_email ?? ''),
      category: String(row.category || 'all'),
      fileName: String(row.fileName ?? row.file_name ?? 'import.csv'),
      duplicateMode: (String(row.duplicateMode ?? row.duplicate_mode ?? 'skip') as LocalImportHistoryRecord['duplicateMode']),
      status: (String(row.status || 'completed') as LocalImportHistoryRecord['status']),
      totalRows: Number(row.totalRows ?? row.total_rows ?? 0),
      createdCount: Number(row.createdCount ?? row.created_count ?? 0),
      updatedCount: Number(row.updatedCount ?? row.updated_count ?? 0),
      skippedCount: Number(row.skippedCount ?? row.skipped_count ?? 0),
      failedCount: Number(row.failedCount ?? row.failed_count ?? 0),
      durationMs: Number(row.durationMs ?? row.duration_ms ?? 0),
      createdAt: String(row.createdAt ?? row.created_at ?? new Date().toISOString())
    }));

    const studentGroups = Array.isArray(workspace.studentGroups)
      ? (workspace.studentGroups as StudentGroup[])
      : [];
    const prevStore = loadDataForInstitution(instId);
    const preservedGroupId =
      prevStore.selectedClassGroupId && studentGroups.some(g => g.id === prevStore.selectedClassGroupId)
        ? prevStore.selectedClassGroupId
        : studentGroups[0]?.id || '';

    const profile: InstitutionProfile = {
      id: String(rawInst.universityId || instId),
      name: String(rawInst.universityName || ''),
      code: String(rawInst.universityCode || ''),
      campusCode: String(rawInst.campusCode || 'MAIN'),
      campusName: String(rawInst.campusName || 'Main Campus'),
      accreditation: String(rawInst.accreditation || 'Accredited Higher Education Institution'),
      academicYear: String(rawInst.academicYear || '2026–2027'),
      currentTermName: String(rawInst.currentTerm || ''),
      activeTermIds: Array.isArray(rawInst.activeTermIds) ? (rawInst.activeTermIds as string[]) : undefined,
      timetableManagementPolicy: (rawInst.timetableManagementPolicy as TimetableManagementPolicy) || 'whole_university',
      registrarName: String(rawInst.registrarName || ''),
      registrarEmail: String(rawInst.registrarEmail || ''),
      autoConflictSweep: Boolean(rawInst.autoConflictSweep ?? true),
      defaultSessionMinutes: Number(rawInst.defaultSessionMinutes || hydratedTimeStructure.periodLengthMinutes || 50),
      timezone: 'UTC',
      isSample: false
    };

    const hydrated: InstitutionalDataStore = {
      institutionProfile: profile,
      selectedClassGroupId: preservedGroupId,
      campuses: Array.isArray(workspace.campuses) ? (workspace.campuses as Campus[]) : [],
      buildings: Array.isArray(workspace.buildings) ? (workspace.buildings as Building[]) : [],
      terms: Array.isArray(workspace.terms) ? (workspace.terms as AcademicTerm[]) : [],
      departments: Array.isArray(workspace.departments) ? (workspace.departments as Department[]) : [],
      programs: Array.isArray(workspace.programs) ? (workspace.programs as Program[]) : [],
      rooms: Array.isArray(workspace.rooms) ? (workspace.rooms as Room[]) : [],
      courses: Array.isArray(workspace.courses) ? (workspace.courses as Course[]) : [],
      instructors: Array.isArray(workspace.instructors) ? (workspace.instructors as Instructor[]) : [],
      studentGroups,
      sections: hydratedSections,
      timeStructure: hydratedTimeStructure,
      constraints:
        Array.isArray(workspace.constraints) && workspace.constraints.length > 0
          ? (workspace.constraints as ConstraintRule[])
          : DEFAULT_CONSTRAINT_RULES,
      scenarios: hydratedScenarios,
      auditLogs: Array.isArray(workspace.auditLogs) ? (workspace.auditLogs as AuditLogEntry[]) : [],
      feedbackPolls: hydratedPolls,
      importHistory: hydratedImports
    };

    institutionStoresMap.set(instId, hydrated);
    registeredInstitutionsMap.set(instId, {
      id: instId,
      name: profile.name,
      code: profile.code || 'UNIV',
      campusName: profile.campusName || 'Main Campus',
      accreditation: profile.accreditation,
      isSample: false,
      workingDays: computedTs.workingDays,
      dayStartTime: computedTs.dayStartTime,
      dayEndTime: computedTs.dayEndTime,
      periodLengthMinutes: computedTs.periodLengthMinutes,
      shortBreakMinutes: computedTs.shortBreakMinutes,
      middayBreakEnabled: computedTs.middayBreak.enabled,
      middayBreakStart: computedTs.middayBreak.startTime24,
      middayBreakDuration: computedTs.middayBreak.durationMinutes,
      labDurationMinutes: computedTs.labDurationMinutes
    });

    currentInstitutionId = instId;
    currentStore = hydrated;
    listeners.forEach(fn => fn());
  },

  mapBackendStartTimeToPeriod(day: DayOfWeek, startTimeHHMM: string): string {
    const computedTiming = computeAcademicScheduleConfig(currentStore.timeStructure);
    const slots = computedTiming.slots || [];
    if (slots.length === 0) return UNIVERSITY_PERIODS[0];
    const targetMins = parseTime24ToMinutes(startTimeHHMM, 540);
    let bestSlot = slots[0];
    let bestDiff = Math.abs((bestSlot.startMinutes ?? 540) - targetMins);
    for (const slot of slots) {
      const diff = Math.abs((slot.startMinutes ?? 540) - targetMins);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestSlot = slot;
      }
    }
    return bestSlot.basePeriod || bestSlot.period;
  },

  applyBackendOptimizationResult(params: {
    assignments: Record<string, BackendOptimizationAssignment>;
    entries?: BackendOptimizationEntry[];
    strategyName: string;
    algorithm?: string;
    versionId?: string;
    termId?: string;
    fitness?: Partial<BackendFitnessBreakdown>;
    conflictCount?: number;
    selectedGroupIds?: string[];
  }): {
    placedCount: number;
    unplacedCount: number;
    conflictCount: number;
    roomUtilization: number;
    scenario: TimetableScenario;
  } {
    const computedTiming = computeAcademicScheduleConfig(currentStore.timeStructure);
    const activeLabBlocks = computedTiming.continuousLabBlocks.length > 0
      ? computedTiming.continuousLabBlocks
      : VALID_CONTINUOUS_LAB_BLOCKS;

    const targetGroupSet = params.selectedGroupIds && params.selectedGroupIds.length > 0
      ? new Set(params.selectedGroupIds)
      : null;

    const entriesBySectionId = new Map<string, BackendOptimizationEntry[]>();
    if (Array.isArray(params.entries)) {
      params.entries.forEach(entry => {
        const sid = String(entry.sectionId || entry.sessionId || '');
        if (sid) {
          const list = entriesBySectionId.get(sid) || [];
          list.push(entry);
          entriesBySectionId.set(sid, list);
        }
      });
    }

    let placedCount = 0;
    let unplacedCount = 0;

    const mapSlotForEntry = (
      sec: Section,
      entry?: BackendOptimizationEntry,
      assign?: BackendOptimizationAssignment
    ): { assignedSlot?: SectionSlotAssignment; isLab: boolean; instructorId: string; labEngineerId?: string } | null => {
      const dayRaw = entry?.day || assign?.day;
      const startTimeRaw = entry?.startTime || assign?.startTime;
      const roomIdRaw = entry?.roomId || assign?.roomId;
      if (!dayRaw || !startTimeRaw) return null;

      const day = (String(dayRaw).slice(0, 3) as DayOfWeek) || 'Mon';
      const period = this.mapBackendStartTimeToPeriod(day, String(startTimeRaw));
      const roomId = roomIdRaw || currentStore.rooms[0]?.id || '';
      const isLab =
        sec.sessionType === 'Lab' ||
        Boolean(sec.spanSlots && sec.spanSlots > 1) ||
        entry?.componentType === 'lab' ||
        entry?.sessionType?.toLowerCase() === 'lab' ||
        sec.assignedSlot?.sessionType === 'Lab';

      const startMins = entry?.startMinutes ?? assign?.startMinutes ?? parseTime24ToMinutes(String(startTimeRaw), 540);
      const defaultDur = isLab
        ? computedTiming.labDurationMinutes || 180
        : (getEffectiveSlotDisplayForDay(day, period, computedTiming).durationMinutes || computedTiming.periodLengthMinutes || 50);
      const durationMinutes = Number(entry?.durationMinutes ?? assign?.durationMinutes ?? defaultDur);
      const endMins = entry?.endMinutes ?? assign?.endMinutes ?? (startMins + durationMinutes);
      const startTime24 = String(entry?.startTime || assign?.startTime || minutesToTime24(startMins));
      const endTime24 = String(entry?.endTime || assign?.endTime || minutesToTime24(endMins));
      const slotSource = (entry?.slotSource as SectionSlotAssignment['slotSource']) || (day === 'Fri' ? 'friday_compressed' : 'regular');
      const instructorId = entry?.instructorId || assign?.instructorId || sec.instructorId;
      const labEngineerId = entry?.labEngineerId || assign?.labEngineerId || sec.labEngineerId;

      if (isLab) {
        const matchedBlock =
          getLabBlockByStartPeriod(period, currentStore.timeStructure, day) ||
          (day === 'Fri' && computedTiming.fridaySchedule.continuousLabBlocks[0]) ||
          activeLabBlocks[0];
        const span = matchedBlock?.spanSlots || computedTiming.labSpanSlots || 3;
        return {
          isLab: true,
          instructorId,
          labEngineerId,
          assignedSlot: {
            day,
            timeSlot: matchedBlock?.startPeriod || period,
            roomId,
            durationMinutes,
            sessionType: 'Lab',
            spanSlots: span,
            continuousTimeLabel: matchedBlock?.continuousLabel || `${startTime24} – ${endTime24}`,
            startTime24,
            endTime24,
            startMinutes: startMins,
            endMinutes: endMins,
            isSplitLab: Boolean(entry?.isSplitLab),
            slotSource
          }
        };
      }

      return {
        isLab: false,
        instructorId,
        labEngineerId,
        assignedSlot: {
          day,
          timeSlot: period,
          roomId,
          durationMinutes,
          sessionType: 'Lecture',
          spanSlots: 1,
          startTime24,
          endTime24,
          startMinutes: startMins,
          endMinutes: endMins,
          slotSource
        }
      };
    };

    const newSections: Section[] = [];
    currentStore.sections.forEach(sec => {
      if (targetGroupSet && !targetGroupSet.has(sec.studentGroupId)) {
        newSections.push(sec);
        return;
      }
      const matchedEntries = entriesBySectionId.get(sec.id);
      const assign = params.assignments?.[sec.id];

      if (matchedEntries && matchedEntries.length > 0) {
        matchedEntries.forEach((entry, mIdx) => {
          const mapped = mapSlotForEntry(sec, entry, mIdx === 0 ? assign : undefined);
          if (!mapped || !mapped.assignedSlot) return;
          placedCount++;
          newSections.push({
            ...sec,
            id: mIdx === 0 ? sec.id : `${sec.id}__m${mIdx}`,
            sectionNumber: matchedEntries.length > 1 ? `${sec.sectionNumber}-M${mIdx + 1}` : sec.sectionNumber,
            instructorId: mapped.instructorId,
            labEngineerId: mapped.labEngineerId,
            assignedLabId: sec.assignedLabId || (mapped.isLab ? mapped.assignedSlot.roomId : undefined),
            sessionType: mapped.isLab ? 'Lab' : 'Lecture',
            componentType: mapped.isLab ? 'lab' : 'lecture',
            isAtomicSession: true,
            sessionsPerWeek: 1,
            spanSlots: mapped.assignedSlot.spanSlots || (mapped.isLab ? 3 : 1),
            assignedSlot: mapped.assignedSlot
          });
        });
        return;
      }

      const singleMapped = mapSlotForEntry(sec, undefined, assign);
      if (singleMapped?.assignedSlot) {
        placedCount++;
        newSections.push({
          ...sec,
          instructorId: singleMapped.instructorId,
          labEngineerId: singleMapped.labEngineerId,
          assignedLabId: sec.assignedLabId || (singleMapped.isLab ? singleMapped.assignedSlot.roomId : undefined),
          sessionType: singleMapped.isLab ? 'Lab' : 'Lecture',
          componentType: singleMapped.isLab ? 'lab' : 'lecture',
          spanSlots: singleMapped.assignedSlot.spanSlots || (singleMapped.isLab ? 3 : 1),
          assignedSlot: singleMapped.assignedSlot
        });
        return;
      }

      if (sec.assignedSlot) {
        placedCount++;
      } else {
        unplacedCount++;
      }
      newSections.push(sec);
    });

    const roomUtilization = Number(
      (params.fitness?.roomUtilization ?? Math.min(96.5, Math.max(24.0, (placedCount / Math.max(1, newSections.length)) * 84))).toFixed(1)
    );
    const conflictCount = Number(params.conflictCount ?? 0);
    const isValid = conflictCount === 0 && unplacedCount === 0;

    const assignmentsMap: Record<string, SectionSlotAssignment> = {};
    newSections.forEach(s => {
      if (s.assignedSlot) assignmentsMap[s.id] = s.assignedSlot;
    });

    const activeTerm = currentStore.terms.find(t => t.id === params.termId) ||
      currentStore.terms.find(t => t.status === 'active') ||
      currentStore.terms[0];

    const newScenario: TimetableScenario = {
      id: params.versionId || `scen-${Date.now()}`,
      termId: activeTerm?.id || 'term-spring-2026',
      name: params.strategyName,
      version: `v${currentStore.scenarios.length + 1}.0`,
      status: isValid ? 'published' : 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: currentStore.institutionProfile?.registrarName || getStoredUser()?.name || 'Administrator',
      metrics: {
        clashCount: conflictCount,
        satisfactionScore: Number((params.fitness?.totalScore ?? (isValid ? 96.4 : 68.0)).toFixed(1)),
        roomUtilizationPercent: roomUtilization,
        instructorSatisfaction: Number((params.fitness?.instructorSatisfaction ?? 95.8).toFixed(1)),
        studentTransitScore: Number((params.fitness?.compactnessScore ?? params.fitness?.fairnessScore ?? 94.2).toFixed(1))
      },
      assignments: assignmentsMap
    };

    currentStore = {
      ...currentStore,
      sections: newSections,
      scenarios: [newScenario, ...currentStore.scenarios.filter(sc => sc.id !== newScenario.id)]
    };

    this.addAuditLog(
      'generate',
      'scenario',
      newScenario.id,
      `Applied Python ${params.algorithm || 'Hybrid AI'} schedule "${newScenario.name}" (${placedCount} sections, ${conflictCount} hard violations).`
    );
    notifyListeners();

    return {
      placedCount,
      unplacedCount,
      conflictCount,
      roomUtilization,
      scenario: newScenario
    };
  },

  loadSampleUniversityData() {
    const instId = currentStore.institutionProfile?.id || 'inst-sample-uni';
    const deptCsId = `dept-${instId}-cs`;
    const deptEeId = `dept-${instId}-ee`;
    const deptMthId = `dept-${instId}-mth`;
    const instTuringId = `inst-${instId}-turing`;
    const instHopperId = `inst-${instId}-hopper`;
    const instAdaId = `inst-${instId}-ada`;
    const instTeslaId = `inst-${instId}-tesla`;
    const instGaussId = `inst-${instId}-gauss`;

    const instDijkstraId = `inst-${instId}-dijkstra`;
    const instBilalId = `inst-${instId}-bilal`;
    const instNadiaId = `inst-${instId}-nadia`;

    const departments: Department[] = [
      {
        id: deptCsId,
        code: 'CS',
        name: 'Computer Science & Software Engineering',
        school: 'School of Computing & Engineering',
        colorHex: '#171717',
        subDepartments: ['Artificial Intelligence', 'Systems & Networks', 'Software Engineering']
      },
      {
        id: deptEeId,
        code: 'EE',
        name: 'Electrical & Computer Engineering',
        school: 'School of Computing & Engineering',
        colorHex: '#2563EB',
        subDepartments: ['Electronics & Hardware', 'Power Systems']
      },
      {
        id: deptMthId,
        code: 'MTH',
        name: 'Mathematics & Basic Sciences',
        school: 'School of Sciences',
        colorHex: '#16A34A',
        subDepartments: ['Applied Mathematics', 'Statistics']
      }
    ];

    const rooms: Room[] = [
      { id: `room-${instId}-101`, buildingId: `bld-${instId}-1`, code: 'TURING-101', name: 'Alan Turing Lecture Hall', capacity: 65, type: 'lecture', equipment: ['Projector', 'Whiteboard', 'Audio System'], isAccessible: true, isAvailable: true },
      { id: `room-${instId}-102`, buildingId: `bld-${instId}-1`, code: 'SHANNON-201', name: 'Claude Shannon Amphitheater', capacity: 90, type: 'lecture', equipment: ['Dual Projectors', 'Smart Screen', 'Recording Mic'], isAccessible: true, isAvailable: true },
      { id: `room-${instId}-103`, buildingId: `bld-${instId}-1`, code: 'EULER-103', name: 'Leonhard Euler Seminar Hall', capacity: 60, type: 'lecture', equipment: ['Projector', 'Whiteboard'], isAccessible: true, isAvailable: true },
      { id: `room-${instId}-201`, buildingId: `bld-${instId}-1`, code: 'ADA-LAB-1', name: 'Ada Lovelace Computing Lab', capacity: 45, type: 'lab', equipment: ['45 Workstations', 'Linux Cluster', 'Projector'], isAccessible: true, isAvailable: true, assignedLabEngineerId: instAdaId },
      { id: `room-${instId}-202`, buildingId: `bld-${instId}-1`, code: 'COMPUTE-LAB-2', name: 'Systems & Database Computing Lab', capacity: 45, type: 'lab', equipment: ['45 Workstations', 'PostgreSQL Cluster', 'Projector'], isAccessible: true, isAvailable: true, assignedLabEngineerId: instBilalId },
      { id: `room-${instId}-203`, buildingId: `bld-${instId}-1`, code: 'CIRCUITS-LAB', name: 'Electronics & Hardware Lab', capacity: 40, type: 'lab', equipment: ['Oscilloscopes', 'Breadboards', 'DC Power Supplies'], isAccessible: true, isAvailable: true, assignedLabEngineerId: instNadiaId }
    ];

    const courses: Course[] = [
      { id: `course-${instId}-101`, departmentId: deptCsId, code: 'CS-101', title: 'Programming Fundamentals', courseType: 'lecture_lab', creditHours: 4, lectureCredits: 3, labCredits: 1, weeklyContactHours: 6, lectureHours: 3, labHours: 3, assignedInstructorId: instTuringId, assignedLabEngineerId: instAdaId, labSessionMode: 'continuous', isElective: false, requiredRoomType: 'lecture' },
      { id: `course-${instId}-201`, departmentId: deptCsId, code: 'CS-201', title: 'Data Structures & Algorithms', courseType: 'lecture_lab', creditHours: 4, lectureCredits: 3, labCredits: 1, weeklyContactHours: 6, lectureHours: 3, labHours: 3, assignedInstructorId: instHopperId, assignedLabEngineerId: instBilalId, labSessionMode: 'continuous', isElective: false, requiredRoomType: 'lecture' },
      { id: `course-${instId}-301`, departmentId: deptCsId, code: 'CS-301', title: 'Database Systems', courseType: 'lecture_lab', creditHours: 4, lectureCredits: 3, labCredits: 1, weeklyContactHours: 6, lectureHours: 3, labHours: 3, assignedInstructorId: instDijkstraId, assignedLabEngineerId: instNadiaId, labSessionMode: 'continuous', isElective: false, requiredRoomType: 'lecture' },
      { id: `course-${instId}-401`, departmentId: deptCsId, code: 'CS-401', title: 'Artificial Intelligence & Deep Learning', courseType: 'lecture', creditHours: 3, lectureCredits: 3, labCredits: 0, weeklyContactHours: 3, lectureHours: 3, labHours: 0, assignedInstructorId: instTuringId, isElective: true, electivePoolName: 'AI & Data Science Track', requiredRoomType: 'lecture' },
      { id: `course-${instId}-ee101`, departmentId: deptEeId, code: 'EE-101', title: 'Applied Physics & Digital Circuits', courseType: 'lecture_lab', creditHours: 3, lectureCredits: 2, labCredits: 1, weeklyContactHours: 5, lectureHours: 2, labHours: 3, assignedInstructorId: instTeslaId, assignedLabEngineerId: instNadiaId, labSessionMode: 'continuous', isElective: false, requiredRoomType: 'lecture' },
      { id: `course-${instId}-mth101`, departmentId: deptMthId, code: 'MTH-101', title: 'Calculus & Analytical Geometry', courseType: 'lecture', creditHours: 3, lectureCredits: 3, labCredits: 0, weeklyContactHours: 3, lectureHours: 3, labHours: 0, assignedInstructorId: instGaussId, isElective: false, requiredRoomType: 'lecture' }
    ];

    const instructors: Instructor[] = [
      {
        id: instTuringId,
        departmentId: deptCsId,
        subDepartment: 'Artificial Intelligence',
        staffRole: 'faculty',
        name: 'Dr. Alan Turing',
        email: 'alan.turing@university.edu',
        title: 'Professor of Computer Science',
        maxWeeklyHours: 16,
        maxConsecutiveHours: 3,
        preferredDays: ['Mon', 'Wed', 'Fri'],
        unavailableSlots: [],
        qualifiedCourseIds: [courses[0].id, courses[3].id]
      },
      {
        id: instHopperId,
        departmentId: deptCsId,
        subDepartment: 'Software Engineering',
        staffRole: 'faculty',
        name: 'Dr. Grace Hopper',
        email: 'grace.hopper@university.edu',
        title: 'Associate Professor',
        maxWeeklyHours: 14,
        maxConsecutiveHours: 3,
        preferredDays: ['Tue', 'Thu'],
        unavailableSlots: [],
        qualifiedCourseIds: [courses[1].id]
      },
      {
        id: instDijkstraId,
        departmentId: deptCsId,
        subDepartment: 'Systems & Networks',
        staffRole: 'faculty',
        name: 'Dr. Edsger Dijkstra',
        email: 'edsger.dijkstra@university.edu',
        title: 'Professor of Systems',
        maxWeeklyHours: 14,
        maxConsecutiveHours: 3,
        preferredDays: ['Mon', 'Tue', 'Thu'],
        unavailableSlots: [],
        qualifiedCourseIds: [courses[2].id]
      },
      {
        id: instAdaId,
        departmentId: deptCsId,
        subDepartment: 'Systems & Networks',
        staffRole: 'lab_engineer',
        name: 'Engr. Ada Lovelace',
        email: 'ada.lovelace@university.edu',
        title: 'Senior Lab Engineer',
        maxWeeklyHours: 18,
        maxConsecutiveHours: 3,
        preferredDays: ['Mon', 'Wed', 'Fri'],
        unavailableSlots: [],
        qualifiedCourseIds: [courses[0].id]
      },
      {
        id: instBilalId,
        departmentId: deptCsId,
        subDepartment: 'Software Engineering',
        staffRole: 'lab_engineer',
        name: 'Engr. Bilal Tariq',
        email: 'bilal.tariq@university.edu',
        title: 'Lab Engineer (Computing)',
        maxWeeklyHours: 18,
        maxConsecutiveHours: 3,
        preferredDays: ['Tue', 'Thu'],
        unavailableSlots: [],
        qualifiedCourseIds: [courses[1].id]
      },
      {
        id: instNadiaId,
        departmentId: deptEeId,
        subDepartment: 'Electronics & Hardware',
        staffRole: 'lab_engineer',
        name: 'Engr. Nadia Raza',
        email: 'nadia.raza@university.edu',
        title: 'Lab Engineer (Systems & Hardware)',
        maxWeeklyHours: 18,
        maxConsecutiveHours: 3,
        preferredDays: ['Mon', 'Wed', 'Fri'],
        unavailableSlots: [],
        qualifiedCourseIds: [courses[2].id, courses[4].id]
      },
      {
        id: instTeslaId,
        departmentId: deptEeId,
        subDepartment: 'Electronics & Hardware',
        staffRole: 'faculty',
        name: 'Dr. Nikola Tesla',
        email: 'nikola.tesla@university.edu',
        title: 'Professor of Electrical Engineering',
        maxWeeklyHours: 12,
        maxConsecutiveHours: 3,
        preferredDays: ['Mon', 'Tue', 'Wed'],
        unavailableSlots: [],
        qualifiedCourseIds: [courses[4].id]
      },
      {
        id: instGaussId,
        departmentId: deptMthId,
        subDepartment: 'Applied Mathematics',
        staffRole: 'faculty',
        name: 'Dr. Carl Gauss',
        email: 'carl.gauss@university.edu',
        title: 'Professor of Mathematics',
        maxWeeklyHours: 16,
        maxConsecutiveHours: 3,
        preferredDays: ['Tue', 'Thu'],
        unavailableSlots: [],
        qualifiedCourseIds: [courses[5].id]
      }
    ];

    const programs: Program[] = [
      { id: `prog-${instId}-bscs`, departmentId: deptCsId, code: 'BSCS', name: 'BS Computer Science', degreeLevel: 'Undergraduate', totalSemesters: 8 },
      { id: `prog-${instId}-bsee`, departmentId: deptEeId, code: 'BSEE', name: 'BS Electrical Engineering', degreeLevel: 'Undergraduate', totalSemesters: 8 }
    ];

    const studentGroups: StudentGroup[] = [
      { id: `group-${instId}-2k24-a`, programId: programs[0].id, departmentCode: 'BSCS', batchCode: '2K24', section: 'A', name: '2K24 BSCS Section A', code: '2K24-BSCS-A', year: 2, semester: 3, size: 42, sharedCourseIds: [courses[3].id] },
      { id: `group-${instId}-2k24-b`, programId: programs[0].id, departmentCode: 'BSCS', batchCode: '2K24', section: 'B', name: '2K24 BSCS Section B', code: '2K24-BSCS-B', year: 2, semester: 3, size: 40, sharedCourseIds: [courses[3].id] },
      { id: `group-${instId}-2k24-c`, programId: programs[0].id, departmentCode: 'BSCS', batchCode: '2K24', section: 'C', name: '2K24 BSCS Section C', code: '2K24-BSCS-C', year: 2, semester: 3, size: 38, sharedCourseIds: [] },
      { id: `group-${instId}-2k25-a`, programId: programs[0].id, departmentCode: 'BSCS', batchCode: '2K25', section: 'A', name: '2K25 BSCS Section A (Freshman)', code: '2K25-BSCS-A', year: 1, semester: 1, size: 45, sharedCourseIds: [] },
      { id: `group-${instId}-2k24-ee`, programId: programs[1].id, departmentCode: 'BSEE', batchCode: '2K24', section: 'A', name: '2K24 BSEE Section A', code: '2K24-BSEE-A', year: 2, semester: 3, size: 35, sharedCourseIds: [] }
    ];

    const activeTerm = currentStore.terms[0] || {
      id: `term-${instId}-1`,
      name: 'Fall Semester 2026',
      code: 'TERM-2026-1',
      startDate: '2026-09-01',
      endDate: '2026-12-31',
      status: 'active',
      weeksCount: 16
    };
    const terms = currentStore.terms.length > 0 ? currentStore.terms : [activeTerm];

    currentStore = {
      ...currentStore,
      institutionProfile: {
        ...(currentStore.institutionProfile || {
          name: 'University of Engineering & Technology',
          campusCode: 'UET',
          accreditation: 'ABET & HEC Accredited',
          registrarName: 'Registrar Office',
          registrarEmail: 'registrar@uet.edu',
          autoConflictSweep: true,
          defaultSessionMinutes: 50,
          timezone: 'UTC'
        }),
        isSample: false
      },
      terms,
      departments,
      rooms,
      courses,
      instructors,
      programs,
      studentGroups
    };

    this.autoGenerateMissingSections();
    this.runTimetableSolver();
    this.addAuditLog('create', 'term', 'sample-load', 'Loaded complete sample university dataset with departments, faculty qualified subjects, and multi-section batches.');
    notifyListeners();
  }
};

export function useInstitutionalData(): InstitutionalDataStore {
  const [data, setData] = useState<InstitutionalDataStore>(institutionalStore.get());

  useEffect(() => {
    return institutionalStore.subscribe(() => {
      setData(institutionalStore.get());
    });
  }, []);

  return data;
}
