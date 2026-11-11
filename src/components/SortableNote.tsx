import { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Button } from "./ui/button";

type SortableNoteProps = {
  id: string;
  disabled: boolean;
  onClick: () => void;
  children: (handle: ReactNode) => ReactNode;
};

export function SortableNote({ id, disabled, onClick, children }: SortableNoteProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });

  return (
    <div
      ref={setNodeRef}
      data-note-id={id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onClick={onClick}
      className={`bg-card rounded-lg shadow-sm p-3 flex flex-col gap-2 ${
        disabled ? "" : "cursor-pointer hover:shadow-md"
      } ${isDragging ? "relative z-10 ring-2 ring-primary opacity-80" : ""}`}
    >
      {children(disabled ? null : (
        <Button
          ref={setActivatorNodeRef}
          type="button"
          variant="ghost"
          size="icon"
          className="h-12 w-12 shrink-0 -ml-3 -mt-2 touch-none cursor-grab active:cursor-grabbing text-muted-foreground"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          title="Drag to reorder"
          onClick={(event) => event.stopPropagation()}
        >
          <GripVertical size={16} />
        </Button>
      ))}
    </div>
  );
}