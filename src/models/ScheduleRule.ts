import { ScheduleHelpers } from '../lib/schedule-helpers';
import { Match } from './Match';
import { RuleViolation } from './RuleViolation';
import { Schedule } from './Schedule';
import { Division } from './Team';

/**
 * Base class for schedule rules
 */
export abstract class ScheduleRule {
  priority;
  constructor(priority = 1) {
    this.priority = priority; // Higher priority means the rule is more important
  }

  /**
   * Evaluate the schedule against this rule
   * @param {Schedule} schedule - Schedule to evaluate
   * @returns {Array} Array of violation objects
   */
  abstract evaluate(schedule: Schedule, violations: RuleViolation[]): void;
}

/**
 * Rule to avoid back-to-back games for teams
 */
export class AvoidBackToBackGames extends ScheduleRule {
  name;
  constructor(priority = 3) {
    super(priority);
    this.name = 'Avoid back-to-back games';
  }

  evaluate(schedule: Schedule, violations: RuleViolation[]) {
    const matches = [...schedule.matches].sort((a, b) => a.timeSlot - b.timeSlot);

    for (let i = 1; i < matches.length; i++) {
      const prevMatch = matches[i - 1];
      const currMatch = matches[i];

      // Check if the time slots are consecutive
      if (currMatch.timeSlot === prevMatch.timeSlot + 1) {
        // Check if any team plays in both matches and identify which team
        const teams = [];
        if (prevMatch.team1.name === currMatch.team1.name || prevMatch.team1.name === currMatch.team2.name) {
          teams.push(prevMatch.team1.name);
        }
        if (prevMatch.team2.name === currMatch.team1.name || prevMatch.team2.name === currMatch.team2.name) {
          teams.push(prevMatch.team2.name);
        }

        // Create a violation for each team that has back-to-back games
        teams.forEach(teamName => {
          violations.push({
            rule: this.name,
            description: `Team ${teamName} plays back-to-back in time slots ${prevMatch.timeSlot} and ${currMatch.timeSlot}`,
            matches: [prevMatch, currMatch],
          });
        });
      }
    }

    return violations;
  }
}

/**
 * Rule to avoid teams having the first and last game
 */
export class AvoidFirstAndLastGame extends ScheduleRule {
  name;
  constructor(priority = 2) {
    super(priority);
    this.name = 'Avoid teams having first and last game';
  }

  evaluate(schedule: Schedule, violations: RuleViolation[]) {
    const matches = [...schedule.matches];

    if (matches.length === 0) return;

    // Group matches by division
    const divisionMatches = ScheduleHelpers.groupMatchesByDivision(matches);

    // Check each division
    for (const division in divisionMatches) {
      const divMatches = divisionMatches[division].sort((a, b) => a.timeSlot - b.timeSlot);

      if (divMatches.length < 2) continue; // Skip if not enough matches

      const firstMatch = divMatches[0];
      const lastMatch = divMatches[divMatches.length - 1];

      // Teams in first match
      const firstMatchTeams = [firstMatch.team1.name, firstMatch.team2.name];

      // Teams in last match
      const lastMatchTeams = [lastMatch.team1.name, lastMatch.team2.name];

      // Check for overlap
      const teamsWithFirstAndLast = firstMatchTeams.filter(team => lastMatchTeams.includes(team));

      if (teamsWithFirstAndLast.length > 0) {
        teamsWithFirstAndLast.forEach(team => {
          violations.push({
            rule: this.name,
            description: `Team ${team} has both first and last game in ${division} division`,
            matches: [firstMatch, lastMatch],
          });
        });
      }
    }

    return violations;
  }
}

/**
 * Rule to avoid teams refereeing immediately before their match
 */
export class AvoidReffingBeforePlaying extends ScheduleRule {
  name;
  constructor(priority = 4) {
    super(priority);
    this.name = 'Avoid refereeing before playing';
  }

