import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { S } from './geo.js';
import { ROCK_R } from './sim.js';

// The Captain's view off the bow. Everything that moves every frame is read from
// the `view` ref, so React never re-renders the scene during play.
const SEA = 72;
const DEEP = new THREE.Color('#0b2832'), MID = new THREE.Color('#14414d'), FOAM = new THREE.Color('#cfe3e2');

function Sky({ view }) {
  const mesh = useRef();
  const uniforms = useMemo(() => ({ uTop: { value: new THREE.Color('#050b14') }, uHorizon: { value: new THREE.Color('#1d3a4c') }, uFlash: { value: 0 }, uFog: { value: 0 } }), []);
  useFrame(({ camera }) => {
    const v = view.current, m = mesh.current; if (!m) return;
    m.material.uniforms.uFlash.value = v.flash || 0;
    m.material.uniforms.uFog.value = v.mode === 'fog' ? 1 : 0;
    m.position.copy(camera.position);
  });
  return (
    <mesh ref={mesh} scale={500}>
      <sphereGeometry args={[1, 32, 16]} />
      <shaderMaterial side={THREE.BackSide} depthWrite={false} fog={false} uniforms={uniforms}
        vertexShader={'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'}
        fragmentShader={`uniform vec3 uTop; uniform vec3 uHorizon; uniform float uFlash; uniform float uFog; varying vec3 vP;
          void main(){ float h = clamp(vP.y * 1.6, 0.0, 1.0); vec3 c = mix(uHorizon, uTop, pow(h, 0.6));
          c = mix(c, vec3(0.42,0.5,0.55), uFog * (1.0 - h) * 0.7);
          c += vec3(0.55,0.62,0.8) * uFlash * (0.4 + 0.6 * h);
          gl_FragColor = vec4(c, 1.0); }`} />
    </mesh>
  );
}

function Ocean({ view }) {
  const mesh = useRef();
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(300, 300, SEA, SEA); g.rotateX(-Math.PI / 2);
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
    return g;
  }, []);
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array), [geo]);
  const tmp = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime, v = view.current, amp = v.mode === 'storm' ? 1.6 : 0.5;
    const m = mesh.current; if (!m) return;
    m.position.x = Math.round(camera.position.x / 4) * 4; m.position.z = Math.round(camera.position.z / 4) * 4;
    const p = geo.attributes.position.array, col = geo.attributes.color.array;
    for (let i = 0; i < p.length; i += 3) {
      const x = base[i] + m.position.x, z = base[i + 2] + m.position.z;
      const y = Math.sin(x * 0.09 + t * 1.1) * amp + Math.sin(z * 0.13 - t * 1.4) * amp * 0.7 + Math.sin((x + z) * 0.31 + t * 2.1) * amp * 0.28;
      p[i + 1] = y;
      const crest = Math.max(0, (y / amp - 1.0) / 0.9);
      tmp.copy(DEEP).lerp(MID, Math.min(1, (y / amp + 1.6) / 3)).lerp(FOAM, Math.min(1, crest * crest * 1.4));
      col[i] = tmp.r; col[i + 1] = tmp.g; col[i + 2] = tmp.b;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; geo.computeVertexNormals();
  });
  return (
    <mesh ref={mesh} geometry={geo}>
      <meshStandardMaterial vertexColors roughness={0.28} metalness={0.2} flatShading />
    </mesh>
  );
}

