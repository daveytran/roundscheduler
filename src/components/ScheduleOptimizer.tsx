import React, { useState, useEffect, useRef } from 'react';
import { Schedule } from '../models/Schedule';
import { Match } from '../models/Match';
import { ScheduleRule } from '../models/ScheduleRule';
import { OptimizerSettings } from '../lib/localStorage';
import { OPTIMIZATION_STRATEGIES } from '../models/OptimizationStrategy';
import ScheduleVisualization, { ScheduleVisualizationSettings } from './ScheduleVisualization';

function normalizeStrategyId(strategyId?: string): string {
  if (strategyId && OPTIMIZATION_STRATEGIES.some(strategy => strategy.id === strategyId)) {
    return strategyId;
  }
  return OPTIMIZATION_STRATEGIES[0]?.id || 'simulated-annealing';
}

function getMatchesFingerprint(matches: Match[]): string {
  return matches
    .map(match =>
      [
        match.team1?.name || '',
        match.team2?.name || '',
        match.timeSlot,
        match.field,
        match.division,
        match.refereeTeam?.name || '',
        match.activityType,
        match.locked ? '1' : '0',
      ].join('|')
    )
    .sort()
    .join('||');
}

// Props interface
interface ScheduleOptimizerProps {
  matches: Match[];
  rules: ScheduleRule[];
  initialSettings?: OptimizerSettings;
  onSettingsChange?: (settings: OptimizerSettings) => void;
  onOptimizationComplete?: (schedule: Schedule) => void;
  visualizationSettings?: ScheduleVisualizationSettings;
  onVisualizationSettingsChange?: (settings: ScheduleVisualizationSettings) => void;
}

