import { Schedule } from './Schedule'
import { ScheduleRule } from './ScheduleRule'

type OptimizationState<T> = {
  currentSchedule: Schedule
  currentScore: number
  bestScore: number
  bestSchedule: Schedule
  storage: T | null
}
type OptimizeResult<T> = {
  currentSchedule?: Schedule
  /**
   * undefined will retain the current best schedule
   */
  bestSchedule?: Schedule
  /**
   * undefined will retain the current storage
   */
  storage?: T | null
}

type Optimize<T> = (state: OptimizationState<T>, iteration: number, rules: ScheduleRule[]) => OptimizeResult<T>

function createOptimize<T>(optimize: Optimize<T>) {
  return (state: OptimizationState<T>, iteration: number, rules: ScheduleRule[]) => {
    return optimize(state, iteration, rules)
  }
}

// Strategy metadata for UI selection
export interface OptimizationStrategyInfo {
  id: string
  name: string
  description: string
  optimize: Optimize<any>
}

export const RANDOM_OPTIMIZE: Optimize<number> = (state, iteration, rules) => {
  const coolingRate = 0.9985 // Slower cooling for better exploration

  let temperature: number = state.storage ?? 150 // Higher initial temperature
  
  // Try to create a new candidate solution using targeted swaps
  let newSchedule: Schedule | null = null
  let attempts = 0
  const maxAttempts = 5 // Limit attempts to avoid infinite loops

  while (newSchedule === null && attempts < maxAttempts) {
    attempts++
    
    // Randomly choose between swapMatches (70%) and swapTimeSlots (30%)
    const useSwapMatches = Math.random() < 0.7

    if (useSwapMatches) {
      // Get all non-locked, non-special matches that can be swapped
      const swappableMatches = state.currentSchedule.matches.filter(match => 
        !match.locked && !match.isSpecialActivity()
      )
      
      if (swappableMatches.length >= 2) {
        // Randomly select two different matches
        const match1Index = Math.floor(Math.random() * swappableMatches.length)
        let match2Index = Math.floor(Math.random() * swappableMatches.length)
        
        // Ensure we pick two different matches
        while (match2Index === match1Index && swappableMatches.length > 1) {
          match2Index = Math.floor(Math.random() * swappableMatches.length)
        }
        
        const match1 = swappableMatches[match1Index]
        const match2 = swappableMatches[match2Index]
        
        newSchedule = state.currentSchedule.swapMatches(match1, match2)
        
        // Debug: Log swap attempts occasionally
        if (Math.random() < 0.02) {
          const success = newSchedule !== null
          console.log(`🔄 SwapMatches attempt ${attempts}: ${match1.team1.name} vs ${match1.team2.name} (slot ${match1.timeSlot}) ↔ ${match2.team1.name} vs ${match2.team2.name} (slot ${match2.timeSlot}) - ${success ? 'Success' : 'Failed'}`)
        }
      }
    } else {
      // Get all unique time slots that have non-locked, non-special matches
      const timeSlotSet = new Set<number>()
      state.currentSchedule.matches.forEach(match => {
        if (!match.locked && !match.isSpecialActivity()) {
          timeSlotSet.add(match.timeSlot)
        }
      })
      
      const availableTimeSlots = Array.from(timeSlotSet)
      
      if (availableTimeSlots.length >= 2) {
        // Randomly select two different time slots
        const slot1Index = Math.floor(Math.random() * availableTimeSlots.length)
        let slot2Index = Math.floor(Math.random() * availableTimeSlots.length)
        
        // Ensure we pick two different time slots
        while (slot2Index === slot1Index && availableTimeSlots.length > 1) {
          slot2Index = Math.floor(Math.random() * availableTimeSlots.length)
        }
        
        const timeSlot1 = availableTimeSlots[slot1Index]
        const timeSlot2 = availableTimeSlots[slot2Index]
        
        newSchedule = state.currentSchedule.swapTimeSlots(timeSlot1, timeSlot2)
        
        // Debug: Log swap attempts occasionally
        if (Math.random() < 0.02) {
          const success = newSchedule !== null
          const slot1Matches = state.currentSchedule.matches.filter(m => m.timeSlot === timeSlot1).length
          const slot2Matches = state.currentSchedule.matches.filter(m => m.timeSlot === timeSlot2).length
          console.log(`🔄 SwapTimeSlots attempt ${attempts}: slot ${timeSlot1} (${slot1Matches} matches) ↔ slot ${timeSlot2} (${slot2Matches} matches) - ${success ? 'Success' : 'Failed'}`)
        }
      }
    }
  }

  // If all swap attempts failed, fall back to randomization as a last resort
  if (newSchedule === null) {
    newSchedule = state.currentSchedule.randomize()
    if (Math.random() < 0.01) {
      console.log(`⚠️ All targeted swaps failed after ${attempts} attempts, falling back to randomization`)
    }
  }

  const newScore = newSchedule.evaluate(rules)
  
  // Debug: Check if the new approach is producing changes
  if (newScore === state.currentScore && Math.random() < 0.02) {
    console.log(`⚠️ Targeted optimization produced same score: ${newScore}`)
  }

  // Skip solutions with critical violations 
  const criticalViolation = newSchedule.violations.find(it => it.level === 'critical')
  if (criticalViolation) {
    // Log occasionally to see if this is happening too often
    if (Math.random() < 0.01) {
      console.log(`❌ Rejecting solution due to critical violation: ${criticalViolation.description}`)
    }
    temperature *= coolingRate
    return {
      storage: temperature,
    }
  }

  const acceptanceProbability = getAcceptanceProbability(state.currentScore, newScore, temperature)

  let currentSchedule: Schedule | undefined = undefined
  let bestSchedule: Schedule | undefined = undefined

  // Always update best schedule if we found a better one
  if (newScore < state.bestScore) {
    bestSchedule = newSchedule.deepCopy()
    console.log(`🎉 New best score found: ${newScore} (was ${state.bestScore})`)
  }

  // Accept new schedule as current based on acceptance probability
  if (Math.random() < acceptanceProbability) {
    currentSchedule = newSchedule
  }

  temperature *= coolingRate
  return {
    currentSchedule,
    bestSchedule,
    storage: temperature,
  }
}


