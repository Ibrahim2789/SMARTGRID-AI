import React, { useState } from 'react';
import { SmartGridNav, RouteType } from './SmartGridNav';
import { Download, CheckCircle2, Award } from 'lucide-react';
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
      tagline: '34,000 students • 12 academic schools • 312 legacy clashes solved',
      location: 'Massachusetts, USA',
      term: 'Fall 2025 - Spring 2026',
      heroStats: [
        { label: 'Preparation time', before: '6 weeks', after: '18 mins', delta: '-94%' },
        { label: 'Curricular clashes', before: '312 clashes', after: '0 clashes', delta: '100% resolved' },
        { label: 'Transit walking delay', before: '24 mins', after: '9 mins', delta: '-62.5%' },
        { label: 'Accreditation match', before: '91.4%', after: '100.0%', delta: '+8.6%' }
      ],
      description: 'Western Poly faced recurring bottlenecks between Mechanical Engineering and Computer Science majors attempting to take mandatory Robotics electives. SmartGrid solved the multi-building transit bottleneck across the north-south footbridge, compacting lab classes into contiguous spatial zones and automating all faculty contractual work-hour rules.',
      quote: "SmartGrid didn't just save our registrar staff hundreds of hours—it gave our students their lives back by eliminating 4-hour dead gaps between morning and evening lectures.",
      author: 'Dr. Katherine Reynolds, Vice Provost of Academic Operations'
    },
    oxford: {
      name: 'Oxford Union Sciences & Research Division',
      tagline: 'Collegiate division synthesis • Specialized laboratory allocation',
      location: 'Oxford, United Kingdom',
      term: 'Michaelmas & Hilary Terms',
      heroStats: [
        { label: 'Cleanroom utilization', before: '68%', after: '98.4%', delta: '+30.4%' },
        { label: 'Specialized lab conflicts', before: '42 / term', after: '0 / term', delta: '100% clear' },
        { label: 'Inter-college transit', before: '28 mins', after: '12 mins', delta: '-57%' },
        { label: 'Faculty satisfaction', before: '76%', after: '99.1%', delta: '+23.1%' }
      ],
      description: 'Synchronizing laboratory access across historic colleges with strict non-contiguous buildings and high-demand electron microscopes. SmartGrid generated conflict-free equipment batches with guaranteed 45-minute decontamination transitions between biochemistry cohorts.',
      quote: "The mathematical rigor behind SmartGrid provided our department chairs with total confidence in our room allocation audits.",
      author: 'Prof. Alistair MacIntyre, Chair of Physical & Life Sciences'
    },
    sutd: {
      name: 'Singapore University of Technology & Design',
      tagline: 'Rapid schedule reconfiguration during campus retrofitting',
      location: 'Singapore',
      term: 'Academic Year 2025',
      heroStats: [
        { label: 'Turnaround speed', before: '14 days', after: '48 hours', delta: '-85%' },
        { label: 'Cancelled studio hours', before: '84 hours', after: '0 hours', delta: 'Zero loss' },
        { label: 'Makerspace uptime', before: '72%', after: '96.2%', delta: '+24.2%' },
        { label: 'Student sentiment', before: '3.4 / 5.0', after: '4.8 / 5.0', delta: '+41%' }
      ],
      description: 'When central structural renovations closed 14 design studios 3 days before term launch, SmartGrid re-optimized the entire university schedule in 48 hours without cancelling a single class, balancing noise-isolated lecture halls and heavy fabrication workshops.',
      quote: "An unprecedented crisis was turned into a masterclass in operational resilience thanks to SmartGrid's solver.",
      author: 'Eng. Chen Wei Ling, Director of Academic Planning'
    },
    tudelft: {
      name: 'TU Delft Technical Sciences',
      tagline: 'Campus thermal compaction & sustainable energy synthesis',
      location: 'Delft, Netherlands',
      term: 'Full Academic Year',
      heroStats: [
        { label: 'Weekly power saved', before: '0 MWh', after: '-34.1 MWh', delta: 'Conserved' },
        { label: 'Heating consolidation', before: 'Fragmented', after: 'Zoned', delta: '100% zoned' },
        { label: 'Late hall stragglers', before: '41 halls', after: '4 halls', delta: '-90%' },
        { label: 'Commute punctuality', before: '83.2%', after: '97.6%', delta: '+14.4%' }
      ],
      description: 'By passing campus thermal insulation curves and municipal grid peak pricing into the objective function, TU Delft unified lecture hours to power down dormant satellite buildings by 17:00 each day, cutting campus carbon footprint while elevating timetable predictability.',
      quote: "Achieving both carbon neutrality targets and student satisfaction at once was considered impossible until we deployed SmartGrid.",
      author: 'Ir. Maarten van de Berg, Sustainable Infrastructure Lead'
    }
  };

  const current = studies[selectedStudy];

  const handleDownloadPaper = (title: string) => {
    setDownloadSuccess(`Case study report downloaded for ${title}.`);
    setTimeout(() => setDownloadSuccess(null), 3500);
  };

  return (
    <div className="min-h-screen bg-app text-primary antialiased">
      {!hideNav && (
        <SmartGridNav 
          activeRoute="case-studies" 
          onNavigate={onNavigate} 
          onOpenAuth={onOpenAuth}
          onSignOut={onSignOut}
          currentUser={currentUser}
        />
      )}

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Page Title & Subtitle */}
        <div className="pb-4 border-b border-border">
          <h1 className="text-2xl sm:text-[30px] font-semibold text-primary tracking-tight">Campuses & accreditation</h1>
          <p className="text-[15px] text-secondary mt-1">
            Operational case studies, accreditation benchmarks, and solver deployment metrics
          </p>
        </div>

        {/* Institution Selector Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'wpi' as const, label: 'Western Polytechnic (34k students)' },
            { id: 'oxford' as const, label: 'Oxford Union Sciences' },
            { id: 'sutd' as const, label: 'Singapore Tech & Design' },
            { id: 'tudelft' as const, label: 'TU Delft (Thermal compaction)' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedStudy(tab.id)}
              className={`h-[38px] px-3.5 rounded-md text-[14px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedStudy === tab.id
                  ? 'bg-subtle text-brand border border-border font-medium'
                  : 'text-secondary hover:text-primary hover:bg-subtle border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Selected Study Showcase */}
        <div className="bg-surface border border-border rounded-lg p-6 sm:p-7 space-y-6">
          {/* Header Strip */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
            <div>
              <div className="text-[13px] text-secondary">
                {current.location} • {current.term}
              </div>
              <h2 className="text-xl font-semibold text-primary mt-1">{current.name}</h2>
              <p className="text-[14px] text-secondary mt-0.5">{current.tagline}</p>
            </div>
            <button
              onClick={() => handleDownloadPaper(current.name)}
              className="h-[38px] px-4 rounded-md bg-brand hover:bg-brand-hover text-white text-[14px] font-medium flex items-center gap-2 transition-colors shadow-xs cursor-pointer shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Download case study</span>
            </button>
          </div>

          <AnimatePresence>
            {downloadSuccess && (
              <motion.div 
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-md text-[14px] flex items-center gap-2.5"
              >
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                <span>{downloadSuccess}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Unified Stat Strip */}
          <div className="bg-surface border border-border rounded-lg grid grid-cols-2 md:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border">
            {current.heroStats.map((stat, i) => (
              <div key={i} className="p-5 space-y-1">
                <div className="text-[14px] text-secondary">{stat.label}</div>
                <div className="flex items-baseline justify-between pt-1">
                  <div className="text-[32px] font-semibold text-primary font-mono tabular-nums tracking-tight">
                    {stat.after}
                  </div>
                  <span className="px-2 py-0.5 rounded text-[13px] font-mono font-medium bg-emerald-50 dark:bg-emerald-950/40 text-success border border-emerald-200 dark:border-emerald-800">
                    {stat.delta}
                  </span>
                </div>
                <div className="text-[13px] text-tertiary">
                  Prior: <span className="line-through">{stat.before}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Quote Block */}
          <div className="p-5 rounded-md border-l-2 border-brand bg-subtle text-[15px] text-secondary italic space-y-1.5">
            <p>"{current.quote}"</p>
            <div className="text-[14px] font-medium not-italic text-primary pt-0.5">
              — {current.author}
            </div>
          </div>

          {/* Description */}
          <p className="text-[15px] text-secondary leading-relaxed">
            {current.description}
          </p>
        </div>
      </div>
    </div>
  );
};
