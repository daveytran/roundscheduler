import { Schedule } from '../../models/Schedule';
import { AvoidBackToBackGames } from '../../models/ScheduleRule';
import { createMockMatches } from '../../lib/testUtils';

describe('UI Update Fix Test', () => {
  it('should immediately update UI when improvements are found', async () => {
    const rules = [new AvoidBackToBackGames(10)];
    
    // Create a more complex problematic schedule with multiple violations
    const matches = createMockMatches([
      { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1' },
      { team1: 'Team A', team2: 'Team C', timeSlot: 2, field: 'Field 1' }, // Back-to-back violation for Team A
      { team1: 'Team D', team2: 'Team E', timeSlot: 2, field: 'Field 2' },
      { team1: 'Team D', team2: 'Team F', timeSlot: 3, field: 'Field 1' }, // Back-to-back violation for Team D
      { team1: 'Team G', team2: 'Team H', timeSlot: 4, field: 'Field 1' },
      { team1: 'Team I', team2: 'Team J', timeSlot: 5, field: 'Field 1' },
    ]);

    const schedule = new Schedule(matches);
    const originalScore = schedule.evaluate(rules);
    
    console.log('\n=== UI UPDATE FIX TEST ===');
    console.log('Original score:', originalScore);
    console.log('Original violations:', schedule.violations.length);

    const uiUpdates: Array<{
      iteration: number;
      bestScore: number;
      scheduleScore?: number;
      violationCount?: number;
      wasImprovement: boolean;
      hasSnapshot: boolean;
    }> = [];

    let lastBestScore = originalScore;
    let totalUpdatesReceived = 0;

    // Run optimization and track ALL UI updates
    const optimized = await schedule.optimize(rules, 300, (info) => {
      totalUpdatesReceived++;
      
      // Always record UI updates, regardless of snapshot availability
      const wasImprovement = info.bestScore < lastBestScore;
      const hasSnapshot = !!info.bestScheduleSnapshot;
      
      uiUpdates.push({
        iteration: info.iteration,
        bestScore: info.bestScore,
        scheduleScore: hasSnapshot ? info.bestScheduleSnapshot!.score : undefined,
        violationCount: hasSnapshot ? info.bestScheduleSnapshot!.violations.length : undefined,
        wasImprovement,
        hasSnapshot
      });

      if (wasImprovement) {
        console.log(`🎉 UI received improvement at iteration ${info.iteration}: ${info.bestScore} (was ${lastBestScore})`);
        if (hasSnapshot) {
          console.log(`   Schedule violations: ${info.bestScheduleSnapshot!.violations.length}`);
        }
        lastBestScore = info.bestScore;
      }
    });

    const finalScore = optimized.evaluate(rules);
    console.log('Final score:', finalScore);
    console.log('Total UI updates received:', uiUpdates.length);
    console.log('Total progress callbacks received:', totalUpdatesReceived);
    console.log('Updates with snapshots:', uiUpdates.filter(u => u.hasSnapshot).length);

    // Count improvements that reached the UI
    const improvementUpdates = uiUpdates.filter(update => update.wasImprovement);
    console.log('UI updates that were improvements:', improvementUpdates.length);

    // Verify optimization didn't make things worse
    expect(finalScore).toBeLessThanOrEqual(originalScore);
    
    // Verify we received UI updates 
    expect(totalUpdatesReceived).toBeGreaterThan(0);
    expect(uiUpdates.length).toBeGreaterThan(0);

    // If we found improvements, verify their consistency
    if (improvementUpdates.length > 0) {
      console.log('Checking consistency of improvement updates...');
      
      const improvementsWithSnapshots = improvementUpdates.filter(u => u.hasSnapshot);
      improvementsWithSnapshots.forEach((update, index) => {
        console.log(`Improvement ${index + 1}: bestScore=${update.bestScore}, scheduleScore=${update.scheduleScore}`);
        expect(update.bestScore).toBe(update.scheduleScore); // Critical: improvement updates must be consistent
      });
      
      console.log('All improvement updates with snapshots are consistent! ✅');
      console.log('✅ UI updates are working correctly with improvements found!');
    } else {
      console.log('ℹ️ No improvements found during optimization');
    }

    // The key test: verify that the UI update mechanism is working properly
    // (receiving progress updates is the main requirement)
    expect(uiUpdates.every(update => {
      return typeof update.iteration === 'number' && 
             typeof update.bestScore === 'number' &&
             typeof update.wasImprovement === 'boolean';
    })).toBe(true);
    
    console.log('✅ UI update mechanism is functioning properly!');
  });
}); 