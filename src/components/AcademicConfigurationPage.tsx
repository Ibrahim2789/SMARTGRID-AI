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
  Building2
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

type ConfigTab = 'timings' | 'calendar' | 'policy';

const ALL_WEEK_DAYS: Array<{ code: DayOfWeek; label: string }> = [
  { code: 'Mon', label: 'Mon' },
  { code: 'Tue', label: 'Tue' },
  { code: 'Wed', label: 'Wed' },
  { code: 'Thu', label: 'Thu' },
  { code: 'Fri', label: 'Fri' },
  { code: 'Sat', label: 'Sat' },
  { code: 'Sun', label: 'Sun' }
];

const TIMING_PRESETS = [
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
];

export const AcademicConfigurationPage: React.FC<AcademicConfigurationPageProps> = ({
  onNavigate,
  currentUser,
  onSwitchUser
}) => {
  const store = useInstitutionalData();
  const profile = store.institutionProfile;
  const ts = store.timeStructure;
  const institutionName =
    profile?.name || currentUser?.institution || 'University of Engineering & Computing';

  const isAdmin = isUserAdminRole(currentUser?.role || 'Registrar');

  const [activeTab, setActiveTab] = useState<ConfigTab>('timings');

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

  const showToast = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(null), 5500);
  };

  const handleAddSemester = (e: React.FormEvent) => {
    e.preventDefault();
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

  const applyTimingPreset = (preset: (typeof TIMING_PRESETS)[number]) => {
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
            className="btn-secondary text-xs h-10 px-4 shrink-0"
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
    <div className="space-y-6 pb-8">
      {/* 1. CLEAN PAGE HEADER */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-[#E4E2DA]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-[#77766F]">
            <span>{institutionName}</span>
            <span>·</span>
            <span className="font-mono-tabular">{livePreview.operatingHoursLabel}</span>
            <span>·</span>
            <span className="font-mono-tabular">{livePreview.slots.length} daily slots</span>
          </div>
          <h1 className="font-serif-editorial text-3xl sm:text-4xl text-[#171717] tracking-tight">
            Academic Configuration
          </h1>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="btn-secondary text-xs h-9 px-3.5 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            disabled={!liveValidation.valid}
            onClick={() => handleSaveConfiguration()}
            className="btn-primary text-xs h-9 px-4 whitespace-nowrap shrink-0 disabled:opacity-50"
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
              className="px-3 py-1.5 rounded-lg bg-white border border-[#171717]/20 text-[#171717] text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              Generate Schedule
            </button>
            <button
              type="button"
              onClick={() => onNavigate('timetables')}
              className="px-3 py-1.5 rounded-lg bg-[#171717] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <span>Inspect Timetables</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Validation Error Banner */}
      {(timingValidationErrors.length > 0 || !liveValidation.valid) && (
        <div className="p-4 rounded-2xl bg-[#FDE8E8] border border-[#F5B7B7] space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[#8A1C1C]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Configuration Conflict</span>
          </div>
          <ul className="list-disc list-inside text-xs text-[#8A1C1C] space-y-0.5">
            {(timingValidationErrors.length > 0 ? timingValidationErrors : liveValidation.errors).map(
              (err, i) => (
                <li key={i}>{err}</li>
              )
            )}
          </ul>
        </div>
      )}

      {/* 2. SECTION NAVIGATION TABS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex items-center p-1 rounded-xl bg-[#EDEAE0] border border-[#E4E2DA] self-start">
          {[
            { id: 'timings' as const, label: 'Timings & Breaks', icon: Clock },
            {
              id: 'calendar' as const,
              label: `Academic Calendar (${store.terms.length})`,
              icon: Calendar
            },
            { id: 'policy' as const, label: 'Policy & Tools', icon: Building2 }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`h-8 px-3.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#171717] text-white'
                    : 'text-[#57564F] hover:text-[#171717]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="text-xs text-[#77766F] font-mono-tabular">
          Active Policy: <strong className="text-[#171717]">{currentPolicy === 'whole_university' ? 'Whole-University' : 'Department-Wise'}</strong>
          {' · '}
          {activeTermsList.length} active {activeTermsList.length === 1 ? 'term' : 'terms'}
        </div>
      </div>

      {/* =========================================================
          TAB 1: TIMINGS & BREAKS (SPACIOUS 7/5 SPLIT + LIVE SLOT PREVIEW)
         ========================================================= */}
      {activeTab === 'timings' && (
        <div className="space-y-6">
          {/* Quick Presets Bar */}
          <div className="sf-card-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold text-[#171717]">Quick Schedule Presets</span>
            <div className="flex flex-wrap items-center gap-2">
              {TIMING_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyTimingPreset(preset)}
                  className="px-3 py-1.5 rounded-lg bg-[#F7F6EF] hover:bg-[#EDEAE0] border border-[#E4E2DA] text-xs font-medium text-[#171717] transition-colors cursor-pointer whitespace-nowrap"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT 7 COLUMNS: UNIFIED TIMING CONTROLS */}
            <div className="lg:col-span-7 space-y-6">
              {/* SECTION A: OPERATING HOURS & WORKING DAYS */}
              <section className="sf-card-white p-6 space-y-5">
                <div className="flex items-center justify-between gap-3 border-b border-[#E4E2DA] pb-3.5">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#171717]" />
                    <h2 className="font-serif-editorial text-xl text-[#171717]">
                      Operating Hours &amp; Days
                    </h2>
                  </div>
                  <span className="font-mono-tabular text-xs font-semibold text-[#57564F]">
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
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#171717]">Working Days</span>
                    <span className="font-mono-tabular text-[#77766F]">
                      {workingDays.length} days selected
                    </span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    {ALL_WEEK_DAYS.map(day => {
                      const active = workingDays.includes(day.code);
                      return (
                        <button
                          key={day.code}
                          type="button"
                          onClick={() => handleToggleWorkingDay(day.code)}
                          className={`h-9 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#171717] text-white border-[#171717]'
                              : 'bg-white text-[#77766F] border-[#E4E2DA] hover:text-[#171717]'
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Friday Afternoon Shift */}
                <div className="pt-4 border-t border-[#E4E2DA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-[#171717]">
                      Friday Afternoon Shift (Jummah Buffer)
                    </div>
                    <div className="text-[11px] text-[#77766F] mt-0.5">
                      Shifts Friday afternoon sessions to start after prayer break.
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {fridayAfternoonShiftEnabled && (
                      <input
                        type="time"
                        value={fridayAfternoonStartTime}
                        onChange={e => setFridayAfternoonStartTime(e.target.value)}
                        className="input-field h-9 w-32 text-xs font-mono-tabular"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setFridayAfternoonShiftEnabled(!fridayAfternoonShiftEnabled)}
                      className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                        fridayAfternoonShiftEnabled ? 'bg-[#171717]' : 'bg-[#D6D3C9]'
                      }`}
                      aria-label="Toggle Friday afternoon shift"
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full transition-transform ${
                          fridayAfternoonShiftEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </section>

              {/* SECTION B: LECTURES, BREAKS & LABS IN ONE CLEAN HAIRLINE SHEET */}
              <section className="sf-card-white divide-y divide-[#E4E2DA] overflow-hidden">
                {/* 1. Lecture Duration */}
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#171717]" />
                      <h2 className="font-serif-editorial text-xl text-[#171717]">
                        Lecture Duration
                      </h2>
                    </div>
                    <span className="font-mono-tabular text-xs font-semibold text-[#57564F]">
                      {periodLengthMinutes} min / slot
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="input-group-field h-10 px-3 gap-2 sm:w-44 shrink-0">
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
                        min
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {[45, 50, 60, 75, 90].map(mins => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => {
                            setTimingValidationErrors([]);
                            setPeriodLengthMinutes(mins);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono-tabular transition-colors cursor-pointer ${
                            periodLengthMinutes === mins
                              ? 'bg-[#171717] text-white font-semibold'
                              : 'bg-[#F7F6EF] hover:bg-[#EDEAE0] text-[#171717] border border-[#E4E2DA]'
                          }`}
                        >
                          {mins}m
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. Inter-Class Break */}
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-serif-editorial text-xl text-[#171717]">
                        Inter-Class Break
                      </h2>
                      <p className="text-xs text-[#77766F] mt-0.5">
                        {shortBreakEnabled
                          ? `${shortBreakMinutes}-minute transition buffer between lecture slots`
                          : `Disabled — ${periodLengthMinutes}-minute lectures run back-to-back`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTimingValidationErrors([]);
                        setShortBreakEnabled(!shortBreakEnabled);
                      }}
                      className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                        shortBreakEnabled ? 'bg-[#171717]' : 'bg-[#D6D3C9]'
                      }`}
                      aria-label="Toggle inter-class break"
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full transition-transform ${
                          shortBreakEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {shortBreakEnabled && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="input-group-field h-10 px-3 gap-2 sm:w-44 shrink-0">
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
                            min
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {[5, 10, 15, 20].map(mins => (
                            <button
                              key={mins}
                              type="button"
                              onClick={() => {
                                setTimingValidationErrors([]);
                                setShortBreakMinutes(mins);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-mono-tabular transition-colors cursor-pointer ${
                                shortBreakMinutes === mins
                                  ? 'bg-[#171717] text-white font-semibold'
                                  : 'bg-[#F7F6EF] hover:bg-[#EDEAE0] text-[#171717] border border-[#E4E2DA]'
                              }`}
                            >
                              {mins}m
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-1">
                        <span className="text-xs text-[#57564F]">
                          Include break after final slot ({periodLengthMinutes + shortBreakMinutes}m cycle)
                        </span>
                        <button
                          type="button"
                          onClick={() => setIncludeBreakAfterLastSlot(!includeBreakAfterLastSlot)}
                          className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                            includeBreakAfterLastSlot ? 'bg-[#171717]' : 'bg-[#D6D3C9]'
                          }`}
                          aria-label="Toggle break after final slot"
                        >
                          <div
                            className={`bg-white w-4 h-4 rounded-full transition-transform ${
                              includeBreakAfterLastSlot ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Midday / Lunch Break */}
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Coffee className="w-4 h-4 text-[#171717]" />
                      <div>
                        <h2 className="font-serif-editorial text-xl text-[#171717]">
                          Midday / Lunch Break
                        </h2>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTimingValidationErrors([]);
                        setMiddayBreakEnabled(!middayBreakEnabled);
                      }}
                      className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                        middayBreakEnabled ? 'bg-[#171717]' : 'bg-[#D6D3C9]'
                      }`}
                      aria-label="Toggle midday break"
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full transition-transform ${
                          middayBreakEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {middayBreakEnabled ? (
                    <div className="space-y-4">
                      <div className="inline-flex items-center p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA]">
                        <button
                          type="button"
                          onClick={() => setMiddayBreakMode('fixed')}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            middayBreakMode === 'fixed'
                              ? 'bg-[#171717] text-white'
                              : 'text-[#57564F] hover:text-[#171717]'
                          }`}
                        >
                          Fixed Start Time
                        </button>
                        <button
                          type="button"
                          onClick={() => setMiddayBreakMode('auto')}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            middayBreakMode === 'auto'
                              ? 'bg-[#171717] text-white'
                              : 'text-[#57564F] hover:text-[#171717]'
                          }`}
                        >
                          Auto ({livePreview.middayBreak.startTime24})
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                        <div>
                          <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                            Start Time ({livePreview.middayBreak.timeRangeLabel})
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
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                            Break Duration
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
                              min
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
                                className={`px-2.5 py-1 rounded-md text-[11px] font-mono-tabular cursor-pointer ${
                                  middayBreakDurationMinutes === mins
                                    ? 'bg-[#171717] text-white font-semibold'
                                    : 'bg-[#F7F6EF] text-[#171717] border border-[#E4E2DA]'
                                }`}
                              >
                                {mins}m
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[#77766F]">
                      Disabled — continuous slots from {dayStartTime} to {dayEndTime}.
                    </p>
                  )}
                </div>

                {/* 4. Laboratory Duration */}
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <FlaskConical className="w-4 h-4 text-[#171717]" />
                      <h2 className="font-serif-editorial text-xl text-[#171717]">
                        Laboratory Duration
                      </h2>
                    </div>
                    <span className="font-mono-tabular text-xs font-semibold text-[#57564F]">
                      {labDurationMinutes}m ({labHoursEquivalent}h · {livePreview.labSpanSlots} merged slots)
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="input-group-field h-10 px-3 gap-2 sm:w-44 shrink-0">
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
                        min
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { mins: 120, label: '2h (120m)' },
                        { mins: 150, label: '2.5h (150m)' },
                        { mins: 180, label: '3h (180m)' }
                      ].map(opt => (
                        <button
                          key={opt.mins}
                          type="button"
                          onClick={() => {
                            setTimingValidationErrors([]);
                            setLabDurationMinutes(opt.mins);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono-tabular transition-colors cursor-pointer ${
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

                  {livePreview.continuousLabBlocks.length > 0 && (
                    <div className="text-xs text-[#57564F] font-mono-tabular pt-1">
                      Continuous Lab Windows:{' '}
                      {livePreview.continuousLabBlocks.map((block, idx) => (
                        <span key={block.startPeriod}>
                          <strong className="text-[#171717]">{block.session}</strong> {block.continuousLabel}
                          {idx < livePreview.continuousLabBlocks.length - 1 ? ' · ' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* RIGHT 5 COLUMNS: LIVE DAILY SLOT BREAKDOWN TIMELINE */}
            <aside className="lg:col-span-5 lg:sticky lg:top-6 sf-card-white overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E4E2DA] bg-[#F7F6EF]/60 flex items-center justify-between">
                <div>
                  <h2 className="font-serif-editorial text-xl text-[#171717]">
                    Daily Slot Breakdown
                  </h2>
                  <p className="text-xs text-[#77766F] mt-0.5 font-mono-tabular">
                    Live preview · {livePreview.slots.length} slots ({periodLengthMinutes}m lecture)
                  </p>
                </div>
              </div>

              <div className="divide-y divide-[#E4E2DA]">
                {livePreview.slots.map(slot => {
                  const showLunchBefore =
                    livePreview.middayBreak.enabled &&
                    slot.slotNumber === livePreview.firstAfternoonSlotNumber;

                  return (
                    <React.Fragment key={slot.slotNumber}>
                      {showLunchBefore && (
                        <div className="px-5 py-3 bg-[#E8D36B]/25 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-xs font-semibold text-[#171717]">
                            <Coffee className="w-3.5 h-3.5 shrink-0" />
                            <span>Midday / Lunch Break</span>
                          </div>
                          <div className="text-xs font-mono-tabular font-semibold text-[#171717]">
                            {livePreview.middayBreak.timeRangeLabel} ({livePreview.middayBreak.durationMinutes}m)
                          </div>
                        </div>
                      )}

                      <div className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-[#F7F6EF]/40 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-mono-tabular font-bold text-[#171717] w-12 shrink-0">
                            Slot {slot.slotNumber}
                          </span>
                          <span className="text-xs font-mono-tabular font-medium text-[#171717] truncate">
                            {slot.period}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono-tabular text-[#77766F] shrink-0">
                          {slot.session}
                          {livePreview.shortBreakEnabled && livePreview.shortBreakMinutes > 0
                            ? ` · +${livePreview.shortBreakMinutes}m break`
                            : ''}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="px-5 py-3.5 border-t border-[#E4E2DA] bg-[#F7F6EF]/50 flex items-center justify-between text-[11px] font-mono-tabular text-[#77766F]">
                <span>Lab span: {livePreview.labSpanSlots} consecutive slots</span>
                <span>{workingDays.join(' · ')}</span>
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* =========================================================
          TAB 2: ACADEMIC CALENDAR (7/5 SPACIOUS SPLIT)
         ========================================================= */}
      {activeTab === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT 7 COLUMNS: REGISTERED SEMESTERS */}
          <section className="lg:col-span-7 sf-card-white overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E4E2DA] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#171717]" />
                <h2 className="font-serif-editorial text-xl text-[#171717]">
                  Semesters &amp; Terms
                </h2>
              </div>
              <span className="text-xs font-mono-tabular font-semibold text-[#77766F]">
                {activeTermsList.length} active · {store.terms.length} total
              </span>
            </div>

            <div className="divide-y divide-[#E4E2DA]">
              {store.terms.map(term => {
                const isActive = term.status === 'active';
                return (
                  <div
                    key={term.id}
                    className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F7F6EF]/50 transition-colors"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-xs font-semibold text-[#171717] flex items-center gap-2 flex-wrap">
                        <span className="font-mono-tabular font-bold">{term.code}</span>
                        <span>·</span>
                        <span>{term.name}</span>
                        {isActive && (
                          <span className="text-[11px] font-medium text-[#1B5E20]">· Active</span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#77766F] font-mono-tabular">
                        {term.academicYear} · {term.startDate} to {term.endDate} · {term.weeksCount} weeks
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          institutionalStore.toggleTermActiveStatus(term.id);
                          showToast(`Updated status for "${term.name}".`);
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
                            showToast(`Removed "${term.name}".`);
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
          </section>

          {/* RIGHT 5 COLUMNS: CLEAN ADD SEMESTER FORM */}
          <section className="lg:col-span-5 sf-card-white p-6 space-y-5">
            <div className="border-b border-[#E4E2DA] pb-3.5">
              <h2 className="font-serif-editorial text-xl text-[#171717]">
                Add Semester
              </h2>
              <p className="text-xs text-[#77766F] mt-0.5">
                Create an upcoming or active academic term.
              </p>
            </div>

            <form onSubmit={handleAddSemester} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                  Semester Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Spring 2027"
                  value={newSemName}
                  onChange={e => setNewSemName(e.target.value)}
                  className="input-field h-10 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Semester Code
                  </label>
                  <input
                    type="text"
                    placeholder="SPR-27"
                    value={newSemCode}
                    onChange={e => setNewSemCode(e.target.value.toUpperCase())}
                    className="input-field h-10 text-xs font-mono-tabular uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    placeholder="2026–2027"
                    value={newSemYear}
                    onChange={e => setNewSemYear(e.target.value)}
                    className="input-field h-10 text-xs font-mono-tabular"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={newSemStart}
                    onChange={e => setNewSemStart(e.target.value)}
                    className="input-field h-10 text-xs font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={newSemEnd}
                    onChange={e => setNewSemEnd(e.target.value)}
                    className="input-field h-10 text-xs font-mono-tabular"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Duration (Weeks)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={newSemWeeks}
                    onChange={e => setNewSemWeeks(Math.max(1, parseInt(e.target.value, 10) || 16))}
                    className="input-field h-10 text-xs font-mono-tabular"
                  />
                </div>

                <label className="h-10 px-3 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF]/60 flex items-center justify-between gap-2 text-xs text-[#171717] cursor-pointer">
                  <span className="font-medium">Active immediately</span>
                  <input
                    type="checkbox"
                    checked={newSemActive}
                    onChange={e => setNewSemActive(e.target.checked)}
                    className="w-4 h-4 accent-[#171717]"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={!newSemName.trim() || !newSemCode.trim()}
                className="w-full btn-primary h-10 text-xs disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Semester</span>
              </button>
            </form>
          </section>
        </div>
      )}

      {/* =========================================================
          TAB 3: SCHEDULING POLICY & INSTITUTIONAL TOOLS
         ========================================================= */}
      {activeTab === 'policy' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT 7 COLUMNS: SCHEDULING POLICY */}
          <section className="lg:col-span-7 sf-card-white p-6 space-y-5">
            <div className="flex items-center justify-between gap-3 border-b border-[#E4E2DA] pb-3.5">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#171717]" />
                <h2 className="font-serif-editorial text-xl text-[#171717]">
                  Timetable Scheduling Policy
                </h2>
              </div>
              <span className="text-xs font-mono-tabular text-[#77766F]">
                {currentPolicy === 'whole_university' ? 'Whole-University' : 'Department-Wise'}
              </span>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  institutionalStore.setTimetableManagementPolicy('whole_university');
                  showToast('Activated Whole-University Timetable Policy.');
                }}
                className={`w-full p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                  currentPolicy === 'whole_university'
                    ? 'bg-[#171717] text-white border-[#171717]'
                    : 'bg-white text-[#171717] border-[#E4E2DA] hover:bg-[#F7F6EF]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">Whole-University Integrated</span>
                  {currentPolicy === 'whole_university' && (
                    <Check className="w-4 h-4 text-[#B7F77C]" />
                  )}
                </div>
                <p
                  className={`text-xs mt-1 leading-relaxed ${
                    currentPolicy === 'whole_university' ? 'text-white/75' : 'text-[#77766F]'
                  }`}
                >
                  Schedules all {store.departments.length} departments ({store.studentGroups.length} sections) together in one conflict-free matrix to prevent shared room and faculty collisions.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  institutionalStore.setTimetableManagementPolicy('department_wise');
                  showToast('Activated Department-Wise Timetable Policy.');
                }}
                className={`w-full p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                  currentPolicy === 'department_wise'
                    ? 'bg-[#171717] text-white border-[#171717]'
                    : 'bg-white text-[#171717] border-[#E4E2DA] hover:bg-[#F7F6EF]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">Department-Wise Isolation</span>
                  {currentPolicy === 'department_wise' && (
                    <Check className="w-4 h-4 text-[#B7F77C]" />
                  )}
                </div>
                <p
                  className={`text-xs mt-1 leading-relaxed ${
                    currentPolicy === 'department_wise' ? 'text-white/75' : 'text-[#77766F]'
                  }`}
                >
                  Each department generates and manages its own timetable independently using department-assigned faculty, rooms, and batches.
                </p>
              </button>
            </div>

            <div className="pt-4 border-t border-[#E4E2DA] flex items-center justify-between gap-3 text-xs">
              <span className="text-[#57564F] font-mono-tabular">
                {store.departments.length} Depts · {store.programs.length} Programs · {store.studentGroups.length} Sections
              </span>
              <button
                type="button"
                onClick={() => onNavigate('generate')}
                className="text-xs font-semibold text-[#171717] underline hover:opacity-80 cursor-pointer shrink-0"
              >
                Open Generator →
              </button>
            </div>
          </section>

          {/* RIGHT 5 COLUMNS: SETUP WIZARD & CSV IMPORT */}
          <section className="lg:col-span-5 sf-card-white divide-y divide-[#E4E2DA] overflow-hidden">
            <div className="px-6 py-4">
              <h2 className="font-serif-editorial text-xl text-[#171717]">
                Institutional Setup &amp; Data
              </h2>
              <p className="text-xs text-[#77766F] mt-0.5">
                Configure institutional structure or import bulk records.
              </p>
            </div>

            <div className="p-6 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-[#171717]">
                    University Setup Wizard
                  </div>
                  <p className="text-xs text-[#77766F] leading-relaxed">
                    Step-by-step configuration for campus details, academic calendar, daily hours, and break rules.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOnboardingModal(true)}
                className="btn-secondary text-xs h-9 px-4"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Launch Setup Wizard</span>
              </button>
            </div>

            <div className="p-6 space-y-3">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-[#171717]">
                  Bulk CSV Data Import
                </div>
                <p className="text-xs text-[#77766F] leading-relaxed">
                  Import courses, faculty members, classrooms, and student batches from CSV spreadsheets.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowImportWizard(true)}
                className="btn-secondary text-xs h-9 px-4"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import CSV Data</span>
              </button>
            </div>
          </section>
        </div>
      )}

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
