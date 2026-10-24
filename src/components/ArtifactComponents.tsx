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
  Sparkles,
  Calendar,
  Building2,
  DollarSign,
  Percent,
  Package,
  Activity,
  CheckCircle2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { KPIArtifactData, ChartArtifactData, TableArtifactData, FileArtifactData } from '../types';
import { apiClient } from '../services/apiClient';

export const KPICard: React.FC<{ data: KPIArtifactData; title?: string }> = ({ data, title }) => {
  const changeType = (data as any).changeType || (data as any).change_type || 'neutral';
  const isPositive = changeType === 'positive';
  const isNegative = changeType === 'negative';

  // Determine icon & category based on metric
  const metricLower = ((data.metric || '') + ' ' + (title || '')).toLowerCase();
  const isMargin = metricLower.includes('margin') || metricLower.includes('profit');
  const isSales = metricLower.includes('sale') || metricLower.includes('revenue');
  const isUnits = metricLower.includes('unit') || metricLower.includes('volume') || metricLower.includes('piece');
  const isLocation = metricLower.includes('headquarter') || metricLower.includes('location') || metricLower.includes('base') || metricLower.includes('facility');

  const getMetricIcon = () => {
    if (isMargin) return <Percent className="w-4 h-4 text-emerald-400" />;
    if (isSales) return <DollarSign className="w-4 h-4 text-[#A089E6]" />;
    if (isUnits) return <Package className="w-4 h-4 text-purple-300" />;
    if (isLocation) return <Building2 className="w-4 h-4 text-amber-300" />;
    return <Activity className="w-4 h-4 text-[#A089E6]" />;
  };

  const getMetricCategoryName = () => {
    if (isMargin) return 'GROSS PROFIT MARGIN (%)';
    if (isSales) return 'SALES REVENUE (INR)';
    if (isUnits) return 'PRODUCTION VOLUME (UNITS)';
    if (isLocation) return 'FACILITY / HEADQUARTERS';
    return (data.metric || 'PERFORMANCE KPI').toUpperCase();
  };

  // Explicit denomination label to prevent user confusion
  const getDenominationLabel = () => {
    const val = String(data.value || '');
    if (val.includes('₹') && (val.includes('L') || val.includes('Lakh'))) {
      return 'Lakhs (INR) · Audited Sales Ledger';
    }
    if (val.includes('₹')) {
      return 'INR Value · Multi-Tenant General Ledger';
    }
    if (val.includes('%')) {
      return 'Operating Margin Rate (%)';
    }
    if (isUnits) {
      return 'Finished Goods / Mill Output';
    }
    return 'Audited Operating Metric';
  };

  const subtext = data.subtext || '';
  const isCompanyInSubtext = subtext.toLowerCase().includes('company') || subtext.toLowerCase().includes('mill') || subtext.toLowerCase().includes('textiles') || subtext.toLowerCase().includes('enterprise');

  return (
    <div className="bg-[#130C2E]/75 backdrop-blur-xl border border-purple-400/20 rounded-2xl p-5 shadow-[0_4px_25px_rgba(0,0,0,0.35)] hover:border-purple-400/40 hover:shadow-[0_8px_30px_rgba(160,137,230,0.18)] transition-all duration-300 group relative overflow-hidden flex flex-col justify-between">
      {/* Top right ambient volumetric purple aura */}
      <div className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 bg-[#8A5CFF]/15 blur-2xl rounded-full" />

      {/* Header section: Metric Category & Timeframe Pill */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-purple-950/70 border border-purple-400/25 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(160,137,230,0.2)]">
              {getMetricIcon()}
            </div>
            <div className="overflow-hidden">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#A089E6] block truncate">
                {getMetricCategoryName()}
              </span>
              <span className="text-xs font-semibold text-white/90 truncate block">
                {title || data.metric}
              </span>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 bg-purple-950/60 text-purple-200 border border-purple-400/25 px-2.5 py-1 rounded-full text-[10px] font-mono shrink-0 shadow-xs">
            <Calendar className="w-3 h-3 text-[#A089E6]" />
            <span>{data.period}</span>
          </span>
        </div>

        {/* Primary Value Display with explicit denomination */}
        <div className="mt-3.5">
          <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight drop-shadow-[0_2px_12px_rgba(160,137,230,0.25)] tabular-nums">
            {data.value}
          </div>
          <div className="text-[11px] text-purple-300/60 font-medium mt-1 flex items-center gap-1.5">
            <span>{getDenominationLabel()}</span>
          </div>
        </div>
      </div>

      {/* Footer / Contextual Grounding Badges */}
      <div className="pt-3.5 mt-4 border-t border-purple-400/15 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {data.change && (
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-semibold text-[11px] transition-transform duration-200 group-hover:scale-105 ${
                isPositive
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 shadow-[0_0_8px_rgba(52,211,153,0.15)]'
                  : isNegative
                  ? 'bg-rose-950/60 text-rose-400 border border-rose-800/50 shadow-[0_0_8px_rgba(244,63,94,0.15)]'
                  : 'bg-purple-950/60 text-purple-200 border border-purple-400/25'
              }`}
            >
              {isPositive && <TrendingUp className="w-3.5 h-3.5 mr-1 inline" />}
              {isNegative && <TrendingDown className="w-3.5 h-3.5 mr-1 inline" />}
              {!isPositive && !isNegative && <Minus className="w-3.5 h-3.5 mr-1 inline" />}
              {data.change}
            </span>
          )}

          {subtext && (
            <span
              className="inline-flex items-center gap-1.5 text-[11px] text-purple-200/80 bg-white/[0.04] px-2.5 py-0.5 rounded-full border border-purple-400/15 truncate max-w-[220px]"
              title={subtext}
            >
              {isCompanyInSubtext && <Building2 className="w-3 h-3 text-[#A089E6] shrink-0" />}
              <span className="truncate">{subtext}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-[10px] text-purple-300/40 font-mono">
          <CheckCircle2 className="w-3 h-3 text-emerald-400/70" />
          <span>Grounded</span>
        </div>
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

  const width = 720;
  const height = 250;
  const padding = { top: 25, right: 28, bottom: 44, left: 58 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Horizontal Bar / Ranking Chart Mode (Section 17: Intelligent Question-Driven Visuals)
  if (chartType === 'horizontal_bar' || chartType === 'ranking') {
    const valueKey = series[0]?.key || 'total_revenue_lakh';
    const metricName = series[0]?.name || 'Value';
    const isMargin = valueKey.includes('margin') || metricName.includes('%');
    const isGrowth = valueKey.includes('growth');
    const isUnits = valueKey.includes('unit') || metricName.toLowerCase().includes('unit');
    const isRupee = (valueKey.includes('revenue') || valueKey.includes('profit') || metricName.includes('₹')) && !isMargin && !isGrowth;

    // Sort descending by target metric
    const sortedPoints = [...points].sort((a, b) => (Number(b[valueKey]) || 0) - (Number(a[valueKey]) || 0));
    const highestVal = Math.max(1, Number(sortedPoints[0]?.[valueKey]) || 1);

    return (
      <div className="w-full">
        {title && (
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-purple-400/20 flex-wrap gap-2">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#A089E6] shadow-[0_0_8px_#A089E6]" />
              {title}
            </h4>
            <span className="text-[11px] text-purple-300/70 font-mono bg-purple-950/60 px-2.5 py-0.5 rounded-full border border-purple-400/20">
              Ranked Leaderboard ({sortedPoints.length} items)
            </span>
          </div>
        )}

        <div className="space-y-2.5">
          {sortedPoints.map((pt, i) => {
            const val = Number(pt[valueKey]) || 0;
            const pctOfMax = Math.max(8, Math.min(100, (val / highestVal) * 100));
            const isHovered = hoveredIdx === i;

            // Tiered rank badges
            const rankBadge = i === 0 
              ? 'bg-amber-500/25 text-amber-300 border-amber-400/50 shadow-[0_0_10px_rgba(245,158,11,0.25)]' 
              : i === 1 
              ? 'bg-slate-400/25 text-slate-200 border-slate-300/40' 
              : i === 2 
              ? 'bg-orange-600/25 text-orange-300 border-orange-500/40' 
              : 'bg-purple-950/50 text-purple-300 border-purple-400/20';

            const name = (pt.company_name as string) || (pt.category_name as string) || (pt.name as string) || (pt[xKey] as string) || `Enterprise ${i + 1}`;
            
            let formattedVal = `${val.toLocaleString()}`;
            if (isMargin) formattedVal = `${val.toFixed(2)}%`;
            else if (isGrowth) formattedVal = `${val > 0 ? '+' : ''}${val.toFixed(2)}%`;
            else if (isRupee) formattedVal = `₹${val.toLocaleString('en-IN', { maximumFractionDigits: 2 })} L`;
            else if (isUnits) formattedVal = `${Math.round(val).toLocaleString()} Units`;

            const gradient = i === 0
              ? 'from-[#C4B5FD] via-[#A089E6] to-[#6D4AFF]'
              : i === 1
              ? 'from-[#6EE7B7] via-[#34D399] to-[#059669]'
              : i === 2
              ? 'from-[#7DD3FC] via-[#38BDF8] to-[#2563EB]'
              : 'from-[#FDE68A] via-[#FBBF24] to-[#D97706]';

            return (
              <div
                key={i}
                className={`p-2.5 rounded-xl transition-all duration-300 cursor-pointer ${
                  isHovered ? 'bg-purple-950/60 border border-purple-400/40 shadow-md translate-x-1' : 'bg-white/[0.02] border border-white/5 hover:border-purple-400/25'
                }`}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <div className="flex items-center justify-between mb-1.5 text-xs">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold border shrink-0 ${rankBadge}`}>
                      #{i + 1}
                    </span>
                    <span className="font-semibold text-white truncate text-[13px]">{name}</span>
                    {pt.code && (
                      <span className="text-[10px] text-purple-300/60 font-mono bg-purple-950/60 px-1.5 py-0.2 rounded border border-purple-400/20 shrink-0">
                        {pt.code}
                      </span>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-white font-mono font-bold text-xs">{formattedVal}</span>
                    {pt.total_revenue_lakh && isMargin && (
                      <span className="text-purple-300/50 text-[10px] block font-mono">
                        Rev: ₹{Number(pt.total_revenue_lakh).toFixed(1)}L
                      </span>
                    )}
                    {pt.avg_profit_margin_pct && isRupee && (
                      <span className="text-emerald-300/70 text-[10px] block font-mono">
                        Margin: {Number(pt.avg_profit_margin_pct).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar container */}
                <div className="w-full bg-[#0E0B1A] h-2.5 rounded-full overflow-hidden p-0.5 border border-purple-400/10">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-700 ease-out`}
                    style={{
                      width: mounted ? `${pctOfMax}%` : '0%',
                      boxShadow: isHovered ? '0 0 12px rgba(160,137,230,0.6)' : undefined
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Donut chart mode
  if (chartType === 'donut') {
    const valueKey = data.series?.[0]?.key || 'total_revenue_lakh';
    const total = points.reduce(
      (acc, pt) => acc + (Number(pt[valueKey] || pt.total_revenue_lakh || pt.revenueSharePct || 1) || 0),
      0
    );
    const colors = ['#A089E6', '#6D4AFF', '#34D399', '#38BDF8', '#FBBF24', '#F472B6'];
    let accumulated = 0;

    return (
      <div className="w-full">
        {title && (
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-purple-400/20">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#A089E6] shadow-[0_0_8px_#A089E6]" />
              {title}
            </h4>
            <span className="text-[11px] text-purple-300/60 font-mono">Market Distribution</span>
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
              <span className="text-[11px] text-purple-300/70">
                {hoveredIdx !== null ? (points[hoveredIdx][xKey] || 'Enterprise') : 'Total Share'}
              </span>
              <span className="text-base font-bold text-white drop-shadow-[0_0_10px_rgba(160,137,230,0.4)]">
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
                  className={`flex items-center justify-between p-2 rounded-xl text-xs transition-all duration-200 cursor-pointer ${
                    isHovered
                      ? 'bg-purple-950/60 border border-purple-400/40 shadow-sm font-semibold translate-x-1'
                      : 'hover:bg-white/[0.04] border border-transparent'
                  }`}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-[0_0_6px_currentColor]" style={{ backgroundColor: col, color: col }} />
                    <span className="truncate text-purple-200/90">{pt[xKey] || pt.category_name}</span>
                  </div>
                  <span className="text-white font-mono shrink-0">
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

  // Bar / Area / Line grouped series calculation
  const barSeriesList = series.filter(s => s.type === 'bar' || !s.type);
  const numBars = Math.max(1, barSeriesList.length);
  const colSlotW = chartW / points.length;
  // Dynamic group width tailored so multi-series sit side-by-side cleanly without overlapping
  const groupW = Math.min(54, Math.max(16, colSlotW * 0.72));
  const barGap = numBars > 1 ? 3 : 0;
  const singleBarW = Math.max(8, (groupW - (numBars - 1) * barGap) / numBars);

  return (
    <div className="w-full overflow-hidden">
      {/* Chart Header with Theme-Relative Accents */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2 pb-3 border-b border-purple-400/20">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#A089E6] shadow-[0_0_8px_#A089E6] animate-pulse" />
          {title && <h4 className="text-sm font-bold text-white tracking-tight">{title}</h4>}
        </div>
        <div className="flex items-center gap-3 text-xs">
          {data.series.map((s, i) => {
            const dotColor = i === 0 ? '#A089E6' : i === 1 ? '#34D399' : s.color || '#38BDF8';
            return (
              <div key={i} className="flex items-center gap-1.5 bg-white/[0.04] px-2.5 py-1 rounded-full border border-purple-400/20 shadow-xs">
                <span className="w-2.5 h-2.5 rounded-full shadow-[0_0_6px_currentColor]" style={{ backgroundColor: dotColor, color: dotColor }} />
                <span className="text-purple-200/90 font-medium text-[11px]">{s.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="w-full overflow-x-auto custom-scrollbar">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-56 select-none">
          {/* Radiant Gradient & Glow Definitions */}
          <defs>
            {/* Lavender to Violet Radiant Gradient */}
            <linearGradient id="grad-accent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C4B5FD" stopOpacity="1" />
              <stop offset="35%" stopColor="#A089E6" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#6D4AFF" stopOpacity="0.85" />
            </linearGradient>

            {/* Radiant Emerald Gradient */}
            <linearGradient id="grad-emerald" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6EE7B7" stopOpacity="1" />
              <stop offset="40%" stopColor="#34D399" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.85" />
            </linearGradient>

            {/* Electric Blue Gradient */}
            <linearGradient id="grad-blue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7DD3FC" stopOpacity="1" />
              <stop offset="45%" stopColor="#38BDF8" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.80" />
            </linearGradient>

            {/* Radiant Amber Gradient */}
            <linearGradient id="grad-amber" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FDE68A" stopOpacity="1" />
              <stop offset="45%" stopColor="#FBBF24" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#D97706" stopOpacity="0.80" />
            </linearGradient>

            {/* Glowing Drop Shadows */}
            <filter id="glow-purple" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#A089E6" floodOpacity="0.7" />
            </filter>
            <filter id="glow-emerald" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#34D399" floodOpacity="0.7" />
            </filter>
            <filter id="glow-bar" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#A089E6" floodOpacity="0.5" />
            </filter>
          </defs>

          {/* Grid lines with soft translucent purple accents */}
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
                  stroke="rgba(160, 137, 230, 0.12)"
                  strokeWidth="1"
                  strokeDasharray={i > 0 && i < 4 ? '3 3' : undefined}
                />
                <text
                  x={padding.left - 10}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[10px] fill-purple-300/50 font-mono"
                >
                  {labelVal >= 1000 ? `${(labelVal / 1000).toFixed(1)}k` : labelVal}
                </text>
              </g>
            );
          })}

          {/* Vertical guideline on column hover */}
          {hoveredIdx !== null && points[hoveredIdx] && (
            <line
              x1={padding.left + (hoveredIdx + 0.5) * colSlotW}
              y1={padding.top}
              x2={padding.left + (hoveredIdx + 0.5) * colSlotW}
              y2={padding.top + chartH}
              stroke="rgba(160, 137, 230, 0.35)"
              strokeDasharray="4 4"
              strokeWidth="1.5"
              className="pointer-events-none transition-all duration-150"
            />
          )}

          {/* Render Grouped Bars: Side-by-Side Without Overlapping */}
          {(() => {
            return barSeriesList.map((s, sIdx) => {
              const gradId =
                sIdx === 0
                  ? 'url(#grad-accent)'
                  : sIdx === 1
                  ? 'url(#grad-emerald)'
                  : sIdx === 2
                  ? 'url(#grad-blue)'
                  : 'url(#grad-amber)';

              const glowId =
                sIdx === 0
                  ? 'url(#glow-purple)'
                  : sIdx === 1
                  ? 'url(#glow-emerald)'
                  : 'url(#glow-bar)';

              return points.map((pt, pIdx) => {
                const val = Number(pt[s.key]) || 0;
                const barHeight = (val / maxVal) * chartH;
                const groupCenterX = padding.left + (pIdx + 0.5) * colSlotW;
                const x = groupCenterX - groupW / 2 + sIdx * (singleBarW + barGap);
                const y = padding.top + chartH - barHeight;
                const isHovered = hoveredIdx === pIdx;

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
                      width={singleBarW}
                      height={animatedHeight}
                      rx="4"
                      ry="4"
                      fill={gradId}
                      filter={isHovered ? glowId : undefined}
                      className="transition-all duration-300"
                      style={{
                        transition: 'height 0.75s cubic-bezier(0.16, 1, 0.3, 1), y 0.75s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease',
                        transitionDelay: `${pIdx * 25 + sIdx * 15}ms`,
                        opacity: hoveredIdx !== null ? (isHovered ? 1 : 0.45) : 0.92
                      }}
                    />
                    {/* Top radiant reflection cap on hover */}
                    {isHovered && mounted && (
                      <rect
                        x={x}
                        y={y}
                        width={singleBarW}
                        height="3"
                        rx="1.5"
                        fill="#FFFFFF"
                        className="animate-pulse"
                      />
                    )}
                  </g>
                );
              });
            });
          })()}

          {/* Render Line/Area Series */}
          {data.series
            .filter(s => s.type === 'line' || s.type === 'area')
            .map((s, sIdx) => {
              const pathCoords = points.map((pt, pIdx) => {
                const val = Number(pt[s.key]) || 0;
                const x = padding.left + (pIdx + 0.5) * colSlotW;
                const y = padding.top + chartH - (val / maxVal) * chartH;
                return `${x},${y}`;
              });

              const linePath = `M ${pathCoords.join(' L ')}`;
              const areaPath = `M ${padding.left + 0.5 * colSlotW},${padding.top + chartH} L ${pathCoords.join(' L ')} L ${
                padding.left + (points.length - 0.5) * colSlotW
              },${padding.top + chartH} Z`;

              const strokeCol = s.color || '#A089E6';

              return (
                <g key={`line-${sIdx}`}>
                  {s.type === 'area' && (
                    <path
                      d={areaPath}
                      fill={strokeCol}
                      fillOpacity={mounted ? '0.2' : '0'}
                      className="pointer-events-none transition-all duration-700 ease-out"
                    />
                  )}
                  <path
                    d={linePath}
                    fill="none"
                    stroke={strokeCol}
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
                    const x = padding.left + (pIdx + 0.5) * colSlotW;
                    const y = padding.top + chartH - (val / maxVal) * chartH;
                    const isHovered = hoveredIdx === pIdx;
                    return (
                      <circle
                        key={pIdx}
                        cx={x}
                        cy={y}
                        r={isHovered ? 6 : 4}
                        fill={strokeCol}
                        stroke="#0E0B1A"
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
            const x = padding.left + (pIdx + 0.5) * colSlotW;
            const rawLabel = String(pt[xKey] || '');
            const label = (pt.code && xKey !== 'month' ? String(pt.code) : '') || (rawLabel.length > 10 ? rawLabel.split(' ')[0] : rawLabel);
            const isHovered = hoveredIdx === pIdx;
            return (
              <text
                key={pIdx}
                x={x}
                y={height - 12}
                textAnchor="middle"
                className={`text-[10px] transition-colors duration-150 ${
                  isHovered ? 'fill-[#A089E6] font-bold' : 'fill-purple-300/50 font-medium'
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
        <div className="mt-4 bg-[#140D2E]/95 backdrop-blur-2xl rounded-xl p-3.5 text-xs flex flex-wrap items-center justify-between gap-3 border border-purple-400/30 shadow-[0_8px_30px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#A089E6] shadow-[0_0_8px_#A089E6]" />
            <span className="font-bold text-white text-[13px]">
              {(points[hoveredIdx].company_name as string) || points[hoveredIdx][xKey]}
            </span>
            <span className="text-[10px] text-purple-300/60 font-mono bg-purple-950/60 px-2 py-0.5 rounded-full border border-purple-400/20">
              Period Detail
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {series.map((s, i) => {
              const val = Number(points[hoveredIdx][s.key]) || 0;
              const isRupee = s.key.includes('revenue') || s.key.includes('profit') || s.name.includes('₹');
              const formattedVal = isRupee ? `₹${val.toFixed(2)}L` : val.toLocaleString();
              const dotColor = i === 0 ? '#A089E6' : i === 1 ? '#34D399' : s.color || '#38BDF8';
              return (
                <div key={i} className="flex items-center gap-1.5 bg-white/[0.04] px-2.5 py-1 rounded-lg border border-purple-400/15">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
                  <span className="text-purple-200/80">{s.name}:</span>
                  <span className="font-bold text-white font-mono">{formattedVal}</span>
                </div>
              );
            })}

            {/* Computed Margin if both revenue & profit exist */}
            {(() => {
              const pt = points[hoveredIdx];
              const rev = Number(pt.revenue_lakh || pt.total_revenue_lakh) || 0;
              const gp = Number(pt.gross_profit_lakh || pt.total_gross_profit_lakh) || 0;
              if (rev > 0 && gp > 0) {
                const margin = ((gp / rev) * 100).toFixed(2);
                return (
                  <div className="flex items-center gap-1.5 bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 px-2.5 py-1 rounded-lg font-semibold">
                    <span>Margin:</span>
                    <span className="font-mono">{margin}%</span>
                  </div>
                );
              }
              return null;
            })()}
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
    <div className="bg-[#130C2E]/75 backdrop-blur-xl border border-purple-400/20 rounded-2xl overflow-hidden shadow-[0_4px_25px_rgba(0,0,0,0.3)] transition-all duration-300">
      {/* Table Action Bar */}
      <div className="px-4 py-3 border-b border-purple-400/20 flex items-center justify-between flex-wrap gap-3 bg-purple-950/40">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#A089E6]" />
          <h4 className="text-sm font-bold text-white">{title || 'Data Matrix'}</h4>
          <span className="text-[11px] text-purple-300/70 font-mono bg-[#0C071C] px-2 py-0.5 rounded-full border border-purple-400/20">
            {processedRows.length} {processedRows.length === 1 ? 'row' : 'rows'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-purple-300/50 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search data..."
              className="bg-[#0C071C]/70 border border-purple-400/25 text-[12px] text-white placeholder-purple-300/40 rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:border-[#A089E6] w-36 sm:w-44 transition-all"
            />
          </div>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-[#A089E6] to-[#6D4AFF] hover:from-[#B8A4EE] hover:to-[#8155F5] text-white px-3.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-[0_0_12px_rgba(109,74,255,0.3)] hover:scale-105 active:scale-95"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Download className="w-3.5 h-3.5" />}
            <span>{copied ? 'Exported CSV' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto max-h-80 custom-scrollbar">
        <table className="w-full text-xs text-left">
          <thead className="bg-[#0C071C]/90 backdrop-blur-md text-purple-200/90 font-semibold sticky top-0 uppercase tracking-wider text-[11px] border-b border-purple-400/20 z-10">
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
    <div className="bg-[#130C2E]/75 backdrop-blur-xl border border-purple-400/20 rounded-2xl p-5 shadow-[0_4px_25px_rgba(0,0,0,0.35)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-purple-400/40 transition-all duration-300">
      <div className="flex items-center gap-3.5 min-w-0">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
            isExcel
              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40 shadow-[0_0_12px_rgba(52,211,153,0.2)]'
              : 'bg-purple-950/60 text-[#A089E6] border-purple-400/30 shadow-[0_0_12px_rgba(160,137,230,0.2)]'
          }`}
        >
          {isExcel ? <FileSpreadsheet className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-white truncate">
            {title || data.filename}
          </h4>
          <p className="text-xs text-purple-200/70 line-clamp-1 mt-0.5">{data.description}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="inline-block uppercase text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-400/30 text-[#A089E6] font-mono">
              {data.format.toUpperCase()}
            </span>
            <span className="text-[11px] text-purple-300/50 font-mono">{data.size}</span>
            {statusText && (
              <span className="text-[11px] font-medium text-[#A089E6] animate-pulse">
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
        className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold shadow transition-all shrink-0 cursor-pointer ${
          downloaded
            ? 'bg-emerald-500 text-slate-950 font-bold shadow-[0_0_15px_rgba(16,185,129,0.4)]'
            : downloading
            ? 'bg-purple-950/60 text-purple-300/50 cursor-wait border border-purple-400/20'
            : 'bg-gradient-to-r from-[#A089E6] to-[#6D4AFF] hover:from-[#B8A4EE] hover:to-[#8155F5] text-white font-bold shadow-[0_0_15px_rgba(109,74,255,0.35)] hover:shadow-[0_0_25px_rgba(160,137,230,0.5)] hover:scale-105 active:scale-95'
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
