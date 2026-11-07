import React, { useState } from 'react';
import { RouteType } from './SmartGridNav';
import { institutionalStore, useInstitutionalData } from '../data/store';
import { 
  Room, 
  Course, 
  Instructor, 
  StudentGroup, 
  DayOfWeek, 
  RoomType 
} from '../types/institutional';
import { Check, X, Plus, AlertCircle, Download, Upload, Trash2, Edit2 } from 'lucide-react';

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
  const [sideDrawerOpen, setSideDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Instructor modal availability state
  const [selectedInstructorForGrid, setSelectedInstructorForGrid] = useState<Instructor | null>(null);

  // Sample data management state
  const isSampleLoaded = institutionalStore.isSampleDataLoaded();
  const sampleCounts = institutionalStore.getSampleCounts();
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  // Pagination states (15 items per page)
  const PAGE_SIZE = 15;
  const [roomPage, setRoomPage] = useState(1);
  const [coursePage, setCoursePage] = useState(1);
  const [instructorPage, setInstructorPage] = useState(1);
  const [groupPage, setGroupPage] = useState(1);

  const handleLoadSample = () => {
    if (institutionalStore.hasRealData()) {
      if (!window.confirm('Real data already exists. Load realistic sample dataset alongside your existing data without overwriting anything?')) {
        return;
      }
    }
    institutionalStore.loadSampleData();
  };

  const handleConfirmRemoveSample = () => {
    institutionalStore.removeSampleData();
    setShowRemoveConfirm(false);
    setRoomPage(1);
    setCoursePage(1);
    setInstructorPage(1);
    setGroupPage(1);
  };

  const renderPagination = (currentPage: number, totalItems: number, setPage: (p: number) => void) => {
    const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
    if (totalPages <= 1) return null;

    const startItem = (currentPage - 1) * PAGE_SIZE + 1;
    const endItem = Math.min(currentPage * PAGE_SIZE, totalItems);

    return (
      <div className="flex items-center justify-between px-4 py-3 bg-[#FAFBFD] border-t border-[#E8EAEE] text-[13px] text-[#556070]">
        <div>
          Showing <span className="font-medium text-[#1B2430]">{startItem}</span> to <span className="font-medium text-[#1B2430]">{endItem}</span> of <span className="font-medium text-[#1B2430]">{totalItems}</span> records
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-2.5 py-1 border border-[#E8EAEE] rounded bg-white text-[#1B2430] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F6F7F9] cursor-pointer"
          >
            Previous
          </button>
          <span className="px-2 font-mono text-[13px] text-[#1B2430]">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-2.5 py-1 border border-[#E8EAEE] rounded bg-white text-[#1B2430] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F6F7F9] cursor-pointer"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  // Form states for side drawers
  // Step 2: Room Form
  const [roomForm, setRoomForm] = useState({
    code: '',
    buildingName: 'Alan Turing Hall',
    capacity: 35,
    type: 'lecture' as RoomType,
    equipment: 'Projector, Whiteboard'
  });

  // Step 3: Course Form
  const [courseForm, setCourseForm] = useState({
    code: '',
    title: '',
    creditHours: 3,
    weeklyContactHours: 3,
    requiredRoomType: 'lecture' as RoomType
  });

  // Step 4: Instructor Form
  const [instructorForm, setInstructorForm] = useState({
    name: '',
    departmentId: 'dept-cs',
    maxWeeklyHours: 12
  });

  // Step 5: Student Group Form
  const [groupForm, setGroupForm] = useState({
    name: '',
    code: '',
    year: 1,
    size: 40
  });

  // Status computation for left step list
  const activeTerm = store.terms.find(t => t.status === 'active') || store.terms[0];
  const step1Done = !!(activeTerm && store.timeStructure.periods.length > 0);
  const step2Done = store.rooms.length > 0;
  const step3Done = store.courses.length > 0;
  const step4Done = store.instructors.length > 0;
  const step5Done = store.studentGroups.length > 0;
  const step6Done = store.constraints.length > 0;

  const steps = [
    { title: 'Term and time slots', isDone: step1Done },
    { title: 'Rooms', isDone: step2Done },
    { title: 'Courses', isDone: step3Done },
    { title: 'Instructors', isDone: step4Done },
    { title: 'Student groups', isDone: step5Done },
    { title: 'Rules', isDone: step6Done }
  ];

  const handleNext = () => {
    if (activeStep < 5) {
      setActiveStep(activeStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      onNavigate('generate');
    }
  };

  // CSV Template download simulation
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
    link.setAttribute('download', `${type}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Import simulation
  const handleImportCSV = (type: string) => {
    alert(`CSV import for ${type}: sample template validated. 4 records staged.`);
  };

  // --- Step 2: Room Actions ---
  const handleOpenAddRoom = (room?: Room) => {
    setValidationError(null);
    if (room) {
      setEditingItem(room);
      setRoomForm({
        code: room.code,
        buildingName: 'Alan Turing Hall',
        capacity: room.capacity,
        type: room.type,
        equipment: room.equipment.join(', ')
      });
    } else {
      setEditingItem(null);
      setRoomForm({
        code: '',
        buildingName: 'Alan Turing Hall',
        capacity: 35,
        type: 'lecture',
        equipment: 'Projector, Whiteboard'
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
    // Check duplicate code
    const isDup = store.rooms.some(r => r.code.toLowerCase() === roomForm.code.trim().toLowerCase() && r.id !== editingItem?.id);
    if (isDup) {
      setValidationError(`Room code "${roomForm.code}" already exists.`);
      return;
    }

    if (editingItem) {
      institutionalStore.updateRoom(editingItem.id, {
        code: roomForm.code.trim(),
        capacity: Number(roomForm.capacity),
        type: roomForm.type,
        equipment: roomForm.equipment.split(',').map(s => s.trim()).filter(Boolean)
      });
    } else {
      institutionalStore.addRoom({
        id: `room-${Date.now()}`,
        buildingId: 'bld-turing',
        code: roomForm.code.trim(),
        name: roomForm.code.trim(),
        capacity: Number(roomForm.capacity),
        type: roomForm.type,
        equipment: roomForm.equipment.split(',').map(s => s.trim()).filter(Boolean),
        isAccessible: true,
        isAvailable: true
      });
    }
    setSideDrawerOpen(false);
  };

  // --- Step 3: Course Actions ---
  const handleOpenAddCourse = (course?: Course) => {
    setValidationError(null);
    if (course) {
      setEditingItem(course);
      setCourseForm({
        code: course.code,
        title: course.title,
        creditHours: course.creditHours,
        weeklyContactHours: course.weeklyContactHours,
        requiredRoomType: course.requiredRoomType
      });
    } else {
      setEditingItem(null);
      setCourseForm({
        code: '',
        title: '',
        creditHours: 3,
        weeklyContactHours: 3,
        requiredRoomType: 'lecture'
      });
    }
    setSideDrawerOpen(true);
  };

  const handleSaveCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseForm.code.trim()) {
      setValidationError('Course code is required.');
      return;
    }
    if (!courseForm.title.trim()) {
      setValidationError('Course title is required.');
      return;
    }
    const isDup = store.courses.some(c => c.code.toLowerCase() === courseForm.code.trim().toLowerCase() && c.id !== editingItem?.id);
    if (isDup) {
      setValidationError(`Course code "${courseForm.code}" already exists.`);
      return;
    }

    // Validation: Lab course check
    if (courseForm.requiredRoomType === 'lab') {
      const hasLabRoom = store.rooms.some(r => r.type === 'lab');
      if (!hasLabRoom) {
        setValidationError('Warning: No laboratory room exists in the rooms catalog yet.');
      }
    }

    if (editingItem) {
      institutionalStore.updateCourse(editingItem.id, {
        code: courseForm.code.trim(),
        title: courseForm.title.trim(),
        creditHours: Number(courseForm.creditHours),
        weeklyContactHours: Number(courseForm.weeklyContactHours),
        requiredRoomType: courseForm.requiredRoomType
      });
    } else {
      institutionalStore.addCourse({
        id: `course-${Date.now()}`,
        departmentId: 'dept-cs',
        code: courseForm.code.trim(),
        title: courseForm.title.trim(),
        creditHours: Number(courseForm.creditHours),
        weeklyContactHours: Number(courseForm.weeklyContactHours),
        lectureHours: Number(courseForm.weeklyContactHours),
        labHours: 0,
        requiredRoomType: courseForm.requiredRoomType
      });
    }
    setSideDrawerOpen(false);
  };

  // --- Step 4: Instructor Actions ---
  const handleOpenAddInstructor = (inst?: Instructor) => {
    setValidationError(null);
    if (inst) {
      setEditingItem(inst);
      setInstructorForm({
        name: inst.name,
        departmentId: inst.departmentId,
        maxWeeklyHours: inst.maxWeeklyHours
      });
    } else {
      setEditingItem(null);
      setInstructorForm({
        name: '',
        departmentId: 'dept-cs',
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
        departmentId: instructorForm.departmentId,
        maxWeeklyHours: Number(instructorForm.maxWeeklyHours)
      });
    } else {
      institutionalStore.addInstructor({
        id: `inst-${Date.now()}`,
        departmentId: instructorForm.departmentId,
        name: instructorForm.name.trim(),
        email: `${instructorForm.name.toLowerCase().replace(/\s+/g, '.')}@university.edu`,
        title: 'Faculty Member',
        maxWeeklyHours: Number(instructorForm.maxWeeklyHours),
        maxConsecutiveHours: 3,
        preferredDays: ['Mon', 'Wed', 'Fri'],
        unavailableSlots: []
      });
    }
    setSideDrawerOpen(false);
  };

  // --- Step 5: Student Group Actions ---
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
    } else {
      institutionalStore.addStudentGroup({
        id: `cohort-${Date.now()}`,
        programId: 'prog-bsc-cs',
        name: groupForm.name.trim() || groupForm.code.trim(),
        code: groupForm.code.trim(),
        year: Number(groupForm.year),
        size: Number(groupForm.size),
        sharedCourseIds: []
      });
    }
    setSideDrawerOpen(false);
  };

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8 md:py-10">
      {/* Page Title & One Short Description */}
      <div className="pb-6 border-b border-[#E8EAEE]">
        <h1 className="text-[28px] font-semibold text-[#1B2430] tracking-tight">
          Setup
        </h1>
        <p className="text-[16px] text-[#556070] mt-1">
          Input and configure the master academic data for timetable generation.
        </p>
      </div>

      {/* Quiet Sample Data Banner */}
      {isSampleLoaded ? (
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2.5 px-4 bg-[#F6F7F9] border border-[#E8EAEE] rounded-md text-[13px] text-[#556070]">
          <span>
            Sample data is loaded ({sampleCounts.departments} departments, {sampleCounts.programs} programs, {sampleCounts.classes} classes, {sampleCounts.courses} courses, {sampleCounts.instructors} instructors, {sampleCounts.rooms} rooms).
          </span>
          <button
            type="button"
            onClick={() => setShowRemoveConfirm(true)}
            className="text-[#DC2626] hover:underline font-medium cursor-pointer shrink-0"
          >
            Remove it
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2.5 px-4 bg-[#F6F7F9] border border-[#E8EAEE] rounded-md text-[13px] text-[#556070]">
          <span>Need realistic institutional data for testing and demonstration?</span>
          <button
            type="button"
            onClick={handleLoadSample}
            className="text-[#1B2430] hover:underline font-medium underline underline-offset-2 cursor-pointer shrink-0"
          >
            Load sample data
          </button>
        </div>
      )}

      {/* Confirm Remove Sample Modal */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4 border border-[#E8EAEE]">
            <div className="flex items-center justify-between">
              <h3 className="text-[18px] font-semibold text-[#1B2430]">Remove sample data?</h3>
              <button 
                onClick={() => setShowRemoveConfirm(false)}
                className="text-[#7A8594] hover:text-[#1B2430] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-[14px] text-[#556070] space-y-2">
              <p>This will delete only the sample records:</p>
              <ul className="list-disc pl-5 space-y-1 text-[#1B2430] font-mono text-[13px]">
                <li>{sampleCounts.departments} Departments</li>
                <li>{sampleCounts.programs} Programs</li>
                <li>{sampleCounts.classes} Student Groups / Classes</li>
                <li>{sampleCounts.courses} Courses</li>
                <li>{sampleCounts.instructors} Instructors</li>
                <li>{sampleCounts.rooms} Rooms</li>
                <li>{sampleCounts.sections} Assigned Sections</li>
              </ul>
              <p className="pt-1 text-[#059669] font-medium text-[13px]">
                Your real data and custom configurations will never be touched.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[#E8EAEE]">
              <button
                type="button"
                onClick={() => setShowRemoveConfirm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveSample}
                className="px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-[14px] font-medium rounded-md cursor-pointer transition-colors"
              >
                Remove sample data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main 2-Column Guided Layout: Vertical step list on left, One step on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-8">
        {/* Left: Vertical Step List */}
        <aside className="lg:col-span-3 space-y-1">
          <div className="text-[13px] font-semibold text-[#7A8594] uppercase tracking-wider px-3 mb-2">
            Steps
          </div>
          {steps.map((s, idx) => {
            const isCurrent = activeStep === idx;
            return (
              <button
                key={idx}
                onClick={() => {
                  setActiveStep(idx);
                  setSideDrawerOpen(false);
                }}
                className={`w-full text-left px-3.5 py-3 rounded-md flex items-center justify-between text-[15px] transition-colors cursor-pointer ${
                  isCurrent 
                    ? 'font-semibold text-[#1B2430] bg-[#F6F7F9] border-l-[3px] border-[#FFC400]' 
                    : 'text-[#556070] hover:text-[#1B2430] hover:bg-[#F6F7F9]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                    s.isDone 
                      ? 'bg-[#15803D] text-white' 
                      : (isCurrent ? 'border-2 border-[#1B2430] text-[#1B2430]' : 'border border-[#E8EAEE] text-[#7A8594]')
                  }`}>
                    {s.isDone ? <Check className="w-3 h-3 stroke-[3]" /> : idx + 1}
                  </span>
                  <span>{s.title}</span>
                </div>
              </button>
            );
          })}
        </aside>

        {/* Right: Exactly ONE Step Content */}
        <div className="lg:col-span-9 space-y-6">
          {/* STEP 1: Term and time slots */}
          {activeStep === 0 && (
            <div className="content-card p-6 space-y-6">
              <div>
                <h2 className="text-[20px] font-semibold text-[#1B2430]">
                  Term and time slots
                </h2>
                <p className="text-[15px] text-[#556070] mt-1">
                  Define the academic term dates, active teaching days, and daily instructional periods.
                </p>
              </div>

              {/* Term Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-[14px] font-medium text-[#1B2430] mb-1.5">
                    Term name
                  </label>
                  <input
                    type="text"
                    defaultValue={activeTerm?.name || 'Term 2 (Spring 2026)'}
                    onChange={e => activeTerm && institutionalStore.updateTerm(activeTerm.id, { name: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-[#1B2430] mb-1.5">
                    Term code
                  </label>
                  <input
                    type="text"
                    defaultValue={activeTerm?.code || 'SPRING-2026'}
                    onChange={e => activeTerm && institutionalStore.updateTerm(activeTerm.id, { code: e.target.value })}
                    className="form-input font-mono"
                  />
                </div>
              </div>

              {/* Working Days */}
              <div className="space-y-2">
                <label className="block text-[14px] font-medium text-[#1B2430]">
                  Active teaching days
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
                          institutionalStore.updateTimeStructure({ workingDays: next });
                        }}
                        className={`h-[44px] px-4 rounded-md border text-[14px] font-medium transition-colors cursor-pointer ${
                          isSelected 
                            ? 'bg-[#1B2430] text-white border-[#1B2430]' 
                            : 'bg-white text-[#556070] border-[#E8EAEE] hover:bg-[#F6F7F9]'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Period Length & Daily Range */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[14px] font-medium text-[#1B2430] mb-1.5">
                    Period length (minutes)
                  </label>
                  <input
                    type="number"
                    defaultValue={store.timeStructure.periodLengthMinutes}
                    onChange={e => institutionalStore.updateTimeStructure({ periodLengthMinutes: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-[#1B2430] mb-1.5">
                    Day start time
                  </label>
                  <input
                    type="time"
                    defaultValue={store.timeStructure.dayStartTime}
                    onChange={e => institutionalStore.updateTimeStructure({ dayStartTime: e.target.value })}
                    className="form-input font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-[#1B2430] mb-1.5">
                    Day end time
                  </label>
                  <input
                    type="time"
                    defaultValue={store.timeStructure.dayEndTime}
                    onChange={e => institutionalStore.updateTimeStructure({ dayEndTime: e.target.value })}
                    className="form-input font-mono"
                  />
                </div>
              </div>

              {/* Scheduled Periods Table */}
              <div className="space-y-2 pt-2">
                <label className="block text-[14px] font-medium text-[#1B2430]">
                  Standard instructional periods ({store.timeStructure.periods.length})
                </label>
                <div className="border border-[#E8EAEE] rounded-md divide-y divide-[#E8EAEE] bg-[#F6F7F9]">
                  {store.timeStructure.periods.map((period, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-center justify-between text-[15px] bg-white">
                      <span className="font-mono text-[#1B2430]">Period {i + 1}: {period}</span>
                      <span className="text-[13px] text-[#7A8594]">{store.timeStructure.periodLengthMinutes} mins</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom: Save and continue */}
              <div className="pt-4 border-t border-[#E8EAEE] flex justify-end">
                <button
                  onClick={handleNext}
                  className="btn-primary"
                >
                  Save and continue
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Rooms */}
          {activeStep === 1 && (
            <div className="content-card p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-[20px] font-semibold text-[#1B2430]">
                    Rooms
                  </h2>
                  <p className="text-[15px] text-[#556070] mt-0.5">
                    Campus instructional spaces, capacities, and facility types.
                  </p>
                </div>

                {/* ONE primary action on this screen */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadTemplate('rooms')}
                    className="btn-text text-[14px]"
                  >
                    Download template
                  </button>
                  <button
                    onClick={() => handleImportCSV('rooms')}
                    className="btn-text text-[14px]"
                  >
                    Import CSV
                  </button>
                  <button
                    onClick={() => handleOpenAddRoom()}
                    className="btn-primary"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add room</span>
                  </button>
                </div>
              </div>

              {/* Rooms Table */}
              {store.rooms.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-[#E8EAEE] rounded-md space-y-3">
                  <p className="text-[15px] text-[#556070]">No rooms yet. Add your first room.</p>
                  <button
                    onClick={() => handleOpenAddRoom()}
                    className="btn-primary"
                  >
                    Add room
                  </button>
                </div>
              ) : (
                <div className="border border-[#E8EAEE] rounded-md overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[15px]">
                      <thead className="bg-[#F6F7F9] text-[#556070] text-[14px] border-b border-[#E8EAEE]">
                        <tr>
                          <th className="py-3 px-4 font-semibold">Code</th>
                          <th className="py-3 px-4 font-semibold">Building</th>
                          <th className="py-3 px-4 font-semibold">Capacity</th>
                          <th className="py-3 px-4 font-semibold">Type</th>
                          <th className="py-3 px-4 font-semibold">Equipment</th>
                          <th className="py-3 px-4 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8EAEE]">
                        {store.rooms.slice((roomPage - 1) * PAGE_SIZE, roomPage * PAGE_SIZE).map(room => (
                          <tr key={room.id} className="hover:bg-[#F6F7F9] transition-colors">
                            <td className="py-3 px-4 font-mono font-medium text-[#1B2430]">{room.code}</td>
                            <td className="py-3 px-4 text-[#556070]">{room.name}</td>
                            <td className="py-3 px-4 text-[#1B2430] font-mono">{room.capacity}</td>
                            <td className="py-3 px-4 capitalize text-[#556070]">{room.type}</td>
                            <td className="py-3 px-4 text-[14px] text-[#7A8594] truncate max-w-[200px]">
                              {room.equipment.join(', ') || 'Standard'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleOpenAddRoom(room)}
                                className="p-1.5 text-[#556070] hover:text-[#1B2430] cursor-pointer"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => institutionalStore.deleteRoom(room.id)}
                                className="p-1.5 text-[#556070] hover:text-[#DC2626] cursor-pointer ml-1"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {renderPagination(roomPage, store.rooms.length, setRoomPage)}
                </div>
              )}

              {/* Bottom: Save and continue */}
              <div className="pt-4 border-t border-[#E8EAEE] flex justify-end">
                <button
                  onClick={handleNext}
                  className="btn-primary"
                >
                  Save and continue
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Courses */}
          {activeStep === 2 && (
            <div className="content-card p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-[20px] font-semibold text-[#1B2430]">
                    Courses
                  </h2>
                  <p className="text-[15px] text-[#556070] mt-0.5">
                    Catalog offerings, weekly credit hours, and required facility types.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadTemplate('courses')}
                    className="btn-text text-[14px]"
                  >
                    Download template
                  </button>
                  <button
                    onClick={() => handleImportCSV('courses')}
                    className="btn-text text-[14px]"
                  >
                    Import CSV
                  </button>
                  <button
                    onClick={() => handleOpenAddCourse()}
                    className="btn-primary"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add course</span>
                  </button>
                </div>
              </div>

              {store.courses.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-[#E8EAEE] rounded-md space-y-3">
                  <p className="text-[15px] text-[#556070]">No courses yet. Add your first course.</p>
                  <button
                    onClick={() => handleOpenAddCourse()}
                    className="btn-primary"
                  >
                    Add course
                  </button>
                </div>
              ) : (
                <div className="border border-[#E8EAEE] rounded-md overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[15px]">
                      <thead className="bg-[#F6F7F9] text-[#556070] text-[14px] border-b border-[#E8EAEE]">
                        <tr>
                          <th className="py-3 px-4 font-semibold">Code</th>
                          <th className="py-3 px-4 font-semibold">Title</th>
                          <th className="py-3 px-4 font-semibold">Credits</th>
                          <th className="py-3 px-4 font-semibold">Weekly hrs</th>
                          <th className="py-3 px-4 font-semibold">Room type</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8EAEE]">
                        {store.courses.slice((coursePage - 1) * PAGE_SIZE, coursePage * PAGE_SIZE).map(course => (
                          <tr key={course.id} className="hover:bg-[#F6F7F9] transition-colors">
                            <td className="py-3 px-4 font-mono font-medium text-[#1B2430]">{course.code}</td>
                            <td className="py-3 px-4 text-[#1B2430] font-medium">{course.title}</td>
                            <td className="py-3 px-4 text-[#556070] font-mono">{course.creditHours}</td>
                            <td className="py-3 px-4 text-[#556070] font-mono">{course.weeklyContactHours} hrs</td>
                            <td className="py-3 px-4 text-[#556070] capitalize">{course.requiredRoomType}</td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleOpenAddCourse(course)}
                                className="p-1.5 text-[#556070] hover:text-[#1B2430] cursor-pointer"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => institutionalStore.deleteCourse(course.id)}
                                className="p-1.5 text-[#556070] hover:text-[#DC2626] cursor-pointer ml-1"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {renderPagination(coursePage, store.courses.length, setCoursePage)}
                </div>
              )}

              <div className="pt-4 border-t border-[#E8EAEE] flex justify-end">
                <button
                  onClick={handleNext}
                  className="btn-primary"
                >
                  Save and continue
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Instructors */}
          {activeStep === 3 && (
            <div className="content-card p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-[20px] font-semibold text-[#1B2430]">
                    Instructors
                  </h2>
                  <p className="text-[15px] text-[#556070] mt-0.5">
                    Faculty teaching capacity and click-to-mark availability windows.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadTemplate('instructors')}
                    className="btn-text text-[14px]"
                  >
                    Download template
                  </button>
                  <button
                    onClick={() => handleImportCSV('instructors')}
                    className="btn-text text-[14px]"
                  >
                    Import CSV
                  </button>
                  <button
                    onClick={() => handleOpenAddInstructor()}
                    className="btn-primary"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add instructor</span>
                  </button>
                </div>
              </div>

              {store.instructors.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-[#E8EAEE] rounded-md space-y-3">
                  <p className="text-[15px] text-[#556070]">No instructors yet. Add your first instructor.</p>
                  <button
                    onClick={() => handleOpenAddInstructor()}
                    className="btn-primary"
                  >
                    Add instructor
                  </button>
                </div>
              ) : (
                <div className="border border-[#E8EAEE] rounded-md overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[15px]">
                      <thead className="bg-[#F6F7F9] text-[#556070] text-[14px] border-b border-[#E8EAEE]">
                        <tr>
                          <th className="py-3 px-4 font-semibold">Name</th>
                          <th className="py-3 px-4 font-semibold">Department</th>
                          <th className="py-3 px-4 font-semibold">Max load</th>
                          <th className="py-3 px-4 font-semibold">Blackout slots</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8EAEE]">
                        {store.instructors.slice((instructorPage - 1) * PAGE_SIZE, instructorPage * PAGE_SIZE).map(inst => (
                          <tr key={inst.id} className="hover:bg-[#F6F7F9] transition-colors">
                            <td className="py-3 px-4 font-medium text-[#1B2430]">{inst.name}</td>
                            <td className="py-3 px-4 text-[#556070]">
                              {store.departments.find(d => d.id === inst.departmentId)?.name || 'General'}
                            </td>
                            <td className="py-3 px-4 font-mono text-[#556070]">{inst.maxWeeklyHours} hrs/wk</td>
                            <td className="py-3 px-4">
                              <button
                                onClick={() => setSelectedInstructorForGrid(inst)}
                                className="text-[14px] text-[#1B2430] underline cursor-pointer hover:font-medium"
                              >
                                {inst.unavailableSlots.length === 0 
                                  ? 'Set availability' 
                                  : `${inst.unavailableSlots.length} unavailable slots`}
                              </button>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleOpenAddInstructor(inst)}
                                className="p-1.5 text-[#556070] hover:text-[#1B2430] cursor-pointer"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => institutionalStore.deleteInstructor(inst.id)}
                                className="p-1.5 text-[#556070] hover:text-[#DC2626] cursor-pointer ml-1"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {renderPagination(instructorPage, store.instructors.length, setInstructorPage)}
                </div>
              )}

              <div className="pt-4 border-t border-[#E8EAEE] flex justify-end">
                <button
                  onClick={handleNext}
                  className="btn-primary"
                >
                  Save and continue
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Student Groups */}
          {activeStep === 4 && (
            <div className="content-card p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-[20px] font-semibold text-[#1B2430]">
                    Student groups
                  </h2>
                  <p className="text-[15px] text-[#556070] mt-0.5">
                    Degree cohorts, academic year levels, and class enrollment headcounts.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadTemplate('groups')}
                    className="btn-text text-[14px]"
                  >
                    Download template
                  </button>
                  <button
                    onClick={() => handleImportCSV('groups')}
                    className="btn-text text-[14px]"
                  >
                    Import CSV
                  </button>
                  <button
                    onClick={() => handleOpenAddGroup()}
                    className="btn-primary"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add group</span>
                  </button>
                </div>
              </div>

              {store.studentGroups.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-[#E8EAEE] rounded-md space-y-3">
                  <p className="text-[15px] text-[#556070]">No student groups yet. Add your first cohort.</p>
                  <button
                    onClick={() => handleOpenAddGroup()}
                    className="btn-primary"
                  >
                    Add group
                  </button>
                </div>
              ) : (
                <div className="border border-[#E8EAEE] rounded-md overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[15px]">
                      <thead className="bg-[#F6F7F9] text-[#556070] text-[14px] border-b border-[#E8EAEE]">
                        <tr>
                          <th className="py-3 px-4 font-semibold">Cohort code</th>
                          <th className="py-3 px-4 font-semibold">Name</th>
                          <th className="py-3 px-4 font-semibold">Year</th>
                          <th className="py-3 px-4 font-semibold">Size</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8EAEE]">
                        {store.studentGroups.slice((groupPage - 1) * PAGE_SIZE, groupPage * PAGE_SIZE).map(grp => (
                          <tr key={grp.id} className="hover:bg-[#F6F7F9] transition-colors">
                            <td className="py-3 px-4 font-mono font-medium text-[#1B2430]">{grp.code}</td>
                            <td className="py-3 px-4 text-[#556070]">{grp.name}</td>
                            <td className="py-3 px-4 text-[#556070] font-mono">Year {grp.year}</td>
                            <td className="py-3 px-4 text-[#1B2430] font-mono">{grp.size} students</td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleOpenAddGroup(grp)}
                                className="p-1.5 text-[#556070] hover:text-[#1B2430] cursor-pointer"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => institutionalStore.deleteStudentGroup(grp.id)}
                                className="p-1.5 text-[#556070] hover:text-[#DC2626] cursor-pointer ml-1"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {renderPagination(groupPage, store.studentGroups.length, setGroupPage)}
                </div>
              )}

              <div className="pt-4 border-t border-[#E8EAEE] flex justify-end">
                <button
                  onClick={handleNext}
                  className="btn-primary"
                >
                  Save and continue
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: Rules */}
          {activeStep === 5 && (
            <div className="content-card p-6 space-y-8">
              <div>
                <h2 className="text-[20px] font-semibold text-[#1B2430]">
                  Rules
                </h2>
                <p className="text-[15px] text-[#556070] mt-0.5">
                  Configure hard feasibility requirements and soft optimization preferences.
                </p>
              </div>

              {/* Must-have rules as simple toggles */}
              <div className="space-y-4">
                <h3 className="text-[16px] font-semibold text-[#1B2430] pb-2 border-b border-[#E8EAEE]">
                  Must-have rules (hard constraints)
                </h3>
                <div className="space-y-3">
                  {store.constraints.filter(c => c.kind === 'hard').map(rule => (
                    <div 
                      key={rule.id}
                      className="p-4 border border-[#E8EAEE] rounded-md flex items-start justify-between gap-4 bg-white"
                    >
                      <div className="space-y-1">
                        <div className="text-[15px] font-semibold text-[#1B2430] flex items-center gap-2">
                          <span>{rule.name}</span>
                          <span className="font-mono text-xs text-[#7A8594]">{rule.code}</span>
                        </div>
                        <p className="text-[14px] text-[#556070] leading-relaxed">
                          {rule.description}
                        </p>
                      </div>

                      {/* Simple toggle */}
                      <button
                        type="button"
                        onClick={() => institutionalStore.toggleConstraint(rule.id, !rule.enabled)}
                        className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 mt-0.5 ${
                          rule.enabled ? 'bg-[#15803D]' : 'bg-[#E8EAEE]'
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

              {/* Preferences as simple sliders, each with one plain-language sentence */}
              <div className="space-y-5 pt-2">
                <h3 className="text-[16px] font-semibold text-[#1B2430] pb-2 border-b border-[#E8EAEE]">
                  Preferences (soft weights)
                </h3>
                <div className="space-y-5">
                  {store.constraints.filter(c => c.kind === 'soft').map(rule => (
                    <div key={rule.id} className="space-y-2">
                      <div className="flex justify-between items-center text-[15px]">
                        <span className="font-semibold text-[#1B2430]">{rule.name}</span>
                        <span className="font-mono text-[#1B2430] font-medium">{rule.weight}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={rule.weight}
                        onChange={e => institutionalStore.updateConstraintWeight(rule.id, Number(e.target.value))}
                        className="w-full"
                      />
                      <p className="text-[14px] text-[#556070]">
                        {rule.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom: Finish and proceed to generate */}
              <div className="pt-4 border-t border-[#E8EAEE] flex justify-end">
                <button
                  onClick={() => onNavigate('generate')}
                  className="btn-primary"
                >
                  Generate timetable
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Side Slide-Out Form Drawer */}
      {sideDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/25">
          <div className="w-full max-w-md bg-white h-full shadow-xl flex flex-col justify-between p-6 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#E8EAEE]">
                <h3 className="text-[18px] font-semibold text-[#1B2430]">
                  {editingItem ? 'Edit entry' : 'Add new entry'}
                </h3>
                <button
                  onClick={() => setSideDrawerOpen(false)}
                  className="text-[#7A8594] hover:text-[#1B2430] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {validationError && (
                <div className="mt-4 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-md text-[14px] text-[#DC2626] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Form Content by Step */}
              {activeStep === 1 && (
                <form id="drawerForm" onSubmit={handleSaveRoom} className="space-y-4 pt-4">
                  <div>
                    <label className="block text-[14px] font-medium text-[#1B2430] mb-1.5">
                      Room code
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Hall B3 or Lab 4"
                      value={roomForm.code}
                      onChange={e => setRoomForm({ ...roomForm, code: e.target.value })}
                      className="form-input font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[14px] font-medium text-[#1B2430] mb-1.5">
                      Capacity (seating)
                    </label>
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
                    <label className="block text-[14px] font-medium text-[#1B2430] mb-1.5">
                      Space type
                    </label>
                    <select
                      value={roomForm.type}
                      onChange={e => setRoomForm({ ...roomForm, type: e.target.value as RoomType })}
                      className="form-input"
                    >
                      <option value="lecture">Lecture Hall</option>
                      <option value="lab">Laboratory</option>
                      <option value="seminar">Seminar Room</option>
                      <option value="studio">Studio</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[14px] font-medium text-[#1B2430] mb-1.5">
                      Equipment tags (comma separated)
                    </label>
                    <input
                      type="text"
                      placeholder="Projector, Laser Cutter, Microscopes"
                      value={roomForm.equipment}
                      onChange={e => setRoomForm({ ...roomForm, equipment: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </form>
              )}

              {activeStep === 2 && (
                <form id="drawerForm" onSubmit={handleSaveCourse} className="space-y-4 pt-4">
                  <div>
                    <label className="block text-[14px] font-medium text-[#1B2430] mb-1.5">
                      Course code
                    </label>
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
                    <label className="block text-[14px] font-medium text-[#1B2430] mb-1.5">
                      Course title
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Data Structures & Algorithms"
                      value={courseForm.title}
                      onChange={e => setCourseForm({ ...courseForm, title: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[14px] font-medium text-[#1B2430] mb-1.5">
                        Credit hours
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={courseForm.creditHours}
                        onChange={e => setCourseForm({ ...courseForm, creditHours: Number(e.target.value) })}
                        className="form-input font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[14px] font-medium text-[#1B2430] mb-1.5">
                        Weekly hours
                      </label>
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
                    <label className="block text-[14px] font-medium text-[#1B2430] mb-1.5">
                      Required room type
                    </label>
                    <select
                      value={courseForm.requiredRoomType}
                      onChange={e => setCourseForm({ ...courseForm, requiredRoomType: e.target.value as RoomType })}
                      className="form-input"
                    >
                      <option value="lecture">Lecture Hall</option>
                      <option value="lab">Laboratory</option>
                      <option value="seminar">Seminar</option>
                      <option value="studio">Studio</option>
                    </select>
                  </div>
                </form>
              )}

              {activeStep === 3 && (
                <form id="drawerForm" onSubmit={handleSaveInstructor} className="space-y-4 pt-4">
                  <div>
                    <label className="block text-[14px] font-medium text-[#1B2430] mb-1.5">
                      Instructor full name
                    </label>
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
                    <label className="block text-[14px] font-medium text-[#1B2430] mb-1.5">
                      Department
                    </label>
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
                    <label className="block text-[14px] font-medium text-[#1B2430] mb-1.5">
                      Maximum weekly teaching load (hours)
                    </label>
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

              {activeStep === 4 && (
                <form id="drawerForm" onSubmit={handleSaveGroup} className="space-y-4 pt-4">
                  <div>
                    <label className="block text-[14px] font-medium text-[#1B2430] mb-1.5">
                      Cohort code
                    </label>
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
                    <label className="block text-[14px] font-medium text-[#1B2430] mb-1.5">
                      Cohort description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sophomore Computer Science Cohort"
                      value={groupForm.name}
                      onChange={e => setGroupForm({ ...groupForm, name: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[14px] font-medium text-[#1B2430] mb-1.5">
                        Year level
                      </label>
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
                      <label className="block text-[14px] font-medium text-[#1B2430] mb-1.5">
                        Student count (size)
                      </label>
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

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-[#E8EAEE] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSideDrawerOpen(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="drawerForm"
                className="btn-primary"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructor Click-to-Mark Availability Modal Grid */}
      {selectedInstructorForGrid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25">
          <div className="bg-white rounded-lg border border-[#E8EAEE] max-w-2xl w-full p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8EAEE]">
              <div>
                <h3 className="text-[18px] font-semibold text-[#1B2430]">
                  Availability grid: {selectedInstructorForGrid.name}
                </h3>
                <p className="text-[14px] text-[#556070] mt-0.5">
                  Click any slot to mark it as unavailable (red). Green slots are available.
                </p>
              </div>
              <button
                onClick={() => setSelectedInstructorForGrid(null)}
                className="text-[#7A8594] hover:text-[#1B2430] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Matrix Grid */}
            <div className="border border-[#E8EAEE] rounded-md overflow-hidden">
              <div className="grid grid-cols-6 bg-[#F6F7F9] border-b border-[#E8EAEE] text-[13px] font-semibold text-[#556070] text-center py-2.5">
                <div>Period</div>
                {store.timeStructure.workingDays.map(d => (
                  <div key={d}>{d}</div>
                ))}
              </div>

              <div className="divide-y divide-[#E8EAEE]">
                {store.timeStructure.periods.map(period => (
                  <div key={period} className="grid grid-cols-6 text-center text-[13px]">
                    <div className="p-2 font-mono text-[#556070] bg-[#F6F7F9] flex items-center justify-center border-r border-[#E8EAEE]">
                      {period}
                    </div>
                    {store.timeStructure.workingDays.map(day => {
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
                            // Refresh local modal pointer
                            const updated = institutionalStore.get().instructors.find(i => i.id === selectedInstructorForGrid.id);
                            if (updated) setSelectedInstructorForGrid(updated);
                          }}
                          className={`p-3 border-r border-[#E8EAEE] cursor-pointer transition-colors font-medium flex items-center justify-center select-none ${
                            isUnavailable 
                              ? 'bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FEE2E2]' 
                              : 'bg-white text-[#15803D] hover:bg-[#F0FDF4]'
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
              <span className="text-[13px] text-[#7A8594]">
                {selectedInstructorForGrid.unavailableSlots.length} blackout slots registered
              </span>
              <button
                onClick={() => setSelectedInstructorForGrid(null)}
                className="btn-primary"
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
