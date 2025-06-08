import { Schedule } from '../../models/Schedule';
import { Match } from '../../models/Match';
import { createMockMatches, createMockTeam } from '../../lib/testUtils';

describe('Schedule Swap Methods', () => {
  describe('swapMatches', () => {
    let baseMatches: Match[];

    beforeEach(() => {
      // Create a base set of matches for testing
      baseMatches = createMockMatches([
        { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1' },
        { team1: 'Team C', team2: 'Team D', timeSlot: 2, field: 'Field 2' },
        { team1: 'Team E', team2: 'Team F', timeSlot: 3, field: 'Field 1' },
        { team1: 'Team G', team2: 'Team H', timeSlot: 4, field: 'Field 2' },
      ]);
    });

    test('should successfully swap two unlocked matches', () => {
      const schedule = new Schedule(baseMatches);
      const match1 = schedule.matches[0]; // Team A vs Team B, time slot 1, Field 1
      const match2 = schedule.matches[1]; // Team C vs Team D, time slot 2, Field 2

      const newSchedule = schedule.swapMatches(match1, match2);

      expect(newSchedule).not.toBeNull();
      expect(newSchedule!.matches).toHaveLength(4);

      // Find the swapped matches in the new schedule
      const swappedMatch1 = newSchedule!.matches.find(m => 
        m.team1.name === 'Team A' && m.team2.name === 'Team B'
      );
      const swappedMatch2 = newSchedule!.matches.find(m => 
        m.team1.name === 'Team C' && m.team2.name === 'Team D'
      );

      expect(swappedMatch1!.timeSlot).toBe(2);
      expect(swappedMatch1!.field).toBe('Field 2');
      expect(swappedMatch2!.timeSlot).toBe(1);
      expect(swappedMatch2!.field).toBe('Field 1');
    });

    test('should return null when first match is locked', () => {
      // Create matches with one locked
      const matches = createMockMatches([
        { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1' },
        { team1: 'Team C', team2: 'Team D', timeSlot: 2, field: 'Field 2' },
      ]);
      
      // Lock the first match
      matches[0].locked = true;

      const schedule = new Schedule(matches);
      const match1 = schedule.matches[0];
      const match2 = schedule.matches[1];

      const result = schedule.swapMatches(match1, match2);

      expect(result).toBeNull();
    });

    test('should return null when second match is locked', () => {
      const matches = createMockMatches([
        { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1' },
        { team1: 'Team C', team2: 'Team D', timeSlot: 2, field: 'Field 2' },
      ]);
      
      // Lock the second match
      matches[1].locked = true;

      const schedule = new Schedule(matches);
      const match1 = schedule.matches[0];
      const match2 = schedule.matches[1];

      const result = schedule.swapMatches(match1, match2);

      expect(result).toBeNull();
    });

    test('should return null when both matches are locked', () => {
      const matches = createMockMatches([
        { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1' },
        { team1: 'Team C', team2: 'Team D', timeSlot: 2, field: 'Field 2' },
      ]);
      
      // Lock both matches
      matches[0].locked = true;
      matches[1].locked = true;

      const schedule = new Schedule(matches);
      const match1 = schedule.matches[0];
      const match2 = schedule.matches[1];

      const result = schedule.swapMatches(match1, match2);

      expect(result).toBeNull();
    });

    test('should return null when first match is not found in schedule', () => {
      const schedule = new Schedule(baseMatches);
      
      // Create a match that doesn't exist in the schedule
      const nonExistentMatch = createMockMatches([
        { team1: 'Team X', team2: 'Team Y', timeSlot: 5, field: 'Field 3' }
      ])[0];
      
      const existingMatch = schedule.matches[0];

      const result = schedule.swapMatches(nonExistentMatch, existingMatch);

      expect(result).toBeNull();
    });

    test('should return null when second match is not found in schedule', () => {
      const schedule = new Schedule(baseMatches);
      
      // Create a match that doesn't exist in the schedule
      const nonExistentMatch = createMockMatches([
        { team1: 'Team X', team2: 'Team Y', timeSlot: 5, field: 'Field 3' }
      ])[0];
      
      const existingMatch = schedule.matches[0];

      const result = schedule.swapMatches(existingMatch, nonExistentMatch);

      expect(result).toBeNull();
    });

    test('should return null when both matches are not found in schedule', () => {
      const schedule = new Schedule(baseMatches);
      
      // Create matches that don't exist in the schedule
      const nonExistentMatches = createMockMatches([
        { team1: 'Team X', team2: 'Team Y', timeSlot: 5, field: 'Field 3' },
        { team1: 'Team P', team2: 'Team Q', timeSlot: 6, field: 'Field 4' }
      ]);

      const result = schedule.swapMatches(nonExistentMatches[0], nonExistentMatches[1]);

      expect(result).toBeNull();
    });

    test('should preserve other matches unchanged when swapping', () => {
      const schedule = new Schedule(baseMatches);
      const match1 = schedule.matches[0];
      const match2 = schedule.matches[1];

      const newSchedule = schedule.swapMatches(match1, match2);

      expect(newSchedule).not.toBeNull();
      
      // Check that other matches remain unchanged
      const unchangedMatch1 = newSchedule!.matches.find(m => 
        m.team1.name === 'Team E' && m.team2.name === 'Team F'
      );
      const unchangedMatch2 = newSchedule!.matches.find(m => 
        m.team1.name === 'Team G' && m.team2.name === 'Team H'
      );

      expect(unchangedMatch1!.timeSlot).toBe(3);
      expect(unchangedMatch1!.field).toBe('Field 1');
      expect(unchangedMatch2!.timeSlot).toBe(4);
      expect(unchangedMatch2!.field).toBe('Field 2');
    });

    test('should handle swapping matches with same time slot but different fields', () => {
      const matches = createMockMatches([
        { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1' },
        { team1: 'Team C', team2: 'Team D', timeSlot: 1, field: 'Field 2' },
      ]);

      const schedule = new Schedule(matches);
      const match1 = schedule.matches[0];
      const match2 = schedule.matches[1];

      const newSchedule = schedule.swapMatches(match1, match2);

      expect(newSchedule).not.toBeNull();

      const swappedMatch1 = newSchedule!.matches.find(m => 
        m.team1.name === 'Team A' && m.team2.name === 'Team B'
      );
      const swappedMatch2 = newSchedule!.matches.find(m => 
        m.team1.name === 'Team C' && m.team2.name === 'Team D'
      );

      // Time slots should remain the same, but fields should be swapped
      expect(swappedMatch1!.timeSlot).toBe(1);
      expect(swappedMatch1!.field).toBe('Field 2');
      expect(swappedMatch2!.timeSlot).toBe(1);
      expect(swappedMatch2!.field).toBe('Field 1');
    });
  });

  describe('swapTimeSlots', () => {
    let baseMatches: Match[];

    beforeEach(() => {
      // Create matches with multiple matches per time slot
      baseMatches = createMockMatches([
        // Time slot 1
        { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1' },
        { team1: 'Team C', team2: 'Team D', timeSlot: 1, field: 'Field 2' },
        // Time slot 2
        { team1: 'Team E', team2: 'Team F', timeSlot: 2, field: 'Field 1' },
        { team1: 'Team G', team2: 'Team H', timeSlot: 2, field: 'Field 2' },
        // Time slot 3
        { team1: 'Team I', team2: 'Team J', timeSlot: 3, field: 'Field 1' },
      ]);
    });

    test('should successfully swap two unlocked time slots', () => {
      const schedule = new Schedule(baseMatches);

      const newSchedule = schedule.swapTimeSlots(1, 2);

      expect(newSchedule).not.toBeNull();
      expect(newSchedule!.matches).toHaveLength(5);

      // Check that all matches from time slot 1 are now in time slot 2
      const formerSlot1Matches = newSchedule!.matches.filter(m => 
        (m.team1.name === 'Team A' && m.team2.name === 'Team B') ||
        (m.team1.name === 'Team C' && m.team2.name === 'Team D')
      );
      
      formerSlot1Matches.forEach(match => {
        expect(match.timeSlot).toBe(2);
      });

      // Check that all matches from time slot 2 are now in time slot 1
      const formerSlot2Matches = newSchedule!.matches.filter(m => 
        (m.team1.name === 'Team E' && m.team2.name === 'Team F') ||
        (m.team1.name === 'Team G' && m.team2.name === 'Team H')
      );
      
      formerSlot2Matches.forEach(match => {
        expect(match.timeSlot).toBe(1);
      });

      // Check that time slot 3 remains unchanged
      const unchangedMatches = newSchedule!.matches.filter(m => 
        m.team1.name === 'Team I' && m.team2.name === 'Team J'
      );
      
      expect(unchangedMatches[0].timeSlot).toBe(3);
    });

    test('should return null when any match in first time slot is locked', () => {
      // Lock one match in time slot 1
      baseMatches[0].locked = true;

      const schedule = new Schedule(baseMatches);
      const result = schedule.swapTimeSlots(1, 2);

      expect(result).toBeNull();
    });

    test('should return null when any match in second time slot is locked', () => {
      // Lock one match in time slot 2
      baseMatches[2].locked = true;

      const schedule = new Schedule(baseMatches);
      const result = schedule.swapTimeSlots(1, 2);

      expect(result).toBeNull();
    });

    test('should return null when matches in both time slots are locked', () => {
      // Lock matches in both time slots
      baseMatches[0].locked = true;
      baseMatches[2].locked = true;

      const schedule = new Schedule(baseMatches);
      const result = schedule.swapTimeSlots(1, 2);

      expect(result).toBeNull();
    });

    test('should return null when time slot contains SETUP activity', () => {
      // Create matches with SETUP activity
      const team1 = createMockTeam('Setup Team 1');
      const team2 = createMockTeam('Setup Team 2');
      const setupMatch = new Match(
        team1, 
        team2, 
        1, 
        'Field 1', 
        'mixed', 
        null, 
        'SETUP',
        false
      );

      const matches = [setupMatch, ...baseMatches.slice(1)];
      const schedule = new Schedule(matches);

      const result = schedule.swapTimeSlots(1, 2);

      expect(result).toBeNull();
    });

    test('should return null when time slot contains PACKING_DOWN activity', () => {
      // Create matches with PACKING_DOWN activity
      const team1 = createMockTeam('Packing Team 1');
      const team2 = createMockTeam('Packing Team 2');
      const packingMatch = new Match(
        team1, 
        team2, 
        2, 
        'Field 1', 
        'mixed', 
        null, 
        'PACKING_DOWN',
        false
      );

      const matches = [...baseMatches.slice(0, 2), packingMatch, ...baseMatches.slice(3)];
      const schedule = new Schedule(matches);

      const result = schedule.swapTimeSlots(1, 2);

      expect(result).toBeNull();
    });

    test('should handle swapping when one time slot is empty', () => {
      const schedule = new Schedule(baseMatches);

      // Try to swap with a non-existent time slot
      const result = schedule.swapTimeSlots(1, 99);

      expect(result).not.toBeNull();
      
      // All matches from time slot 1 should now be in time slot 99
      const swappedMatches = result!.matches.filter(m => 
        (m.team1.name === 'Team A' && m.team2.name === 'Team B') ||
        (m.team1.name === 'Team C' && m.team2.name === 'Team D')
      );
      
      swappedMatches.forEach(match => {
        expect(match.timeSlot).toBe(99);
      });
    });

    test('should handle swapping when both time slots are empty', () => {
      const schedule = new Schedule(baseMatches);

      // Try to swap two non-existent time slots
      const result = schedule.swapTimeSlots(98, 99);

      expect(result).not.toBeNull();
      // Original matches should remain unchanged
      expect(result!.matches).toHaveLength(5);
      expect(result!.matches[0].timeSlot).toBe(1);
      expect(result!.matches[4].timeSlot).toBe(3);
    });

    test('should preserve field assignments when swapping time slots', () => {
      const schedule = new Schedule(baseMatches);

      const newSchedule = schedule.swapTimeSlots(1, 2);

      expect(newSchedule).not.toBeNull();

      // Find the match that was originally Team A vs Team B in time slot 1, Field 1
      const swappedMatch = newSchedule!.matches.find(m => 
        m.team1.name === 'Team A' && m.team2.name === 'Team B'
      );

      expect(swappedMatch!.timeSlot).toBe(2);
      expect(swappedMatch!.field).toBe('Field 1'); // Field should be preserved
    });

    test('should handle single match per time slot', () => {
      const matches = createMockMatches([
        { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1' },
        { team1: 'Team C', team2: 'Team D', timeSlot: 3, field: 'Field 1' },
      ]);

      const schedule = new Schedule(matches);
      const newSchedule = schedule.swapTimeSlots(1, 3);

      expect(newSchedule).not.toBeNull();

      const match1 = newSchedule!.matches.find(m => 
        m.team1.name === 'Team A' && m.team2.name === 'Team B'
      );
      const match2 = newSchedule!.matches.find(m => 
        m.team1.name === 'Team C' && m.team2.name === 'Team D'
      );

      expect(match1!.timeSlot).toBe(3);
      expect(match2!.timeSlot).toBe(1);
    });

    test('should handle setup and pack down matches being treated as locked', () => {
      // Create a mixed scenario with regular matches and special activities
      const team1 = createMockTeam('Setup Team');
      const team2 = createMockTeam('Regular Team 1');
      const team3 = createMockTeam('Regular Team 2');
      const team4 = createMockTeam('Regular Team 3');
      
      const setupMatch = new Match(team1, team2, 1, 'Field 1', 'mixed', null, 'SETUP', false);
      const regularMatch = new Match(team3, team4, 2, 'Field 1', 'mixed', null, 'REGULAR', false);

      const matches = [setupMatch, regularMatch];
      const schedule = new Schedule(matches);

      // This should fail because time slot 1 contains a SETUP activity
      const result = schedule.swapTimeSlots(1, 2);

      expect(result).toBeNull();
    });
  });
}); 