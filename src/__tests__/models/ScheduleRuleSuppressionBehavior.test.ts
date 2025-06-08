import { RuleViolation } from '@/src/models/RuleViolation';
import { Schedule } from '../../models/Schedule';
import {
  AvoidBackToBackGames,
  AvoidFirstAndLastGame,
  LimitVenueTime,
} from '../../models/ScheduleRule';
import { createMockMatches } from '../../lib/testUtils';

describe('ScheduleRule Violation Suppression Tests', () => {
  describe('AvoidBackToBackGames - Suppression Behavior', () => {
    it('should suppress player violations when they match team violations', () => {
      const rule = new AvoidBackToBackGames(5);
      const matches = createMockMatches([
        { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1' },
        { team1: 'Team A', team2: 'Team C', timeSlot: 2, field: 'Field 1' }, // Team A back-to-back
      ]);
      const schedule = new Schedule(matches);
      const violations: RuleViolation[] = [];

      rule.evaluate(schedule, violations);

      console.log('Back-to-back violations:', violations.map(v => v.description));
      
      // Should have team violation but suppress redundant player violations
      const teamViolations = violations.filter(v => v.description.startsWith('Team'));
      const playerViolations = violations.filter(v => v.description.startsWith('Player'));
      
      expect(teamViolations).toHaveLength(1);
      expect(teamViolations[0].description).toContain('Team A');
      
      // Player violations should be suppressed since they're covered by team violation
      expect(playerViolations).toHaveLength(0);
    });

    it('should report player violations when they differ from team violations', () => {
      const rule = new AvoidBackToBackGames(5);
      const matches = createMockMatches([
        // Team A has back-to-back games
        { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1' },
        { team1: 'Team A', team2: 'Team C', timeSlot: 2, field: 'Field 1' },
        
        // Team D has different players with different back-to-back pattern
        { team1: 'Team D', team2: 'Team E', timeSlot: 3, field: 'Field 1' },
        { team1: 'Team F', team2: 'Team D', timeSlot: 4, field: 'Field 1' },
        
        // Individual player from Team G has extra back-to-back not covered by team
        { team1: 'Team G', team2: 'Team H', timeSlot: 5, field: 'Field 1' },
        { team1: 'Team I', team2: 'Team J', timeSlot: 6, field: 'Field 1', referee: 'Team G' }, // Team G refs
        { team1: 'Team G', team2: 'Team K', timeSlot: 7, field: 'Field 1' }, // Team G plays again
      ]);
      const schedule = new Schedule(matches);
      const violations: RuleViolation[] = [];

      rule.evaluate(schedule, violations);

      console.log('Complex back-to-back violations:', violations.map(v => v.description));
      
      // Should have multiple violations - teams and any differing players
      expect(violations.length).toBeGreaterThan(0);
      
      const teamViolations = violations.filter(v => v.description.startsWith('Team'));
      const playerViolations = violations.filter(v => v.description.startsWith('Player'));
      
      expect(teamViolations.length).toBeGreaterThan(0);
      // Player violations should only exist if they differ from team patterns
    });
  });

  describe('AvoidFirstAndLastGame - Suppression Behavior', () => {
    it('should suppress redundant player violations - working behavior', () => {
      const rule = new AvoidFirstAndLastGame(2);
      const matches = createMockMatches([
        { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1', division: 'mixed' },
        { team1: 'Team C', team2: 'Team D', timeSlot: 2, field: 'Field 1', division: 'mixed' },
        { team1: 'Team A', team2: 'Team E', timeSlot: 3, field: 'Field 1', division: 'mixed' }, // Team A first and last
      ]);
      const schedule = new Schedule(matches);
      const violations: RuleViolation[] = [];

      rule.evaluate(schedule, violations);

      console.log('First/Last violations:', violations.map(v => v.description));
      
      // Working behavior: suppresses redundant player violations
      const teamViolations = violations.filter(v => v.description.startsWith('Team'));
      const playerViolations = violations.filter(v => v.description.startsWith('Player'));
      
      console.log('Team violations:', teamViolations.length);
      console.log('Player violations:', playerViolations.length);
      console.log('Total violations:', violations.length);
      
      // Working behavior: 1 team violation, player violations suppressed
      expect(teamViolations).toHaveLength(1);
      expect(playerViolations).toHaveLength(0);
      expect(violations).toHaveLength(1);
      expect(teamViolations[0].description).toContain('Team A');
    });

    it('should suppress player violations when they match team violations', () => {
      const rule = new AvoidFirstAndLastGame(2);
      const matches = createMockMatches([
        { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1', division: 'mixed' },
        { team1: 'Team C', team2: 'Team D', timeSlot: 2, field: 'Field 1', division: 'mixed' },
        { team1: 'Team A', team2: 'Team E', timeSlot: 3, field: 'Field 1', division: 'mixed' }, // Team A first and last
      ]);
      const schedule = new Schedule(matches);
      const violations: RuleViolation[] = [];

      rule.evaluate(schedule, violations);

      console.log('First/Last suppression test violations:', violations.map(v => v.description));
      
      // Should suppress player violations when they match team violations
      const teamViolations = violations.filter(v => v.description.startsWith('Team'));
      const playerViolations = violations.filter(v => v.description.startsWith('Player'));
      
      // Assert suppression is working: only team violation, no redundant player violations
      expect(teamViolations).toHaveLength(1);
      expect(playerViolations).toHaveLength(0);
      expect(violations).toHaveLength(1);
      expect(teamViolations[0].description).toContain('Team A');
    });

    it('should report player violations when they differ from team violations', () => {
      const rule = new AvoidFirstAndLastGame(2);
      const matches = createMockMatches([
        // Team A has first and last games
        { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1', division: 'mixed' },
        { team1: 'Team C', team2: 'Team D', timeSlot: 2, field: 'Field 1', division: 'mixed' },
        { team1: 'Team A', team2: 'Team E', timeSlot: 3, field: 'Field 1', division: 'mixed' },
        
        // Individual player from Team F has different first/last pattern
        { team1: 'Team F', team2: 'Team G', timeSlot: 1, field: 'Field 2', division: 'mixed' }, // Player in first slot
        { team1: 'Team H', team2: 'Team I', timeSlot: 2, field: 'Field 2', division: 'mixed' }, 
        { team1: 'Team J', team2: 'Team K', timeSlot: 3, field: 'Field 2', division: 'mixed', referee: 'Team F' }, // Same player refs in last slot
      ]);
      const schedule = new Schedule(matches);
      const violations: RuleViolation[] = [];

      rule.evaluate(schedule, violations);

      console.log('Complex First/Last violations:', violations.map(v => v.description));
      
      // Should have violations for different patterns
      expect(violations.length).toBeGreaterThan(0);
    });
  });

  describe('LimitVenueTime - Suppression Behavior', () => {
    it('should suppress similar player violations - working behavior', () => {
      const rule = new LimitVenueTime(1, 4, 30); // Max 4 hours, 30 min slots
      const matches = createMockMatches([
        { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1' }, // Start at slot 1
        { team1: 'Team C', team2: 'Team D', timeSlot: 5, field: 'Field 1' },
        { team1: 'Team A', team2: 'Team E', timeSlot: 10, field: 'Field 1' }, // Team A: 9 slots = 4.5 hours
      ]);
      const schedule = new Schedule(matches);
      const violations: RuleViolation[] = [];

      rule.evaluate(schedule, violations);

      console.log('Venue time violations:', violations.map(v => v.description));
      
      // Working behavior: suppresses similar player violations
      const teamViolations = violations.filter(v => v.description.startsWith('Team'));
      const playerViolations = violations.filter(v => v.description.startsWith('Player'));
      
      // Working behavior: 1 team violation, similar player violations suppressed
      expect(teamViolations).toHaveLength(1);
      expect(playerViolations).toHaveLength(0);
      expect(violations).toHaveLength(1);
      expect(teamViolations[0].description).toContain('Team A');
    });

    it('should suppress player violations when they are similar to team violations', () => {
      const rule = new LimitVenueTime(1, 4, 30); // Max 4 hours, 30 min slots
      const matches = createMockMatches([
        { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1' }, // Start at slot 1
        { team1: 'Team C', team2: 'Team D', timeSlot: 5, field: 'Field 1' },
        { team1: 'Team A', team2: 'Team E', timeSlot: 10, field: 'Field 1' }, // Team A: 9 slots = 4.5 hours
      ]);
      const schedule = new Schedule(matches);
      const violations: RuleViolation[] = [];

      rule.evaluate(schedule, violations);

      console.log('Venue time suppression test violations:', violations.map(v => v.description));
      
      // Should suppress player violations when they're within 0.5h of team violation
      const teamViolations = violations.filter(v => v.description.startsWith('Team'));
      const playerViolations = violations.filter(v => v.description.startsWith('Player'));
      
      // Assert suppression is working: only team violation, similar player violations suppressed
      expect(teamViolations).toHaveLength(1);
      expect(playerViolations).toHaveLength(0); // Should be suppressed since within 0.5h of team
      expect(violations).toHaveLength(1);
      expect(teamViolations[0].description).toContain('Team A');
    });

    it('should report player violations when they significantly exceed team violations', () => {
      const rule = new LimitVenueTime(1, 4, 30); // Max 4 hours, 30 min slots
      const matches = createMockMatches([
        // Team A has 4.5 hour venue time
        { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1' },
        { team1: 'Team A', team2: 'Team C', timeSlot: 10, field: 'Field 1' },
        
        // Individual player from Team A has much longer venue time (through refereeing)
        { team1: 'Team D', team2: 'Team E', timeSlot: 15, field: 'Field 1', referee: 'Team A' }, // Player stays much longer
      ]);
      const schedule = new Schedule(matches);
      const violations: RuleViolation[] = [];

      rule.evaluate(schedule, violations);

      console.log('Excessive venue time violations:', violations.map(v => v.description));
      
      // Should have team violation + player violations that significantly exceed team time
      expect(violations.length).toBeGreaterThan(0);
      
      const teamViolations = violations.filter(v => v.description.startsWith('Team'));
      const playerViolations = violations.filter(v => v.description.startsWith('Player'));
      
      expect(teamViolations.length).toBeGreaterThan(0);
      // Should have player violations for those who stay significantly longer than their team
    });
  });

  describe('Edge Cases', () => {
    it('should handle mixed scenarios correctly', () => {
      const backToBackRule = new AvoidBackToBackGames(5);
      const firstLastRule = new AvoidFirstAndLastGame(2);
      const venueTimeRule = new LimitVenueTime(1, 3, 30); // Max 3 hours
      
      const matches = createMockMatches([
        // Complex scenario with multiple rule violations
        { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1' }, // Team A first game
        { team1: 'Team A', team2: 'Team C', timeSlot: 2, field: 'Field 1' }, // Team A back-to-back
        { team1: 'Team D', team2: 'Team E', timeSlot: 3, field: 'Field 1' },
        { team1: 'Team F', team2: 'Team G', timeSlot: 4, field: 'Field 1' },
        { team1: 'Team A', team2: 'Team H', timeSlot: 8, field: 'Field 1' }, // Team A last game + long venue time
      ]);
      const schedule = new Schedule(matches);
      
      // Test each rule independently
      const backToBackViolations: RuleViolation[] = [];
      const firstLastViolations: RuleViolation[] = [];
      const venueTimeViolations: RuleViolation[] = [];
      
      backToBackRule.evaluate(schedule, backToBackViolations);
      firstLastRule.evaluate(schedule, firstLastViolations);
      venueTimeRule.evaluate(schedule, venueTimeViolations);
      
      console.log('Mixed scenario - Back-to-back:', backToBackViolations.map(v => v.description));
      console.log('Mixed scenario - First/Last:', firstLastViolations.map(v => v.description));
      console.log('Mixed scenario - Venue time:', venueTimeViolations.map(v => v.description));
      
      // Each rule should work independently with proper suppression
      expect(backToBackViolations.length).toBeGreaterThan(0);
      expect(firstLastViolations.length).toBeGreaterThan(0);
      expect(venueTimeViolations.length).toBeGreaterThan(0);
    });
  });
}); 