import React from "react";
import { View, Text, StyleSheet } from "react-native";

export interface MapViewProps {
  style?: any;
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta?: number;
    longitudeDelta?: number;
  };
  children?: React.ReactNode;
  onPress?: (event: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => void;
}

export interface MarkerProps {
  coordinate: { latitude: number; longitude: number };
  title?: string;
  pinColor?: string;
  draggable?: boolean;
  onDragEnd?: (event: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => void;
}

export interface PolylineProps {
  coordinates: { latitude: number; longitude: number }[];
  strokeColor?: string;
  strokeWidth?: number;
}

export const Marker: React.FC<MarkerProps> = () => null;
export const Polyline: React.FC<PolylineProps> = () => null;

export const MapView: React.FC<MapViewProps> = ({ style, initialRegion, children, onPress }) => {
  const markers: MarkerProps[] = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement<MarkerProps>(child) && child.props?.coordinate) {
      markers.push(child.props);
    }
  });

  const center = initialRegion || (markers[0]?.coordinate ? { latitude: markers[0].coordinate.latitude, longitude: markers[0].coordinate.longitude } : { latitude: 10.7769, longitude: 106.7009 });

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>📍 Bản đồ hiển thị (Web Preview)</Text>
        <Text style={styles.coords}>
          {center.latitude?.toFixed(4)}, {center.longitude?.toFixed(4)}
        </Text>
      </View>
      <View style={styles.markersList}>
        {markers.map((m, idx) => (
          <View key={idx} style={styles.markerRow}>
            <View style={[styles.dot, { backgroundColor: m.pinColor || "#EA580C" }]} />
            <Text style={styles.markerTitle}>{m.title || `Điểm ${idx + 1}`}:</Text>
            <Text style={styles.markerCoords}>
              {m.coordinate.latitude?.toFixed(5)}, {m.coordinate.longitude?.toFixed(5)}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.subtext}>
        (Bản đồ Google Maps / GPS vệ tinh đầy đủ hoạt động trực tiếp khi chạy trên thiết bị Android / iOS)
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    padding: 14,
    justifyContent: "center",
    minHeight: 180,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
    paddingBottom: 6,
  },
  title: {
    fontWeight: "700",
    color: "#0F172A",
    fontSize: 13,
  },
  coords: {
    fontSize: 12,
    color: "#64748B",
    fontFamily: "monospace",
  },
  markersList: {
    gap: 6,
    marginVertical: 4,
  },
  markerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  markerTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1E293B",
  },
  markerCoords: {
    fontSize: 11,
    color: "#64748B",
    fontFamily: "monospace",
  },
  subtext: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 8,
    textAlign: "center",
  },
});

export default MapView;
