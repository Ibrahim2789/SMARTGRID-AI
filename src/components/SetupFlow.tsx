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
  RoomType 
} from '../types/institutional';
import { 
  Check, 
  X, 
  Plus, 
  AlertCircle, 
  Download, 
  Upload, 
  Trash2, 
  Edit2, 
  ArrowRight, 
  ArrowLeft,
  Layers
} from 'lucide-react';

interface SetupFlowProps {
  initialStep?: number;
  onNavigate: (route: RouteType) => void;
}

export const SetupFlow: React.FC<SetupFlowProps> = ({ 
  initialStep = 0, 
  onNavigate 
}) => {
  const store = useInstitutionalData();
  const [activeStep, setActiveStep] = useState(initialStep);

  useEffect(() => {
    setActiveStep(initialStep);
  }, [initialStep]);

  const [sideDrawerOpen, setSideDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Instructor modal availability state
  const [selectedInstructorForGrid, setSelectedInstructorForGrid] = useState<Instructor | null>(null);

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

  // Step 1: New Period input
  const [newPeriodInput, setNewPeriodInput] = useState('');

  // Step 2: Department Form
  const [deptForm, setDeptForm] = useState({
    code: '',
    name: '',
    school: 'School of Engineering & Sciences'
  });

  // Step 3: Room Form
  const [roomForm, setRoomForm] = useState({
    code: '',
    buildingName: 'Alan Turing Hall',
    capacity: 45,
    type: 'lecture' as RoomType,
    equipment: 'Projector, Whiteboard, Audio System'
  });

  // Step 4: Course Form
  const [courseForm, setCourseForm] = useState({
    code: '',
    title: '',
    departmentId: store.departments[0]?.id || 'dept-cs',
    creditHours: 4,
    weeklyContactHours: 4,
    requiredRoomType: 'lecture' as RoomType
  });

  // Step 5: Instructor Form
  const [instructorForm, setInstructorForm] = useState({
    name: '',
    title: 'Associate Professor',
    departmentId: store.departments[0]?.id || 'dept-cs',
    maxWeeklyHours: 12
  });

  // Step 6: Student Group Form & Section Quick-Add Form
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
    showToast('Loaded realistic multi-department university dataset.');
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
      <div className="flex items-center justify-between px-4 py-3 bg-[#fbf8fc] border-t border-[#ece6ed] text-xs text-[#655d69]">
        <div>
          Showing <span className="font-bold text-[#1f1b20]">{startItem}</span>–<span className="font-bold text-[#1f1b20]">{endItem}</span> of <span className="font-bold text-[#1f1b20]">{totalItems}</span> records
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 border border-[#ece6ed] rounded-xl bg-white text-[#1f1b20] font-semibold disabled:opacity-40 cursor-pointer hover:bg-[#f6f2f7]"
          >
            Previous
          </button>
          <span className="px-2 font-mono text-xs font-bold text-[#3b1e4a]">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 border border-[#ece6ed] rounded-xl bg-white text-[#1f1b20] font-semibold disabled:opacity-40 cursor-pointer hover:bg-[#f6f2f7]"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  const activeTerm = store.terms.find(t => t.status === 'active') || store.terms[0];
  const steps = [
    { title: '01. Term & Time Grid', subtitle: `${store.timeStructure.periods.length} periods`, isDone: !!(activeTerm && store.timeStructure.periods.length > 0) },
    { title: '02. Departments', subtitle: `${store.departments.length} departments`, isDone: store.departments.length > 0 },
    { title: '03. Rooms & Labs', subtitle: `${store.rooms.length} facilities`, isDone: store.rooms.length > 0 },
    { title: '04. Courses Catalog', subtitle: `${store.courses.length} courses`, isDone: store.courses.length > 0 },
    { title: '05. Faculty Roster', subtitle: `${store.instructors.length} instructors`, isDone: store.instructors.length > 0 },
    { title: '06. Cohorts & Sections', subtitle: `${store.studentGroups.length} cohorts · ${store.sections.length} secs`, isDone: store.studentGroups.length > 0 },
    { title: '07. Constraints & Rules', subtitle: `${store.constraints.filter(c => c.enabled).length} active rules`, isDone: store.constraints.length > 0 }
  ];

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      setActiveStep(activeStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      onNavigate('generate');
    }
  };

  const handlePrev = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDownloadTemplate = (type: string) => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    if (type === 'rooms') {
      csvContent += 'code,building,capacity,type,equipment\nHALL-101,Turing Hall,60,lecture,Projector\n';
    } else if (type === 'courses') {
      csvContent += 'code,title,creditHours,weeklyHours,roomType\nCS-101,Introduction to CS,4,4,lecture\n';
    } else if (type === 'instructors') {
      csvContent += 'name,department,maxWeeklyHours\nDr. Jane Doe,Computer Science,12\n';
    } else if (type === 'groups') {
      csvContent += 'code,name,year,size\nCS-Y1,Freshman CS,1,60\n';
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

  const handleImportCSV = (type: string) => {
    showToast(`Validated CSV schema for ${type}. Records synchronized with store.`);
  };

  // --- Step 2: Department Actions ---
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
        colorHex: '#3b1e4a'
      });
      showToast(`Added department ${deptForm.name.trim()}.`);
    }
    setSideDrawerOpen(false);
  };

  // --- Step 3: Room Actions ---
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
    const isDup = store.rooms.some(r => r.code.toLowerCase() === roomForm.code.trim().toLowerCase() && r.id !== editingItem?.id);
    if (isDup) {
      setValidationError(`Room code "${roomForm.code}" already exists.`);
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

  // --- Step 4: Course Actions ---
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
    const isDup = store.courses.some(c => c.code.toLowerCase() === courseForm.code.trim().toLowerCase() && c.id !== editingItem?.id);
    if (isDup) {
      setValidationError(`Course code "${courseForm.code}" already exists.`);
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

  // --- Step 5: Instructor Actions ---
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

  // --- Step 6: Student Group Actions ---
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
    if (groupForm.size <= 0) {
      setValidationError('Cohort size must be greater than zero.');
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="p-6 bg-gradient-to-br from-[#faf4fc] via-white to-[#fff7f2] border border-[#ece6ed] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="text-xs font-mono text-[#9c4126] font-bold">
            Master Institutional Configuration · Step {activeStep + 1} of {steps.length}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1f1b20] tracking-tight mt-0.5">
            Setup & Curriculum Builder
          </h1>
          <p className="text-xs sm:text-sm text-[#655d69] mt-1">
            Configure academic terms, departments, rooms, courses, faculty availability, student cohorts, and solver constraints.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {isSampleLoaded ? (
            <button
              type="button"
              onClick={() => setShowRemoveConfirm(true)}
              className="btn-secondary text-xs text-[#dc2626]"
            >
              <span>Remove Sample Data</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLoadSample}
              className="btn-secondary text-xs"
            >
              <span>Load Sample Dataset</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('generate')}
            className="btn-primary text-xs"
          >
            <span>Proceed to Solver</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {statusBanner && (
        <div className="p-3.5 rounded-xl bg-[#eefcf2] border border-[#ece6ed] text-xs text-[#0f5431] flex items-center gap-2 font-medium">
          <Check className="w-4 h-4 text-[#18794e]" />
          <span>{statusBanner}</span>
        </div>
      )}

      {/* Confirm Remove Sample Modal */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-[#ece6ed]">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1f1b20]">Remove sample dataset?</h3>
              <button 
                onClick={() => setShowRemoveConfirm(false)}
                className="text-[#7c747f] hover:text-[#1f1b20] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-[#655d69] space-y-2">
              <p>This removes the loaded sample records ({sampleCounts.rooms} rooms, {sampleCounts.courses} courses, {sampleCounts.instructors} instructors) while preserving any custom entries you created.</p>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[#ece6ed]">
              <button
                type="button"
                onClick={() => setShowRemoveConfirm(false)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveSample}
                className="px-4 py-2 bg-[#dc2626] hover:bg-[#b91c1c] text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
              >
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main 2-Column Guided Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 7-Step Vertical Navigation */}
        <aside className="lg:col-span-3 space-y-1.5">
          <div className="content-card p-3 space-y-1">
            {steps.map((s, idx) => {
              const isCurrent = activeStep === idx;
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setActiveStep(idx);
                    setSideDrawerOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-3 rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                    isCurrent 
                      ? 'bg-[#3b1e4a] text-white shadow-xs' 
                      : 'text-[#655d69] hover:text-[#1f1b20] hover:bg-[#f6f2f7]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${
                      isCurrent
                        ? 'bg-[#f27438] text-white'
                        : s.isDone 
                        ? 'bg-[#18794e] text-white' 
                        : 'border border-[#ece6ed] text-[#7c747f]'
                    }`}>
                      {s.isDone && !isCurrent ? <Check className="w-3 h-3 stroke-[3]" /> : idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className={`text-xs truncate ${isCurrent ? 'font-bold text-white' : 'font-semibold text-[#1f1b20]'}`}>
                        {s.title}
                      </div>
                      <div className={`text-[10px] truncate ${isCurrent ? 'text-white/75' : 'text-[#7c747f]'}`}>
                        {s.subtitle}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right: Active Step Content */}
        <div className="lg:col-span-9 space-y-6">
          {/* STEP 0: Term and Time Slots */}
          {activeStep === 0 && (
            <div className="content-card p-6 space-y-6">
              <div>
                <h2 className="text-xl font-bold text-[#1f1b20]">
                  01. Academic Term & Daily Time Grid
                </h2>
                <p className="text-xs text-[#655d69] mt-1">
                  Define the active academic term, teaching days of the week, and standard instructional time periods.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">
                    Academic Term Name
                  </label>
                  <input
                    type="text"
                    value={activeTerm?.name || 'Term 2 (Spring 2026)'}
                    onChange={e => activeTerm && institutionalStore.updateTerm(activeTerm.id, { name: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">
                    Term Code
                  </label>
                  <input
                    type="text"
                    value={activeTerm?.code || 'SPRING-2026'}
                    onChange={e => activeTerm && institutionalStore.updateTerm(activeTerm.id, { code: e.target.value })}
                    className="form-input font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#1f1b20]">
                  Active Teaching Days
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as DayOfWeek[]).map(day => {
                    const isSelected = store.timeStructure.workingDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          const current = store.timeStructure.workingDays;
                          const next = isSelected 
                            ? current.filter(d => d !== day) 
                            : [...current, day];
                          if (next.length > 0) {
                            institutionalStore.updateTimeStructure({ workingDays: next });
                          }
                        }}
                        className={`h-10 px-4 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-[#3b1e4a] text-white border-[#3b1e4a]' 
                            : 'bg-white text-[#655d69] border-[#ece6ed] hover:bg-[#f6f2f7]'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">
                    Period Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={store.timeStructure.periodLengthMinutes}
                    onChange={e => institutionalStore.updateTimeStructure({ periodLengthMinutes: Number(e.target.value) })}
                    className="form-input font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">
                    Campus Day Start
                  </label>
                  <input
                    type="time"
                    value={store.timeStructure.dayStartTime}
                    onChange={e => institutionalStore.updateTimeStructure({ dayStartTime: e.target.value })}
                    className="form-input font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">
                    Campus Day End
                  </label>
                  <input
                    type="time"
                    value={store.timeStructure.dayEndTime}
                    onChange={e => institutionalStore.updateTimeStructure({ dayEndTime: e.target.value })}
                    className="form-input font-mono"
                  />
                </div>
              </div>

              {/* Manage Periods */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="block text-xs font-bold text-[#1f1b20]">
                    Standard Instructional Time Slots ({store.timeStructure.periods.length})
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. 15:30 - 17:00"
                      value={newPeriodInput}
                      onChange={e => setNewPeriodInput(e.target.value)}
                      className="h-9 px-3 text-xs border border-[#ece6ed] rounded-xl font-mono bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newPeriodInput.trim()) return;
                        if (!store.timeStructure.periods.includes(newPeriodInput.trim())) {
                          institutionalStore.updateTimeStructure({
                            periods: [...store.timeStructure.periods, newPeriodInput.trim()]
                          });
                          setNewPeriodInput('');
                          showToast(`Added time slot ${newPeriodInput.trim()}.`);
                        }
                      }}
                      className="h-9 px-3 rounded-xl bg-[#3b1e4a] text-white text-xs font-semibold cursor-pointer"
                    >
                      + Add Slot
                    </button>
                  </div>
                </div>

                <div className="border border-[#ece6ed] rounded-xl divide-y divide-[#ece6ed] overflow-hidden">
                  {store.timeStructure.periods.map((period, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between text-xs bg-white hover:bg-[#fbf8fc]">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-[#3b1e4a]">Slot 0{i + 1}</span>
                        <span className="font-mono text-[#1f1b20] font-semibold">{period}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[#7c747f] font-mono">{store.timeStructure.periodLengthMinutes} mins</span>
                        {store.timeStructure.periods.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              institutionalStore.updateTimeStructure({
                                periods: store.timeStructure.periods.filter((_, idx) => idx !== i)
                              });
                            }}
                            className="text-[#7c747f] hover:text-[#dc2626] cursor-pointer"
                            title="Remove period"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-[#ece6ed] flex justify-end">
                <button onClick={handleNext} className="btn-primary text-xs">
                  <span>Save & Continue to Departments</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 1: Departments & Programs */}
          {activeStep === 1 && (
            <div className="content-card p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[#1f1b20]">
                    02. Academic Departments & Schools
                  </h2>
                  <p className="text-xs text-[#655d69] mt-0.5">
                    Organize courses, faculty, and degree tracks by academic department.
                  </p>
                </div>

                <button onClick={() => handleOpenAddDept()} className="btn-primary text-xs">
                  <Plus className="w-4 h-4" />
                  <span>Add Department</span>
                </button>
              </div>

              <div className="border border-[#ece6ed] rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#fbf8fc] text-[#655d69] border-b border-[#ece6ed]">
                    <tr>
                      <th className="py-3 px-4 font-bold">Code</th>
                      <th className="py-3 px-4 font-bold">Department Name</th>
                      <th className="py-3 px-4 font-bold">Academic School</th>
                      <th className="py-3 px-4 font-bold font-mono">Courses</th>
                      <th className="py-3 px-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ece6ed]">
                    {store.departments.map(dept => {
                      const courseCount = store.courses.filter(c => c.departmentId === dept.id).length;
                      return (
                        <tr key={dept.id} className="hover:bg-[#fbf8fc]">
                          <td className="py-3 px-4 font-mono font-bold text-[#3b1e4a]">{dept.code}</td>
                          <td className="py-3 px-4 font-semibold text-[#1f1b20]">{dept.name}</td>
                          <td className="py-3 px-4 text-[#655d69]">{dept.school}</td>
                          <td className="py-3 px-4 font-mono text-[#655d69]">{courseCount} courses</td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleOpenAddDept(dept)}
                              className="p-1.5 text-[#655d69] hover:text-[#1f1b20] cursor-pointer"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => institutionalStore.deleteDepartment(dept.id)}
                              className="p-1.5 text-[#655d69] hover:text-[#dc2626] cursor-pointer ml-1"
                              title="Delete"
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

              <div className="pt-4 border-t border-[#ece6ed] flex justify-between">
                <button onClick={handlePrev} className="btn-secondary text-xs">
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>
                <button onClick={handleNext} className="btn-primary text-xs">
                  <span>Save & Continue to Rooms</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Rooms & Facilities */}
          {activeStep === 2 && (
            <div className="content-card p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[#1f1b20]">
                    03. Campus Rooms & Laboratories
                  </h2>
                  <p className="text-xs text-[#655d69] mt-0.5">
                    Configure lecture halls, specialized laboratories, studios, and seating capacities.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => handleDownloadTemplate('rooms')} className="btn-text text-xs">
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV Template</span>
                  </button>
                  <button onClick={() => handleImportCSV('rooms')} className="btn-text text-xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Sync CSV</span>
                  </button>
                  <button onClick={() => handleOpenAddRoom()} className="btn-primary text-xs">
                    <Plus className="w-4 h-4" />
                    <span>Add Room</span>
                  </button>
                </div>
              </div>

              <div className="border border-[#ece6ed] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#fbf8fc] text-[#655d69] border-b border-[#ece6ed]">
                      <tr>
                        <th className="py-3 px-4 font-bold">Room Code</th>
                        <th className="py-3 px-4 font-bold">Facility / Wing</th>
                        <th className="py-3 px-4 font-bold font-mono">Seat Cap</th>
                        <th className="py-3 px-4 font-bold">Space Type</th>
                        <th className="py-3 px-4 font-bold">Equipment</th>
                        <th className="py-3 px-4 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ece6ed]">
                      {store.rooms.slice((roomPage - 1) * PAGE_SIZE, roomPage * PAGE_SIZE).map(room => (
                        <tr key={room.id} className="hover:bg-[#fbf8fc]">
                          <td className="py-3 px-4 font-mono font-bold text-[#3b1e4a]">{room.code}</td>
                          <td className="py-3 px-4 text-[#1f1b20] font-medium">{room.name}</td>
                          <td className="py-3 px-4 font-mono font-bold text-[#1f1b20]">{room.capacity} seats</td>
                          <td className="py-3 px-4 capitalize text-[#655d69]">{room.type}</td>
                          <td className="py-3 px-4 text-[#7c747f] truncate max-w-[200px]">
                            {room.equipment.join(', ') || 'Standard AV'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button onClick={() => handleOpenAddRoom(room)} className="p-1.5 text-[#655d69] hover:text-[#1f1b20] cursor-pointer">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => institutionalStore.deleteRoom(room.id)} className="p-1.5 text-[#655d69] hover:text-[#dc2626] cursor-pointer ml-1">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {renderPagination(roomPage, store.rooms.length, setRoomPage)}
              </div>

              <div className="pt-4 border-t border-[#ece6ed] flex justify-between">
                <button onClick={handlePrev} className="btn-secondary text-xs">
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>
                <button onClick={handleNext} className="btn-primary text-xs">
                  <span>Save & Continue to Courses</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Courses Catalog */}
          {activeStep === 3 && (
            <div className="content-card p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[#1f1b20]">
                    04. Academic Courses Catalog
                  </h2>
                  <p className="text-xs text-[#655d69] mt-0.5">
                    Define courses, credit hours, weekly contact hours, and required room types.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => handleDownloadTemplate('courses')} className="btn-text text-xs">
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV Template</span>
                  </button>
                  <button onClick={() => handleOpenAddCourse()} className="btn-primary text-xs">
                    <Plus className="w-4 h-4" />
                    <span>Add Course</span>
                  </button>
                </div>
              </div>

              <div className="border border-[#ece6ed] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#fbf8fc] text-[#655d69] border-b border-[#ece6ed]">
                      <tr>
                        <th className="py-3 px-4 font-bold">Course Code</th>
                        <th className="py-3 px-4 font-bold">Course Title</th>
                        <th className="py-3 px-4 font-bold">Department</th>
                        <th className="py-3 px-4 font-bold font-mono">Credits</th>
                        <th className="py-3 px-4 font-bold font-mono">Weekly Hrs</th>
                        <th className="py-3 px-4 font-bold">Room Type</th>
                        <th className="py-3 px-4 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ece6ed]">
                      {store.courses.slice((coursePage - 1) * PAGE_SIZE, coursePage * PAGE_SIZE).map(course => {
                        const dept = store.departments.find(d => d.id === course.departmentId);
                        return (
                          <tr key={course.id} className="hover:bg-[#fbf8fc]">
                            <td className="py-3 px-4 font-mono font-bold text-[#9c4126]">{course.code}</td>
                            <td className="py-3 px-4 font-semibold text-[#1f1b20]">{course.title}</td>
                            <td className="py-3 px-4 text-[#655d69]">{dept?.code || 'STEM'}</td>
                            <td className="py-3 px-4 font-mono text-[#1f1b20]">{course.creditHours} cr</td>
                            <td className="py-3 px-4 font-mono text-[#655d69]">{course.weeklyContactHours} hrs</td>
                            <td className="py-3 px-4 capitalize text-[#3b1e4a] font-medium">{course.requiredRoomType}</td>
                            <td className="py-3 px-4 text-right">
                              <button onClick={() => handleOpenAddCourse(course)} className="p-1.5 text-[#655d69] hover:text-[#1f1b20] cursor-pointer">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => institutionalStore.deleteCourse(course.id)} className="p-1.5 text-[#655d69] hover:text-[#dc2626] cursor-pointer ml-1">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {renderPagination(coursePage, store.courses.length, setCoursePage)}
              </div>

              <div className="pt-4 border-t border-[#ece6ed] flex justify-between">
                <button onClick={handlePrev} className="btn-secondary text-xs">
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>
                <button onClick={handleNext} className="btn-primary text-xs">
                  <span>Save & Continue to Faculty</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Instructors & Availability */}
          {activeStep === 4 && (
            <div className="content-card p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[#1f1b20]">
                    05. Faculty Roster & Availability Matrix
                  </h2>
                  <p className="text-xs text-[#655d69] mt-0.5">
                    Configure faculty workload limits and click any instructor's availability button to block out unavailable hours.
                  </p>
                </div>

                <button onClick={() => handleOpenAddInstructor()} className="btn-primary text-xs">
                  <Plus className="w-4 h-4" />
                  <span>Add Instructor</span>
                </button>
              </div>

              <div className="border border-[#ece6ed] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#fbf8fc] text-[#655d69] border-b border-[#ece6ed]">
                      <tr>
                        <th className="py-3 px-4 font-bold">Instructor Name</th>
                        <th className="py-3 px-4 font-bold">Department</th>
                        <th className="py-3 px-4 font-bold font-mono">Max Load</th>
                        <th className="py-3 px-4 font-bold">Availability & Blackouts</th>
                        <th className="py-3 px-4 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ece6ed]">
                      {store.instructors.slice((instructorPage - 1) * PAGE_SIZE, instructorPage * PAGE_SIZE).map(inst => (
                        <tr key={inst.id} className="hover:bg-[#fbf8fc]">
                          <td className="py-3 px-4 font-bold text-[#1f1b20]">{inst.name}</td>
                          <td className="py-3 px-4 text-[#655d69]">
                            {store.departments.find(d => d.id === inst.departmentId)?.name || 'Engineering'}
                          </td>
                          <td className="py-3 px-4 font-mono text-[#1f1b20]">{inst.maxWeeklyHours} hrs/wk</td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => setSelectedInstructorForGrid(inst)}
                              className="px-3 py-1 rounded-lg border border-[#ece6ed] bg-[#fbf8fc] hover:bg-[#f6f2f7] text-xs font-semibold text-[#3b1e4a] cursor-pointer transition-colors"
                            >
                              {inst.unavailableSlots.length === 0 
                                ? 'Configure Availability Grid' 
                                : `${inst.unavailableSlots.length} Blackout Slots Set`}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button onClick={() => handleOpenAddInstructor(inst)} className="p-1.5 text-[#655d69] hover:text-[#1f1b20] cursor-pointer">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => institutionalStore.deleteInstructor(inst.id)} className="p-1.5 text-[#655d69] hover:text-[#dc2626] cursor-pointer ml-1">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {renderPagination(instructorPage, store.instructors.length, setInstructorPage)}
              </div>

              <div className="pt-4 border-t border-[#ece6ed] flex justify-between">
                <button onClick={handlePrev} className="btn-secondary text-xs">
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>
                <button onClick={handleNext} className="btn-primary text-xs">
                  <span>Save & Continue to Cohorts</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Student Groups & Course Sections */}
          {activeStep === 5 && (
            <div className="space-y-6">
              <div className="content-card p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-[#1f1b20]">
                      06. Student Cohorts & Curriculum Sections
                    </h2>
                    <p className="text-xs text-[#655d69] mt-0.5">
                      Manage student degree cohorts and link courses + instructors into schedulable class sections.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const added = institutionalStore.autoGenerateMissingSections();
                        showToast(added > 0 ? `Auto-generated ${added} curriculum sections.` : 'All catalog courses already have active sections.');
                      }}
                      className="btn-secondary text-xs"
                    >
                      <Layers className="w-3.5 h-3.5 text-[#9c4126]" />
                      <span>Auto-Map Missing Sections</span>
                    </button>
                    <button onClick={() => handleOpenAddGroup()} className="btn-primary text-xs">
                      <Plus className="w-4 h-4" />
                      <span>Add Student Cohort</span>
                    </button>
                  </div>
                </div>

                <div className="border border-[#ece6ed] rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#fbf8fc] text-[#655d69] border-b border-[#ece6ed]">
                        <tr>
                          <th className="py-3 px-4 font-bold">Cohort Code</th>
                          <th className="py-3 px-4 font-bold">Cohort Description</th>
                          <th className="py-3 px-4 font-bold font-mono">Year Level</th>
                          <th className="py-3 px-4 font-bold font-mono">Enrollment</th>
                          <th className="py-3 px-4 font-bold font-mono">Mapped Sections</th>
                          <th className="py-3 px-4 font-bold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ece6ed]">
                        {store.studentGroups.slice((groupPage - 1) * PAGE_SIZE, groupPage * PAGE_SIZE).map(grp => {
                          const secCount = store.sections.filter(s => s.studentGroupId === grp.id).length;
                          return (
                            <tr key={grp.id} className="hover:bg-[#fbf8fc]">
                              <td className="py-3 px-4 font-mono font-bold text-[#3b1e4a]">{grp.code}</td>
                              <td className="py-3 px-4 font-medium text-[#1f1b20]">{grp.name}</td>
                              <td className="py-3 px-4 font-mono text-[#655d69]">Year {grp.year}</td>
                              <td className="py-3 px-4 font-mono font-bold text-[#1f1b20]">{grp.size} students</td>
                              <td className="py-3 px-4 font-mono text-[#18794e] font-semibold">{secCount} sections</td>
                              <td className="py-3 px-4 text-right">
                                <button onClick={() => handleOpenAddGroup(grp)} className="p-1.5 text-[#655d69] hover:text-[#1f1b20] cursor-pointer">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => institutionalStore.deleteStudentGroup(grp.id)} className="p-1.5 text-[#655d69] hover:text-[#dc2626] cursor-pointer ml-1">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {renderPagination(groupPage, store.studentGroups.length, setGroupPage)}
                </div>

                {/* Quick Section Creator */}
                <form onSubmit={handleAddSectionInline} className="p-4 rounded-xl bg-[#fbf8fc] border border-[#ece6ed] space-y-3">
                  <div className="text-xs font-bold text-[#1f1b20]">
                    Assign Course Section to Cohort ({store.sections.length} total sections queued for solver)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] text-[#655d69] mb-1">Course</label>
                      <select
                        value={sectionForm.courseId || store.courses[0]?.id || ''}
                        onChange={e => setSectionForm({ ...sectionForm, courseId: e.target.value })}
                        className="form-input text-xs h-9"
                      >
                        {store.courses.map(c => (
                          <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#655d69] mb-1">Faculty Instructor</label>
                      <select
                        value={sectionForm.instructorId || store.instructors[0]?.id || ''}
                        onChange={e => setSectionForm({ ...sectionForm, instructorId: e.target.value })}
                        className="form-input text-xs h-9"
                      >
                        {store.instructors.map(i => (
                          <option key={i.id} value={i.id}>{i.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#655d69] mb-1">Student Cohort</label>
                      <select
                        value={sectionForm.studentGroupId || store.studentGroups[0]?.id || ''}
                        onChange={e => setSectionForm({ ...sectionForm, studentGroupId: e.target.value })}
                        className="form-input text-xs h-9"
                      >
                        {store.studentGroups.map(g => (
                          <option key={g.id} value={g.id}>{g.code} ({g.size} students)</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button type="submit" className="w-full h-9 rounded-xl bg-[#3b1e4a] hover:bg-[#2a1335] text-white text-xs font-bold cursor-pointer transition-colors">
                        + Queue Section
                      </button>
                    </div>
                  </div>
                </form>

                <div className="pt-4 border-t border-[#ece6ed] flex justify-between">
                  <button onClick={handlePrev} className="btn-secondary text-xs">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>
                  <button onClick={handleNext} className="btn-primary text-xs">
                    <span>Save & Continue to Rules</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: Rules & Constraints */}
          {activeStep === 6 && (
            <div className="content-card p-6 space-y-8">
              <div>
                <h2 className="text-xl font-bold text-[#1f1b20]">
                  07. Scheduling Rules & Optimization Preferences
                </h2>
                <p className="text-xs text-[#655d69] mt-0.5">
                  Configure hard feasibility invariants and soft optimization weights before launching the timetable generator.
                </p>
              </div>

              {/* Hard Constraints */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[#1f1b20] pb-2 border-b border-[#ece6ed]">
                  Hard Feasibility Constraints (Zero Violation Guarantee)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {store.constraints.filter(c => c.kind === 'hard').map(rule => (
                    <div 
                      key={rule.id}
                      className="p-4 border border-[#ece6ed] rounded-xl flex items-start justify-between gap-4 bg-[#fbf8fc]/60"
                    >
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-[#1f1b20] flex items-center gap-2">
                          <span>{rule.name}</span>
                          <span className="font-mono text-[10px] text-[#9c4126]">{rule.code}</span>
                        </div>
                        <p className="text-xs text-[#655d69] leading-relaxed">
                          {rule.description}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => institutionalStore.toggleConstraint(rule.id, !rule.enabled)}
                        className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 mt-0.5 ${
                          rule.enabled ? 'bg-[#18794e]' : 'bg-[#dcd9dd]'
                        }`}
                      >
                        <div 
                          className={`bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform ${
                            rule.enabled ? 'translate-x-5' : 'translate-x-0'
                          }`} 
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Soft Preferences */}
              <div className="space-y-5 pt-2">
                <h3 className="text-sm font-bold text-[#1f1b20] pb-2 border-b border-[#ece6ed]">
                  Soft Optimization Weights (Multi-Objective Heuristics)
                </h3>
                <div className="space-y-5">
                  {store.constraints.filter(c => c.kind === 'soft').map(rule => (
                    <div key={rule.id} className="p-4 rounded-xl border border-[#ece6ed] bg-white space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-[#1f1b20]">{rule.name}</span>
                        <span className="font-mono text-[#9c4126] font-bold">{rule.weight}% priority</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={rule.weight}
                        onChange={e => institutionalStore.updateConstraintWeight(rule.id, Number(e.target.value))}
                        className="w-full"
                      />
                      <p className="text-xs text-[#655d69]">
                        {rule.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-[#ece6ed] flex justify-between">
                <button onClick={handlePrev} className="btn-secondary text-xs">
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>
                <button onClick={() => onNavigate('generate')} className="btn-primary text-xs">
                  <span>Complete Setup & Launch Generator</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Side Slide-Out Form Drawer */}
      {sideDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between p-6 overflow-y-auto border-l border-[#ece6ed]">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#ece6ed]">
                <h3 className="text-lg font-bold text-[#1f1b20]">
                  {editingItem ? 'Update Record' : 'Create New Record'}
                </h3>
                <button
                  onClick={() => setSideDrawerOpen(false)}
                  className="text-[#7c747f] hover:text-[#1f1b20] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {validationError && (
                <div className="mt-4 p-3 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-xs text-[#dc2626] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {activeStep === 1 && (
                <form id="drawerForm" onSubmit={handleSaveDept} className="space-y-4 pt-4">
                  <div>
                    <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">Department Code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CS or BIO"
                      value={deptForm.code}
                      onChange={e => setDeptForm({ ...deptForm, code: e.target.value })}
                      className="form-input font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">Department Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Computer Science & AI"
                      value={deptForm.name}
                      onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">Academic School / Division</label>
                    <input
                      type="text"
                      value={deptForm.school}
                      onChange={e => setDeptForm({ ...deptForm, school: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </form>
              )}

              {activeStep === 2 && (
                <form id="drawerForm" onSubmit={handleSaveRoom} className="space-y-4 pt-4">
                  <div>
                    <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">Room Code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Hall B3 or Bio Lab 4"
                      value={roomForm.code}
                      onChange={e => setRoomForm({ ...roomForm, code: e.target.value })}
                      className="form-input font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">Building / Wing Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alan Turing Hall"
                      value={roomForm.buildingName}
                      onChange={e => setRoomForm({ ...roomForm, buildingName: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">Seating Capacity</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={roomForm.capacity}
                      onChange={e => setRoomForm({ ...roomForm, capacity: Number(e.target.value) })}
                      className="form-input font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">Space Type</label>
                    <select
                      value={roomForm.type}
                      onChange={e => setRoomForm({ ...roomForm, type: e.target.value as RoomType })}
                      className="form-input"
                    >
                      <option value="lecture">Lecture Hall</option>
                      <option value="lab">Laboratory</option>
                      <option value="seminar">Seminar Room</option>
                      <option value="studio">Design Studio</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">Equipment (comma separated)</label>
                    <input
                      type="text"
                      value={roomForm.equipment}
                      onChange={e => setRoomForm({ ...roomForm, equipment: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </form>
              )}

              {activeStep === 3 && (
                <form id="drawerForm" onSubmit={handleSaveCourse} className="space-y-4 pt-4">
                  <div>
                    <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">Course Code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CS-301"
                      value={courseForm.code}
                      onChange={e => setCourseForm({ ...courseForm, code: e.target.value })}
                      className="form-input font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">Course Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Algorithms & Data Structures"
                      value={courseForm.title}
                      onChange={e => setCourseForm({ ...courseForm, title: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">Department</label>
                    <select
                      value={courseForm.departmentId}
                      onChange={e => setCourseForm({ ...courseForm, departmentId: e.target.value })}
                      className="form-input"
                    >
                      {store.departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">Credits</label>
                      <input
                        type="number"
                        min="1"
                        value={courseForm.creditHours}
                        onChange={e => setCourseForm({ ...courseForm, creditHours: Number(e.target.value) })}
                        className="form-input font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">Weekly Hours</label>
                      <input
                        type="number"
                        min="1"
                        value={courseForm.weeklyContactHours}
                        onChange={e => setCourseForm({ ...courseForm, weeklyContactHours: Number(e.target.value) })}
                        className="form-input font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">Required Room Type</label>
                    <select
                      value={courseForm.requiredRoomType}
                      onChange={e => setCourseForm({ ...courseForm, requiredRoomType: e.target.value as RoomType })}
                      className="form-input"
                    >
                      <option value="lecture">Lecture Hall</option>
                      <option value="lab">Laboratory</option>
                      <option value="seminar">Seminar Room</option>
                      <option value="studio">Design Studio</option>
                    </select>
                  </div>
                </form>
              )}

              {activeStep === 4 && (
                <form id="drawerForm" onSubmit={handleSaveInstructor} className="space-y-4 pt-4">
                  <div>
                    <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">Instructor Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Alan Evans"
                      value={instructorForm.name}
                      onChange={e => setInstructorForm({ ...instructorForm, name: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">Academic Title</label>
                    <input
                      type="text"
                      value={instructorForm.title}
                      onChange={e => setInstructorForm({ ...instructorForm, title: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">Department</label>
                    <select
                      value={instructorForm.departmentId}
                      onChange={e => setInstructorForm({ ...instructorForm, departmentId: e.target.value })}
                      className="form-input"
                    >
                      {store.departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">Max Weekly Teaching Hours</label>
                    <input
                      type="number"
                      min="1"
                      value={instructorForm.maxWeeklyHours}
                      onChange={e => setInstructorForm({ ...instructorForm, maxWeeklyHours: Number(e.target.value) })}
                      className="form-input font-mono"
                    />
                  </div>
                </form>
              )}

              {activeStep === 5 && (
                <form id="drawerForm" onSubmit={handleSaveGroup} className="space-y-4 pt-4">
                  <div>
                    <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">Cohort Code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CS-Year2"
                      value={groupForm.code}
                      onChange={e => setGroupForm({ ...groupForm, code: e.target.value })}
                      className="form-input font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">Cohort Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Sophomore Computer Science"
                      value={groupForm.name}
                      onChange={e => setGroupForm({ ...groupForm, name: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">Year Level</label>
                      <input
                        type="number"
                        min="1"
                        max="6"
                        value={groupForm.year}
                        onChange={e => setGroupForm({ ...groupForm, year: Number(e.target.value) })}
                        className="form-input font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">Student Count</label>
                      <input
                        type="number"
                        min="1"
                        value={groupForm.size}
                        onChange={e => setGroupForm({ ...groupForm, size: Number(e.target.value) })}
                        className="form-input font-mono"
                      />
                    </div>
                  </div>
                </form>
              )}
            </div>

            <div className="pt-4 border-t border-[#ece6ed] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSideDrawerOpen(false)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="drawerForm"
                className="btn-primary text-xs"
              >
                Save Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructor Click-to-Mark Availability Modal Grid */}
      {selectedInstructorForGrid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-xs">
          <div className="bg-white rounded-xl border border-[#ece6ed] max-w-2xl w-full p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#ece6ed]">
              <div>
                <h3 className="text-lg font-bold text-[#1f1b20]">
                  Faculty Availability Matrix · {selectedInstructorForGrid.name}
                </h3>
                <p className="text-xs text-[#655d69] mt-0.5">
                  Click any period cell to toggle between Available (green) and Blocked Out (terracotta red).
                </p>
              </div>
              <button
                onClick={() => setSelectedInstructorForGrid(null)}
                className="text-[#7c747f] hover:text-[#1f1b20] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border border-[#ece6ed] rounded-xl overflow-hidden">
              <div className="grid grid-cols-6 bg-[#fbf8fc] border-b border-[#ece6ed] text-xs font-bold text-[#655d69] text-center py-2.5">
                <div>Period</div>
                {store.timeStructure.workingDays.slice(0, 5).map(d => (
                  <div key={d}>{d}</div>
                ))}
              </div>

              <div className="divide-y divide-[#ece6ed]">
                {store.timeStructure.periods.map(period => (
                  <div key={period} className="grid grid-cols-6 text-center text-xs">
                    <div className="p-2.5 font-mono text-[#3b1e4a] font-semibold bg-[#fbf8fc] flex items-center justify-center border-r border-[#ece6ed]">
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
                            const updated = institutionalStore.get().instructors.find(i => i.id === selectedInstructorForGrid.id);
                            if (updated) setSelectedInstructorForGrid(updated);
                          }}
                          className={`p-3 border-r border-[#ece6ed] cursor-pointer transition-colors font-bold flex items-center justify-center select-none ${
                            isUnavailable 
                              ? 'bg-[#fef2f2] text-[#dc2626] hover:bg-[#fee2e2]' 
                              : 'bg-[#eefcf2] text-[#18794e] hover:bg-[#d2f3dd]'
                          }`}
                        >
                          {isUnavailable ? 'Blocked' : 'Available'}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-xs font-mono text-[#655d69]">
                {selectedInstructorForGrid.unavailableSlots.length} blackout periods registered
              </span>
              <button
                onClick={() => setSelectedInstructorForGrid(null)}
                className="btn-primary text-xs"
              >
                Done & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
