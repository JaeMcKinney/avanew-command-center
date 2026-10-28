# 11. Oasis, A Haven for Women and Children: Outreach & Demo Package

> Prepared 2026-10-28 by Divigner research for Jae McKinney. Draft only: not sent, no Gmail draft, no demo deployed. Builds on the verified profile `docs/nonprofit-research/profiles/11-oasis.md`; facts re-checked today against oasisnj.org are marked as such. The organization's official name contains a dash; this package writes it as "Oasis, A Haven for Women and Children" or "Oasis" throughout, per house rules.
>
> **Safety caution:** Oasis serves women and children in poverty, including domestic violence survivors. The demo collects no personal data and routes danger to 911 and the NJ Domestic Violence Hotline.

## A. Research brief (one page)

| Field | Detail |
|---|---|
| Official name | Oasis, A Haven for Women and Children (990 header: "OASIS - A HAVEN FOR WOMEN & CHILDREN INC"), EIN 22-3491573. Related LLCs: 59 Mill Street Paterson LLC and 84 Mill Street Paterson LLC (property holding) |
| Website | https://oasisnj.org/ |
| Location | 59 Mill Street, Paterson, NJ 07501 |
| Service area | Greater Paterson |
| Decision maker | **Jennifer Brady, Executive Director** since 2015 (staff page, re-confirmed 2026-10-28; Form 990 FY2025 Part VII). Operational champion: Jim Walsh, Director of Community Engagement |
| Latest Form 990 | Tax year 2024 (fiscal year Jul 1, 2024 to Jun 30, 2025). **Total revenue $6,871,737**; expenses $6,765,061 (surplus $106,676). Direct filing: https://projects.propublica.org/nonprofits/organizations/223491573/202513099349302501/full |
| Revenue caveat | Annual revenue is not a purchasing budget. Funding is mostly private donors (government grants about 6%), surpluses have narrowed three years running, and net assets of $16.9M are mostly the Mill Street building, not spendable cash |

**Featured programs (re-checked 2026-10-28)**

1. **Adult Education**: free classes for women, with free infant and toddler childcare while mothers are in class. Includes three levels of High School Equivalency (GED) preparation with exam registration and fees paid, four levels of ESL plus the "English Café" conversation program, computer training with an afternoon open lab, a Citizenship course (age 18+, lawful permanent residents; N-400 and test preparation), job counseling, Child Development Associate training with Passaic County Community College, and Saturday programs. 2025: 893 students, 501 in ESL. https://oasisnj.org/adult-education/
2. **Basic Needs**: hot breakfast and lunch every weekday in the dining room (the community lunch is served 12 to 1, per the contact page), 3-day grocery bags, and diapers, formula, hygiene items and school supplies for families. https://oasisnj.org/basic-needs/
3. **Youth Development**: the Michael Wagner After-School Academy (weekday classes with dinner), a Teen Program, Carl's Kids Summer Camp, Rise and Shine Saturday Program, and lead-agency work at Paterson Public Schools 2 and 16. https://oasisnj.org/youth-development/

**Digital infrastructure inventory (observed 2026-10-28)**

| Channel | What exists | How the web concierge complements it |
|---|---|---|
| Phone | Main line 973-881-8307 with published staff extensions; "Do you need help or services? Please call ... and ask to speak with one of our social workers" | Hands off to the main line and social workers |
| Email | General inbox info@oasisnj.org; staff emails published on the staff page | Routes non-urgent questions to the general inbox |
| Hours | Office hours Monday to Friday, 8 AM to 4 PM; donation drop-off windows | Explains programs outside office hours, then points to morning contact |
| Applications or enrollment | No online enrollment or class registration found; intake begins in person with social workers | Prepares visitors for the in-person or phone first step |
| Chat or FAQ | None found | Adds a conversational, visual guide |
| Multilingual | English-only website; domestic violence groups run in English and Spanish | Demo English; Spanish pending |
| Site access | oasisnj.org returns HTTP 403 to plain automated fetch; pages were read via Firecrawl | Knowledge base build needs an approved fetch method |

**Use cases**

