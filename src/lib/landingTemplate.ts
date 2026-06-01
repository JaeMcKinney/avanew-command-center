// Merge-tag rendering for RA landing pages.
//
// Templates are stored as raw HTML in ra_landing_templates.html.
// Full-page templates (starting with <!DOCTYPE or <html) are rendered inside
// an iframe so their scripts execute. Partial templates split on {{form}} and
// slot the React form component in-between.

export type MergeContext = {
  ra_first_name:  string
  ra_last_name:   string
  ra_photo:       string
  ra_bio:         string
  ra_slug:        string
  functions_url:  string  // Supabase edge function URL for form submission
}

export const MERGE_TAGS: { tag: string; description: string }[] = [
  { tag: "{{ra_first_name}}", description: "RA's first name" },
  { tag: "{{ra_last_name}}",  description: "RA's last name" },
  { tag: "{{ra_photo}}",      description: "Photo URL (use inside src=\"…\")" },
  { tag: "{{ra_bio}}",        description: "RA's bio text" },
  { tag: "{{ra_slug}}",       description: "Referral slug (e.g. \"jane-doe\")" },
  { tag: "{{functions_url}}", description: "Edge function URL for form POST (full-page templates)" },
  { tag: "{{form}}",          description: "Lead capture form — injected by React (partial templates only)" },
]

/** Returns true when the template is a full HTML document (has its own scripts). */
export function isFullPageTemplate(html: string): boolean {
  const t = html.trimStart()
  return t.startsWith("<!DOCTYPE") || t.startsWith("<!doctype") || t.startsWith("<html")
}

/**
 * Replace all merge tags.
 * ra_slug and functions_url are NOT HTML-escaped because they are embedded
 * directly inside JavaScript string literals in full-page templates.
 */
export function renderMergeTags(html: string, ctx: MergeContext): string {
  return html
    .replaceAll("{{ra_first_name}}", escapeHtml(ctx.ra_first_name))
    .replaceAll("{{ra_last_name}}",  escapeHtml(ctx.ra_last_name))
    .replaceAll("{{ra_photo}}",      escapeAttr(ctx.ra_photo))
    .replaceAll("{{ra_bio}}",        escapeHtml(ctx.ra_bio))
    // ra_slug is alphanumeric+hyphens only (DB-validated) — safe raw in JS strings
    .replaceAll("{{ra_slug}}",       ctx.ra_slug)
    // functions_url is a plain HTTPS URL — safe raw in JS strings
    .replaceAll("{{functions_url}}", ctx.functions_url)
}

/** Split rendered HTML around the {{form}} marker. If absent, form goes last. */
export function splitFormSlot(html: string): { before: string; after: string } {
  const idx = html.indexOf("{{form}}")
  if (idx === -1) return { before: html, after: "" }
  return { before: html.slice(0, idx), after: html.slice(idx + "{{form}}".length) }
}

