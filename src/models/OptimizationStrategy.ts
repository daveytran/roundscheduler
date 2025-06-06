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
  const coolingRate = 0.995

  let temperature: number = state.storage ?? 100
  
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

export const GENETIC_OPTIMIZE: Optimize<GeneticAlgorithmStorage> = (state, iteration, rules) => {
  const POPULATION_SIZE = 20
  const ELITE_SIZE = 4
  const MUTATION_RATE = 0.3
  const CROSSOVER_RATE = 0.7
  const MAX_STAGNATION = 100

  let storage = state.storage || {
    population: [],
    generation: 0,
    stagnationCount: 0
  }

  // Initialize population on first iteration
  if (storage.population.length === 0) {
    console.log('🧬 Initializing genetic algorithm population')
    storage.population = [state.currentSchedule.deepCopy()]
    
    // Create diverse initial population
    for (let i = 1; i < POPULATION_SIZE; i++) {
      const candidate = state.currentSchedule.randomize()
      candidate.evaluate(rules)
      storage.population.push(candidate)
    }
    
    // Sort by fitness (lower score is better)
    storage.population.sort((a, b) => a.score - b.score)
  }

  storage.generation++

  // Selection: Tournament selection for parents
  const selectParent = (): Schedule => {
    const tournamentSize = 3
    const tournament = []
    for (let i = 0; i < tournamentSize; i++) {
      tournament.push(storage.population[Math.floor(Math.random() * storage.population.length)])
    }
    tournament.sort((a, b) => a.score - b.score)
    return tournament[0]
  }

  // Crossover: Mix matches from two parents strategically
  const crossover = (parent1: Schedule, parent2: Schedule): Schedule => {
    const child = parent1.deepCopy()
    
    // Get matches grouped by division
    const parent1ByDivision = groupMatchesByDivision(parent1.matches)
    const parent2ByDivision = groupMatchesByDivision(parent2.matches)
    
    // For each division, randomly choose time slot assignments from either parent
    Object.keys(parent1ByDivision).forEach(division => {
      if (Math.random() < 0.5 && parent2ByDivision[division]) {
        const p1Matches = parent1ByDivision[division]
        const p2Matches = parent2ByDivision[division]
        
        // Try to copy time slot pattern from parent2 to child
        if (p1Matches.length === p2Matches.length) {
          p1Matches.forEach((match, index) => {
            if (p2Matches[index]) {
              const childMatch = child.matches.find(m => 
                m.team1.name === match.team1.name && 
                m.team2.name === match.team2.name
              )
              if (childMatch) {
                childMatch.timeSlot = p2Matches[index].timeSlot
                childMatch.field = p2Matches[index].field
              }
            }
          })
        }
      }
    })
    
    return child
  }

  // Mutation: Strategic swapping based on violations
  const mutate = (schedule: Schedule): Schedule => {
    const mutated = schedule.deepCopy()
    mutated.evaluate(rules)
    
    if (Math.random() < MUTATION_RATE) {
      // Strategic mutation: target matches involved in violations
      if (mutated.violations.length > 0) {
        strategicSwap(mutated)
      } else {
        // Random mutation if no violations
        mutated.matches = mutated.randomize().matches
      }
    }
    
    return mutated
  }

  // Create new generation
  const newPopulation: Schedule[] = []
  
  // Keep elite (best performers)
  const elite = storage.population.slice(0, ELITE_SIZE)
  newPopulation.push(...elite.map(s => s.deepCopy()))
  
  // Create offspring through crossover and mutation
  while (newPopulation.length < POPULATION_SIZE) {
    const parent1 = selectParent()
    const parent2 = selectParent()
    
    let offspring: Schedule
    if (Math.random() < CROSSOVER_RATE) {
      offspring = crossover(parent1, parent2)
    } else {
      offspring = parent1.deepCopy()
    }
    
    offspring = mutate(offspring)
    offspring.evaluate(rules)
    newPopulation.push(offspring)
  }

  // Sort new population by fitness
  newPopulation.sort((a, b) => a.score - b.score)
  storage.population = newPopulation

  const currentBest = storage.population[0]
  let bestSchedule: Schedule | undefined = undefined
  let currentSchedule: Schedule | undefined = undefined

  // Check for improvement
  if (currentBest.score < state.bestScore) {
    bestSchedule = currentBest.deepCopy()
    storage.stagnationCount = 0
    console.log(`🧬 Genetic algorithm found new best: ${currentBest.score} (generation ${storage.generation})`)
  } else {
    storage.stagnationCount++
  }

  // Introduce diversity if stagnated
  if (storage.stagnationCount > MAX_STAGNATION) {
    console.log('🧬 Population stagnant, introducing diversity')
    for (let i = ELITE_SIZE; i < storage.population.length; i++) {
      storage.population[i] = state.currentSchedule.randomize()
      storage.population[i].evaluate(rules)
    }
    storage.population.sort((a, b) => a.score - b.score)
    storage.stagnationCount = 0
  }

  // Use current best as the current schedule
  currentSchedule = currentBest.deepCopy()

  return {
    currentSchedule,
    bestSchedule,
    storage
  }
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
    id: 'genetic-algorithm',
    name: 'Genetic Algorithm',
    description: 'Evolves a population of solutions using crossover and mutation. Explores solution space more systematically.',
    optimize: GENETIC_OPTIMIZE
  },
  {
    id: 'strategic-swapping',
    name: 'Strategic Swapping',
    description: 'Targets specific rule violations with strategic match swapping. More focused on problem areas.',
    optimize: STRATEGIC_OPTIMIZE
  }
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
