import { ACHIEVEMENTS } from './texts';
import type { ItemDef } from './items';
import { rand } from './util';

export interface ReviewData {
  fired: boolean;
  reason: string;
  t: number;
  shiftLen: number;
  overtimes: number;
  writeUps: number;
  /** General counters of the shift engine (thrown, stolen, toilet, puddles, inspected, overheats). */
  counters: Record<string, number>;
  /** Payslip price of everything broken. */
  damage: number;
  secretsShift: number;
  secretsAll: number;
  secretsTotal: number;
  peakViewers: number;
  pocket: ItemDef[];
  achievements: string[];
  /** Rows and payslip lines of the job. */
  jobRows: [string, string | number][];
  jobPay: [string, number][];
  productive: boolean;
  employeeOfTheMonth: string;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const euro = (n: number) => `${n < 0 ? '-' : ''}€${Math.abs(n).toFixed(2)}`;

export function reviewHtml(d: ReviewData): string {
  const c = (k: string) => d.counters[k] ?? 0;
  const smile = Math.round(rand(12, 61));
  const blinks = Math.round(d.t * rand(0.25, 0.35));
  const stolen = d.pocket.filter((p) => p.shape !== 'nothing');
  const frac = Math.min(1, d.t / d.shiftLen);
  const hours = 8 * frac;

  const stats: [string, string | number][] = [
    ...d.jobRows,
    ['Items inspected per Regulation 4.2.1', c('inspected')],
    ['Items thrown', c('thrown')],
    ['Items in your pockets', stolen.length],
    ['Things kicked', c('kicked')],
    ['Things broken', c('broken')],
    ['Secrets found this shift', d.secretsShift],
    ['Secrets found ever', `${d.secretsAll}/${d.secretsTotal}`],
    ...(c('beers') ? [["Beers from Brad's crate", c('beers')] as [string, number]] : []),
    ['Approved toilet breaks', c('toilet')],
    ['Unapproved liquid events', c('puddles')],
    ['Boss overheats', c('overheats')],
    ['Write-ups', d.writeUps],
    ['Peak viewers', Math.round(d.peakViewers).toLocaleString('en-US')],
    ['Smile uptime', `${smile}%`],
    ['Unauthorized blinks', blinks],
  ];

  const pay: [string, number][] = [[`Wage: ${hours.toFixed(1)} h x €4.20`, hours * 4.2]];
  if (d.overtimes) pay.push([`Overtime (voluntary, unpaid) x${d.overtimes}`, 0]);
  pay.push(['Uniform rental', -7.5], ['Air usage fee', -3.2], [`Smile tax (uptime ${smile}%)`, -(100 - smile) * 0.05]);
  pay.push(...d.jobPay);
  if (c('puddles')) pay.push([`Floor cleaning x${c('puddles')}`, -12 * c('puddles')]);
  if (d.writeUps) pay.push([`Write-up processing fee x${d.writeUps}`, -5 * d.writeUps]);
  if (c('thrown')) pay.push([`Gravity usage x${c('thrown')}`, -0.5 * c('thrown')]);
  if (c('inspected')) pay.push([`Thoroughness surcharge x${c('inspected')}`, -1 * c('inspected')]);
  if (c('overheats')) pay.push(['Contribution to boss repair', -25 * c('overheats')]);
  if (c('broken')) pay.push([`Property damage x${c('broken')}`, -d.damage]);
  if (c('beers')) pay.push([`Brad's beer x${c('beers')} (team spirit price)`, -4.5 * c('beers')]);
  if (d.fired && stolen.length) pay.push(['Recovered stolen goods (handling fee)', -4 * stolen.length]);
  pay.push(['Viewer engagement bonus', Math.round(d.peakViewers / 1000) / 100]);
  const net = pay.reduce((a, [, v]) => a + v, 0);

  const productive = d.productive;
  const entertaining = d.peakViewers >= 12000;
  let verdict: string;
  if (d.fired) verdict = 'Thank you for your service. Please return your smile at the service desk.';
  else if (productive && entertaining) verdict = 'Productive AND entertaining. You are a threat. We will watch you more closely now.';
  else if (productive) verdict = 'Efficient but unwatchable. Corporate says viewers preferred the furniture.';
  else if (entertaining) verdict = 'Brad hates you. The viewers love you. Corporate is confused, which counts as a promotion.';
  else verdict = 'Neither productive nor entertaining. You may have a future in middle management.';

  const eotm = d.employeeOfTheMonth;

  const ach = d.achievements.filter((a) => ACHIEVEMENTS[a]).map((a) => `<span title="${esc(ACHIEVEMENTS[a].text)}">${esc(ACHIEVEMENTS[a].title)}</span>`).join('');

  return `
  <div class="card review${d.fired ? ' fired' : ''}">
    <h2>${d.fired ? 'YOU ARE FIRED' : 'SHIFT COMPLETE'}</h2>
    <p class="reason">${esc(d.reason)}</p>
    <div class="cols">
      <div class="side">
        <div class="pane">
          <h3 class="wt">PERFORMANCE REVIEW</h3>
          <table>${stats.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(String(v))}</td></tr>`).join('')}</table>
        </div>
        ${ach ? `<h3 class="wt">ACHIEVEMENTS</h3><div class="ach">${ach}</div>` : ''}
      </div>
      <div class="side">
        <div class="pane">
          <h3 class="wt">PAYSLIP</h3>
          <table>
            ${pay.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="${v < 0 ? 'neg' : ''}">${euro(v)}</td></tr>`).join('')}
            <tr class="total"><td>Net pay</td><td class="${net < 0 ? 'neg' : ''}">${euro(net)}</td></tr>
          </table>
          ${net < 0 ? '<p>You owe us money. It will be deducted from your next shift.</p>' : ''}
        </div>
        <p class="verdict">${esc(verdict)}</p>
        <p class="eotm"><b>EMPLOYEE OF THE MONTH</b><br>${esc(eotm)}</p>
        <button id="againBtn">CLOCK IN AGAIN</button>
      </div>
    </div>
  </div>`;
}
