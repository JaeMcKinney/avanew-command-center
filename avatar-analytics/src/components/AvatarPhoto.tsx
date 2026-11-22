import { useState } from "react"
import { initials } from "@/lib/format"
import { cn } from "@/lib/utils"

const SIZES = { xs: "size-7 text-[0.65rem]", sm: "size-10 text-sm", md: "size-14 text-base", lg: "size-20 text-xl" }

/** An avatar's photo from Tavus, or their initials if there is none. */
export function AvatarPhoto({
  name,
  src,
  size = "md",
  ring,
}: {
  name: string
  src: string | null | undefined
  size?: keyof typeof SIZES
  /** A chart colour, so the photo doubles as the legend swatch. */
  ring?: string
}) {
  const [broken, setBroken] = useState(false)
  const style = ring ? { boxShadow: `0 0 0 2px var(--card), 0 0 0 5px ${ring}` } : undefined
  const base = cn("shrink-0 rounded-full object-cover", SIZES[size])
  if (src && !broken) {
    return <img src={src} alt="" className={cn(base, "bg-muted")} style={style} onError={() => setBroken(true)} />
  }
  return (
    <span aria-hidden="true" style={style} className={cn(base, "grid place-items-center bg-secondary font-semibold text-secondary-foreground")}>
      {initials(name)}
    </span>
  )
}


/** An avatar's name with its photo beside it, for lists and tables. */
export function AvatarName({ avatar, fallback = "Avatar" }: { avatar: { display_name: string; photo_url: string | null; custom_photo_url: string | null } | null | undefined; fallback?: string }) {
  const name = avatar?.display_name ?? fallback
  return (
    <span className="inline-flex items-center gap-2 align-middle">
      <AvatarPhoto name={name} src={avatar?.custom_photo_url ?? avatar?.photo_url} size="xs" />
      <span>{name}</span>
    </span>
  )
}
