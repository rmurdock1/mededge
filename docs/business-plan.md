# PracticeFlow Business Plan
## Prior Authorization Automation for Specialty Medical Practices

---

## 1. The business in one paragraph

PracticeFlow automates prior authorization for small and mid-size specialty medical practices, starting with dermatology. We connect to practice management systems like ModMed, instantly flag which patients need PA, assemble the required documentation using AI, and track every authorization in one dashboard. Practices pay $149-499/month per provider. The product replaces 12+ hours of weekly staff time and unlocks revenue from payers that practices currently avoid. The exit path is acquisition by a PM/EHR vendor, clearinghouse, or RCM company within 3-5 years.

---

## 2. Revenue model

### Pricing structure (three tiers, per provider per month)

**Starter: $149/mo per provider**
- PA requirement auto-detection
- Payer-specific documentation checklists
- Status tracking dashboard
- Deadline and expiration alerts
- Target customer: solo practitioners and small practices testing the waters

**Growth: $299/mo per provider**
- Everything in Starter
- AI-powered documentation assembly
- Auto-pull clinical data from PM
- Missing information flags before submission
- Payer rule change alerts
- Dedicated onboarding
- Target customer: 2-5 provider practices with meaningful PA volume

**Practice Pro: $499/mo per provider**
- Everything in Growth
- Denial tracking and appeal support
- Revenue impact reporting
- After-hours AI call assistant
- Weekend cancellation slot recovery
- Priority support
- Target customer: larger practices wanting full operations layer

### Revenue math

Scenario 1: Conservative (Year 1)
- 10 practices, average 3 providers each = 30 providers
- Average tier: Growth at $299/mo
- Monthly recurring revenue: $8,970
- Annual recurring revenue: $107,640

Scenario 2: Moderate (Year 2)
- 40 practices, average 3 providers each = 120 providers
- Average tier: mixed at $275/mo
- Monthly recurring revenue: $33,000
- Annual recurring revenue: $396,000

Scenario 3: Growth (Year 3)
- 150 practices across multiple specialties = 500 providers
- Average tier: mixed at $300/mo
- Monthly recurring revenue: $150,000
- Annual recurring revenue: $1,800,000

### Why these numbers are realistic
- Toby validated the pricing range as "cheaper than hiring someone"
- A dedicated PA staff member costs $40,000-55,000/year
- For a 3-provider practice, that's roughly $1,100-1,500/mo per provider
- Our pricing at $149-499 is 30-50% of the human alternative
- The revenue expansion angle (accepting payers you currently avoid) adds ROI on top of the cost savings

---

## 3. Cost structure

### Phase 1: Pre-revenue (Months 1-3)

| Category | Monthly | One-time | Notes |
|----------|---------|----------|-------|
| Vercel hosting | $0-20 | - | Free tier covers early development |
| Supabase Pro | $25 | - | Required for HIPAA (BAA) |
| Domain (practiceflow.ai) | - | $30-50 | Annual registration |
| Anthropic API | $0-50 | - | Likely covered by employer |
| ModMed sandbox | $0 | - | Free for approved vendors |
| Freelance dev help | - | $2,000-4,000 | ModMed API integration assist |
| HIPAA compliance review | - | $2,000-5,000 | One-time assessment before going live |
| **Monthly total** | **$50-95** | | |
| **One-time total** | | **$4,000-9,050** | |

### Phase 2: Pilot with Toby (Months 4-6)

| Category | Monthly | Notes |
|----------|---------|-------|
| Infrastructure (Vercel + Supabase + misc) | $75-150 | Scaling slightly with real data |
| Anthropic API usage | $50-100 | Real PA document processing |
| Error monitoring (Sentry free tier) | $0 | |
| Email service (Resend free tier) | $0 | For alerts and notifications |
| Your time | Priceless | Evenings and weekends, 15-20 hrs/week |
| **Monthly total** | **$125-250** | |

### Phase 3: First 10 customers (Months 7-12)

| Category | Monthly | Notes |
|----------|---------|-------|
| Infrastructure | $200-400 | More practices, more data |
| Anthropic API | $100-300 | Scales with PA volume |
| Keragon middleware (if needed) | $200-500 | Only if direct API isn't enough |
| SOC 2 prep | $500-1,000 | Amortized over 12 months ($6K-12K total) |
| Legal (terms, privacy policy, BAA template) | $200-400 | Amortized one-time cost |
| Marketing/sales | $200-500 | Mostly your dad's network, minimal spend |
| **Monthly total** | **$1,400-3,100** | |
| **Expected revenue (10 practices)** | **$8,970** | At average $299/provider |
| **Monthly margin** | **$5,870-7,570** | Profitable from month 7-8 |

