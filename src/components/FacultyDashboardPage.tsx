import React, { useState } from 'react';
import {
  Clock,
  BookOpen,
  CheckCircle2,
  Plus,
  Trash2,
  Sliders,
  Check,
  Send
} from 'lucide-react';
import { useInstitutionalData, institutionalStore } from '../data/store';
import { AuthenticatedVotingUser } from '../services/votingApi';
import { RouteType } from './SmartGridNav';
import { DayOfWeek, computeAcademicScheduleConfig, getLabBlockByStartPeriod, getEffectiveSlotDisplayForDay } from '../types/institutional';
import { resolveFacultyInstructor } from '../utils/userTimetableScope';
import { showAppPopup } from './ToastPopupHost';

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

  // Strictly match faculty record from master store (never fall back to another instructor)
  const matchedInstructor = resolveFacultyInstructor(currentUser, store.instructors);

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
    showAppPopup({
      title: 'Preferences Saved',
      message: 'Availability preferences submitted to Registrar and Timetable Solver successfully.',
      variant: 'success'
    });
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

  const [scheduleSearch, setScheduleSearch] = useState('');
  const [scheduleDayFilter, setScheduleDayFilter] = useState<string>('ALL');

  const sortedSessions = [...scheduledSessions].sort((a, b) => {
    const dayA = daysOrder[a.assignedSlot?.day as DayOfWeek] || 99;
    const dayB = daysOrder[b.assignedSlot?.day as DayOfWeek] || 99;
    if (dayA !== dayB) return dayA - dayB;
    return (a.assignedSlot?.timeSlot || '').localeCompare(b.assignedSlot?.timeSlot || '');
  });

  const filteredSessions = sortedSessions.filter(sec => {
    if (scheduleDayFilter !== 'ALL' && sec.assignedSlot?.day !== scheduleDayFilter) {
      return false;
    }
    const q = scheduleSearch.trim().toLowerCase();
    if (!q) return true;
    const course = store.courses.find(c => c.id === sec.courseId);
    const cohort = store.studentGroups.find(g => g.id === sec.studentGroupId);
    const room = store.rooms.find(r => r.id === sec.assignedSlot?.roomId);
    return (
      (course?.code || '').toLowerCase().includes(q) ||
      (course?.title || '').toLowerCase().includes(q) ||
      (cohort?.code || '').toLowerCase().includes(q) ||
      (room?.code || '').toLowerCase().includes(q) ||
      (room?.name || '').toLowerCase().includes(q) ||
      sec.sectionNumber.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-[1200px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* 1. Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[#E4E2DA]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-[#77766F]">
            <span>{matchedInstructor?.title || 'Professor'}</span>
            <span>·</span>
            <span>{currentUser.email}</span>
          </div>
          <h1 className="font-serif-editorial text-2xl sm:text-3xl text-[#171717] tracking-tight">
            Welcome, {matchedInstructor?.name || currentUser.name}
          </h1>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('timetables')}
          className="btn-secondary h-9 text-xs shrink-0"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>My Weekly Timetable</span>
        </button>
      </header>

      {/* 2. Compact Hairline Key Metrics Strip */}
      <div className="sf-card-white overflow-hidden grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E4E2DA]">
        <div className="px-4 py-3.5 space-y-0.5">
          <div className="text-[11px] font-medium text-[#77766F] flex items-center justify-between">
            <span>Weekly Workload</span>
            <Clock className="w-3.5 h-3.5 text-[#77766F]" />
          </div>
          <div className="font-serif-editorial text-2xl text-[#171717] font-mono-tabular">
            {totalWeeklyTeachingHours} <span className="text-xs font-sans text-[#77766F] font-normal">/ {maxWeeklyHours} hrs</span>
          </div>
        </div>

        <div className="px-4 py-3.5 space-y-0.5">
          <div className="text-[11px] font-medium text-[#77766F] flex items-center justify-between">
            <span>Lectures</span>
            <BookOpen className="w-3.5 h-3.5 text-[#77766F]" />
          </div>
          <div className="font-serif-editorial text-2xl text-[#171717] font-mono-tabular">
            {lectureCount}
          </div>
        </div>

        <div className="px-4 py-3.5 space-y-0.5">
          <div className="text-[11px] font-medium text-[#77766F] flex items-center justify-between">
            <span>Continuous Labs</span>
            <Sliders className="w-3.5 h-3.5 text-[#77766F]" />
          </div>
          <div className="font-serif-editorial text-2xl text-[#171717] font-mono-tabular">
            {labCount} <span className="text-xs font-sans text-[#77766F] font-normal">({computedTiming.labDurationHoursLabel})</span>
          </div>
        </div>

        <div className="px-4 py-3.5 space-y-0.5">
          <div className="text-[11px] font-medium text-[#77766F] flex items-center justify-between">
            <span>Conflicts</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#1B5E20]" />
          </div>
          <div className="font-serif-editorial text-2xl text-[#171717]">
            0
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
          Availability &amp; Preferences
        </button>
      </div>

      {/* 4. Tab Content: My Weekly Schedule */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          <div className="sf-card-white overflow-hidden">
            <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E4E2DA]">
              <h2 className="font-serif-editorial text-xl text-[#171717]">
                Assigned Teaching Schedule
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={scheduleSearch}
                  onChange={e => setScheduleSearch(e.target.value)}
                  placeholder="Search course, section, room..."
                  className="input-field h-8 text-xs w-48"
                />
                <select
                  value={scheduleDayFilter}
                  onChange={e => setScheduleDayFilter(e.target.value)}
                  className="input-field h-8 text-xs w-28"
                >
                  <option value="ALL">All Days</option>
                  {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as DayOfWeek[]).map(d => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-mono-tabular text-[#77766F] pl-1">
                  {filteredSessions.length} sessions
                </span>
              </div>
            </div>

            {filteredSessions.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <BookOpen className="w-8 h-8 text-[#77766F] mx-auto opacity-50" />
                <div className="text-sm font-semibold text-[#171717]">No matching sessions found</div>
                <p className="text-xs text-[#77766F] max-w-md mx-auto">
                  No teaching sections match your current filter or the automatic solver has not allocated sections yet.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F7F6EF] border-b border-[#E4E2DA] text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                      <th className="py-3 px-4">Course Code &amp; Name</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Batch &amp; Section</th>
                      <th className="py-3 px-4">Day &amp; Time Window</th>
                      <th className="py-3 px-4">Classroom / Lab</th>
                      <th className="py-3 px-4 text-right">Enrolled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E2DA] text-xs">
                    {filteredSessions.map(sec => {
                      const course = store.courses.find(c => c.id === sec.courseId);
                      const cohort = store.studentGroups.find(g => g.id === sec.studentGroupId);
                      const room = store.rooms.find(r => r.id === sec.assignedSlot?.roomId);
                      const isLab = sec.sessionType === 'Lab' || (sec.spanSlots && sec.spanSlots > 1);
                      const slotDay = sec.assignedSlot?.day || 'Mon';
                      const basePeriod = sec.assignedSlot?.timeSlot || '';
                      const effSlot = getEffectiveSlotDisplayForDay(slotDay, basePeriod, computedTiming);
                      const labBlock = isLab ? getLabBlockByStartPeriod(basePeriod, store.timeStructure, slotDay) : undefined;
                      const timeWindow = isLab
                        ? (slotDay === 'Fri'
                            ? (labBlock?.continuousLabel || sec.assignedSlot?.continuousTimeLabel || basePeriod)
                            : (sec.assignedSlot?.continuousTimeLabel || labBlock?.continuousLabel || basePeriod))
                        : (effSlot.isOpen ? effSlot.period : basePeriod);
                      const effMinutes = isLab
                        ? (labBlock?.durationMinutes || computedTiming.labDurationMinutes)
                        : (effSlot.isOpen ? effSlot.durationMinutes : computedTiming.periodLengthMinutes);

                      return (
                        <tr
                          key={sec.id}
                          className="hover:bg-[#F7F6EF]/60 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono-tabular font-semibold text-[#171717]">
                                {course?.code || sec.courseId}
                              </span>
                              <span className="text-[#57564F]">
                                {course?.title || 'Academic Course'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-[#57564F]">
                            <span className="inline-flex items-center gap-1.5 font-medium text-[#171717]">
                              <span className={`w-1.5 h-1.5 rounded-full ${isLab ? 'bg-[#9C52B5]' : 'bg-[#2C7A7B]'}`} />
                              {isLab
                                ? `Lab (${effMinutes === computedTiming.labDurationMinutes ? computedTiming.labDurationHoursLabel : `${effMinutes}m`})`
                                : `Lecture (${effMinutes}m)`}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono-tabular font-semibold text-[#171717]">
                              {cohort?.code || sec.studentGroupId}
                            </span>
                            <span className="text-[#77766F] ml-1.5">· Sec {sec.sectionNumber}</span>
                          </td>
                          <td className="py-3 px-4 font-mono-tabular">
                            <span className="font-bold text-[#171717] mr-1.5">
                              {sec.assignedSlot?.day}
                            </span>
                            <span className="text-[#57564F]">{timeWindow}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono-tabular font-semibold text-[#171717]">
                              {room?.code || sec.assignedSlot?.roomId}
                            </span>
                            <span className="text-[#77766F] ml-1">({room?.name || 'Classroom'})</span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular text-[#57564F]">
                            {sec.expectedEnrollment || cohort?.size || 40}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Tab Content: Teaching Availability & Preferences */}
      {activeTab === 'preferences' && (
        <div className="space-y-4">
          <div className="sf-card-white p-5 sm:p-6 space-y-6">
            <h2 className="font-serif-editorial text-xl text-[#171717] border-b border-[#E4E2DA] pb-3">
              Teaching Availability &amp; Preferences
            </h2>

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
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
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
            </div>

            {/* Teaching Hours Limits */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-[#E4E2DA]">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#171717]">
                  <span>Maximum Weekly Teaching Load</span>
                  <span className="font-mono-tabular">{maxWeeklyHours} hrs</span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="24"
                  step="1"
                  value={maxWeeklyHours}
                  onChange={e => setMaxWeeklyHours(Number(e.target.value))}
                  className="w-full accent-[#171717]"
                />
              </div>

              <div className="space-y-2">
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
              </div>
            </div>

            {/* Blocked Unavailability / Research Windows */}
            <div className="space-y-3 pt-4 border-t border-[#E4E2DA]">
              <label className="block text-xs font-semibold text-[#171717]">
                Blocked Unavailability &amp; Research Windows
              </label>

              {/* Current Blocked Slots */}
              {unavailableSlots.length === 0 ? (
                <div className="py-3 text-xs text-[#77766F]">
                  No unavailable slots configured.
                </div>
              ) : (
                <div className="border border-[#E4E2DA] rounded-xl divide-y divide-[#E4E2DA]">
                  {unavailableSlots.map((slot, idx) => (
                    <div
                      key={`${slot.day}-${slot.timeSlot}-${idx}`}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2 font-mono-tabular">
                        <span className="font-semibold text-[#171717]">{slot.day}</span>
                        <span>·</span>
                        <span className="text-[#171717] font-medium">{slot.timeSlot}</span>
                        {slot.reason && (
                          <span className="text-[#77766F] font-sans">· {slot.reason}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveUnavailableSlot(idx)}
                        className="text-[#77766F] hover:text-[#8B1E1E] p-1 rounded hover:bg-[#F7F6EF] transition-colors cursor-pointer"
                        title="Remove unavailable window"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Block Form */}
              <div className="pt-3 border-t border-[#E4E2DA] space-y-2.5">
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
                    <span>Add Blocked Window</span>
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
                <span>Save &amp; Submit Preferences</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
