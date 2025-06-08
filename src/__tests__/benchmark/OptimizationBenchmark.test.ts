import { Schedule } from '../../models/Schedule'
import { Match } from '../../models/Match'
import { Team } from '../../models/Team'
import { Player } from '../../models/Player'
import { 
  OPTIMIZATION_STRATEGIES, 
  OptimizationStrategyInfo,
  SIMULATED_ANNEALING_OPTIMIZE
} from '../../models/OptimizationStrategy'
import { ScheduleRule, AvoidBackToBackGames, ManageRestTimeAndGaps } from '../../models/ScheduleRule'
import { Division } from '../../models/Team'

// Test configuration constants
const BENCHMARK_ITERATIONS = 500
const TARGET_SCORE = 0 // Perfect score
const ACCEPTABLE_SCORE = 10 // Good enough score
const TIMEOUT_MS = 15000 // Reduced from 30 seconds

interface BenchmarkResult {
  strategyName: string
  initialScore: number
  finalScore: number
  bestScore: number
  iterationsToTarget?: number
  iterationsToAcceptable?: number
  convergenceRate: number
  totalTime: number
  scoresOverTime: number[]
  violationsByType: Record<string, number>
}

interface BenchmarkSuite {
  scenario: string
  results: BenchmarkResult[]
  bestStrategy: string
  worstStrategy: string
}

