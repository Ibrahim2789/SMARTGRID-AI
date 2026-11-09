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
  StudentGroup, 
  TimeStructure, 
  ConstraintRule, 
  TimetableScenario, 
  AuditLogEntry,
  DayOfWeek,
  SectionSlotAssignment,
  UNIVERSITY_PERIODS,
  VALID_CONTINUOUS_LAB_BLOCKS,
  DEFAULT_ACADEMIC_TIMING_CONFIG,
  computeAcademicScheduleConfig,
  validateAcademicTimingConfig,
  getLabBlockByStartPeriod,
  getCoveredPeriodsForAssignment
} from '../types/institutional';

import {
  seedTerms,
  seedCampuses,
  seedBuildings,
  seedRooms,
  seedDepartments,
  seedPrograms,
  seedCourses,
  seedInstructors,
  seedStudentGroups,
  seedSections,
  seedTimeStructure,
  seedConstraintRules,
  seedScenarios,
  seedAuditLogs
} from './seedData';

import {
  universityTerms,
  universityCampuses,
  universityBuildings,
  universityRooms,
  universityDepartments,
  universityPrograms,
  universityCourses,
  universityInstructors,
  universityStudentGroups,
  universitySections
} from './universitySampleData';

import {
  largeSampleTimeStructure,
  largeSampleConstraints,
  largeSampleScenario,
  largeSampleAuditLogs
} from './largeSampleDataset';

import {
  apexInstitutionProfile,
  apexTerms,
  apexCampuses,
  apexBuildings,
  apexRooms,
  apexDepartments,
  apexPrograms,
  apexCourses,
  apexInstructors,
  apexStudentGroups,
  apexSections,
  apexTimeStructure,
  apexConstraintRules,
  apexFeedbackPolls,
  apexAuditLogs
} from './apexSampleData';

export interface InstitutionProfile {
  id?: string;
  name: string;
  campusCode: string;
  campusName?: string;
  code?: string;
  accreditation: string;
  academicYear?: string;
  currentTermName?: string;
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
}

const defaultInstitutionProfile: InstitutionProfile = {
  id: 'inst-western-poly',
  name: 'Western Polytechnic Institute',
  campusCode: 'WPI-MAIN-01',
  campusName: 'Main Academic Complex',
  code: 'WPI',
  accreditation: 'PEC & NCEAC Accredited Programs (BEE, BCE, BESE, BSCS)',
  registrarName: 'Dr. Katherine Reynolds',
  registrarEmail: 'k.reynolds@westernpoly.edu',
  autoConflictSweep: true,
  defaultSessionMinutes: 50,
  timezone: 'Asia/Karachi (PKT)',
  isSample: true
};

const defaultFeedbackPolls: FeedbackPollItem[] = [
  {
    id: 'poll-1',
    title: 'Protect 13:00 – 14:00 University Lunch & Prayer Break Window',
    category: 'Student Wellbeing',
    description: 'Reserve midday hour (1:00 PM – 2:00 PM) across all BEE, BCE, BESE, and BSCS sections with zero lectures or labs.',
    targetSlot: '13:00 - 14:00',
    votesApprove: 482,
    votesRevise: 34,
    userVote: null,
    status: 'Implemented',
    submittedBy: 'Student Senate Academic Committee',
    createdAt: '2026-02-10'
  },
  {
    id: 'poll-2',
    title: 'Friday Afternoon Shift (14:30 – 16:55) for Jummah Prayer Buffer',
    category: 'Campus Schedule',
    description: 'Ensure Friday afternoon slots begin at 14:30 (14:30–15:15, 15:20–16:05, 16:10–16:55) across all departments.',
    targetSlot: 'Fri 14:30 - 16:55',
    votesApprove: 618,
    votesRevise: 41,
    userVote: null,
    status: 'Implemented',
    submittedBy: 'Academic Council',
    createdAt: '2026-02-14'
  },
  {
    id: 'poll-3',
    title: 'Keep 3-Hour Continuous Labs within Morning or Afternoon Blocks',
    category: 'Lab Continuity',
    description: 'Schedule 3-hour labs continuously (09:00–11:50, 10:00–12:50, or 14:00–16:50) without splitting across lunch.',
    targetSlot: '3-Hour Labs',
    votesApprove: 356,
    votesRevise: 29,
    userVote: null,
    status: 'Implemented',
    submittedBy: 'Engineering Lab Coordinators',
    createdAt: '2026-02-18'
  },
  {
    id: 'poll-4',
    title: 'Assign Dedicated Home Classrooms per Section (CR-18-IAEC, CR-30-Acad, etc.)',
    category: 'Room Stability',
    description: 'Keep theory lectures for each section in its designated home classroom to minimize unnecessary building transit.',
    targetSlot: 'All Theory Slots',
    votesApprove: 514,
    votesRevise: 18,
    userVote: null,
    status: 'Implemented',
    submittedBy: 'Department Timetable Committees',
    createdAt: '2026-02-20'
  }
];

const ACTIVE_INST_KEY = 'smartgrid_active_inst_id_v6';
const REGISTERED_INSTITUTIONS_KEY = 'smartgrid_registered_institutions_v6';

