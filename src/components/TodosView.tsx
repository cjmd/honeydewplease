import { useState, useEffect } from "react";
import { Task, ViewType } from "../App";
import { TaskItem } from "./TaskItem";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ListChecks, Settings, ArrowUpDown, Filter, Check } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Separator } from "./ui/separator";

type TodosViewProps = {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onTaskToggle: (taskId: string, completed: boolean) => void;
  onReorder: (taskOrders: { id: string; order: number }[]) => void;
  onViewChange: (view: ViewType) => void;
  onOpenSettingsMenu: () => void;
  workspaceMembers?: Record<string, string>;
};

type SortBy = "order" | "dueDate" | "createdAt" | "priority";
type FilterBy = "all" | "active" | "completed" | "priority";

function DraggableTaskItem({
  task,
  index,
  moveTask,
  onClick,
  onToggle,
  isDraggable,
  assigneeName,
}: {
  task: Task;
  index: number;
  moveTask: (dragIndex: number, hoverIndex: number) => void;
  onClick: () => void;
  onToggle: (completed: boolean) => void;
  isDraggable: boolean;
  assigneeName?: string | null;
}) {
  const [{ isDragging }, drag] = useDrag({
    type: "task",
    item: { index },
    canDrag: isDraggable,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: "task",
    canDrop: () => isDraggable,
    hover: (item: { index: number }) => {
      if (item.index !== index) {
        moveTask(item.index, index);
        item.index = index;
      }
    },
  });

  return (
    <div 
      ref={isDraggable ? (node) => drag(drop(node)) : null} 
      style={{ opacity: isDragging ? 0.5 : 1 }} 
      className={`w-full ${isDraggable ? 'cursor-move' : ''}`}
    >
      <TaskItem task={task} onClick={onClick} onToggle={onToggle} assigneeName={assigneeName} />
    </div>
  );
}

