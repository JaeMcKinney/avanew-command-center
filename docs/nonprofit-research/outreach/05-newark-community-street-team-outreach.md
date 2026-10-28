# 05. Newark Community Street Team: Outreach & Demo Package

> Prepared 2026-10-28 by Divigner research for Jae McKinney. Draft only: nothing has been sent, no demo exists, and no one at NCST has been contacted. Builds on the verified profile `docs/nonprofit-research/profiles/05-newark-community-street-team.md`.
>
> **Data policy caution:** NCST's About page sets a research policy ("nothing about us without us"; IRB approval through the UCLA Social Justice Research Partnership before any research recruitment) and states that NCST does not share information with law enforcement. A transcript-tracked demo would conflict with that. **The NCST demo would run without transcript retention**, collect no names or incident details, and never be pitched as data collection. Jae should confirm the product can run with transcripts disabled before Version B is sent.

## A. Research brief (one page)

| Field | Detail |
|---|---|
| Official name | Newark Community Street Team Inc (NCST). EIN 82-1719128 |
| Website | https://www.newarkcommunitystreetteam.org/ |
| Location | 915 S. 16th Street, Newark, NJ 07108 (Essex County); outreach workers embedded at University Hospital |
| Service area | Newark, focused on the South and West Wards; the Trauma Recovery Center serves Essex and Hudson counties |
| Decision maker | **Rey (Renaldo) Chavis, Executive Director.** Named "NCST Executive Director Rey Chavis" in NCST's statement of 2025-10-29 (newest official mention found on 2026-10-28; nothing newer contradicts it); FY2024 990 lists "Renaldo Chavis, Exec Director." Board chair and co-founder: Aqeela Sherrills |
| Recipient email | info@newarkcommunitystreetteam.org (official general inbox, published in the About page FAQ). No personal ED email is published. The Gmail addresses on the site were not used |
| Latest Form 990 | Fiscal year ended Dec 31, 2024 (tax year 2024), e-filed 2025-10-01. **Total revenue $6,536,725**; expenses $6,263,321. Direct filing: https://projects.propublica.org/nonprofits/organizations/821719128/202502749349300100/full |
| Revenue vs. budget | Annual revenue is not a purchasing budget. Revenue fell 30% from FY2023, and NCST lost its VOCA victim-services grant in October 2025, so discretionary budget is likely tight |

**Featured programs (2 to 3, official links)**

