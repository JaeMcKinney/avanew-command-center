# 10. Community FoodBank of New Jersey: Outreach & Demo Package

> Prepared 2026-10-28 by Divigner research under Jae McKinney's approved master prompt. Draft only: nothing has been sent, drafted in Gmail or deployed. Builds on the verified profile `docs/nonprofit-research/profiles/10-community-foodbank-of-new-jersey.md`. Not endorsed by the Community FoodBank of New Jersey.

## A. Research brief (one page)

| Field | Detail |
|---|---|
| Official name | Community FoodBank of New Jersey (CFBNJ); legal name Community Food Bank of New Jersey Inc, EIN 22-2423882. Feeding America member |
| Website | https://cfbnj.org/ |
| Location | HQ and warehouse: 31 Evans Terminal, Hillside, NJ (Union County). Southern Branch: 6735 Black Horse Pike, Egg Harbor Township. Garfield Unity Pantry: 529 Midland Ave, Garfield |
| Service area | Website: Atlantic, Bergen, Cape May, Cumberland, Essex, Hudson, Middlesex, Morris, Passaic, Somerset and Union counties, through 800+ partner pantries and soup kitchens. The 990 says 15 of 21 counties (difference unexplained) |
| Decision maker | Jeannie Fournier, Chief Impact Officer (program owner; leadership page re-confirmed 2026-10-28). Executive sponsor: Elizabeth McCarthy, President & CEO (joined July 2023) |
| Latest Form 990 | Tax year 2024 (FYE 6/30/2025), full 990 e-filed 2026-02-23. **Total revenue $214,145,989**; expenses $212,780,417; 379 employees; 31,344 volunteers. Direct source: https://projects.propublica.org/nonprofits/organizations/222423882/202630549349301123/full |
| Revenue vs. budget | Annual revenue is not a purchasing budget. About $110M is donated food (noncash) and about $105M is government grants; most spending is food distributed to partners. Technology purchases go through enterprise processes |

**Featured programs (official pages, read 2026-10-28)**

1. **Find Food**: ZIP-code locator for partner pantries, meal programs and distribution partners; multilingual Food Assistance Line 908-838-4831; text "FindFood" (English) or "Comida" (Spanish) to 908-224-7776. The page notes that partner hours are subject to change. https://cfbnj.org/find-foods-services/
2. **Apply for SNAP (SNAP Navigators / Resource Access Team)**: "Multi-lingual SNAP Navigators" offer free in-person or virtual SNAP application help and talk about utilities assistance and school meals; contact the Resource Access Team at 908-838-4831. The page lists documents to prepare and says to allow about 45 minutes. https://cfbnj.org/apply-for-snap/
3. **Garfield Unity Pantry**: client-choice community pantry at 529 Midland Ave, Garfield. Food shopping Mondays, Tuesdays and Fridays 9:30 AM to 2:30 PM; appointments through PlentifulApp.com (register, search "Garfield"); 973-245-9579. https://cfbnj.org/garfield-unity-pantry/

**Digital infrastructure inventory**

| Channel | What exists (verified 2026-10-28) | How the web concierge complements it |
|---|---|---|
| Locator | Find Food ZIP-code search across 800+ partners | Explains how to use the locator and what to ask a partner; sends visitors into the locator rather than reproducing partner data |
| Phone | Multilingual Food Assistance Line 908-838-4831; Hillside 908-355-3663; EHT 609-383-8843; Garfield 973-245-9579 | Names the right number for each need at every handoff |
| SMS | FindFood / Comida keywords to 908-224-7776 | Promotes the text keywords as an option for visitors on phones |
| Scheduling | Garfield appointments through PlentifulApp | Presents the published booking steps, then links to Plentiful |
| Benefits help | SNAP, WIC, School Meals, Summer EBT, TANF/GA application assistance (in person or virtual) | Explains what the service is and what to prepare; never screens eligibility |
| Multilingual | Multilingual line and teams (languages not listed); GTranslate widget for English, Spanish and Haitian Creole; Spanish SMS | Spanish answers would be validated before any claim; site languages cited as-is |
| Chat / FAQ | Large general FAQ; no website chat widget detected | Turns FAQ content into a guided conversation |
| Partners | Partner portal for agencies | Out of scope for the public demo |

