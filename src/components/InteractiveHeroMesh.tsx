import React, { useEffect, useRef } from 'react';

/**
 * Realistic autonomous fluid harmonic wave canvas.
 * Moves continuously on its own with natural, coupled sine/cosine wave dynamics.
 * Expresses depth through sophisticated tonal shading (algorithmic plum, terracotta shadow, and bone mist),
 * without any floating balls or noisy particles.
 */
export const InteractiveHeroMesh: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 600);

    // Mouse influence with gentle spring damping
    const mouse = {
      x: width * 0.5,
      y: height * 0.5,
      targetX: width * 0.5,
      targetY: height * 0.5,
      velocity: 0
    };

    const handlePointerMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.targetX = e.clientX - rect.left;
      mouse.targetY = e.clientY - rect.top;
    };

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener('resize', handleResize);
    const parent = canvas.parentElement;
    if (parent) {
      parent.addEventListener('mousemove', handlePointerMove);
    }

    // Wave parameters: realistic layered harmonic ribbons
    const waves = [
      {
        baseY: 0.55,
        amplitude: 45,
        frequency: 0.0035,
        speed: 0.008,
        offset: 0,
        gradient: ['rgba(59, 30, 74, 0.07)', 'rgba(156, 65, 38, 0.03)', 'rgba(251, 248, 252, 0)'],
        stroke: 'rgba(59, 30, 74, 0.18)',
        lineWidth: 1.5
      },
      {
        baseY: 0.62,
        amplitude: 38,
        frequency: 0.0042,
        speed: 0.011,
        offset: 2.1,
        gradient: ['rgba(156, 65, 38, 0.06)', 'rgba(242, 116, 56, 0.025)', 'rgba(251, 248, 252, 0)'],
        stroke: 'rgba(156, 65, 38, 0.16)',
        lineWidth: 1.2
      },
      {
        baseY: 0.70,
        amplitude: 50,
        frequency: 0.003,
        speed: 0.007,
        offset: 4.4,
        gradient: ['rgba(59, 30, 74, 0.05)', 'rgba(101, 93, 105, 0.02)', 'rgba(251, 248, 252, 0)'],
        stroke: 'rgba(59, 30, 74, 0.12)',
        lineWidth: 1.0
      },
      {
        baseY: 0.48,
        amplitude: 30,
        frequency: 0.005,
        speed: 0.014,
        offset: 1.2,
        gradient: ['rgba(242, 116, 56, 0.04)', 'rgba(59, 30, 74, 0.02)', 'rgba(251, 248, 252, 0)'],
        stroke: 'rgba(242, 116, 56, 0.14)',
        lineWidth: 1.0
      }
    ];

    let time = 0;

    const render = () => {
      time += 1;

      // Mouse smooth interpolation
      mouse.x += (mouse.targetX - mouse.x) * 0.035;
      mouse.y += (mouse.targetY - mouse.y) * 0.035;

      ctx.clearRect(0, 0, width, height);

      // Subtle, realistic volumetric atmospheric lighting that breathes on its own
      const lightX = width * 0.5 + Math.sin(time * 0.006) * (width * 0.25) + (mouse.x - width * 0.5) * 0.2;
      const lightY = height * 0.35 + Math.cos(time * 0.005) * 40 + (mouse.y - height * 0.5) * 0.2;

      const ambientLight = ctx.createRadialGradient(
        lightX,
        lightY,
        20,
        lightX,
        lightY,
        width * 0.55
      );
      ambientLight.addColorStop(0, 'rgba(254, 247, 242, 0.9)');
      ambientLight.addColorStop(0.4, 'rgba(249, 242, 248, 0.5)');
      ambientLight.addColorStop(1, 'rgba(251, 248, 252, 0)');

      ctx.fillStyle = ambientLight;
      ctx.fillRect(0, 0, width, height);

      // Draw each autonomous undulating wave ribbon
      waves.forEach((wave, idx) => {
        const currentBaseY = height * wave.baseY;
        const phase = time * wave.speed + wave.offset;

        // Wave path
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, currentBaseY);

        const step = 8;
        for (let x = 0; x <= width + step; x += step) {
          // Autonomous compound sine wave with subtle natural variance
          const wave1 = Math.sin(x * wave.frequency + phase);
          const wave2 = Math.cos(x * wave.frequency * 1.8 - phase * 0.6) * 0.45;
          const wave3 = Math.sin(x * wave.frequency * 0.5 + phase * 1.2) * 0.3;

          // Subtle cursor repulsion / attraction
          const distToMouse = Math.abs(x - mouse.x);
          const mouseEffect = Math.max(0, 1 - distToMouse / 280) * (mouse.y - currentBaseY) * 0.25;

          const y = currentBaseY + (wave1 + wave2 + wave3) * wave.amplitude + mouseEffect;
          ctx.lineTo(x, y);
        }

        ctx.lineTo(width, height);
        ctx.closePath();

        // Shaded depth fill
        const fillGrad = ctx.createLinearGradient(0, currentBaseY - wave.amplitude, 0, height);
        fillGrad.addColorStop(0, wave.gradient[0]);
        fillGrad.addColorStop(0.5, wave.gradient[1]);
        fillGrad.addColorStop(1, wave.gradient[2]);

        ctx.fillStyle = fillGrad;
        ctx.fill();

        // Delicate crest contour line
        ctx.beginPath();
        for (let x = 0; x <= width + step; x += step) {
          const wave1 = Math.sin(x * wave.frequency + phase);
          const wave2 = Math.cos(x * wave.frequency * 1.8 - phase * 0.6) * 0.45;
          const wave3 = Math.sin(x * wave.frequency * 0.5 + phase * 1.2) * 0.3;

          const distToMouse = Math.abs(x - mouse.x);
          const mouseEffect = Math.max(0, 1 - distToMouse / 280) * (mouse.y - currentBaseY) * 0.25;

          const y = currentBaseY + (wave1 + wave2 + wave3) * wave.amplitude + mouseEffect;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        ctx.strokeStyle = wave.stroke;
        ctx.lineWidth = wave.lineWidth;
        ctx.stroke();
      });

      // Subtle fine architectural grid matrix lines (delicate and tonally integrated)
      ctx.strokeStyle = 'rgba(236, 230, 237, 0.45)';
      ctx.lineWidth = 1;
      const gridSpacing = 64;
      const gridOffset = (time * 0.15) % gridSpacing;

      ctx.beginPath();
      for (let x = gridOffset; x < width; x += gridSpacing) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = gridOffset; y < height; y += gridSpacing) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

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