// Storage type for strategic optimization
interface StrategicStorage {
  temperature: number
  consecutiveRejections: number
  targetViolationType: string | null
}


// Registry of available optimization strategies
export const OPTIMIZATION_STRATEGIES: OptimizationStrategyInfo[] = [
  {
    id: 'simulated-annealing',
    name: 'Simulated Annealing',
    description: 'Classic optimization using random mutations with temperature-based acceptance. Good general-purpose approach.',
    optimize: RANDOM_OPTIMIZE
  },




]

// Helper functions

/**
 * Helper function to calculate acceptance probability
 */
function getAcceptanceProbability(currentScore: number, newScore: number, temperature: number) {
  // Always accept better solutions
  if (newScore < currentScore) {
    return 1.0
  }

  // Calculate probability of accepting worse solutions
  return Math.exp((currentScore - newScore) / temperature)
}

/**
 * Group matches by division for genetic algorithm crossover
 */
function groupMatchesByDivision(matches: any[]) {
  const groups: Record<string, any[]> = {}
  matches.forEach(match => {
    if (!match.isSpecialActivity || !match.isSpecialActivity()) {
      const division = match.division || 'default'
      if (!groups[division]) groups[division] = []
      groups[division].push(match)
    }
  })
  return groups
}

/**
 * Strategic swapping based on rule violations
 */
