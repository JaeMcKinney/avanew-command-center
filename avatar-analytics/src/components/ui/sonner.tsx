import { Toaster as Sonner, type ToasterProps } from "sonner"

/** Short messages after an action. Announced politely to screen readers. */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="system"
      position="top-center"
      closeButton
      toastOptions={{ duration: 6000 }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}
