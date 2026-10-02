import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Avatar,
  Badge,
  Button,
  CategoryItem,
  Checkbox,
  EmptyState,
  FavoriteButton,
  FilterChip,
  Header,
  Icon,
  InfoRow,
  Input,
  ListItem,
  ProductCard,
  Radio,
  SearchBar,
  SectionHeader,
  Skeleton,
  StatusBadge,
  Stepper,
  Switch,
  Tabs,
  Timeline,
} from "../../components/common";
import { colors, radius, spacing, typography } from "../../theme/tokens";

/**
 * DEV-ONLY COMPONENT GALLERY SCREEN
 * 
 * Mục đích: Màn hình kiểm chứng trực quan toàn bộ Component, mọi trạng thái (states),
 * màu sắc, kích thước vùng chạm (touch targets), và font chữ tiếng Việt có dấu.
 * 
 * FILE CẦN XÓA SAU KHI DUYỆT XONG:
 * apps/customer-mobile/src/screens/dev/ComponentGalleryScreen.tsx
 */
export const ComponentGalleryScreen: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [searchValue, setSearchValue] = useState("");
  const [chipSelected, setChipSelected] = useState(false);
  const [isFav, setIsFav] = useState(true);
  const [stepperVal, setStepperVal] = useState(2);
  const [checkboxVal, setCheckboxVal] = useState(true);
  const [radioVal, setRadioVal] = useState("drone");
  const [switchVal, setSwitchVal] = useState(true);
  const [activeTab, setActiveTab] = useState("tat-ca");
  const [inputText, setInputText] = useState("");

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Header
        title="Thư viện Component (Dev)"
        subtitle="Kiểm chứng hiển thị & dấu tiếng Việt"
        onBack={onBack}
      />

      {/* 1. MÀU SẮC & CONTRAST (MÀU CHỦ ĐẠO MỚI: ACTION BLUE #0066CC) */}
      <SectionHeader title="1. Màu sắc & Điểm nhấn mới" />
      <View style={styles.card}>
        <View style={styles.colorRow}>
          <View style={[styles.colorBox, { backgroundColor: colors.primary }]}>
            <Text style={styles.colorTextWhite}>#0066CC{"\n"}Primary</Text>
          </View>
          <View style={[styles.colorBox, { backgroundColor: colors.primaryLight }]}>
            <Text style={styles.colorTextDark}>#EBF3FB{"\n"}Tint 8%</Text>
          </View>
          <View style={[styles.colorBox, { backgroundColor: colors.textSecondary }]}>
            <Text style={styles.colorTextWhite}>#666666{"\n"}Secondary</Text>
          </View>
          <View style={[styles.colorBox, { backgroundColor: colors.surfaceSubtle }]}>
            <Text style={styles.colorTextDark}>#EFEFEF{"\n"}Subtle</Text>
          </View>
        </View>
      </View>

      {/* 2. CÁC ICON TỰ VẼ SVG 24x24 MỚI */}
      <SectionHeader title="2. Icon Vector SVG Tự vẽ Mới (24x24, Nét 1.5)" />
      <View style={styles.card}>
        <View style={styles.iconRow}>
          <View style={styles.iconItem}>
            <View style={styles.iconCircle}>
              <Icon name="drone" size={24} color={colors.primary} />
            </View>
            <Text style={styles.iconLabel}>Drone giao hàng</Text>
          </View>
          <View style={styles.iconItem}>
            <View style={styles.iconCircle}>
              <Icon name="motorcycle" size={24} color={colors.primary} />
            </View>
            <Text style={styles.iconLabel}>Shipper xe máy</Text>
          </View>
          <View style={styles.iconItem}>
            <View style={styles.iconCircle}>
              <Icon name="utensils" size={24} color={colors.primary} />
            </View>
            <Text style={styles.iconLabel}>Bộ dao nĩa bếp</Text>
          </View>
        </View>
      </View>

      {/* 3. NÚT BẤM (BUTTONS) - CÁC BIẾN THỂ & KÍCH THƯỚC */}
      <SectionHeader title="3. Nút bấm (Button Variants & Sizes)" />
      <View style={styles.card}>
        <Button label="Xác nhận đặt hàng (#0066CC)" variant="primary" size="md" onPress={() => {}} />
        <View style={styles.gap} />
        <Button label="Nút viền mảnh (Outline)" variant="outline" size="md" onPress={() => {}} />
        <View style={styles.gap} />
        <Button label="Nút phụ (Secondary)" variant="secondary" size="md" onPress={() => {}} />
        <View style={styles.gap} />
        <Button label="Nút xóa / Hủy đơn (Danger)" variant="danger" size="md" onPress={() => {}} />
        <View style={styles.gap} />
        <View style={styles.darkBannerPreview}>
          <Text style={styles.darkBannerText}>Ảnh nền tối giả định</Text>
          <Button label="Editor's pick (Glass)" variant="glass" size="sm" onPress={() => {}} />
        </View>
      </View>

      {/* 4. TÌM KIẾM & NHẬP LIỆU (SEARCH & INPUT) */}
      <SectionHeader title="4. Tìm kiếm & Nhập liệu (Placeholder #666666)" />
      <View style={styles.card}>
        <SearchBar
          value={searchValue}
          onChangeText={setSearchValue}
          placeholder="Tìm món ăn, phở bò, trà sữa..."
        />
        <View style={styles.gap} />
        <Input
          label="Ghi chú cho tài xế / quán ăn"
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ví dụ: Giao lên lầu 3, ít đường ít đá"
          hint="Placeholder dùng chung token #666666 đạt chuẩn WCAG AA"
        />
      </View>

      {/* 5. SELECTION CONTROLS (CHECKBOX, RADIO, SWITCH) */}
      <SectionHeader title="5. Điều khiển Chọn (Vùng chạm >= 44x44)" />
      <View style={styles.card}>
        <Checkbox
          label="Đồng ý điều khoản dịch vụ giao hàng DroneFood"
          checked={checkboxVal}
          onToggle={setCheckboxVal}
        />
        <Radio
          label="Giao bằng máy bay không người lái (Drone)"
          subLabel="Tốc độ bay 50km/h, nhận tại bãi đáp gần nhất"
          selected={radioVal === "drone"}
          onSelect={() => setRadioVal("drone")}
        />
        <Radio
          label="Giao bằng tài xế xe máy (Shipper)"
          subLabel="Nhận món tận cửa nhà"
          selected={radioVal === "shipper"}
          onSelect={() => setRadioVal("shipper")}
        />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Nhận thông báo tiến trình bay theo thời gian thực</Text>
          <Switch value={switchVal} onValueChange={setSwitchVal} />
        </View>
      </View>

      {/* 6. STEPPER, FAVORITE & FILTER CHIP */}
      <SectionHeader title="6. Stepper, Yêu thích & Filter Chip" />
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.rowTitle}>Số lượng món:</Text>
          <Stepper value={stepperVal} onIncrement={() => setStepperVal((v) => v + 1)} onDecrement={() => setStepperVal((v) => Math.max(1, v - 1))} size="md" />
        </View>
        <View style={styles.gap} />
        <View style={styles.rowBetween}>
          <Text style={styles.rowTitle}>Nút yêu thích (Heart):</Text>
          <FavoriteButton isFavorite={isFav} onToggle={() => setIsFav(!isFav)} size={36} />
        </View>
        <View style={styles.gap} />
        <View style={styles.chipRow}>
          <FilterChip label="Tất cả" selected={!chipSelected} onPress={() => setChipSelected(false)} />
          <FilterChip label="Ưu đãi hôm nay" selected={chipSelected} onPress={() => setChipSelected(true)} leadingIcon="sparkles" />
        </View>
      </View>

      {/* 7. NHÃN TRẠNG THÁI (STATUS BADGES) */}
      <SectionHeader title="7. Nhãn Trạng thái & Độ tương phản WCAG AA" />
      <View style={styles.card}>
        <View style={styles.badgeRow}>
          <StatusBadge status="pending" label="Chờ xác nhận" />
          <StatusBadge status="preparing" label="Đang chuẩn bị" />
        </View>
        <View style={styles.badgeRow}>
          <StatusBadge status="delivering" label="Đang bay giao" />
          <StatusBadge status="delivered" label="Đã giao thành công" />
        </View>
        <View style={styles.badgeRow}>
          <StatusBadge status="cancelled" label="Đã hủy đơn" />
          <Badge label="Nổi bật (Tint #EBF3FB)" variant="mint" />
        </View>
      </View>

      {/* 8. TIMELINE ĐỦ 7 PHA GIAO HÀNG DRONE */}
      <SectionHeader title="8. Tiến trình Giao hàng Drone (Đủ 7 Pha)" />
      <View style={styles.card}>
        <Timeline deliveryMethod="drone" orderStatus="delivering" dronePhase="en_route_to_customer" />
      </View>

      {/* 9. KIỂM CHỨNG DẤU TIẾNG VIỆT & FONT HỆ THỐNG */}
      <SectionHeader title="9. Dấu Tiếng Việt & Cân nặng Phông chữ (System Fonts)" />
      <View style={styles.card}>
        <Text style={[styles.vietnameseText, { fontWeight: "400" }]}>
          [Regular 400] Cơm sườn bì chả, phở bò tái nạm gầu, bánh mì pate thịt nguội.
        </Text>
        <Text style={[styles.vietnameseText, { fontWeight: "500" }]}>
          [Medium 500] Bún chả cá Quy Nhơn, canh chua cá lóc, lẩu thái hải sản cay nồng.
        </Text>
        <Text style={[styles.vietnameseText, { fontWeight: "600" }]}>
          [Semibold 600] Trà sữa trân châu hoàng kim, bánh tráng nướng Đà Lạt giòn rụm.
        </Text>
        <Text style={[styles.vietnameseText, { fontWeight: "700" }]}>
          [Bold 700] Khuyến mãi hỏa tốc: Giảm ngay 50.000đ cho đơn đặt bay bằng Drone!
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.screenPadding,
    paddingBottom: 60,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  gap: {
    height: spacing.md,
  },
  colorRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  colorBox: {
    flex: 1,
    height: 64,
    borderRadius: radius.sm,
    justifyContent: "center",
    alignItems: "center",
    padding: 4,
  },
  colorTextWhite: {
    ...typography.micro,
    color: colors.textWhite,
    textAlign: "center",
    fontWeight: "700",
  },
  colorTextDark: {
    ...typography.micro,
    color: colors.textPrimary,
    textAlign: "center",
    fontWeight: "700",
  },
  iconRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: spacing.xs,
  },
  iconItem: {
    alignItems: "center",
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  iconLabel: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  darkBannerPreview: {
    backgroundColor: "#1A1A1A",
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  darkBannerText: {
    ...typography.caption,
    color: colors.textWhite,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  switchLabel: {
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  chipRow: {
    flexDirection: "row",
  },
  badgeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  vietnameseText: {
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
});
