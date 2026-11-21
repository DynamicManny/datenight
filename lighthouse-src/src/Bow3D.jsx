import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// The Captain's view off the bow. Everything that moves every frame is read from
// the `view` ref, so React never re-renders the scene during play.
import { S, TOWER } from './geo.js';
const SEA = 64;

function Ocean({ view }) {
  const mesh = useRef();
  const geo = useMemo(() => { const g = new THREE.PlaneGeometry(260, 260, SEA, SEA); g.rotateX(-Math.PI / 2); return g; }, []);
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array), [geo]);
  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime, v = view.current, amp = v.mode === 'storm' ? 1.5 : 0.45;
    const m = mesh.current; if (!m) return;
    m.position.x = Math.round(camera.position.x / 4) * 4; m.position.z = Math.round(camera.position.z / 4) * 4;
    const p = geo.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      const x = base[i] + m.position.x, z = base[i + 2] + m.position.z;
      p[i + 1] = Math.sin(x * 0.09 + t * 1.1) * amp + Math.sin(z * 0.13 - t * 1.4) * amp * 0.7 + Math.sin((x + z) * 0.31 + t * 2.1) * amp * 0.25;
    }
    geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
  });
  return (
    <mesh ref={mesh} geometry={geo}>
      <meshStandardMaterial color="#0d2c36" roughness={0.32} metalness={0.15} flatShading />
    </mesh>
  );
}

function Bow({ view }) {
  const g = useRef();
  const deck = useMemo(() => {
    const s = new THREE.Shape(); s.moveTo(-2.1, 0); s.quadraticCurveTo(-1.9, -3.2, 0, -5.2); s.quadraticCurveTo(1.9, -3.2, 2.1, 0); s.lineTo(-2.1, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: false }); geo.rotateX(-Math.PI / 2); return geo;
  }, []);
  const rail = useMemo(() => {
    const pts = []; for (let i = 0; i <= 24; i++) { const u = i / 24, side = u < 0.5 ? -1 : 1, k = u < 0.5 ? u * 2 : (1 - u) * 2; pts.push(new THREE.Vector3(side * 2.05 * (1 - k * 0.98), 0.75, -5.1 * k)); }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);
  useFrame(({ camera }) => { const b = g.current; if (!b) return; b.position.copy(camera.position); b.quaternion.copy(camera.quaternion); b.translateY(-1.95); b.translateZ(-0.4); });
  return (
    <group ref={g}>
      <mesh geometry={deck}><meshStandardMaterial color="#6b4528" emissive="#2a170a" roughness={0.85} /></mesh>
      {[-1.2, -0.4, 0.4, 1.2].map((x) => <mesh key={x} position={[x, 0.36, -2]}><boxGeometry args={[0.04, 0.01, 4]} /><meshBasicMaterial color="#3a2414" /></mesh>)}
      <line geometry={rail}><lineBasicMaterial color="#d9b36a" /></line>
      <mesh position={[0, 0.75, -4.6]}><cylinderGeometry args={[0.03, 0.03, 0.8]} /><meshStandardMaterial color="#3a2a1a" /></mesh>
      <mesh position={[0, 1.2, -4.6]}><sphereGeometry args={[0.07, 10, 10]} /><meshBasicMaterial color="#ffd27a" fog={false} /></mesh>
      <pointLight position={[0, 1.4, -4.2]} color="#ffb24a" intensity={40} distance={14} decay={1.4} />
    </group>
  );
}

