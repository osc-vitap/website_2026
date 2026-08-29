import { useState, useMemo, useRef, useEffect, useCallback, Dispatch, SetStateAction } from 'react';
import { Link } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { MapControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { getArmchairTexture } from './ArmchairTexture';
import { MAX_SEATS, fetchTakenSeats, seatLabel } from '../data/seatingApi';
import ReserveDialog from '../pages/seating/ReserveDialog';

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

const seatIndexById = new Map(seatData.map((seat, index) => [seat.id, index]));

const dummy = new THREE.Object3D();
const colorUnselected = new THREE.Color('#a1a1aa');
const colorHover = new THREE.Color('#e4e4e7');
const colorSelected = new THREE.Color('#3b82f6');
const colorTaken = new THREE.Color('#4a2a2a');

interface SeatsInstancedProps {
  selected: Set<number>;
  setSelected: Dispatch<SetStateAction<Set<number>>>;
  taken: Set<number>;
  hovered: number | null;
  setHovered: Dispatch<SetStateAction<number | null>>;
  onLimit: () => void;
  onTaken: () => void;
}

function SeatsInstanced({
  selected,
  setSelected,
  taken,
  hovered,
  setHovered,
  onLimit,
  onTaken,
}: SeatsInstancedProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const hoveredRef = useRef<number | null>(null);
  const texture = useMemo(() => getArmchairTexture(), []);

  const colorFor = useCallback(
    (index: number, hover: number | null) => {
      if (taken.has(index)) return colorTaken;
      if (selected.has(index)) return colorSelected;
      if (hover === index) return colorHover;
      return colorUnselected;
    },
    [selected, taken],
  );

  /* Seat positions never move, so the matrices are written once */
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    seatData.forEach((seat, i) => {
      dummy.position.set(seat.x, seat.y, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < seatData.length; i++) {
      mesh.setColorAt(i, colorFor(i, hoveredRef.current));
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [colorFor]);

  /* Only the seat the pointer left and the one it entered are repainted */
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const previous = hoveredRef.current;
    hoveredRef.current = hovered;
    if (previous === hovered) return;
    if (previous !== null) mesh.setColorAt(previous, colorFor(previous, hovered));
    if (hovered !== null) mesh.setColorAt(hovered, colorFor(hovered, hovered));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [hovered, colorFor]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, seatData.length]}
      onPointerMove={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined) {
          setHovered(e.instanceId);
          document.body.style.cursor = taken.has(e.instanceId) ? 'not-allowed' : 'pointer';
        }
      }}
      onPointerOut={() => {
        setHovered(null);
        document.body.style.cursor = 'auto';
      }}
      onClick={(e) => {
        e.stopPropagation();
        const id = e.instanceId;
        if (id === undefined) return;

        if (taken.has(id)) {
          onTaken();
          return;
        }

        if (selected.has(id)) {
          setSelected((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          return;
        }

        if (selected.size >= MAX_SEATS) {
          onLimit();
          return;
        }

        setSelected((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
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
        {` / ${MAX_SEATS}`}
      </Text>
    </group>
  );
}

export default function SeatingLayout() {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [hovered, setHovered] = useState<number | null>(null);
  const [taken, setTaken] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState('');

  /* The dialog keeps the seats it opened with, so refreshing the map
     underneath can never tear it down mid confirmation */
  const [dialogSeatIds, setDialogSeatIds] = useState<string[] | null>(null);

  const pageRef = useRef<HTMLDivElement>(null);
  const reserveButtonRef = useRef<HTMLButtonElement>(null);

  const hoveredSeat = hovered !== null ? seatData[hovered] : null;
  const hoveredTaken = hovered !== null && taken.has(hovered);

  const loadTaken = useCallback(async () => {
    try {
      const ids = await fetchTakenSeats();
      const indexes = new Set(
        ids
          .map((id) => seatIndexById.get(id))
          .filter((index): index is number => index !== undefined),
      );
      setTaken(indexes);
      setSelected((prev) => {
        const next = new Set([...prev].filter((index) => !indexes.has(index)));
        return next.size === prev.size ? prev : next;
      });
    } catch {
      setNotice('Could not load which seats are already taken. Reload to try again.');
    }
  }, []);

  useEffect(() => {
    void loadTaken();
  }, [loadTaken]);

  /* The message replaces itself, so two quick clicks do not
     leave an old one on screen */
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const selectedSeatIds = useMemo(
    () =>
      [...selected]
        .sort((a, b) => a - b)
        .map((index) => seatData[index].id),
    [selected],
  );

  return (
    <div 
      ref={pageRef}
      tabIndex={-1}
      className="w-full h-[100vh] bg-[#0b0b0d] relative overflow-hidden outline-none"
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

      {/* Hover Tooltip Overlay */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 backdrop-blur-md border text-white px-6 py-3 rounded-full font-bold tracking-widest text-sm pointer-events-none z-40 shadow-xl transition-all duration-200 ${
          hoveredTaken
            ? 'bg-[#4a2a2a]/90 border-[#6b3a3a]'
            : 'bg-[#2e2e33]/90 border-[#3e3e44]'
        } ${selected.size > 0 ? 'bottom-32 md:bottom-28' : 'bottom-8'} ${
          hoveredSeat ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        {hoveredSeat
          ? `${seatLabel(hoveredSeat.id).toUpperCase()}${hoveredTaken ? ' | TAKEN' : ''}`
          : 'HOVER A SEAT'}
      </div>

      {/* Inline notice */}
      <div
        aria-live="polite"
        className={`absolute left-1/2 -translate-x-1/2 z-50 max-w-[92vw] rounded-full border border-[#6b3a3a] bg-[#4a2a2a]/95 backdrop-blur-md px-5 py-2.5 text-center text-xs md:text-sm text-[#ffd9db] pointer-events-none shadow-xl transition-all duration-200 ${
          selected.size > 0 ? 'bottom-44 md:bottom-40' : 'bottom-24'
        } ${notice ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
      >
        {notice || ' '}
      </div>

      {/* Selection bar */}
      <div
        className={`absolute bottom-0 left-0 w-full z-50 border-t border-[#2e2e33] bg-[#0b0b0d]/90 backdrop-blur-md px-5 py-4 md:px-8 transition-all duration-200 ${
          selected.size > 0
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-full pointer-events-none'
        }`}
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-[#d6d6db]">
            <span className="font-bold text-white">{selected.size}</span>
            <span className="text-[#86868b]">
              {` of ${MAX_SEATS} ${selected.size === 1 ? 'seat' : 'seats'} selected`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-full border border-[#2e2e33] px-5 py-2.5 text-sm text-[#86868b] transition-colors hover:border-[#3e3e44] hover:text-white"
            >
              Clear
            </button>

            <button
              ref={reserveButtonRef}
              type="button"
              onClick={() => setDialogSeatIds(selectedSeatIds)}
              className="flex-1 rounded-full bg-white px-7 py-2.5 text-sm font-bold text-black transition-transform hover:scale-[1.02] sm:flex-none"
            >
              Reserve
            </button>
          </div>
        </div>
      </div>

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
        
        <SeatsInstanced
          selected={selected}
          setSelected={setSelected}
          taken={taken}
          hovered={hovered}
          setHovered={setHovered}
          onLimit={() => setNotice(`You can reserve at most ${MAX_SEATS} seats at once.`)}
          onTaken={() => setNotice('That seat is already taken.')}
        />
        <StageArea />
        <Counter3D selectedCount={selected.size} />
      </Canvas>

      {dialogSeatIds && dialogSeatIds.length > 0 && (
        <ReserveDialog
          seatIds={dialogSeatIds}
          onClose={() => {
            setDialogSeatIds(null);
            if (selected.size > 0) reserveButtonRef.current?.focus();
            else pageRef.current?.focus();
          }}
          onReserved={() => {
            void loadTaken();
          }}
          onConflict={() => {
            void loadTaken();
          }}
          onDone={() => {
            setSelected(new Set());
            setDialogSeatIds(null);
            pageRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}
