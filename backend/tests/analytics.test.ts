import { describe, it, expect } from 'vitest';
import { computeCostBreakdown } from '../src/services/analyticsService.js';

describe('Cost Engine', () => {
  it('correctly prices generator-only consumption', () => {
    const result = computeCostBreakdown([
      { source: 'generator', energy_kwh: 10 },
    ]);

    expect(result.total_kwh).toBeCloseTo(10);
    // 10 kWh × ₦450/kWh = ₦4,500
    expect(result.total_cost_naira).toBeCloseTo(4500);
    // Generator-only baseline = same consumption, so savings = 0
    expect(result.savings_naira).toBe(0);
    expect(result.blended_rate_naira_per_kwh).toBeCloseTo(450);
  });

  it('prices solar at zero marginal cost', () => {
    const result = computeCostBreakdown([
      { source: 'solar', energy_kwh: 5 },
    ]);

    expect(result.total_kwh).toBeCloseTo(5);
    expect(result.total_cost_naira).toBe(0);
    // Solar vs generator baseline: 5 kWh × ₦450 = ₦2,250 savings
    expect(result.savings_naira).toBeCloseTo(2250);
  });

  it('prices grid at Band A tariff (₦68/kWh)', () => {
    const result = computeCostBreakdown([
      { source: 'grid', energy_kwh: 2 },
    ]);

    expect(result.total_kwh).toBeCloseTo(2);
    // 2 kWh × ₦68 = ₦136
    expect(result.total_cost_naira).toBeCloseTo(136);
    // Savings vs generator: 2 × (450 - 68) = ₦764
    expect(result.savings_naira).toBeCloseTo(764);
  });

  it('blends mixed sources correctly', () => {
    const result = computeCostBreakdown([
      { source: 'generator', energy_kwh: 10 },
      { source: 'solar', energy_kwh: 5 },
      { source: 'grid', energy_kwh: 2 },
    ]);

    // Total kWh = 17
    expect(result.total_kwh).toBeCloseTo(17);

    // Total cost = (10 × 450) + (5 × 0) + (2 × 68) = 4500 + 0 + 136 = 4636
    expect(result.total_cost_naira).toBeCloseTo(4636);

    // Baseline (all generator) = 17 × 450 = 7650
    // Savings = 7650 - 4636 = 3014
    expect(result.savings_naira).toBeCloseTo(3014);

    // Blended rate = 4636 / 17 ≈ 272.7
    expect(result.blended_rate_naira_per_kwh).toBeCloseTo(272.7, 0);
  });

  it('returns zero breakdown for empty readings', () => {
    const result = computeCostBreakdown([]);
    expect(result.total_kwh).toBe(0);
    expect(result.total_cost_naira).toBe(0);
    expect(result.savings_naira).toBe(0);
  });

  it('shows correct by_source breakdown', () => {
    const result = computeCostBreakdown([
      { source: 'generator', energy_kwh: 10 },
      { source: 'solar', energy_kwh: 5 },
      { source: 'grid', energy_kwh: 2 },
    ]);

    const gen = result.by_source.find((s) => s.source === 'generator')!;
    const solar = result.by_source.find((s) => s.source === 'solar')!;
    const grid = result.by_source.find((s) => s.source === 'grid')!;

    expect(gen.kwh).toBeCloseTo(10);
    expect(gen.cost_naira).toBeCloseTo(4500);

    expect(solar.kwh).toBeCloseTo(5);
    expect(solar.cost_naira).toBe(0);

    expect(grid.kwh).toBeCloseTo(2);
    expect(grid.cost_naira).toBeCloseTo(136);
  });
});
