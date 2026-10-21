import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Search,
  ArrowUpDown,
  Check,
  Shield,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  ChevronUp,
  ChevronDown,
  Activity
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { User } from '../types';
import { apiClient } from '../services/apiClient';

interface LedgerViewProps {
  currentUser: User;
}

export const LedgerView: React.FC<LedgerViewProps> = ({ currentUser }) => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompId, setSelectedCompId] = useState<string>(
    currentUser.companyId || 'comp_textile_a'
  );
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('periodDate');
  const [sortAsc, setSortAsc] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'table' | 'summary'>('table');

  const isAdmin = currentUser.role === 'ADMIN';
  const targetId = isAdmin ? selectedCompId : currentUser.companyId || 'comp_textile_a';

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const comps = await apiClient.companies.list();
        setCompanies(comps);
      } catch {}
    };
    fetchCompanies();
  }, [currentUser.id]);

  useEffect(() => {
    const fetchLedger = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient.analytics.getFinancials(targetId);
        setRecords(data);
      } catch (err: any) {
        setError(err?.message || 'Failed to fetch financial ledger statements');
      } finally {
        setLoading(false);
      }
    };
    fetchLedger();
  }, [targetId, currentUser.id]);

  const targetCompany = companies.find(c => c.id === targetId);

  const filtered = records
    .filter(
      r =>
        r.monthName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(r.year).includes(searchTerm)
    )
    .sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });

  const toggleSort = (field: string) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  // ── Derived aggregate metrics ──────────────────────────────────────
  const totalRev = filtered.reduce((acc, r) => acc + (r.revenueLakh || 0), 0);
  const hasGrossProfit = filtered.some(r => r.grossProfitLakh != null);
  const totalProfit = hasGrossProfit ? filtered.reduce((acc, r) => acc + (r.grossProfitLakh || 0), 0) : null;
  const avgMargin = (totalProfit != null && totalRev > 0) ? (totalProfit / totalRev) * 100 : null;
  const hasUnits = filtered.some(r => r.unitsSold != null);
  const totalUnits = hasUnits ? filtered.reduce((acc, r) => acc + (r.unitsSold || 0), 0) : null;
  const totalCogs = filtered.reduce((acc, r) => acc + (r.costOfGoodsSoldLakh || 0), 0);
  const totalNetProfit = filtered.reduce((acc, r) => acc + (r.netProfitLakh || 0), 0);

  // Peak / trough month
  const peakMonth = useMemo(() => {
    if (!filtered.length) return null;
    return filtered.reduce((best, r) => (r.revenueLakh > (best?.revenueLakh || 0) ? r : best), null as any);
  }, [filtered]);
  const troughMonth = useMemo(() => {
    if (!filtered.length) return null;
    return filtered.reduce((low, r) => (r.revenueLakh < (low?.revenueLakh ?? Infinity) ? r : low), null as any);
  }, [filtered]);

  // MoM growth for latest month
  const sortedChron = useMemo(() =>
    [...records].sort((a, b) => (a.periodDate < b.periodDate ? -1 : 1)),
    [records]);
  const latestRec = sortedChron[sortedChron.length - 1];
  const prevRec = sortedChron[sortedChron.length - 2];
  const latestMoM = (latestRec && prevRec && prevRec.revenueLakh > 0)
    ? ((latestRec.revenueLakh - prevRec.revenueLakh) / prevRec.revenueLakh) * 100
    : null;

  // Per-row MoM growth helper
  const getMoM = (idx: number, arr: any[]) => {
    if (idx === 0) return null;
    const prev = arr[idx - 1];
    if (!prev || prev.revenueLakh <= 0) return null;
    return ((arr[idx].revenueLakh - prev.revenueLakh) / prev.revenueLakh) * 100;
  };

  const handleExportCSV = () => {
    const headers = ['Period', 'Revenue (₹ Lakh)', 'COGS (₹ Lakh)', 'Gross Profit (₹ Lakh)', 'Net Profit (₹ Lakh)', 'Profit Margin %', 'Units Sold', 'Avg Realization / Unit (₹)', 'MoM Growth %'];
    const chronRows = [...filtered].sort((a, b) => (a.periodDate < b.periodDate ? -1 : 1));
    const rows = chronRows.map((r, i) => {
      const mom = getMoM(i, chronRows);
      return [
        `"${r.monthName}"`, r.revenueLakh?.toFixed(2), r.costOfGoodsSoldLakh?.toFixed(2),
        r.grossProfitLakh?.toFixed(2), r.netProfitLakh?.toFixed(2), r.profitMarginPct?.toFixed(2),
        r.unitsSold, r.averageSellingPrice?.toFixed(2), mom != null ? mom.toFixed(2) : ''
      ];
    });
    const csv = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${targetCompany?.code || 'Ledger'}_Audited_Financials.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    confetti({ particleCount: 35, spread: 60, origin: { y: 0.85 } });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const marginColor = (m: number) =>
    m > 20 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
    : m > 12 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
    : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300';

  const momColor = (v: number | null) =>
    v == null ? 'text-slate-400'
    : v > 0 ? 'text-emerald-600 dark:text-emerald-400'
    : v < 0 ? 'text-rose-500 dark:text-rose-400'
    : 'text-slate-500';

  // Sparkline-like mini bars for margin column
  const maxRev = Math.max(...filtered.map(r => r.revenueLakh || 0), 1);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="bg-tv-surface border border-tv-border rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-tv-text-primary">Audited Financial Statements</h1>
                <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Shield className="w-3 h-3" />API Verified
                </span>
              </div>
              <p className="text-xs text-tv-text-secondary mt-0.5">
                12-Month Audited General Ledger · Grounded in Relational Database
                {targetCompany && <span className="ml-2 font-semibold text-tv-text-primary">· {targetCompany.name}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {isAdmin && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Enterprise:</span>
                <select
                  value={selectedCompId}
                  onChange={e => setSelectedCompId(e.target.value)}
                  className="bg-tv-base border border-slate-200 dark:border-slate-700 text-xs rounded-xl px-3 py-2 text-tv-text-primary focus:outline-none"
                >
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Tab switcher */}
            <div className="flex items-center bg-tv-base border border-tv-border rounded-xl p-1 gap-1">
              {(['table', 'summary'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                    activeTab === t
                      ? 'bg-tv-surface shadow text-tv-text-primary border border-tv-border'
                      : 'text-tv-text-muted hover:text-tv-text-primary'
                  }`}
                >
                  {t === 'table' ? 'Ledger' : 'Analytics'}
                </button>
              ))}
            </div>

            <button
              onClick={handleExportCSV}
              disabled={loading || filtered.length === 0}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Download className="w-4 h-4" />}
              <span>{copied ? 'Exported!' : 'Export CSV'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 6 KPI Summary Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            label: '12M Revenue',
            value: `₹${totalRev.toFixed(2)} L`,
            sub: `${filtered.length} months`,
            color: 'text-tv-text-primary'
          },
          {
            label: '12M Gross Profit',
            value: totalProfit != null ? `₹${totalProfit.toFixed(2)} L` : '—',
            sub: 'After COGS',
            color: 'text-emerald-600 dark:text-emerald-400'
          },
          {
            label: 'Weighted Margin',
            value: avgMargin != null ? `${avgMargin.toFixed(2)}%` : '—',
            sub: 'Period avg',
            color: 'text-blue-600 dark:text-blue-400'
          },
          {
            label: 'Total COGS',
            value: `₹${totalCogs.toFixed(2)} L`,
            sub: `${totalRev > 0 ? ((totalCogs / totalRev) * 100).toFixed(1) : '—'}% of revenue`,
            color: 'text-amber-600 dark:text-amber-400'
          },
          {
            label: 'Net Profit',
            value: `₹${totalNetProfit.toFixed(2)} L`,
            sub: 'After OpEx',
            color: totalNetProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
          },
          {
            label: 'Cumulative Units',
            value: totalUnits != null ? totalUnits.toLocaleString('en-IN') : '—',
            sub: records[0]?.unitOfMeasure || 'units',
            color: 'text-tv-text-primary'
          },
        ].map((kpi, i) => (
          <div key={i} className="bg-tv-surface border border-tv-border rounded-xl p-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-secondary mb-1">{kpi.label}</div>
            <div className={`text-base font-bold ${kpi.color} leading-tight`}>{kpi.value}</div>
            <div className="text-[10px] text-tv-text-muted mt-1">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Performance Highlights ───────────────────────────────────── */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Peak month */}
          <div className="bg-tv-surface border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Peak Revenue Month</span>
            </div>
            <div className="text-xl font-bold text-tv-text-primary">{peakMonth?.monthName || '—'}</div>
            <div className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold">₹{peakMonth?.revenueLakh?.toFixed(2)} L</div>
            <div className="text-xs text-tv-text-muted mt-0.5">Margin: {peakMonth?.profitMarginPct?.toFixed(2)}%</div>
          </div>

          {/* Trough month */}
          <div className="bg-tv-surface border border-rose-200 dark:border-rose-900/60 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-rose-500" />
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Lowest Revenue Month</span>
            </div>
            <div className="text-xl font-bold text-tv-text-primary">{troughMonth?.monthName || '—'}</div>
            <div className="text-sm text-rose-500 dark:text-rose-400 font-semibold">₹{troughMonth?.revenueLakh?.toFixed(2)} L</div>
            <div className="text-xs text-tv-text-muted mt-0.5">Margin: {troughMonth?.profitMarginPct?.toFixed(2)}%</div>
          </div>

          {/* Latest MoM growth */}
          <div className="bg-tv-surface border border-blue-200 dark:border-blue-900/60 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Latest MoM Growth</span>
            </div>
            <div className="text-xl font-bold text-tv-text-primary">{latestRec?.monthName || '—'}</div>
            <div className={`text-sm font-bold ${latestMoM != null ? (latestMoM >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500') : 'text-slate-400'}`}>
              {latestMoM != null ? `${latestMoM >= 0 ? '+' : ''}${latestMoM.toFixed(2)}%` : 'No prior month'}
            </div>
            <div className="text-xs text-tv-text-muted mt-0.5">Revenue: ₹{latestRec?.revenueLakh?.toFixed(2)} L</div>
          </div>
        </div>
      )}

      {/* ── Search ───────────────────────────────────────────────────── */}
      <div className="bg-tv-surface border border-tv-border rounded-2xl p-4 shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-tv-text-muted shrink-0" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Filter ledger by month or year (e.g., Oct 2025)…"
          className="w-full bg-transparent border-0 text-sm text-tv-text-primary placeholder-slate-400 focus:outline-none"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="text-xs text-tv-text-muted hover:text-tv-text-primary px-2">✕</button>
        )}
      </div>

      {/* ── Table / Analytics ────────────────────────────────────────── */}
      <div className="bg-tv-surface border border-tv-border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
            <p className="text-xs text-slate-500">Querying financial ledger…</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center space-y-2 text-rose-500">
            <AlertCircle className="w-8 h-8 mx-auto" />
            <p className="text-xs font-mono">{error}</p>
          </div>
        ) : activeTab === 'table' ? (
          /* ── LEDGER TABLE ── */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-tv-base/60 text-tv-text-secondary uppercase font-semibold text-[10px] tracking-wider border-b border-tv-border">
                <tr>
                  {[
                    { label: 'Period', field: 'periodDate', align: '' },
                    { label: 'Revenue (₹ L)', field: 'revenueLakh', align: 'text-right' },
                    { label: 'COGS (₹ L)', field: 'costOfGoodsSoldLakh', align: 'text-right' },
                    { label: 'Gross Profit (₹ L)', field: 'grossProfitLakh', align: 'text-right' },
                    { label: 'Net Profit (₹ L)', field: 'netProfitLakh', align: 'text-right' },
                    { label: 'Margin %', field: 'profitMarginPct', align: 'text-right' },
                    { label: 'Units Sold', field: 'unitsSold', align: 'text-right' },
                    { label: 'Avg Realisation', field: 'averageSellingPrice', align: 'text-right' },
                    { label: 'MoM Δ', field: '', align: 'text-right' },
                  ].map(col => (
                    <th
                      key={col.field}
                      onClick={() => col.field && toggleSort(col.field)}
                      className={`py-3.5 px-4 ${col.align} ${col.field ? 'cursor-pointer hover:text-slate-900 dark:hover:text-white' : ''} whitespace-nowrap`}
                    >
                      <div className={`flex items-center gap-1 ${col.align === 'text-right' ? 'justify-end' : ''}`}>
                        <span>{col.label}</span>
                        {col.field && <ArrowUpDown className="w-3 h-3 opacity-50" />}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(() => {
                  // Sort chronologically for MoM calculation
                  const chronFiltered = [...filtered].sort((a, b) => (a.periodDate < b.periodDate ? -1 : 1));
                  const isChronSort = sortField === 'periodDate' && sortAsc;
                  const displayRows = isChronSort ? chronFiltered : filtered;
                  return displayRows.map((r, idx) => {
                    const mom = getMoM(idx, isChronSort ? chronFiltered : displayRows);
                    const isLatest = r.id === sortedChron[sortedChron.length - 1]?.id;
                    return (
                      <tr
                        key={r.id || idx}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                          isLatest ? 'border-l-2 border-l-blue-500' : ''
                        } ${idx % 2 === 0 ? '' : 'bg-slate-50/30 dark:bg-slate-800/10'}`}
                      >
                        <td className="py-3 px-4 font-medium text-tv-text-primary whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {isLatest && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" title="Latest month" />}
                            {r.monthName}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-bold font-mono text-tv-text-primary">
                          {r.revenueLakh != null ? `₹${r.revenueLakh.toFixed(2)}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500">
                          {r.costOfGoodsSoldLakh != null ? `₹${r.costOfGoodsSoldLakh.toFixed(2)}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {r.grossProfitLakh != null ? `₹${r.grossProfitLakh.toFixed(2)}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-300">
                          {r.netProfitLakh != null ? `₹${r.netProfitLakh.toFixed(2)}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {r.profitMarginPct != null ? (
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${marginColor(r.profitMarginPct)}`}>
                              {r.profitMarginPct.toFixed(2)}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-300">
                          {r.unitsSold != null ? (
                            <span>{r.unitsSold.toLocaleString('en-IN')} <span className="text-tv-text-muted">{r.unitOfMeasure}</span></span>
                          ) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-300">
                          {r.averageSellingPrice != null ? `₹${r.averageSellingPrice.toFixed(2)}` : '—'}
                        </td>
                        <td className={`py-3 px-4 text-right font-mono font-semibold text-xs ${momColor(mom)}`}>
                          {mom != null ? (
                            <span className="flex items-center justify-end gap-0.5">
                              {mom > 0 ? <ChevronUp className="w-3 h-3" /> : mom < 0 ? <ChevronDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                              {Math.abs(mom).toFixed(2)}%
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>

              {/* Totals Footer */}
              {filtered.length > 0 && (
                <tfoot className="border-t-2 border-tv-border bg-tv-base/40 text-xs font-bold">
                  <tr>
                    <td className="py-3 px-4 text-tv-text-secondary uppercase tracking-wider text-[10px]">TOTAL / WEIGHTED</td>
                    <td className="py-3 px-4 text-right font-mono text-tv-text-primary">₹{totalRev.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-500">₹{totalCogs.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">
                      {totalProfit != null ? `₹${totalProfit.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-300">₹{totalNetProfit.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right">
                      {avgMargin != null && (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${marginColor(avgMargin)}`}>
                          {avgMargin.toFixed(2)}%
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-300">
                      {totalUnits != null ? totalUnits.toLocaleString('en-IN') : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-tv-text-muted">—</td>
                    <td className="py-3 px-4 text-right text-tv-text-muted">—</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : (
          /* ── ANALYTICS VIEW ── */
          <div className="p-6 space-y-6">
            <h2 className="text-sm font-bold text-tv-text-primary flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              Revenue & Margin Distribution — All Months
            </h2>

            <div className="space-y-2">
              {(() => {
                const sorted = [...filtered].sort((a, b) => (a.periodDate < b.periodDate ? -1 : 1));
                const maxRevForBar = Math.max(...sorted.map(r => r.revenueLakh || 0), 1);
                return sorted.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 group">
                    <span className="w-20 shrink-0 text-xs font-medium text-tv-text-secondary text-right">{r.monthName?.split(' ')[0]} {r.monthName?.split(' ')[1]}</span>
                    <div className="flex-1 relative h-7 bg-tv-base rounded-lg overflow-hidden">
                      {/* Revenue bar */}
                      <div
                        className="absolute left-0 top-0 h-full bg-blue-500/80 rounded-lg transition-all duration-500"
                        style={{ width: `${((r.revenueLakh || 0) / maxRevForBar) * 100}%` }}
                      />
                      {/* Profit bar overlay */}
                      {r.grossProfitLakh != null && (
                        <div
                          className="absolute left-0 top-0 h-full bg-emerald-500/60 rounded-lg transition-all duration-500"
                          style={{ width: `${((r.grossProfitLakh || 0) / maxRevForBar) * 100}%` }}
                        />
                      )}
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-white drop-shadow-sm">
                        ₹{r.revenueLakh?.toFixed(1)} L
                      </span>
                    </div>
                    <span className={`w-16 text-right text-xs font-bold shrink-0 ${marginColor(r.profitMarginPct || 0).split(' ').slice(2).join(' ')}`}>
                      {r.profitMarginPct != null ? `${r.profitMarginPct.toFixed(1)}%` : '—'}
                    </span>
                  </div>
                ));
              })()}
            </div>

            <div className="flex items-center gap-4 text-xs text-tv-text-secondary pt-2 border-t border-tv-border">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500/80 inline-block" />Revenue</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500/60 inline-block" />Gross Profit</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />&gt;20% margin</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />12–20%</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />&lt;12%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
