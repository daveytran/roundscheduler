import { RuleViolation } from '@/src/models/RuleViolation';
import { Schedule } from '../../models/Schedule';
import {
  AvoidBackToBackGames,
  AvoidFirstAndLastGame,
  AvoidReffingBeforePlaying,
  LimitVenueTime,
  EnsureFairFieldDistribution,
} from '../../models/ScheduleRule';
import { testScenarios, createMockMatches } from '../../lib/testUtils';

describe('ScheduleRule Tests', () => {
  describe('AvoidBackToBackGames', () => {
    it('should detect back-to-back games for teams', () => {
      const rule = new AvoidBackToBackGames(3);
      const matches = testScenarios.backToBackGames();
      const schedule = new Schedule(matches);
      const violations: RuleViolation[] = [];

      rule.evaluate(schedule, violations);

      expect(violations).toHaveLength(1);
      expect(violations[0].description).toContain('Team A');
      expect(violations[0].description).toContain('back-to-back');
      expect(violations[0].description).toContain('time slots 1 and 2');
    });

    it('should not detect violations when teams have rest between games', () => {
      const rule = new AvoidBackToBackGames(3);
      const matches = createMockMatches([
        { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1' },
        { team1: 'Team A', team2: 'Team C', timeSlot: 3, field: 'Field 1' }, // Gap between 1 and 3
      ]);
      const schedule = new Schedule(matches);
      const violations: RuleViolation[] = [];

      rule.evaluate(schedule, violations);

      expect(violations).toHaveLength(0);
    });

    it('should detect multiple back-to-back violations', () => {
      const rule = new AvoidBackToBackGames(3);
      const matches = createMockMatches([
        { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1' },
        { team1: 'Team A', team2: 'Team C', timeSlot: 2, field: 'Field 1' }, // Team A back-to-back
        { team1: 'Team B', team2: 'Team D', timeSlot: 2, field: 'Field 2' },
        { team1: 'Team B', team2: 'Team E', timeSlot: 3, field: 'Field 1' }, // Team B back-to-back
      ]);
      const schedule = new Schedule(matches);
      const violations: RuleViolation[] = [];

      rule.evaluate(schedule, violations);

      expect(violations).toHaveLength(2);
      expect(violations.some(v => v.description.includes('Team A'))).toBe(true);
      expect(violations.some(v => v.description.includes('Team B'))).toBe(true);
    });

    it('should NOT flag teams playing then reffing ', () => {
      const rule = new AvoidBackToBackGames(3);
      const matches = createMockMatches([
        { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1' }, // Team A plays
        { team1: 'Team C', team2: 'Team D', timeSlot: 2, field: 'Field 1', referee: 'Team A' }, // Then Team A refs
        { team1: 'Team B', team2: 'Team G', timeSlot: 4, field: 'Field 1' }, // Then Team B plays
      ]);
      const schedule = new Schedule(matches);
      const violations: RuleViolation[] = [];

      rule.evaluate(schedule, violations);

      // Should have no back-to-back violations because playing+reffing is allowed
      expect(violations).toHaveLength(0);
    });
  });

  describe('AvoidFirstAndLastGame', () => {
    it('should detect teams with first and last games but suppress redundant player violations', () => {
      const rule = new AvoidFirstAndLastGame(2);
      const matches = createMockMatches([
        { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1', division: 'mixed' },
        { team1: 'Team C', team2: 'Team D', timeSlot: 2, field: 'Field 1', division: 'mixed' },
        { team1: 'Team A', team2: 'Team E', timeSlot: 3, field: 'Field 1', division: 'mixed' }, // Team A first and last
      ]);
      const schedule = new Schedule(matches);
      const violations: RuleViolation[] = [];

      rule.evaluate(schedule, violations);

      // Should only have the team violation, player violations should be suppressed since they're covered by team violation
      expect(violations).toHaveLength(1);
      expect(violations[0].description).toContain('Team A');
      expect(violations[0].description).toContain('first period (setup + first game) and last period (last game + packdown) of the day');
    });

    it('should not flag teams when they only have first OR last game', () => {
      const rule = new AvoidFirstAndLastGame(2);
      const matches = createMockMatches([
        { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1', division: 'mixed' }, // Team A first
        { team1: 'Team C', team2: 'Team D', timeSlot: 2, field: 'Field 1', division: 'mixed' },
        { team1: 'Team C', team2: 'Team E', timeSlot: 3, field: 'Field 1', division: 'mixed' }, // Team C last
      ]);
      const schedule = new Schedule(matches);
      const violations: RuleViolation[] = [];

      rule.evaluate(schedule, violations);

      expect(violations).toHaveLength(0);
    });
  });

  describe('AvoidReffingBeforePlaying', () => {
    it('should detect teams refereeing before playing', () => {
      const rule = new AvoidReffingBeforePlaying(4);
      const matches = createMockMatches([
        { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1', referee: 'Team C' },
        { team1: 'Team C', team2: 'Team D', timeSlot: 2, field: 'Field 1' }, // Team C refs then plays
      ]);
      const schedule = new Schedule(matches);
      const violations: RuleViolation[] = [];

      rule.evaluate(schedule, violations);

      expect(violations).toHaveLength(1);
      expect(violations[0].description).toContain('Team C');
      expect(violations[0].description).toContain('referees in slot 1 and plays in slot 2');
    });

    it('should not flag teams when they play before refereeing', () => {
      const rule = new AvoidReffingBeforePlaying(4);
      const matches = createMockMatches([
        { team1: 'Team C', team2: 'Team D', timeSlot: 1, field: 'Field 1' }, // Team C plays first
        { team1: 'Team A', team2: 'Team B', timeSlot: 2, field: 'Field 1', referee: 'Team C' }, // Then refs
      ]);
      const schedule = new Schedule(matches);
      const violations: RuleViolation[] = [];

      rule.evaluate(schedule, violations);

      expect(violations).toHaveLength(0);
    });
  });



  describe('EnsureFairFieldDistribution', () => {
    it('should detect unfair field distribution for teams', () => {
      const rule = new EnsureFairFieldDistribution(1);
      const matches = createMockMatches([
        { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1' },
        { team1: 'Team A', team2: 'Team C', timeSlot: 2, field: 'Field 1' },
        { team1: 'Team A', team2: 'Team D', timeSlot: 3, field: 'Field 1' }, // Team A plays 3/3 games on Field 1
      ]);
      const schedule = new Schedule(matches);
      const violations: RuleViolation[] = [];

      rule.evaluate(schedule, violations);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some(v => v.description.includes('Team A plays') && v.description.includes('Field 1'))).toBe(
        true
      );
    });
  });

  describe('Rule Priority System', () => {
    it('should respect rule priorities when calculating scores', () => {
      const highPriorityRule = new AvoidBackToBackGames(10);
      const lowPriorityRule = new AvoidFirstAndLastGame(1);

      expect(highPriorityRule.priority).toBe(10);
      expect(lowPriorityRule.priority).toBe(1);

      const matches = testScenarios.backToBackGames();
      const schedule = new Schedule(matches);
      const rules = [highPriorityRule, lowPriorityRule];

      const score = schedule.evaluate(rules);

      // Should have violations and score should reflect priorities
      expect(schedule.violations.length).toBeGreaterThan(0);
      expect(score).toBeGreaterThan(0);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle schedules with multiple types of violations', () => {
      const rules = [new AvoidBackToBackGames(3), new AvoidFirstAndLastGame(2), new AvoidReffingBeforePlaying(4)];

      const matches = testScenarios.complexViolations();
      const schedule = new Schedule(matches);

      const score = schedule.evaluate(rules);

      expect(schedule.violations.length).toBeGreaterThan(0);
      expect(score).toBeGreaterThan(0);

      // Should have violations from multiple rules
      const ruleNames = schedule.violations.map(v => v.rule);
      expect(new Set(ruleNames).size).toBeGreaterThan(1);
    });

    it('should handle valid schedules without violations', () => {
      const rules = [new AvoidBackToBackGames(3), new AvoidFirstAndLastGame(2), new AvoidReffingBeforePlaying(4)];

      const matches = testScenarios.validSchedule();
      const schedule = new Schedule(matches);

      const score = schedule.evaluate(rules);

      expect(schedule.violations).toHaveLength(0);
      expect(score).toBe(0);
    });
  });
});
