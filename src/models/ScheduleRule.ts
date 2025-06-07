import { ScheduleHelpers } from '../lib/schedule-helpers'
import { Match } from './Match'
import { RuleViolation } from './RuleViolation'
import { Schedule } from './Schedule'
import { Division } from './Team'

/**
 * Base class for schedule rules
 */
export abstract class ScheduleRule {
  priority
  abstract name: string
  constructor(priority = 1) {
    this.priority = priority // Higher priority means the rule is more important
  }

  /**
   * Evaluate the schedule against this rule
   * @param {Schedule} schedule - Schedule to evaluate
   * @returns {Array} Array of violation objects
   */
  abstract evaluate(schedule: Schedule, violations: RuleViolation[]): void
}

/**
 * Rule to avoid consecutive games for both teams and players
 * 3+ consecutive games = critical violation (priority 10)
 * 2 consecutive games = warning violation (priority 5)
 */
export class AvoidBackToBackGames extends ScheduleRule {
  name
  constructor(priority = 5) {
    super(priority)
    this.name = 'Avoid back-to-back games'
  }

  evaluate(schedule: Schedule, violations: RuleViolation[]) {
    const matches = [...schedule.matches].sort((a, b) => a.timeSlot - b.timeSlot)

    // Check teams
    this.checkTeamConsecutiveGames(matches, violations)
    
    // Check players
    this.checkPlayerConsecutiveGames(matches, violations)

    return violations
  }

  private checkTeamConsecutiveGames(matches: Match[], violations: RuleViolation[]) {
    // Get all teams in the schedule
    const allTeams = new Set<string>()
    matches.forEach(match => {
      allTeams.add(match.team1.name)
      allTeams.add(match.team2.name)
    })

    // For each team, find consecutive game streaks
    for (const teamName of Array.from(allTeams)) {
      // Get all matches where this team is involved (playing or refereeing)
      const teamMatches = matches
        .filter(match => match.team1.name === teamName || match.team2.name === teamName)
        .sort((a, b) => a.timeSlot - b.timeSlot)

      if (teamMatches.length < 2) continue

      this.findConsecutiveStreaks(teamMatches, violations, `Team ${teamName}`)
    }
  }

  private checkPlayerConsecutiveGames(matches: Match[], violations: RuleViolation[]) {
    const playerMatches = ScheduleHelpers.groupMatchesByPlayer(matches)

    // Check each player's matches for consecutive games
    Object.entries(playerMatches).forEach(([playerName, playerMatchList]) => {
      if (playerMatchList.length < 2) return

      const sortedMatches = playerMatchList.sort((a, b) => a.timeSlot - b.timeSlot)
      this.findConsecutiveStreaks(sortedMatches, violations, `Player ${playerName}`)
    })
  }

  private findConsecutiveStreaks(matches: Match[], violations: RuleViolation[], entityName: string) {
    // Check for consecutive time slots
    let consecutiveStart = 0
    for (let i = 1; i < matches.length; i++) {
      const prevMatch = matches[i - 1]
      const currMatch = matches[i]

      // If not consecutive, process the previous streak and start a new one
      if (currMatch.timeSlot !== prevMatch.timeSlot + 1) {
        const streakLength = i - consecutiveStart
        if (streakLength >= 2) {
          this.addConsecutiveViolation(violations, entityName, streakLength, matches.slice(consecutiveStart, i))
        }
        consecutiveStart = i
      }
    }

    // Check the final streak
    const finalStreakLength = matches.length - consecutiveStart
    if (finalStreakLength >= 2) {
      this.addConsecutiveViolation(violations, entityName, finalStreakLength, matches.slice(consecutiveStart))
    }
  }

  private addConsecutiveViolation(
    violations: RuleViolation[],
    entityName: string,
    streakLength: number,
    matches: Match[]
  ) {
    const firstSlot = matches[0].timeSlot
    const lastSlot = matches[matches.length - 1].timeSlot
    const timeSlotRange = firstSlot === lastSlot ? `slot ${firstSlot}` : `slots ${firstSlot} and ${lastSlot}`

    if (streakLength >= 3) {
      violations.push({
        rule: this.name,
        description: `${entityName}: ${streakLength} consecutive games in time ${timeSlotRange}`,
        matches: matches,
        level: 'warning',
      })
    } else if (streakLength === 2) {
      violations.push({
        rule: this.name,
        description: `${entityName}: 2 back-to-back games in time ${timeSlotRange}`,
        matches: matches,
        level: 'warning',
      })
    }
  }
}

