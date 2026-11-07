import React, { useState } from 'react';
import { RouteType } from './SmartGridNav';
import { useInstitutionalData } from '../data/store';
import { buildMatrixSchedule } from '../data/solverAdapter';
import { ChevronDown, Play, ArrowRight, CheckCircle2 } from 'lucide-react';

interface GenerateScreenProps {
  onNavigate: (route: RouteType) => void;
}

export const GenerateScreen: React.FC<GenerateScreenProps> = ({ onNavigate }) => {
  const store = useInstitutionalData();
  const [selectedTermId, setSelectedTermId] = useState<string>(
    store.terms.find(t => t.status === 'active')?.id || store.terms[0]?.id || ''
  );
  const [isSolving, setIsSolving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [solved, setSolved] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Advanced options state
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(30);
  const [transitBufferWeight, setTransitBufferWeight] = useState(85);
  const [roomCompactionWeight, setRoomCompactionWeight] = useState(70);

  // Solver run simulation connecting store data
  const handleRunSolver = () => {
    setIsSolving(true);
    setProgress(0);
    setSolved(false);

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 25;
      });
    }, 200);

    setTimeout(() => {
      clearInterval(interval);
      setIsSolving(false);
      setSolved(true);
    }, 1000);
  };

  const handleCancel = () => {
    setIsSolving(false);
    setProgress(0);
  };

  // Compute metrics from current store
  const { conflicts } = buildMatrixSchedule(store);
  const totalSections = store.sections.length;
  const placedSections = store.sections.filter(s => s.assignedSlot).length;
  const unplacedSections = totalSections - placedSections;
  const conflictCount = conflicts.length;

  return (
    <div className="max-w-[760px] mx-auto px-6 py-10 md:py-12 space-y-8">
      {/* Title & Short Description */}
      <div>
        <h1 className="text-[28px] font-semibold text-[#1B2430] tracking-tight">
          Generate
        </h1>
        <p className="text-[16px] text-[#556070] mt-1.5">
          Select an academic term and run the automated timetable scheduler.
        </p>
      </div>

      {/* Main Form Card */}
      <div className="content-card p-6 space-y-6">
        {/* Term Select */}
        <div>
          <label className="block text-[14px] font-medium text-[#1B2430] mb-2">
            Target academic term
          </label>
          <select
            value={selectedTermId}
            onChange={e => setSelectedTermId(e.target.value)}
            disabled={isSolving}
            className="form-input text-[15px]"
          >
            {store.terms.map(term => (
              <option key={term.id} value={term.id}>
                {term.name} ({term.code}) — {term.status === 'active' ? 'Active Term' : term.status}
              </option>
            ))}
          </select>
        </div>

        {/* Closed Advanced Disclosure */}
        <div className="pt-2 border-t border-[#E8EAEE]">
          <button
            type="button"
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="flex items-center gap-2 text-[15px] font-medium text-[#556070] hover:text-[#1B2430] transition-colors cursor-pointer py-1"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${advancedOpen ? 'rotate-180' : ''}`} />
            <span>Advanced options</span>
          </button>

          {advancedOpen && (
            <div className="pt-4 space-y-4">
              <div>
                <div className="flex justify-between text-[14px] mb-1">
                  <label className="text-[#1B2430] font-medium">Solver time limit</label>
                  <span className="font-mono text-[#556070]">{timeLimitSeconds} seconds</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="120"
                  value={timeLimitSeconds}
                  onChange={e => setTimeLimitSeconds(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-[14px] mb-1">
                  <label className="text-[#1B2430] font-medium">Commuter transit buffer weight</label>
                  <span className="font-mono text-[#556070]">{transitBufferWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={transitBufferWeight}
                  onChange={e => setTransitBufferWeight(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-[14px] mb-1">
                  <label className="text-[#1B2430] font-medium">Room compaction weight</label>
                  <span className="font-mono text-[#556070]">{roomCompactionWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={roomCompactionWeight}
                  onChange={e => setRoomCompactionWeight(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* Progress area while running */}
        {isSolving && (
          <div className="p-4 bg-[#F6F7F9] border border-[#E8EAEE] rounded-md space-y-2">
            <div className="flex items-center justify-between text-[14px]">
              <span className="text-[#556070]">Evaluating constraint matrix and slot allocations...</span>
              <div className="flex items-center gap-3">
                <span className="font-mono font-medium text-[#1B2430]">{progress}%</span>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="text-[13px] text-[#DC2626] hover:underline cursor-pointer font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
            <div className="w-full bg-[#E8EAEE] h-2 rounded-full overflow-hidden">
              <div 
                className="bg-[#FFC400] h-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Results showing three numbers (placed, unplaced, conflicts) and View timetable link */}
        {solved && (
          <div className="p-5 border border-[#BBF7D0] bg-[#F0FDF4] rounded-md space-y-4">
            <div className="flex items-center gap-2.5 text-[#15803D]">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span className="text-[15px] font-semibold">Generation complete</span>
            </div>

            <div className="grid grid-cols-3 gap-4 py-2 border-y border-[#BBF7D0]/60">
              <div>
                <div className="text-[13px] text-[#556070]">Placed sections</div>
                <div className="text-[24px] font-bold font-mono text-[#1B2430] mt-0.5">{placedSections}</div>
              </div>
              <div>
                <div className="text-[13px] text-[#556070]">Unplaced</div>
                <div className="text-[24px] font-bold font-mono text-[#1B2430] mt-0.5">{unplacedSections}</div>
              </div>
              <div>
                <div className="text-[13px] text-[#556070]">Conflicts</div>
                <div className={`text-[24px] font-bold font-mono mt-0.5 ${conflictCount > 0 ? 'text-[#DC2626]' : 'text-[#15803D]'}`}>
                  {conflictCount}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onNavigate('timetables')}
                className="text-[15px] font-semibold text-[#1B2430] hover:underline inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>View timetable</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Bottom: Exactly ONE primary button */}
        {!solved && (
          <div className="pt-4 border-t border-[#E8EAEE] flex justify-end">
            <button
              type="button"
              onClick={handleRunSolver}
              disabled={isSolving}
              className="btn-primary"
            >
              <Play className="w-4 h-4 fill-[#1B2430]" />
              <span>{isSolving ? 'Generating...' : 'Generate timetable'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
