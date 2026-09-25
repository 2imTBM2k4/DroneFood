import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import "./QRScanner.css";

const QRScanner = ({ onScan, onClose, expectedQRCode }) => {
  const [error, setError] = useState(null);
  const qrScannerRef = useRef(null);
  const hasScanned = useRef(false);
  const onScanRef = useRef(onScan);
  const expectedQRCodeRef = useRef(expectedQRCode);

  useEffect(() => {
    onScanRef.current = onScan;
    expectedQRCodeRef.current = expectedQRCode;
  }, [onScan, expectedQRCode]);

  useEffect(() => {
    let scanner = null;

    const initScanner = () => {
      const qrReaderElement = document.getElementById("qr-reader");
      if (!qrReaderElement) {
        setError("Camera element not found. Please try again.");
        return;
      }

      scanner = new Html5QrcodeScanner(
        "qr-reader",
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          disableFlip: false,
          rememberLastUsedCamera: true,
        },
        false
      );

      qrScannerRef.current = scanner;

      const onScanSuccess = (decodedText) => {
        if (hasScanned.current) return;

        if (decodedText === expectedQRCodeRef.current) {
          hasScanned.current = true;
          scanner.clear().catch(console.error);
          onScanRef.current(decodedText);
        } else {
          setError(`Invalid QR code! Scanned: ${decodedText.substring(0, 16)}...`);
          setTimeout(() => setError(null), 3000);
        }
      };

      const onScanError = (errorMessage) => {
        if (errorMessage.includes("NotAllowedError")) {
          setError("Camera access denied.");
        } else if (errorMessage.includes("NotFoundError")) {
          setError("Camera not found.");
        }
      };

      try {
        scanner.render(onScanSuccess, onScanError);
      } catch (err) {
        console.error("Error initializing scanner:", err);
        setError("Camera initialization failed. Please try again.");
      }
    };

    const timer = setTimeout(initScanner, 100);

    return () => {
      clearTimeout(timer);
      if (qrScannerRef.current) {
        qrScannerRef.current.clear().catch(console.error);
        qrScannerRef.current = null;
        hasScanned.current = false;
      }
    };
  }, []);

  return (
    <div className="qr-scanner-overlay">
      <div className="qr-scanner-container">
        <div className="qr-scanner-header">
          <h3>Scan QR Code</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="qr-scanner-content">
          <div id="qr-reader"></div>
          {error && (
            <div className="qr-scanner-error">
              <p>{error}</p>
            </div>
          )}
          <div className="qr-scanner-instructions">
            <p>Point your camera at the QR code to scan</p>
            <p className="qr-scanner-hint">The QR code must match the one displayed on screen</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