/**
 * Rule to avoid teams and players having the first and last game
 * Considers setup activities + first game as "first", and last game + packdown activities as "last"
 */
export class AvoidFirstAndLastGame extends ScheduleRule {
  name
  constructor(priority = 2) {
    super(priority)
    this.name = 'Avoid having first and last game'
  }

  evaluate(schedule: Schedule, violations: RuleViolation[]) {
    const matches = [...schedule.matches]

    if (matches.length === 0) return violations

    // Check teams
    this.checkTeamFirstAndLast(matches, violations)
    
    // Check players
    this.checkPlayerFirstAndLast(matches, violations)

    return violations
  }

  private checkTeamFirstAndLast(matches: Match[], violations: RuleViolation[]) {
    // Separate activities by type
    const setupActivities = matches.filter(m => m.activityType === 'SETUP')
    const regularMatches = matches.filter(m => m.activityType === 'REGULAR')
    const packdownActivities = matches.filter(m => m.activityType === 'PACKING_DOWN')

    // Sort all regular matches by time slot to find global first and last
    const sortedRegularMatches = regularMatches.sort((a, b) => a.timeSlot - b.timeSlot)

    if (sortedRegularMatches.length === 0) return // Skip if no regular matches

    // Get teams involved in "first" period (setup + first regular game of the day)
    const firstPeriodTeams = new Set<string>()

    // Add teams from setup activities
    setupActivities.forEach(activity => {
      if (activity.team1.name !== 'ACTIVITY_PLACEHOLDER') {
        firstPeriodTeams.add(activity.team1.name)
      }
      if (activity.team2.name !== 'ACTIVITY_PLACEHOLDER') {
        firstPeriodTeams.add(activity.team2.name)
      }
      if (activity.refereeTeam && activity.refereeTeam.name !== 'ACTIVITY_PLACEHOLDER') {
        firstPeriodTeams.add(activity.refereeTeam.name)
      }
    })

    // Add teams from ALL games in the first time slot of the day
    const firstTimeSlot = sortedRegularMatches[0].timeSlot
    const firstSlotMatches = sortedRegularMatches.filter(match => match.timeSlot === firstTimeSlot)
    firstSlotMatches.forEach(match => {
      firstPeriodTeams.add(match.team1.name)
      firstPeriodTeams.add(match.team2.name)
      if (match.refereeTeam) {
        firstPeriodTeams.add(match.refereeTeam.name)
      }
    })

    // Get teams involved in "last" period (ALL games in last time slot + packdown)
    const lastPeriodTeams = new Set<string>()

    // Add teams from ALL games in the last time slot of the day
    const lastTimeSlot = sortedRegularMatches[sortedRegularMatches.length - 1].timeSlot
    const lastSlotMatches = sortedRegularMatches.filter(match => match.timeSlot === lastTimeSlot)
    lastSlotMatches.forEach(match => {
      lastPeriodTeams.add(match.team1.name)
      lastPeriodTeams.add(match.team2.name)
      if (match.refereeTeam) {
        lastPeriodTeams.add(match.refereeTeam.name)
      }
    })

    // Add teams from packdown activities
    packdownActivities.forEach(activity => {
      if (activity.team1.name !== 'ACTIVITY_PLACEHOLDER') {
        lastPeriodTeams.add(activity.team1.name)
      }
      if (activity.team2.name !== 'ACTIVITY_PLACEHOLDER') {
        lastPeriodTeams.add(activity.team2.name)
      }
      if (activity.refereeTeam && activity.refereeTeam.name !== 'ACTIVITY_PLACEHOLDER') {
        lastPeriodTeams.add(activity.refereeTeam.name)
      }
    })

    // Check for teams that appear in both first and last periods
    const teamsWithFirstAndLast = Array.from(firstPeriodTeams).filter(team => lastPeriodTeams.has(team))

    teamsWithFirstAndLast.forEach(team => {
      // Collect all relevant matches for this violation
      const relevantMatches = [
        ...setupActivities,
        ...firstSlotMatches,
        ...lastSlotMatches,
        ...packdownActivities,
      ].filter(match => {
        const involvedTeams = [match.team1.name, match.team2.name]
        if (match.refereeTeam) involvedTeams.push(match.refereeTeam.name)
        return involvedTeams.includes(team)
      })

      violations.push({
        rule: this.name,
        description: `Team ${team} participates in both first period (setup + first game) and last period (last game + packdown) of the day`,
        matches: relevantMatches,
        level: 'alert',
      })
    })
  }

