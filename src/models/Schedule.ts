import { ScheduleHelpers } from '../lib/schedule-helpers'
import { OptimizationProgressInfo } from '../lib/scheduler'
import { Match } from './Match'
import { RANDOM_OPTIMIZE, OptimizationStrategyInfo } from './OptimizationStrategy'
import { RuleViolation } from './RuleViolation'
import { ScheduleRule } from './ScheduleRule'

/**
 * Schedule class represents a tournament schedule
 * with matches and scheduling rules
 */
export class Schedule {
  matches: Match[]
  violations: RuleViolation[]
  score: number
  originalScore?: number // Score before optimization

  constructor(matches?: (Match | any)[] | null) {
    // Ensure we always have an array
    const inputMatches = matches ?? []
    
    // Convert any plain objects to proper Match instances
    this.matches = inputMatches.map((match: any, index: number) => {
      // Check if this is already a proper Match instance
      if (match instanceof Match) {
        return match
      }
      
      // If it's a plain object, convert it to a Match instance
      console.log(`⚠️ Schedule constructor: Converting plain object to Match instance at index ${index}: ${match.team1?.name || 'Unknown'} vs ${match.team2?.name || 'Unknown'}`)
      
      return new Match(
        match.team1,
        match.team2,
        match.timeSlot,
        match.field,
        match.division,
        match.refereeTeam,
        match.activityType || 'REGULAR',
        match.locked || false
      )
    })
    
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
   * Evaluate all rules and calculate score
   * @param {ScheduleRule[]} rules - Rules to evaluate against
   * @param {boolean} verbose - Whether to log verbose output
   * @returns {number} Score (lower is better)
   */
  evaluate(rules: ScheduleRule[], verbose: boolean = false) {
    this.violations = []
    this.score = 0

    // Sort matches by time slot
    this.matches.sort((a, b) => a.timeSlot - b.timeSlot)

    // Evaluate each rule
    for (const rule of rules) {
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
   * Randomize the schedule using multiple strategies
   * Uses three approaches:
   * 1. Shuffle division blocks (keep divisions contiguous but reorder blocks)
   * 2. Shuffle within divisions (original approach - matches stay in division time ranges)
   * 3. Scatter divisions (allow divisions to be distributed across non-consecutive slots)
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
          match.activityType,
          match.locked
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

    let changesDetected = false

    // Three randomization strategies:
    // 25% - shuffle division blocks (keep divisions as contiguous blocks)
    // 50% - shuffle within divisions (original behavior)
    // 25% - scatter divisions across non-consecutive slots
    const randomStrategy = Math.random()

    if (randomStrategy < 0.25) {
      // Shuffle entire division blocks
      if (shouldLog) {
        console.log(`🔀 Shuffling division blocks`)
      }

      // Group matches by division to understand current block structure
      const divisionMatches = ScheduleHelpers.groupMatchesByDivision(regularMatches)
      const divisions = Object.keys(divisionMatches).filter(div => divisionMatches[div].length > 0)

      if (divisions.length > 1) {
        // Store original division order for comparison
        const originalOrder = divisions.sort((a, b) => {
          const avgTimeSlotA = divisionMatches[a].reduce((sum, m) => sum + m.timeSlot, 0) / divisionMatches[a].length
          const avgTimeSlotB = divisionMatches[b].reduce((sum, m) => sum + m.timeSlot, 0) / divisionMatches[b].length
          return avgTimeSlotA - avgTimeSlotB
        })

        // Shuffle the division order
        const shuffledDivisions = [...divisions]
        shuffleArray(shuffledDivisions)

        // Check if order actually changed
        const orderChanged = !originalOrder.every((div, index) => div === shuffledDivisions[index])

        if (orderChanged) {
          changesDetected = true

          if (shouldLog) {
            console.log(`  📊 Division order: ${originalOrder.join(', ')} → ${shuffledDivisions.join(', ')}`)
          }

          // Preserve original time slot structure by redistributing existing time slots among shuffled divisions
          // Collect ALL original time slots from the entire schedule (not just regularMatches being processed)
          const allOriginalTimeSlots: number[] = []
          this.matches.forEach(match => {
            if (match.timeSlot != null) {
              allOriginalTimeSlots.push(match.timeSlot)
            }
          })
          
          // Filter to only get time slots that belong to regular matches (not special activities)
          const regularMatchTimeSlots = regularMatches.map(m => m.timeSlot).filter(slot => slot != null)
          
          if (shouldLog) {
            console.log(`  📊 All schedule time slots: ${Array.from(new Set(allOriginalTimeSlots)).sort((a, b) => a - b).join(', ')}`)
            console.log(`  📊 Regular match time slots: ${Array.from(new Set(regularMatchTimeSlots)).sort((a, b) => a - b).join(', ')}`)
            console.log(`  📊 Total regular matches: ${regularMatches.length}`)
          }
          
          // Use the original time slots that were assigned to regular matches
          const timeSlotPool = [...regularMatchTimeSlots].sort((a, b) => a - b)
          
          // Distribute the time slots among the shuffled divisions
          let timeSlotIndex = 0
          shuffledDivisions.forEach((division, divIndex) => {
            const matches = divisionMatches[division]
            matches.forEach(match => {
              if (timeSlotIndex < timeSlotPool.length) {
                match.timeSlot = timeSlotPool[timeSlotIndex]
                timeSlotIndex++
              } else {
                // Fallback: if we run out of time slots, use the original time slot
                console.warn(`⚠️ Time slot pool exhausted for match ${match.team1.name} vs ${match.team2.name}, keeping original time slot ${match.timeSlot}`)
              }
            })
          })

          // Fix field assignments to prevent conflicts
          this.fixFieldConflicts(regularMatches)

          // Still shuffle referee assignments within each division
          for (const division of shuffledDivisions) {
            this.shuffleRefereeAssignments(divisionMatches[division])
          }
        }
      }
    } else if (randomStrategy < 0.75) {
      // Original approach: shuffle matches within existing division blocks
      const divisionMatches = ScheduleHelpers.groupMatchesByDivision(regularMatches)

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

        // Preserve exact time slot distribution by shuffling matches within each time slot group
        // Group matches by their current time slot
        const matchesBySlot = new Map<number, typeof matches>()
        matches.forEach(match => {
          if (!matchesBySlot.has(match.timeSlot)) {
            matchesBySlot.set(match.timeSlot, [])
          }
          matchesBySlot.get(match.timeSlot)!.push(match)
        })
        
        // Shuffle matches within each time slot group, preserving distribution
        matchesBySlot.forEach((slotMatches, timeSlot) => {
          shuffleArray(slotMatches)
        })
        
        // Rebuild the matches array with preserved time slot distribution
        matches.length = 0
        Array.from(matchesBySlot.entries()).forEach(([timeSlot, slotMatches]) => {
          matches.push(...slotMatches)
        })
        
        // Note: time slots are already correct, so no need to reassign them
        changesDetected = true // Matches were shuffled within slots

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

      // Fix field assignments to prevent conflicts after time slot shuffling
      this.fixFieldConflicts(regularMatches)
    } else {
      // Scatter divisions across non-consecutive time slots
      if (shouldLog) {
        console.log(`🌐 Scattering divisions across non-consecutive slots`)
      }

      // Store original arrangement for comparison
      const originalArrangement = regularMatches.map(m => ({ slot: m.timeSlot, division: m.division }))

      // Get existing special activity time slots to avoid conflicts
      const specialActivitySlots = new Set(specialActivities.map(m => m.timeSlot))

      // Determine available fields from existing matches
      const allFields = Array.from(new Set([...regularMatches, ...specialActivities].map(m => m.field)))
      const fieldsPerTimeSlot = allFields.length // Maximum matches that can happen simultaneously

      if (shouldLog) {
        console.log(`  📊 Available fields: ${allFields.join(', ')} (${fieldsPerTimeSlot} matches per slot)`)
      }

      // Calculate how many time slots we need (accounting for multiple matches per slot)
      const slotsNeeded = Math.ceil(regularMatches.length / fieldsPerTimeSlot)

      // Only use existing time slots from the schedule, avoiding special activity slots
      const existingTimeSlots = Array.from(new Set(this.matches.map(m => m.timeSlot))).sort((a, b) => a - b)
      const availableSlots = existingTimeSlots.filter(slot => !specialActivitySlots.has(slot))
      
      // If we don't have enough time slots for the scatter strategy, fall back to within-division shuffling
      if (availableSlots.length < slotsNeeded) {
        if (shouldLog) {
          console.log(`  ⚠️ Not enough existing time slots (${availableSlots.length}) for scattering ${slotsNeeded} slots needed. Falling back to within-division shuffling.`)
        }
        
        // Fall back to the original approach: shuffle matches within existing division blocks
        const divisionMatches = ScheduleHelpers.groupMatchesByDivision(regularMatches)

        // Randomize each division's regular matches and referee assignments
        for (const division in divisionMatches) {
          const matches = divisionMatches[division]

          if (matches.length === 0) continue

          // Store original state for comparison
          const originalTimeSlots = matches.map(m => m.timeSlot)
          const originalReferees = matches.map(m => m.refereeTeam?.name || 'none')

          // Shuffle the matches within the division
          shuffleArray(matches)

          // Preserve exact time slot distribution by shuffling matches within each time slot group
          const matchesBySlot = new Map<number, typeof matches>()
          matches.forEach(match => {
            if (!matchesBySlot.has(match.timeSlot)) {
              matchesBySlot.set(match.timeSlot, [])
            }
            matchesBySlot.get(match.timeSlot)!.push(match)
          })
          
          // Shuffle matches within each time slot group, preserving distribution
          matchesBySlot.forEach((slotMatches, timeSlot) => {
            shuffleArray(slotMatches)
          })
          
          // Rebuild the matches array with preserved time slot distribution
          matches.length = 0
          Array.from(matchesBySlot.entries()).forEach(([timeSlot, slotMatches]) => {
            matches.push(...slotMatches)
          })
          
          // Note: time slots are already correct, so no need to reassign them
          changesDetected = true // Matches were shuffled within slots

          // Shuffle referee assignments within this division
          this.shuffleRefereeAssignments(matches)

          // Check if referee assignments changed
          const newReferees = matches.map(m => m.refereeTeam?.name || 'none')
          if (JSON.stringify(originalReferees) !== JSON.stringify(newReferees)) {
            changesDetected = true
          }
        }

        // Fix field assignments to prevent conflicts after time slot shuffling
        this.fixFieldConflicts(regularMatches)
        
        // Skip the scatter logic below since we're falling back
      } else {

      // Preserve time slot distribution while scattering divisions
      // Group all regular matches by their current time slot
      const allMatchesBySlot = new Map<number, typeof regularMatches>()
      regularMatches.forEach(match => {
        if (!allMatchesBySlot.has(match.timeSlot)) {
          allMatchesBySlot.set(match.timeSlot, [])
        }
        allMatchesBySlot.get(match.timeSlot)!.push(match)
      })
      
      // For each time slot, shuffle the matches within that slot and reassign fields
      allMatchesBySlot.forEach((slotMatches, timeSlot) => {
        shuffleArray(slotMatches)
        
        // Reassign fields within this time slot to create variety
        const availableFields = [...allFields]
        shuffleArray(availableFields)
        
        slotMatches.forEach((match, index) => {
          const oldField = match.field
          if (index < availableFields.length) {
            match.field = availableFields[index]
          } else {
            // If more matches than fields, assign cyclically
            match.field = availableFields[index % availableFields.length]
          }
          
          if (match.field !== oldField) {
            changesDetected = true
          }
        })
      })

      // Group the matches by division for referee shuffling
      const divisionMatches = ScheduleHelpers.groupMatchesByDivision(regularMatches)
      for (const division in divisionMatches) {
        this.shuffleRefereeAssignments(divisionMatches[division])
      }

      if (shouldLog && changesDetected) {
        const newArrangement = regularMatches.map(m => ({ slot: m.timeSlot, division: m.division }))
        console.log(`  📊 Arrangement changed:`)
        console.log(`    Original: ${originalArrangement.map(a => `${a.slot}:${a.division}`).join(', ')}`)
        console.log(`    New:      ${newArrangement.map(a => `${a.slot}:${a.division}`).join(', ')}`)

        // Show how divisions are now distributed
        const divisionSlots: Record<string, number[]> = {}
        newArrangement.forEach(a => {
          if (!divisionSlots[a.division]) divisionSlots[a.division] = []
          divisionSlots[a.division].push(a.slot)
        })
        Object.keys(divisionSlots).forEach(div => {
          divisionSlots[div].sort((a, b) => a - b)
          console.log(`    ${div}: slots ${divisionSlots[div].join(', ')}`)
        })
      }
      }
    }

    // Combine all regular matches back together and add special activities
    const randomizedMatches = [...specialActivities] // Special activities keep their original slots
    const divisionMatches = ScheduleHelpers.groupMatchesByDivision(regularMatches)
    for (const division in divisionMatches) {
      randomizedMatches.push(...divisionMatches[division])
    }

    if (shouldLog) {
      console.log(`🔀 Randomization complete. Changes detected: ${changesDetected}`)
    }

    // Verify match integrity before returning
    if (randomizedMatches.length !== this.matches.length) {
      console.error(`❌ randomize() match count mismatch: original=${this.matches.length}, randomized=${randomizedMatches.length}`)
      console.error(`  Original: ${this.matches.length} total, ${specialActivities.length} special, ${regularMatches.length} regular`)
      console.error(`  Randomized: ${randomizedMatches.length} total`)
    }
    
    // Verify all special activities are preserved with original time slots
    const originalSpecialActivities = this.matches.filter(m => m.isSpecialActivity?.())
    const randomizedSpecialActivities = randomizedMatches.filter(m => m.isSpecialActivity?.())
    
    if (originalSpecialActivities.length !== randomizedSpecialActivities.length) {
      console.error(`❌ randomize() special activity count mismatch: original=${originalSpecialActivities.length}, randomized=${randomizedSpecialActivities.length}`)
    }
    
    // Verify special activities maintain their original time slots and properties
    originalSpecialActivities.forEach(original => {
      const randomized = randomizedSpecialActivities.find(r => 
        r.team1?.name === original.team1?.name && 
        r.team2?.name === original.team2?.name && 
        r.activityType === original.activityType
      )
      if (!randomized || randomized.timeSlot !== original.timeSlot) {
        console.error(`❌ Special activity modified during randomization: ${original.team1?.name} ${original.activityType}`)
      }
    })

    // Create and return a new schedule
    return new Schedule(randomizedMatches)
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

    // Assign referees for each time slot
    const timeSlots = Object.keys(matchesByTimeSlot)
      .map(Number)
      .sort((a, b) => a - b)
    let globalRefereeIndex = 0

    for (const timeSlot of timeSlots) {
      const timeSlotMatches = matchesByTimeSlot[timeSlot]
      if (!timeSlotMatches || timeSlotMatches.length === 0) {
        continue // Skip time slots with no matches
      }
      
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
        if (!timeSlotMatches || timeSlotMatches.length === 0) {
          continue // Skip if no matches in this time slot
        }
        
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
   * Fix field conflicts by reassigning fields to ensure no two matches 
   * are scheduled on the same field at the same time slot
   * @param {Match[]} matches - All matches to check and fix
   */
  private fixFieldConflicts(matches: Match[]) {
    // Get all available fields from the matches
    const allFields = Array.from(new Set(matches.map(m => m.field)))
    
    // Group matches by time slot
    const matchesByTimeSlot: Record<number, Match[]> = {}
    matches.forEach(match => {
      if (!matchesByTimeSlot[match.timeSlot]) {
        matchesByTimeSlot[match.timeSlot] = []
      }
      matchesByTimeSlot[match.timeSlot].push(match)
    })

    // For each time slot, ensure no field conflicts
    Object.keys(matchesByTimeSlot).forEach(timeSlotStr => {
      const timeSlot = parseInt(timeSlotStr)
      const timeSlotMatches = matchesByTimeSlot[timeSlot]
      
      if (!timeSlotMatches || timeSlotMatches.length <= 1) {
        return // No conflicts possible with 0 or 1 match
      }

      // Check if there are more matches than available fields
      if (timeSlotMatches.length > allFields.length) {
        console.warn(`⚠️ Time slot ${timeSlot} has ${timeSlotMatches.length} matches but only ${allFields.length} fields available`)
        // This should be handled by spreading matches across more time slots
        // For now, we'll do our best with available fields
      }

      // Track which fields are used in this time slot
      const usedFields = new Set<string>()
      const shuffledFields = [...allFields]
      shuffleArray(shuffledFields)

      // Reassign fields to prevent conflicts
      timeSlotMatches.forEach((match, index) => {
        // Try to find an unused field
        let assignedField = null
        for (const field of shuffledFields) {
          if (!usedFields.has(field)) {
            assignedField = field
            usedFields.add(field)
            break
          }
        }

        if (assignedField) {
          match.field = assignedField
        } else {
          // Fallback: if we run out of fields (shouldn't happen normally), 
          // assign cyclically and log a warning
          const fallbackField = shuffledFields[index % shuffledFields.length]
          match.field = fallbackField
          console.warn(`⚠️ Field conflict unavoidable: assigning ${match.team1.name} vs ${match.team2.name} to ${fallbackField} at time slot ${timeSlot}`)
        }
      })
    })
  }

  /**
   * Optimize schedule using specified optimization strategy
   * @param {ScheduleRule[]} rules - Rules to evaluate against
   * @param {number} iterations - Number of iterations
   * @param {(info: OptimizationProgressInfo) => void} progressCallback - Progress callback
   * @param {OptimizationStrategyInfo} strategy - Optimization strategy to use
   * @returns {Schedule} Optimized schedule
   */
  async optimize(rules: ScheduleRule[], iterations: number = 10000, progressCallback?: (info: OptimizationProgressInfo) => void, strategy?: OptimizationStrategyInfo) {
    // Initial evaluation
    this.evaluate(rules)
    const originalScore = this.score
    
    // Use provided strategy or default to simulated annealing
    const optimizationStrategy = strategy?.optimize || RANDOM_OPTIMIZE
    
    // Create initial copies for optimization - ensuring we have separate instances with deep copied matches
    let currentSchedule = this.deepCopy()
    currentSchedule.evaluate(rules)

    let bestSchedule = this.deepCopy()
    bestSchedule.evaluate(rules)
    let bestScore = bestSchedule.score

    // Store the original score in the best schedule
    bestSchedule.originalScore = originalScore

    let storage: any = null
    
    console.log(`🚀 Starting optimization with strategy: ${strategy?.name || 'Simulated Annealing'}`)

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
        bestScheduleSnapshot.evaluate(rules) // Ensure violations are up to date

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
      // Create a new candidate solution using selected strategy
      const optimizationResult = optimizationStrategy(
        { currentSchedule, currentScore: currentSchedule.score, bestScore, bestSchedule, storage },
        i,
        rules
      )

      // Update current schedule if optimization strategy provided one
      if (optimizationResult.currentSchedule) {
        currentSchedule = optimizationResult.currentSchedule
        currentSchedule.evaluate(rules) // Ensure current schedule is evaluated
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
        immediateBestSnapshot.evaluate(rules) // Ensure score and violations are current

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
    finalBestScheduleSnapshot.evaluate(rules) // Ensure violations are up to date

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

  /**
   * Swap two matches in the schedule
   * @param match1 First match to swap
   * @param match2 Second match to swap  
   * @returns New schedule with swapped matches, or null if either match is locked
   */
  swapMatches(match1: Match, match2: Match): Schedule | null {
    // Check if either match is locked
    if (match1.locked || match2.locked) {
      return null;
    }

    // Find the matches in our schedule
    const match1Index = this.matches.findIndex(m => 
      m.team1.name === match1.team1.name && 
      m.team2.name === match1.team2.name && 
      m.timeSlot === match1.timeSlot &&
      m.field === match1.field
    );
    
    const match2Index = this.matches.findIndex(m => 
      m.team1.name === match2.team1.name && 
      m.team2.name === match2.team2.name && 
      m.timeSlot === match2.timeSlot &&
      m.field === match2.field
    );

    if (match1Index === -1 || match2Index === -1) {
      console.warn('One or both matches not found in schedule');
      return null;
    }

    // Create a new schedule with swapped matches
    const newMatches = copyMatches(this.matches);
    
    // Swap time slots and fields
    const tempTimeSlot = newMatches[match1Index].timeSlot;
    const tempField = newMatches[match1Index].field;
    
    newMatches[match1Index].timeSlot = newMatches[match2Index].timeSlot;
    newMatches[match1Index].field = newMatches[match2Index].field;
    
    newMatches[match2Index].timeSlot = tempTimeSlot;
    newMatches[match2Index].field = tempField;

    return new Schedule(newMatches);
  }

  /**
   * Move matches to a specific time slot
   * @param matches Array of matches to move
   * @param targetTimeSlot Target time slot to move matches to
   * @returns New schedule with moved matches, or null if not enough courts available
   */
  moveMatchesToTimeSlot(matches: Match[], targetTimeSlot: number): Schedule | null {
    // Check if any of the matches are locked
    if (matches.some(match => match.locked)) {
      return null;
    }

    // Check if target time slot exists in the schedule
    const existingTimeSlots = new Set(this.matches.map(m => m.timeSlot));
    if (!existingTimeSlots.has(targetTimeSlot)) {
      return null; // Don't create new time slots
    }

    // Check if target time slot contains setup or packdown activities
    const setupOrPackdownInSlot = this.matches.some(m => 
      m.timeSlot === targetTimeSlot && 
      (m.activityType === 'SETUP' || m.activityType === 'PACKING_DOWN')
    );
    if (setupOrPackdownInSlot) {
      return null; // Don't allow moving into setup/packdown slots
    }

    // Get all available fields
    const allFields = Array.from(new Set(this.matches.map(m => m.field)));
    
    // Check what matches are already scheduled in the target time slot
    const existingMatchesInSlot = this.matches.filter(m => 
      m.timeSlot === targetTimeSlot && 
      !matches.some(moveMatch => 
        moveMatch.team1.name === m.team1.name && 
        moveMatch.team2.name === m.team2.name &&
        moveMatch.timeSlot === m.timeSlot &&
        moveMatch.field === m.field
      )
    );

    // Check if we have enough courts
    const totalMatchesInSlot = existingMatchesInSlot.length + matches.length;
    if (totalMatchesInSlot > allFields.length) {
      return null; // Not enough courts
    }

    // Create new schedule
    const newMatches = copyMatches(this.matches);
    
    // Find available fields in the target time slot
    const usedFields = new Set(existingMatchesInSlot.map(m => m.field));
    const availableFields = allFields.filter(field => !usedFields.has(field));

    // Move the matches
    matches.forEach((matchToMove, index) => {
      const matchIndex = newMatches.findIndex(m => 
        m.team1.name === matchToMove.team1.name && 
        m.team2.name === matchToMove.team2.name && 
        m.timeSlot === matchToMove.timeSlot &&
        m.field === matchToMove.field
      );

      if (matchIndex !== -1 && index < availableFields.length) {
        newMatches[matchIndex].timeSlot = targetTimeSlot;
        newMatches[matchIndex].field = availableFields[index];
      }
    });

    return new Schedule(newMatches);
  }

  /**
   * Swap all matches between two time slots
   * @param timeSlot1 First time slot
   * @param timeSlot2 Second time slot
   * @returns New schedule with swapped time slots
   */
  swapTimeSlots(timeSlot1: number, timeSlot2: number): Schedule | null {
    // Get all matches in both time slots
    const slot1Matches = this.matches.filter(m => m.timeSlot === timeSlot1);
    const slot2Matches = this.matches.filter(m => m.timeSlot === timeSlot2);

    // Check if any matches are locked
    if (slot1Matches.some(m => m.locked) || slot2Matches.some(m => m.locked)) {
      return null;
    }

    // Check if any matches have special activities (SETUP or PACKING_DOWN) - these should be treated as locked
    if (slot1Matches.some(m => m.isSpecialActivity()) ||
        slot2Matches.some(m => m.isSpecialActivity())) {
      return null;
    }

    // Create new schedule
    const newMatches = copyMatches(this.matches);

    // Swap time slots for all matches
    newMatches.forEach(match => {
      if (match.timeSlot === timeSlot1) {
        match.timeSlot = timeSlot2;
      } else if (match.timeSlot === timeSlot2) {
        match.timeSlot = timeSlot1;
      }
    });

    return new Schedule(newMatches);
  }

  deepCopy() {
    const copy = new Schedule(copyMatches(this.matches))
    copy.score = this.score
    copy.violations = [...this.violations] // Shallow copy is sufficient for violations array
    copy.originalScore = this.originalScore
    
    // Verify match integrity (debug assertions)
    if (copy.matches.length !== this.matches.length) {
      console.error(`❌ deepCopy() match count mismatch: original=${this.matches.length}, copy=${copy.matches.length}`)
    }
    
    // Safer special activity filtering that handles non-Match instances
    const getSpecialActivities = (matches: any[]) => {
      return matches.filter(m => {
        // Handle both Match instances and plain objects
        if (typeof m.isSpecialActivity === 'function') {
          return m.isSpecialActivity()
        } else {
          // For plain objects, check activityType directly
          return m.activityType === 'SETUP' || m.activityType === 'PACKING_DOWN'
        }
      })
    }
    
    const originalSpecialActivities = getSpecialActivities(this.matches)
    const copySpecialActivities = getSpecialActivities(copy.matches)
    
    if (originalSpecialActivities.length !== copySpecialActivities.length) {
      console.error(`❌ deepCopy() special activity count mismatch: original=${originalSpecialActivities.length}, copy=${copySpecialActivities.length}`)
      
      // Debug: Show the actual matches that are special activities
      console.log('Original special activities:')
      originalSpecialActivities.forEach(m => {
        const hasMethod = typeof m.isSpecialActivity === 'function'
        console.log(`  ${m.team1?.name || 'Unknown'} vs ${m.team2?.name || 'Unknown'} - activityType: "${m.activityType}", hasMethod: ${hasMethod}`)
      })
      
      console.log('Copy special activities:')
      copySpecialActivities.forEach(m => {
        const hasMethod = typeof m.isSpecialActivity === 'function'
        console.log(`  ${m.team1?.name || 'Unknown'} vs ${m.team2?.name || 'Unknown'} - activityType: "${m.activityType}", hasMethod: ${hasMethod}`)
      })
      
      // Debug: Show all original matches and their types
      console.log('All original matches (first 10):')
      this.matches.slice(0, 10).forEach((m, i) => {
        const hasMethod = typeof m.isSpecialActivity === 'function'
        const isInstance = m instanceof Match
        console.log(`  [${i}] ${m.team1?.name || 'Unknown'} vs ${m.team2?.name || 'Unknown'} - activityType: "${m.activityType}", hasMethod: ${hasMethod}, isInstance: ${isInstance}`)
      })
    }
    
    return copy
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
    match => {
      // Debug: Check if this is actually a Match instance
      const isInstance = match instanceof Match
      const hasMethod = typeof match.isSpecialActivity === 'function'
      
      if (!isInstance || !hasMethod) {
        console.log(`⚠️ copyMatches: Found non-Match instance: ${match.team1?.name || 'Unknown'} vs ${match.team2?.name || 'Unknown'}, isInstance: ${isInstance}, hasMethod: ${hasMethod}`)
      }
      
      // Debug: Log any matches with unusual activityType values
      if (match.activityType !== 'SETUP' && match.activityType !== 'PACKING_DOWN' && match.activityType !== 'REGULAR') {
        console.log(`⚠️ copyMatches: Found match with unusual activityType: "${match.activityType}" for ${match.team1?.name || 'Unknown'} vs ${match.team2?.name || 'Unknown'}`)
      }
      
      // Ensure we have a valid activityType
      const activityType = match.activityType || 'REGULAR'
      
      const newMatch = new Match(
        match.team1,
        match.team2,
        match.timeSlot,
        match.field,
        match.division,
        match.refereeTeam,
        activityType,
        match.locked
      )
      
      // Debug: Check if the copy has different special activity status
      const originalIsSpecial = hasMethod ? match.isSpecialActivity() : (match.activityType === 'SETUP' || match.activityType === 'PACKING_DOWN')
      const copyIsSpecial = newMatch.isSpecialActivity()
      
      if (originalIsSpecial !== copyIsSpecial) {
        console.log(`⚠️ copyMatches: Special activity status changed during copy: ${match.team1?.name || 'Unknown'} vs ${match.team2?.name || 'Unknown'}`)
        console.log(`  Original: activityType="${match.activityType}", isSpecial=${originalIsSpecial}`)
        console.log(`  Copy: activityType="${newMatch.activityType}", isSpecial=${copyIsSpecial}`)
      }
      
      return newMatch
    }
  )
}
