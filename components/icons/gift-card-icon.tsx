import Svg, { Circle, Path, Rect } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

/**
 * Gift card icon from oryno-website: rounded card + ribbon cross + bow.
 */
export function GiftCardIcon({
  size = 20,
  color = '#FF6A00',
  strokeWidth = 1.75,
}: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="3"
        y="6.5"
        width="18"
        height="11"
        rx="2.4"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M9.25 6.5v11"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M3 11.25h18"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M9.25 11.25c-1.7-1.55-3.35-1.35-3.55-.15-.15.95.95 1.55 2.05 1.1"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.25 11.25c1.7-1.55 3.35-1.35 3.55-.15.15.95-.95 1.55-2.05 1.1"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="9.25" cy="11.25" r="1" fill={color} />
    </Svg>
  );
}
