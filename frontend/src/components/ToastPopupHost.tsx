import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, Check, Info, X } from 'lucide-react';

export interface PopupAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export interface ToastPopupPayload {
  title?: string;
  message: string;
  variant?: 'success' | 'error' | 'info';
  durationMs?: number;
  actions?: PopupAction[];
}

interface ActiveToast extends Required<Pick<ToastPopupPayload, 'message' | 'variant' | 'durationMs'>> {
  id: string;
  title: string;
  actions?: PopupAction[];
}

type ToastListener = (toasts: ActiveToast[]) => void;

const listeners = new Set<ToastListener>();
let activeToasts: ActiveToast[] = [];
let toastCounter = 0;

function notifyListeners() {
  const snapshot = [...activeToasts];
  listeners.forEach(listener => listener(snapshot));
}

export function dismissAppPopup(id: string): void {
  activeToasts = activeToasts.filter(item => item.id !== id);
  notifyListeners();
}

export function showAppPopup(payload: ToastPopupPayload | string): string {
  const normalized: ToastPopupPayload =
    typeof payload === 'string' ? { message: payload } : payload;

  const variant = normalized.variant || 'success';
  const defaultTitle =
    variant === 'error'
      ? 'Action Could Not Complete'
      : variant === 'info'
      ? 'Notice'
      : 'Saved & Updated';

  const durationMs =
    normalized.durationMs ??
    (normalized.actions && normalized.actions.length > 0 ? 7000 : 4800);

  const id = `app-toast-${Date.now()}-${++toastCounter}`;
  const entry: ActiveToast = {
    id,
    title: normalized.title || defaultTitle,
    message: normalized.message,
    variant,
    durationMs,
    actions: normalized.actions
  };

  // Deduplicate identical consecutive messages to avoid stacking noise
  activeToasts = [
    entry,
    ...activeToasts.filter(t => t.message !== entry.message || t.variant !== entry.variant)
  ].slice(0, 3);

  notifyListeners();
  return id;
}

const ToastItem: React.FC<{ toast: ActiveToast }> = ({ toast }) => {
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<number | null>(null);
  const remainingRef = useRef<number>(toast.durationMs);
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (toast.durationMs <= 0) return;

    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    if (isPaused) {
      clearTimer();
      const elapsed = Date.now() - startedAtRef.current;
      remainingRef.current = Math.max(800, remainingRef.current - elapsed);
      return clearTimer;
    }

    startedAtRef.current = Date.now();
    timerRef.current = window.setTimeout(() => {
      dismissAppPopup(toast.id);
    }, remainingRef.current);

    return clearTimer;
  }, [isPaused, toast.durationMs, toast.id]);

  const iconStyle =
    toast.variant === 'error'
      ? 'bg-[#FDE8E8] border-[#F5B7B7] text-[#8A1C1C]'
      : toast.variant === 'info'
      ? 'bg-[#B8EEEE] border-[#96D9D9] text-[#171717]'
      : 'bg-[#B7F77C] border-[#98DF58] text-[#171717]';

  const cardBorderStyle =
    toast.variant === 'error'
      ? 'border-[#F5B7B7]'
      : 'border-[#E4E2DA]';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.96 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="status"
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      className={`pointer-events-auto bg-white border ${cardBorderStyle} rounded-2xl shadow-[0_18px_48px_rgba(23,23,23,0.16)] p-4 flex items-start gap-3`}
    >
      <div
        className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${iconStyle}`}
      >
        {toast.variant === 'error' ? (
          <AlertCircle className="w-4 h-4" />
        ) : toast.variant === 'info' ? (
          <Info className="w-4 h-4" />
        ) : (
          <Check className="w-4 h-4 stroke-[2.5]" />
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="text-xs font-bold text-[#171717] leading-snug">
            {toast.title}
          </div>
          <button
            type="button"
            onClick={() => dismissAppPopup(toast.id)}
            aria-label="Dismiss notification"
            className="text-[#77766F] hover:text-[#171717] p-0.5 rounded-md transition-colors cursor-pointer shrink-0 -mt-0.5 -mr-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-xs text-[#57564F] leading-relaxed break-words">
          {toast.message}
        </p>

        {toast.actions && toast.actions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {toast.actions.map(action => (
              <button
                key={action.label}
                type="button"
                onClick={() => {
                  dismissAppPopup(toast.id);
                  action.onClick();
                }}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  action.variant === 'primary'
                    ? 'bg-[#171717] text-white hover:bg-[#2b2b2b]'
                    : 'bg-[#F7F6EF] text-[#171717] border border-[#E4E2DA] hover:bg-[#EDEAE0]'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const ToastPopupHost: React.FC = () => {
  const [toasts, setToasts] = useState<ActiveToast[]>(() => [...activeToasts]);

  useEffect(() => {
    const listener: ToastListener = next => setToasts(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return (
    <div
      className="fixed top-5 left-1/2 -translate-x-1/2 z-[140] flex flex-col items-center gap-2.5 w-[calc(100vw-2rem)] sm:w-[540px] max-w-full pointer-events-none"
      aria-label="Application notifications"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
};
