

## Replace vaul drawer with custom bottom sheet

The vaul library doesn't reliably handle dynamic content height on mobile. We'll build a lightweight custom bottom sheet component that handles this natively.

### New component: `src/components/ui/bottom-sheet.tsx`

A custom bottom sheet built with plain CSS transforms and touch events:
- **Backdrop overlay** with fade animation
- **Sheet panel** that slides up from bottom using `transform: translateY()`
- **Drag handle** at top — drag down to dismiss (touch events: `touchstart`, `touchmove`, `touchend`)
- **Auto-height** — no fixed height measurement; the sheet simply grows with content using `max-h-[90dvh]` and `overflow-y-auto`
- **Snap behavior** — if dragged more than 30% down, dismiss; otherwise snap back
- Props: `open`, `onOpenChange`, `children`

### Update: `src/components/AddTaskDialog.tsx`

- Replace `Drawer`/`DrawerContent`/`DrawerHeader`/`DrawerFooter` imports with the new `BottomSheet` component
- Keep all form logic, state, and layout identical
- The "More options" expand/collapse will work naturally since the sheet auto-sizes to content without any height measurement tricks

### Technical approach

The bottom sheet will use:
- `position: fixed; bottom: 0` with `transform: translateY()` for open/close animation
- CSS `transition` for smooth open/close (300ms ease-out)
- Touch event handlers on the drag handle for swipe-to-dismiss
- `requestAnimationFrame` during drag for smooth tracking
- No `ResizeObserver`, no height snapping — content dictates height naturally

