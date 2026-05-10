import { Outlet } from "react-router-dom"
import { AppSidebar } from "@/components/AppSidebar"
import { TopBar } from "@/components/TopBar"
// import { AVE } from "@/components/AVE"
import { ViewAsBanner } from "@/components/ViewAsBanner"

export function AppLayout() {
  return (
    <div className="flex min-h-screen w-full bg-muted/30">
      <aside className="hidden md:flex md:w-64 md:flex-col border-r border-sidebar-border">
        <AppSidebar />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <ViewAsBanner />
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
      {/* <AVE /> */}
    </div>
  )
}
