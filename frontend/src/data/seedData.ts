import { 
  AcademicTerm, 
  Campus, 
  Building, 
  Room, 
  Department, 
  Program, 
  Course, 
  Section, 
  Instructor, 
  StudentGroup, 
  TimeStructure, 
  ConstraintRule, 
  TimetableScenario, 
  AuditLogEntry 
} from '../types/institutional';

export const seedTerms: AcademicTerm[] = [
  {
    id: 'term-2025-fall',
    name: 'Fall Semester 2025',
    code: 'FALL-2025',
    startDate: '2025-08-25',
    endDate: '2025-12-19',
    status: 'archived',
    weeksCount: 16
  },
  {
    id: 'term-2026-spring',
    name: 'Term 2 (Spring 2026)',
    code: 'SPRING-2026',
    startDate: '2026-01-12',
    endDate: '2026-05-15',
    status: 'active',
    weeksCount: 16
  },
  {
    id: 'term-2026-fall',
    name: 'Fall Semester 2026',
    code: 'FALL-2026',
    startDate: '2026-08-24',
    endDate: '2026-12-18',
    status: 'draft',
    weeksCount: 16
  }
];

export const seedCampuses: Campus[] = [
  {
    id: 'campus-north',
    name: 'North Main Academic Campus',
    code: 'NORTH',
    address: '400 Institute Way, University Heights'
  },
  {
    id: 'campus-south',
    name: 'South Applied Research Quad',
    code: 'SOUTH',
    address: '120 Science Parkway, Technology District'
  }
];

export const seedBuildings: Building[] = [
  {
    id: 'bld-turing',
    campusId: 'campus-north',
    name: 'Alan Turing Computer Science Hall',
    code: 'TUR',
    floors: 4
  },
  {
    id: 'bld-franklin',
    campusId: 'campus-south',
    name: 'Rosalind Franklin Life Sciences Wing',
    code: 'FRK',
    floors: 3
  },
  {
    id: 'bld-euler',
    campusId: 'campus-north',
    name: 'Leonhard Euler Engineering Center',
    code: 'EUL',
    floors: 5
  },
  {
    id: 'bld-vitruvius',
    campusId: 'campus-north',
    name: 'Vitruvius Design & Architecture Complex',
    code: 'VIT',
    floors: 3
  }
];

export const seedRooms: Room[] = [
  // Turing CS Hall (North)
  {
    id: 'room-hall-b3',
    buildingId: 'bld-turing',
    code: 'Hall B3',
    name: 'Turing Tiered Lecture Hall B3',
    capacity: 120,
    type: 'lecture',
    equipment: ['Dual Laser Projectors', 'Lecture Capture', 'Mic Array'],
    isAccessible: true,
    isAvailable: true
  },
  {
    id: 'room-lab-2',
    buildingId: 'bld-turing',
    code: 'Lab 2',
    name: 'Systems & Networks Laboratory 2',
    capacity: 40,
    type: 'lab',
    equipment: ['High-Performance Workstations', 'Cisco Switch Racks', 'Dual Displays'],
    isAccessible: true,
    isAvailable: true
  },
  {
    id: 'room-hall-a1',
    buildingId: 'bld-turing',
    code: 'Hall A1',
    name: 'Mathematical Sciences Auditorium A1',
    capacity: 180,
    type: 'lecture',
    equipment: ['Triple HD Projectors', 'Wireless Mic', 'Document Camera'],
    isAccessible: true,
    isAvailable: true
  },
  {
    id: 'room-sem-201',
    buildingId: 'bld-turing',
    code: 'Seminar 201',
    name: 'Graduate Computing Colloquium Room',
    capacity: 28,
    type: 'seminar',
    equipment: ['Smart Board', 'Video Conference Hub', 'Whiteboard Wall'],
    isAccessible: true,
    isAvailable: true
  },
  {
    id: 'room-lab-6',
    buildingId: 'bld-turing',
    code: 'Lab 6',
    name: 'Artificial Intelligence & Robotics Lab',
    capacity: 32,
    type: 'lab',
    equipment: ['GPU Cluster Access', 'Sensor Testing Rig', 'Workstations'],
    isAccessible: true,
    isAvailable: true
  },

  // Franklin Life Sciences (South)
  {
    id: 'room-lab-4',
    buildingId: 'bld-franklin',
    code: 'Lab 4',
    name: 'Cellular Genomics & Microscopy Lab',
    capacity: 32,
    type: 'lab',
    equipment: ['Confocal Microscopes', 'Autoclave Access', 'Chemical Fume Hoods'],
    isAccessible: true,
    isAvailable: true
  },
  {
    id: 'room-chem-lab-b',
    buildingId: 'bld-franklin',
    code: 'Chem Lab B',
    name: 'Synthetic Organic Chemistry Lab B',
    capacity: 36,
    type: 'lab',
    equipment: ['8 Fume Hoods', 'Rotary Evaporators', 'Safety Shower'],
    isAccessible: true,
    isAvailable: true
  },
  {
    id: 'room-aud-100',
    buildingId: 'bld-franklin',
    code: 'Bio Aud 100',
    name: 'BioSciences Memorial Auditorium',
    capacity: 220,
    type: 'lecture',
    equipment: ['Cinema Projector', 'Acoustic Shell', 'Live Broadcast Camera'],
    isAccessible: true,
    isAvailable: true
  },
  {
    id: 'room-sem-105',
    buildingId: 'bld-franklin',
    code: 'Bio Sem 105',
    name: 'Biochemistry Honors Seminar Room',
    capacity: 24,
    type: 'seminar',
    equipment: ['HD TV Screen', 'Mobile Whiteboards'],
    isAccessible: true,
    isAvailable: true
  },
  {
    id: 'room-lab-8',
    buildingId: 'bld-franklin',
    code: 'Bio Lab 8',
    name: 'Biomaterials Engineering Lab',
    capacity: 30,
    type: 'lab',
    equipment: ['Tensile Testers', 'Incubator Shakers', 'Fume Hood'],
    isAccessible: true,
    isAvailable: true
  },

  // Euler Engineering Center (North)
  {
    id: 'room-eng-hall-1',
    buildingId: 'bld-euler',
    code: 'Eng Hall 1',
    name: 'Euler Engineering Lecture Theater 1',
    capacity: 140,
    type: 'lecture',
    equipment: ['Dual 4K Projectors', 'Sound Array', 'Tiered Power Outlets'],
    isAccessible: true,
    isAvailable: true
  },
  {
    id: 'room-quad-a',
    buildingId: 'bld-euler',
    code: 'Quad A',
    name: 'Euler Quad Amphitheater A',
    capacity: 90,
    type: 'lecture',
    equipment: ['Overhead Projection', 'Clip-on Lavalier Mics'],
    isAccessible: true,
    isAvailable: true
  },
  {
    id: 'room-fluid-lab',
    buildingId: 'bld-euler',
    code: 'Fluid Lab',
    name: 'Aerodynamics & Fluid Dynamics Lab',
    capacity: 28,
    type: 'lab',
    equipment: ['Subsonic Wind Tunnel', 'Hydraulics Flume', 'Laser Doppler PIV'],
    isAccessible: true,
    isAvailable: true
  },
  {
    id: 'room-cad-lab',
    buildingId: 'bld-euler',
    code: 'CAD Lab 1',
    name: 'SolidWorks & Finite Element Design Lab',
    capacity: 45,
    type: 'lab',
    equipment: ['Precision 3D Mice', 'Dual Workstation Monitors', 'Large Plotter'],
    isAccessible: true,
    isAvailable: true
  },
  {
    id: 'room-sem-302',
    buildingId: 'bld-euler',
    code: 'Eng Sem 302',
    name: 'Aerospace Systems Senior Seminar',
    capacity: 25,
    type: 'seminar',
    equipment: ['Conference Table Display', 'Boundary Microphones'],
    isAccessible: true,
    isAvailable: true
  },

  // Vitruvius Architecture Complex (North)
  {
    id: 'room-atrium',
    buildingId: 'bld-vitruvius',
    code: 'Atrium',
    name: 'Central Vitruvius Spatial Design Studio',
    capacity: 60,
    type: 'studio',
    equipment: ['Adjustable Drafting Tables', 'Cutting Mats', 'Daylight Skyroof'],
    isAccessible: true,
    isAvailable: true
  },
  {
    id: 'room-annex-2',
    buildingId: 'bld-vitruvius',
    code: 'Annex 2',
    name: 'Humanities & Social Ethics Recitation Annex',
    capacity: 45,
    type: 'seminar',
    equipment: ['Mobile Seating', 'Interactive Touchscreen'],
    isAccessible: true,
    isAvailable: true
  },
  {
    id: 'room-fab-lab',
    buildingId: 'bld-vitruvius',
    code: 'Fab Lab',
    name: 'Architectural Prototyping & CNC Lab',
    capacity: 26,
    type: 'lab',
    equipment: ['Laser Cutters', '3D Printers', 'Dust Extraction System'],
    isAccessible: true,
    isAvailable: true
  },
  {
    id: 'room-arch-hall',
    buildingId: 'bld-vitruvius',
    code: 'Arch Hall 2',
    name: 'Urban Planning Colloquium Hall',
    capacity: 85,
    type: 'lecture',
    equipment: ['Wide-aspect HD Screen', 'Microphone Podium'],
    isAccessible: true,
    isAvailable: true
  },
  {
    id: 'room-studio-b',
    buildingId: 'bld-vitruvius',
    code: 'Studio B',
    name: 'Environmental Architecture Workshop',
    capacity: 35,
    type: 'studio',
    equipment: ['Drafting Stations', 'Model Storage Racks', 'High CRI Lighting'],
    isAccessible: true,
    isAvailable: true
  }
];