### The big picture on costs

Total investment to reach first paying customer: $4,000-10,000 plus your time
Total investment to reach profitability: $15,000-25,000 plus your time
Break-even point: approximately practice #4-5 (depending on tier mix)

This is extremely lean for a healthcare SaaS. Most health tech startups spend $50K-150K before they see a dollar of revenue. Your unfair advantages: AI coding tools slash development time by 60-70%, your design partner (Toby) is free validation, and your dad's network means near-zero customer acquisition cost for the first 10-20 practices.

---

## 4. Timeline to revenue

### Month 1-2: Build foundation and Revenue Radar sales tool
- Set up development environment (Next.js, Supabase, Vercel)
- Apply for ModMed sandbox
- Build authentication, database, core UI
- Research payer rules for top 5 payers
- Begin payer rules database (manual curation)
- **Build Revenue Radar prototype**: download CMS/Census data, normalize, build ZIP code lookup that shows payer opportunity per practice

### Month 3-4: Build the core PA product
- ModMed sandbox integration
- PA requirement detection logic
- Documentation checklist engine
- Connect Claude API for smart document assembly
- PA tracking dashboard
- **Use Revenue Radar in sales conversations**: generate reports for prospects via dad's network before the product is even live

### Month 5-6: Pilot with Toby
- Onboard Plaza Park Dermatology
- Real-world testing with real patients and real payers
- Iterate based on daily feedback
- HIPAA compliance review
- Fix everything that breaks (it will break)
- **Begin collecting PA outcome data** for Payer Intelligence Network (passive, from day one)

### Month 7: Production readiness
- ModMed production API approval (requires demo and technical review)
- Security hardening, terms of service, privacy policy, BAA template
- Billing integration (Stripe)

### Month 8: First revenue
- Toby becomes paying customer #1
- Begin outreach to dad's network (warm intros, lead with Revenue Radar reports)
- Refine onboarding process based on pilot learnings

### Month 9-12: Scale to 10 practices and build the moat
- 2-3 new practices per month through dad's network
- Expand payer rules database based on real usage
- **Build Auto-Appeal Engine v1**: AI-generated appeal letters, manual submission, outcome tracking
- **Revenue Radar becomes a product feature** in the dashboard
- Payer Intelligence Network starts surfacing actionable patterns (~200+ PA outcomes)
- Gather case study data from Toby for marketing

### Month 12-18: Expand beyond derm
- Identify next specialty (rheumatology or gastro, both heavy PA users)
- Adapt payer rules engine for new specialty
- **Auto-Appeal Engine v2**: template library, auto-detect denial reasons, payer-specific strategies
- **Payer Intelligence insights** become a marketing asset (publish aggregated data)
- Add second PM integration (Nextech) if demand warrants

### Month 18-24: Position for acquisition
- Target: 50-100 paying practices, $300K-600K ARR
- Publish case studies showing ROI including revenue recovered via auto-appeals
- Apply to ModMed marketplace (official listing)
- **Payer Intelligence Network** is now a genuine data moat (1,000+ PA outcomes)
- Revenue Radar data powers a published annual "Payer Access Report"
- Reach out to potential acquirers or raise small seed round

---

## 5. Unit economics

### Per-practice economics (at Growth tier, 3 providers)

Monthly revenue per practice: $897 (3 x $299)
Estimated cost to serve per practice:
- Infrastructure share: ~$15/mo
- API costs (Claude for doc assembly): ~$10-20/mo
- Support time: ~1 hr/mo at $0 (your time initially)
- Total cost to serve: ~$25-35/mo

