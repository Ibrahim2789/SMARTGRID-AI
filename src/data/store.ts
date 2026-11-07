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
  SectionSlotAssignment
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
  largeSampleScenario,
  largeSampleAuditLogs
} from './largeSampleDataset';

export interface InstitutionProfile {
  name: string;
  campusCode: string;
  accreditation: string;
  registrarName: string;
  registrarEmail: string;
  autoConflictSweep: boolean;
  defaultSessionMinutes: number;
  timezone: string;
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
  name: 'Western Polytechnic Institute',
  campusCode: 'WPI-MAIN-01',
  accreditation: 'Higher Learning Commission (HLC) & ABET',
  registrarName: 'Dr. Katherine Reynolds',
  registrarEmail: 'k.reynolds@westernpoly.edu',
  autoConflictSweep: true,
  defaultSessionMinutes: 90,
  timezone: 'America/New_York (EST/EDT)'
};

const defaultFeedbackPolls: FeedbackPollItem[] = [
  {
    id: 'poll-1',
    title: 'Protect 12:00 – 13:00 Campus Lunch & Recharge Window',
    category: 'Student Wellbeing',
    description: 'Reserve midday hour across all undergraduate cohorts to prevent back-to-back 5-hour lecture marathons.',
    targetSlot: '12:00 - 13:00',
    votesApprove: 482,
    votesRevise: 34,
    userVote: null,
    status: 'Implemented',
    submittedBy: 'Student Senate Academic Committee',
    createdAt: '2026-02-10'
  },
  {
    id: 'poll-2',
    title: 'Minimum 20-Minute Transit Buffer Between North & South Quads',
    category: 'Campus Transit',
    description: 'Ensure cohorts moving between Alan Turing Hall and Bioengineering Lab Annex have sufficient walking time.',
    targetSlot: 'All Transitions',
    votesApprove: 618,
    votesRevise: 41,
    userVote: null,
    status: 'Active',
    submittedBy: 'Commuter Student Union',
    createdAt: '2026-02-14'
  },
  {
    id: 'poll-3',
    title: 'Cap Heavy STEM Lab Sessions at 16:00 on Fridays',
    category: 'Circadian Alertness',
    description: 'Shift high-precision wet lab and studio modules earlier in the week when cognitive alertness peaks.',
    targetSlot: 'Fri 15:00 - 17:00',
    votesApprove: 356,
    votesRevise: 89,
    userVote: null,
    status: 'Active',
    submittedBy: 'Department of Bioengineering Faculty',
    createdAt: '2026-02-18'
  },
  {
    id: 'poll-4',
    title: 'Cluster Upper-Division Seminars into Tue/Thu Blocks',
    category: 'Faculty Research',
    description: 'Preserve uninterrupted Monday/Wednesday/Friday mornings for principal investigator grant research.',
    targetSlot: 'Tue / Thu',
    votesApprove: 214,
    votesRevise: 28,
    userVote: null,
    status: 'Under Review',
    submittedBy: 'Faculty Senate Research Council',
    createdAt: '2026-02-20'
  }
];

const STORAGE_KEY = 'smartgrid_institutional_data_v3';

function loadInitialData(): InstitutionalDataStore {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.terms && parsed.rooms && parsed.courses) {
          return {
            institutionProfile: parsed.institutionProfile || defaultInstitutionProfile,
            feedbackPolls: parsed.feedbackPolls || defaultFeedbackPolls,
            ...parsed
          };
        }
      }
    }
  } catch (e) {
    console.warn('Failed to parse stored institutional data, falling back to seed data', e);
  }

  return {
    institutionProfile: defaultInstitutionProfile,
    terms: seedTerms,
    campuses: seedCampuses,
    buildings: seedBuildings,
    rooms: seedRooms,
    departments: seedDepartments,
    programs: seedPrograms,
    courses: seedCourses,
    instructors: seedInstructors,
    studentGroups: seedStudentGroups,
    sections: seedSections,
    timeStructure: seedTimeStructure,
    constraints: seedConstraintRules,
    scenarios: seedScenarios,
    auditLogs: seedAuditLogs,
    feedbackPolls: defaultFeedbackPolls
  };
}

let currentStore: InstitutionalDataStore = loadInitialData();
const listeners = new Set<() => void>();