export const seedDepartments: Department[] = [
  {
    id: 'dept-cs',
    name: 'Computer Science & Software Systems',
    code: 'CS',
    school: 'School of Computing & Mathematical Sciences',
    colorHex: '#0D9488' // Teal
  },
  {
    id: 'dept-bio',
    name: 'Bioengineering & Chemical Sciences',
    code: 'BIO',
    school: 'School of Life Sciences',
    colorHex: '#059669' // Emerald
  },
  {
    id: 'dept-eng',
    name: 'Mechanical & Aerospace Engineering',
    code: 'ENG',
    school: 'School of Engineering & Applied Science',
    colorHex: '#D97706' // Ochre / Amber
  },
  {
    id: 'dept-arch',
    name: 'Architecture & Environmental Planning',
    code: 'ARCH',
    school: 'College of Built Environment',
    colorHex: '#C2410C' // Terracotta
  },
  {
    id: 'dept-math',
    name: 'Mathematics & Applied Statistics',
    code: 'MATH',
    school: 'School of Computing & Mathematical Sciences',
    colorHex: '#2563EB' // Slate blue
  },
  {
    id: 'dept-hum',
    name: 'Humanities, Ethics & Public Policy',
    code: 'HUM',
    school: 'Faculty of Arts and Social Sciences',
    colorHex: '#475569' // Slate
  }
];

export const seedPrograms: Program[] = [
  {
    id: 'prog-bsc-cs',
    departmentId: 'dept-cs',
    name: 'Bachelor of Science in Computer Science',
    code: 'BSC-CS',
    degreeLevel: 'Undergraduate',
    totalSemesters: 8
  },
  {
    id: 'prog-msc-cs',
    departmentId: 'dept-cs',
    name: 'Master of Science in Distributed & AI Systems',
    code: 'MSC-CS',
    degreeLevel: 'Graduate',
    totalSemesters: 4
  },
  {
    id: 'prog-bsc-bio',
    departmentId: 'dept-bio',
    name: 'Bachelor of Science in Bioengineering',
    code: 'BSC-BIO',
    degreeLevel: 'Undergraduate',
    totalSemesters: 8
  },
  {
    id: 'prog-bsc-eng',
    departmentId: 'dept-eng',
    name: 'Bachelor of Science in Mechanical Engineering',
    code: 'BSC-ENG',
    degreeLevel: 'Undergraduate',
    totalSemesters: 8
  },
  {
    id: 'prog-barch',
    departmentId: 'dept-arch',
    name: 'Bachelor of Architecture',
    code: 'B-ARCH',
    degreeLevel: 'Undergraduate',
    totalSemesters: 10
  },
  {
    id: 'prog-bsc-math',
    departmentId: 'dept-math',
    name: 'Bachelor of Science in Applied Mathematics',
    code: 'BSC-MATH',
    degreeLevel: 'Undergraduate',
    totalSemesters: 8
  }
];