// ── Divigner logo (base64 inline SVG) ────────────────────────────────────────
const DIVIGNER_LOGO_B64 = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyBpZD0iTGF5ZXJfMSIgZGF0YS1uYW1lPSJMYXllciAxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgMTE1NS4xNiAzNjguNDkiPgogIDxkZWZzPgogICAgPHN0eWxlPgogICAgICAuY2xzLTEgewogICAgICAgIGZpbGw6IHVybCgjbGluZWFyLWdyYWRpZW50LTIpOwogICAgICB9CgogICAgICAuY2xzLTIgewogICAgICAgIGZpbGw6ICNjNWM1YzU7CiAgICAgIH0KCiAgICAgIC5jbHMtMyB7CiAgICAgICAgZmlsbDogI2M5YzljOTsKICAgICAgfQoKICAgICAgLmNscy00IHsKICAgICAgICBmaWxsOiB1cmwoI2xpbmVhci1ncmFkaWVudC00KTsKICAgICAgfQoKICAgICAgLmNscy01IHsKICAgICAgICBmaWxsOiB1cmwoI3JhZGlhbC1ncmFkaWVudCk7CiAgICAgIH0KCiAgICAgIC5jbHMtNiB7CiAgICAgICAgZmlsbDogdXJsKCNsaW5lYXItZ3JhZGllbnQtMyk7CiAgICAgIH0KCiAgICAgIC5jbHMtNyB7CiAgICAgICAgZmlsbDogdXJsKCNsaW5lYXItZ3JhZGllbnQtNSk7CiAgICAgIH0KCiAgICAgIC5jbHMtOCB7CiAgICAgICAgZmlsbDogdXJsKCNsaW5lYXItZ3JhZGllbnQtNyk7CiAgICAgIH0KCiAgICAgIC5jbHMtOSB7CiAgICAgICAgZmlsbDogdXJsKCNsaW5lYXItZ3JhZGllbnQtNik7CiAgICAgIH0KCiAgICAgIC5jbHMtMTAgewogICAgICAgIGZpbGw6IHVybCgjbGluZWFyLWdyYWRpZW50LTgpOwogICAgICB9CgogICAgICAuY2xzLTEwLCAuY2xzLTExIHsKICAgICAgICBmaWxsLXJ1bGU6IGV2ZW5vZGQ7CiAgICAgIH0KCiAgICAgIC5jbHMtMTEgewogICAgICAgIGZpbGw6IHVybCgjbGluZWFyLWdyYWRpZW50KTsKICAgICAgfQoKICAgICAgLmNscy0xMiB7CiAgICAgICAgZmlsbDogI2Y3ZjdmNzsKICAgICAgfQogICAgPC9zdHlsZT4KICAgIDxyYWRpYWxHcmFkaWVudCBpZD0icmFkaWFsLWdyYWRpZW50IiBjeD0iNTc3LjU4IiBjeT0iMTI3LjU4IiBmeD0iNTc3LjU4IiBmeT0iMTI3LjU4IiByPSIyMTguNDkiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjMDIwMjAyIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2JkYmRiZCIvPgogICAgPC9yYWRpYWxHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0ibGluZWFyLWdyYWRpZW50IiB4MT0iNDUzLjkyIiB5MT0iMTMwLjIyIiB4Mj0iNjk0LjQ4IiB5Mj0iMTMwLjIyIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzAyMDIwMiIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNiZGJkYmQiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImxpbmVhci1ncmFkaWVudC0yIiB4MT0iMzYxLjkyIiB5MT0iMTY4LjE1IiB4Mj0iNDQzLjAzIiB5Mj0iMTY4LjE1IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CiAgICAgIDxzdG9wIG9mZnNldD0iLjIiIHN0b3AtY29sb3I9IiMwMjAyMDIiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIuNSIgc3RvcC1jb2xvcj0iIzMyYTBiNyIvPgogICAgICA8c3RvcCBvZmZzZXQ9Ii45OCIgc3RvcC1jb2xvcj0iI2ZmZiIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0ibGluZWFyLWdyYWRpZW50LTMiIHgxPSIzMTcuMjIiIHkxPSI4Ny4zOCIgeTI9Ijg3LjM4IiB4bGluazpocmVmPSIjbGluZWFyLWdyYWRpZW50LTIiLz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0ibGluZWFyLWdyYWRpZW50LTQiIHgxPSIzMzkuNTciIHkxPSIxMjcuNzYiIHkyPSIxMjcuNzYiIHhsaW5rOmhyZWY9IiNsaW5lYXItZ3JhZGllbnQtMiIvPgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJsaW5lYXItZ3JhZGllbnQtNSIgeDE9IjgzNC44MyIgeTE9Ijg3LjM4IiB4Mj0iNzA5LjAzIiB5Mj0iODcuMzgiIHhsaW5rOmhyZWY9IiNsaW5lYXItZ3JhZGllbnQtMiIvPgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJsaW5lYXItZ3JhZGllbnQtNiIgeDE9IjgxMi40OCIgeTE9IjEyNy43NiIgeDI9IjcwOS4wMyIgeTI9IjEyNy43NiIgeGxpbms6aHJlZj0iI2xpbmVhci1ncmFkaWVudC0yIi8+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImxpbmVhci1ncmFkaWVudC03IiB4MT0iNzkwLjE0IiB4Mj0iNzA5LjAzIiB4bGluazpocmVmPSIjbGluZWFyLWdyYWRpZW50LTIiLz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0ibGluZWFyLWdyYWRpZW50LTgiIHgxPSI1NzcuNTgiIHkxPSIyNDEuODMiIHgyPSI1NzcuNTgiIHkyPSIxMy4zMyIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgogICAgICA8c3RvcCBvZmZzZXQ9Ii4xIiBzdG9wLWNvbG9yPSIjZmZmIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iLjM4IiBzdG9wLWNvbG9yPSIjNGM0YzRjIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iLjQ0IiBzdG9wLWNvbG9yPSIjZDE5NzAzIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iLjY4IiBzdG9wLWNvbG9yPSIjZGVkZWRlIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iLjg3IiBzdG9wLWNvbG9yPSIjZmZmIi8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KICA8Zz4KICAgIDxnPgogICAgICA8cGF0aCBjbGFzcz0iY2xzLTMiIGQ9Ik04MzkuOTMsNDIuMTdoLTMuMTJ2LTE1LjI1aDkuNThjMy40NiwwLDUuOCwxLjY2LDUuOCw0LjgsMCwyLjMzLTEuMzYsMy44OS0zLjUyLDQuNDhsMy44OSw1Ljk3aC0zLjU5bC0zLjU5LTUuNjdoLTUuNDR2NS42N1pNODQ2LjIyLDMzLjg5YzEuODIsMCwyLjg3LS43OSwyLjg3LTIuMTVzLTEuMDQtMi4xNy0yLjg3LTIuMTdoLTYuMjl2NC4zMWg2LjI5WiIvPgogICAgICA8cGF0aCBjbGFzcz0iY2xzLTIiIGQ9Ik04MzkuOTMsNDIuMTdoLTMuMTJ2LTE1LjI1aDkuNThjMy40NiwwLDUuOCwxLjY2LDUuOCw0LjgsMCwyLjMzLTEuMzYsMy44OS0zLjUyLDQuNDhsMy44OSw1Ljk3aC0zLjU5bC0zLjU5LTUuNjdoLTUuNDR2NS42N1pNODQ2LjIyLDMzLjg5YzEuODIsMCwyLjg3LS43OSwyLjg3LTIuMTVzLTEuMDQtMi4xNy0yLjg3LTIuMTdoLTYuMjl2NC4zMWg2LjI5WiIvPgogICAgPC9nPgogICAgPHBhdGggY2xhc3M9ImNscy0yIiBkPSJNODQzLjY5LDUxLjA0Yy05LjEsMC0xNi41LTcuNC0xNi41LTE2LjVzNy40LTE2LjUsMTYuNS0xNi41LDE2LjUsNy40LDE2LjUsMTYuNS03LjQsMTYuNS0xNi41LDE2LjVaTTg0My42OSwyMC4yMWMtNy45MSwwLTE0LjM0LDYuNDMtMTQuMzQsMTQuMzRzNi40MywxNC4zNCwxNC4zNCwxNC4zNCwxNC4zNC02LjQzLDE0LjM0LTE0LjM0LTYuNDMtMTQuMzQtMTQuMzQtMTQuMzRaIi8+CiAgPC9nPgo8L3N2Zz4="

