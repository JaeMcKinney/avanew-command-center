# 17. Bergen Volunteer Medical Initiative: Outreach & Demo Package

> Prepared 2026-10-28 by Divigner research under Jae McKinney's approved master prompt. Draft only: nothing has been sent, drafted in Gmail or deployed. Builds on the verified profile `docs/nonprofit-research/profiles/17-bergen-volunteer-medical-initiative.md`. Not endorsed by BVMI. **Health care caution: the web concierge shares logistics and published eligibility information only. No medical advice.**

## A. Research brief (one page)

| Field | Detail |
|---|---|
| Official name | Bergen Volunteer Medical Initiative Inc (BVMI), EIN 20-2633437. Two sites: Lynn Diamond Healthcare Center (Hackensack) and Russell Berrie Healthcare Center (Garfield) |
| Website | https://www.bvmi.org/ |
| Location | 75 Essex Street, Suite 100, Hackensack, NJ 07601 (main, 201-342-2478); 529 Midland Ave, Garfield, NJ 07026 (551-380-4800) |
| Service area | Bergen County residents (adults 18+) |
| Decision maker | Amanda Missey, President/CEO (team page re-confirmed 2026-10-28; 990 TY2023 to TY2025) |
| Latest Form 990 | Tax year 2025 (FYE 12/31/2025), full 990 e-filed 2026-06-10. **Total revenue $5,512,620**; expenses $3,704,852; 49 employees; 212 volunteers; 1,026 adults served in 9,725 visits. Direct source: https://projects.propublica.org/nonprofits/organizations/202633437/202631619349301408/full |
| Revenue vs. budget | Annual revenue is not a purchasing budget. TY2024 and TY2025 surpluses likely reflect the Garfield expansion campaign; there is no patient fee revenue |

**Featured programs (official pages, read 2026-10-28)**

1. **Primary care (patient services)**: free primary, preventive, chronic and urgent care by appointment, with telehealth for many visits. Published eligibility: adults 18+ living in Bergen County; someone in the household working; earning up to 250% of the Federal Poverty Level; no health insurance. Prospective patients are screened and asked for proof of Bergen County residency, proof of earned income (tax returns, paystubs or an employer letter) and a complete medical history; screening repeats annually. https://www.bvmi.org/services
2. **Women's Health Initiative**: annual well-woman exam for all new women patients after a primary care visit; women 40+ without a mammogram in the last 12 months are referred out. https://www.bvmi.org/womens-health-initiative
3. **Diabetes Prevention, Care and Education**: one-on-one diabetes education "in a language they understand" and the year-long Prevent Diabetes Program for patients with pre-diabetes. https://www.bvmi.org/diabetes-care-and-education

**Digital infrastructure inventory**

| Channel | What exists (verified 2026-10-28) | How the web concierge complements it |
|---|---|---|
| Phone | Hackensack 201-342-2478; Garfield 551-380-4800 | Gives the right number with each center's hours |
| Hours | Hackensack Mon, Wed, Thu, Fri 9:30 AM to 4 PM and Tue 11 AM to 7 PM; Garfield Wed and Thu 9:30 AM to 4 PM | Answers "which center is open when" consistently |
| Email | info@bvmi.net and an "Email Us" link | General questions only; never health details |
| Eligibility | Static list and document list on the Services page; no online pre-screening tool | Presents the published list visually; never decides eligibility |
| Telehealth | Telehealth visits and a nurse practitioner for phone consults and sick visits (for patients) | Explains that these exist for patients; no triage |
| Multilingual | TranslatePress Spanish (/es/) and Korean (/ko/) site versions; clinic uses language interpreters | Cites the translated pages; concierge languages not claimed until tested |
| Chat / FAQ | No chat widget or patient FAQ found | Adds a guided explanation layer before the call |

**Use cases**

- [Verified] Prospective patients must work through a four-part published eligibility test and gather three types of documents before screening, at two centers with very different hours.
- [Hypothesis] A visual walkthrough of the criteria and documents could make screening calls shorter and reduce calls from people outside the criteria. Volume unknown; validate with front-desk staff.

## B. Version A: first-touch email

**Subject:** Helping prospective BVMI patients prepare

> Hi Amanda,
>
> I'm Jae McKinney, founder of Divigner, an AI solutions company based in Montclair, New Jersey. We're working with New Community Corporation in Newark on a community engagement initiative.
>
> BVMI provides free primary care to Bergen County's working uninsured at two healthcare centers, in Hackensack and Garfield.
>
> We've built an AI interactive avatar that acts as a 24/7 web concierge. Visitors see a human-like representative and speak with it naturally. The web concierge presents with real-time images and slides, answers questions mid-presentation, and guides people to the right service.
>
> Picture a restaurant worker in Garfield at 9 PM, checking BVMI's published patient criteria and which documents screening requires.
>
> Experience the BVMI Web Concierge: [DEMO LINK PENDING]
>
> Could we talk for 15 minutes next week?
>
> Jae McKinney | Founder, Divigner | Montclair, NJ | https://divigner.com

