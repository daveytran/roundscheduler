# Testing Guide for Round Scheduler

This document outlines the comprehensive test suite for the violation detection and schedule optimization system.

## Test Setup

### Prerequisites

Make sure you have the testing dependencies installed:

```bash
yarn install
```

### Running Tests

```bash
# Run all tests
yarn test

# Run tests in watch mode (for development)
yarn test:watch

# Run tests with coverage report
yarn test:coverage

# Run tests in CI mode (no watch, with coverage)
yarn test:ci
```

## Test Structure

The test suite is organized into several categories:

### 1. Unit Tests (`src/__tests__/`)

#### Schedule Rules (`src/__tests__/models/ScheduleRule.test.ts`)

Tests all schedule rule implementations:

- **AvoidBackToBackGames**: Detects teams playing consecutive time slots
- **AvoidFirstAndLastGame**: Prevents teams from having both first and last games
- **AvoidReffingBeforePlaying**: Avoids teams refereeing immediately before playing
- **Player-based rules**: Rest time, venue time limits, gap detection
- **Field distribution**: Ensures fair distribution across venues
- **Priority system**: Tests rule priority weighting

#### Import Utilities (`src/__tests__/lib/importUtils.test.ts`)

Tests CSV parsing and schedule importing:

- CSV parsing with various formats and edge cases
- Player data import
- Schedule data import with multiple column arrangements
- Time slot assignment consistency
- Division normalization
- Error handling for malformed data

### 2. Component Tests (`components/__tests__/`)

#### ImportSchedule Component (`components/__tests__/ImportSchedule.test.tsx`)

Tests the violation detection UI component:

- **Hard constraint detection**: Field conflicts, team conflicts, referee conflicts
- **Per-match violation display**: Color coding, violation messages
- **User interface**: Legend, reset functionality, time formatting
- **Error handling**: Empty data, import errors, missing teams
- **Integration**: CSV import to violation display pipeline

### 3. Integration Tests (`src/__tests__/integration/`)

#### Violation Detection Integration (`src/__tests__/integration/violationDetection.integration.test.ts`)

End-to-end tests with real-world scenarios:

- **Real schedule data**: Tests using the actual problematic schedule provided
- **Complex multi-violation scenarios**: Multiple rule violations in one schedule
- **Performance testing**: Large schedule handling (100+ matches)
- **Error recovery**: Malformed data mixed with valid data
- **Unicode support**: International team names and special characters

### 4. Test Utilities (`src/__tests__/utils/testUtils.ts`)

Shared testing utilities:

- Mock data generators for teams, matches, and scenarios
- Common violation scenarios (field conflicts, team conflicts, etc.)
- Helper functions for violation analysis

## Test Coverage

### Violation Detection Coverage

The test suite covers all critical violation types:

#### Hard Constraints (Schedule-Breaking)

- ✅ **Field Conflicts**: Multiple matches on same field simultaneously
- ✅ **Team Playing Conflicts**: Teams in multiple matches at same time
- ✅ **Referee Conflicts**: Teams refereeing multiple matches simultaneously
- ✅ **Playing + Refereeing**: Teams playing and refereeing at same time

#### Soft Constraints (Optimization)

- ✅ **Back-to-back Games**: 2 consecutive time slots
- ✅ **Three+ Consecutive**: 3+ consecutive time slots (critical)
- ✅ **First + Last Games**: Teams with both first and last matches
- ✅ **Referee Before Playing**: Teams refereeing then immediately playing
- ✅ **Venue Time Limits**: Extended time at same venue
- ✅ **Player Rest Time**: Insufficient rest between games
- ✅ **Large Gaps**: Excessive time between player games
- ✅ **Field Distribution**: Unfair field allocation

### Real-World Scenario Testing

The integration tests include the exact problematic schedule you provided:

```
Time Slot 1: Field conflicts (Field 4, Field 1) + Team conflicts (Sun Valley Storm)
Time Slot 4: Field conflicts (Field 1)
Time Slot 7: Referee conflicts (Sun Valley Storm)
Time Slot 8: Field conflicts (Field 1)
Time Slot 9: Field conflicts (Field 3)
Time Slot 10: Field conflicts (Field 2)
```

### Performance Benchmarks

- ✅ **Import Performance**: < 1 second for 100+ match schedules
- ✅ **Violation Detection**: < 0.5 seconds for large schedules
- ✅ **Memory Efficiency**: Proper cleanup and no memory leaks

## Test Scenarios Covered

### Basic Violation Detection

```typescript
// Field conflict example
const matches = [
  { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1' },
  { team1: 'Team C', team2: 'Team D', timeSlot: 1, field: 'Field 1' }, // Conflict!
];
```

### Complex Multi-Violation

```typescript
// Multiple violations in one schedule
const complexSchedule = [
  // Field conflict + Team conflict
  { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1', referee: 'Team E' },
  { team1: 'Team C', team2: 'Team A', timeSlot: 1, field: 'Field 1', referee: 'Team F' },

  // Referee conflict + Playing while refereeing
  { team1: 'Team B', team2: 'Team C', timeSlot: 2, field: 'Field 1', referee: 'Team D' },
  { team1: 'Team E', team2: 'Team F', timeSlot: 2, field: 'Field 2', referee: 'Team D' },
  { team1: 'Team G', team2: 'Team H', timeSlot: 2, field: 'Field 3', referee: 'Team B' },
];
```

### Edge Cases

- Empty/malformed CSV data
- Unicode team names
- Large time slot numbers
- Mixed column formats
- Missing referee assignments

## Running Specific Test Suites

```bash
# Run only schedule rule tests
yarn test ScheduleRule.test.ts

# Run only component tests
yarn test ImportSchedule.test.tsx

# Run only integration tests
yarn test integration

# Run tests matching a pattern
yarn test --testNamePattern="field conflict"

# Run tests for a specific file
yarn test src/__tests__/models/ScheduleRule.test.ts
```

## Coverage Reports

The test suite maintains high coverage standards:

- **Branches**: ≥80%
- **Functions**: ≥80%
- **Lines**: ≥80%
- **Statements**: ≥80%

Coverage reports are generated in the `coverage/` directory:

```bash
yarn test:coverage
open coverage/lcov-report/index.html
```

## Continuous Integration

Tests are configured to run in CI environments with:

- No watch mode
- Coverage reporting
- Parallel execution
- Proper error codes for build failures

## Adding New Tests

### For New Violation Rules

1. Add rule test to `src/__tests__/models/ScheduleRule.test.ts`
2. Create test scenarios in `src/__tests__/utils/testUtils.ts`
3. Add integration test in `src/__tests__/integration/violationDetection.integration.test.ts`

### For New Components

1. Create component test file in `components/__tests__/`
2. Mock external dependencies appropriately
3. Test both violation detection logic and UI behavior

### For Real-World Scenarios

1. Add new scenario to integration tests
2. Include actual schedule data when possible
3. Test both positive and negative cases

## Debugging Tests

```bash
# Run with verbose output
yarn test --verbose

# Run specific test with debugging
yarn test --testNamePattern="should detect field conflicts" --verbose

# Debug with Node.js debugger
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Test Philosophy

The test suite follows these principles:

1. **Real-world driven**: Tests use actual problematic schedules
2. **Comprehensive coverage**: All violation types and edge cases
3. **Performance aware**: Benchmarks for large schedules
4. **User-focused**: Tests the complete user workflow
5. **Maintainable**: Well-organized with shared utilities
6. **Deterministic**: Consistent results across runs

This comprehensive test suite ensures that the violation detection system reliably catches scheduling conflicts and provides accurate feedback to users.
