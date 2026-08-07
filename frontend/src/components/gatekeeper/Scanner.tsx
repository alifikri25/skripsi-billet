"use client";

import dynamic from "next/dynamic";
import type { IDetectedBarcode } from "@yudiel/react-qr-scanner";

const QRScanner = dynamic(() => import("@yudiel/react-qr-scanner").then((mod) => mod.Scanner), {
  ssr: false,
});
import { useState } from "react";
import { AlertCircle, CheckCircle2, ScanLine } from "lucide-react";

interface ScannerProps {
  onScan: (address: string) => void;
}

export function Scanner({ onScan }: ScannerProps) {
  const [error, setError] = useState<string | null>(null);

  const handleScan = (detectedCodes: IDetectedBarcode[]) => {
    if (detectedCodes && detectedCodes.length > 0) {
      const value = detectedCodes[0].rawValue;
      // Basic validation for Ethereum address format
      if (/^0x[a-fA-F0-9]{40}$/.test(value)) {
        setError(null);
        onScan(value);
      } else {
        setError("Bukan format alamat dompet (Address) yang valid.");
      }
    }
  };

  const handleError = (err: unknown) => {
    console.error(err);
    setError("Gagal mengakses kamera. Pastikan izin kamera diberikan.");
  };

  return (
    <div className="relative w-full max-w-sm mx-auto overflow-hidden rounded-3xl bg-bark border-4 border-bark/10 shadow-2xl">
      <div className="absolute top-0 inset-x-0 h-16 bg-linear-to-b from-black/50 to-transparent z-10 flex items-center justify-center pointer-events-none">
        <div className="flex items-center gap-2 text-white/90">
          <ScanLine className="w-4 h-4" />
          <span className="text-sm font-semibold tracking-wide">Pindai QR Address</span>
        </div>
      </div>
      
      <QRScanner
        onScan={handleScan}
        onError={handleError}
      />
      
      {error && (
        <div className="absolute bottom-4 left-4 right-4 z-20">
          <div className="bg-red-500/90 backdrop-blur-sm text-white px-4 py-3 rounded-xl shadow-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium leading-tight">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
