// Gera assets/stats.svg com dados reais da API do GitHub. Roda no Action diariamente.
import { writeFileSync } from 'node:fs';

const login = process.env.GH_LOGIN ?? 'Kauaritter13';
const query = `query($login:String!){user(login:$login){
  contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount}}}}
  repositories(first:100,ownerAffiliations:OWNER,isFork:false,privacy:PUBLIC){nodes{languages(first:8,orderBy:{field:SIZE,direction:DESC}){edges{size node{name color}}}}}
}}`;

const res = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, 'User-Agent': 'profile-stats' },
  body: JSON.stringify({ query, variables: { login } }),
});
const { data, errors } = await res.json();
if (errors) throw new Error(JSON.stringify(errors));

const cal = data.user.contributionsCollection.contributionCalendar;
const days = cal.weeks.flatMap((w) => w.contributionDays);
const active = days.filter((d) => d.contributionCount > 0).length;

const months = new Map();
for (const d of days) {
  const key = d.date.slice(0, 7);
  months.set(key, (months.get(key) ?? 0) + d.contributionCount);
}
const monthRows = [...months].slice(-12);
const peak = Math.max(1, ...monthRows.map(([, v]) => v));

const langs = new Map();
for (const repo of data.user.repositories.nodes) {
  for (const edge of repo.languages.edges) {
    const cur = langs.get(edge.node.name) ?? { size: 0, color: edge.node.color ?? '#8b949e' };
    cur.size += edge.size;
    langs.set(edge.node.name, cur);
  }
}
const total = [...langs.values()].reduce((sum, l) => sum + l.size, 0) || 1;
const top = [...langs].sort((a, b) => b[1].size - a[1].size).slice(0, 5);

const label = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const bars = monthRows
  .map(([month, value], i) => {
    const h = Math.max(3, Math.round((value / peak) * 118));
    const x = 40 + i * 38;
    const count = value ? `<text x="${x + 12}" y="${224 - h}" text-anchor="middle" class="s">${value}</text>` : '';
    return `<rect class="b" style="animation-delay:${i * 60}ms" x="${x}" y="${232 - h}" width="24" height="${h}" rx="5" fill="url(#g)"/>
<text x="${x + 12}" y="252" text-anchor="middle" class="s">${label[Number(month.slice(5)) - 1]}</text>${count}`;
  })
  .join('\n');

const langBars = top
  .map(([name, lang], i) => {
    const pct = (lang.size / total) * 100;
    const y = 112 + i * 30;
    return `<text x="560" y="${y}" class="t">${name}</text>
<text x="810" y="${y}" text-anchor="end" class="s">${pct.toFixed(1)}%</text>
<rect x="560" y="${y + 7}" width="250" height="6" rx="3" fill="#30363d"/>
<rect class="l" style="animation-delay:${i * 90}ms" x="560" y="${y + 7}" width="${Math.max(4, (pct / 100) * 250)}" height="6" rx="3" fill="${lang.color}"/>`;
  })
  .join('\n');

const stat = (x, value, text) =>
  `<text x="${x}" y="62" class="n">${value}</text><text x="${x}" y="82" class="s">${text}</text>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 272" width="850" height="272" role="img" aria-label="Atividade de ${login} no GitHub">
<style>
text{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif}
.n{font-size:26px;font-weight:700;fill:#f0f6fc}.s{font-size:11px;fill:#8b949e}.t{font-size:13px;fill:#c9d1d9}
.b{transform-box:fill-box;transform-origin:bottom;animation:g .7s ease-out both}
.l{transform-box:fill-box;transform-origin:left;animation:w .9s ease-out both}
@keyframes g{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes w{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@media (prefers-reduced-motion:reduce){.b,.l{animation:none}}
</style>
<defs><linearGradient id="g" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff6a2b"/><stop offset="1" stop-color="#ffa070"/></linearGradient></defs>
<rect x=".5" y=".5" width="849" height="271" rx="14" fill="#0d1117" stroke="#30363d"/>
${stat(40, cal.totalContributions, 'contribuições em 12 meses')}
${stat(240, active, 'dias ativos')}
<text x="560" y="62" class="t" style="font-weight:600">Linguagens</text>
<text x="560" y="82" class="s">repositórios públicos</text>
${bars}
${langBars}
</svg>
`;

writeFileSync('assets/stats.svg', svg);
console.log(`stats.svg: ${cal.totalContributions} contribuições, ${active} dias ativos, ${top.length} linguagens`);
