import { useState, useMemo, useRef, useEffect, Dispatch, SetStateAction } from 'react';
import { Link } from 'react-router-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { MapControls, Html, Text } from '@react-three/drei';
import * as THREE from 'three';
import { getArmchairTexture } from './ArmchairTexture';

const SPACING = 1.2;
const seatData: { id: string; x: number; y: number }[] = [];
let yCursor = 15;
const sections = [
  { rows: 10, startRow: 22 },
  { rows: 9, startRow: 12 },
  { rows: 3, startRow: 3 },
];

sections.forEach((section) => {
  for (let i = 0; i < section.rows; i++) {
    const rowNum = section.startRow - i;
    let xCursor = -16;
    let seatNum = 1;
    // Left 7
    for (let c = 0; c < 7; c++) {
      seatData.push({ id: `R${rowNum}-S${seatNum++}`, x: xCursor, y: yCursor });
      xCursor += SPACING;
    }
    xCursor += SPACING * 1.5;
    // Center 12
    for (let c = 0; c < 12; c++) {
      seatData.push({ id: `R${rowNum}-S${seatNum++}`, x: xCursor, y: yCursor });
      xCursor += SPACING;
    }
    xCursor += SPACING * 1.5;
    // Right 7
    for (let c = 0; c < 7; c++) {
      seatData.push({ id: `R${rowNum}-S${seatNum++}`, x: xCursor, y: yCursor });
      xCursor += SPACING;
    }
    yCursor -= SPACING;
  }
  yCursor -= SPACING * 1.5; // Gap between sections
});

const dummy = new THREE.Object3D();
const colorUnselected = new THREE.Color('#a1a1aa');
const colorHover = new THREE.Color('#e4e4e7');
const colorSelected = new THREE.Color('#3b82f6');

interface SeatsInstancedProps {
  selected: Set<number>;
  setSelected: Dispatch<SetStateAction<Set<number>>>;
}

function SeatsInstanced({ selected, setSelected }: SeatsInstancedProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const texture = useMemo(() => getArmchairTexture(), []);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    if (!meshRef.current) return;
    seatData.forEach((seat, i) => {
      dummy.position.set(seat.x, seat.y, 0);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
      
      let c = colorUnselected;
      if (selected.has(i)) c = colorSelected;
      else if (hovered === i) c = colorHover;
      
      meshRef.current!.setColorAt(i, c);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [hovered, selected]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, seatData.length]}
      onPointerMove={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined) {
          setHovered(e.instanceId);
          document.body.style.cursor = 'pointer';
        }
      }}
      onPointerOut={() => {
        setHovered(null);
        document.body.style.cursor = 'auto';
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined) {
          setSelected(prev => {
            const next = new Set(prev);
            if (next.has(e.instanceId!)) next.delete(e.instanceId!);
            else next.add(e.instanceId!);
            return next;
          });
        }
      }}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture!} transparent depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

function StageArea() {
  return (
    <group position={[0, -20, 0]}>
      {/* Screen */}
      <group position={[0, 4, 0]}>
        <mesh>
          <planeGeometry args={[10, 6]} />
          <meshBasicMaterial color="#1c1c1e" />
        </mesh>
        <Text position={[0, 0, 0.1]} fontSize={1} color="#86868b" letterSpacing={0.2}>
          SCREEN
        </Text>
      </group>
      
      {/* Stage */}
      <mesh position={[0, -2, 0]}>
        <boxGeometry args={[40, 4, 1]} />
        <meshBasicMaterial color="#2e2e33" />
      </mesh>
      <mesh position={[0, -1.8, 0.51]}>
        <planeGeometry args={[36, 3]} />
        <meshBasicMaterial color="#0b0b0d" />
      </mesh>
      <Text position={[0, -1.8, 0.52]} fontSize={1.5} color="#d6d6db" letterSpacing={0.4}>
        STAGE
      </Text>
    </group>
  );
}

function Counter3D({ selectedCount }: { selectedCount: number }) {
  return (
    <group position={[24, 0, 0]}>
      <Text position={[0, 1.5, 0]} fontSize={1} color="#86868b" letterSpacing={0.1} anchorX="left">
        RESERVED SEATS
      </Text>
      <Text position={[0, -1, 0]} fontSize={4} color={selectedCount > 0 ? "#3b82f6" : "#ffffff"} anchorX="left">
        {selectedCount}
      </Text>
      <Text position={[3 + (selectedCount > 9 ? 1.5 : 0), -1, 0]} fontSize={4} color="#86868b" anchorX="left">
        / 20
      </Text>
    </group>
  );
}

export default function SeatingLayout() {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  return (
    <div 
      className="w-full h-[100vh] bg-[#0b0b0d] relative overflow-hidden"
      style={{ fontFamily: "'Objectivity', sans-serif" }}
    >
      
      {/* Native DOM Header Overlay */}
      <header className="absolute top-0 left-0 w-full z-50 flex items-center justify-between px-8 py-6 pointer-events-none bg-[#0b0b0d]/80 backdrop-blur-md border-b border-[#2e2e33]">
        
        {/* Left: OSC Logo */}
        <div className="flex items-center flex-1 pointer-events-auto">
          <img
            src="/events/gittyup26/osc-lockup.webp"
            alt="Open Source Community"
            className="h-8 md:h-10 w-auto opacity-90 drop-shadow-lg"
          />
        </div>

        {/* Center: Title */}
        <div className="flex flex-col items-center justify-center flex-1 pointer-events-auto">
          <div className="text-[#86868b] text-sm md:text-base font-normal">
            Seat Reservations <span className="opacity-50 mx-2">|</span> AB-2 Audi
          </div>
        </div>

        {/* Right: Gitty Up */}
        <div className="flex items-center justify-end flex-1 pointer-events-auto">
          <Link to="/gittyup26" className="text-white text-[1.5rem] md:text-[2rem] tracking-[-0.015em] opacity-90 hover:opacity-100 transition-opacity drop-shadow-lg select-none flex items-baseline">
            <span className="font-thin">gitty</span>
            <span className="font-black" style={{ marginLeft: '0.36em' }}>up</span>
          </Link>
        </div>
      </header>

      {/* WebGL Scene */}
      <Canvas camera={{ position: [0, 0, 30], fov: 45 }}>
        <color attach="background" args={['#0b0b0d']} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={1} />
        
        <MapControls 
          enableRotate={false} 
          enableDamping={true}
          minDistance={10}
          maxDistance={50}
        />
        
        <SeatsInstanced selected={selected} setSelected={setSelected} />
        <StageArea />
        <Counter3D selectedCount={selected.size} />
      </Canvas>
    </div>
  );
}
