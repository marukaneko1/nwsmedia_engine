export type ContentBlock =
  | { type: 'text'; content: string }
  | { type: 'heading'; content: string }
  | { type: 'subheading'; content: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'callout'; content: string; variant: 'info' | 'warning' | 'tip' | 'important' }
  | { type: 'script'; label: string; content: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'comparison'; doItems: string[]; dontItems: string[] };

export type QuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export type Slide = {
  title: string;
  subtitle?: string;
  content: ContentBlock[];
};

export type Module = {
  id: string;
  title: string;
  description: string;
  icon: string;
  slides: Slide[];
  quiz: QuizQuestion[];
};

export type Course = {
  id: string;
  title: string;
  description: string;
  modules: Module[];
};

export const VA_TRAINING_COURSE: Course = {
  id: 'va-cold-caller-onboarding',
  title: 'VA Cold Caller — Complete Onboarding',
  description: 'Everything you need to know about NWS Media, our services, and how to book discovery calls.',
  modules: [
    // ────────────────────────────────────────────────────────────
    // MODULE 1: Welcome to NWS Media
    // ────────────────────────────────────────────────────────────
    {
      id: 'welcome',
      title: 'Welcome to NWS Media',
      description: 'Who we are, what we do, and our mission',
      icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5',
      slides: [
        {
          title: 'About NWS Media',
          subtitle: 'The company you now represent',
          content: [
            { type: 'text', content: 'NWS Media LLC is a web and technology agency headquartered in Long Island City, New York. Founded in 2026, we engineer digital experiences that convert — giving service-based businesses the online presence, software infrastructure, and lead generation systems they need to dominate their markets.' },
            { type: 'callout', content: '"We don\'t build websites. We build revenue engines."', variant: 'important' },
            { type: 'table', headers: ['Detail', 'Info'], rows: [
              ['Legal Name', 'NWS Media LLC'],
              ['Founded', '2026'],
              ['Headquarters', 'Long Island City, New York'],
              ['Service Area', 'United States (National)'],
              ['Website', 'nwsmedia.com'],
              ['Industry', 'Web Design, Software Development, Digital Marketing'],
            ]},
          ],
        },
        {
          title: 'Our Vision & Values',
          subtitle: 'What drives everything we do',
          content: [
            { type: 'text', content: 'Our vision is to become the default technology partner for service-based businesses across the United States — the firm that owners call when they\'re ready to stop blending in and start competing at a higher level.' },
            { type: 'heading', content: 'Core Values' },
            { type: 'bullets', items: [
              'Craft Over Templates — Every deliverable is built from scratch. AI accelerates production, never replaces the work.',
              'Evidence Over Promises — We audit before we pitch. We show data before we ask for money.',
              'Outcomes Over Outputs — A beautiful website that doesn\'t rank or convert is a failure. We measure success in leads, calls, and revenue.',
              'Speed With Substance — We ship fast without cutting corners. Custom code, real SEO, proper engineering — delivered in weeks, not months.',
              'Owner-Operator Mentality — Every client gets direct access to the people doing the work. No layers, no hand-offs.',
            ]},
            { type: 'callout', content: 'Company tagline: "Limitless Creation — We Build What You Imagine."', variant: 'info' },
          ],
        },
        {
          title: 'Who We Serve',
          subtitle: 'Our three primary verticals',
          content: [
            { type: 'text', content: 'NWS focuses on service-based businesses where most competitors are still running outdated websites. A well-built, modern web presence is a genuine competitive advantage in these verticals.' },
            { type: 'heading', content: 'Special Trade / Contractors' },
            { type: 'text', content: 'HVAC, plumbing, electrical, roofing, general contractors, landscaping, painting. High job values ($2K–$25K+), rely heavily on local search, and overwhelmingly have outdated or nonexistent websites.' },
            { type: 'heading', content: 'Medical / Healthcare' },
            { type: 'text', content: 'Dental practices, med spas, dermatology, chiropractic, cosmetic surgery. High lifetime patient value ($5K–$50K+), strong review profiles, and a market where visual brand quality directly impacts trust.' },
            { type: 'heading', content: 'Medium-Sized Businesses' },
            { type: 'text', content: 'Companies with established revenue that have outgrown their DIY or freelancer-built websites. They need complex builds — multi-location SEO, booking integrations, client portals, or custom software.' },
          ],
        },
        {
          title: 'Leadership & Team Structure',
          content: [
            { type: 'text', content: 'NWS operates with a lean, high-output team. Leadership handles strategy, engineering, and client relationships directly.' },
            { type: 'table', headers: ['Role', 'Responsibilities'], rows: [
              ['Founder & CEO — Maru Kaneko', 'Vision, product architecture, engineering, client strategy, business development'],
              ['COO — Shunya Obata', 'Operations, team management, process optimization, delivery oversight'],
              ['Sales Representatives (10)', 'Outbound calling, lead qualification, discovery calls, pipeline management'],
              ['Marketing Specialist (1)', 'Meta Ads, content strategy, social media, campaign management'],
            ]},
            { type: 'callout', content: 'NWS operates on an owner-operator model. The founders are directly involved in engineering and client-facing work — not sitting behind account managers. This ensures senior-level execution on every project.', variant: 'info' },
          ],
        },
      ],
      quiz: [
        {
          question: 'Where is NWS Media headquartered?',
          options: ['Houston, Texas', 'Long Island City, New York', 'Los Angeles, California', 'Miami, Florida'],
          correctIndex: 1,
          explanation: 'NWS Media LLC is headquartered in Long Island City, New York.',
        },
        {
          question: 'What does NWS Media\'s mission statement focus on?',
          options: ['Building the cheapest websites possible', 'Engineering digital experiences that convert and building revenue engines', 'Creating social media content for businesses', 'Providing IT support services'],
          correctIndex: 1,
          explanation: 'NWS Media\'s mission is "to engineer digital experiences that convert — giving service-based businesses the online presence, software infrastructure, and lead generation systems they need to dominate their markets."',
        },
        {
          question: 'Which of these is NOT one of NWS Media\'s core values?',
          options: ['Craft Over Templates', 'Evidence Over Promises', 'Lowest Price Guaranteed', 'Speed With Substance'],
          correctIndex: 2,
          explanation: 'NWS Media never competes on being the cheapest. The core values are: Craft Over Templates, Evidence Over Promises, Outcomes Over Outputs, Speed With Substance, and Owner-Operator Mentality.',
        },
        {
          question: 'Which are NWS Media\'s three primary verticals?',
          options: ['Restaurants, Retail, Real Estate', 'Contractors, Medical/Healthcare, Medium-Sized Businesses', 'Tech Startups, E-commerce, SaaS', 'Law Firms, Banks, Insurance'],
          correctIndex: 1,
          explanation: 'NWS focuses on special trade contractors, medical/healthcare practices, and medium-sized businesses that have outgrown DIY websites.',
        },
      ],
    },

    // ────────────────────────────────────────────────────────────
    // MODULE 2: Our Services
    // ────────────────────────────────────────────────────────────
    {
      id: 'services',
      title: 'What We Build',
      description: 'Our full service catalog and technology stack',
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
      slides: [
        {
          title: 'Luxury Custom Websites',
          subtitle: 'Not templates — hand-built, scroll-driven, immersive',
          content: [
            { type: 'text', content: 'Every site is designed in Figma and built from scratch in Next.js with React — no templates, no WordPress themes, no page builders. The output is a site that looks, feels, and performs at a level that off-the-shelf tools cannot replicate.' },
            { type: 'heading', content: 'What We Deliver' },
            { type: 'bullets', items: [
              'Custom page layouts with hand-built components',
              'GSAP scroll-triggered animations and micro-interactions',
              'Three.js 3D elements where appropriate',
              'Mobile-first responsive design across all breakpoints',
              'Core Web Vitals optimization (speed, LCP, CLS, FID)',
              'SEO-optimized markup, meta tags, and schema from day one',
            ]},
            { type: 'callout', content: 'When talking to prospects, never say "we build websites." Say "we build revenue engines" or "we build sites that rank and convert."', variant: 'tip' },
          ],
        },
        {
          title: 'Software, Lead Gen & SEO',
          subtitle: 'The full stack that sets us apart',
          content: [
            { type: 'heading', content: 'Custom Software' },
            { type: 'bullets', items: [
              'AI-powered voice agents for inbound call handling',
              'Custom CRM dashboards for pipeline management',
              'Booking and intake form systems with Stripe payment integration',
              'Client portals with real-time project tracking',
            ]},
            { type: 'heading', content: 'Lead Generation Engines' },
            { type: 'text', content: 'AI-powered systems that crawl Google Maps, Craigslist, and directories to produce qualified, CRM-ready prospect lists — scored, segmented, and ready for outreach.' },
            { type: 'heading', content: 'Local SEO & Brand Identity' },
            { type: 'text', content: 'SEO is not an add-on — it\'s built into the engineering process from day one. Every site ships with keyword-optimized content, Google Business Profile integration, schema markup, and mobile performance tuning.' },
            { type: 'heading', content: 'Production Video (Motion Graphics)' },
            { type: 'text', content: 'Polished screen-recorded or animated website walkthroughs used in sales pitches, social media, and client presentations. All animation-based — no camera crews.' },
          ],
        },
        {
          title: 'Our Technology Stack',
          subtitle: 'Modern, production-grade — no legacy, no page builders',
          content: [
            { type: 'table', headers: ['Category', 'Technologies'], rows: [
              ['Frontend', 'React, Next.js, TypeScript'],
              ['Styling & UI', 'Tailwind CSS, Framer Motion'],
              ['Animation', 'GSAP (GreenSock), Three.js'],
              ['Backend', 'Node.js, Python, GraphQL'],
              ['Database', 'PostgreSQL, Supabase'],
              ['Hosting', 'Vercel, AWS, Cloudflare'],
              ['Design', 'Figma'],
              ['AI / ML', 'OpenAI API, custom integrations'],
            ]},
            { type: 'callout', content: 'You don\'t need to memorize the tech stack. But if a prospect asks "what do you build with?" — say: "Custom code. React, Next.js — the same tech that powers Netflix and Uber. No WordPress, no templates."', variant: 'tip' },
          ],
        },
      ],
      quiz: [
        {
          question: 'What platform does NWS use to build websites?',
          options: ['WordPress with premium themes', 'Wix and Squarespace', 'Custom-built with Next.js and React — no templates', 'Shopify'],
          correctIndex: 2,
          explanation: 'NWS builds everything from scratch using Next.js and React. No templates, no WordPress, no page builders.',
        },
        {
          question: 'What should you say when a prospect asks what NWS builds?',
          options: ['"We build websites"', '"We build revenue engines" or "sites that rank and convert"', '"We do web design and marketing"', '"We make pretty pages"'],
          correctIndex: 1,
          explanation: 'Always frame what NWS does in terms of revenue and results, not just "websites."',
        },
        {
          question: 'Is SEO added to NWS websites after launch?',
          options: ['Yes, it\'s a separate service added later', 'No — SEO is built into every site from day one', 'Only if the client pays extra', 'SEO is not part of our offering'],
          correctIndex: 1,
          explanation: 'SEO is not an add-on at NWS — it\'s built into the engineering process from day one. Every site ships with keyword-optimized content, schema markup, and performance tuning.',
        },
      ],
    },

    // ────────────────────────────────────────────────────────────
    // MODULE 3: Pricing & Packages
    // ────────────────────────────────────────────────────────────
    {
      id: 'pricing',
      title: 'Pricing & Packages',
      description: 'Understanding our pricing tiers and how to position them',
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      slides: [
        {
          title: 'Our Three Pricing Tiers',
          subtitle: 'Floor, Target, and High-End',
          content: [
            { type: 'table', headers: ['Tier', 'Price', 'What\'s Included'], rows: [
              ['STARTER (Floor)', '$3,500 – $4,000', 'Simple 5-page brochure site. SEO fundamentals, mobile-friendly. For businesses stepping up from DIY.'],
              ['TARGET (Sweet Spot)', '$5,500 – $8,000', '8–12 pages. GSAP animations, local SEO strategy, audit data proof, Google Business optimization. This is the main offer.'],
              ['ENTERPRISE (High-End)', '$9,000 – $12,000+', 'Unlimited pages, booking system, multi-location SEO, lead scraper, custom software, priority support.'],
            ]},
            { type: 'callout', content: 'ONGOING: $50 – $150/month for hosting, updates, backups, and small content edits. Hosting is included free for the first year on all tiers.', variant: 'info' },
          ],
        },
        {
          title: 'Industry Pricing Context',
          subtitle: 'Where NWS sits in the market',
          content: [
            { type: 'text', content: 'Understanding the landscape helps you position NWS correctly. We\'re a boutique agency — not competing with Fiverr, and not priced like a 50-person firm.' },
            { type: 'table', headers: ['Tier', 'Who', 'Typical Range'], rows: [
              ['DIY / Template', 'Wix, Squarespace, Fiverr', '$0 – $2,000'],
              ['Freelancer', 'Solo designer / dev', '$3,000 – $8,000'],
              ['Boutique Agency (NWS)', '1–5 person shop', '$5,000 – $15,000'],
              ['Full-Service Agency', '10+ people', '$15,000 – $50,000+'],
            ]},
            { type: 'heading', content: 'By Vertical' },
            { type: 'table', headers: ['Vertical', 'Typical Investment', 'Notes'], rows: [
              ['Contractors', '$3,000 – $12,000', '$6K–$8K common for strong local sites'],
              ['Dentists', '$6,000 – $25,000', '$10K–$12K for solid dental sites'],
              ['Med Spas', '$2,500 – $10,000', '$2.5K–$5K typical sweet spot'],
            ]},
          ],
        },
        {
          title: 'Payment Terms & ROI Framing',
          content: [
            { type: 'heading', content: 'Payment Structure' },
            { type: 'bullets', items: [
              'Standard: 50% upfront to start, 50% at launch',
              'Large projects: Can be split into three installments',
              'Goal: Make it workable for the client without creating cash flow risk',
            ]},
            { type: 'heading', content: 'How to Frame ROI by Vertical' },
            { type: 'bullets', items: [
              'Contractors: Average $2K job × 3 extra leads/month = $6K/month. Site pays for itself month one.',
              'Dentists: A $200 patient can be worth $5K+ over 5 years. A few extra patients/month = massive ROI.',
              'Med Spas: A single procedure is $500–$2K+. A few extra bookings/month pays for the site fast.',
            ]},
            { type: 'callout', content: 'NEVER quote pricing on a cold call. That\'s the closer\'s job. If asked, say: "Great question — that\'s exactly what the 15-minute call covers. Our team lead will look at your specific situation."', variant: 'warning' },
          ],
        },
      ],
      quiz: [
        {
          question: 'What is NWS Media\'s "Target" (sweet spot) price range?',
          options: ['$1,000 – $2,500', '$3,500 – $4,000', '$5,500 – $8,000', '$15,000 – $50,000'],
          correctIndex: 2,
          explanation: 'The Target tier is $5,500–$8,000 for an 8–12 page custom site with animations, local SEO, and audit data proof. This is the main offer.',
        },
        {
          question: 'Should you quote pricing on a cold call?',
          options: ['Yes, always be transparent about pricing', 'No — never. Pricing is the closer\'s job. Redirect to the 15-minute call.', 'Only if the prospect is very interested', 'Yes, but only the Starter tier price'],
          correctIndex: 1,
          explanation: 'Never quote pricing on a cold call. That\'s the closer\'s job. If asked, redirect: "Great question — that\'s exactly what the 15-minute call covers."',
        },
        {
          question: 'What is the standard payment structure?',
          options: ['100% upfront', '50% upfront, 50% at launch', 'Monthly payments for 12 months', 'Pay after 90 days'],
          correctIndex: 1,
          explanation: 'Standard payment is 50% upfront to start, 50% at launch. Large projects can be split into three installments.',
        },
      ],
    },

    // ────────────────────────────────────────────────────────────
    // MODULE 4: Your Competitive Edge
    // ────────────────────────────────────────────────────────────
    {
      id: 'competitive-edge',
      title: 'Your Competitive Edge',
      description: 'The 10 advantages that set NWS apart — memorize them',
      icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      slides: [
        {
          title: 'Advantages 1–5',
          subtitle: 'Evidence, specialization, pipeline, SEO, speed',
          content: [
            { type: 'subheading', content: '1. Audit-First Selling' },
            { type: 'text', content: 'We pre-audit every lead (PageSpeed, SEO, SSL, mobile) before we ever talk. We show specific issues and benchmarks, not vague promises. 78% of complaints about web designers are about service — we look professional and prepared from minute one.' },
            { type: 'subheading', content: '2. Vertical Specialization' },
            { type: 'text', content: 'Agencies with clear specialism outperform generalists (2× growth, 61%+ gross margin). We understand reviews, local search, job value, and pain points for each vertical.' },
            { type: 'subheading', content: '3. Pre-Qualified Pipeline' },
            { type: 'text', content: 'Our system pre-filters and scores leads. You only talk to people who have triage, audit, and enrichment data before the call.' },
            { type: 'subheading', content: '4. Built to Rank From Day One' },
            { type: 'text', content: 'SEO delivers 19.9× ROAS vs ~4.4× for ads. 88%+ of local mobile searches lead to a call or visit within 24 hours. We sell "built to rank," not "we\'ll add SEO later."' },
            { type: 'subheading', content: '5. Speed Focus' },
            { type: 'text', content: '~1 sec slower load hurts conversions ~7%. 53% abandon after 3 seconds. Template builders sit at 3.5–5.5s; NWS targets 2.5s.' },
          ],
        },
        {
          title: 'Advantages 6–10',
          subtitle: 'Boutique, lead-gen killer, ROI, market, messaging',
          content: [
            { type: 'subheading', content: '6. Owner-Operated Boutique' },
            { type: 'text', content: 'Direct contact with senior talent. No juniors behind account managers. No bloated overhead. No disappearing freelancers. The best of both worlds — reliability without the overhead.' },
            { type: 'subheading', content: '7. Lead-Gen Platform Killer' },
            { type: 'text', content: 'Contractors pay $50–$200+ per lead on Thumbtack/HomeAdvisor with no quality guarantee. A $6K site at $100/lead = 60 leads to break even. After that, every lead is free, 24/7.' },
            { type: 'subheading', content: '8. ROI Framing by Vertical' },
            { type: 'text', content: 'We sell outcomes, not pages. Contractors: $2K job × 3 leads/mo = $6K/mo. Dentists: $200 patient = $5K+ lifetime. Med spas: $500–$2K per procedure.' },
            { type: 'subheading', content: '9. National Market Focus' },
            { type: 'text', content: 'US-wide targeting with metro-level depth. We can name competitors, cite benchmarks, and understand local search dynamics in any market.' },
            { type: 'subheading', content: '10. Segment-Aware Messaging' },
            { type: 'text', content: 'ESTABLISHED: "Your reviews and reputation are strong; your site is holding you back." NEW/SMALL: "You\'re early-stage; a site now builds credibility and captures searches as you grow." We\'re not pitching one generic offer.' },
          ],
        },
        {
          title: 'One-Line Pitches',
          subtitle: 'Keep these loaded for cold outreach, DMs, emails, and calls',
          content: [
            { type: 'script', label: 'Pitch 1', content: '"We build websites that rank. I\'ve already audited yours — I can show you exactly where you\'re losing customers."' },
            { type: 'script', label: 'Pitch 2', content: '"Contractors in Houston are paying $50–200 per Thumbtack lead. A site that ranks brings leads without per-lead fees."' },
            { type: 'script', label: 'Pitch 3', content: '"We only work with [contractors / dentists / med spas] in markets like yours. I know what works."' },
            { type: 'script', label: 'Pitch 4', content: '"Your reviews are solid — the site isn\'t. I\'ll show you the data, then we build something that matches your reputation."' },
            { type: 'callout', content: 'These are your quick-draw statements. Use them in cold outreach, DMs, emails, and the first 10 seconds of any call.', variant: 'tip' },
          ],
        },
      ],
      quiz: [
        {
          question: 'What does "Audit-First Selling" mean?',
          options: ['We audit our own work after launch', 'We pre-audit every lead\'s website (PageSpeed, SEO, SSL) before we ever contact them', 'We ask clients to audit their own sites', 'We charge for website audits'],
          correctIndex: 1,
          explanation: 'Audit-First means we show specific data about their website problems before we ever pitch — this builds trust and credibility.',
        },
        {
          question: 'How much do contractors typically pay per lead on platforms like Thumbtack?',
          options: ['$5–$10', '$50–$200+', '$500–$1,000', '$10–$20'],
          correctIndex: 1,
          explanation: 'Contractors pay $50–$200+ per lead on Thumbtack/HomeAdvisor with no quality guarantee. NWS sites deliver leads 24/7 with no per-lead fee.',
        },
        {
          question: 'What percentage of local mobile searches lead to a call or visit within 24 hours?',
          options: ['25%', '50%', '88%+', '10%'],
          correctIndex: 2,
          explanation: '88%+ of local mobile searches lead to a call or visit within 24 hours — which is why being "built to rank from day one" is so powerful.',
        },
        {
          question: 'What is the difference between messaging for ESTABLISHED vs NEW/SMALL clients?',
          options: ['There is no difference — same pitch for everyone', 'ESTABLISHED: "Your site is holding you back." NEW/SMALL: "Build credibility now as you grow."', 'ESTABLISHED: Lower pricing. NEW/SMALL: Higher pricing.', 'ESTABLISHED: Skip the audit. NEW/SMALL: Full audit.'],
          correctIndex: 1,
          explanation: 'NWS uses segment-aware messaging. For established businesses: "Your reviews are strong; your site is holding you back." For new/small: "A site now builds credibility and captures searches as you grow."',
        },
      ],
    },

    // ────────────────────────────────────────────────────────────
    // MODULE 5: Your Mission
    // ────────────────────────────────────────────────────────────
    {
      id: 'mission',
      title: 'Your Mission as a VA',
      description: 'Your one job: book the 15-minute discovery call',
      icon: 'M13 10V3L4 14h7v7l9-11h-7z',
      slides: [
        {
          title: 'You Have ONE Job',
          subtitle: 'Book the 15-minute discovery call. That\'s it.',
          content: [
            { type: 'callout', content: 'You are not selling websites. You are not closing deals. You are opening doors. Get them curious, show them they have a problem, and hand them off to the closer.', variant: 'important' },
            { type: 'heading', content: 'What You Are' },
            { type: 'text', content: 'You are the door opener. You find businesses with slow or stagnant revenue, show them they have a problem they didn\'t know about, and get them curious enough to take a 15-minute call where our closer presents a free audit and analysis.' },
            { type: 'heading', content: 'What You Are NOT' },
            { type: 'text', content: 'You are not selling websites. You are not explaining pricing. You are not talking about features, tech stacks, or design. If the conversation goes there, pull it back.' },
          ],
        },
        {
          title: 'Do\'s and Don\'ts',
          subtitle: 'The rules of engagement',
          content: [
            { type: 'comparison', doItems: [
              'Keep calls under 3–5 minutes',
              'Talk about their revenue problem',
              'Reference their specific business',
              'Book the 15-min call and get off',
              'Sound like a peer, not a salesperson',
              'Let them talk 60% of the time',
            ], dontItems: [
              'Quote pricing',
              'Explain what a website includes',
              'Make generic pitches',
              'Try to close the deal yourself',
              'Start with "How are you today?"',
              'Ramble past 5 minutes',
            ]},
          ],
        },
        {
          title: 'The Handoff',
          subtitle: 'Your job ends when the calendar invite is sent',
          content: [
            { type: 'text', content: 'The closer handles the audit presentation, proposal, and sale. Your job ends when the calendar invite is sent. Clean handoff = more deals closed.' },
            { type: 'heading', content: 'After They Say Yes' },
            { type: 'bullets', items: [
              'Confirm their email address',
              'Send the calendar invite WHILE ON THE CALL',
              'Say: "You should have that invite now. You\'ll also get a short email with some data we pulled. Talk soon, [Name]."',
              'Then GET OFF THE PHONE',
            ]},
            { type: 'callout', content: 'The longer you stay on the phone after booking, the higher the chance they talk themselves out of it. Book it, confirm it, hang up.', variant: 'warning' },
          ],
        },
      ],
      quiz: [
        {
          question: 'What is your ONE job as a VA cold caller?',
          options: ['Sell websites to business owners', 'Book a 15-minute discovery call with the closer', 'Explain NWS Media\'s pricing in detail', 'Close the deal on the phone'],
          correctIndex: 1,
          explanation: 'Your only job is to book a 15-minute discovery call. The closer handles the audit presentation, proposal, and sale.',
        },
        {
          question: 'How long should your cold calls last?',
          options: ['10–15 minutes', '3–5 minutes', '30 seconds', '20+ minutes'],
          correctIndex: 1,
          explanation: 'Keep calls under 3–5 minutes. Your goal is to create curiosity and book the meeting, not have a long conversation.',
        },
        {
          question: 'What should you do after the prospect agrees to a meeting?',
          options: ['Keep talking about NWS Media services', 'Ask about their budget', 'Confirm email, send the calendar invite while on the call, then get off the phone', 'Transfer them to the closer immediately'],
          correctIndex: 2,
          explanation: 'Confirm their email, send the invite while on the call, confirm they received it, then hang up. The longer you stay on after booking, the higher the chance they back out.',
        },
        {
          question: 'If a prospect asks "How much does it cost?", what do you say?',
          options: ['"Our sites start at $3,500"', '"Great question — that\'s exactly what the 15-minute call covers."', '"It depends on what you need, let me explain our packages"', '"I\'ll email you a price sheet"'],
          correctIndex: 1,
          explanation: 'Never quote pricing. That\'s the closer\'s job. Redirect to the meeting: "Great question — that\'s exactly what the 15-minute call covers."',
        },
      ],
    },

    // ────────────────────────────────────────────────────────────
    // MODULE 6: Before You Dial
    // ────────────────────────────────────────────────────────────
    {
      id: 'prep',
      title: 'Before You Dial',
      description: '30 seconds of prep before every single call',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
      slides: [
        {
          title: 'The 30-Second Prep Checklist',
          subtitle: 'Every call. No exceptions.',
          content: [
            { type: 'callout', content: 'Never dial without knowing their name, their business, and one specific thing about them. Generic calls die in 4 seconds.', variant: 'important' },
            { type: 'bullets', items: [
              'Business name + owner first name — Use it in the first sentence.',
              'Category + city — You need to say this out loud on the call.',
              'Google Maps listing open — Know their review count and star rating.',
              'Website status — No site? Dead site? Outdated site? Know which one.',
              '1–2 competitors with better sites — You\'ll reference these on the call.',
              'Their revenue signal — Busy = budget. Slow = urgency. Both work.',
            ]},
          ],
        },
        {
          title: 'Understanding the Prospect\'s State',
          subtitle: 'What they\'re probably doing when you call',
          content: [
            { type: 'text', content: 'When you call a business owner cold, you\'re interrupting one of these states. Your job in the first 5 seconds: diagnose which state they\'re in and adapt.' },
            { type: 'table', headers: ['State', 'Probability', 'What to Do'], rows: [
              ['Deep Work (project/proposal)', '15%', 'High annoyance — compress your pitch'],
              ['Admin Drudgery (emails, invoices)', '40%', 'Low cognitive load — more receptive'],
              ['Crisis Mode (employee/customer issue)', '10%', 'Will hang up instantly — reschedule'],
              ['Downtime/Transition', '25%', 'Golden window — expand conversation'],
              ['Frustrated with Marketing', '10%', 'Primed for your call — match their energy'],
            ]},
            { type: 'callout', content: 'If they sound rushed, compress. If they sound engaged, expand. If they sound frustrated, commiserate before selling.', variant: 'tip' },
          ],
        },
      ],
      quiz: [
        {
          question: 'What should you ALWAYS know before dialing?',
          options: ['Just the phone number', 'Their name, business, reviews, site status, and 1-2 competitors', 'Only their business name', 'Their revenue numbers'],
          correctIndex: 1,
          explanation: 'You need: business name + owner name, category + city, Google Maps rating, website status, 1-2 competitors, and revenue signal. 30 seconds of prep, every call.',
        },
        {
          question: 'When is the best time to reach a prospect (highest engagement)?',
          options: ['When they\'re in crisis mode', 'When they\'re in deep work on a project', 'When they\'re in downtime/transition between tasks', 'Time doesn\'t matter'],
          correctIndex: 2,
          explanation: 'Downtime/transition (25% probability) is the golden window — they\'re between tasks and most receptive to a conversation.',
        },
      ],
    },

    // ────────────────────────────────────────────────────────────
    // MODULE 7: Opening the Call
    // ────────────────────────────────────────────────────────────
    {
      id: 'openers',
      title: 'Opening the Call',
      description: 'The first 10 seconds decide everything',
      icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
      slides: [
        {
          title: 'The First 10 Seconds Rule',
          subtitle: 'Your opener must include their NAME + something SPECIFIC about their business',
          content: [
            { type: 'callout', content: 'Research shows prospects decide whether to engage or disengage within 7–10 seconds. This is pattern recognition, not rational thinking.', variant: 'important' },
            { type: 'heading', content: 'What Kills Your Call Instantly' },
            { type: 'bullets', items: [
              'Starting with "How are you today?" — screams telemarketer',
              'Saying "This will only take a minute" — you\'re already apologizing',
              'Long company intro: "We\'re a full-service digital marketing agency founded in..." — they don\'t care yet',
              'Upward inflection on everything — sounds uncertain',
              'Mispronouncing their name — shows you didn\'t research',
            ]},
            { type: 'heading', content: 'What Gets You In' },
            { type: 'bullets', items: [
              'Saying their name confidently in the first sentence',
              'Dropping a competitor name or local reference',
              'Leading with a problem, not a product',
              'Asking a binary question they can\'t dodge',
              'Speaking like a colleague, not a salesperson',
              'Zero filler words in the first 10 seconds',
            ]},
          ],
        },
        {
          title: 'Opener #1 — The Revenue Gap',
          subtitle: 'Best for: Any vertical. Businesses that seem established but aren\'t growing.',
          content: [
            { type: 'script', label: 'Script', content: '"[Name], this is [You] with NWS Media. I\'ll be quick — I was looking at [category] businesses in [city] and noticed [Business Name] has [X] reviews at [rating] stars, which is solid. But your online presence isn\'t matching that. Are you leaving money on the table, or is that intentional?"' },
            { type: 'callout', content: 'Why it works: The word "intentional" forces a reaction. Nobody admits to intentionally losing money. Pattern interrupt that opens the door.', variant: 'tip' },
          ],
        },
        {
          title: 'Opener #2 — The Competitor Drop',
          subtitle: 'Best for: Contractors, med spas. Works best with real competitor data.',
          content: [
            { type: 'script', label: 'Script', content: '"Hey [Name], [You] with NWS Media. Quick one — do you know why [Competitor Name] in [nearby area] is getting the Google calls that should be going to you? I just looked at the data and thought you\'d want to know."' },
            { type: 'callout', content: 'Why it works: Competitive instinct is primal. Naming a real competitor they know makes this impossible to ignore.', variant: 'tip' },
          ],
        },
        {
          title: 'Opener #3 — The Busy Flip',
          subtitle: 'Best for: Service businesses in peak season. Contractors, dentists.',
          content: [
            { type: 'script', label: 'Script', content: '"Hey [Name], [You] with NWS Media. You guys seem busy, which is great — but let me ask you something: is that pipeline predictable, or does it dry up between seasons? Because that\'s the gap we close."' },
            { type: 'callout', content: 'Why it works: Reframes "busy" as a vulnerability. Hits a nerve they\'re already worried about.', variant: 'tip' },
          ],
        },
        {
          title: 'Opener #4 — The Dead Site Callout',
          subtitle: 'Best for: Leads with no website or a broken/outdated website.',
          content: [
            { type: 'script', label: 'Script', content: '"[Name], [You] with NWS Media. I tried pulling up your website and it\'s [not there / not loading / hasn\'t been touched in years]. Meanwhile your competitors are collecting every Google search in [city]. You\'ve got [X] reviews — people are looking for you and hitting a dead end. Got 60 seconds?"' },
            { type: 'callout', content: 'Why it works: Concrete, visual, undeniable. The "60 seconds" micro-commitment is almost impossible to refuse.', variant: 'tip' },
          ],
        },
        {
          title: 'Opener #5 — The Revenue Math',
          subtitle: 'Best for: High-ticket verticals: contractors, dentists, med spas, attorneys.',
          content: [
            { type: 'script', label: 'Script', content: '"[Name], [You] with NWS Media. Quick question — what\'s your average job worth? [Let them answer]. Okay, so if your online presence brought in just 2–3 extra [jobs/patients/cases] a month, that\'s [$X,000] you\'re not capturing right now. Is that worth a 15-minute conversation?"' },
            { type: 'callout', content: 'Why it works: Makes the cost of inaction tangible. When they do the math in their head, the meeting sells itself.', variant: 'tip' },
            { type: 'callout', content: 'PRO TIP: Don\'t memorize word-for-word. Internalize the STRUCTURE: Name + Specificity + Problem + Micro-commitment. Then say it in your own voice.', variant: 'info' },
          ],
        },
      ],
      quiz: [
        {
          question: 'What should your opener always include?',
          options: ['"How are you today?" and a company introduction', 'Their name + something specific about their business', 'A detailed explanation of NWS services', 'An apology for interrupting them'],
          correctIndex: 1,
          explanation: 'Your opener must include their NAME + something SPECIFIC about their business in the first sentence. Generic calls die in 4 seconds.',
        },
        {
          question: 'Which opener uses the word "intentional" to force a reaction?',
          options: ['The Competitor Drop', 'The Revenue Gap', 'The Dead Site Callout', 'The Busy Flip'],
          correctIndex: 1,
          explanation: 'The Revenue Gap opener ends with "Are you leaving money on the table, or is that intentional?" — nobody admits to intentionally losing money.',
        },
        {
          question: 'What is the structure of every effective opener?',
          options: ['Company intro + Service list + Price quote', 'Name + Specificity + Problem + Micro-commitment', 'Greeting + Weather talk + Pitch + Close', 'Question + Silence + Hang up'],
          correctIndex: 1,
          explanation: 'The formula is: Name + Specificity + Problem + Micro-commitment ask. Then say it in your own voice — sounding natural beats sounding polished.',
        },
      ],
    },

    // ────────────────────────────────────────────────────────────
    // MODULE 8: The Hook & Bridge
    // ────────────────────────────────────────────────────────────
    {
      id: 'hook-bridge',
      title: 'The Hook & Bridge',
      description: 'Making the problem real and bridging to the meeting',
      icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
      slides: [
        {
          title: 'The Hook — Making It Real',
          subtitle: 'You have 30–45 seconds to connect their revenue to their online presence',
          content: [
            { type: 'callout', content: 'YOUR REPUTATION is strong → but YOUR ONLINE PRESENCE is losing you customers → which means YOUR REVENUE is capped below where it should be.', variant: 'important' },
            { type: 'heading', content: 'For Leads With NO Website' },
            { type: 'script', label: 'Script', content: '"Right now, every time someone searches \'[their service] in [city],\' your competitors with websites are getting that call. You show up on Maps, but there\'s nowhere for them to go. They see your reviews, and then they scroll to the next guy who has a site. That\'s revenue walking out the door every day."' },
            { type: 'heading', content: 'For DEAD / OUTDATED Site' },
            { type: 'script', label: 'Script', content: '"I pulled up your site and it\'s [not loading / still showing copyright 2019 / takes forever to load]. Google sees that too — they\'re pushing you down in results. Your competitors with worse reviews are ranking above you. Not because they\'re better — because they showed up online."' },
            { type: 'heading', content: 'For HAS A SITE But Revenue Is Stagnant' },
            { type: 'script', label: 'Script', content: '"Your business is clearly good — [X] reviews prove that. But your site isn\'t converting. People are finding you but not calling. That gap between your reputation and your revenue? That\'s what we fix."' },
          ],
        },
        {
          title: 'The Bridge to Booking',
          subtitle: 'Close this call by booking the meeting',
          content: [
            { type: 'heading', content: 'The Standard Bridge' },
            { type: 'script', label: 'Script', content: '"Here\'s what I\'d like to do — we\'ve already pulled some data on [Business Name]. I want to get you on a quick 15-minute call with our team lead who\'ll walk you through exactly what\'s happening with your online presence and where you\'re losing customers. No pitch, no obligation — just the data. Would [day] or [day] work?"' },
            { type: 'heading', content: 'The Urgency Bridge' },
            { type: 'script', label: 'Script', content: '"Every day this stays the same, those Google searches are going to your competitors. Let me get you 15 minutes with our team — they\'ll show you the exact data for free. If it\'s not useful, you lost nothing. [Day] or [day]?"' },
            { type: 'heading', content: 'The Soft Bridge' },
            { type: 'script', label: 'Script', content: '"I\'m not asking you to commit to anything. We already have the data on your business. Let someone walk you through it for 15 minutes. Worst case, you learn something you didn\'t know. Can we grab a quick slot this week?"' },
            { type: 'callout', content: 'KEY TECHNIQUE — THE EITHER/OR CLOSE: Never ask "When are you free?" Always offer two specific options: "[Day] or [day]?" This removes decision fatigue and doubles your booking rate.', variant: 'tip' },
          ],
        },
        {
          title: 'The Golden Rule of Language',
          subtitle: 'Speak in money, customers, and competitors',
          content: [
            { type: 'callout', content: 'NEVER use technical jargon. No "SEO," no "PageSpeed," no "Core Web Vitals." Speak in money, customers, and competitors.', variant: 'warning' },
            { type: 'comparison', doItems: [
              '"Your competitors are getting calls that should be yours"',
              '"People are finding you but not calling"',
              '"That\'s revenue walking out the door"',
              '"We build sites that rank and bring customers"',
            ], dontItems: [
              '"Your SEO score is low"',
              '"Your PageSpeed needs optimization"',
              '"You need better Core Web Vitals"',
              '"We do responsive design with schema markup"',
            ]},
          ],
        },
      ],
      quiz: [
        {
          question: 'When hooking a prospect who has NO website, what should you focus on?',
          options: ['Explaining SEO and Core Web Vitals', 'That every Google search for their service goes to competitors with websites', 'That WordPress is outdated', 'That you can build them a cheap site quickly'],
          correctIndex: 1,
          explanation: '"Every time someone searches [their service] in [city], your competitors with websites are getting that call. You show up on Maps, but there\'s nowhere for them to go."',
        },
        {
          question: 'What is the "Either/Or Close"?',
          options: ['Asking if they want a website or not', 'Offering two specific day options instead of asking "When are you free?"', 'Giving them two pricing options', 'Asking if they want email or phone follow-up'],
          correctIndex: 1,
          explanation: 'Never ask "When are you free?" Always offer two specific options: "[Day] or [day]?" This removes decision fatigue and doubles your booking rate.',
        },
        {
          question: 'Should you use terms like "SEO" and "PageSpeed" with prospects?',
          options: ['Yes, it shows technical expertise', 'No — speak in money, customers, and competitors instead', 'Only with tech-savvy prospects', 'Yes, all business owners understand these terms'],
          correctIndex: 1,
          explanation: 'Never use technical jargon. Speak in money, customers, and competitors. Instead of "Your SEO is low" say "Your competitors are ranking above you and getting your customers."',
        },
      ],
    },

    // ────────────────────────────────────────────────────────────
    // MODULE 9: Handling Objections
    // ────────────────────────────────────────────────────────────
    {
      id: 'objections',
      title: 'Handling Objections',
      description: 'Short rebuttals that keep momentum',
      icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      slides: [
        {
          title: 'The Three-Step Framework',
          subtitle: 'Acknowledge → Reframe → Redirect to booking',
          content: [
            { type: 'text', content: 'When a prospect objects, their brain enters defensive mode. Your rebuttal must follow three steps in order:' },
            { type: 'bullets', items: [
              '1. ACKNOWLEDGE the objection (disarm): "I totally get that..." / "That\'s a fair concern..."',
              '2. REFRAME the objection (new perspective): "Here\'s what I\'ve seen with other businesses..."',
              '3. TIE TO REVENUE (make it about them): "If this brings in even one extra client, it pays for itself."',
            ]},
            { type: 'callout', content: 'Keep objection responses SHORT. Acknowledge, reframe, redirect to booking. Don\'t get into long debates.', variant: 'important' },
          ],
        },
        {
          title: '"How much does it cost?"',
          content: [
            { type: 'script', label: 'Your Response', content: '"Great question — that\'s exactly what the 15-minute call covers. Our team lead will look at your specific situation and give you a clear picture. No surprises. Can we grab [day] or [day]?"' },
            { type: 'callout', content: 'NEVER quote pricing. That\'s the closer\'s job.', variant: 'warning' },
          ],
        },
        {
          title: '"I already have a website"',
          content: [
            { type: 'script', label: 'Your Response', content: '"Awesome — having a site is step one. But is it actually bringing you customers? If not, it\'s like having a storefront with the lights off. That\'s what the audit reveals. 15 minutes, free data. Worth it?"' },
            { type: 'callout', content: 'Don\'t trash their site. Reframe to results — is it working or not?', variant: 'tip' },
          ],
        },
        {
          title: '"Just send me an email" / "Not interested"',
          content: [
            { type: 'heading', content: '"Just send me an email"' },
            { type: 'script', label: 'Your Response', content: '"Absolutely, I\'ll send it over. Heads up — it\'ll have data on your business you probably haven\'t seen. If anything makes you go \'huh,\' just reply and we\'ll set something up."' },
            { type: 'heading', content: '"Not interested"' },
            { type: 'script', label: 'Your Response', content: '"Totally respect that. One quick thing before I go — when\'s the last time you Googled your own business? Your competitors are ranking above you right now. Can I at least shoot you a quick email with what I found? If nothing else, you\'ll have the data."' },
            { type: 'callout', content: 'If they say no twice, let them go. Log the call, note the reason, follow up in 30 days. Don\'t burn bridges.', variant: 'warning' },
          ],
        },
        {
          title: '"I don\'t have time" / "We tried this before" / "I need to talk to my partner"',
          content: [
            { type: 'heading', content: '"I don\'t have time for this"' },
            { type: 'script', label: 'Response', content: '"The fact that you\'re busy tells me business is good. That\'s exactly why you need this — you\'re running the whole show plus being your own marketing team. 15 minutes. That\'s it. What does [day] look like?"' },
            { type: 'heading', content: '"We tried something like this before"' },
            { type: 'script', label: 'Response', content: '"I hear that a lot. Sounds like you got burned. That\'s exactly why this call is just 15 minutes of free data, not a sales pitch. No commitment. Just see what the numbers say. Fair?"' },
            { type: 'heading', content: '"I need to talk to my partner"' },
            { type: 'script', label: 'Response', content: '"Totally get it. Want us to include both of you on the 15-minute call? That way you\'re both seeing the same data and can make the call together."' },
          ],
        },
      ],
      quiz: [
        {
          question: 'What are the three steps of handling any objection?',
          options: ['Argue, Convince, Close', 'Acknowledge, Reframe, Redirect to booking', 'Ignore, Repeat pitch, Ask again', 'Apologize, Explain, Discount'],
          correctIndex: 1,
          explanation: 'The framework is: (1) Acknowledge the objection to disarm, (2) Reframe with a new perspective, (3) Redirect/tie to revenue and the meeting.',
        },
        {
          question: 'A prospect says "I already have a website." How should you respond?',
          options: ['"Your website looks terrible, you need a new one"', '"Having a site is step one. But is it bringing you customers? If not, it\'s like a storefront with the lights off."', '"We can rebuild it cheaper than anyone else"', '"That\'s fine, never mind then"'],
          correctIndex: 1,
          explanation: 'Don\'t trash their site. Reframe to results: is it actually bringing customers? Use the "storefront with lights off" analogy.',
        },
        {
          question: 'If a prospect says "not interested" for the third time, what should you do?',
          options: ['Keep pushing with different angles', 'Let them go, log the call, follow up in 30 days', 'Ask to speak to someone else at the company', 'Offer a discount'],
          correctIndex: 1,
          explanation: 'If they say no three times, they mean it. Thank them, log the call with the reason, and follow up in 30 days. Don\'t burn bridges.',
        },
        {
          question: 'When a prospect says "I need to talk to my partner," what\'s the best response?',
          options: ['"Okay, call me back when you\'ve decided"', '"Want us to include both of you on the 15-minute call so you\'re seeing the same data?"', '"I can give you a brochure to show them"', '"That\'s usually just an excuse"'],
          correctIndex: 1,
          explanation: 'Get ahead of the telephone game — offer to include both of them on the call so they can make the decision together with the same information.',
        },
      ],
    },

    // ────────────────────────────────────────────────────────────
    // MODULE 10: Reading Prospects & Psychology
    // ────────────────────────────────────────────────────────────
    {
      id: 'psychology',
      title: 'Reading Prospects & Psychology',
      description: 'Temperature responses and buyer archetypes',
      icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
      slides: [
        {
          title: 'Temperature Responses',
          subtitle: 'Read their energy. Match your response.',
          content: [
            { type: 'heading', content: 'WARM — "Yeah, I\'ve been meaning to look into this"' },
            { type: 'script', label: 'Response', content: '"Perfect — that\'s exactly why I called. Let\'s lock in 15 minutes this week. Our team lead will show you the full picture — where you\'re at, where your competitors are, and what it would take to close the gap. [Day] at [time] or [day] at [time]?"' },
            { type: 'heading', content: 'LUKEWARM — "I\'m pretty busy" / "Mostly referrals"' },
            { type: 'script', label: 'Response', content: '"Referrals are great — that means your work speaks for itself. But here\'s the thing: referrals are unpredictable. One slow month and the pipeline dries up. What we build is a second engine on top of referrals — predictable leads from Google, 24/7. All I\'m asking is 15 minutes. Fair enough?"' },
            { type: 'heading', content: 'COLD — "Not interested" / "We\'re good"' },
            { type: 'script', label: 'Response', content: '"Totally respect that. One quick thing before I go — when\'s the last time you Googled your own business? Your competitors are ranking above you right now. Can I at least shoot you a quick email with what I found?"' },
          ],
        },
        {
          title: 'The Three Buyer Archetypes',
          subtitle: 'Every prospect falls into one of three categories — identify them fast',
          content: [
            { type: 'subheading', content: '1. The Delegator (25% of prospects)' },
            { type: 'text', content: 'Has money, lacks time. Trusts experts. Will buy if you demonstrate competence and remove friction.' },
            { type: 'bullets', items: ['Signals: "Just send me a proposal," "What do you recommend?"', 'Approach: Position as done-for-you. Emphasize time savings.'] },
            { type: 'subheading', content: '2. The Skeptic (60% of prospects)' },
            { type: 'text', content: 'Has been burned before. Default answer is "no." Needs proof, guarantees, and reassurance.' },
            { type: 'bullets', items: ['Signals: "How do I know this works?", "We tried this before"', 'Approach: Lead with data. Use hyper-specific examples. Address failure upfront.'] },
            { type: 'subheading', content: '3. The DIY Optimizer (15% of prospects)' },
            { type: 'text', content: 'Already doing some marketing in-house. Looking to fill gaps or scale what works.' },
            { type: 'bullets', items: ['Signals: "We run our own ads but...", "I handle the website myself"', 'Approach: Don\'t replace, augment. Show what they\'re missing. Offer to audit.'] },
          ],
        },
      ],
      quiz: [
        {
          question: 'A prospect says "We get most of our work from referrals." What\'s the best response angle?',
          options: ['"Referrals don\'t work"', '"Referrals are great, but they\'re unpredictable. We build a second engine — predictable leads from Google, 24/7."', '"You should stop relying on referrals immediately"', '"We can replace your referral system"'],
          correctIndex: 1,
          explanation: 'Validate referrals first ("that means your work speaks for itself"), then reframe: referrals are unpredictable, and NWS builds a second pipeline on top.',
        },
        {
          question: 'Which buyer archetype makes up 60% of prospects?',
          options: ['The Delegator', 'The Skeptic', 'The DIY Optimizer', 'The Eager Buyer'],
          correctIndex: 1,
          explanation: 'The Skeptic (60%) has been burned before and defaults to "no." Lead with data, use specific examples, and address past failures upfront.',
        },
        {
          question: 'For a "Delegator" type prospect, what should you emphasize?',
          options: ['Low pricing and discounts', 'Done-for-you service and time savings', 'Technical details of the build', 'Long-term contracts'],
          correctIndex: 1,
          explanation: 'Delegators have money but lack time. Position the service as done-for-you and emphasize how little effort they need to put in.',
        },
      ],
    },

    // ────────────────────────────────────────────────────────────
    // MODULE 11: Advanced Techniques
    // ────────────────────────────────────────────────────────────
    {
      id: 'advanced',
      title: 'Advanced Techniques',
      description: 'Tonality, vocal control, gatekeepers, and follow-ups',
      icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
      slides: [
        {
          title: 'Tonality — Challenger vs Consultative',
          subtitle: 'It\'s not what you say — it\'s how you say it',
          content: [
            { type: 'heading', content: 'Challenger Tonality' },
            { type: 'text', content: 'Best for: Contractors, solar installers, high-energy personalities.' },
            { type: 'bullets', items: [
              'Slightly faster pace (140–160 words/minute)',
              'Downward inflection at end of statements (certainty)',
              'Short, punchy sentences',
              'Strategic pauses after bold claims',
              'Comfortable with silence',
            ]},
            { type: 'heading', content: 'Consultative Tonality' },
            { type: 'text', content: 'Best for: Attorneys, CPAs, med spas, dentists. High-authority prospects.' },
            { type: 'bullets', items: [
              'Slower, measured pace (110–130 words/minute)',
              'Longer sentences with qualifying language',
              'Frequent use of "we" instead of "I"',
              'Active listening cues ("Mm-hmm," "I hear you")',
              'Let the prospect talk more than you',
            ]},
            { type: 'callout', content: 'Elite reps switch tonality mid-call based on the prospect\'s energy. Start consultative, shift to challenger if they\'re indecisive. Or vice versa.', variant: 'tip' },
          ],
        },
        {
          title: 'Vocal Control & Pausing',
          subtitle: 'Silence creates tension. Tension creates attention.',
          content: [
            { type: 'heading', content: 'When to Pause (1–3 seconds)' },
            { type: 'bullets', items: [
              'After a bold claim: "We increased their lead volume by 300%." [PAUSE]',
              'After asking a question: "Are you happy with your lead flow?" [PAUSE — don\'t fill the silence]',
              'Before delivering pricing (closer\'s job, but good to practice): "The investment would be..." [PAUSE]',
              'After a rejection, to reset: "Okay." [PAUSE] "Let me ask you this..."',
            ]},
            { type: 'heading', content: 'Voice Inflection Patterns' },
            { type: 'bullets', items: [
              'Downward inflection = certainty: "We can help you." (confident)',
              'Upward inflection = curiosity: "Is lead generation a priority for you?" (genuine question)',
              'Flat inflection = authority: "Here\'s what we\'re going to do."',
            ]},
            { type: 'callout', content: 'Record yourself and listen back. Notice where your voice goes up when it should go down. Practice saying "$8,000." (confident) vs "$8,000?" (uncertain).', variant: 'tip' },
          ],
        },
        {
          title: 'Gatekeepers & Voicemails',
          subtitle: 'Getting through — and leaving messages that get callbacks',
          content: [
            { type: 'heading', content: 'Handling Gatekeepers' },
            { type: 'comparison', doItems: [
              '"Hey, is [Name] around?" (casual, like you know them)',
              '"This is [You] with NWS Media — can you connect me?" (confident)',
              '"I\'m following up on something with [Name]." (vague but credible)',
            ], dontItems: [
              '"I\'m calling about their website" — screams sales call',
              'Being rude or dismissive to the gatekeeper',
              'Lying about who you are',
            ]},
            { type: 'heading', content: 'Voicemail Script (Under 25 Seconds)' },
            { type: 'script', label: 'Script', content: '"Hey [Name], this is [You] with NWS Media. I was looking at [category] businesses in [city] and came across [Business Name] — your reviews are great. I pulled some data on your online presence and found a few things that are probably costing you customers. Give me a call back at [number]. Again, [You], NWS Media, [number]. Talk soon."' },
            { type: 'bullets', items: [
              'Say your phone number SLOWLY. Twice.',
              'Sound like you\'re leaving a message for a friend',
              'Mention their business name and something specific',
              'Never say "I\'m calling about your website" — screams sales call',
            ]},
          ],
        },
        {
          title: 'The Follow-Up Sequence',
          subtitle: 'Most deals are won in the follow-up, not the first call',
          content: [
            { type: 'table', headers: ['Day', 'Action'], rows: [
              ['Day 1', 'Initial call. Set meeting or get objection.'],
              ['Day 3', 'Email with case study or audit results.'],
              ['Day 7', 'Follow-up call: "Just wanted to see if you reviewed what I sent."'],
              ['Day 14', 'Value-add email (industry article, tip, insight).'],
              ['Day 21', 'Final call: "Moving you to low-priority unless you want to discuss further."'],
              ['After Day 21', 'Monthly nurture sequence.'],
            ]},
            { type: 'callout', content: 'LOG EVERY CALL IMMEDIATELY. Name, outcome, objection, temperature, follow-up date. If it\'s not logged, it didn\'t happen.', variant: 'warning' },
          ],
        },
      ],
      quiz: [
        {
          question: 'Which tonality is best for contractors and high-energy verticals?',
          options: ['Consultative — slow and measured', 'Challenger — fast, confident, downward inflection', 'Monotone — flat and professional', 'Apologetic — soft and uncertain'],
          correctIndex: 1,
          explanation: 'Challenger tonality (140–160 wpm, downward inflection, short punchy sentences) works best for contractors and high-energy prospects who respect confidence.',
        },
        {
          question: 'How long should a voicemail be?',
          options: ['Under 25 seconds', '1–2 minutes', '30–60 seconds', 'As long as it takes to explain everything'],
          correctIndex: 0,
          explanation: 'Under 25 seconds. Anything longer gets deleted. Include their name, business name, something specific, and your number (twice, slowly).',
        },
        {
          question: 'When should you make your first follow-up after an initial call?',
          options: ['Same day', 'Day 3 — email with case study or audit results', 'Day 14', 'Wait for them to call back'],
          correctIndex: 1,
          explanation: 'The follow-up kill sequence starts with an email on Day 3 with case study or audit results, then a call on Day 7, value-add email on Day 14, and final call on Day 21.',
        },
      ],
    },

    // ────────────────────────────────────────────────────────────
    // MODULE 12: Mindset & Quick Reference
    // ────────────────────────────────────────────────────────────
    {
      id: 'mindset',
      title: 'Mindset & Quick Reference',
      description: 'Tips, mental game, and your cheat sheets',
      icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
      slides: [
        {
          title: '10 Rules for Success',
          subtitle: 'What separates good from great',
          content: [
            { type: 'bullets', items: [
              '1. PACE YOURSELF — 2 hours of locked-in calling beats 6 hours of half-assed dialing. Take breaks.',
              '2. SMILE WHEN YOU TALK — It changes your voice. People can hear a smile.',
              '3. STAND UP — Your diaphragm opens, your voice projects, you sound more authoritative.',
              '4. MIRROR THEIR ENERGY — Fast talker = speed up. Slow = slow down. Matching pace builds trust.',
              '5. PAUSE AFTER BOLD CLAIMS — Then SHUT UP. Count to 3. Silence creates attention.',
              '6. NEVER START WITH "HOW ARE YOU?" — Screams telemarketer. Lead with their name.',
              '7. SAY THEIR NAME 2–3 TIMES — At the open, the hook, and the close. Not more.',
              '8. DOWNWARD INFLECTION = CONFIDENCE — "We can help you." vs "We can help you?"',
              '9. LOG EVERY CALL IMMEDIATELY — If it\'s not logged, it didn\'t happen.',
              '10. REJECTION IS DATA — A "no" today is a "not yet." Some of the biggest deals come from the 3rd or 4th touch.',
            ]},
          ],
        },
        {
          title: 'Red Flags — When to Walk Away',
          subtitle: 'Not every lead is worth your time',
          content: [
            { type: 'table', headers: ['Red Flag', 'Action'], rows: [
              ['"Can you do it for $500?"', 'They don\'t value professional work. Move on.'],
              ['Hostile or disrespectful', 'Thank them and hang up. Life\'s too short.'],
              ['Won\'t commit to any timeline', 'Tire-kicker. Send email, move on.'],
              ['Less than 5 reviews', 'Probably can\'t afford it.'],
              ['They want to design it themselves', 'Scope creep nightmare. Not your problem.'],
              ['Third "not interested"', 'They mean it. Follow up in 30 days.'],
            ]},
          ],
        },
        {
          title: 'Quick Reference Card',
          subtitle: 'Keep this open during every call',
          content: [
            { type: 'table', headers: ['Phase', 'What to Do', 'Time'], rows: [
              ['PREP', 'Name + business + reviews + site status + 1–2 competitors', '30 sec'],
              ['OPEN', '[Name] + NWS Media + specific hook + micro-commitment ask', '10 sec'],
              ['HOOK', 'Revenue gap + competitor comparison + money on the table', '30–45 sec'],
              ['BRIDGE', '"15 min, free data, no pitch. [Day] or [day]?"', '30 sec'],
              ['CLOSE', 'Confirm email + send invite + get off the phone', '15 sec'],
            ]},
            { type: 'heading', content: 'Mindset Reminders' },
            { type: 'bullets', items: [
              'You\'re not begging. You found a problem, you have the solution, you\'re giving them a chance to fix it.',
              'Sell the MEETING, not the product. Your only job is to get them to a 15-minute call.',
              'The first 10 seconds decide everything. Be warm, be fast, say something specific.',
              'Energy is contagious. If you sound excited about what NWS can do for them, they\'ll feel it.',
              'Every call is practice. Even bad calls make the next one better.',
            ]},
            { type: 'callout', content: 'YOUR TARGET: Book the call. Send the invite. Get off the phone. Everything else is handled by the closer. Trust the process.', variant: 'important' },
          ],
        },
      ],
      quiz: [
        {
          question: 'Which of these is a "red flag" to walk away from a lead?',
          options: ['"I already have a website"', '"Can you do it for $500?"', '"I need to check with my partner"', '"What\'s the timeline?"'],
          correctIndex: 1,
          explanation: '"Can you do it for $500?" means they don\'t value professional work. Move on. The others are normal objections you can handle.',
        },
        {
          question: 'What should you do immediately after every call?',
          options: ['Take a 30-minute break', 'Log the call — name, outcome, objection, temperature, follow-up date', 'Call them back to add more information', 'Nothing — just move to the next call'],
          correctIndex: 1,
          explanation: 'LOG EVERY CALL IMMEDIATELY. Name, outcome, objection, temperature, follow-up date. If it\'s not logged, it didn\'t happen.',
        },
        {
          question: 'What is the correct order of a cold call?',
          options: ['Hook → Open → Bridge → Close → Prep', 'Prep → Open → Hook → Bridge → Close', 'Open → Prep → Close → Hook → Bridge', 'Close → Open → Hook → Bridge → Prep'],
          correctIndex: 1,
          explanation: 'The correct flow is: PREP (30 sec) → OPEN (10 sec) → HOOK (30–45 sec) → BRIDGE (30 sec) → CLOSE (15 sec).',
        },
        {
          question: 'Complete this: "You\'re not begging. You found a _____, you have the _____, you\'re giving them a chance to fix it."',
          options: ['client, pitch', 'problem, solution', 'lead, website', 'sale, product'],
          correctIndex: 1,
          explanation: '"You\'re not begging. You found a problem, you have the solution, you\'re giving them a chance to fix it." — This is the mindset to carry into every call.',
        },
      ],
    },
  ],
};