export const seedCourses: Course[] = [
  // Computer Science (7 courses)
  {
    id: 'course-cs-101',
    departmentId: 'dept-cs',
    code: 'CS-101',
    title: 'Introduction to Algorithmic Problem Solving',
    creditHours: 4,
    weeklyContactHours: 5,
    lectureHours: 3,
    labHours: 2,
    requiredRoomType: 'lecture',
    description: 'Foundations of algorithms, procedural control flow, recursion, and elementary complexity.'
  },
  {
    id: 'course-cs-201',
    departmentId: 'dept-cs',
    code: 'CS-201',
    title: 'Computer Architecture & Systems Programming',
    creditHours: 4,
    weeklyContactHours: 5,
    lectureHours: 3,
    labHours: 2,
    requiredRoomType: 'lab',
    description: 'Instruction sets, memory hierarchy, cache coherence, and POSIX C programming.'
  },
  {
    id: 'course-cs-301',
    departmentId: 'dept-cs',
    code: 'CS-301',
    title: 'Data Structures & Algorithms',
    creditHours: 4,
    weeklyContactHours: 4,
    lectureHours: 3,
    labHours: 1,
    requiredRoomType: 'lecture',
    description: 'Balanced trees, graph traversals, amortized complexity analysis, dynamic programming.'
  },
  {
    id: 'course-cs-412',
    departmentId: 'dept-cs',
    code: 'CS-412',
    title: 'Distributed Systems & Cloud Consensus',
    creditHours: 4,
    weeklyContactHours: 4,
    lectureHours: 3,
    labHours: 1,
    requiredRoomType: 'lecture',
    description: 'Paxos, Raft consensus, Byzantine fault tolerance, distributed transactions.'
  },
  {
    id: 'course-cs-450',
    departmentId: 'dept-cs',
    code: 'CS-450',
    title: 'Database Management & Relational Theory',
    creditHours: 3,
    weeklyContactHours: 3,
    lectureHours: 3,
    labHours: 0,
    requiredRoomType: 'lecture',
    description: 'B-tree indexation, ACID transaction isolation, query optimization engines.'
  },
  {
    id: 'course-cs-520',
    departmentId: 'dept-cs',
    code: 'CS-520',
    title: 'Deep Learning & Neural Network Synthesis',
    creditHours: 4,
    weeklyContactHours: 4,
    lectureHours: 3,
    labHours: 1,
    requiredRoomType: 'lab',
    description: 'Backpropagation calculus, attention transformers, tensor execution runtimes.'
  },
  {
    id: 'course-cs-580',
    departmentId: 'dept-cs',
    code: 'CS-580',
    title: 'Applied Cryptography & Security Protocols',
    creditHours: 3,
    weeklyContactHours: 3,
    lectureHours: 3,
    labHours: 0,
    requiredRoomType: 'seminar',
    description: 'Elliptic curve arithmetic, zero-knowledge proofs, authenticated key exchange.'
  },

  // Bioengineering & Chemical (7 courses)
  {
    id: 'course-bio-110',
    departmentId: 'dept-bio',
    code: 'BIO-110',
    title: 'Principles of Molecular & Cellular Biology',
    creditHours: 4,
    weeklyContactHours: 5,
    lectureHours: 3,
    labHours: 2,
    requiredRoomType: 'lecture',
    description: 'Cell architecture, biochemical pathways, gene expression, and enzyme kinetics.'
  },
  {
    id: 'course-bio-210',
    departmentId: 'dept-bio',
    code: 'BIO-210',
    title: 'Cell Genomics & Recombinant DNA',
    creditHours: 3,
    weeklyContactHours: 4,
    lectureHours: 2,
    labHours: 2,
    requiredRoomType: 'lab',
    description: 'CRISPR-Cas editing protocols, genome sequencing informatics, RNA sequencing.'
  },
  {
    id: 'course-bio-320',
    departmentId: 'dept-bio',
    code: 'BIO-320',
    title: 'Biomaterials & Tissue Scaffolding',
    creditHours: 3,
    weeklyContactHours: 4,
    lectureHours: 2,
    labHours: 2,
    requiredRoomType: 'lab',
    description: 'Biocompatibility, polymer hydrogels, mechanical testing of synthetic tissue matrices.'
  },
  {
    id: 'course-bio-401',
    departmentId: 'dept-bio',
    code: 'BIO-401',
    title: 'Biomedical Microfluidics & Bio-MEMS',
    creditHours: 4,
    weeklyContactHours: 4,
    lectureHours: 3,
    labHours: 1,
    requiredRoomType: 'lab',
    description: 'Laminar microchannel physics, lab-on-a-chip diagnostic device engineering.'
  },
  {
    id: 'course-bio-440',
    departmentId: 'dept-bio',
    code: 'BIO-440',
    title: 'Computational Systems Biology',
    creditHours: 3,
    weeklyContactHours: 3,
    lectureHours: 3,
    labHours: 0,
    requiredRoomType: 'lecture',
    description: 'Stochastic kinetic models, metabolic flux analysis, signaling pathway dynamics.'
  },
  {
    id: 'course-chem-101',
    departmentId: 'dept-bio',
    code: 'CHEM-101',
    title: 'General Chemistry Principles I',
    creditHours: 4,
    weeklyContactHours: 5,
    lectureHours: 3,
    labHours: 2,
    requiredRoomType: 'lecture',
    description: 'Stoichiometry, thermodynamics, atomic orbitals, thermochemical equilibria.'
  },
  {
    id: 'course-chem-201',
    departmentId: 'dept-bio',
    code: 'CHEM-201',
    title: 'Organic Chemistry & Spectroscopic Synthesis',
    creditHours: 4,
    weeklyContactHours: 5,
    lectureHours: 3,
    labHours: 2,
    requiredRoomType: 'lab',
    description: 'Reaction mechanisms, stereochemistry, NMR and mass spectrometry structure elucidation.'
  },

  // Mechanical & Aerospace Engineering (7 courses)
  {
    id: 'course-eng-101',
    departmentId: 'dept-eng',
    code: 'ENG-101',
    title: 'Engineering Graphic Design & Spatial Modeling',
    creditHours: 3,
    weeklyContactHours: 4,
    lectureHours: 2,
    labHours: 2,
    requiredRoomType: 'lab',
    description: 'Orthographic projection, GD&T tolerancing, parametric parametric SolidWorks modeling.'
  },
  {
    id: 'course-eng-102',
    departmentId: 'dept-eng',
    code: 'ENG-102',
    title: 'Applied Engineering Statics',
    creditHours: 3,
    weeklyContactHours: 3,
    lectureHours: 3,
    labHours: 0,
    requiredRoomType: 'lecture',
    description: 'Vector force systems, truss equilibrium, internal bending moments, and friction.'
  },
  {
    id: 'course-eng-205',
    departmentId: 'dept-eng',
    code: 'ENG-205',
    title: 'Mechanics of Deformable Solids',
    creditHours: 4,
    weeklyContactHours: 4,
    lectureHours: 3,
    labHours: 1,
    requiredRoomType: 'lecture',
    description: 'Stress-strain tensors, Mohr circles, beam deflection equations, and torsion.'
  },
  {
    id: 'course-eng-302',
    departmentId: 'dept-eng',
    code: 'ENG-302',
    title: 'Fluid Dynamics & Navier-Stokes Transport',
    creditHours: 4,
    weeklyContactHours: 5,
    lectureHours: 3,
    labHours: 2,
    requiredRoomType: 'lecture',
    description: 'Continuity equations, boundary layer theory, turbulent boundary layer separation.'
  },
  {
    id: 'course-eng-340',
    departmentId: 'dept-eng',
    code: 'ENG-340',
    title: 'Thermodynamics & Heat Transfer Systems',
    creditHours: 3,
    weeklyContactHours: 3,
    lectureHours: 3,
    labHours: 0,
    requiredRoomType: 'lecture',
    description: 'Rankine and Brayton heat cycles, conduction-convection-radiation thermal analysis.'
  },
  {
    id: 'course-eng-410',
    departmentId: 'dept-eng',
    code: 'ENG-410',
    title: 'Robotics Kinematics & Dynamic Control',
    creditHours: 4,
    weeklyContactHours: 4,
    lectureHours: 3,
    labHours: 1,
    requiredRoomType: 'lab',
    description: 'Denavit-Hartenberg matrices, PID and state-space control, trajectory planning.'
  },
  {
    id: 'course-eng-460',
    departmentId: 'dept-eng',
    code: 'ENG-460',
    title: 'Aerospace Propulsion & Gas Turbines',
    creditHours: 3,
    weeklyContactHours: 3,
    lectureHours: 3,
    labHours: 0,
    requiredRoomType: 'seminar',
    description: 'Compressible nozzle flow, turbofan cycle performance, combustion chamber thermodynamics.'
  },

  // Architecture (5 courses)
  {
    id: 'course-arch-101',
    departmentId: 'dept-arch',
    code: 'ARCH-101',
    title: 'Visual Representation & Freehand Tectonic Drawing',
    creditHours: 3,
    weeklyContactHours: 5,
    lectureHours: 1,
    labHours: 4,
    requiredRoomType: 'studio',
    description: 'Axonometric projection, light-and-shadow rendering, perspective drawing techniques.'
  },
  {
    id: 'course-arch-202',
    departmentId: 'dept-arch',
    code: 'ARCH-202',
    title: 'Architectural History & Structural Tectonics',
    creditHours: 3,
    weeklyContactHours: 3,
    lectureHours: 3,
    labHours: 0,
    requiredRoomType: 'lecture',
    description: 'Global urban history from antiquity through brutalism and sustainable modernism.'
  },
  {
    id: 'course-arch-305',
    departmentId: 'dept-arch',
    code: 'ARCH-305',
    title: 'Parametric Urbanism & Algorithmic Geometry',
    creditHours: 4,
    weeklyContactHours: 4,
    lectureHours: 2,
    labHours: 2,
    requiredRoomType: 'lab',
    description: 'Grasshopper/Rhino computational modeling, environmental facade solar optimization.'
  },
  {
    id: 'course-arch-405',
    departmentId: 'dept-arch',
    code: 'ARCH-405',
    title: 'Spatial Studio: Integrated Urban Assemblages',
    creditHours: 5,
    weeklyContactHours: 6,
    lectureHours: 2,
    labHours: 4,
    requiredRoomType: 'studio',
    description: 'Comprehensive design studio investigating mixed-use civic transit hubs.'
  },
  {
    id: 'course-arch-490',
    departmentId: 'dept-arch',
    code: 'ARCH-490',
    title: 'Zero-Carbon Building Systems & Net-Zero Envelope',
    creditHours: 3,
    weeklyContactHours: 3,
    lectureHours: 3,
    labHours: 0,
    requiredRoomType: 'seminar',
    description: 'Embodied carbon metrics, passive solar thermal mass, HVAC energy benchmarking.'
  },

  // Mathematics & Applied Statistics (3 courses)
  {
    id: 'course-math-101',
    departmentId: 'dept-math',
    code: 'MATH-101',
    title: 'Calculus I: Single Variable Analysis',
    creditHours: 4,
    weeklyContactHours: 4,
    lectureHours: 4,
    labHours: 0,
    requiredRoomType: 'lecture',
    description: 'Limits, epsilon-delta rigor, Riemann integrals, fundamental theorem of calculus.'
  },
  {
    id: 'course-math-204',
    departmentId: 'dept-math',
    code: 'MATH-204',
    title: 'Linear Algebra & Matrix Decompositions',
    creditHours: 4,
    weeklyContactHours: 4,
    lectureHours: 4,
    labHours: 0,
    requiredRoomType: 'lecture',
    description: 'Vector spaces, eigenvalues, singular value decomposition, orthogonal projections.'
  },
  {
    id: 'course-math-310',
    departmentId: 'dept-math',
    code: 'MATH-310',
    title: 'Applied Probability & Stochastic Processes',
    creditHours: 3,
    weeklyContactHours: 3,
    lectureHours: 3,
    labHours: 0,
    requiredRoomType: 'lecture',
    description: 'Markov chains, Poisson arrival queues, Brownian motion, Monte Carlo simulation.'
  },

  // Humanities & General Core (1 course)
  {
    id: 'course-hum-110',
    departmentId: 'dept-hum',
    code: 'HUM-110',
    title: 'Ethics in AI, Data & Automated Society',
    creditHours: 3,
    weeklyContactHours: 3,
    lectureHours: 3,
    labHours: 0,
    requiredRoomType: 'seminar',
    description: 'Algorithmic governance, surveillance capitalism, intellectual property in generative models.'
  }
];

