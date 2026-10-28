# 04. United Community Corporation: Outreach & Demo Package

> Prepared 2026-10-28 by Divigner research for Jae McKinney. Draft only: not sent, no Gmail draft, no demo deployed. Builds on the verified profile `docs/nonprofit-research/profiles/04-united-community-corporation.md`; facts re-checked today against uccnewark.org are marked as such.

## A. Research brief (one page)

| Field | Detail |
|---|---|
| Official name | United Community Corporation ("UCC"), EIN 22-1761128. Newark's designated Community Action Agency since 1964 |
| Website | https://uccnewark.org/ |
| Location | Administrative office: 971 Clinton Avenue, Irvington, NJ 07111. Mailing and 990 address: The Village, 332 S 8th Street, Newark, NJ 07103 (contact page, checked 2026-10-28) |
| Service area | Newark and Essex County |
| Decision maker | **Craig Mainor, Executive Director** (leadership page, checked 2026-10-28; principal officer on Form 990 TY2022 to TY2024). Natural program champion: Tom Wiedmann, Director of Community Engagement |
| Latest Form 990 | Tax year 2024 (calendar year ended Dec 31, 2024), e-filed Oct 6, 2025. **Total revenue $10,184,946**; expenses $11,272,625 (deficit $1,087,679). Direct filing: https://projects.propublica.org/nonprofits/organizations/221761128/202502799349301840/full |
| Revenue caveat | Annual revenue is not a purchasing budget. About 99% is contributions and grants, largely restricted government pass-through funding (CSBG, LIHEAP/USF, weatherization, lead). Net assets fell 46% to $1.88M in TY2024, so discretionary spend is likely tight |

**Featured programs (re-checked 2026-10-28)**

