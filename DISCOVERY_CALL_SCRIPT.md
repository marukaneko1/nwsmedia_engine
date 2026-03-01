# NWS Media — Discovery Call Script

> For leads who replied to cold email and booked via Calendly.
> Call length: 15–20 minutes. Goal: qualify, build trust, book a proposal follow-up.

---

## Before the Call (2 minutes)

Pull up their data before dialing/joining:

- [ ] Business name, category, city
- [ ] Google Maps listing (reviews, rating, photos)
- [ ] Their website (or lack of one) — have it open in a tab
- [ ] Their audit data: triage status, performance score, SEO score, SSL, mobile, tech stack
- [ ] Their segment (ESTABLISHED or NEW_SMALL)
- [ ] Their enrichment data: email, owner name, social profiles
- [ ] Which email they replied to (initial? follow-up 2? breakup?) — tells you their temperature

**CLI quick-pull:**
```
python run.py leads --city "Houston" --limit 5
python run.py segment-stats
```

---

## The Call

### 1. Open — Build Rapport (1–2 min)

Don't pitch. Be a human first.

> "Hey [Name], thanks for jumping on — I appreciate it. How's business going? Are you guys staying busy?"

Let them talk. Listen for:
- How busy they are (budget signal)
- Whether they mention growth, slow season, competition (pain signals)
- Their energy — relaxed, rushed, skeptical?

Then set the agenda:

> "Cool. So here's what I was thinking — I want to learn a little more about [Business Name] and where you're at with your online presence. I'll share what I found in the audit, and then we can figure out if it makes sense to keep talking. Sound good?"

**Why this works:** You're framing it as a conversation, not a pitch. "Figure out if it makes sense" gives them an exit, which paradoxically makes them more open.

---

### 2. Discovery Questions (5–7 min)

Ask these in order. Let them do 70% of the talking.

**Business fundamentals:**

> "So how long has [Business Name] been around?"

> "And where do most of your customers come from right now — referrals, Google, word of mouth, something else?"

*Listen for:* If they say "mostly referrals" or "word of mouth" — that's your opening. They have no predictable online pipeline.

> "When someone does find you on Google, what usually happens? Do they call, fill out a form, just look around?"

*Listen for:* If they don't know — their website isn't tracking anything. If they say "they usually just call" — confirms the phone is their main conversion point.

**Website awareness:**

> "Have you ever looked at what comes up when you Google '[their category] in [their city]'?"

*Most will say no. This is powerful — you're about to show them something they've never seen.*

> "What's your take on your current website? Is it something you're happy with, or has it been bugging you?"

*For NO_WEBSITE leads:* "Have you thought about getting a website, or has it just not been a priority?"

*Listen for:* "I've been meaning to" = warm. "My nephew built it" = they know it's bad. "It works fine" = you need to show evidence.

**Goals and timeline:**

> "If you could wave a magic wand and your online presence was exactly where you wanted it — what would that look like for [Business Name]?"

> "Is getting more customers from Google something that's on your radar for this year, or is it more of a down-the-road thing?"

*This qualifies timeline. "This year" = ready. "Down the road" = nurture, don't push.*

---

### 3. Present the Audit Findings (3–5 min)

Transition naturally from their answers:

> "So this is exactly why I reached out. Let me share what I found when I looked at [Business Name]."

**If they have a website — share the data:**

> "I ran your site through the same tool Google uses to rank websites. Here's what came back:"

Walk through 2–3 issues max. Don't overwhelm. Pick the ones most relevant to what they just told you.

| If they said... | Lead with this issue |
|---|---|
| "Most customers come from referrals" | "Your SEO score is [X]/100 — that's why Google isn't sending you traffic. Your competitors are getting those calls instead." |
| "I think our website is okay" | "Your speed score is [X]/100. For reference, Google penalizes anything under 50. Half your mobile visitors are leaving before the page loads." |
| "We're not showing up on Google" | "Your site isn't optimized for the keywords your customers are typing — '[category] in [city]'. That's a fixable problem." |
| "Customers say our site looks outdated" | "Your site still shows © [year] and is built on [tech]. A modern site would load 3x faster and rank significantly better." |

