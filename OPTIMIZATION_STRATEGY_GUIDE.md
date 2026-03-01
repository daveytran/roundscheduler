# Round Scheduler Optimization Strategy Guide

## Current User-Facing Strategy

### Simulated Annealing (Default and only visible strategy)
- **Status**: Active
- **Use case**: All production scheduling workloads
- **Behavior**: Iteratively applies schedule mutations and accepts better (or occasionally worse) candidates to avoid local minima

This is the only strategy exposed in the UI right now.

## Why only one strategy is visible

Additional strategy helper code exists in the codebase for experimentation, but it is not currently part of the user-facing strategy registry. Keeping a single visible strategy avoids configuration drift and prevents users from selecting unsupported/legacy strategy IDs.

## Practical Tuning

### Iterations
- **Fast pass**: `1,000` to `5,000`
- **Balanced**: `10,000` to `25,000`
- **Deep search**: `50,000+`

Higher iterations generally improve quality but increase runtime.

### Continue Optimization
If you run optimization multiple times without resetting, the optimizer continues from the previous best schedule, which is useful for long-running refinement.

### Reset Behavior
Resetting returns to the original imported schedule and clears continuation state.

## Integration Example

```typescript
import { OPTIMIZATION_STRATEGIES } from './models/OptimizationStrategy'

const annealing = OPTIMIZATION_STRATEGIES.find(s => s.id === 'simulated-annealing')
const optimizedSchedule = await schedule.optimize(rules, 20000, progressCallback, annealing)
```

## Debugging

Verbose optimization logs are disabled by default.

To enable optimizer debug logging in development:

```bash
export NEXT_PUBLIC_DEBUG_OPTIMIZER=true
```

## Notes

- The optimizer rejects candidates with critical rule violations.
- Time-slot and field integrity constraints are preserved during optimization mutations.
- Strategy IDs loaded from storage are normalized to available strategies to avoid stale references.