1. **The Market at UCC**: a free, choice-based, grocery-style market launched July 2026, replacing the Champion House Food Pantry. Serves Newark and Essex County neighbors. Appointment only, at 409 South 18th Street, Newark, Mondays, Wednesdays and Fridays, 10 AM to 2 PM. Book by texting UCCPANTRY to 726879 or through Plentiful (https://app.plentifulapp.com/pantry/41650). Also listed: the UCCafe mobile food truck, six 24/7 community refrigerators and a community kitchen. https://uccnewark.org/food-pantry/
2. **Utilities Assistance Program (LIHEAP and USF)**: UCC helps Essex County residents apply for the two DCA-administered energy programs. The page states income at or below 60% of State Median Income. Apply online through the DCAid portal (https://dcaid.dca.nj.gov/), with on-site iPad help, paperwork assistance for seniors and people without internet, and outreach events. 106 Ann Street, Newark. https://uccnewark.org/liheap/
3. **Fulton Street Emergency Shelter**: up to 30-day stays with case management, housing and legal support; a hospital-referral respite program launched in 2025. 31 Fulton Street, Newark. The contact page tells people needing emergency shelter after hours to go there directly or contact emergency services. https://uccnewark.org/fultonstreet/

**Digital infrastructure inventory (observed 2026-10-28)**

| Channel | What exists | How the web concierge complements it |
|---|---|---|
| Scheduling | Plentiful app and text-to-book (UCCPANTRY to 726879) for The Market | Explains the steps and hands off to Plentiful or the text code; never books on UCC's behalf |
| Applications | DCAid state portal for LIHEAP/USF; contact form with a service-type picker | Walks visitors through what the program is and links the portal or form |
| Phone and email | Main line 973-642-0181; info@uccnewark.org with subject "Request for Assistance"; department inboxes (fooddistribution@, emergencyservices@, wsp@, youthbuild@, energyassistance@) | Routes each question to the right published inbox or the main line |
| Chat | None detected | Adds a visible, conversational front door without replacing staff |
| Multilingual | GTranslate machine translation (Spanish, Portuguese, French, Haitian Creole, Croatian) | Demo stays English until Divigner product language support and UCC-approved translations are confirmed |
| Directory | Contact page lists 9 locations (one marked closed) | Presents locations visually and only from the current list |
| Content quality | Stale pages still live (COVID-era eviction page; senior page "paused due to COVID-19"); homepage contains template placeholder text | Knowledge base excludes stale pages unless UCC confirms them |

**Use cases**

- [Verified] UCC runs several separate intake routes (Plentiful/text booking, DCAid portal, main line, department inboxes) and the 2025 annual report cites 4,000+ online applications; the utilities page reports 6,300+ applications processed. A concierge that explains each route and hands off correctly fits what already exists.
- [Hypothesis, needs validation] Residents asking evening questions about The Market and utility help generate repeat calls or misrouted emails. UCC has not confirmed call or email volumes.

## B. Version A: first-touch email

**Subject:** After-hours help finding food at UCC

**Body:**

```text
Hi Craig,

I'm Jae McKinney, founder of Divigner, an AI solutions company based in Montclair, New Jersey. We're working with New Community Corporation in Newark on a community engagement initiative.

I saw The Market at UCC opened in July, with free appointments booked by text or Plentiful.

We've built an AI interactive avatar that acts as a 24/7 web concierge. It is a visible, human-like representative people can speak with naturally. The web concierge gives real-time presentations with images and slides, answers questions during the presentation, and guides people to the right UCC service.

Picture a Newark mother at 9 PM who wants to book a Market visit and find utility help.

Experience the UCC Web Concierge: [DEMO LINK PENDING]

Could we find 15 minutes to talk next week?
```

**Signature:** Jae McKinney | Founder, Divigner | Montclair, NJ | https://divigner.com

**Disclaimer:** Independent Divigner demonstration using publicly available information; not an official United Community Corporation service.

**Word count:** body 129 words (greeting through the 15-minute ask; counted with Python `len(body.split())`; target 110 to 130).

## C. Version B: expanded email

**Subject:** A 24/7 guide to UCC food, utility and shelter help

**Body:**

```text
Hi Craig,

I'm Jae McKinney, founder of Divigner, an AI solutions company based in Montclair, New Jersey. We're working with New Community Corporation in Newark on a community engagement initiative. As Newark's Community Action Agency, UCC is central to how residents find help.

Your teams cover a great deal: The Market at UCC, launched in July as a choice-based market with appointments by text or Plentiful; LIHEAP and USF help, with applications through the DCAid portal and staff support on site; and the Fulton Street Emergency Shelter. Each has its own steps, locations and contacts.

We've built an AI interactive avatar that acts as a 24/7 web concierge. It is a visible, human-like representative that people can see and speak with naturally.

What sets the web concierge apart is presentation. It walks visitors through a topic in real time, using actual images, slides and verified program information. People can interrupt with a question, get an immediate answer, and the walkthrough adapts to what they care about. It then guides them to your existing pathways, such as the Plentiful booking page, the DCAid portal, the main line or the right department inbox. It does not replace staff or systems.

Picture a Newark mother at 9 PM, after her children are asleep. She wants to know how The Market works, how to book a visit, and what UCC can do about a heating bill. The web concierge could show her the Market, explain the booking steps, and point her to the utility assistance pathway.

I would like to build a personalized demonstration from UCC's public pages for your review.

Experience the UCC Web Concierge: [DEMO LINK PENDING]

Would you have 15 minutes next week to talk it through?
```

**Signature:** Jae McKinney | Founder, Divigner | Montclair, NJ | https://divigner.com

**Disclaimer:** Independent Divigner demonstration using publicly available information; not an official United Community Corporation service.

**Word count:** body 286 words (greeting through the 15-minute ask; counted with Python `len(body.split())`; target 250 to 300).

## D. Demo package

**Personalized greeting (spoken and on screen)**
"Hi, welcome. I'm a web concierge built from United Community Corporation's public website, as an independent Divigner demonstration. I can walk you through The Market at UCC, utility help, or UCC's emergency shelter, and show you the right next step. Please don't share personal details like your name, address or income. What can I help you find?"

**Q&A scenario 1: The Market**
- Visitor: "How do I get food at The Market at UCC? Can I just show up?"
- Answer: "The Market at UCC is a free, choice-based market at 409 South 18th Street in Newark. It runs by appointment only, Mondays, Wednesdays and Fridays from 10 AM to 2 PM. You can book by texting UCCPANTRY to 726879, or through the Plentiful app or website."
- Source: https://uccnewark.org/food-pantry/
- Safe next step: show the Plentiful link and the text code; for anything else, call 973-642-0181.

**Q&A scenario 2: utility help**
- Visitor: "My electric bill is behind. Can UCC help me with LIHEAP?"
- Answer: "UCC helps Essex County residents apply for LIHEAP, which helps with heating and medically necessary cooling costs, and USF, which gives monthly bill credits. UCC's page says eligibility depends on household size and income, with income at or below 60% of State Median Income. The preferred way to apply is the state's DCAid portal, and UCC staff can help in person, including completing paperwork for seniors and people without internet. I can't tell you whether you qualify; the state and UCC staff decide that."
- Source: https://uccnewark.org/liheap/
- Safe next step: link https://dcaid.dca.nj.gov/ and the main line 973-642-0181. If a shutoff notice is involved, say to call the main line and the utility company directly.

**Q&A scenario 3: shelter tonight**
- Visitor: "I don't have anywhere to sleep tonight."
- Answer: "I'm sorry you're dealing with this. UCC's Fulton Street Emergency Shelter is at 31 Fulton Street in Newark. UCC's contact page says that for emergency shelter after hours, you can go to Fulton Street directly or contact local emergency services. If you are in danger right now, call 911."
- Source: https://uccnewark.org/contact-us/ and https://uccnewark.org/fultonstreet/
- Safe next step: show the address and 911; make no promise that a bed is available.

**Dynamic visual presentation: "Shopping at The Market at UCC"**

| Slide | On screen | Spoken narration |
|---|---|---|
| 1 | UCC logo; photo from the food page; title "The Market at UCC" | "Let me show you how The Market at UCC works. It opened in July 2026." |
| 2 | Graphic: grocery cart, fresh produce, proteins, dairy, shelf-stable goods; "No cost" | "It's set up like a neighborhood grocery store. You walk through with a cart and choose your own food, at no cost." |
| 3 | Map card: 409 South 18th Street, Newark; "Mon, Wed, Fri, 10 AM to 2 PM" | "It's at 409 South 18th Street and runs Mondays, Wednesdays and Fridays, 10 to 2, by appointment only." |
| 4 | Two booking tiles: "Text UCCPANTRY to 726879" and "Plentiful app" | "Booking is quick: text the code, or use the Plentiful app or website." |
| 5 | Other food options: UCCafe truck, six community refrigerators (24/7), community kitchen | "UCC also runs a mobile food truck, six community refrigerators open around the clock, and a community kitchen." |
| 6 | Handoff card: Plentiful link, text code, main line | "Ready? Here's where to book. For other questions, UCC's main line is 973-642-0181." |

Likely interruptions and live answers:
- "Do I need to bring ID?" → "UCC's page doesn't list what to bring. Please ask when you book or call 973-642-0181." (No invented requirement.)
- "Is it open Saturday?" → "The page lists Mondays, Wednesdays and Fridays, 10 to 2. For any other day, check with UCC."
- "Where are the community fridges?" → "UCC says it runs six across the city but doesn't list the addresses on that page. The main line can tell you the closest one."
- "Can you book it for me?" → "I can't book for you, but here's the Plentiful link and the text code."

Handoff: Plentiful (https://app.plentifulapp.com/pantry/41650), text UCCPANTRY to 726879, or 973-642-0181.

**2 to 3 minute self-guided demo flow**

| Time | Beat |
|---|---|
| 0:00 to 0:15 | Greeting, independent-demo disclaimer, privacy reminder |
| 0:15 to 0:30 | Visitor picks a topic: food, utility help, shelter, youth programs |
| 0:30 to 1:30 | Six-slide Market presentation with one live interruption |
| 1:30 to 2:10 | Visitor asks about utility help; concierge explains LIHEAP/USF and shows the DCAid link |
| 2:10 to 2:40 | Recap card with booking link, text code, main line and info@uccnewark.org |
| 2:40 to 3:00 | Close: "This was an independent Divigner demonstration, not an official UCC service." |

**Languages (verified only):** UCC's website offers GTranslate machine translation (Spanish, Portuguese, French, Haitian Creole, Croatian). No UCC-authored non-English program content and no staff language list were found. The demo runs in English. Any other language is [PENDING: confirm Divigner product language support and UCC-approved wording].

**Guardrails**
- Use only current public UCC pages; exclude the COVID-era eviction page and the senior services "paused" page unless UCC confirms them.
- No eligibility determinations for LIHEAP, USF, rental help, weatherization or shelter; no promises of beds, appointments or benefit amounts; no legal advice on evictions.
- Do not ask for or store names, addresses, income, immigration status or case details; show the privacy reminder at the start.
- Crisis words (no place to sleep, danger, shutoff today) trigger 911 or the Fulton Street after-hours guidance and the main line.
- On-screen disclaimer throughout: "Independent Divigner demonstration using publicly available information; not an official United Community Corporation service."

## E. Priority score (/100)

| Component | Points | Rationale |
|---|---|---|
| Community engagement fit (25) | 24 | Newark's Community Action Agency serving residents in crisis (food, utilities, shelter), and the closest thematic match to the NCC Newark initiative |
| Operational value (20) | 18 | Several separate intake routes, 4,000+ online applications and 6,300+ utility applications reported; stale pages create real routing confusion [Verified]. Volume of after-hours questions is a [Hypothesis] |
| Financial capacity (15) | 8 | $10.18M revenue (TY2024) sits in the $5M to $15M band (9), minus 1 for the TY2024 deficit and 46% drop in net assets |
| Demo feasibility (15) | 13 | WordPress site fetched cleanly; clear program pages with hours, addresses and links. Docked for stale and placeholder content that must be filtered |
| Montclair proximity (10) | 8 | About 22 minutes to the Irvington office (estimated, 21 to 30 minute band) |
| Decision-maker accessibility (10) | 7 | Executive Director named on site and 990; only the general inbox is published for him |
| Expansion potential (5) | 5 | Part of the statewide Community Action network, multiple Essex sites, partner ties with ICC and others |
| **Total** | **83** | |

Assumptions: financial anchors are under $1.5M = 0, $1.5M to $5M = 6, $5M to $15M = 9, $15M to $50M = 12, over $50M = 15, minus 1 to 2 for deficit or balance-sheet risk. Proximity anchors are 20 minutes or less = 10, 21 to 30 = 8, 31 to 45 = 6, 46 to 60 = 4, over 60 = 2 (drive times are estimates). Engagement fit, operational value, feasibility and expansion are analyst judgments from public pages, not measured demand.

## F. Verification checklist

| Fact | Status |
|---|---|
| Official name, EIN 22-1761128 | ✅ ProPublica org page and TY2024 990, checked 2026-10-28 |
| TY2024 revenue $10,184,946, filed 2025-10-06 | ✅ https://projects.propublica.org/nonprofits/organizations/221761128/202502799349301840/full (2026-10-28) |
| FY2025 990 | ⚠️ Not yet available; only a FY2025 single audit is listed on ProPublica |
| Craig Mainor, Executive Director | ✅ https://uccnewark.org/leadership/ (2026-10-28) and 990 Part VII |
| The Market at UCC: July 2026 launch, appointment only, M/W/F 10 to 2, 409 S 18th St, text or Plentiful booking | ✅ https://uccnewark.org/food-pantry/ (2026-10-28) |
| LIHEAP/USF help, 60% SMI, DCAid portal, 6,300+ applications processed | ✅ https://uccnewark.org/liheap/ (2026-10-28); application count is self-reported |
| Fulton Street shelter, 30-day stays, after-hours guidance | ✅ https://uccnewark.org/fultonstreet/ and https://uccnewark.org/contact-us/ (2026-10-28) |
| 4,000+ online applications (2025) | ✅ 2025 annual report (profile source, 2026-10-28); self-reported |
| Utilities director Desiree Cespedes | ⚠️ Named on the utilities page but not on the leadership page; confirm before using |
| Contact page lists "Champion House Food Pantry" at 409 S 18th St | ⚠️ Outdated label; the food page says The Market replaced Champion House operations |
| Stale COVID-era pages | ⚠️ Still live; excluded from demo content |
| Languages | ⚠️ Machine translation only; staff languages unknown |

**Contact verification:** Greeting "Hi Craig," uses the Executive Director verified on the official leadership page today. Recipient email is UCC's official general inbox **info@uccnewark.org**, published at https://uccnewark.org/contact-us/. No personal address is published for Craig Mainor, and none was constructed.

**Demo link status:** `[DEMO LINK PENDING]`. No demo has been built or tested.
