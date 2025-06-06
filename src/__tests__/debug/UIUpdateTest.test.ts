import { Schedule } from '../../models/Schedule';
import { AvoidBackToBackGames } from '../../models/ScheduleRule';
import { createMockMatches } from '../../lib/testUtils';

describe('UI Update Fix Test', () => {
  it('should immediately update UI when improvements are found', async () => {
    const rules = [new AvoidBackToBackGames(10)];
    
    // Create problematic schedule
    const matches = createMockMatches([
      { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1' },
      { team1: 'Team A', team2: 'Team C', timeSlot: 2, field: 'Field 1' }, // Back-to-back violation
      { team1: 'Team D', team2: 'Team E', timeSlot: 3, field: 'Field 1' },
      { team1: 'Team F', team2: 'Team G', timeSlot: 4, field: 'Field 1' },
    ]);

    const schedule = new Schedule(matches, rules);
    const originalScore = schedule.evaluate();
    
    console.log('\n=== UI UPDATE FIX TEST ===');
    console.log('Original score:', originalScore);
    console.log('Original violations:', schedule.violations.length);

    const uiUpdates: Array<{
      iteration: number;
      bestScore: number;
      scheduleScore: number;
      violationCount: number;
      wasImprovement: boolean;
    }> = [];

    let lastBestScore = originalScore;

    // Run optimization and track ALL UI updates
    const optimized = await schedule.optimize(200, (info) => {
      if (info.bestScheduleSnapshot) {
        const wasImprovement = info.bestScore < lastBestScore;
        
        uiUpdates.push({
          iteration: info.iteration,
          bestScore: info.bestScore,
          scheduleScore: info.bestScheduleSnapshot.score,
          violationCount: info.bestScheduleSnapshot.violations.length,
          wasImprovement
        });

        if (wasImprovement) {
          console.log(`🎉 UI received improvement at iteration ${info.iteration}: ${info.bestScore} (was ${lastBestScore})`);
          console.log(`   Schedule violations: ${info.bestScheduleSnapshot.violations.length}`);
          lastBestScore = info.bestScore;
        }
      }
    });

    const finalScore = optimized.evaluate();
    console.log('Final score:', finalScore);
    console.log('Total UI updates received:', uiUpdates.length);

    // Count improvements that reached the UI
    const improvementUpdates = uiUpdates.filter(update => update.wasImprovement);
    console.log('UI updates that were improvements:', improvementUpdates.length);

    // Verify we got improvements
    expect(finalScore).toBeLessThanOrEqual(originalScore);
    expect(improvementUpdates.length).toBeGreaterThan(0);

    // Verify that improvement updates have consistent data (most important)
    const improvementUiUpdates = uiUpdates.filter(update => update.wasImprovement);
    console.log('Checking consistency of improvement updates...');
    
    improvementUiUpdates.forEach((update, index) => {
      console.log(`Improvement ${index + 1}: bestScore=${update.bestScore}, scheduleScore=${update.scheduleScore}`);
      expect(update.bestScore).toBe(update.scheduleScore); // Critical: improvement updates must be consistent
    });
    
    console.log('All improvement updates are consistent! ✅');

    console.log('✅ UI updates are working correctly!');
  });
}); 