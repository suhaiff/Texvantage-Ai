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
    currentUser.companyId || ''
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
  const targetId = isAdmin ? (selectedCompId || companies[0]?.id || '') : (currentUser.companyId || companies[0]?.id || '');

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const comps = await apiClient.companies.list();
        setCompanies(comps);
        if (comps.length > 0 && !currentUser.companyId && !selectedCompId) {
          setSelectedCompId(comps[0].id);
        }
      } catch {}
    };
    fetchCompanies();
  }, [currentUser.id]);

  useEffect(() => {
    if (!targetId) return;
    const fetchLedger = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient.analytics.getFinancials(targetId);
        const normalized = (data || []).map((r: any) => ({
          ...r,
          id: r.id,
          companyId: r.company_id || r.companyId,
          year: r.year,
          month: r.month,
          monthName: r.month_name || r.monthName || `${r.month}/${r.year}`,
          periodDate: r.period_date || r.periodDate,
          revenueLakh: r.revenue_lakh != null ? Number(r.revenue_lakh) : (r.revenueLakh != null ? Number(r.revenueLakh) : 0),
          costOfGoodsSoldLakh: r.cogs_lakh != null ? Number(r.cogs_lakh) : (r.costOfGoodsSoldLakh != null ? Number(r.costOfGoodsSoldLakh) : null),
          grossProfitLakh: r.gross_profit_lakh != null ? Number(r.gross_profit_lakh) : (r.grossProfitLakh != null ? Number(r.grossProfitLakh) : null),
          profitMarginPct: r.profit_margin_pct != null ? Number(r.profit_margin_pct) : (r.profitMarginPct != null ? Number(r.profitMarginPct) : null),
          netProfitLakh: r.net_profit_lakh != null ? Number(r.net_profit_lakh) : (r.netProfitLakh != null ? Number(r.netProfitLakh) : null),
          operatingExpensesLakh: r.operating_expenses_lakh != null ? Number(r.operating_expenses_lakh) : (r.operatingExpensesLakh != null ? Number(r.operatingExpensesLakh) : null),
          unitsSold: r.units_sold != null ? Number(r.units_sold) : (r.unitsSold != null ? Number(r.unitsSold) : null),
          unitOfMeasure: r.unit_of_measure || r.unitOfMeasure || 'Pcs',
          averageSellingPrice: r.avg_order_value_inr != null ? Number(r.avg_order_value_inr) : (
            (r.revenue_lakh && r.units_sold) ? (Number(r.revenue_lakh) * 100000) / Number(r.units_sold) : null
          ),
          ordersCount: r.orders_count != null ? Number(r.orders_count) : null,
          capacityUtilizationPct: r.capacity_utilization_pct != null ? Number(r.capacity_utilization_pct) : null,
        }));
        setRecords(normalized);
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
    m > 20 ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/40'
    : m > 12 ? 'bg-amber-950/70 text-amber-400 border border-amber-800/40'
    : 'bg-rose-950/70 text-rose-400 border border-rose-800/40';

  const momColor = (v: number | null) =>
    v == null ? 'text-purple-300/40'
    : v > 0 ? 'text-emerald-400'
    : v < 0 ? 'text-rose-400'
    : 'text-purple-300/60';

  // Sparkline-like mini bars for margin column
  const maxRev = Math.max(...filtered.map(r => r.revenueLakh || 0), 1);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-in fade-in duration-300">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="bg-[#130C2E]/70 backdrop-blur-xl border border-purple-400/20 rounded-2xl p-6 shadow-[0_4px_25px_rgba(0,0,0,0.3)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-purple-950/60 border border-purple-400/30 text-[#A089E6] flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(160,137,230,0.2)]">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-white tracking-tight">Audited Financial Statements</h1>
                <span className="bg-emerald-950/70 text-emerald-400 border border-emerald-800/40 text-[10px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Shield className="w-3 h-3 text-emerald-400" />API Verified
                </span>
              </div>
              <p className="text-xs text-purple-200/70 mt-1">
                Audited General Ledger Statements · Grounded in Relational Database
                {targetCompany && <span className="ml-2 font-semibold text-white">· {targetCompany.name}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {isAdmin && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-purple-300/60">Enterprise:</span>
                <select
                  value={selectedCompId}
                  onChange={e => setSelectedCompId(e.target.value)}
                  className="bg-[#1A1238] border border-purple-400/25 text-xs rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                >
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Tab switcher */}
            <div className="flex items-center bg-[#0C071C]/80 border border-purple-400/20 rounded-xl p-1 gap-1">
              {(['table', 'summary'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize cursor-pointer ${
                    activeTab === t
                      ? 'bg-gradient-to-r from-purple-950/90 to-purple-900/60 shadow text-white border border-purple-400/35'
                      : 'text-purple-300/60 hover:text-white'
                  }`}
                >
                  {t === 'table' ? 'Ledger' : 'Analytics'}
                </button>
              ))}
            </div>

            <button
              onClick={handleExportCSV}
              disabled={loading || filtered.length === 0}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#A089E6] to-[#6D4AFF] hover:from-[#B8A4EE] hover:to-[#8155F5] disabled:opacity-40 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(109,74,255,0.35)] hover:scale-105 active:scale-95 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-white" /> : <Download className="w-4 h-4" />}
              <span>{copied ? 'Exported!' : 'Export CSV'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 6 KPI Summary Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {[
          {
            label: '12M Revenue',
            value: `₹${totalRev.toFixed(2)} L`,
            sub: `${filtered.length} months`,
            color: 'text-white'
          },
          {
            label: '12M Gross Profit',
            value: totalProfit != null ? `₹${totalProfit.toFixed(2)} L` : '—',
            sub: 'After COGS',
            color: 'text-emerald-400'
          },
          {
            label: 'Weighted Margin',
            value: avgMargin != null ? `${avgMargin.toFixed(2)}%` : '—',
            sub: 'Period avg',
            color: 'text-[#A089E6]'
          },
          {
            label: 'Total COGS',
            value: `₹${totalCogs.toFixed(2)} L`,
            sub: `${totalRev > 0 ? ((totalCogs / totalRev) * 100).toFixed(1) : '—'}% of revenue`,
            color: 'text-amber-400'
          },
          {
            label: 'Net Profit',
            value: `₹${totalNetProfit.toFixed(2)} L`,
            sub: 'After OpEx',
            color: totalNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
          },
          {
            label: 'Cumulative Units',
            value: totalUnits != null ? totalUnits.toLocaleString('en-IN') : '—',
            sub: records[0]?.unitOfMeasure || 'units',
            color: 'text-white'
          },
        ].map((kpi, i) => (
          <div key={i} className="bg-[#130C2E]/70 backdrop-blur-xl border border-purple-400/20 rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:border-purple-400/40 hover:shadow-[0_8px_30px_rgba(160,137,230,0.15)] transition-all duration-300">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-purple-300/60 mb-1">{kpi.label}</div>
            <div className={`text-base font-bold ${kpi.color} leading-tight tabular-nums`}>{kpi.value}</div>
            <div className="text-[10px] text-purple-300/50 mt-1">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Performance Highlights ───────────────────────────────────── */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Peak month */}
          <div className="bg-[#130C2E]/70 backdrop-blur-xl border border-emerald-500/25 rounded-2xl p-5 shadow-[0_4px_25px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Peak Revenue Month</span>
            </div>
            <div className="text-xl font-bold text-white">{peakMonth?.monthName || '—'}</div>
            <div className="text-sm text-emerald-400 font-semibold tabular-nums">₹{peakMonth?.revenueLakh?.toFixed(2)} L</div>
            <div className="text-xs text-purple-300/50 mt-0.5">Margin: {peakMonth?.profitMarginPct?.toFixed(2)}%</div>
          </div>

          {/* Trough month */}
          <div className="bg-[#130C2E]/70 backdrop-blur-xl border border-rose-500/25 rounded-2xl p-5 shadow-[0_4px_25px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Lowest Revenue Month</span>
            </div>
            <div className="text-xl font-bold text-white">{troughMonth?.monthName || '—'}</div>
            <div className="text-sm text-rose-400 font-semibold tabular-nums">₹{troughMonth?.revenueLakh?.toFixed(2)} L</div>
            <div className="text-xs text-purple-300/50 mt-0.5">Margin: {troughMonth?.profitMarginPct?.toFixed(2)}%</div>
          </div>

          {/* Latest MoM growth */}
          <div className="bg-[#130C2E]/70 backdrop-blur-xl border border-purple-400/25 rounded-2xl p-5 shadow-[0_4px_25px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-[#A089E6]" />
              <span className="text-xs font-semibold text-[#A089E6] uppercase tracking-wider">Latest MoM Growth</span>
            </div>
            <div className="text-xl font-bold text-white">{latestRec?.monthName || '—'}</div>
            <div className={`text-sm font-bold tabular-nums ${latestMoM != null ? (latestMoM >= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-purple-300/40'}`}>
              {latestMoM != null ? `${latestMoM >= 0 ? '+' : ''}${latestMoM.toFixed(2)}%` : 'No prior month'}
            </div>
            <div className="text-xs text-purple-300/50 mt-0.5">Revenue: ₹{latestRec?.revenueLakh?.toFixed(2)} L</div>
          </div>
        </div>
      )}

      {/* ── Search ───────────────────────────────────────────────────── */}
      <div className="bg-[#130C2E]/70 backdrop-blur-xl border border-purple-400/20 rounded-2xl p-4 shadow-[0_4px_25px_rgba(0,0,0,0.3)] flex items-center gap-3">
        <Search className="w-4 h-4 text-purple-300/50 shrink-0" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Filter ledger by month or year (e.g., Oct 2025)…"
          className="w-full bg-transparent border-0 text-sm text-white placeholder-purple-300/40 focus:outline-none"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="text-xs text-purple-300/50 hover:text-white px-2 cursor-pointer">✕</button>
        )}
      </div>

      {/* ── Table / Analytics ────────────────────────────────────────── */}
      <div className="bg-[#130C2E]/70 backdrop-blur-xl border border-purple-400/20 rounded-2xl shadow-[0_4px_25px_rgba(0,0,0,0.3)] overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-6 h-6 text-[#A089E6] animate-spin" />
            <p className="text-xs text-purple-300/60 font-mono">Querying financial ledger…</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center space-y-2 text-rose-400">
            <AlertCircle className="w-8 h-8 mx-auto" />
            <p className="text-xs font-mono">{error}</p>
          </div>
        ) : activeTab === 'table' ? (
          /* ── LEDGER TABLE ── */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0C071C]/80 text-purple-300/70 uppercase font-semibold text-[11px] tracking-wider border-b border-purple-400/20">
                <tr>
                  {[
                    { label: 'Period', field: 'periodDate', align: '' },
                    { label: 'Revenue (₹ L)', field: 'revenueLakh', align: 'text-right' },
                    { label: 'COGS (₹ L)', field: 'costOfGoodsSoldLakh', align: 'text-right' },
                    { label: 'Gross Profit (₹ L)', field: 'grossProfitLakh', align: 'text-right' },
                    { label: 'Net Profit (₹ L)', field: 'netProfitLakh', align: 'text-right' },
                    { label: 'Margin %', field: 'profitMarginPct', align: 'text-right' },
                    { label: 'Units Sold', field: 'unitsSold', align: 'text-right' },
                    { label: 'Avg Realization', field: 'averageSellingPrice', align: 'text-right' },
                    { label: 'MoM Δ', field: '', align: 'text-right' },
                  ].map(col => (
                    <th
                      key={col.field || col.label}
                      onClick={() => col.field && toggleSort(col.field)}
                      className={`py-3.5 px-4 ${col.align} ${col.field ? 'cursor-pointer hover:text-white' : ''} whitespace-nowrap`}
                    >
                      <div className={`flex items-center gap-1.5 ${col.align === 'text-right' ? 'justify-end' : ''}`}>
                        <span>{col.label}</span>
                        {col.field && <ArrowUpDown className="w-3 h-3 text-purple-400/50" />}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-500/10 text-purple-200/90">
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
                        className={`hover:bg-white/[0.04] transition-colors ${
                          isLatest ? 'border-l-2 border-l-[#A089E6] bg-purple-950/20' : ''
                        } ${idx % 2 === 0 ? '' : 'bg-white/[0.015]'}`}
                      >
                        <td className="py-3.5 px-4 font-medium text-white whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {isLatest && <span className="w-2 h-2 rounded-full bg-[#A089E6] shadow-[0_0_6px_#A089E6] inline-block" title="Latest month" />}
                            {r.monthName}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold font-mono text-white">
                          {r.revenueLakh != null ? `₹${r.revenueLakh.toFixed(2)}` : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-purple-300/60">
                          {r.costOfGoodsSoldLakh != null ? `₹${r.costOfGoodsSoldLakh.toFixed(2)}` : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-400">
                          {r.grossProfitLakh != null ? `₹${r.grossProfitLakh.toFixed(2)}` : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-purple-200/80">
                          {r.netProfitLakh != null ? `₹${r.netProfitLakh.toFixed(2)}` : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {r.profitMarginPct != null ? (
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${marginColor(r.profitMarginPct)}`}>
                              {r.profitMarginPct.toFixed(2)}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-purple-200/80">
                          {r.unitsSold != null ? (
                            <span>{r.unitsSold.toLocaleString('en-IN')} <span className="text-purple-400/50">{r.unitOfMeasure}</span></span>
                          ) : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-purple-200/80">
                          {r.averageSellingPrice != null ? `₹${r.averageSellingPrice.toFixed(2)}` : '—'}
                        </td>
                        <td className={`py-3.5 px-4 text-right font-mono font-semibold text-xs ${momColor(mom)}`}>
                          {mom != null ? (
                            <span className="flex items-center justify-end gap-0.5">
                              {mom > 0 ? <ChevronUp className="w-3.5 h-3.5" /> : mom < 0 ? <ChevronDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                              {Math.abs(mom).toFixed(2)}%
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  });
                })()}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-purple-300/50">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <FileSpreadsheet className="w-8 h-8 opacity-40 text-purple-400" />
                        <p className="text-xs font-medium">No financial ledger statements recorded for {targetCompany?.name || 'this enterprise'} in the current fiscal period.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Totals Footer */}
              {filtered.length > 0 && (
                <tfoot className="border-t-2 border-purple-400/25 bg-[#0C071C]/90 text-xs font-bold">
                  <tr>
                    <td className="py-3.5 px-4 text-purple-300/70 uppercase tracking-wider text-[10px]">TOTAL / WEIGHTED</td>
                    <td className="py-3.5 px-4 text-right font-mono text-white">₹{totalRev.toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-purple-300/60">₹{totalCogs.toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-400">
                      {totalProfit != null ? `₹${totalProfit.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-purple-200/80">₹{totalNetProfit.toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-right">
                      {avgMargin != null && (
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${marginColor(avgMargin)}`}>
                          {avgMargin.toFixed(2)}%
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-purple-200/80">
                      {totalUnits != null ? totalUnits.toLocaleString('en-IN') : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right text-purple-400/40">—</td>
                    <td className="py-3.5 px-4 text-right text-purple-400/40">—</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : (
          /* ── ANALYTICS VIEW ── */
          <div className="p-6 space-y-6">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#A089E6]" />
              <span>Revenue & Margin Distribution — All Months</span>
            </h2>

            <div className="space-y-3">
              {(() => {
                const sorted = [...filtered].sort((a, b) => (a.periodDate < b.periodDate ? -1 : 1));
                const maxRevForBar = Math.max(...sorted.map(r => r.revenueLakh || 0), 1);
                return sorted.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 group">
                    <span className="w-20 shrink-0 text-xs font-medium text-purple-300/70 text-right font-mono">{r.monthName?.split(' ')[0]} {r.monthName?.split(' ')[1]}</span>
                    <div className="flex-1 relative h-7 bg-[#0C071C]/80 rounded-xl overflow-hidden border border-white/[0.05]">
                      {/* Revenue bar */}
                      <div
                        className="absolute left-0 top-0 h-full bg-gradient-to-r from-[#8155F5] to-[#A089E6] rounded-xl transition-all duration-500 opacity-80"
                        style={{ width: `${((r.revenueLakh || 0) / maxRevForBar) * 100}%` }}
                      />
                      {/* Profit bar overlay */}
                      {r.grossProfitLakh != null && (
                        <div
                          className="absolute left-0 top-0 h-full bg-emerald-500/50 rounded-xl transition-all duration-500"
                          style={{ width: `${((r.grossProfitLakh || 0) / maxRevForBar) * 100}%` }}
                        />
                      )}
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-white drop-shadow-sm font-mono">
                        ₹{r.revenueLakh?.toFixed(1)} L
                      </span>
                    </div>
                    <span className="w-16 text-right text-xs font-bold shrink-0 text-emerald-400 font-mono">
                      {r.profitMarginPct != null ? `${r.profitMarginPct.toFixed(1)}%` : '—'}
                    </span>
                  </div>
                ));
              })()}
            </div>

            <div className="flex items-center gap-4 text-xs text-purple-300/70 pt-3 border-t border-purple-500/20">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gradient-to-r from-[#8155F5] to-[#A089E6] inline-block" />Revenue</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500/60 inline-block" />Gross Profit</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />&gt;20% margin</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />12–20%</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />&lt;12%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