**If they have NO website:**

> "Right now when someone searches '[category] in [city]' — your competitors with websites are getting that traffic. You show up on Maps, but there's nothing to click through to. Every one of those searches is a potential customer who can't learn about your work, see your reviews, or contact you. They just move on."

**Key:** Always tie it back to money/customers lost, not technical jargon.

> "The good news is — none of this is complicated to fix. And with your [X] reviews and [rating] stars, the hard part is already done. You just need a website that matches the quality of your business."

---

### 4. Gauge Interest + Soft Close (2–3 min)

Don't pitch pricing yet. First, check temperature:

> "Does any of that surprise you, or is it kind of what you expected?"

Then:

> "So here's what I'd suggest as a next step — I can put together a specific plan for [Business Name]. What that site would look like, what it would cost, and a realistic timeline. No obligation, just so you have something concrete to look at."

> "Would that be helpful?"

**If yes:**

> "Great. I'll have that over to you by [2–3 days]. It'll include everything — the design direction, what we'd build, the investment, and a timeline. We can hop on another quick call to walk through it, or you can just review it on your own — whatever you prefer."

**If they hesitate:**

> "Totally fair. Tell you what — I'll send over the one-page audit report so you have the data in front of you. No commitment. And if you want to talk about it later, you know where to find me."

---

### 5. Close the Call (1 min)

> "Really appreciate you taking the time, [Name]. I'll get that [proposal / audit report] over to you by [day]. If any questions come up in the meantime, just shoot me an email or text — my number's [phone]."

> "Good talking to you. Go crush it."

---

## Post-Call (Immediately After)

- [ ] Move card in CRM: Lead → Meeting (tag with segment: ESTABLISHED or NEW_SMALL)
- [ ] Note their key pain points, budget signals, and timeline
- [ ] Generate their audit PDF if not already done: `python run.py generate-pdfs --min-score 40 --limit 1`
- [ ] Send the PDF or proposal within the timeline you promised

---

## Common Questions They'll Ask (+ How to Answer)

### "How much does a website cost?"

**Don't give a number immediately.** Anchor to value first.

> "It depends on what we're building — a simple 5-page site is different from a 20-page site with booking integration. For businesses like yours, projects typically range from **$3,500 to $8,000** for a full custom site that's built to rank on Google."

> "But here's how I think about it — if your site brings in even 2–3 extra customers a month, and your average job is worth [their typical project value], it pays for itself in the first month or two."

**If they push back on price:**

> "I get it. There are cheaper options out there — Wix, Squarespace, a freelancer on Fiverr. The difference is those solutions don't come with local SEO optimization, speed tuning, and ongoing support. You're not just buying a website — you're buying the customers that website brings in."

---

### "Why should I go with you over someone else?"

> "Fair question. Three things: One, I already know your business — I've audited your site, I know your market, and I know what your competitors are doing. Two, everything I build is optimized for Google from day one — not just pretty, but built to rank. And three, I work exclusively with [contractors / dentists / med spas] in markets like [their city], so I know exactly what works in your space."

---

### "Can't I just build it myself on Wix/Squarespace?"

> "You absolutely can. And honestly, for some businesses that's fine. But here's the thing — those platforms have real limitations when it comes to speed and SEO. Google's own data shows that page builders score 30–40% lower on performance than custom sites. If showing up on Google is important to you, a custom site will get you there significantly faster."

> "Plus — your time has value. Every hour you spend fighting a website builder is an hour you're not spending on [their actual business]. That's the real cost."

---

### "I already have a website. Why do I need a new one?"

> "Your site isn't broken — it's just not working for you. Think of it like a storefront: it's open, but the sign is faded, the door sticks, and half the lights are out. Customers still come in, but a lot of them walk right past."

