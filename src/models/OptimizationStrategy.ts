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
  // Cool down
  const newSchedule = state.currentSchedule.randomize()
  // Decide whether to accept the new solution
  const newScore = newSchedule.evaluate()

  const criticalViolation = newSchedule.violations.find(it => it.level === 'critical')
  if (criticalViolation) {
    return {}
  }

  const acceptanceProbability = getAcceptanceProbability(state.currentScore, newScore, temperature)

  let currentSchedule: Schedule | undefined
  let bestSchedule: Schedule | undefined
  if (Math.random() < acceptanceProbability) {
    currentSchedule = newSchedule

    // Update best schedule if needed
    if (newScore < state.bestScore) {
      bestSchedule = newSchedule
    }
  }

  temperature *= coolingRate
  return {
    currentSchedule: newSchedule,
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
