import React, { useState, useEffect, useRef } from 'react';
import { 
  Compass, 
  Sparkles, 
  Menu, 
  X, 
  ChevronDown, 
  Lock, 
  Calendar, 
  Cpu, 
  Award, 
  LayoutDashboard, 
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type RouteType = 'solutions' | 'adaptive-engine' | 'student-voice' | 'timetable' | 'generator' | 'case-studies' | 'portal';

interface SmartGridNavProps {
  activeRoute?: RouteType;
  onNavigate?: (route: RouteType) => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
  onSignOut?: () => void;
  currentUser?: { name: string; role: string; institution?: string } | null;
}

export const SmartGridNav: React.FC<SmartGridNavProps> = ({ 
  activeRoute = 'solutions',
  onNavigate,
  onOpenAuth,
  onSignOut,
  currentUser = null
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);
  const [hoveredRoute, setHoveredRoute] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 16);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMoreDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNav = (route: RouteType) => {
    if (!currentUser && (route === 'timetable' || route === 'generator' || route === 'portal')) {
      onOpenAuth?.('signin');
      return;
    }
    onNavigate?.(route);
    setMobileMenuOpen(false);
    setMoreDropdownOpen(false);
  };

  const navLinks = [
    { id: 'solutions' as RouteType, label: 'Solutions', badge: null },
    { id: 'adaptive-engine' as RouteType, label: 'Adaptive Engine', badge: 'v4.8' },
    { id: 'student-voice' as RouteType, label: 'Student Voice', badge: 'Live' }
  ];

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${
      isScrolled 
        ? 'bg-[#fbf8fc]/95 backdrop-blur-md border-b border-[#ece6ed] shadow-[0_4px_20px_rgba(0,0,0,0.03)] py-3 px-6 sm:px-8' 
        : 'bg-[#fbf8fc]/80 backdrop-blur-sm border-b border-[#ece6ed]/70 py-4 px-6 sm:px-8'
    }`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Wordmark with subtle interactive hover lift */}
        <div 
          className="flex items-center gap-3 cursor-pointer select-none group"
          onClick={() => onNavigate?.('solutions')}
        >
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#3b1e4a] via-[#522567] to-[#1f0e27] flex items-center justify-center text-white shadow-xs group-hover:scale-105 group-hover:shadow-md transition-all duration-200">
              <Compass className="w-5 h-5 text-[#f27438] group-hover:rotate-12 transition-transform duration-300" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#18794e]" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-lg tracking-tight text-[#1f1b20] leading-none whitespace-nowrap">
              SMARTGRID <span className="text-[#9c4126]">AI</span>
            </span>
            <span className="text-[9px] font-mono uppercase tracking-widest text-[#7c747f] mt-0.5">
              Campus Equilibrium
            </span>
          </div>
        </div>

        {/* Desktop Links with Smooth Animated Bars */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-[#655d69] whitespace-nowrap">
          {navLinks.map(item => {
            const isActive = activeRoute === item.id;
            const isHovered = hoveredRoute === item.id;
            return (
              <div
                key={item.id}
                className="relative py-2"
                onMouseEnter={() => setHoveredRoute(item.id)}
                onMouseLeave={() => setHoveredRoute(null)}
              >
                <button 
                  onClick={() => handleNav(item.id)}
                  className={`flex items-center gap-1.5 transition-colors whitespace-nowrap pb-1 font-bold cursor-pointer ${
                    isActive ? 'text-[#3b1e4a]' : 'hover:text-[#1f1b20]'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#f6f2f7] text-[#9c4126] border border-[#ece6ed]">
                      {item.badge}
                    </span>
                  )}
                </button>
                {/* Animated Indicator Bar */}
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

          {/* More Dropdown */}
          <div 
            ref={dropdownRef}
            className="relative py-2"
            onMouseEnter={() => setHoveredRoute('more')}
            onMouseLeave={() => setHoveredRoute(null)}
          >
            <button 
              onClick={() => setMoreDropdownOpen(!moreDropdownOpen)}
              className={`flex items-center gap-1.5 transition-colors whitespace-nowrap pb-1 font-bold cursor-pointer ${
                activeRoute === 'timetable' || activeRoute === 'generator' || activeRoute === 'case-studies' || activeRoute === 'portal'
                  ? 'text-[#3b1e4a]'
                  : 'hover:text-[#1f1b20]'
              }`}
            >
              <span>Explore</span>
              <ChevronDown className={`w-3.5 h-3.5 text-[#7c747f] transition-transform duration-200 ${moreDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            <span 
              className={`absolute bottom-0 left-0 h-[2.5px] rounded-full transition-all duration-200 ease-out pointer-events-none ${
                activeRoute === 'timetable' || activeRoute === 'generator' || activeRoute === 'case-studies' || activeRoute === 'portal'
                  ? 'w-full bg-[#3b1e4a]' 
                  : hoveredRoute === 'more' 
                  ? 'w-full bg-gradient-to-r from-[#9c4126] to-[#f27438]' 
                  : 'w-0 bg-transparent'
              }`}
            />

            {/* Dropdown Menu */}
            <AnimatePresence>
              {moreDropdownOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.96 }}
                  transition={{ duration: 0.16 }}
                  className="absolute top-full right-0 md:left-0 mt-2 w-64 glass-dropdown rounded-2xl shadow-xl p-2 z-50 border border-[#ece6ed]"
                >
                  <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[#7c747f] font-bold">
                    Interactive Modules
                  </div>

                  <button
                    onClick={() => handleNav('timetable')}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold text-[#1f1b20] hover:bg-[#f6f2f7] transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-[#fff0eb] text-[#9c4126] flex items-center justify-center">
                        <Calendar className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-bold">Timetable Matrix</div>
                        <div className="text-[10px] text-[#7c747f]">5-Day Campus Schedule</div>
                      </div>
                    </div>
                    {!currentUser ? (
                      <Lock className="w-3.5 h-3.5 text-[#7c747f]" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-[#ece6ed] group-hover:text-[#1f1b20] transition-colors" />
                    )}
                  </button>

                  <button
                    onClick={() => handleNav('generator')}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold text-[#1f1b20] hover:bg-[#f6f2f7] transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-[#fff7ed] text-[#ea580c] flex items-center justify-center">
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-bold">Generator Studio</div>
                        <div className="text-[10px] text-[#7c747f]">Combinatorial SAT Solver</div>
                      </div>
                    </div>
                    {!currentUser ? (
                      <Lock className="w-3.5 h-3.5 text-[#7c747f]" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-[#ece6ed] group-hover:text-[#1f1b20] transition-colors" />
                    )}
                  </button>

                  <button
                    onClick={() => handleNav('case-studies')}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold text-[#1f1b20] hover:bg-[#f6f2f7] transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-[#f0fdf4] text-[#18794e] flex items-center justify-center">
                        <Award className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-bold">Case Studies</div>
                        <div className="text-[10px] text-[#7c747f]">WPI, Oxford & TU Delft</div>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[#ece6ed] group-hover:text-[#1f1b20] transition-colors" />
                  </button>

                  {currentUser && (
                    <div className="border-t border-[#ece6ed] mt-1 pt-1">
                      <button
                        onClick={() => handleNav('portal')}
                        className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-[#9c4126] hover:bg-[#fff2ee] transition-all flex items-center gap-2.5 cursor-pointer"
                      >
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#9c4126] to-[#f27438] text-white flex items-center justify-center shadow-xs">
                          <LayoutDashboard className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div>Command Portal</div>
                          <div className="text-[10px] text-[#9c4126]/70">LMS & Campus Audit</div>
                        </div>
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>

        {/* Right Actions */}
        <div className="hidden md:flex items-center gap-5">
          {currentUser ? (
            <div className="flex items-center gap-3">
              <button 
                onClick={onSignOut}
                className="text-xs font-bold uppercase tracking-wider text-[#7c747f] hover:text-[#9c4126] transition-colors whitespace-nowrap cursor-pointer px-2 py-1"
              >
                Sign Out ({currentUser.name.split(' ')[0]})
              </button>
              <button 
                onClick={() => onNavigate?.('portal')}
                className="flex items-center gap-2 bg-gradient-to-r from-[#9c4126] to-[#b3401f] hover:from-[#83341d] hover:to-[#9c4126] text-white px-5 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase transition-all shadow-md hover:shadow-lg active:scale-95 whitespace-nowrap cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#fed8c8]" />
                Command Portal
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button 
                onClick={() => onOpenAuth?.('signin')}
                className="text-xs font-bold uppercase tracking-wider text-[#3b1e4a] hover:text-[#f27438] px-3 py-2 rounded-xl hover:bg-white/80 transition-all whitespace-nowrap cursor-pointer"
              >
                Sign In
              </button>
              <button 
                onClick={() => onOpenAuth?.('signup')}
                className="flex items-center gap-2 bg-gradient-to-r from-[#9c4126] to-[#b3401f] hover:from-[#83341d] hover:to-[#9c4126] text-white px-5 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase transition-all shadow-md hover:shadow-lg active:scale-95 whitespace-nowrap cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#fed8c8]" />
                Launch Portal
              </button>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Menu Toggle */}
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden text-[#1f1b20] p-2 rounded-xl bg-white border border-[#ece6ed] shadow-xs focus:outline-none cursor-pointer"
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5 text-[#9c4126]" /> : <Menu className="w-5 h-5 text-[#3b1e4a]" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden pt-4 pb-3 border-t border-[#ece6ed] mt-3 space-y-2"
          >
            {[
              { id: 'solutions' as RouteType, label: 'Solutions' },
              { id: 'adaptive-engine' as RouteType, label: 'Adaptive Engine' },
              { id: 'student-voice' as RouteType, label: 'Student Voice' },
              { id: 'timetable' as RouteType, label: 'Timetable Matrix', lock: !currentUser },
              { id: 'generator' as RouteType, label: 'Generator Studio', lock: !currentUser },
              { id: 'case-studies' as RouteType, label: 'Case Studies' }
            ].map(item => (
              <button 
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center justify-between text-left text-xs font-bold py-2.5 px-3 rounded-xl transition-all cursor-pointer ${
                  activeRoute === item.id 
                    ? 'bg-[#3b1e4a] text-white' 
                    : 'text-[#1f1b20] hover:bg-white'
                }`}
              >
                <span>{item.label}</span>
                {item.lock && <Lock className="w-3.5 h-3.5 text-[#7c747f]" />}
              </button>
            ))}

            <div className="pt-2 flex flex-col gap-2 border-t border-[#ece6ed]">
              {!currentUser ? (
                <>
                  <button 
                    onClick={() => { onOpenAuth?.('signin'); setMobileMenuOpen(false); }}
                    className="w-full text-center py-2.5 text-xs font-bold uppercase tracking-wider text-[#3b1e4a] bg-white border border-[#ece6ed] rounded-xl shadow-xs"
                  >
                    Sign In
                  </button>
                  <button 
                    onClick={() => { onOpenAuth?.('signup'); setMobileMenuOpen(false); }}
                    className="w-full bg-gradient-to-r from-[#9c4126] to-[#b3401f] text-white py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase text-center shadow-md"
                  >
                    Launch Campus Portal
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => { onNavigate?.('portal'); setMobileMenuOpen(false); }}
                    className="w-full bg-gradient-to-r from-[#9c4126] to-[#b3401f] text-white py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase text-center shadow-md"
                  >
                    Enter Command Portal
                  </button>
                  <button 
                    onClick={onSignOut}
                    className="w-full text-center py-2 text-xs font-semibold text-[#7c747f] hover:text-[#9c4126]"
                  >
                    Sign Out ({currentUser.name})
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