export const seedInstructors: Instructor[] = [
  {
    id: 'inst-evans',
    departmentId: 'dept-cs',
    name: 'Dr. Alan Evans',
    email: 'a.evans@westernpoly.edu',
    title: 'Professor of Computer Science',
    maxWeeklyHours: 12,
    maxConsecutiveHours: 3,
    preferredDays: ['Mon', 'Wed', 'Thu'],
    unavailableSlots: [
      { day: 'Tue', timeSlot: '9:00 – 9:50 AM', reason: 'Department Senate Committee' },
      { day: 'Fri', timeSlot: '2:00 – 2:50 PM', reason: 'NSF Grant Research Colloquium' }
    ]
  },
  {
    id: 'inst-chen',
    departmentId: 'dept-cs',
    name: 'Dr. Helena Chen',
    email: 'h.chen@westernpoly.edu',
    title: 'Associate Professor of Software Systems',
    maxWeeklyHours: 14,
    maxConsecutiveHours: 3,
    preferredDays: ['Mon', 'Tue', 'Wed'],
    unavailableSlots: [
      { day: 'Thu', timeSlot: '9:00 – 9:50 AM', reason: 'Industry Advisory Board' }
    ]
  },
  {
    id: 'inst-hopper',
    departmentId: 'dept-cs',
    name: 'Dr. Grace Hopper-Patel',
    email: 'g.patel@westernpoly.edu',
    title: 'Assistant Professor of Machine Learning',
    maxWeeklyHours: 12,
    maxConsecutiveHours: 3,
    preferredDays: ['Tue', 'Thu', 'Fri'],
    unavailableSlots: [
      { day: 'Mon', timeSlot: '2:00 – 2:50 PM', reason: 'Lab Supervision' }
    ]
  },
  {
    id: 'inst-zhao',
    departmentId: 'dept-bio',
    name: 'Dr. Mei Zhao',
    email: 'm.zhao@westernpoly.edu',
    title: 'Professor of Genomic Engineering',
    maxWeeklyHours: 10,
    maxConsecutiveHours: 3,
    preferredDays: ['Tue', 'Wed', 'Thu'],
    unavailableSlots: [
      { day: 'Mon', timeSlot: '9:00 – 9:50 AM', reason: 'Vivarium Protocol Review' },
      { day: 'Fri', timeSlot: '11:00 – 11:50 AM', reason: 'Biosafety Committee' }
    ]
  },
  {
    id: 'inst-scott',
    departmentId: 'dept-bio',
    name: 'Dr. Robert Scott',
    email: 'r.scott@westernpoly.edu',
    title: 'Associate Professor of Chemistry',
    maxWeeklyHours: 14,
    maxConsecutiveHours: 4,
    preferredDays: ['Mon', 'Wed', 'Fri'],
    unavailableSlots: [
      { day: 'Tue', timeSlot: '2:00 – 2:50 PM', reason: 'Hazardous Waste Safety Audit' }
    ]
  },
  {
    id: 'inst-jenkins',
    departmentId: 'dept-bio',
    name: 'Dr. Sarah Jenkins',
    email: 's.jenkins@westernpoly.edu',
    title: 'Assistant Professor of Biomaterials',
    maxWeeklyHours: 12,
    maxConsecutiveHours: 3,
    preferredDays: ['Mon', 'Tue', 'Thu'],
    unavailableSlots: [
      { day: 'Wed', timeSlot: '11:00 – 11:50 AM', reason: 'Clinic Consultations' }
    ]
  },
  {
    id: 'inst-miller',
    departmentId: 'dept-eng',
    name: 'Prof. Marcus Miller',
    email: 'm.miller@westernpoly.edu',
    title: 'Chair & Professor of Mechanical Systems',
    maxWeeklyHours: 10,
    maxConsecutiveHours: 3,
    preferredDays: ['Tue', 'Thu', 'Fri'],
    unavailableSlots: [
      { day: 'Mon', timeSlot: '11:00 – 11:50 AM', reason: 'Deans Council' },
      { day: 'Wed', timeSlot: '9:00 – 9:50 AM', reason: 'ABET Accreditation Prep' }
    ]
  },
  {
    id: 'inst-almansoor',
    departmentId: 'dept-eng',
    name: 'Dr. Tariq Al-Mansoor',
    email: 't.almansoor@westernpoly.edu',
    title: 'Associate Professor of Fluid Mechanics',
    maxWeeklyHours: 14,
    maxConsecutiveHours: 3,
    preferredDays: ['Mon', 'Wed', 'Fri'],
    unavailableSlots: [
      { day: 'Thu', timeSlot: '2:00 – 2:50 PM', reason: 'Wind Tunnel Calibration' }
    ]
  },
  {
    id: 'inst-kim',
    departmentId: 'dept-eng',
    name: 'Dr. David Kim',
    email: 'd.kim@westernpoly.edu',
    title: 'Assistant Professor of Robotics',
    maxWeeklyHours: 12,
    maxConsecutiveHours: 3,
    preferredDays: ['Mon', 'Tue', 'Thu'],
    unavailableSlots: [
      { day: 'Fri', timeSlot: '9:00 – 9:50 AM', reason: 'RoboSub Student Mentorship' }
    ]
  },
  {
    id: 'inst-vance',
    departmentId: 'dept-arch',
    name: 'Dr. Evelyn Vance',
    email: 'e.vance@westernpoly.edu',
    title: 'Distinguished Professor of Architectural Design',
    maxWeeklyHours: 12,
    maxConsecutiveHours: 4,
    preferredDays: ['Tue', 'Thu', 'Fri'],
    unavailableSlots: [
      { day: 'Mon', timeSlot: '9:00 – 9:50 AM', reason: 'Urban Planning Commission' }
    ]
  },
  {
    id: 'inst-campbell',
    departmentId: 'dept-arch',
    name: 'Prof. Donald Campbell',
    email: 'd.campbell@westernpoly.edu',
    title: 'Associate Professor of Urban Form',
    maxWeeklyHours: 14,
    maxConsecutiveHours: 3,
    preferredDays: ['Mon', 'Wed', 'Fri'],
    unavailableSlots: [
      { day: 'Thu', timeSlot: '11:00 – 11:50 AM', reason: 'Design Jury Review' }
    ]
  },
  {
    id: 'inst-morales',
    departmentId: 'dept-arch',
    name: 'Dr. Linda Morales',
    email: 'l.morales@westernpoly.edu',
    title: 'Assistant Professor of Sustainable Architecture',
    maxWeeklyHours: 12,
    maxConsecutiveHours: 3,
    preferredDays: ['Mon', 'Tue', 'Wed'],
    unavailableSlots: [
      { day: 'Fri', timeSlot: '2:00 – 2:50 PM', reason: 'Field Site Inspections' }
    ]
  },
  {
    id: 'inst-raman',
    departmentId: 'dept-math',
    name: 'Dr. Rajesh Raman',
    email: 'r.raman@westernpoly.edu',
    title: 'Professor of Pure & Applied Mathematics',
    maxWeeklyHours: 15,
    maxConsecutiveHours: 3,
    preferredDays: ['Mon', 'Wed', 'Fri'],
    unavailableSlots: [
      { day: 'Tue', timeSlot: '11:00 – 11:50 AM', reason: 'Math Olympiad Coordination' }
    ]
  },
  {
    id: 'inst-sen',
    departmentId: 'dept-math',
    name: 'Dr. Ananya Sen',
    email: 'a.sen@westernpoly.edu',
    title: 'Associate Professor of Statistics',
    maxWeeklyHours: 14,
    maxConsecutiveHours: 3,
    preferredDays: ['Tue', 'Thu', 'Fri'],
    unavailableSlots: [
      { day: 'Wed', timeSlot: '2:00 – 2:50 PM', reason: 'Biostatistics Consulting' }
    ]
  },
  {
    id: 'inst-gomez',
    departmentId: 'dept-hum',
    name: 'Dr. Sofia Gomez',
    email: 's.gomez@westernpoly.edu',
    title: 'Associate Professor of Technology Ethics',
    maxWeeklyHours: 12,
    maxConsecutiveHours: 3,
    preferredDays: ['Mon', 'Wed', 'Fri'],
    unavailableSlots: [
      { day: 'Tue', timeSlot: '9:00 – 9:50 AM', reason: 'Institutional Review Board' }
    ]
  }
];

