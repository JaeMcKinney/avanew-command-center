import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "./index.css"
import App from "./App.tsx"
import { AuthProvider } from "@/contexts/AuthContext"
import { OrganizationProvider } from "@/contexts/OrganizationContext"
import { ThemeProvider } from "@/lib/ThemeProvider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <OrganizationProvider>
            <TooltipProvider>
              <App />
              <Toaster richColors closeButton />
            </TooltipProvider>
          </OrganizationProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
)