  private checkPlayerFirstAndLast(matches: Match[], violations: RuleViolation[]) {
    // Separate activities by type
    const setupActivities = matches.filter(m => m.activityType === 'SETUP')
    const regularMatches = matches.filter(m => m.activityType === 'REGULAR')
    const packdownActivities = matches.filter(m => m.activityType === 'PACKING_DOWN')

    // Sort all regular matches by time slot to find global first and last
    const sortedRegularMatches = regularMatches.sort((a, b) => a.timeSlot - b.timeSlot)

    if (sortedRegularMatches.length === 0) return // Skip if no regular matches

    // Get players involved in "first" period (setup + first regular game of the day)
    const firstPeriodPlayers = new Set<string>()

    // Add players from setup activities
    setupActivities.forEach(activity => {
      const activityPlayers = ScheduleHelpers.getPlayersInMatch(activity)
      activityPlayers.forEach(player => {
        if (player.name !== 'ACTIVITY_PLACEHOLDER') {
          firstPeriodPlayers.add(player.name)
        }
      })
    })

    // Add players from ALL games in the first time slot of the day
    const firstTimeSlot = sortedRegularMatches[0].timeSlot
    const firstSlotMatches = sortedRegularMatches.filter(match => match.timeSlot === firstTimeSlot)
    firstSlotMatches.forEach(match => {
      const firstMatchPlayers = ScheduleHelpers.getPlayersInMatch(match)
      firstMatchPlayers.forEach(player => {
        firstPeriodPlayers.add(player.name)
      })
    })

    // Get players involved in "last" period (ALL games in last time slot + packdown)
    const lastPeriodPlayers = new Set<string>()

    // Add players from ALL games in the last time slot of the day
    const lastTimeSlot = sortedRegularMatches[sortedRegularMatches.length - 1].timeSlot
    const lastSlotMatches = sortedRegularMatches.filter(match => match.timeSlot === lastTimeSlot)
    lastSlotMatches.forEach(match => {
      const lastMatchPlayers = ScheduleHelpers.getPlayersInMatch(match)
      lastMatchPlayers.forEach(player => {
        lastPeriodPlayers.add(player.name)
      })
    })

    // Add players from packdown activities
    packdownActivities.forEach(activity => {
      const activityPlayers = ScheduleHelpers.getPlayersInMatch(activity)
      activityPlayers.forEach(player => {
        if (player.name !== 'ACTIVITY_PLACEHOLDER') {
          lastPeriodPlayers.add(player.name)
        }
      })
    })

    // Check for players who appear in both first and last periods
    const playersWithFirstAndLast = Array.from(firstPeriodPlayers).filter(playerName =>
      lastPeriodPlayers.has(playerName)
    )

    playersWithFirstAndLast.forEach(playerName => {
      // Collect all relevant matches for this violation
      const relevantMatches = [
        ...setupActivities,
        ...firstSlotMatches,
        ...lastSlotMatches,
        ...packdownActivities,
      ].filter(match => {
        const matchPlayers = ScheduleHelpers.getPlayersInMatch(match)
        return matchPlayers.some(player => player.name === playerName)
      })

      violations.push({
        rule: this.name,
        description: `Player ${playerName} participates in both first period (setup + first game) and last period (last game + packdown) of the day`,
        matches: relevantMatches,
        level: 'alert',
      })
    })
  }
}

/**
 * Rule to avoid teams refereeing immediately before their match
 */
export class AvoidReffingBeforePlaying extends ScheduleRule {
  name
  constructor(priority = 4) {
    super(priority)
    this.name = 'Avoid refereeing before playing'
  }