**Use cases**

- [Verified] Neighbors move between several tools (locator, line, text, Plentiful, SNAP help) and three CFBNJ sites with different hours. A presentation-led concierge can explain which pathway fits, in plain language, then hand off to the existing tool.
- [Verified] Published pantry hours have differed between official pages (Egg Harbor Township, noted in the profile). A single reviewed knowledge source for the concierge would surface such conflicts for staff.
- [Hypothesis] Explaining SNAP preparation (documents, 45-minute session) before the call may make Resource Access calls more productive. Needs validation with the team.

## B. Version A: first-touch email

**Subject:** A companion to CFBNJ's Find Food tools

> Hi Jeannie,
>
> I'm Jae McKinney, founder of Divigner, an AI solutions company based in Montclair, New Jersey. We're working with New Community Corporation in Newark on a community engagement initiative.
>
> CFBNJ already helps neighbors through the Find Food locator, the Food Assistance Line and the FindFood and Comida text keywords.
>
> We've built an AI interactive avatar that acts as a 24/7 web concierge. Visitors see a human-like representative and speak with it naturally. The web concierge presents with real-time images and slides, answers questions mid-presentation, and guides people to the right service, including those tools.
>
> Picture a grandmother in Garfield at 9 PM, asking how to book a Garfield Unity Pantry appointment through Plentiful.
>
> Experience the CFBNJ Web Concierge: [DEMO LINK PENDING]
>
> Could we talk for 15 minutes next week?
>
> Jae McKinney | Founder, Divigner | Montclair, NJ | https://divigner.com

*Independent Divigner demonstration using publicly available information; not an official Community FoodBank of New Jersey service.*

Word count (Version A body, greeting through the 15-minute ask, counted with Python `len(body.split())`): **130**

## C. Version B: expanded email

**Subject:** Complementing the Find Food line with a 24/7 web concierge

> Hi Jeannie,
>
> I'm Jae McKinney, founder of Divigner, an AI solutions company based in Montclair, New Jersey. We're working with New Community Corporation in Newark on a community engagement initiative. Through that work, I've been studying how neighbors look for food help on their own, often late in the evening.
>
> CFBNJ already does more than most here. The Find Food ZIP-code locator, the multilingual Food Assistance Line and the FindFood and Comida text service give people several ways in, and your SNAP Navigators offer free in-person or virtual application help. I see a web concierge as a companion to those tools, not a replacement.
>
> We've built an AI interactive avatar that acts as a 24/7 web concierge. It is a visible, human-like representative that visitors can see and speak with naturally. The web concierge can deliver a real-time presentation using actual images, slides and verified program information, take questions in the middle of it, and adapt the walkthrough to each visitor's interests. It then guides people to the pathway you already run: the locator, the Food Assistance Line, the text keywords or the SNAP help page.
>
> Imagine a grandmother in Garfield at 9 PM. She wants to know how the Garfield Unity Pantry works and how to book a shopping appointment through Plentiful, then asks whether anyone can help her apply for SNAP. The web concierge shows the pantry's published steps on screen, answers her questions, and points her to 908-838-4831 for SNAP help.
>
> Experience the CFBNJ Web Concierge: [DEMO LINK PENDING]
>
> Would you have 15 minutes next week to talk about whether this could support your Resource Access and Find Food work?
>
> Jae McKinney | Founder, Divigner | Montclair, NJ | https://divigner.com

*Independent Divigner demonstration using publicly available information; not an official Community FoodBank of New Jersey service.*

Word count (Version B body, greeting through the 15-minute ask, counted with Python `len(body.split())`): **273**

