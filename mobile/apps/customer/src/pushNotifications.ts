import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const projectId = () => process.env.EXPO_PUBLIC_EAS_PROJECT_ID
  || Constants.expoConfig?.extra?.eas?.projectId
  || Constants.easConfig?.projectId;

const expoToken = async () => {
  if (Platform.OS === "web") return null;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Thông báo đơn hàng",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#EA580C",
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  const finalStatus = existing.status === "granted"
    ? existing.status
    : (await Notifications.requestPermissionsAsync()).status;
  if (finalStatus !== "granted") return null;
  const id = projectId();
  if (!id) return null;
  return (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
};

export const registerPushNotifications = async (apiUrl: string, accessToken: string) => {
  const token = await expoToken();
  if (!token) return;
  await fetch(`${apiUrl}/api/push-tokens/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ token, platform: Platform.OS }),
  });
};

export const unregisterPushNotifications = async (apiUrl: string, accessToken: string) => {
  const token = await expoToken();
  if (!token) return;
  await fetch(`${apiUrl}/api/push-tokens/unregister`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ token }),
  });
};