  evaluate(schedule: Schedule, violations: RuleViolation[]) {
    const matches = [...schedule.matches].sort((a, b) => a.timeSlot - b.timeSlot)

    for (let i = 0; i < matches.length - 1; i++) {
      const currMatch = matches[i]
      const nextMatch = matches[i + 1]

      // Skip if there's no referee team assigned to current match
      if (!currMatch.refereeTeam) continue

      // Check if the referee team plays in the next match
      if (currMatch.refereeTeam.name === nextMatch.team1.name || currMatch.refereeTeam.name === nextMatch.team2.name) {
        violations.push({
          rule: this.name,
          description: `Team ${currMatch.refereeTeam.name} referees in slot ${currMatch.timeSlot} and plays in slot ${nextMatch.timeSlot}`,
          matches: [currMatch, nextMatch],
          level: 'note',
        })
      }
    }

    return violations
  }
}

/**
 * Critical rule to prevent teams from playing immediately after setup
 */
export class AvoidPlayingAfterSetup extends ScheduleRule {
  name
  constructor(priority = 10) {
    // High priority for critical violation
    super(priority)
    this.name = 'Avoid playing immediately after setup'
  }

  evaluate(schedule: Schedule, violations: RuleViolation[]) {
    const matches = [...schedule.matches].sort((a, b) => a.timeSlot - b.timeSlot)

    for (let i = 0; i < matches.length - 1; i++) {
      const currMatch = matches[i]
      const nextMatch = matches[i + 1]

      // Check if current match is a SETUP activity and next match is consecutive
      if (currMatch.activityType === 'SETUP' && nextMatch.timeSlot === currMatch.timeSlot + 1) {
        // Get all teams involved in setup - handle both Match instances and plain objects
        let setupTeams
        if (typeof currMatch.getAllInvolvedTeams === 'function') {
          setupTeams = currMatch.getAllInvolvedTeams()
        } else {
          // Fallback for plain objects: manually extract teams
          setupTeams = [currMatch.team1, currMatch.team2]
          if (currMatch.refereeTeam) {
            setupTeams.push(currMatch.refereeTeam)
          }
          // Remove duplicates
          setupTeams = setupTeams.filter((team, index, self) => self.findIndex(t => t.name === team.name) === index)
        }

        // Check if any setup team is playing in the next match
        for (const setupTeam of setupTeams) {
          if (nextMatch.team1.name === setupTeam.name || nextMatch.team2.name === setupTeam.name) {
            violations.push({
              rule: this.name,
              description: `Team ${setupTeam.name} does setup in slot ${currMatch.timeSlot} and plays immediately after in slot ${nextMatch.timeSlot} - CRITICAL VIOLATION`,
              matches: [currMatch, nextMatch],
              level: 'warning',
            })
          }
        }
      }
    }

    return violations
  }
}

/**
 * Critical rule to prevent teams from being double-booked in the same time slot
 * This is a non-optional rule as it's physically impossible for a team to be in two places at once
 */
export class PreventTeamDoubleBooking extends ScheduleRule {
  name
  constructor(priority = 10) {
    // Maximum priority for critical violation
    super(priority)
    this.name = 'Prevent team double-booking'
  }

  evaluate(schedule: Schedule, violations: RuleViolation[]) {
    const matches = [...schedule.matches]

    // Group matches by time slot
    const matchesBySlot = new Map<number, Match[]>()
    matches.forEach(match => {
      if (!matchesBySlot.has(match.timeSlot)) {
        matchesBySlot.set(match.timeSlot, [])
      }
      matchesBySlot.get(match.timeSlot)!.push(match)
    })

    // Check each time slot for team conflicts
    matchesBySlot.forEach((slotMatches, timeSlot) => {
      if (slotMatches.length < 2) return // Skip if only one match in slot

      // Track all team assignments in this slot
      const teamAssignments = new Map<string, Match[]>()

      slotMatches.forEach(match => {
        // Add playing teams
        ;[match.team1.name, match.team2.name].forEach(teamName => {
          if (!teamAssignments.has(teamName)) {
            teamAssignments.set(teamName, [])
          }
          teamAssignments.get(teamName)!.push(match)
        })

        // Add referee team if present
        if (match.refereeTeam) {
          const refTeamName = match.refereeTeam.name
          if (!teamAssignments.has(refTeamName)) {
            teamAssignments.set(refTeamName, [])
          }
          teamAssignments.get(refTeamName)!.push(match)
        }
      })

      // Check for teams with multiple assignments
      teamAssignments.forEach((assignedMatches, teamName) => {
        if (assignedMatches.length > 1) {
          violations.push({
            rule: this.name,
            description: `Team ${teamName} has ${assignedMatches.length} assignments in slot ${timeSlot} - CRITICAL VIOLATION`,
            matches: assignedMatches,
            level: 'critical',
          })
        }
      })
    })

    return violations
  }
}