*Independent Divigner demonstration using publicly available information; not an official Bergen Volunteer Medical Initiative service.*

Word count (Version A body, greeting through the 15-minute ask, counted with Python `len(body.split())`): **125**

## C. Version B: expanded email

**Subject:** Helping working uninsured neighbors get ready to call BVMI

> Hi Amanda,
>
> I'm Jae McKinney, founder of Divigner, an AI solutions company based in Montclair, New Jersey. We're working with New Community Corporation in Newark on a community engagement initiative. Through that work, I've been looking at how people find community services when they search on their own, often after a long workday.
>
> BVMI stood out. You provide free primary care to Bergen County's working uninsured at two healthcare centers, Hackensack and Garfield, with clear published criteria: adults 18 and older living in Bergen County, someone in the household working, income up to 250% of the Federal Poverty Level, and no health insurance. Prospective patients also need to know which documents to bring and when each center is open.
>
> We've built an AI interactive avatar that acts as a 24/7 web concierge. It is a visible, human-like representative that visitors can see and speak with naturally. The web concierge can deliver a real-time presentation using actual images, slides and verified program information, take questions along the way, and adapt the walkthrough to each visitor. It shares logistics and published eligibility information only. It gives no medical advice, makes no eligibility decisions and sends people to your clinic lines.
>
> Imagine a restaurant worker in Garfield at 9 PM, uninsured and supporting two children. She asks who can become a BVMI patient, then which documents the screening requires. The web concierge shows the criteria and document list on screen, answers her questions, and gives her the Garfield and Hackensack numbers and hours.
>
> Experience the BVMI Web Concierge: [DEMO LINK PENDING]
>
> Would you have 15 minutes next week to talk about whether this could help prospective patients at both centers?
>
> Jae McKinney | Founder, Divigner | Montclair, NJ | https://divigner.com

*Independent Divigner demonstration using publicly available information; not an official Bergen Volunteer Medical Initiative service.*

Word count (Version B body, greeting through the 15-minute ask, counted with Python `len(body.split())`): **277**

## D. Demo package

**Personalized greeting:** "Hi, I'm the BVMI web concierge, an independent demonstration built from Bergen Volunteer Medical Initiative's public website. I can explain who BVMI serves, what to bring to screening and when each healthcare center is open. I can't give medical advice or decide eligibility. Please don't share health, income or immigration details. In an emergency, call 911."

**Q&A scenarios**

1. **Visitor:** "I work full time but don't have insurance. Can I be a patient at BVMI?"
   **Answer:** "BVMI lists four criteria: adults 18 and older living in Bergen County, someone in the household working, earning up to 250% of the Federal Poverty Level, and no health insurance. BVMI screens every prospective patient for financial and medical eligibility, so only BVMI can decide. To start, call 201-342-2478 in Hackensack or 551-380-4800 in Garfield."
   **Source:** https://www.bvmi.org/services
   **Safe next step:** Phone handoff; no eligibility judgment; no income questions asked.
2. **Visitor:** "What documents do I need to bring?"
   **Answer:** "BVMI asks prospective patients to provide proof of Bergen County residency, proof of earned income such as tax returns, paystubs or a letter from your employer, and a complete medical history. BVMI repeats this screening every year for existing patients."
   **Source:** https://www.bvmi.org/services
   **Safe next step:** Suggest confirming the list when calling the center.
3. **Visitor:** "Is the Garfield center open on Tuesday?"
   **Answer:** "No. The Garfield center is open Wednesday and Thursday, 9:30 AM to 4 PM. The Hackensack center is open Tuesday from 11 AM to 7 PM, and Monday, Wednesday, Thursday and Friday from 9:30 AM to 4 PM. Garfield: 551-380-4800. Hackensack: 201-342-2478."
   **Source:** https://www.bvmi.org/our-locations
   **Safe next step:** Show both addresses and numbers; recommend calling before visiting.

**Dynamic visual presentation walkthrough: "Becoming a BVMI patient"**

