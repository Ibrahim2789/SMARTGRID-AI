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
  SlidersHorizontal,
  ExternalLink
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
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

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
      question: 'Protect 12:00 - 13:00 Daily Campus Lunch & Mental Recharge Window',
      category: 'Wellbeing Policy',
      votesYes: 2841,
      votesNo: 112,
      userVoted: null as 'yes' | 'no' | null
    },
    {
      id: 'p2',
      question: 'Cap Consecutive Academic Lecture Blocks at 3 Hours Maximum',
      category: 'Cognitive Load',
      votesYes: 3410,
      votesNo: 189,
      userVoted: null as 'yes' | 'no' | null
    },
    {
      id: 'p3',
      question: 'Ban Friday Afternoon (> 15:00) Heavy Midterms & Mandatory Recitations',
      category: 'Schedule Balance',
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

  // Scroll detection for header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
        `[1.32ms] EQUILIBRIUM_RESTORED: 100% collision-free guarantee reinstated.`
      ]);
      setResolvingConflict(false);
    }, 850);
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
      tagline: '34,000 Students • 12 Academic Schools • 312 Legacy Clashes Solved',
      location: 'Massachusetts, USA',
      term: 'Fall 2025 - Spring 2026',
      heroStats: [
        { label: 'Admin Preparation Time', before: '6 Weeks', after: '18 Minutes', delta: '-94%' },
        { label: 'Cross-Disciplinary Clashes', before: '312 Collisions', after: '0 Collisions', delta: '100% Resolved' },
        { label: 'Average Transit Walking Delay', before: '24 Minutes', after: '9 Minutes', delta: '-62.5%' },
        { label: 'Accreditation Matrix Match', before: '91.4%', after: '100.0%', delta: '+8.6%' }
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
        { label: 'Cleanroom Utilization', before: '68%', after: '98.4%', delta: '+30.4%' },
        { label: 'Specialized Lab Conflicts', before: '42 / Term', after: '0 / Term', delta: '100% Clear' },
        { label: 'Inter-Collegiate Walking Time', before: '28 Mins', after: '12 Mins', delta: '-57%' },
        { label: 'Faculty Workload Satisfaction', before: '76%', after: '99.1%', delta: '+23.1%' }
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
        { label: 'Reconfiguration Turnaround', before: '14 Days', after: '48 Hours', delta: '-85%' },
        { label: 'Cancelled Studio Hours', before: '84 Hours', after: '0 Hours', delta: 'Zero Loss' },
        { label: 'Makerspace Machine Uptime', before: '72%', after: '96.2%', delta: '+24.2%' },
        { label: 'Student Cohort Sentiment', before: '3.4 / 5.0', after: '4.8 / 5.0', delta: '+41%' }
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
        { label: 'Weekly Power Conserved', before: '0 MWh', after: '-34.1 MWh', delta: 'Energy Winner' },
        { label: 'Facility Heating Consolidation', before: 'Fragmented', after: 'Zoned', delta: '100% Clustered' },
        { label: 'Late-Evening Hall Stragglers', before: '41 Halls', after: '4 Halls', delta: '-90%' },
        { label: 'Student Commute Punctuality', before: '83.2%', after: '97.6%', delta: '+14.4%' }
      ],
      description: 'By passing campus thermal insulation curves and municipal grid peak pricing into the objective function, TU Delft unified lecture hours to power down dormant satellite buildings by 17:00 each day, cutting campus carbon footprint while elevating timetable predictability.',
      quote: "Achieving both carbon neutrality targets and student satisfaction at once was considered impossible until we deployed SmartGrid.",
      author: 'Ir. Maarten van de Berg, Sustainable Infrastructure Lead'
    }
  };

  const currentStudy = caseStudiesData[selectedStudy];

  // Helper sample classes for modal
  const sampleClasses: Record<string, ClassItem> = {
    'CS-301': {
      id: 'c1',
      code: 'CS-301',
      title: 'Data Structures & Algorithms',
      room: 'Turing Hall B3',
      prof: 'Dr. Evans',
      cohort: 'CS Sophomore Cohort A',
      capacity: 60,
      enrolled: 58,
      time: '09:00 - 10:30',
      day: 'Monday & Wednesday',
      type: 'Lecture',
      credits: 4,
      accent: 'plum',
      constraintStatus: 'Equilibrium Confirmed'
    },
    'BIO-210': {
      id: 'c2',
      code: 'BIO-210',
      title: 'Cellular Genomics & Sequencing',
      room: 'Bio Lab 4 (Cleanroom)',
      prof: 'Dr. Zhao',
      cohort: 'Bioengineering Juniors',
      capacity: 32,
      enrolled: 30,
      time: '09:00 - 10:30',
      day: 'Tuesday',
      type: 'Laboratory',
      credits: 4,
      accent: 'emerald',
      constraintStatus: 'Optimal'
    },
    'ENG-102': {
      id: 'c3',
      code: 'ENG-102',
      title: 'Applied Engineering Statics',
      room: 'Engineering Quad Hall A',
      prof: 'Prof. Miller',
      cohort: 'MechE Freshman Track',
      capacity: 90,
      enrolled: 86,
      time: '09:00 - 10:30',
      day: 'Thursday',
      type: 'Lecture',
      credits: 3,
      accent: 'terracotta',
      constraintStatus: 'Equilibrium Confirmed'
    },
    'MATH-204': {
      id: 'c4',
      code: 'MATH-204',
      title: 'Multivariable Linear Algebra',
      room: 'Kepler Auditorium A1',
      prof: 'Dr. Raman',
      cohort: 'Applied Math Cohort',
      capacity: 75,
      enrolled: 72,
      time: '11:00 - 12:30',
      day: 'Monday & Friday',
      type: 'Lecture',
      credits: 4,
      accent: 'terracotta',
      constraintStatus: 'Optimal'
    }
  };

  return (
    <div className="min-h-screen bg-[#fbf8fc] text-[#1f1b20] font-sans antialiased selection:bg-[#f27438]/20">
      {/* Interactive Modal for timetable preview */}
      <ClassDetailsModal
        classItem={selectedClass}
        onClose={() => setSelectedClass(null)}
      />

      {/* Sticky Top Navigation */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-[#fbf8fc]/95 backdrop-blur-md border-b border-[#ece6ed] shadow-[0_4px_24px_rgba(0,0,0,0.03)] px-6 lg:px-8 py-3.5' 
          : 'bg-[#fbf8fc]/80 backdrop-blur-sm border-b border-[#ece6ed]/80 px-6 lg:px-8 py-5'
      }`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Brand Wordmark */}
          <div 
            className="flex items-center gap-3 cursor-pointer select-none group"
            onClick={() => scrollTo('solutions')}
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3b1e4a] via-[#522567] to-[#1f0e27] flex items-center justify-center text-white shadow-sm group-hover:scale-105 group-hover:shadow-md transition-all">
                <Compass className="w-5 h-5 text-[#f27438] group-hover:rotate-12 transition-transform duration-300" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#18794e]" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-lg tracking-tight text-[#1f1b20] leading-none whitespace-nowrap">
                SMARTGRID <span className="text-[#9c4126]">AI</span>
              </span>
              <span className="text-[9px] font-mono uppercase tracking-widest text-[#7c747f] mt-0.5 font-semibold">
                Campus Equilibrium
              </span>
            </div>
          </div>

          {/* Desktop Anchor Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-[#655d69] whitespace-nowrap">
            {[
              { id: 'solutions' as const, label: 'Solutions' },
              { id: 'adaptive-engine' as const, label: 'Adaptive Engine' },
              { id: 'student-voice' as const, label: 'Student Voice' },
              { id: 'case-studies' as const, label: 'Case Studies' },
              { id: 'matrix-preview' as const, label: 'Timetable Matrix' }
            ].map(link => {
              const isActive = activeSection === link.id;
              const isHovered = hoveredNav === link.id;
              return (
                <div
                  key={link.id}
                  className="relative py-2"
                  onMouseEnter={() => setHoveredNav(link.id)}
                  onMouseLeave={() => setHoveredNav(null)}
                >
                  <button 
                    onClick={() => { setActiveSection(link.id); scrollTo(link.id); }}
                    className={`transition-colors whitespace-nowrap pb-1.5 font-bold cursor-pointer ${
                      isActive ? 'text-[#3b1e4a]' : 'hover:text-[#1f1b20]'
                    }`}
                  >
                    {link.label}
                  </button>
                  <span 
                    className={`absolute bottom-0 left-0 h-[2.5px] rounded-full transition-all duration-200 ease-out pointer-events-none ${
                      isActive 
                        ? 'w-full bg-[#3b1e4a]' 
                        : isHovered 
                        ? 'w-full bg-gradient-to-r from-[#9c4126] to-[#f27438]' 
                        : 'w-0 bg-transparent'
                    }`}
                  />
                </div>
              );
            })}
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <button 
              onClick={() => onOpenAuth('signin')}
              className="text-xs font-bold uppercase tracking-wider text-[#3b1e4a] hover:text-[#f27438] px-3.5 py-2 rounded-xl hover:bg-white/80 transition-all whitespace-nowrap cursor-pointer"
            >
              Sign In
            </button>
            <button 
              onClick={() => onOpenAuth('signup')}
              className="flex items-center gap-2 bg-gradient-to-r from-[#9c4126] to-[#b3401f] hover:from-[#83341d] hover:to-[#9c4126] text-white px-5 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase transition-all shadow-md hover:shadow-lg active:scale-95 whitespace-nowrap cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#fed8c8]" />
              Launch Portal
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-[#1f1b20] p-2 rounded-xl bg-white border border-[#ece6ed] shadow-xs focus:outline-none cursor-pointer"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-[#9c4126]" /> : <Menu className="w-5 h-5 text-[#3b1e4a]" />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden pt-4 pb-3 border-t border-[#ece6ed] mt-3 space-y-2"
            >
              {[
                { id: 'solutions', label: 'Solutions' },
                { id: 'adaptive-engine', label: 'Adaptive Engine' },
                { id: 'student-voice', label: 'Student Voice' },
                { id: 'case-studies', label: 'Case Studies' },
                { id: 'matrix-preview', label: 'Timetable Matrix' }
              ].map(item => (
                <button 
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className="block w-full text-left text-xs font-bold text-[#1f1b20] py-2 px-3 rounded-xl hover:bg-white transition-all cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
              <div className="pt-2 flex flex-col gap-2 border-t border-[#ece6ed]">
                <button 
                  onClick={() => { onOpenAuth('signin'); setMobileMenuOpen(false); }}
                  className="w-full text-center py-2.5 text-xs font-bold uppercase tracking-wider text-[#3b1e4a] bg-white border border-[#ece6ed] rounded-xl shadow-xs"
                >
                  Sign In
                </button>
                <button 
                  onClick={() => { onOpenAuth('signup'); setMobileMenuOpen(false); }}
                  className="w-full bg-gradient-to-r from-[#9c4126] to-[#b3401f] text-white py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase text-center shadow-md"
                >
                  Launch Campus Portal
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Single-Page Content */}
      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-24 py-8 sm:py-12">
        {/* Subtle Ambient Colorful Background Glows */}
        <div className="absolute top-0 left-1/4 w-[550px] h-[550px] bg-gradient-to-tr from-[#ffe6dc]/40 via-[#fde2e4]/30 to-[#f3e8f8]/20 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="absolute top-80 right-10 w-[500px] h-[500px] bg-gradient-to-br from-[#edd5f2]/30 via-[#e2f1ea]/30 to-[#fdf0e6]/25 rounded-full blur-3xl -z-10 pointer-events-none" />
        
        {/* ================= SECTION: SOLUTIONS (HERO) ================= */}
        <section id="solutions" className="relative scroll-mt-24 space-y-10 overflow-hidden rounded-3xl p-6 sm:p-10 lg:p-14 border border-[#ece6ed] bg-gradient-to-b from-white/95 via-[#fcfbfe]/90 to-white/95 shadow-sm">
          {/* Autonomous Harmonic Wave Canvas */}
          <InteractiveHeroMesh />

          <motion.div 
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="relative z-10 text-center max-w-4xl mx-auto space-y-5 pt-2"
          >
            {/* Eyebrow Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f6f2f7] border border-[#ece6ed] text-[11px] font-mono font-bold uppercase tracking-wider text-[#9c4126] shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[#9c4126] animate-pulse" />
              <span>Algorithmic Campus Equilibrium v4.8</span>
              <span aria-hidden="true" className="text-gray-300">·</span>
              <span className="text-[#3b1e4a]">SAT-Solver Architecture</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#1f1b20] tracking-tight leading-[1.12]">
              Algorithmic Harmony for Higher Education.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#9c4126] via-[#f27438] to-[#ea580c]">
                Student-Centric
              </span>{' '}
              Timetables in Minutes.
            </h1>

            <p className="text-sm sm:text-base text-[#655d69] leading-relaxed max-w-2xl mx-auto">
              SmartGrid AI harmonizes faculty availability, physical campus limits, and student commute graphs into rigorously verified, conflict-free semester schedules.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
              <button 
                onClick={() => onOpenAuth('signin')}
                className="group flex items-center gap-2.5 bg-gradient-to-r from-[#9c4126] to-[#b3401f] hover:from-[#83341d] hover:to-[#9c4126] text-white px-7 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md hover:shadow-lg active:scale-95 cursor-pointer"
              >
                <Zap className="w-4 h-4 text-[#fed8c8]" />
                Experience Live Generation
              </button>
              <button 
                onClick={() => scrollTo('adaptive-engine')}
                className="flex items-center gap-2 bg-white/90 backdrop-blur-sm hover:bg-[#f6f2f7] text-[#3b1e4a] border border-[#ece6ed] hover:border-[#dcd9dd] px-7 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs cursor-pointer"
              >
                Explore Methodology
                <ArrowRight className="w-4 h-4 text-[#7c747f] group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>

          {/* Architectural Solver Matrix Console */}
          <div className="relative z-10 w-full bg-white/95 backdrop-blur-md border border-[#ece6ed] rounded-2xl p-6 shadow-sm space-y-5">
            {/* Header Telemetry Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#ece6ed] pb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#18794e] animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#1f1b20]">
                  Campus Solver Matrix // Telemetry Stream
                </span>
                <span className="text-[10px] font-mono text-[#18794e] font-bold bg-[#eefcf2] px-2 py-0.5 rounded shadow-xs">
                  PARITY_LOCKED
                </span>
              </div>
              <div className="text-[11px] font-mono text-[#7c747f]">
                <span>EPOCH 142</span>
                <span className="mx-2">·</span>
                <span className="text-[#3b1e4a] font-bold">4,120 CANDIDATES</span>
                <span className="mx-2">·</span>
                <span className="text-[#18794e] font-bold">0 HARD COLLISIONS</span>
              </div>
            </div>

            {/* 4 Tonal Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-gradient-to-br from-[#faf4fc] via-white to-[#f4eaf7] border border-[#ece6ed] rounded-xl space-y-1 shadow-xs card-lift">
                <div className="text-[10px] font-mono uppercase text-[#7c747f] font-bold">
                  Scheduled Sections
                </div>
                <div className="text-3xl font-black font-mono text-[#3b1e4a]">1,420</div>
                <div className="text-[11px] text-[#655d69]">34,180 Enrolled Students</div>
              </div>

              <div className="p-4 bg-gradient-to-br from-[#fff7f2] via-white to-[#fff0eb] border border-[#ece6ed] rounded-xl space-y-1 shadow-xs card-lift">
                <div className="text-[10px] font-mono uppercase text-[#7c747f] font-bold">
                  Pareto Equilibrium
                </div>
                <div className="text-3xl font-black font-mono text-[#9c4126]">99.98%</div>
                <div className="text-[11px] text-[#655d69]">Circadian Peak Matched</div>
              </div>

              <div className="p-4 bg-gradient-to-br from-[#f1fbf5] via-white to-[#e8f7ee] border border-[#ece6ed] rounded-xl space-y-1 shadow-xs card-lift">
                <div className="text-[10px] font-mono uppercase text-[#7c747f] font-bold">
                  SAT Resolution Speed
                </div>
                <div className="text-3xl font-black font-mono text-[#18794e]">1.24 ms</div>
                <div className="text-[11px] text-[#18794e] font-bold">Polynomial Guarantee</div>
              </div>

              <div className="p-4 bg-gradient-to-br from-[#fffbf0] via-white to-[#fff4df] border border-[#ece6ed] rounded-xl space-y-1 shadow-xs card-lift">
                <div className="text-[10px] font-mono uppercase text-[#7c747f] font-bold">
                  Power Conserved
                </div>
                <div className="text-3xl font-black font-mono text-[#92400e]">-34.1 MWh</div>
                <div className="text-[11px] text-[#655d69]">Delft Thermal Clustering</div>
              </div>
            </div>

            {/* Interactive Micro-Simulation Bar inside Console */}
            <div className="pt-1 flex flex-col md:flex-row items-center justify-between gap-4 p-3.5 bg-[#fbf8fc] border border-[#ece6ed] rounded-xl">
              <div className="flex-1 w-full space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-[#1f1b20]">
                  <span>Faculty Workload Cap Scalar: <span className="font-mono text-[#9c4126]">{heroWorkloadParam}%</span></span>
                  <span className="text-[10px] font-mono text-[#18794e] font-bold bg-[#eefcf2] px-2 py-0.5 rounded">Auto-Compaction Active</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={heroWorkloadParam}
                  onChange={e => setHeroWorkloadParam(Number(e.target.value))}
                  className="w-full h-1.5"
                />
              </div>

              <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
                <button
                  onClick={() => {
                    setHeroTestRunning(true);
                    setTimeout(() => {
                      setHeroTestRunning(false);
                      setHeroTestSuccess(true);
                      setTimeout(() => setHeroTestSuccess(false), 3000);
                    }, 650);
                  }}
                  disabled={heroTestRunning}
                  className="flex items-center gap-1.5 bg-[#3b1e4a] hover:bg-[#2a1335] text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm active:scale-95 disabled:opacity-75 whitespace-nowrap cursor-pointer"
                >
                  <Cpu className={`w-3.5 h-3.5 ${heroTestRunning ? 'animate-spin text-[#fed8c8]' : ''}`} />
                  {heroTestRunning ? 'Testing SAT...' : heroTestSuccess ? 'Self-Healing Verified ✓' : 'Run Parity Test'}
                </button>
              </div>
            </div>
          </div>

          {/* Validation Strip */}
          <div className="relative z-10 border-y border-[#ece6ed] py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#655d69] font-semibold">Oxford Union Validated</div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#655d69] font-semibold">FERPA & Title IV Compliant</div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#655d69] font-semibold">100% Deterministic Guarantee</div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#655d69] font-semibold">Multi-Tier Cohort Synthesis</div>
          </div>

          {/* The Three Architectural Pillars */}
          <div className="relative z-10 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#9c4126] font-bold">System Architecture</span>
                <h2 className="text-xl sm:text-2xl font-black text-[#1f1b20] mt-0.5">Engineered for Campus Equilibrium</h2>
              </div>
              <span className="text-xs font-mono text-[#7c747f] hidden sm:block">SAT Objective Functions</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Student Preference Weighting */}
              <div 
                onClick={() => scrollTo('student-voice')}
                className="bg-gradient-to-br from-[#fff7f2] via-white to-[#fff0eb] border border-[#ece6ed] hover:border-[#dcd9dd] rounded-2xl p-6 shadow-sm card-lift cursor-pointer group space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9c4126] to-[#f27438] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                      <Activity className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[11px] font-mono font-bold text-[#9c4126] bg-white px-2 py-0.5 rounded shadow-xs border border-[#ece6ed]">
                      92.8% Fit
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-[#1f1b20] group-hover:text-[#9c4126] transition-colors">
                      Student Preference Weighting
                    </h3>
                    <p className="text-xs text-[#655d69] mt-1 leading-relaxed">
                      Integrates cohort feedback, commute transit buffers, and circadian learning peaks directly into solver cost functions to slash dropout rates.
                    </p>
                  </div>

                  {/* Micro Visual Widget */}
                  <div className="p-3 bg-white/90 border border-[#ece6ed] rounded-xl space-y-2 text-xs shadow-xs">
                    <div className="flex justify-between text-[10px] font-mono text-[#7c747f]">
                      <span>Circadian Chrono-Distribution</span>
                      <span className="text-[#18794e] font-bold">Protected</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-mono">
                      <div className="p-1.5 rounded-lg bg-[#fff7f2] border border-[#ece6ed] text-[#1f1b20]">
                        <div className="font-bold">08:00 - 13:00</div>
                        <div className="text-[9px] text-[#7c747f]">Early Peak</div>
                      </div>
                      <div className="p-1.5 rounded-lg bg-[#f6f2f7] border border-[#ece6ed] text-[#3b1e4a]">
                        <div className="font-bold">12:00 - 13:00</div>
                        <div className="text-[9px] text-[#18794e] font-bold">Lunch Lock</div>
                      </div>
                      <div className="p-1.5 rounded-lg bg-[#fff7f2] border border-[#ece6ed] text-[#1f1b20]">
                        <div className="font-bold">14:00 - 18:00</div>
                        <div className="text-[9px] text-[#7c747f]">Lab Blocks</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#ece6ed] flex items-center justify-between text-xs">
                  <span className="text-[11px] font-mono text-[#7c747f]">20min Transit Window</span>
                  <span className="font-bold text-[#9c4126] group-hover:translate-x-1 transition-all flex items-center gap-1">
                    Configure <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>

              {/* Card 2: Real-Time Conflict Arbitration */}
              <div 
                onClick={() => scrollTo('adaptive-engine')}
                className="bg-gradient-to-br from-[#faf4fc] via-white to-[#f4eaf7] border border-[#ece6ed] hover:border-[#dcd9dd] rounded-2xl p-6 shadow-sm card-lift cursor-pointer group space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3b1e4a] to-[#7209b7] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                      <ShieldCheck className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[11px] font-mono font-bold text-[#18794e] bg-white px-2 py-0.5 rounded shadow-xs border border-[#ece6ed]">
                      0 Clashes
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-[#1f1b20] group-hover:text-[#7209b7] transition-colors">
                      Real-Time Conflict Arbitration
                    </h3>
                    <p className="text-xs text-[#655d69] mt-1 leading-relaxed">
                      100% collision-free room, instructor, and lab allocation via high-order polynomial constraint satisfaction across departmental curriculums.
                    </p>
                  </div>

                  {/* Micro Visual Widget */}
                  <div className="p-3 bg-white/90 border border-[#ece6ed] rounded-xl space-y-1.5 text-xs font-mono shadow-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#655d69]">Faculty Workload Caps</span>
                      <span className="text-[#18794e] font-bold">✓ 100% Verified</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#655d69]">Lab Hardware Allocations</span>
                      <span className="text-[#18794e] font-bold">✓ 0 Double-Books</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#655d69]">Cross-Major Tracks</span>
                      <span className="text-[#18794e] font-bold">✓ Auto-Mapped</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#ece6ed] flex items-center justify-between text-xs">
                  <span className="text-[11px] font-mono text-[#7c747f]">DETERMINISTIC_SAT</span>
                  <span className="font-bold text-[#7209b7] group-hover:translate-x-1 transition-all flex items-center gap-1">
                    Test Bench <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>

              {/* Card 3: Dynamic Campus Analytics */}
              <div 
                onClick={() => scrollTo('matrix-preview')}
                className="bg-gradient-to-br from-[#f1fbf5] via-white to-[#e8f7ee] border border-[#ece6ed] hover:border-[#dcd9dd] rounded-2xl p-6 shadow-sm card-lift cursor-pointer group space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#18794e] to-[#25a26c] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[11px] font-mono font-bold text-[#18794e] bg-white px-2 py-0.5 rounded shadow-xs border border-[#ece6ed]">
                      -34.1 MWh
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-[#1f1b20] group-hover:text-[#18794e] transition-colors">
                      Dynamic Campus Analytics
                    </h3>
                    <p className="text-xs text-[#655d69] mt-1 leading-relaxed">
                      Calculates spatial utilization density, heating and cooling across dormant halls, and transit delays to reduce campus operating overhead.
                    </p>
                  </div>

                  {/* Micro Visual Widget */}
                  <div className="p-3 bg-white/90 border border-[#ece6ed] rounded-xl space-y-2 text-xs shadow-xs">
                    <div className="flex justify-between text-[10px] font-mono text-[#7c747f]">
                      <span>Building Thermal Compaction</span>
                      <span className="text-[#18794e] font-bold">Delft Benchmark</span>
                    </div>
                    <div className="w-full bg-[#ece6ed] h-1.5 rounded-full overflow-hidden flex">
                      <div className="bg-[#18794e] h-1.5 w-[76%] rounded-full"></div>
                      <div className="bg-[#dcd6df] h-1.5 w-[24%]"></div>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-[#655d69]">
                      <span>Dormant Hall Shutdown: 17:00</span>
                      <span className="text-[#18794e] font-bold">98.4% Room Use</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#ece6ed] flex items-center justify-between text-xs">
                  <span className="text-[11px] font-mono text-[#7c747f]">Zoned Heating Parity</span>
                  <span className="font-bold text-[#18794e] group-hover:translate-x-1 transition-all flex items-center gap-1">
                    View Matrix <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= SECTION: ADAPTIVE ENGINE ================= */}
        <section id="adaptive-engine" className="scroll-mt-24 space-y-10 pt-4">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f6f2f7] border border-[#ece6ed] text-[11px] font-mono font-bold text-[#9c4126] uppercase tracking-wider">
              <Cpu className="w-3.5 h-3.5 text-[#f27438]" />
              Deterministic Solver Core • Mathematical Architecture
            </div>
            <h2 className="text-3xl font-black text-[#1f1b20] tracking-tight">
              High-Order Polynomial Constraint Satisfaction Engine
            </h2>
            <p className="text-sm text-[#655d69] leading-relaxed">
              SmartGrid AI replaces heuristic trial-and-error with a hybrid deterministic SAT-solver and genetic algorithm. It evaluates trillions of timetable permutations across campus buildings, student commute graphs, and faculty contracts in under two seconds.
            </p>
          </div>

          {/* 4-Stage Pipeline */}
          <div className="bg-white border border-[#ece6ed] rounded-2xl p-6 lg:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-[#ece6ed] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1f1b20]">Constraint Propagation Flow</span>
                <span className="text-[10px] font-mono text-[#7c747f]">Deterministic SAT Core</span>
              </div>
              <span className="text-xs font-mono font-bold text-[#18794e] bg-[#eefcf2] px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-[#18794e] animate-pulse" />
                DETERMINISTIC_PARITY_ACTIVE
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative bg-gradient-to-br from-[#faf4fc] via-white to-[#f4eaf7] border border-[#ece6ed] hover:border-[#dcd9dd] rounded-xl p-5 space-y-3 transition-all duration-300 card-lift group">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#3b1e4a] to-[#7209b7] text-white flex items-center justify-center font-mono text-xs font-bold shadow-xs group-hover:scale-105 transition-transform">01</div>
                <div>
                  <div className="text-xs font-bold text-[#1f1b20]">Hard SAT Boundaries</div>
                  <div className="text-[11px] text-[#655d69] mt-0.5">Zero overlapping faculty contracts or double-booked facilities.</div>
                </div>
                <div className="text-[10px] font-mono text-[#7209b7] font-bold bg-[#f4ecf8] px-2 py-0.5 rounded w-fit">Polynomial Proof</div>
              </div>

              <div className="relative bg-gradient-to-br from-[#fff7f2] via-white to-[#fff0eb] border border-[#ece6ed] hover:border-[#dcd9dd] rounded-xl p-5 space-y-3 transition-all duration-300 card-lift group">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#f27438] to-[#ea580c] text-white flex items-center justify-center font-mono text-xs font-bold shadow-xs group-hover:scale-105 transition-transform">02</div>
                <div>
                  <div className="text-xs font-bold text-[#1f1b20]">Circadian Chrono-Map</div>
                  <div className="text-[11px] text-[#655d69] mt-0.5">Weights high-cognition courses against mental alertness curves.</div>
                </div>
                <div className="text-[10px] font-mono text-[#f27438] font-bold bg-[#fff0ea] px-2 py-0.5 rounded w-fit">Biometric Sleep Curve</div>
              </div>

              <div className="relative bg-gradient-to-br from-[#fff5f0] via-white to-[#ffede5] border border-[#ece6ed] hover:border-[#dcd9dd] rounded-xl p-5 space-y-3 transition-all duration-300 card-lift group">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#9c4126] to-[#c84c16] text-white flex items-center justify-center font-mono text-xs font-bold shadow-xs group-hover:scale-105 transition-transform">03</div>
                <div>
                  <div className="text-xs font-bold text-[#1f1b20]">Genetic Permutations</div>
                  <div className="text-[11px] text-[#655d69] mt-0.5">Multi-threaded chromosome crossover evaluated at 1.24 ms per epoch.</div>
                </div>
                <div className="text-[10px] font-mono text-[#9c4126] font-bold bg-[#ffebe2] px-2 py-0.5 rounded w-fit">4,120 Chromosomes</div>
              </div>

              <div className="relative bg-gradient-to-br from-[#f1fbf5] via-white to-[#e8f7ee] border border-[#ece6ed] hover:border-[#dcd9dd] rounded-xl p-5 space-y-3 transition-all duration-300 card-lift group">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#18794e] to-[#10b981] text-white flex items-center justify-center font-mono text-xs font-bold shadow-xs group-hover:scale-105 transition-transform">04</div>
                <div>
                  <div className="text-xs font-bold text-[#1f1b20]">Equilibrium Matrix</div>
                  <div className="text-[11px] text-[#655d69] mt-0.5">Zero hard conflicts locked with instant LMS calendar synchronization.</div>
                </div>
                <div className="text-[10px] font-mono text-[#18794e] font-bold bg-[#e6f9ed] px-2 py-0.5 rounded w-fit">Locked Parity</div>
              </div>
            </div>
          </div>

          {/* Live Simulator & Conflict Test Bench */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Genetic Algorithm Convergence Simulator */}
            <div className="lg:col-span-7 bg-white border border-[#ece6ed] rounded-2xl p-6 lg:p-8 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-[#ece6ed] pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1f1b20]">Convergence Simulator</span>
                  <span className="text-[10px] font-mono text-[#7c747f]">Genetic Epochs</span>
                </div>
                <button 
                  onClick={() => setIsRunningSim(!isRunningSim)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer ${
                    isRunningSim 
                      ? 'bg-[#18794e] text-white hover:bg-[#13613e]' 
                      : 'bg-gradient-to-r from-[#9c4126] to-[#b3401f] text-white hover:from-[#83341d] hover:to-[#9c4126]'
                  }`}
                >
                  {isRunningSim ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-white" />}
                  {isRunningSim ? 'Simulating Iteration' : 'Start Simulation'}
                </button>
              </div>

              {/* Metric Grid */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-4 bg-gradient-to-br from-[#faf4fc] to-[#f4eaf7] border border-[#ece6ed] rounded-xl shadow-xs">
                  <div className="text-2xl font-black font-mono text-[#3b1e4a]">{generation}</div>
                  <div className="text-[10px] font-mono uppercase text-[#7c747f] mt-1 font-bold">Epoch Generation</div>
                </div>
                <div className="p-4 bg-gradient-to-br from-[#f1fbf5] to-[#e8f7ee] border border-[#ece6ed] rounded-xl shadow-xs">
                  <div className="text-2xl font-black font-mono text-[#18794e]">{fitnessScore}%</div>
                  <div className="text-[10px] font-mono uppercase text-[#18794e] mt-1 font-bold">Pareto Fitness</div>
                </div>
                <div className="p-4 bg-gradient-to-br from-[#fff7f2] to-[#fff0eb] border border-[#ece6ed] rounded-xl shadow-xs">
                  <div className="text-2xl font-black font-mono text-[#9c4126]">{activeChromosomes}</div>
                  <div className="text-[10px] font-mono uppercase text-[#9c4126] mt-1 font-bold">Active Parallel Nodes</div>
                </div>
              </div>

              {/* Interactive Mutation Slider */}
              <div className="space-y-2 pt-1">
                <div className="flex justify-between text-xs font-bold text-[#1f1b20]">
                  <span>Mutation Probability: <span className="font-mono text-[#9c4126]">{(mutationRate * 100).toFixed(1)}%</span></span>
                  <span className="font-mono text-[11px] text-[#7c747f]">Theoretical Optimum: 4.0%</span>
                </div>
                <input 
                  type="range" min="1" max="15" value={mutationRate * 100} 
                  onChange={e => setMutationRate(Number(e.target.value) / 100)}
                  className="w-full h-1.5"
                />
              </div>
            </div>

            {/* Real-Time Conflict Arbitration Bench */}
            <div className="lg:col-span-5 bg-white border border-[#ece6ed] rounded-2xl p-6 lg:p-8 shadow-sm space-y-4">
              <div className="border-b border-[#ece6ed] pb-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1f1b20]">Stress Test Bench</span>
                  <div className="text-xs text-[#655d69]">Inject live fault to observe algorithmic self-healing.</div>
                </div>
                <span className="text-[10px] font-mono font-bold text-[#f27438] bg-[#fff5f0] border border-[#ece6ed] px-2 py-0.5 rounded shadow-xs">
                  Self-Healing
                </span>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => handleResolveConflict('prof_overlap')}
                  disabled={resolvingConflict}
                  className="w-full text-left p-3 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] bg-gradient-to-r from-white to-[#fffaf8] hover:bg-[#fff5f0] transition-all text-xs group cursor-pointer shadow-xs"
                >
                  <div className="font-bold text-[#1f1b20] group-hover:text-[#9c4126] flex items-center justify-between">
                    <span>Fault 01: Faculty Double-Book</span>
                    <span className="text-[10px] font-mono text-[#9c4126] font-bold">Inject ⚡</span>
                  </div>
                  <div className="text-[11px] text-[#7c747f] mt-0.5">Dr. Evans assigned to 2 rooms simultaneously</div>
                </button>
                <button
                  onClick={() => handleResolveConflict('room_surge')}
                  disabled={resolvingConflict}
                  className="w-full text-left p-3 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] bg-gradient-to-r from-white to-[#fffaf8] hover:bg-[#fff5f0] transition-all text-xs group cursor-pointer shadow-xs"
                >
                  <div className="font-bold text-[#1f1b20] group-hover:text-[#9c4126] flex items-center justify-between">
                    <span>Fault 02: Sudden Capacity Overflow</span>
                    <span className="text-[10px] font-mono text-[#9c4126] font-bold">Inject ⚡</span>
                  </div>
                  <div className="text-[11px] text-[#7c747f] mt-0.5">Enrolment exceeds physical room seats</div>
                </button>
              </div>

              {/* Console log */}
              <div className="bg-[#1f1b20] text-[#fbf8fc] rounded-xl p-3.5 font-mono text-[10px] space-y-1.5 h-36 overflow-y-auto border border-[#3b1e4a] shadow-inner">
                <div className="text-[#f27438] font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f27438] animate-pulse"></span>
                  // SMARTGRID_ARBITRATION_CONSOLE
                </div>
                {resolutionLog.length === 0 ? (
                  <div className="text-[#7c747f] pt-2">Ready. Select a simulated fault above to trigger solver.</div>
                ) : (
                  resolutionLog.map((log, i) => (
                    <div key={i} className={log.includes('EQUILIBRIUM') ? 'text-[#18794e] font-bold' : 'text-[#ece6ed]'}>{log}</div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ================= SECTION: STUDENT VOICE ================= */}
        <section id="student-voice" className="scroll-mt-24 space-y-10 pt-4">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f6f2f7] border border-[#ece6ed] text-[11px] font-mono font-bold text-[#9c4126] uppercase tracking-wider">
              <HeartHandshake className="w-3.5 h-3.5 text-[#f27438]" />
              Student-Centric Telemetry • Circadian Equilibrium
            </div>
            <h2 className="text-3xl font-black text-[#1f1b20] tracking-tight">
              Prioritizing Student Wellbeing Over Administrative Convenience
            </h2>
            <p className="text-sm text-[#655d69] leading-relaxed">
              Traditional software forces students into back-to-back cross-campus sprints and 8:00 AM post-commute exams. SmartGrid AI ingests student transit realities, sleep science, and real-time cohort sentiment directly into solver cost functions.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Chronotypes Card */}
            <div className="lg:col-span-6 bg-white border border-[#ece6ed] rounded-2xl p-6 lg:p-8 shadow-sm space-y-5">
              <div className="border-b border-[#ece6ed] pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1f1b20]">Chronotype Energy Optimization</span>
                <div className="text-xs text-[#655d69] mt-0.5">Select a chronotype to align quantitative coursework with peak alertness.</div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setSelectedChronotype('early')}
                  className={`p-3.5 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] text-center transition-all duration-200 group cursor-pointer shadow-xs ${
                    selectedChronotype === 'early' 
                      ? 'bg-gradient-to-br from-[#fff7f2] via-white to-[#fff0eb] shadow-md ring-1 ring-[#9c4126]' 
                      : 'bg-[#fbf8fc] hover:bg-white'
                  }`}
                >
                  <Sun className={`w-5 h-5 mx-auto mb-1.5 transition-transform group-hover:scale-110 ${selectedChronotype === 'early' ? 'text-[#f27438]' : 'text-[#7c747f]'}`} />
                  <div className="text-xs font-bold text-[#1f1b20]">Early Peak</div>
                  <div className="text-[10px] font-mono text-[#7c747f] mt-0.5">08:00 - 13:00</div>
                  {selectedChronotype === 'early' && (
                    <div className="mt-1 text-[9px] font-mono font-bold text-[#9c4126] bg-[#ffebe2] px-1.5 py-0.5 rounded w-fit mx-auto">Active</div>
                  )}
                </button>
                <button
                  onClick={() => setSelectedChronotype('balanced')}
                  className={`p-3.5 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] text-center transition-all duration-200 group cursor-pointer shadow-xs ${
                    selectedChronotype === 'balanced' 
                      ? 'bg-gradient-to-br from-[#f1fbf5] via-white to-[#e8f7ee] shadow-md ring-1 ring-[#18794e]' 
                      : 'bg-[#fbf8fc] hover:bg-white'
                  }`}
                >
                  <Coffee className={`w-5 h-5 mx-auto mb-1.5 transition-transform group-hover:scale-110 ${selectedChronotype === 'balanced' ? 'text-[#18794e]' : 'text-[#7c747f]'}`} />
                  <div className="text-xs font-bold text-[#1f1b20]">Balanced</div>
                  <div className="text-[10px] font-mono text-[#7c747f] mt-0.5">10:00 - 16:00</div>
                  {selectedChronotype === 'balanced' && (
                    <div className="mt-1 text-[9px] font-mono font-bold text-[#18794e] bg-[#e6f9ed] px-1.5 py-0.5 rounded w-fit mx-auto">Active</div>
                  )}
                </button>
                <button
                  onClick={() => setSelectedChronotype('evening')}
                  className={`p-3.5 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] text-center transition-all duration-200 group cursor-pointer shadow-xs ${
                    selectedChronotype === 'evening' 
                      ? 'bg-gradient-to-br from-[#faf4fc] via-white to-[#f4eaf7] shadow-md ring-1 ring-[#7209b7]' 
                      : 'bg-[#fbf8fc] hover:bg-white'
                  }`}
                >
                  <Moon className={`w-5 h-5 mx-auto mb-1.5 transition-transform group-hover:scale-110 ${selectedChronotype === 'evening' ? 'text-[#3b1e4a]' : 'text-[#7c747f]'}`} />
                  <div className="text-xs font-bold text-[#1f1b20]">Evening Focus</div>
                  <div className="text-[10px] font-mono text-[#7c747f] mt-0.5">12:30 - 18:30</div>
                  {selectedChronotype === 'evening' && (
                    <div className="mt-1 text-[9px] font-mono font-bold text-[#7209b7] bg-[#f4ecf8] px-1.5 py-0.5 rounded w-fit mx-auto">Active</div>
                  )}
                </button>
              </div>

              {/* Campus Lunch Recharge Switch */}
              <div className="p-3.5 bg-gradient-to-r from-[#fbf8fc] to-[#f4fbf6] rounded-xl border border-[#ece6ed] flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[#1f1b20] flex items-center gap-1.5">
                    <span>Campus Noon Recharge Lock</span>
                    <span className="text-[9px] font-mono font-bold text-[#18794e] bg-[#eefcf2] px-1.5 py-0.5 rounded">Protected</span>
                  </div>
                  <div className="text-[11px] text-[#7c747f]">Mandatory universal break 12:00 - 13:00 for lunch & recharge</div>
                </div>
                <button
                  onClick={() => setLunchBufferLocked(!lunchBufferLocked)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${lunchBufferLocked ? 'bg-[#18794e]' : 'bg-[#dcd6df]'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 shadow-xs transition-transform ${lunchBufferLocked ? 'left-5.5' : 'left-0.5'}`} />
                </button>
              </div>
            </div>

            {/* Commuter Transit Buffer */}
            <div className="lg:col-span-6 bg-white border border-[#ece6ed] rounded-2xl p-6 lg:p-8 shadow-sm space-y-5">
              <div className="border-b border-[#ece6ed] pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1f1b20]">Commuter Buffer & Walking Steps</span>
                <div className="text-xs text-[#655d69] mt-0.5">Calculates transit windows between campus quads and transit hubs.</div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-[#1f1b20]">
                  <span>Door-to-Campus Travel Time:</span>
                  <span className="font-mono text-[#9c4126] font-bold bg-[#fff5f0] border border-[#ece6ed] px-2 py-0.5 rounded">{commuteDuration} mins</span>
                </div>
                <input
                  type="range" min="10" max="90" step="5" value={commuteDuration}
                  onChange={e => setCommuteDuration(Number(e.target.value))}
                  className="w-full h-1.5"
                />
              </div>

              <div className="divide-y divide-[#ece6ed] bg-[#fbf8fc] border border-[#ece6ed] rounded-xl text-xs overflow-hidden">
                <div className="p-3 flex items-center justify-between hover:bg-[#fff9f7] transition-colors">
                  <div className="flex items-center gap-2 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-[#f27438]"></span>
                    <span>Science Quad B ↔ South Engineering</span>
                  </div>
                  <span className="font-mono text-[#18794e] font-bold bg-[#eefcf2] px-2 py-0.5 rounded">12 mins (Buffer: 20 mins)</span>
                </div>
                <div className="p-3 flex items-center justify-between hover:bg-[#fff9f7] transition-colors">
                  <div className="flex items-center gap-2 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-[#7209b7]"></span>
                    <span>Architecture Atrium ↔ Chemistry Lab</span>
                  </div>
                  <span className="font-mono text-[#18794e] font-bold bg-[#eefcf2] px-2 py-0.5 rounded">8 mins (Buffer: 15 mins)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Student Governance Referendums */}
          <div className="bg-white border border-[#ece6ed] rounded-2xl p-6 lg:p-8 shadow-sm space-y-6">
            <div className="border-b border-[#ece6ed] pb-3 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#1f1b20]">Student Governance Matrix</span>
                <div className="text-xs text-[#655d69]">Verified student senate voting results pass directly into solver penalties.</div>
              </div>
              <span className="text-xs font-mono font-bold text-[#18794e] bg-[#eefcf2] px-3 py-1 rounded-xl shadow-xs">
                10,353 Verified Student Ballots
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {polls.map((poll, pIdx) => {
                const total = poll.votesYes + poll.votesNo;
                const pctYes = Math.round((poll.votesYes / total) * 100);
                const washes = [
                  'bg-gradient-to-br from-[#fff7f2] via-white to-[#fff0eb]',
                  'bg-gradient-to-br from-[#faf4fc] via-white to-[#f4eaf7]',
                  'bg-gradient-to-br from-[#f1fbf5] via-white to-[#e8f7ee]'
                ];
                const tagColors = [
                  'text-[#9c4126] bg-white',
                  'text-[#7209b7] bg-white',
                  'text-[#18794e] bg-white'
                ];
                return (
                  <div key={poll.id} className={`p-5 rounded-2xl border border-[#ece6ed] hover:border-[#dcd9dd] ${washes[pIdx % washes.length]} space-y-3.5 flex flex-col justify-between shadow-xs card-lift`}>
                    <div>
                      <span className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded shadow-xs border border-[#ece6ed] ${tagColors[pIdx % tagColors.length]}`}>
                        {poll.category}
                      </span>
                      <div className="text-xs font-bold text-[#1f1b20] mt-2.5 leading-snug">{poll.question}</div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-[#18794e] font-bold">{pctYes}% Yes</span>
                        <span className="text-[#7c747f]">{total.toLocaleString()} votes</span>
                      </div>
                      <div className="w-full bg-[#ece6ed] rounded-full h-2 overflow-hidden flex">
                        <div className="bg-gradient-to-r from-[#18794e] to-[#25a26c] h-2 transition-all duration-300 rounded-full" style={{ width: `${pctYes}%` }}></div>
                        <div className="bg-[#dcd6df] h-2" style={{ width: `${100 - pctYes}%` }}></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={() => handleVote(poll.id, 'yes')}
                          className={`py-2 rounded-xl text-xs font-bold border border-[#ece6ed] transition-all cursor-pointer shadow-xs ${
                            poll.userVoted === 'yes' 
                              ? 'bg-[#18794e] text-white shadow-xs' 
                              : 'bg-white text-[#18794e] hover:bg-[#eefcf2]'
                          }`}
                        >
                          Vote Yes ✓
                        </button>
                        <button
                          onClick={() => handleVote(poll.id, 'no')}
                          className={`py-2 rounded-xl text-xs font-bold border border-[#ece6ed] transition-all cursor-pointer shadow-xs ${
                            poll.userVoted === 'no' 
                              ? 'bg-[#3b1e4a] text-white shadow-xs' 
                              : 'bg-white text-[#655d69] hover:bg-[#f6f2f7]'
                          }`}
                        >
                          Vote No ✗
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ================= SECTION: CASE STUDIES ================= */}
        <section id="case-studies" className="scroll-mt-24 space-y-10 pt-4">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f6f2f7] border border-[#ece6ed] text-[11px] font-mono font-bold text-[#9c4126] uppercase tracking-wider">
              <Award className="w-3.5 h-3.5 text-[#f27438]" />
              Peer-Reviewed Campus Deployments
            </div>
            <h2 className="text-3xl font-black text-[#1f1b20] tracking-tight">
              Institutional Case Studies & Algorithmic Benchmarks
            </h2>
            <p className="text-sm text-[#655d69] leading-relaxed">
              Discover how leading research universities, polytechnics, and collegiate networks eliminated scheduling friction, preserved faculty satisfaction, and protected student mental health.
            </p>
          </div>

          <div className="bg-white border border-[#ece6ed] rounded-2xl p-6 lg:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[#ece6ed]">
              {[
                { id: 'wpi' as const, label: 'Western Poly (34k Students)' },
                { id: 'oxford' as const, label: 'Oxford Union Sciences' },
                { id: 'sutd' as const, label: 'Singapore Tech (SUTD)' },
                { id: 'tudelft' as const, label: 'TU Delft (Thermal Compaction)' }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setSelectedStudy(item.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                    selectedStudy === item.id
                      ? 'bg-[#3b1e4a] text-white border-[#3b1e4a] shadow-xs'
                      : 'bg-white text-[#655d69] border-[#ece6ed] hover:border-[#dcd6df]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="space-y-6">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#9c4126] font-bold">
                  {currentStudy.location} • {currentStudy.term}
                </span>
                <h3 className="text-2xl font-black text-[#1f1b20] mt-0.5">{currentStudy.name}</h3>
                <p className="text-xs text-[#655d69] mt-0.5">{currentStudy.tagline}</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {currentStudy.heroStats.map((stat, i) => {
                  const cardStyles = [
                    'bg-gradient-to-br from-[#faf4fc] via-white to-[#f4eaf7]',
                    'bg-gradient-to-br from-[#f1fbf5] via-white to-[#e8f7ee]',
                    'bg-gradient-to-br from-[#fff7f2] via-white to-[#fff0eb]',
                    'bg-gradient-to-br from-[#fffbf0] via-white to-[#fff4df]'
                  ];
                  return (
                    <div key={i} className={`p-4 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] ${cardStyles[i % cardStyles.length]} space-y-1.5 shadow-xs card-lift`}>
                      <div className="text-[10px] font-mono uppercase text-[#7c747f] font-bold">{stat.label}</div>
                      <div className="flex items-baseline justify-between">
                        <div className="text-xl font-black font-mono text-[#1f1b20]">{stat.after}</div>
                        <div className="text-[11px] font-mono font-bold text-[#18794e] bg-[#eefcf2] px-2 py-0.5 rounded-md shadow-xs">{stat.delta}</div>
                      </div>
                      <div className="text-[10px] font-mono text-[#7c747f]">Prior: <span className="line-through">{stat.before}</span></div>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-[#fff8f5] via-white to-[#fff2ec] border border-[#ece6ed] text-xs text-[#655d69] italic shadow-xs">
                "{currentStudy.quote}"
                <div className="text-[11px] font-bold font-sans not-italic text-[#1f1b20] mt-1">— {currentStudy.author}</div>
              </div>

              <p className="text-xs text-[#655d69] leading-relaxed">
                {currentStudy.description}
              </p>
            </div>
          </div>
        </section>

        {/* ================= SECTION: TIMETABLE MATRIX PREVIEW ================= */}
        <section id="matrix-preview" className="scroll-mt-24 space-y-8 pt-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#ece6ed] pb-4">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#9c4126] font-bold">Interactive Matrix Preview</span>
              <h2 className="text-2xl font-black text-[#1f1b20] mt-0.5">Sample Institutional Timetable</h2>
              <p className="text-xs text-[#655d69]">Click any section slot below to inspect details.</p>
            </div>
            <button
              onClick={() => onOpenAuth('signin')}
              className="flex items-center gap-2 bg-gradient-to-r from-[#9c4126] to-[#b3401f] text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md hover:shadow-lg active:scale-95 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-[#fed8c8]" />
              Sign In to Unlock Full Workspace
            </button>
          </div>

          {/* Department Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {['All Departments', 'Computer Science', 'Bioengineering', 'Architecture'].map(dept => (
              <button
                key={dept}
                onClick={() => setPreviewDept(dept)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                  previewDept === dept
                    ? 'bg-[#3b1e4a] text-white border-[#3b1e4a] shadow-xs'
                    : 'bg-white text-[#655d69] border-[#ece6ed] hover:border-[#dcd9dd]'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>

          {/* Live Preview Grid */}
          <div className="bg-white border border-[#ece6ed] rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#ece6ed] bg-[#fbf8fc]">
                    <th className="py-3 px-4 w-36 text-[10px] font-mono uppercase tracking-wider text-[#7c747f] font-bold">Time Window</th>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => (
                      <th key={day} className="py-3 px-4 min-w-[160px] text-xs font-bold text-[#1f1b20] border-l border-[#ece6ed]">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ece6ed]">
                  {/* Slot 09:00 - 10:30 */}
                  <tr className="hover:bg-[#fcfaff]/50 transition-colors">
                    <td className="py-4 px-4 text-xs font-mono font-bold text-[#655d69] align-top">09:00 - 10:30</td>
                    <td className="py-3 px-3 min-w-[160px] border-l border-[#ece6ed] align-top">
                      <div 
                        onClick={() => setSelectedClass(sampleClasses['CS-301'])}
                        className="p-3 rounded-xl border border-[#ece6ed] hover:border-[#3b1e4a] bg-gradient-to-br from-[#faf4fc] to-[#f4eaf7] text-xs space-y-1.5 shadow-xs transition-all card-lift cursor-pointer"
                      >
                        <div className="font-bold truncate text-[#3b1e4a] flex items-center justify-between">
                          <span>CS-301 // Data Structures</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-[#7209b7]" />
                        </div>
                        <div className="text-[11px] text-[#7c747f] flex justify-between">
                          <span>Hall B3</span>
                          <span className="font-mono text-[#7209b7] font-bold">Dr. Evans</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 min-w-[160px] border-l border-[#ece6ed] align-top">
                      <div 
                        onClick={() => setSelectedClass(sampleClasses['BIO-210'])}
                        className="p-3 rounded-xl border border-[#ece6ed] hover:border-[#18794e] bg-gradient-to-br from-[#f1fbf5] to-[#e8f7ee] text-xs space-y-1.5 shadow-xs transition-all card-lift cursor-pointer"
                      >
                        <div className="font-bold truncate text-[#0f5431] flex items-center justify-between">
                          <span>BIO-210 // Cell Genomics</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-[#18794e]" />
                        </div>
                        <div className="text-[11px] text-[#7c747f] flex justify-between">
                          <span>Lab 4</span>
                          <span className="font-mono text-[#18794e] font-bold">Dr. Zhao</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 min-w-[160px] border-l border-[#ece6ed] align-top">
                      <div 
                        onClick={() => setSelectedClass(sampleClasses['CS-301'])}
                        className="p-3 rounded-xl border border-[#ece6ed] hover:border-[#3b1e4a] bg-gradient-to-br from-[#faf4fc] to-[#f4eaf7] text-xs space-y-1.5 shadow-xs transition-all card-lift cursor-pointer"
                      >
                        <div className="font-bold truncate text-[#3b1e4a] flex items-center justify-between">
                          <span>CS-301 // Data Structures</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-[#7209b7]" />
                        </div>
                        <div className="text-[11px] text-[#7c747f] flex justify-between">
                          <span>Hall B3</span>
                          <span className="font-mono text-[#7209b7] font-bold">Dr. Evans</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 min-w-[160px] border-l border-[#ece6ed] align-top">
                      <div 
                        onClick={() => setSelectedClass(sampleClasses['ENG-102'])}
                        className="p-3 rounded-xl border border-[#ece6ed] hover:border-[#9c4126] bg-gradient-to-br from-[#fff7f2] to-[#fff0eb] text-xs space-y-1.5 shadow-xs transition-all card-lift cursor-pointer"
                      >
                        <div className="font-bold truncate text-[#9c4126] flex items-center justify-between">
                          <span>ENG-102 // Applied Statics</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-[#f27438]" />
                        </div>
                        <div className="text-[11px] text-[#7c747f] flex justify-between">
                          <span>Quad A</span>
                          <span className="font-mono text-[#f27438] font-bold">Prof. Miller</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 min-w-[160px] border-l border-[#ece6ed] align-top">
                      <div 
                        onClick={() => setSelectedClass(sampleClasses['MATH-204'])}
                        className="p-3 rounded-xl border border-[#ece6ed] hover:border-[#92400e] bg-gradient-to-br from-[#fffbf0] to-[#fff4df] text-xs space-y-1.5 shadow-xs transition-all card-lift cursor-pointer"
                      >
                        <div className="font-bold truncate text-[#92400e] flex items-center justify-between">
                          <span>MATH-204 // Linear Algebra</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-[#b45309]" />
                        </div>
                        <div className="text-[11px] text-[#7c747f] flex justify-between">
                          <span>Hall A1</span>
                          <span className="font-mono text-[#b45309] font-bold">Dr. Raman</span>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* Slot 11:00 - 12:30 */}
                  <tr className="hover:bg-[#fcfaff]/50 transition-colors">
                    <td className="py-4 px-4 text-xs font-mono font-bold text-[#655d69] align-top">11:00 - 12:30</td>
                    <td className="py-3 px-3 min-w-[160px] border-l border-[#ece6ed] align-top">
                      <div 
                        onClick={() => setSelectedClass(sampleClasses['MATH-204'])}
                        className="p-3 rounded-xl border border-[#ece6ed] hover:border-[#92400e] bg-gradient-to-br from-[#fffbf0] to-[#fff4df] text-xs space-y-1.5 shadow-xs transition-all card-lift cursor-pointer"
                      >
                        <div className="font-bold truncate text-[#92400e] flex items-center justify-between">
                          <span>MATH-204 // Linear Algebra</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-[#b45309]" />
                        </div>
                        <div className="text-[11px] text-[#7c747f] flex justify-between">
                          <span>Hall A1</span>
                          <span className="font-mono text-[#b45309] font-bold">Dr. Raman</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 min-w-[160px] border-l border-[#ece6ed] align-top">
                      <div 
                        onClick={() => setSelectedClass(sampleClasses['CS-301'])}
                        className="p-3 rounded-xl border border-[#ece6ed] hover:border-[#3b1e4a] bg-gradient-to-br from-[#faf4fc] to-[#f4eaf7] text-xs space-y-1.5 shadow-xs transition-all card-lift cursor-pointer"
                      >
                        <div className="font-bold truncate text-[#3b1e4a] flex items-center justify-between">
                          <span>CS-412 // Distributed Systems</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-[#7209b7]" />
                        </div>
                        <div className="text-[11px] text-[#7c747f] flex justify-between">
                          <span>Lab 2</span>
                          <span className="font-mono text-[#7209b7] font-bold">Dr. Evans</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 min-w-[160px] border-l border-[#ece6ed] align-top">
                      <div 
                        onClick={() => setSelectedClass(sampleClasses['BIO-210'])}
                        className="p-3 rounded-xl border border-[#ece6ed] hover:border-[#18794e] bg-gradient-to-br from-[#f1fbf5] to-[#e8f7ee] text-xs space-y-1.5 shadow-xs transition-all card-lift cursor-pointer"
                      >
                        <div className="font-bold truncate text-[#0f5431] flex items-center justify-between">
                          <span>BIO-320 // Biomaterials</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-[#18794e]" />
                        </div>
                        <div className="text-[11px] text-[#7c747f] flex justify-between">
                          <span>Lab 4</span>
                          <span className="font-mono text-[#18794e] font-bold">Dr. Zhao</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 min-w-[160px] border-l border-[#ece6ed] align-top">
                      <div 
                        onClick={() => setSelectedClass(sampleClasses['CS-301'])}
                        className="p-3 rounded-xl border border-[#ece6ed] hover:border-[#3b1e4a] bg-gradient-to-br from-[#faf4fc] to-[#f4eaf7] text-xs space-y-1.5 shadow-xs transition-all card-lift cursor-pointer"
                      >
                        <div className="font-bold truncate text-[#3b1e4a] flex items-center justify-between">
                          <span>CS-412 // Distributed Systems</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-[#7209b7]" />
                        </div>
                        <div className="text-[11px] text-[#7c747f] flex justify-between">
                          <span>Lab 2</span>
                          <span className="font-mono text-[#7209b7] font-bold">Dr. Evans</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 min-w-[160px] border-l border-[#ece6ed] align-top">
                      <div 
                        onClick={() => setSelectedClass(sampleClasses['MATH-204'])}
                        className="p-3 rounded-xl border border-[#ece6ed] hover:border-[#92400e] bg-gradient-to-br from-[#fffbf0] to-[#fff4df] text-xs space-y-1.5 shadow-xs transition-all card-lift cursor-pointer"
                      >
                        <div className="font-bold truncate text-[#92400e] flex items-center justify-between">
                          <span>MATH-204 // Linear Algebra</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-[#b45309]" />
                        </div>
                        <div className="text-[11px] text-[#7c747f] flex justify-between">
                          <span>Hall A1</span>
                          <span className="font-mono text-[#b45309] font-bold">Dr. Raman</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ================= FINAL CALL TO ACTION ================= */}
        <section className="relative overflow-hidden bg-gradient-to-r from-[#ffffff] via-[#fff8f5] to-[#fbf5fc] border border-[#ece6ed] rounded-3xl p-8 lg:p-14 shadow-lg text-center space-y-6">
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[#f27438]/15 via-[#3b1e4a]/10 to-transparent rounded-full blur-2xl pointer-events-none" />
          <div className="max-w-2xl mx-auto space-y-3 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#ece6ed] text-[10px] font-mono font-bold text-[#9c4126] uppercase tracking-wider shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-[#f27438]" />
              INSTITUTIONAL RAPID ONBOARDING
            </div>
            <h2 className="text-3xl lg:text-4xl font-black text-[#1f1b20] tracking-tight">Ready to harmonise your academic schedule?</h2>
            <p className="text-xs sm:text-sm text-[#655d69] leading-relaxed">
              Join leading universities using SmartGrid AI to eliminate schedule collisions and optimize faculty and student satisfaction in under two seconds.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
            <button
              onClick={() => onOpenAuth('signup')}
              className="flex items-center gap-2.5 bg-gradient-to-r from-[#9c4126] to-[#b3401f] hover:from-[#83341d] hover:to-[#9c4126] text-white px-8 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#fed8c8]" />
              Launch Campus Pilot
            </button>
            <button
              onClick={() => onOpenAuth('signin')}
              className="flex items-center gap-2 bg-white hover:bg-[#f6f2f7] text-[#3b1e4a] border border-[#ece6ed] hover:border-[#dcd9dd] px-8 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs cursor-pointer"
            >
              Sign In with Institutional SSO
            </button>
          </div>
        </section>
      </main>

      {/* Global Minimal Footer */}
      <footer className="border-t border-[#ece6ed] bg-white py-10 px-6 lg:px-8 text-xs text-[#655d69]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#3b1e4a] to-[#522567] flex items-center justify-center text-white shadow-xs">
              <Compass className="w-4 h-4 text-[#f27438]" />
            </div>
            <span className="font-extrabold text-sm tracking-tight text-[#1f1b20]">
              SMARTGRID <span className="text-[#9c4126]">AI</span>
            </span>
            <span className="text-[10px] font-mono text-[#7c747f] ml-2">v4.8 Deterministic Higher Ed Solver</span>
          </div>

          <div className="flex items-center gap-6 text-[11px] font-bold">
            <button onClick={() => scrollTo('solutions')} className="hover:text-[#1f1b20] cursor-pointer">Solutions</button>
            <button onClick={() => scrollTo('adaptive-engine')} className="hover:text-[#1f1b20] cursor-pointer">Engine</button>
            <button onClick={() => scrollTo('student-voice')} className="hover:text-[#1f1b20] cursor-pointer">Student Voice</button>
            <button onClick={() => scrollTo('case-studies')} className="hover:text-[#1f1b20] cursor-pointer">Case Studies</button>
            <button onClick={() => onOpenAuth('signin')} className="hover:text-[#1f1b20] cursor-pointer">Sign In</button>
          </div>

          <div className="text-[11px] text-[#7c747f] font-mono">
            © {new Date().getFullYear()} SmartGrid AI Systems Inc.
          </div>
        </div>
      </footer>
    </div>
  );
};
