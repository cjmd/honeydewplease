import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Task } from "../App";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "./ui/drawer";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Badge } from "./ui/badge";
import { X, ListChecks, ShoppingCart, User, ChevronDown, ChevronUp } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "./ui/command";
import { supabase } from "@/integrations/supabase/client";


type WorkspaceMember = {
  id: string;
  name: string;
  email: string;
};

type AddTaskDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTask: (task: Partial<Task>) => void;
  defaultType?: "todo" | "shopping";
  tasks?: Task[];
  workspaceId?: string | null;
};
export function AddTaskDialog({
  open,
  onOpenChange,
  onCreateTask,
  defaultType = "todo",
  tasks = [],
  workspaceId
}: AddTaskDialogProps) {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [type, setType] = useState<"todo" | "shopping">(defaultType);
  const [isPriority, setIsPriority] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [showMemberSelect, setShowMemberSelect] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const optionsContentRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Scroll input into view when virtual keyboard appears on mobile
  const handleTitleFocus = useCallback(() => {
    setTimeout(() => {
      titleInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }, []);

  // Load workspace members
  useEffect(() => {
    if (open && workspaceId) {
      loadWorkspaceMembers();
    }
  }, [open, workspaceId]);

  const loadWorkspaceMembers = async () => {
    if (!workspaceId) return;

    // 1) Get member user_ids for this workspace
    const { data: memberRows, error: memberErr } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId);

    if (memberErr || !memberRows || memberRows.length === 0) {
      setMembers([]);
      return;
    }

    const userIds = memberRows.map((r: any) => r.user_id);

    // 2) Fetch profiles for those user_ids
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', userIds);

    if (!profErr && profiles) {
      const membersList = profiles.map((p: any) => ({ id: p.id, name: p.name, email: p.email }));
      setMembers(membersList);
    } else {
      setMembers([]);
    }
  };

  // Get existing tags sorted by most recently used
  const existingTags = useMemo(() => {
    const tagMap = new Map<string, number>();
    
    // Collect all tags with their most recent usage timestamp
    tasks.forEach(task => {
      task.tags.forEach(tag => {
        const currentMax = tagMap.get(tag) || 0;
        tagMap.set(tag, Math.max(currentMax, task.updatedAt));
      });
    });
    
    // Sort by most recent usage and filter out already selected tags
    return Array.from(tagMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag)
      .filter(tag => !tags.includes(tag));
  }, [tasks, tags]);

  // Filter suggestions based on input
  const filteredSuggestions = useMemo(() => {
    if (!tagInput.trim()) return existingTags.slice(0, 5);
    const search = tagInput.toLowerCase();
    return existingTags.filter(tag => tag.includes(search)).slice(0, 5);
  }, [existingTags, tagInput]);

  // Update type when dialog opens with new defaultType
  useEffect(() => {
    if (open) {
      setType(defaultType);
    }
  }, [open, defaultType]);
  const handleSubmit = () => {
    if (!title.trim()) return;
    onCreateTask({
      title: title.trim(),
      details: details.trim(),
      type,
      isPriority,
      tags,
      dueDate: dueDate?.toISOString() || null,
      assignedTo
    });

    // Reset form
    setTitle("");
    setDetails("");
    setType(defaultType);
    setIsPriority(false);
    setTags([]);
    setTagInput("");
    setDueDate(undefined);
    setAssignedTo(null);
    onOpenChange(false);
  };
  const addTag = (tag?: string) => {
    const normalizedTag = (tag || tagInput).trim().toLowerCase();
    if (normalizedTag && !tags.includes(normalizedTag)) {
      setTags([...tags, normalizedTag]);
      setTagInput("");
      setShowTagSuggestions(false);
    }
  };
  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };
  return <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="flex flex-col h-[85dvh]">
        <DrawerHeader className="text-left shrink-0">
          <DrawerTitle className="sr-only">Add New Task</DrawerTitle>
          <DrawerDescription className="sr-only">Create a new task with title, details, and options</DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-2 overflow-y-auto flex-1 min-h-0">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Input ref={titleInputRef} value={title} onChange={e => setTitle(e.target.value)} placeholder="New reminder" onFocus={handleTitleFocus} onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
              }
            }} className="text-[20px] text-foreground placeholder:text-muted-foreground placeholder:italic border-0 border-b border-muted-foreground/30 rounded-none shadow-none h-auto focus-visible:ring-0 focus-visible:border-primary px-[8px] py-[4px]" />
            </div>
            <div className="grid gap-2">
              <Label className="text-foreground font-medium">Type</Label>
              <div className="flex gap-2">
                <Button type="button" variant={type === "todo" ? "default" : "outline"} onClick={() => setType("todo")} className="flex-1">
                  <ListChecks className="mr-2" size={16} /> To-do
                </Button>
                <Button type="button" variant={type === "shopping" ? "default" : "outline"} onClick={() => setType("shopping")} className="flex-1">
                  <ShoppingCart className="mr-2" size={16} /> Shopping
                </Button>
              </div>
            </div>

            <div>
              <Button 
                type="button"
                variant="ghost" 
                className="w-full justify-between text-foreground font-medium p-0 h-auto hover:bg-transparent"
                onClick={() => {
                  if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                  setIsOptionsOpen(!isOptionsOpen);
                  if (!isOptionsOpen) {
                    setTimeout(() => {
                      optionsContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 100);
                  }
                }}
              >
                More options
                {isOptionsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </Button>
              
              {isOptionsOpen && (
                <div ref={optionsContentRef} className="space-y-4 mt-4">
                  <div className="grid gap-2">
                    <Label className="text-foreground font-medium">Details</Label>
                    <Textarea 
                      value={details} 
                      onChange={e => setDetails(e.target.value)} 
                      placeholder="Add details" 
                      className="text-[16px] text-foreground placeholder:text-muted-foreground placeholder:italic border-0 border-b border-muted-foreground/30 rounded-none shadow-none min-h-[60px] focus-visible:ring-0 focus-visible:border-primary px-[8px] py-[4px] resize-none" 
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <Label htmlFor="priority" className="text-foreground font-medium">
                      Priority
                    </Label>
                    <Switch id="priority" checked={isPriority} onCheckedChange={setIsPriority} />
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-foreground font-medium">Tags</Label>
                    <Popover open={showTagSuggestions && filteredSuggestions.length > 0}>
                      <PopoverTrigger asChild>
                        <div className="flex gap-2">
                          <Input 
                            value={tagInput} 
                            onChange={e => setTagInput(e.target.value)} 
                            onFocus={() => setShowTagSuggestions(true)}
                            placeholder="Add tag" 
                            onKeyDown={e => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addTag();
                              } else if (e.key === "Escape") {
                                setShowTagSuggestions(false);
                              }
                            }} 
                            className="text-[16px] text-[#999999] border-none shadow-none px-0 h-auto focus-visible:ring-0 px-[8px] py-[4px]" 
                          />
                          <Button type="button" onClick={() => addTag()} variant="outline">
                            Add
                          </Button>
                        </div>
                      </PopoverTrigger>
                      <PopoverContent 
                        className="w-[var(--radix-popover-trigger-width)] p-0" 
                        align="start"
                        onInteractOutside={(e) => {
                          const target = e.target as HTMLElement;
                          if (target.closest('input') || target.closest('button')) {
                            e.preventDefault();
                          } else {
                            setShowTagSuggestions(false);
                          }
                        }}
                      >
                        <Command>
                          <CommandList>
                            <CommandEmpty>No existing tags found</CommandEmpty>
                            <CommandGroup heading="Recent tags">
                              {filteredSuggestions.map((tag) => (
                                <CommandItem
                                  key={tag}
                                  value={tag}
                                  onSelect={() => addTag(tag)}
                                  className="lowercase cursor-pointer"
                                >
                                  {tag}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {tags.length > 0 && <div className="flex flex-wrap gap-2">
                        {tags.map(tag => <Badge key={tag} variant="secondary" className="gap-1 lowercase">
                            {tag}
                            <button onClick={() => removeTag(tag)} className="ml-1">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>)}
                      </div>}
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-foreground font-medium">Assign To</Label>
                    <Popover open={showMemberSelect} onOpenChange={setShowMemberSelect}>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" className="justify-start text-[16px] text-foreground border-none shadow-none px-[8px] h-auto font-normal hover:bg-transparent gap-2">
                          <User size={16} />
                          {assignedTo 
                            ? members.find(m => m.id === assignedTo)?.name || "Select collaborator"
                            : "Select collaborator"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command>
                          <CommandList>
                            <CommandEmpty>No collaborators yet</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                onSelect={() => {
                                  setAssignedTo(null);
                                  setShowMemberSelect(false);
                                }}
                                className="cursor-pointer"
                              >
                                <span className="text-muted-foreground">Unassigned</span>
                              </CommandItem>
                              {members.map((member) => (
                                <CommandItem
                                  key={member.id}
                                  value={member.id}
                                  onSelect={() => {
                                    setAssignedTo(member.id);
                                    setShowMemberSelect(false);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <div className="flex flex-col">
                                    <span>{member.name}</span>
                                    <span className="text-xs text-muted-foreground">{member.email}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-foreground font-medium">Due Date</Label>
                    <Popover modal={true} open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" className="justify-start text-[16px] text-foreground border-none shadow-none px-[8px] h-auto font-normal hover:bg-transparent">
                          {dueDate ? dueDate.toLocaleDateString() : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[100]" align="start">
                        <Calendar mode="single" selected={dueDate} onSelect={date => {
                        setDueDate(date);
                        setIsDatePickerOpen(false);
                      }} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
        <DrawerFooter className="shrink-0 p-3 pt-2 border-t bg-background" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!title.trim()}>
              Create Task
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>;
}