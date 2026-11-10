import React, { useState, useEffect } from 'react';
import { RouteType } from './SmartGridNav';
import { useInstitutionalData, institutionalStore } from '../data/store';
import {
  DayOfWeek,
  TimetableManagementPolicy,
  DEFAULT_ACADEMIC_TIMING_CONFIG,
  computeAcademicScheduleConfig,
  validateAcademicTimingConfig,
  isUserAdminRole
} from '../types/institutional';
import {
  RotateCcw,
  Check,
  ArrowRight,
  Clock,
  Coffee,
  FlaskConical,
  Calendar,
  BookOpen,
  AlertCircle,
  Lock,
  Sparkles,
  Sliders,
  ShieldCheck,
  Upload,
  Plus,
  Trash2,
  Building2,
  Layers
} from 'lucide-react';
import { DataImportWizard } from './DataImportWizard';
import { UniversityOnboardingModal } from './UniversityOnboardingModal';

interface AcademicConfigurationPageProps {
  onNavigate: (route: RouteType) => void;
  currentUser?: {
    name: string;
    role: string;
    email: string;
    institution?: string;
  } | null;
  onSwitchUser?: (user: {
    name: string;
    role: string;
    email: string;
    institution?: string;
  }) => void;
}

const ALL_WEEK_DAYS: Array<{ code: DayOfWeek; label: string }> = [
  { code: 'Mon', label: 'Monday' },
  { code: 'Tue', label: 'Tuesday' },
  { code: 'Wed', label: 'Wednesday' },
  { code: 'Thu', label: 'Thursday' },
  { code: 'Fri', label: 'Friday' },
  { code: 'Sat', label: 'Saturday' },
  { code: 'Sun', label: 'Sunday' }
];

