# 06. Family Promise of Bergen County: Outreach & Demo Package

> Prepared 2026-10-28 by Divigner research under Jae McKinney's approved master prompt. Draft only: nothing has been sent, drafted in Gmail or deployed. Builds on the verified profile `docs/nonprofit-research/profiles/06-family-promise-bergen-county.md`. Not endorsed by Family Promise of Bergen County.

## A. Research brief (one page)

| Field | Detail |
|---|---|
| Official name | Family Promise of Bergen County (IRS: "Family Promise of Bergen County, A New Jersey Non Profit Corporation"), EIN 22-2853599. Affiliate of the national Family Promise network |
| Website | https://www.bergenfamilypromise.org/ |
| Location | Office: 100 Dayton Street, Ridgewood, NJ 07450. Walk-In Dinner at the Bergen County Housing, Health and Human Services Center, 120 South River Street, Hackensack. A donated permanent HQ at 407 State Street, Hackensack was announced in Oct 2026 (Paramus Post) |
| Service area | Bergen County (Bridge Program requires Bergen County residence) |
| Decision maker | Kate Duggan, Executive Director (staff page, re-confirmed 2026-10-28; 990 TY2022 to TY2024). Board President: Paul Shackford |
| Latest Form 990 | Tax year 2024 (FYE 12/31/2024), full 990 e-filed 2025-11-11. **Total revenue $1,939,402**; expenses $2,042,047; 12 employees; about 1,000 volunteers. Direct source: https://projects.propublica.org/nonprofits/organizations/222853599/202503159349305560/full |
| Revenue vs. budget | Annual revenue is not a purchasing budget. About 93% of revenue is contributions, including about $518K of in-kind gifts; two small consecutive deficits. Any technology spend would be a small discretionary line |

**Featured programs (official pages, read 2026-10-28)**

1. **Walk-In Dinner Program**: free dinner seven days a week, 4:45 to 5:50 PM, in the dining room and as to-go meals at the loading dock of 120 South River Street, Hackensack. "All are welcome." Over 70,000 meals last year; about 160 to 170 dinners a night. https://www.bergenfamilypromise.org/walk-in-dinner-program/
2. **The Bridge Program**: temporary housing and support (case management, savings plans, money management, life coaching) for families facing homelessness. Eligibility as published: a parent living with a child under 18, currently and consistently employed, residing in Bergen County. Families apply through a 5-question online form ("check eligibility"); eligible families are contacted by a case manager within 2 business days. https://www.bergenfamilypromise.org/bridge/
3. **New Leaf / New Life Transitional Housing**: managed apartments for up to 2 years with coaching and a savings plan, for families who complete Bridge screening. https://www.bergenfamilypromise.org/housing-and-support-programs/new-leaf/

**Digital infrastructure inventory**

| Channel | What exists (verified 2026-10-28) | How the web concierge complements it |
|---|---|---|
| Phone intake | 201-833-8009; "Sorry, we do not accept walk-ins"; a Family Case Manager calls back | Explains what to expect before the call and repeats the number at every handoff |
| Online application | Bridge "check eligibility" form (forms.fillout.com, 5 questions) | Walks the visitor through the published criteria, then links to the form. Never pre-screens or decides |
| Status notices | "We are currently unable to accept applications for rental assistance" (need-help page) | Repeats the notice verbatim so visitors are not misled |
| Contact | Web contact form at /contact-us/; no public email found | Points general questions to the form |
| Multilingual | Spanish help page "Necesitas Ayuda?" (/necesitas-ayuda/) linked site-wide | Can cite the Spanish page; Spanish conversation is not claimed until tested |
| Chat / FAQ / scheduling | No chat widget, no FAQ page, no online scheduling found | Fills the gap for common questions without adding a new intake system |

**Use cases**

- [Verified] Visitors need the same two answers repeatedly: where and when tonight's or tomorrow's dinner is served, and whether a family can be considered for the Bridge Program. Both answers are published on static pages and the intake line is phone only.
- [Hypothesis] A presentation-led concierge could reduce repeat calls about closed rental assistance and raise completion of the Bridge eligibility form. Call volume and form completion are not public; validate with staff.

## B. Version A: first-touch email

**Subject:** A 24/7 web guide to the Walk-In Dinner

> Hi Kate,
>
> I'm Jae McKinney, founder of Divigner, an AI solutions company based in Montclair, New Jersey. We're working with New Community Corporation in Newark on a community engagement initiative.
>
> Family Promise's Walk-In Dinner served more than 70,000 free meals in Hackensack last year.
>
> We've built an AI interactive avatar that acts as a 24/7 web concierge. Visitors see a human-like representative and speak with it naturally. The web concierge presents with real-time images and slides, answers questions mid-presentation, and guides people to the right service.
>
> Picture a working parent in Hackensack at 9 PM, checking where tomorrow's dinner is served and how the Bridge Program's eligibility form works.
>
> Experience the Family Promise Web Concierge: [DEMO LINK PENDING]
>
> Could we talk for 15 minutes next week?
>
> Jae McKinney | Founder, Divigner | Montclair, NJ | https://divigner.com

