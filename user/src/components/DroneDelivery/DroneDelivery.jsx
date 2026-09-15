import { useEffect, useState, useRef } from "react";
import { toast } from "react-toastify";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { QRCodeSVG } from "qrcode.react";
import QRScanner from "../QRScanner/QRScanner";
import "leaflet/dist/leaflet.css";
import "./DroneDelivery.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const HCMC_CENTER = [10.7769, 106.7008];

const HCMC_BOUNDS = {
  minLat: 10.7,
  maxLat: 10.85,
  minLng: 106.6,
  maxLng: 106.8,
};

const getRandomCoordinate = () => {
  const lat =
    HCMC_BOUNDS.minLat +
    Math.random() * (HCMC_BOUNDS.maxLat - HCMC_BOUNDS.minLat);
  const lng =
    HCMC_BOUNDS.minLng +
    Math.random() * (HCMC_BOUNDS.maxLng - HCMC_BOUNDS.minLng);
  return [lat, lng];
};

const createStraightPath = (start, end, numPoints = 100) => {
  const [lat1, lng1] = start;
  const [lat2, lng2] = end;
  const path = [];
  for (let t = 0; t <= 1; t += 1 / numPoints) {
    const lat = lat1 + (lat2 - lat1) * t;
    const lng = lng1 + (lng2 - lng1) * t;
    path.push([lat, lng]);
  }
  return path;
};

const droneIcon = L.icon({
  iconUrl: "./../src/assets/drone.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const DroneAnimation = ({ path, onComplete, initialArrived }) => {
  const map = useMap();
  const [dronePosition, setDronePosition] = useState(null);
  const [flightCompleted, setFlightCompleted] = useState(Boolean(initialArrived));
  const droneRef = useRef(null);
  const animationFrameId = useRef(null);
  const startTimeRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  const duration = 10000;

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!path || path.length < 2) return;

    const startPoint = path[0];
    const endPoint = path[path.length - 1];

    // Nếu drone đã từng bay đến đích (hoặc trang được reload lại), định vị ngay tại điểm đích
    if (initialArrived) {
      setDronePosition(endPoint);
      if (droneRef.current) {
        droneRef.current.setLatLng(endPoint);
      }
      setFlightCompleted(true);
      return;
    }

    if (flightCompleted) return;

    setDronePosition(startPoint);

    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    startTimeRef.current = null;

    const animate = (currentTime) => {
      if (!startTimeRef.current) startTimeRef.current = currentTime;
      const elapsedTime = currentTime - startTimeRef.current;
      const progress = Math.min(elapsedTime / duration, 1);

      if (progress < 1) {
        const lat = startPoint[0] + (endPoint[0] - startPoint[0]) * progress;
        const lng = startPoint[1] + (endPoint[1] - startPoint[1]) * progress;
        const currentPosition = [lat, lng];

        setDronePosition(currentPosition);
        if (droneRef.current) {
          droneRef.current.setLatLng(currentPosition);
        }
        animationFrameId.current = requestAnimationFrame(animate);
      } else {
        setDronePosition(endPoint);
        if (droneRef.current) {
          droneRef.current.setLatLng(endPoint);
        }
        if (!flightCompleted && onCompleteRef.current) {
          onCompleteRef.current();
        }
        setFlightCompleted(true);
        startTimeRef.current = null;
        animationFrameId.current = null;
      }
    };

    animationFrameId.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [path, map, flightCompleted, initialArrived]);

  return dronePosition ? (
    <Marker position={dronePosition} icon={droneIcon} ref={droneRef} />
  ) : null;
};

const MapBounds = ({ start, end }) => {
  const map = useMap();
  const hasFitted = useRef(false);

  useEffect(() => {
    if (start && end && !hasFitted.current) {
      const isValidCoord = (coord) =>
        coord && Array.isArray(coord) && isFinite(coord[0]) && isFinite(coord[1]);

      if (isValidCoord(start) && isValidCoord(end)) {
        try {
          const bounds = L.latLngBounds([start, end]);
          if (bounds.isValid() && !bounds.getSouthWest().equals(bounds.getNorthEast())) {
            map.fitBounds(bounds, { padding: [50, 50] });
          } else {
            map.setView(start, 15);
          }
          hasFitted.current = true;
        } catch (e) {
          console.error("Error fitting bounds:", e);
          map.setView(start, 15);
        }
      }
    }
  }, [start, end, map]);

  return null;
};