function Bow() {
  const g = useRef(), lantern = useRef();
  const deck = useMemo(() => {
    const s = new THREE.Shape(); s.moveTo(-2.2, 0.4); s.quadraticCurveTo(-2.0, -3.2, 0, -5.4); s.quadraticCurveTo(2.0, -3.2, 2.2, 0.4); s.lineTo(-2.2, 0.4);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 }); geo.rotateX(-Math.PI / 2); return geo;
  }, []);
  const railPts = useMemo(() => { const pts = []; for (let i = 0; i <= 30; i++) { const u = i / 30, side = u < 0.5 ? -1 : 1, k = u < 0.5 ? u * 2 : (1 - u) * 2; pts.push([side * 2.1 * (1 - k * 0.98), -5.3 * k]); } return pts; }, []);
  const rail = useMemo(() => new THREE.BufferGeometry().setFromPoints(railPts.map(([x, z]) => new THREE.Vector3(x, 1.0, z))), [railPts]);
  useFrame(({ camera, clock }) => {
    const b = g.current; if (!b) return;
    b.position.copy(camera.position); b.quaternion.copy(camera.quaternion); b.translateY(-1.95); b.translateZ(-0.3);
    if (lantern.current) lantern.current.intensity = 30 + Math.sin(clock.elapsedTime * 9) * 4 + Math.sin(clock.elapsedTime * 23) * 2;
  });
  return (
    <group ref={g}>
      <mesh geometry={deck}><meshStandardMaterial color="#7a5030" emissive="#24140a" roughness={0.8} /></mesh>
      {[-1.4, -0.7, 0, 0.7, 1.4].map((x) => <mesh key={x} position={[x, 0.44, -1.8]}><boxGeometry args={[0.03, 0.005, 3.6]} /><meshBasicMaterial color="#3a2414" /></mesh>)}
      <line geometry={rail}><lineBasicMaterial color="#e1bd72" /></line>
      {railPts.filter((_, i) => i % 3 === 0).map(([x, z], i) => <mesh key={i} position={[x, 0.7, z]}><cylinderGeometry args={[0.035, 0.035, 0.6]} /><meshStandardMaterial color="#b98c3e" metalness={0.6} roughness={0.4} /></mesh>)}
      <mesh position={[-1.1, 0.55, -0.9]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.35, 0.09, 8, 20]} /><meshStandardMaterial color="#c9b48a" roughness={1} /></mesh>
      <mesh position={[0, 0.85, -4.7]}><cylinderGeometry args={[0.04, 0.05, 0.9]} /><meshStandardMaterial color="#2e2216" /></mesh>
      <mesh position={[0, 1.34, -4.7]}><boxGeometry args={[0.16, 0.2, 0.16]} /><meshBasicMaterial color="#ffd27a" fog={false} /></mesh>
      <pointLight ref={lantern} position={[0, 1.5, -4.4]} color="#ffb24a" intensity={30} distance={16} decay={1.3} />
    </group>
  );
}

function Lighthouse({ view }) {
  const lamp = useRef(), beam = useRef(), halo = useRef(), group = useRef();
  const beamGeo = useMemo(() => { const g = new THREE.CylinderGeometry(0.6, 16, 300, 24, 1, true); g.translate(0, 150, 0); g.rotateZ(-Math.PI / 2); return g; }, []);
  const haloGeo = useMemo(() => { const g = new THREE.CylinderGeometry(0.4, 34, 300, 24, 1, true); g.translate(0, 150, 0); g.rotateZ(-Math.PI / 2); return g; }, []);
  useFrame(() => {
    const v = view.current, gr = group.current; if (!gr) return;
    gr.position.set(v.tower.x, 0, v.tower.z);
    const on = !!v.lightOn;
    lamp.current.material.color.set(on ? '#fff0c2' : '#2a3442');
    const show = on && v.beamVisible !== false;
    beam.current.visible = show; halo.current.visible = show;
    beam.current.rotation.y = -v.beamYaw; halo.current.rotation.y = -v.beamYaw;
  });
  return (
    <group ref={group}>
      <mesh position={[0, -2, 0]}><coneGeometry args={[13, 8, 9]} /><meshStandardMaterial color="#161e23" flatShading /></mesh>
      <mesh position={[0, 12, 0]}><cylinderGeometry args={[1.6, 2.4, 24, 18]} /><meshStandardMaterial color="#ece6da" roughness={0.9} /></mesh>
      {[6, 14].map((y) => <mesh key={y} position={[0, y, 0]}><cylinderGeometry args={[1.95 - y * 0.02, 2.1 - y * 0.02, 3, 18]} /><meshStandardMaterial color="#c0352b" /></mesh>)}
      <mesh position={[0, 24.2, 0]}><cylinderGeometry args={[2.1, 2.1, 0.4, 18]} /><meshStandardMaterial color="#1a2129" /></mesh>
      <mesh ref={lamp} position={[0, 25.8, 0]}><cylinderGeometry args={[1.3, 1.3, 2.8, 14]} /><meshBasicMaterial color="#2a3442" fog={false} /></mesh>
      <mesh position={[0, 28, 0]}><coneGeometry args={[1.9, 2.2, 14]} /><meshStandardMaterial color="#1a2129" /></mesh>
      <mesh ref={halo} geometry={haloGeo} position={[0, 25.8, 0]}><meshBasicMaterial color="#ffd98a" transparent opacity={0.06} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} fog={false} /></mesh>
      <mesh ref={beam} geometry={beamGeo} position={[0, 25.8, 0]}><meshBasicMaterial color="#ffe2a0" transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} fog={false} /></mesh>
    </group>
  );
}

