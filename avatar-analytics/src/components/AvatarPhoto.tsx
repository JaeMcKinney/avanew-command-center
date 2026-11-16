import { useState } from "react"
import { initials } from "@/lib/format"
import { cn } from "@/lib/utils"

const SIZES = { sm: "size-10 text-sm", md: "size-14 text-base", lg: "size-20 text-xl" }

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
