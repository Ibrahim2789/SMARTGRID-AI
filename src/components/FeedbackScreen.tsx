import React from 'react';
import { RouteType } from './SmartGridNav';

interface FeedbackScreenProps {
  onNavigate: (route: RouteType) => void;
}

export const FeedbackScreen: React.FC<FeedbackScreenProps> = () => {
  const pollItems = [
    {
      title: 'Morning 08:30 Lecture Cognitive Alertness',
      responses: 420,
      approval: '74% favorable for stem cohorts',
      status: 'Active'
    },
    {
      title: 'Transit Buffer Between North & South Campuses',
      responses: 680,
      approval: '89% request minimum 30-min buffer',
      status: 'Reviewed'
    },
    {
      title: 'Friday Afternoon Laboratory Sessions',
      responses: 310,
      approval: '62% request conclusion by 16:00',
      status: 'Active'
    }
  ];

  return (
    <div className="max-w-[760px] mx-auto px-6 py-10 md:py-12 space-y-8">
      <div>
        <h1 className="text-[28px] font-semibold text-[#1B2430] tracking-tight">
          Feedback
        </h1>
        <p className="text-[16px] text-[#556070] mt-1.5">
          Student circadian surveys and commute transit poll results.
        </p>
      </div>

      <div className="content-card overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E8EAEE] bg-[#F6F7F9] flex items-center justify-between">
          <span className="text-[15px] font-semibold text-[#1B2430]">Active student surveys</span>
          <span className="text-[14px] text-[#556070]">{pollItems.length} active topics</span>
        </div>

        <div className="divide-y divide-[#E8EAEE]">
          {pollItems.map((poll, idx) => (
            <div key={idx} className="p-6 hover:bg-[#F6F7F9] transition-colors space-y-1.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-semibold text-[#1B2430]">{poll.title}</h3>
                <span className="text-[13px] font-medium text-[#15803D] bg-[#F0FDF4] px-2 py-0.5 rounded border border-[#BBF7D0]">
                  {poll.status}
                </span>
              </div>
              <div className="text-[14px] text-[#556070]">{poll.approval}</div>
              <div className="text-[13px] text-[#7A8594]">{poll.responses} student responses recorded</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
