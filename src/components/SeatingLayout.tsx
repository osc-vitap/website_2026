import {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  ElementRef,
  Dispatch,
  SetStateAction,
} from 'react';
import { Link } from 'react-router-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { getArmchairTexture } from './ArmchairTexture';
import { getScreenLabelTexture } from './ScreenLabelTexture';
import {
  MAX_SEATS,
  fetchTakenSeats,
  isTeamSeat,
  seatLabel,
} from '../data/seatingApi';
import ReserveDialog from '../pages/seating/ReserveDialog';

/* Seat blocks across a row and rows in each section, taken from the
   auditorium plan */
const BLOCKS = [7, 12, 7];
const SECTIONS = [10, 9, 3];

const SEAT_PITCH = 1.25;
const AISLE = 4;
const SECTION_GAP = 2.75;

const seatData: { id: string; x: number; y: number }[] = [];

const ROW_WIDTH =
  BLOCKS.reduce(
    (total, count) => total + (count - 1) * SEAT_PITCH,
    0,
  ) +
  AISLE * (BLOCKS.length - 1);

{
  const startX = -ROW_WIDTH / 2;

  let y = 0;
  let topRow = SECTIONS.reduce(
    (total, rows) => total + rows,
    0,
  );

  SECTIONS.forEach((rows, section) => {
    for (let i = 0; i < rows; i += 1) {
      const rowNumber = topRow - i;

      let x = startX;
      let seatNumber = 1;

      BLOCKS.forEach((count, block) => {
        for (let c = 0; c < count; c += 1) {
          seatData.push({
            id: `R${rowNumber}-S${seatNumber}`,
            x,
            y,
          });
          seatNumber += 1;
          x += SEAT_PITCH;
        }

        if (block < BLOCKS.length - 1) {
          x += AISLE - SEAT_PITCH;
        }
      });

      y -= SEAT_PITCH;
    }

    topRow -= rows;

    if (section < SECTIONS.length - 1) {
      y -= SECTION_GAP - SEAT_PITCH;
    }
  });
}

const SEAT_BOTTOM = seatData[seatData.length - 1].y;

const STAGE_TOP = SEAT_BOTTOM - 6.5;
const STAGE_BOTTOM = STAGE_TOP - 8.5;
const STAGE_HALF_WIDTH = ROW_WIDTH / 2 + 5.5;
const STAGE_ARC = 2.2;
const STAGE_RISER = 1.7;

const BOUNDS = {
  minX: -STAGE_HALF_WIDTH,
  maxX: STAGE_HALF_WIDTH,
  minY: STAGE_BOTTOM,
  maxY: 0.75,
};

const CENTER_X = 0;
const CENTER_Y = (BOUNDS.minY + BOUNDS.maxY) / 2;

/* Room kept for the header and the selection bar, so the stage is
   never hidden behind them */
const INSET_TOP = 92;
const INSET_BOTTOM = 108;
const CONTENT_WIDTH = BOUNDS.maxX - BOUNDS.minX;
const CONTENT_HEIGHT = BOUNDS.maxY - BOUNDS.minY;

const seatIndexById = new Map(
  seatData.map((seat, index) => [seat.id, index]),
);

const dummy = new THREE.Object3D();
const colorUnselected = new THREE.Color('#474d5a');
const colorHover = new THREE.Color('#8b93a5');
const colorSelected = new THREE.Color('#3b82f6');
const colorTaken = new THREE.Color('#5a2f33');
const colorTeam = new THREE.Color('#4e3f73');

const teamSeats = new Set(
  seatData
    .map((seat, index) => (isTeamSeat(seat.id) ? index : -1))
    .filter((index) => index >= 0),
);
const scratchColor = new THREE.Color();

/* How quickly a seat settles on its new colour, lower is gentler */
const HOVER_EASE = 6;

interface SeatsInstancedProps {
  selected: Set<number>;
  setSelected: Dispatch<SetStateAction<Set<number>>>;
  taken: Set<number>;
  hovered: number | null;
  setHovered: Dispatch<SetStateAction<number | null>>;
  onLimit: () => void;
  onTaken: () => void;
  onTeam: () => void;
}

