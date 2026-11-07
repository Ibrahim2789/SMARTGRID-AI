import React, { useEffect, useRef } from 'react';

/**
 * Realistic autonomous fluid harmonic wave canvas with high-DPI rendering,
 * harmonic intersection nodes, and fluid atmospheric lighting.
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
    let cssHeight = canvas.parentElement?.clientHeight || 600;
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

    // Mouse influence with gentle spring damping
    const mouse = {
      x: cssWidth * 0.5,
      y: cssHeight * 0.5,
      targetX: cssWidth * 0.5,
      targetY: cssHeight * 0.5
    };

    const handlePointerMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.targetX = e.clientX - rect.left;
      mouse.targetY = e.clientY - rect.top;
    };

    const handleResize = () => {
      updateSize();
    };

    window.addEventListener('resize', handleResize);
    const parent = canvas.parentElement;
    if (parent) {
      parent.addEventListener('mousemove', handlePointerMove);
    }

    // Wave parameters: layered harmonic ribbons with refined terracotta and plum tones
    const waves = [
      {
        baseY: 0.52,
        amplitude: 44,
        frequency: 0.0035,
        speed: 0.008,
        offset: 0,
        gradient: ['rgba(59, 30, 74, 0.08)', 'rgba(156, 65, 38, 0.04)', 'rgba(251, 248, 252, 0)'],
        stroke: 'rgba(59, 30, 74, 0.22)',
        lineWidth: 1.5,
        nodes: true
      },
      {
        baseY: 0.60,
        amplitude: 36,
        frequency: 0.0042,
        speed: 0.011,
        offset: 2.1,
        gradient: ['rgba(156, 65, 38, 0.07)', 'rgba(242, 116, 56, 0.03)', 'rgba(251, 248, 252, 0)'],
        stroke: 'rgba(156, 65, 38, 0.18)',
        lineWidth: 1.25,
        nodes: false
      },
      {
        baseY: 0.68,
        amplitude: 48,
        frequency: 0.003,
        speed: 0.007,
        offset: 4.4,
        gradient: ['rgba(59, 30, 74, 0.06)', 'rgba(101, 93, 105, 0.02)', 'rgba(251, 248, 252, 0)'],
        stroke: 'rgba(59, 30, 74, 0.14)',
        lineWidth: 1.0,
        nodes: true
      },
      {
        baseY: 0.44,
        amplitude: 28,
        frequency: 0.005,
        speed: 0.013,
        offset: 1.2,
        gradient: ['rgba(242, 116, 56, 0.05)', 'rgba(59, 30, 74, 0.02)', 'rgba(251, 248, 252, 0)'],
        stroke: 'rgba(242, 116, 56, 0.16)',
        lineWidth: 1.0,
        nodes: false
      }
    ];

    let time = 0;

    const render = () => {
      time += 1;

      // Mouse smooth interpolation
      mouse.x += (mouse.targetX - mouse.x) * 0.04;
      mouse.y += (mouse.targetY - mouse.y) * 0.04;

      ctx.clearRect(0, 0, cssWidth, cssHeight);

      // Subtle, realistic volumetric atmospheric lighting
      const lightX = cssWidth * 0.5 + Math.sin(time * 0.006) * (cssWidth * 0.22) + (mouse.x - cssWidth * 0.5) * 0.15;
      const lightY = cssHeight * 0.35 + Math.cos(time * 0.005) * 35 + (mouse.y - cssHeight * 0.5) * 0.15;

      const ambientLight = ctx.createRadialGradient(
        lightX,
        lightY,
        25,
        lightX,
        lightY,
        cssWidth * 0.6
      );
      ambientLight.addColorStop(0, 'rgba(255, 246, 240, 0.95)');
      ambientLight.addColorStop(0.35, 'rgba(250, 242, 248, 0.55)');
      ambientLight.addColorStop(0.7, 'rgba(246, 240, 248, 0.2)');
      ambientLight.addColorStop(1, 'rgba(251, 248, 252, 0)');

      ctx.fillStyle = ambientLight;
      ctx.fillRect(0, 0, cssWidth, cssHeight);

      // Subtle fine architectural grid matrix lines
      ctx.strokeStyle = 'rgba(236, 230, 237, 0.5)';
      ctx.lineWidth = 1;
      const gridSpacing = 64;
      const gridOffset = (time * 0.15) % gridSpacing;

      ctx.beginPath();
      for (let x = gridOffset; x < cssWidth; x += gridSpacing) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, cssHeight);
      }
      for (let y = gridOffset; y < cssHeight; y += gridSpacing) {
        ctx.moveTo(0, y);
        ctx.lineTo(cssWidth, y);
      }
      ctx.stroke();

      // Collect points for glowing harmonic node markers
      const glowNodes: Array<{ x: number; y: number; r: number; color: string }> = [];

      // Draw each autonomous undulating wave ribbon
      waves.forEach((wave) => {
        const currentBaseY = cssHeight * wave.baseY;
        const phase = time * wave.speed + wave.offset;

        // Wave path
        ctx.beginPath();
        ctx.moveTo(0, cssHeight);
        ctx.lineTo(0, currentBaseY);

        const step = 8;
        for (let x = 0; x <= cssWidth + step; x += step) {
          const wave1 = Math.sin(x * wave.frequency + phase);
          const wave2 = Math.cos(x * wave.frequency * 1.8 - phase * 0.6) * 0.45;
          const wave3 = Math.sin(x * wave.frequency * 0.5 + phase * 1.2) * 0.3;

          const distToMouse = Math.abs(x - mouse.x);
          const mouseEffect = Math.max(0, 1 - distToMouse / 280) * (mouse.y - currentBaseY) * 0.22;

          const y = currentBaseY + (wave1 + wave2 + wave3) * wave.amplitude + mouseEffect;
          ctx.lineTo(x, y);

          if (wave.nodes && Math.floor(x) % 192 < step) {
            glowNodes.push({
              x,
              y,
              r: 2.5 + Math.sin(time * 0.04 + x) * 0.8,
              color: wave.stroke
            });
          }
        }

        ctx.lineTo(cssWidth, cssHeight);
        ctx.closePath();

        // Shaded depth fill
        const fillGrad = ctx.createLinearGradient(0, currentBaseY - wave.amplitude, 0, cssHeight);
        fillGrad.addColorStop(0, wave.gradient[0]);
        fillGrad.addColorStop(0.5, wave.gradient[1]);
        fillGrad.addColorStop(1, wave.gradient[2]);

        ctx.fillStyle = fillGrad;
        ctx.fill();

        // Delicate crest contour line
        ctx.beginPath();
        for (let x = 0; x <= cssWidth + step; x += step) {
          const wave1 = Math.sin(x * wave.frequency + phase);
          const wave2 = Math.cos(x * wave.frequency * 1.8 - phase * 0.6) * 0.45;
          const wave3 = Math.sin(x * wave.frequency * 0.5 + phase * 1.2) * 0.3;

          const distToMouse = Math.abs(x - mouse.x);
          const mouseEffect = Math.max(0, 1 - distToMouse / 280) * (mouse.y - currentBaseY) * 0.22;

          const y = currentBaseY + (wave1 + wave2 + wave3) * wave.amplitude + mouseEffect;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        ctx.strokeStyle = wave.stroke;
        ctx.lineWidth = wave.lineWidth;
        ctx.stroke();
      });

      // Render glowing harmonic nodes along key wave crests
      glowNodes.forEach(node => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r + 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (parent) {
        parent.removeEventListener('mousemove', handlePointerMove);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none -z-10"
      aria-hidden="true"
    />
  );
};