function strategicSwap(schedule: Schedule): Schedule {
  const violations = schedule.violations
  if (violations.length === 0) return schedule

  // Focus on the highest priority violations
  const highestPriority = Math.max(...violations.map(v => (v as any).priority || 1))
  const criticalViolations = violations.filter(v => ((v as any).priority || 1) >= highestPriority)
  
  if (criticalViolations.length === 0) return schedule

  // Pick a random violation to address
  const targetViolation = criticalViolations[Math.floor(Math.random() * criticalViolations.length)]
  
  // Try multiple approaches to address the violation
  let bestResult = schedule
  let bestScore = schedule.score

  // Approach 1: Direct match swapping
  const affectedMatches = schedule.matches.filter(match => {
    return targetViolation.description.includes(match.team1.name) || 
           targetViolation.description.includes(match.team2.name)
  })

  if (affectedMatches.length >= 2) {
    for (let i = 0; i < Math.min(3, affectedMatches.length); i++) {
      const match1 = affectedMatches[i]
      
      for (let j = i + 1; j < affectedMatches.length; j++) {
        const match2 = affectedMatches[j]
        
        // Try swapping the matches directly
        const swappedSchedule = schedule.swapMatches(match1, match2)
        if (swappedSchedule !== null) {
          const score = swappedSchedule.evaluate([])
          if (score < bestScore) {
            bestResult = swappedSchedule
            bestScore = score
          }
        }
      }
    }
  }

  // Approach 2: Time slot swapping (enhanced usage)
  const timeSlotInfo = analyzeTimeSlots(schedule)
  const affectedTimeSlots = Array.from(new Set(affectedMatches.map(m => m.timeSlot)))
  
  // Try swapping affected time slots with other time slots
  for (const affectedSlot of affectedTimeSlots) {
    const allTimeSlots = Object.keys(timeSlotInfo).map(Number)
    
    for (const otherSlot of allTimeSlots) {
      if (affectedSlot !== otherSlot) {
        const timeSlotSwapped = schedule.swapTimeSlots(affectedSlot, otherSlot)
        if (timeSlotSwapped !== null) {
          const score = timeSlotSwapped.evaluate([])
          if (score < bestScore) {
            bestResult = timeSlotSwapped
            bestScore = score
          }
        }
      }
    }
  }

  // Approach 3: Try swapping time slots with different load characteristics
  if (bestResult === schedule) {
    const timeSlotsByLoad = Object.entries(timeSlotInfo)
      .map(([slot, matches]) => ({ slot: Number(slot), load: matches.length }))
      .sort((a, b) => a.load - b.load)

    // Try swapping heavily loaded slots with lightly loaded ones
    const heavySlots = timeSlotsByLoad.slice(-2) // Top 2 heavy slots
    const lightSlots = timeSlotsByLoad.slice(0, 2) // Top 2 light slots

    for (const heavy of heavySlots) {
      for (const light of lightSlots) {
        if (Math.abs(heavy.load - light.load) >= 2) { // Only if significant difference
          const timeSlotSwapped = schedule.swapTimeSlots(heavy.slot, light.slot)
          if (timeSlotSwapped !== null) {
            const score = timeSlotSwapped.evaluate([])
            if (score < bestScore) {
              bestResult = timeSlotSwapped
              bestScore = score
            }
          }
        }
      }
    }
  }

  return bestResult
}

/**
 * Swap only the fields of two matches, keeping their time slots the same
 */
function swapFieldsOnly(schedule: Schedule, match1: any, match2: any): Schedule | null {
  // Check if either match is locked
  if (match1.locked || match2.locked) {
    return null;
  }

  // Find the matches in the schedule
  const match1Index = schedule.matches.findIndex(m => 
    m.team1.name === match1.team1.name && 
    m.team2.name === match1.team2.name && 
    m.timeSlot === match1.timeSlot &&
    m.field === match1.field
  );
  
  const match2Index = schedule.matches.findIndex(m => 
    m.team1.name === match2.team1.name && 
    m.team2.name === match2.team2.name && 
    m.timeSlot === match2.timeSlot &&
    m.field === match2.field
  );

  if (match1Index === -1 || match2Index === -1) {
    return null;
  }

  // Create a new schedule with swapped fields only (time slots stay the same)
  const newMatches = schedule.matches.map(match =>
    new (match.constructor as any)(
      match.team1,
      match.team2,
      match.timeSlot,
      match.field,
      match.division,
      match.refereeTeam,
      match.activityType,
      match.locked
    )
  );
  
  // Swap only the fields, keep time slots the same
  const tempField = newMatches[match1Index].field;
  newMatches[match1Index].field = newMatches[match2Index].field;
  newMatches[match2Index].field = tempField;

  return new Schedule(newMatches);
}

/**
 * Strategic improvement targeting specific violations
 */
function strategicImprovement(schedule: Schedule, rules: ScheduleRule[]): Schedule {
  let improved = schedule.deepCopy()
  
  // First, try strategic swaps targeting specific violations
  for (let attempt = 0; attempt < 3; attempt++) {
    const swappedSchedule = strategicSwap(improved)
    swappedSchedule.evaluate(rules)
    
    if (swappedSchedule.score <= improved.score) {
      improved = swappedSchedule
    } else {
      break // Stop if swaps are making things worse
    }
  }
  
  // Next, try strategic time slot swapping to redistribute load
  improved = tryStrategicTimeSlotSwaps(improved, rules)
  
  // Finally, fall back to conservative randomization if needed
  if (improved.score >= schedule.score) {
    improved = conservativeRandomization(improved, schedule)
  }
  
  return improved
}

/**
 * Try strategic time slot swaps to improve schedule balance and reduce violations
 */