const DroneDelivery = ({ order, onDeliveryComplete }) => {
  const storageKeyArrived = `drone_arrived_${order._id}`;
  const storageKeyArrivedTime = `drone_arrived_time_${order._id}`;

  const isDeliveredState =
    order.orderStatus === "delivered" || Boolean(order.cargoChecked);

  const initialArrived = Boolean(
    order.qrScanned ||
    order.cargoChecked ||
    order.orderStatus === "delivered" ||
    localStorage.getItem(storageKeyArrived) === "true"
  );

  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [path, setPath] = useState([]);
  const [startAddress, setStartAddress] = useState("Đang tải địa chỉ nhà hàng...");
  const [endAddress, setEndAddress] = useState("Đang tải địa chỉ nhận hàng...");

  const [droneArrived, setDroneArrived] = useState(initialArrived);
  const [qrScanned, setQrScanned] = useState(Boolean(order.qrScanned || isDeliveredState));
  const [lidOpen, setLidOpen] = useState(false);
  const [canConfirm, setCanConfirm] = useState(isDeliveredState);
  const [showScanner, setShowScanner] = useState(false);

  // Tính thời gian countdown còn lại (5 phút = 300s)
  const calculateRemainingCountdown = () => {
    if (order.qrScanned || isDeliveredState) return 300;
    const savedTime = localStorage.getItem(storageKeyArrivedTime);
    if (savedTime) {
      const elapsed = Math.floor((Date.now() - Number(savedTime)) / 1000);
      return Math.max(0, 300 - elapsed);
    }
    return 300;
  };

  const [countdown, setCountdown] = useState(calculateRemainingCountdown);
  const [timeoutExpired, setTimeoutExpired] = useState(
    initialArrived && !order.qrScanned && !isDeliveredState && calculateRemainingCountdown() <= 0
  );

  const timeoutRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  const getCoordsFromAddress = async (address) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
        { headers: { 'User-Agent': 'DroneDeliveryApp/1.0' } }
      );
      const data = await response.json();
      if (data && data.length > 0) {
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      }
      return getRandomCoordinate();
    } catch (error) {
      console.error("Error geocoding address:", error);
      return getRandomCoordinate();
    }
  };

  useEffect(() => {
    if (!order || !order._id) return;

    const initializeDelivery = async () => {
      const storageKey = `drone_location_${order._id}`;

      const restaurant = order.restaurantId;
      const restaurantAddr = restaurant?.address || "Ho Chi Minh City, Vietnam";
      const shipping = order.shippingAddress;
      const customerAddr = shipping
        ? `${shipping.address}, ${shipping.city}, ${shipping.state}, ${shipping.country}`
        : "Ho Chi Minh City, Vietnam";

      setStartAddress(restaurantAddr);
      setEndAddress(customerAddr);

      const asCoord = (obj) =>
        obj && typeof obj.lat === "number" && typeof obj.lng === "number"
          ? [obj.lat, obj.lng]
          : null;

      let startPos = asCoord(restaurant);
      let endPos = asCoord(shipping);

      if (!startPos || !endPos) {
        const stored = JSON.parse(localStorage.getItem(storageKey) || "null");
        if (stored) {
          startPos = startPos || stored.start;
          endPos = endPos || stored.end;
        }
      }

      if (!startPos) startPos = await getCoordsFromAddress(restaurantAddr);
      if (!endPos) endPos = await getCoordsFromAddress(customerAddr);

      localStorage.setItem(
        storageKey,
        JSON.stringify({ start: startPos, end: endPos })
      );

      const straightPath = createStraightPath(startPos, endPos);
      setStart(startPos);
      setEnd(endPos);
      setPath(straightPath);
    };

    initializeDelivery();
  }, [order]);

  // Khởi chạy bộ đếm thời gian khi drone đã đến mà chưa quét QR
  useEffect(() => {
    if (initialArrived && !order.qrScanned && !isDeliveredState && countdown > 0) {
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            setTimeoutExpired(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      timeoutRef.current = setTimeout(async () => {
        setTimeoutExpired(true);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

        try {
          const url = import.meta.env.VITE_API_URL || "http://localhost:4000";
          const token = localStorage.getItem("token");

          await fetch(`${url}/api/order/status`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              orderId: order._id,
              status: "cancelled",
              reason: "Hết thời gian nhận hàng - Drone đã chờ tại điểm giao nhưng không nhận được xác nhận.",
            }),
          });
        } catch (error) {
          console.error("Error updating order status:", error);
        }

        toast.error("Hết thời gian nhận hàng. Đơn hàng đã bị hủy.");
        window.location.reload();
      }, countdown * 1000);
    }

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [initialArrived, order.qrScanned, isDeliveredState]);

  // Xử lý khi trang tải lại mà đơn hàng đã ở trạng thái delivered hoặc cargoChecked
  useEffect(() => {
    if (isDeliveredState) {
      setDroneArrived(true);
      setQrScanned(true);
      setLidOpen(false);
      setCanConfirm(true);
      if (onDeliveryComplete) {
        onDeliveryComplete();
      }
    } else if (order.qrScanned && !order.cargoChecked) {
      // Khách hàng vừa quét QR và reload trong vòng 5s nắp đang mở
      setDroneArrived(true);
      setQrScanned(true);
      setLidOpen(true);
      const timer = setTimeout(async () => {
        setLidOpen(false);
        setCanConfirm(true);
        try {
          const url = import.meta.env.VITE_API_URL || "http://localhost:4000";
          const token = localStorage.getItem("token");
          await fetch(`${url}/api/drone/confirm-delivery`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ orderId: order._id }),
          });
        } catch (e) {
          console.error("Auto confirm delivery error:", e);
        }
        toast.success("Đã hoàn tất nhận hàng từ Drone!");
        if (onDeliveryComplete) onDeliveryComplete();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isDeliveredState, order.qrScanned, order.cargoChecked, onDeliveryComplete]);

  // Xử lý khi drone vừa bay tới điểm giao lần đầu tiên
  const handleComplete = () => {
    setDroneArrived(true);
    localStorage.setItem(storageKeyArrived, "true");
    if (!localStorage.getItem(storageKeyArrivedTime)) {
      localStorage.setItem(storageKeyArrivedTime, String(Date.now()));
    }
    setCountdown(300);

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          setTimeoutExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      setTimeoutExpired(true);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

      try {
        const url = import.meta.env.VITE_API_URL || "http://localhost:4000";
        const token = localStorage.getItem("token");

        await fetch(`${url}/api/order/status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            orderId: order._id,
            status: "cancelled",
            reason: "Hết thời gian nhận hàng - Drone đã chờ tại điểm giao nhưng không nhận được xác nhận.",
          }),
        });
      } catch (error) {
        console.error("Error updating order status:", error);
      }

      toast.error("Hết thời gian nhận hàng. Đơn hàng đã bị hủy.");
      window.location.reload();
    }, 300000);
  };

  const handleScanQR = async (scannedCode = null) => {
    try {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

      const url = import.meta.env.VITE_API_URL || "http://localhost:4000";
      const token = localStorage.getItem("token");
      const qrCodeToVerify = scannedCode || order.qrCode;

      const response = await fetch(`${url}/api/drone/scan-qr`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: order._id,
          qrCode: qrCodeToVerify,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setQrScanned(true);
        setLidOpen(true);
        setShowScanner(false);

        // Sau 5s mở nắp khoang hàng, tự động đóng nắp và hoàn tất giao hàng
        setTimeout(async () => {
          setLidOpen(false);
          setCanConfirm(true);

          try {
            await fetch(`${url}/api/drone/confirm-delivery`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ orderId: order._id }),
            });
          } catch (e) {
            console.error("Error confirming delivery automatically:", e);
          }

          toast.success("Đã hoàn tất nhận hàng từ Drone! Đơn hàng đã giao thành công.");

          // Dọn dẹp storage
          localStorage.removeItem(storageKeyArrived);
          localStorage.removeItem(storageKeyArrivedTime);

          if (onDeliveryComplete) {
            onDeliveryComplete();
          }
        }, 5000);
      } else {
        toast.error(data.message || "Xác nhận mã QR thất bại");
      }
    } catch (error) {
      console.error("Error scanning QR:", error);
      toast.error("Xác nhận mã QR thất bại");
    }
  };

  const handleOpenScanner = () => setShowScanner(true);
  const handleCloseScanner = () => setShowScanner(false);
  const handleQRScanned = (scannedCode) => handleScanQR(scannedCode);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  if (!start) {
    return (
      <div className="drone-delivery-loading">
        <div className="loading-spinner"></div>
        <p>Đang tải lộ trình bay của Drone...</p>
      </div>
    );
  }

  return (
    <div className="drone-delivery-container">
      <div className="drone-delivery-header">
        <h3>Theo dõi hành trình Drone</h3>
        <div className="delivery-info">
          <p><strong>Xuất phát:</strong> {startAddress}</p>
          <p><strong>Điểm đến:</strong> {endAddress}</p>
          <p>
            <strong>Trạng thái:</strong>{" "}
            {isDeliveredState
              ? "Đã giao hàng thành công"
              : droneArrived
              ? "Drone đã đến điểm giao"
              : "Đang bay đến điểm giao (dự kiến ~10 giây)"}
          </p>
        </div>
      </div>

      <div className="drone-delivery-map-container">
        <MapContainer center={HCMC_CENTER} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
          {start && end && <MapBounds start={start} end={end} />}
          {path.length > 0 && <Polyline positions={path} color="#FF6B6B" weight={5} />}
          {start && (
            <Marker position={start} icon={L.divIcon({ html: "🏪", className: "", iconSize: [30, 30] })}>
              <Popup><strong>Nhà hàng:</strong><br/>{startAddress}</Popup>
            </Marker>
          )}
          {end && (
            <Marker position={end} icon={L.divIcon({ html: "🏠", className: "", iconSize: [30, 30] })}>
              <Popup><strong>Điểm nhận hàng:</strong><br/>{endAddress}</Popup>
            </Marker>
          )}
          {path.length > 0 && (
            <DroneAnimation
              path={path}
              onComplete={handleComplete}
              initialArrived={initialArrived}
            />
          )}
        </MapContainer>
      </div>

      {droneArrived && order.qrCode && (
        <div className="qr-section">
          <div className="qr-header">
            <h4>{isDeliveredState ? "Đã giao hàng thành công" : "Drone đã đến điểm giao! Vui lòng xác nhận"}</h4>
            {qrScanned && <span className="qr-status success">Đã xác nhận QR</span>}
          </div>

          <div className="qr-code-display">
            <div className="qr-code-box">
              <QRCodeSVG value={order.qrCode} size={200} level="H" marginSize={2} />
              <p className="qr-code-text">Mã QR của bạn: {order.qrCode}</p>
              <p className="qr-instruction">Đưa mã QR này cho camera của Drone để mở nắp khoang hàng</p>
            </div>

            {!qrScanned && !timeoutExpired && (
              <div className="qr-actions">
                <button type="button" className="scan-qr-btn camera" onClick={handleOpenScanner}>
                  Quét bằng Camera
                </button>
                <div className="confirm-button-wrapper">
                  <button type="button" className="scan-qr-btn manual" onClick={() => handleScanQR()}>
                    Xác nhận đã quét (Manual)
                  </button>
                  <span className={`countdown-timer ${countdown <= 30 ? 'urgent' : ''}`}>
                    {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                  </span>
                </div>
                <p className="timeout-warning">
                  Vui lòng nhận hàng trong vòng {Math.floor(countdown / 60)} phút {countdown % 60} giây
                </p>
              </div>
            )}
          </div>

          {qrScanned && (
            <div className="delivery-status">
              <div className={`status-item ${lidOpen ? 'active' : 'completed'}`}>
                <span className="status-icon">{lidOpen ? '🔓' : '🔒'}</span>
                <span className="status-text">
                  Nắp khoang hàng: {lidOpen ? 'Đang mở (5 giây)' : 'Đã đóng nắp an toàn'}
                </span>
              </div>
              {lidOpen && (
                <div className="countdown-message">
                  Nắp khoang hàng đang mở trong 5 giây. Vui lòng lấy món ăn ra khỏi khoang hàng ngay!
                </div>
              )}
              {(canConfirm || isDeliveredState) && !lidOpen && (
                <div className="confirm-message">
                  Đã lấy món thành công! Đơn hàng đã hoàn tất giao.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showScanner && (
        <QRScanner onScan={handleQRScanned} onClose={handleCloseScanner} expectedQRCode={order.qrCode} />
      )}
    </div>
  );
};

export default DroneDelivery;
