# 12. CUMAC: Outreach & Demo Package

> Prepared 2026-10-28 by Divigner research for Jae McKinney. Draft only: not sent, no Gmail draft, no demo deployed. Builds on the verified profile `docs/nonprofit-research/profiles/12-cumac.md`; facts re-checked today against cumac.org are marked as such.

## A. Research brief (one page)

| Field | Detail |
|---|---|
| Official name | CUMAC/ECHO, Inc. (public brand "CUMAC"; Center of United Methodist Aid to the Community / Ecumenically Concerned with Helping Others), EIN 22-2657737 |
| Website | https://www.cumac.org/ |
| Location | 223 Ellison Street, Paterson, NJ (mail: PO Box 2721, Paterson, NJ 07509) |
| Service area | Passaic County only; non-residents are helped to find resources in their own county |
| Decision maker | **Jessica Padilla Gonzalez, Chief Executive Officer** (Meet the Team page, re-confirmed 2026-10-28; Form 990 TY2024 Part VII). Operational owners: Laura Purdy, COO; Dianne Youssef, Director of Programs |
| Latest Form 990 | Tax year 2024 (calendar 2024), e-filed 2025-11-14. **Total revenue $8,315,362**; expenses $8,458,776 (deficit $143,414). Direct filing: https://projects.propublica.org/nonprofits/organizations/222657737/202513189349310841/full |
| Revenue caveat | Annual revenue is not a purchasing budget. Revenue is mostly contributions, including donated food, and $5.1M of expenses are food grants to partners. Three consecutive small deficits; amended TY2022 and TY2023 returns were filed in 2025 |

**Featured programs (re-checked 2026-10-28)**

1. **Choice Marketplace**: appointment-only, client-choice grocery market at 223 Ellison Street. Each guest may receive up to one appointment per month, based on availability; appointments 9:30 AM to 2:30 PM, Monday to Friday, plus Wednesday late appointments 4:00 to 6:00 PM. Passaic County residents only. New guests register 10 AM to 12 PM, Monday to Friday, bringing a photo ID for each household member they shop for and proof of a Passaic County address. Proxy shoppers can be arranged with staff. Closed the first Friday of each month and every Friday in July. https://www.cumac.org/help
2. **CUMAC Mobile Pantry**: food and application support in all 16 Passaic County municipalities, supported by the Passaic County Board of Commissioners. Residents attest to household income at or below 185% of the poverty level or a qualifying program (TANF, SNAP, SSI, WIC, Medicaid and others). Register online; cannot be combined with the Marketplace in the same month. https://www.cumac.org/mobile-pantry
3. **Benefits Application Support (SNAP Navigators)**: certified SNAP Navigators help with SNAP, Medicaid and LIHEAP applications, 9:30 AM to 4:00 PM, Monday to Friday, with a published document checklist; appointments requested by online form. https://www.cumac.org/help

**Digital infrastructure inventory (observed 2026-10-28)**

