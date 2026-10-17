"use client";

import { ContactShadows, RoundedBox } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";

/*
 * The hero's 3D stage: a small stack of task cards and a desk clock.
 *  - Tilts toward the pointer (a physical thing you could pick up)
 *  - Fans the stack out as you scroll past it (the list taking shape)
 *  - The clock shows the real time — the one thing that moves on its own, because time does
 * Rendering is on demand: frames are drawn only while something is changing, and never
 * while the canvas is off-screen or the tab is hidden.
 */

interface Palette {
  paper: string;
  raised: string;
  ink: string;
  ink3: string;
  line: string;
  accent: string;
  p1: string;
  p2: string;
  p3: string;
}

function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(`--c-${n}`).trim() || "#888";
  return { paper: v("surface"), raised: v("raised"), ink: v("ink"), ink3: v("ink-3"), line: v("line-strong"), accent: v("accent"), p1: v("p1"), p2: v("p2"), p3: v("p3") };
}

const CARDS = [
  { ring: "p1", lines: [0.9, 0.55], done: false },
  { ring: "p2", lines: [0.75, 0.4], done: false },
  { ring: "accent", lines: [1.0, 0.6], done: true },
  { ring: "p3", lines: [0.65, 0.5], done: false },
] as const;

export interface SceneInputs {
  pointer: MutableRefObject<{ x: number; y: number }>;
  /** 0 at the top of the page, 1 once the hero has scrolled away. */
  progress: MutableRefObject<number>;
}

function Card({ i, palette, inputs }: { i: number; palette: Palette; inputs: SceneInputs }) {
  const ref = useRef<THREE.Group>(null);
  const c = CARDS[i];
  const ringColor = palette[c.ring as keyof Palette];
  const { invalidate } = useThree();

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const p = inputs.progress.current;
    // Stacked (p=0): offset diagonally like a hand of cards. Fanned (p=1): a tidy column.
    const tx = THREE.MathUtils.lerp(-0.15 + i * 0.12, -0.4, p);
    const ty = THREE.MathUtils.lerp(0.55 - i * 0.32, 1.3 - i * 0.9, p);
    const tz = THREE.MathUtils.lerp(-i * 0.28, 0, p);
    const rz = THREE.MathUtils.lerp(0.06 - i * 0.05, 0, p);
    const k = 1 - Math.exp(-dt * 8); // frame-rate independent ease toward the target
    g.position.x += (tx - g.position.x) * k;
    g.position.y += (ty - g.position.y) * k;
    g.position.z += (tz - g.position.z) * k;
    g.rotation.z += (rz - g.rotation.z) * k;
    if (Math.abs(tx - g.position.x) + Math.abs(ty - g.position.y) + Math.abs(tz - g.position.z) > 0.001) invalidate();
  });

  return (
    <group ref={ref} position={[-0.15 + i * 0.12, 0.55 - i * 0.32, -i * 0.28]}>
      <RoundedBox args={[2.3, 0.72, 0.06]} radius={0.05} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color={palette.raised} roughness={0.85} metalness={0} />
      </RoundedBox>
      {/* Checkbox ring (filled when done) */}
      <mesh position={[-0.88, 0.08, 0.035]}>
        {c.done ? <circleGeometry args={[0.1, 32]} /> : <ringGeometry args={[0.078, 0.1, 40]} />}
        <meshBasicMaterial color={ringColor} />
      </mesh>
      {/* Title and meta lines */}
      {c.lines.map((w, j) => (
        <mesh key={j} position={[-0.68 + w / 2, j === 0 ? 0.08 : -0.14, 0.035]}>
          <planeGeometry args={[w, j === 0 ? 0.07 : 0.045]} />
          <meshBasicMaterial color={j === 0 ? (c.done ? palette.ink3 : palette.ink) : palette.ink3} transparent opacity={j === 0 ? 0.9 : 0.6} />
        </mesh>
      ))}
      {c.done && (
        <mesh position={[-0.68 + c.lines[0] / 2, 0.08, 0.037]}>
          <planeGeometry args={[c.lines[0] + 0.04, 0.012]} />
          <meshBasicMaterial color={palette.ink} />
        </mesh>
      )}
    </group>
  );
}