function Lighthouse({ view }) {
  const lamp = useRef(), beam = useRef(), beamMat = useRef(), group = useRef();
  const beamGeo = useMemo(() => { const g = new THREE.CylinderGeometry(0.6, 16, 300, 24, 1, true); g.translate(0, 150, 0); g.rotateZ(-Math.PI / 2); return g; }, []);
  useFrame(() => {
    const v = view.current, gr = group.current; if (!gr) return;
    gr.position.set(v.tower.x, 0, v.tower.z);
    const on = v.lightOn ? 1 : 0;
    lamp.current.material.color.set(on ? '#ffe2a0' : '#2a3442');
    beam.current.visible = on > 0 && v.beamVisible !== false;
    beam.current.rotation.y = -v.beamYaw;
    beamMat.current.opacity = v.mode === 'fog' ? 0.22 : 0.16;
  });
  return (
    <group ref={group}>
      <mesh position={[0, -2, 0]}><coneGeometry args={[12, 8, 7]} /><meshStandardMaterial color="#141b20" flatShading /></mesh>
      <mesh position={[0, 12, 0]}><cylinderGeometry args={[1.6, 2.4, 24, 16]} /><meshStandardMaterial color="#e9e4d8" roughness={0.9} /></mesh>
      {[6, 14].map((y) => <mesh key={y} position={[0, y, 0]}><cylinderGeometry args={[1.95 - y * 0.02, 2.1 - y * 0.02, 3, 16]} /><meshStandardMaterial color="#b8322a" /></mesh>)}
      <mesh ref={lamp} position={[0, 25.6, 0]}><cylinderGeometry args={[1.3, 1.3, 2.6, 12]} /><meshBasicMaterial color="#2a3442" fog={false} /></mesh>
      <mesh position={[0, 27.8, 0]}><coneGeometry args={[1.8, 2, 12]} /><meshStandardMaterial color="#1a2129" /></mesh>
      <mesh ref={beam} geometry={beamGeo} position={[0, 25.6, 0]}>
        <meshBasicMaterial ref={beamMat} color="#ffd98a" transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} fog={false} />
      </mesh>
    </group>
  );
}

function Hazards({ layout }) {
  const items = useMemo(() => {
    if (!layout) return [];
    const out = [];
    let seed = 7;
    const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    layout.cells.forEach((row, y) => row.forEach((c, x) => {
      const px = (x + 0.5) * S, pz = (y + 0.5) * S;
      if (c === 'r') out.push({ k: 'rock', px: px + (r() - 0.5) * 3, pz: pz + (r() - 0.5) * 3, s: 3.6 + r() * 1.8, rot: r() * 6 });
      else if (c === 'boat') out.push({ k: 'boat', px, pz, rot: r() * 6 });
      else if (c === 'p') out.push({ k: 'pier', px, pz });
      else if (c === 'g') out.push({ k: 'gate', px, pz });
      else if (c === 'b') out.push({ k: 'berth', px, pz });
    }));
    return out;
  }, [layout]);
  return items.map((it, i) => {
    if (it.k === 'rock') return <mesh key={i} position={[it.px, 0.4, it.pz]} rotation={[it.rot, it.rot * 2, 0]} scale={[it.s, it.s * 0.75, it.s]}><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#1c2327" flatShading roughness={1} /></mesh>;
    if (it.k === 'boat') return (
      <group key={i} position={[it.px, 0.3, it.pz]} rotation={[0, it.rot, 0]}>
        <mesh><boxGeometry args={[2.6, 1.4, 7]} /><meshStandardMaterial color="#3b2f28" flatShading /></mesh>
        <mesh position={[0, 4, 0]}><cylinderGeometry args={[0.12, 0.12, 7]} /><meshStandardMaterial color="#5a4a3a" /></mesh>
        <mesh position={[0, 7.6, 0]}><sphereGeometry args={[0.2, 8, 8]} /><meshBasicMaterial color="#ffcf7a" /></mesh>
      </group>
    );
    if (it.k === 'pier') return <mesh key={i} position={[it.px, 1.2, it.pz - 1]}><boxGeometry args={[S, 2.4, S * 0.8]} /><meshStandardMaterial color="#2c241e" /></mesh>;
    if (it.k === 'gate') return (
      <group key={i}>
        <mesh position={[it.px - 4.2, 1, it.pz]}><coneGeometry args={[0.9, 3, 8]} /><meshStandardMaterial color="#d8362a" emissive="#d8362a" emissiveIntensity={0.6} /></mesh>
        <mesh position={[it.px + 4.2, 1, it.pz]}><cylinderGeometry args={[0.8, 0.8, 3, 8]} /><meshStandardMaterial color="#2f9e5b" emissive="#2f9e5b" emissiveIntensity={0.6} /></mesh>
      </group>
    );
    return <mesh key={i} position={[it.px, 2.4, it.pz - 3.6]}><sphereGeometry args={[0.35, 8, 8]} /><meshBasicMaterial color="#ffd98a" /></mesh>;
  });
}