*Independent Divigner demonstration using publicly available information; not an official Family Promise of Bergen County service.*

Word count (Version A body, greeting through the 15-minute ask, counted with Python `len(body.split())`): **126**

## C. Version B: expanded email

**Subject:** Helping Bergen families find the Walk-In Dinner and the Bridge Program

> Hi Kate,
>
> I'm Jae McKinney, founder of Divigner, an AI solutions company based in Montclair, New Jersey. We're working with New Community Corporation in Newark on a community engagement initiative. Through that work, I've been looking at how families find help when they search on their own, often late at night.
>
> Family Promise stood out. The Walk-In Dinner served more than 70,000 free meals last year at 120 South River Street in Hackensack, and the Bridge Program gives working parents a short online form to check eligibility, with a case manager following up. Those pathways already exist. The challenge is helping a stressed parent find and understand them quickly.
>
> We've built an AI interactive avatar that acts as a 24/7 web concierge. It is a visible, human-like representative that visitors can see and speak with naturally. The web concierge can deliver a real-time presentation using actual images, slides and verified program information, take questions in the middle of it, and adapt the walkthrough to what each visitor cares about. It points people to your existing form, your intake line and your help pages. It does not replace your case managers or decide anyone's eligibility.
>
> Imagine a working mother in Hackensack at 9 PM, staying with relatives with her two children. She asks where tomorrow's dinner is served, then wants to understand the Bridge Program. The web concierge walks her through the published criteria on screen, answers her follow-up questions, and shows her the eligibility form and the 201-833-8009 intake line.
>
> Experience the Family Promise Web Concierge: [DEMO LINK PENDING]
>
> Would you have 15 minutes next week to talk about whether this could help the families you serve?
>
> Jae McKinney | Founder, Divigner | Montclair, NJ | https://divigner.com

*Independent Divigner demonstration using publicly available information; not an official Family Promise of Bergen County service.*

Word count (Version B body, greeting through the 15-minute ask, counted with Python `len(body.split())`): **277**

## D. Demo package

**Personalized greeting (spoken and on screen):** "Hi, I'm the Family Promise of Bergen County web concierge, an independent demonstration built from Family Promise's public website. I can show you how the Walk-In Dinner works, explain the Bridge Program and help you find the right next step. Please don't share names, addresses or case details. For help from staff, call 201-833-8009."

**Q&A scenarios**

1. **Visitor:** "Where can I get a free dinner tomorrow in Hackensack, and what time?"
   **Answer:** "Family Promise serves a free Walk-In Dinner every day from 4:45 to 5:50 PM at the Bergen County Housing, Health and Human Services Center, 120 South River Street in Hackensack. You can eat in the dining room or pick up a to-go meal at the loading dock. The page says all are welcome."
   **Source:** https://www.bergenfamilypromise.org/walk-in-dinner-program/
   **Safe next step:** Show the address and map link; suggest checking the page or calling 201-833-8009 if plans change.
2. **Visitor:** "I work full time and my kids and I are staying with my sister. Can Family Promise help us find housing?"
   **Answer:** "The Bridge Program is for families facing homelessness, including families temporarily staying with family or friends. Family Promise lists these requirements: a parent living with a child under 18, currently and consistently employed, and residing in Bergen County. I can't tell you whether you qualify; Family Promise decides that. The next step is their short 5-question eligibility form, and they say eligible families hear from a case manager within 2 business days."
   **Source:** https://www.bergenfamilypromise.org/bridge/
   **Safe next step:** Link to the official "check eligibility" form and give 201-833-8009. Do not collect any answers inside the concierge.
3. **Visitor:** "I'm behind on rent. Can I apply for rental assistance?"
   **Answer:** "Family Promise's help page currently says: 'We are currently unable to accept applications for rental assistance. We hope to re-open applications soon.' For other housing questions, you can call 201-833-8009. If you need help tonight, NJ 211 can connect you to other resources."
   **Source:** https://www.bergenfamilypromise.org/need-help/
   **Safe next step:** Phone number plus NJ 211; no legal advice about eviction.

**Dynamic visual presentation walkthrough: "The Bridge Program in four slides"**