function Foam({ r }) {
  const m = useRef(), off = useMemo(() => Math.random() * 6, []);
  useFrame(({ clock }) => { if (m.current) { const k = 1 + Math.sin(clock.elapsedTime * 1.6 + off) * 0.08; m.current.scale.set(k, k, 1); m.current.material.opacity = 0.32 + Math.sin(clock.elapsedTime * 2 + off) * 0.1; } });
  return <mesh ref={m} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]}><ringGeometry args={[r * 0.95, r * 1.35, 28]} /><meshBasicMaterial color="#dfeeee" transparent opacity={0.3} depthWrite={false} /></mesh>;
}
function Blink({ color, period = 2, phase = 0 }) {
  const m = useRef();
  useFrame(({ clock }) => { if (m.current) m.current.visible = ((clock.elapsedTime + phase) % period) < period * 0.35; });
  return <mesh ref={m} position={[0, 3.2, 0]}><sphereGeometry args={[0.45, 10, 10]} /><meshBasicMaterial color={color} /></mesh>;
}

function Hazards({ layout }) {
  const items = useMemo(() => {
    if (!layout) return [];
    const out = [];
    let seed = 7;
    const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    layout.cells.forEach((row, y) => row.forEach((c, x) => {
      const px = (x + 0.5) * S, pz = (y + 0.5) * S;
      if (c === 'r') out.push({ k: 'rock', px, pz, s: ROCK_R * S * (0.9 + r() * 0.15), rot: r() * 6 });
      else if (c === 'boat') out.push({ k: 'boat', px, pz, rot: (r() - 0.5) * 0.6 });
      else if (c === 'p') out.push({ k: 'pier', px, pz });
      else if (c === 'g') out.push({ k: 'gate', px, pz });
      else if (c === 'b') out.push({ k: 'berth', px, pz });
    }));
    return out;
  }, [layout]);
  return items.map((it, i) => {
    if (it.k === 'rock') return (
      <group key={i} position={[it.px, 0, it.pz]}>
        <mesh position={[0, 0.6, 0]} rotation={[it.rot, it.rot * 2, 0]} scale={[it.s, it.s * 0.8, it.s]}><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#232b30" flatShading roughness={1} /></mesh>
        <Foam r={it.s} />
      </group>
    );
    if (it.k === 'boat') return (
      <group key={i} position={[it.px, 0.3, it.pz]} rotation={[0, it.rot, 0]}>
        <mesh><boxGeometry args={[2.4, 1.4, 6.4]} /><meshStandardMaterial color="#4a3a2e" flatShading /></mesh>
        <mesh position={[0, 0.9, 0.6]}><boxGeometry args={[1.6, 0.9, 2]} /><meshStandardMaterial color="#d9d2c2" /></mesh>
        <mesh position={[0, 4, -1]}><cylinderGeometry args={[0.1, 0.1, 7]} /><meshStandardMaterial color="#5a4a3a" /></mesh>
        <mesh position={[0, 7.6, -1]}><sphereGeometry args={[0.2, 8, 8]} /><meshBasicMaterial color="#ffcf7a" /></mesh>
        <Foam r={2.6} />
      </group>
    );
    if (it.k === 'pier') return <mesh key={i} position={[it.px, 1.2, it.pz - 1]}><boxGeometry args={[S, 2.4, S * 0.8]} /><meshStandardMaterial color="#3a2f26" /></mesh>;
    if (it.k === 'gate') return (
      <group key={i}>
        <group position={[it.px - 4.2, 0, it.pz]}><mesh position={[0, 1.2, 0]}><coneGeometry args={[0.9, 3, 8]} /><meshStandardMaterial color="#d8362a" /></mesh><Blink color="#ff5a4d" /></group>
        <group position={[it.px + 4.2, 0, it.pz]}><mesh position={[0, 1.2, 0]}><cylinderGeometry args={[0.8, 0.8, 3, 8]} /><meshStandardMaterial color="#2f9e5b" /></mesh><Blink color="#4fdc8a" phase={1} /></group>
      </group>
    );
    return (
      <group key={i} position={[it.px, 0, it.pz - 4.2]}>
        <mesh position={[3.6, 2.6, 0]}><cylinderGeometry args={[0.12, 0.12, 4]} /><meshStandardMaterial color="#2a2016" /></mesh>
        <mesh position={[3.6, 4.7, 0]}><sphereGeometry args={[0.35, 10, 10]} /><meshBasicMaterial color="#ffd98a" /></mesh>
      </group>
    );
  });
}

