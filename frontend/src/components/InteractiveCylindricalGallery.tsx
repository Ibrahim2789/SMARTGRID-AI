import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ArrowRight, Sparkles, Layers, MousePointer, Compass, RotateCw } from 'lucide-react';

interface GalleryCardData {
  id: string;
  number: string;
  title: string;
  category: string;
  description: string;
  bgHex: string;
  textHex: string;
  accentHex: string;
  width: number;
  height: number;
  type: 'timetable' | 'conflict' | 'student' | 'resource' | 'optimization' | 'adaptive' | 'workload' | 'coordination' | 'laboratory' | 'analytics';
}

const GALLERY_CARDS: GalleryCardData[] = [
  {
    id: 'card-1',
    number: '01',
    title: 'SMARTER SCHEDULES',
    category: 'Intelligent Timetables',
    description: 'Weekly course blocks, time labels, and different session colors.',
    bgHex: '#FFFFFF',
    textHex: '#111111',
    accentHex: '#1D4ED8',
    width: 2.4,
    height: 3.2,
    type: 'timetable'
  },
  {
    id: 'card-2',
    number: '02',
    title: 'NO CONFLICTS',
    category: 'Conflict-Free Scheduling',
    description: 'Visual representation of overlapping timetable sessions being separated or resolved.',
    bgHex: '#1D4ED8',
    textHex: '#FFFFFF',
    accentHex: '#FF4D2D',
    width: 2.8,
    height: 3.0,
    type: 'conflict'
  },
  {
    id: 'card-3',
    number: '03',
    title: 'STUDENT VOICE',
    category: 'Student-Centric Scheduling',
    description: 'Student preference or voting interface, preferred time slots, and participation indicators.',
    bgHex: '#F4F4F6',
    textHex: '#111111',
    accentHex: '#1D4ED8',
    width: 2.5,
    height: 3.4,
    type: 'student'
  },
  {
    id: 'card-4',
    number: '04',
    title: 'EVERY RESOURCE',
    category: 'Resource Allocation',
    description: 'Sophisticated visual composition representing classrooms, laboratories, and instructor assignments.',
    bgHex: '#FF4D2D',
    textHex: '#FFFFFF',
    accentHex: '#111111',
    width: 3.0,
    height: 2.8,
    type: 'resource'
  },
  {
    id: 'card-5',
    number: '05',
    title: 'BETTER SOLUTIONS',
    category: 'Optimization Intelligence',
    description: 'Multiple timetable candidates with visual quality indicators and comparison composition.',
    bgHex: '#111111',
    textHex: '#FFFFFF',
    accentHex: '#B7F77C',
    width: 2.6,
    height: 3.3,
    type: 'optimization'
  },
  {
    id: 'card-6',
    number: '06',
    title: 'ADAPT INSTANTLY',
    category: 'Adaptive Rescheduling',
    description: 'Before-and-after schedule transformation demonstrating how affected sessions can be rearranged.',
    bgHex: '#FFFFFF',
    textHex: '#111111',
    accentHex: '#FF4D2D',
    width: 2.8,
    height: 3.1,
    type: 'adaptive'
  },
  {
    id: 'card-7',
    number: '07',
    title: 'BALANCED WORKLOAD',
    category: 'Instructor Workload',
    description: 'Minimalist workload visualization with weekly hours and balanced allocation.',
    bgHex: '#F4F4F6',
    textHex: '#111111',
    accentHex: '#1D4ED8',
    width: 2.4,
    height: 3.2,
    type: 'workload'
  },
  {
    id: 'card-8',
    number: '08',
    title: 'ONE CONNECTED SYSTEM',
    category: 'University-Wide Coordination',
    description: 'Visual representation of multiple departments, programs, cohorts, and sections being coordinated.',
    bgHex: '#1D4ED8',
    textHex: '#FFFFFF',
    accentHex: '#FFFFFF',
    width: 3.2,
    height: 2.7,
    type: 'coordination'
  },
  {
    id: 'card-9',
    number: '09',
    title: 'SPECIALIZED LABS',
    category: 'Laboratory Scheduling',
    description: 'Continuous 3-hour laboratory practical sessions tied to dedicated lab engineers and equipment.',
    bgHex: '#FFFFFF',
    textHex: '#111111',
    accentHex: '#FF4D2D',
    width: 2.5,
    height: 3.3,
    type: 'laboratory'
  },
  {
    id: 'card-10',
    number: '10',
    title: 'SCHEDULE ANALYTICS',
    category: 'Resource Utilization',
    description: 'Real-time utilization percentages, room occupancy metrics, and satisfaction indexes.',
    bgHex: '#111111',
    textHex: '#FFFFFF',
    accentHex: '#B7F77C',
    width: 2.7,
    height: 3.0,
    type: 'analytics'
  }
];

