'use client';

import { SkillRadar } from '@talentshowcase/types';

interface RadarChartProps {
  data: SkillRadar;
  compare?: SkillRadar | null;
  size?: number;
}

const COLOR_MAIN = '#6366f1';
const COLOR_COMPARE = '#f59e0b';

/** Lightweight dependency-free SVG radar chart for skill data. */
export function RadarChart({ data, compare, size = 420 }: RadarChartProps) {
  const axes = data.axes;
  const n = axes.length;
  if (n === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.36;
  const labelRadius = radius + 34;

  const point = (index: number, value: number, scale = radius) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    const r = (Math.max(0, Math.min(100, value)) / 100) * scale;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  };

  const polygon = (values: number[]) =>
    values.map((v, i) => point(i, v).join(',')).join(' ');

  const gridLevels = [25, 50, 75, 100];
  const pad = 90; // room so category labels are never clipped

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-pad} ${-pad / 2} ${size + pad * 2} ${size + pad}`}
      role="img"
      aria-label="Skill radar"
    >
      {/* grid rings */}
      {gridLevels.map((level) => (
        <polygon
          key={level}
          points={polygon(axes.map(() => level))}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={1}
        />
      ))}

      {/* spokes */}
      {axes.map((_, i) => {
        const [x, y] = point(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e7eb" strokeWidth={1} />;
      })}

      {/* compare polygon (behind) */}
      {compare && (
        <polygon
          points={polygon(compare.axes.map((a) => a.score))}
          fill={`${COLOR_COMPARE}22`}
          stroke={COLOR_COMPARE}
          strokeWidth={2}
          strokeDasharray="6 3"
        />
      )}

      {/* main polygon */}
      <polygon
        points={polygon(axes.map((a) => a.score))}
        fill={`${COLOR_MAIN}33`}
        stroke={COLOR_MAIN}
        strokeWidth={2.5}
      />

      {/* value dots */}
      {axes.map((a, i) => {
        const [x, y] = point(i, a.score);
        return <circle key={i} cx={x} cy={y} r={4} fill={COLOR_MAIN} />;
      })}

      {/* labels */}
      {axes.map((a, i) => {
        const [x, y] = point(i, 100, labelRadius);
        const anchor = Math.abs(x - cx) < 12 ? 'middle' : x > cx ? 'start' : 'end';
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize={11}
            fill="#374151"
          >
            {a.category.toLowerCase()} ({a.score})
          </text>
        );
      })}

      {compare && (
        <g>
          <rect x={12} y={12} width={12} height={3} fill={COLOR_MAIN} rx={1} />
          <text x={30} y={16} fontSize={11} fill="#374151">
            {data.userName ?? 'You'}
          </text>
          <rect x={12} y={30} width={12} height={3} fill={COLOR_COMPARE} rx={1} />
          <text x={30} y={34} fontSize={11} fill="#374151">
            {compare.userName ?? 'Compare'}
          </text>
        </g>
      )}
    </svg>
  );
}
