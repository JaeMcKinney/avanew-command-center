import { Plus, Search } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { ClientsTable } from "@/components/ClientsTable"
import { PageHeader } from "@/components/PageHeader"
import { EmptyState } from "@/components/States"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/useAuth"

export default function Clients() {
  const { can } = useAuth()
  const [filter, setFilter] = useState("")
  const newClient = can("clients.manage") && (
    <Button asChild className="min-h-10"><Link to="/admin/clients/new"><Plus aria-hidden="true" />New client</Link></Button>
  )
  return (
    <>
      <PageHeader title="Clients" description="Each client has their own avatars, users and reports." actions={newClient} />
      <div className="flex max-w-sm flex-col gap-1.5">
        <Label htmlFor="client-filter">Find a client</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id="client-filter" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} className="min-h-10 pl-9" autoComplete="off" />
        </div>
      </div>
      <ClientsTable filter={filter} empty={<EmptyState title="No clients yet" action={newClient}>Add a client to get started.</EmptyState>} />
    </>
  )
}
