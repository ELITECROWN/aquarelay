import { useEffect, useRef } from "react";

interface Droplet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  life: number;
  maxLife: number;
  color: string;
}

export default function WaterSlideTrail() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(max-width: 767px), (pointer: coarse)').matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    const droplets: Droplet[] = [];
    let lastX = 0;
    let lastY = 0;
    let isDown = false;

    const waterColors = [
      "rgba(239, 68, 68,",   // vivid red
      "rgba(220, 38, 38,",   // crimson red
      "rgba(244, 63, 94,",   // rose red
      "rgba(251, 113, 133,", // soft coral
      "rgba(185, 28, 28,",   // deep ruby
    ];

    // Mouse slide watery splash emission (transparent & fluid)
    const onPointerMove = (e: PointerEvent) => {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      const speed = Math.hypot(dx, dy);
      lastX = e.clientX;
      lastY = e.clientY;

      if (speed > 6) {
        // Emit subtle transparent watery droplets
        const count = Math.min(Math.floor(speed / 6), 4);
        for (let i = 0; i < count; i++) {
          const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.5;
          const dropSpeed = Math.random() * (speed * 0.12) + 0.8;
          const color = waterColors[Math.floor(Math.random() * waterColors.length)];

          droplets.push({
            x: e.clientX + (Math.random() - 0.5) * 8,
            y: e.clientY + (Math.random() - 0.5) * 8,
            vx: Math.cos(angle) * dropSpeed,
            vy: Math.sin(angle) * dropSpeed + 0.3,
            radius: Math.random() * 2.8 + 1.2,
            alpha: 0.28, // Transparent water droplets!
            life: 0,
            maxLife: 22 + Math.random() * 12,
            color,
          });
        }
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      isDown = true;
      // Transparent splash ring on click
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2;
        const speed = Math.random() * 2.5 + 1.5;
        droplets.push({
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: Math.random() * 3.5 + 1.5,
          alpha: 0.38,
          life: 0,
          maxLife: 26,
          color: "rgba(14, 165, 233,",
        });
      }
    };

    const onPointerUp = () => {
      isDown = false;
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp);

    // Interactive Bar Illumination Highlighter
    // Whenever pointer or touch enters or moves over any bar (nav, topbar, ticker, panels)
    const onBarPointerMove = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest(
        ".highlight-bar, .landing-nav, .topbar, .lake-health-ticker-container, .global-search, .glass-panel, .wf-panel, .lake-item-btn, .activity-item-btn"
      ) as HTMLElement | null;

      if (target) {
        const rect = target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        target.style.setProperty("--touch-x", `${x}px`);
        target.style.setProperty("--touch-y", `${y}px`);
        target.style.setProperty("--touch-active", "1");
        target.classList.add("bar-illuminated");
      }
    };

    const onBarPointerLeave = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest(
        ".highlight-bar, .landing-nav, .topbar, .lake-health-ticker-container, .global-search, .glass-panel, .wf-panel"
      ) as HTMLElement | null;

      if (target) {
        target.style.setProperty("--touch-active", "0");
        target.classList.remove("bar-illuminated");
      }
    };

    document.addEventListener("mousemove", onBarPointerMove, { passive: true });
    document.addEventListener("mouseout", onBarPointerLeave, { passive: true });

    // Render loop for sliding water droplets
    let animId: number;
    const render = () => {
      if (document.hidden || !droplets.length) {
        ctx.clearRect(0, 0, width, height);
        animId = requestAnimationFrame(render);
        return;
      }
      ctx.clearRect(0, 0, width, height);

      for (let i = droplets.length - 1; i >= 0; i--) {
        const d = droplets[i];
        d.life++;
        d.x += d.vx;
        d.y += d.vy;
        d.vx *= 0.94;
        d.vy *= 0.94;
        d.radius *= 0.97;
        const progress = d.life / d.maxLife;
        const alpha = d.alpha * (1 - progress);

        if (progress >= 1 || d.radius < 0.5) {
          droplets.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${d.color} ${alpha})`;
        ctx.shadowColor = "rgba(225, 29, 72, 0.4)";
        ctx.shadowBlur = d.radius * 2;
        ctx.fill();

        // Little white specular glint on droplet
        ctx.beginPath();
        ctx.arc(d.x - d.radius * 0.3, d.y - d.radius * 0.3, d.radius * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
        ctx.fill();
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("mousemove", onBarPointerMove);
      document.removeEventListener("mouseout", onBarPointerLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 99990,
      }}
      aria-hidden="true"
    />
  );
}
