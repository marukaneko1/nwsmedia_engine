import { query } from '../config/database';

type Strategy = 'round_robin' | 'score_based' | 'territory';

export async function assignLead(leadId: string, strategy: Strategy = 'round_robin') {
  const leadResult = await query('SELECT * FROM leads WHERE id = $1', [leadId]);
  if (leadResult.rows.length === 0) throw new Error('Lead not found');
  const lead = leadResult.rows[0];

  let vaId: string | null = null;

  if (strategy === 'score_based') {
    vaId = await getVAByScoreThreshold(lead.icp_score);
  } else if (strategy === 'territory') {
    vaId = await getVAByTerritory(lead.location_state);
  }

  if (!vaId) {
    vaId = await getNextVAInRotation();
  }

  if (vaId) {
    await query('UPDATE leads SET assigned_va_id = $1, updated_at = NOW() WHERE id = $2', [vaId, leadId]);
  }

  return vaId;
}

async function getVAByScoreThreshold(icpScore: number | null): Promise<string | null> {
  const minRole = icpScore != null && icpScore >= 9 ? 'senior_va' : 'va';
  // For now, all VAs are eligible; seniority can be tracked via teams or a separate field later
  const result = await query(
    `SELECT u.id, COUNT(l.id) as lead_count
     FROM users u
     LEFT JOIN leads l ON l.assigned_va_id = u.id AND l.stage NOT IN ('lost', 'converted')
     WHERE u.role = 'va' AND u.status = 'active'
     GROUP BY u.id
     ORDER BY lead_count ASC, u.created_at ASC
     LIMIT 1`
  );
  return result.rows[0]?.id || null;
}

async function getVAByTerritory(state: string | null): Promise<string | null> {
  if (!state) return null;
  const result = await query(
    `SELECT u.id FROM users u
     JOIN teams t ON u.team_id = t.id
     WHERE u.role = 'va' AND u.status = 'active' AND t.territory ILIKE $1
     ORDER BY RANDOM() LIMIT 1`,
    [`%${state}%`]
  );
  return result.rows[0]?.id || null;
}

async function getNextVAInRotation(): Promise<string | null> {
  const result = await query(
    `SELECT u.id, COUNT(l.id) as lead_count
     FROM users u
     LEFT JOIN leads l ON l.assigned_va_id = u.id AND l.stage NOT IN ('lost', 'converted')
     WHERE u.role = 'va' AND u.status = 'active'
     GROUP BY u.id
     ORDER BY lead_count ASC, u.last_login_at DESC NULLS LAST
     LIMIT 1`
  );
  return result.rows[0]?.id || null;
}
