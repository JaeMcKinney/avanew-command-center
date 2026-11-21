// Small pieces of the support desk's email handling. Pure functions, so they
// run the same in Deno and in the Node unit tests.

/** The line that separates a person's reply from the email they are replying to. */
export const REPLY_MARKER = "Reply above this line"

/** "Dana Reyes <Dana@Example.com>" → "dana@example.com". Null if there is no address. */
export function emailAddress(value: string | null | undefined): string | null {
  if (!value) return null
  const match = value.match(/<([^<>\s]+@[^<>\s]+)>/) ?? value.match(/([^\s<>"',;]+@[^\s<>"',;]+)/)
  return match ? match[1].toLowerCase() : null
}

/** The address replies to a ticket should go to: support+t1001-<token>@example.com. */
export function replyAddress(inbox: string, ticketNumber: number, token: string): string | null {
  const address = emailAddress(inbox)
  if (!address) return null
  const [local, domain] = address.split("@")
  return `${local.split("+")[0]}+t${ticketNumber}-${token}@${domain}`
}

/**
 * Which ticket an incoming email is for, read from the address it was sent to.
 * Returns the reference ("t1001-<token>"), "" for mail sent to the plain
 * support address (a new ticket), or null when none of the addresses is ours.
 */
export function ticketReference(recipients: string[], inbox: string): string | null {
  const ours = emailAddress(inbox)
  if (!ours) return null
  const [local, domain] = ours.split("@")
  const base = local.split("+")[0]
  let plain = false
  for (const raw of recipients) {
    const address = emailAddress(raw)
    if (!address) continue
    const [theirLocal, theirDomain] = address.split("@")
    if (theirDomain !== domain) continue
    const [theirBase, tag] = theirLocal.split("+")
    if (theirBase !== base) continue
    if (tag && /^t\d{1,12}-[0-9a-f]{8,64}$/.test(tag)) return tag
    if (!tag) plain = true
  }
  return plain ? "" : null
}

/** Rough plain text from an HTML email, for mail that has no text part. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** Keeps what the person wrote and drops the quoted email underneath it. */
export function stripQuotedReply(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const kept: string[] = []
  for (const line of lines) {
    if (line.includes(REPLY_MARKER)) break
    if (/^On .{5,200} wrote:\s*$/.test(line.trim())) break
    if (/^-{2,}\s*Original Message\s*-{2,}$/i.test(line.trim())) break
    if (/^From:\s.+@.+/.test(line.trim()) && kept.length > 0) break
    kept.push(line)
  }
  // A long "On … wrote:" line is often wrapped onto two lines by the mail program.
  while (kept.length && /^(>|On .*\d{4}.*)$/.test(kept[kept.length - 1].trim())) kept.pop()
  return kept.filter((line) => !line.trim().startsWith(">")).join("\n").replace(/\n{3,}/g, "\n\n").trim()
}
