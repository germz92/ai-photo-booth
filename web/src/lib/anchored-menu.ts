import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

type PlaceOptions = {
  maxWidth?: number;
  maxMenuHeight?: number;
};

export function placeAnchoredMenu(trigger: DOMRect, menuHeight: number, options: PlaceOptions = {}): CSSProperties {
  const pad = 8;
  const gap = 4;
  const maxMenuHeight = options.maxMenuHeight ?? 288;
  const width = Math.min(options.maxWidth ?? trigger.width, window.innerWidth - pad * 2);
  const viewportLeft = Math.min(Math.max(pad, trigger.left), window.innerWidth - width - pad);
  const spaceBelow = window.innerHeight - trigger.bottom - pad;
  const spaceAbove = trigger.top - pad;
  const height = menuHeight > 0 ? menuHeight : Math.min(140, maxMenuHeight);
  const openBelow = spaceBelow >= height || spaceBelow >= spaceAbove;
  const maxHeight = Math.max(72, Math.min(maxMenuHeight, openBelow ? spaceBelow : spaceAbove));
  const used = Math.min(height, maxHeight);
  return {
    position: "absolute",
    top: (openBelow ? trigger.bottom + gap : Math.max(pad, trigger.top - gap - used)) + window.scrollY,
    left: viewportLeft + window.scrollX,
    width,
    maxHeight,
  };
}

export function useAnchoredMenu(open: boolean, { maxWidth, maxMenuHeight }: PlaceOptions = {}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({});

  const update = useCallback(
    (menuHeight?: number) => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const height = menuHeight ?? menuRef.current?.offsetHeight ?? 0;
      setStyle(placeAnchoredMenu(trigger.getBoundingClientRect(), height, { maxWidth, maxMenuHeight }));
    },
    [maxMenuHeight, maxWidth],
  );

  useLayoutEffect(() => {
    if (!open) return undefined;
    update();
    const onWin = (event: Event) => {
      if (event.target === menuRef.current || (event.target instanceof Node && menuRef.current?.contains(event.target))) {
        return;
      }
      update();
    };
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open, update]);

  return { triggerRef, menuRef, style, update };
}

export function menuContains(
  rootRef: { current: HTMLElement | null },
  menuRef: { current: HTMLElement | null },
  target: EventTarget | null,
) {
  const node = target as Node | null;
  return Boolean(node && (rootRef.current?.contains(node) || menuRef.current?.contains(node)));
}
