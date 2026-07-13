import { Camera, CameraOff, FlashlightOff, Flashlight, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface QRScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasFlash, setHasFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [scanning, setScanning] = useState(false);
  const scanIntervalRef = useRef<number | null>(null);

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setScanning(true);

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.();
      if (capabilities && 'torch' in capabilities) {
        setHasFlash(true);
      }

      startScanning();
    } catch (err) {
      console.error('Camera error:', err);
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Kamerazugriff verweigert. Bitte erlauben Sie den Zugriff in den Browser-Einstellungen.');
        } else if (err.name === 'NotFoundError') {
          setError('Keine Kamera gefunden.');
        } else {
          setError(`Kamerafehler: ${err.message}`);
        }
      }
      setScanning(false);
    }
  }, []);

  const startScanning = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const hasBarcodeDetector = 'BarcodeDetector' in window;

    const scan = async () => {
      if (!video.videoWidth || !video.videoHeight) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      try {
        if (hasBarcodeDetector) {
          const barcodeDetector = new (window as unknown as { BarcodeDetector: new (options?: { formats: string[] }) => { detect: (source: HTMLCanvasElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector({
            formats: ['qr_code'],
          });
          const barcodes = await barcodeDetector.detect(canvas);
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            if (code) {
              stopCamera();
              onScan(code);
              return;
            }
          }
        }
      } catch (e) {
        console.warn('BarcodeDetector error:', e);
      }
    };

    scanIntervalRef.current = window.setInterval(scan, 250);
  }, [onScan, stopCamera]);

  const toggleFlash = useCallback(async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      await track.applyConstraints({
        advanced: [{ torch: !flashOn } as MediaTrackConstraintSet],
      });
      setFlashOn(!flashOn);
    } catch (e) {
      console.warn('Flash toggle failed:', e);
    }
  }, [flashOn]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between p-4">
        <h2 className="text-lg font-semibold text-white">QR-Code scannen</h2>
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="rounded-full bg-white/20 p-2 text-white"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="relative flex-1">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <CameraOff className="h-16 w-16 text-bc-danger" />
            <p className="mt-4 text-white">{error}</p>
            <button
              type="button"
              onClick={startCamera}
              className="btn-primary mt-6"
            >
              Erneut versuchen
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              playsInline
              muted
              autoPlay
            />
            <canvas ref={canvasRef} className="hidden" />

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-64 w-64">
                <div className="absolute left-0 top-0 h-8 w-8 border-l-4 border-t-4 border-bc-accent" />
                <div className="absolute right-0 top-0 h-8 w-8 border-r-4 border-t-4 border-bc-accent" />
                <div className="absolute bottom-0 left-0 h-8 w-8 border-b-4 border-l-4 border-bc-accent" />
                <div className="absolute bottom-0 right-0 h-8 w-8 border-b-4 border-r-4 border-bc-accent" />
                {scanning && (
                  <div className="absolute inset-x-0 top-1/2 h-0.5 animate-pulse bg-bc-accent" />
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-center gap-6 p-6">
        {hasFlash && (
          <button
            type="button"
            onClick={toggleFlash}
            className="flex flex-col items-center gap-1 text-white"
          >
            {flashOn ? (
              <Flashlight className="h-8 w-8 text-bc-warn" />
            ) : (
              <FlashlightOff className="h-8 w-8" />
            )}
            <span className="text-xs">Blitz</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="flex flex-col items-center gap-1 text-white"
        >
          <Camera className="h-8 w-8" />
          <span className="text-xs">Manuell</span>
        </button>
      </div>

      <p className="px-6 pb-6 text-center text-sm text-white/70">
        Halten Sie den QR-Code der Ladesäule in den Rahmen
      </p>
    </div>
  );
}