export const seedStudentGroups: StudentGroup[] = [
  {
    id: 'cohort-cs-y1',
    programId: 'prog-bsc-cs',
    name: 'Computer Science First-Year Cohort',
    code: 'CS-Year1',
    year: 1,
    size: 65,
    sharedCourseIds: ['course-cs-101', 'course-math-101']
  },
  {
    id: 'cohort-cs-y2',
    programId: 'prog-bsc-cs',
    name: 'Computer Science Sophomore Cohort',
    code: 'CS-Year2',
    year: 2,
    size: 58,
    sharedCourseIds: ['course-cs-301', 'course-cs-201', 'course-math-204']
  },
  {
    id: 'cohort-cs-y4',
    programId: 'prog-bsc-cs',
    name: 'Computer Science Senior Cohort',
    code: 'CS-Year4',
    year: 4,
    size: 42,
    sharedCourseIds: ['course-cs-412', 'course-cs-450']
  },
  {
    id: 'cohort-bio-y1',
    programId: 'prog-bsc-bio',
    name: 'Bioengineering Freshman Cohort',
    code: 'Bio-Year1',
    year: 1,
    size: 45,
    sharedCourseIds: ['course-bio-110', 'course-chem-101']
  },
  {
    id: 'cohort-bio-y2',
    programId: 'prog-bsc-bio',
    name: 'Bioengineering Sophomore Cohort',
    code: 'Bio-Year2',
    year: 2,
    size: 40,
    sharedCourseIds: ['course-chem-201', 'course-bio-210']
  },
  {
    id: 'cohort-bio-y3',
    programId: 'prog-bsc-bio',
    name: 'Bioengineering Junior Cohort',
    code: 'Bio-Year3',
    year: 3,
    size: 36,
    sharedCourseIds: ['course-bio-320', 'course-bio-401']
  },
  {
    id: 'cohort-eng-y1',
    programId: 'prog-bsc-eng',
    name: 'Mechanical Engineering First-Year Cohort',
    code: 'Eng-Year1',
    year: 1,
    size: 70,
    sharedCourseIds: ['course-eng-101', 'course-eng-102']
  },
  {
    id: 'cohort-eng-y3',
    programId: 'prog-bsc-eng',
    name: 'Mechanical Engineering Junior Cohort',
    code: 'Eng-Year3',
    year: 3,
    size: 55,
    sharedCourseIds: ['course-eng-302', 'course-eng-340']
  },
  {
    id: 'cohort-arch-y3',
    programId: 'prog-barch',
    name: 'Architecture Third-Year Studio Cohort',
    code: 'Arch-Year3',
    year: 3,
    size: 30,
    sharedCourseIds: ['course-arch-405', 'course-arch-305']
  },
  {
    id: 'cohort-all-stem',
    programId: 'prog-bsc-cs',
    name: 'All STEM Common Mathematics Cohort',
    code: 'All-STEM',
    year: 2,
    size: 110,
    sharedCourseIds: ['course-math-204']
  },
  {
    id: 'cohort-arts-y1',
    programId: 'prog-barch',
    name: 'First-Year Humanities Core Cohort',
    code: 'Arts-Year1',
    year: 1,
    size: 35,
    sharedCourseIds: ['course-hum-110']
  }
];

