import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { env } from '../config/env';
import { query } from '../config/database';

const router = Router();
router.use(authenticateToken);

/* ─── Prospect personas by niche ─────────────────────────────────────── */

const PROSPECTS: Record<string, { name: string; title: string; company: string; pain: string }> = {
  contractor: {
    name: 'Mike Torres',
    title: 'Owner',
    company: 'Torres Contracting',
    pain: 'relies on word-of-mouth, has no website or digital presence, jobs are seasonal and inconsistent',
  },
  dentist: {
    name: 'Dr. Sarah Kim',
    title: 'Owner / Lead Dentist',
    company: 'Bright Smile Dental',
    pain: 'patient flow is inconsistent, spends money on mailers that don\'t convert, no online booking funnel',
  },
  medspa: {
    name: 'Jessica Reyes',
    title: 'Owner / Director',
    company: 'Glow Aesthetics Med Spa',
    pain: 'depends on Instagram but gets no real bookings from it, competitors are running ads and stealing clients',
  },
  chiropractor: {
    name: 'Dr. Brian Walsh',
    title: 'Owner / Chiropractor',
    company: 'Walsh Chiropractic & Wellness',
    pain: 'gets some referrals from existing patients but has zero online lead gen, website is outdated',
  },
  hvac: {
    name: 'Tony Russo',
    title: 'Owner',
    company: 'Russo Heating & Cooling',
    pain: 'busy in summer/winter but dead in between, no retargeting or follow-up system, loses leads to bigger companies',
  },
  plumber: {
    name: 'Carlos Medina',
    title: 'Owner',
    company: 'Medina Plumbing Solutions',
    pain: 'gets emergency calls but no recurring clients, never follows up on estimates, no reviews strategy',
  },
  roofing: {
    name: 'Dave Kowalski',
    title: 'Owner',
    company: 'Kowalski Roofing Group',
    pain: 'spends on Home Advisor leads that are shared with 5 competitors, no exclusive lead system',
  },
  realtor: {
    name: 'Amanda Chen',
    title: 'Broker / Owner',
    company: 'Chen Premier Realty',
    pain: 'market has slowed, relying on Zillow leads that are cold, needs personal brand and content strategy',
  },
  auto_dealer: {
    name: 'Rick Delgado',
    title: 'General Manager',
    company: 'Delgado Motors',
    pain: 'foot traffic is down, SEM costs are climbing, no retargeting on people who visited the lot but didn\'t buy',
  },
  law_firm: {
    name: 'Michelle Tran',
    title: 'Managing Partner',
    company: 'Tran & Associates',
    pain: 'practice areas are competitive online, PPC costs are through the roof, intake process loses potential clients',
  },
};

/* ─── Difficulty behavior instructions ───────────────────────────────── */

const DIFFICULTY_BEHAVIOR: Record<string, string> = {
  easy: `You are FRIENDLY and OPEN. You answer questions willingly, share your pain points with minimal prompting, and are genuinely curious about how NWS Media could help. You still want to feel like the rep is competent — don't just hand them the meeting. Make them earn it a little, but don't be difficult. Throw one soft objection like "Let me think about it" or "Can you send me an email?" but cave pretty quickly if the rep handles it well.`,
  medium: `You are SKEPTICAL but FAIR. You've been burned by marketing agencies before. You're not hostile but you're guarded. You give short answers and make the rep work for information. Throw 2-3 objections during the call: "We already have a guy," "I don't really have the budget right now," or "We're too busy to take on anything new." You'll open up if the rep uses good technique (correction method, gap building, neutral disarming). If they pitch too early or sound scripted, get more resistant.`,
  hard: `You are BUSY, SKEPTICAL, and SLIGHTLY ANNOYED. You get 5 of these calls a day. You're ready to hang up at the first sign of a sales pitch. Your default response is short, dismissive: "Not interested," "We're good," "Who is this?" The rep has about 10 seconds to earn your attention. If they pattern-interrupt well, you'll give them a chance. If they pitch features, explain their company, or ask "How are you today?" — you cut them off or hang up. You throw hard objections: "Take me off your list," "I don't take sales calls," "We tried marketing, it didn't work." Only a masterful rep who uses psychology, builds a real gap, and stays completely relaxed will get you to agree to a meeting.`,
};

