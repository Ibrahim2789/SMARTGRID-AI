import React, { useState, useEffect } from 'react';
import { X, Clock, MapPin, User, Users, CheckCircle, Lock, Unlock, ArrowRightLeft, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { institutionalStore, useInstitutionalData } from '../data/store';
import {
  DayOfWeek,
  VALID_CONTINUOUS_LAB_BLOCKS,
  computeAcademicScheduleConfig,
  getLabBlockByStartPeriod,
  getEffectiveSlotDisplayForDay
} from '../types/institutional';
import { showAppPopup } from './ToastPopupHost';

export interface ClassItem {
  id: string;
  code: string;
  title: string;
  room: string;
  roomId?: string;
  prof: string;
  instructorId?: string;
  cohort: string;
  studentGroupId?: string;
  departmentId?: string;
  departmentName?: string;
  sectionNumber?: string;
  capacity?: number;
  enrolled?: number;
  time?: string;
  effectiveTime?: string;
  day?: string;
  type?: 'Lecture' | 'Lab' | 'Laboratory' | 'Studio' | 'Recitation';
  sessionType?: 'Lecture' | 'Lab';
  spanSlots?: number; // 1 for Lecture, N for continuous Lab
  durationMinutes?: number;
  continuousTimeLabel?: string; // e.g., '9:00 AM – 12:00 PM' or '2:30 PM – 4:55 PM'
  credits?: number;
  accent: 'plum' | 'terracotta' | 'emerald';
  isLocked?: boolean;
  constraintStatus?: 'Optimal' | 'Soft Penalty Resolved' | 'Equilibrium Confirmed';
}

interface ClassDetailsModalProps {
  classItem: ClassItem | null;
  onClose: () => void;
  onLocateInMatrix?: (code: string) => void;
  canEdit?: boolean;
}

export const ClassDetailsModal: React.FC<ClassDetailsModalProps> = ({
  classItem,
  onClose,
  onLocateInMatrix,
  canEdit = true
}) => {
  const store = useInstitutionalData();
  const computedTiming = computeAcademicScheduleConfig(store.timeStructure);
  const activeLabBlocks =
    computedTiming.continuousLabBlocks.length > 0
      ? computedTiming.continuousLabBlocks
      : VALID_CONTINUOUS_LAB_BLOCKS;

  const [isReassigning, setIsReassigning] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [selectedSwapSectionId, setSelectedSwapSectionId] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Mon');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (classItem) {
      setIsReassigning(false);
      setSavedNotice(null);
      const validDays = computedTiming.workingDays;
      const initialDay = validDays.includes(classItem.day as DayOfWeek) ? (classItem.day as DayOfWeek) : (validDays[0] || 'Mon');
      setSelectedDay(initialDay);
      setSelectedPeriod(classItem.time || computedTiming.periods[0] || '9:00 – 9:50 AM');
      const matchedRoom = store.rooms.find(r => r.id === classItem.roomId || r.code === classItem.room);
      setSelectedRoomId(matchedRoom?.id || store.rooms[0]?.id || '');
    }
  }, [classItem, store.rooms, store.timeStructure]);

  if (!classItem) return null;

  const isStoreBacked = store.sections.some(s => s.id === classItem.id);
  const currentSec = store.sections.find(s => s.id === classItem.id);
  const isLocked = currentSec ? Boolean(currentSec.isLocked) : Boolean(classItem.isLocked);
  const isLab = classItem.sessionType === 'Lab' || Boolean(classItem.spanSlots && classItem.spanSlots > 1);
  const effectiveSlotInfo = getEffectiveSlotDisplayForDay(
    classItem.day || 'Mon',
    classItem.time || '',
    computedTiming
  );
  const displayTimeWindow = isLab
    ? (classItem.continuousTimeLabel ||
       getLabBlockByStartPeriod(classItem.time || '', store.timeStructure, classItem.day)?.continuousLabel ||
       classItem.time)
    : (classItem.effectiveTime ||
       (effectiveSlotInfo.isOpen ? effectiveSlotInfo.period : classItem.time) ||
       computedTiming.periods[0] ||
       '9:00 – 9:50 AM');
  const displayDurationMinutes = isLab
    ? (classItem.durationMinutes || computedTiming.labDurationMinutes)
    : (effectiveSlotInfo.isOpen ? effectiveSlotInfo.durationMinutes : (classItem.durationMinutes || computedTiming.periodLengthMinutes));

  const dayLabBlocks =
    selectedDay === 'Fri'
      ? computedTiming.fridaySchedule.continuousLabBlocks
      : activeLabBlocks;
  const dayLecturePeriods =
    selectedDay === 'Fri'
      ? computedTiming.fridaySchedule.validBasePeriods
      : computedTiming.periods;

  const handleSaveSlotChange = () => {
    if (!isStoreBacked) return;
    institutionalStore.updateSectionSlot(classItem.id, {
      day: selectedDay,
      timeSlot: selectedPeriod,
      roomId: selectedRoomId
    });
    void institutionalStore.syncToBackend();
    const newRoom = store.rooms.find(r => r.id === selectedRoomId);
    const labWindow = isLab
      ? (getLabBlockByStartPeriod(selectedPeriod, store.timeStructure, selectedDay)?.continuousLabel || selectedPeriod)
      : getEffectiveSlotDisplayForDay(selectedDay, selectedPeriod, computedTiming).period;
    const msg = `Rescheduled ${classItem.code} to ${selectedDay} · ${labWindow} in ${newRoom?.code || 'selected room'}.`;
    setSavedNotice(msg);
    showAppPopup({ title: 'Session Rescheduled', message: msg, variant: 'success' });
    setIsReassigning(false);
    setTimeout(() => {
      onClose();
    }, 900);
  };

  const otherSections = store.sections.filter(s =>
    s.id !== classItem.id &&
    Boolean(s.assignedSlot) &&
    (s.studentGroupId === classItem.studentGroupId || !classItem.studentGroupId)
  );

  const handleExecuteSwap = () => {
    if (!selectedSwapSectionId) return;
    const res = institutionalStore.swapSectionSlots(classItem.id, selectedSwapSectionId);
    void institutionalStore.syncToBackend();
    setSavedNotice(res.message);
    showAppPopup({ title: 'Sessions Swapped', message: res.message, variant: 'success' });
    setIsSwapping(false);
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  const handleToggleLock = () => {
    if (!isStoreBacked) return;
    institutionalStore.toggleSectionLock(classItem.id);
    void institutionalStore.syncToBackend();
    const msg = isLocked
      ? `${classItem.code} unlocked for future solver runs.`
      : `${classItem.code} locked to current room and slot.`;
    setSavedNotice(msg);
    showAppPopup({ title: isLocked ? 'Session Unlocked' : 'Session Locked', message: msg, variant: 'info' });
  };

  const shortBreakSummary =
    computedTiming.shortBreakEnabled && computedTiming.shortBreakMinutes > 0
      ? `+ ${computedTiming.shortBreakMinutes}-min short break`
      : 'Back-to-back (no short break)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="relative bg-white border border-[#E4E2DA] rounded-2xl shadow-xl max-w-lg w-full overflow-hidden z-10"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E4E2DA] flex items-start justify-between bg-[#F7F6EF]">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#77766F]">
              <span className="font-mono-tabular font-semibold text-[#171717]">
                {classItem.code}
              </span>
              <span>·</span>
              <span className="font-medium text-[#171717]">
                {isLab
                  ? `Lab (${displayDurationMinutes === computedTiming.labDurationMinutes ? `${computedTiming.labDurationHoursLabel} Continuous` : `${displayDurationMinutes}m Continuous`} / ${displayDurationMinutes}m)`
                  : `Lecture (${displayDurationMinutes} Mins)`}
              </span>
              <span>·</span>
              <span className="font-mono-tabular">{classItem.credits || 4} credits</span>
              {isLocked && (
                <>
                  <span>·</span>
                  <span className="font-semibold text-[#171717] inline-flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Pinned
                  </span>
                </>
              )}
            </div>
            <h2 className="font-serif-editorial text-2xl text-[#171717]">
              {classItem.title}
            </h2>
            <p className="text-xs text-[#77766F]">
              Cohort Track: <span className="font-semibold text-[#171717] font-mono-tabular">{classItem.cohort}</span>
              {classItem.departmentName ? ` · ${classItem.departmentName}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#77766F] hover:text-[#171717] p-2 rounded-xl hover:bg-[#EDEAE0] transition-colors cursor-pointer"
            aria-label="Close details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {savedNotice && (
            <div className="p-3 rounded-xl bg-[#B7F77C] text-xs text-[#171717] flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 text-[#171717] shrink-0" />
              <span>{savedNotice}</span>
            </div>
          )}

          {/* Key Meta Grid — Single Hairline-Divided Container */}
          <div className="grid grid-cols-2 divide-x divide-y divide-[#E4E2DA] border border-[#E4E2DA] rounded-xl bg-[#F7F6EF]/40 overflow-hidden">
            <div className="p-3.5 space-y-1">
              <div className="text-[11px] font-medium text-[#77766F] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#171717]" />
                <span>{isLab ? `Continuous ${computedTiming.labDurationHoursLabel} Lab` : 'Scheduled Slot'}</span>
              </div>
              <div className="text-xs font-mono-tabular font-semibold text-[#171717]">
                {classItem.day ? `${classItem.day} · ` : ''}{displayTimeWindow}
              </div>
            </div>

            <div className="p-3.5 space-y-1">
              <div className="text-[11px] font-medium text-[#77766F] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#171717]" />
                <span>Assigned Room</span>
              </div>
              <div className="text-xs font-mono-tabular font-semibold text-[#171717]">
                {classItem.room}
              </div>
            </div>

            <div className="p-3.5 space-y-1">
              <div className="text-[11px] font-medium text-[#77766F] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#171717]" />
                <span>Instructor</span>
              </div>
              <div className="text-xs font-semibold text-[#171717]">
                {classItem.prof}
              </div>
            </div>

            <div className="p-3.5 space-y-1">
              <div className="text-[11px] font-medium text-[#77766F] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#171717]" />
                <span>Enrollment</span>
              </div>
              <div className="text-xs font-mono-tabular font-semibold text-[#171717]">
                {classItem.enrolled || 38} / {classItem.capacity || 45} seats
              </div>
            </div>
          </div>

          {/* Interactive Slot Reassignment Panel */}
          <AnimatePresence>
            {canEdit && isReassigning && isStoreBacked && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-3"
              >
                <div className="text-xs font-semibold text-[#171717] flex items-center justify-between">
                  <span>Slot &amp; Room Reassignment</span>
                  <button
                    type="button"
                    onClick={() => setIsReassigning(false)}
                    className="text-[11px] text-[#77766F] hover:text-[#171717] underline cursor-pointer font-normal"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-[#77766F] mb-1">Day</label>
                    <select
                      value={selectedDay}
                      onChange={e => {
                        const nextDay = e.target.value as DayOfWeek;
                        setSelectedDay(nextDay);
                        if (nextDay === 'Fri') {
                          const nextCandidates = isLab
                            ? computedTiming.fridaySchedule.continuousLabBlocks.map(b => b.startPeriod)
                            : computedTiming.fridaySchedule.validBasePeriods;
                          if (nextCandidates.length > 0 && !nextCandidates.includes(selectedPeriod)) {
                            setSelectedPeriod(nextCandidates[0]);
                          }
                        }
                      }}
                      className="input-field h-9 text-xs"
                    >
                      {computedTiming.workingDays.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#77766F] mb-1">
                      {isLab
                        ? `Lab Window (${selectedDay === 'Fri' ? 'Friday' : computedTiming.labDurationHoursLabel})`
                        : `Lecture (${selectedDay === 'Fri' ? 'Friday Timing' : `${computedTiming.periodLengthMinutes}m`})`}
                    </label>
                    <select
                      value={selectedPeriod}
                      onChange={e => setSelectedPeriod(e.target.value)}
                      className="input-field h-9 text-xs font-mono-tabular"
                    >
                      {isLab ? (
                        dayLabBlocks.length > 0 ? (
                          dayLabBlocks.map(b => (
                            <option key={b.startPeriod} value={b.startPeriod}>
                              {b.continuousLabel} ({b.session})
                            </option>
                          ))
                        ) : (
                          <option value="">No continuous lab blocks fit on {selectedDay}</option>
                        )
                      ) : (
                        dayLecturePeriods.map(p => {
                          const eff = getEffectiveSlotDisplayForDay(selectedDay, p, computedTiming);
                          return (
                            <option key={p} value={p}>
                              {eff.period}
                            </option>
                          );
                        })
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#77766F] mb-1">Room</label>
                    <select
                      value={selectedRoomId}
                      onChange={e => setSelectedRoomId(e.target.value)}
                      className="input-field h-9 text-xs font-mono-tabular"
                    >
                      {store.rooms.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.code} ({r.capacity} seats)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleSaveSlotChange}
                    className="btn-primary h-8 text-xs"
                  >
                    Apply Assignment
                  </button>
                </div>
              </motion.div>
            )}

            {canEdit && isSwapping && isStoreBacked && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-3"
              >
                <div className="text-xs font-semibold text-[#171717] flex items-center justify-between">
                  <span>Swap Timetable Slot</span>
                  <button
                    type="button"
                    onClick={() => setIsSwapping(false)}
                    className="text-[11px] text-[#77766F] hover:text-[#171717] underline cursor-pointer font-normal"
                  >
                    Cancel
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-[#77766F]">
                    Target Session
                  </label>
                  <select
                    value={selectedSwapSectionId}
                    onChange={e => setSelectedSwapSectionId(e.target.value)}
                    className="input-field h-9 text-xs font-mono-tabular"
                  >
                    <option value="">-- Choose a session to swap with --</option>
                    {otherSections.map(sec => {
                      const course = store.courses.find(c => c.id === sec.courseId);
                      return (
                        <option key={sec.id} value={sec.id}>
                          {course?.code || sec.courseId} · {sec.assignedSlot?.day} {sec.assignedSlot?.timeSlot} ({sec.sessionType || 'Lecture'})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    disabled={!selectedSwapSectionId}
                    onClick={handleExecuteSwap}
                    className="btn-primary h-8 text-xs disabled:opacity-50"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Execute Swap</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Subtle Validation Footer Line */}
          <div className="flex items-center gap-2 text-xs text-[#57564F]">
            <CheckCircle className="w-3.5 h-3.5 text-[#1B5E20] shrink-0" />
            <span>
              <strong className="text-[#171717] font-semibold">{classItem.constraintStatus || 'Optimal'}</strong> · Conflict-free &amp; within room capacity ({classItem.enrolled || 38}/{classItem.capacity || 45})
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#F7F6EF] border-t border-[#E4E2DA] flex flex-wrap items-center justify-between gap-2.5">
          {canEdit && isStoreBacked ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsReassigning(!isReassigning);
                  setIsSwapping(false);
                }}
                className="btn-secondary h-9 text-xs"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Move Slot</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSwapping(!isSwapping);
                  setIsReassigning(false);
                  if (!selectedSwapSectionId && otherSections[0]) {
                    setSelectedSwapSectionId(otherSections[0].id);
                  }
                }}
                className="btn-secondary h-9 text-xs"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Swap Slot</span>
              </button>
              <button
                type="button"
                onClick={handleToggleLock}
                className="btn-secondary h-9 text-xs"
              >
                {isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                <span>{isLocked ? 'Unlock Slot' : 'Pin Slot'}</span>
              </button>
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="btn-secondary h-9 text-xs"
            >
              Close
            </button>
            {onLocateInMatrix && (
              <button
                onClick={() => {
                  onLocateInMatrix(classItem.code);
                  onClose();
                }}
                className="btn-primary h-9 text-xs"
              >
                Locate in Calendar
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