export default function ScheduleOptimizer({
  matches,
  rules,
  initialSettings,
  onSettingsChange,
  onOptimizationComplete,
  visualizationSettings,
  onVisualizationSettingsChange,
}: ScheduleOptimizerProps) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [iterations, setIterations] = useState(initialSettings?.iterations || 10000);
  const [strategyId, setStrategyId] = useState(normalizeStrategyId(initialSettings?.strategyId));
  const [originalScore, setOriginalScore] = useState<number | null>(null); // pain points
  const [originalObjectiveScore, setOriginalObjectiveScore] = useState<number | null>(null);
  const [currentScore, setCurrentScore] = useState<number | null>(null); // objective
  const [bestScore, setBestScore] = useState<number | null>(null); // objective
  const [currentPainScore, setCurrentPainScore] = useState<number | null>(null);
  const [bestPainScore, setBestPainScore] = useState<number | null>(null);
  const [currentConcentrationPenaltyScore, setCurrentConcentrationPenaltyScore] = useState<number | null>(null);
  const [bestConcentrationPenaltyScore, setBestConcentrationPenaltyScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renderedSchedule, setRenderedSchedule] = useState<Schedule | null>(null);
  const [showLiveVisualization, setShowLiveVisualization] = useState(true);
  const [lastUpdateIteration, setLastUpdateIteration] = useState<number>(0);
  const [liveBaselineViolationCount, setLiveBaselineViolationCount] = useState<number | null>(null);
  const [liveBestViolationCount, setLiveBestViolationCount] = useState<number | null>(null);
  const [liveLatestViolationChange, setLiveLatestViolationChange] = useState<number>(0);
  
  // Track original imported matches and continuation state
  const [originalMatches, setOriginalMatches] = useState<Match[]>(matches || []);
  const [currentOptimizedSchedule, setCurrentOptimizedSchedule] = useState<Schedule | null>(null);
  const originalMatchesFingerprintRef = useRef<string>(getMatchesFingerprint(matches || []));
  const continuationScheduleRef = useRef<Schedule | null>(null);

  // Throttling refs to avoid stale closure state inside optimization callback
  const lastUIUpdateRef = useRef<number>(0);
  const bestScoreRef = useRef<number | null>(null);
  const previousViolationCountRef = useRef<number | null>(null);

  // Reset continuation when imported match content changes (not just length)
  useEffect(() => {
    const nextMatches = matches || [];
    const incomingFingerprint = getMatchesFingerprint(nextMatches);

    if (incomingFingerprint !== originalMatchesFingerprintRef.current) {
      originalMatchesFingerprintRef.current = incomingFingerprint;
      setCurrentOptimizedSchedule(null);
      continuationScheduleRef.current = null;
      setOriginalScore(null);
      setOriginalObjectiveScore(null);
      setCurrentScore(null);
      setBestScore(null);
      setCurrentPainScore(null);
      setBestPainScore(null);
      setCurrentConcentrationPenaltyScore(null);
      setBestConcentrationPenaltyScore(null);
      setRenderedSchedule(null);
      setError(null);
      bestScoreRef.current = null;
      lastUIUpdateRef.current = 0;
      previousViolationCountRef.current = null;
      setLiveBaselineViolationCount(null);
      setLiveBestViolationCount(null);
      setLiveLatestViolationChange(0);
    }

    setOriginalMatches(nextMatches);
  }, [matches]);

  // Track if settings were changed by user vs props to prevent feedback loop
  const [userChangedSettings, setUserChangedSettings] = useState(false);

  // Update settings when initialSettings change (but not if user made changes)
  useEffect(() => {
    if (initialSettings && !userChangedSettings) {
      setIterations(initialSettings.iterations);
      setStrategyId(normalizeStrategyId(initialSettings.strategyId));
    }
  }, [initialSettings, userChangedSettings]);

  // Save settings when iterations or strategy change (debounced to prevent spam)
  useEffect(() => {
    if (onSettingsChange && userChangedSettings) {
      const timeoutId = setTimeout(() => {
        onSettingsChange({ iterations, strategyId });
      }, 300); // 300ms debounce
      
      return () => clearTimeout(timeoutId);
    }
  }, [iterations, strategyId, onSettingsChange, userChangedSettings]);

  const handleStartOptimization = async () => {
    try {
      setError(null);
      setIsOptimizing(true);
      setProgress(0);
      setRenderedSchedule(null);
      setLastUpdateIteration(0);
      lastUIUpdateRef.current = 0;
      bestScoreRef.current = null;
      previousViolationCountRef.current = null;
      setUserChangedSettings(false); // Reset user changes flag so future prop updates work
      setLiveLatestViolationChange(0);

      if (!originalMatches || originalMatches.length === 0) {
        throw new Error('No matches to optimize');
      }

      if (!rules || rules.length === 0) {
        throw new Error('No rules configured for optimization');
      }

      // Validate that rules have proper evaluate methods
      const invalidRules = rules.filter(rule => !rule || typeof rule.evaluate !== 'function');
      if (invalidRules.length > 0) {
        throw new Error('Some rules are not properly initialized. Please visit the Rules tab first to configure them.');
      }

      // Determine starting point: use current optimized schedule if available, otherwise original matches
      let startingSchedule: Schedule;
      let preservedOriginalScore = originalScore;
      let preservedOriginalObjectiveScore = originalObjectiveScore;
      
      const continuationSource = continuationScheduleRef.current || currentOptimizedSchedule;

      if (continuationSource) {
        // Continue optimization from the last optimized result
        startingSchedule = continuationSource.deepCopy();
        // Preserve the original score from the previous optimization
        if (continuationSource.originalScore !== undefined) {
          preservedOriginalScore = continuationSource.originalScore;
        }
        if (continuationSource.originalObjectiveScore !== undefined) {
          preservedOriginalObjectiveScore = continuationSource.originalObjectiveScore;
        }
        console.log(
          `🔄 Continuing optimization from previous result with objective ${startingSchedule.objectiveScore}`
        );
      } else {
        // Start optimization from original matches
        startingSchedule = new Schedule(originalMatches);
        console.log(`🚀 Starting optimization from original matches`);
      }

      // Initial evaluation to get the starting score
      startingSchedule.evaluate(rules);
      const startingPainScore = startingSchedule.score;
      const startingObjectiveScore = startingSchedule.objectiveScore;
      const startingViolationCount = startingSchedule.violations?.length || 0;
      
      // Set original score only if this is the first optimization
      if (preservedOriginalScore === null) {
        preservedOriginalScore = startingPainScore;
        setOriginalScore(startingPainScore);
      } else {
        setOriginalScore(preservedOriginalScore);
      }

      if (preservedOriginalObjectiveScore === null) {
        preservedOriginalObjectiveScore = startingObjectiveScore;
        setOriginalObjectiveScore(startingObjectiveScore);
      } else {
        setOriginalObjectiveScore(preservedOriginalObjectiveScore);
      }
      
      setCurrentScore(startingObjectiveScore);
      setBestScore(startingObjectiveScore);
      setCurrentPainScore(startingPainScore);
      setBestPainScore(startingPainScore);
      setCurrentConcentrationPenaltyScore(startingSchedule.concentrationPenaltyScore);
      setBestConcentrationPenaltyScore(startingSchedule.concentrationPenaltyScore);
      bestScoreRef.current = startingObjectiveScore;
      setLiveBaselineViolationCount(startingViolationCount);
      setLiveBestViolationCount(startingViolationCount);
      setLiveLatestViolationChange(0);
      previousViolationCountRef.current = startingViolationCount;
      
      console.log(
        `Starting optimization: ${originalMatches.length} matches, ${rules.length} rules, pain ${startingPainScore}, objective ${startingObjectiveScore}`
      );
      
      // Set initial schedule for visualization
      setRenderedSchedule(startingSchedule.deepCopy());
      setLastUpdateIteration(0);

      // Find the selected optimization strategy
      const selectedStrategy = OPTIMIZATION_STRATEGIES.find(s => s.id === strategyId) || OPTIMIZATION_STRATEGIES[0];

      // Optimize the schedule (pass rules to optimize method)
      const bestScheduleFromRunRef = { current: null as Schedule | null };

      const optimized = await startingSchedule.optimize(rules, iterations, info => {
        const objectiveCurrentScore = info.currentObjectiveScore ?? info.currentScore;
        const objectiveBestScore = info.bestObjectiveScore ?? info.bestScore;

        // Update progress and current score immediately (very lightweight)
        setProgress(info.progress);
        setCurrentScore(objectiveCurrentScore);
        if (info.currentPainScore !== undefined) {
          setCurrentPainScore(info.currentPainScore);
        }
        const currentConcentrationPenalty =
          info.currentConcentrationPenaltyScore ?? info.currentSpreadPenaltyScore;
        if (currentConcentrationPenalty !== undefined) {
          setCurrentConcentrationPenaltyScore(currentConcentrationPenalty);
        }

        if (info.bestScheduleSnapshot) {
          bestScheduleFromRunRef.current = info.bestScheduleSnapshot.deepCopy();
        }

        // Always update scores on first few iterations to ensure they show
        const isEarlyIteration = info.iteration <= 5;
        
        // Throttle visualization updates after initial iterations to prevent flashing
        const now = Date.now();
        const timeSinceLastUpdate = now - lastUIUpdateRef.current;
        const isImprovement = bestScoreRef.current !== null && objectiveBestScore < bestScoreRef.current;
        const isNearCompletion = info.progress >= 0.99;
        
        const shouldUpdate = isEarlyIteration || // Always update first few iterations
                            timeSinceLastUpdate >= 300 || // Update at most every 300ms (reduced from 500ms)
                            isImprovement || // Always update on improvement
                            isNearCompletion; // Always update near completion

        if (shouldUpdate) {
          // Update best score and visualization
          setBestScore(objectiveBestScore);
          if (info.bestPainScore !== undefined) {
            setBestPainScore(info.bestPainScore);
          }
          const bestConcentrationPenalty =
            info.bestConcentrationPenaltyScore ?? info.bestSpreadPenaltyScore;
          if (bestConcentrationPenalty !== undefined) {
            setBestConcentrationPenaltyScore(bestConcentrationPenalty);
          }
          bestScoreRef.current = objectiveBestScore;

          // Update visualization
          if (info.currentSchedule) {
            const currentViolationCount = info.currentSchedule.violations?.length || 0;
            if (previousViolationCountRef.current !== null && previousViolationCountRef.current !== currentViolationCount) {
              setLiveLatestViolationChange(currentViolationCount - previousViolationCountRef.current);
            }
            previousViolationCountRef.current = currentViolationCount;
            setLiveBestViolationCount(previousBest =>
              previousBest === null ? currentViolationCount : Math.min(previousBest, currentViolationCount)
            );
            setRenderedSchedule(info.currentSchedule);
            setLastUpdateIteration(info.iteration);
          }
          
          lastUIUpdateRef.current = now;
        }
      }, selectedStrategy);

      // Use the best snapshot tracked during this run for continuation reliability.
      const finalizedOptimized = bestScheduleFromRunRef.current?.deepCopy() || optimized.deepCopy();

      // Final evaluation
      finalizedOptimized.evaluate(rules);

      // Ensure the optimized schedule has the correct originalScore
      if (preservedOriginalScore !== null) {
        finalizedOptimized.originalScore = preservedOriginalScore;
      }
      if (preservedOriginalObjectiveScore !== null) {
        finalizedOptimized.originalObjectiveScore = preservedOriginalObjectiveScore;
      }

      // Store the optimized schedule for future continuation
      setCurrentOptimizedSchedule(finalizedOptimized);
      continuationScheduleRef.current = finalizedOptimized.deepCopy();

      // Clear live preview now that optimization is complete
      setRenderedSchedule(null);

      // Notify parent component
      if (onOptimizationComplete) {
        onOptimizationComplete(finalizedOptimized);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Optimization error: ${errorMessage}`);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleResetToOriginal = () => {
    if (window.confirm('Are you sure you want to reset to the original schedule? This will lose your current optimization progress.')) {
      setCurrentOptimizedSchedule(null);
      continuationScheduleRef.current = null;
      setOriginalScore(null);
      setOriginalObjectiveScore(null);
      setCurrentScore(null);
      setBestScore(null);
      setCurrentPainScore(null);
      setBestPainScore(null);
      setCurrentConcentrationPenaltyScore(null);
      setBestConcentrationPenaltyScore(null);
      setRenderedSchedule(null);
      setError(null);
      bestScoreRef.current = null;
      lastUIUpdateRef.current = 0;
      previousViolationCountRef.current = null;
      setLiveBaselineViolationCount(null);
      setLiveBestViolationCount(null);
      setLiveLatestViolationChange(0);
      console.log('🔄 Reset to original schedule');
      
      // Notify parent component with original schedule
      if (onOptimizationComplete && originalMatches.length > 0) {
        const originalSchedule = new Schedule(originalMatches);
        originalSchedule.evaluate(rules);
        // Clear any originalScore property since this is the original
        originalSchedule.originalScore = undefined;
        originalSchedule.originalObjectiveScore = undefined;
        onOptimizationComplete(originalSchedule);
      }
    }
  };



  const hasOptimizedSchedule = currentOptimizedSchedule !== null;
  const isStartingFromOptimized = hasOptimizedSchedule && !isOptimizing;
  const hasMultipleStrategies = OPTIMIZATION_STRATEGIES.length > 1;
  const selectedStrategy = OPTIMIZATION_STRATEGIES.find(s => s.id === strategyId) || OPTIMIZATION_STRATEGIES[0];

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Schedule Optimizer</h2>

      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">
          The optimizer uses simulated annealing to reduce total pain points while avoiding concentrated pain on a small set of teams or players. 
          {isStartingFromOptimized 
            ? ' Continue optimizing from your current result, or reset to start over.'
            : hasMultipleStrategies
              ? ' Choose a strategy that best fits your needs and adjust iterations for better results.'
              : ' Adjust iterations to trade off speed vs solution quality.'
          }
        </p>

        <div className="flex items-center gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Optimization Strategy</label>
            {hasMultipleStrategies ? (
              <select
                value={strategyId}
                onChange={e => {
                  setStrategyId(normalizeStrategyId(e.target.value));
                  setUserChangedSettings(true);
                }}
                className="w-48 p-2 border rounded"
                disabled={isOptimizing}
              >
                {OPTIMIZATION_STRATEGIES.map(strategy => (
                  <option key={strategy.id} value={strategy.id}>
                    {strategy.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="w-48 p-2 border rounded bg-gray-50 text-gray-700 text-sm">
                {selectedStrategy?.name || 'Simulated Annealing'}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Iterations</label>
            <input
              type="number"
              value={iterations}
              onChange={e => {
                setIterations(parseInt(e.target.value) || 0);
                setUserChangedSettings(true);
              }}
              min="0"
              step="1000"
              className="w-32 p-2 border rounded"
              disabled={isOptimizing}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleStartOptimization}
              disabled={isOptimizing || !originalMatches || originalMatches.length === 0 || !rules || rules.length === 0}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
            >
              {isOptimizing 
                ? 'Optimizing...' 
                : isStartingFromOptimized 
                  ? 'Continue Optimization' 
                  : 'Start Optimization'
              }
            </button>

            {hasOptimizedSchedule && !isOptimizing && (
              <button
                onClick={handleResetToOriginal}
                className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
                title="Reset to the original unoptimized schedule"
              >
                🔄 Reset to Original
              </button>
            )}
          </div>
        </div>

        {/* Status message for current state */}
        {isStartingFromOptimized && !isOptimizing && (
          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="flex items-center gap-2">
              <span className="text-blue-600">🎯</span>
              <span className="text-sm text-blue-800 font-medium">
                Ready to continue from optimized schedule (Objective: {currentOptimizedSchedule?.objectiveScore.toFixed(2)})
              </span>
            </div>
            <p className="text-xs text-blue-700 mt-1">
              Next optimization starts from this result. Pain: {currentOptimizedSchedule?.score}, concentration penalty: {currentOptimizedSchedule?.concentrationPenaltyScore.toFixed(2)}.
            </p>
          </div>
        )}

        {/* Strategy Description */}
        {selectedStrategy ? (
          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
            <h4 className="font-medium text-blue-900 mb-1">{selectedStrategy.name}</h4>
            <p className="text-sm text-blue-700">{selectedStrategy.description}</p>
          </div>
        ) : null}

        {isOptimizing && (
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
              <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${Math.round(progress * 100)}%` }}></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>{Math.round(progress * 100)}% complete</span>
              <span>
                Iteration {Math.round(progress * iterations)} of {iterations}
              </span>
            </div>
          </div>
        )}

        {(originalScore !== null || originalObjectiveScore !== null || currentScore !== null || bestScore !== null) && (
          <div className="p-3 bg-gray-50 border rounded">
            <h3 className="font-bold mb-2">Optimization Results</h3>
            
            {/* Debug info - remove in production */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                <strong>Debug:</strong> Original pain: {originalScore}, Original objective: {originalObjectiveScore}, Best objective: {bestScore}, Current objective: {currentScore}
              </div>
            )}

            {(originalScore !== null || originalObjectiveScore !== null) && (
              <div className="mb-2">
                <p className="text-sm">
                  {originalScore !== null && (
                    <>
                      <span className="font-medium">Original pain points:</span> {originalScore}
                    </>
                  )}
                  {originalScore !== null && originalObjectiveScore !== null && <span className="mx-2 text-gray-400">|</span>}
                  {originalObjectiveScore !== null && (
                    <>
                      <span className="font-medium">Original objective:</span> {originalObjectiveScore.toFixed(2)}
                    </>
                  )}
                </p>
              </div>
            )}

            {/* Show current objective during optimization */}
            {isOptimizing && currentScore !== null && (
              <div className="mb-2">
                <p className="text-sm text-blue-600">
                  <span className="font-medium">Current objective:</span> {currentScore.toFixed(2)}
                  {bestScore !== null && currentScore === bestScore && (
                    <span className="ml-2 text-xs text-blue-500">(matches best)</span>
                  )}
                  {bestScore !== null && currentScore > bestScore && (
                    <span className="ml-2 text-xs text-amber-600">(exploring)</span>
                  )}
                  {bestScore !== null && currentScore < bestScore && (
                    <span className="ml-2 text-xs text-green-600">(improvement!)</span> 
                  )}
                </p>
                {(currentPainScore !== null || currentConcentrationPenaltyScore !== null) && (
                  <p className="text-xs text-blue-700">
                    Pain: {currentPainScore ?? '-'} | Concentration penalty: {currentConcentrationPenaltyScore?.toFixed(2) ?? '-'}
                  </p>
                )}
              </div>
            )}

            {/* Show best objective independently */}
            {bestScore !== null && (
              <div className="mb-2">
                <p className="text-sm">
                  <span className="font-medium">Best objective:</span> {bestScore.toFixed(2)}
                  {bestScore === 0 ? ' 🎉 (Perfect schedule!)' : ''}
                </p>
                {(bestPainScore !== null || bestConcentrationPenaltyScore !== null) && (
                  <p className="text-xs text-gray-700">
                    Pain: {bestPainScore ?? '-'} | Concentration penalty: {bestConcentrationPenaltyScore?.toFixed(2) ?? '-'}
                  </p>
                )}

                {/* Objective change summary */}
                {originalObjectiveScore !== null && originalObjectiveScore !== bestScore && originalObjectiveScore > 0 && (
                  <div className="mt-1">
                    <p className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
                      ✅ Objective improved by {(originalObjectiveScore - bestScore).toFixed(2)} points (
                      {Math.round(((originalObjectiveScore - bestScore) / originalObjectiveScore) * 100)}% better)
                    </p>
                  </div>
                )}

                {originalScore !== null && bestPainScore !== null && (
                  <div className="mt-1">
                    <p
                      className={`text-xs px-2 py-1 rounded ${
                        bestPainScore <= originalScore ? 'text-green-700 bg-green-50' : 'text-amber-700 bg-amber-50'
                      }`}
                    >
                      Pain points change: {bestPainScore - originalScore > 0 ? '+' : ''}
                      {bestPainScore - originalScore}
                    </p>
                  </div>
                )}

                {originalObjectiveScore !== null && originalObjectiveScore === bestScore && originalObjectiveScore > 0 && (
                  <div className="mt-1">
                    <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                      ⚠️ No objective improvement found - try more iterations or adjust rules
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {error && <div className="p-2 mt-3 bg-red-100 border border-red-300 text-red-500 rounded">{error}</div>}
      </div>

      {/* Live Visualization Toggle */}
      <div className="mb-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showLiveVisualization}
            onChange={e => setShowLiveVisualization(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-gray-700">Show live optimization visualization</span>
        </label>
        {showLiveVisualization && (
          <p className="text-xs text-gray-500 mt-1 ml-6">
            Watch objective score, pain points, and concentration metrics update live as optimization runs.
          </p>
        )}
      </div>

      {/* Live Schedule Visualization - Only show during optimization */}
      {showLiveVisualization && isOptimizing && renderedSchedule && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">Live Optimization Progress</h3>
            <div className="text-sm space-y-1">
              <div className="flex items-center gap-2 text-gray-600">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                Live update: Iteration {lastUpdateIteration}
              </div>
              {renderedSchedule && (
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  renderedSchedule.objectiveScore === 0 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  Objective: {renderedSchedule.objectiveScore.toFixed(2)} | Pain: {renderedSchedule.score} | Concentration penalty: {renderedSchedule.concentrationPenaltyScore.toFixed(2)} | Violations: {renderedSchedule.violations?.length || 0}
                </div>
              )}
            </div>
          </div>
          <ScheduleVisualization
            schedule={renderedSchedule}
            isLiveUpdating
            liveViolationBaseline={liveBaselineViolationCount}
            liveBestViolationCount={liveBestViolationCount}
            liveLatestViolationChange={liveLatestViolationChange}
            visualizationSettings={visualizationSettings}
            onVisualizationSettingsChange={onVisualizationSettingsChange}
          />
        </div>
      )}

      {/* Message when optimization is complete */}
      {!isOptimizing && showLiveVisualization && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-800">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="font-medium">Optimization Complete</span>
          </div>
          <p className="text-sm text-green-700 mt-1">
            Final optimized schedule is shown below in the results section.
          </p>
        </div>
      )}
    </div>
  );
}