## D. Demo package

**Personalized greeting:** "Hi, I'm the Community FoodBank of New Jersey web concierge, an independent demonstration built from CFBNJ's public website. I can help you find food near you, explain how to book the Garfield Unity Pantry and show you how CFBNJ's SNAP help works. Hours can change, so please confirm with CFBNJ at 908-838-4831. Please don't share personal or benefit details."

**Q&A scenarios**

1. **Visitor:** "I live in Newark. How do I find a food pantry near me?"
   **Answer:** "CFBNJ's Find Food tool lets you enter your ZIP code to see partner pantries, meal programs and distribution partners near you, with their addresses and hours. CFBNJ notes that partner hours can change, so it's best to call the pantry first. You can also call the multilingual Food Assistance Line at 908-838-4831, or text 'FindFood' or 'Comida' to 908-224-7776."
   **Source:** https://cfbnj.org/find-foods-services/
   **Safe next step:** Open the Find Food locator; offer the line and the text keywords.
2. **Visitor:** "¿Cómo hago una cita en el Garfield Unity Pantry?"
   **Answer (English shown; Spanish only after testing):** "The Garfield Unity Pantry is at 529 Midland Ave in Garfield. Food shopping is Mondays, Tuesdays and Fridays from 9:30 AM to 2:30 PM. To make an appointment, go to PlentifulApp.com, register as a user, then search for Garfield. The pantry's phone number is 973-245-9579."
   **Source:** https://cfbnj.org/garfield-unity-pantry/
   **Safe next step:** Link to PlentifulApp.com and the pantry phone number.
3. **Visitor:** "Can CFBNJ help me apply for SNAP?"
   **Answer:** "Yes, CFBNJ's SNAP Navigators offer free help applying, in person or virtually, and can also talk about utilities assistance and school meals. CFBNJ suggests allowing about 45 minutes and having Social Security numbers, birth dates and monthly income for the household members applying. I can't tell you whether you qualify. To get started, contact the Resource Access Team at 908-838-4831."
   **Source:** https://cfbnj.org/apply-for-snap/
   **Safe next step:** Phone handoff; no benefit or eligibility determinations; no personal data collected.

**Dynamic visual presentation walkthrough: "Three ways to find food with CFBNJ"**

| Slide / image | Spoken explanation | Likely interruption and live answer |
|---|---|---|
| 1. CFBNJ logo and map of the 11 counties served | "CFBNJ works with more than 800 partner pantries and soup kitchens. Here are three ways to find help." | "Is Essex covered?" "Yes, Essex is on CFBNJ's list of counties served." |
| 2. Screenshot of the Find Food ZIP search | "Type your ZIP code to see partners near you, with addresses and hours." | "Are the hours accurate?" "CFBNJ says partner hours can change, so call the pantry before you go." |
| 3. Phone and text card: 908-838-4831; FindFood / Comida to 908-224-7776 | "Prefer to call or text? The Food Assistance Line is multilingual, and the text service works in English or Spanish." | "Is it open now?" "Line hours aren't listed on this page, so I won't guess. You can always text." |
| 4. Garfield Unity Pantry photo, hours and Plentiful steps | "In Garfield, CFBNJ runs a client-choice pantry. You book through Plentiful." | "Do I need ID?" "The Garfield page doesn't say. The pantry can tell you at 973-245-9579." |
| 5. SNAP Navigators card | "If you'd like help with SNAP, CFBNJ's team can help you apply, for free." | "Will I get approved?" "I can't say. The state decides; CFBNJ's team can help you apply." |

**Handoff:** Open the Find Food locator, PlentifulApp.com or the SNAP page in a new tab, and display 908-838-4831.

**2 to 3 minute self-guided demo flow**