function SeatsInstanced({
  selected,
  setSelected,
  taken,
  hovered,
  setHovered,
  onLimit,
  onTaken,
  onTeam,
}: SeatsInstancedProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tint = useRef(
    new Float32Array(seatData.length * 3),
  );
  const texture = useMemo(() => getArmchairTexture(), []);

  const colorFor = useCallback(
    (index: number, hover: number | null) => {
      if (teamSeats.has(index)) return colorTeam;
      if (taken.has(index)) return colorTaken;
      if (selected.has(index)) return colorSelected;
      if (hover === index) return colorHover;
      return colorUnselected;
    },
    [selected, taken],
  );

  /* Seat positions never move, so the matrices and the first colours
     are written once */
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const buffer = tint.current;

    seatData.forEach((seat, i) => {
      dummy.position.set(seat.x, seat.y, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const start = colorFor(i, null);
      mesh.setColorAt(i, start);
      buffer[i * 3] = start.r;
      buffer[i * 3 + 1] = start.g;
      buffer[i * 3 + 2] = start.b;
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Colours ease towards their target instead of snapping, and nothing
     is uploaded once every seat has settled */
  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh?.instanceColor) return;

    const buffer = tint.current;
    const step = 1 - Math.exp(-delta * HOVER_EASE);
    let moving = false;

    for (let i = 0; i < seatData.length; i += 1) {
      const target = colorFor(i, hovered);
      const at = i * 3;

      const dr = target.r - buffer[at];
      const dg = target.g - buffer[at + 1];
      const db = target.b - buffer[at + 2];

      if (
        Math.abs(dr) < 0.0015 &&
        Math.abs(dg) < 0.0015 &&
        Math.abs(db) < 0.0015
      ) {
        if (dr || dg || db) {
          buffer[at] = target.r;
          buffer[at + 1] = target.g;
          buffer[at + 2] = target.b;
          moving = true;
        }
        continue;
      }

      buffer[at] += dr * step;
      buffer[at + 1] += dg * step;
      buffer[at + 2] += db * step;
      moving = true;
    }

    if (!moving) return;

    for (let i = 0; i < seatData.length; i += 1) {
      scratchColor.setRGB(
        buffer[i * 3],
        buffer[i * 3 + 1],
        buffer[i * 3 + 2],
      );
      mesh.setColorAt(i, scratchColor);
    }

    mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, seatData.length]}
      onPointerMove={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined) {
          setHovered(e.instanceId);
          document.body.style.cursor =
            taken.has(e.instanceId) || teamSeats.has(e.instanceId)
              ? 'not-allowed'
              : 'pointer';
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

        if (teamSeats.has(id)) {
          onTeam();
          return;
        }

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

/* The stage front curves towards the room, so the top edge is an arc
   rather than a straight line */
function stageShape(): THREE.Shape {
  const shape = new THREE.Shape();

  shape.moveTo(-STAGE_HALF_WIDTH, STAGE_BOTTOM);
  shape.lineTo(-STAGE_HALF_WIDTH, STAGE_TOP);
  shape.quadraticCurveTo(
    0,
    STAGE_TOP + STAGE_ARC * 2,
    STAGE_HALF_WIDTH,
    STAGE_TOP,
  );
  shape.lineTo(STAGE_HALF_WIDTH, STAGE_BOTTOM);
  shape.closePath();

  return shape;
}

/* A strip that follows the same curve, used for the riser under the
   deck and for the lit edge along its lip */
function stageBand(from: number, to: number): THREE.Shape {
  const shape = new THREE.Shape();

  shape.moveTo(-STAGE_HALF_WIDTH, from);
  shape.quadraticCurveTo(
    0,
    from + STAGE_ARC * 2,
    STAGE_HALF_WIDTH,
    from,
  );
  shape.lineTo(STAGE_HALF_WIDTH, to);
  shape.quadraticCurveTo(
    0,
    to + STAGE_ARC * 2,
    -STAGE_HALF_WIDTH,
    to,
  );
  shape.closePath();

  return shape;
}

const SCREEN_BEZEL = 0.14;
const SCREEN_RADIUS = 0.32;
const SCREEN_BOTTOM = STAGE_BOTTOM + SCREEN_BEZEL;
const SCREEN_TOP = SCREEN_BOTTOM + 2.4;
const SCREEN_HALF_TOP = 14;
const SCREEN_HALF_BOTTOM = 14.65;

/* Corners are cut back along both edges and joined through the old
   point, so the outline has no sharp vertex left */
function roundedShape(
  points: [number, number][],
  radius: number,
): THREE.Shape {
  const shape = new THREE.Shape();
  const count = points.length;

  for (let i = 0; i < count; i += 1) {
    const previous = points[(i - 1 + count) % count];
    const corner = points[i];
    const next = points[(i + 1) % count];

    const toPrevious = [
      previous[0] - corner[0],
      previous[1] - corner[1],
    ];
    const toNext = [
      next[0] - corner[0],
      next[1] - corner[1],
    ];

    const previousLength = Math.hypot(
      toPrevious[0],
      toPrevious[1],
    );
    const nextLength = Math.hypot(toNext[0], toNext[1]);

    const cut = Math.min(
      radius,
      previousLength / 2,
      nextLength / 2,
    );

    const start = [
      corner[0] + (toPrevious[0] / previousLength) * cut,
      corner[1] + (toPrevious[1] / previousLength) * cut,
    ];
    const end = [
      corner[0] + (toNext[0] / nextLength) * cut,
      corner[1] + (toNext[1] / nextLength) * cut,
    ];

    if (i === 0) shape.moveTo(start[0], start[1]);
    else shape.lineTo(start[0], start[1]);

    shape.quadraticCurveTo(
      corner[0],
      corner[1],
      end[0],
      end[1],
    );
  }

  shape.closePath();

  return shape;
}

const SCREEN_TINT_FROM = new THREE.Color('#16255c');
const SCREEN_TINT_TO = new THREE.Color('#5aa2f5');
const SCREEN_TINT_ANGLE = Math.PI / 4;

/* The screen hangs on the back wall at the far end of the stage, so its
   lower edge sits on the wall line */
function screenShape(inset: number): THREE.Shape {
  const bottom = SCREEN_BOTTOM - inset;
  const top = SCREEN_TOP + inset;
  const halfTop = SCREEN_HALF_TOP + inset;
  const halfBottom = SCREEN_HALF_BOTTOM + inset;

  return roundedShape(
    [
      [-halfTop, top],
      [halfTop, top],
      [halfBottom, bottom],
      [-halfBottom, bottom],
    ],
    SCREEN_RADIUS + inset,
  );
}

/* The screen narrows towards the back, so the label is laid on a grid
   that follows the same taper instead of a flat rectangle */
function screenLabelGeometry(): THREE.BufferGeometry {
  const COLS = 32;
  const ROWS = 4;
  const SPREAD = 0.62;
  const MARGIN = 0.2;

  const height = SCREEN_TOP - SCREEN_BOTTOM;
  const bottom = SCREEN_BOTTOM + height * MARGIN;
  const top = SCREEN_TOP - height * MARGIN;

  const halfAt = (y: number) => {
    const t = (y - SCREEN_BOTTOM) / height;
    return (
      SCREEN_HALF_BOTTOM +
      (SCREEN_HALF_TOP - SCREEN_HALF_BOTTOM) * t
    );
  };

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r <= ROWS; r += 1) {
    const v = r / ROWS;
    const y = bottom + (top - bottom) * v;
    const half = halfAt(y) * SPREAD;

    for (let c = 0; c <= COLS; c += 1) {
      const u = c / COLS;
      positions.push((u - 0.5) * 2 * half, y, 0);
      uvs.push(u, v);
    }
  }

  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const a = r * (COLS + 1) + c;
      const b = a + 1;
      const d = a + COLS + 1;
      const e = d + 1;
      indices.push(a, b, d, b, e, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(uvs, 2),
  );
  geometry.setIndex(indices);

  return geometry;
}

/* A flat material cannot fade, so the blue is written onto the corners
   and the triangles blend it across the screen */
function screenGeometry(): THREE.ShapeGeometry {
  const geometry = new THREE.ShapeGeometry(screenShape(0), 24);
  const position = geometry.attributes.position;

  const axisX = Math.cos(SCREEN_TINT_ANGLE);
  const axisY = Math.sin(SCREEN_TINT_ANGLE);

  const along = (index: number) =>
    position.getX(index) * axisX +
    position.getY(index) * axisY;

  let low = Infinity;
  let high = -Infinity;

  for (let i = 0; i < position.count; i += 1) {
    low = Math.min(low, along(i));
    high = Math.max(high, along(i));
  }

  const span = high - low || 1;
  const colors = new Float32Array(position.count * 3);
  const tint = new THREE.Color();

  for (let i = 0; i < position.count; i += 1) {
    tint
      .copy(SCREEN_TINT_FROM)
      .lerp(SCREEN_TINT_TO, (along(i) - low) / span);

    colors[i * 3] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }

  geometry.setAttribute(
    'color',
    new THREE.BufferAttribute(colors, 3),
  );

  return geometry;
}

function StageArea() {
  const stage = useMemo(() => stageShape(), []);
  const riser = useMemo(
    () => stageBand(STAGE_TOP, STAGE_TOP + STAGE_RISER),
    [],
  );
  const lip = useMemo(
    () => stageBand(STAGE_TOP, STAGE_TOP + 0.22),
    [],
  );
  const bezel = useMemo(() => screenShape(SCREEN_BEZEL), []);
  const screen = useMemo(() => screenGeometry(), []);
  const label = useMemo(() => getScreenLabelTexture(), []);
  const labelMesh = useMemo(() => screenLabelGeometry(), []);

  return (
    <group>
      <mesh position={[0, 0, -0.2]}>
        <shapeGeometry args={[stage]} />
        <meshBasicMaterial color="#151517" toneMapped={false} />
      </mesh>

      {/* The riser and the lit lip together read as a step up from the
          floor to the deck */}
      <mesh position={[0, 0, -0.19]}>
        <shapeGeometry args={[riser]} />
        <meshBasicMaterial color="#1e1e23" toneMapped={false} />
      </mesh>

      <mesh position={[0, 0, -0.18]}>
        <shapeGeometry args={[lip]} />
        <meshBasicMaterial color="#4a4a55" toneMapped={false} />
      </mesh>

      <mesh position={[0, 0, -0.1]}>
        <shapeGeometry args={[bezel, 24]} />
        <meshBasicMaterial color="#2e2e33" toneMapped={false} />
      </mesh>

      <mesh geometry={screen}>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </mesh>

      {label && (
        <mesh geometry={labelMesh} position={[0, 0, 0.05]}>
          <meshBasicMaterial
            map={label}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  );
}

export interface ViewApi {
  zoomBy: (factor: number) => void;
  fit: () => void;
}

/* A seat map is a flat drawing, so the camera is orthographic and the
   controls only pan and zoom */
function SceneView({
  apiRef,
}: {
  apiRef: React.MutableRefObject<ViewApi | null>;
}) {
  const controlsRef =
    useRef<ElementRef<typeof OrbitControls>>(null);
  const camera = useThree(
    (state) => state.camera,
  ) as THREE.OrthographicCamera;
  const size = useThree((state) => state.size);
  const touched = useRef(false);

  const usableHeight = Math.max(
    160,
    size.height - INSET_TOP - INSET_BOTTOM,
  );

  const fitZoom = useMemo(() => {
    if (!size.width || !size.height) return 12;

    return Math.min(
      size.width / (CONTENT_WIDTH * 1.12),
      usableHeight / (CONTENT_HEIGHT * 1.06),
    );
  }, [size.width, size.height, usableHeight]);

  /* The drawing is centred in the band between the two bars, not in the
     whole canvas */
  const centerY =
    CENTER_Y +
    (INSET_TOP + usableHeight / 2 - size.height / 2) / fitZoom;

  const apply = useCallback(
    (zoom: number) => {
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
    },
    [camera],
  );

  const fit = useCallback(() => {
    const controls = controlsRef.current;

    camera.position.set(CENTER_X, centerY, 100);
    apply(fitZoom);

    if (controls) {
      controls.target.set(CENTER_X, centerY, 0);
      controls.update();
    }
  }, [apply, camera, centerY, fitZoom]);

  /* Refit while the reader has not moved the map themselves, so a
     rotation or a resize still shows the whole room */
  useEffect(() => {
    const controls = controlsRef.current;

    if (controls) {
      controls.minZoom = fitZoom * 0.85;
      controls.maxZoom = fitZoom * 7;
    }

    if (!touched.current) fit();
  }, [fit, fitZoom]);

  useEffect(() => {
    apiRef.current = {
      fit: () => {
        touched.current = false;
        fit();
      },
      zoomBy: (factor) => {
        touched.current = true;

        const next = THREE.MathUtils.clamp(
          camera.zoom * factor,
          fitZoom * 0.85,
          fitZoom * 7,
        );

        apply(next);
      },
    };

    return () => {
      apiRef.current = null;
    };
  }, [apiRef, apply, camera, fit, fitZoom]);

  /* Panning must not carry the room off screen, so the target is kept
     inside the drawing */
  const clamp = useCallback(() => {
    const controls = controlsRef.current;

    if (!controls) return;

    controls.target.x = THREE.MathUtils.clamp(
      controls.target.x,
      BOUNDS.minX,
      BOUNDS.maxX,
    );
    controls.target.y = THREE.MathUtils.clamp(
      controls.target.y,
      BOUNDS.minY,
      BOUNDS.maxY,
    );

    camera.position.x = controls.target.x;
    camera.position.y = controls.target.y;
  }, [camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableRotate={false}
      enablePan
      screenSpacePanning
      enableDamping
      dampingFactor={0.18}
      zoomToCursor
      onStart={() => {
        touched.current = true;
      }}
      onChange={clamp}
      mouseButtons={{
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
      touches={{
        ONE: THREE.TOUCH.PAN,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
    />
  );
}

export default function SeatingLayout() {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [hovered, setHovered] = useState<number | null>(null);
  const [taken, setTaken] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState('');

  /* The dialog keeps the seats it opened with, so refreshing the map
     underneath can never tear it down mid confirmation */
  const viewRef = useRef<ViewApi | null>(null);
  const [dialogSeatIds, setDialogSeatIds] = useState<string[] | null>(null);

  const pageRef = useRef<HTMLDivElement>(null);
  const reserveButtonRef = useRef<HTMLButtonElement>(null);

  const [chip, setChip] = useState<{
    label: string;
    taken: boolean;
    team: boolean;
  } | null>(null);

  /* Moving onto the next seat replaces the text and cancels the pending
     hide, so the chip never blinks between neighbours */
  useEffect(() => {
    if (hovered !== null) {
      const id = seatData[hovered].id;

      setChip({
        label: seatLabel(id),
        taken: taken.has(hovered),
        team: isTeamSeat(id),
      });
      return;
    }

    const timer = window.setTimeout(
      () => setChip(null),
      220,
    );

    return () => window.clearTimeout(timer);
  }, [hovered, taken]);

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

      {/* Legend and view controls */}
      <div className="pointer-events-none absolute left-4 top-24 z-40 flex flex-col gap-2 md:left-8">
        {[
          { color: '#474d5a', label: 'Available' },
          { color: '#3b82f6', label: 'Selected' },
          { color: '#5a2f33', label: 'Taken' },
          { color: '#4e3f73', label: 'OSC team' },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#86868b] md:text-xs"
          >
            <span
              aria-hidden="true"
              className="h-3 w-3 rounded-[3px]"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </div>
        ))}
      </div>

      <div
        className={`absolute right-4 z-40 flex flex-col overflow-hidden rounded-xl border border-[#2e2e33] bg-[#0b0b0d]/85 backdrop-blur-md transition-all duration-200 md:right-8 ${
          selected.size > 0 ? 'bottom-32 md:bottom-28' : 'bottom-8'
        }`}
      >
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => viewRef.current?.zoomBy(1.35)}
          className="px-3 py-2 text-lg leading-none text-[#d6d6db] transition-colors hover:bg-white/5"
        >
          +
        </button>

        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => viewRef.current?.zoomBy(1 / 1.35)}
          className="border-t border-[#2e2e33] px-3 py-2 text-lg leading-none text-[#d6d6db] transition-colors hover:bg-white/5"
        >
          &minus;
        </button>

        <button
          type="button"
          aria-label="Fit the whole room"
          onClick={() => viewRef.current?.fit()}
          className="border-t border-[#2e2e33] px-3 py-2 text-[10px] uppercase tracking-wider text-[#86868b] transition-colors hover:bg-white/5 hover:text-white"
        >
          Fit
        </button>
      </div>

      {/* Hover Tooltip Overlay */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 backdrop-blur-md border text-white px-6 py-3 rounded-full font-bold tracking-widest text-sm pointer-events-none z-40 shadow-xl transition-all duration-[320ms] ease-out ${
          chip?.team
            ? 'bg-[#4e3f73]/90 border-[#6d5a9c]'
            : chip?.taken
              ? 'bg-[#4a2a2a]/90 border-[#6b3a3a]'
              : 'bg-[#2e2e33]/90 border-[#3e3e44]'
        } ${selected.size > 0 ? 'bottom-32 md:bottom-28' : 'bottom-8'} ${
          chip
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-3'
        }`}
      >
        {chip
          ? `${chip.label.toUpperCase()}${
              chip.team
                ? ' | OSC TEAM'
                : chip.taken
                  ? ' | TAKEN'
                  : ''
            }`
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
      <Canvas
        orthographic
        dpr={[1, 2]}
        gl={{ antialias: true }}
        camera={{
          position: [CENTER_X, CENTER_Y, 100],
          zoom: 12,
          near: 0.1,
          far: 1000,
        }}
      >
        <color attach="background" args={['#0b0b0d']} />

        <SceneView apiRef={viewRef} />

        <SeatsInstanced
          selected={selected}
          setSelected={setSelected}
          taken={taken}
          hovered={hovered}
          setHovered={setHovered}
          onLimit={() => setNotice(`You can reserve at most ${MAX_SEATS} seats at once.`)}
          onTaken={() => setNotice('That seat is already taken.')}
          onTeam={() =>
            setNotice(
              'The first two rows are held for the OSC team.',
            )
          }
        />
        <StageArea />
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
