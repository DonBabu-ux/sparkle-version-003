// Dependency-free sparkline/bar charts for the admin analytics panel.
// Pure SVG so the app ships no chart library for a few small series.

interface Point { day: string; count: number }

const fmtDay = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/** Bars — good for discrete daily counts. */
export function BarSeries({ data, color = '#ff1493', height = 120 }: { data: Point[]; color?: string; height?: number }) {
    if (!data.length) return <EmptyChart />;
    const max = Math.max(1, ...data.map(d => d.count));
    const w = 300;
    const gap = 3;
    const bw = (w - gap * (data.length - 1)) / data.length;
    return (
        <svg viewBox={`0 0 ${w} ${height + 18}`} className="w-full h-auto" role="img" aria-label="Daily bar chart">
            <line x1="0" y1={height} x2={w} y2={height} className="stroke-[#ede3e9] dark:stroke-zinc-700" strokeWidth="1" />
            {data.map((d, i) => {
                const h = Math.max(2, (d.count / max) * height);
                return (
                    <g key={d.day}>
                        <rect
                            x={i * (bw + gap)}
                            y={height - h}
                            width={bw}
                            height={h}
                            rx="2"
                            fill={color}
                            opacity={d.count === 0 ? 0.12 : 0.85}
                        />
                        {i % 3 === 0 && (
                            <text x={i * (bw + gap)} y={height + 13} fontSize="8" className="fill-slate-600 dark:fill-zinc-400">
                                {fmtDay(d.day)}
                            </text>
                        )}
                    </g>
                );
            })}
        </svg>
    );
}

/** Line — good for trends (engagement, cumulative). */
export function LineSeries({ data, color = '#ff1493', height = 120 }: { data: Point[]; color?: string; height?: number }) {
    if (!data.length) return <EmptyChart />;
    const max = Math.max(1, ...data.map(d => d.count));
    const w = 300;
    const step = w / Math.max(1, data.length - 1);
    const pts = data.map((d, i) => [i * step, height - (d.count / max) * (height - 6) - 3] as const);
    const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const area = `${path} L${w},${height} L0,${height} Z`;
    return (
        <svg viewBox={`0 0 ${w} ${height + 18}`} className="w-full h-auto" role="img" aria-label="Daily trend chart">
            <defs>
                <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <line x1="0" y1={height} x2={w} y2={height} className="stroke-[#ede3e9] dark:stroke-zinc-700" strokeWidth="1" />
            <path d={area} fill={`url(#grad-${color.replace('#', '')})`} />
            <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {pts.map((p, i) => (
                <circle key={data[i].day} cx={p[0]} cy={p[1]} r={data[i].count > 0 ? 2.5 : 1.5} fill={color} opacity={data[i].count > 0 ? 1 : 0.3} />
            ))}
            {data.map((d, i) => (
                i % 3 === 0 && (
                    <text key={d.day} x={i * step} y={height + 13} fontSize="8" className="fill-slate-600 dark:fill-zinc-400">
                        {fmtDay(d.day)}
                    </text>
                )
            ))}
        </svg>
    );
}

function EmptyChart() {
    return (
        <div className="h-[120px] flex items-center justify-center text-xs text-slate-600 dark:text-zinc-300">
            No data in this range
        </div>
    );
}
