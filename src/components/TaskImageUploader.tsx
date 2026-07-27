import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

type TaskImageUploaderProps = {
  images: string[];
  onChange: (images: string[]) => void;
  bucket?: string;
  onImageClick?: (url: string) => void;
};

const MAX_SIZE_MB = 5;

export function TaskImageUploader({ images, onChange, bucket = "task-images" }: TaskImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please sign in to attach images");
      return;
    }

    setUploading(true);
    const uploaded: string[] = [];
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image`);
          continue;
        }
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
          toast.error(`${file.name} exceeds ${MAX_SIZE_MB}MB`);
          continue;
        }
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from(bucket)
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (error) {
          toast.error(`Upload failed: ${error.message}`);
          continue;
        }
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        uploaded.push(data.publicUrl);
      }
      if (uploaded.length) onChange([...images, ...uploaded]);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeImage = async (url: string) => {
    onChange(images.filter((u) => u !== url));
    // Best-effort delete from storage
    try {
      const marker = `/${bucket}/`;
      const idx = url.indexOf(marker);
      if (idx >= 0) {
        const path = url.substring(idx + marker.length);
        await supabase.storage.from(bucket).remove([path]);
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="grid gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="flex flex-wrap gap-2">
        {images.map((url) => (
          <div key={url} className="relative h-20 w-20 overflow-hidden rounded-md border border-border">
            <img src={url} alt="Task attachment" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removeImage(url)}
              className="absolute top-1 right-1 rounded-full bg-background/80 p-0.5 hover:bg-background"
              aria-label="Remove image"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="h-20 w-20 flex-col gap-1 p-0"
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          <span className="text-[10px]">{uploading ? "Uploading" : "Add"}</span>
        </Button>
      </div>
    </div>
  );
}
