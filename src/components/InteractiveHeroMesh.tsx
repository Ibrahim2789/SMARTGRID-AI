import React, { useEffect, useRef } from 'react';

/**
 * Clean, subtle schematic vector grid canvas for B2B SaaS hero.
 * Renders understated coordinate lines and subtle interactive intersection points.
 */
export const InteractiveHeroMesh: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let cssWidth = canvas.parentElement?.clientWidth || window.innerWidth;
    let cssHeight = canvas.parentElement?.clientHeight || 400;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const updateSize = () => {
      if (!canvas.parentElement) return;
      cssWidth = canvas.parentElement.clientWidth;
      cssHeight = canvas.parentElement.clientHeight;
      canvas.width = cssWidth * dpr;
      canvas.height = cssHeight * dpr;
      ctx.scale(dpr, dpr);
    };

    updateSize();

    const mouse = {
      x: -1000,
      y: -1000
    };

    const handlePointerMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    const handlePointerLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    window.addEventListener('resize', updateSize);
    const parent = canvas.parentElement;
    if (parent) {
      parent.addEventListener('mousemove', handlePointerMove);
      parent.addEventListener('mouseleave', handlePointerLeave);
    }

    const gridSize = 40;

    const render = () => {
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      const isDark = document.documentElement.classList.contains('dark') || 
        window.matchMedia('(prefers-color-scheme: dark)').matches;

      const baseLineColor = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';
      const dotColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
      const activeDotColor = 'rgba(15, 118, 110, 0.4)';

      ctx.lineWidth = 1;
      ctx.strokeStyle = baseLineColor;

      // Draw subtle grid lines
      ctx.beginPath();
      for (let x = 0; x <= cssWidth; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, cssHeight);
      }
      for (let y = 0; y <= cssHeight; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(cssWidth, y);
      }
      ctx.stroke();

      // Draw subtle intersection dots with gentle mouse proximity highlight
      for (let x = 0; x <= cssWidth; x += gridSize) {
        for (let y = 0; y <= cssHeight; y += gridSize) {
          const dx = mouse.x - x;
          const dy = mouse.y - y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            const alpha = (1 - dist / 120);
            ctx.fillStyle = activeDotColor;
            ctx.beginPath();
            ctx.arc(x, y, 1.5 + alpha * 1.5, 0, Math.PI * 2);
            ctx.fill();
          } else if ((x / gridSize + y / gridSize) % 3 === 0) {
            ctx.fillStyle = dotColor;
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', updateSize);
      if (parent) {
        parent.removeEventListener('mousemove', handlePointerMove);
        parent.removeEventListener('mouseleave', handlePointerLeave);
      }
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full pointer-events-auto"
      style={{ display: 'block' }}
    />
  );
};
