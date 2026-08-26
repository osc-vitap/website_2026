import {
  MotionValue,
  motion,
  useSpring,
  useTransform,
} from 'framer-motion';
import type React from 'react';
import { useEffect } from 'react';

/*
 * Odometer digits, from React Bits (reactbits.dev, Components/Counter).
 *
 * Vendored rather than installed: React Bits ships as copy-in source,
 * not a package. Two changes from upstream:
 *
 *   - imports come from `framer-motion`, since this project is on v10
 *     and the `motion/react` entry point only exists from v11;
 *   - the decimal-point branch is its own component. Upstream returns
 *     early for '.' and calls useSpring after it, which is a
 *     conditional hook — harmless while no caller passes a '.', and a
 *     crash the first time one does.
 *
 * Each digit stacks 0-9 and slides the column, so a value change rolls
 * rather than swaps. Set `places` explicitly to keep the width stable:
 * derived places would drop a column as the number shrinks, and a
 * counter that narrows every time it ticks makes the row jump.
 */

type PlaceValue = number | '.';

interface NumberProps {
  mv: MotionValue<number>;
  number: number;
  height: number;
}

const Digit10 = ({
  mv,
  number,
  height,
}: NumberProps) => {
  const y = useTransform(mv, (latest) => {
    const placeValue = latest % 10;
    const offset =
      (10 + number - placeValue) % 10;

    let memo = offset * height;

    /* Wrap the long way round so 9 -> 0 rolls forward, not back. */
    if (offset > 5) {
      memo -= 10 * height;
    }

    return memo;
  });

  return (
    <motion.span
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        y,
      }}
    >
      {number}
    </motion.span>
  );
};

/*
 * Floating-point division leaves values like 2.9999999996, which floor
 * turns into the wrong digit. Snap anything within tolerance of an
 * integer before flooring.
 */
const normalizeNearInteger = (
  num: number,
): number => {
  const nearest = Math.round(num);

  const tolerance =
    1e-9 * Math.max(1, Math.abs(num));

  return Math.abs(num - nearest) <
    tolerance
    ? nearest
    : num;
};

const valueAtPlace = (
  value: number,
  place: number,
): number =>
  Math.floor(
    normalizeNearInteger(value / place),
  );

interface DigitProps {
  place: number;
  value: number;
  height: number;
  digitStyle?: React.CSSProperties;
}

const NumberDigit = ({
  place,
  value,
  height,
  digitStyle,
}: DigitProps) => {
  const rounded = valueAtPlace(
    value,
    place,
  );

  const animated = useSpring(rounded);

  useEffect(() => {
    animated.set(rounded);
  }, [animated, rounded]);

  return (
    <span
      className="relative inline-flex overflow-hidden"
      style={{
        height,
        position: 'relative',
        width: '1ch',
        fontVariantNumeric: 'tabular-nums',
        ...digitStyle,
      }}
    >
      {Array.from(
        { length: 10 },
        (_, i) => (
          <Digit10
            key={i}
            mv={animated}
            number={i}
            height={height}
          />
        ),
      )}
    </span>
  );
};

const DecimalPoint = ({
  height,
  digitStyle,
}: {
  height: number;
  digitStyle?: React.CSSProperties;
}) => (
  <span
    className="relative inline-flex items-center justify-center"
    style={{
      height,
      width: 'fit-content',
      ...digitStyle,
    }}
  >
    .
  </span>
);

interface CounterProps {
  value: number;
  places: PlaceValue[];
  fontSize?: number;
  padding?: number;
  gap?: number;
  borderRadius?: number;
  horizontalPadding?: number;
  textColor?: string;
  fontWeight?: React.CSSProperties['fontWeight'];
  containerStyle?: React.CSSProperties;
  counterStyle?: React.CSSProperties;
  digitStyle?: React.CSSProperties;
  gradientHeight?: number;
  gradientFrom?: string;
  gradientTo?: string;
}

const Counter = ({
  value,
  places,
  fontSize = 100,
  padding = 0,
  gap = 8,
  /* The theme sets every radius to 0; upstream's default of 4 fights it. */
  borderRadius = 0,
  horizontalPadding = 8,
  textColor = 'inherit',
  fontWeight = 'inherit',
  containerStyle,
  counterStyle,
  digitStyle,
  gradientHeight = 16,
  gradientFrom = 'black',
  gradientTo = 'transparent',
}: CounterProps) => {
  const height = fontSize + padding;

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        ...containerStyle,
      }}
    >
      <span
        style={{
          fontSize,
          display: 'flex',
          gap,
          overflow: 'hidden',
          borderRadius,
          paddingLeft: horizontalPadding,
          paddingRight: horizontalPadding,
          lineHeight: 1,
          color: textColor,
          fontWeight,
          direction: 'ltr',
          ...counterStyle,
        }}
      >
        {places.map((place, i) =>
          place === '.' ? (
            <DecimalPoint
              key={`dot-${i}`}
              height={height}
              digitStyle={digitStyle}
            />
          ) : (
            <NumberDigit
              key={place}
              place={place}
              value={value}
              height={height}
              digitStyle={digitStyle}
            />
          ),
        )}
      </span>

      {/* Fades the top and bottom of the column, so digits roll in and
          out of the housing rather than appearing at its edge. */}
      {gradientHeight > 0 && (
        <span
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              height: gradientHeight,
              background: `linear-gradient(to bottom, ${gradientFrom}, ${gradientTo})`,
            }}
          />
          <span
            style={{
              height: gradientHeight,
              background: `linear-gradient(to top, ${gradientFrom}, ${gradientTo})`,
            }}
          />
        </span>
      )}
    </span>
  );
};

export default Counter;
