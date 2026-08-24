"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { COUNTRY_DIALS, composePhone, splitPhone } from "@/lib/phone-countries";

export function PhoneField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const parts = splitPhone(value);
  const selected = COUNTRY_DIALS.find((item) => item.code === parts.code) || COUNTRY_DIALS[0];
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 24);
    const maxHeight = Math.min(288, window.innerHeight * 0.42);
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
    const below = rect.bottom + 8;
    const top = below + maxHeight > window.innerHeight - 12 ? Math.max(12, rect.top - 8 - maxHeight) : below;
    setMenuStyle({ top, left, width, maxHeight });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    selectedRef.current?.scrollIntoView({ block: "nearest" });
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="phone-field" ref={rootRef}>
      <div className="phone-field-code-wrap">
        <button
          ref={triggerRef}
          type="button"
          className={`booth-input phone-field-code${open ? " is-open" : ""}`}
          aria-label="Country code"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
        >
          <span>{selected.label}</span>
        </button>
        {open ? (
          <div className="phone-field-menu" role="listbox" aria-label="Country code" style={menuStyle}>
            {COUNTRY_DIALS.map((item) => {
              const active = item.code === selected.code;
              return (
                <button
                  key={item.code}
                  ref={active ? selectedRef : undefined}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`phone-field-option${active ? " selected" : ""}`}
                  onClick={() => {
                    onChange(composePhone(item.code, parts.national));
                    setOpen(false);
                  }}
                >
                  <span>{item.label.replace(` ${item.code}`, "")}</span>
                  <span>{item.code}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <input
        className="booth-input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="tel-national"
        enterKeyHint="done"
        disabled={disabled}
        value={parts.national}
        onChange={(event) => onChange(composePhone(parts.code, event.target.value.replace(/\D/g, "")))}
        placeholder="5550100"
      />
    </div>
  );
}
