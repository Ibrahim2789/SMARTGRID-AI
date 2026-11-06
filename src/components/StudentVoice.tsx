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
      question: 'Protect 12:00 - 13:00 Daily Campus Lunch & Mental Recharge Window',
      category: 'Wellbeing Policy',
      votesYes: 2841,
      votesNo: 112,
      userVoted: null as 'yes' | 'no' | null,
      wash: 'from-[#f1fbf5] via-white to-[#e8f7ee]'
    },
    {
      id: 'p2',
      question: 'Cap Consecutive Academic Lecture Blocks at 3 Hours Maximum',
      category: 'Cognitive Load',
      votesYes: 3410,
      votesNo: 189,
      userVoted: null as 'yes' | 'no' | null,
      wash: 'from-[#faf4fc] via-white to-[#f4eaf7]'
    },
    {
      id: 'p3',
      question: 'Ban Friday Afternoon (> 15:00) Heavy Midterms & Mandatory Recitations',
      category: 'Schedule Balance',
      votesYes: 4102,
      votesNo: 84,
      userVoted: null as 'yes' | 'no' | null,
      wash: 'from-[#fff7f2] via-white to-[#fff0eb]'
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
    <div className="min-h-screen bg-[#fbf8fc] text-[#1f1b20] font-sans antialiased">
      {!hideNav && (
        <SmartGridNav 
          activeRoute="student-voice" 
          onNavigate={onNavigate} 
          onOpenAuth={onOpenAuth}
          onSignOut={onSignOut}
          currentUser={currentUser}
        />
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {/* Subheader Hero with Atmospheric Wash */}
        <section className="p-8 bg-gradient-to-br from-[#fff7f2] via-white to-[#faf4fc] border border-[#ece6ed] rounded-xl shadow-sm space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f6f2f7] text-[11px] font-mono font-semibold text-[#9c4126] uppercase tracking-wider">
            <HeartHandshake className="w-3.5 h-3.5 text-[#9c4126]" />
            Circadian Rhythm & Student Voice Telemetry
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#1f1b20] tracking-tight leading-tight">
            Human-Centric Timetable Adaptation
          </h1>
          <p className="text-xs sm:text-sm text-[#655d69] leading-relaxed max-w-3xl">
            Schedules shouldn't force artificial circadian fatigue. SmartGrid AI directly ingests student commute times, chronotypes, and verified union referendums to eliminate academic burnout before schedules are published.
          </p>
        </section>

        {/* 2-Column: Circadian Chronotypes & Commuter Transit Radar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Circadian Chronotype Engine */}
          <section className="lg:col-span-6 bg-white border border-[#ece6ed] rounded-xl p-6 lg:p-8 shadow-sm space-y-6">
            <div className="border-b border-[#ece6ed] pb-3">
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#9c4126] font-bold">Circadian Alignment</span>
              <h2 className="text-xl font-bold text-[#1f1b20] mt-0.5">Chronotype Energy Optimization</h2>
              <p className="text-xs text-[#655d69] mt-1">
                Align high-intensity lectures (e.g., Quantum Mechanics, Multivariable Calculus) with cohort cognitive peaks.
              </p>
            </div>

            {/* Chronotype Selector Cards - Atmospheric Washes with Strictly Neutral Borders */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setSelectedChronotype('early')}
                className={`p-3.5 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] text-center transition-all cursor-pointer shadow-xs ${
                  selectedChronotype === 'early'
                    ? 'bg-gradient-to-br from-[#fff7f2] to-[#fff0eb] shadow-md'
                    : 'bg-[#fbf8fc] hover:bg-white'
                }`}
              >
                <Sun className={`w-5 h-5 mx-auto mb-1.5 ${selectedChronotype === 'early' ? 'text-[#f27438]' : 'text-[#7c747f]'}`} />
                <div className="text-xs font-bold text-[#1f1b20]">Morning Peak</div>
                <div className="text-[10px] font-mono text-[#7c747f] mt-0.5">08:00 - 13:00</div>
              </button>

              <button
                onClick={() => setSelectedChronotype('balanced')}
                className={`p-3.5 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] text-center transition-all cursor-pointer shadow-xs ${
                  selectedChronotype === 'balanced'
                    ? 'bg-gradient-to-br from-[#f1fbf5] to-[#e8f7ee] shadow-md'
                    : 'bg-[#fbf8fc] hover:bg-white'
                }`}
              >
                <Coffee className={`w-5 h-5 mx-auto mb-1.5 ${selectedChronotype === 'balanced' ? 'text-[#18794e]' : 'text-[#7c747f]'}`} />
                <div className="text-xs font-bold text-[#1f1b20]">Balanced Anchor</div>
                <div className="text-[10px] font-mono text-[#7c747f] mt-0.5">10:00 - 16:00</div>
              </button>

              <button
                onClick={() => setSelectedChronotype('evening')}
                className={`p-3.5 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] text-center transition-all cursor-pointer shadow-xs ${
                  selectedChronotype === 'evening'
                    ? 'bg-gradient-to-br from-[#faf4fc] to-[#f4eaf7] shadow-md'
                    : 'bg-[#fbf8fc] hover:bg-white'
                }`}
              >
                <Moon className={`w-5 h-5 mx-auto mb-1.5 ${selectedChronotype === 'evening' ? 'text-[#3b1e4a]' : 'text-[#7c747f]'}`} />
                <div className="text-xs font-bold text-[#1f1b20]">Evening Focus</div>
                <div className="text-[10px] font-mono text-[#7c747f] mt-0.5">12:30 - 18:30</div>
              </button>
            </div>

            {/* Simulated Energy vs Time Profile with Chromatic Gradient Waves */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-[#1f1b20]">
                <span>Predicted Cognitive Alertness Curve</span>
                <span className="font-mono text-[#18794e] bg-[#eaf8f0] px-2 py-0.5 rounded font-bold">Target: 10:30 AM Peak</span>
              </div>
              <div className="bg-gradient-to-b from-[#fdfbfd] to-[#fbf8fc] border border-[#ece6ed] rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#655d69] font-bold">
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
                      <div className="bg-gradient-to-t from-[#9c4126] to-[#f27438] h-[95%] rounded-t" title="Alertness 95%"></div>
                      <div className="bg-gradient-to-t from-[#9c4126] to-[#f27438] h-[100%] rounded-t" title="Alertness 100%"></div>
                      <div className="bg-gradient-to-t from-[#9c4126] to-[#f27438] h-[80%] rounded-t" title="Alertness 80%"></div>
                      <div className="bg-[#9c4126]/60 h-[65%] rounded-t" title="Alertness 65%"></div>
                      <div className="bg-[#9c4126]/40 h-[45%] rounded-t" title="Alertness 45%"></div>
                      <div className="bg-[#9c4126]/20 h-[30%] rounded-t" title="Alertness 30%"></div>
                    </>
                  ) : selectedChronotype === 'evening' ? (
                    <>
                      <div className="bg-[#3b1e4a]/20 h-[35%] rounded-t" title="Alertness 35%"></div>
                      <div className="bg-[#3b1e4a]/50 h-[55%] rounded-t" title="Alertness 55%"></div>
                      <div className="bg-gradient-to-t from-[#3b1e4a] to-[#7209b7] h-[80%] rounded-t" title="Alertness 80%"></div>
                      <div className="bg-gradient-to-t from-[#3b1e4a] to-[#7209b7] h-[100%] rounded-t" title="Alertness 100%"></div>
                      <div className="bg-gradient-to-t from-[#3b1e4a] to-[#7209b7] h-[92%] rounded-t" title="Alertness 92%"></div>
                      <div className="bg-[#3b1e4a] h-[85%] rounded-t" title="Alertness 85%"></div>
                    </>
                  ) : (
                    <>
                      <div className="bg-[#18794e]/50 h-[60%] rounded-t" title="Alertness 60%"></div>
                      <div className="bg-gradient-to-t from-[#18794e] to-[#25a26c] h-[92%] rounded-t" title="Alertness 92%"></div>
                      <div className="bg-gradient-to-t from-[#18794e] to-[#25a26c] h-[98%] rounded-t" title="Alertness 98%"></div>
                      <div className="bg-gradient-to-t from-[#18794e] to-[#25a26c] h-[90%] rounded-t" title="Alertness 90%"></div>
                      <div className="bg-gradient-to-t from-[#18794e] to-[#25a26c] h-[78%] rounded-t" title="Alertness 78%"></div>
                      <div className="bg-[#18794e]/40 h-[48%] rounded-t" title="Alertness 48%"></div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Lunch buffer protection switch */}
            <div className="p-4 bg-gradient-to-br from-[#fff7f2] via-white to-[#fff0eb] rounded-xl border border-[#ece6ed] flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#9c4126] to-[#f27438] text-white flex items-center justify-center shadow-xs">
                  <Coffee className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#1f1b20]">Campus Noon Recharge Lock</div>
                  <div className="text-[11px] text-[#7c747f]">Prevents scheduling classes from 12:00 to 13:00</div>
                </div>
              </div>
              <button
                onClick={() => setLunchBufferLocked(!lunchBufferLocked)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${lunchBufferLocked ? 'bg-[#18794e]' : 'bg-[#dcd6df]'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${lunchBufferLocked ? 'left-6.5' : 'left-0.5'}`} />
              </button>
            </div>
          </section>

          {/* Commuter Transit Buffer & Campus Geography Engine */}
          <section className="lg:col-span-6 bg-white border border-[#ece6ed] rounded-xl p-6 lg:p-8 shadow-sm space-y-6">
            <div className="border-b border-[#ece6ed] pb-3">
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#9c4126] font-bold">Transit Geography</span>
              <h2 className="text-xl font-bold text-[#1f1b20] mt-0.5">Commuter Buffer & Walking Step Matrix</h2>
              <p className="text-xs text-[#655d69] mt-1">
                Ensures realistic transit windows between regional transit hubs and opposite campus quads.
              </p>
            </div>

            {/* Mode Selector */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'train' as const, label: 'Suburban Rail', icon: Train },
                { id: 'bus' as const, label: 'City Bus', icon: Bus },
                { id: 'bike' as const, label: 'Active Bike', icon: Bike },
                { id: 'car' as const, label: 'Carpool', icon: Car }
              ].map(m => {
                const Icon = m.icon;
                const isSel = commuteMode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setCommuteMode(m.id)}
                    className={`p-3 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] flex flex-col items-center justify-center transition-all cursor-pointer shadow-xs ${
                      isSel ? 'bg-gradient-to-br from-[#3b1e4a] to-[#5a2a71] text-white shadow-md' : 'bg-[#fbf8fc] text-[#655d69] hover:bg-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 mb-1" />
                    <span className="text-[10px] font-bold">{m.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Commute slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-[#1f1b20]">
                <span>Average Door-to-Campus Commute:</span>
                <span className="font-mono text-[#9c4126] font-bold bg-[#fff0eb] px-2 py-0.5 rounded">{commuteDuration} minutes</span>
              </div>
              <input
                type="range"
                min="10"
                max="90"
                step="5"
                value={commuteDuration}
                onChange={e => setCommuteDuration(Number(e.target.value))}
                className="w-full h-2 bg-[#ece6ed] rounded-lg appearance-none cursor-pointer accent-[#9c4126]"
              />
              <div className="text-[11px] text-[#7c747f]">
                {commuteDuration > 45 ? 'High commute impact: Morning class window shifted to 09:15 AM start.' : 'Standard commute window: 15-minute inter-building buffer enforced.'}
              </div>
            </div>

            {/* Campus Walking Distances Radar */}
            <div className="space-y-2 pt-1">
              <div className="text-xs font-bold text-[#1f1b20]">Cross-Campus Walking Speed Constraints</div>
              <div className="divide-y divide-[#ece6ed] bg-[#fbf8fc] border border-[#ece6ed] rounded-xl text-xs">
                <div className="p-3 flex items-center justify-between">
                  <span className="font-medium text-[#1f1b20]">Science Quad B ↔ South Engineering</span>
                  <span className="font-mono text-[#18794e] font-bold bg-[#eaf8f0] px-2 py-0.5 rounded">12 mins (Buffer: 20 mins)</span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="font-medium text-[#1f1b20]">Architecture Atrium ↔ Chemistry Lab B</span>
                  <span className="font-mono text-[#18794e] font-bold bg-[#eaf8f0] px-2 py-0.5 rounded">8 mins (Buffer: 15 mins)</span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="font-medium text-[#1f1b20]">Humanities Hall ↔ Medical Annex</span>
                  <span className="font-mono text-[#9c4126] font-bold bg-[#fff0eb] px-2 py-0.5 rounded">17 mins (Buffer: 25 mins)</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Student Voice Polling & Cohort Democratic Input - Neutral Borders with Atmospheric Washes */}
        <section className="bg-white border border-[#ece6ed] rounded-xl p-6 lg:p-8 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#ece6ed] pb-4">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#9c4126] font-bold">Student Governance Matrix</span>
              <h2 className="text-2xl font-bold text-[#1f1b20]">Live Academic Scheduling Referendums</h2>
              <p className="text-xs text-[#655d69] mt-0.5">
                Verified student senate voting results are ingested as hard algorithmic penalty scalars in each semester cycle.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#18794e] bg-[#eefcf2] px-3.5 py-1.5 rounded-xl">
                10,353 Total Verified Votes
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {polls.map(poll => {
              const total = poll.votesYes + poll.votesNo;
              const pctYes = Math.round((poll.votesYes / total) * 100);

              return (
                <div key={poll.id} className={`p-5 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] bg-gradient-to-br ${poll.wash} flex flex-col justify-between space-y-4 shadow-xs hover:shadow-md transition-all`}>
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#9c4126] font-bold">
                      {poll.category}
                    </span>
                    <h3 className="text-sm font-bold text-[#1f1b20] leading-snug">
                      {poll.question}
                    </h3>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-mono font-semibold">
                        <span className="text-[#18794e]">{pctYes}% In Favor</span>
                        <span className="text-[#7c747f]">{total} votes</span>
                      </div>
                      <div className="w-full bg-[#ece6ed] rounded-full h-2 overflow-hidden flex">
                        <div className="bg-gradient-to-r from-[#18794e] to-[#25a26c] h-2 transition-all duration-300" style={{ width: `${pctYes}%` }}></div>
                        <div className="bg-[#dcd6df] h-2 transition-all duration-300" style={{ width: `${100 - pctYes}%` }}></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => handleVote(poll.id, 'yes')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider border border-[#ece6ed] transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          poll.userVoted === 'yes'
                            ? 'bg-[#18794e] text-white shadow-sm'
                            : 'bg-white text-[#18794e] hover:bg-[#eefcf2]'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        Vote Yes
                      </button>
                      <button
                        onClick={() => handleVote(poll.id, 'no')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider border border-[#ece6ed] transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          poll.userVoted === 'no'
                            ? 'bg-[#3b1e4a] text-white shadow-sm'
                            : 'bg-white text-[#655d69] hover:bg-[#f6f2f7]'
                        }`}
                      >
                        Vote No
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
};
