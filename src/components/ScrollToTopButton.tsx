import { useEffect, useState } from "react"
import { ArrowUp } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Fixed scroll-to-top FAB. Pass the actual scroll container element
 * (set via callback ref in AppLayout so the element is available as state
 * and the effect re-runs with the real element instead of null).
 */
export function ScrollToTopButton({
  scrollEl,
}: {
  scrollEl: HTMLElement | null
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!scrollEl) return
    function onScroll() {
      setVisible(scrollEl!.scrollTop > 300)
    }
    scrollEl.addEventListener("scroll", onScroll, { passive: true })
    return () => scrollEl.removeEventListener("scroll", onScroll)
  }, [scrollEl])

  return (
    <button
      aria-label="Scroll to top"
      onClick={() => scrollEl?.scrollTo({ top: 0, behavior: "smooth" })}
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