function Rain({ view }) {
  const N = 500;
  const geo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3)); return g; }, []);
  const drops = useMemo(() => Array.from({ length: N }, () => [Math.random() * 40 - 20, Math.random() * 18, Math.random() * 40 - 20]), []);
  const mat = useRef();
  useFrame(({ camera }, dt) => {
    const v = view.current, heavy = v.mode === 'storm' ? 1 : 0.25, p = geo.attributes.position.array;
    mat.current.opacity = 0.35 * heavy;
    for (let i = 0; i < N; i++) {
      const d = drops[i]; d[1] -= dt * 22; d[0] += dt * 5 * heavy; if (d[1] < 0) { d[1] = 18; d[0] = Math.random() * 40 - 20; d[2] = Math.random() * 40 - 20; }
      const x = camera.position.x + d[0], z = camera.position.z + d[2];
      p.set([x, d[1], z, x - 0.25 * heavy, d[1] + 1.1, z], i * 6);
    }
    geo.attributes.position.needsUpdate = true;
  });
  return <lineSegments geometry={geo}><lineBasicMaterial ref={mat} color="#b9c9d8" transparent opacity={0.3} /></lineSegments>;
}

function Rig({ view, glareRef }) {
  const { camera, scene } = useThree();
  const amb = useRef(), flash = useRef(0), dens = useRef(0.02);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime, v = view.current;
    const storm = v.mode === 'storm';
    const pitch = Math.sin(t * 0.9) * (storm ? 0.06 : 0.02), sway = Math.sin(t * 0.7 + 1) * (storm ? 0.05 : 0.015);
    camera.rotation.order = 'YXZ';
    if (storm) { camera.position.set(0, 2.4 + Math.sin(t * 1.1) * 0.5, 0); camera.rotation.set(pitch, THREE.MathUtils.degToRad(-v.yawDeg), sway + THREE.MathUtils.degToRad(v.yawDeg * 0.25)); }
    else { camera.position.set(v.ship.x * S, 2.4 + Math.sin(t * 1.1) * 0.15, v.ship.y * S); camera.rotation.set(pitch, -v.ship.h, sway); }

    // fog: her beam on you, or a flare, pushes it back
    let target = storm ? 0.014 : 0.08;
    let glare = 0;
    if (v.lightOn) {
      const dx = camera.position.x - v.tower.x, dz = camera.position.z - v.tower.z;
      const toShip = Math.atan2(dz, dx);
      let d = toShip - v.beamYaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      const deg = Math.abs(THREE.MathUtils.radToDeg(d));
      glare = Math.max(0, 1 - deg / 9);
      if (!storm && deg < 9) target = 0.04;
    }
    if (v.flareUntil && performance.now() < v.flareUntil) target = 0.016;
    dens.current += (target - dens.current) * Math.min(1, dt * 2);
    scene.fog.density = dens.current;
    if (glareRef.current) glareRef.current.style.opacity = String(storm ? glare : glare * 0.5);

    if (storm && Math.random() < dt * 0.07) flash.current = 1;
    flash.current = Math.max(0, flash.current - dt * 3);
    amb.current.intensity = (storm ? 0.35 : 0.55) + flash.current * 3;
  });
  return <ambientLight ref={amb} intensity={0.4} color="#9fb4c8" />;
}

export default function Bow3D({ view, layout, glareRef }) {
  return (
    <Canvas className="bow3d" dpr={[1, 1.75]} camera={{ fov: 64, near: 0.1, far: 700, position: [0, 2.4, 0] }} gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl, scene }) => { gl.setClearColor('#0a1820'); scene.background = new THREE.Color('#0a1820'); }}>
      <fogExp2 attach="fog" args={['#0f2028', 0.02]} />
      <directionalLight position={[-40, 60, -30]} intensity={0.9} color="#c4d4e4" />
      <Rig view={view} glareRef={glareRef} />
      <Ocean view={view} />
      <Rain view={view} />
      <Lighthouse view={view} />
      <Hazards layout={layout} />
      <Bow view={view} />
    </Canvas>
  );
}

