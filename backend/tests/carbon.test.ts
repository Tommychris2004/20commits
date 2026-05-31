import { describe, it, expect } from 'vitest';
import { computeCarbonSummary, computeImpactEquivalences } from '../src/services/carbonService.js';

describe('Carbon MRV Engine', () => {
  it('correctly calculates CO2 avoided from solar generation', () => {
    // 100 kWh solar × 0.75 kg CO2/kWh = 75 kg CO2 avoided
    const result = computeCarbonSummary(100);

    expect(result.solar_kwh).toBe(100);
    expect(result.co2_avoided_kg).toBeCloseTo(75);
    expect(result.credits_earned).toBeCloseTo(0.075); // 75 kg = 0.075 tonnes
  });

  it('values credits at correct USD and NGN rates', () => {
    // 1 tonne = $7.50 × ₦1580 = ₦11,850
    const result = computeCarbonSummary(1000 / 0.75); // 1000 kg CO2 = 1 tonne

    expect(result.credits_earned).toBeCloseTo(1, 2);
    expect(result.credit_value_usd).toBeCloseTo(7.5, 1);
    expect(result.credit_value_naira).toBeCloseTo(11850, 0);
  });

  it('applies 70% user share to payout', () => {
    const result = computeCarbonSummary(1000 / 0.75);
    // User gets 70% of total credit value
    expect(result.estimated_payout_naira).toBeCloseTo(result.credit_value_naira * 0.7, 0);
  });

  it('returns zero for no solar generation', () => {
    const result = computeCarbonSummary(0);
    expect(result.co2_avoided_kg).toBe(0);
    expect(result.credits_earned).toBe(0);
    expect(result.credit_value_naira).toBe(0);
    expect(result.estimated_payout_naira).toBe(0);
  });

  it('computes correct environmental equivalences', () => {
    // 1050 kg CO2 avoided
    const eq = computeImpactEquivalences(1050);

    // 1050 / 21 = 50 trees
    expect(eq.trees_equivalent).toBe(50);
    // 1050 / 0.1 = 10,500 km
    expect(eq.car_km_equivalent).toBe(10500);
    // 1050 kg / 1000 = 1.05 tonnes ≈ 105% of LOS-LHR flight
    expect(eq.flight_pct_lagos_london).toBe(105);
  });

  it('includes methodology and disclaimer', () => {
    const result = computeCarbonSummary(100);
    expect(result.methodology).toBeTruthy();
    expect(result.methodology).toContain('Verra VCS');
    expect(result.methodology).toContain('Estimates only');
  });
});
