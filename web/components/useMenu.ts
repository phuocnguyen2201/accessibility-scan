"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Menu-button behaviour (WAI-ARIA menu pattern): opens on click or ArrowDown, focuses the first item,
 * arrow keys move between items, Escape closes and returns focus, Tab or an outside click closes.
 */
export function useMenu() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const buttonProps = {
    ref: buttonRef,
    type: "button" as const,
    "aria-haspopup": "menu" as const,
    "aria-expanded": open,
    "aria-controls": open ? `${id}-menu` : undefined,
    onClick: () => setOpen((o) => !o),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
    },
  };

  const menuProps = {
    ref: menuRef,
    id: `${id}-menu`,
    role: "menu" as const,
    onKeyDown: (e: React.KeyboardEvent) => {
      const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
      const i = items.indexOf(document.activeElement as HTMLElement);
      if (e.key === "Escape" || e.key === "Tab") {
        if (e.key === "Escape") e.preventDefault();
        close(e.key === "Escape");
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const next = (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
      }
    },
  };

  return { open, close, id, buttonRef, buttonProps, menuProps };
}
