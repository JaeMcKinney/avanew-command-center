#!/usr/bin/env python3
"""
Generate a Supabase migration that upserts the Skilldora custom RA template
and assigns it to Skilldora's ra_associates row.

Reads:
    public/demo-skilldora.html  → goes into ra_landing_templates.demo_html
    public/refer-skilldora.html → goes into ra_landing_templates.html

Run before each push:
    python3 scripts/build-skilldora-template.py
    python3 scripts/build-skilldora-refer-template.py
    python3 scripts/emit-skilldora-template-migration.py
    supabase db push --linked --include-all
"""

from __future__ import annotations
from pathlib import Path
import re

ROOT  = Path(__file__).resolve().parent.parent
DEMO  = ROOT / "public" / "demo-skilldora.html"
REFER = ROOT / "public" / "refer-skilldora.html"

# Stable deterministic UUID so the migration is idempotent — re-running the
# generator + db push UPDATEs the same template row instead of creating a new
# one. Picked from /dev/urandom once and pinned here.
TEMPLATE_ID = "c5a11d04-5d11-4d04-9c5a-5d115d04c5a1"

MIGRATIONS_DIR = ROOT / "supabase" / "migrations"
MIGRATION_GLOB = "*_skilldora_custom_template*.sql"
# Each regenerate writes a brand-new migration file with the next timestamp
# so `supabase db push` actually re-applies (the CLI keys on filename, not
# content). Past Skilldora-template migration files are left in place for
# audit history.


def dollar_tag(html: str, base: str = "SKD_DEMO") -> str:
    """Pick a $tag$ that's guaranteed not to appear in the HTML."""
    n = 0
    while f"${base}{n if n else ''}$" in html:
        n += 1
    return f"{base}{n if n else ''}"


def next_migration_path() -> Path:
    """Return a path with a timestamp strictly newer than every existing
    Skilldora-template migration filename, so `supabase db push` re-applies."""
    existing = sorted(MIGRATIONS_DIR.glob(MIGRATION_GLOB))
    if not existing:
        # First-ever run — anchor at today
        stamp = "20260620120000"
    else:
        latest = existing[-1].name.split("_", 1)[0]  # the 14-digit prefix
        stamp = str(int(latest) + 1)
    return MIGRATIONS_DIR / f"{stamp}_skilldora_custom_template.sql"


def main() -> None:
    if not DEMO.exists():
        raise SystemExit(
            f"missing {DEMO}\nRun: python3 scripts/build-skilldora-template.py first"
        )
    if not REFER.exists():
        raise SystemExit(
            f"missing {REFER}\nRun: python3 scripts/build-skilldora-refer-template.py first"
        )
    demo_html  = DEMO.read_text()
    refer_html = REFER.read_text()
    demo_tag   = dollar_tag(demo_html,  "SKD_DEMO")
    refer_tag  = dollar_tag(refer_html, "SKD_REFER")
    migration_path = next_migration_path()

    sql = f"""-- ═══════════════════════════════════════════════════════════════════════════
-- Custom Skilldora-branded RA templates (demo + refer)
--
-- demo_html  → /demo/skilldora  — full interactive avatar demo page
-- html       → /refer/skilldora — Skilldora-branded lead-capture form
--
-- Sources:
--   public/demo-skilldora.html  (build-skilldora-template.py)
--   public/refer-skilldora.html (build-skilldora-refer-template.py)
-- Re-running this migration UPSERTs the same row by its pinned id.
-- ═══════════════════════════════════════════════════════════════════════════

DO $migration$
DECLARE
  v_divigner_org uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  v_template_id  uuid := '{TEMPLATE_ID}';
BEGIN

  -- 1) Upsert the template row with both demo_html and html columns set.
  INSERT INTO public.ra_landing_templates (
    id, organization_id, name, html, demo_html
  ) VALUES (
    v_template_id,
    v_divigner_org,
    'Skilldora Custom (Company)',
    ${refer_tag}${refer_html}${refer_tag}$,
    ${demo_tag}${demo_html}${demo_tag}$
  )
  ON CONFLICT (id) DO UPDATE
    SET name       = EXCLUDED.name,
        html       = EXCLUDED.html,
        demo_html  = EXCLUDED.demo_html,
        updated_at = now();

  -- 2) Point Skilldora's ra_associates row at this template.
  UPDATE public.ra_associates
     SET template_id = v_template_id
   WHERE slug = 'skilldora';

  RAISE NOTICE 'Skilldora custom template upserted (id=%)', v_template_id;
END
$migration$;
"""

    migration_path.write_text(sql)
    print(f"wrote {migration_path} ({len(sql):,} bytes)")
    print(f"  demo_html: {len(demo_html):,} bytes | refer_html: {len(refer_html):,} bytes")


if __name__ == "__main__":
    main()
