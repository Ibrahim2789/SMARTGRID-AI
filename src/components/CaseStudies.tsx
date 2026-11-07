import React, { useState } from 'react';
import { SmartGridNav, RouteType } from './SmartGridNav';
import { 
  Download, 
  ArrowRight, 
  CheckCircle2, 
  Award,
  FileText,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CaseStudiesProps {
  onNavigate?: (route: RouteType) => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
  onSignOut?: () => void;
  currentUser?: { name: string; role: string; institution?: string } | null;
  hideNav?: boolean;
}

export const CaseStudies: React.FC<CaseStudiesProps> = ({ 
  onNavigate,
  onOpenAuth,
  onSignOut,
  currentUser,
  hideNav = false
}) => {
  const [selectedStudy, setSelectedStudy] = useState<'wpi' | 'oxford' | 'sutd' | 'tudelft'>('wpi');
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const studies = {
    wpi: {
      name: 'Western Polytechnic Institute',
      tagline: '34,000 Students • 12 Academic Schools • 312 Legacy Clashes Solved',
      location: 'Massachusetts, USA',
      term: 'Fall 2025 - Spring 2026',
      heroStats: [
        { label: 'Admin Preparation Time', before: '6 Weeks', after: '18 Minutes', delta: '-94%', wash: 'from-[#faf4fc] via-white to-[#f4eaf7]' },
        { label: 'Cross-Disciplinary Clashes', before: '312 Collisions', after: '0 Collisions', delta: '100% Resolved', wash: 'from-[#f1fbf5] via-white to-[#e8f7ee]' },
        { label: 'Average Transit Walking Delay', before: '24 Minutes', after: '9 Minutes', delta: '-62.5%', wash: 'from-[#fff7f2] via-white to-[#fff0eb]' },
        { label: 'Accreditation Matrix Match', before: '91.4%', after: '100.0%', delta: '+8.6%', wash: 'from-[#fffbf0] via-white to-[#fff4df]' }
      ],
      description: 'Western Poly faced recurring bottlenecks between Mechanical Engineering and Computer Science majors attempting to take mandatory Robotics electives. SmartGrid AI solved the multi-building transit bottleneck across the north-south river footbridge, compacting lab classes into contiguous spatial zones and automating all faculty contractual work-hour rules.',
      quote: "SmartGrid AI didn't just save our registrar staff hundreds of hours—it gave our students their lives back by eliminating 4-hour dead gaps between morning and evening lectures.",
      author: 'Dr. Katherine Reynolds, Vice Provost of Academic Operations'
    },
    oxford: {
      name: 'Oxford Union Sciences & Research Division',
      tagline: 'Multi-Tier Collegiate Division Synthesis • Cleanroom Allocation',
      location: 'Oxford, United Kingdom',
      term: 'Michaelmas & Hilary Terms',
      heroStats: [
        { label: 'Cleanroom Utilization', before: '68%', after: '98.4%', delta: '+30.4%', wash: 'from-[#f1fbf5] via-white to-[#e8f7ee]' },
        { label: 'Specialized Lab Conflicts', before: '42 / Term', after: '0 / Term', delta: '100% Clear', wash: 'from-[#faf4fc] via-white to-[#f4eaf7]' },
        { label: 'Inter-Collegiate Walking Time', before: '28 Mins', after: '12 Mins', delta: '-57%', wash: 'from-[#fff7f2] via-white to-[#fff0eb]' },
        { label: 'Faculty Workload Satisfaction', before: '76%', after: '99.1%', delta: '+23.1%', wash: 'from-[#fffbf0] via-white to-[#fff4df]' }
      ],
      description: 'Synchronizing laboratory access across historic colleges with strict non-contiguous buildings and high-demand electron microscopes. SmartGrid AI’s deterministic solver generated conflict-free equipment batches with guaranteed 45-minute decontamination transitions between biochemistry cohorts.',
      quote: "The mathematical rigor behind SmartGrid AI provided our department chairs with total confidence in our room allocation audits.",
      author: 'Prof. Alistair MacIntyre, Chair of Physical & Life Sciences'
    },
    sutd: {
      name: 'Singapore University of Technology & Design',
      tagline: 'Dynamic Rapid Reconfiguration During Campus Retrofitting',
      location: 'Singapore',
      term: 'Academic Year 2025',
      heroStats: [
        { label: 'Reconfiguration Turnaround', before: '14 Days', after: '48 Hours', delta: '-85%', wash: 'from-[#fff7f2] via-white to-[#fff0eb]' },
        { label: 'Cancelled Studio Hours', before: '84 Hours', after: '0 Hours', delta: 'Zero Loss', wash: 'from-[#f1fbf5] via-white to-[#e8f7ee]' },
        { label: 'Makerspace Machine Uptime', before: '72%', after: '96.2%', delta: '+24.2%', wash: 'from-[#faf4fc] via-white to-[#f4eaf7]' },
        { label: 'Student Cohort Sentiment', before: '3.4 / 5.0', after: '4.8 / 5.0', delta: '+41%', wash: 'from-[#fffbf0] via-white to-[#fff4df]' }
      ],
      description: 'When central structural renovations closed 14 design studios 3 days before term launch, SmartGrid AI re-optimized the entire university schedule in 48 hours without cancelling a single class, balancing noise-isolated lecture halls and heavy fabrication workshops.',
      quote: "An unprecedented crisis was turned into a masterclass in operational resilience thanks to SmartGrid's algorithmic solver.",
      author: 'Eng. Chen Wei Ling, Director of Academic Planning'
    },
    tudelft: {
      name: 'TU Delft Technical Sciences',
      tagline: 'Campus Thermal Compaction & Sustainable Energy Synthesis',
      location: 'Delft, Netherlands',
      term: 'Full Academic Year',
      heroStats: [
        { label: 'Weekly Power Conserved', before: '0 MWh', after: '-34.1 MWh', delta: 'Energy Winner', wash: 'from-[#f1fbf5] via-white to-[#e8f7ee]' },
        { label: 'Facility Heating Consolidation', before: 'Fragmented', after: 'Zoned', delta: '100% Clustered', wash: 'from-[#faf4fc] via-white to-[#f4eaf7]' },
        { label: 'Late-Evening Hall Stragglers', before: '41 Halls', after: '4 Halls', delta: '-90%', wash: 'from-[#fff7f2] via-white to-[#fff0eb]' },
        { label: 'Student Commute Punctuality', before: '83.2%', after: '97.6%', delta: '+14.4%', wash: 'from-[#fffbf0] via-white to-[#fff4df]' }
      ],
      description: 'By passing campus thermal insulation curves and municipal grid peak pricing into the objective function, TU Delft unified lecture hours to power down dormant satellite buildings by 17:00 each day, cutting campus carbon footprint while elevating timetable predictability.',
      quote: "Achieving both carbon neutrality targets and student satisfaction at once was considered impossible until we deployed SmartGrid.",
      author: 'Ir. Maarten van de Berg, Sustainable Infrastructure Lead'
    }
  };

  const current = studies[selectedStudy];

  const handleDownloadPaper = (title: string) => {
    setDownloadSuccess(`Initiated download for ${title}. Complete methodology PDF saved.`);
    setTimeout(() => setDownloadSuccess(null), 3500);
  };

  return (
    <div className="min-h-screen bg-[#fbf8fc] text-[#1f1b20] font-sans antialiased">
      {!hideNav && (
        <SmartGridNav 
          activeRoute="case-studies" 
          onNavigate={onNavigate} 
          onOpenAuth={onOpenAuth}
          onSignOut={onSignOut}
          currentUser={currentUser}
        />
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {/* Header Hero */}
        <section className="p-6 sm:p-8 bg-gradient-to-br from-[#fff7f2] via-white to-[#faf4fc] border border-[#ece6ed] rounded-2xl shadow-sm space-y-3 relative overflow-hidden">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#ece6ed] text-[10px] font-mono font-bold text-[#9c4126] uppercase tracking-wider shadow-xs">
            <Award className="w-3.5 h-3.5 text-[#f27438]" />
            Peer-Reviewed Campus Deployments
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#1f1b20] tracking-tight leading-tight">
            Institutional Case Studies & Algorithmic Benchmarks
          </h1>
          <p className="text-xs sm:text-sm text-[#655d69] leading-relaxed max-w-3xl">
            Discover how leading research universities, polytechnics, and collegiate networks eliminated scheduling friction, preserved faculty satisfaction, and protected student mental health.
          </p>
        </section>

        {/* Institution Selector Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'wpi' as const, label: 'Western Polytechnic (34,000 Students)' },
            { id: 'oxford' as const, label: 'Oxford Union Sciences' },
            { id: 'sutd' as const, label: 'Singapore Tech & Design (SUTD)' },
            { id: 'tudelft' as const, label: 'TU Delft (Thermal Compaction)' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedStudy(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                selectedStudy === tab.id
                  ? 'bg-[#3b1e4a] text-white border-[#3b1e4a] shadow-xs'
                  : 'bg-white text-[#655d69] border-[#ece6ed] hover:border-[#dcd9dd]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Selected Study Showcase */}
        <div className="bg-white border border-[#ece6ed] rounded-2xl p-6 lg:p-8 shadow-sm space-y-8">
          {/* Top Title Strip */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-[#ece6ed] pb-5">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#9c4126] font-bold">
                {current.location} • {current.term}
              </span>
              <h2 className="text-2xl font-black text-[#1f1b20] mt-1">{current.name}</h2>
              <p className="text-xs text-[#655d69] mt-0.5">{current.tagline}</p>
            </div>
            <button
              onClick={() => handleDownloadPaper(current.name)}
              className="flex items-center gap-2 bg-gradient-to-r from-[#9c4126] to-[#b3401f] hover:from-[#83341d] hover:to-[#9c4126] text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md hover:shadow-lg active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-[#fed8c8]" />
              Download Full Case Study PDF
            </button>
          </div>

          <AnimatePresence>
            {downloadSuccess && (
              <motion.div 
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="p-3.5 bg-[#eefcf2] text-[#0f5431] rounded-xl text-xs font-mono flex items-center justify-between border border-[#18794e]/30 shadow-xs"
              >
                <span>{downloadSuccess}</span>
                <span className="font-bold">200_OK</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hero Delta Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {current.heroStats.map((stat, i) => (
              <div key={i} className={`p-4 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] bg-gradient-to-br ${stat.wash} space-y-1.5 shadow-xs card-lift`}>
                <div className="text-[10px] font-mono uppercase text-[#7c747f] font-bold">{stat.label}</div>
                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-black font-mono text-[#1f1b20]">{stat.after}</div>
                  <div className="text-[11px] font-mono font-bold text-[#18794e] bg-[#eefcf2] px-2 py-0.5 rounded-md shadow-xs border border-[#18794e]/20">{stat.delta}</div>
                </div>
                <div className="text-[10px] font-mono text-[#7c747f]">Prior: <span className="line-through">{stat.before}</span></div>
              </div>
            ))}
          </div>

          {/* Executive Quote */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#fff8f5] via-white to-[#fff2ec] border border-[#ece6ed] text-xs text-[#655d69] italic shadow-xs">
            "{current.quote}"
            <div className="text-[11px] font-bold font-sans not-italic text-[#1f1b20] mt-1.5">— {current.author}</div>
          </div>

          <div className="text-xs text-[#655d69] leading-relaxed">
            {current.description}
          </div>
        </div>
      </main>
    </div>
  );
};
