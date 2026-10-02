import { useEffect, useState } from "react";

export default function LusionCursor() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // Only enable on non-touch devices
    if (window.matchMedia("(pointer: coarse)").matches) return;
    setEnabled(true);

    const cursorDot = document.getElementById("lusion-cursor-dot");
    const cursorRing = document.getElementById("lusion-cursor-ring");

    if (!cursorDot || !cursorRing) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;
    let isHovering = false;
    let isClicking = false;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      // Position dot instantly
      cursorDot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;

      // Check if hovering over clickable element
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.closest("button") ||
          target.closest("a") ||
          target.closest("input") ||
          target.closest("select") ||
          target.closest(".interactive") ||
          target.closest(".wf-choice") ||
          target.closest(".water-card"))
      ) {
        if (!isHovering) {
          isHovering = true;
          cursorRing.classList.add("cursor-hover");
        }
      } else {
        if (isHovering) {
          isHovering = false;
          cursorRing.classList.remove("cursor-hover");
        }
      }
    };

    const onMouseDown = () => {
      isClicking = true;
      cursorRing.classList.add("cursor-click");
    };

    const onMouseUp = () => {
      isClicking = false;
      cursorRing.classList.remove("cursor-click");
    };

    let animId: number;
    const animateRing = () => {
      // Spring lag for smooth liquid trailing
      const ease = isHovering ? 0.22 : 0.15;
      ringX += (mouseX - ringX) * ease;
      ringY += (mouseY - ringY) * ease;

      cursorRing.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;

      animId = requestAnimationFrame(animateRing);
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    animId = requestAnimationFrame(animateRing);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      cancelAnimationFrame(animId);
    };
  }, []);

  if (!enabled) return null;

  return (
    <>
      <div
        id="lusion-cursor-dot"
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          backgroundColor: "#e11d48",
          pointerEvents: "none",
          zIndex: 99999,
          transition: "opacity 0.15s ease",
          boxShadow: "0 0 8px rgba(225, 29, 72, 0.7)",
        }}
      />
      <div
        id="lusion-cursor-ring"
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "34px",
          height: "34px",
          borderRadius: "50%",
          border: "1.5px solid rgba(225, 29, 72, 0.45)",
          backgroundColor: "rgba(255, 228, 230, 0.2)",
          backdropFilter: "blur(1px)",
          pointerEvents: "none",
          zIndex: 99998,
          transition:
            "width 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), height 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), background-color 0.25s ease, border-color 0.25s ease, transform 0.05s linear",
          boxShadow: "0 0 16px rgba(244, 63, 94, 0.15)",
        }}
      />
    </>
  );
}