export const AcademicConfigurationPage: React.FC<AcademicConfigurationPageProps> = ({
  onNavigate,
  currentUser,
  onSwitchUser
}) => {
  const store = useInstitutionalData();
  const profile = store.institutionProfile;
  const ts = store.timeStructure;
  const institutionName = profile?.name || currentUser?.institution || 'University of Engineering & Computing';

  const isAdmin = isUserAdminRole(currentUser?.role || 'Registrar');

  // --- Academic Configuration Form State ---
  const [dayStartTime, setDayStartTime] = useState<string>(
    ts.dayStartTime || DEFAULT_ACADEMIC_TIMING_CONFIG.dayStartTime
  );
  const [dayEndTime, setDayEndTime] = useState<string>(
    ts.dayEndTime || DEFAULT_ACADEMIC_TIMING_CONFIG.dayEndTime
  );
  const [workingDays, setWorkingDays] = useState<DayOfWeek[]>(
    ts.workingDays?.length ? ts.workingDays : DEFAULT_ACADEMIC_TIMING_CONFIG.workingDays
  );
  const [fridayAfternoonShiftEnabled, setFridayAfternoonShiftEnabled] = useState<boolean>(
    ts.fridayAfternoonShiftEnabled ?? DEFAULT_ACADEMIC_TIMING_CONFIG.fridayAfternoonShiftEnabled
  );
  const [fridayAfternoonStartTime, setFridayAfternoonStartTime] = useState<string>(
    ts.fridayAfternoonStartTime || DEFAULT_ACADEMIC_TIMING_CONFIG.fridayAfternoonStartTime
  );

  const [periodLengthMinutes, setPeriodLengthMinutes] = useState<number>(
    ts.periodLengthMinutes || DEFAULT_ACADEMIC_TIMING_CONFIG.periodLengthMinutes
  );

  const [shortBreakEnabled, setShortBreakEnabled] = useState<boolean>(
    ts.shortBreakEnabled ?? DEFAULT_ACADEMIC_TIMING_CONFIG.shortBreakEnabled
  );
  const [shortBreakMinutes, setShortBreakMinutes] = useState<number>(
    ts.shortBreakMinutes ?? DEFAULT_ACADEMIC_TIMING_CONFIG.shortBreakMinutes
  );
  const [includeBreakAfterLastSlot, setIncludeBreakAfterLastSlot] = useState<boolean>(
    ts.includeBreakAfterLastSlot ?? DEFAULT_ACADEMIC_TIMING_CONFIG.includeBreakAfterLastSlot
  );

  const [middayBreakEnabled, setMiddayBreakEnabled] = useState<boolean>(
    ts.middayBreakEnabled ?? DEFAULT_ACADEMIC_TIMING_CONFIG.middayBreakEnabled
  );
  const [middayBreakMode, setMiddayBreakMode] = useState<'fixed' | 'auto'>(
    ts.middayBreakMode || DEFAULT_ACADEMIC_TIMING_CONFIG.middayBreakMode
  );
  const [middayBreakStartTime, setMiddayBreakStartTime] = useState<string>(
    ts.middayBreakStartTime || DEFAULT_ACADEMIC_TIMING_CONFIG.middayBreakStartTime
  );
  const [middayBreakDurationMinutes, setMiddayBreakDurationMinutes] = useState<number>(
    ts.middayBreakDurationMinutes ?? DEFAULT_ACADEMIC_TIMING_CONFIG.middayBreakDurationMinutes
  );

  const [labDurationMinutes, setLabDurationMinutes] = useState<number>(
    ts.labDurationMinutes ?? DEFAULT_ACADEMIC_TIMING_CONFIG.labDurationMinutes
  );

  const [timingValidationErrors, setTimingValidationErrors] = useState<string[]>([]);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [showSlotTimeline, setShowSlotTimeline] = useState<boolean>(false);
  const [showImportWizard, setShowImportWizard] = useState<boolean>(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState<boolean>(false);

  // Academic Calendar Add Semester State
  const [newSemName, setNewSemName] = useState('');
  const [newSemCode, setNewSemCode] = useState('');
  const [newSemYear, setNewSemYear] = useState(profile?.academicYear || '2026–2027');
  const [newSemStart, setNewSemStart] = useState('2026-09-01');
  const [newSemEnd, setNewSemEnd] = useState('2026-12-20');
  const [newSemWeeks, setNewSemWeeks] = useState<number>(16);
  const [newSemActive, setNewSemActive] = useState<boolean>(true);

  const currentPolicy: TimetableManagementPolicy =
    profile?.timetableManagementPolicy || 'whole_university';
  const activeTermsList = store.terms.filter(t => t.status === 'active');

  const handleAddSemester = () => {
    if (!isAdmin || !newSemName.trim() || !newSemCode.trim()) return;
    institutionalStore.addTerm({
      id: `term-custom-${Date.now().toString(36)}`,
      name: newSemName.trim(),
      code: newSemCode.trim().toUpperCase(),
      academicYear: newSemYear.trim() || profile?.academicYear || '2026–2027',
      startDate: newSemStart || '2026-09-01',
      endDate: newSemEnd || '2026-12-20',
      status: newSemActive ? 'active' : 'draft',
      weeksCount: Math.max(1, Number(newSemWeeks) || 16)
    });
    showToast(`Added academic semester "${newSemName.trim()}" (${newSemCode.trim().toUpperCase()}).`);
    setNewSemName('');
    setNewSemCode('');
  };

  // Sync local state when saved timeStructure updates or resets
  useEffect(() => {
    setDayStartTime(ts.dayStartTime || DEFAULT_ACADEMIC_TIMING_CONFIG.dayStartTime);
    setDayEndTime(ts.dayEndTime || DEFAULT_ACADEMIC_TIMING_CONFIG.dayEndTime);
    setWorkingDays(
      ts.workingDays?.length ? ts.workingDays : DEFAULT_ACADEMIC_TIMING_CONFIG.workingDays
    );
    setFridayAfternoonShiftEnabled(
      ts.fridayAfternoonShiftEnabled ?? DEFAULT_ACADEMIC_TIMING_CONFIG.fridayAfternoonShiftEnabled
    );
    setFridayAfternoonStartTime(
      ts.fridayAfternoonStartTime || DEFAULT_ACADEMIC_TIMING_CONFIG.fridayAfternoonStartTime
    );
    setPeriodLengthMinutes(
      ts.periodLengthMinutes || DEFAULT_ACADEMIC_TIMING_CONFIG.periodLengthMinutes
    );
    setShortBreakEnabled(
      ts.shortBreakEnabled ?? DEFAULT_ACADEMIC_TIMING_CONFIG.shortBreakEnabled
    );
    setShortBreakMinutes(
      ts.shortBreakMinutes ?? DEFAULT_ACADEMIC_TIMING_CONFIG.shortBreakMinutes
    );
    setIncludeBreakAfterLastSlot(
      ts.includeBreakAfterLastSlot ?? DEFAULT_ACADEMIC_TIMING_CONFIG.includeBreakAfterLastSlot
    );
    setMiddayBreakEnabled(
      ts.middayBreakEnabled ?? DEFAULT_ACADEMIC_TIMING_CONFIG.middayBreakEnabled
    );
    setMiddayBreakMode(ts.middayBreakMode || DEFAULT_ACADEMIC_TIMING_CONFIG.middayBreakMode);
    setMiddayBreakStartTime(
      ts.middayBreakStartTime || DEFAULT_ACADEMIC_TIMING_CONFIG.middayBreakStartTime
    );
    setMiddayBreakDurationMinutes(
      ts.middayBreakDurationMinutes ?? DEFAULT_ACADEMIC_TIMING_CONFIG.middayBreakDurationMinutes
    );
    setLabDurationMinutes(
      ts.labDurationMinutes ?? DEFAULT_ACADEMIC_TIMING_CONFIG.labDurationMinutes
    );
  }, [ts]);

  const showToast = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(null), 5500);
  };

  // Draft timing configuration for real-time slot calculation & validation
  const draftTimingConfig = {
    workingDays,
    dayStartTime,
    dayEndTime,
    fridayAfternoonShiftEnabled,
    fridayAfternoonStartTime,
    periodLengthMinutes,
    shortBreakEnabled,
    shortBreakMinutes: shortBreakEnabled ? shortBreakMinutes : 0,
    includeBreakAfterLastSlot,
    middayBreakEnabled,
    middayBreakMode,
    middayBreakStartTime,
    middayBreakDurationMinutes,
    labDurationMinutes
  };

  const liveValidation = validateAcademicTimingConfig(draftTimingConfig);
  const livePreview = computeAcademicScheduleConfig(draftTimingConfig);

  const handleToggleWorkingDay = (day: DayOfWeek) => {
    if (!isAdmin) return;
    setTimingValidationErrors([]);
    setWorkingDays(prev => {
      if (prev.includes(day)) {
        return prev.filter(d => d !== day);
      }
      const order: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return [...prev, day].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    });
  };

  const handleSaveConfiguration = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isAdmin) return;

    const result = institutionalStore.saveAcademicTimingConfig(draftTimingConfig);
    if (!result.success) {
      setTimingValidationErrors(result.errors);
      return;
    }

    setTimingValidationErrors([]);
    showToast(
      `Saved Academic Configuration (${result.summaryText}). Recalculated ${livePreview.slots.length} daily slots and re-synchronized ${result.placedCount} scheduled sessions across all class timetables.`
    );
  };

  const handleResetToDefaults = () => {
    if (!isAdmin) return;
    setTimingValidationErrors([]);
    const res = institutionalStore.resetAcademicTimingConfig();
    showToast(
      `Reset Academic Configuration to defaults (${res.summaryText}) and re-synchronized ${res.placedCount} scheduled sessions.`
    );
  };

  const applyTimingPreset = (preset: {
    label: string;
    dayStartTime: string;
    dayEndTime: string;
    periodLengthMinutes: number;
    shortBreakEnabled: boolean;
    shortBreakMinutes: number;
    middayBreakEnabled: boolean;
    middayBreakMode: 'fixed' | 'auto';
    middayBreakStartTime: string;
    middayBreakDurationMinutes: number;
    labDurationMinutes: number;
  }) => {
    if (!isAdmin) return;
    setTimingValidationErrors([]);
    setDayStartTime(preset.dayStartTime);
    setDayEndTime(preset.dayEndTime);
    setPeriodLengthMinutes(preset.periodLengthMinutes);
    setShortBreakEnabled(preset.shortBreakEnabled);
    setShortBreakMinutes(preset.shortBreakMinutes);
    setMiddayBreakEnabled(preset.middayBreakEnabled);
    setMiddayBreakMode(preset.middayBreakMode);
    setMiddayBreakStartTime(preset.middayBreakStartTime);
    setMiddayBreakDurationMinutes(preset.middayBreakDurationMinutes);
    setLabDurationMinutes(preset.labDurationMinutes);
  };

  const labHoursEquivalent = (labDurationMinutes / 60).toFixed(
    labDurationMinutes % 60 === 0 ? 0 : 1
  );

  // Administrator-Only Access Gate for Non-Admin Personas
  if (!isAdmin) {
    return (
      <div className="space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#E4E2DA]">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-[#77766F]">
              <span>Academic Administration</span>
              <span>·</span>
              <span>{institutionName}</span>
            </div>
            <h1 className="font-serif-editorial text-3xl sm:text-4xl text-[#171717] tracking-tight">
              Academic Configuration
            </h1>
            <p className="text-sm text-[#77766F] max-w-2xl">
              University-wide operating hours, lecture durations, break rules, and laboratory session timing.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('timetables')}
            className="btn-secondary text-xs h-10 px-4"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Back to My Timetable</span>
          </button>
        </header>

        <div className="sf-card-white p-8 max-w-2xl space-y-5">
          <div className="w-11 h-11 rounded-2xl bg-[#F2D8FA] border border-[#DFB9EC] flex items-center justify-center text-[#171717]">
            <Lock className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h2 className="font-serif-editorial text-2xl text-[#171717]">
              Administrator Access Required
            </h2>
            <p className="text-xs sm:text-sm text-[#77766F] leading-relaxed">
              You are currently signed in as <strong className="text-[#171717]">{currentUser?.name}</strong> ({currentUser?.role}). Only authorized university administrators (<strong className="text-[#171717]">Registrar</strong> or <strong className="text-[#171717]">Admin</strong>) can access and modify the university’s Academic Configuration.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-1.5 text-xs">
            <div className="font-semibold text-[#171717]">Current Saved Academic Structure:</div>
            <div className="font-mono-tabular text-[#77766F]">{livePreview.summaryText}</div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {onSwitchUser && (
              <button
                type="button"
                onClick={() =>
                  onSwitchUser({
                    name: 'Dr. Katherine Reynolds',
                    role: 'Registrar',
                    email: 'k.reynolds@westernpoly.edu',
                    institution: institutionName
                  })
                }
                className="btn-primary text-xs h-10 px-4"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Switch to Registrar (Administrator)</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="btn-secondary text-xs h-10 px-4"
            >
              <span>Return to Dashboard</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* =========================================================
          1. PAGE HEADER & PRIMARY SAVE / RESET ACTIONS
         ========================================================= */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[#E4E2DA]">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#77766F]">
            <span>Academic Administration</span>
            <span>·</span>
            <span>{institutionName}</span>
            <span>·</span>
            <span className="px-2 py-0.5 rounded font-semibold bg-[#B7F77C] text-[#171717]">
              Administrator ({currentUser?.role || 'Registrar'})
            </span>
          </div>
          <h1 className="font-serif-editorial text-3xl sm:text-4xl text-[#171717] tracking-tight">
            Academic Configuration
          </h1>
          <p className="text-sm text-[#77766F] max-w-2xl">
            Configure the university’s general academic timing structure once. Whenever a timetable is generated, validated, viewed, or exported to Google Sheets, the scheduling engine automatically uses this saved configuration.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowOnboardingModal(true)}
            className="btn-secondary text-xs h-10 px-4"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Multi-Step Setup Wizard</span>
          </button>

          <button
            type="button"
            onClick={() => setShowImportWizard(true)}
            className="btn-secondary text-xs h-10 px-4"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV Dataset</span>
          </button>

          <button
            type="button"
            onClick={handleResetToDefaults}
            className="btn-secondary text-xs h-10 px-4"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Defaults</span>
          </button>

          <button
            type="button"
            disabled={!liveValidation.valid}
            onClick={() => handleSaveConfiguration()}
            className="btn-primary text-xs h-10 px-5 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Save Configuration</span>
          </button>
        </div>
      </header>

      {/* Toast Notification Banner */}
      {statusNotice && (
        <div className="p-4 sf-pastel-lime rounded-2xl text-xs font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Check className="w-4 h-4 text-[#171717] shrink-0" />
            <span className="text-[#171717] font-semibold">{statusNotice}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('generate')}
              className="px-3 py-1.5 rounded-lg bg-white border border-[#171717]/20 text-[#171717] text-xs font-semibold cursor-pointer"
            >
              Generate Schedule
            </button>
            <button
              type="button"
              onClick={() => onNavigate('timetables')}
              className="px-3 py-1.5 rounded-lg bg-[#171717] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>Inspect Timetables</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Validation Error Banner */}
      {(timingValidationErrors.length > 0 || !liveValidation.valid) && (
        <div className="p-5 rounded-2xl bg-[#FDE8E8] border border-[#F5B7B7] space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#8A1C1C]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Scheduling Configuration Conflict — Please adjust the parameters below:</span>
          </div>
          <ul className="list-disc list-inside text-xs text-[#8A1C1C] space-y-1">
            {(timingValidationErrors.length > 0 ? timingValidationErrors : liveValidation.errors).map(
              (err, i) => (
                <li key={i}>{err}</li>
              )
            )}
          </ul>
        </div>
      )}

      {/* Active Summary & Quick Academic Structure Presets Bar */}
      <div className="sf-card-white p-4 sm:px-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Sliders className="w-4 h-4 text-[#171717]" />
          <span className="font-semibold text-[#171717]">Active Summary:</span>
          <strong className="text-[#171717] font-mono-tabular">{livePreview.summaryText}</strong>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#77766F] mr-1">
            Presets:
          </span>
          {[
            {
              label: 'Standard 9–5 (50m + 10m)',
              dayStartTime: '09:00',
              dayEndTime: '17:00',
              periodLengthMinutes: 50,
              shortBreakEnabled: true,
              shortBreakMinutes: 10,
              middayBreakEnabled: true,
              middayBreakMode: 'fixed' as const,
              middayBreakStartTime: '13:00',
              middayBreakDurationMinutes: 60,
              labDurationMinutes: 180
            },
            {
              label: 'Extended 8:30–5 (60m)',
              dayStartTime: '08:30',
              dayEndTime: '17:00',
              periodLengthMinutes: 60,
              shortBreakEnabled: true,
              shortBreakMinutes: 15,
              middayBreakEnabled: true,
              middayBreakMode: 'fixed' as const,
              middayBreakStartTime: '12:15',
              middayBreakDurationMinutes: 45,
              labDurationMinutes: 135
            },
            {
              label: 'Back-to-Back (No Breaks)',
              dayStartTime: '09:00',
              dayEndTime: '17:00',
              periodLengthMinutes: 60,
              shortBreakEnabled: false,
              shortBreakMinutes: 0,
              middayBreakEnabled: true,
              middayBreakMode: 'fixed' as const,
              middayBreakStartTime: '13:00',
              middayBreakDurationMinutes: 60,
              labDurationMinutes: 180
            },
            {
              label: 'Compact Lab (2h Lab)',
              dayStartTime: '09:00',
              dayEndTime: '17:00',
              periodLengthMinutes: 50,
              shortBreakEnabled: true,
              shortBreakMinutes: 10,
              middayBreakEnabled: true,
              middayBreakMode: 'fixed' as const,
              middayBreakStartTime: '13:00',
              middayBreakDurationMinutes: 60,
              labDurationMinutes: 120
            }
          ].map(preset => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyTimingPreset(preset)}
              className="px-2.5 py-1.5 rounded-lg bg-[#F7F6EF] hover:bg-[#EDEAE0] border border-[#E4E2DA] text-[11px] font-medium text-[#171717] transition-colors cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* =========================================================
          UNIVERSITY ACADEMIC CALENDAR & TIMETABLE MANAGEMENT POLICY
         ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* PANEL A: UNIVERSITY ACADEMIC CALENDAR (MULTI-SEMESTER SUPPORT) */}
        <section className="lg:col-span-7 sf-card-white p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E4E2DA] pb-4">
              <div className="space-y-1">
                <div className="text-[11px] font-mono-tabular font-semibold uppercase tracking-wider text-[#77766F]">
                  University Academic Calendar · Multi-Cohort Semesters
                </div>
                <h2 className="font-serif-editorial text-xl text-[#171717] flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#171717]" />
                  <span>Configured Semesters &amp; Active Periods</span>
                </h2>
                <p className="text-xs text-[#77766F]">
                  Define custom semester names, academic years, and dates. Multiple semesters (e.g., Fall, Spring, Summer) can be active simultaneously for different cohorts.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-[#B7F77C] text-[#171717] font-mono-tabular text-xs font-semibold shrink-0">
                {activeTermsList.length} Active / {store.terms.length} Total
              </span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {store.terms.map(term => {
                const isActive = term.status === 'active';
                return (
                  <div
                    key={term.id}
                    className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 transition-colors ${
                      isActive
                        ? 'bg-[#B7F77C]/20 border-[#98DF58]'
                        : 'bg-[#F7F6EF]/60 border-[#E4E2DA]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <span className="px-2 py-1 rounded-md bg-[#171717] text-white text-[10px] font-mono-tabular font-bold">
                        {term.code}
                      </span>
                      <div>
                        <div className="text-xs font-semibold text-[#171717] flex items-center gap-2 flex-wrap">
                          <span>{term.name}</span>
                          {term.academicYear && (
                            <span className="text-[10.5px] font-mono-tabular text-[#77766F]">
                              ({term.academicYear})
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              isActive
                                ? 'bg-[#171717] text-[#B7F77C]'
                                : 'bg-white text-[#77766F] border border-[#E4E2DA]'
                            }`}
                          >
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#77766F] font-mono-tabular mt-0.5">
                          {term.startDate} → {term.endDate} · {term.weeksCount} weeks
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          institutionalStore.toggleTermActiveStatus(term.id);
                          showToast(
                            `Updated active status for "${term.name}".`
                          );
                        }}
                        className={`h-8 px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-white text-[#171717] border-[#E4E2DA] hover:bg-[#F7F6EF]'
                            : 'bg-[#171717] text-white border-[#171717]'
                        }`}
                      >
                        {isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      {store.terms.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            institutionalStore.deleteTerm(term.id);
                            showToast(`Removed semester "${term.name}".`);
                          }}
                          className="h-8 w-8 rounded-lg border border-[#E4E2DA] bg-white hover:bg-[#FDE8E8] text-[#77766F] hover:text-[#8B1E1E] flex items-center justify-center transition-colors cursor-pointer"
                          title="Delete semester"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add New Semester Form */}
          <div className="p-3.5 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#171717]">
                Add Semester to Academic Calendar
              </span>
              <label className="inline-flex items-center gap-1.5 text-[11px] text-[#57564F] cursor-pointer">
                <input
                  type="checkbox"
                  checked={newSemActive}
                  onChange={e => setNewSemActive(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[#171717]"
                />
                <span>Mark Active Immediately</span>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
              <input
                type="text"
                placeholder="Semester Name (e.g. Spring 2027)"
                value={newSemName}
                onChange={e => setNewSemName(e.target.value)}
                className="input-field h-9 text-xs bg-white sm:col-span-2"
              />
              <input
                type="text"
                placeholder="Code (SPR-27)"
                value={newSemCode}
                onChange={e => setNewSemCode(e.target.value.toUpperCase())}
                className="input-field h-9 text-xs font-mono-tabular uppercase bg-white"
              />
              <input
                type="text"
                placeholder="Academic Yr"
                value={newSemYear}
                onChange={e => setNewSemYear(e.target.value)}
                className="input-field h-9 text-xs font-mono-tabular bg-white"
              />
              <input
                type="date"
                value={newSemStart}
                onChange={e => setNewSemStart(e.target.value)}
                className="input-field h-9 text-xs font-mono-tabular bg-white"
              />
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={newSemEnd}
                  onChange={e => setNewSemEnd(e.target.value)}
                  className="input-field h-9 text-xs font-mono-tabular bg-white flex-1 min-w-0"
                  title="Semester End Date"
                />
                <button
                  type="button"
                  onClick={handleAddSemester}
                  disabled={!newSemName.trim() || !newSemCode.trim()}
                  className="btn-primary h-9 px-3 text-xs shrink-0 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* PANEL B: UNIVERSITY TIMETABLE MANAGEMENT POLICY */}
        <section className="lg:col-span-5 sf-card-white p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-[#E4E2DA] pb-4">
              <div className="space-y-1">
                <div className="text-[11px] font-mono-tabular font-semibold uppercase tracking-wider text-[#77766F]">
                  Institutional Governance · Scheduling Policy
                </div>
                <h2 className="font-serif-editorial text-xl text-[#171717] flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#171717]" />
                  <span>Timetable Management Policy</span>
                </h2>
                <p className="text-xs text-[#77766F]">
                  Configure how timetable generation and resource allocation operate across your university’s departments.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-[#B8EEEE] text-[#171717] font-mono-tabular text-xs font-semibold shrink-0">
                {currentPolicy === 'whole_university' ? 'Whole-University' : 'Department-Wise'}
              </span>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  institutionalStore.setTimetableManagementPolicy('whole_university');
                  showToast('Activated Policy: Whole-University Integrated Timetable Management.');
                }}
                className={`w-full p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                  currentPolicy === 'whole_university'
                    ? 'bg-[#171717] text-white border-[#171717]'
                    : 'bg-[#F7F6EF] text-[#171717] border-[#E4E2DA] hover:bg-[#EDEAE0]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">
                    Policy 1: Whole-University Timetable Management
                  </span>
                  {currentPolicy === 'whole_university' && (
                    <span className="px-2 py-0.5 rounded-full bg-[#B7F77C] text-[#171717] text-[10px] font-bold">
                      Configured Policy
                    </span>
                  )}
                </div>
                <p
                  className={`text-[11px] mt-1.5 leading-relaxed ${
                    currentPolicy === 'whole_university' ? 'text-[#B8EEEE]' : 'text-[#57564F]'
                  }`}
                >
                  All configured departments ({store.departments.length}), semesters, batches, and sections ({store.studentGroups.length}) are scheduled in one integrated operation. Prevents cross-department shared faculty, classroom, and laboratory double-booking while providing both university-wide and department-specific views.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  institutionalStore.setTimetableManagementPolicy('department_wise');
                  showToast('Activated Policy: Department-wise Timetable Management.');
                }}
                className={`w-full p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                  currentPolicy === 'department_wise'
                    ? 'bg-[#171717] text-white border-[#171717]'
                    : 'bg-[#F7F6EF] text-[#171717] border-[#E4E2DA] hover:bg-[#EDEAE0]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">
                    Policy 2: Department-wise Timetable Management
                  </span>
                  {currentPolicy === 'department_wise' && (
                    <span className="px-2 py-0.5 rounded-full bg-[#B7F77C] text-[#171717] text-[10px] font-bold">
                      Configured Policy
                    </span>
                  )}
                </div>
                <p
                  className={`text-[11px] mt-1.5 leading-relaxed ${
                    currentPolicy === 'department_wise' ? 'text-[#B8EEEE]' : 'text-[#57564F]'
                  }`}
                >
                  Each department generates and manages its own timetable using department-specific faculty, classrooms, laboratories, courses, batches, and sections, while university administrators retain a master overview of all departmental schedules.
                </p>
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-[#57564F]">
              <Layers className="w-4 h-4 text-[#171717] shrink-0" />
              <span>
                Hierarchy: <strong className="text-[#171717]">{store.departments.length} Depts</strong> ·{' '}
                <strong className="text-[#171717]">{store.programs.length} Programs</strong> ·{' '}
                <strong className="text-[#171717]">{store.studentGroups.length} Sections</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('generate')}
              className="text-xs font-semibold text-[#171717] underline hover:opacity-80 cursor-pointer shrink-0"
            >
              Open Generator →
            </button>
          </div>
        </section>
      </div>

      {/* =========================================================
          5 SEPARATED CONFIGURATION PANELS
         ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* PANEL 1: UNIVERSITY OPERATING HOURS (6 cols) */}
        <section className="lg:col-span-6 sf-card-white p-6 space-y-5">
          <div className="flex items-start justify-between gap-3 border-b border-[#E4E2DA] pb-4">
            <div className="space-y-1">
              <div className="text-[11px] font-mono-tabular font-semibold uppercase tracking-wider text-[#77766F]">
                Section 01 · Operating Window
              </div>
              <h2 className="font-serif-editorial text-xl text-[#171717] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#171717]" />
                <span>University Operating Hours</span>
              </h2>
              <p className="text-xs text-[#77766F]">
                Define daily opening time, closing time, and active academic working days.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-[#B8EEEE] text-[#171717] font-mono-tabular text-xs font-semibold shrink-0">
              {livePreview.operatingHoursLabel}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Opening Time
              </label>
              <input
                type="time"
                value={dayStartTime}
                onChange={e => {
                  setTimingValidationErrors([]);
                  setDayStartTime(e.target.value);
                }}
                className="input-field h-10 text-xs font-mono-tabular"
              />
              <span className="block text-[11px] text-[#77766F] mt-1">
                First morning lecture or lab starts at this hour.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Closing Time
              </label>
              <input
                type="time"
                value={dayEndTime}
                onChange={e => {
                  setTimingValidationErrors([]);
                  setDayEndTime(e.target.value);
                }}
                className="input-field h-10 text-xs font-mono-tabular"
              />
              <span className="block text-[11px] text-[#77766F] mt-1">
                All lectures and continuous labs must end by this hour.
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#171717]">
                Working Days ({workingDays.length} active days)
              </label>
              <span className="text-[11px] text-[#77766F]">Click to toggle active teaching days</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_WEEK_DAYS.map(day => {
                const active = workingDays.includes(day.code);
                return (
                  <button
                    key={day.code}
                    type="button"
                    onClick={() => handleToggleWorkingDay(day.code)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#171717] text-white border-[#171717]'
                        : 'bg-[#F7F6EF] text-[#77766F] border-[#E4E2DA] hover:text-[#171717]'
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Friday Afternoon Operating Shift */}
          <div className="p-4 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-[#171717]">
                  Friday Afternoon Operating Shift (Jummah Buffer)
                </div>
                <div className="text-[11px] text-[#77766F]">
                  Optional daily difference for Friday afternoon sessions.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFridayAfternoonShiftEnabled(!fridayAfternoonShiftEnabled)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                  fridayAfternoonShiftEnabled ? 'bg-[#171717]' : 'bg-[#D6D3C9]'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full transition-transform ${
                    fridayAfternoonShiftEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {fridayAfternoonShiftEnabled && (
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#E4E2DA]">
                <span className="text-xs text-[#171717] font-medium">
                  Friday Afternoon Start Time:
                </span>
                <input
                  type="time"
                  value={fridayAfternoonStartTime}
                  onChange={e => setFridayAfternoonStartTime(e.target.value)}
                  className="input-field h-9 w-36 text-xs font-mono-tabular"
                />
              </div>
            )}
          </div>
        </section>

        {/* PANEL 2: REGULAR CLASS DURATION & PANEL 3: BREAK BETWEEN CLASSES (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* PANEL 2: REGULAR CLASS DURATION */}
          <section className="sf-card-white p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-[#E4E2DA] pb-3.5">
              <div className="space-y-1">
                <div className="text-[11px] font-mono-tabular font-semibold uppercase tracking-wider text-[#77766F]">
                  Section 02 · Lecture Slot Length
                </div>
                <h2 className="font-serif-editorial text-xl text-[#171717] flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#171717]" />
                  <span>Regular Class Duration</span>
                </h2>
                <p className="text-xs text-[#77766F]">
                  Configure the duration of each standard lecture session in minutes.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-[#B8F2E6] text-[#171717] font-mono-tabular text-xs font-semibold shrink-0">
                {periodLengthMinutes} minutes
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
              <div className="sm:col-span-5">
                <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                  Lecture Duration
                </label>
                <div className="input-group-field h-10 px-3 gap-2">
                  <input
                    type="number"
                    min={20}
                    max={240}
                    step={5}
                    value={periodLengthMinutes}
                    onChange={e => {
                      setTimingValidationErrors([]);
                      setPeriodLengthMinutes(Math.max(1, parseInt(e.target.value, 10) || 50));
                    }}
                    className="text-xs font-mono-tabular font-semibold"
                  />
                  <span className="text-[11px] font-mono-tabular text-[#77766F] shrink-0">
                    minutes
                  </span>
                </div>
              </div>

              <div className="sm:col-span-7 space-y-1.5">
                <span className="block text-[11px] font-medium text-[#77766F]">
                  Standard Lecture Durations:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[45, 50, 60, 75, 90].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        setTimingValidationErrors([]);
                        setPeriodLengthMinutes(mins);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-mono-tabular transition-colors cursor-pointer ${
                        periodLengthMinutes === mins
                          ? 'bg-[#171717] text-white font-semibold'
                          : 'bg-[#F7F6EF] hover:bg-[#EDEAE0] text-[#171717] border border-[#E4E2DA]'
                      }`}
                    >
                      {mins} min
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* PANEL 3: BREAK BETWEEN CLASSES */}
          <section className="sf-card-white p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-[#E4E2DA] pb-3.5">
              <div className="space-y-1">
                <div className="text-[11px] font-mono-tabular font-semibold uppercase tracking-wider text-[#77766F]">
                  Section 03 · Inter-Class Transition
                </div>
                <h2 className="font-serif-editorial text-xl text-[#171717]">
                  Break Between Classes
                </h2>
                <p className="text-xs text-[#77766F]">
                  Enable or disable short breaks between consecutive classes and configure break duration in minutes.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setTimingValidationErrors([]);
                  setShortBreakEnabled(!shortBreakEnabled);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-colors cursor-pointer shrink-0 ${
                  shortBreakEnabled
                    ? 'bg-[#B7F77C] border-[#98DF58] text-[#171717]'
                    : 'bg-[#F7F6EF] border-[#E4E2DA] text-[#77766F]'
                }`}
              >
                <span>Breaks: {shortBreakEnabled ? 'Enabled (ON)' : 'Disabled (OFF)'}</span>
              </button>
            </div>

            {shortBreakEnabled ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                  <div className="sm:col-span-5">
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                      Break Duration
                    </label>
                    <div className="input-group-field h-10 px-3 gap-2">
                      <input
                        type="number"
                        min={0}
                        max={60}
                        step={5}
                        value={shortBreakMinutes}
                        onChange={e => {
                          setTimingValidationErrors([]);
                          setShortBreakMinutes(Math.max(0, parseInt(e.target.value, 10) || 0));
                        }}
                        className="text-xs font-mono-tabular font-semibold"
                      />
                      <span className="text-[11px] font-mono-tabular text-[#77766F] shrink-0">
                        minutes
                      </span>
                    </div>
                  </div>

                  <div className="sm:col-span-7 space-y-1.5">
                    <span className="block text-[11px] font-medium text-[#77766F]">
                      Quick Break Durations:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[5, 10, 15, 20].map(mins => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => {
                            setTimingValidationErrors([]);
                            setShortBreakMinutes(mins);
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-mono-tabular transition-colors cursor-pointer ${
                            shortBreakMinutes === mins
                              ? 'bg-[#171717] text-white font-semibold'
                              : 'bg-[#F7F6EF] hover:bg-[#EDEAE0] text-[#171717] border border-[#E4E2DA]'
                          }`}
                        >
                          {mins} min
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-[#171717]">
                      Include break after final class of a session
                    </div>
                    <div className="text-[11px] text-[#77766F]">
                      Each lecture cycle spans {periodLengthMinutes} minutes + {shortBreakMinutes} minutes break ({periodLengthMinutes + shortBreakMinutes} minutes total).
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIncludeBreakAfterLastSlot(!includeBreakAfterLastSlot)}
                    className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                      includeBreakAfterLastSlot ? 'bg-[#171717]' : 'bg-[#D6D3C9]'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full transition-transform ${
                        includeBreakAfterLastSlot ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] text-xs text-[#77766F]">
                Breaks between classes are currently <strong className="text-[#171717]">DISABLED</strong>. Regular {periodLengthMinutes}-minute lectures are scheduled consecutively back-to-back.
              </div>
            )}
          </section>
        </div>

        {/* PANEL 4: MIDDAY / LUNCH BREAK (6 cols) */}
        <section className="lg:col-span-6 sf-card-white p-6 space-y-5">
          <div className="flex items-start justify-between gap-3 border-b border-[#E4E2DA] pb-4">
            <div className="space-y-1">
              <div className="text-[11px] font-mono-tabular font-semibold uppercase tracking-wider text-[#77766F]">
                Section 04 · Protected Midday Window
              </div>
              <h2 className="font-serif-editorial text-xl text-[#171717] flex items-center gap-2">
                <Coffee className="w-4 h-4 text-[#171717]" />
                <span>Midday / Lunch Break</span>
              </h2>
              <p className="text-xs text-[#77766F]">
                Enable or disable the midday break and configure its start time and duration. No lectures or labs overlap this period.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setTimingValidationErrors([]);
                setMiddayBreakEnabled(!middayBreakEnabled);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer shrink-0 ${
                middayBreakEnabled
                  ? 'bg-[#E8D36B] border-[#D4BC4C] text-[#171717]'
                  : 'bg-[#F7F6EF] border-[#E4E2DA] text-[#77766F]'
              }`}
            >
              {middayBreakEnabled
                ? `Enabled (${livePreview.middayBreak.timeRangeLabel})`
                : 'Disabled'}
            </button>
          </div>

          {middayBreakEnabled ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#171717]">
                  Midday Break Placement Mode
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setMiddayBreakMode('fixed')}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      middayBreakMode === 'fixed'
                        ? 'bg-[#171717] text-white border-[#171717]'
                        : 'bg-[#F7F6EF] text-[#171717] border-[#E4E2DA] hover:bg-[#EDEAE0]'
                    }`}
                  >
                    <div className="text-xs font-semibold">Fixed Start Time</div>
                    <div
                      className={`text-[11px] mt-0.5 ${
                        middayBreakMode === 'fixed' ? 'text-[#B8EEEE]' : 'text-[#77766F]'
                      }`}
                    >
                      Specify exact start time (e.g. 1:00 PM)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMiddayBreakMode('auto')}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      middayBreakMode === 'auto'
                        ? 'bg-[#171717] text-white border-[#171717]'
                        : 'bg-[#F7F6EF] text-[#171717] border-[#E4E2DA] hover:bg-[#EDEAE0]'
                    }`}
                  >
                    <div className="text-xs font-semibold">Auto-Calculated Midday</div>
                    <div
                      className={`text-[11px] mt-0.5 ${
                        middayBreakMode === 'auto' ? 'text-[#B8EEEE]' : 'text-[#77766F]'
                      }`}
                    >
                      Placed after morning slots ({livePreview.middayBreak.startTime24})
                    </div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Midday Break Start Time
                  </label>
                  <input
                    type="time"
                    disabled={middayBreakMode === 'auto'}
                    value={
                      middayBreakMode === 'auto'
                        ? livePreview.middayBreak.startTime24
                        : middayBreakStartTime
                    }
                    onChange={e => {
                      setTimingValidationErrors([]);
                      setMiddayBreakStartTime(e.target.value);
                    }}
                    className="input-field h-10 text-xs font-mono-tabular disabled:opacity-60"
                  />
                  <span className="block text-[11px] text-[#77766F] mt-1">
                    Active Window:{' '}
                    <strong className="text-[#171717]">
                      {livePreview.middayBreak.fullRangeLabel}
                    </strong>
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Midday Break Duration
                  </label>
                  <div className="input-group-field h-10 px-3 gap-2">
                    <input
                      type="number"
                      min={15}
                      max={180}
                      step={15}
                      value={middayBreakDurationMinutes}
                      onChange={e => {
                        setTimingValidationErrors([]);
                        setMiddayBreakDurationMinutes(
                          Math.max(15, parseInt(e.target.value, 10) || 60)
                        );
                      }}
                      className="text-xs font-mono-tabular font-semibold"
                    />
                    <span className="text-[11px] font-mono-tabular text-[#77766F] shrink-0">
                      minutes
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[30, 45, 60, 90].map(mins => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => {
                          setTimingValidationErrors([]);
                          setMiddayBreakDurationMinutes(mins);
                        }}
                        className={`px-2 py-1 rounded-md text-[11px] font-mono-tabular cursor-pointer ${
                          middayBreakDurationMinutes === mins
                            ? 'bg-[#171717] text-white font-semibold'
                            : 'bg-[#F7F6EF] text-[#171717] border border-[#E4E2DA]'
                        }`}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] text-xs text-[#77766F]">
              Midday / Lunch Break is currently <strong className="text-[#171717]">DISABLED</strong>. Instructional slots are generated continuously from opening time ({dayStartTime}) to closing time ({dayEndTime}).
            </div>
          )}
        </section>

        {/* PANEL 5: LABORATORY DURATION (6 cols) */}
        <section className="lg:col-span-6 sf-card-white p-6 space-y-5">
          <div className="flex items-start justify-between gap-3 border-b border-[#E4E2DA] pb-4">
            <div className="space-y-1">
              <div className="text-[11px] font-mono-tabular font-semibold uppercase tracking-wider text-[#77766F]">
                Section 05 · Continuous Practical Sessions
              </div>
              <h2 className="font-serif-editorial text-xl text-[#171717] flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-[#171717]" />
                <span>Laboratory Duration</span>
              </h2>
              <p className="text-xs text-[#77766F]">
                Configure the duration of one continuous laboratory session in minutes and hours. Labs never split across different times of day.
              </p>
            </div>

            <span className="px-2.5 py-1 rounded-lg bg-[#F2D8FA] text-[#171717] font-mono-tabular text-xs font-semibold shrink-0">
              {labDurationMinutes} min ({labHoursEquivalent} hrs)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
            <div className="sm:col-span-5">
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Continuous Lab Duration
              </label>
              <div className="input-group-field h-10 px-3 gap-2">
                <input
                  type="number"
                  min={periodLengthMinutes}
                  max={360}
                  step={15}
                  value={labDurationMinutes}
                  onChange={e => {
                    setTimingValidationErrors([]);
                    setLabDurationMinutes(
                      Math.max(periodLengthMinutes, parseInt(e.target.value, 10) || 180)
                    );
                  }}
                  className="text-xs font-mono-tabular font-semibold"
                />
                <span className="text-[11px] font-mono-tabular text-[#77766F] shrink-0">
                  minutes ({labHoursEquivalent}h)
                </span>
              </div>
            </div>

            <div className="sm:col-span-7 space-y-1.5">
              <span className="block text-[11px] font-medium text-[#77766F]">
                Standard Lab Duration Presets:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { mins: 120, label: '120 min (2 hours)' },
                  { mins: 150, label: '150 min (2.5 hours)' },
                  { mins: 180, label: '180 min (3 hours)' }
                ].map(opt => (
                  <button
                    key={opt.mins}
                    type="button"
                    onClick={() => {
                      setTimingValidationErrors([]);
                      setLabDurationMinutes(opt.mins);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono-tabular transition-colors cursor-pointer ${
                      labDurationMinutes === opt.mins
                        ? 'bg-[#171717] text-white font-semibold'
                        : 'bg-[#F7F6EF] hover:bg-[#EDEAE0] text-[#171717] border border-[#E4E2DA]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Computed Continuous Lab Windows Preview */}
          <div className="p-4 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#171717]">
                Valid Continuous Lab Windows ({livePreview.continuousLabBlocks.length})
              </span>
              <span className="font-mono-tabular text-[11px] text-[#77766F]">
                Spans {livePreview.labSpanSlots} consecutive timetable slots (Merged)
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {livePreview.continuousLabBlocks.map(block => (
                <span
                  key={block.startPeriod}
                  className="px-2.5 py-1 rounded-lg bg-[#F2D8FA]/75 border border-[#DFB9EC] text-xs font-mono-tabular font-semibold text-[#171717]"
                >
                  {block.session}: {block.continuousLabel}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* =========================================================
          COLLAPSIBLE DAILY TIMETABLE SLOT TIMELINE PREVIEW
         ========================================================= */}
      <div className="sf-card-white p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-serif-editorial text-xl text-[#171717]">
              Daily Timetable Slot Preview ({livePreview.slots.length} Slots)
            </h2>
            <p className="text-xs text-[#77766F]">
              Inspect how the scheduling solver partitions the university day based on the settings above.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowSlotTimeline(prev => !prev)}
              className="btn-secondary text-xs h-9 px-3.5"
            >
              <span>{showSlotTimeline ? 'Hide Slot Breakdown' : 'Preview Daily Slots'}</span>
            </button>

            <button
              type="button"
              disabled={!liveValidation.valid}
              onClick={() => handleSaveConfiguration()}
              className="btn-primary text-xs h-9 px-4 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Save Configuration</span>
            </button>
          </div>
        </div>

        {showSlotTimeline && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5 pt-4 border-t border-[#E4E2DA]">
            {livePreview.slots.map(slot => {
              const showLunchBefore =
                livePreview.middayBreak.enabled &&
                slot.slotNumber === livePreview.firstAfternoonSlotNumber;

              return (
                <React.Fragment key={slot.slotNumber}>
                  {showLunchBefore && (
                    <div className="p-3 rounded-xl bg-[#E8D36B]/45 border border-[#D4BC4C] flex flex-col justify-between">
                      <div className="text-[10px] font-mono-tabular font-bold uppercase text-[#171717]">
                        Midday Break
                      </div>
                      <div className="text-xs font-mono-tabular font-bold text-[#171717] my-1">
                        {livePreview.middayBreak.timeRangeLabel}
                      </div>
                      <div className="text-[10.5px] text-[#171717]/80">
                        {livePreview.middayBreak.durationMinutes} min Protected Lunch
                      </div>
                    </div>
                  )}

                  <div className="p-3 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[10px] font-mono-tabular text-[#77766F]">
                      <span className="font-bold text-[#171717]">Slot {slot.slotNumber}</span>
                      <span>{slot.session}</span>
                    </div>
                    <div className="text-xs font-mono-tabular font-semibold text-[#171717] my-1">
                      {slot.period}
                    </div>
                    <div className="text-[10.5px] font-mono-tabular text-[#77766F]">
                      {livePreview.shortBreakEnabled && livePreview.shortBreakMinutes > 0
                        ? `Break: ${slot.shortBreak}`
                        : 'No Break (0 min)'}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {showImportWizard && (
        <DataImportWizard
          onClose={() => setShowImportWizard(false)}
          onSuccess={summary => {
            setShowImportWizard(false);
            showToast(summary);
          }}
        />
      )}

      {showOnboardingModal && (
        <UniversityOnboardingModal
          existingInstitutionId={institutionalStore.getCurrentInstitutionId()}
          onClose={() => setShowOnboardingModal(false)}
          onCompleted={() => {
            setShowOnboardingModal(false);
            showToast('Saved custom academic calendar, operating hours, course durations, and break structures.');
          }}
        />
      )}
    </div>
  );
};
