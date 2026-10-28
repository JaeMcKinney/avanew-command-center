# 08. Catholic Charities of the Archdiocese of Newark: Outreach & Demo Package

> Prepared 2026-10-28 by Divigner research for Jae McKinney. Draft only: not sent, no Gmail draft, no demo deployed. Builds on the verified profile `docs/nonprofit-research/profiles/08-catholic-charities-archdiocese-of-newark.md`; facts re-checked today against ccannj.org are marked as such.
>
> **Privacy caution for this prospect:** the homepage links a "Notice of Data Privacy Event" stating that files were taken from CCAN systems between April 30 and May 8, 2023, possibly including Social Security numbers and medical information (https://ccannj.org/wp-content/uploads/2023/07/Website-Notice-HIPAA.pdf). Every element of this package is written privacy-first. The emails stress privacy without naming the incident.

## A. Research brief (one page)

| Field | Detail |
|---|---|
| Official name | Catholic Charities of the Archdiocese of Newark ("CCAN"), EIN 22-2164120 (footer confirms). A ministry of the Archdiocese of Newark. Related filers: Mount Carmel Guild Behavioral Health (22-1585565), Mount Carmel Guild Education (26-1600305), Domus Corporation (22-3422749) |
| Website | https://ccannj.org/ |
| Location | 590 North 7th Street, Newark, NJ 07107 |
| Service area | Bergen, Essex, Hudson and Union counties |
| Decision maker | **John Westervelt, Chief Executive Officer** (About Us page, Administration and Board Treasurer, re-confirmed 2026-10-28; principal officer on Form 990 TY2024). Other administration: Elizabeth McClendon, Associate Executive Director; John D. Blomquist, General Counsel; Thomas Strano, Controller |
| Latest Form 990 | Tax year 2024 (fiscal year Jul 1, 2024 to Jun 30, 2025), e-filed 2026-05-07. **Total revenue $50,012,843**; expenses $50,824,826 (deficit $811,983). Direct filing: https://projects.propublica.org/nonprofits/organizations/222164120/202611279349302521/full |
| Revenue caveat | Annual revenue is not a purchasing budget. About 87% is program service revenue from government fee-for-service contracts, which is restricted to those services. Net assets have been negative for over a decade (minus $7.07M in TY2024), and an archdiocesan ministry likely has layered approvals |

**Featured programs (re-checked 2026-10-28)**

1. **Housing, Food & Utility Assistance: LIHEAP and USF**: CCAN partners with NJ DCA to help residents of Bergen, Essex, Hudson and Union counties with utility bills. Schedule an appointment for help with an application at 973-266-7954 or LIHEAP-USF@ccannj.org, or apply online at the DCAid portal and send the UAP application ID to that inbox. The page publishes income guidelines by household size and a required-documents list; forms can be returned by email (preferred), by appointment or mail at 47 Miller Street, Newark. https://ccannj.org/housing-and-food/
2. **Emergency Shelters and housing for families**: Hope House (246 Second Street, Jersey City; homeless Hudson County families by referral), St. Rocco's Emergency Family Shelter (368 South 7th Street, Newark; Essex County families referred by Essex County DFAB, the City of Newark and others), Miller Street Pathways to Housing (47 Miller Street, Newark; 24/7 shelter for adults 18+ and families), St. Lucy's (Jersey City), and Parish Access Centers offering emergency assistance and free information and referral at (800) 227-7413. https://ccannj.org/housing-and-food/
3. **Children and Family Services**: Hudson Mobile Response and Stabilization Services and Intensive Family Support Services (249 Virginia Avenue, Jersey City), NJ4S (Hudson), Partnership for Children (in-home therapeutic services in four counties; families call PerformCare at 1-877-652-7624), supervised visitation, Safe Spaces trauma treatment, and Strong Futures. Division Director: Kathy Elias, LCSW. https://ccannj.org/children-and-family/

**Digital infrastructure inventory (observed 2026-10-28)**

| Channel | What exists | How the web concierge complements it |
|---|---|---|
| Central phone | Help Line 1-800-227-7413 ("Need help? Call") on every page; HQ 973-596-4100 | Starts every handoff with the Help Line |
| Program phones and inboxes | Dozens of program numbers and inboxes (LIHEAP-USF@, immigration@, refugee@, program staff addresses) | Matches a visitor's need to the right published contact |
| Applications | State DCAid portal for LIHEAP/USF; downloadable forms; PerformCare referral line for Partnership for Children | Explains steps and links the existing portal or line |
| Directory | Catalog of Services PDF (Oct 2025) listing programs and addresses | Turns the catalog into a guided, visual walkthrough |
| Chat or FAQ | None found | Adds a conversational front door; no data collection |
| Contact page | Returns HTTP 403 to automated fetch; site uses a bot-challenge page | Demo knowledge base must be built from pages that load normally, plus the catalog |
| Multilingual | English-only website; Title VI Language Assistance Plan (2022) posted | Demo English only; other languages pending CCAN-approved content |
| Privacy | 2023 data privacy event notice posted | Concierge collects nothing; disclaimer and privacy notice on screen |

**Use cases**

- [Verified] Families face 86 programs at 26 sites, each with its own number, location and referral rule (for example, St. Rocco's accepts Essex families by referral; LIHEAP help is by appointment). A privacy-first guide that only explains and routes, starting with the Help Line, matches CCAN's existing structure.
- [Hypothesis, needs validation] The Help Line and program staff spend time redirecting callers who reached the wrong program. CCAN has not confirmed call volumes or misroutes.

## B. Version A: first-touch email

**Subject:** Helping Newark families find the right program

**Body:**

```text
Hi John,

I'm Jae McKinney, founder of Divigner, an AI solutions company based in Montclair, New Jersey. We're working with New Community Corporation in Newark on a community engagement initiative.

Catholic Charities runs 86 programs at 26 sites, including LIHEAP and USF utility help in Newark.

We've built an AI interactive avatar that acts as a 24/7 web concierge. It is a visible, human-like representative people can speak with naturally. The web concierge gives real-time presentations with images and slides, answers questions during the presentation, and guides people to the right program.

Picture a Newark family at 9 PM, behind on the gas bill, unsure where to turn. Privacy first: the web concierge would use only public information and never request personal details.

Experience the Catholic Charities Web Concierge: [DEMO LINK PENDING]

Could we find 15 minutes to talk next week?
```

**Signature:** Jae McKinney | Founder, Divigner | Montclair, NJ | https://divigner.com

**Disclaimer:** Independent Divigner demonstration using publicly available information; not an official Catholic Charities of the Archdiocese of Newark service.

**Word count:** body 141 words (greeting through the 15-minute ask; counted with Python `len(body.split())`; target 110 to 130); above 130 but within the 150 cap, see the reason in the JSON notes.

## C. Version B: expanded email

**Subject:** A privacy-first guide to Catholic Charities programs

**Body:**

```text
Hi John,

I'm Jae McKinney, founder of Divigner, an AI solutions company based in Montclair, New Jersey. We're working with New Community Corporation in Newark on a community engagement initiative. That work shows me how much a family's first step depends on finding the right door.

Catholic Charities offers an extraordinary network: 86 programs at 26 sites across Bergen, Essex, Hudson and Union counties. Housing, food and utility assistance alone spans LIHEAP and USF help, Parish Access Centers, housing counseling, and family shelters such as Hope House and St. Rocco's, each with its own phone number, location and referral path.

We've built an AI interactive avatar that acts as a 24/7 web concierge. It is a visible, human-like representative that families can see and speak with naturally.

The web concierge delivers real-time presentations using actual images, slides and verified program information. Visitors can interrupt with a question, get an immediate answer, and the walkthrough adapts to their needs. It then guides them to your existing pathways, starting with the Help Line at 1-800-227-7413 and the published program contacts. It supports staff rather than replacing them.

I know protecting client information matters deeply to your team. Any demonstration would draw only on your public website and Catalog of Services, would never ask visitors for names, Social Security numbers, immigration status or health details, and would make no eligibility decisions.

Picture a Newark family at 9 PM, behind on the gas bill. They want to know whether Catholic Charities helps with LIHEAP, which office to contact, and which documents to gather. The web concierge could walk them through it with slides and point them to the right contact.

Experience the Catholic Charities Web Concierge: [DEMO LINK PENDING]

Would you have 15 minutes next week, by phone or at 590 North 7th Street?
```

**Signature:** Jae McKinney | Founder, Divigner | Montclair, NJ | https://divigner.com

**Disclaimer:** Independent Divigner demonstration using publicly available information; not an official Catholic Charities of the Archdiocese of Newark service.

**Word count:** body 300 words (greeting through the 15-minute ask; counted with Python `len(body.split())`; target 250 to 300).

## D. Demo package

**Personalized greeting (spoken and on screen)**
"Hi, welcome. I'm a web concierge built from Catholic Charities of the Archdiocese of Newark's public website, as an independent Divigner demonstration. I can help you find the right Catholic Charities program and location for housing, utility help or family support. For your privacy, please don't share your name, Social Security number, immigration status, health information or case details. I don't collect any of that. What are you looking for today?"

**Q&A scenario 1: utility bills**
- Visitor: "We're behind on our gas bill. Does Catholic Charities help with that?"
- Answer: "Yes. Catholic Charities partners with the New Jersey Department of Community Affairs to help residents of Bergen, Essex, Hudson and Union counties with LIHEAP and USF utility assistance. To schedule an appointment with a representative who can help with the application, call 973-266-7954 or email LIHEAP-USF@ccannj.org. You can also apply online through the state's DCAid portal and then send your application ID to that email. The program page lists the required documents. I can't tell you whether you'll qualify; the program reviews that."
- Source: https://ccannj.org/housing-and-food/
- Safe next step: show the phone, the inbox and https://dcaid.dca.nj.gov; remind the visitor not to send documents through this demo.

**Q&A scenario 2: family shelter in Newark**
- Visitor: "My kids and I may lose our apartment. Is there a family shelter in Newark?"
- Answer: "Catholic Charities runs St. Rocco's Emergency Family Shelter at 368 South 7th Street in Newark for homeless Essex County families with children. The program page says families are referred by the Essex County Division of Family Assistance and Benefits, the City of Newark and other partners, so it isn't a walk-in placement. Miller Street Pathways to Housing at 47 Miller Street is a 24/7 shelter for adults and families. For help figuring out the right step, call the Help Line at 1-800-227-7413. If you're in danger, call 911."
- Source: https://ccannj.org/housing-and-food/
- Safe next step: Help Line 1-800-227-7413; no bed promises; 911 for immediate danger.

**Q&A scenario 3: family support**
- Visitor: "My teenage son is struggling and our family needs counseling at home. Can Catholic Charities help?"
- Answer: "Catholic Charities' Partnership for Children program provides in-home therapeutic services for youth and families in Bergen, Essex, Hudson and Union counties, at no cost to the family, covered by Medicaid. Referrals come through New Jersey's Children's System of Care, and the program page says families interested in services should call PerformCare at 1-877-652-7624. I can't give clinical advice. If anyone is in immediate danger, call 911, or call or text 988."
- Source: https://ccannj.org/children-and-family/
- Safe next step: PerformCare 1-877-652-7624 or the Help Line; crisis routing to 911/988.

**Dynamic visual presentation: "Getting help with a utility bill (LIHEAP and USF)"**

| Slide | On screen | Spoken narration |
|---|---|---|
| 1 | CCAN logo; title "Help paying utility bills"; privacy banner "No personal information needed" | "Let me show you how Catholic Charities helps with utility bills. You won't need to share any personal details with me." |
| 2 | Two cards: LIHEAP (heating) and USF (monthly bill credits); "Bergen, Essex, Hudson, Union" | "Catholic Charities works with the state on two programs, LIHEAP and USF, for residents of four counties." |
| 3 | Image of the published income-guideline table, labeled "Program guidelines; staff confirm eligibility" | "The program page lists income guidelines by household size. Staff review each application, so I can't say whether you qualify." |
| 4 | Checklist icons from the required-documents list: IDs, lease or mortgage, full utility bills, proof of income | "Applications need documents. Here are the main ones the page lists." |
| 5 | Three paths: call 973-266-7954; email LIHEAP-USF@ccannj.org; apply online at DCAid and send the application ID | "You can schedule help by phone or email, or apply online yourself and send in your application ID." |
| 6 | Handoff card: phone, inbox, DCAid link, Help Line 1-800-227-7413 | "Here's where to go next. For anything else, the Help Line can point you to the right program." |

Likely interruptions and live answers:
- "Can I upload my documents here?" → "Please don't. This demonstration doesn't collect documents. Send them to LIHEAP-USF@ccannj.org or follow the program's instructions."
- "How much will I get?" → "I can't promise an amount. The program decides benefits after review."
- "I'm undocumented. Can I apply?" → "The documents list notes that undocumented individuals may provide a passport in place of a Social Security card. Please don't share your status with me; program staff can answer questions directly."
- "Where is the office?" → "Forms can be dropped off by appointment at 47 Miller Street in Newark."

Handoff: 973-266-7954, LIHEAP-USF@ccannj.org, https://dcaid.dca.nj.gov, or the Help Line 1-800-227-7413.

**2 to 3 minute self-guided demo flow**

| Time | Beat |
|---|---|
| 0:00 to 0:20 | Greeting, independent-demo disclaimer, strong privacy notice |
| 0:20 to 0:35 | Visitor picks a need: utility help, shelter, family support, food |
| 0:35 to 1:40 | Six-slide LIHEAP/USF presentation with one interruption |
| 1:40 to 2:15 | Visitor asks about a family shelter; concierge explains referral-based entry and the Help Line |
| 2:15 to 2:40 | Recap card: Help Line, program phone and inbox, DCAid |
| 2:40 to 3:00 | Close: "This was an independent Divigner demonstration, not an official Catholic Charities service. Nothing you said was used to identify you." |

**Languages (verified only):** The CCAN website is English only, with a Title VI Language Assistance Plan posted. Program pages reference Hispanic Older Adult Services and Haitian community outreach, but staff languages are not published. The demo runs in English; any other language is [PENDING: confirm Divigner product language support and CCAN-approved wording].

**Guardrails (privacy-first)**
- Collect nothing: no names, Social Security numbers, immigration status, health information, documents or case details. Say so at the start and whenever a visitor begins to share.
- Use only public CCAN pages and the October 2025 Catalog of Services; no internal data; note that transcript retention settings for any pilot would be set with CCAN.
- No eligibility, benefit, legal, immigration, medical or clinical determinations; no shelter-bed or appointment promises.
- Crisis routing: 911 for immediate danger; 988 for mental health crisis; Help Line 1-800-227-7413 otherwise.
- On-screen disclaimer throughout: "Independent Divigner demonstration using publicly available information; not an official Catholic Charities of the Archdiocese of Newark service."

## E. Priority score (/100)

| Component | Points | Rationale |
|---|---|---|
| Community engagement fit (25) | 25 | Newark-headquartered, four-county network serving families in housing, food, utility and family crises; strongest overlap with the NCC Newark narrative |
| Operational value (20) | 19 | 86 programs, 26 sites, many separate numbers and referral rules [Verified]; misroute volume is a [Hypothesis] |
| Financial capacity (15) | 13 | $50.0M revenue (TY2024) clears the $50M anchor (15), minus 2 for long-running negative net assets and a TY2024 deficit |
| Demo feasibility (15) | 11 | Rich program pages and a service catalog, but a bot challenge and a 403 contact page, plus heightened privacy review after 2023 |
| Montclair proximity (10) | 10 | About 15 to 20 minutes to the Newark HQ (estimated) |
| Decision-maker accessibility (10) | 5 | CEO named on site and 990, but no published email or general inbox; archdiocesan approvals likely |
| Expansion potential (5) | 5 | Parish network, affiliates and four counties; a pilot could start with one division |
| **Total** | **88** | |

Assumptions: financial anchors are under $1.5M = 0, $1.5M to $5M = 6, $5M to $15M = 9, $15M to $50M = 12, over $50M = 15, minus 1 to 2 for deficit or balance-sheet risk. Proximity anchors are 20 minutes or less = 10, 21 to 30 = 8, 31 to 45 = 6, 46 to 60 = 4, over 60 = 2 (drive times are estimates). Other components are analyst judgments from public pages, not measured demand.

## F. Verification checklist

| Fact | Status |
|---|---|
| Official name, EIN 22-2164120 | ✅ Site footer and TY2024 990, checked 2026-10-28 |
| TY2024 revenue $50,012,843 (FYE 6/2025), filed 2026-05-07 | ✅ https://projects.propublica.org/nonprofits/organizations/222164120/202611279349302521/full (2026-10-28) |
| John Westervelt, Chief Executive Officer | ✅ https://ccannj.org/about-us/ (re-confirmed 2026-10-28) and 990 TY2024 |
| 86 programs, 26 sites, 55,160 people served | ✅ Homepage impact panel, https://ccannj.org/ (2026-10-28); self-reported |
| LIHEAP/USF: 973-266-7954, LIHEAP-USF@ccannj.org, DCAid, documents list, 47 Miller Street | ✅ https://ccannj.org/housing-and-food/ (2026-10-28) |
| St. Rocco's, Hope House, Miller Street shelter details | ✅ https://ccannj.org/housing-and-food/ (2026-10-28); referral sentences are truncated on the page, so referral sources beyond those listed are unverified |
| Partnership for Children and PerformCare 1-877-652-7624 | ✅ https://ccannj.org/children-and-family/ (2026-10-28) |
| 2023 Notice of Data Privacy Event | ✅ Linked from homepage (2026-10-28); notice PDF per profile |
| Contact page content | ⚠️ HTTP 403 to automated fetch; not re-checked |
| CEO compensation, staff languages | ⚠️ Unknown |
| LIHEAP income table | ⚠️ Shown on the page; values vary by program year, so the demo shows it only as an image labeled for staff confirmation |

**Contact verification:** Greeting "Hi John," uses the CEO verified on the official About Us page today. **No recipient email found:** ccannj.org publishes no address for John Westervelt and no general or leadership inbox (only program inboxes such as LIHEAP-USF@ccannj.org, which are not appropriate for this outreach). Third-party directories show a masked address; not used, and no address was constructed. JSON `email` is left blank. Options for Jae: mail to 590 North 7th Street, call HQ at 973-596-4100 to ask for the right address, or supply a verified address.

**Demo link status:** `[DEMO LINK PENDING]`. No demo has been built or tested.
