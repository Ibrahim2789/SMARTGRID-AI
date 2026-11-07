import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  Sparkles, 
  ArrowRight, 
  Activity, 
  ShieldCheck, 
  Zap, 
  Cpu, 
  Play, 
  RefreshCw, 
  HeartHandshake, 
  Sun, 
  Moon, 
  Coffee, 
  Check, 
  Download, 
  Award, 
  Clock, 
  Building, 
  AlertCircle, 
  Lock, 
  Menu, 
  X,
  ChevronDown,
  Calendar,
  Layers,
  CheckCircle2,
  SlidersHorizontal
} from 'lucide-react';
import { ClassDetailsModal, ClassItem } from './ClassDetailsModal';
import { InteractiveHeroMesh } from './InteractiveHeroMesh';
import { motion, AnimatePresence } from 'motion/react';

interface PublicLandingPageProps {
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
}

export const PublicLandingPage: React.FC<PublicLandingPageProps> = ({ onOpenAuth }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'solutions' | 'adaptive-engine' | 'student-voice' | 'case-studies' | 'matrix-preview'>('solutions');

  // Hero Quick Simulation state
  const [heroTestRunning, setHeroTestRunning] = useState(false);
  const [heroTestSuccess, setHeroTestSuccess] = useState(false);
  const [heroWorkloadParam, setHeroWorkloadParam] = useState(85);

  // Adaptive Engine simulation state
  const [isRunningSim, setIsRunningSim] = useState(false);
  const [generation, setGeneration] = useState(142);
  const [fitnessScore, setFitnessScore] = useState(99.88);
  const [activeChromosomes, setActiveChromosomes] = useState(4120);
  const [mutationRate, setMutationRate] = useState(0.04);

  // Conflict test bench state
  const [conflictScenario, setConflictScenario] = useState<'none' | 'prof_overlap' | 'room_surge'>('none');
  const [resolvingConflict, setResolvingConflict] = useState(false);
  const [resolutionLog, setResolutionLog] = useState<string[]>([]);

  // Student Voice state
  const [selectedChronotype, setSelectedChronotype] = useState<'early' | 'balanced' | 'evening'>('balanced');
  const [commuteDuration, setCommuteDuration] = useState(35);
  const [lunchBufferLocked, setLunchBufferLocked] = useState(true);

  // Referendum state
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
      question: 'Ban Friday afternoon (> 15:00) heavy midterms and recitations',
      category: 'Schedule balance',
      votesYes: 4102,
      votesNo: 84,
      userVoted: null as 'yes' | 'no' | null
    }
  ]);

  // Case Studies state
  const [selectedStudy, setSelectedStudy] = useState<'wpi' | 'oxford' | 'sutd' | 'tudelft'>('wpi');

  // Timetable Matrix Preview state
  const [previewDept, setPreviewDept] = useState('All Departments');
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);

  // Genetic sim tick
  useEffect(() => {
    let interval: any;
    if (isRunningSim) {
      interval = setInterval(() => {
        setGeneration(prev => prev + 1);
        setActiveChromosomes(prev => Math.floor(4000 + Math.random() * 250));
        setFitnessScore(prev => {
          const next = prev + (Math.random() * 0.04 - 0.015);
          return Math.min(99.99, Math.max(97.5, Number(next.toFixed(2))));
        });
      }, 350);
    }
    return () => clearInterval(interval);
  }, [isRunningSim]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  const handleResolveConflict = (type: 'prof_overlap' | 'room_surge') => {
    setConflictScenario(type);
    setResolvingConflict(true);
    setResolutionLog([
      `[0.00ms] Injected: ${type.toUpperCase()} into constraint pipeline`,
      `[0.12ms] Hard collision detected in sub-matrix D-4`,
      `[0.45ms] Evaluating 1,280 adjacent chromosome permutations...`
    ]);

    setTimeout(() => {
      setResolutionLog(prev => [
        ...prev,
        `[0.88ms] Found Pareto-optimal slot swap: Hall B3 -> Annex 102`,
        `[1.14ms] Validated zero cascade violations across 18 enrolled cohorts`,
        `[1.32ms] Equilibrium restored: 100% collision-free guarantee reinstated.`
      ]);
      setResolvingConflict(false);
    }, 700);
  };

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

  const caseStudiesData = {
    wpi: {
      name: 'Western Polytechnic Institute',
      tagline: '34,000 students • 12 academic schools • 312 legacy clashes solved',
      location: 'Massachusetts, USA',
      term: 'Fall 2025 - Spring 2026',
      heroStats: [
        { label: 'Admin preparation time', before: '6 weeks', after: '18 mins', delta: '-94%' },
        { label: 'Cross-disciplinary clashes', before: '312 clashes', after: '0 clashes', delta: '100% resolved' },
        { label: 'Walking delay', before: '24 mins', after: '9 mins', delta: '-62.5%' },
        { label: 'Accreditation match', before: '91.4%', after: '100.0%', delta: '+8.6%' }
      ],
      description: 'Western Poly faced recurring bottlenecks between Mechanical Engineering and Computer Science majors attempting to take mandatory Robotics electives. SmartGrid solved the multi-building transit bottleneck across the river footbridge, compacting lab classes into contiguous spatial zones and automating faculty work-hour rules.',
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
      description: 'Synchronizing laboratory access across historic colleges with strict non-contiguous buildings and high-demand electron microscopes. SmartGrid generated conflict-free equipment batches with guaranteed 45-minute decontamination transitions between cohorts.',
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

  const currentStudy = caseStudiesData[selectedStudy];

  const sampleClasses: Record<string, ClassItem> = {
    'CS-301': {
      id: 'c1',
      code: 'CS-301',
      title: 'Data Structures & Algorithms',
      room: 'Hall B3',
      prof: 'Dr. Evans',
      cohort: 'CS Sophomore Cohort A',
      capacity: 60,
      enrolled: 58,
      time: '09:00 - 10:30',
      day: 'Mon & Wed',
      type: 'Lecture',
      credits: 4,
      accent: 'plum'
    },
    'BIO-210': {
      id: 'c2',
      code: 'BIO-210',
      title: 'Cellular Genomics',
      room: 'Bio Lab 4',
      prof: 'Dr. Zhao',
      cohort: 'Bioengineering Juniors',
      capacity: 32,
      enrolled: 30,
      time: '09:00 - 10:30',
      day: 'Tue',
      type: 'Laboratory',
      credits: 4,
      accent: 'emerald'
    },
    'ENG-102': {
      id: 'c3',
      code: 'ENG-102',
      title: 'Applied Engineering Statics',
      room: 'Quad Hall A',
      prof: 'Prof. Miller',
      cohort: 'MechE Freshman Track',
      capacity: 90,
      enrolled: 86,
      time: '09:00 - 10:30',
      day: 'Thu',
      type: 'Lecture',
      credits: 3,
      accent: 'terracotta'
    },
    'MATH-204': {
      id: 'c4',
      code: 'MATH-204',
      title: 'Linear Algebra',
      room: 'Hall A1',
      prof: 'Dr. Raman',
      cohort: 'Applied Math Track',
      capacity: 75,
      enrolled: 72,
      time: '11:00 - 12:30',
      day: 'Mon & Fri',
      type: 'Lecture',
      credits: 4,
      accent: 'plum'
    }
  };

  const getDeptClassStyle = (code: string) => {
    if (code.startsWith('CS')) return 'dept-block-cs';
    if (code.startsWith('BIO') || code.startsWith('CHEM')) return 'dept-block-bio';
    if (code.startsWith('ENG')) return 'dept-block-eng';
    if (code.startsWith('ARCH')) return 'dept-block-arch';
    if (code.startsWith('MATH')) return 'dept-block-math';
    return 'dept-block-hum';
  };

  return (
    <div className="min-h-screen bg-app text-primary antialiased">
      {/* Interactive Modal for timetable preview */}
      <ClassDetailsModal
        classItem={selectedClass}
        onClose={() => setSelectedClass(null)}
      />

      {/* Top Navigation Bar (52px) */}
      <header className="sticky top-0 z-50 bg-surface/95 backdrop-blur-sm border-b border-border h-[52px] px-4 sm:px-6 flex items-center justify-between">
        <div className="max-w-[1360px] mx-auto w-full flex items-center justify-between">
          {/* Brand */}
          <div 
            className="flex items-center gap-2.5 cursor-pointer select-none"
            onClick={() => scrollTo('solutions')}
          >
            <div className="w-7 h-7 rounded-md bg-brand flex items-center justify-center text-white shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <span className="font-semibold text-[15px] text-primary tracking-tight">
              SmartGrid
            </span>
          </div>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-[14px] text-secondary">
            {[
              { id: 'solutions' as const, label: 'Overview' },
              { id: 'adaptive-engine' as const, label: 'Optimization' },
              { id: 'student-voice' as const, label: 'Student feedback' },
              { id: 'case-studies' as const, label: 'Campuses & accreditation' },
              { id: 'matrix-preview' as const, label: 'Timetable preview' }
            ].map(link => (
              <button 
                key={link.id}
                onClick={() => { setActiveSection(link.id); scrollTo(link.id); }}
                className={`transition-colors cursor-pointer py-1 font-medium ${
                  activeSection === link.id ? 'text-brand' : 'hover:text-primary'
                }`}
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden md:flex items-center gap-2.5">
            <button 
              onClick={() => onOpenAuth('signin')}
              className="h-[36px] px-3.5 text-[14px] font-medium text-secondary hover:text-primary hover:bg-subtle rounded-md transition-colors cursor-pointer"
            >
              Sign in
            </button>
            <button 
              onClick={() => onOpenAuth('signup')}
              className="h-[36px] px-4 rounded-md bg-brand hover:bg-brand-hover text-white text-[14px] font-medium transition-colors shadow-xs cursor-pointer"
            >
              Launch workspace
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-secondary hover:text-primary p-2 rounded-md hover:bg-subtle cursor-pointer"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden absolute top-[52px] left-0 right-0 bg-surface border-b border-border p-4 space-y-2 shadow-lg"
            >
              {[
                { id: 'solutions', label: 'Overview' },
                { id: 'adaptive-engine', label: 'Optimization' },
                { id: 'student-voice', label: 'Student feedback' },
                { id: 'case-studies', label: 'Campuses & accreditation' },
                { id: 'matrix-preview', label: 'Timetable preview' }
              ].map(item => (
                <button 
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className="block w-full text-left text-[14px] py-2 px-3 rounded-md text-primary hover:bg-subtle transition-colors cursor-pointer font-medium"
                >
                  {item.label}
                </button>
              ))}
              <div className="pt-2 flex flex-col gap-2 border-t border-border">
                <button 
                  onClick={() => { onOpenAuth('signin'); setMobileMenuOpen(false); }}
                  className="w-full h-[38px] text-[14px] font-medium text-primary bg-surface border border-border rounded-md hover:bg-subtle"
                >
                  Sign in
                </button>
                <button 
                  onClick={() => { onOpenAuth('signup'); setMobileMenuOpen(false); }}
                  className="w-full h-[38px] bg-brand hover:bg-brand-hover text-white rounded-md text-[14px] font-medium"
                >
                  Launch workspace
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Single-Page Content */}
      <main className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 space-y-16 py-8 sm:py-12">
        {/* ================= SECTION: OVERVIEW (HERO) ================= */}
        <section id="solutions" className="scroll-mt-16 space-y-8">
          <div className="relative rounded-lg border border-border bg-surface p-6 sm:p-10 lg:p-12 overflow-hidden shadow-xs">
            {/* Subtle schematic vector grid */}
            <InteractiveHeroMesh />

            <div className="relative z-10 max-w-2xl mx-auto text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-subtle border border-border text-[13px] text-secondary">
                <span>Combinatorial solver engine</span>
                <span className="text-tertiary">•</span>
                <span className="text-primary font-medium">Higher ed timetabling</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-semibold text-primary tracking-tight leading-tight">
                University timetable scheduling for registrars and academic operations
              </h1>

              <p className="text-[15px] sm:text-base text-secondary leading-relaxed">
                SmartGrid evaluates faculty contractual limits, campus room capacity, and student commute graphs to generate conflict-free semester schedules in seconds.
              </p>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button 
                  onClick={() => onOpenAuth('signup')}
                  className="h-[38px] px-4 rounded-md bg-brand hover:bg-brand-hover text-white text-[14px] font-medium flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
                >
                  <span>Launch workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => scrollTo('adaptive-engine')}
                  className="h-[38px] px-4 rounded-md bg-surface border border-border hover:bg-subtle text-primary text-[14px] font-medium transition-colors cursor-pointer"
                >
                  View methodology
                </button>
              </div>
            </div>
          </div>

          {/* Unified Bordered Stat Strip with Comparisons */}
          <div className="bg-surface border border-border rounded-lg grid grid-cols-2 md:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border">
            <div className="p-5 sm:p-6 space-y-1">
              <div className="text-[14px] text-secondary">Scheduled sections</div>
              <div className="text-[32px] font-semibold text-primary tracking-tight font-mono tabular-nums">1,420</div>
              <div className="text-[13px] text-secondary mt-0.5">34,180 enrolled students</div>
            </div>

            <div className="p-5 sm:p-6 space-y-1">
              <div className="text-[14px] text-secondary">Solver parity</div>
              <div className="text-[32px] font-semibold text-success tracking-tight font-mono tabular-nums">99.88%</div>
              <div className="text-[13px] text-secondary mt-0.5">Deterministic convergence</div>
            </div>

            <div className="p-5 sm:p-6 space-y-1">
              <div className="text-[14px] text-secondary">Mean solve speed</div>
              <div className="text-[32px] font-semibold font-mono text-primary tracking-tight tabular-nums">1.24 ms</div>
              <div className="text-[13px] text-secondary mt-0.5">Polynomial SAT bounding</div>
            </div>

            <div className="p-5 sm:p-6 space-y-1">
              <div className="text-[14px] text-secondary">Energy conserved</div>
              <div className="text-[32px] font-semibold text-primary tracking-tight font-mono tabular-nums">-34.1 MWh</div>
              <div className="text-[13px] text-secondary mt-0.5">Spatial thermal clustering</div>
            </div>
          </div>

          {/* Interactive Parity Test Bench */}
          <div className="p-5 rounded-lg border border-border bg-surface flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex-1 w-full space-y-2">
              <div className="flex justify-between text-[14px]">
                <span className="font-medium text-primary">Faculty consecutive teaching cap: <span className="font-mono text-primary font-medium">{heroWorkloadParam}%</span></span>
                <span className="text-success text-[13px] font-medium">Constraint active</span>
              </div>
              <input
                type="range"
                min="50"
                max="100"
                value={heroWorkloadParam}
                onChange={e => setHeroWorkloadParam(Number(e.target.value))}
                className="w-full h-2 cursor-pointer"
              />
            </div>

            <button
              onClick={() => {
                setHeroTestRunning(true);
                setTimeout(() => {
                  setHeroTestRunning(false);
                  setHeroTestSuccess(true);
                  setTimeout(() => setHeroTestSuccess(false), 3000);
                }, 600);
              }}
              disabled={heroTestRunning}
              className="h-[38px] px-4 rounded-md border border-border bg-surface hover:bg-subtle text-primary text-[14px] font-medium flex items-center gap-2 transition-colors cursor-pointer shrink-0"
            >
              <Cpu className={`w-4 h-4 text-secondary ${heroTestRunning ? 'animate-spin text-brand' : ''}`} />
              <span>{heroTestRunning ? 'Evaluating...' : heroTestSuccess ? 'Parity verified ✓' : 'Run constraint test'}</span>
            </button>
          </div>

          {/* The Three Pillars (Compact 3-Card Grid) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div 
              onClick={() => scrollTo('student-voice')}
              className="p-5 rounded-lg border border-border bg-surface hover:bg-subtle text-left transition-colors cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Activity className="w-5 h-5 text-secondary group-hover:text-brand" />
                  <span className="text-[13px] text-success font-medium">92.8% fit</span>
                </div>
                <h3 className="text-base font-semibold text-primary">Student preference weighting</h3>
                <p className="text-[14px] text-secondary mt-1.5 leading-relaxed">
                  Integrates commute buffers and circadian learning peaks into solver cost functions.
                </p>
              </div>
              <span className="text-[14px] text-brand font-medium mt-4">Configure preferences →</span>
            </div>

            <div 
              onClick={() => scrollTo('adaptive-engine')}
              className="p-5 rounded-lg border border-border bg-surface hover:bg-subtle text-left transition-colors cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <ShieldCheck className="w-5 h-5 text-secondary group-hover:text-brand" />
                  <span className="text-[13px] text-success font-medium">0 clashes</span>
                </div>
                <h3 className="text-base font-semibold text-primary">Conflict arbitration</h3>
                <p className="text-[14px] text-secondary mt-1.5 leading-relaxed">
                  Collision-free room, instructor, and lab allocation via high-order polynomial constraint satisfaction.
                </p>
              </div>
              <span className="text-[14px] text-brand font-medium mt-4">Test arbitration →</span>
            </div>

            <div 
              onClick={() => scrollTo('matrix-preview')}
              className="p-5 rounded-lg border border-border bg-surface hover:bg-subtle text-left transition-colors cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Zap className="w-5 h-5 text-secondary group-hover:text-brand" />
                  <span className="text-[13px] text-secondary font-medium">98.4% util</span>
                </div>
                <h3 className="text-base font-semibold text-primary">Campus analytics</h3>
                <p className="text-[14px] text-secondary mt-1.5 leading-relaxed">
                  Calculates room utilization density and powers down dormant buildings by late afternoon.
                </p>
              </div>
              <span className="text-[14px] text-brand font-medium mt-4">View matrix →</span>
            </div>
          </div>
        </section>

        {/* ================= SECTION: OPTIMIZATION (ADAPTIVE ENGINE) ================= */}
        <section id="adaptive-engine" className="scroll-mt-16 space-y-6">
          <div className="pb-4 border-b border-border">
            <h2 className="text-2xl font-semibold text-primary">Optimization architecture</h2>
            <p className="text-[15px] text-secondary mt-1">
              High-order polynomial constraint satisfaction engine and genetic algorithm
            </p>
          </div>

          {/* 4-Stage Pipeline in a Single Bordered Box */}
          <div className="bg-surface border border-border rounded-lg grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border">
            <div className="p-5 sm:p-6 space-y-1.5">
              <div className="text-[14px] font-mono font-medium text-brand">01</div>
              <h3 className="text-[15px] font-semibold text-primary">Hard SAT boundaries</h3>
              <p className="text-[14px] text-secondary leading-relaxed">
                Zero-tolerance bounding: instructor non-overlap and room capacity caps.
              </p>
            </div>

            <div className="p-5 sm:p-6 space-y-1.5">
              <div className="text-[14px] font-mono font-medium text-brand">02</div>
              <h3 className="text-[15px] font-semibold text-primary">Circadian chrono-map</h3>
              <p className="text-[14px] text-secondary leading-relaxed">
                Weights high-cognition courses against student alertness curves.
              </p>
            </div>

            <div className="p-5 sm:p-6 space-y-1.5">
              <div className="text-[14px] font-mono font-medium text-brand">03</div>
              <h3 className="text-[15px] font-semibold text-primary">Genetic permutations</h3>
              <p className="text-[14px] text-secondary leading-relaxed">
                Multi-threaded chromosome crossover evaluated at 1.24 ms per epoch.
              </p>
            </div>

            <div className="p-5 sm:p-6 space-y-1.5">
              <div className="text-[14px] font-mono font-medium text-brand">04</div>
              <h3 className="text-[15px] font-semibold text-primary">Equilibrium matrix</h3>
              <p className="text-[14px] text-secondary leading-relaxed">
                Zero hard conflicts locked with instant LMS calendar synchronization.
              </p>
            </div>
          </div>

          {/* Simulator & Conflict Arbitration */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Genetic Convergence Simulator */}
            <div className="lg:col-span-7 bg-surface border border-border rounded-lg p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <h3 className="text-base font-semibold text-primary">Convergence simulator</h3>
                <button 
                  onClick={() => setIsRunningSim(!isRunningSim)}
                  className={`h-[38px] px-3.5 rounded-md text-[14px] font-medium transition-colors shadow-xs flex items-center gap-2 cursor-pointer ${
                    isRunningSim ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-brand hover:bg-brand-hover text-white'
                  }`}
                >
                  {isRunningSim ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                  <span>{isRunningSim ? 'Simulating' : 'Start simulation'}</span>
                </button>
              </div>

              <div className="grid grid-cols-3 divide-x divide-border border border-border rounded-lg bg-surface text-center">
                <div className="p-4">
                  <div className="text-[32px] font-semibold font-mono text-primary tabular-nums">{generation}</div>
                  <div className="text-[13px] text-secondary mt-0.5">Generation epoch</div>
                </div>
                <div className="p-4">
                  <div className="text-[32px] font-semibold font-mono text-success tabular-nums">{fitnessScore}%</div>
                  <div className="text-[13px] text-secondary mt-0.5">Pareto fitness</div>
                </div>
                <div className="p-4">
                  <div className="text-[32px] font-semibold font-mono text-primary tabular-nums">{activeChromosomes}</div>
                  <div className="text-[13px] text-secondary mt-0.5">Parallel nodes</div>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex justify-between text-[14px]">
                  <span className="text-primary font-medium">Mutation probability:</span>
                  <span className="font-mono text-primary font-medium">{(mutationRate * 100).toFixed(1)}%</span>
                </div>
                <input 
                  type="range" min="1" max="15" value={mutationRate * 100} 
                  onChange={e => setMutationRate(Number(e.target.value) / 100)}
                  className="w-full h-2 cursor-pointer"
                />
              </div>
            </div>

            {/* Conflict Arbitration Bench */}
            <div className="lg:col-span-5 bg-surface border border-border rounded-lg p-6 space-y-5">
              <div className="border-b border-border pb-4">
                <h3 className="text-base font-semibold text-primary">Stress test bench</h3>
                <p className="text-[13px] text-secondary mt-0.5">Inject live faults to observe automatic arbitration</p>
              </div>

              <div className="space-y-2.5">
                <button
                  onClick={() => handleResolveConflict('prof_overlap')}
                  disabled={resolvingConflict}
                  className="w-full text-left p-3.5 rounded-md border border-border hover:bg-subtle transition-colors text-[14px] cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-primary">Fault 01: Faculty double-book</div>
                    <div className="text-[13px] text-secondary mt-0.5">Instructor assigned to two rooms at once</div>
                  </div>
                  <span className="text-[13px] text-brand font-medium">Inject</span>
                </button>

                <button
                  onClick={() => handleResolveConflict('room_surge')}
                  disabled={resolvingConflict}
                  className="w-full text-left p-3.5 rounded-md border border-border hover:bg-subtle transition-colors text-[14px] cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-primary">Fault 02: Sudden capacity surge</div>
                    <div className="text-[13px] text-secondary mt-0.5">Enrollment exceeds physical room seats</div>
                  </div>
                  <span className="text-[13px] text-brand font-medium">Inject</span>
                </button>
              </div>

              {/* Console Log */}
              <div className="bg-subtle text-primary rounded-md p-3.5 font-mono text-[13px] space-y-1.5 h-36 overflow-y-auto border border-border leading-relaxed">
                {resolutionLog.length === 0 ? (
                  <div className="text-secondary">Ready. Select a simulated fault above to trigger solver.</div>
                ) : (
                  resolutionLog.map((log, i) => (
                    <div key={i} className={log.includes('restored') ? 'text-success font-medium' : 'text-primary'}>
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ================= SECTION: STUDENT FEEDBACK ================= */}
        <section id="student-voice" className="scroll-mt-16 space-y-6">
          <div className="pb-4 border-b border-border">
            <h2 className="text-2xl font-semibold text-primary">Student feedback & chronotypes</h2>
            <p className="text-[15px] text-secondary mt-1">
              Ingesting student transit realities, sleep curves, and verified senate referendums
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Chronotypes Card */}
            <div className="lg:col-span-6 bg-surface border border-border rounded-lg p-6 space-y-5">
              <div className="border-b border-border pb-4">
                <h3 className="text-base font-semibold text-primary">Chronotype energy optimization</h3>
                <p className="text-[13px] text-secondary mt-0.5">Align quantitative coursework with peak alertness</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'early' as const, label: 'Morning peak', time: '08:00 - 13:00', icon: Sun },
                  { id: 'balanced' as const, label: 'Balanced', time: '10:00 - 16:00', icon: Coffee },
                  { id: 'evening' as const, label: 'Evening focus', time: '12:30 - 18:30', icon: Moon }
                ].map(item => {
                  const Icon = item.icon;
                  const isSel = selectedChronotype === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedChronotype(item.id)}
                      className={`p-3 rounded-md border text-center transition-colors cursor-pointer text-[14px] ${
                        isSel 
                          ? 'border-brand bg-brand/5 text-primary' 
                          : 'border-border bg-surface hover:bg-subtle text-secondary'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mx-auto mb-1.5 ${isSel ? 'text-brand' : 'text-secondary'}`} />
                      <div className="font-medium text-primary">{item.label}</div>
                      <div className="text-[13px] font-mono text-secondary mt-1">{item.time}</div>
                    </button>
                  );
                })}
              </div>

              {/* Lunch Buffer Toggle */}
              <div className="p-4 bg-surface rounded-md border border-border flex items-center justify-between">
                <div>
                  <div className="text-[14px] font-medium text-primary">Daily noon recharge lock</div>
                  <div className="text-[13px] text-secondary mt-0.5">Universal 12:00 - 13:00 break protected</div>
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
            </div>

            {/* Commuter Transit Buffer */}
            <div className="lg:col-span-6 bg-surface border border-border rounded-lg p-6 space-y-5">
              <div className="border-b border-border pb-4">
                <h3 className="text-base font-semibold text-primary">Commuter buffer & walking steps</h3>
                <p className="text-[13px] text-secondary mt-0.5">Calculates transit windows between campus quads and transit hubs</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[14px]">
                  <span className="text-primary font-medium">Door-to-campus transit duration:</span>
                  <span className="font-mono text-primary font-medium">{commuteDuration} mins</span>
                </div>
                <input
                  type="range" min="10" max="90" step="5" value={commuteDuration}
                  onChange={e => setCommuteDuration(Number(e.target.value))}
                  className="w-full h-2 cursor-pointer"
                />
              </div>

              <div className="divide-y divide-border border border-border rounded-md text-[14px] overflow-hidden">
                <div className="p-3 px-3.5 flex items-center justify-between">
                  <span className="text-primary">Science Quad B ↔ South Engineering</span>
                  <span className="font-mono text-secondary text-[13px]">12 mins (Buffer: 20m)</span>
                </div>
                <div className="p-3 px-3.5 flex items-center justify-between">
                  <span className="text-primary">Architecture Atrium ↔ Chemistry Lab</span>
                  <span className="font-mono text-secondary text-[13px]">8 mins (Buffer: 15m)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Student Polls */}
          <div className="bg-surface border border-border rounded-lg p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-base font-semibold text-primary">Student polls & referendums</h3>
                <p className="text-[13px] text-secondary mt-0.5">Verified student senate voting results pass directly into solver penalties</p>
              </div>
              <span className="text-[13px] font-mono text-secondary">10,353 verified votes</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {polls.map(poll => {
                const total = poll.votesYes + poll.votesNo;
                const pctYes = Math.round((poll.votesYes / total) * 100);
                return (
                  <div key={poll.id} className="p-5 rounded-lg border border-border bg-surface space-y-3.5 flex flex-col justify-between">
                    <div>
                      <span className="text-[13px] text-brand font-medium">
                        {poll.category}
                      </span>
                      <div className="text-[15px] font-semibold text-primary mt-1 leading-snug">
                        {poll.question}
                      </div>
                    </div>

                    <div className="space-y-2.5 pt-1">
                      <div className="flex justify-between text-[13px] font-mono">
                        <span className="text-success font-medium">{pctYes}% Yes</span>
                        <span className="text-secondary">{total.toLocaleString()} votes</span>
                      </div>
                      <div className="w-full bg-subtle rounded-full h-2 overflow-hidden flex">
                        <div className="bg-success h-full transition-all duration-300" style={{ width: `${pctYes}%` }} />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5 pt-1">
                        <button
                          onClick={() => handleVote(poll.id, 'yes')}
                          className={`h-9 px-3 rounded-md text-[14px] font-medium border transition-colors cursor-pointer ${
                            poll.userVoted === 'yes' 
                              ? 'bg-brand text-white border-brand' 
                              : 'bg-surface border-border text-primary hover:bg-subtle'
                          }`}
                        >
                          Vote yes
                        </button>
                        <button
                          onClick={() => handleVote(poll.id, 'no')}
                          className={`h-9 px-3 rounded-md text-[14px] font-medium border transition-colors cursor-pointer ${
                            poll.userVoted === 'no' 
                              ? 'bg-primary text-surface border-primary' 
                              : 'bg-surface border-border text-secondary hover:text-primary hover:bg-subtle'
                          }`}
                        >
                          Vote no
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ================= SECTION: CAMPUSES & ACCREDITATION ================= */}
        <section id="case-studies" className="scroll-mt-16 space-y-6">
          <div className="pb-4 border-b border-border">
            <h2 className="text-2xl font-semibold text-primary">Campuses & accreditation</h2>
            <p className="text-[15px] text-secondary mt-1">
              Peer-reviewed deployments and operational benchmarks
            </p>
          </div>

          <div className="bg-surface border border-border rounded-lg p-6 sm:p-7 space-y-6">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-border">
              {[
                { id: 'wpi' as const, label: 'Western Poly (34k students)' },
                { id: 'oxford' as const, label: 'Oxford Union Sciences' },
                { id: 'sutd' as const, label: 'Singapore Tech (SUTD)' },
                { id: 'tudelft' as const, label: 'TU Delft (Thermal compaction)' }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setSelectedStudy(item.id)}
                  className={`h-[38px] px-3.5 rounded-md text-[14px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    selectedStudy === item.id
                      ? 'bg-subtle text-brand border border-border font-medium'
                      : 'text-secondary hover:text-primary hover:bg-subtle border border-transparent'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="space-y-5">
              <div>
                <div className="text-[13px] text-secondary">
                  {currentStudy.location} • {currentStudy.term}
                </div>
                <h3 className="text-xl font-semibold text-primary mt-1">{currentStudy.name}</h3>
                <p className="text-[14px] text-secondary mt-0.5">{currentStudy.tagline}</p>
              </div>

              {/* Stat Strip */}
              <div className="bg-surface border border-border rounded-lg grid grid-cols-2 md:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border">
                {currentStudy.heroStats.map((stat, i) => (
                  <div key={i} className="p-4 sm:p-5 space-y-1">
                    <div className="text-[14px] text-secondary">{stat.label}</div>
                    <div className="flex items-baseline justify-between pt-1">
                      <div className="text-[32px] font-semibold text-primary font-mono tabular-nums tracking-tight">{stat.after}</div>
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

              <div className="p-4 sm:p-5 rounded-md border-l-2 border-brand bg-subtle text-[15px] text-secondary italic space-y-1.5">
                <p>"{currentStudy.quote}"</p>
                <div className="text-[14px] font-medium not-italic text-primary pt-0.5">— {currentStudy.author}</div>
              </div>

              <p className="text-[15px] text-secondary leading-relaxed">
                {currentStudy.description}
              </p>
            </div>
          </div>
        </section>

        {/* ================= SECTION: TIMETABLE PREVIEW ================= */}
        <section id="matrix-preview" className="scroll-mt-16 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
            <div>
              <h2 className="text-2xl font-semibold text-primary">Sample timetable matrix</h2>
              <p className="text-[15px] text-secondary mt-1">Click any section to inspect details</p>
            </div>
            <button
              onClick={() => onOpenAuth('signin')}
              className="h-[38px] px-4 rounded-md bg-brand hover:bg-brand-hover text-white text-[14px] font-medium flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Sign in to unlock full workspace</span>
            </button>
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            {['All Departments', 'Computer Science', 'Bioengineering', 'Architecture'].map(dept => (
              <button
                key={dept}
                onClick={() => setPreviewDept(dept)}
                className={`h-[38px] px-3.5 rounded-md text-[14px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  previewDept === dept
                    ? 'bg-subtle text-brand border border-border font-medium'
                    : 'text-secondary hover:text-primary hover:bg-subtle border border-transparent'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>

          {/* Preview Grid */}
          <div className="bg-surface border border-border rounded-lg shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border bg-subtle h-11">
                    <th className="py-2.5 px-4 w-36 text-[14px] font-medium text-secondary">Time</th>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => (
                      <th key={day} className="py-2.5 px-3.5 min-w-[160px] text-[14px] font-medium text-primary border-l border-border">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr className="hover:bg-subtle/40 transition-colors">
                    <td className="py-3.5 px-4 text-[14px] font-mono text-secondary align-top">09:00 - 10:30</td>
                    <td className="py-2.5 px-2.5 min-w-[160px] border-l border-border align-top">
                      <div 
                        onClick={() => setSelectedClass(sampleClasses['CS-301'])}
                        className={`p-2.5 rounded-md transition-colors cursor-pointer text-[14px] space-y-1 ${getDeptClassStyle('CS-301')}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-medium text-[14px]">CS-301</span>
                          <span className="text-[13px] text-secondary">Lecture</span>
                        </div>
                        <div className="font-medium truncate text-[14px]">Data Structures</div>
                        <div className="text-[13px] text-secondary flex justify-between pt-0.5">
                          <span className="font-mono">Hall B3</span>
                          <span>Dr. Evans</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-2.5 px-2.5 min-w-[160px] border-l border-border align-top">
                      <div 
                        onClick={() => setSelectedClass(sampleClasses['BIO-210'])}
                        className={`p-2.5 rounded-md transition-colors cursor-pointer text-[14px] space-y-1 ${getDeptClassStyle('BIO-210')}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-medium text-[14px]">BIO-210</span>
                          <span className="text-[13px] text-secondary">Lab</span>
                        </div>
                        <div className="font-medium truncate text-[14px]">Cell Genomics</div>
                        <div className="text-[13px] text-secondary flex justify-between pt-0.5">
                          <span className="font-mono">Lab 4</span>
                          <span>Dr. Zhao</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-2.5 px-2.5 min-w-[160px] border-l border-border align-top">
                      <div 
                        onClick={() => setSelectedClass(sampleClasses['CS-301'])}
                        className={`p-2.5 rounded-md transition-colors cursor-pointer text-[14px] space-y-1 ${getDeptClassStyle('CS-301')}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-medium text-[14px]">CS-301</span>
                          <span className="text-[13px] text-secondary">Lecture</span>
                        </div>
                        <div className="font-medium truncate text-[14px]">Data Structures</div>
                        <div className="text-[13px] text-secondary flex justify-between pt-0.5">
                          <span className="font-mono">Hall B3</span>
                          <span>Dr. Evans</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-2.5 px-2.5 min-w-[160px] border-l border-border align-top">
                      <div 
                        onClick={() => setSelectedClass(sampleClasses['ENG-102'])}
                        className={`p-2.5 rounded-md transition-colors cursor-pointer text-[14px] space-y-1 ${getDeptClassStyle('ENG-102')}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-medium text-[14px]">ENG-102</span>
                          <span className="text-[13px] text-secondary">Lecture</span>
                        </div>
                        <div className="font-medium truncate text-[14px]">Applied Statics</div>
                        <div className="text-[13px] text-secondary flex justify-between pt-0.5">
                          <span className="font-mono">Quad A</span>
                          <span>Prof. Miller</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-2.5 px-2.5 min-w-[160px] border-l border-border align-top">
                      <div 
                        onClick={() => setSelectedClass(sampleClasses['MATH-204'])}
                        className={`p-2.5 rounded-md transition-colors cursor-pointer text-[14px] space-y-1 ${getDeptClassStyle('MATH-204')}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-medium text-[14px]">MATH-204</span>
                          <span className="text-[13px] text-secondary">Lecture</span>
                        </div>
                        <div className="font-medium truncate text-[14px]">Linear Algebra</div>
                        <div className="text-[13px] text-secondary flex justify-between pt-0.5">
                          <span className="font-mono">Hall A1</span>
                          <span>Dr. Raman</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Final CTA Box */}
        <section className="bg-surface border border-border rounded-lg p-8 sm:p-12 text-center space-y-5">
          <div className="max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl font-semibold text-primary">Ready to optimize your academic schedule?</h2>
            <p className="text-[15px] text-secondary leading-relaxed">
              Join university registrars using SmartGrid to eliminate timetable collisions and streamline campus operations.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => onOpenAuth('signup')}
              className="h-[38px] px-4 rounded-md bg-brand hover:bg-brand-hover text-white text-[14px] font-medium transition-colors shadow-xs cursor-pointer"
            >
              Launch workspace
            </button>
            <button
              onClick={() => onOpenAuth('signin')}
              className="h-[38px] px-4 rounded-md bg-surface border border-border hover:bg-subtle text-primary text-[14px] font-medium transition-colors cursor-pointer"
            >
              Sign in with SSO
            </button>
          </div>
        </section>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-border bg-surface py-6 px-4 sm:px-6 lg:px-8 text-[13px] text-secondary">
        <div className="max-w-[1360px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-brand flex items-center justify-center text-white shrink-0">
              <Compass className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-[14px] text-primary">SmartGrid</span>
            <span className="text-[13px] text-tertiary ml-2">University timetable scheduling platform</span>
          </div>

          <div className="flex items-center gap-5 text-[13px]">
            <button onClick={() => scrollTo('solutions')} className="hover:text-primary cursor-pointer">Overview</button>
            <button onClick={() => scrollTo('adaptive-engine')} className="hover:text-primary cursor-pointer">Optimization</button>
            <button onClick={() => scrollTo('student-voice')} className="hover:text-primary cursor-pointer">Student feedback</button>
            <button onClick={() => scrollTo('case-studies')} className="hover:text-primary cursor-pointer">Campuses</button>
            <button onClick={() => onOpenAuth('signin')} className="hover:text-primary cursor-pointer">Sign in</button>
          </div>

          <div className="text-[13px] text-tertiary font-mono">
            © {new Date().getFullYear()} SmartGrid Systems
          </div>
        </div>
      </footer>
    </div>
  );
};
