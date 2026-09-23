"use client";

import { useEffect, useState } from "react";

function isStandaloneDisplay() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function PwaInstallHint({ compact = false }: { compact?: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandaloneDisplay() || sessionStorage.getItem("pwa-install-hint") === "1") return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  function dismiss() {
    sessionStorage.setItem("pwa-install-hint", "1");
    setVisible(false);
  }

  return (
    <div className={`pwa-install-hint${compact ? " is-compact" : ""}`} role="note">
      <p>
        Install Lumetry once on this iPad: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
        Open any event from there.
      </p>
      <button type="button" className="pwa-install-dismiss" onClick={dismiss}>
        Dismiss
      </button>
    </div>
  );
}
