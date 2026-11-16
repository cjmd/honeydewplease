import { Task } from "../App";
import { Checkbox } from "./ui/checkbox";
import { Badge } from "./ui/badge";
import { Flag, ListChecks, ShoppingCart, User } from "lucide-react";
import { useState } from "react";

type TaskItemProps = {
  task: Task;
  onClick: () => void;
  onToggle: (completed: boolean) => void;
  showTypeIcon?: boolean;
  assigneeName?: string | null;
  compact?: boolean;
};

export function TaskItem({ task, onClick, onToggle, showTypeIcon = false, assigneeName, compact = false }: TaskItemProps) {
  const [isChecking, setIsChecking] = useState(false);
  const displayCompleted = task.completed || isChecking;

  const handleToggle = (completed: boolean) => {
    if (!task.completed && completed) {
      // Show checked state first
      setIsChecking(true);
      setTimeout(() => {
        onToggle(completed);
      }, 600);
    } else {
      onToggle(completed);
    }
  };

  return (
    <div
      className={`task-card box-border flex gap-2 items-start bg-card px-4 py-4 relative shrink-0 w-full rounded-lg cursor-pointer ${displayCompleted ? "bg-muted/50" : ""}`}
      onClick={onClick}
    >
      <div className={`flex items-start w-full ${task.isPriority && !task.completed ? 'gap-[4px]' : 'gap-[12px]'}`}>
        <div className="flex items-center gap-[4px] shrink-0 pt-[2px]">
          {task.isPriority && !task.completed && (
            <Flag className="text-attention" size={16} />
          )}
          {showTypeIcon && (
            task.type === "todo" ? (
              <ListChecks className="text-todo" size={16} />
            ) : (
              <ShoppingCart className="text-shopping" size={16} />
            )
          )}
        </div>
        <div className="flex flex-col gap-[4px] flex-1 min-w-0">
          <div className="flex items-start gap-[8px]">
            <p
              className={`text-[16px] flex-1 break-words ${
                displayCompleted ? "line-through text-muted-foreground" : "text-foreground"
              }`}
            >
              {task.title}
            </p>
          </div>
          {task.details && (
            <p className={`text-[14px] text-muted-foreground break-words whitespace-pre-line ${compact ? "line-clamp-2" : ""}`}>
              {task.details}
            </p>
          )}
          {task.images && task.images.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-[4px]">
              {task.images.slice(0, 4).map((url) => (
                <img
                  key={url}
                  src={url}
                  alt="Task attachment"
                  className="h-10 w-10 rounded object-cover border border-border"
                />
              ))}
              {task.images.length > 4 && (
                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center text-[11px] text-muted-foreground">
                  +{task.images.length - 4}
                </div>
              )}
            </div>
          )}
          {assigneeName && (
            <div className="flex items-center gap-[4px] mt-[4px]">
              <User size={12} className="text-muted-foreground" />
              <span className="text-[12px] text-muted-foreground">{assigneeName}</span>
            </div>
          )}
          {task.dueDate && !task.completed && (
            <p className="text-[12px] text-muted-foreground mt-[2px]">
              Due: {new Date(task.dueDate).toLocaleDateString()}
            </p>
          )}
        </div>
        <div
          className="flex items-center justify-center relative shrink-0 -mr-2 -my-2 p-3 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            handleToggle(!task.completed);
          }}
        >
          <Checkbox checked={displayCompleted} aria-label={`${task.completed ? "Restore" : "Complete"} ${task.title}`} />
        </div>
      </div>
    </div>
  );
}