/* ─── Build system prompt ────────────────────────────────────────────── */

function buildSystemPrompt(niche: string, difficulty: string): string {
  const prospect = PROSPECTS[niche] || PROSPECTS.contractor;
  const behavior = DIFFICULTY_BEHAVIOR[difficulty] || DIFFICULTY_BEHAVIOR.medium;

  return `You are ${prospect.name}, ${prospect.title} at ${prospect.company}.

ROLE: You are a real business owner receiving a cold call. You are NOT an AI. Stay in character at all times.

YOUR SITUATION: ${prospect.pain}

DIFFICULTY: ${difficulty.toUpperCase()}
BEHAVIOR: ${behavior}

RULES:
1. Stay in character as ${prospect.name} for the entire conversation. Never break character.
2. Keep responses SHORT — 1-3 sentences max, like a real phone conversation. Real people don't monologue.
3. React naturally to the rep's quality. Good technique = you warm up. Bad technique = you get colder.
4. You have a HIDDEN PAIN: ${prospect.pain}. The rep has to EARN this information by asking the right questions. Don't volunteer it.
5. NEVER coach the rep. NEVER tell them what they should say. NEVER explain sales technique.
6. If the rep uses psychological techniques well (correction method, pattern interrupt, gap building, neutral disarming), respond as a real human would — with curiosity, engagement, or slight defensiveness that melts.
7. If the rep asks to book a 15-20 minute call/audit, you can agree IF they've built enough value. Make them earn it.
8. Use natural speech patterns: "Uh," "Look," "I mean," etc. Sound like a real person on the phone.
9. If the rep says something really dumb, scripted, or robotic — react like a real person would. Get annoyed, go silent, or dismiss them.
10. NEVER mention NWS Media's services yourself. Only respond to what the rep brings up.`;
}

/* ─── Build eval prompt ──────────────────────────────────────────────── */

function buildEvalPrompt(transcript: string, niche: string, difficulty: string): string {
  const prospect = PROSPECTS[niche] || PROSPECTS.contractor;
  return `You are a cold calling coach evaluating a practice call transcript. The rep called ${prospect.name} at ${prospect.company} (${niche} industry, ${difficulty} difficulty).

NWS Media is a marketing agency that helps local businesses grow revenue through websites, SEO, paid ads, and marketing systems.

TRANSCRIPT:
${transcript}

Evaluate the rep's performance. Return STRICT JSON ONLY — no preamble, no markdown fences, no explanation outside the JSON. The response must be valid JSON that can be parsed with JSON.parse().

Return this exact shape:
{
  "overall": <number 1-10>,
  "scores": {
    "Pattern interrupt": <number 1-10>,
    "Problem diagnosis": <number 1-10>,
    "Gap building": <number 1-10>,
    "Psychology / tonality": <number 1-10>,
    "Objection handling": <number 1-10>,
    "Close": <number 1-10>
  },
  "headline": "<one-line summary of performance>",
  "summary": "<2-sentence overall assessment>",
  "wins": ["<specific thing done well>", "<another win>"],
  "misses": ["<specific miss with suggestion>", "<another miss>"],
  "bestLine": "<exact quote from the rep that was strongest, or empty string if nothing stood out>",
  "wouldHaveBooked": <boolean — would a real prospect have booked a meeting?>
}

Be honest and specific. Reference actual lines from the transcript. Score based on NWS Media's cold calling methodology: psychology-first, correction technique, gap building, neutral disarming, assumptive close.`;
}

/* ─── Call Claude API ────────────────────────────────────────────────── */

async function callClaude(
  systemPrompt: string,
  messages: { role: string; content: string }[],
  maxTokens = 512
): Promise<string> {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { content?: { text?: string }[] };
  return data.content?.[0]?.text || '';
}

/* ─── Routes ─────────────────────────────────────────────────────────── */

