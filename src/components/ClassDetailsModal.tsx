import React from 'react';
import { X, Clock, MapPin, User, Users, CheckCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface ClassItem {
  id: string;
  code: string;
  title: string;
  room: string;
  prof: string;
  cohort: string;
  capacity?: number;
  enrolled?: number;
  time?: string;
  day?: string;
  type?: 'Lecture' | 'Laboratory' | 'Studio' | 'Recitation';
  credits?: number;
  accent: 'plum' | 'terracotta' | 'emerald';
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
  if (!classItem) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/45 backdrop-blur-xs"
      />

      {/* Modal Container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative bg-white border border-[#ece6ed] rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden z-10"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#ece6ed] flex items-start justify-between bg-gradient-to-r from-white via-[#fffbfa] to-[#fbf8fc]">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-white border border-[#ece6ed] text-[#9c4126] shadow-xs mb-1">
              <span className={`w-1.5 h-1.5 rounded-full ${classItem.accent === 'plum' ? 'bg-[#3b1e4a]' : classItem.accent === 'emerald' ? 'bg-[#18794e]' : 'bg-[#c84c16]'}`}></span>
              {classItem.type || 'Academic Lecture'} • {classItem.credits || 4} Credits
            </div>
            <h2 className="text-xl font-black text-[#1f1b20]">{classItem.code}: {classItem.title}</h2>
            <p className="text-xs text-[#655d69]">Assigned to Cohort: <strong className="text-[#1f1b20]">{classItem.cohort}</strong></p>
          </div>
          <button 
            onClick={onClose}
            className="text-[#7c747f] hover:text-[#1f1b20] p-2 rounded-xl hover:bg-[#ece6ed] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Key Meta Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 bg-[#fbf8fc] rounded-xl border border-[#ece6ed] space-y-1">
              <div className="text-[10px] font-mono uppercase text-[#7c747f] font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#9c4126]" />
                Schedule Slot
              </div>
              <div className="text-xs font-bold text-[#1f1b20]">{classItem.day ? `${classItem.day} • ` : ''}{classItem.time || '09:00 - 10:30'}</div>
            </div>

            <div className="p-3.5 bg-[#fbf8fc] rounded-xl border border-[#ece6ed] space-y-1">
              <div className="text-[10px] font-mono uppercase text-[#7c747f] font-bold flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#3b1e4a]" />
                Facility & Room
              </div>
              <div className="text-xs font-bold text-[#1f1b20]">{classItem.room}</div>
            </div>

            <div className="p-3.5 bg-[#fbf8fc] rounded-xl border border-[#ece6ed] space-y-1">
              <div className="text-[10px] font-mono uppercase text-[#7c747f] font-bold flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#18794e]" />
                Faculty Member
              </div>
              <div className="text-xs font-bold text-[#1f1b20]">{classItem.prof}</div>
            </div>

            <div className="p-3.5 bg-[#fbf8fc] rounded-xl border border-[#ece6ed] space-y-1">
              <div className="text-[10px] font-mono uppercase text-[#7c747f] font-bold flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#c84c16]" />
                Enrolled Capacity
              </div>
              <div className="text-xs font-bold text-[#1f1b20] font-mono">{classItem.enrolled || 48} / {classItem.capacity || 50} seats</div>
            </div>
          </div>

          {/* Solver Verification Badge */}
          <div className="p-4 rounded-xl border border-[#ece6ed] bg-gradient-to-br from-[#f1fbf5] to-[#e8f7ee] flex items-start gap-3 shadow-xs">
            <CheckCircle className="w-5 h-5 text-[#18794e] shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-bold text-[#0f5431]">
                Deterministic Solver Validation: 100% Collision-Free
              </div>
              <p className="text-[#3c6b4e] text-xs leading-relaxed">
                Zero hard constraints violated. Adjacent walking buffer: 18 minutes (exceeds 10-min minimum campus threshold). Circadian energy alignment: 94.2%.
              </p>
            </div>
          </div>

          {/* Student Commute Impact */}
          <div className="border border-[#ece6ed] rounded-xl p-4 bg-white space-y-2">
            <div className="text-xs font-mono uppercase tracking-wider text-[#7c747f] font-bold flex items-center justify-between">
              <span>Transit Buffer Analysis</span>
              <span className="text-[#18794e] font-bold">Optimal Margin</span>
            </div>
            <div className="flex items-center justify-between text-xs text-[#1f1b20]">
              <span>Campus Shuttle Arrival Margin:</span>
              <span className="font-mono font-bold text-[#18794e]">+16 mins prior</span>
            </div>
            <div className="w-full bg-[#ece6ed] rounded-full h-1.5 overflow-hidden">
              <div className="bg-[#18794e] h-1.5 rounded-full" style={{ width: '88%' }}></div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#fbf8fc] border-t border-[#ece6ed] flex items-center justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 border border-[#ece6ed] rounded-xl text-xs font-bold uppercase tracking-wider text-[#655d69] hover:bg-white transition-colors cursor-pointer"
          >
            Close Details
          </button>
          <button 
            onClick={() => {
              onLocateInMatrix?.(classItem.code);
              onClose();
            }}
            className="px-4 py-2 bg-gradient-to-r from-[#9c4126] to-[#b3401f] text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:from-[#83341d] hover:to-[#9c4126] transition-all shadow-md cursor-pointer"
          >
            Inspect in Matrix
          </button>
        </div>
      </motion.div>
    </div>
  );
};
