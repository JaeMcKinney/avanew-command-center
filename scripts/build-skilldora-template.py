#!/usr/bin/env python3
"""
Build the Skilldora-branded demo template from the canonical public/demo.html.

Strategy: keep the entire HTML structure + JS hydration logic untouched. Apply
surgical text replacements (logo URLs, title) and append a Skilldora-theme
<style> block right before </style> that redefines the CSS custom properties
and overrides the hard-coded dark-navy bits.

Run:
    python3 scripts/build-skilldora-template.py

Writes:
    public/demo-skilldora.html
"""

from __future__ import annotations
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "demo.html"
DST = ROOT / "public" / "demo-skilldora.html"

# Hosted Skilldora logo variants (sourced from myskilldora.com)
SKILLDORA_LOGO_WHITE = "https://myskilldora.com/wp-content/uploads/2024/09/Logo-White-2024-1.png"
SKILLDORA_LOGO_COLOR = "https://myskilldora.com/wp-content/uploads/2024/09/Logo2024.png"
DIVIGNER_LOGO_DARK = "https://ai-automation.divigner.com/divigner-logo.svg"

# ── Skilldora design tokens (extracted from BuddyBoss theme CSS variables) ──
SKD_PRIMARY_BTN_BG      = "#385DFF"  # bright blue — CTAs
SKD_PRIMARY_BTN_HOVER   = "#1E42DD"  # deeper blue
SKD_ACCENT_ORANGE       = "#FF6113"  # vivid orange (eyebrow, top accent bar)
SKD_ACCENT_ORANGE_SOFT  = "#FE6F4B"  # softer coral
SKD_HEADING_NAVY        = "#122B46"  # heading text
SKD_BODY_TEXT           = "#3D3D3D"  # body text
SKD_MUTED_TEXT          = "#7A7A7A"  # secondary body
SKD_BODY_BG             = "#EFEFEF"  # page bg
SKD_CONTENT_BG          = "#FFFFFF"  # cards
SKD_CONTENT_ALT_BG      = "#FBFBFC"
SKD_SUBTLE_BG           = "#F2F4F5"  # secondary buttons / panels
SKD_LINE                = "#E2E5EA"  # borders / dividers
SKD_SUCCESS             = "#1CD991"

# ── Replacements applied as plain string substitutions ──
REPLACEMENTS: list[tuple[str, str]] = [
    # Title
    ("<title>Divigner AI Automations</title>",
     "<title>Skilldora · Interactive Avatars</title>"),

    # Topbar logo → Skilldora WHITE (it sits on an orange-tinted dark header)
    # The img tag in the topbar:
    ('<img class="logo-img" src="https://ai-automation.divigner.com/divigner-logo.svg" alt="Divigner Group">',
     f'<img class="logo-img" src="{SKILLDORA_LOGO_WHITE}" alt="Skilldora">'),

    # Footer logo → Skilldora COLOR (footer is light)
    ('<img class="footer-logo-img" src="https://ai-automation.divigner.com/divigner-logo.svg" alt="Divigner Group">',
     f'<img class="footer-logo-img" src="{SKILLDORA_LOGO_COLOR}" alt="Skilldora">'),

    # Footer links / address — credit Skilldora's site, NOT Divigner's
    ('<a href="https://divigner.com" target="_blank" rel="noopener">divigner.com</a><br>\n        7 North Willow Street, Suite 8C, Montclair, NJ 07042',
     '<a href="https://myskilldora.com" target="_blank" rel="noopener">myskilldora.com</a>'),
    ('© <span id="year"></span> Divigner Group, LLC. All rights reserved.',
     '© <span id="year"></span> Skilldora® Inc. · Avatars powered by <a href="https://divigner.com" target="_blank" rel="noopener" style="color:inherit;border-bottom:1px dotted currentColor">Divigner Group</a>'),

    # Add Roboto / Roboto Slab to the Google Fonts request
    ("&family=Manrope:wght@300;400;500;600;700&display=swap",
     "&family=Manrope:wght@300;400;500;600;700&family=Roboto+Slab:wght@300;400;500;600;700;800&family=Roboto:wght@300;400;500;700&display=swap"),
]

