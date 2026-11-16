# Architecture

- Use dnd-kit sortable notes with handle-only pointer and keyboard sensors so touch dragging works without blocking card scrolling or editing.
- Keep household summaries in a read-only presentation helper; overview counts must never change task filters, ordering, or persistence.
- Use the shared app shell and semantic section tokens for responsive list layout and navigation, keeping existing action handlers intact.