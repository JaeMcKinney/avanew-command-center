import { Eye, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRole } from "@/hooks/useRole"
import type { TeamRole } from "@/types/db"

const ROLE_LABELS: Record<TeamRole, string> = {
  super_user: "Super User",
  owner: "Owner",
  admin: "Admin",
  bd: "BD",
  partner: "Partner",
}

export function ViewAsBanner() {
  const { viewAs, setViewAsRole } = useRole()

  if (!viewAs) return null

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
      <Eye className="h-4 w-4 shrink-0" />
      <span className="text-center">
        Viewing as <strong>{ROLE_LABELS[viewAs]}</strong>. UI is scoped; you keep Super User privileges.
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setViewAsRole(null)}
        className="h-7 gap-1 text-amber-900 hover:bg-amber-200 dark:text-amber-200 dark:hover:bg-amber-900/50"
      >
        <X className="h-3.5 w-3.5" />
        Exit
      </Button>
    </div>
  )
}
