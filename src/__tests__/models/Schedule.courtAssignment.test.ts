import { Schedule } from '../../models/Schedule';
import { createMockMatches, createMockTeamsMap } from '../../lib/testUtils';

describe('Schedule Court Assignment', () => {
  // Test helper to create a schedule with multiple courts
  const createScheduleWithMultipleCourts = (numCourts: number = 4, numMatches: number = 20) => {
    const courts = Array.from({ length: numCourts }, (_, i) => `Field ${i + 1}`);
    
    const matchData = Array.from({ length: numMatches }, (_, i) => ({
      team1: `Team ${String.fromCharCode(65 + (i * 2))}`, // Team A, C, E, etc.
      team2: `Team ${String.fromCharCode(66 + (i * 2))}`, // Team B, D, F, etc.
      timeSlot: Math.floor(i / numCourts) + 1, // Distribute matches across time slots
      field: courts[i % numCourts], // Cycle through available courts
      division: 'mixed' as const,
    }));

    const matches = createMockMatches(matchData);
    return new Schedule(matches);
  };

  describe('Field Availability Detection', () => {
    test('should correctly identify maximum number of available courts', () => {
      const schedule = createScheduleWithMultipleCourts(4, 20);
      const allFields = Array.from(new Set(schedule.matches.map(m => m.field)));
      
      expect(allFields).toHaveLength(4);
      expect(allFields).toEqual(['Field 1', 'Field 2', 'Field 3', 'Field 4']);
    });

    test('should handle mixed court names correctly', () => {
      const matchData = [
        { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Court 1', division: 'mixed' as const },
        { team1: 'Team C', team2: 'Team D', timeSlot: 1, field: 'Field 2', division: 'mixed' as const },
        { team1: 'Team E', team2: 'Team F', timeSlot: 1, field: 'Pitch A', division: 'mixed' as const },
      ];
      
      const matches = createMockMatches(matchData);
      const schedule = new Schedule(matches);
      
      const allFields = Array.from(new Set(schedule.matches.map(m => m.field)));
      expect(allFields).toHaveLength(3);
      expect(allFields).toContain('Court 1');
      expect(allFields).toContain('Field 2');
      expect(allFields).toContain('Pitch A');
    });
  });

  describe('Field Conflict Detection', () => {
    test('should detect field conflicts in same time slot', () => {
      const matchData = [
        { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1', division: 'mixed' as const },
        { team1: 'Team C', team2: 'Team D', timeSlot: 1, field: 'Field 1', division: 'mixed' as const }, // CONFLICT!
        { team1: 'Team E', team2: 'Team F', timeSlot: 2, field: 'Field 1', division: 'mixed' as const },
      ];
      
      const matches = createMockMatches(matchData);
      const schedule = new Schedule(matches);
      
      // Group matches by time slot and field to detect conflicts
      const timeSlotFieldMap = new Map<string, string[]>();
      
      schedule.matches.forEach(match => {
        const key = `${match.timeSlot}-${match.field}`;
        if (!timeSlotFieldMap.has(key)) {
          timeSlotFieldMap.set(key, []);
        }
        timeSlotFieldMap.get(key)!.push(`${match.team1.name} vs ${match.team2.name}`);
      });
      
      // Check for conflicts (more than one match per time slot per field)
      const conflicts = Array.from(timeSlotFieldMap.entries()).filter(([_, matches]) => matches.length > 1);
      
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0][0]).toBe('1-Field 1'); // Time slot 1, Field 1 has conflict
      expect(conflicts[0][1]).toHaveLength(2); // Two matches assigned to same field/time
    });

    test('should not report conflicts for different time slots on same field', () => {
      const matchData = [
        { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1', division: 'mixed' as const },
        { team1: 'Team C', team2: 'Team D', timeSlot: 2, field: 'Field 1', division: 'mixed' as const }, // OK - different time slot
        { team1: 'Team E', team2: 'Team F', timeSlot: 3, field: 'Field 1', division: 'mixed' as const }, // OK - different time slot
      ];
      
      const matches = createMockMatches(matchData);
      const schedule = new Schedule(matches);
      
      const timeSlotFieldMap = new Map<string, string[]>();
      
      schedule.matches.forEach(match => {
        const key = `${match.timeSlot}-${match.field}`;
        if (!timeSlotFieldMap.has(key)) {
          timeSlotFieldMap.set(key, []);
        }
        timeSlotFieldMap.get(key)!.push(`${match.team1.name} vs ${match.team2.name}`);
      });
      
      const conflicts = Array.from(timeSlotFieldMap.entries()).filter(([_, matches]) => matches.length > 1);
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('Randomization Court Assignment', () => {
    test('should preserve court availability assumption during randomization', () => {
      const schedule = createScheduleWithMultipleCourts(4, 16); // 4 courts, 16 matches (4 time slots)
      
      // Run randomization multiple times to test consistency
      for (let i = 0; i < 10; i++) {
        const randomized = schedule.randomize();
        
        // Check that no two matches are assigned to the same court in the same time slot
        const timeSlotFieldMap = new Map<string, number>();
        
        randomized.matches.forEach(match => {
          const key = `${match.timeSlot}-${match.field}`;
          timeSlotFieldMap.set(key, (timeSlotFieldMap.get(key) || 0) + 1);
        });
        
        // Find any conflicts
        const conflicts = Array.from(timeSlotFieldMap.entries()).filter(([_, count]) => count > 1);
        
        if (conflicts.length > 0) {
          console.log(`❌ Randomization attempt ${i + 1} created field conflicts:`, conflicts);
          console.log('Match details:');
          randomized.matches.forEach(match => {
            console.log(`  Time ${match.timeSlot}, ${match.field}: ${match.team1.name} vs ${match.team2.name}`);
          });
        }
        
        expect(conflicts).toHaveLength(0);
      }
    });

    test('should correctly assign matches when courts < matches per time slot', () => {
      // Create scenario where we have fewer courts than matches that want to run simultaneously
      const schedule = createScheduleWithMultipleCourts(2, 8); // 2 courts, 8 matches
      
      console.log('Original schedule:');
      schedule.matches.forEach(match => {
        console.log(`  Time ${match.timeSlot}, ${match.field}: ${match.team1.name} vs ${match.team2.name}`);
      });
      
      const randomized = schedule.randomize();
      
      console.log('Randomized schedule:');
      randomized.matches.forEach(match => {
        console.log(`  Time ${match.timeSlot}, ${match.field}: ${match.team1.name} vs ${match.team2.name}`);
      });
      
      // Check for conflicts
      const timeSlotFieldMap = new Map<string, number>();
      
      randomized.matches.forEach(match => {
        const key = `${match.timeSlot}-${match.field}`;
        timeSlotFieldMap.set(key, (timeSlotFieldMap.get(key) || 0) + 1);
      });
      
      const conflicts = Array.from(timeSlotFieldMap.entries()).filter(([_, count]) => count > 1);
      expect(conflicts).toHaveLength(0);
    });

    test('should handle the scatter divisions strategy correctly', () => {
      // Force the scatter divisions strategy by testing it many times
      const schedule = createScheduleWithMultipleCourts(3, 12);
      let scatterStrategyTestCount = 0;
      let conflictsFound = 0;
      
      // Run many randomizations to increase chances of hitting the scatter strategy (25% chance)
      for (let i = 0; i < 50; i++) {
        const randomized = schedule.randomize();
        
        // Check if this looks like scatter strategy (divisions spread across non-consecutive slots)
        const divisionTimeSlots = randomized.matches.reduce((acc, match) => {
          if (!acc[match.division]) acc[match.division] = [];
          acc[match.division].push(match.timeSlot);
          return acc;
        }, {} as Record<string, number[]>);
        
        // Sort time slots for each division
        Object.keys(divisionTimeSlots).forEach(div => {
          divisionTimeSlots[div].sort((a, b) => a - b);
        });
        
        // Check for field conflicts
        const timeSlotFieldMap = new Map<string, number>();
        
        randomized.matches.forEach(match => {
          const key = `${match.timeSlot}-${match.field}`;
          timeSlotFieldMap.set(key, (timeSlotFieldMap.get(key) || 0) + 1);
        });
        
        const conflicts = Array.from(timeSlotFieldMap.entries()).filter(([_, count]) => count > 1);
        
        if (conflicts.length > 0) {
          conflictsFound++;
          console.log(`❌ Conflicts found in randomization ${i + 1}:`, conflicts);
        }
        
        scatterStrategyTestCount++;
      }
      
      console.log(`Tested ${scatterStrategyTestCount} randomizations, found ${conflictsFound} with conflicts`);
      expect(conflictsFound).toBe(0);
    });
  });

  describe('Optimization Court Assignment', () => {
    test('should maintain valid court assignments during optimization', async () => {
      const schedule = createScheduleWithMultipleCourts(3, 12);
      const rules: any[] = []; // Empty rules array for this test
      
      let conflictsDetected = false;
      
      const optimized = await schedule.optimize(rules, 100, (info) => {
        // Check current schedule for field conflicts
        if (info.currentSchedule) {
          const timeSlotFieldMap = new Map<string, number>();
          
          info.currentSchedule.matches.forEach(match => {
            const key = `${match.timeSlot}-${match.field}`;
            timeSlotFieldMap.set(key, (timeSlotFieldMap.get(key) || 0) + 1);
          });
          
          const conflicts = Array.from(timeSlotFieldMap.entries()).filter(([_, count]) => count > 1);
          
          if (conflicts.length > 0) {
            conflictsDetected = true;
            console.log(`❌ Field conflicts detected during optimization at iteration ${info.iteration}:`, conflicts);
          }
        }
      });
      
      expect(conflictsDetected).toBe(false);
      
      // Final check on optimized schedule
      const finalTimeSlotFieldMap = new Map<string, number>();
      
      optimized.matches.forEach(match => {
        const key = `${match.timeSlot}-${match.field}`;
        finalTimeSlotFieldMap.set(key, (finalTimeSlotFieldMap.get(key) || 0) + 1);
      });
      
      const finalConflicts = Array.from(finalTimeSlotFieldMap.entries()).filter(([_, count]) => count > 1);
      expect(finalConflicts).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle single court correctly', () => {
      const schedule = createScheduleWithMultipleCourts(1, 5); // 1 court, 5 matches
      
      const randomized = schedule.randomize();
      
      // All matches should be on the same field but different time slots
      const fields = Array.from(new Set(randomized.matches.map(m => m.field)));
      expect(fields).toHaveLength(1);
      
      // Check no conflicts
      const timeSlotFieldMap = new Map<string, number>();
      
      randomized.matches.forEach(match => {
        const key = `${match.timeSlot}-${match.field}`;
        timeSlotFieldMap.set(key, (timeSlotFieldMap.get(key) || 0) + 1);
      });
      
      const conflicts = Array.from(timeSlotFieldMap.entries()).filter(([_, count]) => count > 1);
      expect(conflicts).toHaveLength(0);
    });

    test('should handle more courts than matches', () => {
      const schedule = createScheduleWithMultipleCourts(5, 3); // 5 courts, 3 matches
      
      const randomized = schedule.randomize();
      
      // Should use up to 3 courts (one per match if they're in same time slot, or spread across time slots)
      const usedFields = Array.from(new Set(randomized.matches.map(m => m.field)));
      expect(usedFields.length).toBeGreaterThan(0);
      expect(usedFields.length).toBeLessThanOrEqual(5);
      
      // Check no conflicts
      const timeSlotFieldMap = new Map<string, number>();
      
      randomized.matches.forEach(match => {
        const key = `${match.timeSlot}-${match.field}`;
        timeSlotFieldMap.set(key, (timeSlotFieldMap.get(key) || 0) + 1);
      });
      
      const conflicts = Array.from(timeSlotFieldMap.entries()).filter(([_, count]) => count > 1);
      expect(conflicts).toHaveLength(0);
    });
  });
}); 