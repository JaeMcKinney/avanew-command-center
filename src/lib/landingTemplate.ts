// Merge-tag rendering for RA landing pages.
//
// Templates are stored as raw HTML in ra_landing_templates.html and are
// rendered server-side by string-replace at request time on the public
// /refer/:slug page. The {{form}} tag is special — it's NOT a string
// substitution; the React renderer splits the HTML on {{form}} and slots
// the live form component in between.

export type MergeContext = {
  ra_first_name: string
  ra_last_name:  string
  ra_photo:      string
  ra_bio:        string
  ra_slug:       string
}

export const MERGE_TAGS: { tag: string; description: string }[] = [
  { tag: "{{ra_first_name}}", description: "RA's first name" },
  { tag: "{{ra_last_name}}",  description: "RA's last name" },
  { tag: "{{ra_photo}}",      description: "Photo URL (use inside src=\"…\")" },
  { tag: "{{ra_bio}}",        description: "RA's bio text" },
  { tag: "{{ra_slug}}",       description: "Referral slug (e.g. \"jane-doe\")" },
  { tag: "{{form}}",          description: "Lead capture form (only rendered on /refer/:slug)" },
]

/** Replace all merge tags except {{form}}, which is handled by the renderer. */
export function renderMergeTags(html: string, ctx: MergeContext): string {
  return html
    .replaceAll("{{ra_first_name}}", escapeHtml(ctx.ra_first_name))
    .replaceAll("{{ra_last_name}}",  escapeHtml(ctx.ra_last_name))
    .replaceAll("{{ra_photo}}",      escapeAttr(ctx.ra_photo))
    .replaceAll("{{ra_bio}}",        escapeHtml(ctx.ra_bio))
    .replaceAll("{{ra_slug}}",       escapeHtml(ctx.ra_slug))
}

/** Split rendered HTML around the {{form}} marker. If absent, form goes last. */
export function splitFormSlot(html: string): { before: string; after: string } {
  const idx = html.indexOf("{{form}}")
  if (idx === -1) return { before: html, after: "" }
  return { before: html.slice(0, idx), after: html.slice(idx + "{{form}}".length) }
}

/** Built-in fallback template — used when an org has no default and no per-RA override. */
export const BUILTIN_FALLBACK_TEMPLATE = `<!-- Built-in fallback template -->
<div style="max-width:640px;margin:60px auto;padding:40px 32px;font-family:system-ui,-apple-system,sans-serif;color:#111;text-align:center">
  <img src="{{ra_photo}}" alt="{{ra_first_name}} {{ra_last_name}}"
       style="width:120px;height:120px;border-radius:9999px;object-fit:cover;margin:0 auto 24px;display:block" />
  <h1 style="font-size:32px;font-weight:600;margin:0 0 12px;letter-spacing:-.02em">
    Referred by {{ra_first_name}} {{ra_last_name}}
  </h1>
  <p style="font-size:16px;line-height:1.6;color:#555;margin:0 0 32px">
    {{ra_bio}}
  </p>
  {{form}}
</div>`

/** Starter template used when an admin clicks "New template" — copies into the editor. */
export const STARTER_TEMPLATE = `<!-- Starter template — edit freely. Use the merge tags shown below the editor. -->
<div style="max-width:680px;margin:60px auto;padding:48px 32px;font-family:system-ui,-apple-system,sans-serif;color:#111">

  <header style="text-align:center;margin-bottom:40px">
    <img src="{{ra_photo}}" alt="{{ra_first_name}}"
         style="width:96px;height:96px;border-radius:9999px;object-fit:cover;margin-bottom:20px" />
    <h1 style="font-size:28px;font-weight:600;margin:0 0 8px;letter-spacing:-.01em">
      Hi, I'm {{ra_first_name}}.
    </h1>
    <p style="font-size:15px;color:#666;margin:0">{{ra_bio}}</p>
  </header>

  <section style="background:#fafafa;border-radius:12px;padding:28px 24px;margin-bottom:32px">
    <h2 style="font-size:18px;font-weight:600;margin:0 0 8px">Ready to learn more?</h2>
    <p style="font-size:14px;color:#666;margin:0">
      Fill out the form below and I'll be in touch shortly.
    </p>
  </section>

  {{form}}

</div>`

// ── Internal helpers ────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;")
}

function escapeAttr(s: string): string {
  // For use inside attribute values (e.g. src="…"); same as escapeHtml is fine.
  return escapeHtml(s)
}
