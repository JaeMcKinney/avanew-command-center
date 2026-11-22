import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "@/App"
import { Toaster } from "@/components/ui/sonner"
import { AvanewGlows } from "@/editions/AvanewBackdrop"
import { AuthProvider } from "@/hooks/useAuth"
import { EDITION } from "@/lib/edition"
import { followDevice } from "@/lib/theme"
import "@/index.css"
import "@/editions/avanew.css"

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } },
})

document.documentElement.dataset.edition = EDITION.id
followDevice()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {EDITION.id === "avanew" && <AvanewGlows />}
        <App />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
