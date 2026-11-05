# 01. Ironbound Community Corporation: Outreach & Demo Package

> Prepared 2026-10-28 by Divigner research for Jae McKinney. Draft only: nothing has been sent, no demo exists, and no one at ICC has been contacted. Builds on the verified profile `docs/nonprofit-research/profiles/01-ironbound-community-corporation.md`.
>
> **Messaging caution:** ICC published the op-ed "Newark does not need AI data centers" on 2026-09-29 (https://ironboundcc.org/nodatacenters/), calling for a municipal moratorium. Both emails stay strictly on access to services and language access, in plain and respectful language, and use the required avatar sentence once each. Expect questions about energy use, data handling and transcript retention, and answer them candidly.

## A. Research brief (one page)

| Field | Detail |
|---|---|
| Official name | Ironbound Community Corporation (ICC). EIN 22-1916086 |
| Website | https://ironboundcc.org/ |
| Location | Administration at 317 Elm Street, Newark, NJ 07105 (Essex County). Five Ironbound sites: 317 Elm St, 1 New York Ave (Early Learning Center), 29 Cortland St, 432 Lafayette St, 377-385 Ferry St |
| Service area | The Ironbound (07105 and part of 07114), with some citywide Newark eligibility (state-funded preschool) |
| Decision maker | **Hazel Applewhite, Chief Executive Officer.** Listed first on the official team page (checked 2026-10-28) and principal officer on the FY2025 Form 990 |
| Recipient email | happlewhite@ironboundcc.org, published on https://ironboundcc.org/our-team/ |
| Latest Form 990 | Fiscal year ended Aug 31, 2025 (IRS tax year 2024), e-filed 2026-07-14. **Total revenue $11,987,799**; expenses $10,588,766. Direct filing: https://projects.propublica.org/nonprofits/organizations/221916086/202621979349301112/full |
| Revenue vs. budget | Annual revenue is not a purchasing budget. About 95% of revenue is contributions and grants, and ICC's 2024 Impact Report puts government grants and contracts at $6.64M, so most funds are restricted to programs |

**Featured programs (2 to 3, official links)**

1. **Pre-school Head Start at the Early Learning Center** (https://ironboundcc.org/pre-school-head-start/). Free 8:30 to 3:00 preschool at 1 New York Ave for children who are 3 or 4 by October 1. State-funded seats require Newark residence (3 proofs); Head Start seats require Ironbound zip codes and income below 100% of the federal poverty guidelines. Applications are available on site on Tuesdays and can be emailed to ApplyELC@ironboundcc.org. Fee-based wraparound care, with Programs for Parents subsidies. An English and Spanish FAQ (2026) lists documents to bring: three proofs of address, one month of pay stubs, birth certificate.
2. **Early Head Start** (https://ironboundcc.org/early-head-start/). Full-day, year-round program for 72 families (center-based, home-based, expectant parents). Eligibility: live in 07105 or part of 07114, 3 proofs of residence, at or below 100% of poverty guidelines. Applications on site every other Wednesday beginning in March; notices in English and Spanish.
3. **Family Success Centers** (https://ironboundcc.org/family-success-centers/). West (317 Elm St, 973-465-0555) and East (29 Cortland St, 973-344-5949). Help applying for NJ FamilyCare, LIHEAP, NJ SHARES and SNAP; parenting programs; Home Friends for adults 60+; weekly Table to Table food distribution. Enrollment contact: Family Partner/Site Supervisor, ext. 202.

**Digital infrastructure inventory (checked 2026-10-28)**

| Channel | What exists | How the web concierge complements it |
|---|---|---|
| Scheduling | None online. Financial Opportunity Center appointments by email (financialopportunitycenter@ironboundcc.org); ELC applications on fixed weekdays | Explains which day and which email applies to which program, then hands off to that email or phone |
| Applications | On-site paper applications; downloadable Pre-Application Form PDF; completed applications emailed to ApplyELC@ | Walks a parent through the documents list before they come in; never collects the application itself |
| Portals | None found | Not applicable |
| Chat | No chat widget found in the homepage HTML | Adds a visual, conversational layer on top of existing pages |
| Telephone | Main (973) 465-0555; ELC (973) 589-6873; per-site lines on the contact page | Routes each question to the right site number |
| Multilingual | Website is English-only with no translation widget. ELC and EHS application notices are bilingual; ELC FAQ PDF in English and Spanish; Breaking the Cycle delivers services in English, Spanish and Portuguese | Could surface the existing Spanish FAQ and bilingual notices. Do not promise Spanish or Portuguese conversation until verified in the product |
| Directories | Locations page and contact page list five sites with phones and services | Turns the five-site directory into "which site, for what" answers |

**Use cases**

- [Verified] Families must match programs to application days, sites and documents (Tuesday preschool applications; every-other-Wednesday EHS applications from March; three proofs of address). The concierge can present this as a short visual walkthrough and route to the ELC phone or ApplyELC@ email.
- [Hypothesis] Family Success Center staff answer repeat "where do I get help with SNAP or NJ FamilyCare?" questions by phone. Needs validation with ICC (inquiry volume unknown).

## B. Version A: first-touch email

**Subject:** Helping Ironbound families find the right ICC program

**Body:**

> Hi Hazel,
>
> I'm Jae McKinney, founder of Divigner, an AI solutions company based in Montclair, New Jersey. We're working with New Community Corporation in Newark on a community engagement initiative.
>
> ICC's Early Learning Center posts preschool application days in English and Spanish.
>
> We've built an AI interactive avatar that acts as a 24/7 web concierge. It is a visible, human-like guide people can talk with naturally. The web concierge gives real-time presentations with images and slides, answers questions during the presentation, and points families to your contacts.
>
> Picture an Ironbound parent at 9 PM, wanting to know which documents to bring to apply.
>
> Experience the ICC Web Concierge: [DEMO LINK PENDING]
>
> Would you have 15 minutes next week to tell me if this would help, or miss the mark?

**Signature:** Jae McKinney | Founder, Divigner | Montclair, NJ | https://divigner.com

**Disclaimer:** Independent Divigner demonstration using publicly available information; not an official Ironbound Community Corporation service.

**Word count:** 129 words in the body (greeting through the 15-minute ask; excludes subject, signature and disclaimer; target 110 to 130). Counted with Python `len(body.split())`.

## C. Version B: expanded email

**Subject:** Early Learning Center questions, answered in plain language

**Body:**

> Hi Hazel,
>
> I'm Jae McKinney, founder of Divigner, an AI solutions company based in Montclair, New Jersey. We're working with New Community Corporation in Newark on a community engagement initiative. It has me focused on how residents find the right service when they need it.
>
> ICC's programs show why this matters. The Early Learning Center offers free preschool from 8:30 to 3:00, with applications on site on Tuesdays and Early Head Start applications every other Wednesday starting in March. The Family Success Centers on Elm Street and Cortland Street help families apply for NJ FamilyCare, LIHEAP, NJ SHARES and SNAP. Your pages already post application notices in English and Spanish, which tells me language access is part of how ICC works.
>
> We've built an AI interactive avatar that acts as a 24/7 web concierge. It is a visible, human-like representative that people can see and talk with naturally. The web concierge can walk a visitor through a short presentation with real images and slides drawn only from ICC's public pages, take questions in the middle, and adjust to what that person cares about. It does not replace staff or decide eligibility. It points people to the phone numbers, emails and on-site application days you already publish.
>
> Picture a parent at 9 PM with a three-year-old, reading about the preschool. She wants to know what the program includes, which documents to bring, and which day to come in. The web concierge shows the Early Learning Center, explains the steps your FAQ lists, and gives her the number to call in the morning.
>
> Experience the ICC Web Concierge: [DEMO LINK PENDING]
>
> I would value your honest view, including on privacy and language access. Would you have 15 minutes next week for a conversation, by phone or at Elm Street?

**Signature:** Jae McKinney | Founder, Divigner | Montclair, NJ | https://divigner.com

**Disclaimer:** Independent Divigner demonstration using publicly available information; not an official Ironbound Community Corporation service.

**Word count:** 297 words in the body (greeting through the 15-minute ask; excludes subject, signature and disclaimer; target 250 to 300). Counted with Python `len(body.split())`.

## D. Demo package

All answers below are built only from ICC's public pages as checked on 2026-10-28. Demo status: [DEMO LINK PENDING]. No demo exists yet.

**Personalized greeting**

"Hi, welcome. I'm a web guide built from Ironbound Community Corporation's public website. I can show you ICC's early learning, family and financial programs and help you find the right contact. I can't check eligibility or take applications, and please don't share personal details. What would you like to explore?"

**Q&A scenario 1**
- Visitor question: "My son turns 3 in August. Can he go to the free preschool, and how do I apply?"
- Grounded answer: "ICC's preschool at the Early Learning Center, 1 New York Avenue, runs 8:30 to 3:00 at no cost. Children need to be 3 or 4 before October 1. Applications are available at the center on Tuesdays, and ICC's FAQ says to bring three proofs of address, one month of pay stubs, and a birth certificate. ICC staff decide eligibility."
- Source: https://ironboundcc.org/pre-school-head-start/ and https://ironboundcc.org/wp-content/uploads/2026/05/FAQ-for-ELC-Preschool.docx.pdf
- Safe next step: Call the ELC at (973) 589-6873 or email ApplyELC@ironboundcc.org.

**Q&A scenario 2**
- Visitor question: "Where can I get help applying for SNAP or NJ FamilyCare in the Ironbound?"
- Grounded answer: "ICC's two Family Success Centers help families with NJ FamilyCare, LIHEAP, NJ SHARES and SNAP applications. Family Success Center West is at 317 Elm Street, and East is at 29 Cortland Street."
- Source: https://ironboundcc.org/family-success-centers/
- Safe next step: Call West at 973-465-0555 (ext. 202 for enrollment) or East at 973-344-5949.

**Q&A scenario 3**
- Visitor question: "I need free help filing my taxes. When is the Financial Opportunity Center open?"
- Grounded answer: "The Financial Opportunity Center at 317 Elm Street is open Monday to Friday, 9:30 AM to 4:30 PM. It offers free tax help through the VITA program, plus financial coaching and job services. Appointments are made by email."
- Source: https://ironboundcc.org/financial-opportunity-center/
- Safe next step: Email financialopportunitycenter@ironboundcc.org to request an appointment.

**Dynamic visual presentation walkthrough: "Starting preschool at ICC's Early Learning Center"**

| Slide / image | Spoken narration | Likely interruption and live answer |
|---|---|---|
| 1. Photo of the Early Learning Center building at 1 New York Ave (from ICC's ELC page) | "This is ICC's Early Learning Center in the Ironbound. Its preschool has been NAEYC accredited since 1988." | "Is it really free?" "Yes. ICC lists the 8:30 to 3:00 program at no cost. Before and after care is fee-based, and Programs for Parents subsidies may help." |
| 2. Slide: "Who it's for" with two columns (state-funded and Head Start) | "There are two ways in. Both need your child to be 3 or 4 before October 1. State-funded seats are for Newark residents; Head Start seats are for Ironbound zip codes with an income guideline." | "We live in the North Ward." "The state-funded seats list Newark residence. ICC's staff confirm eligibility, so please call the ELC." |
| 3. Slide: documents checklist (three proofs of address, one month of pay stubs, birth certificate) | "ICC's FAQ asks families to bring these documents." | "Can I use a lease?" "ICC's pages don't list which documents count as proof of address, so the ELC team is the right one to ask." |
| 4. Slide: "When to apply" (Tuesdays on site, or email ApplyELC@) with the Spanish notice shown | "Applications are at the center on Tuesdays, and you can email a completed application to ApplyELC@ironboundcc.org. The notice is also posted in Spanish." | "Is there a Spanish FAQ?" "Yes. ICC posts a Spanish FAQ on the ELC page." (link shown) |
| 5. Handoff card | "To take the next step, call the ELC at (973) 589-6873 or email ApplyELC@ironboundcc.org." | Ends with the ELC phone, email and the ELC page link. No data collected |

**2 to 3 minute self-guided demo flow**

- 0:00 to 0:20. Greeting and disclaimer; visitor picks Children, Family or Money and Jobs.
- 0:20 to 1:30. Visitor picks Children; the five-slide preschool walkthrough plays, pausing for questions.
- 1:30 to 2:10. Visitor asks the SNAP question (scenario 2); the concierge shows both Family Success Center addresses on a map image.
- 2:10 to 2:40. Handoff card with phone numbers and emails; reminder that ICC staff decide eligibility.
- 2:40 to 3:00. Close with the disclaimer and a link to https://ironboundcc.org/contact/.

**Languages (verified only)**

- ICC delivers Breaking the Cycle services in English, Spanish and Portuguese (https://ironboundcc.org/breaking-the-cycle/).
- ELC and Early Head Start application notices are in English and Spanish; the ELC FAQ PDF exists in English and Spanish.
- The website itself is English-only. The demo runs in English and can link to the Spanish FAQ. Spanish or Portuguese conversation is not claimed until it is verified in the Divigner product.

**Privacy, safety and accuracy guardrails**

- Disclaimer on screen: "Independent Divigner demonstration using publicly available information; not an official Ironbound Community Corporation service."
- No eligibility, immigration, legal, medical or benefits determinations. No invented hours, appointments or rules; anything not on ICC's pages goes to the ICC phone or email.
- Never ask for names, addresses, income, immigration status or details of domestic violence. If a visitor mentions danger or abuse, show 911 and ICC's Breaking the Cycle contact only.
- Given ICC's ICE accountability work and the data-center op-ed, offer a transcript-off configuration for the ICC demo and be ready to explain where the demo is hosted and what it stores.
- Session limit of about 3 minutes.

## E. Priority score (/100)

| Component | Points | Rationale |
|---|---|---|
| Community engagement fit (25) | 20 | Multilingual immigrant community, five sites, bilingual application notices and benefit-application help are a strong match. Docked for the public anti-AI-data-center stance, which raises messaging risk |
| Operational value (20) | 17 | Day-specific application windows, zip and income rules, and benefit-application help generate repeat questions [hypothesis on volume] |
| Financial capacity (15) | 11 | FY2025 revenue $11.99M with three surpluses; most revenue is restricted grants |
| Demo feasibility (15) | 13 | Detailed program pages plus an English and Spanish FAQ PDF give solid grounding |
| Montclair proximity (10) | 8 | About 25 minutes to 317 Elm St (estimate) |
| Decision-maker accessibility (10) | 9 | CEO named on site and 990, with a published email |
| Expansion potential (5) | 3 | Coalition ties (South Ward Environmental Alliance and others), but reputational sensitivity limits referrals |
| **Total** | **81** | |

Assumptions: proximity is a drive-time estimate; operational value assumes inquiry volume that ICC has not confirmed; financial capacity reflects revenue, not available budget.

## F. Verification checklist

- ✅ Legal name, EIN 22-1916086, FY2025 revenue $11,987,799: ProPublica filing above (profile, checked 2026-10-28).
- ✅ Hazel Applewhite, Chief Executive Officer, and email happlewhite@ironboundcc.org: https://ironboundcc.org/our-team/ (2026-10-28).
- ✅ Preschool details (8:30 to 3:00, free, age by Oct 1, Tuesday applications, ApplyELC@): https://ironboundcc.org/pre-school-head-start/ (2026-10-28).
- ✅ Documents to bring and no-cost preschool: ELC FAQ PDF, https://ironboundcc.org/wp-content/uploads/2026/05/FAQ-for-ELC-Preschool.docx.pdf (2026-10-28).
- ✅ Early Head Start eligibility and every-other-Wednesday applications from March: https://ironboundcc.org/early-head-start/ (2026-10-28).
- ✅ Family Success Centers addresses, phones and benefit applications: https://ironboundcc.org/family-success-centers/ (2026-10-28).
- ✅ Financial Opportunity Center hours and appointment email: https://ironboundcc.org/financial-opportunity-center/ (2026-10-28).
- ✅ English, Spanish and Portuguese delivery (Breaking the Cycle): https://ironboundcc.org/breaking-the-cycle/ (2026-10-28).
- ✅ Op-ed "Newark does not need AI data centers," dated 2026-09-29: https://ironboundcc.org/nodatacenters/ (2026-10-28).
- ✅ No chat widget in homepage HTML; no translation widget (HTML check, 2026-10-28).
- ⚠️ The ELC FAQ PDF header lists "info@ironbouncc.org" (a typo in ICC's PDF); the contact page gives info@ironboundcc.org. Use the contact page version.
- ⚠️ CFO conflict: site lists Garfield Grant, FY2025 990 lists Alpesh Patel. Not used in outreach.
- ⚠️ Inquiry volumes and staff counts are unverified.
- **Contact verification:** Recipient Hazel Applewhite, CEO; email happlewhite@ironboundcc.org published on the official team page. Greeting "Hi Hazel," is supported.
- **Demo link status:** [DEMO LINK PENDING]. No demo has been built or tested.