  evaluate(schedule: Schedule, violations: RuleViolation[]) {
    const matches = [...schedule.matches].sort((a, b) => a.timeSlot - b.timeSlot);

    for (let i = 0; i < matches.length - 1; i++) {
      const currMatch = matches[i];
      const nextMatch = matches[i + 1];

      // Skip if there's no referee team assigned to current match
      if (!currMatch.refereeTeam) continue;

      // Check if the referee team plays in the next match
      if (currMatch.refereeTeam.name === nextMatch.team1.name || currMatch.refereeTeam.name === nextMatch.team2.name) {
        violations.push({
          rule: this.name,
          description: `Team ${currMatch.refereeTeam.name} referees in slot ${currMatch.timeSlot} and plays in slot ${nextMatch.timeSlot}`,
          matches: [currMatch, nextMatch],
        });
      }
    }

    return violations;
  }
}

// ===== PLAYER-BASED RULES (Lower Priority) =====

/**
 * Rule to avoid individual players playing back-to-back games
 */
export class AvoidPlayerBackToBackGames extends ScheduleRule {
  name;
  constructor(priority = 2) {
    super(priority);
    this.name = 'Avoid players playing back-to-back games';
  }

  evaluate(schedule: Schedule, violations: RuleViolation[]) {
    const matches = [...schedule.matches].sort((a, b) => a.timeSlot - b.timeSlot);
    const playerMatches = ScheduleHelpers.groupMatchesByPlayer(matches);

    // Check each player's matches for back-to-back games
    Object.entries(playerMatches).forEach(([playerName, playerMatchList]) => {
      const sortedMatches = playerMatchList.sort((a, b) => a.timeSlot - b.timeSlot);

      for (let i = 1; i < sortedMatches.length; i++) {
        const prevMatch = sortedMatches[i - 1];
        const currMatch = sortedMatches[i];

        // Check if matches are consecutive
        if (currMatch.timeSlot === prevMatch.timeSlot + 1) {
          violations.push({
            rule: this.name,
            description: `Player ${playerName} plays back-to-back games in time slots ${prevMatch.timeSlot} and ${currMatch.timeSlot}`,
            matches: [prevMatch, currMatch],
            priority: this.priority,
          });
        }
      }
    });

    return violations;
  }
}

/**
 * Rule to ensure players get adequate rest between games
 */
export class EnsurePlayerRestTime extends ScheduleRule {
  name;
  minRestSlots;
  constructor(priority = 1, minRestSlots = 2) {
    super(priority);
    this.name = 'Ensure player rest time';
    this.minRestSlots = minRestSlots;
  }

  evaluate(schedule: Schedule, violations: RuleViolation[]) {
    const matches = [...schedule.matches].sort((a, b) => a.timeSlot - b.timeSlot);
    const playerMatches = ScheduleHelpers.groupMatchesByPlayer(matches);

    // Check each player's matches for adequate rest
    Object.entries(playerMatches).forEach(([playerName, playerMatchList]) => {
      const sortedMatches = playerMatchList.sort((a, b) => a.timeSlot - b.timeSlot);

      for (let i = 1; i < sortedMatches.length; i++) {
        const prevMatch = sortedMatches[i - 1];
        const currMatch = sortedMatches[i];
        const restTime = currMatch.timeSlot - prevMatch.timeSlot - 1;

        // Check if rest time is insufficient
        if (restTime < this.minRestSlots) {
          violations.push({
            rule: this.name,
            description: `Player ${playerName} has insufficient rest (${restTime} slots) between games in slots ${prevMatch.timeSlot} and ${currMatch.timeSlot}`,
            matches: [prevMatch, currMatch],
            priority: this.priority,
          });
        }
      }
    });

    return violations;
  }
}

/**
 * Rule to limit the number of games a player can play
 */
export class LimitPlayerGameCount extends ScheduleRule {
  name;
  maxGames;
  constructor(priority = 1, maxGames = 4) {
    super(priority);
    this.name = 'Limit player game count';
    this.maxGames = maxGames;
  }

