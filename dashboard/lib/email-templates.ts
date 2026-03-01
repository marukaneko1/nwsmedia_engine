type TemplateVars = {
  company_name: string;
  first_name: string;
  review_count: string;
  rating: string;
  category: string;
  city: string;
  website: string;
  issues_found: string;
};

export interface EmailTemplate {
  subject: string;
  body: string;
}

const HAS_WEBSITE_INITIAL: EmailTemplate = {
  subject: "ideas for {{ company_name }}",
  body: `Hi {{ first_name }},

I came across {{ company_name }} — {{ review_count }} reviews, {{ rating }} stars. Clearly doing something right.

I ran {{ company_name }}'s website through Google's PageSpeed analysis and had a look at how it's presenting the business. A few things stood out:

→ {{ issues_found }}
→ The site doesn't do justice to the reputation you've built — the look and feel can make a strong brand feel generic or outdated, and that's costing you trust (and revenue) from people who land on the site before calling.
→ Slow load times and a weak first impression mean you're likely losing leads to competitors whose sites feel faster and more professional.

Would it be useful if I sent over a one-page breakdown with the specific fixes? No cost, no catch — I genuinely think {{ company_name }} is leaving money on the table and that a better-performing, better-looking site would reflect the quality of work you're already doing.

All the best,
NWS MEDIA`,
};

const NO_WEBSITE_INITIAL: EmailTemplate = {
  subject: "ideas for {{ company_name }}",
  body: `Hi {{ first_name }},

I came across {{ company_name }} — {{ review_count }} reviews, {{ rating }} stars. Clearly doing something right.

I searched "{{ category }} in {{ city }}" and your Maps listing came up — but there's no website to click through to. Every one of those searchers is a potential customer who can't learn more about you, check your work, or contact you. They just move on to the next result.

The fix is straightforward and I actually mapped out what I'd build if {{ company_name }} were my client. Three things:

→ A clean one-page site optimized for "{{ category }} {{ city }}" searches
→ Click-to-call and a contact form above the fold
→ Your best reviews pulled in automatically from Google

Would it be useful if I sent over a one-page breakdown with the specific fixes? No cost, no catch — I genuinely think {{ company_name }} is leaving money on the table.

All the best,
NWS MEDIA`,
};

const DEAD_WEBSITE_INITIAL: EmailTemplate = {
  subject: "ideas for {{ company_name }}",
  body: `Hi {{ first_name }},

I came across {{ company_name }} — {{ review_count }} reviews, {{ rating }} stars. Clearly doing something right.

I just tried pulling up {{ company_name }}'s website — {{ website }} isn't loading. Every customer who finds you on Google Maps and clicks through is hitting a dead page right now.

I ran a quick diagnostic and found:

→ The site is returning errors (likely a hosting or DNS issue)
→ While it's down, Google is actively demoting your listing in search results
→ Your competitors in {{ city }} are picking up the traffic you're losing

Would it be useful if I sent over a one-page breakdown with the specific fixes? No cost, no catch — I genuinely think {{ company_name }} is leaving money on the table.

All the best,
NWS MEDIA`,
};

const FOLLOWUP_1: EmailTemplate = {
  subject: "re: {{ company_name }}",
  body: `{{ first_name }} — circling back on this.

I dug deeper into what's happening with {{ company_name }}'s site since my last note. The top-ranking {{ category }} in {{ city }} all have fast mobile-optimized sites with their Google reviews on the homepage. None of that is complicated — it's just that nobody's set it up for {{ company_name }} yet.

I can walk through everything in 10 minutes. No pitch — just what I found and what I'd prioritize first.

Here's my calendar if it's easier to just pick a time: https://calendly.com/shunya-nwsmedia/30min

Or just reply here, either works.

All the best,
NWS MEDIA`,
};

const FOLLOWUP_2: EmailTemplate = {
  subject: "quick question about {{ company_name }}",
  body: `{{ first_name }},

Genuine question — where do most of {{ company_name }}'s new customers come from right now? Referrals? Google? Word of mouth?

I ask because I recently worked with a {{ category }} in a similar spot — strong reviews, solid reputation, but a website that was actually hurting them in Google rankings. After we rebuilt it (took about 3 weeks), they went from page 2 to the top 3 results. Monthly calls doubled. No ad spend, just a site built to perform.

The issues we fixed were the same ones I flagged for {{ company_name }} — speed, mobile experience, and SEO structure.

Not trying to sell you anything with this email. Just thought it was relevant since the situations are so similar.

If you're curious what that'd look like for {{ company_name }}, happy to share.

All the best,
NWS MEDIA`,
};

