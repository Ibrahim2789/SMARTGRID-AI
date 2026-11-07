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
  DayOfWeek
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

export interface InstitutionalDataStore {
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
}

const STORAGE_KEY = 'smartgrid_institutional_data_v2';

function loadInitialData(): InstitutionalDataStore {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.terms && parsed.rooms && parsed.courses) {
          return parsed;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to parse stored institutional data, falling back to seed data', e);
  }

  return {
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
    auditLogs: seedAuditLogs
  };
}

// In-memory singleton state
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
      auditLogs: seedAuditLogs
    };
    notifyListeners();
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

    // Ensure Spring 2026 is active
    currentStore.terms = currentStore.terms.map(t =>
      t.id === largeSampleTerm.id ? { ...t, status: 'active' } : (t.status === 'active' ? { ...t, status: 'archived' } : t)
    );

    this.addAuditLog('create', 'system', 'sample-data', 'Loaded realistic multi-department sample dataset.');
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

    // Restore clean default seed data if no real data was added
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

    this.addAuditLog('delete', 'system', 'sample-data', 'Removed all sample dataset records.');
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
    this.addAuditLog('update', 'term', id, `Updated term parameters.`);
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

  // 2. Rooms
  addRoom(room: Room) {
    currentStore = {
      ...currentStore,
      rooms: [...currentStore.rooms, room]
    };
    this.addAuditLog('create', 'room', room.id, `Created room ${room.code} (${room.name}).`);
    notifyListeners();
  },

  updateRoom(id: string, updated: Partial<Room>) {
    currentStore = {
      ...currentStore,
      rooms: currentStore.rooms.map(r => r.id === id ? { ...r, ...updated } : r)
    };
    this.addAuditLog('update', 'room', id, `Updated room details.`);
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

  // 3. Courses
  addCourse(course: Course) {
    currentStore = {
      ...currentStore,
      courses: [...currentStore.courses, course]
    };
    this.addAuditLog('create', 'course', course.id, `Created course ${course.code} - ${course.title}.`);
    notifyListeners();
  },

  updateCourse(id: string, updated: Partial<Course>) {
    currentStore = {
      ...currentStore,
      courses: currentStore.courses.map(c => c.id === id ? { ...c, ...updated } : c)
    };
    this.addAuditLog('update', 'course', id, `Updated course details.`);
    notifyListeners();
  },

  deleteCourse(id: string) {
    const target = currentStore.courses.find(c => c.id === id);
    currentStore = {
      ...currentStore,
      courses: currentStore.courses.filter(c => c.id !== id)
    };
    this.addAuditLog('delete', 'course', id, `Deleted course ${target?.code || id}.`);
    notifyListeners();
  },

  // 4. Instructors
  addInstructor(instructor: Instructor) {
    currentStore = {
      ...currentStore,
      instructors: [...currentStore.instructors, instructor]
    };
    this.addAuditLog('create', 'instructor', instructor.id, `Added instructor ${instructor.name}.`);
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
      updatedSlots.push({ day, timeSlot, reason: 'Manual blackout' });
    }

    this.updateInstructor(instructorId, { unavailableSlots: updatedSlots });
  },

  // 5. Student Groups
  addStudentGroup(group: StudentGroup) {
    currentStore = {
      ...currentStore,
      studentGroups: [...currentStore.studentGroups, group]
    };
    this.addAuditLog('create', 'group', group.id, `Created student cohort ${group.code}.`);
    notifyListeners();
  },

  updateStudentGroup(id: string, updated: Partial<StudentGroup>) {
    currentStore = {
      ...currentStore,
      studentGroups: currentStore.studentGroups.map(g => g.id === id ? { ...g, ...updated } : g)
    };
    this.addAuditLog('update', 'group', id, `Updated student group details.`);
    notifyListeners();
  },

  deleteStudentGroup(id: string) {
    const target = currentStore.studentGroups.find(g => g.id === id);
    currentStore = {
      ...currentStore,
      studentGroups: currentStore.studentGroups.filter(g => g.id !== id)
    };
    this.addAuditLog('delete', 'group', id, `Deleted student group ${target?.code || id}.`);
    notifyListeners();
  },

  // 6. Constraints & Rules
  toggleConstraint(id: string, enabled: boolean) {
    currentStore = {
      ...currentStore,
      constraints: currentStore.constraints.map(c => c.id === id ? { ...c, enabled } : c)
    };
    this.addAuditLog('update', 'constraint', id, `${enabled ? 'Enabled' : 'Disabled'} constraint.`);
    notifyListeners();
  },

  updateConstraintWeight(id: string, weight: number) {
    currentStore = {
      ...currentStore,
      constraints: currentStore.constraints.map(c => c.id === id ? { ...c, weight } : c)
    };
    notifyListeners();
  },

  // Section assignments (Moving/editing blocks in Timetable)
  updateSectionSlot(sectionId: string, slot?: { day: DayOfWeek; timeSlot: string; roomId: string }) {
    currentStore = {
      ...currentStore,
      sections: currentStore.sections.map(s => s.id === sectionId ? { ...s, assignedSlot: slot } : s)
    };
    notifyListeners();
  },

  // Audit Logs
  addAuditLog(action: any, entityType: any, entityId: string, summary: string) {
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      userId: 'user-admin',
      userName: 'Dr. Katherine Reynolds',
      action,
      entityType,
      entityId,
      summary
    };
    currentStore = {
      ...currentStore,
      auditLogs: [entry, ...currentStore.auditLogs.slice(0, 49)]
    };
  }
};

// React hook for component consumption
import { useState, useEffect } from 'react';

export function useInstitutionalData(): InstitutionalDataStore {
  const [data, setData] = useState<InstitutionalDataStore>(institutionalStore.get());

  useEffect(() => {
    return institutionalStore.subscribe(() => {
      setData(institutionalStore.get());
    });
  }, []);

  return data;
}