- [Verified] Women first meet Oasis through the weekday dining room and then need to understand classes, childcare during class, the Citizenship course and youth programs, with no online enrollment path and an English-only site. A visual walkthrough of "what Oasis offers and how to start" fits the published content and the phone-first intake.
- [Hypothesis, needs validation] Prospective students and parents call or walk in mainly to ask what is offered and when, which a concierge could answer first. Oasis has not confirmed this.

## B. Version A: first-touch email

**Subject:** Helping Paterson moms find Oasis classes

**Body:**

```text
Hi Jennifer,

I'm Jae McKinney, founder of Divigner, an AI solutions company based in Montclair, New Jersey. We're working with New Community Corporation in Newark on a community engagement initiative.

I was struck that Oasis offers free infant and toddler childcare while mothers attend GED, ESL and computer classes.

We've built an AI interactive avatar that acts as a 24/7 web concierge. It is a visible, human-like representative people can speak with naturally. The web concierge gives real-time presentations with images and slides, answers questions during the presentation, and guides people to the right Oasis program.

Picture a Paterson mother at 9 PM, wondering if she can bring her toddler to English class.

Experience the Oasis Web Concierge: [DEMO LINK PENDING]

Could we find 15 minutes to talk next week?
```

**Signature:** Jae McKinney | Founder, Divigner | Montclair, NJ | https://divigner.com

**Disclaimer:** Independent Divigner demonstration using publicly available information; not an official Oasis, A Haven for Women and Children service.

**Word count:** body 130 words (greeting through the 15-minute ask; counted with Python `len(body.split())`; target 110 to 130).

## C. Version B: expanded email

**Subject:** An evening guide to Oasis programs for Paterson families

**Body:**

```text
Hi Jennifer,

I'm Jae McKinney, founder of Divigner, an AI solutions company based in Montclair, New Jersey. We're working with New Community Corporation in Newark on a community engagement initiative. That work keeps reminding me how often a family's first visit leads to everything that follows.

At Oasis, that first visit is often a weekday meal at Mill Street. From there, women learn about GED preparation, four levels of ESL and the English Café, computer training, the Citizenship course, and free infant and toddler childcare while they are in class. Their children may join the Michael Wagner After-School Academy or Carl's Kids Summer Camp.

We've built an AI interactive avatar that acts as a 24/7 web concierge. It is a visible, human-like representative that women can see and speak with naturally.

The web concierge delivers real-time presentations using actual images, slides and verified program information. A visitor can interrupt with a question, get an immediate answer, and the walkthrough adapts to her interests. It then guides her to your existing pathways, such as calling 973-881-8307 to speak with a social worker. It supports your staff rather than replacing anyone, and it would never ask for personal details.

Picture a mother in Paterson at 9 PM, after her children are asleep. She wants to improve her English and wonders whether she can bring her toddler to class. The web concierge could show her the classrooms and childcare center in photos, explain the ESL levels, and tell her how to reach Oasis staff in the morning.

I would like to put together a personalized demonstration from Oasis's public pages for your review.

Experience the Oasis Web Concierge: [DEMO LINK PENDING]

Would you have 15 minutes next week, or could I stop by Mill Street?
```

**Signature:** Jae McKinney | Founder, Divigner | Montclair, NJ | https://divigner.com

**Disclaimer:** Independent Divigner demonstration using publicly available information; not an official Oasis, A Haven for Women and Children service.

**Word count:** body 292 words (greeting through the 15-minute ask; counted with Python `len(body.split())`; target 250 to 300).

## D. Demo package

**Personalized greeting (spoken and on screen)**
"Hi, welcome. I'm a web concierge built from the public website of Oasis, A Haven for Women and Children, as an independent Divigner demonstration. I can tell you about free classes for women, childcare during class, meals and youth programs, and how to reach Oasis staff. Please don't share your name, address, immigration status or personal story with me. If you are in danger, call 911. What would you like to know?"

**Q&A scenario 1: English classes and childcare**
- Visitor: "I want to learn English, but I have a baby. Can I still take classes at Oasis?"
- Answer: "Oasis offers free English as a Second Language classes for women at four levels, plus the English Café, where students practice speaking with volunteers. Oasis also provides free childcare for infants and toddlers while mothers are in class, in separate infant and toddler rooms. The website doesn't list class start dates, so the best next step is to call Oasis."
- Source: https://oasisnj.org/adult-education/
- Safe next step: 973-881-8307 (office hours Monday to Friday, 8 AM to 4 PM) or info@oasisnj.org.

