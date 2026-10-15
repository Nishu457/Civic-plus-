/* CivicPulse AI — Cursor Particle & Reactive Glow Canvas */

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string; // rgb string 'r, g, b'
  alpha: number;
  initialAlpha: number;
  life: number;
  decay: number;
  brightBoost: number;
}

// Restrained palette: Electric Blue (#2563EB), Cyan (#22D3EE), Violet (#8B5CF6)
const PALETTE = [
  '37, 99, 235',  // #2563EB Electric Blue
  '34, 211, 238',  // #22D3EE Cyan
  '139, 92, 246', // #8B5CF6 Violet
];

export const CursorParticleEffect = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // 1. Accessibility: Respect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Detect touch / coarse pointer devices
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

    // Performance detection: Low-powered devices (low core count or low memory)
    const isLowPower =
      (typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4) ||
      (typeof (navigator as any).deviceMemory === 'number' && (navigator as any).deviceMemory <= 4);

    const MAX_PARTICLES = isTouchDevice ? 15 : isLowPower ? 25 : 65;
    const CONNECT_DISTANCE = isLowPower ? 0 : 65; // Skip lines on low power
    const SPAWN_DISTANCE = isTouchDevice ? 16 : 6;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Device Pixel Ratio capped at 2 for performance
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      if (!canvas) return;
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });

    // State maintained in refs/closures (NO React re-renders)
    const particles: Particle[] = [];
    const pointer = {
      x: -1000,
      y: -1000,
      lastX: -1000,
      lastY: -1000,
      smoothX: -1000,
      smoothY: -1000,
      speed: 0,
      isHoveringInteractive: false,
      active: false,
      distAccum: 0,
    };

    let animationFrameId: number;
    let isTabVisible = !document.hidden;

    // Detect interactive element hover efficiently
    const checkInteractive = (target: EventTarget | null) => {
      if (!target || !(target instanceof HTMLElement)) return false;
      return Boolean(
        target.closest('button, a, input, select, textarea, [role="button"], .card, .btn-primary, .btn-secondary, .btn-accent, .card-interactive')
      );
    };

    // Spawn a particle
    const spawnParticle = (x: number, y: number, speed: number, isInteractive: boolean) => {
      if (particles.length >= MAX_PARTICLES) {
        particles.shift(); // Evict oldest
      }

      // Color selection
      const colorIndex = Math.floor(Math.random() * PALETTE.length);
      const color = PALETTE[colorIndex];

      // Particles brighten and get more energetic when moving quickly
      const speedNormalized = Math.min(speed / 30, 1);
      const brightBoost = 1.0 + speedNormalized * 0.6;

      // Slight angle jitter
      const angle = Math.random() * Math.PI * 2;
      const velocityMag = 0.3 + Math.random() * (1.2 + speedNormalized * 1.5);

      const vx = Math.cos(angle) * velocityMag;
      const vy = Math.sin(angle) * velocityMag;

      const size = 1.6 + Math.random() * 2.2 + (isInteractive ? 0.6 : 0);
      const decay = 0.016 + Math.random() * 0.018; // ~35 - 60 frames life
      const initialAlpha = 0.75 * brightBoost;

      particles.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx,
        vy,
        size,
        color,
        alpha: Math.min(initialAlpha, 1),
        initialAlpha: Math.min(initialAlpha, 1),
        life: 1.0,
        decay,
        brightBoost,
      });
    };

    // Pointer move handler
    const onPointerMove = (e: PointerEvent) => {
      const x = e.clientX;
      const y = e.clientY;

      if (!pointer.active) {
        pointer.active = true;
        pointer.x = x;
        pointer.y = y;
        pointer.lastX = x;
        pointer.lastY = y;
        pointer.smoothX = x;
        pointer.smoothY = y;
      }

      const dx = x - pointer.lastX;
      const dy = y - pointer.lastY;
      const dist = Math.hypot(dx, dy);
      pointer.speed = dist;

      pointer.x = x;
      pointer.y = y;
      pointer.distAccum += dist;

      pointer.isHoveringInteractive = checkInteractive(e.target);

      // Distance-based particle emission
      if (pointer.distAccum >= SPAWN_DISTANCE) {
        const count = dist > 25 ? (isLowPower ? 1 : 2) : 1;
        for (let i = 0; i < count; i++) {
          spawnParticle(x, y, pointer.speed, pointer.isHoveringInteractive);
        }
        pointer.distAccum = 0;
      }

      pointer.lastX = x;
      pointer.lastY = y;
    };

    const onPointerLeave = () => {
      pointer.active = false;
      pointer.isHoveringInteractive = false;
    };

    // Touch tap burst for touchscreens (restrained & lightweight)
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const count = isLowPower ? 2 : 4;
        for (let i = 0; i < count; i++) {
          spawnParticle(touch.clientX, touch.clientY, 10, false);
        }
      }
    };

    // Visibility change handling
    const onVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible) {
        // Reset last positions to prevent burst
        pointer.distAccum = 0;
        cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(render);
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave, { passive: true });
    if (isTouchDevice) {
      window.addEventListener('touchstart', onTouchStart, { passive: true });
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Animation Loop
    const render = () => {
      if (!isTabVisible) return;

      ctx.clearRect(0, 0, width, height);

      // Smooth cursor glow follower (spring / lerp)
      if (pointer.active) {
        pointer.smoothX += (pointer.x - pointer.smoothX) * 0.22;
        pointer.smoothY += (pointer.y - pointer.smoothY) * 0.22;

        // Render subtle radial glow around cursor
        const glowRadius = pointer.isHoveringInteractive ? 110 : 80;
        const glowAlpha = pointer.isHoveringInteractive ? 0.12 : 0.07;

        const radialGlow = ctx.createRadialGradient(
          pointer.smoothX,
          pointer.smoothY,
          0,
          pointer.smoothX,
          pointer.smoothY,
          glowRadius
        );
        radialGlow.addColorStop(0, `rgba(37, 99, 235, ${glowAlpha})`);
        radialGlow.addColorStop(0.4, `rgba(34, 211, 238, ${glowAlpha * 0.5})`);
        radialGlow.addColorStop(0.8, `rgba(139, 92, 246, ${glowAlpha * 0.2})`);
        radialGlow.addColorStop(1, 'rgba(139, 92, 246, 0)');

        ctx.fillStyle = radialGlow;
        ctx.beginPath();
        ctx.arc(pointer.smoothX, pointer.smoothY, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Update & Render Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Physics: movement + damping
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95;
        p.vy *= 0.95;

        // Gentle attraction to interactive element cursor
        if (pointer.isHoveringInteractive && pointer.active) {
          const dx = pointer.x - p.x;
          const dy = pointer.y - p.y;
          p.x += dx * 0.02;
          p.y += dy * 0.02;
        }

        // Decay & fade
        p.life -= p.decay;
        p.alpha = Math.max(0, p.life * p.initialAlpha);

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        // Draw particle dot with soft glow
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
        ctx.shadowColor = `rgba(${p.color}, ${p.alpha * 0.8})`;
        ctx.shadowBlur = p.brightBoost > 1.2 ? 10 : 6;
        ctx.fill();
        ctx.restore();
      }

      // Draw subtle connecting lines between nearby particles
      if (CONNECT_DISTANCE > 0 && particles.length > 1) {
        const pLen = particles.length;
        for (let i = 0; i < pLen; i++) {
          let connections = 0;
          const p1 = particles[i];
          for (let j = i + 1; j < pLen; j++) {
            if (connections >= 2) break; // Restrained: max 2 connections per particle
            const p2 = particles[j];
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const dist = Math.hypot(dx, dy);

            if (dist < CONNECT_DISTANCE) {
              connections++;
              const lineAlpha = (1 - dist / CONNECT_DISTANCE) * Math.min(p1.alpha, p2.alpha) * 0.22;
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = `rgba(37, 99, 235, ${lineAlpha})`;
              ctx.lineWidth = 0.75;
              ctx.stroke();
            }
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    // Cleanup on unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onPointerLeave);
      if (isTouchDevice) {
        window.removeEventListener('touchstart', onTouchStart);
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-30 overflow-hidden"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 30,
      }}
      aria-hidden="true"
    />
  );
};

export default CursorParticleEffect;
