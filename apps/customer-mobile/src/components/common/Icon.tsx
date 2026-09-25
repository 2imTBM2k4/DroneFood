import React from "react";
import Svg, { Path } from "react-native-svg";

export type IconName =
  | "camera"
  | "cart"
  | "banknote"
  | "cake"
  | "check"
  | "chevron-right"
  | "clock"
  | "close"
  | "coffee"
  | "crosshair"
  | "credit-card"
  | "drone"
  | "gift"
  | "home"
  | "leaf"
  | "map-pin"
  | "motorcycle"
  | "package"
  | "pizza"
  | "phone"
  | "orders"
  | "profile"
  | "refresh"
  | "search"
  | "settings"
  | "sparkles"
  | "star"
  | "store"
  | "trash"
  | "ticket"
  | "utensils";

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

const paths: Record<IconName, React.ReactNode> = {
  camera: <><Path d="M14.5 4 16 6h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l1.5-2h5Z" /><Path d="M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /></>,
  home: <Path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z" />,
  orders: <><Path d="M9 5h10M9 12h10M9 19h10" /><Path d="m4 5 .01 0M4 12l.01 0M4 19l.01 0" strokeWidth={3} /></>,
  cart: <><Path d="M3 3h2l2.5 13h10.8l2-9H7" /><Path d="M10 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM18 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" /></>,
  profile: <><Path d="M20 21a8 8 0 0 0-16 0" /><Path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /></>,
  "map-pin": <><Path d="M20 10c0 5-8 11-8 11s-8-6-8-11a8 8 0 1 1 16 0Z" /><Path d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /></>,
  search: <><Path d="m21 21-4.35-4.35" /><Path d="M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" /></>,
  close: <><Path d="m6 6 12 12M18 6 6 18" /></>,
  crosshair: <><Path d="M12 2v4M12 18v4M2 12h4M18 12h4" /><Path d="M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z" /></>,
  refresh: <><Path d="M20 11a8.1 8.1 0 0 0-14.6-3L3 10" /><Path d="M3 4v6h6" /><Path d="M4 13a8.1 8.1 0 0 0 14.6 3L21 14" /><Path d="M21 20v-6h-6" /></>,
  cake: <><Path d="M20 21v-8a4 4 0 0 0-8 0 4 4 0 0 0-8 0v8" /><Path d="M3 21h18M12 3v4M9 5h6" /></>,
  banknote: <><Path d="M3 6h18v12H3z" /><Path d="M7 10h.01M17 14h.01M12 16a4 4 0 0 0 0-8 4 4 0 0 0 0 8Z" /></>,
  check: <Path d="m5 12 4 4L19 6" />,
  "chevron-right": <Path d="m9 18 6-6-6-6" />,
  clock: <><Path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" /><Path d="M12 6v6l4 2" /></>,
  coffee: <><Path d="M4 8h13v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z" /><Path d="M17 10h1a3 3 0 0 1 0 6h-1M7 3v2M11 3v2M15 3v2" /></>,
  "credit-card": <><Path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" /><Path d="M2 10h20M6 15h4" /></>,
  drone: <><Path d="M7 12h10l2 3H5l2-3Z" /><Path d="M12 12V7M8 7h8M6 19h12M5 7l-2 2M19 7l2 2" /><Path d="M10 18v1M14 18v1" /></>,
  motorcycle: <><Path d="M5 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><Path d="M5 14h5l2-5h4l2 5h-4M12 9l-2-3h3M16 9h2" /></>,
  gift: <><Path d="M20 12v9H4v-9M2 7h20v5H2zM12 7v14" /><Path d="M12 7H7.5a2.5 2.5 0 1 1 2.5-2.5V7ZM12 7h4.5A2.5 2.5 0 1 0 14 4.5V7Z" /></>,
  leaf: <><Path d="M20 4C10 4 4 9 4 16c0 2 1 4 3 4 7 0 12-6 13-16Z" /><Path d="M4 20c3-4 7-7 12-9" /></>,
  package: <><Path d="m21 8-9 5-9-5 9-5 9 5Z" /><Path d="M3 8v9l9 5 9-5V8M12 13v9" /></>,
  pizza: <><Path d="M4 4h16l-8 16L4 4Z" /><Path d="M10 9h.01M14 14h.01M15 9h.01" strokeWidth={4} /></>,
  phone: <Path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .8 2.9a2 2 0 0 1-.5 2.1L8.1 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.4 1.9.7 2.9.8a2 2 0 0 1 1.6 1.9Z" />,
  settings: <><Path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.1 2.1-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.1-2.1.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H5.3v-3h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.1-2.1.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h3v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.1 2.1-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2v3h-.2a1.7 1.7 0 0 0-1.5 1Z" /></>,
  sparkles: <><Path d="m12 3-1.5 5.5L5 10l5.5 1.5L12 17l1.5-5.5L19 10l-5.5-1.5L12 3Z" /><Path d="m19 16-.7 2.3L16 19l2.3.7L19 22l.7-2.3L22 19l-2.3-.7L19 16ZM5 3l-.5 1.5L3 5l1.5.5L5 7l.5-1.5L7 5l-1.5-.5L5 3Z" /></>,
  star: <Path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
  store: <><Path d="M4 10v10h16V10M3 5h18l-1.5 5a3 3 0 0 1-5.5.8A3 3 0 0 1 9 10.8 3 3 0 0 1 4.5 10L3 5Z" /><Path d="M9 20v-6h6v6" /></>,
  trash: <><Path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
  ticket: <Path d="M3 7a2 2 0 0 0 2 2v6a2 2 0 0 0-2 2v2h18v-2a2 2 0 0 0-2-2V9a2 2 0 0 0 2-2V5H3v2Zm9 2v6" />,
  utensils: <><Path d="M7 3v7M4 3v4a3 3 0 0 0 6 0V3M7 10v11M17 3v18M17 3c2 2 3 4 3 7h-3" /></>,
};

export const Icon: React.FC<IconProps> = ({ name, size = 20, color = "currentColor" }) => (
  <Svg accessible={false} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {paths[name]}
  </Svg>
);
