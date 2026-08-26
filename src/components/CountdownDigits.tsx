import { useReducedMotion } from 'framer-motion';

import Counter from './Counter';
import { Remaining } from '../data/eventCountdown';

/*
 * Days / hours / minutes as rolling odometer digits.
 *
 * Shared by the strip under the navbar and the registration success
 * screens, so the two never drift apart in size rules, padding
 * behaviour or how they handle reduced motion.
 */

interface UnitProps {
  value: number;
  places: number[];
  label: string;
  size: number;
  accent: string;
  ground: string;
  stacked: boolean;
  still: boolean;
}

const Unit = ({
  value,
  places,
  label,
  size,
  accent,
  ground,
  stacked,
  still,
}: UnitProps) => {
  const digits = still ? (
    /*
     * Reduced motion: the number, without ten copies of every digit
     * sliding past it. Padded by hand to the width the rolling version
     * reserves, so the row does not shift between the two.
     */
    <span
      className="tabular-nums font-semibold"
      style={{
        fontSize: size,
        lineHeight: 1,
        color: accent,
      }}
    >
      {String(value).padStart(
        places.length,
        '0',
      )}
    </span>
  ) : (
    <Counter
      value={value}
      places={places}
      fontSize={size}
      padding={Math.round(size * 0.28)}
      gap={1}
      horizontalPadding={0}
      fontWeight={600}
      textColor={accent}
      gradientHeight={Math.round(
        size * 0.22,
      )}
      gradientFrom={ground}
    />
  );

  /*
   * Stacked puts the label under the digits, which is the readable
   * shape when there is room; inline keeps the strip one line tall.
   */
  return stacked ? (
    <span className="flex flex-col items-center gap-1">
      {digits}
      <span
        className="font-mono uppercase tracking-[0.2em] text-white/40"
        style={{
          fontSize: Math.max(
            9,
            Math.round(size * 0.26),
          ),
        }}
      >
        {label}
      </span>
    </span>
  ) : (
    <span className="flex items-center gap-1">
      {digits}
      <span
        className="font-mono uppercase tracking-[0.2em] text-white/40"
        style={{
          fontSize: Math.max(
            9,
            Math.round(size * 0.45),
          ),
        }}
      >
        {label}
      </span>
    </span>
  );
};

interface CountdownDigitsProps {
  remaining: Remaining;
  /** Digit size in px. */
  size?: number;
  accent?: string;
  /** The surface behind the digits, for the odometer's fade. */
  ground?: string;
  /** Label under the digits rather than beside them. */
  stacked?: boolean;
  className?: string;
}

const CountdownDigits = ({
  remaining,
  size = 22,
  accent = '#c084fc',
  ground = 'rgba(10,10,12,0.9)',
  stacked = false,
  className = '',
}: CountdownDigitsProps) => {
  const still = !!useReducedMotion();

  /*
   * Fixed width as it counts down, so the row never reflows. Derived
   * places would drop a column as the number shrinks and the whole
   * line would shuffle sideways on every tick.
   */
  const dayPlaces =
    remaining.days >= 100
      ? [100, 10, 1]
      : [10, 1];

  const shared = {
    size,
    accent,
    ground,
    stacked,
    still,
  };

  return (
    <span
      aria-hidden
      className={`flex items-center ${
        stacked ? 'gap-5' : 'gap-3'
      } ${className}`}
    >
      <Unit
        value={remaining.days}
        places={dayPlaces}
        label="days"
        {...shared}
      />
      <Unit
        value={remaining.hours}
        places={[10, 1]}
        label="hrs"
        {...shared}
      />
      <Unit
        value={remaining.minutes}
        places={[10, 1]}
        label="min"
        {...shared}
      />
    </span>
  );
};

export default CountdownDigits;
