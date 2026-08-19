"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCodeImage({
  value,
  size = 280,
  alt = "QR code",
}: {
  value: string;
  size?: number;
  alt?: string;
}) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: "#0a0a0a", light: "#ffffff" },
    }).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!src) {
    return <div className="bg-white/10" style={{ width: size, height: size }} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} width={size} height={size} alt={alt} className="rounded bg-white p-2" />
  );
}
