import React, { useState } from 'react';
import { SmartGridNav, RouteType } from './SmartGridNav';
import { 
  HeartHandshake, 
  Sun, 
  Moon, 
  Coffee, 
  Check, 
  Bus, 
  Bike, 
  Car, 
  Train 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StudentVoiceProps {
  onNavigate?: (route: RouteType) => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
  onSignOut?: () => void;
  currentUser?: { name: string; role: string; institution?: string } | null;
  hideNav?: boolean;
}

export const StudentVoice: React.FC<StudentVoiceProps> = ({ 
  onNavigate,
  onOpenAuth,
  onSignOut,
  currentUser,
  hideNav = false
}) => {
  // Chronotype state
  const [selectedChronotype, setSelectedChronotype] = useState<'early' | 'balanced' | 'evening'>('balanced');
  
  // Transit Mode state
  const [commuteMode, setCommuteMode] = useState<'train' | 'bus' | 'bike' | 'car'>('train');
  const [commuteDuration, setCommuteDuration] = useState(35);
  const [lunchBufferLocked, setLunchBufferLocked] = useState(true);

  // Poll voting state
  const [polls, setPolls] = useState([
    {
      id: 'p1',
      question: 'Protect 12:00 - 13:00 daily campus lunch and recharge window',
      category: 'Wellbeing policy',
      votesYes: 2841,
      votesNo: 112,
      userVoted: null as 'yes' | 'no' | null
    },
    {
      id: 'p2',
      question: 'Cap consecutive academic lecture blocks at 3 hours maximum',
      category: 'Cognitive load',
      votesYes: 3410,
      votesNo: 189,
      userVoted: null as 'yes' | 'no' | null
    },
    {
      id: 'p3',
      question: 'Ban Friday afternoon (> 15:00) heavy exams and required recitations',
      category: 'Schedule balance',
      votesYes: 4102,
      votesNo: 84,
      userVoted: null as 'yes' | 'no' | null
    }
  ]);

  const handleVote = (pollId: string, choice: 'yes' | 'no') => {
    setPolls(prev => prev.map(p => {
      if (p.id !== pollId) return p;
      if (p.userVoted === choice) return p;
      const prevVoted = p.userVoted;
      return {
        ...p,
        userVoted: choice,
        votesYes: choice === 'yes' ? p.votesYes + 1 : (prevVoted === 'yes' ? p.votesYes - 1 : p.votesYes),
        votesNo: choice === 'no' ? p.votesNo + 1 : (prevVoted === 'no' ? p.votesNo - 1 : p.votesNo)
      };
    }));
  };

  return (
    <div className="min-h-screen bg-app text-primary antialiased">
      {!hideNav && (
        <SmartGridNav 
          activeRoute="student-voice" 
          onNavigate={onNavigate} 
          onOpenAuth={onOpenAuth}
          onSignOut={onSignOut}
          currentUser={currentUser}
        />
      )}

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Page Title & Subtitle */}
        <div className="pb-4 border-b border-border">
          <h1 className="text-2xl sm:text-[30px] font-semibold text-primary tracking-tight">Student feedback</h1>
          <p className="text-[15px] text-secondary mt-1">
            Circadian chronotypes, commute walking buffers, and student union referendums
          </p>
        </div>

        {/* 2-Column: Chronotypes & Commuter Radar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Circadian Chronotype Engine */}
          <section className="lg:col-span-6 bg-surface border border-border rounded-lg p-6 space-y-6">
            <div className="border-b border-border pb-4">
              <h2 className="text-base font-semibold text-primary">Chronotype energy optimization</h2>
              <p className="text-[13px] text-secondary mt-0.5">
                Align high-intensity STEM lectures with cohort cognitive peaks
              </p>
            </div>

            {/* Chronotype Selector */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setSelectedChronotype('early')}
                className={`p-3.5 rounded-md border text-center transition-colors cursor-pointer text-[14px] ${
                  selectedChronotype === 'early'
                    ? 'border-brand bg-brand/5 text-primary'
                    : 'border-border bg-surface hover:bg-subtle text-secondary'
                }`}
              >
                <Sun className={`w-5 h-5 mx-auto mb-1.5 ${selectedChronotype === 'early' ? 'text-brand' : 'text-secondary'}`} />
                <div className="font-medium text-primary">Morning peak</div>
                <div className="text-[13px] font-mono text-secondary mt-1">08:00 - 13:00</div>
              </button>

              <button
                onClick={() => setSelectedChronotype('balanced')}
                className={`p-3.5 rounded-md border text-center transition-colors cursor-pointer text-[14px] ${
                  selectedChronotype === 'balanced'
                    ? 'border-brand bg-brand/5 text-primary'
                    : 'border-border bg-surface hover:bg-subtle text-secondary'
                }`}
              >
                <Coffee className={`w-5 h-5 mx-auto mb-1.5 ${selectedChronotype === 'balanced' ? 'text-brand' : 'text-secondary'}`} />
                <div className="font-medium text-primary">Balanced anchor</div>
                <div className="text-[13px] font-mono text-secondary mt-1">10:00 - 16:00</div>
              </button>

              <button
                onClick={() => setSelectedChronotype('evening')}
                className={`p-3.5 rounded-md border text-center transition-colors cursor-pointer text-[14px] ${
                  selectedChronotype === 'evening'
                    ? 'border-brand bg-brand/5 text-primary'
                    : 'border-border bg-surface hover:bg-subtle text-secondary'
                }`}
              >
                <Moon className={`w-5 h-5 mx-auto mb-1.5 ${selectedChronotype === 'evening' ? 'text-brand' : 'text-secondary'}`} />
                <div className="font-medium text-primary">Evening focus</div>
                <div className="text-[13px] font-mono text-secondary mt-1">12:30 - 18:30</div>
              </button>
            </div>

            {/* Cognitive Alertness Curve */}
            <div className="space-y-2">
              <div className="flex justify-between text-[14px]">
                <span className="font-medium text-primary">Predicted cognitive alertness curve</span>
                <span className="font-mono text-[13px] text-success font-medium">Target: 10:30 AM peak</span>
              </div>
              <div className="bg-subtle border border-border rounded-md p-4 space-y-2.5">
                <div className="flex items-center justify-between text-[13px] font-mono text-secondary">
                  <span>08:00</span>
                  <span>10:00</span>
                  <span>12:00</span>
                  <span>14:00</span>
                  <span>16:00</span>
                  <span>18:00</span>
                </div>
                <div className="grid grid-cols-6 gap-2.5 h-16 items-end">
                  {selectedChronotype === 'early' ? (
                    <>
                      <div className="bg-brand h-[95%] rounded-xs" title="Alertness 95%" />
                      <div className="bg-brand h-[100%] rounded-xs" title="Alertness 100%" />
                      <div className="bg-brand/80 h-[80%] rounded-xs" title="Alertness 80%" />
                      <div className="bg-slate-400 dark:bg-slate-600 h-[65%] rounded-xs" title="Alertness 65%" />
                      <div className="bg-slate-400 dark:bg-slate-600 h-[45%] rounded-xs" title="Alertness 45%" />
                      <div className="bg-slate-400 dark:bg-slate-600 h-[30%] rounded-xs" title="Alertness 30%" />
                    </>
                  ) : selectedChronotype === 'evening' ? (
                    <>
                      <div className="bg-slate-400 dark:bg-slate-600 h-[35%] rounded-xs" title="Alertness 35%" />
                      <div className="bg-slate-400 dark:bg-slate-600 h-[55%] rounded-xs" title="Alertness 55%" />
                      <div className="bg-brand/70 h-[80%] rounded-xs" title="Alertness 80%" />
                      <div className="bg-brand h-[100%] rounded-xs" title="Alertness 100%" />
                      <div className="bg-brand h-[92%] rounded-xs" title="Alertness 92%" />
                      <div className="bg-brand/80 h-[85%] rounded-xs" title="Alertness 85%" />
                    </>
                  ) : (
                    <>
                      <div className="bg-slate-400 dark:bg-slate-600 h-[60%] rounded-xs" title="Alertness 60%" />
                      <div className="bg-brand h-[92%] rounded-xs" title="Alertness 92%" />
                      <div className="bg-brand h-[98%] rounded-xs" title="Alertness 98%" />
                      <div className="bg-brand h-[90%] rounded-xs" title="Alertness 90%" />
                      <div className="bg-brand/80 h-[78%] rounded-xs" title="Alertness 78%" />
                      <div className="bg-slate-400 dark:bg-slate-600 h-[48%] rounded-xs" title="Alertness 48%" />
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Lunch Buffer Lock Switch */}
            <div className="p-4 bg-surface rounded-md border border-border flex items-center justify-between">
              <div>
                <div className="text-[14px] font-medium text-primary">Daily noon recharge lock</div>
                <div className="text-[13px] text-secondary mt-0.5">Prevents scheduling classes from 12:00 to 13:00</div>
              </div>
              <button
                onClick={() => setLunchBufferLocked(!lunchBufferLocked)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  lunchBufferLocked ? 'bg-brand' : 'bg-slate-300 dark:bg-slate-700'
                }`}
                aria-label="Toggle lunch buffer"
              >
                <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                  lunchBufferLocked ? 'left-5.5' : 'left-0.5'
                }`} />
              </button>
            </div>
          </section>

          {/* Commuter Transit Buffer & Campus Geography Engine */}
          <section className="lg:col-span-6 bg-surface border border-border rounded-lg p-6 space-y-6">
            <div className="border-b border-border pb-4">
              <h2 className="text-base font-semibold text-primary">Commuter transit buffer & walking step matrix</h2>
              <p className="text-[13px] text-secondary mt-0.5">
                Ensures transit windows between transit hubs and campus quads
              </p>
            </div>

            {/* Mode Selector */}
            <div className="grid grid-cols-4 gap-2.5">
              {[
                { id: 'train' as const, label: 'Rail', icon: Train },
                { id: 'bus' as const, label: 'Bus', icon: Bus },
                { id: 'bike' as const, label: 'Bike', icon: Bike },
                { id: 'car' as const, label: 'Carpool', icon: Car }
              ].map(m => {
                const Icon = m.icon;
                const isSel = commuteMode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setCommuteMode(m.id)}
                    className={`h-[38px] px-2.5 rounded-md border flex items-center justify-center gap-2 transition-colors cursor-pointer text-[14px] font-medium ${
                      isSel 
                        ? 'border-brand bg-brand/5 text-brand font-medium' 
                        : 'border-border bg-surface hover:bg-subtle text-secondary'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Commute Duration Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-[14px]">
                <span className="font-medium text-primary">Door-to-campus transit duration</span>
                <span className="font-mono text-primary font-medium">{commuteDuration} minutes</span>
              </div>
              <input
                type="range"
                min="10"
                max="90"
                step="5"
                value={commuteDuration}
                onChange={e => setCommuteDuration(Number(e.target.value))}
                className="w-full h-2 cursor-pointer"
              />
              <div className="text-[13px] text-secondary leading-relaxed">
                {commuteDuration > 45 ? 'High commute impact: morning class start shifted to 09:15 AM.' : 'Standard commute window: 15-minute inter-building buffer enforced.'}
              </div>
            </div>

            {/* Walking Speed Constraints Table */}
            <div className="space-y-2 pt-1">
              <div className="text-[14px] font-medium text-primary">Cross-campus walking paths</div>
              <div className="divide-y divide-border border border-border rounded-md text-[14px] overflow-hidden">
                <div className="p-3 px-3.5 flex items-center justify-between">
                  <span className="text-primary">Science Quad B ↔ South Engineering</span>
                  <span className="font-mono text-secondary text-[13px]">12 mins (Buffer: 20m)</span>
                </div>
                <div className="p-3 px-3.5 flex items-center justify-between">
                  <span className="text-primary">Architecture Atrium ↔ Chemistry Lab B</span>
                  <span className="font-mono text-secondary text-[13px]">8 mins (Buffer: 15m)</span>
                </div>
                <div className="p-3 px-3.5 flex items-center justify-between">
                  <span className="text-primary">Humanities Hall ↔ Medical Annex</span>
                  <span className="font-mono text-secondary text-[13px]">17 mins (Buffer: 25m)</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Student Voice Polling & Referendums */}
        <section className="bg-surface border border-border rounded-lg p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <h2 className="text-base font-semibold text-primary">Student polls & referendums</h2>
              <p className="text-[13px] text-secondary mt-0.5">
                Verified student senate votes ingested as objective penalty weights
              </p>
            </div>
            <span className="text-[13px] font-mono text-secondary">
              10,353 verified votes
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {polls.map(poll => {
              const total = poll.votesYes + poll.votesNo;
              const pctYes = Math.round((poll.votesYes / total) * 100);

              return (
                <div key={poll.id} className="p-5 rounded-lg border border-border bg-surface flex flex-col justify-between space-y-4">
                  <div className="space-y-1.5">
                    <span className="text-[13px] font-medium text-brand">
                      {poll.category}
                    </span>
                    <h3 className="text-[15px] font-semibold text-primary leading-snug">
                      {poll.question}
                    </h3>
                  </div>

                  <div className="space-y-3.5 pt-1">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[13px] font-mono">
                        <span className="text-success font-medium">{pctYes}% in favor</span>
                        <span className="text-secondary">{total.toLocaleString()} votes</span>
                      </div>
                      <div className="w-full bg-subtle rounded-full h-2 overflow-hidden flex">
                        <div className="bg-success h-full transition-all duration-300" style={{ width: `${pctYes}%` }} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <button
                        onClick={() => handleVote(poll.id, 'yes')}
                        className={`h-9 px-3 rounded-md text-[14px] font-medium border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                          poll.userVoted === 'yes'
                            ? 'bg-brand text-white border-brand'
                            : 'bg-surface border-border text-primary hover:bg-subtle'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Vote yes</span>
                      </button>
                      <button
                        onClick={() => handleVote(poll.id, 'no')}
                        className={`h-9 px-3 rounded-md text-[14px] font-medium border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                          poll.userVoted === 'no'
                            ? 'bg-primary text-surface border-primary'
                            : 'bg-surface border-border text-secondary hover:text-primary hover:bg-subtle'
                        }`}
                      >
                        <span>Vote no</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