// ===== ADDITIONAL RULES =====

/**
 * Rule to manage rest time and gaps between games for players
 */
export class ManageRestTimeAndGaps extends ScheduleRule {
  name
  minRestSlots
  maxGapSlots
  constructor(priority = 1, minRestSlots = 2, maxGapSlots = 6) {
    super(priority)
    this.name = 'Manage rest time and gaps'
    this.minRestSlots = minRestSlots
    this.maxGapSlots = maxGapSlots
  }

  evaluate(schedule: Schedule, violations: RuleViolation[]) {
    const matches = [...schedule.matches].sort((a, b) => a.timeSlot - b.timeSlot)
    const playerMatches = ScheduleHelpers.groupMatchesByPlayer(matches)

    // Check each player's matches for adequate rest and reasonable gaps
    Object.entries(playerMatches).forEach(([playerName, playerMatchList]) => {
      if (playerMatchList.length < 2) return

      const sortedMatches = playerMatchList.sort((a, b) => a.timeSlot - b.timeSlot)

      for (let i = 1; i < sortedMatches.length; i++) {
        const prevMatch = sortedMatches[i - 1]
        const currMatch = sortedMatches[i]
        const gap = currMatch.timeSlot - prevMatch.timeSlot - 1

        // Check if rest time is insufficient
        if (gap < this.minRestSlots) {
          violations.push({
            rule: this.name,
            description: `Player ${playerName} has insufficient rest (${gap} slots) between games in slots ${prevMatch.timeSlot} and ${currMatch.timeSlot}`,
            matches: [prevMatch, currMatch],
            level: 'note',
          })
        }
        // Check if gap is too large
        else if (gap > this.maxGapSlots) {
          violations.push({
            rule: this.name,
            description: `Player ${playerName} has ${gap}-slot gap between games (slots ${prevMatch.timeSlot} and ${currMatch.timeSlot})`,
            matches: [prevMatch, currMatch],
            level: 'warning',
          })
        }
      }
    })

    return violations
  }
}

/**
 * Rule to manage player game count limits and distribution balance
 */
export class ManagePlayerGameBalance extends ScheduleRule {
  name
  maxGames
  maxGameDifference
  constructor(priority = 1, maxGames = 4, maxGameDifference = 1) {
    super(priority)
    this.name = 'Manage player game balance'
    this.maxGames = maxGames
    this.maxGameDifference = maxGameDifference
  }

  evaluate(schedule: Schedule, violations: RuleViolation[]) {
    const matches = [...schedule.matches]
    const playerMatches = ScheduleHelpers.groupMatchesByPlayer(matches)

    // Check individual player game counts
    Object.entries(playerMatches).forEach(([playerName, playerMatchList]) => {
      if (playerMatchList.length > this.maxGames) {
        violations.push({
          rule: this.name,
          description: `Player ${playerName} is scheduled for ${playerMatchList.length} games (max: ${this.maxGames})`,
          matches: playerMatchList,
          level: 'warning',
        })
      }
    })

    // Check game distribution balance within divisions
    this.checkGameDistributionBalance(matches, playerMatches, violations)

    return violations
  }

  private checkGameDistributionBalance(matches: Match[], playerMatches: { [playerName: string]: Match[] }, violations: RuleViolation[]) {
    // Group by division to ensure fairness within divisions
    const divisionPlayers: { [division: string]: { [playerName: string]: number } } = {}
    Object.entries(playerMatches).forEach(([playerName, playerMatchList]) => {
      playerMatchList.forEach(match => {
        const division = (match.team1.division || match.team2.division || 'default') as string
        if (!divisionPlayers[division]) {
          divisionPlayers[division] = {}
        }
        if (!divisionPlayers[division][playerName]) {
          divisionPlayers[division][playerName] = 0
        }
        divisionPlayers[division][playerName]++
      })
    })

    // Check balance within each division
    Object.entries(divisionPlayers).forEach(([division, players]) => {
      const gameCounts = Object.values(players)
      if (gameCounts.length === 0) return

      const minGames = Math.min(...gameCounts)
      const maxGames = Math.max(...gameCounts)

      if (maxGames - minGames > this.maxGameDifference) {
        violations.push({
          rule: this.name,
          description: `Game distribution imbalance in ${division}: ${minGames}-${maxGames} games (max difference: ${this.maxGameDifference})`,
          matches: [], // Could add specific matches if needed
          level: 'warning',
        })
      }
    })
  }
}