  evaluate(schedule: Schedule, violations: RuleViolation[]) {
    const matches = [...schedule.matches];
    const playerMatches = ScheduleHelpers.groupMatchesByPlayer(matches);

    // Check each player's game count
    Object.entries(playerMatches).forEach(([playerName, playerMatchList]) => {
      if (playerMatchList.length > this.maxGames) {
        violations.push({
          rule: this.name,
          description: `Player ${playerName} is scheduled for ${playerMatchList.length} games (max: ${this.maxGames})`,
          matches: playerMatchList,
          priority: this.priority,
        });
      }
    });

    return violations;
  }
}

/**
 * Rule to avoid players having first and last game in a division
 */
export class AvoidPlayerFirstAndLastGame extends ScheduleRule {
  name;
  constructor(priority = 1) {
    super(priority);
    this.name = 'Avoid players having first and last game';
  }

  evaluate(schedule: Schedule, violations: RuleViolation[]) {
    const matches = [...schedule.matches];

    if (matches.length === 0) return violations;

    // Group matches by division
    const divisionMatches = ScheduleHelpers.groupMatchesByDivision(matches);

    // Check each division
    for (const division in divisionMatches) {
      const divMatches = divisionMatches[division].sort((a, b) => a.timeSlot - b.timeSlot);

      if (divMatches.length < 2) continue; // Skip if not enough matches

      const firstMatch = divMatches[0];
      const lastMatch = divMatches[divMatches.length - 1];

      // Get all players in first and last matches
      const firstMatchPlayers = ScheduleHelpers.getPlayersInMatch(firstMatch);
      const lastMatchPlayers = ScheduleHelpers.getPlayersInMatch(lastMatch);

      // Check for players who appear in both
      const playersWithFirstAndLast = firstMatchPlayers.filter(player =>
        lastMatchPlayers.some(lastPlayer => lastPlayer.name === player.name)
      );

      playersWithFirstAndLast.forEach(player => {
        violations.push({
          rule: this.name,
          description: `Player ${player.name} has both first and last game in ${division} division`,
          matches: [firstMatch, lastMatch],
          priority: this.priority,
        });
      });
    }

    return violations;
  }
}

/**
 * Custom rule to implement specific scheduling constraints
 */
export class CustomRule extends ScheduleRule {
  name;
  evaluateFunction;
  constructor(name: string, evaluateFunction: (schedule: Schedule) => RuleViolation[], priority = 1) {
    super(priority);
    this.name = name;
    this.evaluateFunction = evaluateFunction;
  }

  evaluate(schedule: Schedule, violations: RuleViolation[]) {
    return this.evaluateFunction(schedule);
  }
}

/**
 * Rule to limit the maximum time players need to be at the venue
 */
export class LimitPlayerVenueTime extends ScheduleRule {
  name;
  maxHours;
  minutesPerSlot;
  constructor(priority = 1, maxHours = 5, minutesPerSlot = 30) {
    super(priority);
    this.name = 'Limit player venue time';
    this.maxHours = maxHours;
    this.minutesPerSlot = minutesPerSlot;
  }

  evaluate(schedule: Schedule, violations: RuleViolation[]) {
    const matches = [...schedule.matches];
    const playerMatches = ScheduleHelpers.groupMatchesByPlayer(matches);

    // Check each player's venue time
    Object.entries(playerMatches).forEach(([playerName, playerMatchList]) => {
      if (playerMatchList.length < 2) return; // Skip players with only one game

      const sortedMatches = playerMatchList.sort((a, b) => a.timeSlot - b.timeSlot);
      const firstSlot = sortedMatches[0].timeSlot;
      const lastSlot = sortedMatches[sortedMatches.length - 1].timeSlot;

      // Calculate total time at venue (from first game start to last game end)
      const slotsSpan = lastSlot - firstSlot + 1; // +1 to include the last slot
      const hoursAtVenue = (slotsSpan * this.minutesPerSlot) / 60;

      if (hoursAtVenue > this.maxHours) {
        violations.push({
          rule: this.name,
          description: `Player ${playerName} needs to be at venue for ${hoursAtVenue.toFixed(1)} hours (max: ${this.maxHours}h)`,
          matches: sortedMatches,
          priority: this.priority,
        });
      }
    });

    return violations;
  }
}

