import { useEffect, useState } from "react";
import { ViewType } from "../App";
import { StickyNote, Settings, Plus, Trash2, GripVertical, Archive, ArchiveRestore, X, Image as ImageIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { BottomSheet, BottomSheetHeader, BottomSheetFooter } from "./ui/bottom-sheet";
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

  // Editor sheet state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null = creating new
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftImages, setDraftImages] = useState<string[]>([]);

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

  const openCreate = () => {
    setEditingId(null);
    setDraftTitle("");
    setDraftContent("");
    setDraftImages([]);
    setEditorOpen(true);
  };

  const openEdit = (note: Note) => {
    if (note.archived) return;
    setEditingId(note.id);
    setDraftTitle(note.title);
    setDraftContent(note.content);
    setDraftImages(note.images);
    setEditorOpen(true);
  };

  const handleSaveDraft = async () => {
    const title = draftTitle.trim();
    const content = draftContent.trim();

    if (editingId === null) {
      // Creating new
      if (!title && !content && draftImages.length === 0) {
        setEditorOpen(false);
        return;
      }
      const newNote: Note = {
        id: crypto.randomUUID(),
        title,
        content,
        order: -1,
        images: draftImages,
        archived: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const active = notes.filter((n) => !n.archived);
      const archived = notes.filter((n) => n.archived);
      const reordered = [newNote, ...active].map((n, i) => ({ ...n, order: i }));
      persist([...reordered, ...archived]);
      setEditorOpen(false);

      if (!userId || !workspaceId) return;
      const { error } = await supabase.from("notes").insert({
        id: newNote.id,
        user_id: userId,
        workspace_id: workspaceId,
        title: newNote.title,
        content: newNote.content,
        images: newNote.images,
        order: 0,
      });
      if (error) {
        console.error("Create note failed:", error);
        toast.error("Failed to create note");
      }
      await Promise.all(
        reordered
          .filter((n) => n.id !== newNote.id)
          .map((n) => supabase.from("notes").update({ order: n.order }).eq("id", n.id))
      );
    } else {
      // Editing existing
      const id = editingId;
      const next = notes.map((n) =>
        n.id === id
          ? { ...n, title, content, images: draftImages, updatedAt: Date.now() }
          : n
      );
      persist(next);
      setEditorOpen(false);

      if (!userId || !workspaceId) return;
      const { error } = await supabase
        .from("notes")
        .update({ title, content, images: draftImages })
        .eq("id", id);
      if (error) {
        console.error("Update note failed:", error);
        toast.error("Failed to save note");
      }
    }
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

  const handleArchive = async (id: string, archived: boolean) => {
    const next = notes.map((n) =>
      n.id === id ? { ...n, archived, updatedAt: Date.now() } : n
    );
    persist(next);
    toast.success(archived ? "Note archived" : "Note restored");

    if (!userId || !workspaceId) return;
    const { error } = await supabase
      .from("notes")
      .update({ archived, archived_at: archived ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) console.error("Archive note failed:", error);
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
            onClick={openCreate}
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
            const hasTitle = !!note.title.trim();
            const hasContent = !!note.content.trim();
            const hasImages = note.images.length > 0;
            const isEmpty = !hasTitle && !hasContent && !hasImages;

            return (
              <div
                key={note.id}
                draggable={!showArchived}
                onDragStart={(e) => handleDragStart(e, note.id)}
                onDragOver={(e) => handleDragOver(e, note.id)}
                onDrop={(e) => handleDrop(e, note.id)}
                onDragEnd={handleDragEnd}
                onClick={() => openEdit(note)}
                className={`bg-card rounded-[8px] shadow-[0px_1px_4px_0px_rgba(0,0,0,0.08)] p-[12px] flex flex-col gap-[8px] transition-all ${
                  !showArchived ? "cursor-pointer hover:shadow-[0px_2px_8px_0px_rgba(0,0,0,0.12)]" : ""
                } ${isDragging ? "opacity-50" : ""} ${isDragOver ? "ring-2 ring-primary" : ""}`}
              >
                <div className="flex items-start gap-2">
                  {!showArchived && (
                    <div
                      className="cursor-grab active:cursor-grabbing text-muted-foreground pt-1 touch-none"
                      aria-label="Drag to reorder"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <GripVertical size={16} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 flex flex-col gap-[6px]">
                    {hasTitle && (
                      <p className="text-[16px] font-medium text-foreground break-words">
                        {note.title}
                      </p>
                    )}
                    {hasContent && (
                      <p className="text-[14px] text-muted-foreground break-words whitespace-pre-line">
                        {note.content}
                      </p>
                    )}
                    {isEmpty && (
                      <p className="text-[14px] text-muted-foreground italic">Empty note</p>
                    )}
                    {hasImages && (
                      <div className="flex flex-wrap gap-1 mt-[2px]">
                        {note.images.slice(0, 4).map((url) => (
                          <button
                            key={url}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLightboxUrl(url);
                            }}
                            className="h-10 w-10 rounded overflow-hidden border border-border"
                            aria-label="View image"
                          >
                            <img src={url} alt="Note attachment" className="h-full w-full object-cover" />
                          </button>
                        ))}
                        {note.images.length > 4 && (
                          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center text-[11px] text-muted-foreground">
                            +{note.images.length - 4}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-start gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
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
                </div>
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

      {/* Editor bottom sheet */}
      <BottomSheet open={editorOpen} onOpenChange={setEditorOpen}>
        <BottomSheetHeader className="text-left shrink-0">
          <h2 className="sr-only text-lg font-semibold leading-none tracking-tight">
            {editingId ? "Edit note" : "New note"}
          </h2>
        </BottomSheetHeader>
        <div className="px-4 pb-2 overflow-y-auto flex-1 min-h-0">
          <div className="grid gap-4">
            <Input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Title"
              className="text-[20px] text-foreground placeholder:text-muted-foreground placeholder:italic border-0 border-b border-muted-foreground/30 rounded-none shadow-none h-auto focus-visible:ring-0 focus-visible:border-primary px-[8px] py-[4px]"
            />
            <div className="grid gap-2">
              <Label className="text-foreground font-medium">Content</Label>
              <Textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                placeholder="Write something..."
                style={{ fontSize: "16px" }}
                className="text-foreground placeholder:text-muted-foreground placeholder:italic border-0 border-b border-muted-foreground/30 rounded-none shadow-none min-h-[120px] focus-visible:ring-0 focus-visible:border-primary px-[8px] py-[4px] resize-none"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-foreground font-medium flex items-center gap-2">
                <ImageIcon size={16} /> Images
              </Label>
              <TaskImageUploader
                images={draftImages}
                onChange={setDraftImages}
                onImageClick={(url) => setLightboxUrl(url)}
              />
            </div>
          </div>
        </div>
        <BottomSheetFooter
          className="shrink-0 p-3 pt-2 border-t bg-background"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
        >
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDraft}>
              {editingId ? "Save" : "Create Note"}
            </Button>
          </div>
        </BottomSheetFooter>
      </BottomSheet>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 rounded-full bg-background/20 p-2 text-white hover:bg-background/40"
            aria-label="Close image"
          >
            <X size={24} />
          </button>
          <img
            src={lightboxUrl}
            alt="Note attachment preview"
            className="max-h-[90dvh] max-w-full rounded-md object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