/**
 * Custom rule to implement specific scheduling constraints
 */
export class CustomRule extends ScheduleRule {
  name
  evaluateFunction
  constructor(name: string, evaluateFunction: (schedule: Schedule) => RuleViolation[], priority = 1) {
    super(priority)
    this.name = name
    this.evaluateFunction = evaluateFunction
  }

  evaluate(schedule: Schedule, violations: RuleViolation[]) {
    return this.evaluateFunction(schedule)
  }
}

/**
 * Rule to limit the maximum time players and teams need to be at the venue
 */
export class LimitVenueTime extends ScheduleRule {
  name
  maxHours
  minutesPerSlot
  constructor(priority = 1, maxHours = 5, minutesPerSlot = 30) {
    super(priority)
    this.name = 'Limit venue time'
    this.maxHours = maxHours
    this.minutesPerSlot = minutesPerSlot
  }

  evaluate(schedule: Schedule, violations: RuleViolation[]) {
    const matches = [...schedule.matches]

    // Check players
    this.checkPlayerVenueTime(matches, violations)
    
    // Check teams for consecutive field time
    this.checkTeamVenueTime(matches, violations)

    return violations
  }

  private checkPlayerVenueTime(matches: Match[], violations: RuleViolation[]) {
    const playerMatches = ScheduleHelpers.groupMatchesByPlayer(matches)

    // Check each player's venue time
    Object.entries(playerMatches).forEach(([playerName, playerMatchList]) => {
      if (playerMatchList.length < 2) return // Skip players with only one game

      const sortedMatches = playerMatchList.sort((a, b) => a.timeSlot - b.timeSlot)
      const firstSlot = sortedMatches[0].timeSlot
      const lastSlot = sortedMatches[sortedMatches.length - 1].timeSlot

      // Calculate total time at venue (from first game start to last game end)
      const slotsSpan = lastSlot - firstSlot + 1 // +1 to include the last slot
      const hoursAtVenue = (slotsSpan * this.minutesPerSlot) / 60

      if (hoursAtVenue > this.maxHours) {
        violations.push({
          rule: this.name,
          description: `Player ${playerName} needs to be at venue for ${hoursAtVenue.toFixed(1)} hours (max: ${this.maxHours}h)`,
          matches: sortedMatches,
          level: 'warning',
        })
      }
    })
  }

  private checkTeamVenueTime(matches: Match[], violations: RuleViolation[]) {
    const sortedMatches = [...matches].sort((a, b) => a.timeSlot - b.timeSlot)

    // Get all unique fields
    const fields = Array.from(new Set(sortedMatches.map(m => m.field)))

    // Check each field for extended team presence
    for (const field of fields) {
      const venueMatches = sortedMatches.filter(m => m.field === field)

      // Get all teams that play/ref at this venue
      const teamsAtVenue = new Set<string>()
      venueMatches.forEach(match => {
        teamsAtVenue.add(match.team1.name)
        teamsAtVenue.add(match.team2.name)
        if (match.refereeTeam) {
          teamsAtVenue.add(match.refereeTeam.name)
        }
      })

      // Check each team's time at this venue
      for (const teamName of Array.from(teamsAtVenue)) {
        const teamVenueMatches = venueMatches
          .filter(m => m.team1.name === teamName || m.team2.name === teamName || m.refereeTeam?.name === teamName)
          .sort((a, b) => a.timeSlot - b.timeSlot)

        if (teamVenueMatches.length >= 3) {
          const timeSpan = teamVenueMatches[teamVenueMatches.length - 1].timeSlot - teamVenueMatches[0].timeSlot
          if (timeSpan <= 3) {
            // If 3+ games within 3 time slots
            violations.push({
              rule: this.name,
              description: `Team ${teamName}: Extended time at ${field} (${teamVenueMatches.length} games in ${timeSpan + 1} slots)`,
              matches: teamVenueMatches,
              level: 'warning',
            })
          }
        }
      }
    }
  }
}





/**
 * Rule to ensure players have warm-up time before their first game
 */