export const seedSections: Section[] = [
  // CS-301 (Data Structures & Algorithms): 2 regular 50m lectures + 1 continuous 3-hour Lab
  {
    id: 'sec-1',
    courseId: 'course-cs-301',
    termId: 'term-2026-spring',
    sectionNumber: '01-Lec',
    expectedEnrollment: 58,
    instructorId: 'inst-evans',
    studentGroupId: 'cohort-cs-y2',
    sessionType: 'Lecture',
    spanSlots: 1,
    assignedSlot: {
      day: 'Mon',
      timeSlot: '9:00 – 9:50 AM',
      roomId: 'room-hall-b3',
      durationMinutes: 50,
      sessionType: 'Lecture',
      spanSlots: 1
    },
    isLocked: true
  },
  {
    id: 'sec-3',
    courseId: 'course-cs-301',
    termId: 'term-2026-spring',
    sectionNumber: '02-Lec',
    expectedEnrollment: 58,
    instructorId: 'inst-evans',
    studentGroupId: 'cohort-cs-y2',
    sessionType: 'Lecture',
    spanSlots: 1,
    assignedSlot: {
      day: 'Wed',
      timeSlot: '9:00 – 9:50 AM',
      roomId: 'room-hall-b3',
      durationMinutes: 50,
      sessionType: 'Lecture',
      spanSlots: 1
    },
    isLocked: false
  },
  {
    id: 'sec-cs301-lab',
    courseId: 'course-cs-301',
    termId: 'term-2026-spring',
    sectionNumber: '01-Lab',
    expectedEnrollment: 38,
    instructorId: 'inst-evans',
    studentGroupId: 'cohort-cs-y2',
    sessionType: 'Lab',
    spanSlots: 3,
    assignedSlot: {
      day: 'Fri',
      timeSlot: '9:00 – 9:50 AM',
      roomId: 'room-lab-2',
      durationMinutes: 180,
      sessionType: 'Lab',
      spanSlots: 3,
      continuousTimeLabel: '9:00 AM – 12:00 PM'
    },
    isLocked: true
  },

  // BIO-210 (Cell Genomics & Recombinant DNA): 1 regular lecture + 1 continuous 3-hour Lab (Tue Morning 9:00 AM – 12:00 PM)
  {
    id: 'sec-2',
    courseId: 'course-bio-210',
    termId: 'term-2026-spring',
    sectionNumber: '01-Lab',
    expectedEnrollment: 32,
    instructorId: 'inst-zhao',
    studentGroupId: 'cohort-bio-y2',
    sessionType: 'Lab',
    spanSlots: 3,
    assignedSlot: {
      day: 'Tue',
      timeSlot: '9:00 – 9:50 AM',
      roomId: 'room-lab-4',
      durationMinutes: 180,
      sessionType: 'Lab',
      spanSlots: 3,
      continuousTimeLabel: '9:00 AM – 12:00 PM'
    },
    isLocked: true
  },
  {
    id: 'sec-bio210-lec1',
    courseId: 'course-bio-210',
    termId: 'term-2026-spring',
    sectionNumber: '01-Lec',
    expectedEnrollment: 32,
    instructorId: 'inst-zhao',
    studentGroupId: 'cohort-bio-y2',
    sessionType: 'Lecture',
    spanSlots: 1,
    assignedSlot: {
      day: 'Fri',
      timeSlot: '12:00 – 12:50 PM',
      roomId: 'room-aud-100',
      durationMinutes: 50,
      sessionType: 'Lecture',
      spanSlots: 1
    },
    isLocked: false
  },

  // ENG-102 (Applied Engineering Statics): Regular 50m Lecture
  {
    id: 'sec-4',
    courseId: 'course-eng-102',
    termId: 'term-2026-spring',
    sectionNumber: '01-Lec',
    expectedEnrollment: 70,
    instructorId: 'inst-miller',
    studentGroupId: 'cohort-eng-y1',
    sessionType: 'Lecture',
    spanSlots: 1,
    assignedSlot: {
      day: 'Thu',
      timeSlot: '12:00 – 12:50 PM',
      roomId: 'room-quad-a',
      durationMinutes: 50,
      sessionType: 'Lecture',
      spanSlots: 1
    },
    isLocked: true
  },

  // ARCH-405 (Spatial Studio): Lecture + 3-hour Afternoon Lab/Studio (2:00 PM – 5:00 PM)
  {
    id: 'sec-5',
    courseId: 'course-arch-405',
    termId: 'term-2026-spring',
    sectionNumber: '01-Lec',
    expectedEnrollment: 30,
    instructorId: 'inst-vance',
    studentGroupId: 'cohort-arch-y3',
    sessionType: 'Lecture',
    spanSlots: 1,
    assignedSlot: {
      day: 'Tue',
      timeSlot: '12:00 – 12:50 PM',
      roomId: 'room-arch-hall',
      durationMinutes: 50,
      sessionType: 'Lecture',
      spanSlots: 1
    },
    isLocked: false
  },
  {
    id: 'sec-15',
    courseId: 'course-arch-405',
    termId: 'term-2026-spring',
    sectionNumber: '01-Lab',
    expectedEnrollment: 30,
    instructorId: 'inst-vance',
    studentGroupId: 'cohort-arch-y3',
    sessionType: 'Lab',
    spanSlots: 3,
    assignedSlot: {
      day: 'Thu',
      timeSlot: '2:00 – 2:50 PM',
      roomId: 'room-atrium',
      durationMinutes: 180,
      sessionType: 'Lab',
      spanSlots: 3,
      continuousTimeLabel: '2:00 PM – 5:00 PM'
    },
    isLocked: false
  },

  // MATH-204 (Linear Algebra & Matrix Decompositions): 2 Regular 50m Lectures
  {
    id: 'sec-6',
    courseId: 'course-math-204',
    termId: 'term-2026-spring',
    sectionNumber: '01-Lec',
    expectedEnrollment: 110,
    instructorId: 'inst-raman',
    studentGroupId: 'cohort-all-stem',
    sessionType: 'Lecture',
    spanSlots: 1,
    assignedSlot: {
      day: 'Mon',
      timeSlot: '10:00 – 10:50 AM',
      roomId: 'room-hall-a1',
      durationMinutes: 50,
      sessionType: 'Lecture',
      spanSlots: 1
    },
    isLocked: true
  },
  {
    id: 'sec-11',
    courseId: 'course-math-204',
    termId: 'term-2026-spring',
    sectionNumber: '02-Lec',
    expectedEnrollment: 110,
    instructorId: 'inst-raman',
    studentGroupId: 'cohort-all-stem',
    sessionType: 'Lecture',
    spanSlots: 1,
    assignedSlot: {
      day: 'Wed',
      timeSlot: '10:00 – 10:50 AM',
      roomId: 'room-hall-a1',
      durationMinutes: 50,
      sessionType: 'Lecture',
      spanSlots: 1
    },
    isLocked: false
  },

  // HUM-110 (Ethics in AI, Data & Automated Society): Regular 50m Lecture
  {
    id: 'sec-7',
    courseId: 'course-hum-110',
    termId: 'term-2026-spring',
    sectionNumber: '01-Lec',
    expectedEnrollment: 35,
    instructorId: 'inst-gomez',
    studentGroupId: 'cohort-arts-y1',
    sessionType: 'Lecture',
    spanSlots: 1,
    assignedSlot: {
      day: 'Mon',
      timeSlot: '11:00 – 11:50 AM',
      roomId: 'room-annex-2',
      durationMinutes: 50,
      sessionType: 'Lecture',
      spanSlots: 1
    },
    isLocked: false
  },

  // CS-412 (Distributed Systems & Cloud Consensus): 2 Regular Lectures + 1 Continuous 3-Hour Lab
  {
    id: 'sec-8',
    courseId: 'course-cs-412',
    termId: 'term-2026-spring',
    sectionNumber: '01-Lec',
    expectedEnrollment: 40,
    instructorId: 'inst-evans',
    studentGroupId: 'cohort-cs-y4',
    sessionType: 'Lecture',
    spanSlots: 1,
    assignedSlot: {
      day: 'Mon',
      timeSlot: '12:00 – 12:50 PM',
      roomId: 'room-hall-b3',
      durationMinutes: 50,
      sessionType: 'Lecture',
      spanSlots: 1
    },
    isLocked: true
  },
  {
    id: 'sec-10',
    courseId: 'course-cs-412',
    termId: 'term-2026-spring',
    sectionNumber: '02-Lec',
    expectedEnrollment: 40,
    instructorId: 'inst-evans',
    studentGroupId: 'cohort-cs-y4',
    sessionType: 'Lecture',
    spanSlots: 1,
    assignedSlot: {
      day: 'Wed',
      timeSlot: '12:00 – 12:50 PM',
      roomId: 'room-hall-b3',
      durationMinutes: 50,
      sessionType: 'Lecture',
      spanSlots: 1
    },
    isLocked: false
  },
  {
    id: 'sec-cs412-lab',
    courseId: 'course-cs-412',
    termId: 'term-2026-spring',
    sectionNumber: '01-Lab',
    expectedEnrollment: 40,
    instructorId: 'inst-evans',
    studentGroupId: 'cohort-cs-y4',
    sessionType: 'Lab',
    spanSlots: 3,
    assignedSlot: {
      day: 'Tue',
      timeSlot: '2:00 – 2:50 PM',
      roomId: 'room-lab-6',
      durationMinutes: 180,
      sessionType: 'Lab',
      spanSlots: 3,
      continuousTimeLabel: '2:00 PM – 5:00 PM'
    },
    isLocked: true
  },

  // BIO-320 (Biomaterials & Tissue Scaffolding): Regular Lecture
  {
    id: 'sec-9',
    courseId: 'course-bio-320',
    termId: 'term-2026-spring',
    sectionNumber: '01-Lec',
    expectedEnrollment: 30,
    instructorId: 'inst-zhao',
    studentGroupId: 'cohort-bio-y3',
    sessionType: 'Lecture',
    spanSlots: 1,
    assignedSlot: {
      day: 'Wed',
      timeSlot: '11:00 – 11:50 AM',
      roomId: 'room-sem-105',
      durationMinutes: 50,
      sessionType: 'Lecture',
      spanSlots: 1
    },
    isLocked: false
  },

  // CHEM-201 (Organic Chemistry & Spectroscopic Synthesis): 1 Continuous 3-Hour Lab + 1 Regular Lecture
  {
    id: 'sec-12',
    courseId: 'course-chem-201',
    termId: 'term-2026-spring',
    sectionNumber: '01-Lab',
    expectedEnrollment: 36,
    instructorId: 'inst-scott',
    studentGroupId: 'cohort-bio-y2',
    sessionType: 'Lab',
    spanSlots: 3,
    assignedSlot: {
      day: 'Mon',
      timeSlot: '2:00 – 2:50 PM',
      roomId: 'room-chem-lab-b',
      durationMinutes: 180,
      sessionType: 'Lab',
      spanSlots: 3,
      continuousTimeLabel: '2:00 PM – 5:00 PM'
    },
    isLocked: true
  },
  {
    id: 'sec-14',
    courseId: 'course-chem-201',
    termId: 'term-2026-spring',
    sectionNumber: '01-Lec',
    expectedEnrollment: 36,
    instructorId: 'inst-scott',
    studentGroupId: 'cohort-bio-y2',
    sessionType: 'Lecture',
    spanSlots: 1,
    assignedSlot: {
      day: 'Fri',
      timeSlot: '2:00 – 2:50 PM',
      roomId: 'room-aud-100',
      durationMinutes: 50,
      sessionType: 'Lecture',
      spanSlots: 1
    },
    isLocked: false
  },

  // ENG-302 (Fluid Dynamics): 1 Regular Lecture + 1 Continuous 3-Hour Lab
  {
    id: 'sec-13',
    courseId: 'course-eng-302',
    termId: 'term-2026-spring',
    sectionNumber: '01-Lec',
    expectedEnrollment: 55,
    instructorId: 'inst-miller',
    studentGroupId: 'cohort-eng-y3',
    sessionType: 'Lecture',
    spanSlots: 1,
    assignedSlot: {
      day: 'Fri',
      timeSlot: '3:00 – 3:50 PM',
      roomId: 'room-eng-hall-1',
      durationMinutes: 50,
      sessionType: 'Lecture',
      spanSlots: 1
    },
    isLocked: true
  },
  {
    id: 'sec-eng302-lab',
    courseId: 'course-eng-302',
    termId: 'term-2026-spring',
    sectionNumber: '01-Lab',
    expectedEnrollment: 28,
    instructorId: 'inst-almansoor',
    studentGroupId: 'cohort-eng-y3',
    sessionType: 'Lab',
    spanSlots: 3,
    assignedSlot: {
      day: 'Wed',
      timeSlot: '2:00 – 2:50 PM',
      roomId: 'room-fluid-lab',
      durationMinutes: 180,
      sessionType: 'Lab',
      spanSlots: 3,
      continuousTimeLabel: '2:00 PM – 5:00 PM'
    },
    isLocked: false
  },

  // CS-201 (Computer Architecture & Systems Programming): Regular Lecture + 3-Hour Continuous Lab
  {
    id: 'sec-18',
    courseId: 'course-cs-201',
    termId: 'term-2026-spring',
    sectionNumber: '01-Lec',
    expectedEnrollment: 40,
    instructorId: 'inst-hopper',
    studentGroupId: 'cohort-cs-y2',
    sessionType: 'Lecture',
    spanSlots: 1,
    assignedSlot: {
      day: 'Fri',
      timeSlot: '4:00 – 4:50 PM',
      roomId: 'room-hall-b3',
      durationMinutes: 50,
      sessionType: 'Lecture',
      spanSlots: 1
    },
    isLocked: false
  },
  {
    id: 'sec-cs201-lab',
    courseId: 'course-cs-201',
    termId: 'term-2026-spring',
    sectionNumber: '01-Lab',
    expectedEnrollment: 40,
    instructorId: 'inst-hopper',
    studentGroupId: 'cohort-cs-y2',
    sessionType: 'Lab',
    spanSlots: 3,
    assignedSlot: {
      day: 'Thu',
      timeSlot: '9:00 – 9:50 AM',
      roomId: 'room-lab-2',
      durationMinutes: 180,
      sessionType: 'Lab',
      spanSlots: 3,
      continuousTimeLabel: '9:00 AM – 12:00 PM'
    },
    isLocked: false
  }
];

