"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCodeImage({
  value,
  size = 280,
  alt = "QR code",
  className = "",
}: {
  value: string;
  size?: number;
  alt?: string;
  className?: string;
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
    return <div className={`bg-white/10 ${className}`} style={{ width: size, height: size, maxWidth: "100%" }} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} width={size} height={size} alt={alt} className={`max-w-full rounded bg-white p-2 ${className}`} />
  );
}
