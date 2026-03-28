"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@heroui/react";
import { X } from "lucide-react";

export function RightSheet({
  open,
  onClose,
  title,
  children
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Animate in/out
  useEffect(() => {
    if (open) {
      // Trigger enter animation on next frame
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const sheet = (
    <div className="fixed inset-0 z-[9998]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity duration-200"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="absolute right-0 top-0 flex h-full w-full max-w-[480px] flex-col bg-white shadow-2xl transition-transform dark:bg-zinc-900 dark:ring-1 dark:ring-white/10"
        style={{
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transitionDuration: visible ? "200ms" : "150ms",
          transitionTimingFunction: "ease-out"
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/5 px-6 py-4 dark:border-white/10">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <Button
            isIconOnly
            className="rounded-full text-muted hover:text-foreground"
            size="sm"
            variant="ghost"
            onPress={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
