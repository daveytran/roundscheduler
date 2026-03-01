export const DEFAULT_CUSTOM_RULE_TEMPLATE = `// Custom rule body
// Available globals:
// - schedule: the full schedule
// - violations: push violations here
// - ScheduleHelpers: helper utilities
//
// Tip: start by typing "schedule." or "ScheduleHelpers." for autocomplete.

// Example 1: Flag back-to-back games for teams.
const teamMatches = ScheduleHelpers.groupMatchesByTeam(schedule.matches);

Object.entries(teamMatches).forEach(([teamName, matches]) => {
  const sortedMatches = [...matches].sort((a, b) => a.timeSlot - b.timeSlot);

  for (let i = 0; i < sortedMatches.length - 1; i++) {
    if (ScheduleHelpers.areConsecutive(sortedMatches[i], sortedMatches[i + 1])) {
      violations.push({
        rule: "Avoid back-to-back games",
        description: \`Team \${teamName} has consecutive games in slots \${sortedMatches[i].timeSlot} and \${sortedMatches[i + 1].timeSlot}\`,
        matches: [sortedMatches[i], sortedMatches[i + 1]],
        level: "warning"
      });
    }
  }
});

// Example 2: Flag divisions with unusually high volume.
const stats = ScheduleHelpers.getScheduleStats(schedule);
const divisionCount = Object.keys(stats.matchesPerDivision).length || 1;

Object.entries(stats.matchesPerDivision).forEach(([division, count]) => {
  const averagePerDivision = stats.totalMatches / divisionCount;
  if (count > averagePerDivision * 1.3) {
    violations.push({
      rule: "Division imbalance",
      description: \`Division \${division} has \${count} games (avg \${averagePerDivision.toFixed(1)})\`,
      level: "note"
    });
  }
});
`;