function Clock({ palette, inputs }: { palette: Palette; inputs: SceneInputs }) {
  const group = useRef<THREE.Group>(null);
  const hour = useRef<THREE.Mesh>(null);
  const minute = useRef<THREE.Mesh>(null);
  const { invalidate } = useThree();

  useEffect(() => {
    const id = setInterval(invalidate, 20_000); // the minute hand moves; redraw now and then
    return () => clearInterval(id);
  }, [invalidate]);

  useFrame((_, dt) => {
    const now = new Date();
    const m = now.getMinutes() + now.getSeconds() / 60;
    const h = (now.getHours() % 12) + m / 60;
    if (minute.current) minute.current.rotation.z = -(m / 60) * Math.PI * 2;
    if (hour.current) hour.current.rotation.z = -(h / 12) * Math.PI * 2;
    const g = group.current;
    if (!g) return;
    const p = inputs.progress.current;
    const k = 1 - Math.exp(-dt * 6);
    const tx = THREE.MathUtils.lerp(1.55, 2.1, p);
    const ty = THREE.MathUtils.lerp(-0.55, 0.2, p);
    g.position.x += (tx - g.position.x) * k;
    g.position.y += (ty - g.position.y) * k;
    if (Math.abs(tx - g.position.x) + Math.abs(ty - g.position.y) > 0.001) invalidate();
  });

  return (
    <group ref={group} position={[1.55, -0.55, 0.35]} rotation={[0, -0.35, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.62, 0.62, 0.16, 64]} />
        <meshStandardMaterial color={palette.ink} roughness={0.5} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0, 0.081]}>
        <circleGeometry args={[0.55, 64]} />
        <meshStandardMaterial color={palette.raised} roughness={0.9} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[Math.sin((i / 12) * Math.PI * 2) * 0.46, Math.cos((i / 12) * Math.PI * 2) * 0.46, 0.085]} rotation={[0, 0, -(i / 12) * Math.PI * 2]}>
          <planeGeometry args={[i % 3 === 0 ? 0.03 : 0.018, i % 3 === 0 ? 0.09 : 0.05]} />
          <meshBasicMaterial color={palette.ink3} />
        </mesh>
      ))}
      <mesh ref={hour} position={[0, 0, 0.09]}>
        <planeGeometry args={[0.035, 0.26]} />
        <meshBasicMaterial color={palette.ink} />
      </mesh>
      <mesh ref={minute} position={[0, 0, 0.092]}>
        <planeGeometry args={[0.022, 0.4]} />
        <meshBasicMaterial color={palette.accent} />
      </mesh>
      <mesh position={[0, 0, 0.095]}>
        <circleGeometry args={[0.03, 24]} />
        <meshBasicMaterial color={palette.accent} />
      </mesh>
    </group>
  );
}

function Rig({ inputs, children }: { inputs: SceneInputs; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const { invalidate } = useThree();
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const k = 1 - Math.exp(-dt * 5);
    const tx = inputs.pointer.current.y * 0.12;
    const ty = inputs.pointer.current.x * 0.18 - 0.12;
    g.rotation.x += (tx - g.rotation.x) * k;
    g.rotation.y += (ty - g.rotation.y) * k;
    if (Math.abs(tx - g.rotation.x) + Math.abs(ty - g.rotation.y) > 0.0005) invalidate();
  });
  return <group ref={ref}>{children}</group>;
}

/** Invalidate on outside input, so on-demand rendering wakes up. */
function Wake({ inputs }: { inputs: SceneInputs }) {
  const { invalidate } = useThree();
  useEffect(() => {
    const on = () => invalidate();
    window.addEventListener("pointermove", on, { passive: true });
    window.addEventListener("scroll", on, { passive: true });
    return () => {
      window.removeEventListener("pointermove", on);
      window.removeEventListener("scroll", on);
    };
  }, [invalidate, inputs]);
  return null;
}

export default function HeroScene({ inputs, onReady }: { inputs: SceneInputs; onReady: () => void }) {
  const [palette, setPalette] = useState<Palette | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setPalette(readPalette());
    // Re-read colors when the theme flips.
    const mo = new MutationObserver(() => setPalette(readPalette()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting && !document.hidden));
    if (wrap.current) io.observe(wrap.current);
    const vis = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", vis);
    return () => {
      mo.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  const shadowColor = useMemo(() => (palette ? palette.ink : "#000"), [palette]);
  if (!palette) return <div ref={wrap} className="size-full" />;

  return (
    <div ref={wrap} className="size-full">
      <Canvas
        frameloop={visible ? "demand" : "never"}
        dpr={[1, 1.75]}
        shadows
        camera={{ position: [0, 0.4, 8.1], fov: 32 }}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        onCreated={() => requestAnimationFrame(onReady)}
        aria-hidden
      >
        {/* Bright, soft fill: the cards should read as the same paper as the poster they replace. */}
        <ambientLight intensity={1.6} />
        <hemisphereLight args={["#ffffff", shadowColor, 0.5]} />
        <directionalLight position={[3, 5, 4]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
        <Rig inputs={inputs}>
          {CARDS.map((_, i) => (
            <Card key={i} i={i} palette={palette} inputs={inputs} />
          ))}
          <Clock palette={palette} inputs={inputs} />
        </Rig>
        <ContactShadows position={[0, -1.55, 0]} opacity={0.32} scale={9} blur={2.6} far={3.5} color={shadowColor} frames={1} />
        <Wake inputs={inputs} />
      </Canvas>
    </div>
  );
}
