import { ScheduleHelpers } from '../lib/schedule-helpers'
import { OptimizationProgressInfo } from '../lib/scheduler'
import { Match } from './Match'
import { RANDOM_OPTIMIZE } from './OptimizationStrategy'
import { RuleViolation } from './RuleViolation'
import { ScheduleRule } from './ScheduleRule'

/**
 * Schedule class represents a tournament schedule
 * with matches and scheduling rules
 */
export class Schedule {
  matches: Match[]
  rules: ScheduleRule[]
  violations: RuleViolation[]
  score: number
  originalScore?: number // Score before optimization

  constructor(matches: Match[] = [], rules: ScheduleRule[] = []) {
    this.matches = matches
    this.rules = rules
    this.violations = []
    this.score = 0 // Lower is better (fewer rule violations)
  }

  /**
   * Add a match to the schedule
   * @param {Match} match - Match to add
   */
  addMatch(match: Match) {
    this.matches.push(match)
  }

  /**
   * Add a scheduling rule
   * @param {ScheduleRule} rule - Rule to add
   */
  addRule(rule: ScheduleRule) {
    this.rules.push(rule)
  }

  /**
   * Evaluate all rules and calculate score
   * @returns {number} Score (lower is better)
   */
  evaluate(verbose: boolean = false) {
    this.violations = []
    this.score = 0

    // Sort matches by time slot
    this.matches.sort((a, b) => a.timeSlot - b.timeSlot)

    // Evaluate each rule
    for (const rule of this.rules) {
      const ruleViolations: RuleViolation[] = []
      rule.evaluate(this, ruleViolations)

      if (verbose && ruleViolations.length > 0) {
        console.log(`⚠️ Rule "${rule.name}" found ${ruleViolations.length} violations (priority ${rule.priority})`)
      }

      this.score += ruleViolations.length * rule.priority
      this.violations = [...this.violations, ...ruleViolations]
    }

    if (verbose) {
      console.log(`📊 Schedule evaluated: ${this.violations.length} total violations, score = ${this.score}`)
    }
    return this.score
  }

  /**
   * Randomize the schedule while keeping divisions together
   * Games can be shuffled across blocks as long as the blocks are both for the same division
   * SETUP and PACKING DOWN activities cannot be shuffled
   * Referees are also shuffled to optimize referee assignments
   * @returns {Schedule} New randomized schedule
   */
  randomize() {
    // Create deep copies of matches to avoid modifying the original
    const newMatches = this.matches.map(
      match =>
        new Match(
          match.team1,
          match.team2,
          match.timeSlot,
          match.field,
          match.division,
          match.refereeTeam,
          match.activityType
        )
    )

    // Separate regular matches from special activities
    const specialActivities = newMatches.filter(match => match.isSpecialActivity())
    const regularMatches = newMatches.filter(match => !match.isSpecialActivity())

    // Only log occasionally to avoid spam
    const shouldLog = Math.random() < 0.005 // Log ~0.5% of randomization attempts

    if (shouldLog) {
      console.log(
        `🔀 Randomizing: ${regularMatches.length} regular matches, ${specialActivities.length} special activities`
      )
    }

    // Group regular matches by division
    const divisionMatches = ScheduleHelpers.groupMatchesByDivision(regularMatches)

    let changesDetected = false

    // Randomize each division's regular matches and referee assignments
    for (const division in divisionMatches) {
      const matches = divisionMatches[division]

      if (matches.length === 0) continue

      if (shouldLog) {
        console.log(`🎲 Processing division ${division} with ${matches.length} matches`)
      }

      // Store original state for comparison
      const originalTimeSlots = matches.map(m => m.timeSlot)
      const originalReferees = matches.map(m => m.refereeTeam?.name || 'none')

      // Shuffle the matches within the division
      shuffleArray(matches)

      // Get all time slots available to this division (sorted)
      const availableTimeSlots = matches.map(m => m.timeSlot).sort((a, b) => a - b)

      // Randomly assign the shuffled time slots to any available time slot for this division
      shuffleArray(availableTimeSlots)

      // Assign the shuffled time slots to the shuffled matches
      matches.forEach((match, index) => {
        const oldTimeSlot = match.timeSlot
        match.timeSlot = availableTimeSlots[index]
        if (oldTimeSlot !== match.timeSlot) {
          changesDetected = true
        }
      })

      // Shuffle referee assignments within this division
      this.shuffleRefereeAssignments(matches)

      // Check if referee assignments changed
      const newReferees = matches.map(m => m.refereeTeam?.name || 'none')
      if (JSON.stringify(originalReferees) !== JSON.stringify(newReferees)) {
        changesDetected = true
      }

      if (shouldLog) {
        console.log(
          `  📊 Time slots changed: ${JSON.stringify(originalTimeSlots)} → ${JSON.stringify(matches.map(m => m.timeSlot))}`
        )
        console.log(`  👥 Referees changed: ${JSON.stringify(originalReferees)} → ${JSON.stringify(newReferees)}`)
      }
    }

    // Combine all regular matches back together and add special activities
    const randomizedMatches = [...specialActivities] // Special activities keep their original slots
    for (const division in divisionMatches) {
      randomizedMatches.push(...divisionMatches[division])
    }

    if (shouldLog) {
      console.log(`🔀 Randomization complete. Changes detected: ${changesDetected}`)
    }

    // Create and return a new schedule
    return new Schedule(randomizedMatches, this.rules)
  }