**Q&A scenario 2: meals**
- Visitor: "Can my kids and I get lunch at Oasis?"
- Answer: "Oasis serves hot breakfast and lunch every weekday for women and children from the community at 59 Mill Street in Paterson. The contact page notes the community lunch is served from 12 to 1. Oasis social workers can also tell you about grocery bags, diapers and formula."
- Source: https://oasisnj.org/basic-needs/ and https://oasisnj.org/contact-us/
- Safe next step: call 973-881-8307 and ask for a social worker.

**Q&A scenario 3: Citizenship course**
- Visitor: "I have a green card. Can Oasis help me become a citizen?"
- Answer: "Oasis runs a Citizenship course that helps women complete the N-400 application and prepare for the citizenship test. Oasis says applicants must be at least 18 and lawfully admitted permanent US residents. In 2025, 40 women took the course and 17 became US citizens. I can't give immigration or legal advice."
- Source: https://oasisnj.org/adult-education/
- Safe next step: call 973-881-8307 to ask about the next course; no legal advice.

**Dynamic visual presentation: "Free classes at Oasis, with childcare"**

| Slide | On screen | Spoken narration |
|---|---|---|
| 1 | Oasis logo; photo from the Adult Education page; title "Free classes for women" | "Let me show you the free classes Oasis offers women in Paterson." |
| 2 | Childcare center image; "Free infant and toddler care while you're in class" | "First, the part many moms ask about: Oasis provides free childcare for infants and toddlers while you're in class." |
| 3 | Four tiles: GED (3 levels), ESL (4 levels and English Café), Computer training, Citizenship | "You can prepare for the high school equivalency test, learn English at four levels, build computer skills, or prepare for citizenship." |
| 4 | Career tiles: job counseling; Child Development Associate training with PCCC; Saturday programs | "There's also job counseling, a year-long childcare credential course with Passaic County Community College, and Saturday classes." |
| 5 | 2025 results: 893 students, 501 in ESL, 8 GED graduates, 17 new citizens | "Last year, 893 women took classes at Oasis." |
| 6 | Handoff card: 973-881-8307, info@oasisnj.org, 59 Mill Street, office hours | "To get started, call Oasis during office hours, weekdays from 8 to 4, or email the general inbox." |

Likely interruptions and live answers:
- "When does the next ESL class start?" → "The website doesn't list start dates. Please call 973-881-8307."
- "Do I have to pay for the GED test?" → "Oasis says it helps students register for the exams when ready and pays exam fees."
- "Can my 8-year-old come too?" → "The class childcare is for infants and toddlers. For school-age children, Oasis runs the Michael Wagner After-School Academy; staff can explain how to join."
- "I'm not safe at home." → "If you are in danger, call 911. You can reach the NJ Domestic Violence Hotline at 1-800-572-7233, and Oasis social workers at 973-881-8307."

Handoff: 973-881-8307, info@oasisnj.org, or an in-person visit to 59 Mill Street.

**2 to 3 minute self-guided demo flow**

| Time | Beat |
|---|---|
| 0:00 to 0:20 | Greeting, independent-demo disclaimer, privacy and safety reminder |
| 0:20 to 0:35 | Visitor picks: classes, meals and basic needs, kids' programs, social workers |
| 0:35 to 1:40 | Six-slide adult education presentation with one interruption |
| 1:40 to 2:15 | Follow-up on youth programs or meals |
| 2:15 to 2:40 | Recap card: phone, office hours, general inbox, address |
| 2:40 to 3:00 | Close: "This was an independent Divigner demonstration, not an official Oasis service." |

**Languages (verified only):** The Oasis website is English only, with no translation widget found. Domestic violence group sessions are offered in English and Spanish. The demo runs in English; Spanish is [PENDING: confirm Divigner product language support and Oasis-approved wording].

