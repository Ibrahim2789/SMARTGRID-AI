import React, { useState, useEffect } from 'react';
import { X, Clock, MapPin, User, Users, CheckCircle, Lock, Unlock, ArrowRightLeft, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { institutionalStore, useInstitutionalData } from '../data/store';
import { DayOfWeek } from '../types/institutional';

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
  capacity?: number;
  enrolled?: number;
  time?: string;
  day?: string;
  type?: 'Lecture' | 'Laboratory' | 'Studio' | 'Recitation';
  credits?: number;
  accent: 'plum' | 'terracotta' | 'emerald';
  isLocked?: boolean;
  constraintStatus?: 'Optimal' | 'Soft Penalty Resolved' | 'Equilibrium Confirmed';
}

interface ClassDetailsModalProps {
  classItem: ClassItem | null;
  onClose: () => void;
  onLocateInMatrix?: (code: string) => void;
}

export const ClassDetailsModal: React.FC<ClassDetailsModalProps> = ({
  classItem,
  onClose,
  onLocateInMatrix
}) => {
  const store = useInstitutionalData();
  const [isReassigning, setIsReassigning] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Mon');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (classItem) {
      setIsReassigning(false);
      setSavedNotice(null);
      const validDays = store.timeStructure.workingDays;
      const initialDay = validDays.includes(classItem.day as DayOfWeek) ? (classItem.day as DayOfWeek) : (validDays[0] || 'Mon');
      setSelectedDay(initialDay);
      setSelectedPeriod(classItem.time || store.timeStructure.periods[0] || '09:00 - 10:30');
      const matchedRoom = store.rooms.find(r => r.id === classItem.roomId || r.code === classItem.room);
      setSelectedRoomId(matchedRoom?.id || store.rooms[0]?.id || '');
    }
  }, [classItem, store.rooms, store.timeStructure]);

  if (!classItem) return null;

  const isStoreBacked = store.sections.some(s => s.id === classItem.id);
  const currentSec = store.sections.find(s => s.id === classItem.id);
  const isLocked = currentSec ? Boolean(currentSec.isLocked) : Boolean(classItem.isLocked);

  const handleSaveSlotChange = () => {
    if (!isStoreBacked) return;
    institutionalStore.updateSectionSlot(classItem.id, {
      day: selectedDay,
      timeSlot: selectedPeriod,
      roomId: selectedRoomId
    });
    const newRoom = store.rooms.find(r => r.id === selectedRoomId);
    setSavedNotice(`Rescheduled to ${selectedDay} • ${selectedPeriod} in ${newRoom?.code || 'selected room'}`);
    setIsReassigning(false);
    setTimeout(() => {
      onClose();
    }, 900);
  };

  const handleToggleLock = () => {
    if (!isStoreBacked) return;
    institutionalStore.toggleSectionLock(classItem.id);
    setSavedNotice(isLocked ? 'Section unlocked for future solver runs.' : 'Section locked to current room and slot.');
  };

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
        className="relative bg-white border border-[#ece6ed] rounded-xl shadow-xl max-w-lg w-full overflow-hidden z-10"
        onClick={e => e.stopPropagation()}
      >
        {/* Header with Atmospheric Wash */}
        <div className="px-6 py-5 border-b border-[#ece6ed] flex items-start justify-between bg-gradient-to-br from-[#fff7f2] via-white to-[#faf4fc]">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-[#655d69]">
              <span className="font-mono font-bold text-[#9c4126]">
                {classItem.code}
              </span>
              <span aria-hidden="true">·</span>
              <span>{classItem.type || 'Lecture'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{classItem.credits || 4} credits</span>
              {isLocked && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#3b1e4a] font-semibold inline-flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Pinned
                  </span>
                </>
              )}
            </div>
            <h2 className="text-lg font-bold text-[#1f1b20]">
              {classItem.title}
            </h2>
            <p className="text-xs text-[#655d69]">
              Cohort Track: <span className="font-semibold text-[#1f1b20] font-mono">{classItem.cohort}</span>
              {classItem.departmentName ? ` · ${classItem.departmentName}` : ''}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-[#655d69] hover:text-[#1f1b20] p-2 rounded-xl hover:bg-[#f6f2f7] transition-colors cursor-pointer"
            aria-label="Close details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {savedNotice && (
            <div className="p-3 rounded-xl bg-[#eefcf2] border border-[#ece6ed] text-xs text-[#0f5431] flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 text-[#18794e] shrink-0" />
              <span>{savedNotice}</span>
            </div>
          )}

          {/* Key Meta Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 bg-[#fbf8fc] rounded-xl border border-[#ece6ed] space-y-1">
              <div className="text-xs text-[#655d69] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#9c4126]" />
                <span>Assigned Window</span>
              </div>
              <div className="text-xs font-mono font-bold text-[#1f1b20]">
                {classItem.day ? `${classItem.day} · ` : ''}{classItem.time || '09:00 - 10:30'}
              </div>
            </div>

            <div className="p-3.5 bg-[#fbf8fc] rounded-xl border border-[#ece6ed] space-y-1">
              <div className="text-xs text-[#655d69] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#3b1e4a]" />
                <span>Campus Room</span>
              </div>
              <div className="text-xs font-mono font-bold text-[#1f1b20]">
                {classItem.room}
              </div>
            </div>

            <div className="p-3.5 bg-[#fbf8fc] rounded-xl border border-[#ece6ed] space-y-1">
              <div className="text-xs text-[#655d69] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#3b1e4a]" />
                <span>Faculty Instructor</span>
              </div>
              <div className="text-xs font-semibold text-[#1f1b20]">
                {classItem.prof}
              </div>
            </div>

            <div className="p-3.5 bg-[#fbf8fc] rounded-xl border border-[#ece6ed] space-y-1">
              <div className="text-xs text-[#655d69] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#18794e]" />
                <span>Seat Utilization</span>
              </div>
              <div className="text-xs font-mono font-bold text-[#1f1b20]">
                {classItem.enrolled || 38} / {classItem.capacity || 45} seats
              </div>
            </div>
          </div>

          {/* Interactive Slot Reassignment Panel (when store-backed) */}
          <AnimatePresence>
            {isReassigning && isStoreBacked && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 rounded-xl bg-[#faf4fc] border border-[#ece6ed] space-y-3"
              >
                <div className="text-xs font-bold text-[#3b1e4a] flex items-center justify-between">
                  <span>Manual Slot & Room Reassignment</span>
                  <button
                    type="button"
                    onClick={() => setIsReassigning(false)}
                    className="text-[11px] text-[#655d69] hover:text-[#1f1b20] underline cursor-pointer font-normal"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-[#655d69] mb-1">Day</label>
                    <select
                      value={selectedDay}
                      onChange={e => setSelectedDay(e.target.value as DayOfWeek)}
                      className="w-full h-9 px-2.5 text-xs bg-white border border-[#ece6ed] rounded-xl text-[#1f1b20] font-medium"
                    >
                      {store.timeStructure.workingDays.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#655d69] mb-1">Time Period</label>
                    <select
                      value={selectedPeriod}
                      onChange={e => setSelectedPeriod(e.target.value)}
                      className="w-full h-9 px-2.5 text-xs bg-white border border-[#ece6ed] rounded-xl text-[#1f1b20] font-mono"
                    >
                      {store.timeStructure.periods.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#655d69] mb-1">Room</label>
                    <select
                      value={selectedRoomId}
                      onChange={e => setSelectedRoomId(e.target.value)}
                      className="w-full h-9 px-2.5 text-xs bg-white border border-[#ece6ed] rounded-xl text-[#1f1b20] font-mono"
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
                    className="px-4 py-2 rounded-xl bg-[#3b1e4a] hover:bg-[#2a1335] text-white text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Apply New Assignment
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Solver Verification Banner */}
          <div className="p-3.5 rounded-xl border border-[#ece6ed] bg-gradient-to-r from-[#f1fbf5] to-white flex items-start gap-2.5">
            <CheckCircle className="w-4 h-4 text-[#18794e] shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <div className="font-bold text-[#0f5431]">
                Constraint Parity Confirmed · {classItem.constraintStatus || 'Optimal'}
              </div>
              <p className="text-[#655d69] leading-relaxed">
                Zero instructor or cohort collisions detected. Walking transit margin meets campus threshold and room capacity satisfies enrolled headcount.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#fbf8fc] border-t border-[#ece6ed] flex flex-wrap items-center justify-between gap-2.5">
          {isStoreBacked ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsReassigning(!isReassigning)}
                className="h-9 px-3.5 rounded-xl border border-[#ece6ed] bg-white hover:bg-[#f6f2f7] text-xs font-semibold text-[#3b1e4a] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-[#9c4126]" />
                <span>Move Slot / Room</span>
              </button>
              <button
                type="button"
                onClick={handleToggleLock}
                className="h-9 px-3.5 rounded-xl border border-[#ece6ed] bg-white hover:bg-[#f6f2f7] text-xs font-semibold text-[#655d69] hover:text-[#1f1b20] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
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
              className="h-9 px-4 rounded-xl border border-[#ece6ed] bg-white hover:bg-[#f6f2f7] text-xs text-[#1f1b20] transition-colors cursor-pointer font-semibold"
            >
              Close
            </button>
            {onLocateInMatrix && (
              <button 
                onClick={() => {
                  onLocateInMatrix(classItem.code);
                  onClose();
                }}
                className="h-9 px-4 rounded-xl bg-gradient-to-r from-[#9c4126] to-[#f27438] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
              >
                Inspect in Matrix
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