export const seedTimeStructure: TimeStructure = {
  id: 'standard-campus-grid',
  name: 'University Standard 9:00 AM – 5:00 PM Academic Grid',
  workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  periodLengthMinutes: 50,
  dayStartTime: '09:00',
  dayEndTime: '17:00',
  periods: [
    '9:00 – 9:50 AM',
    '10:00 – 10:50 AM',
    '11:00 – 11:50 AM',
    '12:00 – 12:50 PM',
    '2:00 – 2:50 PM',
    '3:00 – 3:50 PM',
    '4:00 – 4:50 PM'
  ],
  breaks: [
    {
      id: 'break-lunch',
      name: 'Fixed University Lunch Break (1:00 PM – 2:00 PM)',
      startTime: '13:00',
      endTime: '14:00',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    }
  ]
};

export const seedConstraintRules: ConstraintRule[] = [
  // Hard Constraints
  {
    id: 'rule-hard-no-prof-clash',
    code: 'HC-01',
    name: 'No Instructor Double-Booking',
    description: 'An instructor cannot be scheduled to teach more than one section at the same day and time slot.',
    kind: 'hard',
    enabled: true,
    weight: 100,
    category: 'instructor'
  },
  {
    id: 'rule-hard-no-room-clash',
    code: 'HC-02',
    name: 'No Room Double-Booking',
    description: 'A room cannot host two separate courses simultaneously across lectures or 3-hour labs.',
    kind: 'hard',
    enabled: true,
    weight: 100,
    category: 'room'
  },
  {
    id: 'rule-hard-no-cohort-clash',
    code: 'HC-03',
    name: 'No Student Cohort Clash',
    description: 'Required cohort classes for the same year and degree track cannot overlap in time.',
    kind: 'hard',
    enabled: true,
    weight: 100,
    category: 'student'
  },
  {
    id: 'rule-hard-room-capacity',
    code: 'HC-04',
    name: 'Strict Room Capacity Enforcement',
    description: 'Expected enrollment cannot exceed the physical room seating capacity.',
    kind: 'hard',
    enabled: true,
    weight: 100,
    category: 'room'
  },
  {
    id: 'rule-hard-room-type-match',
    code: 'HC-05',
    name: '3-Hour Continuous Lab & Facility Enforcement',
    description: 'Laboratory sessions occupy 3 continuous hourly cycles (9:00 AM–12:00 PM, 10:00 AM–1:00 PM, or 2:00 PM–5:00 PM) without crossing the 1:00–2:00 PM lunch break.',
    kind: 'hard',
    enabled: true,
    weight: 100,
    category: 'facility'
  },
  {
    id: 'rule-hard-prof-unavailability',
    code: 'HC-06',
    name: 'Instructor Unavailability Compliance',
    description: 'Sections cannot be assigned during an instructors formally registered committee or medical blackout slots.',
    kind: 'hard',
    enabled: true,
    weight: 100,
    category: 'instructor'
  },

  // Soft Constraints with Adjustable Weights
  {
    id: 'rule-soft-commuter-transit',
    code: 'SC-01',
    name: 'Short Break & Transit Buffer Weight',
    description: 'Preserves 10-minute short breaks between 50-minute lectures and respects the fixed 1:00 PM – 2:00 PM university lunch break.',
    kind: 'soft',
    enabled: true,
    weight: 85,
    category: 'facility'
  },
  {
    id: 'rule-soft-circadian',
    code: 'SC-02',
    name: 'Circadian Alertness Curve Alignment',
    description: 'Prioritizes high-cognition theoretical lectures (Math, CS Theory) into morning session slots (9:00 AM – 1:00 PM).',
    kind: 'soft',
    enabled: true,
    weight: 90,
    category: 'temporal'
  },
  {
    id: 'rule-soft-room-compaction',
    code: 'SC-03',
    name: 'Facility Space Compaction',
    description: 'Concentrates building utilization to minimize HVAC and security operational expenses across underutilized wings.',
    kind: 'soft',
    enabled: true,
    weight: 70,
    category: 'room'
  },
  {
    id: 'rule-soft-faculty-consecutive',
    code: 'SC-04',
    name: 'Faculty Workload & Consecutive Hour Cap',
    description: 'Enforces break intervals after 3 hours of consecutive instructional delivery.',
    kind: 'soft',
    enabled: true,
    weight: 80,
    category: 'instructor'
  },
  {
    id: 'rule-soft-student-gaps',
    code: 'SC-05',
    name: 'Minimize Idle Student Schedule Gaps',
    description: 'Prevents fragmented schedules with single isolated classes separated by 3+ hours of downtime.',
    kind: 'soft',
    enabled: true,
    weight: 75,
    category: 'student'
  }
];