function Rain({ view }) {
  const N = 500;
  const geo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3)); return g; }, []);
  const drops = useMemo(() => Array.from({ length: N }, () => [Math.random() * 40 - 20, Math.random() * 18, Math.random() * 40 - 20]), []);
  const mat = useRef();
  useFrame(({ camera }, dt) => {
    const v = view.current, heavy = v.mode === 'storm' ? 1 : 0.2, p = geo.attributes.position.array;
    mat.current.opacity = 0.38 * heavy;
    for (let i = 0; i < N; i++) {
      const d = drops[i]; d[1] -= dt * 22; d[0] += dt * 5 * heavy; if (d[1] < 0) { d[1] = 18; d[0] = Math.random() * 40 - 20; d[2] = Math.random() * 40 - 20; }
      const x = camera.position.x + d[0], z = camera.position.z + d[2];
      p.set([x, d[1], z, x - 0.25 * heavy, d[1] + 1.1, z], i * 6);
    }
    geo.attributes.position.needsUpdate = true;
  });
  return <lineSegments geometry={geo}><lineBasicMaterial ref={mat} color="#c3d3e0" transparent opacity={0.3} /></lineSegments>;
}

/* Spray over the bow when you hit something or a wave breaks */
function Spray({ view }) {
  const N = 160;
  const geo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); return g; }, []);
  const parts = useMemo(() => Array.from({ length: N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0 })), []);
  const seen = useRef(0), mat = useRef();
  useFrame(({ camera }, dt) => {
    const v = view.current;
    if (v.splashAt && v.splashAt !== seen.current) {
      seen.current = v.splashAt;
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize();
      const o = camera.position.clone().addScaledVector(fwd, 5); o.y = 0.6;
      parts.forEach((q) => { q.p.copy(o).add(new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 1.5)); q.v.set((Math.random() - 0.5) * 5, 5 + Math.random() * 6, (Math.random() - 0.5) * 3).addScaledVector(fwd, -4); q.life = 1.4 + Math.random() * 0.6; });
    }
    const arr = geo.attributes.position.array; let alive = 0;
    parts.forEach((q, i) => {
      if (q.life > 0) { q.life -= dt; q.v.y -= 14 * dt; q.p.addScaledVector(q.v, dt); alive++; arr.set([q.p.x, q.p.y, q.p.z], i * 3); }
      else arr.set([0, -999, 0], i * 3);
    });
    geo.attributes.position.needsUpdate = true;
    mat.current.opacity = alive ? 0.85 : 0;
  });
  return <points geometry={geo}><pointsMaterial ref={mat} color="#eaf6f6" size={0.28} transparent opacity={0} depthWrite={false} /></points>;
}

