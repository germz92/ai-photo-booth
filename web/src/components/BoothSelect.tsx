"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { menuContains, useAnchoredMenu } from "@/lib/anchored-menu";

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
  const { triggerRef, menuRef, style, update } = useAnchoredMenu(open);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: PointerEvent) => {
      if (!menuContains(triggerRef, menuRef, event.target)) setOpen(false);
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
  }, [open, menuRef, triggerRef]);

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <div className="booth-select-menu" role="listbox" aria-label={label || placeholder} ref={menuRef} style={style}>
            {options.map((item) => {
              const active = item.value === value;
              return (
                <button
                  key={item.value}
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
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={`booth-select${className ? ` ${className}` : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`booth-input booth-select-trigger${open ? " is-open" : ""}`}
        aria-label={label || placeholder}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          update(options.length * 44 + 12);
          setOpen(true);
        }}
      >
        <span className={selected ? "" : "is-placeholder"}>{selected?.label || placeholder}</span>
      </button>
      {menu}
    </div>
  );
}
