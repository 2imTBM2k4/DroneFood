import React from "react";
import {
  Image,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radius, typography } from "../../theme/tokens";
import { Icon, type IconName } from "./Icon";

export interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  iconName?: IconName;
  style?: StyleProp<ViewStyle>;
}

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  name,
  size = 48,
  iconName = "profile",
  style,
}) => {
  const getInitials = (text?: string): string => {
    if (!text || !text.trim()) return "";
    const parts = text.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const initials = getInitials(name);

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: radius.pill },
        style,
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: radius.pill }}
          resizeMode="cover"
          accessible={false}
        />
      ) : initials ? (
        <Text style={[styles.initialsText, { fontSize: size * 0.38 }]}>
          {initials}
        </Text>
      ) : (
        <Icon
          name={iconName}
          size={size * 0.5}
          color={colors.primary}
          variant="solid"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  initialsText: {
    ...typography.subhead,
    color: colors.primary,
    fontWeight: "700",
  },
});
