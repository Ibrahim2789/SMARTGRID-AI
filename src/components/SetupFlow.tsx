import React, { useState, useEffect } from 'react';
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
  Building2
} from 'lucide-react';

interface SetupFlowProps {
  initialStep?: number;
  onStepChange?: (stepIdx: number) => void;
  onNavigate: (route: RouteType) => void;
  currentUser?: { name: string; role: string; email: string; institution?: string } | null;
}

const PASTEL_ACCENTS = ['#B8EEEE', '#F2D8FA', '#B8F2E6', '#B7F77C', '#E8D36B'];

export const SetupFlow: React.FC<SetupFlowProps> = ({
  initialStep = 2,
  onStepChange,
  onNavigate
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
  };

  const [sideDrawerOpen, setSideDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Instructor modal availability state
  const [selectedInstructorForGrid, setSelectedInstructorForGrid] = useState<Instructor | null>(null);

  // My Preferences local interactive state (persisted alongside store constraints)
  const [preferredTiming, setPreferredTiming] = useState<'morning' | 'midday' | 'afternoon'>('morning');
  const [unavailableDays, setUnavailableDays] = useState<DayOfWeek[]>([]);
  const [breakDurationMins, setBreakDurationMins] = useState<number>(60);
  const [maxConsecutiveClasses, setMaxConsecutiveClasses] = useState<number>(3);
  const [maxDailyWorkloadHours, setMaxDailyWorkloadHours] = useState<number>(6);
  const [newPeriodInput, setNewPeriodInput] = useState('');

  // Sample data management state
  const isSampleLoaded = institutionalStore.isSampleDataLoaded();
  const sampleCounts = institutionalStore.getSampleCounts();
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  // Pagination states
  const PAGE_SIZE = 12;
  const [roomPage, setRoomPage] = useState(1);
  const [coursePage, setCoursePage] = useState(1);
  const [instructorPage, setInstructorPage] = useState(1);
  const [groupPage, setGroupPage] = useState(1);

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
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner(null), 4000);
  };

  const handleLoadSample = () => {
    institutionalStore.loadSampleData();
    showToast('Loaded Western Polytechnic multi-department academic dataset.');
  };

  const handleConfirmRemoveSample = () => {
    institutionalStore.removeSampleData();
    setShowRemoveConfirm(false);
    setRoomPage(1);
    setCoursePage(1);
    setInstructorPage(1);
    setGroupPage(1);
    showToast('Removed sample dataset and restored base institutional records.');
  };

  const renderPagination = (currentPage: number, totalItems: number, setPage: (p: number) => void) => {
    const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
    if (totalPages <= 1) return null;

    const startItem = (currentPage - 1) * PAGE_SIZE + 1;
    const endItem = Math.min(currentPage * PAGE_SIZE, totalItems);

    return (
      <div className="flex items-center justify-between px-4 py-3 bg-[#F7F6EF] border-t border-[#E4E2DA] text-xs text-[#77766F]">
        <div>
          Showing <span className="font-semibold text-[#171717]">{startItem}</span>–<span className="font-semibold text-[#171717]">{endItem}</span> of <span className="font-semibold text-[#171717]">{totalItems}</span>
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
    if (editingItem) {
      institutionalStore.updateDepartment(editingItem.id, {
        code: deptForm.code.trim().toUpperCase(),
        name: deptForm.name.trim(),
        school: deptForm.school.trim()
      });
      showToast(`Updated department ${deptForm.code.toUpperCase()}.`);
    } else {
      institutionalStore.addDepartment({
        id: `dept-${Date.now()}`,
        code: deptForm.code.trim().toUpperCase(),
        name: deptForm.name.trim(),
        school: deptForm.school.trim(),
        colorHex: '#171717'
      });
      showToast(`Added department ${deptForm.name.trim()}.`);
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
    if (editingItem) {
      institutionalStore.updateRoom(editingItem.id, {
        code: roomForm.code.trim(),
        name: roomForm.buildingName.trim() || roomForm.code.trim(),
        capacity: Number(roomForm.capacity),
        type: roomForm.type,
        equipment: roomForm.equipment.split(',').map(s => s.trim()).filter(Boolean)
      });
      showToast(`Updated room ${roomForm.code.trim()}.`);
    } else {
      institutionalStore.addRoom({
        id: `room-${Date.now()}`,
        buildingId: 'bld-turing',
        code: roomForm.code.trim(),
        name: roomForm.buildingName.trim() || roomForm.code.trim(),
        capacity: Number(roomForm.capacity),
        type: roomForm.type,
        equipment: roomForm.equipment.split(',').map(s => s.trim()).filter(Boolean),
        isAccessible: true,
        isAvailable: true
      });
      showToast(`Added room ${roomForm.code.trim()} (${roomForm.capacity} seats).`);
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

    if (editingItem) {
      institutionalStore.updateCourse(editingItem.id, {
        code: courseForm.code.trim().toUpperCase(),
        title: courseForm.title.trim(),
        departmentId: courseForm.departmentId,
        creditHours: Number(courseForm.creditHours),
        weeklyContactHours: Number(courseForm.weeklyContactHours),
        requiredRoomType: courseForm.requiredRoomType
      });
      showToast(`Updated course ${courseForm.code.trim().toUpperCase()}.`);
    } else {
      institutionalStore.addCourse({
        id: `course-${Date.now()}`,
        departmentId: courseForm.departmentId,
        code: courseForm.code.trim().toUpperCase(),
        title: courseForm.title.trim(),
        creditHours: Number(courseForm.creditHours),
        weeklyContactHours: Number(courseForm.weeklyContactHours),
        lectureHours: Number(courseForm.weeklyContactHours),
        labHours: courseForm.requiredRoomType === 'lab' ? Number(courseForm.weeklyContactHours) : 0,
        requiredRoomType: courseForm.requiredRoomType
      });
      showToast(`Added course ${courseForm.code.trim().toUpperCase()} — ${courseForm.title.trim()}.`);
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

    if (editingItem) {
      institutionalStore.updateInstructor(editingItem.id, {
        name: instructorForm.name.trim(),
        title: instructorForm.title.trim(),
        departmentId: instructorForm.departmentId,
        maxWeeklyHours: Number(instructorForm.maxWeeklyHours)
      });
      showToast(`Updated faculty profile for ${instructorForm.name.trim()}.`);
    } else {
      institutionalStore.addInstructor({
        id: `inst-${Date.now()}`,
        departmentId: instructorForm.departmentId,
        name: instructorForm.name.trim(),
        email: `${instructorForm.name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@westernpoly.edu`,
        title: instructorForm.title.trim() || 'Faculty Member',
        maxWeeklyHours: Number(instructorForm.maxWeeklyHours),
        maxConsecutiveHours: 3,
        preferredDays: ['Mon', 'Wed', 'Fri'],
        unavailableSlots: []
      });
      showToast(`Added faculty instructor ${instructorForm.name.trim()}.`);
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
        year: grp.year,
        size: grp.size
      });
    } else {
      setEditingItem(null);
      setGroupForm({
        name: '',
        code: '',
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
    if (editingItem) {
      institutionalStore.updateStudentGroup(editingItem.id, {
        name: groupForm.name.trim() || groupForm.code.trim(),
        code: groupForm.code.trim(),
        year: Number(groupForm.year),
        size: Number(groupForm.size)
      });
      showToast(`Updated student cohort ${groupForm.code.trim()}.`);
    } else {
      institutionalStore.addStudentGroup({
        id: `cohort-${Date.now()}`,
        programId: store.programs[0]?.id || 'prog-bsc-cs',
        name: groupForm.name.trim() || groupForm.code.trim(),
        code: groupForm.code.trim(),
        year: Number(groupForm.year),
        size: Number(groupForm.size),
        sharedCourseIds: []
      });
      showToast(`Added student cohort ${groupForm.code.trim()}.`);
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

  const isPreferencesView = activeStep === 6;

  return (
    <div className="space-y-6">
      {/* =========================================================
          1. EDITORIAL SERIF PAGE HEADING & MODE SWITCHER
         ========================================================= */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-[#E4E2DA]">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#B8F2E6] text-[#171717] text-xs font-semibold mb-2">
            {isPreferencesView ? (
              <>
                <Sliders className="w-3.5 h-3.5" />
                <span>Student & Institutional Preferences</span>
              </>
            ) : (
              <>
                <BookOpen className="w-3.5 h-3.5" />
                <span>Courses & Academic Resources</span>
              </>
            )}
          </div>
          <h1 className="font-serif-editorial text-3xl sm:text-4xl text-[#171717] tracking-tight">
            {isPreferencesView ? 'My Preferences' : 'Courses & Academic Resources'}
          </h1>
          <p className="text-xs sm:text-sm text-[#77766F] mt-1 max-w-2xl">
            {isPreferencesView
              ? 'Customize preferred daily timings, unavailable days, break durations, consecutive-class caps, and maximum daily workload.'
              : 'Browse and manage academic courses, sections, campus rooms, faculty availability, and student cohorts.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {isSampleLoaded ? (
            <button
              type="button"
              onClick={() => setShowRemoveConfirm(true)}
              className="btn-secondary text-xs h-9"
            >
              <span>Remove Sample Data</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLoadSample}
              className="btn-secondary text-xs h-9"
            >
              <span>Load Sample Dataset</span>
            </button>
          )}
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

      {statusBanner && (
        <div className="p-3.5 sf-pastel-lime text-xs font-medium flex items-center gap-2">
          <Check className="w-4 h-4 text-[#171717]" />
          <span>{statusBanner}</span>
        </div>
      )}

      {/* Confirm Remove Sample Modal */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-[#E4E2DA]">
            <div className="flex items-center justify-between">
              <h3 className="font-serif-editorial text-xl text-[#171717]">Remove sample dataset?</h3>
              <button
                onClick={() => setShowRemoveConfirm(false)}
                className="text-[#77766F] hover:text-[#171717] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[#77766F]">
              This removes the sample dataset ({sampleCounts.rooms} rooms, {sampleCounts.courses} courses, {sampleCounts.instructors} instructors) while keeping any custom records you added.
            </p>
            <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E4E2DA]">
              <button
                type="button"
                onClick={() => setShowRemoveConfirm(false)}
                className="btn-secondary text-xs h-9"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveSample}
                className="btn-primary text-xs h-9"
              >
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          2. MAIN 2-COLUMN WORKSPACE (SIDEBAR TABS + CONTENT AREA)
         ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Navigation Column */}
        <aside className="lg:col-span-3 space-y-2">
          <div className="sf-card-white p-3 space-y-1">
            {steps.map((s, idx) => {
              const Icon = s.icon;
              const isCurrent = activeStep === idx;
              return (
                <button
                  key={s.title}
                  onClick={() => selectStep(idx)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-[#171717] text-white'
                      : 'text-[#171717] hover:bg-[#F7F6EF]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isCurrent
                          ? 'bg-white/15 text-white'
                          : 'bg-[#EDEAE0] text-[#171717]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{s.title}</div>
                      <div
                        className={`text-[10.5px] truncate ${
                          isCurrent ? 'text-[#B8EEEE]' : 'text-[#77766F]'
                        }`}
                      >
                        {s.subtitle}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Active Content Area */}
        <div className="lg:col-span-9 space-y-6">
          {/* STEP 0: Departments & Academic Time Grid */}
          {activeStep === 0 && (
            <div className="sf-card-white p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E2DA] pb-4">
                <div>
                  <h2 className="font-serif-editorial text-2xl text-[#171717]">
                    Departments & Academic Time Grid
                  </h2>
                  <p className="text-xs text-[#77766F]">
                    Manage university departments, working days, and standard class periods.
                  </p>
                </div>
                <button onClick={() => handleOpenAddDept()} className="btn-primary text-xs h-9">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Department</span>
                </button>
              </div>

              {/* Department Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {store.departments.map((dept, idx) => {
                  const courseCount = store.courses.filter(c => c.departmentId === dept.id).length;
                  const accent = PASTEL_ACCENTS[idx % PASTEL_ACCENTS.length];
                  return (
                    <div
                      key={dept.id}
                      className="p-4 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF]/60 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span
                            className="text-xs font-mono-tabular font-bold px-2 py-0.5 rounded text-[#171717]"
                            style={{ backgroundColor: accent }}
                          >
                            {dept.code}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenAddDept(dept)}
                              className="p-1 text-[#77766F] hover:text-[#171717] cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => institutionalStore.deleteDepartment(dept.id)}
                              className="p-1 text-[#77766F] hover:text-[#171717] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <h3 className="font-serif-editorial text-lg text-[#171717] mt-2">
                          {dept.name}
                        </h3>
                        <p className="text-xs text-[#77766F]">{dept.school}</p>
                      </div>
                      <div className="text-xs font-mono-tabular text-[#171717] pt-2 border-t border-[#E4E2DA]">
                        {courseCount} active courses
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Standard Periods & Link to Admin Academic Timings & Breaks */}
              <div className="pt-4 border-t border-[#E4E2DA] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-serif-editorial text-lg text-[#171717]">
                      Active Academic Timings & Breaks ({computedTiming.slots.length} Daily Slots)
                    </h3>
                    <p className="text-xs text-[#77766F]">
                      {computedTiming.summaryText} · Working Days: {computedTiming.workingDays.join(', ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('settings')}
                    className="btn-secondary h-9 text-xs shrink-0"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Configure Academic Timings & Breaks</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {computedTiming.slots.map(slot => (
                    <div
                      key={slot.slotNumber}
                      className="px-3 py-2 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] flex items-center gap-2 text-xs font-mono-tabular"
                    >
                      <span className="font-semibold text-[#171717]">
                        Slot {slot.slotNumber}: {slot.period}
                      </span>
                      <span className="text-[11px] text-[#77766F]">
                        ({computedTiming.shortBreakEnabled && computedTiming.shortBreakMinutes > 0
                          ? `Brk ${slot.shortBreak}`
                          : 'No Break'})
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-[#E4E2DA] flex justify-end">
                <button onClick={handleNext} className="btn-primary text-xs">
                  <span>Continue to Campus Rooms</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 1: Campus Rooms & Labs */}
          {activeStep === 1 && (
            <div className="sf-card-white p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E2DA] pb-4">
                <div>
                  <h2 className="font-serif-editorial text-2xl text-[#171717]">
                    Campus Rooms & Laboratories
                  </h2>
                  <p className="text-xs text-[#77766F]">
                    Lecture halls, computer labs, and seminar spaces with seating capacity and equipment metadata.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleDownloadTemplate('rooms')} className="btn-secondary text-xs h-9">
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV Template</span>
                  </button>
                  <button onClick={() => handleOpenAddRoom()} className="btn-primary text-xs h-9">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Room</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {store.rooms.slice((roomPage - 1) * PAGE_SIZE, roomPage * PAGE_SIZE).map((room, idx) => {
                  const accent = PASTEL_ACCENTS[idx % PASTEL_ACCENTS.length];
                  return (
                    <div
                      key={room.id}
                      className="p-4 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF]/50 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="text-xs font-mono-tabular font-bold px-2 py-0.5 rounded text-[#171717]"
                            style={{ backgroundColor: accent }}
                          >
                            {room.code}
                          </span>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-white border border-[#E4E2DA] capitalize">
                            {room.type}
                          </span>
                        </div>
                        <h3 className="font-semibold text-sm text-[#171717] mt-2">{room.name}</h3>
                        <p className="text-xs text-[#77766F] mt-0.5 line-clamp-1">
                          {room.equipment.join(' · ') || 'Standard AV'}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2.5 border-t border-[#E4E2DA] text-xs">
                        <span className="font-mono-tabular font-semibold text-[#171717]">
                          {room.capacity} seats
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenAddRoom(room)}
                            className="p-1 text-[#77766F] hover:text-[#171717] cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => institutionalStore.deleteRoom(room.id)}
                            className="p-1 text-[#77766F] hover:text-[#171717] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {renderPagination(roomPage, store.rooms.length, setRoomPage)}

              <div className="pt-4 border-t border-[#E4E2DA] flex justify-between">
                <button onClick={handlePrev} className="btn-secondary text-xs">
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>
                <button onClick={handleNext} className="btn-primary text-xs">
                  <span>Continue to Course Catalog</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Course Catalog (Clean Content Cards) */}
          {activeStep === 2 && (
            <div className="sf-card-white p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E2DA] pb-4">
                <div>
                  <h2 className="font-serif-editorial text-2xl text-[#171717]">
                    Course Catalog & Academic Metadata
                  </h2>
                  <p className="text-xs text-[#77766F]">
                    Clean course cards showing credits, weekly contact hours, required space type, and active sections.
                  </p>
                </div>
                <div className="flex items-center gap-2">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {store.courses.slice((coursePage - 1) * PAGE_SIZE, coursePage * PAGE_SIZE).map((course, idx) => {
                  const dept = store.departments.find(d => d.id === course.departmentId);
                  const secCount = store.sections.filter(s => s.courseId === course.id).length;
                  const accent = PASTEL_ACCENTS[idx % PASTEL_ACCENTS.length];
                  return (
                    <div
                      key={course.id}
                      className="p-4 rounded-xl border border-[#E4E2DA] bg-white hover:border-[#171717] transition-colors flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="text-xs font-mono-tabular font-bold px-2.5 py-0.5 rounded text-[#171717]"
                            style={{ backgroundColor: accent }}
                          >
                            {course.code}
                          </span>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#F7F6EF] border border-[#E4E2DA] text-[#77766F]">
                            {dept?.code || 'ACAD'}
                          </span>
                        </div>

                        <h3 className="font-serif-editorial text-lg text-[#171717] mt-2 leading-snug">
                          {course.title}
                        </h3>

                        <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-[#77766F]">
                          <span className="font-mono-tabular">{course.creditHours} credits</span>
                          <span>·</span>
                          <span className="font-mono-tabular">{course.weeklyContactHours} hrs/wk</span>
                          <span>·</span>
                          <span className="capitalize">{course.requiredRoomType}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-[#E4E2DA] text-xs">
                        <button
                          onClick={() => selectStep(5)}
                          className="font-semibold text-[#171717] hover:underline cursor-pointer"
                        >
                          {secCount} {secCount === 1 ? 'section' : 'sections'} →
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenAddCourse(course)}
                            className="p-1 text-[#77766F] hover:text-[#171717] cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => institutionalStore.deleteCourse(course.id)}
                            className="p-1 text-[#77766F] hover:text-[#171717] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {renderPagination(coursePage, store.courses.length, setCoursePage)}

              <div className="pt-4 border-t border-[#E4E2DA] flex justify-between">
                <button onClick={handlePrev} className="btn-secondary text-xs">
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>
                <button onClick={handleNext} className="btn-primary text-xs">
                  <span>Continue to Faculty</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Faculty & Availability Matrix */}
          {activeStep === 3 && (
            <div className="sf-card-white p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E2DA] pb-4">
                <div>
                  <h2 className="font-serif-editorial text-2xl text-[#171717]">
                    Faculty Roster & Availability Matrix
                  </h2>
                  <p className="text-xs text-[#77766F]">
                    Configure weekly teaching load limits and click any instructor's availability button to block out unavailable slots.
                  </p>
                </div>
                <button onClick={() => handleOpenAddInstructor()} className="btn-primary text-xs h-9">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Instructor</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {store.instructors.slice((instructorPage - 1) * PAGE_SIZE, instructorPage * PAGE_SIZE).map((inst, idx) => {
                  const dept = store.departments.find(d => d.id === inst.departmentId);
                  const accent = PASTEL_ACCENTS[idx % PASTEL_ACCENTS.length];
                  return (
                    <div
                      key={inst.id}
                      className="p-4 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF]/50 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-xs text-[#171717] shrink-0"
                            style={{ backgroundColor: accent }}
                          >
                            {inst.name
                              .split(' ')
                              .map(n => n[0])
                              .join('')
                              .slice(0, 2)}
                          </div>
                          <div>
                            <h3 className="font-semibold text-sm text-[#171717]">{inst.name}</h3>
                            <p className="text-xs text-[#77766F]">
                              {dept?.name || 'Academic Faculty'} · Max {inst.maxWeeklyHours} hrs/wk
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenAddInstructor(inst)}
                            className="p-1 text-[#77766F] hover:text-[#171717] cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => institutionalStore.deleteInstructor(inst.id)}
                            className="p-1 text-[#77766F] hover:text-[#171717] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2.5 border-t border-[#E4E2DA]">
                        <span className="text-[11px] font-mono-tabular text-[#77766F]">
                          {inst.unavailableSlots.length} unavailable slots marked
                        </span>
                        <button
                          onClick={() => setSelectedInstructorForGrid(inst)}
                          className="btn-secondary h-8 text-xs"
                        >
                          Edit Availability Grid
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {renderPagination(instructorPage, store.instructors.length, setInstructorPage)}

              <div className="pt-4 border-t border-[#E4E2DA] flex justify-between">
                <button onClick={handlePrev} className="btn-secondary text-xs">
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>
                <button onClick={handleNext} className="btn-primary text-xs">
                  <span>Continue to Student Cohorts</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Classes & Student Cohorts */}
          {activeStep === 4 && (
            <div className="sf-card-white p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E2DA] pb-4">
                <div>
                  <h2 className="font-serif-editorial text-2xl text-[#171717]">
                    Classes & Student Cohorts
                  </h2>
                  <p className="text-xs text-[#77766F]">
                    Student class sections that share core curriculum blocks and must never have overlapping required classes.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] text-xs">
                    <button
                      type="button"
                      onClick={() => selectStep(4)}
                      className="px-3 py-1 rounded-lg bg-[#171717] text-white font-semibold cursor-pointer"
                    >
                      Classes ({store.studentGroups.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => selectStep(5)}
                      className="px-3 py-1 rounded-lg text-[#77766F] hover:text-[#171717] font-medium cursor-pointer"
                    >
                      Course Sections ({store.sections.length})
                    </button>
                  </div>
                  <button onClick={() => handleOpenAddGroup()} className="btn-primary text-xs h-9">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Class Cohort</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {store.studentGroups.slice((groupPage - 1) * PAGE_SIZE, groupPage * PAGE_SIZE).map((grp, idx) => {
                  const secCount = store.sections.filter(s => s.studentGroupId === grp.id).length;
                  const accent = PASTEL_ACCENTS[idx % PASTEL_ACCENTS.length];
                  return (
                    <div
                      key={grp.id}
                      className="p-4 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF]/60 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span
                            className="text-xs font-mono-tabular font-bold px-2 py-0.5 rounded text-[#171717]"
                            style={{ backgroundColor: accent }}
                          >
                            {grp.code}
                          </span>
                          <span className="text-xs font-mono-tabular text-[#77766F]">
                            Year {grp.year}
                          </span>
                        </div>
                        <h3 className="font-serif-editorial text-lg text-[#171717] mt-2">
                          {grp.name}
                        </h3>
                        <p className="text-xs text-[#77766F] mt-0.5">
                          {grp.size} enrolled students · {secCount} course sections
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2.5 border-t border-[#E4E2DA] text-xs">
                        <button
                          onClick={() => selectStep(5)}
                          className="font-semibold text-[#171717] hover:underline cursor-pointer"
                        >
                          Manage sections →
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenAddGroup(grp)}
                            className="p-1 text-[#77766F] hover:text-[#171717] cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => institutionalStore.deleteStudentGroup(grp.id)}
                            className="p-1 text-[#77766F] hover:text-[#171717] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {renderPagination(groupPage, store.studentGroups.length, setGroupPage)}

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

          {/* STEP 5: Course Sections */}
          {activeStep === 5 && (
            <div className="sf-card-white p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E2DA] pb-4">
                <div>
                  <h2 className="font-serif-editorial text-2xl text-[#171717]">
                    Course Sections & Assignments
                  </h2>
                  <p className="text-xs text-[#77766F]">
                    Link courses, faculty instructors, and student cohorts into schedulable sections.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] text-xs">
                    <button
                      type="button"
                      onClick={() => selectStep(4)}
                      className="px-3 py-1 rounded-lg text-[#77766F] hover:text-[#171717] font-medium cursor-pointer"
                    >
                      Classes ({store.studentGroups.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => selectStep(5)}
                      className="px-3 py-1 rounded-lg bg-[#171717] text-white font-semibold cursor-pointer"
                    >
                      Course Sections ({store.sections.length})
                    </button>
                  </div>
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
                className="p-4 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-3"
              >
                <div className="text-xs font-semibold text-[#171717]">
                  Create New Course Section ({store.sections.length} total sections in registry)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#77766F] mb-1">Course</label>
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
                    <label className="block text-[11px] text-[#77766F] mb-1">Instructor</label>
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
                    <label className="block text-[11px] text-[#77766F] mb-1">Cohort</label>
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
                  <div className="flex items-end">
                    <button type="submit" className="w-full btn-primary h-9 text-xs">
                      + Add Section
                    </button>
                  </div>
                </div>
              </form>

              {/* Sections List */}
              <div className="border border-[#E4E2DA] rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F7F6EF] text-[#77766F] border-b border-[#E4E2DA] sticky top-0">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Course</th>
                        <th className="py-3 px-4 font-semibold">Instructor</th>
                        <th className="py-3 px-4 font-semibold">Student Cohort</th>
                        <th className="py-3 px-4 font-semibold">Assigned Slot</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4E2DA]">
                      {store.sections.map(sec => {
                        const course = store.courses.find(c => c.id === sec.courseId);
                        const inst = store.instructors.find(i => i.id === sec.instructorId);
                        const grp = store.studentGroups.find(g => g.id === sec.studentGroupId);
                        const room = store.rooms.find(r => r.id === sec.assignedSlot?.roomId);
                        return (
                          <tr key={sec.id} className="hover:bg-[#F7F6EF]/60">
                            <td className="py-2.5 px-4 font-semibold text-[#171717]">
                              <span className="font-mono-tabular mr-2 px-1.5 py-0.5 rounded bg-[#B8EEEE]">
                                {course?.code}
                              </span>
                              {course?.title}
                            </td>
                            <td className="py-2.5 px-4 text-[#77766F]">{inst?.name}</td>
                            <td className="py-2.5 px-4 font-mono-tabular text-[#171717]">{grp?.code}</td>
                            <td className="py-2.5 px-4 font-mono-tabular text-xs">
                              {sec.assignedSlot ? (
                                <span className="px-2 py-0.5 rounded bg-[#B7F77C] text-[#171717] font-semibold">
                                  {sec.assignedSlot.day} · {sec.assignedSlot.timeSlot} ({room?.code || 'Room'})
                                </span>
                              ) : (
                                <span className="text-[#77766F]">Pending solver</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-4 border-t border-[#E4E2DA] flex justify-between">
                <button onClick={handlePrev} className="btn-secondary text-xs">
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>
                <button onClick={handleNext} className="btn-primary text-xs">
                  <span>Continue to My Preferences</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: MY PREFERENCES (Dedicated Student & Schedule Preferences Page) */}
          {activeStep === 6 && (
            <div className="space-y-6">
              {/* Personal Timing & Workload Preferences Card */}
              <div className="sf-card-white p-6 space-y-6">
                <div className="border-b border-[#E4E2DA] pb-4 flex items-center justify-between">
                  <div>
                    <h2 className="font-serif-editorial text-2xl text-[#171717]">
                      Personal Schedule Preferences
                    </h2>
                    <p className="text-xs text-[#77766F]">
                      Configure preferred timings, unavailable days, break durations, consecutive-class limits, and daily workload caps.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => showToast('Personal scheduling preferences saved and synced with solver.')}
                    className="btn-primary text-xs h-9"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Preferences</span>
                  </button>
                </div>

                {/* 1. Preferred Timings */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[#171717]">
                    1. Preferred Daily Class Timings
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {
                        id: 'morning' as const,
                        title: 'Morning Session (Slots 1–4)',
                        window: '9:00 AM – 1:00 PM',
                        desc: 'Prioritize 50m lectures & 3h labs before 1:00 PM lunch',
                        bg: 'sf-pastel-cyan'
                      },
                      {
                        id: 'midday' as const,
                        title: 'Balanced Day (9 AM – 5 PM)',
                        window: '10:00 AM – 4:00 PM',
                        desc: 'Evenly distribute sessions across morning & afternoon',
                        bg: 'sf-pastel-lavender'
                      },
                      {
                        id: 'afternoon' as const,
                        title: 'Afternoon Session (Slots 5–7)',
                        window: '2:00 PM – 5:00 PM',
                        desc: 'Concentrate 3-hour labs and seminars after 2:00 PM',
                        bg: 'sf-pastel-mint'
                      }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPreferredTiming(opt.id)}
                        className={`p-4 rounded-xl text-left transition-all cursor-pointer border ${
                          preferredTiming === opt.id
                            ? `${opt.bg} border-[#171717] ring-1 ring-[#171717]`
                            : 'bg-[#F7F6EF] border-[#E4E2DA] hover:border-[#171717]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-serif-editorial text-lg text-[#171717]">{opt.title}</span>
                          {preferredTiming === opt.id && <Check className="w-4 h-4 text-[#171717]" />}
                        </div>
                        <div className="text-xs font-mono-tabular font-semibold text-[#171717] mt-1">
                          {opt.window}
                        </div>
                        <p className="text-[11px] text-[#77766F] mt-1">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Unavailable Days */}
                <div className="space-y-2 pt-2 border-t border-[#E4E2DA]">
                  <label className="block text-xs font-semibold text-[#171717]">
                    2. Unavailable / Study-Only Days
                  </label>
                  <p className="text-xs text-[#77766F]">
                    Select any days you prefer to keep free for independent study, research, or off-campus internships.
                  </p>
                  <div className="flex flex-wrap gap-2.5 pt-1">
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
                          className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                            isBlocked
                              ? 'bg-[#E8D36B] text-[#171717] border-[#171717]'
                              : 'bg-white text-[#171717] border-[#E4E2DA] hover:bg-[#F7F6EF]'
                          }`}
                        >
                          {day} {isBlocked ? '(Unavailable)' : '(Available)'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Break Preferences, Consecutive Classes & Max Daily Workload */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-[#E4E2DA]">
                  <div className="p-4 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#171717]">Midday Break Buffer</span>
                      <span className="font-mono-tabular font-bold px-2 py-0.5 rounded bg-[#B8F2E6]">
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
                    <p className="text-[11px] text-[#77766F]">
                      Protected lunch and campus transit interval between morning and afternoon blocks.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#171717]">Max Consecutive Classes</span>
                      <span className="font-mono-tabular font-bold px-2 py-0.5 rounded bg-[#F2D8FA]">
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
                    <p className="text-[11px] text-[#77766F]">
                      Inserts a mandatory open period after {maxConsecutiveClasses} consecutive sessions.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#171717]">Maximum Daily Workload</span>
                      <span className="font-mono-tabular font-bold px-2 py-0.5 rounded bg-[#B8EEEE]">
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
                    <p className="text-[11px] text-[#77766F]">
                      Caps total lecture and lab contact hours scheduled on any single day.
                    </p>
                  </div>
                </div>
              </div>

              {/* Hard & Soft Solver Rules */}
              <div className="sf-card-white p-6 space-y-6">
                <h2 className="font-serif-editorial text-2xl text-[#171717]">
                  Institutional Feasibility & Optimization Rules
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {store.constraints.map(rule => (
                    <div
                      key={rule.id}
                      className="p-4 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF]/60 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#171717]">{rule.name}</span>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                rule.kind === 'hard' ? 'bg-[#E8D36B]' : 'bg-[#B8EEEE]'
                              }`}
                            >
                              {rule.kind.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-[#77766F] mt-1">{rule.description}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => institutionalStore.toggleConstraint(rule.id, !rule.enabled)}
                          className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                            rule.enabled ? 'bg-[#171717]' : 'bg-[#D6D3C9]'
                          }`}
                        >
                          <div
                            className={`bg-white w-4 h-4 rounded-full transition-transform ${
                              rule.enabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {rule.kind === 'soft' && (
                        <div className="pt-2 border-t border-[#E4E2DA] space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-[#77766F]">Optimization Weight</span>
                            <span className="font-mono-tabular font-semibold">{rule.weight}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={rule.weight}
                            onChange={e =>
                              institutionalStore.updateConstraintWeight(rule.id, Number(e.target.value))
                            }
                            className="w-full accent-[#171717]"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-[#E4E2DA] flex justify-between">
                  <button onClick={handlePrev} className="btn-secondary text-xs">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Sections</span>
                  </button>
                  <button onClick={() => onNavigate('generate')} className="btn-primary text-xs">
                    <span>Apply Preferences & Generate Schedule</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
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
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">Required Room Type</label>
                    <select
                      value={courseForm.requiredRoomType}
                      onChange={e => setCourseForm({ ...courseForm, requiredRoomType: e.target.value as RoomType })}
                      className="input-field"
                    >
                      <option value="lecture">Lecture Hall</option>
                      <option value="lab">Laboratory</option>
                      <option value="seminar">Seminar Room</option>
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
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">Department</label>
                    <select
                      value={instructorForm.departmentId}
                      onChange={e => setInstructorForm({ ...instructorForm, departmentId: e.target.value })}
                      className="input-field"
                    >
                      {store.departments.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name}
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
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">Cohort Code</label>
                    <input
                      type="text"
                      required
                      value={groupForm.code}
                      onChange={e => setGroupForm({ ...groupForm, code: e.target.value })}
                      className="input-field font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">Cohort Name</label>
                    <input
                      type="text"
                      value={groupForm.name}
                      onChange={e => setGroupForm({ ...groupForm, name: e.target.value })}
                      className="input-field"
                    />
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
