import { useEffect, useState } from "react"
import { ArrowUp } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Fixed scroll-to-top FAB. Pass the ref of the scrollable container
 * (the <main> element in AppLayout). Hidden until user scrolls 300 px down;
 * fades + slides in/out smoothly. Works on both desktop and mobile.
 */
export function ScrollToTopButton({
  scrollRef,
}: {
  scrollRef: React.RefObject<HTMLElement | null>
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    function onScroll() {
      setVisible(el!.scrollTop > 300)
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [scrollRef])

  return (
    <button
      aria-label="Scroll to top"
      onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        "fixed bottom-20 right-4 md:right-6 z-50 h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-all duration-200",
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-4 pointer-events-none"
      )}
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  )
}
