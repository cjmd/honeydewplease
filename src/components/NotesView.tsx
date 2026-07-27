import { useEffect, useRef, useState } from "react";
import { ViewType } from "../App";
import { StickyNote, Settings, Plus, Trash2, GripVertical, Archive, ArchiveRestore, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TaskImageUploader } from "./TaskImageUploader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";

export type Note = {
  id: string;
  title: string;
  content: string;
  order: number;
  images: string[];
  archived: boolean;
  createdAt: number;
  updatedAt: number;
  userId?: string;
  workspaceId?: string | null;
};

type NotesViewProps = {
  onOpenSettingsMenu: () => void;
  onViewChange: (view: ViewType) => void;
  workspaceId: string | null;
  userId: string | null;
};

const LOCAL_KEY = "notes";

const mapRow = (row: any): Note => ({
  id: row.id,
  title: row.title,
  content: row.content,
  order: row.order,
  images: Array.isArray(row.images) ? row.images : [],
  archived: !!row.archived,
  createdAt: new Date(row.created_at).getTime(),
  updatedAt: new Date(row.updated_at).getTime(),
  userId: row.user_id,
  workspaceId: row.workspace_id,
});

export function NotesView({ onOpenSettingsMenu, workspaceId, userId }: NotesViewProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Load notes
  useEffect(() => {
    const cached = localStorage.getItem(LOCAL_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setNotes(parsed.map((n: any) => ({ images: [], archived: false, ...n })));
      } catch {}
    }

    if (!userId || !workspaceId) return;

    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("order", { ascending: true });
      setLoading(false);
      if (error) {
        console.error("Load notes failed:", error);
        return;
      }
      const mapped: Note[] = (data || []).map(mapRow);
      setNotes(mapped);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(mapped));
    };
    load();
  }, [userId, workspaceId]);

  // Realtime
  useEffect(() => {
    if (!userId || !workspaceId) return;

    const channel = supabase
      .channel("notes-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notes",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newNote = mapRow(payload.new);
            setNotes((prev) =>
              prev.some((x) => x.id === newNote.id) ? prev : [...prev, newNote]
            );
          } else if (payload.eventType === "UPDATE") {
            const n = payload.new as any;
            setNotes((prev) =>
              prev.map((note) => {
                if (note.id !== n.id) return note;
                const dbUpdated = new Date(n.updated_at).getTime();
                if (note.updatedAt > dbUpdated) return note;
                return mapRow(n);
              })
            );
          } else if (payload.eventType === "DELETE") {
            const id = (payload.old as any)?.id;
            setNotes((prev) => prev.filter((n) => n.id !== id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, workspaceId]);

  const persist = (next: Note[]) => {
    setNotes(next);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
  };

  const handleAddNote = async () => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      title: "",
      content: "",
      order: -1,
      images: [],
      archived: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Shift existing active notes down so new note appears at top
    const active = notes.filter((n) => !n.archived);
    const archived = notes.filter((n) => n.archived);
    const reordered = [newNote, ...active].map((n, i) => ({ ...n, order: i }));
    persist([...reordered, ...archived]);

    if (!userId || !workspaceId) return;

    const { error } = await supabase.from("notes").insert({
      id: newNote.id,
      user_id: userId,
      workspace_id: workspaceId,
      title: newNote.title,
      content: newNote.content,
      order: 0,
    });
    if (error) {
      console.error("Create note failed:", error);
      toast.error("Failed to create note");
    }

    // Persist new ordering for shifted notes
    await Promise.all(
      reordered
        .filter((n) => n.id !== newNote.id)
        .map((n) => supabase.from("notes").update({ order: n.order }).eq("id", n.id))
    );
  };

  const handleUpdateNote = async (id: string, updates: Partial<Note>) => {
    const next = notes.map((n) =>
      n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n
    );
    persist(next);

    if (!userId || !workspaceId) return;

    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.content !== undefined) dbUpdates.content = updates.content;
    if (updates.images !== undefined) dbUpdates.images = updates.images;
    if (updates.archived !== undefined) {
      dbUpdates.archived = updates.archived;
      dbUpdates.archived_at = updates.archived ? new Date().toISOString() : null;
    }
    if (Object.keys(dbUpdates).length === 0) return;
    const { error } = await supabase.from("notes").update(dbUpdates).eq("id", id);
    if (error) console.error("Update note failed:", error);
  };

  const handleDeleteNote = async (id: string) => {
    const next = notes.filter((n) => n.id !== id);
    persist(next);
    if (!userId || !workspaceId) {
      toast.success("Note deleted");
      return;
    }
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) {
      console.error("Delete note failed:", error);
      toast.error("Failed to delete note");
    } else {
      toast.success("Note deleted");
    }
  };

  const handleArchive = (id: string, archived: boolean) => {
    handleUpdateNote(id, { archived });
    toast.success(archived ? "Note archived" : "Note restored");
  };

  // Drag and drop reorder (only for active notes)
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (id !== dragOverId) setDragOverId(id);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = draggedId;
    setDraggedId(null);
    setDragOverId(null);
    if (!sourceId || sourceId === targetId) return;

    const active = notes.filter((n) => !n.archived);
    const archived = notes.filter((n) => n.archived);
    const sourceIdx = active.findIndex((n) => n.id === sourceId);
    const targetIdx = active.findIndex((n) => n.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const reorderedActive = [...active];
    const [moved] = reorderedActive.splice(sourceIdx, 1);
    reorderedActive.splice(targetIdx, 0, moved);

    const withOrder = reorderedActive.map((n, i) => ({ ...n, order: i }));
    persist([...withOrder, ...archived]);

    if (!userId || !workspaceId) return;
    await Promise.all(
      withOrder.map((n) => supabase.from("notes").update({ order: n.order }).eq("id", n.id))
    );
  };

  const activeNotes = notes.filter((n) => !n.archived).sort((a, b) => a.order - b.order);
  const archivedNotes = notes.filter((n) => n.archived).sort((a, b) => b.updatedAt - a.updatedAt);
  const visibleNotes = showArchived ? archivedNotes : activeNotes;

  return (
    <div className="size-full overflow-y-auto">
      <div className="box-border content-stretch flex flex-col gap-[16px] items-start pb-[180px] pt-[60px] px-[16px] relative min-h-full">
        {/* Header */}
        <div className="flex items-start justify-between w-full text-[24px]">
          <div className="flex gap-[10px] items-center">
            <StickyNote className="text-[#a78bfa]" size={24} />
            <p className="text-foreground">Notes</p>
          </div>
          <button onClick={onOpenSettingsMenu} className="text-foreground">
            <Settings size={24} />
          </button>
        </div>

        {/* Tabs: Active / Archived */}
        <div className="flex gap-2 w-full">
          <Button
            variant={showArchived ? "outline" : "default"}
            size="sm"
            onClick={() => setShowArchived(false)}
            className="flex-1"
          >
            Active ({activeNotes.length})
          </Button>
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchived(true)}
            className="flex-1 gap-1"
          >
            <Archive size={14} />
            Archived ({archivedNotes.length})
          </Button>
        </div>

        {/* Add note button (only on active tab) */}
        {!showArchived && (
          <Button
            onClick={handleAddNote}
            variant="outline"
            className="w-full justify-center gap-2"
          >
            <Plus size={16} />
            New note
          </Button>
        )}

        {/* Notes list */}
        <div className="flex flex-col gap-[12px] w-full">
          {visibleNotes.map((note) => {
            const isDragging = draggedId === note.id;
            const isDragOver = dragOverId === note.id && draggedId !== note.id;
            return (
              <div
                key={note.id}
                draggable={!showArchived}
                onDragStart={(e) => handleDragStart(e, note.id)}
                onDragOver={(e) => handleDragOver(e, note.id)}
                onDrop={(e) => handleDrop(e, note.id)}
                onDragEnd={handleDragEnd}
                className={`bg-card rounded-[8px] shadow-[0px_1px_4px_0px_rgba(0,0,0,0.08)] p-[12px] flex flex-col gap-[8px] transition-all ${
                  isDragging ? "opacity-50" : ""
                } ${isDragOver ? "ring-2 ring-primary" : ""}`}
              >
                <div className="flex items-start gap-2">
                  {!showArchived && (
                    <div
                      className="cursor-grab active:cursor-grabbing text-muted-foreground pt-1 touch-none"
                      aria-label="Drag to reorder"
                    >
                      <GripVertical size={16} />
                    </div>
                  )}
                  <Input
                    value={note.title}
                    onChange={(e) => handleUpdateNote(note.id, { title: e.target.value })}
                    placeholder="Title"
                    disabled={showArchived}
                    className="flex-1 border-0 bg-transparent text-[16px] font-medium px-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none h-auto py-0"
                  />
                  <button
                    onClick={() => handleArchive(note.id, !note.archived)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    aria-label={note.archived ? "Restore note" : "Archive note"}
                  >
                    {note.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        aria-label="Delete note"
                      >
                        <Trash2 size={16} />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this note?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteNote(note.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <Textarea
                  value={note.content}
                  onChange={(e) => handleUpdateNote(note.id, { content: e.target.value })}
                  placeholder="Write something..."
                  disabled={showArchived}
                  ref={(el) => {
                    if (el) {
                      el.style.height = "auto";
                      el.style.height = `${el.scrollHeight}px`;
                    }
                  }}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight}px`;
                  }}
                  style={{ fontSize: "16px" }}
                  className="border-0 bg-transparent px-0 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none min-h-[60px] overflow-hidden"
                />
                {!showArchived ? (
                  <TaskImageUploader
                    images={note.images}
                    onChange={(images) => handleUpdateNote(note.id, { images })}
                    onImageClick={(url) => setLightboxUrl(url)}
                  />
                ) : note.images.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {note.images.map((url) => (
                      <img
                        key={url}
                        src={url}
                        alt="Note attachment"
                        className="h-20 w-20 rounded-md border border-border object-cover"
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}

          {visibleNotes.length === 0 && !loading && (
            <div className="flex items-center justify-center w-full pt-20">
              <p className="text-muted-foreground">
                {showArchived
                  ? "No archived notes."
                  : 'No notes yet. Tap "New note" to add one!'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
