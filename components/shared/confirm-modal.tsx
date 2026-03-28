"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Input, TextField } from "@heroui/react";
import { AlertTriangle } from "lucide-react";

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  confirmMatch,
  variant = "danger",
  loading = false
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  confirmMatch?: string;
  variant?: "danger" | "warning";
  loading?: boolean;
}) {
  const [inputValue, setInputValue] = useState("");
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const needsMatch = !!confirmMatch;
  const isMatch = !needsMatch || inputValue === confirmMatch;

  useEffect(() => { setMounted(true); }, []);

  // Reset input when modal opens
  useEffect(() => {
    if (open) {
      setInputValue("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, loading, onClose]);

  if (!mounted || !open) return null;

  const colors = {
    danger: {
      icon: "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400",
      button: "bg-red-600 hover:bg-red-700 text-white",
      border: "border-red-400 dark:border-red-600"
    },
    warning: {
      icon: "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
      button: "bg-amber-600 hover:bg-amber-700 text-white",
      border: "border-amber-400 dark:border-amber-600"
    }
  }[variant];

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => !loading && onClose()}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md mx-4 animate-in zoom-in-95 fade-in duration-200">
        <div className="overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-zinc-900 dark:ring-1 dark:ring-white/10">
          <div className="p-8">
            {/* Icon */}
            <div className="flex justify-center">
              <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${colors.icon}`}>
                <AlertTriangle className="h-8 w-8" />
              </div>
            </div>

            {/* Title & Description */}
            <div className="mt-6 text-center">
              <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{description}</p>
            </div>

            {/* Confirm input */}
            {needsMatch && (
              <div className="mt-6">
                <p className="mb-3 text-center text-xs text-muted">
                  Type{" "}
                  <code className="rounded-lg bg-black/5 px-2 py-1 font-bold dark:bg-white/10">
                    {confirmMatch}
                  </code>{" "}
                  to confirm
                </p>
                <TextField>
                  <Input
                    ref={inputRef}
                    className={`w-full rounded-2xl border-2 bg-transparent px-4 py-3 text-center font-mono text-sm transition-all focus:outline-none ${
                      inputValue && inputValue === confirmMatch
                        ? colors.border
                        : "border-black/10 dark:border-white/10"
                    }`}
                    placeholder={confirmMatch}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && isMatch && !loading && onConfirm()}
                  />
                </TextField>
              </div>
            )}

            {/* Buttons */}
            <div className="mt-8 flex gap-3">
              <Button
                className="flex-1 h-12 rounded-2xl font-medium"
                variant="ghost"
                onPress={onClose}
                isDisabled={loading}
              >
                Cancel
              </Button>
              <Button
                className={`flex-1 h-12 rounded-2xl font-medium transition-opacity ${colors.button} ${
                  !isMatch ? "opacity-40 cursor-not-allowed" : ""
                }`}
                isDisabled={!isMatch || loading}
                onPress={onConfirm}
              >
                {loading ? "Deleting..." : confirmText}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