export const seedScenarios: TimetableScenario[] = [
  {
    id: 'scenario-baseline-2026',
    termId: 'term-2026-spring',
    name: 'Master Schedule Baseline v2.0 (9 AM – 5 PM Grid)',
    version: '2.0.0',
    status: 'published',
    createdAt: '2026-01-08T09:00:00Z',
    updatedAt: '2026-01-10T16:30:00Z',
    author: 'Dr. Katherine Reynolds',
    metrics: {
      clashCount: 0,
      satisfactionScore: 99.88,
      roomUtilizationPercent: 88.4,
      instructorSatisfaction: 96.2,
      studentTransitScore: 94.7
    },
    assignments: Object.fromEntries(
      seedSections
        .filter(s => Boolean(s.assignedSlot))
        .map(s => [s.id, s.assignedSlot!])
    )
  }
];

export const seedAuditLogs: AuditLogEntry[] = [
  {
    id: 'audit-001',
    timestamp: '2026-01-08T09:00:00Z',
    userId: 'user-reynolds',
    userName: 'Dr. Katherine Reynolds',
    action: 'publish',
    entityType: 'scenario',
    entityId: 'scenario-baseline-2026',
    summary: 'Published Master Schedule Baseline v1.0 to SIS Registrar portal.'
  },
  {
    id: 'audit-002',
    timestamp: '2026-01-09T11:15:00Z',
    userId: 'user-reynolds',
    userName: 'Dr. Katherine Reynolds',
    action: 'update',
    entityType: 'room',
    entityId: 'room-hall-b3',
    summary: 'Updated Turing Hall B3 capacity from 110 to 120 seats following acoustic renovation.'
  },
  {
    id: 'audit-003',
    timestamp: '2026-01-10T14:20:00Z',
    userId: 'user-reynolds',
    userName: 'Dr. Katherine Reynolds',
    action: 'create',
    entityType: 'constraint',
    entityId: 'rule-hard-prof-unavailability',
    summary: 'Added hard constraint rule HC-06: Instructor Unavailability Compliance.'
  },
  {
    id: 'audit-004',
    timestamp: '2026-01-11T16:45:00Z',
    userId: 'user-reynolds',
    userName: 'Dr. Katherine Reynolds',
    action: 'update',
    entityType: 'instructor',
    entityId: 'inst-evans',
    summary: 'Configured Friday colloquium blackout slot for Dr. Alan Evans.'
  }
];