| Channel | What exists | How the web concierge complements it |
|---|---|---|
| FAQ | Detailed Get Help page (registration, documents, hours, rescheduling, languages, non-residents, farmers' markets) | Turns the FAQ into a spoken, visual walkthrough |
| Forms | Google Forms for SNAP Navigator appointments and Mobile Pantry registration; Proxy Form | Hands off to the right form; collects nothing itself |
| Rescheduling | By email (support@cumacecho.org) or text (973-742-5518) "at the end of the work day," with name, date of birth and Path ID | Explains the process and tells visitors to send those details only to CUMAC, never to the concierge |
| Phone and email | 973-742-5518; info@cumacecho.org | Final fallback for every answer |
| Chat | None found | Adds an always-available conversational guide |
| Multilingual | Staff speak Spanish, "Bangladeshi" (likely Bengali), Arabic and Filipino; brochures in English, Spanish and Arabic; Google Translate widget; SNAP guidance in English and Spanish | Demo English first; Spanish or Arabic only with product confirmation and CUMAC's own text |
| Directory | County pantry list and SNAP-friendly farmers' market list | Points non-Marketplace visitors to those lists |

**Use cases**

- [Verified] CUMAC's rules are precise and public (residency, documents, one visit a month, Marketplace vs Mobile Pantry, registration window), and reschedule requests already arrive after hours by text and email. A concierge that explains these rules accurately and hands off to the right form fits the existing workflow.
- [Hypothesis, needs validation] Explaining the rules at any hour reduces repeat calls, incomplete registrations and mixed Marketplace and Mobile Pantry requests. CUMAC has not shared volumes.

## B. Version A: first-touch email

**Subject:** CUMAC's Get Help answers, at 9 PM

**Body:**

```text
Hi Jessica,

I'm Jae McKinney, founder of Divigner, an AI solutions company based in Montclair, New Jersey. We're working with New Community Corporation in Newark on a community engagement initiative.

CUMAC's Get Help page clearly explains who can register for the Choice Marketplace and what to bring.

We've built an AI interactive avatar that acts as a 24/7 web concierge. It is a visible, human-like representative people can speak with naturally. The web concierge gives real-time presentations with images and slides, answers questions during the presentation, and guides people to the right CUMAC service.

Picture a mother in Paterson at 9 PM, checking what to bring to register.

Experience the CUMAC Web Concierge: [DEMO LINK PENDING]

Could we find 15 minutes to talk next week?
```

**Signature:** Jae McKinney | Founder, Divigner | Montclair, NJ | https://divigner.com

**Disclaimer:** Independent Divigner demonstration using publicly available information; not an official CUMAC/ECHO, Inc. service.

**Word count:** body 125 words (greeting through the 15-minute ask; counted with Python `len(body.split())`; target 110 to 130).

## C. Version B: expanded email

**Subject:** Bringing CUMAC's Get Help answers to life after hours

**Body:**

```text
Hi Jessica,

I'm Jae McKinney, founder of Divigner, an AI solutions company based in Montclair, New Jersey. We're working with New Community Corporation in Newark on a community engagement initiative. That work has me focused on how residents get clear answers when offices are closed.

CUMAC already does this well on paper. Your Get Help page explains how Passaic County residents register for the Choice Marketplace, what ID and proof of address to bring, how appointments and rescheduling work, how the Mobile Pantry serves all 16 municipalities, and how SNAP Navigators can help with applications.

We've built an AI interactive avatar that acts as a 24/7 web concierge. It is a visible, human-like representative that guests can see and speak with naturally.

The web concierge delivers real-time presentations using actual images, slides and verified program information. A guest can interrupt with a question, get an immediate answer, and the walkthrough adapts to what she needs. It then guides her to your existing pathways: the SNAP Navigator request form, the Mobile Pantry registration, support@cumacecho.org or 973-742-5518. It supports your team rather than replacing anyone, and it would make no eligibility decisions.

Picture a mother in Paterson at 9 PM, after a long shift. She heard about CUMAC from a neighbor and wants to know what to bring to register and whether the Mobile Pantry or the Marketplace is the better fit. The web concierge could show her the Marketplace with photos, walk through the registration checklist, and point her to the right next step for the morning.

I would like to put together a personalized demonstration from CUMAC's public pages for your review.

Experience the CUMAC Web Concierge: [DEMO LINK PENDING]

Would you have 15 minutes next week? I am also glad to join a tour.
```

**Signature:** Jae McKinney | Founder, Divigner | Montclair, NJ | https://divigner.com

**Disclaimer:** Independent Divigner demonstration using publicly available information; not an official CUMAC/ECHO, Inc. service.

**Word count:** body 295 words (greeting through the 15-minute ask; counted with Python `len(body.split())`; target 250 to 300).

## D. Demo package

**Personalized greeting (spoken and on screen)**
"Hi, welcome. I'm a web concierge built from CUMAC's public website, as an independent Divigner demonstration. I can explain how to register for the Choice Marketplace, how the Mobile Pantry works, and how SNAP Navigators can help. Please don't share your name, date of birth, Path ID or income with me. What would you like to know?"

**Q&A scenario 1: registering**
- Visitor: "I just moved to Paterson. How do I start shopping at CUMAC?"
- Answer: "CUMAC serves Passaic County residents. New guests can register between 10 AM and 12 PM, Monday through Friday, at 223 Ellison Street. Bring a photo ID for each person in your household you'll be shopping for, and proof of your Passaic County address, like a lease or utility bill. After you register, the Choice Marketplace is by appointment, up to one appointment a month based on availability."
- Source: https://www.cumac.org/help
- Safe next step: 973-742-5518 or the Get Help page; note CUMAC is closed the first Friday of each month.

**Q&A scenario 2: Marketplace or Mobile Pantry**
- Visitor: "¿Puedo usar el mercado y la despensa móvil en el mismo mes?" (Can I use the Marketplace and the Mobile Pantry in the same month?)
- Answer (English demo): "CUMAC's page says it can't provide food from both the Marketplace and the Mobile Unit in the same month. The Mobile Pantry serves all 16 Passaic County municipalities, and you register online for a visit near you. CUMAC has staff who speak Spanish if you'd like to talk with someone."
- Source: https://www.cumac.org/help and https://www.cumac.org/mobile-pantry
- Safe next step: Mobile Pantry registration link on https://www.cumac.org/mobile-pantry; Spanish brochure on the Get Help page.

**Q&A scenario 3: SNAP help**
- Visitor: "My SNAP renewal is confusing. Can someone help me?"
- Answer: "CUMAC has certified SNAP Navigators who help with SNAP, Medicaid and LIHEAP applications, 9:30 AM to 4:00 PM, Monday through Friday. You can request an appointment with a navigator using CUMAC's online form. The Get Help page lists documents to bring, such as ID, proof of residence and proof of income. I can't tell you whether you qualify or how SNAP rules apply to you; the navigators have the latest information."
- Source: https://www.cumac.org/help
- Safe next step: SNAP Navigator request form linked on the Get Help page; 973-742-5518.

**Dynamic visual presentation: "Your first visit to the Choice Marketplace"**

| Slide | On screen | Spoken narration |
|---|---|---|
| 1 | CUMAC logo; title "Your first visit to the Choice Marketplace" | "Let me walk you through how to start shopping at CUMAC's Choice Marketplace." |
| 2 | Map of Passaic County with "Passaic County residents" | "The Marketplace serves people who live in Passaic County." |
| 3 | Checklist: photo ID for each household member; proof of Passaic County address | "When you register, bring a photo ID for each person you'll shop for, and proof of address, like a lease or utility bill." |
| 4 | Clock card: "Register: Mon to Fri, 10 AM to 12 PM, 223 Ellison Street" | "New guests register weekday mornings, 10 to noon, at 223 Ellison Street." |
| 5 | Calendar card: "Appointments: Mon to Fri 9:30 to 2:30; Wednesdays also 4 to 6 PM; up to one per month"; note "Closed first Friday of each month" | "After that, shopping is by appointment, up to once a month, including Wednesday evening slots." |
| 6 | Options card: proxy shopper; Mobile Pantry (not in the same month); SNAP Navigators | "If you can't come yourself, ask about a proxy. The Mobile Pantry is another option, just not in the same month." |
| 7 | Handoff card: 973-742-5518, info@cumacecho.org, Get Help page | "Here's how to reach CUMAC to get started." |

Likely interruptions and live answers:
- "I live in Newark. Can I come?" → "CUMAC serves only Passaic County residents, but its page says staff are happy to help you find food or resources in your county."
- "I need to reschedule my appointment." → "CUMAC asks you to email support@cumacecho.org or text 973-742-5518 with your details. Please send those details to CUMAC directly, not to me."
- "Can my sister shop for me?" → "CUMAC allows a proxy. Ask staff during registration; there's also a Proxy Form on the Get Help page."
- "Is it open this Friday?" → "CUMAC is closed the first Friday of every month and every Friday in July. For a specific date, please call 973-742-5518."

Handoff: 973-742-5518, info@cumacecho.org, https://www.cumac.org/help, or the Mobile Pantry registration link.

**2 to 3 minute self-guided demo flow**

| Time | Beat |
|---|---|
| 0:00 to 0:15 | Greeting, independent-demo disclaimer, privacy reminder |
| 0:15 to 0:30 | Visitor picks: first visit, Mobile Pantry, SNAP help, reschedule |
| 0:30 to 1:40 | Seven-slide first-visit presentation with one interruption |
| 1:40 to 2:15 | Follow-up on Mobile Pantry vs Marketplace rule |
| 2:15 to 2:40 | Recap card with phone, email, forms and brochure links (English, Spanish, Arabic) |
| 2:40 to 3:00 | Close: "This was an independent Divigner demonstration, not an official CUMAC service." |

**Languages (verified only):** CUMAC states that staff speak Spanish, "Bangladeshi" (likely Bengali; confirm), Arabic and Filipino; it publishes brochures in English, Spanish and Arabic, SNAP guidance in English and Spanish, and a Google Translate widget. The demo runs in English and refers visitors to CUMAC's multilingual staff and brochures. A Spanish or Arabic concierge is [PENDING: confirm Divigner product language support and use only CUMAC's own translated text].

