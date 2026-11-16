import React, { useState, useEffect, useMemo } from 'react';
import { RouteType } from './SmartGridNav';
import { institutionalStore, useInstitutionalData } from '../data/store';
import {
  Room,
  Course,
  Instructor,
  StudentGroup,
  Department,
  DayOfWeek,
  RoomType,
  computeAcademicScheduleConfig
} from '../types/institutional';
import {
  Check,
  X,
  Plus,
  AlertCircle,
  Download,
  Trash2,
  Edit2,
  ArrowRight,
  ArrowLeft,
  Layers,
  BookOpen,
  Sliders,
  Clock,
  Calendar,
  Users,
  DoorOpen,
  Building2,
  Search,
  ArrowUpDown,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { showAppPopup } from './ToastPopupHost';
import {
  AuthenticatedVotingUser,
  createDepartmentBackend,
  createClassroomBackend,
  createCourseBackend,
  createInstructorBackend,
  createBatchAdmin,
  fetchStudentsBackend,
  BackendStudentDirectoryDTO
} from '../services/votingApi';

interface SetupFlowProps {
  initialStep?: number;
  onStepChange?: (stepIdx: number) => void;
  onNavigate: (route: RouteType) => void;
  currentUser?: AuthenticatedVotingUser | null;
}

export const SetupFlow: React.FC<SetupFlowProps> = ({
  initialStep = 2,
  onStepChange,
  onNavigate,
  currentUser
}) => {
  const store = useInstitutionalData();
  const computedTiming = computeAcademicScheduleConfig(store.timeStructure);
  const [activeStep, setActiveStep] = useState(initialStep);

  useEffect(() => {
    setActiveStep(initialStep);
  }, [initialStep]);

  const selectStep = (idx: number) => {
    setActiveStep(idx);
    onStepChange?.(idx);
    setSideDrawerOpen(false);
    setExpandedRowId(null);
  };

  const [sideDrawerOpen, setSideDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Instructor modal availability state
  const [selectedInstructorForGrid, setSelectedInstructorForGrid] = useState<Instructor | null>(null);

  // My Preferences local interactive state
  const [preferredTiming, setPreferredTiming] = useState<'morning' | 'midday' | 'afternoon'>('morning');
  const [unavailableDays, setUnavailableDays] = useState<DayOfWeek[]>([]);
  const [breakDurationMins, setBreakDurationMins] = useState<number>(60);
  const [maxConsecutiveClasses, setMaxConsecutiveClasses] = useState<number>(3);
  const [maxDailyWorkloadHours, setMaxDailyWorkloadHours] = useState<number>(6);

  // Registered Students directory from GET /api/students
  const [registeredStudents, setRegisteredStudents] = useState<BackendStudentDirectoryDTO[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    if (activeStep !== 4 || !currentUser?.token) return;
    let cancelled = false;
    setLoadingStudents(true);
    const uniId = store.institutionProfile?.id || institutionalStore.getCurrentInstitutionId();
    fetchStudentsBackend(currentUser, uniId)
      .then(rows => {
        if (!cancelled) setRegisteredStudents(rows);
      })
      .catch(() => {
        if (!cancelled) setRegisteredStudents([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingStudents(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeStep, currentUser, store.institutionProfile?.id]);

  // Search, Filter & Sort states per step
  const [deptSearch, setDeptSearch] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [roomTypeFilter, setRoomTypeFilter] = useState<'ALL' | RoomType>('ALL');
  const [roomSortKey, setRoomSortKey] = useState<'code' | 'building' | 'capacity' | 'type'>('code');
  const [roomSortAsc, setRoomSortAsc] = useState(true);

  const [courseSearch, setCourseSearch] = useState('');
  const [courseDeptFilter, setCourseDeptFilter] = useState<string>('ALL');
  const [courseTypeFilter, setCourseTypeFilter] = useState<'ALL' | 'lecture' | 'lab'>('ALL');
  const [courseSortKey, setCourseSortKey] = useState<'code' | 'title' | 'type' | 'sections'>('code');
  const [courseSortAsc, setCourseSortAsc] = useState(true);

  const [instSearch, setInstSearch] = useState('');
  const [instDeptFilter, setInstDeptFilter] = useState<string>('ALL');
  const [instStatusFilter, setInstStatusFilter] = useState<'ALL' | 'available' | 'restricted'>('ALL');
  const [instSortKey, setInstSortKey] = useState<'name' | 'dept' | 'load'>('name');
  const [instSortAsc, setInstSortAsc] = useState(true);

  const [groupSearch, setGroupSearch] = useState('');
  const [groupDeptFilter, setGroupDeptFilter] = useState<string>('ALL');
  const [groupYearFilter, setGroupYearFilter] = useState<string>('ALL');
  const [groupSortKey, setGroupSortKey] = useState<'code' | 'dept' | 'semester' | 'size'>('code');
  const [groupSortAsc, setGroupSortAsc] = useState(true);

  const [sectionSearch, setSectionSearch] = useState('');
  const [sectionTypeFilter, setSectionTypeFilter] = useState<'ALL' | 'Lecture' | 'Lab'>('ALL');

  // Pagination states
  const PAGE_SIZE = 15;
  const [roomPage, setRoomPage] = useState(1);
  const [coursePage, setCoursePage] = useState(1);
  const [instructorPage, setInstructorPage] = useState(1);
  const [groupPage, setGroupPage] = useState(1);
  const [sectionPage, setSectionPage] = useState(1);

  // Forms
  const [deptForm, setDeptForm] = useState({
    code: '',
    name: '',
    school: 'School of Engineering & Sciences'
  });

  const [roomForm, setRoomForm] = useState({
    code: '',
    buildingName: 'Alan Turing Hall',
    capacity: 45,
    type: 'lecture' as RoomType,
    equipment: 'Projector, Whiteboard, Audio System'
  });

  const [courseForm, setCourseForm] = useState({
    code: '',
    title: '',
    departmentId: store.departments[0]?.id || 'dept-cs',
    creditHours: 4,
    weeklyContactHours: 4,
    requiredRoomType: 'lecture' as RoomType
  });

  const [instructorForm, setInstructorForm] = useState({
    name: '',
    title: 'Associate Professor',
    departmentId: store.departments[0]?.id || 'dept-cs',
    maxWeeklyHours: 12
  });

  const [groupForm, setGroupForm] = useState({
    name: '',
    code: '',
    departmentCode: store.departments[0]?.code || 'BSCS',
    semester: 1,
    year: 1,
    size: 40
  });

  const [sectionForm, setSectionForm] = useState({
    courseId: store.courses[0]?.id || '',
    instructorId: store.instructors[0]?.id || '',
    studentGroupId: store.studentGroups[0]?.id || '',
    expectedEnrollment: 35
  });

  const showToast = (msg: string) => {
    showAppPopup({
      title: 'Catalog Updated',
      message: msg,
      variant: 'success'
    });
  };


  const renderPagination = (currentPage: number, totalItems: number, setPage: (p: number) => void) => {
    const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
    if (totalPages <= 1) return null;

    const startItem = (currentPage - 1) * PAGE_SIZE + 1;
    const endItem = Math.min(currentPage * PAGE_SIZE, totalItems);

    return (
      <div className="flex items-center justify-between px-4 py-3 bg-[#F7F6EF] border-t border-[#E4E2DA] text-xs text-[#77766F]">
        <div className="font-mono-tabular">
          Showing <span className="font-semibold text-[#171717]">{startItem}</span>–
          <span className="font-semibold text-[#171717]">{endItem}</span> of{' '}
          <span className="font-semibold text-[#171717]">{totalItems}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="btn-secondary h-8 text-xs"
          >
            Previous
          </button>
          <span className="px-2 font-mono-tabular text-xs font-semibold text-[#171717]">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="btn-secondary h-8 text-xs"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  const activeTerm = store.terms.find(t => t.status === 'active') || store.terms[0];

  const steps = [
    {
      title: 'Departments & Term',
      subtitle: `${store.departments.length} departments`,
      icon: Building2,
      isDone: store.departments.length > 0
    },
    {
      title: 'Campus Rooms & Labs',
      subtitle: `${store.rooms.length} facilities`,
      icon: DoorOpen,
      isDone: store.rooms.length > 0
    },
    {
      title: 'Course Catalog',
      subtitle: `${store.courses.length} courses`,
      icon: BookOpen,
      isDone: store.courses.length > 0
    },
    {
      title: 'Faculty & Availability',
      subtitle: `${store.instructors.length} instructors`,
      icon: Users,
      isDone: store.instructors.length > 0
    },
    {
      title: 'Student Cohorts',
      subtitle: `${store.studentGroups.length} cohorts`,
      icon: Layers,
      isDone: store.studentGroups.length > 0
    },
    {
      title: 'Course Sections',
      subtitle: `${store.sections.length} sections`,
      icon: Calendar,
      isDone: store.sections.length > 0
    },
    {
      title: 'My Preferences',
      subtitle: `${store.constraints.filter(c => c.enabled).length} active rules`,
      icon: Sliders,
      isDone: store.constraints.length > 0
    }
  ];

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      selectStep(activeStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      onNavigate('generate');
    }
  };

  const handlePrev = () => {
    if (activeStep > 0) {
      selectStep(activeStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDownloadTemplate = (type: string) => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    if (type === 'rooms') {
      csvContent += 'code,building,capacity,type,equipment\nHALL-101,Turing Hall,60,lecture,Projector\n';
    } else if (type === 'courses') {
      csvContent += 'code,title,creditHours,weeklyHours,roomType\nCS-101,Introduction to CS,4,4,lecture\n';
    }
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `smartgrid_${type}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Downloaded CSV template for ${type}.`);
  };

  // --- Step 0: Department Actions ---
  const handleOpenAddDept = (dept?: Department) => {
    setValidationError(null);
    if (dept) {
      setEditingItem(dept);
      setDeptForm({
        code: dept.code,
        name: dept.name,
        school: dept.school || 'School of Engineering & Sciences'
      });
    } else {
      setEditingItem(null);
      setDeptForm({
        code: '',
        name: '',
        school: 'School of Engineering & Sciences'
      });
    }
    setSideDrawerOpen(true);
  };

  const handleSaveDept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptForm.code.trim() || !deptForm.name.trim()) {
      setValidationError('Department code and name are required.');
      return;
    }
    const cleanCode = deptForm.code.trim().toUpperCase();
    const cleanName = deptForm.name.trim();
    const cleanSchool = deptForm.school.trim();
    if (editingItem) {
      institutionalStore.updateDepartment(editingItem.id, {
        code: cleanCode,
        name: cleanName,
        school: cleanSchool
      });
      showToast(`Updated department ${cleanCode}.`);
    } else {
      institutionalStore.addDepartment({
        id: `dept-${Date.now()}`,
        code: cleanCode,
        name: cleanName,
        school: cleanSchool,
        colorHex: '#171717'
      });
      showToast(`Added department ${cleanName}.`);
    }
    if (currentUser?.token) {
      void createDepartmentBackend(currentUser, {
        universityId: store.institutionProfile?.id || institutionalStore.getCurrentInstitutionId(),
        code: cleanCode,
        name: cleanName,
        facultyGroup: cleanSchool
      }).catch(() => {});
      void institutionalStore.syncToBackend(currentUser);
    }
    setSideDrawerOpen(false);
  };

  // --- Step 1: Room Actions ---
  const handleOpenAddRoom = (room?: Room) => {
    setValidationError(null);
    if (room) {
      setEditingItem(room);
      setRoomForm({
        code: room.code,
        buildingName: room.name || 'Alan Turing Hall',
        capacity: room.capacity,
        type: room.type,
        equipment: room.equipment.join(', ')
      });
    } else {
      setEditingItem(null);
      setRoomForm({
        code: '',
        buildingName: 'Alan Turing Hall',
        capacity: 45,
        type: 'lecture',
        equipment: 'Projector, Whiteboard, Audio System'
      });
    }
    setSideDrawerOpen(true);
  };

  const handleSaveRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomForm.code.trim()) {
      setValidationError('Room code is required.');
      return;
    }
    if (roomForm.capacity <= 0) {
      setValidationError('Room capacity must be greater than zero.');
      return;
    }
    const cleanCode = roomForm.code.trim();
    const cleanName = roomForm.buildingName.trim() || cleanCode;
    const eqList = roomForm.equipment.split(',').map(s => s.trim()).filter(Boolean);
    const roomId = editingItem ? editingItem.id : `room-${Date.now()}`;

    if (editingItem) {
      institutionalStore.updateRoom(editingItem.id, {
        code: cleanCode,
        name: cleanName,
        capacity: Number(roomForm.capacity),
        type: roomForm.type,
        equipment: eqList
      });
      showToast(`Updated room ${cleanCode}.`);
    } else {
      institutionalStore.addRoom({
        id: roomId,
        buildingId: 'bld-turing',
        code: cleanCode,
        name: cleanName,
        capacity: Number(roomForm.capacity),
        type: roomForm.type,
        equipment: eqList,
        isAccessible: true,
        isAvailable: true
      });
      showToast(`Added room ${cleanCode} (${roomForm.capacity} seats).`);
    }
    if (currentUser?.token) {
      void createClassroomBackend(currentUser, {
        id: roomId,
        universityId: store.institutionProfile?.id || institutionalStore.getCurrentInstitutionId(),
        code: cleanCode,
        name: cleanName,
        capacity: Number(roomForm.capacity),
        type: roomForm.type,
        equipment: eqList,
        isAvailable: true
      }).catch(() => {});
      void institutionalStore.syncToBackend(currentUser);
    }
    setSideDrawerOpen(false);
  };

  // --- Step 2: Course Actions ---
  const handleOpenAddCourse = (course?: Course) => {
    setValidationError(null);
    if (course) {
      setEditingItem(course);
      setCourseForm({
        code: course.code,
        title: course.title,
        departmentId: course.departmentId || store.departments[0]?.id || 'dept-cs',
        creditHours: course.creditHours,
        weeklyContactHours: course.weeklyContactHours,
        requiredRoomType: course.requiredRoomType
      });
    } else {
      setEditingItem(null);
      setCourseForm({
        code: '',
        title: '',
        departmentId: store.departments[0]?.id || 'dept-cs',
        creditHours: 4,
        weeklyContactHours: 4,
        requiredRoomType: 'lecture'
      });
    }
    setSideDrawerOpen(true);
  };

  const handleSaveCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseForm.code.trim() || !courseForm.title.trim()) {
      setValidationError('Course code and title are required.');
      return;
    }

    const cleanCode = courseForm.code.trim().toUpperCase();
    const cleanTitle = courseForm.title.trim();
    const courseId = editingItem ? editingItem.id : `course-${Date.now()}`;
    const deptCode =
      store.departments.find(d => d.id === courseForm.departmentId)?.code || 'BSCS';

    if (editingItem) {
      institutionalStore.updateCourse(editingItem.id, {
        code: cleanCode,
        title: cleanTitle,
        departmentId: courseForm.departmentId,
        creditHours: Number(courseForm.creditHours),
        weeklyContactHours: Number(courseForm.weeklyContactHours),
        requiredRoomType: courseForm.requiredRoomType
      });
      showToast(`Updated course ${cleanCode}.`);
    } else {
      institutionalStore.addCourse({
        id: courseId,
        departmentId: courseForm.departmentId,
        code: cleanCode,
        title: cleanTitle,
        creditHours: Number(courseForm.creditHours),
        weeklyContactHours: Number(courseForm.weeklyContactHours),
        lectureHours: Number(courseForm.weeklyContactHours),
        labHours: courseForm.requiredRoomType === 'lab' ? Number(courseForm.weeklyContactHours) : 0,
        requiredRoomType: courseForm.requiredRoomType
      });
      showToast(`Added course ${cleanCode} — ${cleanTitle}.`);
    }
    if (currentUser?.token) {
      void createCourseBackend(currentUser, {
        id: courseId,
        universityId: store.institutionProfile?.id || institutionalStore.getCurrentInstitutionId(),
        code: cleanCode,
        title: cleanTitle,
        departmentCode: deptCode,
        type: courseForm.requiredRoomType === 'lab' ? 'Lab' : 'Theory',
        creditHours: Number(courseForm.creditHours),
        hoursPerWeek: Number(courseForm.weeklyContactHours),
        requiredRoomType: courseForm.requiredRoomType
      }).catch(() => {});
      void institutionalStore.syncToBackend(currentUser);
    }
    setSideDrawerOpen(false);
  };

  // --- Step 3: Instructor Actions ---
  const handleOpenAddInstructor = (inst?: Instructor) => {
    setValidationError(null);
    if (inst) {
      setEditingItem(inst);
      setInstructorForm({
        name: inst.name,
        title: inst.title || 'Professor',
        departmentId: inst.departmentId,
        maxWeeklyHours: inst.maxWeeklyHours
      });
    } else {
      setEditingItem(null);
      setInstructorForm({
        name: '',
        title: 'Associate Professor',
        departmentId: store.departments[0]?.id || 'dept-cs',
        maxWeeklyHours: 12
      });
    }
    setSideDrawerOpen(true);
  };

  const handleSaveInstructor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!instructorForm.name.trim()) {
      setValidationError('Instructor name is required.');
      return;
    }

    const cleanName = instructorForm.name.trim();
    const instId = editingItem ? editingItem.id : `inst-${Date.now()}`;
    const instDomain =
      store.institutionProfile?.registrarEmail?.split('@')[1] ||
      currentUser?.email?.split('@')[1] ||
      'university.edu';
    const emailVal = editingItem?.email || `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@${instDomain}`;
    const deptCode =
      store.departments.find(d => d.id === instructorForm.departmentId)?.code || 'BSCS';

    if (editingItem) {
      institutionalStore.updateInstructor(editingItem.id, {
        name: cleanName,
        title: instructorForm.title.trim(),
        departmentId: instructorForm.departmentId,
        maxWeeklyHours: Number(instructorForm.maxWeeklyHours)
      });
      showToast(`Updated faculty profile for ${cleanName}.`);
    } else {
      institutionalStore.addInstructor({
        id: instId,
        departmentId: instructorForm.departmentId,
        name: cleanName,
        email: emailVal,
        title: instructorForm.title.trim() || 'Faculty Member',
        maxWeeklyHours: Number(instructorForm.maxWeeklyHours),
        maxConsecutiveHours: 3,
        preferredDays: ['Mon', 'Wed', 'Fri'],
        unavailableSlots: []
      });
      showToast(`Added faculty instructor ${cleanName}.`);
    }
    if (currentUser?.token) {
      void createInstructorBackend(currentUser, {
        id: instId,
        universityId: store.institutionProfile?.id || institutionalStore.getCurrentInstitutionId(),
        name: cleanName,
        email: emailVal,
        departmentCode: deptCode,
        designation: instructorForm.title.trim() || 'Professor',
        maxWeeklyHours: Number(instructorForm.maxWeeklyHours)
      }).catch(() => {});
      void institutionalStore.syncToBackend(currentUser);
    }
    setSideDrawerOpen(false);
  };

  // --- Step 4: Student Group Actions ---
  const handleOpenAddGroup = (grp?: StudentGroup) => {
    setValidationError(null);
    if (grp) {
      setEditingItem(grp);
      setGroupForm({
        name: grp.name,
        code: grp.code,
        departmentCode: grp.departmentCode || grp.code.split('-')[1] || 'BSCS',
        semester: grp.semester || grp.year * 2 - 1 || 1,
        year: grp.year,
        size: grp.size
      });
    } else {
      setEditingItem(null);
      setGroupForm({
        name: '',
        code: '',
        departmentCode: store.departments[0]?.code || 'BSCS',
        semester: 1,
        year: 1,
        size: 40
      });
    }
    setSideDrawerOpen(true);
  };

  const handleSaveGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupForm.code.trim()) {
      setValidationError('Cohort code is required.');
      return;
    }
    const cleanCode = groupForm.code.trim();
    const cleanName = groupForm.name.trim() || cleanCode;
    if (editingItem) {
      institutionalStore.updateStudentGroup(editingItem.id, {
        name: cleanName,
        code: cleanCode,
        departmentCode: groupForm.departmentCode,
        semester: Number(groupForm.semester),
        year: Number(groupForm.year),
        size: Number(groupForm.size)
      });
      showToast(`Updated student cohort ${cleanCode}.`);
    } else {
      const matchedDept = store.departments.find(d => d.code === groupForm.departmentCode);
      const matchedProg =
        store.programs.find(p => p.departmentId === matchedDept?.id) || store.programs[0];
      institutionalStore.addStudentGroup({
        id: `cohort-${Date.now()}`,
        programId: matchedProg?.id || 'prog-bsc-cs',
        departmentCode: groupForm.departmentCode,
        semester: Number(groupForm.semester),
        name: cleanName,
        code: cleanCode,
        year: Number(groupForm.year),
        size: Number(groupForm.size),
        sharedCourseIds: []
      });
      showToast(`Added student cohort ${cleanCode}.`);
    }
    if (currentUser?.token) {
      void createBatchAdmin(currentUser, {
        code: cleanCode,
        name: cleanName,
        departmentCode: groupForm.departmentCode,
        year: Number(groupForm.year),
        semester: Number(groupForm.semester),
        studentCount: Number(groupForm.size)
      }).catch(() => {});
      void institutionalStore.syncToBackend(currentUser);
    }
    setSideDrawerOpen(false);
  };

  const handleAddSectionInline = (e: React.FormEvent) => {
    e.preventDefault();
    const courseId = sectionForm.courseId || store.courses[0]?.id;
    const instructorId = sectionForm.instructorId || store.instructors[0]?.id;
    const studentGroupId = sectionForm.studentGroupId || store.studentGroups[0]?.id;
    if (!courseId || !instructorId || !studentGroupId) return;

    institutionalStore.addSection({
      id: `sec-${Date.now()}`,
      courseId,
      termId: activeTerm?.id || 'term-spring-2026',
      sectionNumber: `0${store.sections.filter(s => s.courseId === courseId).length + 1}`,
      expectedEnrollment: Number(sectionForm.expectedEnrollment) || 35,
      instructorId,
      studentGroupId
    });
    const course = store.courses.find(c => c.id === courseId);
    const group = store.studentGroups.find(g => g.id === studentGroupId);
    showToast(`Added section for ${course?.code} (${group?.code}).`);
  };

  // --- Filtered & Sorted Datasets for Horizontal Tables ---
  const filteredDepartments = useMemo(() => {
    const q = deptSearch.trim().toLowerCase();
    return store.departments.filter(
      d =>
        !q ||
        d.code.toLowerCase().includes(q) ||
        d.name.toLowerCase().includes(q) ||
        (d.school || '').toLowerCase().includes(q)
    );
  }, [store.departments, deptSearch]);

  const filteredRooms = useMemo(() => {
    const q = roomSearch.trim().toLowerCase();
    const list = store.rooms.filter(r => {
      if (roomTypeFilter !== 'ALL' && r.type !== roomTypeFilter) return false;
      if (!q) return true;
      return (
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q) ||
        r.equipment.some(eq => eq.toLowerCase().includes(q))
      );
    });
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (roomSortKey === 'code') cmp = a.code.localeCompare(b.code);
      else if (roomSortKey === 'building') cmp = a.name.localeCompare(b.name);
      else if (roomSortKey === 'capacity') cmp = a.capacity - b.capacity;
      else if (roomSortKey === 'type') cmp = a.type.localeCompare(b.type);
      return roomSortAsc ? cmp : -cmp;
    });
  }, [store.rooms, roomSearch, roomTypeFilter, roomSortKey, roomSortAsc]);

  const filteredCourses = useMemo(() => {
    const q = courseSearch.trim().toLowerCase();
    const list = store.courses.filter(c => {
      if (courseDeptFilter !== 'ALL' && c.departmentId !== courseDeptFilter) return false;
      if (courseTypeFilter === 'lab' && c.requiredRoomType !== 'lab') return false;
      if (courseTypeFilter === 'lecture' && c.requiredRoomType === 'lab') return false;
      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.requiredRoomType.toLowerCase().includes(q)
      );
    });
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (courseSortKey === 'code') cmp = a.code.localeCompare(b.code);
      else if (courseSortKey === 'title') cmp = a.title.localeCompare(b.title);
      else if (courseSortKey === 'type') cmp = a.requiredRoomType.localeCompare(b.requiredRoomType);
      else if (courseSortKey === 'sections') {
        const secA = store.sections.filter(s => s.courseId === a.id).length;
        const secB = store.sections.filter(s => s.courseId === b.id).length;
        cmp = secA - secB;
      }
      return courseSortAsc ? cmp : -cmp;
    });
  }, [
    store.courses,
    store.sections,
    courseSearch,
    courseDeptFilter,
    courseTypeFilter,
    courseSortKey,
    courseSortAsc
  ]);

  const filteredInstructors = useMemo(() => {
    const q = instSearch.trim().toLowerCase();
    const list = store.instructors.filter(inst => {
      if (instDeptFilter !== 'ALL' && inst.departmentId !== instDeptFilter) return false;
      if (instStatusFilter === 'available' && inst.unavailableSlots.length > 0) return false;
      if (instStatusFilter === 'restricted' && inst.unavailableSlots.length === 0) return false;
      if (!q) return true;
      const dept = store.departments.find(d => d.id === inst.departmentId);
      return (
        inst.name.toLowerCase().includes(q) ||
        inst.email.toLowerCase().includes(q) ||
        (inst.title || '').toLowerCase().includes(q) ||
        (dept?.code || '').toLowerCase().includes(q) ||
        (dept?.name || '').toLowerCase().includes(q)
      );
    });
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (instSortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (instSortKey === 'dept') {
        const dA = store.departments.find(d => d.id === a.departmentId)?.code || '';
        const dB = store.departments.find(d => d.id === b.departmentId)?.code || '';
        cmp = dA.localeCompare(dB);
      } else if (instSortKey === 'load') {
        const loadA = store.sections.filter(s => s.instructorId === a.id).length;
        const loadB = store.sections.filter(s => s.instructorId === b.id).length;
        cmp = loadA - loadB;
      }
      return instSortAsc ? cmp : -cmp;
    });
  }, [
    store.instructors,
    store.departments,
    store.sections,
    instSearch,
    instDeptFilter,
    instStatusFilter,
    instSortKey,
    instSortAsc
  ]);

  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    const list = store.studentGroups.filter(g => {
      const prog = store.programs.find(p => p.id === g.programId);
      const dept = store.departments.find(d => d.id === prog?.departmentId);
      const deptCode = g.departmentCode || dept?.code || g.code.split('-')[1] || 'ACAD';
      if (groupDeptFilter !== 'ALL' && deptCode !== groupDeptFilter && dept?.id !== groupDeptFilter) {
        return false;
      }
      if (groupYearFilter !== 'ALL' && String(g.year) !== groupYearFilter) return false;
      if (!q) return true;
      return (
        g.code.toLowerCase().includes(q) ||
        g.name.toLowerCase().includes(q) ||
        deptCode.toLowerCase().includes(q)
      );
    });
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (groupSortKey === 'code') cmp = a.code.localeCompare(b.code);
      else if (groupSortKey === 'dept') {
        const dA = a.departmentCode || a.code.split('-')[1] || '';
        const dB = b.departmentCode || b.code.split('-')[1] || '';
        cmp = dA.localeCompare(dB);
      } else if (groupSortKey === 'semester') {
        cmp = (a.semester || a.year) - (b.semester || b.year);
      } else if (groupSortKey === 'size') {
        cmp = a.size - b.size;
      }
      return groupSortAsc ? cmp : -cmp;
    });
  }, [
    store.studentGroups,
    store.programs,
    store.departments,
    groupSearch,
    groupDeptFilter,
    groupYearFilter,
    groupSortKey,
    groupSortAsc
  ]);

  const filteredSections = useMemo(() => {
    const q = sectionSearch.trim().toLowerCase();
    return store.sections.filter(sec => {
      const isLab = sec.sessionType === 'Lab' || (sec.spanSlots && sec.spanSlots > 1);
      if (sectionTypeFilter === 'Lab' && !isLab) return false;
      if (sectionTypeFilter === 'Lecture' && isLab) return false;
      if (!q) return true;
      const course = store.courses.find(c => c.id === sec.courseId);
      const inst = store.instructors.find(i => i.id === sec.instructorId);
      const grp = store.studentGroups.find(g => g.id === sec.studentGroupId);
      return (
        (course?.code || '').toLowerCase().includes(q) ||
        (course?.title || '').toLowerCase().includes(q) ||
        (inst?.name || '').toLowerCase().includes(q) ||
        (grp?.code || '').toLowerCase().includes(q)
      );
    });
  }, [store.sections, store.courses, store.instructors, store.studentGroups, sectionSearch, sectionTypeFilter]);

  const isClassesAndSectionsGroup = activeStep === 4 || activeStep === 5 || activeStep === 0;
  const isInstructorsGroup = activeStep === 3 || activeStep === 6;

  const currentSectionTitle =
    activeStep === 1
      ? 'Classrooms & Laboratories'
      : activeStep === 2
      ? 'Courses'
      : isInstructorsGroup
      ? 'Instructors & Availability'
      : 'Batches, Sections & Departments';

  const currentSectionSubtitle =
    activeStep === 1
      ? 'Manage campus lecture halls, specialized laboratories, seating capacities, and room availability.'
      : activeStep === 2
      ? 'Manage the university course catalog, assigned instructors, semester sections, and lecture/laboratory types.'
      : isInstructorsGroup
      ? 'Manage faculty members, department assignments, availability status, and weekly teaching loads.'
      : 'Manage student batches, sections, academic semesters, and university departments.';

  return (
    <div className="space-y-6">
      {/* =========================================================
          1. CONTEXTUAL PAGE HEADING & INTERNAL SUB-VIEW TABS
         ========================================================= */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-[#E4E2DA]">
        <div className="space-y-1">
          <h1 className="font-serif-editorial text-3xl sm:text-4xl text-[#171717] tracking-tight">
            {currentSectionTitle}
          </h1>
          <p className="text-xs sm:text-sm text-[#77766F]">
            Active Term · {activeTerm?.name || 'Fall 2026'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('generate')}
            className="btn-primary text-xs h-9"
          >
            <span>Generate Schedule</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Internal Sub-Tabs for Classes/Sections/Departments or Instructors */}
      {isClassesAndSectionsGroup && (
        <div
          className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#EDEAE0]/70 border border-[#E4E2DA]"
          role="tablist"
          aria-label="Batches and sections views"
        >
          {[
            {
              stepIdx: 4,
              label: 'Batches & Sections',
              count: store.studentGroups.length,
              icon: Layers
            },
            {
              stepIdx: 5,
              label: 'Course Section Mappings',
              count: store.sections.length,
              icon: Calendar
            },
            {
              stepIdx: 0,
              label: 'Departments & Time Slots',
              count: store.departments.length,
              icon: Building2
            }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeStep === tab.stepIdx;
            return (
              <button
                key={tab.stepIdx}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectStep(tab.stepIdx)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#171717] text-white'
                    : 'text-[#57564F] hover:text-[#171717]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span
                  className={`text-[11px] font-mono-tabular ${
                    active ? 'text-white/75' : 'text-[#77766F]'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {isInstructorsGroup && (
        <div
          className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#EDEAE0]/70 border border-[#E4E2DA]"
          role="tablist"
          aria-label="Instructor management views"
        >
          {[
            {
              stepIdx: 3,
              label: 'Instructors & Teaching Load',
              count: store.instructors.length,
              icon: Users
            },
            {
              stepIdx: 6,
              label: 'Scheduling Rules & Preferences',
              count: store.constraints.filter(c => c.enabled).length,
              icon: Sliders
            }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeStep === tab.stepIdx;
            return (
              <button
                key={tab.stepIdx}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectStep(tab.stepIdx)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#171717] text-white'
                    : 'text-[#57564F] hover:text-[#171717]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span
                  className={`text-[11px] font-mono-tabular ${
                    active ? 'text-white/75' : 'text-[#77766F]'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      )}


      {/* =========================================================
          2. HORIZONTAL ROW-BASED DATA TABLES
         ========================================================= */}
      <div className="space-y-6">
        {/* STEP 0: Departments & Academic Time Grid (Compact Horizontal Table) */}
        {activeStep === 0 && (
          <div className="sf-card-white p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E2DA] pb-4">
              <h2 className="font-serif-editorial text-2xl text-[#171717]">
                University Departments ({filteredDepartments.length})
              </h2>
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="input-group-field h-9 px-3 gap-2 w-56">
                  <Search className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                  <input
                    type="text"
                    placeholder="Search departments..."
                    value={deptSearch}
                    onChange={e => setDeptSearch(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <button onClick={() => handleOpenAddDept()} className="btn-primary text-xs h-9">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Department</span>
                </button>
              </div>
            </div>

            {/* Compact Horizontal Table of Departments */}
            <div className="border border-[#E4E2DA] rounded-xl overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F7F6EF] text-[#57564F] border-b border-[#E4E2DA]">
                      <th className="py-3 px-4 font-semibold w-28">Code</th>
                      <th className="py-3 px-4 font-semibold">Department Name</th>
                      <th className="py-3 px-4 font-semibold hidden md:table-cell">Academic School</th>
                      <th className="py-3 px-4 font-semibold text-right font-mono-tabular">Courses</th>
                      <th className="py-3 px-4 font-semibold text-right font-mono-tabular">Faculty</th>
                      <th className="py-3 px-4 font-semibold text-right font-mono-tabular">Sections</th>
                      <th className="py-3 px-4 font-semibold text-right w-28">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E2DA]">
                    {filteredDepartments.map(dept => {
                      const courseCount = store.courses.filter(c => c.departmentId === dept.id).length;
                      const instCount = store.instructors.filter(i => i.departmentId === dept.id).length;
                      const progIds = new Set(
                        store.programs.filter(p => p.departmentId === dept.id).map(p => p.id)
                      );
                      const groupCount = store.studentGroups.filter(
                        g => progIds.has(g.programId) || g.departmentCode === dept.code
                      ).length;

                      return (
                        <tr key={dept.id} className="hover:bg-[#F7F6EF]/70 transition-colors">
                          <td className="py-3 px-4 font-mono-tabular font-bold text-[#171717]">
                            {dept.code}
                          </td>
                          <td className="py-3 px-4 font-semibold text-[#171717]">{dept.name}</td>
                          <td className="py-3 px-4 text-[#77766F] hidden md:table-cell">
                            {dept.school || 'School of Engineering & Computing'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular text-[#171717]">
                            {courseCount}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular text-[#171717]">
                            {instCount}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular text-[#171717]">
                            {groupCount}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenAddDept(dept)}
                                className="px-2 py-1 rounded hover:bg-[#EDEAE0] text-[#57564F] hover:text-[#171717] font-medium cursor-pointer"
                                title="Edit department"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => institutionalStore.deleteDepartment(dept.id)}
                                className="p-1 rounded hover:bg-[#FDE8E8] text-[#77766F] hover:text-[#8B1E1E] cursor-pointer"
                                title="Delete department"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Active Daily Time Slots Horizontal Table */}
            <div className="pt-4 border-t border-[#E4E2DA] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-serif-editorial text-lg text-[#171717]">
                    Active Academic Timings &amp; Breaks ({computedTiming.slots.length} Daily Slots)
                  </h3>
                  <p className="text-xs text-[#77766F]">
                    {computedTiming.summaryText} · Working Days: {computedTiming.workingDays.join(', ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('academic-config')}
                  className="btn-secondary h-9 text-xs shrink-0"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Configure Academic Timings &amp; Calendar</span>
                </button>
              </div>

              <div className="border border-[#E4E2DA] rounded-xl overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F7F6EF] text-[#57564F] border-b border-[#E4E2DA]">
                        <th className="py-2.5 px-4 font-semibold">Slot</th>
                        <th className="py-2.5 px-4 font-semibold">Time Period</th>
                        <th className="py-2.5 px-4 font-semibold">Session Window</th>
                        <th className="py-2.5 px-4 font-semibold">Transition Break</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4E2DA]">
                      {computedTiming.slots.map(slot => (
                        <tr key={slot.slotNumber} className="hover:bg-[#F7F6EF]/60">
                          <td className="py-2 px-4 font-mono-tabular font-semibold text-[#171717]">
                            Slot {slot.slotNumber}
                          </td>
                          <td className="py-2 px-4 font-mono-tabular text-[#171717]">
                            {slot.period}
                          </td>
                          <td className="py-2 px-4 text-[#57564F]">
                            {(slot.startMinutes ?? 540) < 780 ? 'Morning Session' : 'Afternoon Session'}
                          </td>
                          <td className="py-2 px-4 font-mono-tabular text-[#77766F]">
                            {computedTiming.shortBreakEnabled && computedTiming.shortBreakMinutes > 0
                              ? slot.shortBreak
                              : 'None'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#E4E2DA] flex justify-end">
              <button onClick={handleNext} className="btn-primary text-xs">
                <span>Continue to Classrooms &amp; Labs</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 1: Classrooms and Laboratories (Compact Horizontal Data Table) */}
        {activeStep === 1 && (
          <div className="sf-card-white p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E4E2DA] pb-4">
              <h2 className="font-serif-editorial text-2xl text-[#171717]">
                Classrooms and Laboratories ({filteredRooms.length})
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => handleDownloadTemplate('rooms')} className="btn-secondary text-xs h-9">
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV Template</span>
                </button>
                <button onClick={() => handleOpenAddRoom()} className="btn-primary text-xs h-9">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Classroom / Lab</span>
                </button>
              </div>
            </div>

            {/* Search & Compact Filters Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="input-group-field h-9 px-3 gap-2 flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                <input
                  type="text"
                  placeholder="Search by room code, building, or equipment..."
                  value={roomSearch}
                  onChange={e => {
                    setRoomSearch(e.target.value);
                    setRoomPage(1);
                  }}
                  className="text-xs"
                />
                {roomSearch && (
                  <button
                    type="button"
                    onClick={() => setRoomSearch('')}
                    className="text-[#77766F] hover:text-[#171717] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'ALL', label: `All Spaces (${store.rooms.length})` },
                    {
                      id: 'lecture',
                      label: `Classrooms (${store.rooms.filter(r => r.type === 'lecture').length})`
                    },
                    {
                      id: 'lab',
                      label: `Laboratories (${store.rooms.filter(r => r.type === 'lab').length})`
                    },
                    {
                      id: 'seminar',
                      label: `Seminar (${store.rooms.filter(r => r.type === 'seminar').length})`
                    }
                  ] as const
                ).map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setRoomTypeFilter(f.id as 'ALL' | RoomType);
                      setRoomPage(1);
                    }}
                    className={`h-8 px-3 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                      roomTypeFilter === f.id
                        ? 'bg-[#171717] text-white border-[#171717]'
                        : 'bg-[#F7F6EF] text-[#57564F] border-[#E4E2DA] hover:text-[#171717]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Compact Horizontal Rooms & Labs Table */}
            <div className="border border-[#E4E2DA] rounded-xl overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F7F6EF] text-[#57564F] border-b border-[#E4E2DA]">
                      <th className="py-3 px-4 font-semibold">
                        <button
                          type="button"
                          onClick={() => {
                            if (roomSortKey === 'code') setRoomSortAsc(!roomSortAsc);
                            else {
                              setRoomSortKey('code');
                              setRoomSortAsc(true);
                            }
                          }}
                          className="inline-flex items-center gap-1 hover:text-[#171717] cursor-pointer"
                        >
                          <span>Room / Laboratory</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-3 px-4 font-semibold">
                        <button
                          type="button"
                          onClick={() => {
                            if (roomSortKey === 'building') setRoomSortAsc(!roomSortAsc);
                            else {
                              setRoomSortKey('building');
                              setRoomSortAsc(true);
                            }
                          }}
                          className="inline-flex items-center gap-1 hover:text-[#171717] cursor-pointer"
                        >
                          <span>Building / Location</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-3 px-4 font-semibold text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (roomSortKey === 'capacity') setRoomSortAsc(!roomSortAsc);
                            else {
                              setRoomSortKey('capacity');
                              setRoomSortAsc(false);
                            }
                          }}
                          className="inline-flex items-center gap-1 hover:text-[#171717] cursor-pointer"
                        >
                          <span>Capacity</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-3 px-4 font-semibold">
                        <button
                          type="button"
                          onClick={() => {
                            if (roomSortKey === 'type') setRoomSortAsc(!roomSortAsc);
                            else {
                              setRoomSortKey('type');
                              setRoomSortAsc(true);
                            }
                          }}
                          className="inline-flex items-center gap-1 hover:text-[#171717] cursor-pointer"
                        >
                          <span>Room Type</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-3 px-4 font-semibold">Availability Status</th>
                      <th className="py-3 px-4 font-semibold text-right w-36">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E2DA]">
                    {filteredRooms
                      .slice((roomPage - 1) * PAGE_SIZE, roomPage * PAGE_SIZE)
                      .map(room => {
                        const assignedCount = store.sections.filter(
                          s => s.assignedSlot?.roomId === room.id
                        ).length;
                        const isExpanded = expandedRowId === room.id;

                        return (
                          <React.Fragment key={room.id}>
                            <tr className="hover:bg-[#F7F6EF]/70 transition-colors">
                              <td className="py-3 px-4 font-mono-tabular font-bold text-[#171717]">
                                {room.code}
                              </td>
                              <td className="py-3 px-4 text-[#171717] font-medium">
                                {room.name}
                              </td>
                              <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-[#171717]">
                                {room.capacity} seats
                              </td>
                              <td className="py-3 px-4 capitalize text-[#57564F]">
                                {room.type === 'lab'
                                  ? 'Laboratory'
                                  : room.type === 'lecture'
                                  ? 'Classroom / Lecture'
                                  : room.type}
                              </td>
                              <td className="py-3 px-4">
                                <span className="text-[#171717] font-medium">
                                  {room.isAvailable !== false ? 'Available' : 'Maintenance'}
                                </span>
                                <span className="text-[#77766F] font-mono-tabular ml-1.5">
                                  · {assignedCount} {assignedCount === 1 ? 'session' : 'sessions'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="inline-flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedRowId(isExpanded ? null : room.id)
                                    }
                                    className="px-2 py-1 rounded hover:bg-[#EDEAE0] text-[#57564F] hover:text-[#171717] font-medium cursor-pointer"
                                  >
                                    {isExpanded ? 'Hide' : 'Details'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAddRoom(room)}
                                    className="px-2 py-1 rounded hover:bg-[#EDEAE0] text-[#57564F] hover:text-[#171717] font-medium cursor-pointer"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => institutionalStore.deleteRoom(room.id)}
                                    className="p-1 rounded hover:bg-[#FDE8E8] text-[#77766F] hover:text-[#8B1E1E] cursor-pointer"
                                    title="Delete room"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-[#F7F6EF]/60">
                                <td colSpan={6} className="py-2.5 px-4 text-xs text-[#57564F]">
                                  <span className="font-semibold text-[#171717]">Equipment &amp; Specs:</span>{' '}
                                  {room.equipment.join(' · ') || 'Standard AV & Whiteboard'} · Accessible:{' '}
                                  {room.isAccessible ? 'Yes' : 'No'}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    {filteredRooms.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-xs text-[#77766F]">
                          No classrooms or laboratories match your search filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {renderPagination(roomPage, filteredRooms.length, setRoomPage)}
            </div>

            <div className="pt-4 border-t border-[#E4E2DA] flex justify-between">
              <button onClick={handlePrev} className="btn-secondary text-xs">
                <ArrowLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>
              <button onClick={handleNext} className="btn-primary text-xs">
                <span>Continue to Courses</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Courses (Compact Horizontal Data Table) */}
        {activeStep === 2 && (
          <div className="sf-card-white p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E4E2DA] pb-4">
              <h2 className="font-serif-editorial text-2xl text-[#171717]">
                Courses ({filteredCourses.length})
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => handleDownloadTemplate('courses')} className="btn-secondary text-xs h-9">
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV Template</span>
                </button>
                <button onClick={() => handleOpenAddCourse()} className="btn-primary text-xs h-9">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Course</span>
                </button>
              </div>
            </div>

            {/* Search & Compact Filters Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="input-group-field h-9 px-3 gap-2 flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                <input
                  type="text"
                  placeholder="Search by course code or title..."
                  value={courseSearch}
                  onChange={e => {
                    setCourseSearch(e.target.value);
                    setCoursePage(1);
                  }}
                  className="text-xs"
                />
                {courseSearch && (
                  <button
                    type="button"
                    onClick={() => setCourseSearch('')}
                    className="text-[#77766F] hover:text-[#171717] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={courseDeptFilter}
                  onChange={e => {
                    setCourseDeptFilter(e.target.value);
                    setCoursePage(1);
                  }}
                  className="h-8 px-3 rounded-lg border border-[#E4E2DA] bg-[#F7F6EF] text-xs font-medium text-[#171717]"
                >
                  <option value="ALL">All Departments</option>
                  {store.departments.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </option>
                  ))}
                </select>

                <div className="inline-flex items-center gap-1">
                  {(
                    [
                      { id: 'ALL', label: 'All Types' },
                      { id: 'lecture', label: 'Lecture' },
                      { id: 'lab', label: 'Lab' }
                    ] as const
                  ).map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setCourseTypeFilter(t.id);
                        setCoursePage(1);
                      }}
                      className={`h-8 px-3 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        courseTypeFilter === t.id
                          ? 'bg-[#171717] text-white border-[#171717]'
                          : 'bg-[#F7F6EF] text-[#57564F] border-[#E4E2DA] hover:text-[#171717]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Compact Horizontal Courses Table */}
            <div className="border border-[#E4E2DA] rounded-xl overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F7F6EF] text-[#57564F] border-b border-[#E4E2DA]">
                      <th className="py-3 px-4 font-semibold">
                        <button
                          type="button"
                          onClick={() => {
                            if (courseSortKey === 'code') setCourseSortAsc(!courseSortAsc);
                            else {
                              setCourseSortKey('code');
                              setCourseSortAsc(true);
                            }
                          }}
                          className="inline-flex items-center gap-1 hover:text-[#171717] cursor-pointer"
                        >
                          <span>Course Code &amp; Name</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-3 px-4 font-semibold">Assigned Instructor</th>
                      <th className="py-3 px-4 font-semibold">
                        <button
                          type="button"
                          onClick={() => {
                            if (courseSortKey === 'sections') setCourseSortAsc(!courseSortAsc);
                            else {
                              setCourseSortKey('sections');
                              setCourseSortAsc(false);
                            }
                          }}
                          className="inline-flex items-center gap-1 hover:text-[#171717] cursor-pointer"
                        >
                          <span>Semester / Section</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-3 px-4 font-semibold">
                        <button
                          type="button"
                          onClick={() => {
                            if (courseSortKey === 'type') setCourseSortAsc(!courseSortAsc);
                            else {
                              setCourseSortKey('type');
                              setCourseSortAsc(true);
                            }
                          }}
                          className="inline-flex items-center gap-1 hover:text-[#171717] cursor-pointer"
                        >
                          <span>Course Type</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-3 px-4 font-semibold text-right w-32">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E2DA]">
                    {filteredCourses
                      .slice((coursePage - 1) * PAGE_SIZE, coursePage * PAGE_SIZE)
                      .map(course => {
                        const dept = store.departments.find(d => d.id === course.departmentId);
                        const courseSections = store.sections.filter(s => s.courseId === course.id);
                        const primaryInst =
                          store.instructors.find(i => i.id === courseSections[0]?.instructorId) ||
                          store.instructors.find(i => i.departmentId === course.departmentId);
                        const primaryGroup = store.studentGroups.find(
                          g => g.id === courseSections[0]?.studentGroupId
                        );
                        const isLab =
                          course.requiredRoomType === 'lab' ||
                          course.code.endsWith('-L') ||
                          (course.labHours && course.labHours > 0);

                        return (
                          <tr key={course.id} className="hover:bg-[#F7F6EF]/70 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-baseline gap-2">
                                <span className="font-mono-tabular font-bold text-[#171717] shrink-0">
                                  {course.code}
                                </span>
                                <span className="font-semibold text-[#171717]">
                                  {course.title}
                                </span>
                              </div>
                              <div className="text-[11px] text-[#77766F] mt-0.5">
                                {dept?.name || 'Academic Department'} · {course.creditHours} Cr ·{' '}
                                {course.weeklyContactHours} hrs/wk
                              </div>
                            </td>
                            <td className="py-3 px-4 text-[#171717]">
                              {primaryInst ? (
                                <span>{primaryInst.name}</span>
                              ) : (
                                <span className="text-[#77766F]">Department Faculty</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono-tabular text-[#57564F]">
                              {primaryGroup ? (
                                <span>
                                  {primaryGroup.semester
                                    ? `Sem ${primaryGroup.semester}`
                                    : `Yr ${primaryGroup.year}`}{' '}
                                  · {primaryGroup.code}
                                  {courseSections.length > 1
                                    ? ` (+${courseSections.length - 1})`
                                    : ''}
                                </span>
                              ) : (
                                <span>{courseSections.length} sections</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-medium text-[#171717]">
                                {isLab ? 'Lab' : 'Lecture'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenAddCourse(course)}
                                  className="px-2 py-1 rounded hover:bg-[#EDEAE0] text-[#57564F] hover:text-[#171717] font-medium cursor-pointer"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => institutionalStore.deleteCourse(course.id)}
                                  className="p-1 rounded hover:bg-[#FDE8E8] text-[#77766F] hover:text-[#8B1E1E] cursor-pointer"
                                  title="Delete course"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    {filteredCourses.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-xs text-[#77766F]">
                          No courses match your current search or filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {renderPagination(coursePage, filteredCourses.length, setCoursePage)}
            </div>

            <div className="pt-4 border-t border-[#E4E2DA] flex justify-between">
              <button onClick={handlePrev} className="btn-secondary text-xs">
                <ArrowLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>
              <button onClick={handleNext} className="btn-primary text-xs">
                <span>Continue to Instructors</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Instructors (Compact Horizontal Data Table) */}
        {activeStep === 3 && (
          <div className="sf-card-white p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E4E2DA] pb-4">
              <h2 className="font-serif-editorial text-2xl text-[#171717]">
                Instructors ({filteredInstructors.length})
              </h2>
              <button onClick={() => handleOpenAddInstructor()} className="btn-primary text-xs h-9 self-start lg:self-auto">
                <Plus className="w-3.5 h-3.5" />
                <span>Add Instructor</span>
              </button>
            </div>

            {/* Search & Compact Filters Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="input-group-field h-9 px-3 gap-2 flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                <input
                  type="text"
                  placeholder="Search instructor name, title, or email..."
                  value={instSearch}
                  onChange={e => {
                    setInstSearch(e.target.value);
                    setInstructorPage(1);
                  }}
                  className="text-xs"
                />
                {instSearch && (
                  <button
                    type="button"
                    onClick={() => setInstSearch('')}
                    className="text-[#77766F] hover:text-[#171717] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={instDeptFilter}
                  onChange={e => {
                    setInstDeptFilter(e.target.value);
                    setInstructorPage(1);
                  }}
                  className="h-8 px-3 rounded-lg border border-[#E4E2DA] bg-[#F7F6EF] text-xs font-medium text-[#171717]"
                >
                  <option value="ALL">All Departments</option>
                  {store.departments.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </option>
                  ))}
                </select>

                <div className="inline-flex items-center gap-1">
                  {(
                    [
                      { id: 'ALL', label: 'All Statuses' },
                      { id: 'available', label: 'Fully Available' },
                      { id: 'restricted', label: 'Has Blocked Slots' }
                    ] as const
                  ).map(st => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        setInstStatusFilter(st.id);
                        setInstructorPage(1);
                      }}
                      className={`h-8 px-3 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        instStatusFilter === st.id
                          ? 'bg-[#171717] text-white border-[#171717]'
                          : 'bg-[#F7F6EF] text-[#57564F] border-[#E4E2DA] hover:text-[#171717]'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Compact Horizontal Instructors Table */}
            <div className="border border-[#E4E2DA] rounded-xl overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F7F6EF] text-[#57564F] border-b border-[#E4E2DA]">
                      <th className="py-3 px-4 font-semibold">
                        <button
                          type="button"
                          onClick={() => {
                            if (instSortKey === 'name') setInstSortAsc(!instSortAsc);
                            else {
                              setInstSortKey('name');
                              setInstSortAsc(true);
                            }
                          }}
                          className="inline-flex items-center gap-1 hover:text-[#171717] cursor-pointer"
                        >
                          <span>Instructor Name</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-3 px-4 font-semibold">
                        <button
                          type="button"
                          onClick={() => {
                            if (instSortKey === 'dept') setInstSortAsc(!instSortAsc);
                            else {
                              setInstSortKey('dept');
                              setInstSortAsc(true);
                            }
                          }}
                          className="inline-flex items-center gap-1 hover:text-[#171717] cursor-pointer"
                        >
                          <span>Department</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-3 px-4 font-semibold">Availability Status</th>
                      <th className="py-3 px-4 font-semibold text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (instSortKey === 'load') setInstSortAsc(!instSortAsc);
                            else {
                              setInstSortKey('load');
                              setInstSortAsc(false);
                            }
                          }}
                          className="inline-flex items-center gap-1 hover:text-[#171717] cursor-pointer"
                        >
                          <span>Assigned Teaching Load</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-3 px-4 font-semibold text-right w-48">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E2DA]">
                    {filteredInstructors
                      .slice((instructorPage - 1) * PAGE_SIZE, instructorPage * PAGE_SIZE)
                      .map(inst => {
                        const dept = store.departments.find(d => d.id === inst.departmentId);
                        const instSections = store.sections.filter(s => s.instructorId === inst.id);
                        const assignedHours = instSections.reduce(
                          (acc, s) =>
                            acc + (s.sessionType === 'Lab' || (s.spanSlots && s.spanSlots > 1) ? 3 : 1),
                          0
                        );

                        return (
                          <tr key={inst.id} className="hover:bg-[#F7F6EF]/70 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-[#171717]">{inst.name}</div>
                              <div className="text-[11px] text-[#77766F]">
                                {inst.title || 'Faculty'} · {inst.email}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-[#171717]">
                              <span className="font-mono-tabular font-semibold mr-1.5">
                                {dept?.code || 'DEPT'}
                              </span>
                              <span className="text-[#77766F] hidden sm:inline">
                                {dept?.name}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {inst.unavailableSlots.length === 0 ? (
                                <span className="text-[#171717] font-medium">
                                  Available ({inst.preferredDays.join(', ')})
                                </span>
                              ) : (
                                <span className="text-[#57564F] font-mono-tabular">
                                  {inst.unavailableSlots.length} slot(s) blocked
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-mono-tabular">
                              <span className="font-semibold text-[#171717]">
                                {assignedHours} / {inst.maxWeeklyHours} hrs
                              </span>
                              <span className="text-[#77766F] ml-1.5">
                                ({instSections.length} sec)
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => setSelectedInstructorForGrid(inst)}
                                  className="px-2.5 py-1 rounded bg-[#F7F6EF] hover:bg-[#EDEAE0] border border-[#E4E2DA] text-[#171717] font-medium cursor-pointer"
                                >
                                  Availability
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenAddInstructor(inst)}
                                  className="px-2 py-1 rounded hover:bg-[#EDEAE0] text-[#57564F] hover:text-[#171717] font-medium cursor-pointer"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => institutionalStore.deleteInstructor(inst.id)}
                                  className="p-1 rounded hover:bg-[#FDE8E8] text-[#77766F] hover:text-[#8B1E1E] cursor-pointer"
                                  title="Delete instructor"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    {filteredInstructors.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-xs text-[#77766F]">
                          No instructors match your search or filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {renderPagination(instructorPage, filteredInstructors.length, setInstructorPage)}
            </div>

            <div className="pt-4 border-t border-[#E4E2DA] flex justify-between">
              <button onClick={handlePrev} className="btn-secondary text-xs">
                <ArrowLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>
              <button onClick={handleNext} className="btn-primary text-xs">
                <span>Continue to Batches &amp; Sections</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Batches and Sections (Compact Horizontal Data Table) */}
        {activeStep === 4 && (
          <div className="sf-card-white p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E4E2DA] pb-4">
              <h2 className="font-serif-editorial text-2xl text-[#171717]">
                Batches and Sections ({filteredGroups.length})
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => handleOpenAddGroup()} className="btn-primary text-xs h-9">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Batch Section</span>
                </button>
              </div>
            </div>

            {/* Search & Compact Filters Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="input-group-field h-9 px-3 gap-2 flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                <input
                  type="text"
                  placeholder="Search by batch year (2K24), department (BSCS), or section..."
                  value={groupSearch}
                  onChange={e => {
                    setGroupSearch(e.target.value);
                    setGroupPage(1);
                  }}
                  className="text-xs"
                />
                {groupSearch && (
                  <button
                    type="button"
                    onClick={() => setGroupSearch('')}
                    className="text-[#77766F] hover:text-[#171717] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={groupDeptFilter}
                  onChange={e => {
                    setGroupDeptFilter(e.target.value);
                    setGroupPage(1);
                  }}
                  className="h-8 px-3 rounded-lg border border-[#E4E2DA] bg-[#F7F6EF] text-xs font-medium text-[#171717]"
                >
                  <option value="ALL">All Departments</option>
                  {store.departments.map(d => (
                    <option key={d.id} value={d.code}>
                      {d.code} — {d.name}
                    </option>
                  ))}
                </select>

                <select
                  value={groupYearFilter}
                  onChange={e => {
                    setGroupYearFilter(e.target.value);
                    setGroupPage(1);
                  }}
                  className="h-8 px-3 rounded-lg border border-[#E4E2DA] bg-[#F7F6EF] text-xs font-medium text-[#171717]"
                >
                  <option value="ALL">All Cohort Years</option>
                  <option value="1">Year 1 (Freshman)</option>
                  <option value="2">Year 2 (Sophomore)</option>
                  <option value="3">Year 3 (Junior)</option>
                  <option value="4">Year 4 (Senior)</option>
                </select>
              </div>
            </div>

            {/* Compact Horizontal Batches & Sections Table */}
            <div className="border border-[#E4E2DA] rounded-xl overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F7F6EF] text-[#57564F] border-b border-[#E4E2DA]">
                      <th className="py-3 px-4 font-semibold">
                        <button
                          type="button"
                          onClick={() => {
                            if (groupSortKey === 'code') setGroupSortAsc(!groupSortAsc);
                            else {
                              setGroupSortKey('code');
                              setGroupSortAsc(true);
                            }
                          }}
                          className="inline-flex items-center gap-1 hover:text-[#171717] cursor-pointer"
                        >
                          <span>Batch Name / Year</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-3 px-4 font-semibold">
                        <button
                          type="button"
                          onClick={() => {
                            if (groupSortKey === 'dept') setGroupSortAsc(!groupSortAsc);
                            else {
                              setGroupSortKey('dept');
                              setGroupSortAsc(true);
                            }
                          }}
                          className="inline-flex items-center gap-1 hover:text-[#171717] cursor-pointer"
                        >
                          <span>Department</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-3 px-4 font-semibold">
                        <button
                          type="button"
                          onClick={() => {
                            if (groupSortKey === 'semester') setGroupSortAsc(!groupSortAsc);
                            else {
                              setGroupSortKey('semester');
                              setGroupSortAsc(true);
                            }
                          }}
                          className="inline-flex items-center gap-1 hover:text-[#171717] cursor-pointer"
                        >
                          <span>Semester</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-3 px-4 font-semibold">Section</th>
                      <th className="py-3 px-4 font-semibold text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (groupSortKey === 'size') setGroupSortAsc(!groupSortAsc);
                            else {
                              setGroupSortKey('size');
                              setGroupSortAsc(false);
                            }
                          }}
                          className="inline-flex items-center gap-1 hover:text-[#171717] cursor-pointer"
                        >
                          <span>Student Count</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-3 px-4 font-semibold text-right w-40">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E2DA]">
                    {filteredGroups
                      .slice((groupPage - 1) * PAGE_SIZE, groupPage * PAGE_SIZE)
                      .map(grp => {
                        const prog = store.programs.find(p => p.id === grp.programId);
                        const dept = store.departments.find(d => d.id === prog?.departmentId);
                        const parts = grp.code.split('-');
                        const batchPrefix = grp.batchCode || parts[0] || `Year ${grp.year}`;
                        const deptCode = grp.departmentCode || dept?.code || parts[1] || 'ACAD';
                        const sectionSuffix = parts[2] || 'A';
                        const semLabel = grp.semester
                          ? `Semester ${grp.semester}`
                          : `Semester ${Math.max(1, grp.year * 2 - 1)}`;
                        const secCount = store.sections.filter(s => s.studentGroupId === grp.id).length;

                        return (
                          <tr key={grp.id} className="hover:bg-[#F7F6EF]/70 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-mono-tabular font-bold text-[#171717]">
                                {batchPrefix} · Year {grp.year}
                              </div>
                              <div className="text-[11px] text-[#77766F]">{grp.name}</div>
                            </td>
                            <td className="py-3 px-4 text-[#171717]">
                              <span className="font-mono-tabular font-semibold mr-1.5">
                                {deptCode}
                              </span>
                              <span className="text-[#77766F] hidden md:inline">
                                {dept?.name}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono-tabular text-[#57564F]">
                              {semLabel}
                            </td>
                            <td className="py-3 px-4 font-mono-tabular">
                              <span className="font-bold text-[#171717]">
                                Section {sectionSuffix}
                              </span>
                              <span className="text-[#77766F] ml-1.5">({grp.code})</span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono-tabular">
                              <span className="font-semibold text-[#171717]">
                                {grp.size}
                              </span>
                              <span className="text-[#77766F] ml-1">
                                ({secCount} courses)
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => selectStep(5)}
                                  className="px-2 py-1 rounded hover:bg-[#EDEAE0] text-[#171717] font-medium cursor-pointer"
                                >
                                  Sections
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenAddGroup(grp)}
                                  className="px-2 py-1 rounded hover:bg-[#EDEAE0] text-[#57564F] hover:text-[#171717] font-medium cursor-pointer"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => institutionalStore.deleteStudentGroup(grp.id)}
                                  className="p-1 rounded hover:bg-[#FDE8E8] text-[#77766F] hover:text-[#8B1E1E] cursor-pointer"
                                  title="Delete section"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    {filteredGroups.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-xs text-[#77766F]">
                          No batches or sections match your search filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {renderPagination(groupPage, filteredGroups.length, setGroupPage)}
            </div>

            {/* Registered Students Directory (GET /api/students) */}
            <div className="pt-4 border-t border-[#E4E2DA] space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-serif-editorial text-lg text-[#171717]">
                  Enrolled Student &amp; BR Accounts ({registeredStudents.length})
                </h3>
                <span className="text-xs text-[#77766F] font-mono-tabular">
                  {loadingStudents ? 'Loading directory...' : 'Synced from Supabase users'}
                </span>
              </div>

              {registeredStudents.length > 0 && (
                <div className="border border-[#E4E2DA] rounded-xl overflow-hidden bg-white">
                  <div className="overflow-x-auto max-h-56">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#F7F6EF] text-[#57564F] border-b border-[#E4E2DA]">
                        <tr>
                          <th className="py-2 px-4 font-semibold">Student Name</th>
                          <th className="py-2 px-4 font-semibold">Email</th>
                          <th className="py-2 px-4 font-semibold">Reg. Number</th>
                          <th className="py-2 px-4 font-semibold">Section</th>
                          <th className="py-2 px-4 font-semibold">Role</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E4E2DA]">
                        {registeredStudents.slice(0, 12).map(st => (
                          <tr key={st.id} className="hover:bg-[#F7F6EF]/60">
                            <td className="py-2 px-4 font-medium text-[#171717]">{st.name}</td>
                            <td className="py-2 px-4 text-[#57564F]">{st.email}</td>
                            <td className="py-2 px-4 font-mono-tabular text-[#57564F]">
                              {st.registration_number || '—'}
                            </td>
                            <td className="py-2 px-4 font-mono-tabular text-[#57564F]">
                              {st.section || '—'}
                            </td>
                            <td className="py-2 px-4 uppercase font-mono-tabular text-[11px] font-semibold text-[#171717]">
                              {st.role}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#E4E2DA] flex justify-between">
              <button onClick={handlePrev} className="btn-secondary text-xs">
                <ArrowLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>
              <button onClick={handleNext} className="btn-primary text-xs">
                <span>Continue to Course Sections</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Course Sections (Compact Horizontal Data Table) */}
        {activeStep === 5 && (
          <div className="sf-card-white p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E2DA] pb-4">
              <h2 className="font-serif-editorial text-2xl text-[#171717]">
                Course Section Mappings ({filteredSections.length})
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const added = institutionalStore.autoGenerateMissingSections();
                    showToast(
                      added > 0
                        ? `Auto-generated ${added} curriculum sections.`
                        : 'All catalog courses already have active sections.'
                    );
                  }}
                  className="btn-secondary text-xs h-9"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Auto-Map Missing Sections</span>
                </button>
              </div>
            </div>

            {/* Quick Section Creator */}
            <form
              onSubmit={handleAddSectionInline}
              className="pb-4 border-b border-[#E4E2DA]"
            >
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-medium text-[#77766F] mb-1">Course</label>
                  <select
                    value={sectionForm.courseId || store.courses[0]?.id || ''}
                    onChange={e => setSectionForm({ ...sectionForm, courseId: e.target.value })}
                    className="input-field text-xs h-9"
                  >
                    {store.courses.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#77766F] mb-1">Instructor</label>
                  <select
                    value={sectionForm.instructorId || store.instructors[0]?.id || ''}
                    onChange={e => setSectionForm({ ...sectionForm, instructorId: e.target.value })}
                    className="input-field text-xs h-9"
                  >
                    {store.instructors.map(i => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#77766F] mb-1">Batch Section</label>
                  <select
                    value={sectionForm.studentGroupId || store.studentGroups[0]?.id || ''}
                    onChange={e => setSectionForm({ ...sectionForm, studentGroupId: e.target.value })}
                    className="input-field text-xs h-9"
                  >
                    {store.studentGroups.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.code} ({g.size} students)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <button type="submit" className="w-full btn-primary h-9 text-xs">
                    + Add Section
                  </button>
                </div>
              </div>
            </form>

            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="input-group-field h-9 px-3 gap-2 flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                <input
                  type="text"
                  placeholder="Search by course, instructor, or section code..."
                  value={sectionSearch}
                  onChange={e => {
                    setSectionSearch(e.target.value);
                    setSectionPage(1);
                  }}
                  className="text-xs"
                />
              </div>

              <div className="inline-flex items-center gap-1">
                {(['ALL', 'Lecture', 'Lab'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setSectionTypeFilter(t);
                      setSectionPage(1);
                    }}
                    className={`h-8 px-3 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      sectionTypeFilter === t
                        ? 'bg-[#171717] text-white border-[#171717]'
                        : 'bg-[#F7F6EF] text-[#57564F] border-[#E4E2DA] hover:text-[#171717]'
                    }`}
                  >
                    {t === 'ALL' ? 'All Sessions' : `${t}s`}
                  </button>
                ))}
              </div>
            </div>

            {/* Sections Horizontal Table */}
            <div className="border border-[#E4E2DA] rounded-xl overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#F7F6EF] text-[#57564F] border-b border-[#E4E2DA]">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Course Code &amp; Title</th>
                      <th className="py-3 px-4 font-semibold">Assigned Instructor</th>
                      <th className="py-3 px-4 font-semibold">Batch &amp; Section</th>
                      <th className="py-3 px-4 font-semibold">Type</th>
                      <th className="py-3 px-4 font-semibold">Assigned Timetable Slot</th>
                      <th className="py-3 px-4 font-semibold text-right w-20">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E2DA]">
                    {filteredSections
                      .slice((sectionPage - 1) * PAGE_SIZE, sectionPage * PAGE_SIZE)
                      .map(sec => {
                        const course = store.courses.find(c => c.id === sec.courseId);
                        const inst = store.instructors.find(i => i.id === sec.instructorId);
                        const grp = store.studentGroups.find(g => g.id === sec.studentGroupId);
                        const room = store.rooms.find(r => r.id === sec.assignedSlot?.roomId);
                        const isLab = sec.sessionType === 'Lab' || (sec.spanSlots && sec.spanSlots > 1);
                        return (
                          <tr key={sec.id} className="hover:bg-[#F7F6EF]/70 transition-colors">
                            <td className="py-2.5 px-4 font-semibold text-[#171717]">
                              <span className="font-mono-tabular font-bold mr-2">
                                {course?.code}
                              </span>
                              <span>{course?.title}</span>
                            </td>
                            <td className="py-2.5 px-4 text-[#171717]">{inst?.name}</td>
                            <td className="py-2.5 px-4 font-mono-tabular text-[#171717]">
                              {grp?.code}
                            </td>
                            <td className="py-2.5 px-4 text-[#57564F]">
                              {isLab ? 'Lab (3h)' : 'Lecture'}
                            </td>
                            <td className="py-2.5 px-4 font-mono-tabular text-xs">
                              {sec.assignedSlot ? (
                                <span className="text-[#171717] font-medium">
                                  {sec.assignedSlot.day} · {sec.assignedSlot.timeSlot} ({room?.code || 'Room'})
                                </span>
                              ) : (
                                <span className="text-[#77766F]">Pending solver</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => institutionalStore.deleteSection(sec.id)}
                                className="p-1 rounded hover:bg-[#FDE8E8] text-[#77766F] hover:text-[#8B1E1E] cursor-pointer"
                                title="Delete section"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              {renderPagination(sectionPage, filteredSections.length, setSectionPage)}
            </div>

            <div className="pt-4 border-t border-[#E4E2DA] flex justify-between">
              <button onClick={handlePrev} className="btn-secondary text-xs">
                <ArrowLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>
              <button onClick={handleNext} className="btn-primary text-xs">
                <span>Continue to Preferences</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: MY PREFERENCES & INSTITUTIONAL RULES (Horizontal Rows) */}
        {activeStep === 6 && (
          <div className="space-y-6">
            <div className="sf-card-white p-6 space-y-6">
              <div className="border-b border-[#E4E2DA] pb-4 flex items-center justify-between">
                <h2 className="font-serif-editorial text-2xl text-[#171717]">
                  Personal Schedule Preferences
                </h2>
                <button
                  type="button"
                  onClick={() => showToast('Personal scheduling preferences saved and synced with solver.')}
                  className="btn-primary text-xs h-9"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Preferences</span>
                </button>
              </div>

              {/* Preferred Timings */}
              <div className="space-y-2.5">
                <label className="block text-xs font-semibold text-[#171717]">
                  Preferred Daily Class Window
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: 'morning' as const,
                      title: 'Morning Session',
                      window: '9:00 AM – 1:00 PM'
                    },
                    {
                      id: 'midday' as const,
                      title: 'Balanced Day',
                      window: '10:00 AM – 4:00 PM'
                    },
                    {
                      id: 'afternoon' as const,
                      title: 'Afternoon Session',
                      window: '2:00 PM – 5:00 PM'
                    }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPreferredTiming(opt.id)}
                      className={`p-3.5 rounded-xl text-left transition-all cursor-pointer border ${
                        preferredTiming === opt.id
                          ? 'bg-[#171717] text-white border-[#171717]'
                          : 'bg-white text-[#171717] border-[#E4E2DA] hover:border-[#171717]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-serif-editorial text-base">{opt.title}</span>
                        {preferredTiming === opt.id && <Check className="w-4 h-4 text-[#B7F77C]" />}
                      </div>
                      <div className={`text-xs font-mono-tabular mt-0.5 ${preferredTiming === opt.id ? 'text-white/75' : 'text-[#77766F]'}`}>
                        {opt.window}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Unavailable Days */}
              <div className="space-y-2.5 pt-4 border-t border-[#E4E2DA]">
                <label className="block text-xs font-semibold text-[#171717]">
                  Unavailable / Study-Only Days
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as DayOfWeek[]).map(day => {
                    const isBlocked = unavailableDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          setUnavailableDays(prev =>
                            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                          );
                        }}
                        className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                          isBlocked
                            ? 'bg-[#E8D36B] text-[#171717] border-[#171717]'
                            : 'bg-white text-[#57564F] border-[#E4E2DA] hover:border-[#171717] hover:text-[#171717]'
                        }`}
                      >
                        {day}{isBlocked ? ' · Blocked' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Break Preferences, Consecutive Classes & Max Daily Workload */}
              <div className="border border-[#E4E2DA] rounded-xl grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E4E2DA]">
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#171717]">Midday Break Buffer</span>
                    <span className="font-mono-tabular font-bold text-[#171717]">
                      {breakDurationMins} mins
                    </span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="120"
                    step="15"
                    value={breakDurationMins}
                    onChange={e => setBreakDurationMins(Number(e.target.value))}
                    className="w-full accent-[#171717]"
                  />
                </div>

                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#171717]">Max Consecutive Classes</span>
                    <span className="font-mono-tabular font-bold text-[#171717]">
                      {maxConsecutiveClasses} back-to-back
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={maxConsecutiveClasses}
                    onChange={e => setMaxConsecutiveClasses(Number(e.target.value))}
                    className="w-full accent-[#171717]"
                  />
                </div>

                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#171717]">Maximum Daily Workload</span>
                    <span className="font-mono-tabular font-bold text-[#171717]">
                      {maxDailyWorkloadHours} hrs / day
                    </span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="8"
                    step="1"
                    value={maxDailyWorkloadHours}
                    onChange={e => setMaxDailyWorkloadHours(Number(e.target.value))}
                    className="w-full accent-[#171717]"
                  />
                </div>
              </div>
            </div>

            {/* Hard & Soft Solver Rules — Compact Horizontal Table */}
            <div className="sf-card-white p-6 space-y-4">
              <h2 className="font-serif-editorial text-2xl text-[#171717]">
                Institutional Feasibility &amp; Optimization Rules
              </h2>

              <div className="border border-[#E4E2DA] rounded-xl overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F7F6EF] text-[#57564F] border-b border-[#E4E2DA]">
                        <th className="py-3 px-4 font-semibold">Constraint Rule &amp; Description</th>
                        <th className="py-3 px-4 font-semibold w-28">Type</th>
                        <th className="py-3 px-4 font-semibold w-56">Optimization Weight</th>
                        <th className="py-3 px-4 font-semibold text-right w-24">Enabled</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4E2DA]">
                      {store.constraints.map(rule => (
                        <tr key={rule.id} className="hover:bg-[#F7F6EF]/70 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-[#171717]">{rule.name}</div>
                            <div className="text-[11px] text-[#77766F] mt-0.5">
                              {rule.description}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono-tabular uppercase font-semibold text-[#171717]">
                            {rule.kind}
                          </td>
                          <td className="py-3 px-4">
                            {rule.kind === 'soft' ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={rule.weight}
                                  onChange={e =>
                                    institutionalStore.updateConstraintWeight(
                                      rule.id,
                                      Number(e.target.value)
                                    )
                                  }
                                  className="w-28 accent-[#171717]"
                                />
                                <span className="font-mono-tabular font-semibold text-[#171717]">
                                  {rule.weight}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-[#77766F] font-mono-tabular">
                                Strict Invariant (100%)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                institutionalStore.toggleConstraint(rule.id, !rule.enabled)
                              }
                              className={`inline-flex w-10 h-6 items-center rounded-full p-1 transition-colors cursor-pointer ${
                                rule.enabled ? 'bg-[#171717]' : 'bg-[#D6D3C9]'
                              }`}
                            >
                              <div
                                className={`bg-white w-4 h-4 rounded-full transition-transform ${
                                  rule.enabled ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-4 border-t border-[#E4E2DA] flex justify-between">
                <button onClick={handlePrev} className="btn-secondary text-xs">
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Sections</span>
                </button>
                <button onClick={() => onNavigate('generate')} className="btn-primary text-xs">
                  <span>Apply Preferences &amp; Generate Schedule</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Contextual Slide-Out Drawer for Creating/Editing Records */}
      {sideDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between p-6 overflow-y-auto border-l border-[#E4E2DA]">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#E4E2DA]">
                <h3 className="font-serif-editorial text-2xl text-[#171717]">
                  {editingItem ? 'Edit Record' : 'Add Record'}
                </h3>
                <button
                  onClick={() => setSideDrawerOpen(false)}
                  className="text-[#77766F] hover:text-[#171717] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {validationError && (
                <div className="mt-4 p-3 bg-[#E8D36B] rounded-xl text-xs text-[#171717] flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {activeStep === 0 && (
                <form id="drawerForm" onSubmit={handleSaveDept} className="space-y-4 pt-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">Department Code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CS"
                      value={deptForm.code}
                      onChange={e => setDeptForm({ ...deptForm, code: e.target.value })}
                      className="input-field font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">Department Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Computer Science"
                      value={deptForm.name}
                      onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">Academic School</label>
                    <input
                      type="text"
                      value={deptForm.school}
                      onChange={e => setDeptForm({ ...deptForm, school: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </form>
              )}

              {activeStep === 1 && (
                <form id="drawerForm" onSubmit={handleSaveRoom} className="space-y-4 pt-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">Room Code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ENG-204"
                      value={roomForm.code}
                      onChange={e => setRoomForm({ ...roomForm, code: e.target.value })}
                      className="input-field font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">Building / Wing Name</label>
                    <input
                      type="text"
                      required
                      value={roomForm.buildingName}
                      onChange={e => setRoomForm({ ...roomForm, buildingName: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">Seating Capacity</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={roomForm.capacity}
                      onChange={e => setRoomForm({ ...roomForm, capacity: Number(e.target.value) })}
                      className="input-field font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">Space Type</label>
                    <select
                      value={roomForm.type}
                      onChange={e => setRoomForm({ ...roomForm, type: e.target.value as RoomType })}
                      className="input-field"
                    >
                      <option value="lecture">Lecture Hall</option>
                      <option value="lab">Laboratory</option>
                      <option value="seminar">Seminar Room</option>
                      <option value="studio">Design Studio</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">Equipment</label>
                    <input
                      type="text"
                      value={roomForm.equipment}
                      onChange={e => setRoomForm({ ...roomForm, equipment: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </form>
              )}

              {activeStep === 2 && (
                <form id="drawerForm" onSubmit={handleSaveCourse} className="space-y-4 pt-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">Course Code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CS-301"
                      value={courseForm.code}
                      onChange={e => setCourseForm({ ...courseForm, code: e.target.value })}
                      className="input-field font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">Course Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Algorithms & Data Structures"
                      value={courseForm.title}
                      onChange={e => setCourseForm({ ...courseForm, title: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">Department</label>
                    <select
                      value={courseForm.departmentId}
                      onChange={e => setCourseForm({ ...courseForm, departmentId: e.target.value })}
                      className="input-field"
                    >
                      {store.departments.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#171717] mb-1.5">Credits</label>
                      <input
                        type="number"
                        min="1"
                        value={courseForm.creditHours}
                        onChange={e => setCourseForm({ ...courseForm, creditHours: Number(e.target.value) })}
                        className="input-field font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#171717] mb-1.5">Weekly Hours</label>
                      <input
                        type="number"
                        min="1"
                        value={courseForm.weeklyContactHours}
                        onChange={e => setCourseForm({ ...courseForm, weeklyContactHours: Number(e.target.value) })}
                        className="input-field font-mono-tabular"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">Course Type</label>
                    <select
                      value={courseForm.requiredRoomType}
                      onChange={e => setCourseForm({ ...courseForm, requiredRoomType: e.target.value as RoomType })}
                      className="input-field"
                    >
                      <option value="lecture">Lecture</option>
                      <option value="lab">Laboratory</option>
                      <option value="seminar">Seminar</option>
                      <option value="studio">Design Studio</option>
                    </select>
                  </div>
                </form>
              )}

              {activeStep === 3 && (
                <form id="drawerForm" onSubmit={handleSaveInstructor} className="space-y-4 pt-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">Instructor Full Name</label>
                    <input
                      type="text"
                      required
                      value={instructorForm.name}
                      onChange={e => setInstructorForm({ ...instructorForm, name: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">Academic Title</label>
                    <input
                      type="text"
                      value={instructorForm.title}
                      onChange={e => setInstructorForm({ ...instructorForm, title: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">Department</label>
                    <select
                      value={instructorForm.departmentId}
                      onChange={e => setInstructorForm({ ...instructorForm, departmentId: e.target.value })}
                      className="input-field"
                    >
                      {store.departments.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">Max Weekly Hours</label>
                    <input
                      type="number"
                      min="1"
                      value={instructorForm.maxWeeklyHours}
                      onChange={e => setInstructorForm({ ...instructorForm, maxWeeklyHours: Number(e.target.value) })}
                      className="input-field font-mono-tabular"
                    />
                  </div>
                </form>
              )}

              {activeStep === 4 && (
                <form id="drawerForm" onSubmit={handleSaveGroup} className="space-y-4 pt-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">Section Code (e.g. 2K24-BSCS-A)</label>
                    <input
                      type="text"
                      required
                      value={groupForm.code}
                      onChange={e => setGroupForm({ ...groupForm, code: e.target.value })}
                      className="input-field font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">Batch / Section Name</label>
                    <input
                      type="text"
                      value={groupForm.name}
                      onChange={e => setGroupForm({ ...groupForm, name: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#171717] mb-1.5">Department</label>
                      <select
                        value={groupForm.departmentCode}
                        onChange={e => setGroupForm({ ...groupForm, departmentCode: e.target.value })}
                        className="input-field"
                      >
                        {store.departments.map(d => (
                          <option key={d.id} value={d.code}>
                            {d.code} — {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#171717] mb-1.5">Semester</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={groupForm.semester}
                        onChange={e => setGroupForm({ ...groupForm, semester: Number(e.target.value) })}
                        className="input-field font-mono-tabular"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#171717] mb-1.5">Year Level</label>
                      <input
                        type="number"
                        min="1"
                        max="6"
                        value={groupForm.year}
                        onChange={e => setGroupForm({ ...groupForm, year: Number(e.target.value) })}
                        className="input-field font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#171717] mb-1.5">Student Count</label>
                      <input
                        type="number"
                        min="1"
                        value={groupForm.size}
                        onChange={e => setGroupForm({ ...groupForm, size: Number(e.target.value) })}
                        className="input-field font-mono-tabular"
                      />
                    </div>
                  </div>
                </form>
              )}
            </div>

            <div className="pt-4 border-t border-[#E4E2DA] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSideDrawerOpen(false)}
                className="btn-secondary text-xs h-9"
              >
                Cancel
              </button>
              <button type="submit" form="drawerForm" className="btn-primary text-xs h-9">
                Save Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Faculty Availability Matrix Modal */}
      {selectedInstructorForGrid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E4E2DA] max-w-2xl w-full p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E2DA]">
              <div>
                <h3 className="font-serif-editorial text-2xl text-[#171717]">
                  Availability Grid · {selectedInstructorForGrid.name}
                </h3>
                <p className="text-xs text-[#77766F]">
                  Click any period cell to toggle between Available and Unavailable.
                </p>
              </div>
              <button
                onClick={() => setSelectedInstructorForGrid(null)}
                className="text-[#77766F] hover:text-[#171717] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border border-[#E4E2DA] rounded-xl overflow-hidden">
              <div className="grid grid-cols-6 bg-[#F7F6EF] border-b border-[#E4E2DA] text-xs font-semibold text-[#77766F] text-center py-2.5">
                <div>Period</div>
                {store.timeStructure.workingDays.slice(0, 5).map(d => (
                  <div key={d}>{d}</div>
                ))}
              </div>

              <div className="divide-y divide-[#E4E2DA]">
                {store.timeStructure.periods.map(period => (
                  <div key={period} className="grid grid-cols-6 text-center text-xs">
                    <div className="p-2.5 font-mono-tabular text-[#171717] font-semibold bg-[#F7F6EF] flex items-center justify-center border-r border-[#E4E2DA]">
                      {period}
                    </div>
                    {store.timeStructure.workingDays.slice(0, 5).map(day => {
                      const isUnavailable = selectedInstructorForGrid.unavailableSlots.some(
                        s => s.day === day && s.timeSlot === period
                      );
                      return (
                        <div
                          key={day}
                          onClick={() => {
                            institutionalStore.toggleInstructorAvailability(
                              selectedInstructorForGrid.id,
                              day,
                              period
                            );
                            const updated = institutionalStore
                              .get()
                              .instructors.find(i => i.id === selectedInstructorForGrid.id);
                            if (updated) setSelectedInstructorForGrid(updated);
                          }}
                          className={`p-3 border-r border-[#E4E2DA] cursor-pointer transition-colors font-semibold flex items-center justify-center select-none ${
                            isUnavailable
                              ? 'bg-[#E8D36B] text-[#171717]'
                              : 'bg-[#B7F77C]/55 text-[#171717] hover:bg-[#B7F77C]'
                          }`}
                        >
                          {isUnavailable ? 'Unavailable' : 'Available'}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-xs font-mono-tabular text-[#77766F]">
                {selectedInstructorForGrid.unavailableSlots.length} unavailable slots marked
              </span>
              <button
                onClick={() => setSelectedInstructorForGrid(null)}
                className="btn-primary text-xs h-9"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