export class EnsurePlayerWarmupTime extends ScheduleRule {
  name
  minWarmupSlots
  constructor(priority = 1, minWarmupSlots = 1) {
    super(priority)
    this.name = 'Ensure player warm-up time'
    this.minWarmupSlots = minWarmupSlots
  }

  evaluate(schedule: Schedule, violations: RuleViolation[]) {
    const matches = [...schedule.matches]
    const playerMatches = ScheduleHelpers.groupMatchesByPlayer(matches)

    // Check each player's first game timing
    Object.entries(playerMatches).forEach(([playerName, playerMatchList]) => {
      const sortedMatches = playerMatchList.sort((a, b) => a.timeSlot - b.timeSlot)
      const firstMatch = sortedMatches[0]

      // Check if first game is too early (not enough warm-up time)
      if (firstMatch.timeSlot < this.minWarmupSlots + 1) {
        violations.push({
          rule: this.name,
          description: `Player ${playerName} has first game in slot ${firstMatch.timeSlot} (needs ${this.minWarmupSlots} warm-up slots)`,
          matches: [firstMatch],
          level: 'note',
        })
      }
    })

    return violations
  }
}

/**
 * Rule to balance referee assignments among teams
 */
export class BalanceRefereeAssignments extends ScheduleRule {
  name
  maxRefereeDifference
  constructor(priority = 2, maxRefereeDifference = 1) {
    super(priority)
    this.name = 'Balance referee assignments'
    this.maxRefereeDifference = maxRefereeDifference
  }

  evaluate(schedule: Schedule, violations: RuleViolation[]) {
    const matches = [...schedule.matches]
    const teamRefereeCount: { [teamName: string]: number } = {}

    // Count referee assignments per team
    matches.forEach(match => {
      if (match.refereeTeam) {
        const teamName = match.refereeTeam.name
        teamRefereeCount[teamName] = (teamRefereeCount[teamName] || 0) + 1
      }
    })

    // Check balance
    const refereeCounts = Object.values(teamRefereeCount)
    if (refereeCounts.length > 0) {
      const minAssignments = Math.min(...refereeCounts)
      const maxAssignments = Math.max(...refereeCounts)

      if (maxAssignments - minAssignments > this.maxRefereeDifference) {
        violations.push({
          rule: this.name,
          description: `Referee assignment imbalance: ${minAssignments}-${maxAssignments} assignments (max difference: ${this.maxRefereeDifference})`,
          matches: [], // Could add specific matches if needed
          level: 'warning',
        })
      }
    }

    return violations
  }
}

/**
 * Rule to ensure fair field distribution for teams
 */
export class EnsureFairFieldDistribution extends ScheduleRule {
  name
  fieldDistributionThreshold
  constructor(priority = 1, fieldDistributionThreshold = 0.6) {
    super(priority)
    this.name = 'Ensure fair field distribution'
    this.fieldDistributionThreshold = fieldDistributionThreshold
  }

  evaluate(schedule: Schedule, violations: RuleViolation[]) {
    const matches = [...schedule.matches]
    const teamFieldCount: { [teamName: string]: { [field: string]: number } } = {}

    // Count field usage per team
    matches.forEach(match => {
      ;[match.team1.name, match.team2.name].forEach(teamName => {
        if (!teamFieldCount[teamName]) {
          teamFieldCount[teamName] = {}
        }
        const field = match.field
        teamFieldCount[teamName][field] = (teamFieldCount[teamName][field] || 0) + 1
      })
    })

    // Check for teams playing too many games on the same field
    Object.entries(teamFieldCount).forEach(([teamName, fieldCounts]) => {
      const totalGames = Object.values(fieldCounts).reduce((sum: number, count: number) => sum + count, 0)
      const maxFieldGames = Math.max(...Object.values(fieldCounts))

      // If a team plays more than threshold of their games on one field, flag it
      if (totalGames >= 3 && maxFieldGames / totalGames > this.fieldDistributionThreshold) {
        const dominantField = Object.entries(fieldCounts).find(([_, count]) => count === maxFieldGames)?.[0]

        violations.push({
          rule: this.name,
          description: `Team ${teamName} plays ${maxFieldGames}/${totalGames} games on ${dominantField}`,
          matches: [], // Could add specific matches if needed
          level: 'warning',
        })
      }
    })

    return violations
  }
}




