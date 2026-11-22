import { useQuery } from "@tanstack/react-query"
import { BrandForm } from "@/components/BrandForm"
import { PageHeader } from "@/components/PageHeader"
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/States"
import { useAuth } from "@/hooks/useAuth"
import { getAgencyById } from "@/lib/api"

/** An agency's own staff change their agency's logos and colours here. */
export default function Brand() {
  const { access } = useAuth()
  const agencyId = access?.agency?.id ?? ""
  const agency = useQuery({ queryKey: ["agency", "mine", agencyId], queryFn: () => getAgencyById(agencyId), enabled: Boolean(agencyId) })

  if (!agencyId) return <EmptyState title="There Is No Brand to Change Here">This page is for an agency's own team.</EmptyState>
  if (agency.isPending) return <LoadingBlock label="Loading your brand" />
  if (agency.isError) return <ErrorBlock error={agency.error} onRetry={() => void agency.refetch()} />
  if (!agency.data) return <EmptyState title="Your Agency Could Not Be Found">Ask Divigner for help.</EmptyState>
  return (
    <>
      <PageHeader title="Brand" description={`How Avalytics looks for ${agency.data.name}'s team and for its clients: logos, colors, and a light and a dark version.`} />
      <BrandForm agency={agency.data} />
    </>
  )
}
