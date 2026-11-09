import React, { useState } from 'react';
import {
  Building2,
  Clock,
  Layers,
  DoorOpen,
  BookOpen,
  Users,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Upload,
  Sparkles,
  Check,
  Plus,
  Trash2,
  Sliders
} from 'lucide-react';
import { institutionalStore, useInstitutionalData, InstitutionProfile } from '../data/store';
import { DayOfWeek, TimeStructure, computeAcademicScheduleConfig } from '../types/institutional';
import { DataImportWizard } from './DataImportWizard';

interface UniversityOnboardingModalProps {
  onClose: () => void;
  onCompleted?: (newInstitutionId: string) => void;
  existingInstitutionId?: string;
  initialName?: string;
  initialCode?: string;
  initialCampusName?: string;
  initialRegistrarName?: string;
  initialRegistrarEmail?: string;
}

export const UniversityOnboardingModal: React.FC<UniversityOnboardingModalProps> = ({
  onClose,
  onCompleted,
  existingInstitutionId,
  initialName = '',
  initialCode = '',
  initialCampusName = 'Main Campus',
  initialRegistrarName = 'Academic Registrar',
  initialRegistrarEmail = 'registrar@university.edu'
}) => {
  const [activeStep, setActiveStep] = useState<number>(existingInstitutionId ? 1 : 0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  // Step 1: Institution Profile
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(initialCode);
  const [campusName, setCampusName] = useState(initialCampusName);
  const [accreditation, setAccreditation] = useState('National Higher Education Accreditation Council');
  const [academicYear, setAcademicYear] = useState('2026–2027');
  const [currentTerm, setCurrentTerm] = useState('Fall Semester 2026');
  const [registrarName, setRegistrarName] = useState(initialRegistrarName);
  const [registrarEmail, setRegistrarEmail] = useState(initialRegistrarEmail);

  // Step 2: Scheduling & Operating Hours
  const [workingDays, setWorkingDays] = useState<DayOfWeek[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [dayStartTime, setDayStartTime] = useState('09:00');
  const [dayEndTime, setDayEndTime] = useState('17:00');
  const [periodLengthMinutes, setPeriodLengthMinutes] = useState<number>(50);
  const [shortBreakEnabled, setShortBreakEnabled] = useState(true);
  const [shortBreakMinutes, setShortBreakMinutes] = useState<number>(10);
  const [middayBreakEnabled, setMiddayBreakEnabled] = useState(true);
  const [middayBreakStartTime, setMiddayBreakStartTime] = useState('13:00');
  const [middayBreakDurationMinutes, setMiddayBreakDurationMinutes] = useState<number>(60);
  const [labDurationMinutes, setLabDurationMinutes] = useState<number>(180);

  // Step 3: Departments & Programs
  const [departments, setDepartments] = useState<Array<{ name: string; code: string; school: string }>>([
    { name: 'Department of Computer Science', code: 'CS', school: 'School of Technology' },
    { name: 'Department of Electrical Engineering', code: 'EE', school: 'School of Engineering' }
  ]);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');

  // Step 4: Facilities
  const [rooms, setRooms] = useState<Array<{ code: string; capacity: number; type: 'lecture' | 'lab' }>>([
    { code: 'HALL-A', capacity: 60, type: 'lecture' },
    { code: 'HALL-B', capacity: 60, type: 'lecture' },
    { code: 'LAB-01', capacity: 45, type: 'lab' }
  ]);
  const [newRoomCode, setNewRoomCode] = useState('');
  const [newRoomCap, setNewRoomCap] = useState(50);
  const [newRoomType, setNewRoomType] = useState<'lecture' | 'lab'>('lecture');

  // Step 5: Courses & Instructors
  const [courses, setCourses] = useState<Array<{ code: string; title: string; cr: number; isLab: boolean }>>([
    { code: 'CS-101', title: 'Foundations of Computer Systems', cr: 3, isLab: false },
    { code: 'CS-101-L', title: 'Systems Programming Laboratory', cr: 1, isLab: true },
    { code: 'EE-201', title: 'Circuit Analysis & Electronics', cr: 3, isLab: false }
  ]);
  const [instructors, setInstructors] = useState<Array<{ name: string; title: string; email: string }>>([
    { name: 'Dr. Michael Chen', title: 'Professor', email: 'm.chen@university.edu' },
    { name: 'Prof. Sarah Jenkins', title: 'Associate Professor', email: 's.jenkins@university.edu' }
  ]);

  const toggleDay = (day: DayOfWeek) => {
    if (workingDays.includes(day)) {
      if (workingDays.length > 1) {
        setWorkingDays(workingDays.filter(d => d !== day));
      }
    } else {
      setWorkingDays([...workingDays, day]);
    }
  };

  const handleAddDept = () => {
    if (!newDeptName.trim() || !newDeptCode.trim()) return;
    setDepartments([...departments, { name: newDeptName.trim(), code: newDeptCode.trim().toUpperCase(), school: 'Academic Division' }]);
    setNewDeptName('');
    setNewDeptCode('');
  };

  const handleAddRoom = () => {
    if (!newRoomCode.trim()) return;
    setRooms([...rooms, { code: newRoomCode.trim().toUpperCase(), capacity: newRoomCap, type: newRoomType }]);
    setNewRoomCode('');
  };

  const computedPreview = computeAcademicScheduleConfig({
    workingDays,
    dayStartTime,
    dayEndTime,
    periodLengthMinutes,
    shortBreakEnabled,
    shortBreakMinutes,
    middayBreakEnabled,
    middayBreakStartTime,
    middayBreakDurationMinutes,
    labDurationMinutes
  });

  const handleFinalizeOnboarding = () => {
    if (!name.trim() || !code.trim()) {
      setActiveStep(0);
      setOnboardingError('Please provide a university name and acronym code.');
      return;
    }

    setOnboardingError(null);
    setIsSubmitting(true);

    try {
      const newInstId =
        existingInstitutionId ||
        `inst-${code.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;
      const profile: InstitutionProfile = {
        id: newInstId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        campusCode: `${code.toUpperCase()}-MAIN-01`,
        campusName: campusName.trim(),
        accreditation: accreditation.trim(),
        academicYear: academicYear.trim(),
        currentTermName: currentTerm.trim(),
        registrarName: registrarName.trim(),
        registrarEmail: registrarEmail.trim(),
        autoConflictSweep: true,
        defaultSessionMinutes: periodLengthMinutes,
        timezone: 'UTC',
        isSample: false
      };

      const timeConfig: Partial<TimeStructure> = {
        workingDays,
        dayStartTime,
        dayEndTime,
        periodLengthMinutes,
        shortBreakEnabled,
        shortBreakMinutes,
        middayBreakEnabled,
        middayBreakStartTime,
        middayBreakDurationMinutes,
        labDurationMinutes,
        periods: computedPreview.periods
      };

      // 1. Register or update institution in store
      institutionalStore.registerNewInstitution(profile, timeConfig);

      // 2. Populate configured departments, rooms, courses, and instructors
      const current = institutionalStore.get();
      const bldId = current.buildings[0]?.id || 'bld-main';
      const termId = current.terms[0]?.id || 'term-new';

      // Insert custom departments
      departments.forEach((d, i) => {
        institutionalStore.addDepartment({
          id: `dept-${d.code.toLowerCase()}-${i}`,
          code: d.code,
          name: d.name,
          school: d.school,
          colorHex: i === 0 ? '#1E3A8A' : i === 1 ? '#047857' : '#B45309'
        });
      });

      // Refresh state to get added department IDs
      const updatedStore = institutionalStore.get();
      const firstDeptId = updatedStore.departments[0]?.id || 'dept-gen';

      // Insert custom rooms
      rooms.forEach((r, i) => {
        institutionalStore.addRoom({
          id: `room-${r.code.toLowerCase()}-${i}`,
          code: r.code,
          name: `${r.code} (${r.type === 'lab' ? 'Laboratory' : 'Lecture Hall'})`,
          buildingId: bldId,
          capacity: r.capacity,
          type: r.type,
          equipment: r.type === 'lab' ? ['Specialized Workstations', 'Safety System'] : ['Projector', 'Whiteboard'],
          isAccessible: true,
          isAvailable: true
        });
      });

      // Insert custom courses
      courses.forEach((c, i) => {
        institutionalStore.addCourse({
          id: `course-${c.code.toLowerCase()}-${i}`,
          departmentId: firstDeptId,
          code: c.code,
          title: c.title,
          creditHours: c.cr,
          lectureHours: c.isLab ? 0 : 3,
          labHours: c.isLab ? 2 : 0,
          weeklyContactHours: c.isLab ? 2 : 3,
          requiredRoomType: c.isLab ? 'lab' : 'lecture'
        });
      });

      // Insert custom instructors
      instructors.forEach((inst, i) => {
        institutionalStore.addInstructor({
          id: `instructor-${Date.now()}-${i}`,
          departmentId: firstDeptId,
          name: inst.name,
          email: inst.email,
          title: inst.title,
          maxWeeklyHours: 14,
          maxConsecutiveHours: 3,
          preferredDays: workingDays,
          unavailableSlots: []
        });
      });

      // Insert student cohort
      institutionalStore.addStudentGroup({
        id: `group-2k26-${code.toLowerCase()}-a`,
        programId: updatedStore.programs[0]?.id || 'prog-gen',
        name: `${code.toUpperCase()} First Year Cohort A`,
        code: `2K26-${code.toUpperCase()}-A`,
        year: 1,
        size: 40,
        homeRoom: rooms[0]?.code || 'HALL-A',
        sharedCourseIds: []
      });

      // 3. Run solver to generate inaugural conflict-free timetable
      const solverRes = institutionalStore.runTimetableSolver({
        forceRescheduleAll: true,
        strategyName: 'Inaugural University Timetable'
      });

      setIsSubmitting(false);
      onCompleted?.(newInstId);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setOnboardingError(`Setup encountered an error: ${err?.message || err}`);
    }
  };

  const steps = [
    { title: 'Institution Identity', icon: Building2 },
    { title: 'Operating Hours & Rules', icon: Clock },
    { title: 'Departments & Cohorts', icon: Layers },
    { title: 'Facilities & Rooms', icon: DoorOpen },
    { title: 'Curriculum & Faculty', icon: BookOpen },
    { title: 'Verify & Generate', icon: Sparkles }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs">
      {showImportWizard && (
        <DataImportWizard
          onClose={() => setShowImportWizard(false)}
          onSuccess={msg => {
            setShowImportWizard(false);
          }}
        />
      )}

      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-white border border-[#E4E2DA] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-[#F7F6EF] border-b border-[#E4E2DA] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#171717] text-white flex items-center justify-center shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif-editorial text-lg text-[#171717] font-semibold">
                  University Setup & Onboarding Wizard
                </h2>
                <span className="text-[10px] font-mono-tabular font-bold px-2 py-0.5 rounded-full bg-[#B8EEEE] text-[#171717] border border-[#95DFDF]">
                  Multi-University Platform
                </span>
              </div>
              <p className="text-xs text-[#77766F] mt-0.5">
                Configure your institution from scratch with custom academic structure, operating hours, and zero-conflict timetables.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#77766F] hover:text-[#171717] hover:bg-black/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Stepper Bar */}
        <div className="px-6 py-3 bg-white border-b border-[#E4E2DA] overflow-x-auto">
          <div className="flex items-center justify-between min-w-[620px] gap-2">
            {steps.map((st, sIdx) => {
              const Icon = st.icon;
              const isActive = activeStep === sIdx;
              const isPast = activeStep > sIdx;
              return (
                <button
                  key={st.title}
                  type="button"
                  onClick={() => setActiveStep(sIdx)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#171717] text-white font-semibold shadow-xs'
                      : isPast
                      ? 'bg-[#B7F77C]/30 text-[#171717] font-medium border border-[#98DF58]'
                      : 'text-[#77766F] hover:text-[#171717] hover:bg-[#F7F6EF]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{st.title}</span>
                  {isPast && <Check className="w-3 h-3 text-[#2E7D32]" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {onboardingError && (
            <div className="px-3.5 py-2.5 rounded-xl bg-[#FDE8E8] border border-[#F5B5B5] text-[#8B1E1E] text-xs font-medium">
              {onboardingError}
            </div>
          )}

          {/* STEP 0: Institution Identity */}
          {activeStep === 0 && (
            <div className="space-y-5">
              <div>
                <h3 className="font-serif-editorial text-lg text-[#171717] font-semibold">
                  1. Institutional Information & Campus Setup
                </h3>
                <p className="text-xs text-[#77766F] mt-0.5">
                  Enter the official university branding, accreditation status, and current academic calendar.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#171717]">
                    University Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Apex Institute of Science & Technology"
                    className="input-field text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#171717]">
                    University Acronym / Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. AIST, MSU, UEC"
                    className="input-field text-xs font-mono-tabular"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#171717]">
                    Main Campus Name
                  </label>
                  <input
                    type="text"
                    value={campusName}
                    onChange={e => setCampusName(e.target.value)}
                    placeholder="e.g. Downtown Innovation Campus"
                    className="input-field text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#171717]">
                    Accreditation & Certification Details
                  </label>
                  <input
                    type="text"
                    value={accreditation}
                    onChange={e => setAccreditation(e.target.value)}
                    placeholder="e.g. ABET, PEC, NCEAC, AACSB"
                    className="input-field text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#171717]">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    value={academicYear}
                    onChange={e => setAcademicYear(e.target.value)}
                    placeholder="2026–2027"
                    className="input-field text-xs font-mono-tabular"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#171717]">
                    Current Academic Term
                  </label>
                  <input
                    type="text"
                    value={currentTerm}
                    onChange={e => setCurrentTerm(e.target.value)}
                    placeholder="Fall Semester 2026"
                    className="input-field text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#171717]">
                    Registrar / Provost Full Name
                  </label>
                  <input
                    type="text"
                    value={registrarName}
                    onChange={e => setRegistrarName(e.target.value)}
                    placeholder="Dr. Katherine Reynolds"
                    className="input-field text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#171717]">
                    Registrar Email Address
                  </label>
                  <input
                    type="email"
                    value={registrarEmail}
                    onChange={e => setRegistrarEmail(e.target.value)}
                    placeholder="registrar@university.edu"
                    className="input-field text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 1: Operating Hours & Rules */}
          {activeStep === 1 && (
            <div className="space-y-5">
              <div>
                <h3 className="font-serif-editorial text-lg text-[#171717] font-semibold">
                  2. University Operating Hours, Lecture & Break Durations
                </h3>
                <p className="text-xs text-[#77766F] mt-0.5">
                  SmartGrid AI does not assume 9–5 or 50m classes. Define your exact university timings below.
                </p>
              </div>

              {/* Working Days Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#171717]">
                  Academic Working Days
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as DayOfWeek[]).map(d => {
                    const active = workingDays.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(d)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-mono-tabular transition-colors cursor-pointer border ${
                          active
                            ? 'bg-[#171717] text-white border-[#171717] font-bold'
                            : 'bg-[#F7F6EF] text-[#77766F] border-[#E4E2DA] hover:text-[#171717]'
                        }`}
                      >
                        {d} {active && '✓'}
                      </button>
                    );
                  })}
                </div>
                <div className="text-[11px] text-[#77766F]">
                  Selected: <strong>{workingDays.length} working days per week</strong> (e.g., 5-day Mon–Fri or 6-day Mon–Sat)
                </div>
              </div>

              {/* Operating Hours */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#171717]">
                    Campus Opening Time (HH:MM)
                  </label>
                  <input
                    type="time"
                    value={dayStartTime}
                    onChange={e => setDayStartTime(e.target.value)}
                    className="input-field text-xs font-mono-tabular"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#171717]">
                    Campus Closing Time (HH:MM)
                  </label>
                  <input
                    type="time"
                    value={dayEndTime}
                    onChange={e => setDayEndTime(e.target.value)}
                    className="input-field text-xs font-mono-tabular"
                  />
                </div>
              </div>

              {/* Lecture & Break Durations */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#171717]">
                    Regular Class Duration
                  </label>
                  <select
                    value={periodLengthMinutes}
                    onChange={e => setPeriodLengthMinutes(Number(e.target.value))}
                    className="input-field text-xs bg-white"
                  >
                    <option value={45}>45 Minutes</option>
                    <option value={50}>50 Minutes (Standard)</option>
                    <option value={60}>60 Minutes (1 Hour)</option>
                    <option value={75}>75 Minutes (1h 15m)</option>
                    <option value={90}>90 Minutes (1h 30m)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#171717]">
                    Short Break Between Classes
                  </label>
                  <select
                    value={shortBreakMinutes}
                    onChange={e => setShortBreakMinutes(Number(e.target.value))}
                    className="input-field text-xs bg-white"
                  >
                    <option value={0}>0 Mins (Back-to-Back)</option>
                    <option value={5}>5 Minutes</option>
                    <option value={10}>10 Minutes (Standard)</option>
                    <option value={15}>15 Minutes</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#171717]">
                    Continuous Laboratory Duration
                  </label>
                  <select
                    value={labDurationMinutes}
                    onChange={e => setLabDurationMinutes(Number(e.target.value))}
                    className="input-field text-xs bg-white"
                  >
                    <option value={120}>2 Hours (120 Minutes)</option>
                    <option value={180}>3 Hours (180 Minutes)</option>
                    <option value={240}>4 Hours (240 Minutes)</option>
                  </select>
                </div>
              </div>

              {/* Midday Lunch Break */}
              <div className="p-4 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF]/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-[#171717]">
                      University Midday Lunch & Rest Break
                    </div>
                    <div className="text-[11px] text-[#77766F]">
                      Protected university-wide window free of lectures or continuous labs
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={middayBreakEnabled}
                    onChange={e => setMiddayBreakEnabled(e.target.checked)}
                    className="w-4 h-4 accent-[#171717]"
                  />
                </div>

                {middayBreakEnabled && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#E4E2DA]">
                    <div className="space-y-1">
                      <label className="text-[11px] text-[#77766F]">Lunch Start Time</label>
                      <input
                        type="time"
                        value={middayBreakStartTime}
                        onChange={e => setMiddayBreakStartTime(e.target.value)}
                        className="input-field h-8 text-xs font-mono-tabular bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-[#77766F]">Duration (Minutes)</label>
                      <select
                        value={middayBreakDurationMinutes}
                        onChange={e => setMiddayBreakDurationMinutes(Number(e.target.value))}
                        className="input-field h-8 text-xs bg-white"
                      >
                        <option value={30}>30 Minutes</option>
                        <option value={45}>45 Minutes</option>
                        <option value={60}>60 Minutes (1 Hour)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic Calculation Preview */}
              <div className="p-3 rounded-xl bg-[#B7F77C]/25 border border-[#98DF58] text-xs text-[#171717] flex items-center justify-between">
                <div>
                  <span className="font-semibold">Calculated Schedule Grid:</span> {computedPreview.slots.length} daily lecture slots ({computedPreview.periodLengthMinutes}m each) · {computedPreview.continuousLabBlocks.length} uninterrupted continuous lab windows ({computedPreview.labDurationHoursLabel}).
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Departments & Cohorts */}
          {activeStep === 2 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif-editorial text-lg text-[#171717] font-semibold">
                    3. Academic Structure & Departments
                  </h3>
                  <p className="text-xs text-[#77766F] mt-0.5">
                    Define faculties, degree programs, and initial student cohorts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowImportWizard(true)}
                  className="btn-secondary h-8 px-3 text-xs inline-flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Bulk Import via CSV</span>
                </button>
              </div>

              {/* Department List */}
              <div className="space-y-2">
                {departments.map((d, i) => (
                  <div
                    key={d.code}
                    className="p-3 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF]/40 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-md bg-[#171717] text-white text-[10px] font-mono-tabular font-bold flex items-center justify-center">
                        {d.code}
                      </span>
                      <div>
                        <div className="text-xs font-semibold text-[#171717]">{d.name}</div>
                        <div className="text-[11px] text-[#77766F]">{d.school}</div>
                      </div>
                    </div>
                    {departments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setDepartments(departments.filter((_, idx) => idx !== i))}
                        className="text-[#77766F] hover:text-red-600 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add New Department Form */}
              <div className="p-3 rounded-xl border border-[#E4E2DA] bg-white flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Department Name (e.g. Mechanical Engineering)"
                  value={newDeptName}
                  onChange={e => setNewDeptName(e.target.value)}
                  className="input-field text-xs flex-1 min-w-[200px]"
                />
                <input
                  type="text"
                  placeholder="Code (ME)"
                  value={newDeptCode}
                  onChange={e => setNewDeptCode(e.target.value)}
                  className="input-field text-xs w-24 font-mono-tabular"
                />
                <button
                  type="button"
                  onClick={handleAddDept}
                  disabled={!newDeptName.trim() || !newDeptCode.trim()}
                  className="btn-primary h-9 px-3 text-xs inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Department</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Facilities & Rooms */}
          {activeStep === 3 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif-editorial text-lg text-[#171717] font-semibold">
                    4. Campus Classrooms & Laboratories
                  </h3>
                  <p className="text-xs text-[#77766F] mt-0.5">
                    Define lecture halls, seminar rooms, and continuous lab facilities with seating capacities.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowImportWizard(true)}
                  className="btn-secondary h-8 px-3 text-xs inline-flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Bulk Import Facilities</span>
                </button>
              </div>

              {/* Room Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {rooms.map((r, i) => (
                  <div
                    key={r.code}
                    className="p-3 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF]/50 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-mono-tabular font-bold text-[#171717]">{r.code}</div>
                      <div className="text-[11px] text-[#77766F]">
                        {r.type === 'lab' ? 'Laboratory' : 'Lecture Hall'} · {r.capacity} Seats
                      </div>
                    </div>
                    {rooms.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setRooms(rooms.filter((_, idx) => idx !== i))}
                        className="text-[#77766F] hover:text-red-600 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Quick Add Room */}
              <div className="p-3 rounded-xl border border-[#E4E2DA] bg-white flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Room Code (e.g. HALL-101)"
                  value={newRoomCode}
                  onChange={e => setNewRoomCode(e.target.value)}
                  className="input-field text-xs font-mono-tabular flex-1 min-w-[140px]"
                />
                <input
                  type="number"
                  placeholder="Seats"
                  value={newRoomCap}
                  onChange={e => setNewRoomCap(Number(e.target.value))}
                  className="input-field text-xs w-20 font-mono-tabular"
                />
                <select
                  value={newRoomType}
                  onChange={e => setNewRoomType(e.target.value as any)}
                  className="input-field text-xs w-28 bg-white"
                >
                  <option value="lecture">Lecture Hall</option>
                  <option value="lab">Laboratory</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddRoom}
                  disabled={!newRoomCode.trim()}
                  className="btn-primary h-9 px-3 text-xs inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Room</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Curriculum & Faculty */}
          {activeStep === 4 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif-editorial text-lg text-[#171717] font-semibold">
                    5. Academic Catalog & Faculty Roster
                  </h3>
                  <p className="text-xs text-[#77766F] mt-0.5">
                    Configure courses, credit hours, and professors available for scheduling.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowImportWizard(true)}
                  className="btn-secondary h-8 px-3 text-xs inline-flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Bulk Import via CSV</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Courses Column */}
                <div className="space-y-2 border border-[#E4E2DA] p-3 rounded-xl bg-[#F7F6EF]/30">
                  <div className="text-xs font-semibold text-[#171717]">Initial Course Catalog</div>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {courses.map(c => (
                      <div key={c.code} className="p-2 rounded-lg bg-white border border-[#E4E2DA] flex items-center justify-between text-xs">
                        <div>
                          <div className="font-mono-tabular font-bold text-[#171717]">{c.code}</div>
                          <div className="text-[11px] text-[#77766F] truncate">{c.title}</div>
                        </div>
                        <span className="text-[10px] font-mono-tabular px-1.5 py-0.5 rounded bg-[#F7F6EF]">
                          {c.isLab ? 'Lab' : `${c.cr} Cr`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Faculty Column */}
                <div className="space-y-2 border border-[#E4E2DA] p-3 rounded-xl bg-[#F7F6EF]/30">
                  <div className="text-xs font-semibold text-[#171717]">Initial Faculty Roster</div>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {instructors.map(inst => (
                      <div key={inst.email} className="p-2 rounded-lg bg-white border border-[#E4E2DA] flex items-center justify-between text-xs">
                        <div>
                          <div className="font-semibold text-[#171717]">{inst.name}</div>
                          <div className="text-[11px] text-[#77766F] truncate">{inst.email}</div>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#B8EEEE]/40 text-[#171717]">
                          {inst.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Verify & Generate */}
          {activeStep === 5 && (
            <div className="space-y-6 text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-[#171717] text-white flex items-center justify-center mx-auto shadow-md">
                <Sparkles className="w-7 h-7 text-[#B7F77C]" />
              </div>

              <div>
                <h3 className="font-serif-editorial text-2xl text-[#171717]">
                  Ready to Launch {name || 'New University'}
                </h3>
                <p className="text-xs text-[#77766F] max-w-md mx-auto mt-1">
                  All institutional parameters, working hours, facilities, and initial curriculum items have been validated.
                </p>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto text-left">
                <div className="p-3 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF]">
                  <div className="text-[10.5px] text-[#77766F]">Working Days</div>
                  <div className="font-mono-tabular font-bold text-xs text-[#171717] mt-0.5">
                    {workingDays.length} Days/Wk
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF]">
                  <div className="text-[10.5px] text-[#77766F]">Lecture Duration</div>
                  <div className="font-mono-tabular font-bold text-xs text-[#171717] mt-0.5">
                    {periodLengthMinutes} Mins
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF]">
                  <div className="text-[10.5px] text-[#77766F]">Continuous Lab</div>
                  <div className="font-mono-tabular font-bold text-xs text-[#171717] mt-0.5">
                    {labDurationMinutes / 60}h Continuous
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF]">
                  <div className="text-[10.5px] text-[#77766F]">Facilities Ready</div>
                  <div className="font-mono-tabular font-bold text-xs text-[#171717] mt-0.5">
                    {rooms.length} Rooms & Labs
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#B7F77C]/30 border border-[#98DF58] text-xs text-[#171717] max-w-md mx-auto text-left flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#2E7D32] shrink-0 mt-0.5" />
                <div>
                  <strong>Configuration-Driven Synthesis:</strong> SmartGrid AI will generate the inaugural weekly timetable without classroom or faculty collisions, strictly respecting your university's operating hours and break windows.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 bg-[#F7F6EF] border-t border-[#E4E2DA] flex items-center justify-between">
          <button
            type="button"
            disabled={activeStep === 0}
            onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
            className="btn-secondary h-9 px-4 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Previous Step</span>
          </button>

          <div className="flex items-center gap-2">
            {activeStep < steps.length - 1 ? (
              <button
                type="button"
                onClick={() => {
                  if (activeStep === 0 && (!name.trim() || !code.trim())) {
                    setOnboardingError('Please enter a university name and acronym code to continue.');
                    return;
                  }
                  setOnboardingError(null);
                  setActiveStep(activeStep + 1);
                }}
                className="btn-primary h-9 px-5 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinalizeOnboarding}
                className="btn-primary h-10 px-6 text-xs font-bold inline-flex items-center gap-2 shadow-xs"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isSubmitting ? 'Synthesizing...' : 'Finalize & Generate Timetable'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
