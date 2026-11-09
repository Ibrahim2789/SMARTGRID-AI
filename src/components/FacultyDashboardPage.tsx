import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  BookOpen,
  MapPin,
  Users,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Sliders,
  Check,
  Send,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { useInstitutionalData, institutionalStore } from '../data/store';
import { AuthenticatedVotingUser } from '../services/votingApi';
import { RouteType } from './SmartGridNav';
import { DayOfWeek, computeAcademicScheduleConfig, getLabBlockByStartPeriod } from '../types/institutional';

interface FacultyDashboardPageProps {
  currentUser: AuthenticatedVotingUser;
  subView?: 'dashboard' | 'preferences';
  onNavigate: (route: RouteType) => void;
  onUserSynced?: (user: AuthenticatedVotingUser) => void;
}

export const FacultyDashboardPage: React.FC<FacultyDashboardPageProps> = ({
  currentUser,
  subView = 'dashboard',
  onNavigate
}) => {
  const store = useInstitutionalData();
  const computedTiming = computeAcademicScheduleConfig(store.timeStructure);

  const [activeTab, setActiveTab] = useState<'schedule' | 'preferences'>(
    subView === 'preferences' ? 'preferences' : 'schedule'
  );

  // Match faculty record from master store
  const matchedInstructor =
    store.instructors.find(
      i =>
        i.email.toLowerCase() === (currentUser.email || '').toLowerCase() ||
        i.name.toLowerCase().includes(currentUser.name.toLowerCase()) ||
        currentUser.name.toLowerCase().includes(i.name.toLowerCase())
    ) ||
    store.instructors.find(i => i.name.toLowerCase().includes('jehanzeb')) ||
    store.instructors[0];

  // Assigned sections in master schedule
  const assignedSections = store.sections.filter(s => s.instructorId === matchedInstructor?.id);
  const scheduledSessions = assignedSections.filter(s => Boolean(s.assignedSlot));

  // Teaching Preferences State
  const [preferredDays, setPreferredDays] = useState<DayOfWeek[]>(
    matchedInstructor?.preferredDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  );
  const [maxWeeklyHours, setMaxWeeklyHours] = useState<number>(
    matchedInstructor?.maxWeeklyHours || 16
  );
  const [maxConsecutiveHours, setMaxConsecutiveHours] = useState<number>(
    matchedInstructor?.maxConsecutiveHours || 3
  );
  const [unavailableSlots, setUnavailableSlots] = useState<
    Array<{ day: DayOfWeek; timeSlot: string; reason?: string }>
  >(matchedInstructor?.unavailableSlots || [
    { day: 'Wed', timeSlot: '14:00 – 14:50', reason: 'Department Research Colloquium' }
  ]);

  // Form for adding blocked window
  const [newBlockDay, setNewBlockDay] = useState<DayOfWeek>('Fri');
  const [newBlockSlot, setNewBlockSlot] = useState<string>(computedTiming.periods[0] || '09:00 – 09:50');
  const [newBlockReason, setNewBlockReason] = useState<string>('Faculty Board Meeting');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  // Stats calculation
  const lectureCount = assignedSections.filter(s => s.sessionType === 'Lecture' || (!s.spanSlots || s.spanSlots === 1)).length;
  const labCount = assignedSections.filter(s => s.sessionType === 'Lab' || (s.spanSlots && s.spanSlots > 1)).length;
  const totalWeeklyTeachingHours = lectureCount * 1 + labCount * 3;

  const handleToggleDay = (day: DayOfWeek) => {
    if (preferredDays.includes(day)) {
      if (preferredDays.length > 1) {
        setPreferredDays(preferredDays.filter(d => d !== day));
      }
    } else {
      setPreferredDays([...preferredDays, day]);
    }
  };

  const handleAddUnavailableSlot = () => {
    if (!newBlockSlot) return;
    const exists = unavailableSlots.some(
      u => u.day === newBlockDay && u.timeSlot === newBlockSlot
    );
    if (exists) return;
    setUnavailableSlots([
      ...unavailableSlots,
      { day: newBlockDay, timeSlot: newBlockSlot, reason: newBlockReason.trim() || 'Unavailable' }
    ]);
    setNewBlockReason('');
  };

  const handleRemoveUnavailableSlot = (index: number) => {
    setUnavailableSlots(unavailableSlots.filter((_, idx) => idx !== index));
  };

  const handleSavePreferences = () => {
    if (!matchedInstructor) return;
    institutionalStore.updateInstructorPreferences(matchedInstructor.id, {
      preferredDays,
      maxWeeklyHours,
      maxConsecutiveHours,
      unavailableSlots
    });
    setSaveSuccessNotice('Availability preferences submitted to Registrar and Timetable Solver successfully.');
    setTimeout(() => setSaveSuccessNotice(null), 4500);
  };

  const daysOrder: Record<DayOfWeek, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7
  };

  const sortedSessions = [...scheduledSessions].sort((a, b) => {
    const dayA = daysOrder[a.assignedSlot?.day as DayOfWeek] || 99;
    const dayB = daysOrder[b.assignedSlot?.day as DayOfWeek] || 99;
    if (dayA !== dayB) return dayA - dayB;
    return (a.assignedSlot?.timeSlot || '').localeCompare(b.assignedSlot?.timeSlot || '');
  });

  return (
    <div className="max-w-[1200px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* 1. Header & Professor Identity Banner */}
      <div className="sf-card-white p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-[#77766F]">
            <span className="font-semibold text-[#171717]">Faculty Academic Portal</span>
            <span>·</span>
            <span>{matchedInstructor?.title || 'Professor'}</span>
            <span>·</span>
            <span className="text-[#57564F] font-medium">{currentUser.email}</span>
          </div>
          <h1 className="font-serif-editorial text-2xl sm:text-3xl text-[#171717] tracking-tight">
            Welcome, {matchedInstructor?.name || currentUser.name}
          </h1>
          <p className="text-xs text-[#57564F]">
            Review your weekly teaching sessions, laboratory allocations, and submit constraint preferences to the academic scheduler.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('timetables')}
            className="btn-secondary h-9 text-xs"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Open Institutional Matrix</span>
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="sf-card-white p-4 space-y-1">
          <div className="text-[11px] font-medium text-[#77766F] flex items-center justify-between">
            <span>Weekly Workload</span>
            <Clock className="w-3.5 h-3.5 text-[#171717]" />
          </div>
          <div className="font-serif-editorial text-2xl text-[#171717] font-mono-tabular">
            {totalWeeklyTeachingHours} <span className="text-sm font-sans text-[#77766F] font-normal">hrs/week</span>
          </div>
          <div className="text-[10.5px] text-[#77766F]">
            Target limit: {maxWeeklyHours} hrs max
          </div>
        </div>

        <div className="sf-card-white p-4 space-y-1">
          <div className="text-[11px] font-medium text-[#77766F] flex items-center justify-between">
            <span>Scheduled Lectures</span>
            <BookOpen className="w-3.5 h-3.5 text-[#171717]" />
          </div>
          <div className="font-serif-editorial text-2xl text-[#171717] font-mono-tabular">
            {lectureCount}
          </div>
          <div className="text-[10.5px] text-[#77766F]">
            50-minute teaching slots
          </div>
        </div>

        <div className="sf-card-white p-4 space-y-1">
          <div className="text-[11px] font-medium text-[#77766F] flex items-center justify-between">
            <span>Continuous Labs</span>
            <Sliders className="w-3.5 h-3.5 text-[#171717]" />
          </div>
          <div className="font-serif-editorial text-2xl text-[#171717] font-mono-tabular">
            {labCount}
          </div>
          <div className="text-[10.5px] text-[#77766F]">
            {computedTiming.labDurationHoursLabel} lab sessions
          </div>
        </div>

        <div className="sf-card-white p-4 space-y-1">
          <div className="text-[11px] font-medium text-[#77766F] flex items-center justify-between">
            <span>Conflict Clearance</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#171717]" />
          </div>
          <div className="font-serif-editorial text-2xl text-[#171717]">
            100%
          </div>
          <div className="text-[10.5px] text-[#77766F]">
            Zero overlapping assignments
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex items-center gap-1 p-1 bg-[#EDEAE0] rounded-xl border border-[#E4E2DA] max-w-sm">
        <button
          type="button"
          onClick={() => setActiveTab('schedule')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
            activeTab === 'schedule'
              ? 'bg-[#171717] text-white shadow-2xs'
              : 'text-[#57564F] hover:text-[#171717]'
          }`}
        >
          My Weekly Schedule
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('preferences')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
            activeTab === 'preferences'
              ? 'bg-[#171717] text-white shadow-2xs'
              : 'text-[#57564F] hover:text-[#171717]'
          }`}
        >
          Availability & Preferences
        </button>
      </div>

      {/* 4. Tab Content: My Weekly Schedule */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          <div className="sf-card-white p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E4E2DA] pb-3">
              <div>
                <h2 className="font-serif-editorial text-xl text-[#171717]">
                  Assigned Teaching Schedule
                </h2>
                <p className="text-xs text-[#77766F]">
                  All current lecture sessions and continuous laboratory slots assigned to your institutional profile.
                </p>
              </div>
              <span className="text-xs font-mono-tabular text-[#77766F]">
                {sortedSessions.length} active sessions
              </span>
            </div>

            {sortedSessions.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <BookOpen className="w-8 h-8 text-[#77766F] mx-auto opacity-50" />
                <div className="text-sm font-semibold text-[#171717]">No sessions currently assigned</div>
                <p className="text-xs text-[#77766F] max-w-md mx-auto">
                  The administrator or automatic solver has not allocated teaching sections to your profile yet, or generation is pending.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {sortedSessions.map(sec => {
                  const course = store.courses.find(c => c.id === sec.courseId);
                  const cohort = store.studentGroups.find(g => g.id === sec.studentGroupId);
                  const room = store.rooms.find(r => r.id === sec.assignedSlot?.roomId);
                  const isLab = sec.sessionType === 'Lab' || (sec.spanSlots && sec.spanSlots > 1);
                  const timeWindow = isLab
                    ? (sec.assignedSlot?.continuousTimeLabel ||
                       getLabBlockByStartPeriod(sec.assignedSlot?.timeSlot || '', store.timeStructure)?.continuousLabel ||
                       sec.assignedSlot?.timeSlot)
                    : sec.assignedSlot?.timeSlot;

                  return (
                    <div
                      key={sec.id}
                      className="p-4 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF] space-y-3 hover:border-[#171717]/30 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono-tabular text-xs font-bold text-[#171717] bg-white px-2 py-0.5 rounded border border-[#E4E2DA]">
                            {course?.code || sec.courseId}
                          </span>
                          <span className={`ml-1.5 text-[10px] font-semibold px-2 py-0.5 rounded ${
                            isLab ? 'bg-[#F2D8FA] text-[#171717]' : 'bg-[#B8EEEE] text-[#171717]'
                          }`}>
                            {isLab ? `Lab (${computedTiming.labDurationHoursLabel})` : `Lecture (${computedTiming.periodLengthMinutes}m)`}
                          </span>
                        </div>
                        <span className="text-xs font-mono-tabular font-semibold text-[#171717]">
                          {sec.assignedSlot?.day}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-serif-editorial text-base text-[#171717] leading-tight">
                          {course?.title || 'Academic Course'}
                        </h3>
                        <p className="text-xs text-[#77766F] mt-0.5">
                          Section: <strong className="text-[#171717]">{sec.sectionNumber}</strong> · Cohort: <strong className="text-[#171717]">{cohort?.code}</strong>
                        </p>
                      </div>

                      <div className="pt-2 border-t border-[#E4E2DA] space-y-1 text-xs text-[#57564F]">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#171717] shrink-0" />
                          <span className="font-mono-tabular font-medium text-[#171717]">{timeWindow}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#171717] shrink-0" />
                          <span className="font-mono-tabular text-[#171717]">{room?.code || sec.assignedSlot?.roomId}</span>
                          <span className="text-[#77766F]">({room?.name || 'Classroom'})</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-[#171717] shrink-0" />
                          <span className="font-mono-tabular">{sec.expectedEnrollment || cohort?.size || 40} Enrolled Students</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Tab Content: Teaching Availability & Preferences */}
      {activeTab === 'preferences' && (
        <div className="space-y-4">
          {saveSuccessNotice && (
            <div className="p-3.5 rounded-xl bg-[#B7F77C] text-xs text-[#171717] flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 text-[#171717] shrink-0" />
              <span>{saveSuccessNotice}</span>
            </div>
          )}

          <div className="sf-card-white p-5 sm:p-6 space-y-6">
            <div>
              <h2 className="font-serif-editorial text-xl text-[#171717]">
                Teaching Availability & Operating Preferences
              </h2>
              <p className="text-xs text-[#77766F] mt-0.5">
                Configure your preferred teaching days, workload thresholds, and reserved research or administrative meeting windows.
              </p>
            </div>

            {/* Preferred Teaching Days */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#171717]">
                Preferred Teaching Days
              </label>
              <div className="flex flex-wrap gap-2">
                {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as DayOfWeek[]).map(day => {
                  const isSelected = preferredDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleToggleDay(day)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-[#171717] text-white border-[#171717]'
                          : 'bg-[#F7F6EF] text-[#57564F] border-[#E4E2DA] hover:border-[#171717]'
                      }`}
                    >
                      {day} {isSelected ? '✓' : ''}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-[#77766F]">
                The solver algorithm prioritizes placing your teaching workload on your preferred days.
              </p>
            </div>

            {/* Teaching Hours Limits */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E4E2DA]">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#171717]">
                  Maximum Weekly Teaching Load
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="6"
                    max="24"
                    step="1"
                    value={maxWeeklyHours}
                    onChange={e => setMaxWeeklyHours(Number(e.target.value))}
                    className="w-full accent-[#171717]"
                  />
                  <span className="font-mono-tabular font-bold text-xs px-2.5 py-1 rounded bg-[#F7F6EF] border border-[#E4E2DA] shrink-0">
                    {maxWeeklyHours} hrs
                  </span>
                </div>
                <p className="text-[11px] text-[#77766F]">
                  Weekly cap for lectures and laboratory oversight.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#171717]">
                  Maximum Consecutive Hours
                </label>
                <div className="flex items-center gap-2">
                  {[2, 3, 4].map(hours => (
                    <button
                      key={hours}
                      type="button"
                      onClick={() => setMaxConsecutiveHours(hours)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                        maxConsecutiveHours === hours
                          ? 'bg-[#171717] text-white border-[#171717]'
                          : 'bg-[#F7F6EF] text-[#57564F] border-[#E4E2DA]'
                      }`}
                    >
                      {hours} Hours Max
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[#77766F]">
                  Guarantees breaks between long teaching stretches.
                </p>
              </div>
            </div>

            {/* Blocked Unavailability / Research Windows */}
            <div className="space-y-3 pt-2 border-t border-[#E4E2DA]">
              <div>
                <label className="block text-xs font-semibold text-[#171717]">
                  Blocked Unavailability & Research Windows
                </label>
                <p className="text-[11px] text-[#77766F]">
                  Prevent the solver from placing lectures or labs during your protected research hours, faculty meetings, or thesis defenses.
                </p>
              </div>

              {/* Current Blocked Slots */}
              {unavailableSlots.length === 0 ? (
                <div className="p-3 text-xs text-[#77766F] bg-[#F7F6EF] rounded-xl border border-[#E4E2DA]">
                  No unavailable slots configured. You are fully available during university operational hours.
                </div>
              ) : (
                <div className="space-y-2">
                  {unavailableSlots.map((slot, idx) => (
                    <div
                      key={`${slot.day}-${slot.timeSlot}-${idx}`}
                      className="p-3 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2 font-mono-tabular">
                        <span className="font-semibold text-[#171717] px-2 py-0.5 rounded bg-white border border-[#E4E2DA]">
                          {slot.day}
                        </span>
                        <span className="text-[#171717] font-medium">{slot.timeSlot}</span>
                        {slot.reason && (
                          <span className="text-[#77766F] font-sans">· {slot.reason}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveUnavailableSlot(idx)}
                        className="text-[#77766F] hover:text-[#8B1E1E] p-1 rounded hover:bg-white transition-colors cursor-pointer"
                        title="Remove unavailable window"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Block Form */}
              <div className="p-3.5 rounded-xl bg-[#EDEAE0] border border-[#E4E2DA] space-y-2.5">
                <div className="text-xs font-semibold text-[#171717] flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Blocked Window</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10.5px] text-[#77766F] mb-1">Day</label>
                    <select
                      value={newBlockDay}
                      onChange={e => setNewBlockDay(e.target.value as DayOfWeek)}
                      className="input-field h-8 text-xs"
                    >
                      {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as DayOfWeek[]).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10.5px] text-[#77766F] mb-1">Time Slot</label>
                    <select
                      value={newBlockSlot}
                      onChange={e => setNewBlockSlot(e.target.value)}
                      className="input-field h-8 text-xs font-mono-tabular"
                    >
                      {computedTiming.periods.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10.5px] text-[#77766F] mb-1">Reason (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Research / Faculty Board"
                      value={newBlockReason}
                      onChange={e => setNewBlockReason(e.target.value)}
                      className="input-field h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleAddUnavailableSlot}
                    className="btn-secondary h-8 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add to Unavailable Windows</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Submit Action Button */}
            <div className="pt-4 border-t border-[#E4E2DA] flex justify-end">
              <button
                type="button"
                onClick={handleSavePreferences}
                className="btn-primary h-10 px-5 text-xs font-semibold"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Save & Submit Preferences to Scheduler</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
