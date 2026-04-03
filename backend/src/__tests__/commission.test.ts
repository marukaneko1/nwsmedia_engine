describe('Commission Calculation', () => {
  function calculateVACommission(dealValue: number): number {
    return Math.max(dealValue * 0.10, 500);
  }

  function calculateCloserCommission(dealValue: number): { percentage: number; amount: number } {
    let pct = 15;
    if (dealValue > 25000) pct = 20;
    else if (dealValue > 10000) pct = 18;
    return { percentage: pct, amount: dealValue * (pct / 100) };
  }

  describe('VA Commission (10% or $500 min)', () => {
    test('returns $500 minimum for small deals', () => {
      expect(calculateVACommission(3000)).toBe(500);
      expect(calculateVACommission(4999)).toBe(500);
    });
    test('returns 10% for deals over $5000', () => {
      expect(calculateVACommission(5000)).toBe(500);
      expect(calculateVACommission(8000)).toBe(800);
      expect(calculateVACommission(15000)).toBe(1500);
    });
    test('handles zero', () => {
      expect(calculateVACommission(0)).toBe(500);
    });
  });

  describe('Closer Commission (tiered)', () => {
    test('15% for deals <= $10,000', () => {
      const r = calculateCloserCommission(5000);
      expect(r.percentage).toBe(15);
      expect(r.amount).toBe(750);
    });
    test('15% at exactly $10,000', () => {
      const r = calculateCloserCommission(10000);
      expect(r.percentage).toBe(15);
      expect(r.amount).toBe(1500);
    });
    test('18% for deals $10,001-$25,000', () => {
      const r = calculateCloserCommission(15000);
      expect(r.percentage).toBe(18);
      expect(r.amount).toBe(2700);
    });
    test('18% at exactly $25,000', () => {
      const r = calculateCloserCommission(25000);
      expect(r.percentage).toBe(18);
      expect(r.amount).toBe(4500);
    });
    test('20% for deals > $25,000', () => {
      const r = calculateCloserCommission(30000);
      expect(r.percentage).toBe(20);
      expect(r.amount).toBe(6000);
    });
  });
});
