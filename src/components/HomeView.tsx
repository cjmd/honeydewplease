import { useState, useEffect } from "react";
import { Task, ViewType } from "../App";
import { TaskItem } from "./TaskItem";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Flag, Settings, ListChecks, ShoppingCart, ArrowUpDown, Filter, Check } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Separator } from "./ui/separator";

type HomeViewProps = {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onTaskToggle: (taskId: string, completed: boolean) => void;
  onReorder: (taskOrders: { id: string; order: number }[]) => void;
  onViewChange: (view: ViewType) => void;
  onOpenSettingsMenu: () => void;
  workspaceMembers?: Record<string, string>;
};

function DraggableTaskItem({
  task,
  index,
  moveTask,
  onClick,
  onToggle,
  isDraggable,
  showTypeIcon,
  assigneeName,
}: {
  task: Task;
  index: number;
  moveTask: (dragIndex: number, hoverIndex: number) => void;
  onClick: () => void;
  onToggle: (completed: boolean) => void;
  isDraggable: boolean;
  showTypeIcon?: boolean;
  assigneeName?: string | null;
}) {
  const [{ isDragging }, drag] = useDrag({
    type: "home-task",
    item: { index },
    canDrag: isDraggable,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: "home-task",
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
      <TaskItem task={task} onClick={onClick} onToggle={onToggle} showTypeIcon={showTypeIcon} assigneeName={assigneeName} />
    </div>
  );
}

type SortBy = "order" | "createdAt" | "dueDate";

export function HomeView({ tasks, onTaskClick, onTaskToggle, onReorder, onViewChange, onOpenSettingsMenu, workspaceMembers = {} }: HomeViewProps) {
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [filterMode, setFilterMode] = useState<"all" | "priority">("all");
  const [sortBy, setSortBy] = useState<SortBy>("order");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("all");
  const [localTasks, setLocalTasks] = useState(tasks);

  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  const now = new Date();

  // Get all unique tags from tasks
  const allTags = Array.from(new Set(localTasks.flatMap(task => task.tags))).sort();
  
  // Filter and sort todos
  const todoTasks = localTasks
    .filter((task) => {
      if (task.type !== "todo" || task.completed) return false;
      const tagMatch = selectedTag === "all" || task.tags.includes(selectedTag);
      const isOverdue = task.dueDate && new Date(task.dueDate) < now;
      const priorityMatch = filterMode === "all" || task.isPriority || isOverdue;
      const assigneeMatch = selectedAssignee === "all" || 
        (selectedAssignee === "unassigned" ? !task.assignedTo : task.assignedTo === selectedAssignee);
      return tagMatch && priorityMatch && assigneeMatch;
    })
    .sort((a, b) => {
      if (sortBy === "order") return a.order - b.order;
      if (sortBy === "createdAt") return b.createdAt - a.createdAt;
      if (sortBy === "dueDate") {
        if (!a.dueDate && !b.dueDate) return a.order - b.order;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      return 0;
    });

  // Filter and sort shopping items
  const shoppingTasks = localTasks
    .filter((task) => {
      if (task.type !== "shopping" || task.completed) return false;
      const tagMatch = selectedTag === "all" || task.tags.includes(selectedTag);
      const isOverdue = task.dueDate && new Date(task.dueDate) < now;
      const priorityMatch = filterMode === "all" || task.isPriority || isOverdue;
      const assigneeMatch = selectedAssignee === "all" || 
        (selectedAssignee === "unassigned" ? !task.assignedTo : task.assignedTo === selectedAssignee);
      return tagMatch && priorityMatch && assigneeMatch;
    })
    .sort((a, b) => {
      if (sortBy === "order") return a.order - b.order;
      if (sortBy === "createdAt") return b.createdAt - a.createdAt;
      if (sortBy === "dueDate") {
        if (!a.dueDate && !b.dueDate) return a.order - b.order;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      return 0;
    });

  const moveTodoTask = (dragIndex: number, hoverIndex: number) => {
    const newTodos = [...todoTasks];
    const dragTask = newTodos[dragIndex];
    newTodos.splice(dragIndex, 1);
    newTodos.splice(hoverIndex, 0, dragTask);
    const taskOrders = newTodos.map((task, index) => ({ id: task.id, order: index }));
    setLocalTasks(prev => {
      const updated = [...prev];
      taskOrders.forEach(({ id, order }) => {
        const t = updated.find(x => x.id === id);
        if (t) t.order = order;
      });
      return updated;
    });
    onReorder(taskOrders);
  };

  const moveShoppingTask = (dragIndex: number, hoverIndex: number) => {
    const newShopping = [...shoppingTasks];
    const dragTask = newShopping[dragIndex];
    newShopping.splice(dragIndex, 1);
    newShopping.splice(hoverIndex, 0, dragTask);
    const taskOrders = newShopping.map((task, index) => ({ id: task.id, order: index }));
    setLocalTasks(prev => {
      const updated = [...prev];
      taskOrders.forEach(({ id, order }) => {
        const t = updated.find(x => x.id === id);
        if (t) t.order = order;
      });
      return updated;
    });
    onReorder(taskOrders);
  };

  const isDraggable = sortBy === "order";

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="w-full h-screen overflow-y-auto">
        <div className="box-border content-stretch flex flex-col gap-[16px] items-start pb-[180px] pt-[60px] px-[16px] relative min-h-full pr-[16px] pl-[16px]">
          {/* Header */}
          <div className="content-stretch flex items-start justify-between leading-[normal] not-italic relative shrink-0 text-[24px] text-nowrap w-full whitespace-pre">
            <div className="content-stretch flex gap-[10px] items-center relative shrink-0 w-[234px]">
              <Flag className="relative shrink-0 text-[#f24822]" size={24} />
              <p className="relative shrink-0 text-foreground">{filterMode === "all" ? "Home" : "Priorities"}</p>
            </div>
            <button 
              onClick={onOpenSettingsMenu}
              className="relative shrink-0 text-foreground"
            >
              <Settings size={24} />
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-[8px] w-full items-center flex-wrap">
            <div className="flex gap-[4px] bg-muted rounded-lg p-[2px]">
              <button
                onClick={() => setFilterMode("all")}
                className={`px-[16px] py-[6px] rounded-md transition-colors ${
                  filterMode === "all"
                    ? "bg-background text-foreground shadow-sm"
                    : "bg-transparent text-muted-foreground"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterMode("priority")}
                className={`px-[16px] py-[6px] rounded-md transition-colors ${
                  filterMode === "priority"
                    ? "bg-background text-foreground shadow-sm"
                    : "bg-transparent text-muted-foreground"
                }`}
              >
                Priority
              </button>
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
                <Button variant="outline" size="icon" className="ml-auto shrink-0">
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
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {sortBy !== "order" && (
            <p className="text-xs text-muted-foreground px-2">
              Switch to Manual Order to reorder items by dragging
            </p>
          )}

          {/* To-dos section */}
          {todoTasks.length > 0 && (
            <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full">
              <button
                onClick={() => onViewChange("todos")}
                className="content-stretch flex gap-[4px] items-center leading-[normal] not-italic relative shrink-0 text-[20px] text-nowrap whitespace-pre"
              >
                <ListChecks className="relative shrink-0 text-[#3dadff]" size={20} />
                <p className="relative shrink-0 text-foreground">To-dos</p>
              </button>
              {todoTasks.map((task, index) => (
                <DraggableTaskItem
                  key={task.id}
                  task={task}
                  index={index}
                  moveTask={moveTodoTask}
                  onClick={() => onTaskClick(task)}
                  onToggle={(completed) => onTaskToggle(task.id, completed)}
                  isDraggable={isDraggable}
                  showTypeIcon={false}
                  assigneeName={task.assignedTo ? workspaceMembers[task.assignedTo] : null}
                />
              ))}
            </div>
          )}

          {/* Shopping section */}
          {shoppingTasks.length > 0 && (
            <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full">
              <button
                onClick={() => onViewChange("shopping")}
                className="content-stretch flex gap-[4px] items-center leading-[normal] not-italic relative shrink-0 text-[20px] text-nowrap whitespace-pre"
              >
                <ShoppingCart className="relative shrink-0 text-[#66d575]" size={20} />
                <p className="relative shrink-0 text-foreground">Shopping</p>
              </button>
              {shoppingTasks.map((task, index) => (
                <DraggableTaskItem
                  key={task.id}
                  task={task}
                  index={index}
                  moveTask={moveShoppingTask}
                  onClick={() => onTaskClick(task)}
                  onToggle={(completed) => onTaskToggle(task.id, completed)}
                  isDraggable={isDraggable}
                  showTypeIcon={false}
                  assigneeName={task.assignedTo ? workspaceMembers[task.assignedTo] : null}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {todoTasks.length === 0 && shoppingTasks.length === 0 && (
            <div className="flex items-center justify-center w-full pt-20">
              <p className="text-muted-foreground">
                No tasks yet. Tap + to add one!
              </p>
            </div>
          )}
        </div>
      </div>
    </DndProvider>
  );
}