export function TodosView({ tasks, onTaskClick, onTaskToggle, onReorder, onViewChange, onOpenSettingsMenu, workspaceMembers = {} }: TodosViewProps) {
  const [sortBy, setSortBy] = useState<SortBy>("order");
  const [filterBy, setFilterBy] = useState<FilterBy>("active");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("all");
  const [localTasks, setLocalTasks] = useState(tasks);

  // Update local tasks when props change
  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  // Get all unique tags from tasks
  const allTags = Array.from(new Set(localTasks.flatMap(task => task.tags))).sort();

  // Filter tasks
  const filteredTasks = localTasks.filter((task) => {
    // Filter by status
    let statusMatch = true;
    if (filterBy === "active") statusMatch = !task.completed;
    else if (filterBy === "completed") statusMatch = task.completed;
    else if (filterBy === "priority") statusMatch = task.isPriority && !task.completed;
    
    // Filter by tag
    const tagMatch = selectedTag === "all" || task.tags.includes(selectedTag);
    
    // Filter by assignee
    const assigneeMatch = selectedAssignee === "all" || 
      (selectedAssignee === "unassigned" ? !task.assignedTo : task.assignedTo === selectedAssignee);
    
    return statusMatch && tagMatch && assigneeMatch;
  });

  // Sort tasks
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (sortBy === "order") return a.order - b.order;
    if (sortBy === "priority") {
      if (a.isPriority && !b.isPriority) return -1;
      if (!a.isPriority && b.isPriority) return 1;
      return a.order - b.order;
    }
    if (sortBy === "dueDate") {
      if (!a.dueDate && !b.dueDate) return a.order - b.order;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    if (sortBy === "createdAt") {
      return b.createdAt - a.createdAt; // Newest first
    }
    return 0;
  });

  const moveTask = (dragIndex: number, hoverIndex: number) => {
    const dragTask = sortedTasks[dragIndex];
    const newTasks = [...sortedTasks];
    newTasks.splice(dragIndex, 1);
    newTasks.splice(hoverIndex, 0, dragTask);

    // Update orders
    const taskOrders = newTasks.map((task, index) => ({
      id: task.id,
      order: index,
    }));

    setLocalTasks(newTasks);
    onReorder(taskOrders);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="size-full overflow-y-auto">
        <div className="box-border content-stretch flex flex-col gap-[16px] items-start pb-[180px] pt-[60px] px-[16px] relative min-h-full">
          {/* Header */}
          <div className="content-stretch flex items-start justify-between leading-[normal] not-italic relative shrink-0 text-[24px] text-nowrap w-full whitespace-pre">
            <div className="content-stretch flex gap-[10px] items-center relative shrink-0 w-[234px]">
              <ListChecks className="relative shrink-0 text-todo" size={24} />
              <p className="relative shrink-0 text-foreground">To-dos</p>
            </div>
            <Button variant="ghost" size="icon"
              onClick={onOpenSettingsMenu}
              aria-label="Open settings" title="Settings"
              className="relative shrink-0 text-muted-foreground"
            >
              <Settings size={24} />
            </Button>
          </div>

          {/* Filters and sorting */}
          <div className="flex gap-[8px] w-full items-center flex-wrap">
            <div className="flex gap-[4px] bg-muted rounded-lg p-[2px]">
              <Button variant="ghost"
                onClick={() => setFilterBy("active")}
                className={`px-[16px] py-[6px] rounded-md transition-colors ${
                  filterBy === "active"
                    ? "bg-background text-foreground shadow-sm"
                    : "bg-transparent text-muted-foreground"
                }`}
              >
                All
              </Button>
              <Button variant="ghost"
                onClick={() => setFilterBy("priority")}
                className={`px-[16px] py-[6px] rounded-md transition-colors ${
                  filterBy === "priority"
                    ? "bg-background text-foreground shadow-sm"
                    : "bg-transparent text-muted-foreground"
                }`}
              >
                Priority
              </Button>
            </div>
            
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[100px] sm:w-[140px] justify-start">
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] bg-background" align="start">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2 text-sm">Tags</h4>
                  <div className="space-y-1">
                    <button
                      onClick={() => setSelectedTag("all")}
                      className="w-full flex items-center justify-between px-2 py-1.5 text-sm rounded hover:bg-muted"
                    >
                      <span>All tags</span>
                      {selectedTag === "all" && <Check className="h-4 w-4" />}
                    </button>
                    {allTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setSelectedTag(tag)}
                        className="w-full flex items-center justify-between px-2 py-1.5 text-sm rounded hover:bg-muted lowercase"
                      >
                        <span>{tag}</span>
                        {selectedTag === tag && <Check className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2 text-sm">Assignees</h4>
                  <div className="space-y-1">
                    <button
                      onClick={() => setSelectedAssignee("all")}
                      className="w-full flex items-center justify-between px-2 py-1.5 text-sm rounded hover:bg-muted"
                    >
                      <span>All assignees</span>
                      {selectedAssignee === "all" && <Check className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => setSelectedAssignee("unassigned")}
                      className="w-full flex items-center justify-between px-2 py-1.5 text-sm rounded hover:bg-muted"
                    >
                      <span>Unassigned</span>
                      {selectedAssignee === "unassigned" && <Check className="h-4 w-4" />}
                    </button>
                    {Object.entries(workspaceMembers).map(([id, name]) => (
                      <button
                        key={id}
                        onClick={() => setSelectedAssignee(id)}
                        className="w-full flex items-center justify-between px-2 py-1.5 text-sm rounded hover:bg-muted"
                      >
                        <span>{name}</span>
                        {selectedAssignee === id && <Check className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="ml-auto shrink-0" aria-label="Sort items" title="Sort items">
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background">
                <DropdownMenuItem onClick={() => setSortBy("order")}>
                  Manual Order
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("createdAt")}>
                  Date Created
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("dueDate")}>
                  Due Date
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("priority")}>
                  Priority
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Task list */}
          <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full">
            {sortBy !== "order" && (
              <p className="text-xs text-muted-foreground px-2">
                Switch to Manual Order to reorder items by dragging
              </p>
            )}
            {sortedTasks.map((task, index) => (
              <DraggableTaskItem
                key={task.id}
                task={task}
                index={index}
                moveTask={moveTask}
                onClick={() => onTaskClick(task)}
                onToggle={(completed) => onTaskToggle(task.id, completed)}
                isDraggable={sortBy === "order"}
                assigneeName={task.assignedTo ? workspaceMembers[task.assignedTo] : null}
              />
            ))}
          </div>

          {sortedTasks.length === 0 && (
            <div className="flex items-center justify-center w-full pt-20">
              <p className="text-muted-foreground">
                {selectedTag !== "all" || selectedAssignee !== "all" ? "Nothing matches these filters." : filterBy === "priority" ? "No priority to-dos. A little breathing room." : "No to-dos here. Room for what comes next."}
              </p>
            </div>
          )}
        </div>
      </div>
    </DndProvider>
  );
}