# ── Theme override block ──
# Appended right before </style>. Wins over the original rules because it's
# defined later in source order with the same specificity (and !important where
# we need to defeat hard-coded values).
THEME_OVERRIDE = f"""

  /* ════════════════════════════════════════════════════════════════════════
   * SKILLDORA THEME OVERRIDE
   * Redefines the design tokens to Skilldora's brand and patches the bits
   * that hard-code the dark-navy values.
   * ════════════════════════════════════════════════════════════════════════ */
  :root {{
    --ink: {SKD_HEADING_NAVY};
    --bg: {SKD_BODY_BG};
    --bg-2: {SKD_CONTENT_BG};
    --surface: {SKD_CONTENT_BG};
    --surface-2: {SKD_SUBTLE_BG};
    --line: {SKD_LINE};
    --line-soft: rgba(0,0,0,0.05);
    --gold: {SKD_ACCENT_ORANGE};
    --teal: {SKD_PRIMARY_BTN_BG};
    --teal-bright: {SKD_PRIMARY_BTN_BG};
    --cyan: {SKD_PRIMARY_BTN_HOVER};
    --text: {SKD_HEADING_NAVY};
    --muted: {SKD_BODY_TEXT};
    --muted-2: {SKD_MUTED_TEXT};
  }}

  /* Fonts — Roboto Slab for headings, Roboto for body. Falls back to system. */
  body {{
    font-family: 'Roboto', 'Helvetica Neue', Arial, sans-serif !important;
    background: {SKD_BODY_BG} !important;
    color: {SKD_BODY_TEXT} !important;
  }}
  h1, h2, h3, h4, h5, h6,
  .sec-title, .form-title, .featured-name, .embed-name, .modal-title,
  .ra-name, .hero h1 {{
    font-family: 'Roboto Slab', Georgia, serif !important;
    color: {SKD_HEADING_NAVY} !important;
    font-weight: 700 !important;
    font-style: normal !important;
  }}
  .sec-title .grad, h1 .grad, .qr-title .grad {{
    background: none !important;
    -webkit-background-clip: initial !important;
    background-clip: initial !important;
    -webkit-text-fill-color: {SKD_ACCENT_ORANGE} !important;
    color: {SKD_ACCENT_ORANGE} !important;
    font-style: normal !important;
    font-weight: 700 !important;
  }}

  /* Kill the dark radial gradients behind the body */
  body::before {{
    background: {SKD_BODY_BG} !important;
  }}
  body::after {{ display: none !important; }}

  /* Topbar — Skilldora orange header strip */
  .topbar {{
    background: {SKD_ACCENT_ORANGE} !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    border-bottom-color: rgba(0,0,0,0.08) !important;
  }}
  .topbar.scrolled {{
    background: {SKD_ACCENT_ORANGE} !important;
    box-shadow: 0 2px 14px rgba(0,0,0,0.08);
  }}
  .logo-img {{
    filter: none !important;
    height: 46px;
  }}
  .topbar.scrolled .logo-img {{ height: 36px; }}
  .navlinks a {{ color: rgba(255,255,255,0.92) !important; }}
  .navlinks a:hover, .navlinks a.active {{ color: #fff !important; }}
  .navlinks a.cta {{
    background: #fff !important;
    color: {SKD_ACCENT_ORANGE} !important;
    border: 1px solid #fff !important;
    border-radius: 100px !important;
    animation: none !important;
    font-weight: 700 !important;
  }}
  .navlinks a.cta:hover {{
    background: {SKD_PRIMARY_BTN_BG} !important;
    color: #fff !important;
    border-color: {SKD_PRIMARY_BTN_BG} !important;
    box-shadow: 0 8px 22px -8px rgba(56,93,255,0.5) !important;
  }}
  .mob-toggle {{
    background: rgba(255,255,255,0.18) !important;
    border-color: rgba(255,255,255,0.4) !important;
    color: #fff !important;
  }}

  /* Mobile menu — light theme */
  .mob-menu {{
    background: #fff !important;
    border-left-color: {SKD_LINE} !important;
  }}
  .mob-menu-head {{ border-bottom-color: {SKD_LINE} !important; }}
  .mob-menu-head span {{ color: {SKD_MUTED_TEXT} !important; }}
  .mob-close {{ color: {SKD_BODY_TEXT} !important; }}
  .mob-menu-links a {{ color: {SKD_BODY_TEXT} !important; }}
  .mob-menu-links a:hover, .mob-menu-links a.active {{
    color: {SKD_HEADING_NAVY} !important;
    background: rgba(56,93,255,0.05) !important;
    border-left-color: {SKD_PRIMARY_BTN_BG} !important;
  }}
  .mob-menu-links a .mob-num {{
    color: {SKD_ACCENT_ORANGE} !important;
    font-family: 'Roboto Slab', serif !important;
    font-style: normal !important;
  }}
  .mob-menu-foot {{ border-top-color: {SKD_LINE} !important; }}
  .mob-menu-foot .cta-btn {{
    background: {SKD_PRIMARY_BTN_BG} !important;
    border-color: {SKD_PRIMARY_BTN_BG} !important;
    color: #fff !important;
    border-radius: 100px !important;
  }}
  .mob-menu-foot .cta-btn:hover {{
    background: {SKD_PRIMARY_BTN_HOVER} !important;
    border-color: {SKD_PRIMARY_BTN_HOVER} !important;
  }}

  /* Section dot nav — light bg, blue dots */
  .sec-nav .nav-arrow {{
    background: #fff !important;
    border-color: {SKD_LINE} !important;
    color: {SKD_MUTED_TEXT} !important;
  }}
  .sec-nav .nav-arrow:hover {{
    border-color: {SKD_PRIMARY_BTN_BG} !important;
    color: {SKD_PRIMARY_BTN_BG} !important;
  }}
  .sec-nav .nav-dot {{
    background: rgba(56,93,255,0.18) !important;
    border-color: rgba(56,93,255,0.3) !important;
  }}
  .sec-nav .nav-dot:hover {{ background: {SKD_PRIMARY_BTN_BG} !important; border-color: {SKD_PRIMARY_BTN_HOVER} !important; }}
  .sec-nav .nav-dot.active {{
    background: {SKD_PRIMARY_BTN_BG} !important;
    border-color: {SKD_PRIMARY_BTN_HOVER} !important;
    box-shadow: 0 0 10px rgba(56,93,255,0.5) !important;
  }}
  .sec-nav .nav-dot::after {{
    background: #fff !important;
    border-color: {SKD_LINE} !important;
    color: {SKD_HEADING_NAVY} !important;
  }}
  .sec-nav .nav-dot.active::after {{ color: {SKD_PRIMARY_BTN_BG} !important; }}

  /* Decorative orb — soften for light bg */
  .orb-stage {{ opacity: 0.4 !important; }}
  .orb {{
    background: radial-gradient(circle at 30% 30%, rgba(56,93,255,0.35), rgba(255,97,19,0.12) 60%, transparent 80%) !important;
    box-shadow: 0 0 80px rgba(56,93,255,0.15) !important;
  }}
  .orb-halo {{ background: radial-gradient(circle, rgba(56,93,255,0.10), transparent 70%) !important; }}
  .orb-core {{ background: radial-gradient(circle, rgba(255,255,255,0.9), rgba(56,93,255,0.4) 60%, transparent 80%) !important; }}
  .orb-ring {{ border-color: rgba(56,93,255,0.18) !important; }}

  /* Eyebrows / sec-num — orange accent */
  .eyebrow, .sec-num {{
    color: {SKD_ACCENT_ORANGE} !important;
    font-family: 'Roboto', sans-serif !important;
    font-style: normal !important;
    font-weight: 700 !important;
  }}
  .gold-line {{ background: linear-gradient(90deg, {SKD_ACCENT_ORANGE}, transparent) !important; }}

  /* Hero text */
  .hero-sub, .lede {{ color: {SKD_BODY_TEXT} !important; }}

  /* Buttons — pill, blue primary, white secondary */
  .btn-primary, .submit-btn, .cookie-btn.accept, .modal-cta, .featured-cta {{
    background: {SKD_PRIMARY_BTN_BG} !important;
    color: #fff !important;
    border: 1px solid {SKD_PRIMARY_BTN_BG} !important;
    border-radius: 100px !important;
    box-shadow: 0 6px 18px -6px rgba(56,93,255,0.5) !important;
    transition: background .2s, transform .15s, box-shadow .2s !important;
  }}
  .btn-primary:hover, .submit-btn:hover, .cookie-btn.accept:hover, .modal-cta:hover, .featured-cta:hover {{
    background: {SKD_PRIMARY_BTN_HOVER} !important;
    border-color: {SKD_PRIMARY_BTN_HOVER} !important;
    transform: translateY(-1px);
    box-shadow: 0 10px 26px -6px rgba(56,93,255,0.6) !important;
  }}
  .btn-secondary {{
    background: {SKD_SUBTLE_BG} !important;
    color: {SKD_HEADING_NAVY} !important;
    border: 1px solid {SKD_SUBTLE_BG} !important;
    border-radius: 100px !important;
  }}
  .btn-secondary:hover {{
    background: {SKD_PRIMARY_BTN_BG} !important;
    color: #fff !important;
    border-color: {SKD_PRIMARY_BTN_BG} !important;
  }}
  .cookie-btn.decline {{
    background: transparent !important;
    color: {SKD_MUTED_TEXT} !important;
    border: 1px solid {SKD_LINE} !important;
    border-radius: 100px !important;
  }}

  /* Cards / surfaces */
  section, footer, .final-cta {{ background: transparent !important; }}
  .embed-card, .feature-card, .pricing-card, .featured-card,
  .investment-card, .ra-card {{
    background: #fff !important;
    border: 1px solid {SKD_LINE} !important;
    box-shadow: 0 10px 30px -16px rgba(18,43,70,0.15) !important;
    color: {SKD_BODY_TEXT} !important;
  }}
  .embed-card .embed-name, .embed-card .featured-name {{
    color: {SKD_HEADING_NAVY} !important;
  }}
  .embed-label, .feature-label, .embed-desc, .featured-desc, .featured-tagline {{
    color: {SKD_BODY_TEXT} !important;
  }}
  .embed-thumb-label {{
    background: {SKD_SUCCESS} !important;
    color: #fff !important;
  }}
  .embed-link {{ color: {SKD_PRIMARY_BTN_BG} !important; }}
  .embed-link:hover {{ color: {SKD_PRIMARY_BTN_HOVER} !important; }}

  /* "Not a X / A Y" rows */
  .notis .not {{ color: {SKD_MUTED_TEXT} !important; }}
  .notis .arrow {{ color: {SKD_ACCENT_ORANGE} !important; }}
  .notis .is {{ color: {SKD_HEADING_NAVY} !important; font-weight: 600 !important; }}

  /* Investment / pricing list */
  .investment-card ul li, .pricing-card ul li {{ color: {SKD_BODY_TEXT} !important; }}
  .investment-card .price, .pricing-card .price {{ color: {SKD_HEADING_NAVY} !important; }}

  /* RA card */
  .ra-card {{ background: #fff !important; }}
  .ra-photo-placeholder {{
    background: linear-gradient(135deg, {SKD_PRIMARY_BTN_BG}, {SKD_PRIMARY_BTN_HOVER}) !important;
    color: #fff !important;
  }}
  .ra-label {{ color: {SKD_ACCENT_ORANGE} !important; font-weight: 700; }}
  .ra-name {{ color: {SKD_HEADING_NAVY} !important; }}
  .ra-title {{ color: {SKD_MUTED_TEXT} !important; }}
  .ra-bio {{ color: {SKD_BODY_TEXT} !important; }}
  .ra-contact a {{
    color: {SKD_BODY_TEXT} !important;
    background: {SKD_SUBTLE_BG} !important;
    border: 1px solid {SKD_LINE} !important;
    border-radius: 100px !important;
  }}
  .ra-contact a:hover {{
    color: #fff !important;
    background: {SKD_PRIMARY_BTN_BG} !important;
    border-color: {SKD_PRIMARY_BTN_BG} !important;
  }}
  .ra-partner-logo-top {{ filter: none !important; }}
  /* Partnership banner — dark navy so the partner's white-on-transparent
   * logos (designed for dark backgrounds) actually read. */
  .ra-partnership {{
    background: linear-gradient(135deg, {SKD_HEADING_NAVY} 0%, #1c3a63 100%) !important;
    border: 1px solid {SKD_HEADING_NAVY} !important;
    border-radius: 18px !important;
    padding: 28px 32px !important;
    box-shadow: 0 14px 36px -18px rgba(18,43,70,0.6) !important;
  }}
  .ra-partnership-text {{ color: #fff !important; }}
  .ra-partnership-text b {{ color: {SKD_ACCENT_ORANGE} !important; }}
  .ra-partnership-text .has, .ra-partnership-text .offer {{
    color: rgba(255,255,255,0.85) !important;
    font-style: italic !important;
  }}
  .ra-partnership-logos img {{
    filter: brightness(1.1) !important;
    max-height: 52px !important;
  }}

  /* Final CTA — light bg w/ blue button (already covered) */
  .final-cta {{
    background: linear-gradient(180deg, {SKD_CONTENT_BG} 0%, {SKD_SUBTLE_BG} 100%) !important;
    border-top: 1px solid {SKD_LINE};
    border-bottom: 1px solid {SKD_LINE};
  }}
  .final-cta h3 {{ color: {SKD_HEADING_NAVY} !important; }}
  .final-cta p {{ color: {SKD_BODY_TEXT} !important; }}

  /* Footer */
  footer {{
    background: #fff !important;
    border-top: 1px solid {SKD_LINE} !important;
    color: {SKD_MUTED_TEXT} !important;
  }}
  .footer-logo-img {{ filter: none !important; height: 46px; }}
  .footer-text {{ color: {SKD_MUTED_TEXT} !important; }}
  .footer-text a {{ color: {SKD_PRIMARY_BTN_BG} !important; }}
  .footer-meta {{ color: {SKD_MUTED_TEXT} !important; }}

  /* Cookie popup — light card */
  .cookie-popup-card {{
    background: #fff !important;
    border: 1px solid {SKD_LINE} !important;
    color: {SKD_BODY_TEXT} !important;
    box-shadow: 0 14px 40px -10px rgba(18,43,70,0.2) !important;
  }}
  .cookie-popup-card a {{ color: {SKD_PRIMARY_BTN_BG} !important; }}

  /* Modals — white cards on tinted backdrop */
  .modal-overlay {{ background: rgba(18,43,70,0.55) !important; }}
  .modal {{
    background: #fff !important;
    border: 1px solid {SKD_LINE} !important;
    color: {SKD_BODY_TEXT} !important;
  }}
  .qr-title {{ color: {SKD_HEADING_NAVY} !important; }}
  .modal-close {{ color: {SKD_BODY_TEXT} !important; }}
  .modal-close:hover {{ background: {SKD_SUBTLE_BG} !important; }}

  /* Avatar modal — keep dark, that's a video stage */
  /* (no changes needed there) */

  /* Progress bar — orange→blue gradient */
  .progress {{
    background: linear-gradient(90deg, {SKD_ACCENT_ORANGE}, {SKD_PRIMARY_BTN_BG}) !important;
    box-shadow: 0 0 10px rgba(56,93,255,0.5) !important;
  }}

  /* Selection */
  ::selection {{ background: rgba(56,93,255,0.25); color: {SKD_HEADING_NAVY}; }}

"""


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"source not found: {SRC}")
    html = SRC.read_text()

    for old, new in REPLACEMENTS:
        if old not in html:
            print(f"[warn] replacement target not found: {old[:80]!r}")
            continue
        html = html.replace(old, new, 1)

    if "</style>" not in html:
        raise SystemExit("</style> not found — cannot append theme override")
    html = html.replace("</style>", THEME_OVERRIDE + "</style>", 1)

    DST.write_text(html)
    print(f"wrote {DST} ({len(html):,} bytes, {html.count(chr(10)):,} lines)")


if __name__ == "__main__":
    main()
