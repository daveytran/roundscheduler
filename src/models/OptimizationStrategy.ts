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
  
  // Create a new candidate solution
  const newSchedule = state.currentSchedule.randomize()
  const newScore = newSchedule.evaluate(rules)
  
  // Debug: Check if randomization is working (log occasionally)
  if (newScore === state.currentScore && Math.random() < 0.02) {
    console.log(`⚠️ Randomization produced same score: ${newScore}`)
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

// Storage type for genetic algorithm
interface GeneticAlgorithmStorage {
  population: Schedule[]
  generation: number
  stagnationCount: number
}


// Storage type for strategic optimization
interface StrategicStorage {
  temperature: number
  consecutiveRejections: number
  targetViolationType: string | null
}

export const STRATEGIC_OPTIMIZE: Optimize<StrategicStorage> = (state, iteration, rules) => {
  const coolingRate = 0.997
  const maxConsecutiveRejections = 50

  let storage = state.storage || {
    temperature: 100,
    consecutiveRejections: 0,
    targetViolationType: null
  }

  // Analyze current violations to target specific issues
  const currentSchedule = state.currentSchedule
  currentSchedule.evaluate(rules)
  
  let newSchedule: Schedule

  if (currentSchedule.violations.length > 0 && Math.random() < 0.8) {
    // Strategic approach: target specific violations
    newSchedule = strategicImprovement(currentSchedule, rules)
  } else {
    // Fallback to random improvement
    newSchedule = currentSchedule.randomize()
  }

  const newScore = newSchedule.evaluate(rules)

  // Skip solutions with critical violations 
  const criticalViolation = newSchedule.violations.find(it => it.level === 'critical')
  if (criticalViolation) {
    storage.consecutiveRejections++
    storage.temperature *= coolingRate
    return { storage }
  }

  const acceptanceProbability = getAcceptanceProbability(state.currentScore, newScore, storage.temperature)
  
  let currentScheduleResult: Schedule | undefined = undefined
  let bestSchedule: Schedule | undefined = undefined

  // Always update best schedule if we found a better one
  if (newScore < state.bestScore) {
    bestSchedule = newSchedule.deepCopy()
    storage.consecutiveRejections = 0
    console.log(`🎯 Strategic optimization found new best: ${newScore} (was ${state.bestScore})`)
  }

  // Accept new schedule based on probability
  if (Math.random() < acceptanceProbability) {
    currentScheduleResult = newSchedule
    storage.consecutiveRejections = 0
  } else {
    storage.consecutiveRejections++
  }

  // Increase mutation intensity if stuck
  if (storage.consecutiveRejections > maxConsecutiveRejections) {
    console.log('🎯 Strategic optimization stuck, increasing randomization')
    storage.temperature = Math.min(storage.temperature * 1.5, 200)
    storage.consecutiveRejections = 0
  }

  storage.temperature *= coolingRate

  return {
    currentSchedule: currentScheduleResult,
    bestSchedule,
    storage
  }
}



// Registry of available optimization strategies
export const OPTIMIZATION_STRATEGIES: OptimizationStrategyInfo[] = [
  {
    id: 'simulated-annealing',
    name: 'Simulated Annealing',
    description: 'Classic optimization using random mutations with temperature-based acceptance. Good general-purpose approach.',
    optimize: RANDOM_OPTIMIZE
  },

  {
    id: 'strategic-swapping',
    name: 'Strategic Swapping',
    description: 'Targets specific rule violations with strategic match swapping. More focused on problem areas.',
    optimize: STRATEGIC_OPTIMIZE
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
function strategicSwap(schedule: Schedule): void {
  const violations = schedule.violations
  if (violations.length === 0) return

  // Focus on the highest priority violations
  const highestPriority = Math.max(...violations.map(v => (v as any).priority || 1))
  const criticalViolations = violations.filter(v => ((v as any).priority || 1) >= highestPriority)
  
  if (criticalViolations.length === 0) return

  // Pick a random violation to address
  const targetViolation = criticalViolations[Math.floor(Math.random() * criticalViolations.length)]
  
  // Try to find matches involved in this violation and swap them strategically
  const affectedMatches = schedule.matches.filter(match => {
    return targetViolation.description.includes(match.team1.name) || 
           targetViolation.description.includes(match.team2.name)
  })

  if (affectedMatches.length >= 2) {
    // Swap time slots between two affected matches
    const match1 = affectedMatches[0]
    const match2 = affectedMatches[Math.floor(Math.random() * affectedMatches.length)]
    
    const tempTimeSlot = match1.timeSlot
    const tempField = match1.field
    
    match1.timeSlot = match2.timeSlot
    match1.field = match2.field
    match2.timeSlot = tempTimeSlot
    match2.field = tempField
  }
}

/**
 * Strategic improvement targeting specific violations
 */
function strategicImprovement(schedule: Schedule, rules: ScheduleRule[]): Schedule {
  const improved = schedule.deepCopy()
  
  // Try several strategic swaps
  for (let attempt = 0; attempt < 3; attempt++) {
    strategicSwap(improved)
    improved.evaluate(rules)
    
    // If we made it worse, try a different approach
    if (improved.score > schedule.score) {
      // Fall back to partial randomization
      const randomizedPortion = Math.random() * 0.3 // Randomize up to 30% of matches
      const matchesToRandomize = Math.floor(improved.matches.length * randomizedPortion)
      
      for (let i = 0; i < matchesToRandomize; i++) {
        const randomMatch = improved.matches[Math.floor(Math.random() * improved.matches.length)]
        const anotherMatch = improved.matches[Math.floor(Math.random() * improved.matches.length)]
        
        if (randomMatch !== anotherMatch && !randomMatch.isSpecialActivity?.() && !anotherMatch.isSpecialActivity?.()) {
          const tempTimeSlot = randomMatch.timeSlot
          randomMatch.timeSlot = anotherMatch.timeSlot
          anotherMatch.timeSlot = tempTimeSlot
        }
      }
      break
    }
  }
  
  return improved
}