function tryStrategicTimeSlotSwaps(schedule: Schedule, rules: ScheduleRule[]): Schedule {
  let improved = schedule.deepCopy()
  improved.evaluate(rules)
  
  // Get time slot information
  const timeSlotInfo = analyzeTimeSlots(schedule)
  const timeSlots = Object.keys(timeSlotInfo).map(Number).sort((a, b) => a - b)
  
  // Try strategic time slot swaps (3 attempts max to avoid infinite loops)
  for (let attempt = 0; attempt < 3; attempt++) {
    let bestSwap: Schedule | null = null
    let bestScore = improved.score
    
    // Try swapping different combinations of time slots
    for (let i = 0; i < timeSlots.length - 1; i++) {
      for (let j = i + 1; j < timeSlots.length; j++) {
        const timeSlot1 = timeSlots[i]
        const timeSlot2 = timeSlots[j]
        
        // Skip if time slots have significantly different load (might be intentional)
        const load1 = timeSlotInfo[timeSlot1]?.length || 0
        const load2 = timeSlotInfo[timeSlot2]?.length || 0
        const loadDifference = Math.abs(load1 - load2)
        
        // Allow swaps if loads are similar or if it might reduce violations
        if (loadDifference <= 2 || Math.random() < 0.3) {
          const swappedSchedule = improved.swapTimeSlots(timeSlot1, timeSlot2)
          
          if (swappedSchedule !== null) {
            const score = swappedSchedule.evaluate(rules)
            
            if (score < bestScore) {
              bestSwap = swappedSchedule
              bestScore = score
            }
          }
        }
      }
    }
    
    // Apply the best swap found, or break if no improvement
    if (bestSwap !== null) {
      improved = bestSwap
    } else {
      break
    }
  }
  
  return improved
}

/**
 * Analyze time slot distribution for strategic decision making
 */
function analyzeTimeSlots(schedule: Schedule): Record<number, any[]> {
  const timeSlotGroups: Record<number, any[]> = {}
  
  schedule.matches.forEach(match => {
    if (!match.isSpecialActivity?.()) {
      if (!timeSlotGroups[match.timeSlot]) timeSlotGroups[match.timeSlot] = []
      timeSlotGroups[match.timeSlot].push(match)
    }
  })
  
  return timeSlotGroups
}

/**
 * Conservative randomization fallback that preserves time slot structure
 */
function conservativeRandomization(improved: Schedule, originalSchedule: Schedule): Schedule {
  const timeSlotGroups = analyzeTimeSlots(improved)
  const timeSlots = Object.keys(timeSlotGroups).map(Number)
  
  const randomizedPortion = Math.random() * 0.2 // Reduced randomization to 20%
  const matchesToRandomize = Math.floor(improved.matches.length * randomizedPortion)
  
  for (let i = 0; i < matchesToRandomize; i++) {
    // 50% chance to swap within same time slot, 30% chance to swap time slots, 20% chance to swap matches
    const action = Math.random()
    
    if (action < 0.5) {
      // Swap matches within the same time slot (field/referee changes only)
      const randomTimeSlot = timeSlots[Math.floor(Math.random() * timeSlots.length)]
      const matchesInSlot = timeSlotGroups[randomTimeSlot]
      
      if (matchesInSlot.length >= 2) {
        const match1 = matchesInSlot[Math.floor(Math.random() * matchesInSlot.length)]
        const match2 = matchesInSlot[Math.floor(Math.random() * matchesInSlot.length)]
        
        if (match1 !== match2) {
          const fieldSwapped = swapFieldsOnly(improved, match1, match2)
          if (fieldSwapped !== null) {
            improved = fieldSwapped
          }
        }
      }
    } else if (action < 0.8) {
      // Swap entire time slots
      if (timeSlots.length >= 2) {
        const timeSlot1 = timeSlots[Math.floor(Math.random() * timeSlots.length)]
        const timeSlot2 = timeSlots[Math.floor(Math.random() * timeSlots.length)]
        
        if (timeSlot1 !== timeSlot2) {
          const timeSlotSwapped = improved.swapTimeSlots(timeSlot1, timeSlot2)
          if (timeSlotSwapped !== null) {
            improved = timeSlotSwapped
          }
        }
      }
    } else {
      // Swap individual matches across time slots
      const allMatches = improved.matches.filter(m => !m.isSpecialActivity?.() && !m.locked)
      if (allMatches.length >= 2) {
        const match1 = allMatches[Math.floor(Math.random() * allMatches.length)]
        const match2 = allMatches[Math.floor(Math.random() * allMatches.length)]
        
        if (match1 !== match2) {
          const matchSwapped = improved.swapMatches(match1, match2)
          if (matchSwapped !== null) {
            improved = matchSwapped
          }
        }
      }
    }
  }
  
  return improved
}
