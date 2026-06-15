"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  useGenerationStore,
  type GenerationStatus,
} from "@/store/generation.store";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  color: string;
}

function getStatusConfig(status: GenerationStatus) {
  switch (status) {
    case "IDLE":
      return { speed: 0.3, particleCount: 40, energy: 0.2, opacity: 0.6 };
    case "GENERATING":
      return { speed: 1.5, particleCount: 80, energy: 1.0, opacity: 0.9 };
    case "REVEALING":
      return { speed: 0.6, particleCount: 60, energy: 0.4, opacity: 0.5 };
    case "READY":
      return { speed: 0.1, particleCount: 20, energy: 0.05, opacity: 0.15 };
    case "FAILED":
      return { speed: 0.8, particleCount: 50, energy: 0.6, opacity: 0.7 };
    default:
      return { speed: 0.3, particleCount: 40, energy: 0.2, opacity: 0.6 };
  }
}

function getStatusColor(status: GenerationStatus): string {
  switch (status) {
    case "GENERATING":
      return "rgba(99, 102, 241, 0.6)";
    case "REVEALING":
      return "rgba(139, 92, 246, 0.5)";
    case "READY":
      return "rgba(34, 197, 94, 0.3)";
    case "FAILED":
      return "rgba(239, 68, 68, 0.5)";
    default:
      return "rgba(99, 102, 241, 0.3)";
  }
}

export function LiquidEtherBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const status = useGenerationStore((s) => s.status);
  const statusRef = useRef(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const createParticles = useCallback(
    (width: number, height: number, count: number) => {
      const particles: Particle[] = [];
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          radius: Math.random() * 3 + 1,
          alpha: Math.random() * 0.5 + 0.3,
          color: getStatusColor(statusRef.current),
        });
      }
      return particles;
    },
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement!.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement!);
    resize();

    const rect = canvas.parentElement!.getBoundingClientRect();
    particlesRef.current = createParticles(
      rect.width || 600,
      rect.height || 340,
      40,
    );

    const animate = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      const width = rect.width || 600;
      const height = rect.height || 340;
      const config = getStatusConfig(statusRef.current);
      const color = getStatusColor(statusRef.current);

      ctx.clearRect(0, 0, width, height);

      const particles = particlesRef.current;
      const targetCount = config.particleCount;

      while (particles.length < targetCount) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * config.speed,
          vy: (Math.random() - 0.5) * config.speed,
          radius: Math.random() * 3 + 1,
          alpha: Math.random() * 0.5 + 0.3,
          color,
        });
      }
      while (particles.length > targetCount) {
        particles.pop();
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!p) continue;

        p.x += p.vx * config.speed;
        p.y += p.vy * config.speed;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        p.x = Math.max(0, Math.min(width, p.x));
        p.y = Math.max(0, Math.min(height, p.y));

        p.color = color;
        p.alpha = config.opacity * (0.5 + Math.random() * 0.5);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          if (!p2) continue;
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120 * config.energy + 40) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = color;
            ctx.globalAlpha = (1 - dist / 160) * config.opacity * 0.4;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      ctx.globalAlpha = 1;
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationRef.current);
    };
  }, [createParticles]);

  const zIndex = status === "GENERATING" ? "z-20" : "z-0";

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 ${zIndex} pointer-events-none rounded-xl`}
      style={{ opacity: status === "READY" ? 0.15 : 1 }}
    />
  );
}