/**
 * Rule to ensure balanced game distribution among players
 */
export class BalancePlayerGameDistribution extends ScheduleRule {
  name;
  maxGameDifference;
  constructor(priority = 1, maxGameDifference = 1) {
    super(priority);
    this.name = 'Balance player game distribution';
    this.maxGameDifference = maxGameDifference;
  }

  evaluate(schedule: Schedule, violations: RuleViolation[]) {
    const matches = [...schedule.matches];
    const playerMatches = ScheduleHelpers.groupMatchesByPlayer(matches);

    // Group by division to ensure fairness within divisions
    const divisionPlayers: { [division: string]: { [playerName: string]: number } } = {};
    Object.entries(playerMatches).forEach(([playerName, playerMatchList]) => {
      playerMatchList.forEach(match => {
        const division = (match.team1.division || match.team2.division || 'default') as string;
        if (!divisionPlayers[division]) {
          divisionPlayers[division] = {};
        }
        if (!divisionPlayers[division][playerName]) {
          divisionPlayers[division][playerName] = 0;
        }
        divisionPlayers[division][playerName]++;
      });
    });

    // Check balance within each division
    Object.entries(divisionPlayers).forEach(([division, players]) => {
      const gameCounts = Object.values(players);
      const minGames = Math.min(...gameCounts);
      const maxGames = Math.max(...gameCounts);

      if (maxGames - minGames > this.maxGameDifference) {
        const overScheduledPlayers = Object.entries(players)
          .filter(([_, count]) => count === maxGames)
          .map(([name, _]) => name);

        violations.push({
          rule: this.name,
          description: `Game distribution imbalance in ${division}: ${minGames}-${maxGames} games (max difference: ${this.maxGameDifference})`,
          matches: [], // Could add specific matches if needed
          priority: this.priority,
        });
      }
    });

    return violations;
  }
}

/**
 * Rule to avoid players having large gaps between games
 */
export class AvoidPlayerLargeGaps extends ScheduleRule {
  name;
  maxGapSlots;
  constructor(priority = 1, maxGapSlots = 6) {
    super(priority);
    this.name = 'Avoid large gaps between player games';
    this.maxGapSlots = maxGapSlots;
  }

  evaluate(schedule: Schedule, violations: RuleViolation[]) {
    const matches = [...schedule.matches];
    const playerMatches = ScheduleHelpers.groupMatchesByPlayer(matches);

    // Check each player's gaps between games
    Object.entries(playerMatches).forEach(([playerName, playerMatchList]) => {
      if (playerMatchList.length < 2) return;

      const sortedMatches = playerMatchList.sort((a, b) => a.timeSlot - b.timeSlot);

      for (let i = 1; i < sortedMatches.length; i++) {
        const prevMatch = sortedMatches[i - 1];
        const currMatch = sortedMatches[i];
        const gap = currMatch.timeSlot - prevMatch.timeSlot - 1;

        if (gap > this.maxGapSlots) {
          violations.push({
            rule: this.name,
            description: `Player ${playerName} has ${gap}-slot gap between games (slots ${prevMatch.timeSlot} and ${currMatch.timeSlot})`,
            matches: [prevMatch, currMatch],
            priority: this.priority,
          });
        }
      }
    });

    return violations;
  }
}

/**
 * Rule to ensure players have warm-up time before their first game
 */
export class EnsurePlayerWarmupTime extends ScheduleRule {
  name;
  minWarmupSlots;
  constructor(priority = 1, minWarmupSlots = 1) {
    super(priority);
    this.name = 'Ensure player warm-up time';
    this.minWarmupSlots = minWarmupSlots;
  }

