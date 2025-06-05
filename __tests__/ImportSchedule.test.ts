import { Team } from '../src/models/Team';
import { Match } from '../src/models/Match';

// Mock the ImportSchedule component functions for testing
// Note: In a real setup, these would be extracted to utility functions or exported from the component

interface ViolationInfo {
  type: 'critical' | 'warning' | 'invalid';
  message: string;
}

interface HardConstraintViolation {
  type: 'invalid';
  message: string;
  matchIndex: number;
}

// Copy of detectViolations function for testing
function detectViolations(match: Match, allMatches: Match[]): ViolationInfo[] {
  const violations: ViolationInfo[] = [];
  const sortedMatches = [...allMatches].sort((a, b) => a.timeSlot - b.timeSlot);
  const currentIndex = sortedMatches.findIndex(m => m === match);

  // Get all teams involved in this match (including referee)
  const teamsInMatch = [match.team1.name, match.team2.name];
  if (match.refereeTeam) {
    teamsInMatch.push(match.refereeTeam.name);
  }

  // Check for same-timeslot conflicts
  const sameTimeSlotMatches = allMatches.filter(m => m.timeSlot === match.timeSlot && m !== match);

  // Check for field conflicts first
  const sameFieldMatches = sameTimeSlotMatches.filter(m => m.field === match.field);
  if (sameFieldMatches.length > 0) {
    violations.push({
      type: 'invalid',
      message: `Field conflict: Multiple matches on ${match.field} in time slot ${match.timeSlot}`,
    });
  }

  // Check team conflicts
  for (const teamName of teamsInMatch) {
    const conflictingMatches = sameTimeSlotMatches.filter(
      m => m.team1.name === teamName || m.team2.name === teamName || m.refereeTeam?.name === teamName
    );

    if (conflictingMatches.length > 0) {
      const isPlaying = match.team1.name === teamName || match.team2.name === teamName;
      const isRefereeing = match.refereeTeam?.name === teamName;

      // Count how many times this team appears in same time slot
      let playingConflicts = 0;
      let refereeingConflicts = 0;

      for (const conflictMatch of conflictingMatches) {
        if (conflictMatch.team1.name === teamName || conflictMatch.team2.name === teamName) {
          playingConflicts++;
        }
        if (conflictMatch.refereeTeam?.name === teamName) {
          refereeingConflicts++;
        }
      }

      if (isPlaying && playingConflicts > 0) {
        violations.push({
          type: 'invalid',
          message: `Team conflict: ${teamName} plays multiple matches in time slot ${match.timeSlot}`,
        });
      }

      if (isRefereeing && refereeingConflicts > 0) {
        violations.push({
          type: 'invalid',
          message: `Referee conflict: ${teamName} referees multiple matches in time slot ${match.timeSlot}`,
        });
      }

      if ((isPlaying && refereeingConflicts > 0) || (isRefereeing && playingConflicts > 0)) {
        violations.push({
          type: 'invalid',
          message: `Dual role conflict: ${teamName} cannot play and referee in time slot ${match.timeSlot}`,
        });
      }
    }
  }

  // Check for consecutive games
  for (const teamName of teamsInMatch) {
    let consecutiveCount = 0;
    let currentStreak = 0;

    // Count consecutive games around current match
    for (let i = 0; i < sortedMatches.length; i++) {
      const m = sortedMatches[i];
      const isTeamInvolved = m.team1.name === teamName || m.team2.name === teamName || m.refereeTeam?.name === teamName;

      if (isTeamInvolved) {
        currentStreak++;
        if (i === currentIndex) {
          consecutiveCount = currentStreak;
        }
      } else {
        if (i < currentIndex) {
          currentStreak = 0;
        } else if (i > currentIndex) {
          break;
        }
      }
    }

    // Also check backwards from current position
    let backwardStreak = 0;
    for (let i = currentIndex; i >= 0; i--) {
      const m = sortedMatches[i];
      const isTeamInvolved = m.team1.name === teamName || m.team2.name === teamName || m.refereeTeam?.name === teamName;

      if (isTeamInvolved) {
        backwardStreak++;
      } else {
        break;
      }
    }

    // Check forward from current position
    let forwardStreak = 0;
    for (let i = currentIndex; i < sortedMatches.length; i++) {
      const m = sortedMatches[i];
      const isTeamInvolved = m.team1.name === teamName || m.team2.name === teamName || m.refereeTeam?.name === teamName;

      if (isTeamInvolved) {
        forwardStreak++;
      } else {
        break;
      }
    }

    const totalConsecutive = Math.max(consecutiveCount, backwardStreak + forwardStreak - 1);

    if (totalConsecutive >= 3) {
      violations.push({
        type: 'critical',
        message: `${teamName}: ${totalConsecutive} consecutive games`,
      });
    } else if (totalConsecutive === 2) {
      violations.push({
        type: 'warning',
        message: `${teamName}: 2 back-to-back games`,
      });
    }
  }

  // Check venue time limits
  const venueMatches = sortedMatches.filter(m => m.field === match.field);
  for (const teamName of teamsInMatch) {
    const teamVenueMatches = venueMatches.filter(
      m => m.team1.name === teamName || m.team2.name === teamName || m.refereeTeam?.name === teamName
    );

    if (teamVenueMatches.length >= 3) {
      const timeSpan = teamVenueMatches[teamVenueMatches.length - 1].timeSlot - teamVenueMatches[0].timeSlot;
      if (timeSpan <= 3) {
        violations.push({
          type: 'warning',
          message: `${teamName}: Extended time at ${match.field}`,
        });
      }
    }
  }

  return violations;
}

