import React from 'react';
import { RouteType } from './SmartGridNav';
import { useInstitutionalData } from '../data/store';
import { Check } from 'lucide-react';

interface HomeScreenProps {
  onNavigate: (route: RouteType) => void;
  onOpenSetupStep?: (stepIndex: number) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ 
  onNavigate,
  onOpenSetupStep 
}) => {
  const store = useInstitutionalData();

  // Counts for the 6 setup steps
  const activeTerm = store.terms.find(t => t.status === 'active') || store.terms[0];
  const step1Ready = !!(activeTerm && store.timeStructure.periods.length > 0);
  const step1Text = activeTerm 
    ? `${activeTerm.name}, ${store.timeStructure.periods.length} periods/day` 
    : 'Not configured';

  const step2Count = store.rooms.length;
  const step2Ready = step2Count > 0;
  const step2Text = step2Count > 0 ? `${step2Count} rooms` : 'No rooms yet';

  const step3Count = store.courses.length;
  const step3Ready = step3Count > 0;
  const step3Text = step3Count > 0 ? `${step3Count} courses` : 'No courses yet';

  const step4Count = store.instructors.length;
  const step4Ready = step4Count > 0;
  const step4Text = step4Count > 0 ? `${step4Count} instructors` : 'No instructors yet';

  const step5Count = store.studentGroups.length;
  const step5Ready = step5Count > 0;
  const step5Text = step5Count > 0 ? `${step5Count} student groups` : 'No groups yet';

  const hardRulesCount = store.constraints.filter(c => c.kind === 'hard' && c.enabled).length;
  const softRulesCount = store.constraints.filter(c => c.kind === 'soft' && c.enabled).length;
  const step6Ready = store.constraints.length > 0;
  const step6Text = `${hardRulesCount} hard rules, ${softRulesCount} preferences`;

  const allReady = step1Ready && step2Ready && step3Ready && step4Ready && step5Ready && step6Ready;

  const steps = [
    { num: 1, title: 'Term and time slots', detail: step1Text, ready: step1Ready },
    { num: 2, title: 'Rooms', detail: step2Text, ready: step2Ready },
    { num: 3, title: 'Courses', detail: step3Text, ready: step3Ready },
    { num: 4, title: 'Instructors', detail: step4Text, ready: step4Ready },
    { num: 5, title: 'Student groups', detail: step5Text, ready: step5Ready },
    { num: 6, title: 'Rules', detail: step6Text, ready: step6Ready }
  ];

  const handleStepClick = (stepIndex: number) => {
    onOpenSetupStep?.(stepIndex);
    onNavigate('setup');
  };

  const handlePrimaryClick = () => {
    if (allReady) {
      onNavigate('generate');
    } else {
      onNavigate('setup');
    }
  };

  return (
    <div className="max-w-[760px] mx-auto px-6 py-10 md:py-12 space-y-8">
      {/* Page Title & Short Description */}
      <div>
        <h1 className="text-[28px] font-semibold text-[#1B2430] tracking-tight">
          Home
        </h1>
        <p className="text-[16px] text-[#556070] mt-1.5">
          Review your timetable data readiness before generating the schedule.
        </p>
      </div>

      {/* ONE Checklist Card */}
      <div className="content-card overflow-hidden">
        <div className="px-6 py-5 border-b border-[#E8EAEE] flex items-center justify-between bg-[#F6F7F9]">
          <span className="text-[15px] font-semibold text-[#1B2430]">
            Setup checklist
          </span>
          <span className="text-[14px] text-[#556070]">
            {steps.filter(s => s.ready).length} of 6 complete
          </span>
        </div>

        <div className="divide-y divide-[#E8EAEE]">
          {steps.map(step => (
            <div 
              key={step.num}
              onClick={() => handleStepClick(step.num - 1)}
              className="px-6 py-4 flex items-center justify-between hover:bg-[#F6F7F9] transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${
                  step.ready 
                    ? 'bg-[#15803D] text-white' 
                    : 'border border-[#E8EAEE] text-[#7A8594]'
                }`}>
                  {step.ready ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : step.num}
                </div>
                <div>
                  <div className="text-[15px] font-medium text-[#1B2430] group-hover:underline">
                    {step.title}
                  </div>
                  <div className="text-[14px] text-[#7A8594]">
                    {step.detail}
                  </div>
                </div>
              </div>

              <span className="text-[14px] text-[#556070] group-hover:text-[#1B2430]">
                Edit &rarr;
              </span>
            </div>
          ))}
        </div>

        {/* Footer with exactly ONE primary button */}
        <div className="p-6 bg-white border-t border-[#E8EAEE] flex items-center justify-between">
          <span className="text-[14px] text-[#556070]">
            {allReady ? 'All input data is verified and ready.' : 'Complete any remaining steps to generate.'}
          </span>
          <button
            onClick={handlePrimaryClick}
            className="btn-primary"
          >
            {allReady ? 'Generate timetable' : 'Continue setup'}
          </button>
        </div>
      </div>
    </div>
  );
};
