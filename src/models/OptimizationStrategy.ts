import { Schedule } from './Schedule'

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

type Optimize<T> = (state: OptimizationState<T>, iteration: number) => OptimizeResult<T>

function createOptimize<T>(optimize: Optimize<T>) {
  return (state: OptimizationState<T>, iteration: number) => {
    return optimize(state, iteration)
  }
}

export const RANDOM_OPTIMIZE: Optimize<number> = state => {
  const coolingRate = 0.995

  let temperature: number = state.storage ?? 100
  
  // Create a new candidate solution
  const newSchedule = state.currentSchedule.randomize()
  const newScore = newSchedule.evaluate()
  
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
