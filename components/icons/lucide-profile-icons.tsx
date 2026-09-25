import Svg, { Circle, Path, Rect } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

const strokeOf = (color: string, strokeWidth: number) => ({
  stroke: color,
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none' as const,
});

/** Lucide UserRound */
export function UserRoundIcon({ size = 16, color = '#FF6A00', strokeWidth = 1.75 }: Props) {
  const stroke = strokeOf(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={5} {...stroke} />
      <Path d="M20 21a8 8 0 0 0-16 0" {...stroke} />
    </Svg>
  );
}

/** Lucide AtSign */
export function AtSignIcon({ size = 16, color = '#FF6A00', strokeWidth = 1.75 }: Props) {
  const stroke = strokeOf(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={4} {...stroke} />
      <Path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" {...stroke} />
    </Svg>
  );
}

/** Lucide Mail */
export function MailIcon({ size = 16, color = '#FF6A00', strokeWidth = 1.75 }: Props) {
  const stroke = strokeOf(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect width={20} height={16} x={2} y={4} rx={2} {...stroke} />
      <Path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" {...stroke} />
    </Svg>
  );
}

/** Lucide Globe2 */
export function Globe2Icon({ size = 16, color = '#FF6A00', strokeWidth = 1.75 }: Props) {
  const stroke = strokeOf(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21.54 15H17a2 2 0 0 0-2 2v4.54" {...stroke} />
      <Path
        d="M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17"
        {...stroke}
      />
      <Path
        d="M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05"
        {...stroke}
      />
      <Circle cx={12} cy={12} r={10} {...stroke} />
    </Svg>
  );
}

/** Lucide BadgeCheck */
export function BadgeCheckIcon({ size = 14, color = '#34C759', strokeWidth = 2 }: Props) {
  const stroke = strokeOf(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
        {...stroke}
      />
      <Path d="m9 12 2 2 4-4" {...stroke} />
    </Svg>
  );
}

/** Lucide Shield */
export function ShieldIcon({ size = 14, color = '#8E8E93', strokeWidth = 2 }: Props) {
  const stroke = strokeOf(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
        {...stroke}
      />
    </Svg>
  );
}

/** Lucide Camera */
export function CameraIcon({ size = 16, color = '#fff', strokeWidth = 2 }: Props) {
  const stroke = strokeOf(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"
        {...stroke}
      />
      <Circle cx={12} cy={13} r={3} {...stroke} />
    </Svg>
  );
}

/** Lucide Check */
export function CheckIcon({ size = 16, color = '#fff', strokeWidth = 2 }: Props) {
  const stroke = strokeOf(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6 9 17l-5-5" {...stroke} />
    </Svg>
  );
}