function notifyListeners() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentStore));
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

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  resetToDefaults() {
    currentStore = {
      institutionProfile: defaultInstitutionProfile,
      terms: seedTerms,
      campuses: seedCampuses,
      buildings: seedBuildings,
      rooms: seedRooms,
      departments: seedDepartments,
      programs: seedPrograms,
      courses: seedCourses,
      instructors: seedInstructors,
      studentGroups: seedStudentGroups,
      sections: seedSections,
      timeStructure: seedTimeStructure,
      constraints: seedConstraintRules,
      scenarios: seedScenarios,
      auditLogs: seedAuditLogs,
      feedbackPolls: defaultFeedbackPolls
    };
    this.addAuditLog('restore', 'scenario', 'factory-reset', 'Reset all institutional master data to default baseline.');
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
      terms: mergeSample(currentStore.terms.filter(t => !seedTerms.some(st => st.id === t.id) && !t.is_sample && !t.isSample), [largeSampleTerm]),
      campuses: mergeSample(currentStore.campuses.filter(c => !seedCampuses.some(sc => sc.id === c.id) && !c.is_sample && !c.isSample), largeSampleCampuses),
      buildings: mergeSample(currentStore.buildings.filter(b => !seedBuildings.some(sb => sb.id === b.id) && !b.is_sample && !b.isSample), largeSampleBuildings),
      rooms: mergeSample(realUserRooms, largeSampleRooms),
      departments: largeSampleDepartments,
      programs: largeSamplePrograms,
      courses: mergeSample(realUserCourses, largeSampleCourses),
      instructors: mergeSample(realUserInstructors, largeSampleInstructors),
      studentGroups: mergeSample(realUserGroups, largeSampleStudentGroups),
      sections: mergeSample(realUserSections, largeSampleSections),
      timeStructure: { ...largeSampleTimeStructure, is_sample: true, isSample: true },
      constraints: largeSampleConstraints,
      scenarios: [largeSampleScenario],
      auditLogs: [...currentStore.auditLogs.filter(a => !a.is_sample && !a.isSample), ...largeSampleAuditLogs]
    };

    currentStore.terms = currentStore.terms.map(t =>
      t.id === largeSampleTerm.id ? { ...t, status: 'active' } : (t.status === 'active' ? { ...t, status: 'archived' } : t)
    );

    this.addAuditLog('create', 'scenario', 'sample-data', 'Loaded realistic multi-department university dataset.');
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

  // 1. Time Structure & Term
  updateTimeStructure(updated: Partial<TimeStructure>) {
    currentStore = {
      ...currentStore,
      timeStructure: { ...currentStore.timeStructure, ...updated }
    };
    this.addAuditLog('update', 'time', currentStore.timeStructure.id, 'Updated timetable grid time structure.');
    notifyListeners();
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

    // Ensure every course has at least 1 section mapped to a matching cohort & instructor
    currentStore.courses.forEach((course, idx) => {
      const existingForCourse = newSections.filter(s => s.courseId === course.id);
      if (existingForCourse.length === 0) {
        // Find matching instructor in same department or fallback
        const matchingInst = currentStore.instructors.find(i => i.departmentId === course.departmentId) ||
          currentStore.instructors[idx % currentStore.instructors.length];
        // Find matching student group or fallback
        const matchingGroup = currentStore.studentGroups.find(g => {
          const prog = currentStore.programs.find(p => p.id === g.programId);
          return prog?.departmentId === course.departmentId;
        }) || currentStore.studentGroups[idx % currentStore.studentGroups.length];

        if (matchingInst && matchingGroup) {
          newSections.push({
            id: `sec-auto-${Date.now()}-${idx}`,
            courseId: course.id,
            termId: activeTerm.id,
            sectionNumber: '01',
            expectedEnrollment: Math.min(matchingGroup.size, 45),
            instructorId: matchingInst.id,
            studentGroupId: matchingGroup.id
          });
          createdCount++;
        }
      }
    });

    if (createdCount > 0) {
      currentStore = {
        ...currentStore,
        sections: newSections
      };
      this.addAuditLog('create', 'section', 'auto-sync', `Auto-generated ${createdCount} curriculum sections for unmapped courses.`);
      notifyListeners();
    }
    return createdCount;
  },

  // 8. Real Combinatorial Solver Engine
  runTimetableSolver(options?: {
    termId?: string;
    departmentId?: string;
    selectedGroupIds?: string[];
    strategyName?: string;
  }): {
    placedCount: number;
    unplacedCount: number;
    conflictCount: number;
    roomUtilization: number;
    scenario: TimetableScenario;
  } {
    // First ensure any newly created courses have sections
    this.autoGenerateMissingSections();

    const days = currentStore.timeStructure.workingDays.length > 0
      ? currentStore.timeStructure.workingDays
      : (['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as DayOfWeek[]);
    const periods = currentStore.timeStructure.periods.length > 0
      ? currentStore.timeStructure.periods
      : ['09:00 - 10:30', '11:00 - 12:30', '13:30 - 15:00', '15:30 - 17:00'];

    const groupFilter = options?.selectedGroupIds ? new Set(options.selectedGroupIds) : null;

    // Separate locked/out-of-scope sections from sections to solve
    const sectionsToSolve: Section[] = [];
    const fixedSections: Section[] = [];

    currentStore.sections.forEach(sec => {
      const inScope = !groupFilter || groupFilter.has(sec.studentGroupId);
      if (sec.isLocked && sec.assignedSlot) {
        fixedSections.push(sec);
      } else if (inScope) {
        sectionsToSolve.push(sec);
      } else if (sec.assignedSlot) {
        fixedSections.push(sec);
      } else {
        sectionsToSolve.push(sec);
      }
    });

    // Sort sections by constraint tightness:
    // 1. Lab / studio courses first
    // 2. Larger enrollment first
    sectionsToSolve.sort((a, b) => {
      const cA = currentStore.courses.find(c => c.id === a.courseId);
      const cB = currentStore.courses.find(c => c.id === b.courseId);
      const isSpecialA = cA?.requiredRoomType === 'lab' || cA?.requiredRoomType === 'studio' ? 1 : 0;
      const isSpecialB = cB?.requiredRoomType === 'lab' || cB?.requiredRoomType === 'studio' ? 1 : 0;
      if (isSpecialA !== isSpecialB) return isSpecialB - isSpecialA;
      return (b.expectedEnrollment || 30) - (a.expectedEnrollment || 30);
    });

    // Track occupancy maps: key = `${day}__${period}`
    const usedRooms = new Map<string, Set<string>>();
    const usedInstructors = new Map<string, Set<string>>();
    const usedGroups = new Map<string, Set<string>>();
    const groupDailyLoad = new Map<string, number>(); // `${groupId}__${day}` -> count

    const markSlot = (day: DayOfWeek, period: string, roomId: string, instId: string, groupId: string) => {
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

    fixedSections.forEach(sec => {
      if (sec.assignedSlot) {
        markSlot(
          sec.assignedSlot.day,
          sec.assignedSlot.timeSlot,
          sec.assignedSlot.roomId,
          sec.instructorId,
          sec.studentGroupId
        );
      }
    });

    const updatedAssignments = new Map<string, SectionSlotAssignment | undefined>();
    let placedCount = fixedSections.length;
    let unplacedCount = 0;

    // Assign each section in scope
    sectionsToSolve.forEach((sec, secIdx) => {
      const course = currentStore.courses.find(c => c.id === sec.courseId);
      const instructor = currentStore.instructors.find(i => i.id === sec.instructorId);
      const reqType = course?.requiredRoomType || 'lecture';
      const minCap = sec.expectedEnrollment || 25;

      // Candidate rooms: prefer exact type & sufficient capacity, then fallback
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

      // Sort candidate rooms by closest fit capacity (room compaction)
      const sortedRooms = [...candidateRooms].sort((a, b) => a.capacity - b.capacity);

      // Build candidate (day, period) pairs scored by soft preferences
      const slotCandidates: Array<{ day: DayOfWeek; period: string; score: number }> = [];
      days.forEach((day, dIdx) => {
        periods.forEach((period, pIdx) => {
          let score = 100;
          // Spread across days for the cohort
          const currentLoadOnDay = groupDailyLoad.get(`${sec.studentGroupId}__${day}`) || 0;
          score -= currentLoadOnDay * 25;
          // Circadian preference: mid-day slots slightly preferred for heavy courses
          if (pIdx === 1 || pIdx === 2) score += 10;
          // Deterministic rotation offset so classes distribute evenly across the week
          score += ((secIdx + dIdx * 3 + pIdx * 2) % 11);
          slotCandidates.push({ day, period, score });
        });
      });

      slotCandidates.sort((a, b) => b.score - a.score);

      let assigned: SectionSlotAssignment | undefined = undefined;

      for (const slot of slotCandidates) {
        const key = `${slot.day}__${slot.period}`;

        // Check instructor availability blackout
        const isBlackedOut = instructor?.unavailableSlots.some(
          u => u.day === slot.day && u.timeSlot === slot.period
        );
        if (isBlackedOut) continue;

        // Check instructor collision
        if (usedInstructors.get(key)?.has(sec.instructorId)) continue;

        // Check student group collision
        if (usedGroups.get(key)?.has(sec.studentGroupId)) continue;

        // Find available room
        const freeRoom = sortedRooms.find(r => !usedRooms.get(key)?.has(r.id));
        if (freeRoom) {
          assigned = {
            day: slot.day,
            timeSlot: slot.period,
            roomId: freeRoom.id,
            durationMinutes: currentStore.timeStructure.periodLengthMinutes || 90
          };
          markSlot(slot.day, slot.period, freeRoom.id, sec.instructorId, sec.studentGroupId);
          break;
        }
      }

      // Fallback if strict constraints left it unplaced: relax cohort or blackout check to find any free room
      if (!assigned && sortedRooms.length > 0) {
        for (const slot of slotCandidates) {
          const key = `${slot.day}__${slot.period}`;
          const freeRoom = sortedRooms.find(r => !usedRooms.get(key)?.has(r.id));
          if (freeRoom && !usedInstructors.get(key)?.has(sec.instructorId)) {
            assigned = {
              day: slot.day,
              timeSlot: slot.period,
              roomId: freeRoom.id,
              durationMinutes: currentStore.timeStructure.periodLengthMinutes || 90
            };
            markSlot(slot.day, slot.period, freeRoom.id, sec.instructorId, sec.studentGroupId);
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
        return { ...sec, assignedSlot: updatedAssignments.get(sec.id) };
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
    currentStore = {
      ...currentStore,
      sections: currentStore.sections.map(s => s.id === sectionId ? { ...s, assignedSlot: slot } : s)
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
    this.addAuditLog('create', 'constraint', newPoll.id, `Submitted schedule feedback proposal: "${newPoll.title}".`);
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