| Slide / image | Spoken explanation | Likely interruption and live answer |
|---|---|---|
| 1. BVMI logo and photos of the two centers | "BVMI provides free care to Bergen County's working uninsured at two healthcare centers, in Hackensack and Garfield." | "Is it really free?" "BVMI describes its care as free for qualified adults. Staff can answer questions about specific services." |
| 2. "Who qualifies": four published criteria as icons | "These are BVMI's published criteria. BVMI makes the final decision through screening." | "I'm not sure if my income is under the limit. Do I qualify?" "I can't calculate that or decide. Please call BVMI; their team does the screening." |
| 3. "What to bring": residency, earned income, medical history | "For screening, BVMI asks for these three things. Screening repeats each year." | "What counts as proof of income?" "BVMI lists tax returns, paystubs or a letter from your employer." |
| 4. Hours grid for both centers | "Hackensack is open five days, including Tuesday evenings until 7. Garfield is open Wednesday and Thursday." | "Can I walk in?" "BVMI provides care by appointment. Call the center first." |
| 5. Programs patients can access: Women's Health Initiative, diabetes education | "Once patients enroll, BVMI also offers women's health and diabetes programs." | "Do I have diabetes?" "I can't answer medical questions. BVMI's clinicians can help once you're a patient. If you feel unwell now, call 911 or your doctor." |

**Handoff:** Display 201-342-2478 and 551-380-4800 with hours, plus the Services and Locations page links.

**2 to 3 minute self-guided demo flow**

| Time | Beat |
|---|---|
| 0:00 to 0:20 | Greeting, independence disclaimer, no-medical-advice and privacy notice |
| 0:20 to 1:40 | Five-slide "Becoming a BVMI patient" presentation with one interruption |
| 1:40 to 2:10 | Documents question answered from the Services page |
| 2:10 to 2:35 | Garfield hours question; both centers compared |
| 2:35 to 2:50 | Phone handoff and closing disclaimer |

**Languages (verified):** English site with TranslatePress Spanish and Korean versions (translation quality unverified); clinic uses language interpreters. The concierge's own Spanish or Korean conversation is not claimed until tested.

**Guardrails**

- Independence disclaimer; not an official BVMI service.
- No medical advice, symptom triage, diagnosis or medication information. Emergencies: 911.
- No eligibility determinations and no Federal Poverty Level calculations.
- Do not ask for or store health, income, insurance or immigration information.
- Quote hours and criteria from official pages; tell visitors to confirm by phone.
- Treat any HIPAA-adjacent disclosure by a visitor by declining to engage and pointing to the clinic line.

## E. Priority score (/100)

| Component (max) | Points | Rationale |
|---|---|---|
| Community engagement fit (25) | 20 | Direct prospective-patient intake with a published multi-part test; Spanish and Korean audiences |
| Operational value (20) | 16 | Two centers with very different hours; document preparation before screening; volume unknown |
| Financial capacity (15) | 8 | $5.5M revenue, growing, but campaign-driven and contribution-dependent |
| Demo feasibility (15) | 11 | Clear criteria and hours pages; health context requires strict guardrails |
| Montclair proximity (10) | 9 | About 25 minutes to Hackensack; about 20 to Garfield |
| Decision-maker accessibility (10) | 10 | CEO's work email published on the official team page |
| Expansion potential (5) | 3 | Volunteers in Medicine model and health-system board ties; co-located with CFBNJ in Garfield |
| **Total** | **77** | |

Assumptions: proximity is estimated; operational value assumes prospective-patient inquiries exceed the roughly 1,000 active patients, which is unverified.

## F. Verification checklist

| Fact | Status |
|---|---|
| Amanda Missey, President/CEO; amissey@bvmi.net | ✅ https://www.bvmi.org/about-our-team (2026-10-28) |
| TY2025 990 revenue $5,512,620; 1,026 adults in 9,725 visits | ✅ ProPublica e-file render (accessed 2026-10-28) |
| Four eligibility criteria and document list | ✅ https://www.bvmi.org/services (2026-10-28) |
| Hours for both centers and phone numbers | ✅ https://www.bvmi.org/our-locations (2026-10-28) |
| Women's Health Initiative details | ✅ womens-health-initiative page (2026-10-28) |
| Diabetes program details | ✅ diabetes-care-and-education page (2026-10-28) |
| Telehealth and interpreters | ✅ https://www.bvmi.org/our-organization (2026-10-28) |
| Spanish and Korean site versions | ✅ hreflang es and ko, TranslatePress (2026-10-28); ⚠️ translation quality unknown |
| Waitlist or capacity status | ⚠️ not published |

**Contact verification:** Recipient Amanda Missey, President/CEO, verified on the official team page 2026-10-28. Recipient email **amissey@bvmi.net**, published on https://www.bvmi.org/about-our-team beside her name and title.

**Demo link status:** [DEMO LINK PENDING]. No demo has been built or tested.
