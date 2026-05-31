import { describe, it, expect } from 'vitest';
import { evaluateAlertsFromReadings } from '../src/services/alertsService.js';

describe('Alerts Engine', () => {
  it('triggers low-load generator alert when running below 30% load', () => {
    // Generator rated at 2.5 kW (one peak reading), running at 0.5 kW average — 20% load
    const readings = [
      // One startup spike (rated capacity)
      { source: 'generator' as const, power_kw: 2.5, energy_kwh: 0.07, hours_ago: 4.0 },
      // 7 readings at very low load (20%)
      ...Array.from({ length: 7 }, (_, i) => ({
        source: 'generator' as const,
        power_kw: 0.5,
        energy_kwh: 0.25,
        hours_ago: 3.5 - i * 0.5,
      })),
    ];

    // avg = (2.5 + 7*0.5) / 8 = (2.5 + 3.5) / 8 = 0.75
    // max = 2.5, loadFactor = 0.75 / 2.5 = 0.30 — just at the threshold
    // Let's verify: with all at 0.4 kW to be clearly below 30%
    const lowReadings = [
      { source: 'generator' as const, power_kw: 2.5, energy_kwh: 0.07, hours_ago: 4.0 },
      ...Array.from({ length: 7 }, (_, i) => ({
        source: 'generator' as const,
        power_kw: 0.3, // 12% of 2.5 kW rated
        energy_kwh: 0.15,
        hours_ago: 3.5 - i * 0.5,
      })),
    ];

    const alerts = evaluateAlertsFromReadings(lowReadings);

    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].alert_type).toBe('low_load_generator');
    expect(alerts[0].impact_naira).toBeGreaterThan(0);
  });

  it('does NOT trigger low-load alert when generator is at healthy load', () => {
    // max=2kW, avg=1.8kW → load factor = 90%
    const readings = Array.from({ length: 8 }, (_, i) => ({
      source: 'generator' as const,
      power_kw: i === 0 ? 2.0 : 1.8,
      energy_kwh: 0.9,
      hours_ago: Math.floor(i / 2) + 0.5,
    }));

    const alerts = evaluateAlertsFromReadings(readings);
    const lowLoad = alerts.find((a) => a.alert_type === 'low_load_generator');
    expect(lowLoad).toBeUndefined();
  });

  it('caps alerts at 3 even when multiple rules fire', () => {
    // Create conditions that could fire many rules
    const readings = Array.from({ length: 20 }, (_, i) => ({
      source: 'generator' as const,
      power_kw: 0.3,
      energy_kwh: 0.15,
      hours_ago: i * 0.2,
    }));

    const alerts = evaluateAlertsFromReadings(readings);
    expect(alerts.length).toBeLessThanOrEqual(3);
  });

  it('ranks alerts by Naira impact (highest first)', () => {
    const readings = Array.from({ length: 8 }, (_, i) => ({
      source: 'generator' as const,
      power_kw: 0.5,
      energy_kwh: 0.25,
      hours_ago: i * 0.5,
    }));

    const alerts = evaluateAlertsFromReadings(readings);

    for (let i = 1; i < alerts.length; i++) {
      expect(alerts[i - 1].impact_naira).toBeGreaterThanOrEqual(alerts[i].impact_naira);
    }
  });

  it('returns empty array for solar-only readings (no generator alerts)', () => {
    const readings = Array.from({ length: 8 }, (_, i) => ({
      source: 'solar' as const,
      power_kw: 1.5,
      energy_kwh: 0.75,
      hours_ago: i * 0.5,
    }));

    const alerts = evaluateAlertsFromReadings(readings);
    const lowLoad = alerts.find((a) => a.alert_type === 'low_load_generator');
    expect(lowLoad).toBeUndefined();
  });
});
