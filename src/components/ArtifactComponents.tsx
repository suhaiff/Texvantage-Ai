import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Download, FileSpreadsheet, FileText, Check, ChevronRight, RefreshCw, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { KPIArtifactData, ChartArtifactData, TableArtifactData, FileArtifactData } from '../types';
import { apiClient } from '../services/apiClient';

export const KPICard: React.FC<{ data: KPIArtifactData; title?: string }> = ({ data, title }) => {
  const isPositive = data.changeType === 'positive';
  const isNegative = data.changeType === 'negative';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
        <span>{title || data.metric}</span>
        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] font-medium text-slate-600 dark:text-slate-300">
          {data.period}
        </span>
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
        {data.value}
      </div>
      <div className="flex items-center gap-1.5 mt-2 text-xs">
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium ${
            isPositive
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
              : isNegative
              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {isPositive && <TrendingUp className="w-3.5 h-3.5 mr-1 inline" />}
          {isNegative && <TrendingDown className="w-3.5 h-3.5 mr-1 inline" />}
          {!isPositive && !isNegative && <Minus className="w-3.5 h-3.5 mr-1 inline" />}
          {data.change}
        </span>
        {data.subtext && <span className="text-slate-400 dark:text-slate-500 truncate">{data.subtext}</span>}
      </div>
    </div>
  );
};

