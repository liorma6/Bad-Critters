// Keep authored seconds independent of low refresh rates. Visibility changes reset
// the clock in main.js, so a hidden tab never catches up an unattended incident.
export function frameSteps(elapsed){const total=Math.min(1,Math.max(0,Number.isFinite(elapsed)?elapsed:0));const count=Math.ceil(total/.05);return count?Array(count).fill(total/count):[];}
