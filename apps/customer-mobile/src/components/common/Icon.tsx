import React from "react";
import Svg, { Path } from "react-native-svg";
import * as OutlineIcons from "react-native-heroicons/outline";
import * as SolidIcons from "react-native-heroicons/solid";

export type IconName =
  | "camera"
  | "cart"
  | "banknote"
  | "cake"
  | "check"
  | "chevron-left"
  | "chevron-right"
  | "chevron-down"
  | "clock"
  | "close"
  | "coffee"
  | "crosshair"
  | "credit-card"
  | "drone"
  | "gift"
  | "heart"
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

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  variant?: "outline" | "solid";
  strokeWidth?: number;
}

// Custom domain SVG paths for icons not in standard Heroicons (drone, shipper motorcycle, utensils)
// Standard 24x24 viewBox, strokeWidth 1.5, round caps & joins
const customPaths: Partial<Record<IconName, React.ReactNode>> = {
  drone: (
    <>
      {/* Central body fuselage */}
      <Path d="M9 10.5h6a1.5 1.5 0 0 1 1.5 1.5v0a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 12v0a1.5 1.5 0 0 1 1.5-1.5Z" />
      {/* 4 Diagonal quadcopter arms */}
      <Path d="M7.5 10.5 4.5 7M16.5 10.5 19.5 7M7.5 13.5 4.5 17M16.5 13.5 19.5 17" />
      {/* 4 Propeller rotors */}
      <Path d="M2.5 7h4M17.5 7h4M2.5 17h4M17.5 17h4" />
      {/* Landing skids & cargo clamp */}
      <Path d="M10 13.5v2M14 13.5v2M8.5 17.5h7" />
    </>
  ),
  motorcycle: (
    <>
      {/* Rear & front wheels */}
      <Path d="M5 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM19 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
      {/* Motorbike frame & chassis */}
      <Path d="M5 17h3l3.5-6h4.5l2 6" />
      {/* Handlebar & front fork */}
      <Path d="M15 7.5 13 5h3M16 11l-1-3.5" />
      {/* Shipper food delivery delivery box */}
      <Path d="M4 8.5h4.5v5.5H4Z" />
    </>
  ),
  utensils: (
    <>
      {/* Fork: 3 tines, curved base, straight handle */}
      <Path d="M5.5 3v5a2.5 2.5 0 0 0 5 0V3M8 3v5M8 10.5v10" />
      {/* Knife: Curved cutting blade, straight handle */}
      <Path d="M16 3c2.2 0 3 1.8 3 5v4h-3M16 12v8.5" />
    </>
  ),
  crosshair: (
    <>
      <Path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      <Path d="M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z" />
    </>
  ),
  pizza: (
    <>
      <Path d="M4 4h16l-8 16L4 4Z" />
      <Path d="M10 9h.01M14 14h.01M15 9h.01" strokeWidth={3} />
    </>
  ),
  leaf: (
    <>
      <Path d="M20 4C10 4 4 9 4 16c0 2 1 4 3 4 7 0 12-6 13-16Z" />
      <Path d="M4 20c3-4 7-7 12-9" />
    </>
  ),
  coffee: (
    <>
      <Path d="M4 8h13v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z" />
      <Path d="M17 10h1a3 3 0 0 1 0 6h-1M7 3v2M11 3v2M15 3v2" />
    </>
  ),
};