**Guardrails**
- Never collect name, date of birth, Path ID, income, immigration status or documents; reschedule requests go only to CUMAC's published email or text line.
- No eligibility or benefit determinations; no SNAP work-requirement rulings (CUMAC's SNAP guidance is dated 11/11/2025 and may change); no immigration or legal advice.
- No promises of appointment availability; state "based on availability" as CUMAC does.
- Use the Mobile Pantry page's registration link (the Get Help page links a different form; confirm with CUMAC).
- On-screen disclaimer throughout: "Independent Divigner demonstration using publicly available information; not an official CUMAC/ECHO, Inc. service."

## E. Priority score (/100)

| Component | Points | Rationale |
|---|---|---|
| Community engagement fit (25) | 24 | High-volume direct public intake in Paterson with multilingual staff; strong fit with an urban community engagement story, though outside Newark |
| Operational value (20) | 19 | Precise public rules, a registration window, after-hours reschedule traffic by text and email [Verified]; repeat-call reduction is a [Hypothesis] |
| Financial capacity (15) | 9 | $8.32M revenue (TY2024), $5M to $15M band; small recurring deficits judged not material |
| Demo feasibility (15) | 14 | Excellent FAQ content; Squarespace site fetched cleanly; clear handoff forms |
| Montclair proximity (10) | 8 | About 20 to 25 minutes to Paterson (estimated) |
| Decision-maker accessibility (10) | 10 | CEO's professional email is published on the official team page; 38-person organization |
| Expansion potential (5) | 4 | County hunger hub supplying partner pantries; county commissioner support |
| **Total** | **88** | |

Assumptions: financial anchors are under $1.5M = 0, $1.5M to $5M = 6, $5M to $15M = 9, $15M to $50M = 12, over $50M = 15, minus 1 to 2 for deficit or balance-sheet risk. Proximity anchors are 20 minutes or less = 10, 21 to 30 = 8, 31 to 45 = 6, 46 to 60 = 4, over 60 = 2 (drive times are estimates). Other components are analyst judgments from public pages, not measured demand.

## F. Verification checklist

| Fact | Status |
|---|---|
| Legal name CUMAC/ECHO, Inc., EIN 22-2657737 | ✅ TY2024 990 and ProPublica, checked 2026-10-28 |
| TY2024 revenue $8,315,362, filed 2025-11-14 | ✅ https://projects.propublica.org/nonprofits/organizations/222657737/202513189349310841/full (2026-10-28) |
| Amended TY2022 and TY2023 returns | ⚠️ Filed 2025-09-11 with no explanation; ask only if finances come up |
| Jessica Padilla Gonzalez, CEO, and email jpgonzalez@cumacecho.org | ✅ https://www.cumac.org/meettheteam (re-confirmed 2026-10-28) and 990 TY2024 |
| Marketplace rules, hours, registration window and documents | ✅ https://www.cumac.org/help (2026-10-28) |
| Mobile Pantry: 16 municipalities, 185% poverty or categorical eligibility, online registration | ✅ https://www.cumac.org/mobile-pantry (2026-10-28) |
| SNAP Navigators and document checklist | ✅ https://www.cumac.org/help (2026-10-28) |
| SNAP work-requirement guidance | ⚠️ Dated 11/11/2025 on the site; may be outdated, so the demo does not restate figures |
| Two different Mobile Pantry registration forms | ⚠️ Get Help and Mobile Pantry pages link different Google Forms; confirm which is current |
| Staff languages | ✅ Stated on https://www.cumac.org/help (2026-10-28); "Bangladeshi" wording should be confirmed |
| Board president | ⚠️ Site lists Stephanie Schwartz; the 990 lists Julie Holland (officer change) |

**Contact verification:** Greeting "Hi Jessica," uses the CEO verified on the official team page today. Recipient email **jpgonzalez@cumacecho.org** is published on https://www.cumac.org/meettheteam. It was not constructed.

**Demo link status:** `[DEMO LINK PENDING]`. No demo has been built or tested.
