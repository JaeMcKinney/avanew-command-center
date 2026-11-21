import { ChevronLeft } from "lucide-react"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { useDocumentTitle } from "@/hooks/useDocumentTitle"

export function PageHeader({
  title,
  description,
  actions,
  back,
  documentTitle,
}: {
  /** Needed when `title` is not plain text. */
  documentTitle?: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  back?: { to: string; label: string }
}) {
  useDocumentTitle(documentTitle ?? (typeof title === "string" ? title : null))
  return (
    <header className="flex flex-col gap-3">
      {back && (
        <Link to={back.to} className="inline-flex min-h-8 w-fit items-center gap-1 text-sm text-primary-text hover:underline">
          <ChevronLeft className="size-4" aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
          {description && <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