// GET /api/simulator/prospects — list available niches
router.get('/prospects', (_req: Request, res: Response) => {
  const list = Object.entries(PROSPECTS).map(([id, p]) => ({
    id,
    name: p.name,
    title: p.title,
    company: p.company,
  }));
  res.json({ data: list });
});

// POST /api/simulator/chat — send a message, get prospect response
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { niche, difficulty, messages } = req.body;
    if (!niche || !difficulty || !Array.isArray(messages)) {
      res.status(400).json({ error: 'niche, difficulty, and messages[] are required' });
      return;
    }

    const systemPrompt = buildSystemPrompt(niche, difficulty);
    const response = await callClaude(systemPrompt, messages, 256);
    res.json({ response });
  } catch (err: any) {
    console.error('Simulator chat error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to get AI response' });
  }
});

// POST /api/simulator/evaluate — score a completed call
router.post('/evaluate', async (req: Request, res: Response) => {
  try {
    const { niche, difficulty, messages } = req.body;
    if (!niche || !difficulty || !Array.isArray(messages)) {
      res.status(400).json({ error: 'niche, difficulty, and messages[] are required' });
      return;
    }

    const transcript = messages
      .map((m: { role: string; content: string }) =>
        `${m.role === 'user' ? 'REP' : 'PROSPECT'}: ${m.content}`
      )
      .join('\n');

    const evalPrompt = buildEvalPrompt(transcript, niche, difficulty);
    const raw = await callClaude(evalPrompt, [{ role: 'user', content: 'Evaluate this call transcript and return the JSON score.' }], 1024);

    // Strip any accidental markdown fences
    const cleaned = raw.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
    const scores = JSON.parse(cleaned);
    res.json({ scores });
  } catch (err: any) {
    console.error('Simulator evaluate error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to evaluate call' });
  }
});

// POST /api/simulator/sessions — save a completed session
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { niche, difficulty, prospect_name, prospect_title, transcript, scores, overall_score, would_have_booked, duration_seconds, turn_count } = req.body;

    const result = await query(
      `INSERT INTO simulator_sessions (user_id, niche, difficulty, prospect_name, prospect_title, transcript, scores, overall_score, would_have_booked, duration_seconds, turn_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [userId, niche, difficulty, prospect_name, prospect_title, JSON.stringify(transcript), scores ? JSON.stringify(scores) : null, overall_score, would_have_booked, duration_seconds, turn_count]
    );

    res.json({ data: result.rows[0] });
  } catch (err: any) {
    console.error('Save simulator session error:', err.message);
    res.status(500).json({ error: 'Failed to save session' });
  }
});

// GET /api/simulator/sessions — list user's past sessions
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await query(
      `SELECT id, niche, difficulty, prospect_name, prospect_title, overall_score, would_have_booked, duration_seconds, turn_count, created_at
       FROM simulator_sessions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM simulator_sessions WHERE user_id = $1`,
      [userId]
    );

    res.json({ data: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err: any) {
    console.error('List simulator sessions error:', err.message);
    res.status(500).json({ error: 'Failed to load sessions' });
  }
});

// GET /api/simulator/sessions/:id — get a specific session with transcript
router.get('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const result = await query(
      `SELECT * FROM simulator_sessions WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json({ data: result.rows[0] });
  } catch (err: any) {
    console.error('Get simulator session error:', err.message);
    res.status(500).json({ error: 'Failed to load session' });
  }
});

// GET /api/simulator/stats — get user's aggregate stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const result = await query(
      `SELECT
         COUNT(*) as total_sessions,
         ROUND(AVG(overall_score), 1) as avg_score,
         MAX(overall_score) as best_score,
         COUNT(*) FILTER (WHERE would_have_booked = true) as booked_count,
         ROUND(AVG(duration_seconds)) as avg_duration
       FROM simulator_sessions
       WHERE user_id = $1`,
      [userId]
    );

    res.json({ data: result.rows[0] });
  } catch (err: any) {
    console.error('Get simulator stats error:', err.message);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

export default router;
