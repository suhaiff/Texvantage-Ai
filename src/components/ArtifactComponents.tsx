import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  FileSpreadsheet,
  FileText,
  Check,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { KPIArtifactData, ChartArtifactData, TableArtifactData, FileArtifactData } from '../types';
import { apiClient } from '../services/apiClient';

export const KPICard: React.FC<{ data: KPIArtifactData; title?: string }> = ({ data, title }) => {
  const changeType = (data as any).changeType || (data as any).change_type || 'neutral';
  const isPositive = changeType === 'positive';
  const isNegative = changeType === 'negative';

  return (
    <div className="bg-tv-surface border border-tv-border rounded-[14px] p-4 shadow-sm hover:border-tv-accent/40 hover:shadow-lg transition-all duration-300 group">
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-tv-text-muted mb-1">
        <span className="group-hover:text-tv-text-primary transition-colors">{title || data.metric}</span>
        <span className="bg-tv-base px-2 py-0.5 rounded text-[11px] font-medium text-tv-text-secondary border border-tv-border/50">
          {data.period}
        </span>
      </div>
      <div className="text-2xl font-bold text-tv-text-primary mt-1 tabular-nums tracking-tight">
        {data.value}
      </div>
      <div className="flex items-center gap-1.5 mt-2.5 text-xs">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium text-[11px] transition-transform duration-200 group-hover:scale-105 ${
            isPositive
              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
              : isNegative
              ? 'bg-rose-950/60 text-rose-400 border border-rose-800/50'
              : 'bg-tv-base text-tv-text-secondary border border-tv-border'
          }`}
        >
          {isPositive && <TrendingUp className="w-3.5 h-3.5 mr-1 inline" />}
          {isNegative && <TrendingDown className="w-3.5 h-3.5 mr-1 inline" />}
          {!isPositive && !isNegative && <Minus className="w-3.5 h-3.5 mr-1 inline" />}
          {data.change}
        </span>
        {data.subtext && <span className="text-tv-text-muted truncate text-[11px]">{data.subtext}</span>}
      </div>
    </div>
  );
};

export const InteractiveChart: React.FC<{ data: ChartArtifactData; title?: string }> = ({ data, title }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(timer);
  }, []);

  const chartType = data.chartType || (data as any).chart_type || 'bar';
  const xKey = data.xKey || (data as any).x_key || 'month';
  const points = data.dataPoints || (data as any).data_points || [];
  const series = (data.series || []).map(s => ({
    ...s,
    type: s.type || chartType
  }));
  if (!points || points.length === 0) return null;

  // Compute numeric max for scaling
  const numericKeys = series.map(s => s.key);
  let maxVal = 0;
  points.forEach(pt => {
    numericKeys.forEach(k => {
      const val = Number(pt[k]) || 0;
      if (val > maxVal) maxVal = val;
    });
  });
  if (maxVal === 0) maxVal = 100;

  const width = 640;
  const height = 230;
  const padding = { top: 25, right: 25, bottom: 42, left: 55 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Donut chart mode
  if (chartType === 'donut') {
    const valueKey = data.series?.[0]?.key || 'total_revenue_lakh';
    const total = points.reduce(
      (acc, pt) => acc + (Number(pt[valueKey] || pt.total_revenue_lakh || pt.revenueSharePct || 1) || 0),
      0
    );
    const colors = ['#D6FF4B', '#38BDF8', '#34D399', '#FBBF24', '#C084FC', '#FB7185'];
    let accumulated = 0;

    return (
      <div className="w-full">
        {title && (
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-tv-border/60">
            <h4 className="text-sm font-semibold text-tv-text-primary flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-tv-accent" />
              {title}
            </h4>
            <span className="text-[11px] text-tv-text-muted font-mono">Market Distribution</span>
          </div>
        )}
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="relative w-48 h-48 shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
              {points.map((pt, i) => {
                const val = Number(pt[valueKey] || pt.total_revenue_lakh || pt.revenueSharePct || 1) || 0;
                const pct = total > 0 ? val / total : 0;
                const strokeDasharray = mounted ? `${pct * 283} 283` : '0 283';
                const strokeDashoffset = -accumulated * 283;
                accumulated += pct;
                const col = colors[i % colors.length];
                const isHovered = hoveredIdx === i;

                return (
                  <circle
                    key={i}
                    cx="50"
                    cy="50"
                    r="45"
                    fill="transparent"
                    stroke={col}
                    strokeWidth={isHovered ? '13' : '10'}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-500 ease-out cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[11px] text-tv-text-muted">
                {hoveredIdx !== null ? (points[hoveredIdx][xKey] || 'Enterprise') : 'Total Share'}
              </span>
              <span className="text-base font-bold text-tv-text-primary">
                {hoveredIdx !== null
                  ? `${(((Number(points[hoveredIdx][valueKey]) || 1) / (total || 1)) * 100).toFixed(1)}%`
                  : '100%'}
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-1.5 w-full">
            {points.map((pt, i) => {
              const val = Number(pt[valueKey] || pt.total_revenue_lakh || pt.revenueSharePct || 1) || 0;
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
              const col = colors[i % colors.length];
              const isHovered = hoveredIdx === i;

              return (
                <div
                  key={i}
                  className={`flex items-center justify-between p-2 rounded-lg text-xs transition-all duration-200 cursor-pointer ${
                    isHovered
                      ? 'bg-tv-base border border-tv-border shadow-sm font-semibold translate-x-1'
                      : 'hover:bg-tv-base/50'
                  }`}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: col }} />
                    <span className="truncate text-tv-text-secondary">{pt[xKey] || pt.category_name}</span>
                  </div>
                  <span className="text-tv-text-primary font-mono shrink-0">
                    {valueKey.includes('revenue') || pt.total_revenue_lakh ? `₹${val.toLocaleString('en-IN')}L (${pct}%)` : `${pct}%`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Bar / Area / Line chart
  const barWidth = Math.max(14, Math.min(36, chartW / points.length - 8));

  return (
    <div className="w-full overflow-hidden">
      {/* Chart Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2 pb-2 border-b border-tv-border/60">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-tv-accent animate-pulse" />
          {title && <h4 className="text-sm font-semibold text-tv-text-primary">{title}</h4>}
        </div>
        <div className="flex items-center gap-3 text-xs">
          {data.series.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm shadow-xs" style={{ backgroundColor: s.color || '#D6FF4B' }} />
              <span className="text-tv-text-secondary font-medium">{s.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full overflow-x-auto custom-scrollbar">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-52 select-none">
          {/* Gradient & Filter Definitions */}
          <defs>
            <linearGradient id="grad-accent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D6FF4B" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#84CC16" stopOpacity="0.75" />
            </linearGradient>
            <linearGradient id="grad-blue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.75" />
            </linearGradient>
            <linearGradient id="grad-emerald" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34D399" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.75" />
            </linearGradient>
            <linearGradient id="grad-amber" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#D97706" stopOpacity="0.75" />
            </linearGradient>
            <filter id="glow-bar" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#D6FF4B" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const y = padding.top + chartH * (1 - pct);
            const labelVal = Math.round(maxVal * pct);
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#272B30"
                  strokeWidth="1"
                  strokeDasharray={i > 0 && i < 4 ? '3 3' : undefined}
                />
                <text
                  x={padding.left - 10}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[10px] fill-tv-text-muted font-mono"
                >
                  {labelVal > 1000 ? `${(labelVal / 1000).toFixed(1)}k` : labelVal}
                </text>
              </g>
            );
          })}

          {/* Render Bars with Staggered Rise Transition */}
          {data.series
            .filter(s => s.type === 'bar' || !s.type)
            .map((s, sIdx) => {
              const gradId =
                sIdx === 0
                  ? 'url(#grad-accent)'
                  : sIdx === 1
                  ? 'url(#grad-blue)'
                  : sIdx === 2
                  ? 'url(#grad-emerald)'
                  : 'url(#grad-amber)';

              return points.map((pt, pIdx) => {
                const val = Number(pt[s.key]) || 0;
                const barHeight = (val / maxVal) * chartH;
                const groupX = padding.left + (pIdx + 0.5) * (chartW / points.length);
                const x = groupX - barWidth / 2;
                const y = padding.top + chartH - barHeight;
                const isHovered = hoveredIdx === pIdx;

                // Animate height & y from zero on mount
                const animatedHeight = mounted ? Math.max(3, barHeight) : 0;
                const animatedY = mounted ? y : padding.top + chartH;

                return (
                  <g
                    key={`${sIdx}-${pIdx}`}
                    onMouseEnter={() => setHoveredIdx(pIdx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={x}
                      y={animatedY}
                      width={barWidth}
                      height={animatedHeight}
                      rx="4"
                      fill={gradId}
                      filter={isHovered ? 'url(#glow-bar)' : undefined}
                      className="transition-all duration-300"
                      style={{
                        transition: 'height 0.75s cubic-bezier(0.16, 1, 0.3, 1), y 0.75s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease',
                        transitionDelay: `${pIdx * 35}ms`,
                        opacity: isHovered ? 1 : 0.88
                      }}
                    />
                    {/* Top glow cap when hovered */}
                    {isHovered && mounted && (
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height="3"
                        rx="1"
                        fill="#FFFFFF"
                        className="animate-pulse"
                      />
                    )}
                  </g>
                );
              });
            })}

          {/* Render Line/Area Series */}
          {data.series
            .filter(s => s.type === 'line' || s.type === 'area')
            .map((s, sIdx) => {
              const pathCoords = points.map((pt, pIdx) => {
                const val = Number(pt[s.key]) || 0;
                const x = padding.left + (pIdx + 0.5) * (chartW / points.length);
                const y = padding.top + chartH - (val / maxVal) * chartH;
                return `${x},${y}`;
              });

              const linePath = `M ${pathCoords.join(' L ')}`;
              const areaPath = `M ${padding.left + 0.5 * (chartW / points.length)},${padding.top + chartH} L ${pathCoords.join(' L ')} L ${
                padding.left + (points.length - 0.5) * (chartW / points.length)
              },${padding.top + chartH} Z`;

              return (
                <g key={`line-${sIdx}`}>
                  {s.type === 'area' && (
                    <path
                      d={areaPath}
                      fill={s.color || '#D6FF4B'}
                      fillOpacity={mounted ? '0.18' : '0'}
                      className="pointer-events-none transition-all duration-700 ease-out"
                    />
                  )}
                  <path
                    d={linePath}
                    fill="none"
                    stroke={s.color || '#D6FF4B'}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-all duration-700 ease-out"
                    style={{
                      strokeDasharray: mounted ? 'none' : '1000',
                      strokeDashoffset: mounted ? '0' : '1000'
                    }}
                  />
                  {points.map((pt, pIdx) => {
                    const val = Number(pt[s.key]) || 0;
                    const x = padding.left + (pIdx + 0.5) * (chartW / points.length);
                    const y = padding.top + chartH - (val / maxVal) * chartH;
                    const isHovered = hoveredIdx === pIdx;
                    return (
                      <circle
                        key={pIdx}
                        cx={x}
                        cy={y}
                        r={isHovered ? 6 : 4}
                        fill={s.color || '#D6FF4B'}
                        stroke="#0B0D0F"
                        strokeWidth="2"
                        className="cursor-pointer transition-all duration-200"
                        onMouseEnter={() => setHoveredIdx(pIdx)}
                        onMouseLeave={() => setHoveredIdx(null)}
                      />
                    );
                  })}
                </g>
              );
            })}

          {/* X Axis Labels */}
          {points.map((pt, pIdx) => {
            const x = padding.left + (pIdx + 0.5) * (chartW / points.length);
            const rawLabel = String(pt[xKey] || '');
            const label = rawLabel.length > 10 ? rawLabel.split(' ')[0] : rawLabel;
            const isHovered = hoveredIdx === pIdx;
            return (
              <text
                key={pIdx}
                x={x}
                y={height - 12}
                textAnchor="middle"
                className={`text-[10px] transition-colors duration-150 ${
                  isHovered ? 'fill-tv-accent font-bold' : 'fill-tv-text-muted font-medium'
                }`}
              >
                {label}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Interactive Floating Hover Details Card */}
      {hoveredIdx !== null && points[hoveredIdx] && (
        <div className="mt-3 bg-tv-base/90 backdrop-blur-md rounded-xl px-4 py-2.5 text-xs flex items-center justify-between border border-tv-border shadow-md animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-tv-accent shadow-xs" />
            <span className="font-semibold text-tv-text-primary text-[13px]">{points[hoveredIdx][xKey]}</span>
          </div>
          <div className="flex items-center gap-4">
            {data.series.map((s, i) => (
              <span key={i} className="text-tv-text-secondary font-mono">
                {s.name}: <strong className="text-tv-accent font-bold">{points[hoveredIdx][s.key]}</strong>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const TableArtifactView: React.FC<{ data: TableArtifactData; title?: string }> = ({ data, title }) => {
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleExportCSV = () => {
    const header = data.columns.map(c => `"${c.label}"`).join(',');
    const rows = data.rows.map(r => data.columns.map(c => `"${r[c.key] || ''}"`).join(','));
    const csvContent = [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${title || 'export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    confetti({ particleCount: 35, spread: 65, origin: { y: 0.85 } });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSort = (colKey: string) => {
    if (sortCol === colKey) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(colKey);
      setSortDir('desc');
    }
  };

  // Filter & sort rows
  const processedRows = useMemo(() => {
    let rows = [...data.rows];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter(r =>
        Object.values(r).some(val => String(val).toLowerCase().includes(q))
      );
    }
    if (sortCol) {
      rows.sort((a, b) => {
        const valA = a[sortCol];
        const valB = b[sortCol];
        const cleanA = typeof valA === 'string' ? parseFloat(valA.replace(/[₹,%+]/g, '')) : Number(valA);
        const cleanB = typeof valB === 'string' ? parseFloat(valB.replace(/[₹,%+]/g, '')) : Number(valB);

        if (!isNaN(cleanA) && !isNaN(cleanB)) {
          return sortDir === 'asc' ? cleanA - cleanB : cleanB - cleanA;
        }
        return sortDir === 'asc'
          ? String(valA || '').localeCompare(String(valB || ''))
          : String(valB || '').localeCompare(String(valA || ''));
      });
    }
    return rows;
  }, [data.rows, searchTerm, sortCol, sortDir]);

  return (
    <div className="bg-tv-surface border border-tv-border rounded-[14px] overflow-hidden shadow-sm transition-all duration-300">
      {/* Table Action Bar */}
      <div className="px-4 py-3 border-b border-tv-border flex items-center justify-between flex-wrap gap-3 bg-tv-base/40">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-tv-accent" />
          <h4 className="text-sm font-semibold text-tv-text-primary">{title || 'Data Matrix'}</h4>
          <span className="text-[11px] text-tv-text-muted font-mono bg-tv-surface px-2 py-0.5 rounded border border-tv-border/60">
            {processedRows.length} {processedRows.length === 1 ? 'row' : 'rows'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-tv-text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search data..."
              className="bg-tv-surface border border-tv-border text-[12px] text-tv-text-primary placeholder-tv-text-muted rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-tv-accent w-36 sm:w-44 transition-all"
            />
          </div>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-tv-surface hover:bg-tv-base border border-tv-border hover:border-tv-accent text-tv-text-secondary hover:text-tv-text-primary px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-2xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5" />}
            <span>{copied ? 'Exported CSV' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto max-h-80 custom-scrollbar">
        <table className="w-full text-xs text-left">
          <thead className="bg-tv-base/80 backdrop-blur-sm text-tv-text-secondary font-semibold sticky top-0 uppercase tracking-wider text-[11px] border-b border-tv-border z-10">
            <tr>
              {data.columns.map((col, idx) => (
                <th
                  key={idx}
                  onClick={() => handleSort(col.key)}
                  className="px-4 py-3 border-b border-tv-border cursor-pointer select-none hover:text-tv-text-primary transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.label}</span>
                    {sortCol === col.key ? (
                      sortDir === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-tv-accent" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-tv-accent" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-tv-text-muted opacity-40 hover:opacity-100" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-tv-border/50 text-tv-text-secondary">
            {processedRows.map((row, rIdx) => (
              <tr
                key={rIdx}
                className="hover:bg-tv-base/80 hover:text-tv-text-primary transition-colors duration-150 group"
              >
                {data.columns.map((col, cIdx) => {
                  const val = row[col.key];
                  const isGrowth = col.format === 'growth' || col.key.includes('growth');
                  const isPos = String(val).startsWith('+');
                  const isNeg = String(val).startsWith('-');

                  return (
                    <td key={cIdx} className="px-4 py-2.5 font-mono">
                      {isGrowth ? (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            isPos
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                              : isNeg
                              ? 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
                              : 'text-tv-text-secondary'
                          }`}
                        >
                          {val}
                        </span>
                      ) : cIdx === 0 ? (
                        <span className="font-sans font-medium text-tv-text-primary group-hover:text-tv-accent transition-colors">
                          {val}
                        </span>
                      ) : (
                        <span>{val}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const FileArtifactDownload: React.FC<{ data: FileArtifactData; title?: string }> = ({ data, title }) => {
  const [downloading, setDownloading] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    setError(null);
    setStatusText('Preparing report...');

    try {
      setTimeout(() => setStatusText('Collecting authorized data...'), 300);
      setTimeout(() => setStatusText('Building workbook...'), 700);

      await apiClient.reports.downloadExcel({
        reportType: data.reportType || (data.filename.includes('Portfolio') ? 'portfolio' : 'executive'),
        companyIds: data.companyIds,
        companyId: data.companyId,
        periodMonths: data.periodMonths || 6,
        analysisContext: data.analysisContext,
        title: title || data.filename
      });

      confetti({
        particleCount: 45,
        spread: 70,
        origin: { y: 0.8 }
      });

      setStatusText('Report ready.');
      setDownloaded(true);
      setTimeout(() => {
        setDownloaded(false);
        setStatusText(null);
      }, 4000);
    } catch (err: any) {
      setError('Unable to generate the report. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const isExcel = data.format === 'xlsx' || data.filename.endsWith('.xlsx');

  return (
    <div className="bg-tv-surface border border-tv-border rounded-[14px] p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-tv-accent/30 transition-all duration-300">
      <div className="flex items-center gap-3.5 min-w-0">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
            isExcel
              ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/40'
              : 'bg-blue-950/50 text-blue-400 border-blue-800/40'
          }`}
        >
          {isExcel ? <FileSpreadsheet className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-tv-text-primary truncate">
            {title || data.filename}
          </h4>
          <p className="text-xs text-tv-text-secondary line-clamp-1 mt-0.5">{data.description}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-block uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-tv-base border border-tv-border text-tv-accent">
              {data.format.toUpperCase()}
            </span>
            <span className="text-[11px] text-tv-text-muted">{data.size}</span>
            {statusText && (
              <span className="text-[11px] font-medium text-tv-accent animate-pulse">
                · {statusText}
              </span>
            )}
            {error && (
              <span className="text-[11px] font-medium text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 inline" /> {error}
              </span>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={handleDownload}
        disabled={downloading}
        className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold shadow transition-all shrink-0 cursor-pointer ${
          downloaded
            ? 'bg-emerald-500 text-slate-950 font-bold'
            : downloading
            ? 'bg-tv-border text-tv-text-muted cursor-wait'
            : 'bg-tv-accent hover:bg-tv-accent-hover text-slate-950 font-bold shadow-md hover:scale-[1.02]'
        }`}
      >
        {downloading ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating...
          </>
        ) : downloaded ? (
          <>
            <Check className="w-4 h-4 text-slate-950" /> Report Ready
          </>
        ) : (
          <>
            <Download className="w-4 h-4" /> Download Excel Report
          </>
        )}
      </button>
    </div>
  );
};
