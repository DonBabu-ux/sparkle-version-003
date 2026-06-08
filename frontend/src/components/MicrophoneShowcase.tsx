import React, { Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Float, Html as DreiHtml } from '@react-three/drei';
import * as THREE from 'three';

// Helper to create a simple 3D microphone
function Microphone() {
  return (
    <group>
      {/* Mic base - cylinder */}
      <mesh position={[0, -0.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.8, 32]} />
        <meshStandardMaterial color="#ff008a" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Mic head - sphere */}
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.2, 32, 32]} />
        <meshStandardMaterial color="#ff66c4" metalness={0.8} roughness={0.25} />
      </mesh>
    </group>
  );
}

// Simple gift placeholder using box geometry
function Gift({ position, scale = 0.3, color = '#ff008a' }) {
  return (
    <mesh position={position} scale={scale} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
    </mesh>
  );
}

// Orbit ring visualiser (torus)
function OrbitRing({ radius = 2, speed = 0.01, clockwise = true }) {
  const ref = React.useRef();
  useFrame(() => {
    if (ref.current) {
      ref.current.rotation.y += speed * (clockwise ? 1 : -1);
    }
  });
  return (
    <mesh ref={ref} rotation-x={Math.PI / 2}>
      <torusGeometry args={[radius, 0.02, 16, 100]} />
      <meshBasicMaterial color="#ff008a" transparent opacity={0.5} />
    </mesh>
  );
}

// Floating label attached to microphone
function FloatingLabel({ text, position = [0, 0, 0] }) {
  return (
    <Html position={position} style={{ pointerEvents: 'none' }} center>
      <div style={{
        color: '#fff',
        fontFamily: 'Outfit, sans-serif',
        fontSize: '0.6rem',
        textShadow: '0 0 6px #ff008a',
        whiteSpace: 'nowrap',
        background: 'rgba(0,0,0,0.25)',
        padding: '2px 6px',
        borderRadius: '4px',
      }}>{text}</div>
    </Html>
  );
}

export default function MicrophoneShowcase() {
  // Define positions for gifts on two rings
  const giftsRing1 = useMemo(() => {
    const items = [];
    const types = ['diamond', 'rose', 'gift', 'coin', 'crown', 'rocket', 'trophy', 'music'];
    const radius = 2.2;
    const count = types.length;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      items.push({
        position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius],
        color: '#ff66c4',
      });
    }
    return items;
  }, []);

  const giftsRing2 = useMemo(() => {
    const items = [];
    const radius = 1.5;
    const count = 5;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      items.push({
        position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius],
        color: '#ff008a',
      });
    }
    return items;
  }, []);

  return (
    <div className="w-full h-96 md:h-[480px]">
      <Canvas camera={{ position: [0, 1, 5], fov: 45 }} shadows>
        <Suspense fallback={null}>
          {/* Ambient lighting */}
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} castShadow />
          {/* Rotating rings */}
          <OrbitRing radius={2.2} speed={0.003} clockwise={true} />
          <OrbitRing radius={1.5} speed={0.0045} clockwise={false} />
          {/* Microphone centre */}
          <Float speed={1.5} rotationIntensity={0.2} floatingRange={[-0.2, 0.2]}>
            <Microphone />
          </Float>
          {/* Gifts on rings */}
          {giftsRing1.map((gift, i) => (
            <Gift key={i} position={gift.position} color={gift.color} />
          ))}
          {giftsRing2.map((gift, i) => (
            <Gift key={i} position={gift.position} scale={0.25} color={gift.color} />
          ))}
          {/* Labels */}
          <FloatingLabel text="LIVE" position={[0, 1.2, 0]} />
          <FloatingLabel text="GIFTS" position={[0, -1.2, 0]} />
          <FloatingLabel text="DISCOVERY" position={[1.8, 0, 0]} />
          <FloatingLabel text="AUDIENCE" position={[-1.8, 0, 0]} />
          <FloatingLabel text="COMMUNITY" position={[0, 0, 1.8]} />
          <FloatingLabel text="TOOLS" position={[0, 0, -1.8]} />
          {/* Controls (optional) */}
          <OrbitControls enableZoom={false} enablePan={false} />
        </Suspense>
      </Canvas>
    </div>
  );
}
