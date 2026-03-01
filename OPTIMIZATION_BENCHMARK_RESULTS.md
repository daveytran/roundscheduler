# Round Scheduler Optimization Benchmark Results

## Scope

This benchmark document reflects the **currently supported user-facing optimizer configuration**:

- Visible strategy in UI: **Simulated Annealing**

Historical multi-strategy comparisons are not considered current product behavior.

## Test Scenario

- 49 matches across 3 fields
- Multi-division tournament setup
- Rule set includes high-priority conflict and rest constraints

## Current Result Snapshot

Simulated annealing consistently improves schedules from high initial violation scores to substantially lower scores within a few hundred to a few thousand iterations, depending on schedule complexity.

## Operational Guidance

- Use simulated annealing for all optimization runs.
- Increase iterations for quality, decrease for speed.
- Use continuation runs to refine an already optimized schedule.

## Implementation Notes

- Candidate schedules with critical violations are rejected.
- Field/time-slot integrity protections remain active during optimization.
- Verbose optimizer logging is now behind `NEXT_PUBLIC_DEBUG_OPTIMIZER=true` in development.

## Next Benchmarking Step (when additional strategies are reintroduced)

When new user-facing strategies are added back to the strategy registry, rerun comparative benchmarks and update this document with measured (not projected) results.
