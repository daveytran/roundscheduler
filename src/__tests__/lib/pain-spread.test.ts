import { calculatePainSpreadMetrics } from '../../lib/pain-spread';
import { RuleViolation } from '../../models/RuleViolation';

describe('pain spread concentration scope', () => {
  it('excludes league-attributed pain from concentration penalty', () => {
    const violations: RuleViolation[] = [
      {
        rule: 'Entity Rule',
        description: 'Team A has back-to-back games',
        level: 'warning',
        painPoints: 10,
        concentrationScope: 'entity',
      },
      {
        rule: 'League Rule',
        description: 'Time slot 2 has multiple divisions: mixed, cloth',
        level: 'warning',
        painPoints: 10,
        concentrationScope: 'league',
      },
    ];

    const metrics = calculatePainSpreadMetrics(violations, 20);

    expect(metrics.totalPainScore).toBe(20);
    expect(metrics.concentrationEligiblePainScore).toBe(10);
    expect(metrics.leagueAttributedPainScore).toBe(10);
    expect(metrics.combinedConcentration).toBe(1);
    expect(metrics.concentrationPenaltyScore).toBe(3.5);
    expect(metrics.objectiveScore).toBe(23.5);
  });

  it('does not apply concentration penalty when all pain is league-attributed', () => {
    const violations: RuleViolation[] = [
      {
        rule: 'League Rule',
        description: 'Time slot 4 has multiple divisions: mixed, gendered',
        level: 'warning',
        painPoints: 8,
        concentrationScope: 'league',
      },
    ];

    const metrics = calculatePainSpreadMetrics(violations, 8);

    expect(metrics.totalPainScore).toBe(8);
    expect(metrics.concentrationEligiblePainScore).toBe(0);
    expect(metrics.leagueAttributedPainScore).toBe(8);
    expect(metrics.concentrationPenaltyScore).toBe(0);
    expect(metrics.objectiveScore).toBe(8);
  });
});