describe('Optimization Strategy Benchmark', () => {
  
  /**
   * Create realistic tournament data with common scheduling challenges
   */
  function createComplexTournamentScenario(): { schedule: Schedule; rules: ScheduleRule[] } {
    // Create teams across multiple divisions
    const mixedTeams = Array.from({ length: 8 }, (_, i) => {
      const team = new Team(`Mixed Team ${String.fromCharCode(65 + i)}`, 'mixed')
      // Add 4 players per team
      for (let j = 1; j <= 4; j++) {
        team.addPlayer(new Player(`Player ${String.fromCharCode(65 + i)}${j}`, 'mixed', 'cloth'))
      }
      return team
    })

    const genderedTeams = Array.from({ length: 6 }, (_, i) => {
      const team = new Team(`Gendered Team ${String.fromCharCode(65 + i)}`, 'gendered')
      for (let j = 1; j <= 4; j++) {
        team.addPlayer(new Player(`Player G${String.fromCharCode(65 + i)}${j}`, 'gendered', 'cloth'))
      }
      return team
    })

    const clothTeams = Array.from({ length: 4 }, (_, i) => {
      const team = new Team(`Cloth Team ${String.fromCharCode(65 + i)}`, 'cloth')
      for (let j = 1; j <= 4; j++) {
        team.addPlayer(new Player(`Player C${String.fromCharCode(65 + i)}${j}`, 'cloth', 'cloth'))
      }
      return team
    })

    // Create matches with intentionally problematic initial scheduling
    const matches: Match[] = []
    let timeSlot = 1

    // Mixed division matches - create round-robin with scheduling conflicts
    for (let i = 0; i < mixedTeams.length; i++) {
      for (let j = i + 1; j < mixedTeams.length; j++) {
        const field = `Field ${(matches.length % 3) + 1}` // 3 fields available
        const referee = genderedTeams[matches.length % genderedTeams.length]
        matches.push(new Match(mixedTeams[i], mixedTeams[j], timeSlot, field, 'mixed', referee))
        timeSlot++
      }
    }

    // Gendered division matches
    for (let i = 0; i < genderedTeams.length; i++) {
      for (let j = i + 1; j < genderedTeams.length; j++) {
        const field = `Field ${(matches.length % 3) + 1}`
        const referee = clothTeams[matches.length % clothTeams.length]
        matches.push(new Match(genderedTeams[i], genderedTeams[j], timeSlot, field, 'gendered', referee))
        timeSlot++
      }
    }

    // Cloth division matches
    for (let i = 0; i < clothTeams.length; i++) {
      for (let j = i + 1; j < clothTeams.length; j++) {
        const field = `Field ${(matches.length % 3) + 1}`
        const referee = mixedTeams[matches.length % mixedTeams.length]
        matches.push(new Match(clothTeams[i], clothTeams[j], timeSlot, field, 'cloth', referee))
        timeSlot++
      }
    }

    // Intentionally create problematic overlaps by resetting time slots
    // This will create conflicts that optimization needs to solve
    matches.forEach((match, index) => {
      // Create clustering that violates rest time rules but respects field constraints
      // Put 3 matches per time slot (matching the 3 available fields) to avoid field conflicts
      match.timeSlot = Math.floor(index / 3) + 1
      // Reassign fields to ensure no conflicts within each time slot
      match.field = `Field ${(index % 3) + 1}`
    })

    const schedule = new Schedule(matches)
    
    // Create comprehensive rules
    const rules: ScheduleRule[] = [
      new AvoidBackToBackGames(10), // High priority
      new ManageRestTimeAndGaps(8, 1, 6), // High priority - minimal rest, reasonable max gap
      // Add field conflict rule manually since it's not in the imported rules
      {
        name: 'No Field Conflicts',
        priority: 15, // Highest priority
        evaluate: (schedule: Schedule, violations: any[]) => {
          const fieldTimeMap = new Map<string, Set<number>>()
          
          schedule.matches.forEach(match => {
            const key = match.field
            if (!fieldTimeMap.has(key)) {
              fieldTimeMap.set(key, new Set())
            }
            
            if (fieldTimeMap.get(key)!.has(match.timeSlot)) {
              violations.push({
                rule: 'No Field Conflicts',
                description: `Field ${match.field} has multiple matches at time slot ${match.timeSlot}`,
                matches: [match],
                level: 'critical'
              })
            } else {
              fieldTimeMap.get(key)!.add(match.timeSlot)
            }
          })
        }
      } as ScheduleRule
    ]

    return { schedule, rules }
  }

  /**
   * Run benchmark for a single optimization strategy
   */
  async function benchmarkStrategy(
    strategy: OptimizationStrategyInfo,
    initialSchedule: Schedule,
    rules: ScheduleRule[]
  ): Promise<BenchmarkResult> {
    const startTime = Date.now()
    const scoresOverTime: number[] = []
    
    // Create a copy for optimization
    const testSchedule = initialSchedule.deepCopy()
    const initialScore = testSchedule.evaluate(rules)
    
    let bestScore = initialScore
    let iterationsToTarget: number | undefined
    let iterationsToAcceptable: number | undefined
    let currentIteration = 0

    // Track progress
    const progressCallback = (info: any) => {
      scoresOverTime.push(info.bestScore)
      
      if (!iterationsToAcceptable && info.bestScore <= ACCEPTABLE_SCORE) {
        iterationsToAcceptable = currentIteration
      }
      
      if (!iterationsToTarget && info.bestScore <= TARGET_SCORE) {
        iterationsToTarget = currentIteration
      }
      
      bestScore = Math.min(bestScore, info.bestScore)
      currentIteration = info.iteration
    }

    try {
      const optimizedSchedule = await testSchedule.optimize(
        rules,
        BENCHMARK_ITERATIONS,
        progressCallback,
        strategy
      )
      
      const finalScore = optimizedSchedule.score
      const totalTime = Date.now() - startTime
      
      // Calculate convergence rate (improvement per 100 iterations)
      const convergenceRate = (initialScore - bestScore) / (BENCHMARK_ITERATIONS / 100)
      
      // Analyze violation types
      const violationsByType: Record<string, number> = {}
      optimizedSchedule.violations.forEach(violation => {
        const rule = violation.rule || 'Unknown'
        violationsByType[rule] = (violationsByType[rule] || 0) + 1
      })

      return {
        strategyName: strategy.name,
        initialScore,
        finalScore,
        bestScore,
        iterationsToTarget,
        iterationsToAcceptable,
        convergenceRate,
        totalTime,
        scoresOverTime,
        violationsByType
      }
    } catch (error) {
      console.error(`Error benchmarking ${strategy.name}:`, error)
      return {
        strategyName: strategy.name,
        initialScore,
        finalScore: initialScore,
        bestScore: initialScore,
        convergenceRate: 0,
        totalTime: Date.now() - startTime,
        scoresOverTime: [initialScore],
        violationsByType: {}
      }
    }
  }

  /**
   * Run comprehensive benchmark suite
   */
  async function runBenchmarkSuite(scenario: string): Promise<BenchmarkSuite> {
    console.log(`\n🏁 Starting benchmark suite: ${scenario}`)
    
    const { schedule, rules } = createComplexTournamentScenario()
    const initialScore = schedule.evaluate(rules)
    
    console.log(`📊 Initial schedule score: ${initialScore}`)
    console.log(`📊 Total matches: ${schedule.matches.length}`)
    console.log(`📊 Initial violations: ${schedule.violations.length}`)
    
    const results: BenchmarkResult[] = []
    
    // Test each optimization strategy
    for (const strategy of OPTIMIZATION_STRATEGIES) {
      console.log(`\n🧪 Testing ${strategy.name}...`)
      const result = await benchmarkStrategy(strategy, schedule, rules)
      results.push(result)
      
      console.log(`   Initial: ${result.initialScore} → Final: ${result.finalScore} (Best: ${result.bestScore})`)
      console.log(`   Time: ${result.totalTime}ms, Convergence rate: ${result.convergenceRate.toFixed(2)}`)
      
      if (result.iterationsToAcceptable) {
        console.log(`   ✅ Reached acceptable score in ${result.iterationsToAcceptable} iterations`)
      }
      if (result.iterationsToTarget) {
        console.log(`   🎯 Reached target score in ${result.iterationsToTarget} iterations`)
      }
    }
    
    // Determine best and worst strategies
    const bestStrategy = results.reduce((best, current) => 
      current.bestScore < best.bestScore ? current : best
    ).strategyName
    
    const worstStrategy = results.reduce((worst, current) => 
      current.bestScore > worst.bestScore ? current : worst
    ).strategyName
    
    return {
      scenario,
      results,
      bestStrategy,
      worstStrategy
    }
  }

  test('Complex Tournament Benchmark', async () => {
    const suite = await runBenchmarkSuite('Complex Tournament with Multiple Divisions')
    
    // Print comprehensive results
    console.log('\n📈 BENCHMARK RESULTS SUMMARY')
    console.log('=' .repeat(60))
    console.log(`Scenario: ${suite.scenario}`)
    console.log(`Best Strategy: ${suite.bestStrategy}`)
    console.log(`Worst Strategy: ${suite.worstStrategy}`)
    
    console.log('\n📊 Detailed Results:')
    suite.results.forEach(result => {
      console.log(`\n${result.strategyName}:`)
      console.log(`  Score improvement: ${result.initialScore} → ${result.bestScore} (${((result.initialScore - result.bestScore) / result.initialScore * 100).toFixed(1)}%)`)
      console.log(`  Convergence rate: ${result.convergenceRate.toFixed(2)} points/100 iterations`)
      console.log(`  Time taken: ${result.totalTime}ms`)
      
      if (result.iterationsToAcceptable) {
        console.log(`  Iterations to acceptable: ${result.iterationsToAcceptable}`)
      } else {
        console.log(`  ❌ Did not reach acceptable score`)
      }
      
      if (result.iterationsToTarget) {
        console.log(`  Iterations to target: ${result.iterationsToTarget}`)
      } else {
        console.log(`  ❌ Did not reach target score`)
      }
      
      console.log(`  Final violation types:`, result.violationsByType)
    })
    
    // Assertions for test validity
    expect(suite.results).toHaveLength(OPTIMIZATION_STRATEGIES.length)
    expect(suite.results.every(r => r.bestScore <= r.initialScore)).toBe(true)
    expect(suite.bestStrategy).toBeDefined()
    expect(suite.worstStrategy).toBeDefined()
    
    // At least one strategy should show significant improvement
    const bestResult = suite.results.find(r => r.strategyName === suite.bestStrategy)!
    const improvementPercentage = (bestResult.initialScore - bestResult.bestScore) / bestResult.initialScore * 100
    expect(improvementPercentage).toBeGreaterThan(10) // At least 10% improvement
    
  }, TIMEOUT_MS * OPTIMIZATION_STRATEGIES.length) // Allow enough time for all strategies

  test('Convergence Speed Analysis', async () => {
    const { schedule, rules } = createComplexTournamentScenario()
    
    console.log('\n⚡ CONVERGENCE SPEED ANALYSIS')
    console.log('=' .repeat(50))
    
    // Test shorter runs to see early convergence patterns
    const shortIterations = 500
    const speedResults: Array<{strategy: string, earlyImprovement: number, timeToConverge: number}> = []
    
    for (const strategy of OPTIMIZATION_STRATEGIES) {
      const testSchedule = schedule.deepCopy()
      const initialScore = testSchedule.evaluate(rules)
      
      const startTime = Date.now()
      let bestFoundScore = initialScore
      let convergeTime = 0
      
      const progressCallback = (info: any) => {
        if (info.bestScore < bestFoundScore) {
          bestFoundScore = info.bestScore
          convergeTime = Date.now() - startTime
        }
      }
      
      await testSchedule.optimize(rules, shortIterations, progressCallback, strategy)
      
      const earlyImprovement = ((initialScore - bestFoundScore) / initialScore) * 100
      
      speedResults.push({
        strategy: strategy.name,
        earlyImprovement,
        timeToConverge: convergeTime
      })
      
      console.log(`${strategy.name}: ${earlyImprovement.toFixed(1)}% improvement in ${convergeTime}ms`)
    }
    
    // Find fastest converging strategy
    const fastestStrategy = speedResults.reduce((fastest, current) => 
      current.timeToConverge < fastest.timeToConverge ? current : fastest
    )
    
    console.log(`\n🏃 Fastest converging: ${fastestStrategy.strategy} (${fastestStrategy.timeToConverge}ms)`)
    
    expect(speedResults.length).toBe(OPTIMIZATION_STRATEGIES.length)
    expect(speedResults.every(r => r.earlyImprovement >= 0)).toBe(true)
  }, TIMEOUT_MS * OPTIMIZATION_STRATEGIES.length) // Add proper timeout
}) 