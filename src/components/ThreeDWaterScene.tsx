import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function ThreeDWaterScene({
  className = "",
}: {
  className?: string;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xfff8f8, 0.025);

    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 7, 16);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // 2. Lighting (Crisp oceanic sky + azure water reflections)
    const ambientLight = new THREE.AmbientLight(0xe0f2fe, 1.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 2.6);
    dirLight.position.set(8, 12, 10);
    scene.add(dirLight);

    const secondaryLight = new THREE.PointLight(0x06b6d4, 3.2, 35);
    secondaryLight.position.set(-6, 4, 4);
    scene.add(secondaryLight);

    // 3. 3D Water Plane Geometry with dynamic ripples
    const widthSegments = 90;
    const heightSegments = 90;
    const waterGeometry = new THREE.PlaneGeometry(
      28,
      28,
      widthSegments,
      heightSegments
    );
    waterGeometry.rotateX(-Math.PI / 2);

    // Save original vertex heights for wave reset
    const posAttribute = waterGeometry.attributes.position;
    const initialPositions = posAttribute.array.slice();

    const waterMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#0096c7"),
      emissive: new THREE.Color("#023e8a"),
      emissiveIntensity: 0.12,
      roughness: 0.06,
      metalness: 0.08,
      transmission: 0.95,
      ior: 1.333, // Water index of refraction
      transparent: true,
      opacity: 0.52,
      reflectivity: 0.85,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      wireframe: false,
    });

    const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    waterMesh.position.set(0, -1.8, 0);
    scene.add(waterMesh);

    // 4. Floating 3D Transparent Crystal Water Droplets
    const bubbles: THREE.Mesh[] = [];
    const bubbleGeo = new THREE.SphereGeometry(0.35, 32, 32);
    const bubbleMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#38bdf8"),
      emissive: new THREE.Color("#0284c7"),
      emissiveIntensity: 0.25,
      roughness: 0.02,
      transmission: 0.96,
      thickness: 0.4,
      transparent: true,
      opacity: 0.28,
      ior: 1.333,
    });

    for (let i = 0; i < 18; i++) {
      const bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
      const scale = 0.4 + Math.random() * 0.9;
      bubble.scale.set(scale, scale, scale);
      bubble.position.set(
        (Math.random() - 0.5) * 18,
        -1.2 + Math.random() * 2.8,
        (Math.random() - 0.5) * 14
      );
      bubble.userData = {
        speed: 0.8 + Math.random() * 1.4,
        angle: Math.random() * Math.PI * 2,
        initialY: bubble.position.y,
        bobRange: 0.3 + Math.random() * 0.5,
      };
      scene.add(bubble);
      bubbles.push(bubble);
    }

    // 5. Interactive Mouse Sliding Fluid Dynamics
    const raycaster = new THREE.Raycaster();
    const mouse2D = new THREE.Vector2(-999, -999);
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;
    let mouseVelocity = 0;
    let lastMouseX = 0;
    let lastMouseY = 0;

    // Wave ripple impact points queue
    interface Impact {
      x: number;
      z: number;
      radius: number;
      strength: number;
      decay: number;
    }
    const impacts: Impact[] = [];

    const onPointerMove = (e: PointerEvent) => {
      // Normalized device coordinates (-1 to +1)
      mouse2D.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse2D.y = -(e.clientY / window.innerHeight) * 2 + 1;

      targetMouseX = mouse2D.x * 6;
      targetMouseY = mouse2D.y * 4;

      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      mouseVelocity = Math.min(Math.sqrt(dx * dx + dy * dy), 40);
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;

      // Project mouse on 3D water plane
      raycaster.setFromCamera(mouse2D, camera);
      const intersects = raycaster.intersectObject(waterMesh);

      if (intersects.length > 0) {
        const point = intersects[0].point;
        // Slide ripple wave
        impacts.push({
          x: point.x,
          z: point.z,
          radius: 0.1,
          strength: 0.35 + (mouseVelocity / 40) * 0.45,
          decay: 0.94,
        });
        if (impacts.length > 15) impacts.shift();
      }
    };

    // 6. Scroll-Driven 3D Water Dynamics
    let scrollY = window.scrollY;
    let scrollVelocity = 0;
    let lastScrollY = window.scrollY;

    const onScroll = () => {
      scrollY = window.scrollY;
      const diff = scrollY - lastScrollY;
      scrollVelocity = Math.min(Math.abs(diff) * 0.05, 3);
      lastScrollY = scrollY;

      // Add a dynamic water surge when scrolling
      if (Math.abs(diff) > 8 && impacts.length < 12) {
        impacts.push({
          x: (Math.random() - 0.5) * 8,
          z: (Math.random() - 0.5) * 8,
          radius: 0.3,
          strength: 0.4 + scrollVelocity * 0.2,
          decay: 0.93,
        });
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });

    // Handle Window Resize
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    // 7. Render Loop
    let lastTime = performance.now();
    let animId: number;

    const animate = (currentTime: number) => {
      const now = currentTime || performance.now();
      const delta = Math.min((now - lastTime) * 0.001, 0.1);
      lastTime = now;
      const time = now * 0.001;

      // Smooth camera parallax following mouse slide
      currentMouseX += (targetMouseX - currentMouseX) * 0.05;
      currentMouseY += (targetMouseY - currentMouseY) * 0.05;

      camera.position.x = currentMouseX * 0.45;
      camera.position.y = 7 + currentMouseY * 0.25 - scrollY * 0.002;
      camera.lookAt(0, -scrollY * 0.001, 0);

      // Light moves with mouse slide for liquid caustics reflection
      secondaryLight.position.x = currentMouseX * 1.5;
      secondaryLight.position.z = 4 + currentMouseY;

      // Update 3D Water Geometry Vertices (Watery wave equations)
      const positions = posAttribute.array as Float32Array;
      const vertexCount = positions.length / 3;

      // Fade out and expand impacts
      for (let i = impacts.length - 1; i >= 0; i--) {
        const imp = impacts[i];
        imp.radius += 0.14;
        imp.strength *= imp.decay;
        if (imp.strength < 0.01) {
          impacts.splice(i, 1);
        }
      }

      for (let i = 0; i < vertexCount; i++) {
        const i3 = i * 3;
        const x = initialPositions[i3];
        const z = initialPositions[i3 + 2];

        // Harmonic natural ocean/lake swells
        let waveHeight =
          Math.sin(x * 0.45 + time * 1.8) * 0.16 +
          Math.cos(z * 0.45 + time * 1.5) * 0.14 +
          Math.sin((x + z) * 0.3 + time * 2.2) * 0.09;

        // Apply mouse sliding impact waves
        for (let j = 0; j < impacts.length; j++) {
          const imp = impacts[j];
          const dist = Math.hypot(x - imp.x, z - imp.z);
          const wavePhase = (dist - imp.radius) * 4;
          if (dist < imp.radius + 3 && dist > imp.radius - 1) {
            waveHeight += Math.sin(wavePhase) * imp.strength;
          }
        }

        // Apply scroll turbulence
        if (scrollVelocity > 0.01) {
          waveHeight += Math.sin(x * 0.8 + time * 6) * scrollVelocity * 0.08;
          scrollVelocity *= 0.96;
        }

        positions[i3 + 1] = initialPositions[i3 + 1] + waveHeight;
      }

      posAttribute.needsUpdate = true;
      waterGeometry.computeVertexNormals();

      // Animate floating droplets
      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        b.userData.angle += delta * b.userData.speed;
        b.position.y =
          b.userData.initialY +
          Math.sin(b.userData.angle) * b.userData.bobRange +
          Math.sin(time * 2 + i) * 0.1;
        b.rotation.x += delta * 0.4;
        b.rotation.y += delta * 0.6;
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animate(performance.now());

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      waterGeometry.dispose();
      waterMaterial.dispose();
      bubbleGeo.dispose();
      bubbleMat.dispose();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={`fixed inset-0 pointer-events-none z-0 ${className}`}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        overflow: "hidden",
      }}
      aria-hidden="true"
    />
  );
}