**Guardrails**
- Collect no personal data (names, addresses, immigration status, abuse details); interrupt and redirect if a visitor starts to share.
- Safety routing: 911 for danger; NJ Domestic Violence Hotline 1-800-572-7233; Oasis social workers at 973-881-8307.
- No eligibility, legal, immigration or medical advice; no invented class schedules, enrollment dates or meal times beyond those published.
- Do not present ECO housing or community-school site details (addresses not published).
- On-screen disclaimer throughout: "Independent Divigner demonstration using publicly available information; not an official Oasis, A Haven for Women and Children service."

## E. Priority score (/100)

| Component | Points | Rationale |
|---|---|---|
| Community engagement fit (25) | 22 | About 1,500 women and children served daily with walk-in meals and free classes; docked for sensitive domestic violence population and private-donor focus |
| Operational value (20) | 17 | Many programs, phone-first intake, no online enrollment, English-only site [Verified]; repeat-question load is a [Hypothesis] |
| Financial capacity (15) | 9 | $6.87M revenue (FY2025), $5M to $15M band; surpluses but narrowing |
| Demo feasibility (15) | 12 | Rich, current program pages; docked because plain fetches are blocked (403) and enrollment dates are not published |
| Montclair proximity (10) | 8 | About 20 to 25 minutes to 59 Mill Street (estimated) |
| Decision-maker accessibility (10) | 7 | ED named on site and 990, phone extension x101 published, general inbox available; no personal email |
| Expansion potential (5) | 4 | 50+ partner agencies, two Paterson community schools, PCCC partnership |
| **Total** | **79** | |

Assumptions: financial anchors are under $1.5M = 0, $1.5M to $5M = 6, $5M to $15M = 9, $15M to $50M = 12, over $50M = 15, minus 1 to 2 for deficit or balance-sheet risk. Proximity anchors are 20 minutes or less = 10, 21 to 30 = 8, 31 to 45 = 6, 46 to 60 = 4, over 60 = 2 (drive times are estimates). Other components are analyst judgments from public pages, not measured demand.

## F. Verification checklist

| Fact | Status |
|---|---|
| Official name, EIN 22-3491573 | ✅ FY2025 990 and ProPublica, checked 2026-10-28 |
| FY2025 (TY2024) revenue $6,871,737 | ✅ https://projects.propublica.org/nonprofits/organizations/223491573/202513099349302501/full (2026-10-28) |
| Jennifer Brady, Executive Director; phone x101; no email published | ✅ https://oasisnj.org/staff/ (re-confirmed 2026-10-28) and 990 FY2025 |
| Adult Education programs, free childcare during class, 2025 results | ✅ https://oasisnj.org/adult-education/ (2026-10-28) |
| Office hours M to F 8 to 4; info@oasisnj.org; community lunch 12 to 1; "ask to speak with one of our social workers" | ✅ https://oasisnj.org/contact-us/ (2026-10-28) |
| Weekday hot breakfast and lunch; distributions | ✅ https://oasisnj.org/basic-needs/ (profile check, 2026-10-28) |
| Youth programs | ✅ https://oasisnj.org/youth-development/ (profile check, 2026-10-28) |
| Homepage figures (1,500 served daily; 100,642 meals; 839 women in classes; 234 at summer camp) | ⚠️ Homepage says 839 women attending classes while Adult Education says 893 students in 2025; different measures, so the demo uses the Adult Education figure |
| Profile note that /contact/ returns 404 | ⚠️ Outdated: the live page is /contact-us/ |
| Class start dates, thrift store hours, youth enrollment steps | ⚠️ Not published |
| Brand colors | ⚠️ From Firecrawl branding extraction, not read from CSS directly |

**Contact verification:** Greeting "Hi Jennifer," uses the Executive Director verified on the official staff page today. Recipient email is the official general inbox **info@oasisnj.org**, published at https://oasisnj.org/contact-us/. Jennifer Brady has only a phone extension published (973-881-8307 x101); no personal address was constructed. Optional cc: Jim Walsh, Director of Community Engagement, jimwalsh@oasisnj.org (published on https://oasisnj.org/staff/).

**Demo link status:** `[DEMO LINK PENDING]`. No demo has been built or tested.