// Copy of detectHardConstraintViolations function for testing
function detectHardConstraintViolations(matches: Match[]): HardConstraintViolation[] {
  const violations: HardConstraintViolation[] = [];

  // Group matches by time slot for easier analysis
  const matchesByTimeSlot = new Map<number, Match[]>();
  matches.forEach((match, index) => {
    if (!matchesByTimeSlot.has(match.timeSlot)) {
      matchesByTimeSlot.set(match.timeSlot, []);
    }
    matchesByTimeSlot.get(match.timeSlot)!.push(match);
  });

  // Check each time slot for hard constraint violations
  matchesByTimeSlot.forEach((slotMatches, timeSlot) => {
    // Check for field conflicts
    const fieldToMatches = new Map<string, Match[]>();
    slotMatches.forEach(match => {
      if (match.field) {
        if (!fieldToMatches.has(match.field)) {
          fieldToMatches.set(match.field, []);
        }
        fieldToMatches.get(match.field)!.push(match);
      }
    });

    fieldToMatches.forEach((fieldMatches, field) => {
      if (fieldMatches.length > 1) {
        violations.push({
          type: 'invalid',
          message: `Multiple matches scheduled on ${field} in time slot ${timeSlot}`,
          matchIndex: matches.indexOf(fieldMatches[0]),
        });
      }
    });

    // Check for team conflicts
    const teamToRoles = new Map<string, { playing: Match[]; refereeing: Match[] }>();

    slotMatches.forEach(match => {
      // Track teams playing
      [match.team1.name, match.team2.name].forEach(teamName => {
        if (!teamToRoles.has(teamName)) {
          teamToRoles.set(teamName, { playing: [], refereeing: [] });
        }
        teamToRoles.get(teamName)!.playing.push(match);
      });

      // Track teams refereeing
      if (match.refereeTeam) {
        const refTeamName = match.refereeTeam.name;
        if (!teamToRoles.has(refTeamName)) {
          teamToRoles.set(refTeamName, { playing: [], refereeing: [] });
        }
        teamToRoles.get(refTeamName)!.refereeing.push(match);
      }
    });

    // Check for violations
    teamToRoles.forEach((roles, teamName) => {
      const { playing, refereeing } = roles;

      // Check if team is playing multiple matches
      if (playing.length > 1) {
        violations.push({
          type: 'invalid',
          message: `${teamName} is scheduled to play multiple matches in time slot ${timeSlot}`,
          matchIndex: matches.indexOf(playing[0]),
        });
      }

      // Check if team is refereeing multiple matches
      if (refereeing.length > 1) {
        violations.push({
          type: 'invalid',
          message: `${teamName} is scheduled to referee multiple matches in time slot ${timeSlot}`,
          matchIndex: matches.indexOf(refereeing[0]),
        });
      }

      // Check if team is playing and refereeing simultaneously
      if (playing.length >= 1 && refereeing.length >= 1) {
        violations.push({
          type: 'invalid',
          message: `${teamName} cannot play and referee simultaneously in time slot ${timeSlot}`,
          matchIndex: matches.indexOf(playing[0]),
        });
      }
    });
  });

  return violations;
}