const FOLLOWUP_3: EmailTemplate = {
  subject: "still interested or should I move on?",
  body: `{{ first_name }},

I've sent a couple of notes about {{ company_name }}'s website. Totally get it if you're busy — running a {{ category }} doesn't leave a lot of time for website stuff.

Just want to know which camp you're in:

A) "Yeah this is on my radar, let's talk" → grab a time here: https://calendly.com/shunya-nwsmedia/30min
B) "Not right now, maybe later" → just reply "later" and I'll check back in a few months
C) "Not interested" → reply "pass" and I'll delete your file, no hard feelings

Whichever it is — {{ review_count }} reviews at {{ rating }} stars is no joke. {{ company_name }} is clearly the real deal.

All the best,
NWS MEDIA`,
};

const FOLLOWUP_4: EmailTemplate = {
  subject: "closing {{ company_name }}'s file",
  body: `{{ first_name }},

Last email from me.

I still think {{ company_name }} is sitting on a lot of untapped potential online. The website situation is fixable and the upside is real — more calls, more visibility, less reliance on word of mouth alone.

If you ever want to revisit this, just reply to this thread. I'll still have your audit saved and can pick it up right where we left off.

All the best,
NWS MEDIA`,
};

const INITIAL_BY_TRIAGE: Record<string, EmailTemplate> = {
  HAS_WEBSITE: HAS_WEBSITE_INITIAL,
  NO_WEBSITE: NO_WEBSITE_INITIAL,
  DEAD_WEBSITE: DEAD_WEBSITE_INITIAL,
  FREE_SUBDOMAIN: HAS_WEBSITE_INITIAL,
  PAGE_BUILDER: HAS_WEBSITE_INITIAL,
};

const FOLLOWUPS: EmailTemplate[] = [
  FOLLOWUP_1,
  FOLLOWUP_2,
  FOLLOWUP_3,
  FOLLOWUP_4,
];

export const SEQUENCE_LABELS = [
  "Initial Email",
  "Follow-up #1",
  "Follow-up #2",
  "Follow-up #3",
  "Follow-up #4",
];

export function getTemplateForStep(
  triageStatus: string | null,
  stepIndex: number
): EmailTemplate {
  if (stepIndex === 0) {
    return INITIAL_BY_TRIAGE[triageStatus ?? "HAS_WEBSITE"] ?? HAS_WEBSITE_INITIAL;
  }
  return FOLLOWUPS[stepIndex - 1] ?? FOLLOWUP_1;
}

export function buildIssuesFound(lead: {
  performance_score?: number | null;
  seo_score?: number | null;
  ssl_valid?: boolean | null;
  mobile_friendly?: boolean | null;
}): string {
  const issues: string[] = [];

  if (lead.performance_score != null && lead.performance_score < 50) {
    issues.push(
      `Site speed scored ${lead.performance_score}/100 — slow loads are costing you visitors`
    );
  }
  if (lead.seo_score != null && lead.seo_score < 60) {
    issues.push(
      `SEO scored ${lead.seo_score}/100 — you're harder to find in search results than you should be`
    );
  }
  if (lead.ssl_valid === false) {
    issues.push(
      `No valid SSL certificate — browsers are flagging your site as "Not Secure"`
    );
  }
  if (lead.mobile_friendly === false) {
    issues.push(
      `Site isn't mobile-friendly — over 60% of local searches happen on phones`
    );
  }

  if (issues.length === 0) {
    issues.push(
      "A few areas where the site could be optimized for speed and local search visibility"
    );
  }

  return issues.join("\n→ ");
}

export function fillTemplate(
  template: EmailTemplate,
  vars: Partial<TemplateVars>
): EmailTemplate {
  const replace = (text: string) => {
    let result = text;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replaceAll(`{{ ${key} }}`, value ?? "");
    }
    return result;
  };

  return {
    subject: replace(template.subject),
    body: replace(template.body),
  };
}
