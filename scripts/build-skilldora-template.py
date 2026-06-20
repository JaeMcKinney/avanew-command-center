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
  /* LIVE label — no pill, just the base red pulsing dot + dark text with halo */
  .embed-thumb-label {{
    background: transparent !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    color: {SKD_HEADING_NAVY} !important;
    text-shadow:
      0 1px 2px rgba(255,255,255,0.85),
      0 0 8px rgba(255,255,255,0.6) !important;
  }}
  .embed-thumb-label::before {{
    /* Re-assert the base red pulsing dot so the cascade can't bleed any
     * green/teal accent into it. */
    background: #FF3D5A !important;
    box-shadow: 0 0 10px #FF3D5A !important;
  }}
  .embed-link {{ color: {SKD_PRIMARY_BTN_BG} !important; }}
  .embed-link:hover {{ color: {SKD_PRIMARY_BTN_HOVER} !important; }}

  /* "Not / Is" intrigue row — light card (base had a dark navy gradient bg
   * with the .notis .is text rendered in --text which is now dark navy too). */
  .notis {{
    background: #fff !important;
    border: 1px solid {SKD_LINE} !important;
    box-shadow: 0 10px 30px -16px rgba(18,43,70,0.15) !important;
  }}
  .notis::after {{ opacity: 0.35 !important; }}
  .notis:hover {{
    border-color: {SKD_ACCENT_ORANGE} !important;
    box-shadow: 0 18px 40px -16px rgba(18,43,70,0.22) !important;
  }}
  .notis .not {{ color: {SKD_MUTED_TEXT} !important; }}
  .notis .arrow {{ color: {SKD_ACCENT_ORANGE} !important; }}
  .notis .is {{ color: {SKD_HEADING_NAVY} !important; font-weight: 600 !important; }}

  /* Callout panel ("The short version") — light surface */
  .callout {{
    background: linear-gradient(120deg, rgba(56,93,255,0.06), rgba(255,97,19,0.05)) !important;
    border: 1px solid {SKD_LINE} !important;
  }}
  .callout p {{ color: {SKD_HEADING_NAVY} !important; font-style: italic; }}
  .callout .label {{ color: {SKD_ACCENT_ORANGE} !important; }}

  /* Why-item rows — light cards (base had a dark navy gradient) */
  .why-item {{
    background: #fff !important;
    border: 1px solid {SKD_LINE} !important;
    box-shadow: 0 8px 22px -14px rgba(18,43,70,0.18) !important;
  }}
  .why-item::after {{ opacity: 0.3 !important; }}
  .why-item h4 {{ color: {SKD_HEADING_NAVY} !important; }}
  .why-item p {{ color: {SKD_BODY_TEXT} !important; }}
  .why-item:hover {{
    border-color: {SKD_PRIMARY_BTN_BG} !important;
    box-shadow: 0 14px 32px -14px rgba(56,93,255,0.25) !important;
  }}

  /* Pricing cards — base uses .price / .price.one / .price.svc (NOT the
   * .investment-card/.pricing-card selectors I targeted earlier — those
   * never matched any element, leaving the whole pricing block dark). */
  .price.one, .price.svc {{
    background: #fff !important;
    border: 1px solid {SKD_LINE} !important;
    box-shadow: 0 14px 38px -18px rgba(18,43,70,0.18) !important;
    color: {SKD_BODY_TEXT} !important;
  }}
  .price.svc {{
    background: linear-gradient(160deg, #fff, {SKD_SUBTLE_BG}) !important;
    box-shadow: 0 22px 50px -20px rgba(56,93,255,0.25) !important;
  }}
  .price.svc::after {{ opacity: 0.25 !important; }}
  .price .pk {{ color: {SKD_MUTED_TEXT} !important; }}
  .price.svc .pk {{ color: {SKD_PRIMARY_BTN_BG} !important; }}
  .price .amt {{ color: {SKD_HEADING_NAVY} !important; }}
  .price .amt span {{ color: {SKD_MUTED_TEXT} !important; }}
  .price .freq {{ color: {SKD_PRIMARY_BTN_BG} !important; }}
  .price .desc {{ color: {SKD_BODY_TEXT} !important; border-top-color: {SKD_LINE} !important; }}
  .price .incl li {{ color: {SKD_BODY_TEXT} !important; }}
  .price .incl li b {{ color: {SKD_HEADING_NAVY} !important; }}
  .price .incl li ul li {{ color: {SKD_MUTED_TEXT} !important; }}
  .price .incl svg {{ stroke: {SKD_PRIMARY_BTN_BG} !important; }}
  .pill.green {{
    background: rgba(56,93,255,0.10) !important;
    color: {SKD_PRIMARY_BTN_BG} !important;
    border: 1px solid rgba(56,93,255,0.25) !important;
  }}

  /* Investment / pricing list (legacy selectors — harmless if unmatched) */
  .investment-card ul li, .pricing-card ul li {{ color: {SKD_BODY_TEXT} !important; }}
  .investment-card .price, .pricing-card .price {{ color: {SKD_HEADING_NAVY} !important; }}

  /* "Going Further" addon-note block — light card */
  .addon-note {{
    background: linear-gradient(160deg, #fff 0%, {SKD_SUBTLE_BG} 100%) !important;
    border: 1px solid {SKD_LINE} !important;
    box-shadow: 0 22px 60px -22px rgba(18,43,70,0.20) !important;
  }}
  .addon-note::after, .addon-note .addon-glow-teal {{ opacity: 0.25 !important; }}
  .addon-note h3.addon-heading {{ color: {SKD_HEADING_NAVY} !important; }}
  .addon-note h3.addon-heading .grad-gold {{
    background: none !important;
    -webkit-background-clip: initial !important;
    background-clip: initial !important;
    -webkit-text-fill-color: {SKD_ACCENT_ORANGE} !important;
    color: {SKD_ACCENT_ORANGE} !important;
  }}
  .addon-note p {{ color: {SKD_BODY_TEXT} !important; }}
  .addon-note p b {{ color: {SKD_HEADING_NAVY} !important; }}
  .addon-tags .a-tag {{
    color: {SKD_HEADING_NAVY} !important;
    background: {SKD_SUBTLE_BG} !important;
    border: 1px solid {SKD_LINE} !important;
  }}
  .addon-tags .a-tag:hover {{
    background: rgba(56,93,255,0.08) !important;
    border-color: {SKD_PRIMARY_BTN_BG} !important;
  }}

  /* Lead-capture modal form fields — base inputs were dark-navy bg with navy
   * text (invisible inside the now-white modal card) */
  .field label {{ color: {SKD_MUTED_TEXT} !important; }}
  .field input {{
    background: #fff !important;
    color: {SKD_HEADING_NAVY} !important;
    border: 1px solid {SKD_LINE} !important;
  }}
  .field input::placeholder {{ color: {SKD_MUTED_TEXT} !important; opacity: 0.7; }}
  .field input:focus {{
    background: #fff !important;
    border-color: {SKD_PRIMARY_BTN_BG} !important;
    box-shadow: 0 0 0 3px rgba(56,93,255,0.15) !important;
  }}
  .modal-eyebrow {{ color: {SKD_ACCENT_ORANGE} !important; }}
  .modal-sub {{ color: {SKD_BODY_TEXT} !important; }}
  .modal-foot {{ color: {SKD_MUTED_TEXT} !important; }}
  .modal-success h3 {{ color: {SKD_HEADING_NAVY} !important; }}
  .modal-success p {{ color: {SKD_BODY_TEXT} !important; }}
  .modal-success svg {{ stroke: {SKD_PRIMARY_BTN_BG} !important; }}

  /* Thumbnail click target — base hardcoded background:#06101D (ink black);
   * neutralize so initial-paint flash matches the light theme. */
  .embed-thumb-btn {{
    background: linear-gradient(160deg, {SKD_SUBTLE_BG}, #fff) !important;
  }}

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

  /* Footer — tightened spacing (base had 64/88 padding + 60 margin-top) */
  footer {{
    background: #fff !important;
    border-top: 1px solid {SKD_LINE} !important;
    color: {SKD_MUTED_TEXT} !important;
    margin-top: 28px !important;
    padding: 36px 0 44px !important;
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

  /* ── Orange glow around the RA photo ─────────────────────────────────── */
  @keyframes raGlow {{
    0%, 100% {{
      box-shadow:
        0 0 0 5px rgba(255,97,19,0.10),
        0 0 28px -4px rgba(255,97,19,0.32),
        0 20px 50px -16px rgba(18,43,70,0.25);
    }}
    50% {{
      box-shadow:
        0 0 0 10px rgba(255,97,19,0.16),
        0 0 56px -4px rgba(255,97,19,0.55),
        0 20px 50px -16px rgba(18,43,70,0.3);
    }}
  }}
  .ra-photo {{
    background: linear-gradient(150deg, rgba(255,97,19,0.18), rgba(255,255,255,0.65)) !important;
    border: 2px solid rgba(255,97,19,0.55) !important;
    box-shadow:
      0 0 0 5px rgba(255,97,19,0.10),
      0 0 28px -4px rgba(255,97,19,0.32),
      0 20px 50px -16px rgba(18,43,70,0.25) !important;
  }}
  .ra-photo .ra-photo-placeholder {{
    color: {SKD_ACCENT_ORANGE} !important;
    font-family: 'Roboto Slab', serif !important;
    font-style: normal !important;
  }}

  /* ── Featured-avatar section (the "Ask her about Divigner" block) ────
   * Big card around the floating Victoria — base had dark teal/navy gradient.
   * Light it up for the Skilldora theme so the inner text reads. */
  .featured-avatar {{
    background: linear-gradient(160deg, #fff 0%, {SKD_SUBTLE_BG} 100%) !important;
    border: 1px solid {SKD_LINE} !important;
    box-shadow:
      0 30px 80px -28px rgba(18,43,70,0.22),
      0 0 0 1px rgba(255,255,255,0.5) inset !important;
  }}
  .featured-embed {{
    background: #fff !important;
    border-color: {SKD_LINE} !important;
    box-shadow: 0 24px 50px -22px rgba(18,43,70,0.25) !important;
  }}
  .featured-name {{ color: {SKD_HEADING_NAVY} !important; }}
  .featured-name .grad,
  .featured-tagline,
  .featured-desc,
  .featured-foot {{
    color: {SKD_BODY_TEXT} !important;
    -webkit-text-fill-color: {SKD_BODY_TEXT} !important;
    background: none !important;
  }}
  .featured-name .grad {{
    color: {SKD_ACCENT_ORANGE} !important;
    -webkit-text-fill-color: {SKD_ACCENT_ORANGE} !important;
    font-style: normal !important;
    font-weight: 700 !important;
  }}
  .featured-badge {{
    background: linear-gradient(120deg, {SKD_PRIMARY_BTN_BG}, {SKD_PRIMARY_BTN_HOVER}) !important;
    color: #fff !important;
    border-color: {SKD_PRIMARY_BTN_HOVER} !important;
    text-shadow: none !important;
    box-shadow: 0 8px 22px -8px rgba(56,93,255,0.55) !important;
  }}

  /* Why-proof card (if shown) */
  .why-proof-card {{
    background: #fff !important;
    border: 1px solid {SKD_LINE} !important;
    color: {SKD_BODY_TEXT} !important;
  }}

  /* Generic .card (used in features/about sections) */
  section .card {{
    background: #fff !important;
    border: 1px solid {SKD_LINE} !important;
    color: {SKD_BODY_TEXT} !important;
    box-shadow: 0 10px 30px -18px rgba(18,43,70,0.18) !important;
  }}
  section .card h3, section .card h4 {{ color: {SKD_HEADING_NAVY} !important; }}
  section .card p, section .card li {{ color: {SKD_BODY_TEXT} !important; }}

  /* Embed video thumbs — soften the dark radial behind images so the LIGHT
   * badge still reads on the lighter theme. The thumbnails themselves are
   * photographs so their own background sets the tone — we just neutralize
   * the placeholder/loading bg. */
  .embed-video, .embed-placeholder, .embed-loading, .embed-thumb-fallback {{
    background: linear-gradient(160deg, {SKD_SUBTLE_BG}, #fff) !important;
    color: {SKD_BODY_TEXT} !important;
  }}
  .embed-thumb-overlay {{
    background: linear-gradient(180deg, rgba(0,0,0,0.04) 0%, transparent 35%, rgba(0,0,0,0.28) 100%) !important;
  }}
  .embed-error {{
    background: #fff !important;
    color: #d32f2f !important;
    border: 1px solid #ffcdd2 !important;
  }}

  /* Cookie popup overlay — light bar, doesn't obscure the Final CTA button.
   * Position-sticky on small screens so content scrolls under it cleanly. */
  .cookie-popup {{
    background: rgba(255,255,255,0.98) !important;
    border-top: 1px solid {SKD_LINE} !important;
    backdrop-filter: blur(10px) !important;
    -webkit-backdrop-filter: blur(10px) !important;
    box-shadow: 0 -8px 24px -10px rgba(18,43,70,0.18) !important;
  }}
  .cookie-popup-card p {{ color: {SKD_BODY_TEXT} !important; }}
  .cookie-popup-card p a {{ color: {SKD_PRIMARY_BTN_BG} !important; }}

  /* Reserve space for the cookie bar so the final CTA's button never sits
   * underneath it. Measured: bar is ~76px desktop, ~120px mobile when text
   * wraps; pad just enough and let it collapse if dismissed. */
  body {{ padding-bottom: 80px !important; }}
  @media (max-width: 600px) {{ body {{ padding-bottom: 140px !important; }} }}
  body:has(.cookie-popup:not(.visible)) {{ padding-bottom: 0 !important; }}

  /* Final CTA spacing — small bottom pad; tightened footer carries the rest */
  .final-cta {{ padding: 60px 0 32px !important; }}

  /* ── Mobile responsive audit ─────────────────────────────────────────── */
  @media (max-width: 880px) {{
    .topbar {{ padding: 10px 16px !important; }}
    .logo-img {{ height: 38px !important; }}
    .topbar.scrolled .logo-img {{ height: 32px !important; }}
    .wrap {{ padding-left: 18px !important; padding-right: 18px !important; }}
    .ra-partnership {{ padding: 22px 20px !important; border-radius: 14px !important; }}
    .ra-partnership-text {{ font-size: 19px !important; line-height: 1.45 !important; }}
    .ra-partnership-logos {{ gap: 18px !important; flex-wrap: wrap; justify-content: center; }}
    .ra-partnership-logos img {{ max-height: 40px !important; }}
    .featured-avatar {{ padding: 22px !important; grid-template-columns: 1fr !important; gap: 22px !important; }}
    .featured-cta {{ padding: 14px 22px !important; font-size: 12.5px !important; width: 100%; justify-content: center; }}
    .btn-primary, .btn-secondary {{ padding: 14px 22px !important; font-size: 13px !important; }}
    .hero-cta-row {{ flex-direction: column !important; gap: 12px !important; }}
    .hero-cta-row > * {{ width: 100% !important; justify-content: center !important; }}
  }}
  @media (max-width: 480px) {{
    .navlinks {{ display: none !important; }}
    .mob-toggle {{ display: grid !important; }}
    .hero h1 {{ font-size: clamp(34px, 9vw, 44px) !important; }}
    .sec-title {{ font-size: clamp(26px, 7vw, 36px) !important; }}
    .ra-name {{ font-size: clamp(24px, 7vw, 32px) !important; }}
    .ra-photo {{ width: 140px !important; height: 140px !important; }}
    .featured-badge {{ font-size: 10.5px !important; padding: 8px 14px !important; letter-spacing: .16em !important; }}
  }}

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