Gross margin per practice: approximately 96%
Customer lifetime (healthcare SaaS median retention is ~92% annually): ~36 months
Lifetime value per practice: approximately $28,000
Customer acquisition cost (via dad's network): approximately $0-200

LTV:CAC ratio: 140:1 or better

These are exceptional unit economics. Healthcare SaaS typically runs 80-90% gross margins, and customer acquisition through warm referral networks is the cheapest channel in existence. This is what makes bootstrapping viable.

### Churn risk
Healthcare SaaS has higher revenue churn than other verticals (industry median ~12.5% annually). The main churn triggers for us would be: practice gets acquired by PE (they switch to the PE platform's tools), practice switches PM systems (we'd need to support the new PM), or the PA problem gets solved by the PM vendor natively (ModMed builds it themselves). Mitigation: the payer intelligence layer and multi-specialty expansion create switching costs that increase over time.

---

## 6. Three features that build the moat

These are not nice-to-haves. They are the reason a competitor can't just copy our PA workflow and win. Each one grows in value over time, compounds with usage, and connects directly to the core PA product.

### Feature 1: Revenue Opportunity Radar

Shows each practice exactly how much revenue they're missing by not accepting certain payers in their area.

How it works: We combine free public data from CMS (marketplace enrollment by ZIP code, issuer-level enrollment by county) with Census Bureau SAHIE (county-level insurance coverage estimates) and CMS Provider Enrollment Data (how many dermatologists accept each payer per ZIP). Given a practice's ZIP code and their current payer list, we calculate the gap: "There are approximately 11,000 UHC members in your county. 42 dermatologists accept UHC locally. You don't. Estimated opportunity: $1,500-3,000/month."

Why it matters: This reframes PracticeFlow from "save time on PA" to "make more money by accepting payers you've been avoiding." That's a fundamentally different sales conversation. No other PA tool does this.

Build difficulty: Medium. All data is free and public. Requires downloading, normalizing, and joining CMS and Census CSV files. Can prototype a working version in 1-2 weeks.

Strategic advantage: We can use this as a sales tool BEFORE the product is built. Walk into a pitch meeting, show a practice their revenue gap, and close them on PracticeFlow as the solution. Revenue Radar also becomes a marketing tool: publish "State of Dermatology Payer Access" reports using aggregated data to generate PR and inbound interest.

### Feature 2: Auto-Appeal Engine

When a PA gets denied, PracticeFlow auto-generates a tailored appeal letter using AI, addresses the specific denial reason, attaches relevant documentation, and prepares it for staff review and submission.

How it works: The system reads the denial reason (missing documentation, medical necessity not established, step therapy not completed, etc.), cross-references the patient's clinical data from the PM, and uses the Claude API to draft an appeal letter that cites the payer's own coverage policy and addresses the denial head-on. Staff reviews, edits if needed, clicks approve, and submits.

Why it matters: Over 80% of PA denials are overturned on appeal, but fewer than 12% are ever appealed because nobody has time to write the letters. Each successful appeal recovers $200-2,000+. If we recover even 5 denied claims per provider per month at an average of $400 each, that's $2,000/month the practice wasn't getting before. This feature literally pays for the subscription.

Build difficulty: Medium-high for v1. The letter generation itself is a well-structured prompt engineering task. The harder parts are structuring denial reasons from PM data, knowing each payer's appeal submission requirements, and tracking outcomes. Start with manual denial entry and manual submission, automate later.

Competitive context: Hathr.AI sells AI Medicare appeal letters for $45/month. NYX Health AI offers automated denial appeals. These prove market demand exists but they target large health systems, not small practices. We own this for the specialty practice segment.

### Feature 3: Payer Intelligence Network

An anonymized, aggregated database of PA outcomes across all PracticeFlow practices. Every PA processed feeds the network. Over time, patterns emerge that no single practice could ever see on their own.

How it works: Every time a PA is submitted through PracticeFlow, we record (anonymized, no patient data): payer, plan type, procedure, what documentation was included, outcome (approved/denied), denial reason if denied, and appeal outcome if appealed. After 100-200 PAs, patterns start appearing. After 1,000+, it becomes a genuine data asset.

Example insight: "Across our network, Aetna approves 92% of Dupixent PA requests when BSA (body surface area) photos are included in the initial submission. Without photos, approval drops to 61%. Your current submission for this patient is missing BSA documentation."

Why it matters: This is a classic network effect moat. Every new customer makes the data better for every existing customer. The intelligence layer gets smarter, faster, and more valuable over time. An acquirer isn't just buying software; they're buying a proprietary dataset that took years and thousands of real PA interactions to build.

Build difficulty: Low to start. It's a database table (pa_outcomes) that records anonymized outcomes. The analysis layer on top (using AI to surface actionable insights) comes later. The hardest part is getting enough volume to make insights statistically meaningful, which is a customer acquisition problem, not a technical one.

---

## 7. What makes this attractive to acquirers

### The acquisition thesis in detail

**Why someone would buy PracticeFlow:**

1. Payer Intelligence Network: A proprietary dataset of anonymized PA outcomes across hundreds of practices and thousands of submissions. This data takes years and massive transaction volume to build. It cannot be replicated quickly. It is the single most defensible asset in the company.

2. Revenue Opportunity Radar: A unique growth-focused layer that no PA competitor offers. It turns PracticeFlow from a cost-savings tool into a revenue expansion engine. Acquirers get a built-in upsell mechanism for their existing customer base.

3. Auto-Appeal Engine with proven recovery data: A working system that generates appeal letters and tracks revenue recovered. The historical data showing "PracticeFlow recovers X% of denied claims" is a powerful sales proof point for the acquirer.

4. Payer rules database: A continuously-updated dataset of what every payer requires for every PA scenario across specialties. Combined with the intelligence network, this is hard to replicate.

5. PM integrations already built: The hard engineering work of connecting to ModMed, Nextech, etc. is done. The acquirer gets plug-and-play distribution to their existing customer base.

6. Multi-specialty architecture: The buyer isn't acquiring a derm-only tool. They're buying an engine that works for every specialty where PA is a pain point.

7. Regulatory tailwind: CMS-0057-F creates mandatory demand for electronic PA. A working product positioned ahead of this wave is strategically valuable.

### Potential acquirers and what they'd pay

| Buyer type | Examples | Why they'd buy | Likely range |
|------------|----------|----------------|-------------|
| PM/EHR vendors | ModMed, Nextech, NextGen | Add PA automation to their platform natively | 4-8x ARR |
| Clearinghouses | Availity, Change Healthcare | Complete the pre-claim workflow | 5-10x ARR |
| RCM companies | R1 RCM, Athelas, Assembly | Bolt onto existing revenue cycle services | 3-6x ARR |
| PE practice platforms | U.S. Dermatology Partners, etc. | Operational efficiency across all portfolio practices | 4-7x ARR |

### What this means in real numbers

At $500K ARR with a 5x multiple: $2.5M acquisition
At $1M ARR with a 6x multiple: $6M acquisition
At $2M ARR with a 7x multiple: $14M acquisition

SaaS Capital data shows bootstrapped SaaS companies trade at a median of 4.8x ARR. Healthcare vertical SaaS with strong retention can command premiums. The payer rules database as a unique data asset could push multiples higher.

---

## 8. Risks to the business model

### Revenue risks
- Pricing pressure if competitors enter the small-practice PA space
- Practices canceling because ModMed or their PM adds basic PA features
- Longer-than-expected sales cycles (healthcare is notoriously slow to buy)

### Cost risks
- SOC 2 audit costs higher than expected ($20K-50K is the range, we budgeted low)
- ModMed API changes or pricing that increases integration costs
- HIPAA incident requiring legal response (insurance helps, but it's still disruptive)

### Execution risks
- Solo founder bandwidth limits growth velocity
- Domain expertise gap leads to product decisions that miss the mark
- Payer rules change faster than we can keep the database current

### Mitigation strategy
- Keep the burn rate extremely low until product-market fit is undeniable
- Stay close to Toby and early customers for continuous reality checks
- Build the payer rules engine to be updateable by non-technical staff
- Consider bringing in a part-time co-founder with healthcare ops experience after reaching $10K MRR
- Purchase HIPAA breach insurance before going live ($1,000-3,000/year)

---

## 9. Investment summary

### What you need to invest

| Phase | Duration | Cash needed | Your time |
|-------|----------|-------------|-----------|
| Build MVP | Months 1-4 | $4,000-9,000 | 15-20 hrs/week |
| Pilot | Months 5-6 | $250-500 | 15-20 hrs/week |
| First customers | Months 7-12 | $2,000-5,000 | 10-15 hrs/week |
| **Total to revenue** | **8 months** | **$6,250-14,500** | **~800 hours** |

### What you get back

- A working SaaS product with paying customers
- A proprietary payer rules database that grows with usage
- A Payer Intelligence Network (anonymized PA outcome data) that compounds in value with every customer
- An Auto-Appeal Engine recovering revenue from denied PAs that practices currently leave on the table
- A Revenue Opportunity Radar that doubles as both a product feature and a sales tool
- PM integrations that took months to build and test
- A customer base generating $5,000-10,000/mo in recurring revenue by month 12
- A product positioned for acquisition within 3-5 years at a multiple of annual revenue

### The honest question

Can you invest $6,000-15,000 and 800 hours over 12 months while keeping your day job and PM consulting LLC running?

If yes, the risk/reward ratio here is genuinely strong. Your downside is capped (you lose the cash and time). Your upside is uncapped (acquisition at multiples of ARR). And unlike most startup bets, you have a validated customer, a built-in distribution channel, and infrastructure costs under $300/month.

---

## 10. Immediate next steps (this week)

1. Apply for ModMed API sandbox access at portal.api.modmed.com
2. Register domain (practiceflow.ai or practiceflow.health)
3. Set up GitHub repo (private) with CLAUDE.md and agent docs
4. Ask Toby: "What are your top 5 payers and what procedures trigger PA most often?"
5. Download CMS Marketplace PUFs and Census SAHIE data for Revenue Radar prototype
6. Set up Cowork project folder on Windows machine with MVP scope doc
7. Start Sprint 1: Next.js project setup, Supabase auth, database schema

The plan is set. The moat features are defined. Revenue Radar gives us a sales tool before the product even exists. Time to build.