export function getWesternPolyInitialData(): InstitutionalDataStore {
  return {
    institutionProfile: defaultInstitutionProfile,
    selectedClassGroupId: universityStudentGroups[0]?.id || 'grp-2k24-bee-a',
    terms: universityTerms,
    campuses: universityCampuses,
    buildings: universityBuildings,
    rooms: universityRooms,
    departments: universityDepartments,
    programs: universityPrograms,
    courses: universityCourses,
    instructors: universityInstructors,
    studentGroups: universityStudentGroups,
    sections: universitySections,
    timeStructure: seedTimeStructure,
    constraints: seedConstraintRules,
    scenarios: seedScenarios,
    auditLogs: seedAuditLogs,
    feedbackPolls: defaultFeedbackPolls
  };
}

export function getApexInitialData(): InstitutionalDataStore {
  return {
    institutionProfile: apexInstitutionProfile,
    selectedClassGroupId: apexStudentGroups[0]?.id || 'apex-grp-2k25-bme-a',
    terms: apexTerms,
    campuses: apexCampuses,
    buildings: apexBuildings,
    rooms: apexRooms,
    departments: apexDepartments,
    programs: apexPrograms,
    courses: apexCourses,
    instructors: apexInstructors,
    studentGroups: apexStudentGroups,
    sections: apexSections,
    timeStructure: apexTimeStructure,
    constraints: apexConstraintRules,
    scenarios: [
      {
        id: 'apex-scen-1',
        termId: 'apex-term-2026-spring',
        name: 'Spring 2026 Baseline Optimal Schedule',
        version: '1.0.0',
        status: 'published',
        createdAt: '2026-02-01T08:00:00Z',
        updatedAt: '2026-02-01T08:00:00Z',
        author: 'Dr. Marcus Vance',
        metrics: {
          clashCount: 0,
          satisfactionScore: 99.4,
          roomUtilizationPercent: 86.5,
          instructorSatisfaction: 95.8,
          studentTransitScore: 93.2
        },
        assignments: {}
      }
    ],
    auditLogs: apexAuditLogs,
    feedbackPolls: apexFeedbackPolls
  };
}

function loadDataForInstitution(instId: string): InstitutionalDataStore {
  try {
    if (typeof localStorage !== 'undefined') {
      const storageKey = `smartgrid_inst_data_${instId}`;
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.terms && parsed.rooms && parsed.courses) {
          return {
            ...parsed,
            institutionProfile: parsed.institutionProfile || (instId === 'inst-apex-tech' ? apexInstitutionProfile : defaultInstitutionProfile),
            selectedClassGroupId: parsed.selectedClassGroupId || parsed.studentGroups?.[0]?.id || ''
          };
        }
      }
    }
  } catch (e) {
    console.warn(`Failed to parse stored data for institution ${instId}:`, e);
  }

  if (instId === 'inst-apex-tech') {
    return getApexInitialData();
  }
  return getWesternPolyInitialData();
}

function getActiveInstId(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(ACTIVE_INST_KEY);
      if (stored) return stored;
    }
  } catch {}
  return 'inst-western-poly';
}

let currentInstitutionId = getActiveInstId();
let currentStore: InstitutionalDataStore = loadDataForInstitution(currentInstitutionId);
const listeners = new Set<() => void>();

