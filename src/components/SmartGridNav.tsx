import React, { useState } from 'react';
import { Compass, Sparkles, Menu, X, ChevronDown, Lock } from 'lucide-react';

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

  const handleNav = (route: RouteType) => {
    // If route requires auth and not logged in, prompt auth
    if (!currentUser && (route === 'timetable' || route === 'generator' || route === 'portal')) {
      onOpenAuth?.('signin');
      return;
    }
    onNavigate?.(route);
    setMobileMenuOpen(false);
    setMoreDropdownOpen(false);
  };

  const [hoveredRoute, setHoveredRoute] = useState<string | null>(null);

  return (
    <header className="sticky top-0 z-50 bg-[#fbf8fc]/90 backdrop-blur-md border-b border-[#ece6ed] px-8 py-4 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Wordmark (Cleaned: No subtitle) */}
        <div 
          className="flex items-center gap-3 cursor-pointer select-none group"
          onClick={() => onNavigate?.('solutions')}
        >
          <div className="w-9 h-9 rounded-xl bg-[#3b1e4a] flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
            <Compass className="w-5 h-5 text-[#f27438]" />
          </div>
          <span className="font-bold text-lg tracking-tight text-[#1f1b20] leading-none whitespace-nowrap">
            SMARTGRID <span className="text-[#f27438]">AI</span>
          </span>
        </div>

        {/* Desktop Single-Line Links with Interactive Animated Bars */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#655d69] whitespace-nowrap">
          {[
            { id: 'solutions' as RouteType, label: 'Solutions' },
            { id: 'adaptive-engine' as RouteType, label: 'Adaptive Engine' },
            { id: 'student-voice' as RouteType, label: 'Student Voice' }
          ].map(item => {
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
                  className={`transition-colors whitespace-nowrap pb-1.5 font-semibold cursor-pointer ${
                    isActive ? 'text-[#3b1e4a]' : 'hover:text-[#1f1b20]'
                  }`}
                >
                  {item.label}
                </button>
                {/* Animated Bar Below Each Link */}
                <span 
                  className={`absolute bottom-0 left-0 h-[2.5px] rounded-full transition-all duration-300 ease-out pointer-events-none ${
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
            className="relative py-2"
            onMouseEnter={() => setHoveredRoute('more')}
            onMouseLeave={() => setHoveredRoute(null)}
          >
            <button 
              onClick={() => setMoreDropdownOpen(!moreDropdownOpen)}
              className={`flex items-center gap-1.5 transition-colors whitespace-nowrap pb-1.5 font-semibold cursor-pointer ${
                activeRoute === 'timetable' || activeRoute === 'generator' || activeRoute === 'case-studies' || activeRoute === 'portal'
                  ? 'text-[#3b1e4a]'
                  : 'hover:text-[#1f1b20]'
              }`}
            >
              <span>More</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#7c747f] transition-transform duration-200" />
            </button>
            {/* Animated Bar */}
            <span 
              className={`absolute bottom-0 left-0 h-[2.5px] rounded-full transition-all duration-300 ease-out pointer-events-none ${
                activeRoute === 'timetable' || activeRoute === 'generator' || activeRoute === 'case-studies' || activeRoute === 'portal'
                  ? 'w-full bg-[#3b1e4a]' 
                  : hoveredRoute === 'more' 
                  ? 'w-full bg-gradient-to-r from-[#9c4126] to-[#f27438]' 
                  : 'w-0 bg-transparent'
              }`}
            />

            {moreDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-[#ece6ed] rounded-xl shadow-lg py-2 z-50">
                <button
                  onClick={() => handleNav('timetable')}
                  className="w-full text-left px-4 py-2.5 text-xs font-semibold text-[#1f1b20] hover:bg-[#f6f2f7] transition-colors flex items-center justify-between"
                >
                  <span>Timetable Matrix</span>
                  {!currentUser && <Lock className="w-3 h-3 text-[#7c747f]" />}
                </button>
                <button
                  onClick={() => handleNav('generator')}
                  className="w-full text-left px-4 py-2.5 text-xs font-semibold text-[#1f1b20] hover:bg-[#f6f2f7] transition-colors flex items-center justify-between"
                >
                  <span>Generator Studio</span>
                  {!currentUser && <Lock className="w-3 h-3 text-[#7c747f]" />}
                </button>
                <button
                  onClick={() => handleNav('case-studies')}
                  className="w-full text-left px-4 py-2.5 text-xs font-semibold text-[#655d69] hover:bg-[#f6f2f7] transition-colors"
                >
                  Institutional Case Studies
                </button>
                {currentUser && (
                  <div className="border-t border-[#ece6ed] mt-1 pt-1">
                    <button
                      onClick={() => handleNav('portal')}
                      className="w-full text-left px-4 py-2.5 text-xs font-semibold text-[#9c4126] hover:bg-[#f6f2f7] transition-colors"
                    >
                      Command Portal
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </nav>

        {/* Consolidated Right Actions: 1 Text Link + 1 Primary Button with rounded-xl */}
        <div className="hidden md:flex items-center gap-6">
          {currentUser ? (
            <>
              <button 
                onClick={onSignOut}
                className="text-xs font-semibold uppercase tracking-wider text-[#7c747f] hover:text-[#9c4126] transition-colors whitespace-nowrap"
              >
                Sign Out ({currentUser.name.split(' ')[0]})
              </button>
              <button 
                onClick={() => onNavigate?.('portal')}
                className="flex items-center gap-2 bg-[#9c4126] hover:bg-[#83341d] text-white px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wider uppercase transition-all shadow-sm active:scale-95 whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#fbbd9c]" />
                Portal
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => onOpenAuth?.('signin')}
                className="text-xs font-semibold uppercase tracking-wider text-[#3b1e4a] hover:text-[#f27438] transition-colors whitespace-nowrap"
              >
                Sign In
              </button>
              <button 
                onClick={() => onOpenAuth?.('signup')}
                className="flex items-center gap-2 bg-[#9c4126] hover:bg-[#83341d] text-white px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wider uppercase transition-all shadow-sm active:scale-95 whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#fbbd9c]" />
                Portal
              </button>
            </>
          )}
        </div>

        {/* Mobile Hamburger Menu Toggle */}
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden text-[#1f1b20] p-1.5 focus:outline-none"
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden pt-4 pb-2 border-t border-[#ece6ed] mt-4 space-y-3">
          <button 
            onClick={() => handleNav('solutions')}
            className={`block w-full text-left text-sm font-semibold py-2 ${activeRoute === 'solutions' ? 'text-[#3b1e4a]' : 'text-[#1f1b20]'}`}
          >
            Solutions
          </button>
          <button 
            onClick={() => handleNav('adaptive-engine')}
            className={`block w-full text-left text-sm font-semibold py-2 ${activeRoute === 'adaptive-engine' ? 'text-[#3b1e4a]' : 'text-[#1f1b20]'}`}
          >
            Adaptive Engine
          </button>
          <button 
            onClick={() => handleNav('student-voice')}
            className={`block w-full text-left text-sm font-semibold py-2 ${activeRoute === 'student-voice' ? 'text-[#3b1e4a]' : 'text-[#1f1b20]'}`}
          >
            Student Voice
          </button>
          <button 
            onClick={() => handleNav('timetable')}
            className={`block w-full text-left text-sm font-semibold py-2 flex items-center justify-between ${activeRoute === 'timetable' ? 'text-[#3b1e4a]' : 'text-[#1f1b20]'}`}
          >
            <span>Timetable Matrix</span>
            {!currentUser && <Lock className="w-3.5 h-3.5 text-[#7c747f]" />}
          </button>
          <button 
            onClick={() => handleNav('generator')}
            className={`block w-full text-left text-sm font-semibold py-2 flex items-center justify-between ${activeRoute === 'generator' ? 'text-[#3b1e4a]' : 'text-[#1f1b20]'}`}
          >
            <span>Generator Studio</span>
            {!currentUser && <Lock className="w-3.5 h-3.5 text-[#7c747f]" />}
          </button>
          <button 
            onClick={() => handleNav('case-studies')}
            className={`block w-full text-left text-sm font-semibold py-2 ${activeRoute === 'case-studies' ? 'text-[#3b1e4a]' : 'text-[#1f1b20]'}`}
          >
            Institutional Case Studies
          </button>

          <div className="pt-2 flex flex-col gap-2">
            {!currentUser ? (
              <>
                <button 
                  onClick={() => { onOpenAuth?.('signin'); setMobileMenuOpen(false); }}
                  className="w-full text-center py-2.5 text-xs font-semibold uppercase tracking-wider text-[#3b1e4a] border border-[#ece6ed] rounded-xl"
                >
                  Sign In
                </button>
                <button 
                  onClick={() => { onOpenAuth?.('signup'); setMobileMenuOpen(false); }}
                  className="w-full bg-[#9c4126] text-white py-2.5 rounded-xl text-xs font-semibold tracking-wider uppercase text-center"
                >
                  Launch Portal
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => { onNavigate?.('portal'); setMobileMenuOpen(false); }}
                  className="w-full bg-[#9c4126] text-white py-2.5 rounded-xl text-xs font-semibold tracking-wider uppercase text-center"
                >
                  Launch Portal
                </button>
                <button 
                  onClick={onSignOut}
                  className="w-full text-center py-2 text-xs font-semibold text-[#7c747f] hover:text-[#9c4126]"
                >
                  Sign Out
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
