interface LeadData {
  company_size_min?: number;
  company_size_max?: number;
  industry?: string;
  location_city?: string;
  location_state?: string;
  website_quality_score?: number;
  estimated_revenue?: number;
}

const HIGH_VALUE_INDUSTRIES = [
  'construction', 'specialty_trade_contractors',
  'medical_spas', 'legal_services', 'accounting', 'solar_installation',
];

const TARGET_AREAS = ['Long Island', 'Bergen County', 'Westchester', 'Fairfield County'];
const TARGET_STATES = ['NY', 'NJ', 'CT'];

export function calculateICPScore(lead: LeadData): { score: number; factors: Record<string, number> } {
  const factors: Record<string, number> = {};

  // Company Size (30% weight, max 3.0)
  if (lead.company_size_min != null && lead.company_size_max != null) {
    if (lead.company_size_min >= 10 && lead.company_size_max <= 100) {
      factors.company_size = 3.0;
    } else if (lead.company_size_min >= 5 && lead.company_size_max <= 200) {
      factors.company_size = 2.0;
    } else {
      factors.company_size = 1.0;
    }
  } else {
    factors.company_size = 1.0;
  }

  // Industry Match (25% weight, max 2.5)
  if (lead.industry && HIGH_VALUE_INDUSTRIES.includes(lead.industry)) {
    factors.industry = 2.5;
  } else {
    factors.industry = 1.0;
  }

  // Geographic Fit (20% weight, max 2.0)
  const location = `${lead.location_city || ''}, ${lead.location_state || ''}`;
  if (TARGET_AREAS.some(area => location.includes(area))) {
    factors.geographic = 2.0;
  } else if (lead.location_state && TARGET_STATES.includes(lead.location_state)) {
    factors.geographic = 1.5;
  } else {
    factors.geographic = 0.5;
  }

  // Website Quality (15% weight, max 1.5)
  if (lead.website_quality_score != null) {
    if (lead.website_quality_score >= 7) {
      factors.website_quality = 0.5;
    } else {
      factors.website_quality = 1.5;
    }
  } else {
    factors.website_quality = 1.0;
  }

  // Budget Signals (10% weight, max 1.0)
  if (lead.estimated_revenue != null) {
    if (lead.estimated_revenue >= 1000000) {
      factors.budget = 1.0;
    } else if (lead.estimated_revenue >= 500000) {
      factors.budget = 0.7;
    } else {
      factors.budget = 0.3;
    }
  } else {
    factors.budget = 0.3;
  }

  const rawScore = Object.values(factors).reduce((sum, v) => sum + v, 0);
  const score = Math.min(Math.round(rawScore), 10);

  return { score: Math.max(score, 1), factors };
}