export const InteractiveChart: React.FC<{ data: ChartArtifactData; title?: string }> = ({ data, title }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const points = data.dataPoints;
  if (!points || points.length === 0) return null;

  // Compute numeric max for scaling
  const numericKeys = data.series.map(s => s.key);
  let maxVal = 0;
  points.forEach(pt => {
    numericKeys.forEach(k => {
      const val = Number(pt[k]) || 0;
      if (val > maxVal) maxVal = val;
    });
  });
  if (maxVal === 0) maxVal = 100;

  const width = 580;
  const height = 220;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Donut chart mode
  if (data.chartType === 'donut') {
    const total = points.reduce((acc, pt) => acc + (Number(pt.total_revenue_lakh || pt.revenueSharePct || 1) || 0), 0);
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];
    let accumulated = 0;

    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
        {title && <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">{title}</h4>}
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="relative w-44 h-44 flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
              {points.map((pt, i) => {
                const val = Number(pt.total_revenue_lakh || pt.revenueSharePct || 1) || 0;
                const pct = total > 0 ? val / total : 0;
                const strokeDasharray = `${pct * 283} 283`;
                const strokeDashoffset = -accumulated * 283;
                accumulated += pct;
                const col = colors[i % colors.length];

                return (
                  <circle
                    key={i}
                    cx="50"
                    cy="50"
                    r="45"
                    fill="transparent"
                    stroke={col}
                    strokeWidth="10"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs text-slate-500 dark:text-slate-400">Total Share</span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">100%</span>
            </div>
          </div>

          <div className="flex-1 space-y-2 w-full">
            {points.map((pt, i) => {
              const val = Number(pt.total_revenue_lakh || pt.revenueSharePct || 1) || 0;
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
              const col = colors[i % colors.length];
              const isHovered = hoveredIdx === i;

              return (
                <div
                  key={i}
                  className={`flex items-center justify-between p-1.5 rounded text-xs transition-colors cursor-pointer ${
                    isHovered ? 'bg-slate-100 dark:bg-slate-800 font-semibold' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: col }} />
                    <span className="truncate text-slate-700 dark:text-slate-300">
                      {pt[data.xKey] || pt.category_name}
                    </span>
                  </div>
                  <span className="text-slate-900 dark:text-white font-medium flex-shrink-0">
                    {pt.total_revenue_lakh ? `₹${pt.total_revenue_lakh}L (${pct}%)` : `${pct}%`}
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
  const barWidth = Math.max(12, Math.min(32, chartW / points.length - 8));

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        {title && <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h4>}
        <div className="flex items-center gap-3 text-xs">
          {data.series.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              <span className="text-slate-600 dark:text-slate-400">{s.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48 select-none">
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
                  stroke="currentColor"
                  className="text-slate-100 dark:text-slate-800/80"
                  strokeDasharray={i > 0 && i < 4 ? '3 3' : undefined}
                />
                <text
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[10px] fill-slate-400 dark:fill-slate-500 font-mono"
                >
                  {labelVal > 1000 ? `${(labelVal / 1000).toFixed(1)}k` : labelVal}
                </text>
              </g>
            );
          })}

          {/* Render Bars */}
          {data.series.filter(s => s.type === 'bar' || !s.type).map((s, sIdx) => {
            return points.map((pt, pIdx) => {
              const val = Number(pt[s.key]) || 0;
              const barHeight = (val / maxVal) * chartH;
              const groupX = padding.left + (pIdx + 0.5) * (chartW / points.length);
              const x = groupX - barWidth / 2;
              const y = padding.top + chartH - barHeight;
              const isHovered = hoveredIdx === pIdx;

              return (
                <g key={`${sIdx}-${pIdx}`} onMouseEnter={() => setHoveredIdx(pIdx)} onMouseLeave={() => setHoveredIdx(null)}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(2, barHeight)}
                    rx="3"
                    fill={s.color}
                    className={`transition-all duration-200 cursor-pointer ${isHovered ? 'opacity-100 brightness-110' : 'opacity-85'}`}
                  />
                </g>
              );
            });
          })}

          {/* Render Line/Area Series */}
          {data.series.filter(s => s.type === 'line' || s.type === 'area').map((s, sIdx) => {
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
                  <path d={areaPath} fill={s.color} fillOpacity="0.15" className="pointer-events-none" />
                )}
                <path d={linePath} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
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
                      r={isHovered ? 5 : 3.5}
                      fill={s.color}
                      stroke="#fff"
                      strokeWidth="1.5"
                      className="cursor-pointer transition-all"
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
            const label = String(pt[data.xKey] || '').split(' ')[0];
            const isHovered = hoveredIdx === pIdx;
            return (
              <text
                key={pIdx}
                x={x}
                y={height - 12}
                textAnchor="middle"
                className={`text-[10px] transition-colors ${
                  isHovered ? 'fill-blue-600 dark:fill-blue-400 font-bold' : 'fill-slate-500 dark:fill-slate-400 font-medium'
                }`}
              >
                {label}
              </text>
            );
          })}
        </svg>
      </div>

      {hoveredIdx !== null && points[hoveredIdx] && (
        <div className="mt-2 bg-slate-50 dark:bg-slate-800/80 rounded-lg px-3 py-2 text-xs flex items-center justify-between border border-slate-200 dark:border-slate-700/60">
          <span className="font-semibold text-slate-800 dark:text-slate-200">{points[hoveredIdx][data.xKey]}</span>
          <div className="flex items-center gap-4">
            {data.series.map((s, i) => (
              <span key={i} className="text-slate-600 dark:text-slate-300">
                {s.name}: <strong className="text-slate-900 dark:text-white">{points[hoveredIdx][s.key]}</strong>
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

    confetti({ particleCount: 30, spread: 60, origin: { y: 0.85 } });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title || 'Data Matrix'}</h4>
        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Download className="w-3.5 h-3.5" />}
          {copied ? 'Exported CSV' : 'Export CSV'}
        </button>
      </div>
      <div className="overflow-x-auto max-h-72">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold sticky top-0 uppercase tracking-wider text-[11px]">
            <tr>
              {data.columns.map((col, idx) => (
                <th key={idx} className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
            {data.rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                {data.columns.map((col, cIdx) => {
                  const val = row[col.key];
                  const isGrowth = col.format === 'growth';
                  const isPos = String(val).startsWith('+');
                  const isNeg = String(val).startsWith('-');

                  return (
                    <td key={cIdx} className="px-3.5 py-2 font-mono">
                      {isGrowth ? (
                        <span
                          className={`font-semibold ${
                            isPos
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : isNeg
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-600'
                          }`}
                        >
                          {val}
                        </span>
                      ) : (
                        val
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
    <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 dark:from-slate-900 dark:to-slate-800/80 border border-blue-200/80 dark:border-blue-900/40 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3.5 min-w-0">
        <div
          className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isExcel
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
          }`}
        >
          {isExcel ? <FileSpreadsheet className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
            {title || data.filename}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">{data.description}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-block uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
              {data.format.toUpperCase()}
            </span>
            <span className="text-[11px] text-slate-400">{data.size}</span>
            {statusText && (
              <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 animate-pulse">
                · {statusText}
              </span>
            )}
            {error && (
              <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 inline" /> {error}
              </span>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={handleDownload}
        disabled={downloading}
        className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold shadow transition-all flex-shrink-0 ${
          downloaded
            ? 'bg-emerald-600 text-white'
            : downloading
            ? 'bg-blue-400 text-white cursor-wait'
            : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-md'
        }`}
      >
        {downloading ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating...
          </>
        ) : downloaded ? (
          <>
            <Check className="w-4 h-4 text-white" /> Report Ready
          </>
        ) : (
          <>
            <Download className="w-4 h-4" /> Generate Excel Report
          </>
        )}
      </button>
    </div>
  );
};
