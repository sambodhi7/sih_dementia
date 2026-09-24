import { difficultyLabel, difficultyLevel } from '../services/adaptive/difficulty';
import type { ControllerState, PatientProfileMetrics } from '../services/adaptive/types';
import { readCompletedPractice } from '../storage/caregiverProgress';
import { readControllerState } from '../storage/controllerState';
import { readPatientProfileMetrics } from '../storage/patientMetrics';
import type { RoutineItem } from '../storage/routines';
import { theme } from '../theme';
import { activityDays, gameNames, samplePractice, scoredRounds, trackedGames } from '../components/caregiverCharts';
import type { TrackedGame } from '../components/caregiverCharts';

export type ReportOptions = { patientId: string; patientName: string; locale: string; routine: RoutineItem[] };

function html(value: string | number): string {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

function metricPercent(value: number | null): string { return value === null ? '—' : `${Math.round(value)}%`; }
function metricSeconds(value: number | null): string { return value === null ? '—' : `${value.toFixed(1)} sec`; }

function trendText(direction: PatientProfileMetrics['trend']['direction']): string {
  if (direction === 'improving') return 'Correct responses increased from the first to the latest scored round.';
  if (direction === 'changing') return 'Correct responses decreased from the first to the latest scored round.';
  if (direction === 'stable') return 'Correct responses are similar in the first and latest scored rounds.';
  return 'More completed sessions are needed to show a personal pattern.';
}

function bars(values: Array<{ label: string; value: number; valueLabel: string }>, maximum: number): string {
  return `<div class="chart">${values.map(({ label, value, valueLabel }) => `<div class="bar-group"><strong>${html(valueLabel)}</strong><div class="bar-track"><div class="bar" style="height:${Math.max(0, Math.min(100, value / Math.max(1, maximum) * 100))}%"></div></div><span>${html(label)}</span></div>`).join('')}</div>`;
}

function gameSection(gameId: TrackedGame, metrics: PatientProfileMetrics, controller: ControllerState | null, rounds: ReturnType<typeof scoredRounds>, sample: boolean): string {
  const level = controller ? difficultyLabel(controller.difficulty) : 'Starting level';
  return `<section class="card"><div class="eyebrow">${html(gameNames[gameId])}${sample ? ' · EXAMPLE GRAPH' : ''}</div>
    <h2>Independent responses</h2>
    ${rounds.length ? `<p>Last ${rounds.length} scored ${rounds.length === 1 ? 'round' : 'rounds'}, oldest to newest.</p>${bars(rounds.map((round, index) => ({ label: String(index + 1), value: round.independentPercent ?? 0, valueLabel: `${Math.round(round.independentPercent ?? 0)}%` })), 100)}<p class="small">Based on scored responses completed without hints or replay.</p>` : '<p>No scored rounds yet. A progress graph appears after a completed scored round.</p>'}
    <div class="metrics"><div><span>Independent</span><b>${html(metricPercent(metrics.independentPerformancePercent))}</b></div><div><span>Support needed</span><b>${html(metricPercent(metrics.supportNeededPercent))}</b></div><div><span>Typical time</span><b>${html(metricSeconds(metrics.medianResponseLatencySeconds))}</b></div><div><span>Sessions</span><b>${metrics.activity.completedSessions}</b></div></div>
    <p><b>Current level:</b> ${html(level)}${controller ? ` — ${html(difficultyLevel(controller.difficulty))} practice; hints after about ${Math.round(controller.hintTimeSeconds)} seconds.` : '. The first completed session will set the starting level.'}</p>
    <p>${html(trendText(metrics.trend.direction))}</p></section>`;
}

/** Creates a local-only, print-ready report from the same data shown in Practice Insights. */
export async function buildMemberReportHtml({ patientId, patientName, locale, routine }: ReportOptions): Promise<string> {
  const now = Date.now();
  // Keep export reads sequential: Expo Go's SQLite connection also serves the
  // visible insights cards, and the two activities are cheap to read in order.
  const completed = await readCompletedPractice(patientId);
  const snapshots: Array<{ gameId: TrackedGame; metrics: PatientProfileMetrics; controller: ControllerState | null }> = [];
  for (const gameId of trackedGames) {
    const metrics = await readPatientProfileMetrics(patientId, gameId, now);
    const controller = await readControllerState(patientId, gameId);
    snapshots.push({ gameId, metrics, controller });
  }
  const sample = completed.length === 0;
  const graphPractice = sample ? samplePractice(now) : completed;
  const days = activityDays(graphPractice, now, locale);
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(now);
  const sortedRoutine = [...routine].sort((a, b) => a.time.localeCompare(b.time));
  const currentMinutes = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  const next = sortedRoutine.find((item) => {
    const [hour, minute] = item.time.split(':').map(Number);
    return hour * 60 + minute >= currentMinutes;
  });
  const active = snapshots.filter((entry) => entry.controller && entry.controller.sessionsObserved > 0)
    .sort((a, b) => (b.controller?.updatedAt ?? 0) - (a.controller?.updatedAt ?? 0))[0];
  const adaptation = active?.controller;
  const updated = Math.max(0, ...snapshots.map((entry) => entry.controller?.updatedAt ?? 0));

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Saathi member practice report</title>
  <style>
    @page { size: A4; margin: 18mm; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 22px; color: ${theme.colors.ink}; background: ${theme.colors.canvas}; font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Noto Sans", "Noto Sans Devanagari", "Noto Sans Bengali", Arial, sans-serif; }
    .page { max-width: 760px; margin: auto; }
    .toolbar { margin-bottom: 16px; }
    button { border: 0; border-radius: 12px; background: ${theme.colors.leaf}; color: white; padding: 12px 20px; font: inherit; cursor: pointer; }
    .eyebrow { color: ${theme.colors.leaf}; font-size: 11px; font-weight: 800; letter-spacing: .7px; text-transform: uppercase; }
    h1 { font-size: 27px; line-height: 1.2; margin: 7px 0 8px; }
    h2 { font-size: 18px; margin: 4px 0 8px; }
    p { margin: 6px 0 10px; }
    .muted, .small { color: ${theme.colors.mutedInk}; }
    .small { font-size: 12px; }
    .header { border-bottom: 2px solid ${theme.colors.leaf}; padding-bottom: 15px; margin-bottom: 18px; }
    .card { border: 1px solid ${theme.colors.border}; border-radius: 12px; padding: 16px; margin: 0 0 15px; background: white; break-inside: avoid; page-break-inside: avoid; }
    .soft { background: ${theme.colors.leafSoft}; border-color: ${theme.colors.leaf}; }
    .notice { background: ${theme.colors.amberSoft}; border-left: 4px solid ${theme.colors.amber}; padding: 10px 13px; margin-bottom: 15px; }
    .routine { display: flex; gap: 12px; border-top: 1px solid ${theme.colors.border}; padding: 8px 0; }
    .routine time { color: ${theme.colors.leaf}; font-weight: 800; min-width: 50px; }
    .routine div { flex: 1; }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; border-top: 1px solid ${theme.colors.border}; padding-top: 12px; margin-top: 12px; }
    .metrics span, .metrics b { display: block; }
    .metrics span { color: ${theme.colors.mutedInk}; font-size: 11px; }
    .metrics b { font-size: 17px; }
    .chart { display: flex; gap: 8px; height: 126px; align-items: end; margin: 12px 0; }
    .bar-group { flex: 1; min-width: 0; text-align: center; font-size: 11px; }
    .bar-group strong, .bar-group span { display: block; }
    .bar-track { height: 85px; border-bottom: 1px solid ${theme.colors.border}; display: flex; align-items: end; }
    .bar { width: 100%; background: ${theme.colors.leaf}; border-radius: 4px 4px 0 0; min-height: 0; }
    footer { font-size: 11px; color: ${theme.colors.mutedInk}; padding-top: 10px; border-top: 1px solid ${theme.colors.border}; }
    @media print { body { padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .toolbar { display: none; } }
  </style></head><body><div class="page"><div class="toolbar"><button type="button" onclick="window.print()">Print / save as PDF</button></div>
  <header class="header"><div class="eyebrow">SAATHI · LOCAL CAREGIVER REPORT</div><h1>Member practice report</h1><p><b>Member:</b> ${html(patientName.trim() || 'Member not named')}<br><b>Prepared:</b> ${html(date)}</p><p class="muted">These patterns describe practice and support. They are not a diagnosis.</p></header>
  ${sample ? '<div class="notice"><b>Example graphs only.</b> No completed practice was found for this member. The charts below show illustrative values, not member results. Metric values remain empty until real activities are completed.</div>' : ''}
  <section class="card"><div class="eyebrow">TODAY’S CARE PLAN</div><h2>${html(next ? `Next: ${next.title}` : sortedRoutine.length ? 'All planned times have passed' : 'Plan today together')}</h2><p>These are scheduled reminders. Saathi does not record whether medicine was taken.</p>${sortedRoutine.length ? sortedRoutine.map((item) => `<div class="routine"><time>${html(item.time)}</time><div><b>${html(item.title)}</b><br><span class="small">${item.kind === 'medication' ? 'Medicine reminder' : 'Daily activity'} · ${html(item.detail || 'No additional instructions')}</span></div></div>`).join('') : '<p>No reminders have been added yet.</p>'}</section>
  <section class="card"><div class="eyebrow">${sample ? 'EXAMPLE · ' : ''}LAST 7 DAYS</div><h2>Completed activities</h2><p>${sample ? 'Example: ' : ''}${total} completed ${total === 1 ? 'activity' : 'activities'} this week.</p>${bars(days.map((day) => ({ label: day.label, value: day.count, valueLabel: String(day.count) })), Math.max(1, ...days.map((day) => day.count)))}<p class="small">${html(days.map((day) => `${day.label}: ${day.count}`).join(' · '))}</p><p class="small">Completed Day’s Plan and Who’s Who activities. Recipe is not scored here.</p></section>
  ${snapshots.map((entry) => gameSection(entry.gameId, entry.metrics, entry.controller, scoredRounds(graphPractice, entry.gameId), sample)).join('')}
  <section class="card soft"><div class="eyebrow">ADAPTIVE PRACTICE</div><h2>${adaptation && active ? `${html(gameNames[active.gameId])}: ${html(difficultyLabel(adaptation.difficulty))}` : 'Ready for a first activity'}</h2><p>${adaptation ? `Saathi currently offers ${html(difficultyLevel(adaptation.difficulty))} practice and brings in hints after about ${Math.round(adaptation.hintTimeSeconds)} seconds. It updates this setting from completed practice.` : 'After a completed activity, Saathi can adjust the level and hint timing for the next round.'}</p></section>
  <footer>${updated ? `<p>Practice settings updated ${html(new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(updated))}.</p>` : ''}<p>Recipe is a shared activity and is not scored in these insights. Use these signals to choose a calm next activity and discuss changes with a qualified caregiver or clinician when needed.</p><p>Generated on this device. Share this report only with people involved in the member’s care.</p></footer></div></body></html>`;
}