// Helper function to create test teams
function createTeam(name: string, division: 'mixed' | 'gendered' | 'cloth' = 'mixed'): Team {
  return new Team(name, division);
}

// Helper function to create test matches
function createMatch(
  team1Name: string,
  team2Name: string,
  timeSlot: number,
  field: string,
  refereeTeamName?: string,
  division: 'mixed' | 'gendered' | 'cloth' = 'mixed'
): Match {
  const team1 = createTeam(team1Name, division);
  const team2 = createTeam(team2Name, division);
  const refereeTeam = refereeTeamName ? createTeam(refereeTeamName, division) : null;

  return new Match(team1, team2, timeSlot, field, division, refereeTeam);
}

describe('ImportSchedule Violation Detection', () => {
  describe('detectHardConstraintViolations', () => {
    describe('Field Conflicts', () => {
      test('should detect multiple matches on same field at same time', () => {
        const matches = [
          createMatch('Team A', 'Team B', 1, 'Field 1'),
          createMatch('Team C', 'Team D', 1, 'Field 1'), // Same field, same time
          createMatch('Team E', 'Team F', 1, 'Field 2'), // Different field, OK
        ];

        const violations = detectHardConstraintViolations(matches);

        expect(violations).toHaveLength(1);
        expect(violations[0].message).toBe('Multiple matches scheduled on Field 1 in time slot 1');
        expect(violations[0].type).toBe('invalid');
        expect(violations[0].matchIndex).toBe(0);
      });

      test('should not detect field conflicts for different time slots', () => {
        const matches = [
          createMatch('Team A', 'Team B', 1, 'Field 1'),
          createMatch('Team C', 'Team D', 2, 'Field 1'), // Same field, different time
        ];

        const violations = detectHardConstraintViolations(matches);
        expect(violations).toHaveLength(0);
      });

      test('should detect multiple field conflicts in same time slot', () => {
        const matches = [
          createMatch('Team A', 'Team B', 1, 'Field 1'),
          createMatch('Team C', 'Team D', 1, 'Field 1'), // Field 1 conflict
          createMatch('Team E', 'Team F', 1, 'Field 2'),
          createMatch('Team G', 'Team H', 1, 'Field 2'), // Field 2 conflict
        ];

        const violations = detectHardConstraintViolations(matches);
        expect(violations).toHaveLength(2);
        expect(violations.some(v => v.message.includes('Field 1'))).toBeTruthy();
        expect(violations.some(v => v.message.includes('Field 2'))).toBeTruthy();
      });
    });

    describe('Team Playing Conflicts', () => {
      test('should detect team playing multiple matches simultaneously', () => {
        const matches = [
          createMatch('Team A', 'Team B', 1, 'Field 1'),
          createMatch('Team A', 'Team C', 1, 'Field 2'), // Team A playing twice
        ];

        const violations = detectHardConstraintViolations(matches);

        expect(violations).toHaveLength(1);
        expect(violations[0].message).toBe('Team A is scheduled to play multiple matches in time slot 1');
        expect(violations[0].type).toBe('invalid');
      });

      test('should detect multiple teams with playing conflicts', () => {
        const matches = [
          createMatch('Team A', 'Team B', 1, 'Field 1'),
          createMatch('Team A', 'Team C', 1, 'Field 2'), // Team A conflict
          createMatch('Team B', 'Team D', 1, 'Field 3'), // Team B conflict (also in first match)
        ];

        const violations = detectHardConstraintViolations(matches);
        expect(violations).toHaveLength(2);
        expect(violations.some(v => v.message.includes('Team A'))).toBeTruthy();
        expect(violations.some(v => v.message.includes('Team B'))).toBeTruthy();
      });
    });

    describe('Referee Conflicts', () => {
      test('should detect team refereeing multiple matches simultaneously', () => {
        const matches = [
          createMatch('Team A', 'Team B', 1, 'Field 1', 'Team C'),
          createMatch('Team D', 'Team E', 1, 'Field 2', 'Team C'), // Team C refereeing twice
        ];

        const violations = detectHardConstraintViolations(matches);

        expect(violations).toHaveLength(1);
        expect(violations[0].message).toBe('Team C is scheduled to referee multiple matches in time slot 1');
        expect(violations[0].type).toBe('invalid');
      });

      test('should detect team playing and refereeing simultaneously', () => {
        const matches = [
          createMatch('Team A', 'Team B', 1, 'Field 1', 'Team C'),
          createMatch('Team C', 'Team D', 1, 'Field 2'), // Team C playing and refereeing
        ];

        const violations = detectHardConstraintViolations(matches);

        expect(violations).toHaveLength(1);
        expect(violations[0].message).toBe('Team C cannot play and referee simultaneously in time slot 1');
        expect(violations[0].type).toBe('invalid');
      });
    });

    describe('Complex Scenarios', () => {
      test('should detect all violations in complex conflicted schedule', () => {
        const matches = [
          createMatch('Team A', 'Team B', 1, 'Field 1', 'Team E'),
          createMatch('Team C', 'Team D', 1, 'Field 1', 'Team F'), // Field conflict
          createMatch('Team A', 'Team G', 1, 'Field 2', 'Team E'), // Team A playing twice, Team E refereeing twice
          createMatch('Team E', 'Team H', 1, 'Field 3'), // Team E playing and refereeing
        ];

        const violations = detectHardConstraintViolations(matches);

        expect(violations.length).toBeGreaterThanOrEqual(3);
        expect(violations.some(v => v.message.includes('Field 1'))).toBeTruthy();
        expect(violations.some(v => v.message.includes('Team A is scheduled to play multiple'))).toBeTruthy();
        expect(violations.some(v => v.message.includes('Team E'))).toBeTruthy();
      });

      test('should handle empty matches array', () => {
        const violations = detectHardConstraintViolations([]);
        expect(violations).toHaveLength(0);
      });

      test('should handle single match without violations', () => {
        const matches = [createMatch('Team A', 'Team B', 1, 'Field 1', 'Team C')];
        const violations = detectHardConstraintViolations(matches);
        expect(violations).toHaveLength(0);
      });
    });
  });

  describe('detectViolations', () => {
    describe('Field Conflicts', () => {
      test('should detect field conflict for specific match', () => {
        const matches = [createMatch('Team A', 'Team B', 1, 'Field 1'), createMatch('Team C', 'Team D', 1, 'Field 1')];

        const violations = detectViolations(matches[0], matches);

        expect(
          violations.some(
            v => v.type === 'invalid' && v.message === 'Field conflict: Multiple matches on Field 1 in time slot 1'
          )
        ).toBeTruthy();
      });
    });

    describe('Team Conflicts', () => {
      test('should detect team playing multiple matches', () => {
        const matches = [createMatch('Team A', 'Team B', 1, 'Field 1'), createMatch('Team A', 'Team C', 1, 'Field 2')];

        const violations = detectViolations(matches[0], matches);

        expect(
          violations.some(
            v => v.type === 'invalid' && v.message === 'Team conflict: Team A plays multiple matches in time slot 1'
          )
        ).toBeTruthy();
      });

      test('should detect referee conflicts', () => {
        const matches = [
          createMatch('Team A', 'Team B', 1, 'Field 1', 'Team C'),
          createMatch('Team D', 'Team E', 1, 'Field 2', 'Team C'),
        ];

        const violations = detectViolations(matches[0], matches);

        expect(
          violations.some(
            v =>
              v.type === 'invalid' && v.message === 'Referee conflict: Team C referees multiple matches in time slot 1'
          )
        ).toBeTruthy();
      });

      test('should detect dual role conflicts', () => {
        const matches = [
          createMatch('Team A', 'Team B', 1, 'Field 1', 'Team C'),
          createMatch('Team C', 'Team D', 1, 'Field 2'),
        ];

        const violations = detectViolations(matches[0], matches);

        expect(
          violations.some(
            v =>
              v.type === 'invalid' && v.message === 'Dual role conflict: Team C cannot play and referee in time slot 1'
          )
        ).toBeTruthy();
      });
    });

    describe('Consecutive Games', () => {
      test('should detect 2 consecutive games as warning', () => {
        const matches = [
          createMatch('Team A', 'Team B', 1, 'Field 1'),
          createMatch('Team A', 'Team C', 2, 'Field 1'),
          createMatch('Team D', 'Team E', 3, 'Field 1'),
        ];

        const violations = detectViolations(matches[0], matches);

        expect(violations.some(v => v.type === 'warning' && v.message === 'Team A: 2 back-to-back games')).toBeTruthy();
      });

      test('should detect 3+ consecutive games as critical', () => {
        const matches = [
          createMatch('Team A', 'Team B', 1, 'Field 1'),
          createMatch('Team A', 'Team C', 2, 'Field 2'),
          createMatch('Team A', 'Team D', 3, 'Field 3'),
          createMatch('Team E', 'Team F', 4, 'Field 1'),
        ];

        const violations = detectViolations(matches[0], matches);

        expect(violations.some(v => v.type === 'critical' && v.message === 'Team A: 3 consecutive games')).toBeTruthy();
      });

      test('should detect 4+ consecutive games correctly', () => {
        const matches = [
          createMatch('Team A', 'Team B', 1, 'Field 1'),
          createMatch('Team A', 'Team C', 2, 'Field 2'),
          createMatch('Team A', 'Team D', 3, 'Field 3'),
          createMatch('Team A', 'Team E', 4, 'Field 4'),
          createMatch('Team F', 'Team G', 5, 'Field 1'),
        ];

        const violations = detectViolations(matches[1], matches); // Check middle match

        expect(violations.some(v => v.type === 'critical' && v.message === 'Team A: 4 consecutive games')).toBeTruthy();
      });

      test('should not detect consecutive games when there are gaps', () => {
        const matches = [
          createMatch('Team A', 'Team B', 1, 'Field 1'),
          createMatch('Team C', 'Team D', 2, 'Field 2'), // Gap - Team A not playing
          createMatch('Team A', 'Team E', 3, 'Field 3'),
        ];

        const violations = detectViolations(matches[0], matches);

        expect(violations.some(v => v.message.includes('consecutive'))).toBeFalsy();
      });

      test('should detect consecutive games including referee duties', () => {
        const matches = [
          createMatch('Team A', 'Team B', 1, 'Field 1'),
          createMatch('Team C', 'Team D', 2, 'Field 2', 'Team A'), // Team A refereeing
          createMatch('Team A', 'Team E', 3, 'Field 3'),
        ];

        const violations = detectViolations(matches[0], matches);

        expect(violations.some(v => v.type === 'critical' && v.message === 'Team A: 3 consecutive games')).toBeTruthy();
      });
    });

    describe('Venue Time Limits', () => {
      test('should detect extended time at venue', () => {
        const matches = [
          createMatch('Team A', 'Team B', 1, 'Field 1'),
          createMatch('Team A', 'Team C', 2, 'Field 1'),
          createMatch('Team A', 'Team D', 3, 'Field 1'),
          createMatch('Team E', 'Team F', 4, 'Field 2'),
        ];

        const violations = detectViolations(matches[1], matches);

        expect(
          violations.some(v => v.type === 'warning' && v.message === 'Team A: Extended time at Field 1')
        ).toBeTruthy();
      });

      test('should not detect extended time when games are spread out', () => {
        const matches = [
          createMatch('Team A', 'Team B', 1, 'Field 1'),
          createMatch('Team C', 'Team D', 2, 'Field 1'),
          createMatch('Team E', 'Team F', 3, 'Field 1'),
          createMatch('Team A', 'Team G', 5, 'Field 1'), // Gap of 4 time slots
          createMatch('Team A', 'Team H', 6, 'Field 1'),
        ];

        const violations = detectViolations(matches[0], matches);

        expect(violations.some(v => v.message.includes('Extended time'))).toBeFalsy();
      });

      test('should detect extended time including referee duties', () => {
        const matches = [
          createMatch('Team A', 'Team B', 1, 'Field 1'),
          createMatch('Team C', 'Team D', 2, 'Field 1', 'Team A'),
          createMatch('Team A', 'Team E', 3, 'Field 1'),
        ];

        const violations = detectViolations(matches[0], matches);

        expect(
          violations.some(v => v.type === 'warning' && v.message === 'Team A: Extended time at Field 1')
        ).toBeTruthy();
      });
    });

    describe('Edge Cases', () => {
      test('should handle match with no referee', () => {
        const matches = [
          createMatch('Team A', 'Team B', 1, 'Field 1'), // No referee
          createMatch('Team C', 'Team D', 1, 'Field 2'),
        ];

        const violations = detectViolations(matches[0], matches);

        // Should not throw error, and no referee-related violations
        expect(violations.every(v => !v.message.includes('referee'))).toBeTruthy();
      });

      test('should handle single match schedule', () => {
        const matches = [createMatch('Team A', 'Team B', 1, 'Field 1', 'Team C')];

        const violations = detectViolations(matches[0], matches);

        expect(violations).toHaveLength(0);
      });

      test('should handle matches with same teams playing different opponents', () => {
        const matches = [
          createMatch('Team A', 'Team B', 1, 'Field 1'),
          createMatch('Team A', 'Team C', 2, 'Field 1'),
          createMatch('Team B', 'Team D', 3, 'Field 1'),
        ];

        const violations = detectViolations(matches[0], matches);

        // Should detect consecutive games but no simultaneous conflicts
        expect(violations.some(v => v.type === 'invalid')).toBeFalsy();
        expect(violations.some(v => v.type === 'warning' && v.message.includes('back-to-back'))).toBeTruthy();
      });
    });

    describe('Performance and Stress Tests', () => {
      test('should handle large number of matches efficiently', () => {
        const matches: Match[] = [];

        // Create 100 matches with various patterns
        for (let i = 1; i <= 100; i++) {
          matches.push(createMatch(`Team A${i}`, `Team B${i}`, (i % 10) + 1, `Field ${(i % 5) + 1}`));
        }

        const startTime = Date.now();
        const violations = detectViolations(matches[0], matches);
        const endTime = Date.now();

        expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
        expect(Array.isArray(violations)).toBeTruthy();
      });

      test('should handle matches with complex referee patterns', () => {
        const matches = [
          createMatch('Team A', 'Team B', 1, 'Field 1', 'Team E'),
          createMatch('Team C', 'Team D', 2, 'Field 1', 'Team A'),
          createMatch('Team E', 'Team F', 3, 'Field 1', 'Team C'),
          createMatch('Team G', 'Team H', 4, 'Field 1', 'Team B'),
        ];

        matches.forEach((match, index) => {
          const violations = detectViolations(match, matches);
          expect(Array.isArray(violations)).toBeTruthy();
        });
      });
    });
  });

  describe('Integration Tests', () => {
    test('should work together: hard constraints should catch what individual detection misses', () => {
      const matches = [
        createMatch('Team A', 'Team B', 1, 'Field 1'),
        createMatch('Team A', 'Team C', 1, 'Field 2'), // Team A conflict
        createMatch('Team D', 'Team E', 1, 'Field 1'), // Field 1 conflict
      ];

      const hardViolations = detectHardConstraintViolations(matches);
      const individualViolations = matches.map(match => detectViolations(match, matches));

      // Hard constraints should find the systemic issues
      expect(hardViolations.length).toBeGreaterThan(0);

      // Individual violations should also detect conflicts for affected matches
      const allIndividualViolations = individualViolations.flat();
      expect(allIndividualViolations.some(v => v.type === 'invalid')).toBeTruthy();
    });

    test('should correctly identify all violation types in realistic schedule', () => {
      const matches = [
        // Time slot 1: Field conflict
        createMatch('Team A', 'Team B', 1, 'Field 1', 'Team G'),
        createMatch('Team C', 'Team D', 1, 'Field 1', 'Team H'), // Field conflict

        // Time slot 2-4: Team A consecutive games
        createMatch('Team A', 'Team E', 2, 'Field 2', 'Team F'),
        createMatch('Team A', 'Team F', 3, 'Field 3'), // 3 consecutive for Team A

        // Time slot 4: Dual role conflict
        createMatch('Team G', 'Team H', 4, 'Field 1', 'Team A'), // Team A playing and refereeing
      ];

      // Test hard constraints
      const hardViolations = detectHardConstraintViolations(matches);
      expect(hardViolations.some(v => v.message.includes('Field 1'))).toBeTruthy();
      expect(hardViolations.some(v => v.message.includes('Team A cannot play and referee'))).toBeTruthy();

      // Test individual match violations
      const match0Violations = detectViolations(matches[0], matches);
      expect(match0Violations.some(v => v.message.includes('Field conflict'))).toBeTruthy();

      const match2Violations = detectViolations(matches[2], matches);
      expect(match2Violations.some(v => v.message.includes('consecutive'))).toBeTruthy();
    });
  });
});