function createCardCanvasTexture(card: GalleryCardData): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1280;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Background
    ctx.fillStyle = card.bgHex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border
    ctx.strokeStyle = card.textHex === '#FFFFFF' ? '#333333' : '#E4E2DA';
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

    // Top Header: Category & Number
    ctx.fillStyle = card.accentHex;
    ctx.font = 'bold 36px monospace';
    ctx.fillText(card.category.toUpperCase(), 72, 110);

    ctx.fillStyle = card.textHex;
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(card.number, canvas.width - 72, 120);

    ctx.textAlign = 'left';
    ctx.fillStyle = card.textHex;
    ctx.font = 'bold 64px serif';

    // Wrap Title
    const words = card.title.split(' ');
    let line = '';
    let y = 220;
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > canvas.width - 144 && i > 0) {
        ctx.fillText(line, 72, y);
        line = words[i] + ' ';
        y += 75;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 72, y);

    // Visual illustration box based on card type
    const boxY = y + 50;
    const boxHeight = 520;
    ctx.fillStyle = card.textHex === '#FFFFFF' ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.04)';
    ctx.fillRect(72, boxY, canvas.width - 144, boxHeight);
    ctx.strokeStyle = card.accentHex;
    ctx.lineWidth = 4;
    ctx.strokeRect(72, boxY, canvas.width - 144, boxHeight);

    // Render inner graphical specimen
    ctx.save();
    ctx.translate(72, boxY);
    const innerW = canvas.width - 144;
    const innerH = boxHeight;

    if (card.type === 'timetable') {
      // Draw miniature timetable grid
      ctx.fillStyle = card.accentHex;
      ctx.fillRect(40, 40, innerW - 80, 60);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px monospace';
      ctx.fillText('MON  ·  TUE  ·  WED  ·  THU  ·  FRI', 64, 80);

      const cellW = (innerW - 100) / 5;
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 5; c++) {
          ctx.fillStyle = (r + c) % 2 === 0 ? 'rgba(29,78,216,0.15)' : 'rgba(255,77,45,0.15)';
          ctx.fillRect(50 + c * (cellW + 4), 120 + r * 90, cellW, 80);
          ctx.fillStyle = card.textHex;
          ctx.font = 'bold 20px monospace';
          ctx.fillText(`CS-${201 + r * 10 + c}`, 60 + c * (cellW + 4), 155 + r * 90);
        }
      }
    } else if (card.type === 'conflict') {
      // Draw clash resolution flow
      ctx.strokeStyle = '#FF4D2D';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(80, 200);
      ctx.lineTo(innerW - 80, 200);
      ctx.stroke();

      ctx.fillStyle = '#FF4D2D';
      ctx.fillRect(150, 140, 180, 120);
      ctx.fillRect(innerW - 330, 140, 180, 120);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 28px monospace';
      ctx.fillText('CLASH', 190, 210);
      ctx.fillText('RESOLVED', innerW - 305, 210);

      ctx.fillStyle = card.textHex;
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('Zero overlapping sessions guaranteed', 120, 380);
    } else if (card.type === 'student') {
      // Draw voting & preferences
      ctx.fillStyle = card.accentHex;
      ctx.fillRect(60, 80, innerW - 120, 50);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('BATCH PARTICIPATION: 94.8%', 90, 113);

      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = 'rgba(29,78,216,0.2)';
        ctx.fillRect(60, 160 + i * 100, innerW - 120, 75);
        ctx.fillStyle = card.textHex;
        ctx.font = 'bold 24px monospace';
        ctx.fillText(`Preferred Morning Slot Batch 2K2${5 + i}`, 90, 205 + i * 100);
      }
    } else if (card.type === 'resource') {
      // Draw resource allocation bars
      const items = ['Lecture Halls: 45', 'Laboratories: 15', 'Faculty Assigned: 60'];
      items.forEach((txt, idx) => {
        ctx.fillStyle = idx === 0 ? '#1D4ED8' : idx === 1 ? '#FF4D2D' : '#111111';
        ctx.fillRect(60, 80 + idx * 130, (innerW - 120) * (0.9 - idx * 0.15), 90);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 26px monospace';
        ctx.fillText(txt, 90, 138 + idx * 130);
      });
    } else if (card.type === 'optimization') {
      // Draw fitness score chart
      ctx.strokeStyle = '#B7F77C';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(80, 420);
      ctx.lineTo(250, 300);
      ctx.lineTo(450, 180);
      ctx.lineTo(innerW - 80, 100);
      ctx.stroke();

      ctx.fillStyle = '#B7F77C';
      ctx.font = 'bold 36px monospace';
      ctx.fillText('FITNESS SCORE: 99.4%', 80, 80);
    } else {
      // Default geometric architectural specimen
      ctx.fillStyle = card.accentHex;
      ctx.fillRect(80, 100, innerW - 160, innerH - 200);
      ctx.fillStyle = card.textHex === '#FFFFFF' ? '#111111' : '#FFFFFF';
      ctx.font = 'bold 40px monospace';
      ctx.fillText('SMARTGRID AI', 120, 260);
      ctx.font = '24px monospace';
      ctx.fillText('INSTITUTIONAL CORE', 120, 310);
    }

    ctx.restore();

    // Bottom description text
    ctx.fillStyle = card.textHex === '#FFFFFF' ? 'rgba(255,255,255,0.85)' : '#57564F';
    ctx.font = '24px sans-serif';
    const descWords = card.description.split(' ');
    let descLine = '';
    let descY = boxY + boxHeight + 45;
    for (let i = 0; i < descWords.length; i++) {
      const testLine = descLine + descWords[i] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > canvas.width - 144 && i > 0) {
        ctx.fillText(descLine, 72, descY);
        descLine = words[i] + ' ';
        descY += 35;
      } else {
        descLine = testLine;
      }
    }
    ctx.fillText(descLine, 72, descY);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

