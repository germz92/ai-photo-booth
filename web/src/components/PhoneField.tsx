"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { menuContains, useAnchoredMenu } from "@/lib/anchored-menu";
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
  const { triggerRef, menuRef, style, update } = useAnchoredMenu(open, { maxWidth: 360 });

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

  useLayoutEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    const active = menu?.querySelector<HTMLElement>(".phone-field-option.selected");
    if (!menu || !active) return;
    const menuRect = menu.getBoundingClientRect();
    const selRect = active.getBoundingClientRect();
    if (selRect.top < menuRect.top) menu.scrollTop -= menuRect.top - selRect.top;
    else if (selRect.bottom > menuRect.bottom) menu.scrollTop += selRect.bottom - menuRect.bottom;
  }, [open, menuRef]);

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <div className="phone-field-menu" role="listbox" aria-label="Country code" ref={menuRef} style={style}>
            {COUNTRY_DIALS.map((item) => {
              const active = item.code === selected.code;
              return (
                <button
                  key={item.code}
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
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="phone-field">
      <div className="phone-field-code-wrap">
        <button
          ref={triggerRef}
          type="button"
          className={`booth-input phone-field-code${open ? " is-open" : ""}`}
          aria-label="Country code"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => {
            if (open) {
              setOpen(false);
              return;
            }
            update(288);
            setOpen(true);
          }}
        >
          <span>{selected.label}</span>
        </button>
        {menu}
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
