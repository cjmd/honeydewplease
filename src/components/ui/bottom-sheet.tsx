import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

export function BottomSheet({ open, onOpenChange, children, className }: BottomSheetProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragDelta = useRef(0);
  const isDragging = useRef(false);

  // Open: mount then animate in
  useEffect(() => {
    if (open) {
      setVisible(true);
      // Force reflow before animating
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating(true));
      });
    } else {
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [visible]);

  const dismiss = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // Touch handlers for drag-to-dismiss on the handle
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    isDragging.current = true;
    dragStartY.current = e.touches[0].clientY;
    dragDelta.current = 0;
    if (sheetRef.current) {
      sheetRef.current.style.transition = "none";
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    dragDelta.current = Math.max(0, delta); // Only allow dragging down
    if (sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${dragDelta.current}px)`;
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const sheet = sheetRef.current;
    if (!sheet) return;

    sheet.style.transition = "transform 300ms ease-out";
    const sheetHeight = sheet.offsetHeight;
    if (dragDelta.current > sheetHeight * 0.3) {
      // Dismiss
      sheet.style.transform = `translateY(100%)`;
      setTimeout(dismiss, 300);
    } else {
      // Snap back
      sheet.style.transform = "translateY(0)";
    }
    dragDelta.current = 0;
  }, [dismiss]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/80 transition-opacity duration-300",
          animating ? "opacity-100" : "opacity-0"
        )}
        onClick={dismiss}
      />
      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          "absolute inset-x-0 bottom-0 flex max-h-[90dvh] flex-col rounded-t-[10px] border bg-background transition-transform duration-300 ease-out",
          animating ? "translate-y-0" : "translate-y-full",
          className
        )}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center pt-4 pb-0 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="h-2 w-[100px] shrink-0 rounded-full bg-muted" />
        </div>
        {children}
      </div>
    </div>
  );
}

export function BottomSheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)} {...props} />;
}

export function BottomSheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />;
}