export const InteractiveCylindricalGallery: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);

    // Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 14);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(10, 20, 15);
    scene.add(directionalLight);

    // Create Cylindrical Card Meshes
    const group = new THREE.Group();
    scene.add(group);

    const radius = 5.2;
    const cardCount = GALLERY_CARDS.length;
    const meshes: THREE.Mesh[] = [];

    GALLERY_CARDS.forEach((cardData, i) => {
      const angle = (i / cardCount) * Math.PI * 2;
      const texture = createCardCanvasTexture(cardData);
      const geometry = new THREE.PlaneGeometry(cardData.width, cardData.height, 32, 32);
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        side: THREE.DoubleSide,
        roughness: 0.2,
        metalness: 0.1
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData = { index: i, baseAngle: angle, cardData };

      // Initial cylindrical placement
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius - radius;
      const y = (i % 2 === 0 ? 0.4 : -0.4);

      mesh.position.set(x, y, z);
      mesh.rotation.y = angle;

      group.add(mesh);
      meshes.push(mesh);
    });

    // Scroll & Mouse State
    let scrollProgress = 0;
    let targetScrollProgress = 0;
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    const handleScroll = () => {
      const rect = container.getBoundingClientRect();
      const scrollableHeight = container.clientHeight - window.innerHeight;
      if (scrollableHeight <= 0) return;
      const progress = Math.max(0, Math.min(1, -rect.top / scrollableHeight));
      targetScrollProgress = progress;
    };

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
      targetMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Smooth damping for scroll & mouse
      scrollProgress += (targetScrollProgress - scrollProgress) * 0.08;
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      // Camera tilt based on mouse
      camera.position.x = mouseX * 0.8;
      camera.position.y = mouseY * 0.5;
      camera.lookAt(0, 0, 0);

      // Cylindrical gallery blooming on scroll
      group.rotation.y = scrollProgress * Math.PI * 1.5 + mouseX * 0.2;

      const expandedRadius = radius + scrollProgress * 4.5;
      meshes.forEach((mesh, i) => {
        const baseAngle = mesh.userData.baseAngle;
        const targetX = Math.sin(baseAngle) * expandedRadius;
        const targetZ = Math.cos(baseAngle) * expandedRadius - radius;

        mesh.position.x += (targetX - mesh.position.x) * 0.1;
        mesh.position.z += (targetZ - mesh.position.z) * 0.1;

        // Subtle floating pulse
        mesh.position.y = (i % 2 === 0 ? 0.4 : -0.4) + Math.sin(Date.now() * 0.002 + i) * 0.15;
      });

      // Update active center card index
      const activeIdx = Math.abs(Math.round((group.rotation.y / (Math.PI * 2)) * cardCount)) % cardCount;
      setCurrentIndex(activeIdx);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-[220vh] bg-[#F4F4F6]">
      {/* Sticky Viewport Container */}
      <div className="sticky top-0 w-full h-screen overflow-hidden flex flex-col justify-between py-8 px-6 sm:px-12">
        {/* Gallery Header */}
        <div className="max-w-[1240px] mx-auto w-full flex items-center justify-between z-10">
          <div>
            <div className="text-xs font-mono-tabular uppercase tracking-wider text-[#1D4ED8] font-bold">
              Interactive 3D Editorial Gallery
            </div>
            <h2 className="font-serif-editorial text-2xl sm:text-3xl text-[#111111]">
              SmartGrid AI Architecture
            </h2>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#E4E2DA] text-xs font-mono-tabular text-[#111111]">
            <Compass className="w-3.5 h-3.5 text-[#1D4ED8]" />
            <span>Scroll to Bloom · Move Mouse to Tilt</span>
          </div>
        </div>

        {/* WebGL Canvas */}
        <div className="absolute inset-0 z-0">
          <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />
        </div>

        {/* Bottom Floating Pill Toolbar */}
        <div className="max-w-[1240px] mx-auto w-full z-10 flex items-center justify-between">
          <div className="px-4 py-2 rounded-full bg-white/90 backdrop-blur-md border border-[#E4E2DA] shadow-sm flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#1D4ED8] animate-pulse" />
            <span className="text-xs font-mono-tabular font-semibold text-[#111111]">
              SmartGrid AI · Card {currentIndex + 1} of {GALLERY_CARDS.length}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 backdrop-blur-md border border-[#E4E2DA] shadow-sm text-xs text-[#57564F]">
            <MousePointer className="w-3.5 h-3.5 text-[#FF4D2D]" />
            <span>Curved 3D Cylindrical Installation</span>
          </div>
        </div>
      </div>
    </div>
  );
};