> "The data backs this up — your speed score is [X]/100, your SEO is [X]/100, and Google is ranking competitors with worse reviews above you. A rebuild doesn't mean starting from scratch — it means making what you have actually perform."

---

### "How long does it take?"

> "Typical timeline is **3–4 weeks** from kickoff to launch. First week is design and content gathering, second and third week is building, and the fourth week is revisions and launch. I'll keep you in the loop the whole way — you'll see the site before it goes live and can request changes."

---

### "What do you need from me?"

> "Very little, honestly. I'll need your logo, any photos of your work you want showcased, and about 30 minutes of your time for a content call where I learn how you describe your services. Everything else — writing, design, SEO, hosting setup — I handle."

---

### "Do you offer a payment plan?"

> "Yep. Standard structure is **50% upfront to start, 50% at launch**. For larger projects, I can break it into three payments. The goal is to make it workable for you."

---

### "What if I don't like it?"

> "You'll see the design before anything goes live. We do a round of revisions included in every project — colors, layout, text, whatever you want changed. I don't launch anything you're not 100% happy with."

---

### "Do you handle hosting and maintenance?"

> "I can, yeah. Hosting is included for the first year. After that it's [your rate — e.g. $50/month] which covers hosting, security updates, backups, and small edits. Or if you prefer to manage it yourself, I'll set everything up and hand it over."

---

### "What about SEO? Will I show up on Google?"

> "That's built into every site I create. I optimize for the keywords your customers are actually searching — things like '[category] in [city]' and '[category] near me.' I also set up your Google Business Profile connection, add schema markup so Google understands your business, and make sure the site loads fast on mobile. Most clients see ranking improvements within 6–8 weeks."

---

### "I had a bad experience with a web designer before."

> "I hear that a lot, honestly. And I'm sorry that happened. Here's how I'm different — you'll have my cell number. I respond same day. You see everything before it launches. And I don't disappear after the project is done — I'm here for updates, questions, whatever you need."

> "Also, I'll send you the audit report upfront so you can see the quality of my work before you commit to anything."

---

### "Let me think about it."

**Don't push. But do create a timeline.**

> "Absolutely, take your time. One thing I'd keep in mind — every day the current situation stays the same, you're losing those potential customers to competitors who already have their site dialed in. But no pressure. I'll send you the proposal and the audit, and if you have questions after you've had a chance to look, just reach out."

> "Is there anything specific you'd want to think through? I might be able to help answer it now."

---

### "Can you send me some examples of your work?"

> "For sure. I'll include a few examples in the proposal — sites I've built for similar [category] businesses. You'll be able to see the design style, how they load on mobile, and where they rank on Google."

---

### "I need to talk to my [partner / spouse / business partner] first."

> "Totally understand. Want me to send the proposal to both of you so they have the full picture? That way when you do talk about it, they'll have the same context you do."

*This prevents the game of telephone where your prospect tries to re-sell the value to their partner from memory.*

---

## Red Flags — When to Walk Away

Not every lead is a good fit. Watch for:

| Red flag | What it means |
|---|---|
| "Can you do it for $500?" | They don't value professional work. Don't negotiate down — you'll resent the project. |
| Won't commit to any timeline | They're tire-kicking. Send the audit, move on. |
| Want to "design it themselves" and have you just build it | Scope creep nightmare. Politely decline or charge hourly. |
| Hostile or disrespectful on the call | Life's too short. Thank them and end the call. |
| Business has <5 reviews and no clear revenue | May not have budget. Offer a simpler package or refer to a template solution. |

---

## Call Cheat Sheet (Keep Open During Calls)

```
OPEN:   "How's business? Staying busy?"
AGENDA: "I want to learn about [Business], share what I found, see if it makes sense."
ASK:    Where customers come from? Happy with site? Goals for this year?
SHOW:   2-3 audit findings → tie to money lost
CHECK:  "Does that surprise you?"
CLOSE:  "Want me to put together a specific plan?"
AFTER:  CRM update → send PDF/proposal in 2-3 days
```