export const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  color = "#1A1A1A",
  variant = "outline",
  strokeWidth = 1.5,
}) => {
  // Check if it's a custom domain icon
  if (customPaths[name]) {
    return (
      <Svg
        accessible={false}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {customPaths[name]}
      </Svg>
    );
  }

  // Map to Heroicons
  const isSolid = variant === "solid";
  const iconProps = {
    width: size,
    height: size,
    color,
    strokeWidth: isSolid ? undefined : strokeWidth,
  };

  switch (name) {
    case "home":
      return isSolid ? <SolidIcons.HomeIcon {...iconProps} /> : <OutlineIcons.HomeIcon {...iconProps} />;
    case "search":
      return isSolid ? <SolidIcons.MagnifyingGlassIcon {...iconProps} /> : <OutlineIcons.MagnifyingGlassIcon {...iconProps} />;
    case "cart":
      return isSolid ? <SolidIcons.ShoppingBagIcon {...iconProps} /> : <OutlineIcons.ShoppingBagIcon {...iconProps} />;
    case "orders":
      return isSolid ? <SolidIcons.ClipboardDocumentListIcon {...iconProps} /> : <OutlineIcons.ClipboardDocumentListIcon {...iconProps} />;
    case "profile":
      return isSolid ? <SolidIcons.UserIcon {...iconProps} /> : <OutlineIcons.UserIcon {...iconProps} />;
    case "heart":
      return isSolid ? <SolidIcons.HeartIcon {...iconProps} /> : <OutlineIcons.HeartIcon {...iconProps} />;
    case "check":
      return isSolid ? <SolidIcons.CheckIcon {...iconProps} /> : <OutlineIcons.CheckIcon {...iconProps} />;
    case "close":
      return isSolid ? <SolidIcons.XMarkIcon {...iconProps} /> : <OutlineIcons.XMarkIcon {...iconProps} />;
    case "chevron-left":
      return isSolid ? <SolidIcons.ChevronLeftIcon {...iconProps} /> : <OutlineIcons.ChevronLeftIcon {...iconProps} />;
    case "chevron-right":
      return isSolid ? <SolidIcons.ChevronRightIcon {...iconProps} /> : <OutlineIcons.ChevronRightIcon {...iconProps} />;
    case "chevron-down":
      return isSolid ? <SolidIcons.ChevronDownIcon {...iconProps} /> : <OutlineIcons.ChevronDownIcon {...iconProps} />;
    case "map-pin":
      return isSolid ? <SolidIcons.MapPinIcon {...iconProps} /> : <OutlineIcons.MapPinIcon {...iconProps} />;
    case "clock":
      return isSolid ? <SolidIcons.ClockIcon {...iconProps} /> : <OutlineIcons.ClockIcon {...iconProps} />;
    case "camera":
      return isSolid ? <SolidIcons.CameraIcon {...iconProps} /> : <OutlineIcons.CameraIcon {...iconProps} />;
    case "banknote":
      return isSolid ? <SolidIcons.BanknotesIcon {...iconProps} /> : <OutlineIcons.BanknotesIcon {...iconProps} />;
    case "credit-card":
      return isSolid ? <SolidIcons.CreditCardIcon {...iconProps} /> : <OutlineIcons.CreditCardIcon {...iconProps} />;
    case "package":
      return isSolid ? <SolidIcons.ArchiveBoxIcon {...iconProps} /> : <OutlineIcons.ArchiveBoxIcon {...iconProps} />;
    case "phone":
      return isSolid ? <SolidIcons.PhoneIcon {...iconProps} /> : <OutlineIcons.PhoneIcon {...iconProps} />;
    case "refresh":
      return isSolid ? <SolidIcons.ArrowPathIcon {...iconProps} /> : <OutlineIcons.ArrowPathIcon {...iconProps} />;
    case "settings":
      return isSolid ? <SolidIcons.Cog6ToothIcon {...iconProps} /> : <OutlineIcons.Cog6ToothIcon {...iconProps} />;
    case "sparkles":
      return isSolid ? <SolidIcons.SparklesIcon {...iconProps} /> : <OutlineIcons.SparklesIcon {...iconProps} />;
    case "star":
      return isSolid ? <SolidIcons.StarIcon {...iconProps} /> : <OutlineIcons.StarIcon {...iconProps} />;
    case "store":
      return isSolid ? <SolidIcons.BuildingStorefrontIcon {...iconProps} /> : <OutlineIcons.BuildingStorefrontIcon {...iconProps} />;
    case "trash":
      return isSolid ? <SolidIcons.TrashIcon {...iconProps} /> : <OutlineIcons.TrashIcon {...iconProps} />;
    case "ticket":
      return isSolid ? <SolidIcons.TicketIcon {...iconProps} /> : <OutlineIcons.TicketIcon {...iconProps} />;
    case "cake":
      return isSolid ? <SolidIcons.CakeIcon {...iconProps} /> : <OutlineIcons.CakeIcon {...iconProps} />;
    case "gift":
      return isSolid ? <SolidIcons.GiftIcon {...iconProps} /> : <OutlineIcons.GiftIcon {...iconProps} />;
    default:
      return <OutlineIcons.QuestionMarkCircleIcon {...iconProps} />;
  }
};
