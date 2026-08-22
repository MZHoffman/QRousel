import { useEffect, useRef } from "react";

type QrLibrary = {
  (version: number, correction: "H"): {
    addData(value: string): void;
    make(): void;
    getModuleCount(): number;
    isDark(row: number, column: number): boolean;
  };
};

declare global {
  interface Window { qrcode?: QrLibrary; }
}

let loader: Promise<void> | null = null;
function loadQrLibrary(): Promise<void> {
  if (window.qrcode) return Promise.resolve();
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("QR code renderer could not load."));
    document.head.append(script);
  });
  return loader;
}

export default function QrCodeCanvas({ content, color, version }: { content: string; color: string; version: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let active = true;
    void loadQrLibrary().then(() => {
      if (!active || !canvasRef.current || !window.qrcode) return;
      let qr;
      try { qr = window.qrcode(version, "H"); qr.addData(content || " "); qr.make(); }
      catch { qr = window.qrcode(0, "H"); qr.addData(content || " "); qr.make(); }
      const modules = qr.getModuleCount(), padding = 2, unit = Math.max(6, Math.ceil(512 / (modules + padding * 2))), size = (modules + padding * 2) * unit;
      const canvas = canvasRef.current, context = canvas.getContext("2d");
      if (!context) return;
      canvas.width = size; canvas.height = size;
      context.fillStyle = "#FFFFFF"; context.fillRect(0, 0, size, size); context.fillStyle = color;
      for (let row = 0; row < modules; row += 1) for (let column = 0; column < modules; column += 1) if (qr.isDark(row, column)) context.fillRect((column + padding) * unit, (row + padding) * unit, unit, unit);
    });
    return () => { active = false; };
  }, [color, content, version]);
  return <canvas className="qr-code-canvas" ref={canvasRef} aria-label="QR code preview" />;
}