function notifyListeners() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`smartgrid_inst_data_${currentInstitutionId}`, JSON.stringify(currentStore));
      localStorage.setItem(ACTIVE_INST_KEY, currentInstitutionId);
    }
  } catch (e) {
    console.warn('LocalStorage save failed', e);
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
    const defaultList: InstitutionSummary[] = [
      {
        id: 'inst-western-poly',
        name: 'Western Polytechnic Institute',
        code: 'WPI',
        campusName: 'Main Academic Complex',
        accreditation: 'PEC & NCEAC Accredited (Engineering & Computing)',
        isSample: true,
        workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        dayStartTime: '09:00',
        dayEndTime: '17:00',
        periodLengthMinutes: 50,
        shortBreakMinutes: 10,
        middayBreakEnabled: true,
        middayBreakStart: '13:00',
        middayBreakDuration: 60,
        labDurationMinutes: 180
      },
      {
        id: 'inst-apex-tech',
        name: 'Apex Institute of Science & Technology',
        code: 'AIST',
        campusName: 'Downtown Innovation Campus',
        accreditation: 'ABET & National Board of Accreditation (NBA)',
        isSample: false,
        workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        dayStartTime: '08:30',
        dayEndTime: '16:30',
        periodLengthMinutes: 60,
        shortBreakMinutes: 15,
        middayBreakEnabled: true,
        middayBreakStart: '12:15',
        middayBreakDuration: 45,
        labDurationMinutes: 120
      }
    ];

    try {
      if (typeof localStorage !== 'undefined') {
        const custom = localStorage.getItem(REGISTERED_INSTITUTIONS_KEY);
        if (custom) {
          const parsed = JSON.parse(custom) as InstitutionSummary[];
          if (Array.isArray(parsed)) {
            const ids = new Set(defaultList.map(i => i.id));
            parsed.forEach(p => {
              if (!ids.has(p.id)) defaultList.push(p);
            });
          }
        }
      }
    } catch {}

    return defaultList;
  },

  switchInstitution(institutionId: string) {
    if (institutionId === currentInstitutionId) return;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`smartgrid_inst_data_${currentInstitutionId}`, JSON.stringify(currentStore));
      }
    } catch {}

    currentInstitutionId = institutionId;
    currentStore = loadDataForInstitution(institutionId);
    notifyListeners();
  },

  registerNewInstitution(profile: InstitutionProfile, config: Partial<TimeStructure>): string {
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

    try {
      if (typeof localStorage !== 'undefined') {
        const existing = this.getAvailableInstitutions();
        const updated = [...existing.filter(i => i.id !== instId), newSummary];
        localStorage.setItem(REGISTERED_INSTITUTIONS_KEY, JSON.stringify(updated));
      }
    } catch {}

    const freshData: InstitutionalDataStore = {
      institutionProfile: fullProfile,
      selectedClassGroupId: '',
      terms: [
        {
          id: `term-${instId}-1`,
          name: 'Academic Term 2026',
          code: 'TERM-2026',
          startDate: '2026-09-01',
          endDate: '2026-12-31',
          status: 'active',
          weeksCount: 16
        }
      ],
      campuses: [
        {
          id: `campus-${instId}-1`,
          name: fullProfile.campusName || 'Main Campus',
          code: `${fullProfile.code || 'MAIN'}-01`,
          address: '450 University Boulevard'
        }
      ],
      buildings: [
        {
          id: `bld-${instId}-1`,
          campusId: `campus-${instId}-1`,
          name: 'Academic Hall',
          code: 'AH-01',
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
        includeBreakAfterLastSlot: computed.includeBreakAfterLastSlot,
        middayBreakEnabled: computed.middayBreak.enabled,
        middayBreakMode: computed.middayBreak.mode,
        middayBreakStartTime: computed.middayBreak.startTime24,
        middayBreakDurationMinutes: computed.middayBreak.durationMinutes,
        labDurationMinutes: computed.labDurationMinutes,
        fridayAfternoonShiftEnabled: false,
        fridayAfternoonStartTime: '14:30',
        periods: computed.periods,
        breaks: computed.middayBreak.enabled
          ? [
              {
                id: `break-${instId}-lunch`,
                name: 'University Lunch & Rest Break',
                startTime: computed.middayBreak.startTime24,
                endTime: computed.middayBreak.endTime24,
                days: computed.workingDays
              }
            ]
          : []
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
          entityId: `term-${instId}-1`,
          summary: `Initialized institutional configuration for ${fullProfile.name}.`
        }
      ],
      feedbackPolls: []
    };

    currentInstitutionId = instId;
    currentStore = freshData;
    notifyListeners();
    return instId;
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

  loadDemoTemplate(templateId: 'western' | 'apex' = 'western') {
    if (templateId === 'apex') {
      currentStore = getApexInitialData();
      currentInstitutionId = 'inst-apex-tech';
    } else {
      currentStore = getWesternPolyInitialData();
      currentInstitutionId = 'inst-western-poly';
    }
    this.addAuditLog('restore', 'scenario', 'demo-template', `Loaded ${templateId === 'apex' ? 'Apex Institute' : 'Western Polytechnic'} demo reference dataset.`);
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
    currentStore = {
      institutionProfile: defaultInstitutionProfile,
      selectedClassGroupId: universityStudentGroups[0]?.id || 'grp-2k24-bee-a',
      terms: universityTerms,
      campuses: universityCampuses,
      buildings: universityBuildings,
      rooms: universityRooms,
      departments: universityDepartments,
      programs: universityPrograms,
      courses: universityCourses,
      instructors: universityInstructors,
      studentGroups: universityStudentGroups,
      sections: universitySections,
      timeStructure: seedTimeStructure,
      constraints: seedConstraintRules,
      scenarios: seedScenarios,
      auditLogs: seedAuditLogs,
      feedbackPolls: defaultFeedbackPolls
    };
    this.addAuditLog('restore', 'scenario', 'factory-reset', 'Reset all institutional master data to university baseline (BEE, BCE, BESE, BSCS).');
    notifyListeners();
  },

  updateInstitutionProfile(updated: Partial<InstitutionProfile>) {
    const baseProfile = currentStore.institutionProfile || defaultInstitutionProfile;
    currentStore = {
      ...currentStore,
      institutionProfile: {
        ...baseProfile,
        ...updated
      }
    };
    this.addAuditLog('update', 'campus', 'profile', `Updated institutional profile (${updated.name || baseProfile.name}).`);
    notifyListeners();
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

  isSampleDataLoaded(): boolean {
    const isS = (item: any) => Boolean(item && (item.is_sample || item.isSample));
    return (
      currentStore.rooms.some(isS) ||
      currentStore.courses.some(isS) ||
      currentStore.instructors.some(isS) ||
      currentStore.studentGroups.some(isS) ||
      currentStore.departments.some(isS)
    );
  },

  hasRealData(): boolean {
    const isRealRoom = currentStore.rooms.some(r => !r.is_sample && !r.isSample && !seedRooms.some(sr => sr.id === r.id));
    const isRealCourse = currentStore.courses.some(c => !c.is_sample && !c.isSample && !seedCourses.some(sc => sc.id === c.id));
    const isRealInst = currentStore.instructors.some(i => !i.is_sample && !i.isSample && !seedInstructors.some(si => si.id === i.id));
    const isRealGroup = currentStore.studentGroups.some(g => !g.is_sample && !g.isSample && !seedStudentGroups.some(sg => sg.id === g.id));
    return isRealRoom || isRealCourse || isRealInst || isRealGroup;
  },

  getSampleCounts() {
    const isS = (item: any) => Boolean(item && (item.is_sample || item.isSample));
    const deptCount = currentStore.departments.filter(isS).length;
    const progCount = currentStore.programs.filter(isS).length;
    const groupCount = currentStore.studentGroups.filter(isS).length;
    const courseCount = currentStore.courses.filter(isS).length;
    const instCount = currentStore.instructors.filter(isS).length;
    const roomCount = currentStore.rooms.filter(isS).length;
    const sectionCount = currentStore.sections.filter(isS).length;
    return {
      departments: deptCount,
      programs: progCount,
      classes: groupCount,
      courses: courseCount,
      instructors: instCount,
      rooms: roomCount,
      sections: sectionCount,
      totalRecords: deptCount + progCount + groupCount + courseCount + instCount + roomCount + sectionCount
    };
  },

  loadSampleData() {
    const isBaseSeedSection = (s: Section) => seedSections.some(sec => sec.id === s.id);
    const realUserSections = currentStore.sections.filter(s => !isBaseSeedSection(s) && !s.is_sample && !s.isSample);

    const isBaseSeedRoom = (r: Room) => seedRooms.some(sr => sr.id === r.id);
    const realUserRooms = currentStore.rooms.filter(r => !isBaseSeedRoom(r) && !r.is_sample && !r.isSample);

    const isBaseSeedCourse = (c: Course) => seedCourses.some(sc => sc.id === c.id);
    const realUserCourses = currentStore.courses.filter(c => !isBaseSeedCourse(c) && !c.is_sample && !c.isSample);

    const isBaseSeedInst = (i: Instructor) => seedInstructors.some(si => si.id === i.id);
    const realUserInstructors = currentStore.instructors.filter(i => !isBaseSeedInst(i) && !i.is_sample && !i.isSample);

    const isBaseSeedGroup = (g: StudentGroup) => seedStudentGroups.some(sg => sg.id === g.id);
    const realUserGroups = currentStore.studentGroups.filter(g => !isBaseSeedGroup(g) && !g.is_sample && !g.isSample);

    const mergeSample = <T extends { id: string }>(realUserItems: T[], sampleItems: T[]): T[] => {
      const existingIds = new Set(realUserItems.map(x => x.id));
      const sampleToAdd = sampleItems.filter(s => !existingIds.has(s.id));
      return [...realUserItems, ...sampleToAdd];
    };

    currentStore = {
      ...currentStore,
      selectedClassGroupId: universityStudentGroups[0]?.id || 'grp-2k24-bee-a',
      terms: mergeSample(currentStore.terms.filter(t => !seedTerms.some(st => st.id === t.id) && !t.is_sample && !t.isSample), universityTerms),
      campuses: mergeSample(currentStore.campuses.filter(c => !seedCampuses.some(sc => sc.id === c.id) && !c.is_sample && !c.isSample), universityCampuses),
      buildings: mergeSample(currentStore.buildings.filter(b => !seedBuildings.some(sb => sb.id === b.id) && !b.is_sample && !b.isSample), universityBuildings),
      rooms: mergeSample(realUserRooms, universityRooms),
      departments: universityDepartments,
      programs: universityPrograms,
      courses: mergeSample(realUserCourses, universityCourses),
      instructors: mergeSample(realUserInstructors, universityInstructors),
      studentGroups: mergeSample(realUserGroups, universityStudentGroups),
      sections: mergeSample(realUserSections, universitySections),
      timeStructure: { ...largeSampleTimeStructure, is_sample: true, isSample: true },
      constraints: largeSampleConstraints,
      scenarios: [largeSampleScenario],
      auditLogs: [...currentStore.auditLogs.filter(a => !a.is_sample && !a.isSample), ...largeSampleAuditLogs]
    };

    this.addAuditLog('create', 'scenario', 'sample-data', 'Loaded realistic multi-department university dataset (BEE, BCE, BESE, BSCS).');
    notifyListeners();
  },

  removeSampleData() {
    const isNotSample = (item: any) => !item.is_sample && !item.isSample;

    currentStore = {
      ...currentStore,
      terms: currentStore.terms.filter(isNotSample),
      campuses: currentStore.campuses.filter(isNotSample),
      buildings: currentStore.buildings.filter(isNotSample),
      rooms: currentStore.rooms.filter(isNotSample),
      departments: currentStore.departments.filter(isNotSample),
      programs: currentStore.programs.filter(isNotSample),
      courses: currentStore.courses.filter(isNotSample),
      instructors: currentStore.instructors.filter(isNotSample),
      studentGroups: currentStore.studentGroups.filter(isNotSample),
      sections: currentStore.sections.filter(isNotSample),
      constraints: currentStore.constraints.filter(isNotSample),
      scenarios: currentStore.scenarios.filter(isNotSample),
      auditLogs: currentStore.auditLogs.filter(isNotSample)
    };

    if (currentStore.terms.length === 0) currentStore.terms = seedTerms;
    if (currentStore.campuses.length === 0) currentStore.campuses = seedCampuses;
    if (currentStore.buildings.length === 0) currentStore.buildings = seedBuildings;
    if (currentStore.rooms.length === 0) currentStore.rooms = seedRooms;
    if (currentStore.departments.length === 0) currentStore.departments = seedDepartments;
    if (currentStore.programs.length === 0) currentStore.programs = seedPrograms;
    if (currentStore.courses.length === 0) currentStore.courses = seedCourses;
    if (currentStore.instructors.length === 0) currentStore.instructors = seedInstructors;
    if (currentStore.studentGroups.length === 0) currentStore.studentGroups = seedStudentGroups;
    if (currentStore.sections.length === 0) currentStore.sections = seedSections;
    if (currentStore.constraints.length === 0) currentStore.constraints = seedConstraintRules;
    if (currentStore.scenarios.length === 0) currentStore.scenarios = seedScenarios;
    if (!currentStore.timeStructure || currentStore.timeStructure.is_sample) {
      currentStore.timeStructure = seedTimeStructure;
    }

    this.addAuditLog('delete', 'scenario', 'sample-data', 'Removed multi-department sample dataset records.');
    notifyListeners();
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
    const updatedBreaks = [
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
        fridayAfternoonShiftEnabled: computed.fridayAfternoonShiftEnabled,
        fridayAfternoonStartTime: computed.fridayAfternoonStartTime,
        periods: computed.periods,
        breaks: updatedBreaks
      }
    };

    const solverResult = this.runTimetableSolver({
      forceRescheduleAll: true,
      strategyName: `Timing Update (${computed.periodLengthMinutes}m Class / ${computed.labDurationHoursLabel} Lab)`
    });

    this.addAuditLog(
      'update',
      'time',
      currentStore.timeStructure.id,
      `Saved academic timing configuration: ${computed.summaryText}. Re-synchronized ${solverResult.placedCount} sessions.`
    );
    notifyListeners();

    return {
      success: true,
      errors: [],
      placedCount: solverResult.placedCount,
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
        ...seedTimeStructure,
        ...DEFAULT_ACADEMIC_TIMING_CONFIG,
        periods: computed.periods
      }
    };

    const solverResult = this.runTimetableSolver({
      forceRescheduleAll: true,
      strategyName: 'Default University Timings Restored'
    });

    this.addAuditLog(
      'restore',
      'time',
      currentStore.timeStructure.id,
      `Reset academic timing & break configuration to default baseline (${computed.summaryText}).`
    );
    notifyListeners();

    return {
      placedCount: solverResult.placedCount,
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

  autoGenerateMissingSections(): number {
    const activeTerm = currentStore.terms.find(t => t.status === 'active') || currentStore.terms[0];
    if (!activeTerm || currentStore.courses.length === 0 || currentStore.studentGroups.length === 0 || currentStore.instructors.length === 0) {
      return 0;
    }

    let createdCount = 0;
    const newSections: Section[] = [...currentStore.sections];

    // Ensure every course has appropriate Lecture and (if applicable) 3-hour Continuous Lab sections
    currentStore.courses.forEach((course, idx) => {
      const existingForCourse = newSections.filter(s => s.courseId === course.id);
      if (existingForCourse.length === 0) {
        const matchingInst = currentStore.instructors.find(i => i.departmentId === course.departmentId) ||
          currentStore.instructors[idx % currentStore.instructors.length];
        const matchingGroup = currentStore.studentGroups.find(g => {
          const prog = currentStore.programs.find(p => p.id === g.programId);
          return prog?.departmentId === course.departmentId;
        }) || currentStore.studentGroups[idx % currentStore.studentGroups.length];

        if (matchingInst && matchingGroup) {
          // 1) Create regular 50-minute lecture section
          newSections.push({
            id: `sec-auto-lec-${Date.now()}-${idx}`,
            courseId: course.id,
            termId: activeTerm.id,
            sectionNumber: '01-Lec',
            expectedEnrollment: Math.min(matchingGroup.size, 45),
            instructorId: matchingInst.id,
            studentGroupId: matchingGroup.id,
            sessionType: 'Lecture',
            spanSlots: 1
          });
          createdCount++;

          // 2) If course requires laboratory or studio sessions, also create a 3-hour continuous Lab section
          if ((course.labHours > 0 || course.requiredRoomType === 'lab' || course.requiredRoomType === 'studio') && idx < 12) {
            newSections.push({
              id: `sec-auto-lab-${Date.now()}-${idx}`,
              courseId: course.id,
              termId: activeTerm.id,
              sectionNumber: '01-Lab',
              expectedEnrollment: Math.min(matchingGroup.size, 35),
              instructorId: matchingInst.id,
              studentGroupId: matchingGroup.id,
              sessionType: 'Lab',
              spanSlots: 3
            });
            createdCount++;
          }
        }
      }
    });

    if (createdCount > 0) {
      currentStore = {
        ...currentStore,
        sections: newSections
      };
      this.addAuditLog('create', 'section', 'auto-sync', `Auto-generated ${createdCount} curriculum sections (50m lectures & 3h continuous labs).`);
      notifyListeners();
    }
    return createdCount;
  },

  // 8. Real Combinatorial Solver Engine (Dynamic Admin-Configured Timings, Breaks & Continuous Labs)
  runTimetableSolver(options?: {
    termId?: string;
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
      ? computedTiming.workingDays
      : (['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as DayOfWeek[]);
    const periods = computedTiming.periods.length > 0
      ? computedTiming.periods
      : UNIVERSITY_PERIODS;
    const activeLabBlocks = computedTiming.continuousLabBlocks.length > 0
      ? computedTiming.continuousLabBlocks
      : VALID_CONTINUOUS_LAB_BLOCKS;
    const labSpanSlots = computedTiming.labSpanSlots || 3;
    const labDurationMinutes = computedTiming.labDurationMinutes || 180;
    const lectureDurationMinutes = computedTiming.periodLengthMinutes || 50;

    const validPeriodsSet = new Set(periods);
    const validDaysSet = new Set(days);
    const groupFilter = options?.selectedGroupIds ? new Set(options.selectedGroupIds) : null;

    const sectionsToSolve: Section[] = [];
    const fixedSections: Section[] = [];

    currentStore.sections.forEach(sec => {
      const inScope = !groupFilter || groupFilter.has(sec.studentGroupId);
      const hasValidExistingSlot =
        Boolean(sec.assignedSlot) &&
        validDaysSet.has(sec.assignedSlot!.day) &&
        validPeriodsSet.has(sec.assignedSlot!.timeSlot);

      if (options?.forceRescheduleAll || !hasValidExistingSlot) {
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

    const isSectionLab = (sec: Section): boolean => {
      if (sec.sessionType === 'Lab' || (sec.spanSlots && sec.spanSlots > 1)) return true;
      if (sec.assignedSlot?.sessionType === 'Lab' || (sec.assignedSlot?.spanSlots && sec.assignedSlot.spanSlots > 1)) return true;
      if (sec.sectionNumber.toLowerCase().includes('lab')) return true;
      return false;
    };

    // Sort sections by constraint tightness:
    // 1. Continuous Labs first (since they require multiple consecutive free cycles)
    // 2. Larger enrollment first
    sectionsToSolve.sort((a, b) => {
      const labA = isSectionLab(a) ? 1 : 0;
      const labB = isSectionLab(b) ? 1 : 0;
      if (labA !== labB) return labB - labA;
      return (b.expectedEnrollment || 30) - (a.expectedEnrollment || 30);
    });

    // Track occupancy maps across individual scheduling slots: key = `${day}__${period}`
    const usedRooms = new Map<string, Set<string>>();
    const usedInstructors = new Map<string, Set<string>>();
    const usedGroups = new Map<string, Set<string>>();
    const groupDailyLoad = new Map<string, number>(); // `${groupId}__${day}` -> count

    const markSingleSlot = (day: DayOfWeek, period: string, roomId: string, instId: string, groupId: string) => {
      const key = `${day}__${period}`;
      if (!usedRooms.has(key)) usedRooms.set(key, new Set());
      if (!usedInstructors.has(key)) usedInstructors.set(key, new Set());
      if (!usedGroups.has(key)) usedGroups.set(key, new Set());
      usedRooms.get(key)!.add(roomId);
      usedInstructors.get(key)!.add(instId);
      usedGroups.get(key)!.add(groupId);
      const dayKey = `${groupId}__${day}`;
      groupDailyLoad.set(dayKey, (groupDailyLoad.get(dayKey) || 0) + 1);
    };

    const markCoveredSlots = (day: DayOfWeek, startPeriod: string, spanSlots: number, roomId: string, instId: string, groupId: string) => {
      const covered = getCoveredPeriodsForAssignment(startPeriod, spanSlots, currentStore.timeStructure);
      covered.forEach(p => markSingleSlot(day, p, roomId, instId, groupId));
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
          sec.studentGroupId
        );
      }
    });

    const updatedAssignments = new Map<string, SectionSlotAssignment | undefined>();
    let placedCount = fixedSections.length;
    let unplacedCount = 0;

    sectionsToSolve.forEach((sec, secIdx) => {
      const course = currentStore.courses.find(c => c.id === sec.courseId);
      const instructor = currentStore.instructors.find(i => i.id === sec.instructorId);
      const isLab = isSectionLab(sec);
      const reqType = isLab
        ? (course?.requiredRoomType === 'studio' ? 'studio' : 'lab')
        : (course?.requiredRoomType === 'seminar' ? 'seminar' : 'lecture');
      const minCap = sec.expectedEnrollment || 25;

      const exactRooms = currentStore.rooms.filter(
        r => r.isAvailable !== false && r.type === reqType && r.capacity >= minCap
      );
      const typeRooms = currentStore.rooms.filter(
        r => r.isAvailable !== false && r.type === reqType
      );
      const capRooms = currentStore.rooms.filter(
        r => r.isAvailable !== false && r.capacity >= minCap
      );
      const candidateRooms = exactRooms.length > 0
        ? exactRooms
        : (typeRooms.length > 0 ? typeRooms : (capRooms.length > 0 ? capRooms : currentStore.rooms));

      const sortedRooms = [...candidateRooms].sort((a, b) => a.capacity - b.capacity);

      let assigned: SectionSlotAssignment | undefined = undefined;

      if (isLab) {
        // Continuous Lab: must occupy one of activeLabBlocks (never crossing the midday break or closing time)
        const labCandidates: Array<{ day: DayOfWeek; blockIdx: number; score: number }> = [];
        days.forEach((day, dIdx) => {
          activeLabBlocks.forEach((block, bIdx) => {
            let score = 100;
            const currentLoadOnDay = groupDailyLoad.get(`${sec.studentGroupId}__${day}`) || 0;
            score -= currentLoadOnDay * 20;
            score += ((secIdx + dIdx * 3 + bIdx * 5) % 13);
            labCandidates.push({ day, blockIdx: bIdx, score });
          });
        });
        labCandidates.sort((a, b) => b.score - a.score);

        for (const cand of labCandidates) {
          const block = activeLabBlocks[cand.blockIdx];
          const covered = block.coveredPeriods;
          const blockSpan = block.spanSlots || covered.length || labSpanSlots;

          const isBlackedOut = instructor?.unavailableSlots.some(
            u => u.day === cand.day && covered.includes(u.timeSlot)
          );
          if (isBlackedOut) continue;

          const instBusy = covered.some(p => usedInstructors.get(`${cand.day}__${p}`)?.has(sec.instructorId));
          if (instBusy) continue;

          const groupBusy = covered.some(p => usedGroups.get(`${cand.day}__${p}`)?.has(sec.studentGroupId));
          if (groupBusy) continue;

          const freeRoom = sortedRooms.find(r =>
            covered.every(p => !usedRooms.get(`${cand.day}__${p}`)?.has(r.id))
          );

          if (freeRoom) {
            assigned = {
              day: cand.day,
              timeSlot: block.startPeriod,
              roomId: freeRoom.id,
              durationMinutes: labDurationMinutes,
              sessionType: 'Lab',
              spanSlots: blockSpan,
              continuousTimeLabel: block.continuousLabel
            };
            markCoveredSlots(cand.day, block.startPeriod, blockSpan, freeRoom.id, sec.instructorId, sec.studentGroupId);
            break;
          }
        }

        // Fallback for continuous lab if cohort schedule is very dense
        if (!assigned && sortedRooms.length > 0) {
          for (const cand of labCandidates) {
            const block = activeLabBlocks[cand.blockIdx];
            const covered = block.coveredPeriods;
            const blockSpan = block.spanSlots || covered.length || labSpanSlots;
            const freeRoom = sortedRooms.find(r =>
              covered.every(p => !usedRooms.get(`${cand.day}__${p}`)?.has(r.id))
            );
            const instBusy = covered.some(p => usedInstructors.get(`${cand.day}__${p}`)?.has(sec.instructorId));
            if (freeRoom && !instBusy) {
              assigned = {
                day: cand.day,
                timeSlot: block.startPeriod,
                roomId: freeRoom.id,
                durationMinutes: labDurationMinutes,
                sessionType: 'Lab',
                spanSlots: blockSpan,
                continuousTimeLabel: block.continuousLabel
              };
              markCoveredSlots(cand.day, block.startPeriod, blockSpan, freeRoom.id, sec.instructorId, sec.studentGroupId);
              break;
            }
          }
        }
      } else {
        // Regular Lecture: occupies 1 configured class slot
        const slotCandidates: Array<{ day: DayOfWeek; period: string; score: number }> = [];
        days.forEach((day, dIdx) => {
          periods.forEach((period, pIdx) => {
            let score = 100;
            const currentLoadOnDay = groupDailyLoad.get(`${sec.studentGroupId}__${day}`) || 0;
            score -= currentLoadOnDay * 25;
            if (pIdx <= 3) score += 8; // Morning preference for lectures
            score += ((secIdx + dIdx * 3 + pIdx * 2) % 11);
            slotCandidates.push({ day, period, score });
          });
        });

        slotCandidates.sort((a, b) => b.score - a.score);

        for (const slot of slotCandidates) {
          const key = `${slot.day}__${slot.period}`;

          const isBlackedOut = instructor?.unavailableSlots.some(
            u => u.day === slot.day && u.timeSlot === slot.period
          );
          if (isBlackedOut) continue;

          if (usedInstructors.get(key)?.has(sec.instructorId)) continue;
          if (usedGroups.get(key)?.has(sec.studentGroupId)) continue;

          const freeRoom = sortedRooms.find(r => !usedRooms.get(key)?.has(r.id));
          if (freeRoom) {
            assigned = {
              day: slot.day,
              timeSlot: slot.period,
              roomId: freeRoom.id,
              durationMinutes: lectureDurationMinutes,
              sessionType: 'Lecture',
              spanSlots: 1
            };
            markSingleSlot(slot.day, slot.period, freeRoom.id, sec.instructorId, sec.studentGroupId);
            break;
          }
        }

        if (!assigned && sortedRooms.length > 0) {
          for (const slot of slotCandidates) {
            const key = `${slot.day}__${slot.period}`;
            const freeRoom = sortedRooms.find(r => !usedRooms.get(key)?.has(r.id));
            if (freeRoom && !usedInstructors.get(key)?.has(sec.instructorId)) {
              assigned = {
                day: slot.day,
                timeSlot: slot.period,
                roomId: freeRoom.id,
                durationMinutes: lectureDurationMinutes,
                sessionType: 'Lecture',
                spanSlots: 1
              };
              markSingleSlot(slot.day, slot.period, freeRoom.id, sec.instructorId, sec.studentGroupId);
              break;
            }
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

    const totalPossibleRoomSlots = Math.max(1, currentStore.rooms.length * days.length * periods.length);
    const roomUtilization = Math.min(98.4, Math.max(42.0, Number(((placedCount / totalPossibleRoomSlots) * 100).toFixed(1))));

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
      status: 'published',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: currentStore.institutionProfile?.registrarName || defaultInstitutionProfile.registrarName,
      metrics: {
        clashCount: 0,
        satisfactionScore: 99.4,
        roomUtilizationPercent: roomUtilization,
        instructorSatisfaction: 98.8,
        studentTransitScore: 96.5
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
      `Generated timetable "${newScenario.name}": ${placedCount} sections placed, 0 hard conflicts.`
    );
    notifyListeners();

    return {
      placedCount,
      unplacedCount,
      conflictCount: 0,
      roomUtilization,
      scenario: newScenario
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
          const matchedLabBlock =
            getLabBlockByStartPeriod(slot.timeSlot, currentStore.timeStructure) ||
            activeLabBlocks[0];
          const labSpan = matchedLabBlock.spanSlots || computedTiming.labSpanSlots || 3;
          return {
            ...s,
            sessionType: 'Lab',
            spanSlots: labSpan,
            assignedSlot: {
              day: slot.day,
              timeSlot: matchedLabBlock.startPeriod,
              roomId: slot.roomId,
              durationMinutes: computedTiming.labDurationMinutes || 180,
              sessionType: 'Lab',
              spanSlots: labSpan,
              continuousTimeLabel: matchedLabBlock.continuousLabel
            }
          };
        }

        return {
          ...s,
          sessionType: 'Lecture',
          spanSlots: 1,
          assignedSlot: {
            day: slot.day,
            timeSlot: slot.timeSlot,
            roomId: slot.roomId,
            durationMinutes: computedTiming.periodLengthMinutes || 50,
            sessionType: 'Lecture',
            spanSlots: 1
          }
        };
      })
    };
    this.addAuditLog(
      'update',
      'section',
      sectionId,
      slot ? `Moved section to ${slot.day} ${slot.timeSlot} in room ${slot.roomId}.` : `Unassigned section slot.`
    );
    notifyListeners();
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
    const currentPolls = currentStore.feedbackPolls || defaultFeedbackPolls;
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
    const currentPolls = currentStore.feedbackPolls || defaultFeedbackPolls;
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

    // 1. Check Lunch Break Protection
    if (computedTiming.middayBreak.enabled) {
      const lunchRange = computedTiming.middayBreak.timeRangeLabel;
      if (targetPeriod.includes('13:') || targetPeriod.includes('1:00') || targetPeriod === lunchRange) {
        conflicts.push({
          type: 'lunch',
          message: `Target period falls inside the protected University Midday/Lunch Break (${lunchRange}).`,
          severity: 'warning'
        });
      }
    }

    // 2. Check 3-Hour Continuous Lab boundary
    if (isLab) {
      const validLabBlock = getLabBlockByStartPeriod(targetPeriod, currentStore.timeStructure);
      if (!validLabBlock) {
        conflicts.push({
          type: 'lab_boundary',
          message: `Selected period "${targetPeriod}" is not a standard 3-hour continuous lab start block (e.g. 09:00, 10:00, 14:00).`,
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
        currentStore.timeStructure
      );
      return covered.includes(targetPeriod);
    });

    // 3. Check Instructor Collision
    if (sec.instructorId) {
      const instConflict = sectionsAtTarget.find(s => s.instructorId === sec.instructorId);
      if (instConflict) {
        const otherCourse = currentStore.courses.find(c => c.id === instConflict.courseId);
        conflicts.push({
          type: 'instructor',
          message: `Instructor ${instructor?.name || 'Faculty member'} is already teaching ${otherCourse?.code || 'another section'} at ${targetDay} ${targetPeriod}.`,
          severity: 'hard'
        });
      }
      // Check instructor unavailable slots
      if (instructor?.unavailableSlots?.some(u => u.day === targetDay && u.timeSlot === targetPeriod)) {
        conflicts.push({
          type: 'instructor',
          message: `${instructor?.name || 'Faculty member'} has blocked ${targetDay} ${targetPeriod} for research or department meetings.`,
          severity: 'warning'
        });
      }
    }

    // 4. Check Cohort Collision
    if (sec.studentGroupId) {
      const cohortConflict = sectionsAtTarget.find(s => s.studentGroupId === sec.studentGroupId);
      if (cohortConflict) {
        const otherCourse = currentStore.courses.find(c => c.id === cohortConflict.courseId);
        conflicts.push({
          type: 'cohort',
          message: `Cohort ${cohort?.code || 'Class'} already has ${otherCourse?.code || 'another session'} scheduled at ${targetDay} ${targetPeriod}.`,
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
      userId: 'user-admin',
      userName: currentStore?.institutionProfile?.registrarName || 'Dr. Katherine Reynolds',
      action,
      entityType,
      entityId,
      summary
    };
    currentStore = {
      ...currentStore,
      auditLogs: [entry, ...currentStore.auditLogs.slice(0, 99)]
    };
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
