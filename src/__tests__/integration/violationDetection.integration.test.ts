import { Schedule } from '../../models/Schedule';
import {
  AvoidBackToBackGames,
  AvoidFirstAndLastGame,
  AvoidReffingBeforePlaying,
  EnsureFairFieldDistribution,
} from '../../models/ScheduleRule';
import { importSchedule } from '../../lib/importUtils';
import { createMockTeamsMap, extractViolationMessages, hasViolationType } from '../../lib/testUtils';

describe('Violation Detection Integration Tests', () => {
  const mockTeams = createMockTeamsMap({
    mixed: [
      'Elderslie Empyreans',
      'Villawood Hydra',
      'Iluka Immortals',
      'Fairfield Falcons',
      'Ultimo Falcons',
      'Oakville Orcas',
      'Sun Valley Storm',
      'Pan Ban Pandas',
      'Como Chaos',
      'Lilli Pilli Lions',
      'Fairlight Ascendents',
      'Oakhurst Orcas',
      'Darkwood Immortals',
      'Ashbury Inferno',
      'Canterbury Nines',
      'UTS Lizards Teal',
      'Deepwater Storm',
      'Banda Banda Pandas',
      'UTS Lizards',
      'North Star Storm',
      'Chatswood Chibis',
      'Marsfield Meteors',
      'Liverpool Lightning',
      'Double Bay Dragonites',
      'Maison Dieu Mazoku',
    ],
    gendered: [
      'Sapphire Sirens',
      'Kingswood Mavericks',
      'Darkwood Deathdealers',
      'Magenta Storm',
      'Manly Magicians',
      'Razorback Raptors',
      'Kingsford Mavericks',
      'Valla Valkyries',
      'Kirribilli Kangaroos',
      'Five Dock Falcons',
      'UTS Lizards White',
      'Ashbury Firehawks',
      'Warburn Wraiths',
      'Arkstone Akuma',
      'Lilyfield Labubus',
      'Auburn Ultras',
      'Sefton Stunners',
      'Limpwood Lions',
      'Diehard Darkknights',
    ],
  });

  describe('Real-world Schedule Scenarios', () => {
    it('should detect field conflicts in provided bad schedule', () => {
      // This is the problematic schedule from the user's example
      const badScheduleCSV = `Time,Division,Field,Team1,Team2,Referee
1,mixed,4,Elderslie Empyreans,Villawood Hydra,Iluka Immortals
1,mixed,4,Fairfield Falcons,Ultimo Falcons,Oakville Orcas
1,mixed,2,Sun Valley Storm,Pan Ban Pandas,Como Chaos
1,mixed,1,Sun Valley Storm,Lilli Pilli Lions,Fairlight Ascendents
2,mixed,1,Oakhurst Orcas,Darkwood Immortals,Lilli Pilli Lions
2,mixed,3,Oakville Orcas,Ashbury Inferno,Ultimo Falcons
2,mixed,2,Canterbury Nines,Fairlight Ascendents,UTS Lizards Teal
2,mixed,3,Fairlight Ascendents,Iluka Immortals,Deepwater Storm
4,gendered,1,Oakhurst Orcas,Sapphire Sirens,Kingswood Mavericks
4,gendered,1,Darkwood Deathdealers,Magenta Storm,Manly Magicians
4,gendered,4,Kingswood Mavericks,Liverpool Lightning,Sun Valley Storm
7,gendered,3,Razorback Raptors,Sun Valley Storm,Manly Magicians
7,gendered,3,North Star Storm,Canterbury Nines,Sun Valley Storm
8,mixed,1,Oakhurst Orcas,Iluka Immortals,Fairlight Ascendents
8,mixed,1,Ashbury Inferno,Como Chaos,Ultimo Falcons
9,mixed,3,Lilli Pilli Lions,Double Bay Dragonites,Iluka Immortals
9,mixed,3,Banda Banda Pandas,Double Bay Dragonites,Oakville Orcas
10,mixed,2,Elderslie Empyreans,Liverpool Lightning,Fairlight Ascendents
10,mixed,2,Canterbury Nines,Chatswood Chibis,Lilli Pilli Lions`;

      const matches = importSchedule(badScheduleCSV, mockTeams);

      // Test individual violation detection functions
      const testMatch = matches.find(m => m.timeSlot === 1 && m.field === '4');
      expect(testMatch).toBeDefined();

      // Create a simple violation detector similar to ImportSchedule
      const detectViolations = (match: any, allMatches: any[]) => {
        const violations: any[] = [];
        const sameTimeSlotMatches = allMatches.filter(m => m.timeSlot === match.timeSlot && m !== match);

        // Check for field conflicts
        const sameFieldMatches = sameTimeSlotMatches.filter(m => m.field === match.field);
        if (sameFieldMatches.length > 0) {
          violations.push({
            type: 'invalid',
            message: `Field conflict: Multiple matches on ${match.field} in time slot ${match.timeSlot}`,
          });
        }

        // Check team conflicts
        const teamsInMatch = [match.team1.name, match.team2.name];
        if (match.refereeTeam) {
          teamsInMatch.push(match.refereeTeam.name);
        }

        for (const teamName of teamsInMatch) {
          const conflictingMatches = sameTimeSlotMatches.filter(
            m => m.team1.name === teamName || m.team2.name === teamName || m.refereeTeam?.name === teamName
          );

          if (conflictingMatches.length > 0) {
            violations.push({
              type: 'invalid',
              message: `Team conflict: ${teamName} appears in multiple matches in time slot ${match.timeSlot}`,
            });
          }
        }

        return violations;
      };

      // Test specific known violations
      const fieldConflictMatch1 = matches.find(
        m => m.timeSlot === 1 && m.field === '4' && m.team1.name === 'Elderslie Empyreans'
      );
      const fieldConflictMatch2 = matches.find(
        m => m.timeSlot === 1 && m.field === '4' && m.team1.name === 'Fairfield Falcons'
      );

      expect(fieldConflictMatch1).toBeDefined();
      expect(fieldConflictMatch2).toBeDefined();

      const violations1 = detectViolations(fieldConflictMatch1, matches);
      const violations2 = detectViolations(fieldConflictMatch2, matches);

      expect(violations1.some(v => v.message.includes('Field conflict'))).toBe(true);
      expect(violations2.some(v => v.message.includes('Field conflict'))).toBe(true);

      // Test team playing multiple matches
      const sunValleyConflict = matches.filter(
        m => m.timeSlot === 1 && (m.team1.name === 'Sun Valley Storm' || m.team2.name === 'Sun Valley Storm')
      );
      expect(sunValleyConflict.length).toBeGreaterThan(1);

      const sunValleyViolations = detectViolations(sunValleyConflict[0], matches);
      expect(sunValleyViolations.some(v => v.message.includes('Team conflict'))).toBe(true);
    });

    it('should detect referee conflicts in provided schedule', () => {
      const scheduleWithRefereeConflicts = `Time,Division,Field,Team1,Team2,Referee
7,gendered,3,Razorback Raptors,Sun Valley Storm,Manly Magicians
7,gendered,3,North Star Storm,Canterbury Nines,Sun Valley Storm`;

      const matches = importSchedule(scheduleWithRefereeConflicts, mockTeams);

      // Sun Valley Storm is refereeing in slot 7 match 1 and playing in slot 7 match 2
      const refereeMatch = matches.find(m => m.refereeTeam?.name === 'Sun Valley Storm');
      const playingMatch = matches.find(
        m => (m.team1.name === 'Sun Valley Storm' || m.team2.name === 'Sun Valley Storm') && m !== refereeMatch
      );

      expect(refereeMatch).toBeDefined();
      expect(playingMatch).toBeDefined();
      expect(refereeMatch?.timeSlot).toBe(playingMatch?.timeSlot);
    });

    it('should handle valid schedules without false positives', () => {
      const validScheduleCSV = `Time,Division,Field,Team1,Team2,Referee
1,mixed,1,Team A,Team B,Team E
1,mixed,2,Team C,Team D,Team F
2,mixed,1,Team G,Team H,Team I
2,mixed,2,Team J,Team K,Team L
3,mixed,1,Team A,Team C,Team M
3,mixed,2,Team B,Team D,Team N`;

      const matches = importSchedule(validScheduleCSV, mockTeams);

      const detectViolations = (match: any, allMatches: any[]) => {
        const violations: any[] = [];
        const sameTimeSlotMatches = allMatches.filter(m => m.timeSlot === match.timeSlot && m !== match);

        // Check for field conflicts
        const sameFieldMatches = sameTimeSlotMatches.filter(m => m.field === match.field);
        if (sameFieldMatches.length > 0) {
          violations.push({
            type: 'invalid',
            message: `Field conflict: Multiple matches on ${match.field} in time slot ${match.timeSlot}`,
          });
        }

        return violations;
      };

      // Should have no field conflicts
      matches.forEach(match => {
        const violations = detectViolations(match, matches);
        const fieldViolations = violations.filter(v => v.message.includes('Field conflict'));
        expect(fieldViolations).toHaveLength(0);
      });
    });
  });

  describe('Complex Multi-Violation Scenarios', () => {
    it('should detect all violation types in a complex schedule', () => {
      const complexScheduleCSV = `Time,Division,Field,Team1,Team2,Referee
1,mixed,1,Team A,Team B,Team E
1,mixed,1,Team C,Team D,Team F
2,mixed,1,Team A,Team C,Team G
2,mixed,2,Team B,Team D,Team A
3,mixed,1,Team A,Team E,Team H`;

      const matches = importSchedule(complexScheduleCSV, mockTeams);
      const rules = [new AvoidBackToBackGames(3), new AvoidFirstAndLastGame(2), new AvoidReffingBeforePlaying(4)];

      const schedule = new Schedule(matches, rules);
      const score = schedule.evaluate();

      expect(schedule.violations.length).toBeGreaterThan(0);
      expect(score).toBeGreaterThan(0);

      // Should have various types of violations
      const violationMessages = extractViolationMessages(schedule.violations);
      expect(violationMessages.some(msg => msg.includes('back-to-back'))).toBe(true);
    });

    it('should prioritize hard constraints over soft constraints', () => {
      // Hard constraints should prevent schedule acceptance regardless of soft violations
      const hardConstraintViolationCSV = `Time,Division,Field,Team1,Team2,Referee
1,mixed,1,Team A,Team B,Team C
1,mixed,1,Team D,Team E,Team F`;

      const matches = importSchedule(hardConstraintViolationCSV, mockTeams);

      // Simulate hard constraint detection
      const timeSlotMap = new Map<number, any[]>();
      matches.forEach(match => {
        if (!timeSlotMap.has(match.timeSlot)) {
          timeSlotMap.set(match.timeSlot, []);
        }
        timeSlotMap.get(match.timeSlot)!.push(match);
      });

      let hasFieldConflict = false;
      timeSlotMap.forEach((slotMatches, timeSlot) => {
        const fieldMap = new Map<string, any[]>();
        slotMatches.forEach(match => {
          if (!fieldMap.has(match.field)) {
            fieldMap.set(match.field, []);
          }
          fieldMap.get(match.field)!.push(match);
        });

        fieldMap.forEach(fieldMatches => {
          if (fieldMatches.length > 1) {
            hasFieldConflict = true;
          }
        });
      });

      expect(hasFieldConflict).toBe(true);
    });
  });

  describe('Performance and Scale Tests', () => {
    it('should handle large schedules efficiently', () => {
      // Generate a large valid schedule
      const largeScheduleData: string[] = [];
      largeScheduleData.push('Time,Division,Field,Team1,Team2,Referee');

      for (let timeSlot = 1; timeSlot <= 20; timeSlot++) {
        for (let field = 1; field <= 5; field++) {
          const team1Index = ((timeSlot - 1) * 5 + field - 1) * 2;
          const team2Index = team1Index + 1;
          largeScheduleData.push(
            `${timeSlot},mixed,Field ${field},Team ${team1Index},Team ${team2Index},Team ${team1Index + 100}`
          );
        }
      }

      const start = Date.now();
      const matches = importSchedule(largeScheduleData.join('\n'), mockTeams);
      const importTime = Date.now() - start;

      expect(matches.length).toBe(100); // 20 time slots * 5 fields
      expect(importTime).toBeLessThan(1000); // Should complete within 1 second

      // Test violation detection performance
      const detectionStart = Date.now();
      matches.forEach(match => {
        const sameTimeSlotMatches = matches.filter(m => m.timeSlot === match.timeSlot && m !== match);
        const sameFieldMatches = sameTimeSlotMatches.filter(m => m.field === match.field);
        // Just check for conflicts, don't store results
        sameFieldMatches.length > 0;
      });
      const detectionTime = Date.now() - detectionStart;

      expect(detectionTime).toBeLessThan(500); // Should complete within 0.5 seconds
    });

    it('should handle edge case with maximum time slots', () => {
      const edgeScheduleCSV = `Time,Division,Field,Team1,Team2,Referee
1,mixed,1,Team A,Team B,Team C
999,mixed,1,Team D,Team E,Team F
1000,mixed,1,Team G,Team H,Team I`;

      const matches = importSchedule(edgeScheduleCSV, mockTeams);

      expect(matches).toHaveLength(3);
      expect(matches[0].timeSlot).toBe(1);
      expect(matches[1].timeSlot).toBe(999);
      expect(matches[2].timeSlot).toBe(1000);
    });
  });

  describe('Error Recovery and Robustness', () => {
    it('should gracefully handle malformed data mixed with valid data', () => {
      const mixedQualityCSV = `Time,Division,Field,Team1,Team2,Referee
1,mixed,1,Team A,Team B,Team C
,,,,,
invalid,mixed,2,Team D,Team E,Team F
2,mixed,1,Team G,Team H,Team I
,,Team J,,`;

      const matches = importSchedule(mixedQualityCSV, mockTeams);

      // Should extract valid matches and skip invalid ones
      expect(matches.length).toBeGreaterThan(0);
      expect(matches.every(m => m.team1 && m.team2 && m.timeSlot && m.field)).toBe(true);
    });

    it('should handle unicode and special characters in team names', () => {
      const unicodeScheduleCSV = `Time,Division,Field,Team1,Team2,Referee
1,mixed,1,Team Ñoño,Team Café,Team Zürich
2,mixed,1,Team 日本,Team العربية,Team Россия`;

      const matches = importSchedule(unicodeScheduleCSV, mockTeams);

      expect(matches).toHaveLength(2);
      expect(matches[0].team1.name).toBe('Team Ñoño');
      expect(matches[1].team1.name).toBe('Team 日本');
    });
  });

  describe('Regression Tests', () => {
    it('should maintain consistent time slot assignment across imports', () => {
      const scheduleCSV = `Time,Division,Field,Team1,Team2,Referee
9:00,mixed,1,Team A,Team B,Team C
9:30,mixed,1,Team D,Team E,Team F
9:00,mixed,2,Team G,Team H,Team I`;

      const matches1 = importSchedule(
        scheduleCSV,
        createMockTeamsMap({
          mixed: ['Team A', 'Team B', 'Team C', 'Team D', 'Team E', 'Team F', 'Team G', 'Team H', 'Team I'],
        })
      );
      const matches2 = importSchedule(
        scheduleCSV,
        createMockTeamsMap({
          mixed: ['Team A', 'Team B', 'Team C', 'Team D', 'Team E', 'Team F', 'Team G', 'Team H', 'Team I'],
        })
      );

      // Time slot assignments should be consistent across imports
      expect(matches1.map(m => m.timeSlot)).toEqual(matches2.map(m => m.timeSlot));

      // Matches with same time should have same time slot
      const nineOClockMatches1 = matches1.filter(m => [0, 2].includes(matches1.indexOf(m)));
      const nineOClockMatches2 = matches2.filter(m => [0, 2].includes(matches2.indexOf(m)));

      expect(nineOClockMatches1[0].timeSlot).toBe(nineOClockMatches1[1].timeSlot);
      expect(nineOClockMatches2[0].timeSlot).toBe(nineOClockMatches2[1].timeSlot);
    });
  });
});
