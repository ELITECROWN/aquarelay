import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  originX: number;
  originY: number;
  radius: number;
  color: string;
  alpha: number;
  speed: number;
  angle: number;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
}

export default function FluidWaterCanvas({
  intensity = "full",
  className = "",
}: {
  intensity?: "full" | "subtle";
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const mouse = {
      x: width / 2,
      y: height / 2,
      targetX: width / 2,
      targetY: height / 2,
      isMoving: false,
      speed: 0,
      lastX: width / 2,
      lastY: height / 2,
    };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Light red & coral palette
    const colors = [
      "rgba(255, 77, 109, ",   // bright rose
      "rgba(244, 63, 94, ",    // crimson rose
      "rgba(251, 113, 133, ",  // soft light red
      "rgba(254, 205, 211, ",  // pale blush
      "rgba(225, 29, 72, ",    // deep ruby
    ];

    // Create particles
    const particleCount = intensity === "full" ? 65 : 35;
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      particles.push({
        x,
        y,
        originX: x,
        originY: y,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        radius: Math.random() * 4 + 1.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.45 + 0.15,
        speed: Math.random() * 0.02 + 0.008,
        angle: Math.random() * Math.PI * 2,
      });
    }

    // Interactive ripples
    const ripples: Ripple[] = [];

    const handleMouseMove = (e: MouseEvent) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      mouse.isMoving = true;

      // Calculate speed
      const dx = e.clientX - mouse.lastX;
      const dy = e.clientY - mouse.lastY;
      mouse.speed = Math.sqrt(dx * dx + dy * dy);
      mouse.lastX = e.clientX;
      mouse.lastY = e.clientY;

      if (mouse.speed > 15 && Math.random() > 0.6) {
        ripples.push({
          x: e.clientX,
          y: e.clientY,
          radius: 5,
          maxRadius: Math.min(180, mouse.speed * 4 + 40),
          alpha: 0.45,
          speed: 2.2 + mouse.speed * 0.05,
        });
      }
    };

    const handleClick = (e: MouseEvent) => {
      // Big ripple on click
      ripples.push({
        x: e.clientX,
        y: e.clientY,
        radius: 10,
        maxRadius: 260,
        alpha: 0.7,
        speed: 3.8,
      });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("click", handleClick, { passive: true });

    let time = 0;

    const render = () => {
      time += 0.015;

      // Smooth mouse follow
      mouse.x += (mouse.targetX - mouse.x) * 0.08;
      mouse.y += (mouse.targetY - mouse.y) * 0.08;

      ctx.clearRect(0, 0, width, height);

      // 1. Draw organic water wave layers with light red tint
      const waveCount = 3;
      for (let w = 0; w < waveCount; w++) {
        ctx.beginPath();
        const baseHeight = height * (0.65 + w * 0.12);
        const amplitude = 22 + w * 14;
        const frequency = 0.0022 - w * 0.0005;
        const waveSpeed = time * (0.8 + w * 0.4);

        ctx.moveTo(0, height);
        ctx.lineTo(0, baseHeight);

        for (let x = 0; x <= width; x += 15) {
          // Cursor displacement wave effect
          const distToMouse = Math.abs(x - mouse.x);
          const mouseEffect = distToMouse < 220 
            ? Math.cos((distToMouse / 220) * (Math.PI / 2)) * 35 * Math.sin(time * 3)
            : 0;

          const y =
            baseHeight +
            Math.sin(x * frequency + waveSpeed) * amplitude +
            Math.cos(x * frequency * 1.5 - waveSpeed * 0.8) * (amplitude * 0.5) +
            mouseEffect;

          ctx.lineTo(x, y);
        }

        ctx.lineTo(width, height);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, baseHeight - 50, 0, height);
        if (w === 0) {
          grad.addColorStop(0, "rgba(255, 228, 230, 0.45)");
          grad.addColorStop(1, "rgba(255, 241, 242, 0.75)");
        } else if (w === 1) {
          grad.addColorStop(0, "rgba(254, 205, 211, 0.35)");
          grad.addColorStop(1, "rgba(255, 228, 230, 0.6)");
        } else {
          grad.addColorStop(0, "rgba(253, 164, 175, 0.22)");
          grad.addColorStop(1, "rgba(254, 205, 211, 0.4)");
        }

        ctx.fillStyle = grad;
        ctx.fill();
      }

      // 2. Draw active water ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.radius += r.speed;
        r.alpha *= 0.96;

        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(225, 29, 72, ${r.alpha})`;
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Inner harmonic ripple
        if (r.radius > 20) {
          ctx.beginPath();
          ctx.arc(r.x, r.y, r.radius * 0.65, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(251, 113, 133, ${r.alpha * 0.5})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        if (r.alpha < 0.01 || r.radius > r.maxRadius) {
          ripples.splice(i, 1);
        }
      }

      // 3. Draw and update floating fluid particles (bio-luminescent water sensors)
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Orbit around natural origin
        p.angle += p.speed;
        const driftX = Math.cos(p.angle) * 25;
        const driftY = Math.sin(p.angle * 1.3) * 20;

        const targetX = p.originX + driftX;
        const targetY = p.originY + driftY;

        // Interaction with mouse cursor (fluid dispersion & magnetic swirling)
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 180) {
          const force = (1 - dist / 180) * 4;
          // Fluid push
          p.vx -= (dx / dist) * force * 0.8;
          p.vy -= (dy / dist) * force * 0.8;
          // Organic swirl
          p.vx += (-dy / dist) * force * 0.4;
          p.vy += (dx / dist) * force * 0.4;
        }

        // Apply friction and restore to anchor
        p.vx += (targetX - p.x) * 0.015;
        p.vy += (targetY - p.y) * 0.015;
        p.vx *= 0.92;
        p.vy *= 0.92;

        p.x += p.vx;
        p.y += p.vy;

        // Draw particle with soft glowing aura
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.alpha})`;
        ctx.shadowColor = "rgba(225, 29, 72, 0.4)";
        ctx.shadowBlur = p.radius * 3;
        ctx.fill();
        ctx.restore();

        // Connect nearby particles with delicate water molecular filaments
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const distBetween = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (distBetween < 85) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            const lineAlpha = (1 - distBetween / 85) * 0.16;
            ctx.strokeStyle = `rgba(244, 63, 94, ${lineAlpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // 4. Subtle ambient mouse glow aura (Lusion spotlight)
      const mouseGlow = ctx.createRadialGradient(
        mouse.x,
        mouse.y,
        0,
        mouse.x,
        mouse.y,
        280
      );
      mouseGlow.addColorStop(0, "rgba(255, 77, 109, 0.09)");
      mouseGlow.addColorStop(0.5, "rgba(254, 205, 211, 0.04)");
      mouseGlow.addColorStop(1, "rgba(255, 241, 242, 0)");
      ctx.fillStyle = mouseGlow;
      ctx.fillRect(0, 0, width, height);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleClick);
    };
  }, [intensity]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none z-0 ${className}`}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
      }}
      aria-hidden="true"
    />
  );
}