  evaluate(schedule: Schedule, violations: RuleViolation[]) {
    const matches = [...schedule.matches];
    const playerMatches = ScheduleHelpers.groupMatchesByPlayer(matches);

    // Check each player's first game timing
    Object.entries(playerMatches).forEach(([playerName, playerMatchList]) => {
      const sortedMatches = playerMatchList.sort((a, b) => a.timeSlot - b.timeSlot);
      const firstMatch = sortedMatches[0];

      // Check if first game is too early (not enough warm-up time)
      if (firstMatch.timeSlot < this.minWarmupSlots + 1) {
        violations.push({
          rule: this.name,
          description: `Player ${playerName} has first game in slot ${firstMatch.timeSlot} (needs ${this.minWarmupSlots} warm-up slots)`,
          matches: [firstMatch],
          priority: this.priority,
        });
      }
    });

    return violations;
  }
}

/**
 * Rule to balance referee assignments among teams
 */
export class BalanceRefereeAssignments extends ScheduleRule {
  name;
  maxRefereeDifference;
  constructor(priority = 2, maxRefereeDifference = 1) {
    super(priority);
    this.name = 'Balance referee assignments';
    this.maxRefereeDifference = maxRefereeDifference;
  }

  evaluate(schedule: Schedule, violations: RuleViolation[]) {
    const matches = [...schedule.matches];
    const teamRefereeCount: { [teamName: string]: number } = {};

    // Count referee assignments per team
    matches.forEach(match => {
      if (match.refereeTeam) {
        const teamName = match.refereeTeam.name;
        teamRefereeCount[teamName] = (teamRefereeCount[teamName] || 0) + 1;
      }
    });

    // Check balance
    const refereeCounts = Object.values(teamRefereeCount);
    if (refereeCounts.length > 0) {
      const minAssignments = Math.min(...refereeCounts);
      const maxAssignments = Math.max(...refereeCounts);

      if (maxAssignments - minAssignments > this.maxRefereeDifference) {
        const overAssignedTeams = Object.entries(teamRefereeCount)
          .filter(([_, count]) => count === maxAssignments)
          .map(([name, _]) => name);

        violations.push({
          rule: this.name,
          description: `Referee assignment imbalance: ${minAssignments}-${maxAssignments} assignments (max difference: ${this.maxRefereeDifference})`,
          matches: [], // Could add specific matches if needed
          priority: this.priority,
        });
      }
    }

    return violations;
  }
}

/**
 * Rule to ensure fair field distribution for teams
 */
export class EnsureFairFieldDistribution extends ScheduleRule {
  name;
  constructor(priority = 1) {
    super(priority);
    this.name = 'Ensure fair field distribution';
  }

  evaluate(schedule: Schedule, violations: RuleViolation[]) {
    const matches = [...schedule.matches];
    const teamFieldCount: { [teamName: string]: { [field: string]: number } } = {};

    // Count field usage per team
    matches.forEach(match => {
      [match.team1.name, match.team2.name].forEach(teamName => {
        if (!teamFieldCount[teamName]) {
          teamFieldCount[teamName] = {};
        }
        const field = match.field;
        teamFieldCount[teamName][field] = (teamFieldCount[teamName][field] || 0) + 1;
      });
    });

    // Check for teams playing too many games on the same field
    Object.entries(teamFieldCount).forEach(([teamName, fieldCounts]) => {
      const totalGames = Object.values(fieldCounts).reduce((sum: number, count: number) => sum + count, 0);
      const maxFieldGames = Math.max(...Object.values(fieldCounts));

      // If a team plays more than 60% of their games on one field, flag it
      if (totalGames >= 3 && maxFieldGames / totalGames > 0.6) {
        const dominantField = Object.entries(fieldCounts).find(([_, count]) => count === maxFieldGames)?.[0];

        violations.push({
          rule: this.name,
          description: `Team ${teamName} plays ${maxFieldGames}/${totalGames} games on ${dominantField}`,
          matches: [], // Could add specific matches if needed
          priority: this.priority,
        });
      }
    });

    return violations;
  }
}