/* Once a night, something big comes up for air next to the ship */
function Whale({ view }) {
  const g = useRef(), spout = useRef();
  useFrame(({ camera }) => {
    const v = view.current, gr = g.current; if (!gr) return;
    const t = v.whaleAt ? (performance.now() - v.whaleAt) / 1000 : -1;
    if (t < 0 || t > 7) { gr.visible = false; gr.userData.placed = false; return; }
    gr.visible = true;
    if (!gr.userData.placed) {
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).setY(0).normalize();
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize();
      gr.position.copy(camera.position).addScaledVector(fwd, 16).addScaledVector(right, 7); gr.position.y = 0;
      gr.rotation.y = Math.atan2(fwd.x, fwd.z) + 1.2; gr.userData.placed = true;
    }
    const rise = Math.sin(Math.min(1, t / 6) * Math.PI);
    gr.children[0].position.y = -2.2 + rise * 2.6;
    gr.children[1].position.y = -2.4 + rise * 2.4 + Math.max(0, t - 4) * 0.9;
    gr.children[1].rotation.x = Math.max(0, t - 3.5) * 0.7;
    spout.current.visible = t > 1.2 && t < 3;
    spout.current.scale.y = 1 + Math.sin(t * 8) * 0.2;
  });
  return (
    <group ref={g} visible={false}>
      <mesh scale={[2.4, 1.1, 7]}><sphereGeometry args={[1, 20, 12]} /><meshStandardMaterial color="#1e2a33" roughness={0.6} /></mesh>
      <group position={[0, -2.4, -7]}><mesh scale={[3.4, 0.25, 1.4]}><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color="#1e2a33" /></mesh></group>
      <mesh ref={spout} position={[0, 2.6, 3]}><coneGeometry args={[0.9, 4, 10, 1, true]} /><meshBasicMaterial color="#e8f4f4" transparent opacity={0.5} depthWrite={false} /></mesh>
    </group>
  );
}

function Rig({ view, glareRef }) {
  const { camera, scene } = useThree();
  const amb = useRef(), flash = useRef(0), dens = useRef(0.02);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime, v = view.current;
    const storm = v.mode === 'storm';
    const hitShake = v.splashAt ? Math.max(0, 1 - (performance.now() - v.splashAt) / 600) : 0;
    const pitch = Math.sin(t * 0.9) * (storm ? 0.06 : 0.02) + hitShake * Math.sin(t * 40) * 0.03;
    const sway = Math.sin(t * 0.7 + 1) * (storm ? 0.05 : 0.015) + hitShake * Math.sin(t * 33) * 0.03;
    camera.rotation.order = 'YXZ';
    if (storm) { camera.position.set(0, 2.4 + Math.sin(t * 1.1) * 0.5, 0); camera.rotation.set(pitch, THREE.MathUtils.degToRad(-v.yawDeg), sway + THREE.MathUtils.degToRad(v.yawDeg * 0.25)); }
    else { camera.position.set(v.ship.x * S, 2.4 + Math.sin(t * 1.1) * 0.15, v.ship.y * S); camera.rotation.set(pitch, -v.ship.h, sway); }

    let target = storm ? 0.012 : 0.075, glare = 0;
    if (v.lightOn) {
      const dx = camera.position.x - v.tower.x, dz = camera.position.z - v.tower.z;
      let d = Math.atan2(dz, dx) - v.beamYaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      const deg = Math.abs(THREE.MathUtils.radToDeg(d));
      glare = Math.max(0, 1 - deg / 9);
      if (!storm && deg < 9) target = 0.038;
    }
    if (v.flareUntil && performance.now() < v.flareUntil) target = 0.015;
    dens.current += (target - dens.current) * Math.min(1, dt * 2);
    scene.fog.density = dens.current;
    if (glareRef.current) glareRef.current.style.opacity = String(storm ? glare : glare * 0.5);

    if (storm && Math.random() < dt * 0.08) flash.current = 1;
    flash.current = Math.max(0, flash.current - dt * 2.8);
    v.flash = flash.current;
    amb.current.intensity = (storm ? 0.35 : 0.6) + flash.current * 3;
  });
  return <ambientLight ref={amb} intensity={0.4} color="#9fb4c8" />;
}

export default function Bow3D({ view, layout, glareRef }) {
  return (
    <Canvas className="bow3d" dpr={[1, 1.75]} camera={{ fov: 64, near: 0.1, far: 900, position: [0, 2.4, 0] }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
      <fogExp2 attach="fog" args={['#12252e', 0.02]} />
      <directionalLight position={[-40, 60, -30]} intensity={1} color="#c4d4e4" />
      <Sky view={view} />
      <Rig view={view} glareRef={glareRef} />
      <Ocean view={view} />
      <Rain view={view} />
      <Spray view={view} />
      <Whale view={view} />
      <Lighthouse view={view} />
      <Hazards layout={layout} />
      <Bow />
    </Canvas>
  );
}
