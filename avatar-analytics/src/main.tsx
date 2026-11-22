import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Branded } from "@/components/Branded"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/hooks/useAuth"
import { loadHostBrand } from "@/lib/hostBrand"
import { followDevice } from "@/lib/theme"
import "@/index.css"
import "@/brand-motion.css"

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } },
})

followDevice()
loadHostBrand()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Branded />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