  /**
   * Shuffle referee assignments within a division while ensuring teams don't referee themselves
   * and that referees aren't assigned to multiple matches in the same time slot
   * @param {Match[]} matches - Matches within a division to shuffle referees for
   */
  private shuffleRefereeAssignments(matches: Match[]) {
    // Collect all referee teams that were originally assigned
    const originalRefereeTeams = matches.map(match => match.refereeTeam).filter(ref => ref !== null)

    // If no referees assigned, skip shuffling
    if (originalRefereeTeams.length === 0) {
      return
    }

    // Disable frequent logging from referee shuffling
    // console.log(
    //   `Shuffling referees for ${matches.length} matches with ${originalRefereeTeams.length} original referees`
    // )

    // Get all unique teams in this division that could potentially referee
    const allTeamsInDivision = new Set<string>()
    matches.forEach(match => {
      allTeamsInDivision.add(match.team1.name)
      allTeamsInDivision.add(match.team2.name)
    })

    // Convert to array and shuffle for random assignment
    const availableRefereeTeams = Array.from(new Set(originalRefereeTeams.map(ref => ref!.name)))
      .map(refName => originalRefereeTeams.find(ref => ref!.name === refName)!)
      .filter(ref => ref !== null)

    // console.log(`Available referee teams: ${availableRefereeTeams.map(ref => ref!.name).join(', ')}`)
    shuffleArray(availableRefereeTeams)

    // Reset all referee assignments first
    matches.forEach(match => {
      match.refereeTeam = null
    })

    // Group matches by time slot to handle conflicts
    const matchesByTimeSlot: Record<number, Match[]> = {}
    matches.forEach(match => {
      if (!matchesByTimeSlot[match.timeSlot]) {
        matchesByTimeSlot[match.timeSlot] = []
      }
      matchesByTimeSlot[match.timeSlot].push(match)
    })

    // console.log(`Time slots: ${Object.keys(matchesByTimeSlot).join(', ')}`)

    // Assign referees for each time slot
    const timeSlots = Object.keys(matchesByTimeSlot)
      .map(Number)
      .sort((a, b) => a - b)
    let globalRefereeIndex = 0

    for (const timeSlot of timeSlots) {
      const timeSlotMatches = matchesByTimeSlot[timeSlot]
      const usedRefereesThisSlot = new Set<string>()

      // console.log(`Assigning referees for time slot ${timeSlot} with ${timeSlotMatches.length} matches`)

      for (const match of timeSlotMatches) {
        // Find a referee that:
        // 1. Isn't playing in this match
        // 2. Isn't already refereeing another match in this time slot
        // 3. Is available
        let assignedReferee = null
        let attempts = 0

        while (attempts < availableRefereeTeams.length && !assignedReferee) {
          const candidateReferee = availableRefereeTeams[globalRefereeIndex % availableRefereeTeams.length]

          if (
            candidateReferee &&
            candidateReferee.name !== match.team1.name &&
            candidateReferee.name !== match.team2.name &&
            !usedRefereesThisSlot.has(candidateReferee.name)
          ) {
            assignedReferee = candidateReferee
            usedRefereesThisSlot.add(candidateReferee.name)
            match.refereeTeam = candidateReferee
            // console.log(`  Assigned ${candidateReferee.name} to referee ${match.team1.name} vs ${match.team2.name}`)
          }

          globalRefereeIndex++
          attempts++
        }

        // If we couldn't find a suitable referee from the original list,
        // try any team from the division that's not playing and not already assigned
        if (!assignedReferee) {
          for (const refTeam of availableRefereeTeams) {
            if (
              refTeam &&
              refTeam.name !== match.team1.name &&
              refTeam.name !== match.team2.name &&
              !usedRefereesThisSlot.has(refTeam.name)
            ) {
              match.refereeTeam = refTeam
              usedRefereesThisSlot.add(refTeam.name)
              // console.log(`  Backup assigned ${refTeam.name} to referee ${match.team1.name} vs ${match.team2.name}`)
              break
            }
          }
        }

        if (!match.refereeTeam) {
          // console.log(
          //   `  WARNING: Could not assign referee for ${match.team1.name} vs ${match.team2.name} at time ${timeSlot}`
          // )
        }
      }
    }

    // Final pass: for any matches still without referees, try to assign any available team
    // (this handles edge cases where we don't have enough referee teams)
    for (const match of matches) {
      if (!match.refereeTeam) {
        // Get all teams not playing in this match and not already refereeing in this time slot
        const timeSlotMatches = matchesByTimeSlot[match.timeSlot]
        const usedRefereesThisSlot = new Set(
          timeSlotMatches.filter(m => m.refereeTeam && m !== match).map(m => m.refereeTeam!.name)
        )

        const availableReferee = availableRefereeTeams.find(
          refTeam =>
            refTeam &&
            refTeam.name !== match.team1.name &&
            refTeam.name !== match.team2.name &&
            !usedRefereesThisSlot.has(refTeam.name)
        )

        if (availableReferee) {
          match.refereeTeam = availableReferee
          // console.log(
          //   `  Final pass assigned ${availableReferee.name} to referee ${match.team1.name} vs ${match.team2.name}`
          // )
        }
      }
    }

    // console.log('Referee assignment completed')
  }

