import { calculateICPScore } from '../services/icpScoring';

describe('ICP Scoring', () => {
  test('high-value lead scores 8+', () => {
    const { score } = calculateICPScore({
      company_size_min: 10,
      company_size_max: 100,
      industry: 'construction',
      location_city: 'Long Island',
      location_state: 'NY',
      website_quality_score: 3,
      estimated_revenue: 1500000,
    });
    expect(score).toBeGreaterThanOrEqual(8);
  });

  test('low-value lead scores low', () => {
    const { score } = calculateICPScore({
      company_size_min: 500,
      company_size_max: 1000,
      industry: 'unknown',
      location_city: 'Los Angeles',
      location_state: 'CA',
      website_quality_score: 9,
      estimated_revenue: 100000,
    });
    expect(score).toBeLessThanOrEqual(5);
  });

  test('returns factors breakdown', () => {
    const { factors } = calculateICPScore({
      company_size_min: 10,
      company_size_max: 50,
      industry: 'legal_services',
      location_state: 'NJ',
      website_quality_score: 5,
      estimated_revenue: 800000,
    });
    expect(factors).toHaveProperty('company_size');
    expect(factors).toHaveProperty('industry');
    expect(factors).toHaveProperty('geographic');
    expect(factors).toHaveProperty('website_quality');
    expect(factors).toHaveProperty('budget');
  });

  test('score is capped at 10', () => {
    const { score } = calculateICPScore({
      company_size_min: 10,
      company_size_max: 100,
      industry: 'construction',
      location_city: 'Long Island',
      location_state: 'NY',
      website_quality_score: 1,
      estimated_revenue: 2000000,
    });
    expect(score).toBeLessThanOrEqual(10);
  });

  test('handles missing fields gracefully', () => {
    const { score } = calculateICPScore({});
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThanOrEqual(0);
  });
});