/**
 * BUILTIN_FALLBACK_TEMPLATE
 * Full-page Divigner-branded landing page. Served when an org has no default
 * template configured and no per-RA override. Scripts execute via iframe.
 *
 * Kept in sync with /Downloads/ra-lead.html — update both together.
 */
export const BUILTIN_FALLBACK_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
<meta name="theme-color" content="#06101D">
<title>Get Started · Divigner Group</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=Manrope:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root{
    --ink:#06101D; --bg:#091A2D; --bg-2:#0B2138;
    --surface:#0E2741; --surface-2:#123150;
    --line:rgba(120,214,196,.16); --line-soft:rgba(160,190,215,.12);
    --gold:#C9A86A; --teal:#18B9A6; --teal-bright:#34D6C2; --cyan:#5FE3D2;
    --text:#EAF2F9; --muted:#A2B6C9; --muted-2:#6E8499;
    --maxw:760px;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  body{font-family:'Manrope',sans-serif;background:var(--bg);color:var(--text);line-height:1.7;-webkit-font-smoothing:antialiased;overflow-x:hidden;position:relative;min-height:100vh;display:flex;flex-direction:column}
  body::before{content:"";position:fixed;inset:0;z-index:-2;
    background:
      radial-gradient(900px 600px at 78% -5%, rgba(52,214,194,.16), transparent 60%),
      radial-gradient(800px 700px at -10% 12%, rgba(28,90,140,.30), transparent 55%),
      radial-gradient(1000px 900px at 50% 110%, rgba(20,80,110,.22), transparent 60%),
      linear-gradient(180deg,#06101D 0%, #091A2D 40%, #08182A 100%);}
  body::after{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:.05;mix-blend-mode:overlay;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
  a{color:inherit}
  img{max-width:100%;display:block}

  .wrap{width:100%;max-width:var(--maxw);margin:0 auto;padding:0 32px}

  /* ── Main layout ── */
  main{flex:1;padding:0;display:flex;flex-direction:column;align-items:center}

  /* ── RA hero ── */
  .ra-hero{text-align:center;padding:52px 32px 28px;max-width:620px;width:100%;margin:0 auto}
  .ra-avatar{width:110px;height:110px;border-radius:50%;object-fit:cover;margin:0 auto 20px;border:2px solid var(--line);box-shadow:0 0 0 6px rgba(52,214,194,.07),0 20px 50px -10px rgba(0,0,0,.5)}
  .ra-avatar-initials{width:110px;height:110px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:700;color:#06101D;margin:0 auto 20px;background:linear-gradient(135deg,#18B9A6,#34D6C2);border:2px solid var(--line);box-shadow:0 0 0 6px rgba(52,214,194,.07),0 20px 50px -10px rgba(0,0,0,.5)}
  .ra-eyebrow{font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:var(--cyan);font-weight:700;margin-bottom:10px}
  .ra-name{font-family:'Fraunces',serif;font-size:clamp(28px,5vw,42px);font-weight:300;color:var(--text);letter-spacing:-.015em;line-height:1.1}

  /* ── Form hero ── */
  .form-hero{text-align:center;margin:0 auto 30px;max-width:620px;padding:0 32px}
  .eyebrow{display:inline-flex;align-items:center;justify-content:center;gap:12px;font-size:12px;letter-spacing:.28em;text-transform:uppercase;color:var(--cyan);font-weight:700;margin-bottom:22px}
  .eyebrow::before,.eyebrow::after{content:"";width:30px;height:1px;background:linear-gradient(90deg,transparent,var(--teal),transparent)}
  h1.form-title{font-family:'Fraunces',serif;font-weight:300;font-size:clamp(36px,5.6vw,58px);line-height:1.05;letter-spacing:-.015em;color:var(--text);text-wrap:balance}
  h1.form-title .grad{background:linear-gradient(110deg,var(--cyan),var(--teal-bright) 45%,var(--gold));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;font-style:italic;font-weight:400}
  .form-sub{font-family:'Fraunces',serif;font-style:italic;font-size:18px;color:var(--muted);font-weight:300;margin-top:18px;line-height:1.55;max-width:540px;margin-left:auto;margin-right:auto;text-wrap:pretty}

  /* ── Form card — floats above footer ── */
  .form-card{width:100%;max-width:620px;margin:0 auto -70px;position:relative;background:linear-gradient(170deg,rgba(14,39,65,.97),rgba(9,26,45,.97));border:1px solid var(--line);border-radius:24px;padding:42px 40px 36px;box-shadow:0 40px 100px -20px rgba(0,0,0,.75),0 0 0 1px rgba(120,214,196,.06) inset;overflow:hidden;z-index:1}
  .form-card::before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:linear-gradient(90deg,var(--teal),var(--cyan),var(--gold))}
  @media(max-width:520px){.form-card{padding:28px 20px 24px;border-radius:20px;margin-bottom:-50px}}

  .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .form-grid .full{grid-column:1 / -1}
  @media(max-width:520px){.form-grid{grid-template-columns:1fr}}
  .field{display:flex;flex-direction:column;gap:6px}
  .field label{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted-2);font-weight:700}
  .field input,.field textarea{font-family:'Manrope';font-size:14.5px;color:var(--text);background:rgba(6,16,29,.55);border:1px solid rgba(120,214,196,.18);border-radius:10px;padding:13px 14px;outline:none;transition:border-color .2s,background .2s,box-shadow .2s;width:100%}
  .field textarea{resize:vertical;min-height:96px;line-height:1.6}
  .field input::placeholder,.field textarea::placeholder{color:var(--muted-2)}
  .field input:focus,.field textarea:focus{border-color:var(--teal-bright);background:rgba(6,16,29,.75);box-shadow:0 0 0 3px rgba(52,214,194,.12)}
  .field-error{color:#ff7d7d;font-size:11.5px;letter-spacing:.04em;margin-top:2px;display:none}
  .field.invalid input,.field.invalid textarea{border-color:rgba(255,125,125,.6)}
  .field.invalid .field-error{display:block}

  .intent-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:26px}
  @media(max-width:520px){.intent-row{grid-template-columns:1fr}}
  .intent-btn{position:relative;padding:16px 18px;border-radius:12px;font-family:'Manrope';font-size:12.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;cursor:pointer;border:1px solid;transition:transform .25s,box-shadow .3s,background .3s,border-color .3s,color .3s;display:flex;align-items:center;justify-content:center;gap:10px}
  .intent-btn svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
  .intent-btn.interested{background:rgba(14,39,65,.7);border-color:rgba(120,214,196,.35);color:var(--muted)}
  .intent-btn.interested:hover{background:rgba(24,185,166,.12);border-color:var(--teal-bright);color:var(--text)}
  .intent-btn.sold{background:rgba(14,39,65,.7);border-color:rgba(120,214,196,.35);color:var(--muted)}
  .intent-btn.sold:hover{background:rgba(24,185,166,.12);border-color:var(--teal-bright);color:var(--text)}
  .intent-btn.selected.interested{background:rgba(24,185,166,.2);border-color:var(--teal-bright);color:var(--text);box-shadow:0 0 0 2px rgba(52,214,194,.2)}
  .intent-btn.selected.sold{background:linear-gradient(120deg,var(--teal-bright),var(--cyan));color:#06101D;border-color:var(--cyan);box-shadow:0 10px 28px -10px rgba(52,214,194,.55)}
  .intent-btn:disabled{opacity:.6;pointer-events:none}
  .intent-error{color:#ff7d7d;font-size:11.5px;text-align:center;margin-top:10px;display:none}
  .intent-error.shown{display:block}

  /* ── Submit button ── */
  .submit-row{margin-top:20px;display:flex;justify-content:center}
  .submit-btn{min-width:200px;padding:15px 36px;background:rgba(14,39,65,.8);border:1px solid rgba(120,214,196,.35);color:var(--text);border-radius:12px;font-family:'Manrope';font-size:12.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:10px;transition:.25s}
  .submit-btn svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
  .submit-btn:hover{border-color:var(--teal-bright);background:rgba(24,185,166,.12);color:var(--cyan);transform:translateY(-1px)}
  .submit-btn:disabled{opacity:.5;pointer-events:none}

  /* ── RA hero bio ── */
  .ra-bio{font-family:'Fraunces',serif;font-style:italic;font-size:16px;color:var(--muted);line-height:1.65;max-width:400px;margin:12px auto 0}

  /* ── Consent / opt-out ── */
  .consent-row{margin-top:22px;padding:18px 20px;background:rgba(6,16,29,.4);border:1px solid var(--line-soft);border-radius:12px}
  .consent-label{display:flex;align-items:flex-start;gap:12px;cursor:pointer;font-size:12.5px;color:var(--muted);line-height:1.65}
  .consent-label input[type="checkbox"]{width:18px;height:18px;min-width:18px;margin-top:2px;accent-color:var(--teal-bright);cursor:pointer}
  .consent-label a{color:var(--cyan);text-decoration:underline;text-underline-offset:2px}
  .form-foot{margin-top:14px;font-size:11.5px;color:var(--muted-2);text-align:center;letter-spacing:.04em}

  /* ── Success state ── */
  .success{display:none;width:100%;max-width:520px;text-align:center;padding:30px 30px 36px}
  .success.shown{display:block;animation:fadeUp .55s cubic-bezier(.2,.7,.2,1)}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  .success .check-wrap{width:88px;height:88px;border-radius:50%;background:linear-gradient(160deg,rgba(24,185,166,.22),rgba(14,39,65,.85));border:1px solid var(--line);display:grid;place-items:center;margin:0 auto 24px;box-shadow:0 0 50px -8px rgba(52,214,194,.45)}
  .success .check-wrap svg{width:42px;height:42px;stroke:var(--cyan);fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  .success h2{font-family:'Fraunces',serif;font-weight:400;font-size:clamp(28px,4.4vw,40px);line-height:1.1;color:var(--text);letter-spacing:-.01em;margin-bottom:14px;text-wrap:balance}
  .success h2 .grad{background:linear-gradient(110deg,var(--cyan),var(--teal-bright) 50%,var(--gold));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;font-style:italic}
  .success p{color:var(--muted);font-size:16px;line-height:1.7;max-width:440px;margin:0 auto;text-wrap:pretty}
  .success .post-cta{margin-top:30px;display:flex;flex-wrap:wrap;justify-content:center;gap:12px}
  .success .post-cta a{display:inline-flex;align-items:center;gap:9px;padding:13px 22px;border-radius:11px;font-family:'Manrope';font-size:12.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;text-decoration:none;transition:.25s}
  .success .post-cta a.secondary{background:rgba(14,39,65,.6);color:var(--text);border:1px solid var(--line)}
  .success .post-cta a.secondary:hover{background:rgba(24,185,166,.12);border-color:var(--teal-bright);color:var(--cyan)}
  .success .post-cta a svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}

  body.submitted .form-hero,body.submitted .form-card{display:none}

  /* ── Footer ── */
  footer{padding:100px 0 48px;border-top:1px solid var(--line-soft);position:relative;z-index:0}
  .footer-row{display:flex;flex-direction:column;align-items:center;text-align:center;gap:16px}
  .footer-logo-img{height:42px;width:auto;display:block;filter:drop-shadow(0 2px 10px rgba(0,0,0,.45))}
  .footer-text{color:var(--muted-2);font-size:12.5px;line-height:1.75}
  .footer-text a{color:var(--muted);text-decoration:none;border-bottom:1px solid transparent;transition:.2s}
  .footer-text a:hover{color:var(--cyan);border-bottom-color:rgba(52,214,194,.35)}
  .footer-meta{font-size:11.5px;color:var(--muted-2);margin-top:8px;letter-spacing:.04em}

  @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
</head>
<body>

<main>
  <div class="wrap">

    <!-- ── RA hero ── -->
    <div class="ra-hero" id="ra-hero">
      <div id="ra-avatar-wrap"></div>
      <div class="ra-eyebrow">Referred by</div>
      <div class="ra-name" id="ra-hero-name">{{ra_first_name}} {{ra_last_name}}</div>
      <div class="ra-bio" id="ra-hero-bio">{{ra_bio}}</div>
    </div>

    <div class="form-hero" id="form-hero">
      <span class="eyebrow">Get Started</span>
      <h1 class="form-title">Tell us about <span class="grad">you.</span></h1>
      <p class="form-sub">Drop your details and let us know where you are. We'll respond from the Divigner team, and your Referral Associate will be notified automatically.</p>
    </div>

    <form class="form-card" id="lead-form" novalidate>
      <div class="form-grid">
        <div class="field">
          <label for="lead-first-name">First Name *</label>
          <input id="lead-first-name" name="first_name" type="text" placeholder="Jane" autocomplete="given-name" required>
          <div class="field-error">Please enter your first name.</div>
        </div>
        <div class="field">
          <label for="lead-last-name">Last Name *</label>
          <input id="lead-last-name" name="last_name" type="text" placeholder="Doe" autocomplete="family-name" required>
          <div class="field-error">Please enter your last name.</div>
        </div>
        <div class="field">
          <label for="lead-email">Email *</label>
          <input id="lead-email" name="email" type="email" placeholder="jane@company.com" autocomplete="email" required>
          <div class="field-error">A valid email is required.</div>
        </div>
        <div class="field">
          <label for="lead-phone">Phone *</label>
          <input id="lead-phone" name="phone" type="tel" placeholder="(555) 555-0142" autocomplete="tel" required>
          <div class="field-error">Please enter a phone number.</div>
        </div>
        <div class="field">
          <label for="lead-company">Business Name *</label>
          <input id="lead-company" name="company" type="text" placeholder="Your business" autocomplete="organization" required>
          <div class="field-error">Please enter your business name.</div>
        </div>
        <div class="field">
          <label for="lead-website">Website</label>
          <input id="lead-website" name="website" type="url" placeholder="https://yourbusiness.com" autocomplete="url">
          <div class="field-error">Please enter a valid URL.</div>
        </div>
        <div class="field full">
          <label for="lead-message">Anything you'd like us to know?</label>
          <textarea id="lead-message" name="message" placeholder="Tell us about your goals, your timeline, or any questions you have…" rows="4"></textarea>
        </div>
      </div>

      <input type="hidden" name="prospect_intent" id="lead-intent" value="">

      <div class="intent-row">
        <button type="button" class="intent-btn interested" data-intent="interested">
          I'm Interested
          <svg viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
        </button>
        <button type="button" class="intent-btn sold" data-intent="sold">
          I'm Sold
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
      </div>
      <div class="intent-error" id="intent-error">Please select how you'd like to proceed above.</div>

      <div class="submit-row">
        <button type="submit" class="submit-btn" id="submit-btn">
          Submit
          <svg viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
        </button>
      </div>

      <!-- Marketing consent (opt-in by default) -->
      <div class="consent-row" id="consent-row">
        <label class="consent-label">
          <input type="checkbox" id="lead-consent" checked>
          <span>It's okay to email me about Divigner updates, offers, and helpful resources. You can opt out anytime by emailing <a href="mailto:hello@divigner.com">hello@divigner.com</a> or clicking "unsubscribe" in any email we send. Uncheck this if you'd prefer we only contact you about this inquiry.</span>
        </label>
      </div>

      <div class="form-foot">Your information is kept secure and never sold to third parties.</div>
    </form>

    <div class="success" id="success">
      <div class="check-wrap">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>
      </div>
      <h2>Thanks — <span class="grad">we've got it.</span></h2>
      <p>Your Referral Associate has been notified and the Divigner team will reach out shortly.</p>
      <div class="post-cta">
        <a class="secondary" href="https://divigner.com" target="_blank" rel="noopener">Visit divigner.com
          <svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
      </div>
    </div>

  </div>
</main>

<footer>
  <div class="wrap">
    <div class="footer-row">
      <img class="footer-logo-img" id="footer-logo" alt="Divigner Group">
      <div class="footer-text">
        <a href="https://divigner.com" target="_blank" rel="noopener">divigner.com</a><br>
        7 North Willow Street, Suite 8C, Montclair, NJ 07042
        <div class="footer-meta">&#169; <span id="year"></span> Divigner Group, LLC. All rights reserved.</div>
      </div>
    </div>
  </div>
</footer>

<script>
(function(){
  var LOGO = '${DIVIGNER_LOGO_B64}';
  var fl = document.getElementById('footer-logo');
  if(fl) fl.src = LOGO;
  document.getElementById('year').textContent = new Date().getFullYear();

  /* ── RA avatar: photo with initials fallback ── */
  var avatarWrap = document.getElementById('ra-avatar-wrap');
  var photoUrl = '{{ra_photo}}';
  var nameEl = document.getElementById('ra-hero-name');
  var nameParts = (nameEl ? nameEl.textContent : '').trim().split(/\\s+/);
  var initials = nameParts.slice(0,2).map(function(w){ return w.charAt(0).toUpperCase(); }).join('') || '?';

  if(photoUrl) {
    var img = document.createElement('img');
    img.className = 'ra-avatar';
    img.src = photoUrl;
    img.alt = nameEl ? nameEl.textContent : '';
    img.onerror = function(){
      avatarWrap.innerHTML = '';
      var d = document.createElement('div');
      d.className = 'ra-avatar-initials';
      d.textContent = initials;
      avatarWrap.appendChild(d);
    };
    avatarWrap.appendChild(img);
  } else {
    var d = document.createElement('div');
    d.className = 'ra-avatar-initials';
    d.textContent = initials;
    avatarWrap.appendChild(d);
  }

  /* ── Form ── */
  var form = document.getElementById('lead-form');
  var intentInput = document.getElementById('lead-intent');
  var intentError = document.getElementById('intent-error');
  var busy = false;

  form.querySelectorAll('.intent-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var val = btn.dataset.intent;
      if(intentInput.value === val){
        intentInput.value = '';
        form.querySelectorAll('.intent-btn').forEach(function(b){ b.classList.remove('selected'); });
      } else {
        intentInput.value = val;
        form.querySelectorAll('.intent-btn').forEach(function(b){ b.classList.remove('selected'); });
        btn.classList.add('selected');
      }
      intentError.classList.remove('shown');
    });
  });

  function setSubmitting(v){
    busy = v;
    var sb = document.getElementById('submit-btn');
    if(sb) sb.disabled = v;
  }

  function validateForm(){
    var ok = true;
    form.querySelectorAll('.field').forEach(function(f){ f.classList.remove('invalid'); });
    intentError.classList.remove('shown');

    form.querySelectorAll('input[required]:not([type="checkbox"])').forEach(function(inp){
      var val = (inp.value || '').trim();
      var valid = val.length > 0;
      if(inp.type === 'email') valid = valid && /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(val);
      if(!valid){ inp.closest('.field').classList.add('invalid'); ok = false; }
    });

    var website = document.getElementById('lead-website');
    if(website.value.trim().length > 0){
      try { new URL(website.value.trim().match(/^https?:\\/\\//) ? website.value.trim() : 'https://'+website.value.trim()); }
      catch(e){ website.closest('.field').classList.add('invalid'); ok = false; }
    }

    if(!intentInput.value){
      intentError.classList.add('shown'); ok = false;
    }

    return ok;
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    if(busy) return;
    if(!validateForm()) return;
    setSubmitting(true);

    var payload = {
      slug:              '{{ra_slug}}',
      first_name:        (document.getElementById('lead-first-name').value || '').trim(),
      last_name:         (document.getElementById('lead-last-name').value || '').trim(),
      email:             (document.getElementById('lead-email').value || '').trim(),
      phone:             (document.getElementById('lead-phone').value || '').trim(),
      company:           (document.getElementById('lead-company').value || '').trim(),
      website:           (document.getElementById('lead-website').value || '').trim() || undefined,
      message:           (document.getElementById('lead-message').value || '').trim() || undefined,
      prospect_intent:   intentInput.value,
      marketing_consent: document.getElementById('lead-consent').checked
    };

    fetch('{{functions_url}}', {
      method:  'POST',
      headers: {'Content-Type':'application/json'},
      body:    JSON.stringify(payload)
    })
    .then(function(r){ return r.json(); })
    .then(function(res){
      if(res && res.id){
        document.body.classList.add('submitted');
        document.getElementById('success').classList.add('shown');
        window.scrollTo({top:0,behavior:'smooth'});
      } else {
        alert((res && res.error) || 'Something went wrong — please try again.');
        setSubmitting(false);
      }
    })
    .catch(function(){
      alert('Something went wrong — please try again.');
      setSubmitting(false);
    });
  });
})();
</script>
</body>
</html>`

/**
 * STARTER_TEMPLATE — pre-populated when an admin clicks "New template."
 * Same full-page branded design so they start with something real.
 */
export const STARTER_TEMPLATE = BUILTIN_FALLBACK_TEMPLATE

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
  return escapeHtml(s)
}
