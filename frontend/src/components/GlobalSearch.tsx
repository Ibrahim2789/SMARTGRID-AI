import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RouteType } from './SmartGridNav';
import { useInstitutionalData, institutionalStore } from '../data/store';
import {
  Search,
  Building2,
  GraduationCap,
  BookOpen,
  User,
  DoorOpen,
  ArrowRight,
  Sparkles,
  Command,
  X,
  Layers,
  Calendar
} from 'lucide-react';

interface GlobalSearchProps {
  onNavigate: (route: RouteType) => void;
  onOpenSetupStep?: (stepIdx: number) => void;
  variant?: 'topbar' | 'compact';
}

type SearchCategory = 'departments' | 'cohorts' | 'courses' | 'faculty' | 'rooms';

interface SearchResultItem {
  id: string;
  category: SearchCategory;
  title: string;
  subtitle: string;
  badge?: string;
  actionText: string;
  onSelect: () => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  onNavigate,
  onOpenSetupStep,
  variant = 'topbar'
}) => {
  const store = useInstitutionalData();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Global keyboard shortcut: Cmd+K / Ctrl+K / '/'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      } else if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setIsOpen(true);
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Filter & match items across departments, batches/sections, courses, instructors, and rooms
  const searchResults: SearchResultItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items: SearchResultItem[] = [];

    // 1. Batches & Sections (Primary university scheduling targets)
    store.studentGroups.forEach(group => {
      const match =
        !q ||
        group.code.toLowerCase().includes(q) ||
        group.name.toLowerCase().includes(q) ||
        (group.batchCode && group.batchCode.toLowerCase().includes(q)) ||
        (group.semester && `semester ${group.semester}`.includes(q));

      if (match) {
        const prog = store.programs.find(p => p.id === group.programId);
        const dept = store.departments.find(d => d.id === prog?.departmentId);
        items.push({
          id: `group-${group.id}`,
          category: 'cohorts',
          title: group.code,
          subtitle: `${group.name}${dept ? ` · ${dept.code}` : ''}${group.semester ? ` (Sem ${group.semester})` : ''}`,
          badge: group.batchCode || 'Cohort',
          actionText: 'View Timetable',
          onSelect: () => {
            institutionalStore.setSelectedClassGroupId(group.id);
            onNavigate('timetables');
            setIsOpen(false);
          }
        });
      }
    });

    // 2. Departments
    store.departments.forEach(dept => {
      const match =
        !q ||
        dept.name.toLowerCase().includes(q) ||
        dept.code.toLowerCase().includes(q);

      if (match) {
        const deptSectionsCount = store.studentGroups.filter(g => {
          const prog = store.programs.find(p => p.id === g.programId);
          return prog?.departmentId === dept.id;
        }).length;

        items.push({
          id: `dept-${dept.id}`,
          category: 'departments',
          title: `${dept.code} — ${dept.name}`,
          subtitle: `${deptSectionsCount} Sections · ${dept.school || 'Academic School'}`,
          badge: 'Department',
          actionText: 'Open Dept Schedule',
          onSelect: () => {
            const firstGroupInDept = store.studentGroups.find(g => {
              const prog = store.programs.find(p => p.id === g.programId);
              return prog?.departmentId === dept.id;
            });
            if (firstGroupInDept) {
              institutionalStore.setSelectedClassGroupId(firstGroupInDept.id);
            }
            onNavigate('timetables');
            setIsOpen(false);
          }
        });
      }
    });

    // 3. Courses
    store.courses.forEach(course => {
      const match =
        !q ||
        course.code.toLowerCase().includes(q) ||
        (course.title && course.title.toLowerCase().includes(q));

      if (match) {
        const isLabCourse = course.requiredRoomType === 'lab';
        const dept = store.departments.find(d => d.id === course.departmentId);
        items.push({
          id: `course-${course.id}`,
          category: 'courses',
          title: `${course.code}: ${course.title}`,
          subtitle: `${course.creditHours} Credits · ${dept ? dept.code : 'Curriculum'}${isLabCourse ? ' · Lab-Integrated' : ''}`,
          badge: isLabCourse ? 'Theory + Lab' : 'Theory',
          actionText: 'Locate Course',
          onSelect: () => {
            if (onOpenSetupStep) {
              onOpenSetupStep(2); // Courses setup step
            } else {
              onNavigate('setup');
            }
            setIsOpen(false);
          }
        });
      }
    });

    // 4. Faculty & Instructors
    store.instructors.forEach(inst => {
      const match =
        !q ||
        inst.name.toLowerCase().includes(q) ||
        (inst.title && inst.title.toLowerCase().includes(q)) ||
        (inst.email && inst.email.toLowerCase().includes(q));

      if (match) {
        const dept = store.departments.find(d => d.id === inst.departmentId);
        items.push({
          id: `inst-${inst.id}`,
          category: 'faculty',
          title: inst.name,
          subtitle: `${inst.title || 'Faculty'}${dept ? ` · ${dept.name}` : ''}`,
          badge: 'Faculty',
          actionText: 'View Schedule',
          onSelect: () => {
            onNavigate('timetables');
            setIsOpen(false);
          }
        });
      }
    });

    // 5. Classrooms & Laboratories
    store.rooms.forEach(room => {
      const match =
        !q ||
        room.code.toLowerCase().includes(q) ||
        room.name.toLowerCase().includes(q) ||
        (room.type && room.type.toLowerCase().includes(q));

      if (match) {
        items.push({
          id: `room-${room.id}`,
          category: 'rooms',
          title: room.code,
          subtitle: `${room.name} · ${room.capacity} seats`,
          badge: room.type === 'lab' ? 'Laboratory' : 'Classroom',
          actionText: 'View Room Schedule',
          onSelect: () => {
            onNavigate('timetables');
            setIsOpen(false);
          }
        });
      }
    });

    // Sort to prioritize exact/prefix matches and limit to top results
    return items.slice(0, 15);
  }, [query, store, onNavigate, onOpenSetupStep]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchResults]);

  const handleKeyDownInput = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : Math.max(0, searchResults.length - 1)));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults[selectedIndex]) {
        searchResults[selectedIndex].onSelect();
      }
    }
  };

  const getCategoryIcon = (category: SearchCategory) => {
    switch (category) {
      case 'departments':
        return <Building2 className="w-4 h-4 text-[#171717]" />;
      case 'cohorts':
        return <GraduationCap className="w-4 h-4 text-[#171717]" />;
      case 'courses':
        return <BookOpen className="w-4 h-4 text-[#171717]" />;
      case 'faculty':
        return <User className="w-4 h-4 text-[#171717]" />;
      case 'rooms':
        return <DoorOpen className="w-4 h-4 text-[#171717]" />;
    }
  };

  return (
    <div ref={containerRef} className="relative z-40">
      {/* Trigger Button: Top Bar or Compact Icon */}
      {variant === 'compact' ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-8 h-8 rounded-lg bg-[#292929] hover:bg-[#333333] border border-[#3E3E3E] text-[#C2C0B8] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          title="Search academic records (Cmd+K)"
          aria-label="Global search"
        >
          <Search className="w-4 h-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="h-9 px-3 w-64 lg:w-84 rounded-xl bg-[#F7F6EF] hover:bg-[#EDEAE0] border border-[#E4E2DA] flex items-center justify-between text-xs text-[#77766F] transition-all cursor-pointer shadow-2xs group"
          title="Search departments, student batches, courses, faculty (Cmd+K)"
          aria-label="Global search"
        >
          <span className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 text-[#171717] shrink-0" />
            <span className="text-[#57564F] group-hover:text-[#171717] truncate font-medium">
              Search departments, batches, courses...
            </span>
          </span>
          <span className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white border border-[#E4E2DA] text-[10px] font-mono-tabular font-medium text-[#77766F] shrink-0">
            <Command className="w-2.5 h-2.5" />
            <span>K</span>
          </span>
        </button>
      )}

      {/* Global Search Modal & Dropdown Palette */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/40 backdrop-blur-xs">
          <div
            ref={dropdownRef}
            className="w-full max-w-2xl bg-white border border-[#E4E2DA] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[82vh] animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Search Input Header */}
            <div className="p-3.5 sm:p-4 border-b border-[#E4E2DA] flex items-center gap-3 bg-[#F7F6EF]">
              <Search className="w-5 h-5 text-[#171717] shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Find department (e.g. CS), batch (BSCS-1A), course (CS101), faculty..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDownInput}
                className="w-full bg-transparent text-sm sm:text-base font-medium text-[#171717] placeholder:text-[#77766F] focus:outline-hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="p-1 text-[#77766F] hover:text-[#171717] rounded-md cursor-pointer"
                  aria-label="Clear query"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-2 py-1 text-xs rounded-lg bg-white border border-[#E4E2DA] text-[#57564F] hover:text-[#171717] cursor-pointer shrink-0 font-medium"
              >
                Esc
              </button>
            </div>

            {/* Live Categorized Results List */}
            <div className="overflow-y-auto p-2 divide-y divide-[#F0EFEA] max-h-[55vh]">
              {searchResults.length > 0 ? (
                <div className="space-y-1">
                  {searchResults.map((item, idx) => {
                    const isSelected = idx === selectedIndex;
                    return (
                      <div
                        key={item.id}
                        onClick={item.onSelect}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#171717] text-white'
                            : 'hover:bg-[#F7F6EF] text-[#171717]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                              isSelected
                                ? 'bg-white/10 border-white/20 text-white'
                                : 'bg-[#F7F6EF] border-[#E4E2DA] text-[#171717]'
                            }`}
                          >
                            {getCategoryIcon(item.category)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-sm font-semibold truncate ${
                                  isSelected ? 'text-white' : 'text-[#171717]'
                                }`}
                              >
                                {item.title}
                              </span>
                              {item.badge && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono-tabular font-semibold shrink-0 ${
                                    isSelected
                                      ? 'bg-white/15 text-[#B8EEEE]'
                                      : 'bg-[#F7F6EF] text-[#57564F] border border-[#E4E2DA]'
                                  }`}
                                >
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            <div
                              className={`text-xs truncate mt-0.5 ${
                                isSelected ? 'text-white/80' : 'text-[#77766F]'
                              }`}
                            >
                              {item.subtitle}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 pl-2">
                          <span
                            className={`text-xs font-semibold ${
                              isSelected ? 'text-[#B7F77C]' : 'text-[#57564F]'
                            }`}
                          >
                            {item.actionText}
                          </span>
                          <ArrowRight
                            className={`w-3.5 h-3.5 transition-transform ${
                              isSelected
                                ? 'translate-x-0.5 text-[#B7F77C]'
                                : 'text-[#77766F]'
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-10 px-4 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-[#F7F6EF] text-[#77766F] mx-auto flex items-center justify-center">
                    <Search className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-semibold text-[#171717]">
                    No matching academic records found
                  </div>
                  <p className="text-xs text-[#77766F] max-w-sm mx-auto">
                    No departments, batches, or courses match "{query}". Try searching by department code (e.g. CS), cohort name (BSCS-1A), or course title.
                  </p>
                </div>
              )}
            </div>

            {/* Quick Navigation Footer */}
            <div className="p-3 bg-[#F7F6EF] border-t border-[#E4E2DA] flex flex-wrap items-center justify-between gap-2 text-xs text-[#77766F]">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#E4E2DA] text-[10px] font-mono-tabular">
                    ↑↓
                  </kbd>{' '}
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#E4E2DA] text-[10px] font-mono-tabular">
                    ↵
                  </kbd>{' '}
                  Jump Directly
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#E4E2DA] text-[10px] font-mono-tabular">
                    Esc
                  </kbd>{' '}
                  Close
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('timetables');
                    setIsOpen(false);
                  }}
                  className="font-semibold text-[#171717] hover:underline cursor-pointer"
                >
                  Master Timetable →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
