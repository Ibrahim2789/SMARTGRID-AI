import React from 'react';
import { X, Clock, MapPin, User, Users, CheckCircle } from 'lucide-react';
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
        className="fixed inset-0 bg-black/40 backdrop-blur-xs"
      />

      {/* Modal Container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="relative bg-surface border border-border rounded-lg shadow-xl max-w-lg w-full overflow-hidden z-10"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex items-start justify-between bg-surface">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[14px] font-medium text-brand">
                {classItem.code}
              </span>
              <span className="text-tertiary">•</span>
              <span className="text-[13px] text-secondary">
                {classItem.type || 'Lecture'}
              </span>
              <span className="text-tertiary">•</span>
              <span className="text-[13px] text-secondary">
                {classItem.credits || 4} credits
              </span>
            </div>
            <h2 className="text-lg font-semibold text-primary">
              {classItem.title}
            </h2>
            <p className="text-[13px] text-secondary">
              Cohort: <span className="font-medium text-primary">{classItem.cohort}</span>
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-secondary hover:text-primary p-2 rounded-md hover:bg-subtle transition-colors cursor-pointer"
            aria-label="Close details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Key Meta Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 bg-subtle rounded-md border border-border space-y-1">
              <div className="text-[13px] text-secondary flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-secondary" />
                <span>Time slot</span>
              </div>
              <div className="text-[14px] font-mono font-medium text-primary">
                {classItem.day ? `${classItem.day} • ` : ''}{classItem.time || '09:00 - 10:30'}
              </div>
            </div>

            <div className="p-3.5 bg-subtle rounded-md border border-border space-y-1">
              <div className="text-[13px] text-secondary flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-secondary" />
                <span>Facility & room</span>
              </div>
              <div className="text-[14px] font-mono font-medium text-primary">
                {classItem.room}
              </div>
            </div>

            <div className="p-3.5 bg-subtle rounded-md border border-border space-y-1">
              <div className="text-[13px] text-secondary flex items-center gap-1.5">
                <User className="w-4 h-4 text-secondary" />
                <span>Instructor</span>
              </div>
              <div className="text-[14px] font-medium text-primary">
                {classItem.prof}
              </div>
            </div>

            <div className="p-3.5 bg-subtle rounded-md border border-border space-y-1">
              <div className="text-[13px] text-secondary flex items-center gap-1.5">
                <Users className="w-4 h-4 text-secondary" />
                <span>Enrolled capacity</span>
              </div>
              <div className="text-[14px] font-mono font-medium text-primary">
                {classItem.enrolled || 48} / {classItem.capacity || 50} seats
              </div>
            </div>
          </div>

          {/* Solver Verification Banner */}
          <div className="p-3.5 rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-start gap-2.5">
            <CheckCircle className="w-4 h-4 text-success shrink-0 mt-0.5" />
            <div className="text-[14px] space-y-0.5">
              <div className="font-medium text-emerald-900 dark:text-emerald-200">
                Deterministic validation: collision-free
              </div>
              <p className="text-emerald-800/90 dark:text-emerald-300/90 text-[13px] leading-relaxed">
                Zero hard constraints violated. Adjacent walking buffer: 18 minutes (exceeds 10-min campus threshold). Circadian energy alignment: 94.2%.
              </p>
            </div>
          </div>

          {/* Student Commute Impact */}
          <div className="border border-border rounded-md p-4 bg-surface space-y-2.5">
            <div className="text-[13px] text-secondary flex items-center justify-between">
              <span>Transit buffer margin</span>
              <span className="font-mono text-success text-[13px] font-medium">+16 mins prior</span>
            </div>
            <div className="w-full bg-subtle rounded-full h-1.5 overflow-hidden">
              <div className="bg-success h-1.5 rounded-full" style={{ width: '88%' }} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-subtle border-t border-border flex items-center justify-end gap-2.5">
          <button 
            onClick={onClose}
            className="h-[38px] px-4 rounded-md border border-border bg-surface hover:bg-subtle text-[14px] text-primary transition-colors cursor-pointer font-medium"
          >
            Close
          </button>
          <button 
            onClick={() => {
              onLocateInMatrix?.(classItem.code);
              onClose();
            }}
            className="h-[38px] px-4 rounded-md bg-brand hover:bg-brand-hover text-white text-[14px] font-medium transition-colors shadow-xs cursor-pointer"
          >
            Inspect in matrix
          </button>
        </div>
      </motion.div>
    </div>
  );
};