  /**
   * Optimize schedule using simulated annealing
   * @param {number} iterations - Number of iterations
   * @returns {Schedule} Optimized schedule
   */
  async optimize(iterations: number = 10000, progressCallback?: (info: OptimizationProgressInfo) => void) {
    // Initial evaluation
    this.evaluate()
    const originalScore = this.score
    // Create initial copies for optimization - ensuring we have separate instances with deep copied matches
    let currentSchedule = this.deepCopy()
    currentSchedule.evaluate()

    let bestSchedule = this.deepCopy()
    bestSchedule.evaluate()
    let bestScore = bestSchedule.score

    // Store the original score in the best schedule
    bestSchedule.originalScore = originalScore

    let storage: any = null

    // Initial progress update to show starting state
    progressCallback?.({
      iteration: 0,
      progress: 0,
      currentScore: currentSchedule.score,
      bestScore: bestScore,
      violations: bestSchedule.violations,
      currentSchedule: currentSchedule,
      bestScheduleSnapshot: bestSchedule.deepCopy(),
    })

    // Optimization loop
    for (let i = 0; i < iterations; i++) {
      // Allow for progress updates and cancellation
      if (i % 100 === 0) {
        // Reduced frequency since we have immediate updates for improvements
        await new Promise(resolve => setTimeout(resolve, 0))

        // Only log major checkpoints to reduce noise
        if (i % 200 === 0 && i > 0) {
          console.log(`📊 Progress checkpoint at iteration ${i}: best=${bestScore}, current=${currentSchedule.score}`)
        }

        // Always send a fresh copy of the current best schedule
        const bestScheduleSnapshot = bestSchedule.deepCopy()
        bestScheduleSnapshot.evaluate() // Ensure violations are up to date

        // Verify the snapshot matches the best score
        if (bestScheduleSnapshot.score !== bestScore) {
          console.warn(
            `⚠️ Regular update mismatch: bestScore=${bestScore}, scheduleScore=${bestScheduleSnapshot.score}`
          )
        }

        progressCallback?.({
          iteration: i,
          progress: i / iterations,
          currentScore: currentSchedule.score,
          bestScore: bestScore,
          violations: bestScheduleSnapshot.violations,
          currentSchedule: currentSchedule,
          bestScheduleSnapshot: bestScheduleSnapshot,
        })
      }
      // Create a new candidate solution
      const optimizationResult = RANDOM_OPTIMIZE(
        { currentSchedule, currentScore: currentSchedule.score, bestScore, bestSchedule, storage },
        i
      )

      // Update current schedule if optimization strategy provided one
      if (optimizationResult.currentSchedule) {
        currentSchedule = optimizationResult.currentSchedule
        currentSchedule.evaluate() // Ensure current schedule is evaluated
      }

      // Update storage (temperature for simulated annealing)
      if (optimizationResult.storage !== undefined) {
        storage = optimizationResult.storage
      }

      // Update best schedule if optimization strategy found a better one
      if (optimizationResult.bestSchedule) {
        bestSchedule = optimizationResult.bestSchedule
        bestScore = bestSchedule.score // Score should already be calculated
        bestSchedule.originalScore = originalScore

        // Immediately notify UI of improvement (don't wait for next regular update)
        // Critical: Use the NEWLY FOUND best schedule, not a copy of previous best
        const immediateBestSnapshot = optimizationResult.bestSchedule.deepCopy()
        immediateBestSnapshot.evaluate() // Ensure score and violations are current

        progressCallback?.({
          iteration: i,
          progress: i / iterations,
          currentScore: currentSchedule.score,
          bestScore: bestScore,
          violations: immediateBestSnapshot.violations,
          currentSchedule: currentSchedule,
          bestScheduleSnapshot: immediateBestSnapshot,
        })
      }
    }

    // Final progress update
    const finalBestScheduleSnapshot = bestSchedule.deepCopy()
    finalBestScheduleSnapshot.evaluate() // Ensure violations are up to date

    progressCallback?.({
      iteration: iterations,
      progress: 1,
      currentScore: currentSchedule.score,
      bestScore: bestScore,
      violations: finalBestScheduleSnapshot.violations,
      currentSchedule: currentSchedule,
      bestScheduleSnapshot: finalBestScheduleSnapshot,
    })

    return bestSchedule
  }

  deepCopy() {
    return new Schedule(copyMatches(this.matches), [...this.rules])
  }
}

/**
 * Helper function to shuffle an array in place
 */
function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
}
// Helper function to create deep copies of matches
const copyMatches = (matches: Match[]): Match[] => {
  return matches.map(
    match =>
      new Match(
        match.team1,
        match.team2,
        match.timeSlot,
        match.field,
        match.division,
        match.refereeTeam,
        match.activityType
      )
  )
}