1. **Victim Services Department, Outreach Workers** (https://www.newarkcommunitystreetteam.org/what-we-do/). Mentoring for youth and young adults aged 14 to 30, with hardship assistance (up to $200), up to 40 hours of life skills, help getting IDs, wellness support, free legal services with Rutgers law fellows, and job referrals. Referrals: info@newarkcommunitystreetteam.org or walk in at 915 S. 16th St (About page FAQ).
2. **Trauma Recovery Center** (https://www.newarkcommunitystreetteam.org/what-we-do/). Free mental health services for survivors of violent crime aged 10 and older who live in Essex or Hudson County. Referral through the online "Trauma Recovery Center and Eviction Prevention Referral Form" (https://forms.gle/XfBMUoYTGZpjjBHk7).
3. **Public Safety Round Table** (https://www.newarkcommunitystreetteam.org/public-safety-round-table/). Community forum every other Tuesday at 10 AM on Facebook or Zoom (email ncstscheduling@gmail.com for the Zoom invite).

**Digital infrastructure inventory (checked 2026-10-28)**

| Channel | What exists | How the web concierge complements it |
|---|---|---|
| Scheduling | None online; requests by email | Explains which inbox handles which request |
| Applications / referrals | Google Form for TRC and Eviction Prevention referrals; email or walk-in referrals for ages 14 to 30 | Explains who each route serves and links to it; never fills in a referral |
| Portals | None | Not applicable |
| Chat | No chat widget found | Adds a visual explainer without collecting data |
| Telephone | HRI hotline and Overdose Response Team (833) 254-6278 | Shows the hotline and 911 for anything urgent |
| Text alerts | Text "newark" to 855-485-2663 | Can mention the text-alert option |
| Multilingual | English only; no translation tools found | Demo in English only |
| Directories / FAQ | Detailed About page FAQ (referrals, research policy, law enforcement, Safe Passage, jobs, technical assistance) | Presents the existing FAQ answers visually, word for word in substance |

**Use cases**

- [Verified] The FAQ shows recurring public questions (how to refer someone, Safe Passage, jobs, research requests). A no-data concierge can present those answers and route to the published inbox or hotline.
- [Hypothesis] Clearer explanation of the Trauma Recovery Center's eligibility and referral form could help survivors and families find it. Needs NCST's view; volume unknown.

## B. Version A: first-touch email

**Subject:** NCST's referral questions, answered on your terms

**Body:**

> Hi Rey,
>
> I'm Jae McKinney, founder of Divigner, an AI solutions company based in Montclair, New Jersey. We're working with New Community Corporation in Newark on a community engagement initiative.
>
> NCST's FAQ explains how to refer a young person aged 14 to 30.
>
> We've built an AI interactive avatar that acts as a 24/7 web concierge. It is a visible, human-like representative people can talk with naturally. The web concierge gives real-time presentations with images and slides, answers questions during the presentation, and guides people to your existing referral routes.
>
> Picture a grandmother at 9 PM, looking up how to connect her grandson with an NCST outreach worker.
>
> Experience the NCST Web Concierge: [DEMO LINK PENDING]
>
> Would you have 15 minutes next week to talk, on your terms?

**Signature:** Jae McKinney | Founder, Divigner | Montclair, NJ | https://divigner.com

**Disclaimer:** Independent Divigner demonstration using publicly available information; not an official Newark Community Street Team service.

**Word count:** 128 words in the body (greeting through the 15-minute ask; excludes subject, signature and disclaimer; target 110 to 130). Counted with Python `len(body.split())`.

## C. Version B: expanded email

**Subject:** Helping residents find NCST's referral routes

**Body:**

> Hi Rey,
>
> I'm Jae McKinney, founder of Divigner, an AI solutions company based in Montclair, New Jersey. We're working with New Community Corporation in Newark on a community engagement initiative. NCST's commitment to putting the public in public safety is one I respect.
>
> Your public pages already answer a lot. The FAQ explains how to refer a young person aged 14 to 30, by email or by coming to 915 S. 16th Street. The Trauma Recovery Center offers free mental health services to survivors of violent crime aged 10 and older in Essex and Hudson counties, with an online referral form.
>
> We've built an AI interactive avatar that acts as a 24/7 web concierge. It is a visible, human-like representative that people can see and talk with naturally. The web concierge can give a short presentation with real images and slides from NCST's public pages, answer questions along the way, and adapt to what the visitor needs. It does not replace outreach workers or make decisions about anyone. It points people to the routes you already publish, and anything urgent goes straight to 911 or your HRI hotline.
>
> I have read NCST's research policy. Any NCST demonstration would run without keeping transcripts, and it would never ask visitors for names or details about an incident.
>
> Picture an aunt at 9 PM after a hard week, reading about the Trauma Recovery Center for her nephew. She wants to know who it serves and how a referral starts. The web concierge explains the program and shows her the referral form.
>
> Experience the NCST Web Concierge: [DEMO LINK PENDING]
>
> If it does not fit your values, that is useful to hear. Would you have 15 minutes next week to talk?

**Signature:** Jae McKinney | Founder, Divigner | Montclair, NJ | https://divigner.com

**Disclaimer:** Independent Divigner demonstration using publicly available information; not an official Newark Community Street Team service.

**Word count:** 287 words in the body (greeting through the 15-minute ask; excludes subject, signature and disclaimer; target 250 to 300). Counted with Python `len(body.split())`.

## D. Demo package

All answers below are built only from NCST's public pages as checked on 2026-10-28. Demo status: [DEMO LINK PENDING]. No demo exists yet.

**Personalized greeting**

"Hi, welcome. I'm a web guide built from Newark Community Street Team's public website. I can explain NCST's programs and how to reach them. This conversation is not recorded or saved. Please don't share names or details about any incident. If someone is in danger right now, call 911."

**Q&A scenario 1**
- Visitor question: "My grandson is 17 and wants to stay out of trouble. How do I connect him with NCST?"
- Grounded answer: "NCST's outreach workers mentor young people aged 14 to 30. NCST's FAQ asks people to send referrals to its info inbox or to come by 915 S. 16th Street."
- Source: https://www.newarkcommunitystreetteam.org/about-us/
- Safe next step: Email info@newarkcommunitystreetteam.org or visit 915 S. 16th St, Newark.

**Q&A scenario 2**
- Visitor question: "Where can someone who was shot get free counseling?"
- Grounded answer: "NCST's Trauma Recovery Center offers free mental health services to survivors of violent crime aged 10 and older, including survivors of gunshot wounds, who live in Essex or Hudson County. Referrals start with NCST's online referral form."
- Source: https://www.newarkcommunitystreetteam.org/what-we-do/
- Safe next step: Open the referral form at https://forms.gle/XfBMUoYTGZpjjBHk7. If anyone is in immediate danger, call 911.

**Q&A scenario 3**
- Visitor question: "How can I join the Public Safety Round Table?"
- Grounded answer: "The Public Safety Round Table meets every other Tuesday at 10 AM. You can join on Facebook or on Zoom; NCST's page says to email for the Zoom invite."
- Source: https://www.newarkcommunitystreetteam.org/public-safety-round-table/
- Safe next step: Email ncstscheduling@gmail.com (the address NCST publishes for the invite) or follow https://www.facebook.com/newarkcst.

**Dynamic visual presentation walkthrough: "NCST's Trauma Recovery Center"**

| Slide / image | Spoken narration | Likely interruption and live answer |
|---|---|---|
| 1. NCST logo and a team photo from NCST's homepage | "Newark Community Street Team works to heal trauma, intervene in violence and empower residents. One of its programs is the Trauma Recovery Center." | "Is this the police?" "No. NCST's FAQ says it does not share information with law enforcement." |
| 2. Slide: "Who the TRC serves" (survivors of violent crime, age 10 and older, Essex and Hudson counties) | "The TRC provides free mental health services to survivors of violent crime, including assault, gunshot wounds, stabbings, domestic violence and human trafficking." | "Does it cost anything?" "NCST's page describes the services as free." |
| 3. Slide: "How it helps" (barriers to mental health care, health care and legal resources after trauma) | "The TRC is designed to help survivors get past barriers to mental health treatment, health care and legal resources." | "Can you tell me if my nephew qualifies?" "I can't decide that. The TRC team reviews each referral." |
| 4. Slide: "Starting a referral" with the referral form link | "Referrals start with NCST's online form." | "Will you save what I tell you?" "No. This demonstration does not keep transcripts, and I won't ask for names or details." |
| 5. Handoff card: referral form link, info@ inbox, and "In danger now? Call 911" | "To take the next step, use the referral form or email NCST." | Ends on the handoff card. No data collected |

**2 to 3 minute self-guided demo flow**

- 0:00 to 0:20. Greeting with the no-recording notice and 911 line.
- 0:20 to 1:30. TRC walkthrough (five slides) with pauses for questions.
- 1:30 to 2:10. Visitor asks how to refer a young person (scenario 1).
- 2:10 to 2:40. Visitor asks about the Public Safety Round Table (scenario 3).
- 2:40 to 3:00. Handoff card and disclaimer.

**Languages (verified only)**

- English only. No translation tools or non-English content found on NCST's site. The demo runs in English.

**Privacy, safety and accuracy guardrails**

- **Transcript-off mode: the NCST demo would run without transcript retention.** No conversation logs, recordings or analytics tied to content; no names, locations or incident details requested or stored. Consistent with NCST's research and data policy.
- Disclaimer on screen: "Independent Divigner demonstration using publicly available information; not an official Newark Community Street Team service."
- Any mention of danger, violence, retaliation or overdose shows only 911 and NCST's HRI/ORT line (833) 254-6278. No mediation advice.
- No legal, medical or mental-health advice; no eligibility decisions; never collect information about third parties.
- No invented hours (NCST publishes none for its office); only the published Round Table and Community Walk times.
- Never framed as surveillance, research or data collection. NCST decides what the concierge says if it ever moves forward.
- Session limit of about 3 minutes.

## E. Priority score (/100)

| Component | Points | Rationale |
|---|---|---|
| Community engagement fit (25) | 15 | Real public intake and a busy FAQ, but most work is relationship-based outreach, and the data policy conflicts with a typical tracked demo |
| Operational value (20) | 12 | Referral and TRC questions are good fits; safety-critical topics limit what a concierge should handle |
| Financial capacity (15) | 9 | FY2024 revenue $6.54M, down 30%; VOCA grant lost in Oct 2025 |
| Demo feasibility (15) | 10 | Good program text and FAQ, but requires transcript-off mode and strict crisis routing |
| Montclair proximity (10) | 8 | About 20 to 25 minutes to South 16th Street (estimate) |
| Decision-maker accessibility (10) | 6 | ED named on site (2025) and 990, but only a general inbox; ED change in 2024 |
| Expansion potential (5) | 3 | National community violence intervention network visibility, but sensitivity limits referrals |
| **Total** | **63** | |

Assumptions: proximity is estimated; FY2025 finances are not yet filed; the score assumes NCST would consider a no-data demo at all.

## F. Verification checklist

- ✅ EIN 82-1719128 and FY2024 revenue $6,536,725: ProPublica filing above (profile, checked 2026-10-28).
- ✅ "NCST Executive Director Rey Chavis": https://www.newarkcommunitystreetteam.org/2025/10/29/standing-up-for-victims-ncst-calls-for-transparency-and-support/ (2026-10-28).
- ✅ Referral route (ages 14 to 30, info@ inbox, 915 S. 16th St); research policy; law-enforcement stance; HRI hotline: https://www.newarkcommunitystreetteam.org/about-us/ (2026-10-28).
- ✅ Program inventory, TRC eligibility, ORT number: https://www.newarkcommunitystreetteam.org/what-we-do/ (2026-10-28).
- ✅ TRC and Eviction Prevention Referral Form link and text alerts: https://www.newarkcommunitystreetteam.org/connect-with-us/ (2026-10-28).
- ✅ Public Safety Round Table schedule: https://www.newarkcommunitystreetteam.org/public-safety-round-table/ (2026-10-28).
- ✅ No chat widget; English-only site (HTML check, 2026-10-28).
- ⚠️ ED status last confirmed by an Oct 2025 statement; re-confirm before sending. "Rey" and "Renaldo" are presumed to be the same person.
- ⚠️ FY2025 finances not yet filed; current COO and CFO unverified.
- ⚠️ Whether the Divigner product supports a transcript-off mode must be confirmed by Jae before Version B is sent.
- **Contact verification:** Recipient Rey (Renaldo) Chavis, Executive Director, verified on NCST's site and the FY2024 990. Greeting "Hi Rey," uses the name NCST itself publishes. Email: official general inbox info@newarkcommunitystreetteam.org (About page FAQ).
- **Demo link status:** [DEMO LINK PENDING]. No demo has been built or tested.
