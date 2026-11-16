import { useState } from "react";
import { Task, ViewType } from "../App";
import { TaskItem } from "./TaskItem";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Archive, Settings, ArrowUpDown, Filter, Check } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Separator } from "./ui/separator";

type ArchiveViewProps = {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onTaskToggle: (taskId: string, completed: boolean) => void;
  onViewChange: (view: ViewType) => void;
  onOpenSettingsMenu: () => void;
  workspaceMembers?: Record<string, string>;
};

type FilterBy = "all" | "todos" | "shopping";
type SortBy = "completedAt" | "createdAt" | "dueDate";

export function ArchiveView({ tasks, onTaskClick, onTaskToggle, onViewChange, onOpenSettingsMenu, workspaceMembers = {} }: ArchiveViewProps) {
  const [filterBy, setFilterBy] = useState<FilterBy>("all");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortBy>("completedAt");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("all");

  // Only show completed tasks
  const completedTasks = tasks.filter((task) => task.completed);

  // Get all unique tags from completed tasks
  const allTags = Array.from(new Set(completedTasks.flatMap(task => task.tags))).sort();

  // Filter by type and tag
  const filteredTasks = completedTasks.filter((task) => {
    // Filter by type
    let typeMatch = true;
    if (filterBy === "todos") typeMatch = task.type === "todo";
    else if (filterBy === "shopping") typeMatch = task.type === "shopping";
    
    // Filter by tag
    const tagMatch = selectedTag === "all" || task.tags.includes(selectedTag);
    
    // Filter by assignee
    const assigneeMatch = selectedAssignee === "all" || 
      (selectedAssignee === "unassigned" ? !task.assignedTo : task.assignedTo === selectedAssignee);
    
    return typeMatch && tagMatch && assigneeMatch;
  });

  // Sort completed tasks
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (sortBy === "completedAt") return b.updatedAt - a.updatedAt;
    if (sortBy === "createdAt") return b.createdAt - a.createdAt;
    if (sortBy === "dueDate") {
      if (!a.dueDate && !b.dueDate) return b.updatedAt - a.updatedAt;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    return 0;
  });

  return (
    <div className="size-full overflow-y-auto">
      <div className="box-border content-stretch flex flex-col gap-[16px] items-start pb-[180px] pt-[60px] px-[16px] relative min-h-full">
        {/* Header */}
        <div className="content-stretch flex items-start justify-between leading-[normal] not-italic relative shrink-0 text-[24px] text-nowrap w-full whitespace-pre">
            <div className="content-stretch flex gap-[10px] items-center relative shrink-0 w-[234px]">
              <Archive className="relative shrink-0 text-archive" size={24} />
              <p className="relative shrink-0 text-foreground">Archive</p>
            </div>
            <Button variant="ghost" size="icon"
              onClick={onOpenSettingsMenu}
              aria-label="Open settings" title="Settings"
              className="relative shrink-0 text-muted-foreground"
            >
              <Settings size={24} />
            </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-[8px] w-full items-center flex-wrap">
            <Select value={filterBy} onValueChange={(value) => setFilterBy(value as FilterBy)}>
              <SelectTrigger className="w-[140px] bg-background">
                <SelectValue />
              </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="todos">To-dos</SelectItem>
              <SelectItem value="shopping">Shopping</SelectItem>
            </SelectContent>
          </Select>

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
              <DropdownMenuItem onClick={() => setSortBy("completedAt")}>
                Completed Date
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

        {/* Task list */}
        <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full">
          {sortedTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
              onToggle={(completed) => onTaskToggle(task.id, completed)}
              showTypeIcon={true}
              assigneeName={task.assignedTo ? workspaceMembers[task.assignedTo] : null}
            />
          ))}
        </div>

          {sortedTasks.length === 0 && (
            <div className="flex items-center justify-center w-full pt-20">
              <p className="text-muted-foreground">
                {selectedTag !== "all" || selectedAssignee !== "all" ? "Nothing matches these filters." : "Finished items will have a home here."}
              </p>
            </div>
          )}
      </div>
    </div>
  );
}
