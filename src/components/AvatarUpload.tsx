import { useRef, useState } from "react"
import { Camera, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { uploadAvatar } from "@/lib/data"
import { supabase } from "@/lib/supabase"

interface Props {
  currentUrl: string | null
  initials: string
  onUploaded: (url: string) => void
}

export function AvatarUpload({ currentUrl, initials, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (JPG, PNG, WebP, etc.)")
      return
    }
    // Show local preview immediately so there's no perceived lag
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const url = await uploadAvatar(user.id, file)
      onUploaded(url)
      toast.success("Profile photo updated")
    } catch (err) {
      setPreviewUrl(null)
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      URL.revokeObjectURL(objectUrl)
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const displayUrl = previewUrl ?? currentUrl

  return (
    <div
      className="relative cursor-pointer group h-16 w-16"
      style={uploading ? { pointerEvents: "none" } : undefined}
      onClick={() => !uploading && inputRef.current?.click()}
      title={uploading ? "Uploading…" : "Click to change photo"}
    >
      <Avatar className="h-16 w-16">
        {displayUrl && <AvatarImage src={displayUrl} alt="Profile photo" />}
        <AvatarFallback className="text-lg">{initials}</AvatarFallback>
      </Avatar>

      {/* Hover overlay */}
      <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        {uploading ? (
          <Loader2 className="h-5 w-5 text-white animate-spin" />
        ) : (
          <Camera className="h-5 w-5 text-white" />
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
        }}
      />
    </div>
  )
}
