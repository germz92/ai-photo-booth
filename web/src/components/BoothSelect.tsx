"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

export type BoothSelectOption = {
  value: string;
  label: string;
};

export function BoothSelect({
  value,
  onChange,
  options,
  placeholder = "Select",
  disabled,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: BoothSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  const selected = options.find((item) => item.value === value);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.min(rect.width, window.innerWidth - 24);
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
    <div className={`booth-select${className ? ` ${className}` : ""}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`booth-input booth-select-trigger${open ? " is-open" : ""}`}
        aria-label={label || placeholder}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={selected ? "" : "is-placeholder"}>{selected?.label || placeholder}</span>
      </button>
      {open ? (
        <div className="booth-select-menu" role="listbox" aria-label={label || placeholder} style={menuStyle}>
          {options.map((item) => {
            const active = item.value === value;
            return (
              <button
                key={item.value}
                ref={active ? selectedRef : undefined}
                type="button"
                role="option"
                aria-selected={active}
                className={`booth-select-option${active ? " selected" : ""}`}
                onClick={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