| Time | Beat |
|---|---|
| 0:00 to 0:15 | Greeting, independence disclaimer, "hours can change" note |
| 0:15 to 1:30 | Five-slide "Three ways to find food" presentation with one interruption |
| 1:30 to 2:05 | Visitor asks about Garfield; concierge shows hours and Plentiful steps |
| 2:05 to 2:35 | SNAP question; concierge lists preparation items and gives 908-838-4831 |
| 2:35 to 2:50 | Closing handoff and disclaimer |

**Languages (verified):** English; Spanish via the "Comida" SMS keyword; GTranslate widget configured for English, Spanish and Haitian Creole; the Food Assistance Line and SNAP Navigators are described as multilingual (languages not listed). The concierge's own Spanish or Creole conversation is not claimed until tested.

**Guardrails**

- Independence disclaimer; not an official CFBNJ service.
- No SNAP, WIC, TANF or pantry eligibility determinations; no nutrition or medical advice beyond quoting public pages.
- Do not reproduce partner pantry hours from memory; always send visitors to Find Food or the partner.
- Flag conflicting official information (for example, differing pantry hours) and advise calling.
- Do not collect names, addresses, Social Security numbers, income or case numbers.
- Position as a complement to the Find Food tools, the Food Assistance Line and the text keywords.

## E. Priority score (/100)

| Component (max) | Points | Rationale |
|---|---|---|
| Community engagement fit (25) | 22 | Largest public-facing anti-hunger operation in NJ; many direct neighbor channels. Two points off because existing tools already cover part of the need |
| Operational value (20) | 16 | Several tools and three sites with different hours; SNAP preparation; value depends on volumes not published |
| Financial capacity (15) | 15 | $214.1M revenue, surpluses every year |
| Demo feasibility (15) | 13 | Rich, current public pages; partner data changes often, so the demo must route to the locator |
| Montclair proximity (10) | 8 | About 25 minutes to Hillside; about 20 to Garfield |
| Decision-maker accessibility (10) | 5 | Executives verified but no published emails; 379-person organization with slower decision paths |
| Expansion potential (5) | 5 | 800+ partner agencies and the Feeding America network |
| **Total** | **84** | |

Assumptions: proximity is estimated; operational value assumes repeat navigation questions, which is not measured publicly; revenue includes donated food and pass-through grants, so it overstates discretionary capacity.

## F. Verification checklist

| Fact | Status |
|---|---|
| Jeannie Fournier, Chief Impact Officer; Elizabeth McCarthy, President & CEO | ✅ https://cfbnj.org/our-story/leadership/ (2026-10-28) |
| TY2024 990 revenue $214,145,989 | ✅ ProPublica e-file render (accessed 2026-10-28) |
| Find Food locator, 908-838-4831 multilingual line, FindFood/Comida to 908-224-7776 | ✅ find-foods-services page (2026-10-28) |
| SNAP Navigators, Resource Access Team 908-838-4831, preparation list | ✅ apply-for-snap page (2026-10-28) |
| Garfield Unity Pantry hours, Plentiful booking, 973-245-9579 | ✅ garfield-unity-pantry page (2026-10-28) |
| Hillside Mon to Fri 5:30 AM to 6 PM; EHT Mon to Fri 8 AM to 5 PM | ✅ locations page (2026-10-28) |
| Languages of the multilingual line | ⚠️ not listed |
| Egg Harbor Township pantry hours | ⚠️ locations page and FAQ disagreed in the profile check; FAQ returned 403 on 2026-10-28, not re-verified |
| Service area 11 counties (site) vs 15 (990) | ⚠️ unexplained |
| Food Assistance Line hours | ⚠️ not published on the Find Food page |

**Contact verification:** Recipient Jeannie Fournier, Chief Impact Officer, verified on the official leadership page 2026-10-28. No personal or general email is published for her or the CEO; leave the recipient email blank. Official route: contact form at https://cfbnj.org/contact-us/ or main line 908-355-3663 (no calls under outreach rules).

**Demo link status:** [DEMO LINK PENDING]. No demo has been built or tested.