| Slide / image | Spoken explanation | Likely interruption and live answer |
|---|---|---|
| 1. Program photo or logo from the Bridge page, title "The Bridge Program" | "Bridge is Family Promise's program for families facing homelessness or housing instability. It combines temporary housing with ongoing support." | "Is this a shelter?" "The page describes temporary housing and ongoing support. Staff can explain where families stay." |
| 2. "What we provide": case management, savings plans, money management, life coaching, career skills | "Families work with a case manager on a plan for long-term stability." | "Do I have to pay?" "The page doesn't list costs, so I won't guess. A case manager can answer that." |
| 3. "Who is eligible": parent with a child under 18; consistently employed; Bergen County resident; examples (facing eviction, staying in a hotel, staying with family or friends, overcrowded) | "These are the published requirements. Final decisions are made by Family Promise." | "I work 30 hours a week, is that enough?" "The Bridge page says 'currently and consistently employed.' Their help page also mentions 35 hours a week for its programs. The case manager will confirm what applies to you." |
| 4. "Next step": button image for the 5-question form, phone 201-833-8009, Spanish page link | "If this sounds like your family, the next step is the short eligibility form. Eligible families are contacted within 2 business days." | "Can you fill it out for me?" "I can't take your information. The form is on Family Promise's site and takes 5 questions." |

**Handoff:** Open the official form (https://forms.fillout.com/t/7qj6u9yaWEus, linked from the Bridge page) in a new tab, and show 201-833-8009.

**2 to 3 minute self-guided demo flow**

| Time | Beat |
|---|---|
| 0:00 to 0:15 | Greeting, independence disclaimer, privacy notice |
| 0:15 to 0:45 | Visitor asks about dinner; concierge shows the Walk-In Dinner card with hours and address |
| 0:45 to 1:50 | Visitor asks about housing; concierge runs the four-slide Bridge presentation and takes one interruption |
| 1:50 to 2:20 | Rental assistance question; concierge reads the current closed notice and offers 201-833-8009 and NJ 211 |
| 2:20 to 2:40 | Handoff to the eligibility form and closing reminder that this is an independent demonstration |

**Languages (verified):** English site; Spanish help page (/necesitas-ayuda/) and bilingual homepage banner. No other languages found. Spanish conversation in the concierge is not claimed until tested.

**Guardrails**

- Independence disclaimer at start and on screen; not an official Family Promise service.
- No eligibility determinations, no promises of housing, no legal advice on eviction, no medical advice.
- Never invent hours, costs, appointment rules or benefits; quote pages and link them.
- Do not request or store names, addresses, income, immigration status or case details.
- Repeat the closed rental-assistance notice exactly as published.
- Emergency: 911 for immediate danger; NJ 211 for after-hours housing and food resources.
- Content refresh before any live use, because the HQ move may change addresses.

## E. Priority score (/100)

| Component (max) | Points | Rationale |
|---|---|---|
| Community engagement fit (25) | 20 | Two direct public audiences (families facing homelessness and anyone needing a meal); Spanish help page; nightly meal service |
| Operational value (20) | 14 | Phone-only intake with 12 staff, a closed-application notice and a new online form; actual call volume unknown |
| Financial capacity (15) | 5 | $1.94M revenue, mostly private and in-kind, two small deficits |
| Demo feasibility (15) | 13 | Clear, current public pages with criteria, hours and form link |
| Montclair proximity (10) | 8 | About 25 to 30 minutes to Ridgewood or Hackensack |
| Decision-maker accessibility (10) | 6 | ED verified, small organization, but no published email (contact form only) |
| Expansion potential (5) | 4 | National Family Promise network with sibling affiliates (Essex, Morris, Union, Hudson) |
| **Total** | **70** | |

Assumptions: proximity is estimated drive time; operational value assumes repeat questions reach a small staff, which is unverified; financial capacity reflects revenue size and mix, not a known technology budget.

## F. Verification checklist

| Fact | Status |
|---|---|
| Kate Duggan, Executive Director | ✅ staff page https://www.bergenfamilypromise.org/staff/ (2026-10-28); 990 TY2024 |
| TY2024 990 revenue $1,939,402 | ✅ ProPublica e-file render (accessed 2026-10-28) |
| Walk-In Dinner hours 4:45 to 5:50 PM daily, 120 South River St, over 70,000 meals last year | ✅ walk-in-dinner-program page (2026-10-28) |
| Bridge eligibility criteria and 5-question form; case manager contact within 2 business days | ✅ bridge page (2026-10-28) |
| Rental-assistance applications closed | ✅ need-help page (2026-10-28) |
| Spanish help page | ✅ /necesitas-ayuda/ (2026-10-28) |
| Contact form exists | ✅ /contact-us/ (2026-10-28) |
| HQ move to 407 State Street, Hackensack | ⚠️ press only (Paramus Post, Oct 2026); timing unverified |
| Intake hours, office hours | ⚠️ not published |
| "35 hours a week" (need-help) vs "consistently employed" (Bridge) | ⚠️ pages word employment differently; demo quotes both and defers to staff |
| Director of Volunteers (Margo Heller vs Art Pereira) | ⚠️ pages conflict; not used in outreach |

**Contact verification:** Recipient Kate Duggan, Executive Director, verified on the official staff page 2026-10-28. No personal or general email is published; leave the recipient email blank and use the contact form (https://www.bergenfamilypromise.org/contact-us/) or a verified address obtained later. The published apereira@ address is for meal providers only and must not be used.

**Demo link status:** [DEMO LINK PENDING]. No demo has been built or tested.
