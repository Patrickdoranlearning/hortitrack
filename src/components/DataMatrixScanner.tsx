'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

type Props = {
  onResult: (text: string) => void;
  onError?: (err: unknown) => void;
  /** Start automatically (e.g. when a dialog opens) */
  autoStart?: boolean;
};

async function listVideoInputDevices(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter((d) => d.kind === 'videoinput');
}

export default function DataMatrixScanner({ onResult, onError, autoStart }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>();

  // guards to prevent loops / double starts in StrictMode
  const startedRef = useRef(false);
  const decodedOnceRef = useRef(false);
  const stoppingRef = useRef(false);

  // init reader with Data Matrix only
  useEffect(() => {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.DATA_MATRIX]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    readerRef.current = new BrowserMultiFormatReader(hints, 250);
    return () => {
      // full stop on unmount
      try {
        readerRef.current?.reset();
      } catch {}
      readerRef.current = null;
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks?.().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  // enumerate cameras once
  useEffect(() => {
    (async () => {
      try {
        const list = await listVideoInputDevices();
        setDevices(list);
        const back =
          list.find((d) => /back|rear|environment/i.test(d.label))?.deviceId ||
          list[0]?.deviceId;
        if (back) setSelectedDeviceId((prev) => prev ?? back);
      } catch (e) {
        onError?.(e);
      }
    })();
  }, [onError]);

  const stop = useCallback(() => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    try {
      readerRef.current?.reset();
    } catch {}
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks?.().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    startedRef.current = false;
    setTimeout(() => {
      // let any parent onResult state updates settle
      stoppingRef.current = false;
      decodedOnceRef.current = false;
    }, 0);
  }, []);

  const start = useCallback(async () => {
    if (!readerRef.current || !videoRef.current || !selectedDeviceId) return;
    if (startedRef.current) return; // guard double start
    startedRef.current = true;
    decodedOnceRef.current = false;

    try {
      await readerRef.current.decodeFromVideoDevice(
        selectedDeviceId,
        videoRef.current,
        (result, err, controls) => {
          // ignore "not found" scan noise
          if (result?.getText && !decodedOnceRef.current) {
            decodedOnceRef.current = true;
            const text = result.getText().trim();
            // stop FIRST, then notify parent (prevents setState loops)
            controls.stop();
            stop();
            onResult(text);
          }
        }
      );

      // try to improve focus / resolution
      const track = (videoRef.current.srcObject as MediaStream | null)
        ?.getVideoTracks?.()[0];
      await track?.applyConstraints({
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: { ideal: 'environment' },
        advanced: [{ focusMode: 'continuous' as any }],
      });
    } catch (e) {
      startedRef.current = false;
      onError?.(e);
    }
  }, [onResult, onError, selectedDeviceId, stop]);

  // optional auto start (e.g., when a Dialog opens)
  useEffect(() => {
    if (autoStart && selectedDeviceId) {
      // only start after a user gesture on iOS; if your dialog open comes
      // from a button click, this is fine. Otherwise, gate behind a Start button.
      start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, selectedDeviceId]);

  return (
    <div className="w-full">
      <div className="flex gap-2 items-center mb-3">
        <select
          className="w-full px-3 py-2 border rounded"
          value={selectedDeviceId}
          onChange={(e) => setSelectedDeviceId(e.target.value)}
          disabled={!devices.length}
        >
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || 'Camera'}
            </option>
          ))}
        </select>
        <button
          className="px-3 py-2 rounded bg-black text-white"
          onClick={start}
          disabled={!selectedDeviceId}
        >
          Start
        </button>
        <button className="px-3 py-2 rounded bg-gray-200" onClick={stop}>
          Stop
        </button>
        <label className="px-3 py-2 rounded bg-gray-100 cursor-pointer">
          From photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={async (e) => {
              try {
                const file = e.target.files?.[0];
                if (!file || !readerRef.current) return;
                const img = new Image();
                img.onload = async () => {
                  try {
                    const res = await readerRef.current!.decodeFromImageElement(img);
                    const text = res.getText().trim();
                    onResult(text);
                  } catch (err) {
                    onError?.(err);
                  }
                };
                img.onerror = onError as any;
                img.src = URL.createObjectURL(file);
                e.currentTarget.value = '';
              } catch (err) {
                onError?.(err);
              }
            }}
          />
        </label>
      </div>

      <div className="relative w-full rounded overflow-hidden border bg-black">
        <video
          ref={videoRef}
          className="block w-full h-[52vw] max-h-[60vh] object-cover"
          muted
          autoPlay
          playsInline
        />
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="w-48 h-48 max-w-[65%] max-h-[65%] border-2 border-white/70 rounded" />
        </div>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        Tip: Fill the square, keep steady, and use good lighting.
      </p>
    </div>
  );
}
