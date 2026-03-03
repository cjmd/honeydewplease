import { useState, useEffect } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Home, ListChecks, ShoppingCart, Archive } from "lucide-react";
import { Task, ViewType } from "../App";
import { HomeView } from "../components/HomeView";
import { TodosView } from "../components/TodosView";
import { ShoppingView } from "../components/ShoppingView";
import { ArchiveView } from "../components/ArchiveView";
import { AddTaskDialog } from "../components/AddTaskDialog";
import { TaskDetailsDialog } from "../components/TaskDetailsDialog";
import { SettingsMenu } from "../components/SettingsMenu";
import { AuthDialog } from "../components/AuthDialog";
import { PWAInstaller } from "../components/PWAInstaller";
import { InstallPrompt } from "../components/InstallPrompt";
import { NotificationPermissionPrompt } from "../components/NotificationPermissionPrompt";
import { useBadgeUpdater } from "../hooks/useBadgeUpdater";

const Index = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentView, setCurrentView] = useState<ViewType>("home");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [defaultTaskType, setDefaultTaskType] = useState<"todo" | "shopping">("todo");
  const [workspaceMembers, setWorkspaceMembers] = useState<Record<string, string>>({});

  // Update app badge with priority/overdue count
  useBadgeUpdater(tasks);

  // Set up auth listener and check session
  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Load workspace and tasks when user signs in
      if (session?.user) {
        setTimeout(() => {
          loadWorkspaceId(session.user.id);
          loadTasks(session.user.id);
        }, 0);
      } else {
        // Load from localStorage if not logged in
        const localTasks = localStorage.getItem("tasks");
        if (localTasks) {
          setTasks(JSON.parse(localTasks));
        }
      }
    });

    // Load cached tasks immediately for faster initial render
    const localTasks = localStorage.getItem("tasks");
    if (localTasks) {
      setTasks(JSON.parse(localTasks));
    }

    // Check for existing session and load workspace
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Load workspace - the useEffect will handle loading tasks
        await loadWorkspaceId(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load tasks when workspace changes
  useEffect(() => {
    if (user && workspaceId) {
      console.log("Workspace ID updated, loading tasks:", workspaceId);
      loadTasks(user.id);
      loadWorkspaceMembers();
    }
  }, [workspaceId, user]);

  // Sync tasks when app becomes visible
  useEffect(() => {
    if (!user || !workspaceId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log("App became visible, syncing tasks...");
        loadTasks(user.id);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, workspaceId]);

  // Set up realtime subscription for tasks
  useEffect(() => {
    if (!user || !workspaceId) return;

    console.log("Setting up realtime subscription for workspace:", workspaceId);

    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `workspace_id=eq.${workspaceId}`
        },
        (payload) => {
          console.log("Realtime event:", payload.eventType, "for task:", (payload.new as any)?.id || (payload.old as any)?.id);
          
          if (payload.eventType === 'INSERT') {
            const newTask: Task = {
              id: payload.new.id,
              title: payload.new.title,
              details: payload.new.details,
              completed: payload.new.completed,
              type: payload.new.type,
              isPriority: payload.new.is_priority,
              tags: payload.new.tags || [],
              dueDate: payload.new.due_date,
              order: payload.new.order,
              createdAt: new Date(payload.new.created_at).getTime(),
              updatedAt: new Date(payload.new.updated_at).getTime(),
              userId: payload.new.user_id,
              workspaceId: payload.new.workspace_id
            };
            
            setTasks(prev => {
              // Avoid duplicates
              if (prev.some(t => t.id === newTask.id)) return prev;
              return [...prev, newTask];
            });
          } else if (payload.eventType === 'UPDATE') {
            setTasks(prev => prev.map(task => {
              if (task.id !== payload.new.id) return task;
              
              // Only update if the database version is newer than our local version
              const dbUpdatedAt = new Date(payload.new.updated_at).getTime();
              if (task.updatedAt && task.updatedAt > dbUpdatedAt) {
                console.log('Skipping stale update from realtime');
                return task;
              }
              
              return {
                ...task,
                title: payload.new.title,
                details: payload.new.details,
                completed: payload.new.completed,
                type: payload.new.type,
                isPriority: payload.new.is_priority,
                tags: payload.new.tags || [],
                dueDate: payload.new.due_date,
                order: payload.new.order,
                updatedAt: dbUpdatedAt
              };
            }));
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any)?.id;
            console.log("Deleting task from local state:", deletedId);
            setTasks(prev => {
              const filtered = prev.filter(task => task.id !== deletedId);
              console.log("Tasks after delete:", filtered.length, "total");
              return filtered;
            });
          }
        }
      )
      .subscribe();

    return () => {
      console.log("Cleaning up realtime subscription");
      supabase.removeChannel(channel);
    };
  }, [user, workspaceId]);

  // Listen for workspace selection changes (e.g., after accepting an invite)
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<string>;
      const id = custom.detail;
      if (typeof id === "string") {
        localStorage.setItem("activeWorkspaceId", id);
        setWorkspaceId(id);
        if (user) {
          loadTasks(user.id);
        }
      }
    };
    window.addEventListener("workspace-changed", handler as EventListener);
    return () => window.removeEventListener("workspace-changed", handler as EventListener);
  }, [user]);

  const loadWorkspaceId = async (userId?: string): Promise<string | null> => {
    const currentUserId = userId || user?.id;
    if (!currentUserId) return null;

    try {
      // 1) Prefer an explicitly selected workspace stored locally (active session)
      const stored = localStorage.getItem("activeWorkspaceId");
      if (stored) {
        const { data: membership } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", currentUserId)
          .eq("workspace_id", stored)
          .maybeSingle();
        if (membership) {
          setWorkspaceId(stored);
          return stored;
        } else {
          // Clear invalid stored value
          localStorage.removeItem("activeWorkspaceId");
        }
      }

      // 2) Check for a default workspace preference (DB first, then localStorage cache)
      let defaultWs = localStorage.getItem("defaultWorkspaceId");
      if (!defaultWs) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("default_workspace_id")
          .eq("id", currentUserId)
          .maybeSingle();
        if (profile?.default_workspace_id) {
          defaultWs = profile.default_workspace_id;
          localStorage.setItem("defaultWorkspaceId", defaultWs);
        }
      }
      if (defaultWs) {
        const { data: membership } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", currentUserId)
          .eq("workspace_id", defaultWs)
          .maybeSingle();
        if (membership) {
          setWorkspaceId(defaultWs);
          localStorage.setItem("activeWorkspaceId", defaultWs);
          return defaultWs;
        } else {
          // Clear invalid default
          localStorage.removeItem("defaultWorkspaceId");
        }
      }

      // 3) Otherwise, pick the most recently joined workspace
      const { data, error } = await supabase
        .from("workspace_members")
        .select("workspace_id, created_at")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setWorkspaceId(data.workspace_id);
        localStorage.setItem("activeWorkspaceId", data.workspace_id);
        return data.workspace_id;
      }

      // 4) No workspace yet — create a default one and add membership
      console.log("No workspace found. Creating a default workspace...");
      const { data: ws, error: wsError } = await supabase
        .from("workspaces")
        .insert({ owner_id: currentUserId })
        .select("id")
        .single();
      if (wsError) throw wsError;

      const newWorkspaceId = ws.id as string;

      const { error: memError } = await supabase
        .from("workspace_members")
        .insert({ workspace_id: newWorkspaceId, user_id: currentUserId, role: "owner" });
      if (memError) throw memError;

      // Migrate any orphaned tasks (created before workspace existed)
      const { error: migrateError } = await supabase
        .from("tasks")
        .update({ workspace_id: newWorkspaceId })
        .is("workspace_id", null)
        .eq("user_id", currentUserId);
      if (migrateError) {
        console.warn("Could not migrate orphaned tasks:", migrateError);
      }

      setWorkspaceId(newWorkspaceId);
      localStorage.setItem("activeWorkspaceId", newWorkspaceId);
      return newWorkspaceId;
    } catch (error) {
      console.error("Error loading/creating workspace:", error);
      return null;
    }
  };

  const loadWorkspaceMembers = async () => {
    if (!workspaceId) return;

    try {
      // Get member user_ids for this workspace
      const { data: memberRows, error: memberErr } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', workspaceId);

      if (memberErr || !memberRows || memberRows.length === 0) {
        setWorkspaceMembers({});
        return;
      }

      const userIds = memberRows.map((r: any) => r.user_id);

      // Fetch profiles for those user_ids
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);

      if (!profErr && profiles) {
        // Create a map of user ID to name
        const membersMap = profiles.reduce((acc: Record<string, string>, p: any) => {
          acc[p.id] = p.name;
          return acc;
        }, {});
        setWorkspaceMembers(membersMap);
      } else {
        setWorkspaceMembers({});
      }
    } catch (error) {
      console.error("Error loading workspace members:", error);
      setWorkspaceMembers({});
    }
  };

  const loadTasks = async (userId?: string) => {
    const currentUserId = userId || user?.id;
    
    if (!currentUserId) {
      const localTasks = localStorage.getItem("tasks");
      if (localTasks) {
        setTasks(JSON.parse(localTasks));
      }
      return;
    }

    try {
      // Get the active workspace ID
      const activeWorkspaceId = workspaceId || localStorage.getItem("activeWorkspaceId");
      
      if (!activeWorkspaceId) {
        console.log("No active workspace, loading from cache...");
        // Load from cache while waiting for workspace
        const localTasks = localStorage.getItem("tasks");
        if (localTasks) {
          setTasks(JSON.parse(localTasks));
        }
        return;
      }

      console.log("Loading tasks for workspace:", activeWorkspaceId);

      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("workspace_id", activeWorkspaceId)
        .order("order", { ascending: true });

      if (error) throw error;

      const loadedTasks: Task[] = (data || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        details: row.details,
        completed: row.completed,
        type: row.type,
        isPriority: row.is_priority,
        tags: row.tags || [],
        dueDate: row.due_date,
        assignedTo: row.assigned_to,
        order: row.order,
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
        userId: row.user_id,
        workspaceId: row.workspace_id
      }));

      console.log("Loaded tasks from server:", loadedTasks.length);
      saveTasks(loadedTasks); // Cache to localStorage
    } catch (error) {
      console.error("Error loading tasks:", error);
      toast.error("Failed to load tasks");
      // Fall back to cache on error
      const localTasks = localStorage.getItem("tasks");
      if (localTasks) {
        console.log("Loading from cache due to error");
        setTasks(JSON.parse(localTasks));
      }
    }
  };
  const saveTasks = (updatedTasks: Task[]) => {
    setTasks(updatedTasks);
    // Always cache to localStorage for faster loading on refresh
    localStorage.setItem("tasks", JSON.stringify(updatedTasks));
  };
  const handleCreateTask = async (taskData: Partial<Task>) => {
    const newTask: Task = {
      id: crypto.randomUUID(),
      title: taskData.title || "",
      details: taskData.details || null,
      completed: false,
      type: taskData.type || "todo",
      isPriority: taskData.isPriority || false,
      tags: taskData.tags || [],
      dueDate: taskData.dueDate || null,
      assignedTo: taskData.assignedTo || null,
      order: tasks.length,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    if (!user) {
      saveTasks([...tasks, newTask]);
      toast.success("Task created");
      return;
    }

    // Ensure we have an active workspace for this user
    let activeId = workspaceId;
    if (!activeId) {
      activeId = await loadWorkspaceId(user.id);
      if (!activeId) {
        toast.error("Unable to prepare your workspace. Please try again.");
        return;
      }
    }

    try {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          id: newTask.id,
          user_id: user.id,
          workspace_id: activeId,
          title: newTask.title,
          details: newTask.details,
          completed: newTask.completed,
          type: newTask.type,
          is_priority: newTask.isPriority,
          tags: newTask.tags,
          due_date: newTask.dueDate,
          assigned_to: newTask.assignedTo,
          order: newTask.order
        })
        .select()
        .single();

      if (error) throw error;

      const createdTask: Task = {
        ...newTask,
        id: data.id,
        userId: data.user_id,
        workspaceId: data.workspace_id,
        assignedTo: (data as any).assigned_to
      };

      const updatedTasks = [...tasks, createdTask];
      saveTasks(updatedTasks); // Cache immediately
      toast.success("Task created");
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error("Failed to create task");
    }
  };

  const handleDuplicateTask = async (task: Task) => {
    const duplicatedTask: Task = {
      ...task,
      id: crypto.randomUUID(),
      title: `${task.title} (copy)`,
      order: tasks.length,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    if (!user) {
      saveTasks([...tasks, duplicatedTask]);
      toast.success("Task duplicated");
      return;
    }

    let activeId = workspaceId;
    if (!activeId) {
      activeId = await loadWorkspaceId(user.id);
      if (!activeId) {
        toast.error("Unable to prepare your workspace. Please try again.");
        return;
      }
    }

    try {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          id: duplicatedTask.id,
          user_id: user.id,
          workspace_id: activeId,
          title: duplicatedTask.title,
          details: duplicatedTask.details,
          completed: duplicatedTask.completed,
          type: duplicatedTask.type,
          is_priority: duplicatedTask.isPriority,
          tags: duplicatedTask.tags,
          due_date: duplicatedTask.dueDate,
          assigned_to: duplicatedTask.assignedTo,
          order: duplicatedTask.order
        })
        .select()
        .single();

      if (error) throw error;

      const createdTask: Task = {
        ...duplicatedTask,
        id: data.id,
        userId: data.user_id,
        workspaceId: data.workspace_id,
        assignedTo: (data as any).assigned_to
      };

      const updatedTasks = [...tasks, createdTask];
      saveTasks(updatedTasks);
      toast.success("Task duplicated");
    } catch (error) {
      console.error("Error duplicating task:", error);
      toast.error("Failed to duplicate task");
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    const targetTask = tasks.find(t => t.id === taskId);
    const optimisticTasks = tasks.map(task =>
      task.id === taskId
        ? { ...task, ...updates, updatedAt: Date.now() }
        : task
    );

    if (!user) {
      saveTasks(optimisticTasks);
      // Show undo button only when completing a task
      if (updates.completed === true) {
        toast.success("Task completed", {
          action: {
            label: "Undo",
            onClick: () => {
              const revertedTasks = tasks.map(task =>
                task.id === taskId ? { ...task, completed: false } : task
              );
              saveTasks(revertedTasks);
            }
          }
        });
      } else {
        toast.success("Task updated");
      }
      return;
    }

    // Ensure workspace is available for cloud updates
    if (!workspaceId) {
      const ensuredId = await loadWorkspaceId(user.id);
      if (!ensuredId) {
        toast.error("Unable to prepare your workspace. Please try again.");
        return;
      }
    }

    try {
      // Preflight concurrency check with tolerance window
      const { data: current, error: fetchError } = await supabase
        .from("tasks")
        .select("updated_at")
        .eq("id", taskId)
        .single();

      if (fetchError) throw fetchError;

      const serverUpdatedAt = current ? new Date((current as any).updated_at).getTime() : 0;
      const localUpdatedAt = targetTask?.updatedAt ?? 0;
      
      // Allow 5 second tolerance to avoid false conflicts from trigger updates, rounding, or cache timing
      const TOLERANCE_MS = 5000;
      const timeDifference = serverUpdatedAt - localUpdatedAt;

      if (timeDifference > TOLERANCE_MS) {
        console.log("Conflict detected:", { serverUpdatedAt, localUpdatedAt, timeDifference });
        toast.error("This item was updated on another device. Showing latest.");
        await loadTasks(user.id);
        return;
      }

      const dbUpdates: any = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.details !== undefined) dbUpdates.details = updates.details;
      if (updates.completed !== undefined) dbUpdates.completed = updates.completed;
      if (updates.type !== undefined) dbUpdates.type = updates.type;
      if (updates.isPriority !== undefined) dbUpdates.is_priority = updates.isPriority;
      if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
      if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
      if (updates.assignedTo !== undefined) dbUpdates.assigned_to = updates.assignedTo;
      if (updates.order !== undefined) dbUpdates.order = updates.order;

      const { data: updatedRow, error } = await supabase
        .from("tasks")
        .update(dbUpdates)
        .eq("id", taskId)
        .select()
        .single();

      if (error) throw error;

      const finalTasks = tasks.map(task =>
        task.id === taskId
          ? {
              ...task,
              ...updates,
              updatedAt: new Date((updatedRow as any).updated_at).getTime(),
            }
          : task
      );

      saveTasks(finalTasks); // Cache immediately
      
      // Show undo button only when completing a task
      if (updates.completed === true) {
        toast.success("Task completed", {
          action: {
            label: "Undo",
            onClick: () => handleUpdateTask(taskId, { completed: false })
          }
        });
      } else {
        toast.success("Task updated");
      }
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Failed to update task");
    }
  };
  const handleDeleteTask = async (taskId: string) => {
    if (!user) {
      const updatedTasks = tasks.filter(task => task.id !== taskId);
      saveTasks(updatedTasks);
      toast.success("Task deleted");
      return;
    }

    // Ensure workspace is available for cloud deletes
    if (!workspaceId) {
      const ensuredId = await loadWorkspaceId(user.id);
      if (!ensuredId) {
        toast.error("Unable to prepare your workspace. Please try again.");
        return;
      }
    }

    try {
      console.log("Deleting task from database:", taskId);
      
      // Optimistically remove from local state and cache
      const updatedTasks = tasks.filter(task => task.id !== taskId);
      saveTasks(updatedTasks);

      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId);

      if (error) throw error;

      console.log("Task deleted successfully:", taskId);
      toast.success("Task deleted");
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
      // Reload to get accurate state
      await loadTasks(user.id);
    }
  };
  const handleToggleTask = async (taskId: string, completed: boolean) => {
    await handleUpdateTask(taskId, {
      completed
    });
  };
  const handleReorderTasks = async (taskOrders: { id: string; order: number }[]) => {
    const updatedTasks = tasks.map(task => {
      const orderUpdate = taskOrders.find(t => t.id === task.id);
      return orderUpdate ? { ...task, order: orderUpdate.order } : task;
    });

    saveTasks(updatedTasks); // Cache immediately

    if (!user) {
      return;
    }

    // Wait for workspace to be loaded
    if (!workspaceId) {
      console.log("Waiting for workspace to load...");
      toast.error("Please wait while we set up your workspace");
      return;
    }

    try {
      // Batch update all task orders without conflict detection
      // Reordering only changes display order, so conflicts are not meaningful here
      const updates = taskOrders.map(({ id, order }) =>
        supabase.from("tasks").update({ order }).eq("id", id)
      );
      await Promise.all(updates);
    } catch (error) {
      console.error("Error reordering tasks:", error);
    }
  };
  const handleSignUp = async (email: string, password: string, name: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            name
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        toast.success("Account created successfully!");

        // Wait a bit for the workspace to be created by the trigger
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get the newly created workspace
        const { data: workspaceData } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", data.user.id)
          .single();

        if (workspaceData) {
          setWorkspaceId(workspaceData.workspace_id);

          // Sync local tasks to server
          const localTasks = localStorage.getItem("tasks");
          if (localTasks) {
            const tasksToSync = JSON.parse(localTasks);
            for (const task of tasksToSync) {
              await supabase.from("tasks").insert({
                id: task.id,
                user_id: data.user.id,
                workspace_id: workspaceData.workspace_id,
                title: task.title,
                details: task.details,
                completed: task.completed,
                type: task.type,
                is_priority: task.isPriority,
                tags: task.tags,
                due_date: task.dueDate,
                order: task.order
              });
            }
            localStorage.removeItem("tasks");
          }
        }
      }
    } catch (error: any) {
      console.error("Sign up error:", error);
      toast.error(error.message || "Sign up failed");
    }
  };
  const handleSignIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      toast.success("Signed in successfully!");
    } catch (error: any) {
      console.error("Sign in error:", error);
      toast.error(error.message || "Sign in failed");
    }
  };
  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setTasks([]);
      toast.success("Signed out successfully");
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("Sign out failed");
    }
  };
  const handleAddTask = () => {
    setDefaultTaskType(currentView === "shopping" ? "shopping" : "todo");
    setIsAddDialogOpen(true);
  };

  const handleDeleteTag = async (tag: string) => {
    const tagLower = tag.toLowerCase();
    
    // Update all tasks to remove this tag
    const updatedTasks = tasks.map(task => {
      if (task.tags && task.tags.includes(tagLower)) {
        return {
          ...task,
          tags: task.tags.filter(t => t !== tagLower)
        };
      }
      return task;
    });

    // Update local state and cache
    setTasks(updatedTasks);
    saveTasks(updatedTasks);

    // Update database if user is logged in
    if (user) {
      try {
        // Update all tasks that have this tag
        const tasksWithTag = tasks.filter(t => t.tags && t.tags.includes(tagLower));
        
        for (const task of tasksWithTag) {
          const newTags = task.tags!.filter(t => t !== tagLower);
          await supabase
            .from("tasks")
            .update({ tags: newTags })
            .eq("id", task.id);
        }

        toast.success(`Tag "${tag}" removed from all tasks`);
      } catch (error) {
        console.error("Error removing tag:", error);
        toast.error("Failed to remove tag from some tasks");
        // Reload to get accurate state
        await loadTasks(user.id);
      }
    } else {
      toast.success(`Tag "${tag}" removed from all tasks`);
    }
  };

  // Filter tasks by type for each view
  const todoTasks = tasks.filter(task => task.type === "todo");
  const shoppingTasks = tasks.filter(task => task.type === "shopping");
  const allTasks = tasks;
  return <>
      <PWAInstaller />
      <InstallPrompt />
      <NotificationPermissionPrompt tasks={tasks} />

      <div className="size-full bg-background relative">
        {/* Main content */}
        {currentView === "home" && <HomeView tasks={tasks} onTaskClick={setSelectedTask} onTaskToggle={handleToggleTask} onViewChange={setCurrentView} onOpenSettingsMenu={() => setIsSettingsMenuOpen(true)} workspaceMembers={workspaceMembers} />}

        {currentView === "todos" && <TodosView tasks={todoTasks} onTaskClick={setSelectedTask} onTaskToggle={handleToggleTask} onReorder={handleReorderTasks} onViewChange={setCurrentView} onOpenSettingsMenu={() => setIsSettingsMenuOpen(true)} workspaceMembers={workspaceMembers} />}

        {currentView === "shopping" && <ShoppingView tasks={shoppingTasks} onTaskClick={setSelectedTask} onTaskToggle={handleToggleTask} onReorder={handleReorderTasks} onViewChange={setCurrentView} onOpenSettingsMenu={() => setIsSettingsMenuOpen(true)} workspaceMembers={workspaceMembers} />}

        {currentView === "archive" && <ArchiveView tasks={allTasks} onTaskClick={setSelectedTask} onTaskToggle={handleToggleTask} onViewChange={setCurrentView} onOpenSettingsMenu={() => setIsSettingsMenuOpen(true)} workspaceMembers={workspaceMembers} />}

        {/* Floating Add Button */}
        <button onClick={handleAddTask} className="fixed bottom-[96px] left-1/2 -translate-x-1/2 w-[56px] h-[56px] rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg hover:opacity-90 transition-opacity z-50">
          <Plus size={28} />
        </button>

        {/* Floating Bottom Navigation */}
        <div className="fixed bottom-4 left-4 right-4 bg-card/95 backdrop-blur-md border border-border h-[60px] rounded-2xl flex items-center justify-around px-[16px] shadow-lg z-40">
          <button onClick={() => setCurrentView("home")} className={`flex flex-col items-center gap-[4px] transition-all px-4 py-2 rounded-xl ${currentView === "home" ? "text-foreground bg-primary/10" : "text-muted-foreground"}`}>
            <Home size={24} />
            <span className="text-[10px]">Home</span>
          </button>

          <button onClick={() => setCurrentView("todos")} className={`flex flex-col items-center gap-[4px] transition-all px-4 py-2 rounded-xl ${currentView === "todos" ? "text-[#3dadff] bg-[#3dadff]/10" : "text-muted-foreground"}`}>
            <ListChecks size={24} />
            <span className="text-[10px]">To-dos</span>
          </button>

          <button onClick={() => setCurrentView("shopping")} className={`flex flex-col items-center gap-[4px] transition-all px-4 py-2 rounded-xl ${currentView === "shopping" ? "text-[#66d575] bg-[#66d575]/10" : "text-muted-foreground"}`}>
            <ShoppingCart size={24} />
            <span className="text-[10px]">Shopping</span>
          </button>

          <button onClick={() => setCurrentView("archive")} className={`flex flex-col items-center gap-[4px] transition-all px-4 py-2 rounded-xl ${currentView === "archive" ? "text-[#ff9500] bg-[#ff9500]/10" : "text-muted-foreground"}`}>
            <Archive size={24} />
            <span className="text-[10px]">Archive</span>
          </button>
        </div>

        {/* Dialogs */}
        <AddTaskDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} onCreateTask={handleCreateTask} defaultType={defaultTaskType} tasks={tasks} workspaceId={workspaceId} />

        {selectedTask && <TaskDetailsDialog task={selectedTask} open={!!selectedTask} onOpenChange={open => !open && setSelectedTask(null)} onUpdate={updates => handleUpdateTask(selectedTask.id, updates)} onDelete={() => handleDeleteTask(selectedTask.id)} onDuplicate={() => handleDuplicateTask(selectedTask)} tasks={tasks} workspaceId={workspaceId} />}

        <SettingsMenu tasks={tasks} open={isSettingsMenuOpen} onOpenChange={setIsSettingsMenuOpen} user={user} onSignOut={handleSignOut} onOpenAuth={() => setIsAuthDialogOpen(true)} workspaceId={workspaceId} onDeleteTag={handleDeleteTag} onWorkspaceChange={(newId) => { setWorkspaceId(newId); loadTasks(user?.id); }} />

        <AuthDialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen} onSignUp={handleSignUp} onSignIn={handleSignIn} />
      </div>
    </>;
};
export default Index;