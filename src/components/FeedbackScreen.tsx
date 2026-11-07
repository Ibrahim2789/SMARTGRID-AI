import React, { useState } from 'react';
import { RouteType } from './SmartGridNav';
import { useInstitutionalData, institutionalStore } from '../data/store';
import { 
  ThumbsUp, 
  MessageSquarePlus, 
  Check, 
  Users, 
  Clock, 
  Sun, 
  Award,
  ArrowRight
} from 'lucide-react';

interface FeedbackScreenProps {
  onNavigate: (route: RouteType) => void;
}

export const FeedbackScreen: React.FC<FeedbackScreenProps> = ({ onNavigate }) => {
  const store = useInstitutionalData();
  const polls = store.feedbackPolls || [];

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Student Wellbeing');
  const [targetSlot, setTargetSlot] = useState('12:00 - 13:00');
  const [submittedBy, setSubmittedBy] = useState('Academic Department Representative');
  const [description, setDescription] = useState('');
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);

  const totalVotes = polls.reduce((sum, p) => sum + p.votesApprove + p.votesRevise, 0);

  const handleSubmitProposal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    institutionalStore.addFeedbackPoll({
      title: title.trim(),
      category,
      targetSlot,
      submittedBy: submittedBy.trim() || 'Campus Stakeholder',
      description: description.trim(),
      status: 'Active'
    });

    setTitle('');
    setDescription('');
    setSubmitNotice('Submitted new schedule review proposal to the active campus board.');
    setTimeout(() => setSubmitNotice(null), 4000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="p-6 bg-gradient-to-br from-[#faf4fc] via-white to-[#fff7f2] border border-[#ece6ed] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="text-xs font-mono text-[#9c4126] font-bold">
            Campus Stakeholder Review · Circadian & Transit Governance
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1f1b20] tracking-tight mt-0.5">
            Student & Faculty Schedule Feedback
          </h1>
          <p className="text-xs sm:text-sm text-[#655d69] mt-1">
            Review cohort alertness polls, vote on campus scheduling policies, and submit new timetable constraint proposals.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('timetables')}
            className="btn-secondary text-xs"
          >
            <span>Back to Matrix</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="btn-primary text-xs"
          >
            <span>Review System Settings</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {submitNotice && (
        <div className="p-3.5 rounded-xl bg-[#eefcf2] border border-[#ece6ed] text-xs text-[#0f5431] flex items-center gap-2 font-medium">
          <Check className="w-4 h-4 text-[#18794e]" />
          <span>{submitNotice}</span>
        </div>
      )}

      {/* 4 Atmospheric Sentiment KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border border-[#ece6ed] bg-gradient-to-br from-[#faf4fc] via-white to-[#f3e8f8] space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#655d69] font-semibold">
            <span>Circadian Alignment</span>
            <Sun className="w-4 h-4 text-[#3b1e4a]" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-[#1f1b20] tabular-nums">94.8%</div>
          <div className="text-xs text-[#655d69]">Core STEM classes in peak hours</div>
        </div>

        <div className="p-5 rounded-xl border border-[#ece6ed] bg-gradient-to-br from-[#fff7f2] via-white to-[#ffede3] space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#655d69] font-semibold">
            <span>Commuter Transit Approval</span>
            <Clock className="w-4 h-4 text-[#9c4126]" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-[#1f1b20] tabular-nums">96.2%</div>
          <div className="text-xs text-[#655d69]">Zero back-to-back cross-campus sprints</div>
        </div>

        <div className="p-5 rounded-xl border border-[#ece6ed] bg-gradient-to-br from-[#f1fbf5] via-white to-[#e5f6ec] space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#655d69] font-semibold">
            <span>Faculty Balance Score</span>
            <Award className="w-4 h-4 text-[#18794e]" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-[#1f1b20] tabular-nums">98.4%</div>
          <div className="text-xs text-[#655d69]">All blackout windows respected</div>
        </div>

        <div className="p-5 rounded-xl border border-[#ece6ed] bg-gradient-to-br from-[#fffbeb] via-white to-[#fef3c7] space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#655d69] font-semibold">
            <span>Recorded Responses</span>
            <Users className="w-4 h-4 text-[#f27438]" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-[#1f1b20] tabular-nums">{totalVotes.toLocaleString()}</div>
          <div className="text-xs text-[#655d69]">Across {polls.length} active referendums</div>
        </div>
      </div>

      {/* Main 2-Column Layout: Active Polls (7 cols) + Submit Proposal Form (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Active Polls */}
        <div className="lg:col-span-7 space-y-4">
          <div className="content-card overflow-hidden">
            <div className="px-6 py-4 border-b border-[#ece6ed] bg-[#fbf8fc] flex items-center justify-between">
              <span className="text-sm font-bold text-[#1f1b20]">Active Campus Scheduling Polls & Proposals</span>
              <span className="text-xs font-mono text-[#655d69]">{polls.length} proposals</span>
            </div>

            <div className="divide-y divide-[#ece6ed]">
              {polls.map(poll => {
                const total = Math.max(1, poll.votesApprove + poll.votesRevise);
                const approvePct = Math.round((poll.votesApprove / total) * 100);

                return (
                  <div key={poll.id} className="p-6 hover:bg-[#fbf8fc]/60 transition-colors space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#655d69]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#9c4126]">{poll.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">Window: {poll.targetSlot}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-[#18794e]">{poll.status}</span>
                      </div>
                      <span className="font-mono text-[11px] text-[#7c747f]">{poll.createdAt}</span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-[#1f1b20]">{poll.title}</h3>
                      <p className="text-xs text-[#655d69] mt-1 leading-relaxed">{poll.description}</p>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="font-bold text-[#18794e]">{approvePct}% Favorable ({poll.votesApprove} votes)</span>
                        <span className="text-[#655d69]">{poll.votesRevise} request revision</span>
                      </div>
                      <div className="w-full h-2 bg-[#f6f2f7] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#3b1e4a] to-[#18794e] rounded-full transition-all duration-200"
                          style={{ width: `${approvePct}%` }}
                        />
                      </div>
                    </div>

                    {/* Voting Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <span className="text-[11px] text-[#7c747f]">
                        Submitted by {poll.submittedBy}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => institutionalStore.voteFeedbackPoll(poll.id, 'approve')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                            poll.userVote === 'approve'
                              ? 'bg-[#18794e] text-white border-[#18794e]'
                              : 'bg-white text-[#1f1b20] border-[#ece6ed] hover:bg-[#f6f2f7]'
                          }`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span>Endorse Policy</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => institutionalStore.voteFeedbackPoll(poll.id, 'revise')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            poll.userVote === 'revise'
                              ? 'bg-[#9c4126] text-white border-[#9c4126]'
                              : 'bg-white text-[#655d69] border-[#ece6ed] hover:bg-[#f6f2f7]'
                          }`}
                        >
                          Request Adjustment
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Submit New Proposal Form */}
        <div className="lg:col-span-5">
          <div className="content-card p-6 space-y-5 sticky top-20">
            <div className="border-b border-[#ece6ed] pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-[#1f1b20]">
                <MessageSquarePlus className="w-4 h-4 text-[#9c4126]" />
                <span>Submit New Schedule Policy Proposal</span>
              </div>
              <p className="text-xs text-[#655d69] mt-0.5">
                Log a student cohort or faculty scheduling request for the next solver iteration.
              </p>
            </div>

            <form onSubmit={handleSubmitProposal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">
                  Proposal Headline
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Reserve Wednesday 14:00 for Engineering Colloquium"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="form-input text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">
                    Policy Category
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="form-input text-xs"
                  >
                    <option value="Student Wellbeing">Student Wellbeing</option>
                    <option value="Campus Transit">Campus Transit</option>
                    <option value="Circadian Alertness">Circadian Alertness</option>
                    <option value="Faculty Research">Faculty Research</option>
                    <option value="Lab Safety Buffer">Lab Safety Buffer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">
                    Target Time Window
                  </label>
                  <input
                    type="text"
                    value={targetSlot}
                    onChange={e => setTargetSlot(e.target.value)}
                    placeholder="e.g. Wed 14:00 - 16:00"
                    className="form-input text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">
                  Submitted By (Role / Group)
                </label>
                <input
                  type="text"
                  value={submittedBy}
                  onChange={e => setSubmittedBy(e.target.value)}
                  className="form-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">
                  Rationale & Impact Description
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe how this constraint improves student transit, alertness, or facility utilization..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full p-3 text-xs bg-white border border-[#ece6ed] rounded-xl text-[#1f1b20] focus:outline-none focus:border-[#9c4126]"
                />
              </div>

              <button type="submit" className="w-full btn-primary text-xs">
                <span>Publish Proposal to Review Board</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
