import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Search,
  ArrowUpDown,
  Check,
  FileText,
  Calendar,
  Filter,
  Shield,
  RefreshCw,
  AlertCircle
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

  const isAdmin = currentUser.role === 'ADMIN';
  const targetId = isAdmin ? selectedCompId : currentUser.companyId || 'comp_textile_a';

  // Load companies for Admin dropdown
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const comps = await apiClient.companies.list();
        setCompanies(comps);
      } catch {
        // Fallback
      }
    };
    fetchCompanies();
  }, [currentUser.id]);

  // Load Financial Ledger Records from Backend
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

  // Filter & Sort
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
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Period',
      'Revenue (₹ Lakh)',
      'COGS (₹ Lakh)',
      'Gross Profit (₹ Lakh)',
      'Profit Margin %',
      'Units Sold',
      'Unit of Measure',
      'Avg Realization / Unit (₹)'
    ];

    const rows = filtered.map(r => [
      `"${r.monthName}"`,
      r.revenueLakh,
      r.costOfGoodsSoldLakh,
      r.grossProfitLakh,
      r.profitMarginPct,
      r.unitsSold,
      `"${r.unitOfMeasure}"`,
      r.averageSellingPrice
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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

  // Totals calculated from loaded ledger subset
  const totalRev = filtered.reduce((acc, r) => acc + (r.revenueLakh || 0), 0);
  const hasGrossProfit = filtered.some(r => r.grossProfitLakh != null);
  const totalProfit = hasGrossProfit ? filtered.reduce((acc, r) => acc + (r.grossProfitLakh || 0), 0) : null;
  const avgMargin = (totalProfit != null && totalRev > 0) ? (totalProfit / totalRev) * 100 : null;
  const hasUnits = filtered.some(r => r.unitsSold != null);
  const totalUnits = hasUnits ? filtered.reduce((acc, r) => acc + (r.unitsSold || 0), 0) : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Bar */}
      <div className="bg-tv-surface border border-tv-border rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-tv-text-primary">
                  Audited Financial Statements Ledger
                </h1>
                <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  FastAPI Protected
                </span>
              </div>
              <p className="text-xs text-tv-text-secondary">
                12-Month Audited General Ledger Statements Grounded in Relational Database
              </p>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Admin Company Selector */}
            {isAdmin && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Enterprise:</span>
                <select
                  value={selectedCompId}
                  onChange={e => setSelectedCompId(e.target.value)}
                  className="bg-tv-base border border-slate-200 dark:border-slate-700 text-xs rounded-xl px-3 py-2 text-tv-text-primary focus:outline-none"
                >
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleExportCSV}
              disabled={loading || filtered.length === 0}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-tv-accent-hover disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Download className="w-4 h-4" />}
              <span>{copied ? 'Exported!' : 'Export CSV'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-tv-surface border border-tv-border rounded-xl p-3.5 shadow-sm">
          <div className="text-[11px] text-slate-500 font-medium">12-Month Revenue</div>
          <div className="text-base font-bold text-tv-text-primary mt-0.5">
            ₹{totalRev.toFixed(2)} Lakhs
          </div>
        </div>
        <div className="bg-tv-surface border border-tv-border rounded-xl p-3.5 shadow-sm">
          <div className="text-[11px] text-slate-500 font-medium">12-Month Gross Profit</div>
          <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
            {totalProfit != null ? `₹${totalProfit.toFixed(2)} Lakhs` : 'Not available'}
          </div>
        </div>
        <div className="bg-tv-surface border border-tv-border rounded-xl p-3.5 shadow-sm">
          <div className="text-[11px] text-slate-500 font-medium">Weighted Profit Margin</div>
          <div className="text-base font-bold text-blue-600 dark:text-blue-400 mt-0.5">
            {avgMargin != null ? `${avgMargin.toFixed(2)}%` : 'Not available'}
          </div>
        </div>
        <div className="bg-tv-surface border border-tv-border rounded-xl p-3.5 shadow-sm">
          <div className="text-[11px] text-slate-500 font-medium">Cumulative Units Sold</div>
          <div className="text-base font-bold text-tv-text-primary mt-0.5">
            {totalUnits != null ? `${totalUnits.toLocaleString()} ${records[0]?.unitOfMeasure || ''}` : 'Not available'}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-tv-surface border border-tv-border rounded-2xl p-4 shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-tv-text-muted" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Filter ledger by month or year (e.g., Oct 2025)..."
          className="w-full bg-transparent border-0 text-xs sm:text-sm text-tv-text-primary placeholder-slate-400 focus:outline-none"
        />
      </div>

      {/* Table Container */}
      <div className="bg-tv-surface border border-tv-border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
            <p className="text-xs text-slate-500">Querying FastAPI financial ledger...</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center space-y-2 text-rose-500">
            <AlertCircle className="w-8 h-8 mx-auto" />
            <p className="text-xs font-mono">{error}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-tv-base/60 text-tv-text-secondary uppercase font-semibold text-[10px] tracking-wider border-b border-tv-border">
                <tr>
                  <th
                    onClick={() => toggleSort('periodDate')}
                    className="py-3.5 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Period</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('revenueLakh')}
                    className="py-3.5 px-4 text-right cursor-pointer hover:text-slate-900 dark:hover:text-white"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Revenue (₹ Lakh)</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('costOfGoodsSoldLakh')}
                    className="py-3.5 px-4 text-right cursor-pointer hover:text-slate-900 dark:hover:text-white"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>COGS (₹ Lakh)</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('grossProfitLakh')}
                    className="py-3.5 px-4 text-right cursor-pointer hover:text-slate-900 dark:hover:text-white"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Gross Profit (₹ Lakh)</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('profitMarginPct')}
                    className="py-3.5 px-4 text-right cursor-pointer hover:text-slate-900 dark:hover:text-white"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Margin %</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('unitsSold')}
                    className="py-3.5 px-4 text-right cursor-pointer hover:text-slate-900 dark:hover:text-white"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Units Sold</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('averageSellingPrice')}
                    className="py-3.5 px-4 text-right cursor-pointer hover:text-slate-900 dark:hover:text-white"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Avg Realization / Unit</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((r, idx) => (
                  <tr
                    key={r.id || idx}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors font-mono"
                  >
                    <td className="py-3 px-4 font-sans font-medium text-tv-text-primary">
                      {r.monthName}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-tv-text-primary">
                      {r.revenueLakh != null ? `₹${r.revenueLakh.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500">
                      {r.costOfGoodsSoldLakh != null ? `₹${r.costOfGoodsSoldLakh.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                      {r.grossProfitLakh != null ? `₹${r.grossProfitLakh.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-blue-600 dark:text-blue-400">
                      {r.profitMarginPct != null ? `${r.profitMarginPct.toFixed(2)}%` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                      {r.unitsSold != null ? `${r.unitsSold.toLocaleString()} ${r.unitOfMeasure}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                      {r.averageSellingPrice != null ? `₹${r.averageSellingPrice.toFixed(2)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
