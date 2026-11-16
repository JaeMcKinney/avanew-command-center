// The code a client pastes into their website for each kind of Tavus
// deployment. Formats follow docs.tavus.io/sections/deployments.

export type EmbedInfo = { kind: "code"; label: string; code: string } | { kind: "link"; label: string; url: string | null }

export function embedFor(deployment: { deployment_id: string; channel: string; page_url: string | null }): EmbedInfo {
  const id = deployment.deployment_id
  switch (deployment.channel) {
    case "embed":
      return {
        kind: "code",
        label: "Embed",
        code: `<script src="https://unpkg.com/@tavus/embed@latest"></script>\n<tavus-embed deployment-id="${id}"></tavus-embed>`,
      }
    case "widget":
      return {
        kind: "code",
        label: "Floating widget",
        code: `<tavus-widget deployment-id="${id}"></tavus-widget>\n<script src="https://unpkg.com/@tavus/widget"></script>`,
      }
    default:
      return { kind: "link", label: "Landing page", url: deployment.page_url }
  }
}
