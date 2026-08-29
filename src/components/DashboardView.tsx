import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Clock,
  Layers,
  ArrowUpRight,
  Database,
  Building2,
  FileSpreadsheet,
  BarChart3,
  PieChart as PieIcon,
  Bot,
  CheckCircle2,
  Calendar,
  MapPin,
  Factory,
  Download,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { User } from '../types';
import { apiClient } from '../services/apiClient';

interface DashboardViewProps {
  currentUser: User;
  onOpenAIQuery: (query: string) => void;
  onNavigateTab?: (tab: 'ai' | 'dashboard' | 'ledger' | 'datasets' | 'benchmark' | 'governance') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  onOpenAIQuery,
  onNavigateTab
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Authoritative backend data
  const [summaryData, setSummaryData] = useState<any>(null);
  const [salesTrend, setSalesTrend] = useState<any>(null);
  const [profitTrend, setProfitTrend] = useState<any>(null);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [financials, setFinancials] = useState<any[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [schema, setSchema] = useState<any>(null);

  // Interactive chart hover states
  const [hoveredSalesIdx, setHoveredSalesIdx] = useState<number | null>(null);
  const [hoveredProfitIdx, setHoveredProfitIdx] = useState<number | null>(null);

  // Executive Report Export State
  const [exportingReport, setExportingReport] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const isGlobal = currentUser.role === 'ADMIN';

  const handleExportReport = async () => {
    if (exportingReport) return;
    setExportingReport(true);
    setExportError(null);

    try {
      if (isGlobal) {
        await apiClient.reports.downloadExcel({
          reportType: 'portfolio',
          periodMonths: 6,
          title: 'Executive Portfolio Command Report'
        });
      } else {
        await apiClient.reports.downloadExcel({
          reportType: 'executive',
          companyId: currentUser.companyId || undefined,
          periodMonths: 12,
          title: `Executive Financial Report — ${summaryData?.company_name || currentUser.companyName || 'Enterprise'}`
        });
      }

      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.85 }
      });

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3500);
    } catch (err: any) {
      setExportError('Unable to generate the report. Please try again.');
      setTimeout(() => setExportError(null), 4000);
    } finally {
      setExportingReport(false);
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      const schemaRes = await apiClient.analytics.getSchema().catch(() => null);
      setSchema(schemaRes);

      if (isGlobal) {
        const [globalRes, dsRes] = await Promise.all([
          apiClient.analytics.getGlobalSummary(6),
          apiClient.datasets.list()
        ]);
        setSummaryData(globalRes);
        setDatasets(dsRes || []);
      } else {
        const [sumRes, trRes, prTrendRes, prRes, finRes, dsRes] = await Promise.all([
          apiClient.analytics.getSummary(currentUser.companyId || undefined),
          apiClient.analytics.getSalesTrend(currentUser.companyId || undefined, 6),
          apiClient.analytics.getProfitTrend(currentUser.companyId || undefined, 6),
          apiClient.analytics.getTopProducts(currentUser.companyId || undefined, 5),
          apiClient.analytics.getFinancials(currentUser.companyId || undefined),
          apiClient.datasets.list(currentUser.companyId || undefined)
        ]);

        setSummaryData(sumRes);
        setSalesTrend(trRes);
        setProfitTrend(prTrendRes);
        setTopProducts(prRes || []);
        setFinancials(finRes || []);
        setDatasets(dsRes || []);
      }
    } catch (err: any) {
      setError('Unable to load your business summary. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [currentUser.id, currentUser.role, currentUser.companyId]);

  // Dynamic greeting based on current time
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const firstName = currentUser.name ? currentUser.name.split(' ')[0] : 'Owner';
    if (hour < 12) return `Good morning, ${firstName}`;
    if (hour < 17) return `Good afternoon, ${firstName}`;
    return `Good evening, ${firstName}`;
  }, [currentUser.name]);

  // Reliable timestamp of latest data update
  const lastUpdatedFormatted = useMemo(() => {
    if (datasets && datasets.length > 0) {
      const dates = datasets
        .map(d => (d.uploaded_at ? new Date(d.uploaded_at).getTime() : 0))
        .filter(t => t > 0);
      if (dates.length > 0) {
        const maxTime = Math.max(...dates);
        return new Intl.DateTimeFormat('en-IN', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }).format(new Date(maxTime));
      }
    }
    if (financials && financials.length > 0) {
      const latest = financials[financials.length - 1];
      return latest.month_name || null;
    }
    return null;
  }, [datasets, financials]);

  // Latest and previous monthly financial records
  const latestFinancialRecord = useMemo(() => {
    if (!financials || financials.length === 0) return null;
    return financials[financials.length - 1];
  }, [financials]);

  const prevFinancialRecord = useMemo(() => {
    if (!financials || financials.length < 2) return null;
    return financials[financials.length - 2];
  }, [financials]);

  // Data coverage calculation
  const dataCoverage = useMemo(() => {
    if (!financials || financials.length === 0) {
      return {
        dateRange: datasets.length > 0 ? 'Uploaded datasets pending' : 'No data uploaded',
        datasetCount: datasets.length,
        totalRecords: datasets.reduce((acc, d) => acc + (d.record_count || 0), 0)
      };
    }
    const start = financials[0].month_name;
    const end = financials[financials.length - 1].month_name;
    const dateRange = start === end ? start : `${start} – ${end}`;
    const totalRecords =
      datasets.length > 0
        ? datasets.reduce((acc, d) => acc + (d.record_count || 0), 0)
        : financials.length;

    return {
      dateRange,
      datasetCount: datasets.length,
      totalRecords
    };
  }, [financials, datasets]);

  // Loading Skeleton State
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded mb-3" />
          <div className="h-8 w-72 bg-slate-200 dark:bg-slate-800 rounded mb-2" />
          <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>

        {/* 4 KPI Skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded mb-3" />
              <div className="h-7 w-28 bg-slate-200 dark:bg-slate-800 rounded mb-2" />
              <div className="h-3 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          ))}
        </div>

        {/* Charts & Profitability Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 h-80" />
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 h-80" />
        </div>

        {/* Tables & Recent Datasets Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 h-64" />
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 h-64" />
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center border border-rose-200 dark:border-rose-900/60">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Unable to Load Business Summary</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">{error}</p>
        <button
          onClick={loadDashboardData}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  // Empty State (Owner with no uploaded data)
  const hasNoData =
    !isGlobal &&
    (!financials || financials.length === 0) &&
    (!datasets || datasets.length === 0) &&
    (!summaryData || summaryData.period_months === 0);

  if (hasNoData) {
    if (schema && schema.tables && schema.tables.length > 0) {
      return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Executive Overview
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {greeting}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {summaryData?.company_name || currentUser.companyName || 'Enterprise'}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-500" />
                Connected to Production Database
              </h2>
              <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-xs font-semibold">
                Live Schema Active
              </span>
            </div>
            
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-3xl">
              We've automatically detected the following tables in your database. 
              Upload a <b>Business Knowledge</b> document (PDF or Text) in the Knowledge & Datasets tab to teach the AI how to interpret these tables, so you can start querying your metrics immediately.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {schema.tables.map((table: any, idx: number) => (
                <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 transition-all hover:shadow-md">
                  <h3 className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2 mb-3">
                    <Layers className="w-4 h-4 text-blue-500" />
                    {table.name}
                  </h3>
                  <div className="max-h-40 overflow-y-auto no-scrollbar space-y-2 pr-2">
                    {table.columns.map((col: any, cIdx: number) => (
                      <div key={cIdx} className="flex justify-between text-xs">
                        <span className="font-mono text-slate-700 dark:text-slate-300 truncate mr-2" title={col.name}>
                          {col.name}
                        </span>
                        <span className="text-slate-500 dark:text-slate-500 shrink-0">
                          {col.type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => (onNavigateTab ? onNavigateTab('datasets') : null)}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-sm transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>Teach AI via Knowledge Upload</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Executive Overview
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {greeting}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {summaryData?.company_name || currentUser.companyName || 'Enterprise'}
          </p>
        </div>

        {/* Empty State Banner */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center border border-blue-200 dark:border-blue-900/60">
            <Database className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">No business data uploaded yet.</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Upload your first dataset to start analyzing your business performance, margins, and sales trends.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => (onNavigateTab ? onNavigateTab('datasets') : null)}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Upload Data</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // GLOBAL PORTFOLIO VIEW (ADMIN ONLY)
  // ==========================================
  if (isGlobal) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
              Global Portfolio Command Center
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {greeting}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              10-Enterprise Aggregated Portfolio Analytics across India
            </p>
          </div>
          <button
            onClick={() => onOpenAIQuery('Summarize full portfolio revenue and margin performance across all 10 mills')}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all self-start md:self-auto"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Consult Portfolio Advisor</span>
          </button>
        </div>

        {/* Global KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Portfolio Revenue</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {summaryData?.total_portfolio_revenue_lakh != null
                ? `₹${summaryData.total_portfolio_revenue_lakh.toLocaleString('en-IN')}L`
                : 'Not available'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">6-Month Aggregate (10 Mills)</div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Weighted Gross Margin</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {summaryData?.portfolio_average_margin_pct != null
                ? `${summaryData.portfolio_average_margin_pct}%`
                : 'Not available'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              {summaryData?.total_portfolio_gross_profit_lakh != null
                ? `₹${summaryData.total_portfolio_gross_profit_lakh}L Total Gross Profit`
                : 'Gross Profit'}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Top Revenue Contributor</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {summaryData?.top_performing_company?.code || 'Not available'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 truncate">
              {summaryData?.top_performing_company?.name || 'Top contributor'}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Highest Margin Mill</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {summaryData?.highest_margin_company?.weighted_profit_margin_pct != null
                ? `${summaryData.highest_margin_company.weighted_profit_margin_pct}%`
                : 'Not available'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 truncate">
              {summaryData?.highest_margin_company?.name || 'Artisanal Silk & Jacquard'}
            </div>
          </div>
        </div>

        {/* Global Ranking Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Executive Enterprise Portfolio Ranking
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {summaryData?.companies?.length || 0} Enterprises Active
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Specialization</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3 text-right">6M Revenue</th>
                  <th className="px-4 py-3 text-right">Gross Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {(summaryData?.companies || []).map((comp: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{comp.name}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{comp.code}</td>
                    <td className="px-4 py-3">{comp.specialization}</td>
                    <td className="px-4 py-3 text-slate-500">{comp.city}</td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      {comp.total_revenue_lakh != null ? `₹${comp.total_revenue_lakh}L` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {comp.weighted_profit_margin_pct != null ? `${comp.weighted_profit_margin_pct}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // EXECUTIVE OWNER DASHBOARD (PHASE 5B)
  // ==========================================

  // Revenue metrics
  const revenueValue =
    summaryData?.latest_monthly_revenue_lakh != null
      ? `₹${Number(summaryData.latest_monthly_revenue_lakh).toFixed(2)}L`
      : 'Not available';

  const revenuePeriod = summaryData?.latest_month || 'Latest Month';

  const revenueGrowthPct = summaryData?.mom_revenue_growth_pct;
  const hasRevenueGrowth = revenueGrowthPct != null;
  const prevMonthName = prevFinancialRecord?.month_name?.split(' ')[0];

  // Gross Margin metrics
  const marginValue =
    summaryData?.latest_profit_margin_pct != null
      ? `${Number(summaryData.latest_profit_margin_pct).toFixed(2)}%`
      : 'Not available';

  const avgMargin = summaryData?.annual_aggregate?.average_profit_margin_pct;
  const marginDiffVsAvg =
    summaryData?.latest_profit_margin_pct != null && avgMargin != null
      ? (summaryData.latest_profit_margin_pct - avgMargin).toFixed(2)
      : null;

  // Units Sold metrics
  const unitsValue =
    summaryData?.latest_units_sold != null
      ? summaryData.latest_units_sold.toLocaleString('en-IN')
      : 'Not available';

  // MoM Growth metrics
  const momGrowthValue = hasRevenueGrowth
    ? `${revenueGrowthPct >= 0 ? '+' : ''}${revenueGrowthPct.toFixed(2)}%`
    : 'Not available';

  // Sales Trend points for SVG Area Chart
  const salesSeries: any[] = salesTrend?.series || [];
  const maxSalesRev = Math.max(10, ...salesSeries.map(s => Number(s.revenue_lakh) || 0));

  // Profit Trend points
  const profitSeries: any[] = profitTrend?.series || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 2. REFINED PAGE HEADER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {greeting}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-slate-200">
              {summaryData?.company_name || currentUser.companyName || currentUser.companyId}
            </span>
            <span>·</span>
            <span>{summaryData?.latest_month || summaryData?.specialization || 'Executive Overview'}</span>
            {lastUpdatedFormatted && (
              <>
                <span className="text-slate-400 dark:text-slate-600">·</span>
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400 inline" />
                  Last updated {lastUpdatedFormatted}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Operational Context Badges & Export Action */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {summaryData?.city && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-medium">
              <MapPin className="w-3.5 h-3.5 text-blue-500" />
              <span>
                {summaryData.city}, {summaryData.state}
              </span>
            </div>
          )}
          {summaryData?.capacity_description && (
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-medium truncate max-w-xs">
              <Factory className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              <span className="truncate">{summaryData.capacity_description}</span>
            </div>
          )}

          <button
            onClick={handleExportReport}
            disabled={exportingReport}
            title="Download authoritative 5-sheet Excel executive report"
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-all ${
              exportSuccess
                ? 'bg-emerald-600 text-white'
                : exportingReport
                ? 'bg-blue-400 text-white cursor-wait'
                : 'bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60'
            }`}
          >
            {exportingReport ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Exporting...</span>
              </>
            ) : exportSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Report Ready</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Export Executive Report</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. FOUR PRIMARY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Revenue */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            <span>Revenue</span>
            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] font-medium text-slate-600 dark:text-slate-300">
              {revenuePeriod}
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
            {revenueValue}
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 text-xs">
            {hasRevenueGrowth ? (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium ${
                  revenueGrowthPct > 0
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                    : revenueGrowthPct < 0
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {revenueGrowthPct > 0 && <TrendingUp className="w-3.5 h-3.5 mr-1 inline" />}
                {revenueGrowthPct < 0 && <TrendingDown className="w-3.5 h-3.5 mr-1 inline" />}
                {revenueGrowthPct === 0 && <Minus className="w-3.5 h-3.5 mr-1 inline" />}
                {revenueGrowthPct >= 0 ? '+' : ''}
                {revenueGrowthPct.toFixed(2)}% vs {prevMonthName || 'July'}
              </span>
            ) : (
              <span className="text-slate-400 dark:text-slate-500">Period baseline</span>
            )}
          </div>
        </div>

        {/* KPI 2: Gross Margin */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            <span>Gross Margin</span>
            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] font-medium text-slate-600 dark:text-slate-300">
              {revenuePeriod}
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
            {marginValue}
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 text-xs">
            {marginDiffVsAvg != null ? (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium ${
                  Number(marginDiffVsAvg) >= 0
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                }`}
              >
                {Number(marginDiffVsAvg) >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 mr-1 inline" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 mr-1 inline" />
                )}
                {Number(marginDiffVsAvg) >= 0 ? '+' : ''}
                {marginDiffVsAvg} pts vs avg
              </span>
            ) : (
              <span className="text-slate-400 dark:text-slate-500">Gross profit realization</span>
            )}
          </div>
        </div>

        {/* KPI 3: Units Sold */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            <span>Units Sold</span>
            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] font-medium text-slate-600 dark:text-slate-300">
              {revenuePeriod}
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
            {unitsValue}
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 text-xs text-slate-500 dark:text-slate-400">
            {summaryData?.annual_aggregate?.total_units_sold != null ? (
              <span>
                {summaryData.annual_aggregate.total_units_sold.toLocaleString('en-IN')} total volume
              </span>
            ) : (
              <span>Monthly volume output</span>
            )}
          </div>
        </div>

        {/* KPI 4: MoM Growth */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            <span>MoM Growth</span>
            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] font-medium text-slate-600 dark:text-slate-300">
              MoM
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
            {momGrowthValue}
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 text-xs">
            {hasRevenueGrowth ? (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium ${
                  revenueGrowthPct >= 0
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                }`}
              >
                {revenueGrowthPct >= 0 ? '+' : ''}
                {revenueGrowthPct.toFixed(2)}%
              </span>
            ) : (
              <span className="text-slate-400 dark:text-slate-500">Revenue trajectory</span>
            )}
          </div>
        </div>
      </div>

      {/* 4. REVENUE TREND & 5. PROFITABILITY SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* REVENUE TREND (2 Cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Revenue Performance Trend
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Monthly sales trajectory from verified ledger records
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-600" />
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Revenue (₹ Lakh)</span>
                </div>
              </div>
            </div>

            {/* Responsive Chart */}
            {salesSeries.length > 0 ? (
              <div className="w-full">
                <svg viewBox="0 0 580 200" className="w-full h-48 select-none">
                  <defs>
                    <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                    const y = 20 + 140 * (1 - pct);
                    const labelVal = Math.round(maxSalesRev * pct);
                    return (
                      <g key={i}>
                        <line
                          x1={45}
                          y1={y}
                          x2={560}
                          y2={y}
                          stroke="currentColor"
                          className="text-slate-100 dark:text-slate-800"
                          strokeDasharray={i > 0 && i < 4 ? '3 3' : undefined}
                        />
                        <text
                          x={38}
                          y={y + 3}
                          textAnchor="end"
                          className="text-[10px] fill-slate-400 font-mono"
                        >
                          ₹{labelVal}L
                        </text>
                      </g>
                    );
                  })}

                  {/* Area fill */}
                  {(() => {
                    const step = 515 / Math.max(1, salesSeries.length - 1 || 1);
                    const pts = salesSeries.map((s, idx) => {
                      const val = Number(s.revenue_lakh) || 0;
                      const x = 45 + idx * step;
                      const y = 20 + 140 * (1 - (maxSalesRev > 0 ? val / maxSalesRev : 0));
                      return `${x},${y}`;
                    });

                    const areaPath = `M 45,160 L ${pts.join(' L ')} L ${45 + (salesSeries.length - 1) * step},160 Z`;
                    const linePath = `M ${pts.join(' L ')}`;

                    return (
                      <g>
                        <path d={areaPath} fill="url(#revGradient)" />
                        <path
                          d={linePath}
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {salesSeries.map((s, idx) => {
                          const val = Number(s.revenue_lakh) || 0;
                          const x = 45 + idx * step;
                          const y = 20 + 140 * (1 - (maxSalesRev > 0 ? val / maxSalesRev : 0));
                          const isHovered = hoveredSalesIdx === idx;

                          return (
                            <g
                              key={idx}
                              onMouseEnter={() => setHoveredSalesIdx(idx)}
                              onMouseLeave={() => setHoveredSalesIdx(null)}
                              className="cursor-pointer"
                            >
                              <circle
                                cx={x}
                                cy={y}
                                r={isHovered ? 5.5 : 3.5}
                                fill="#3b82f6"
                                stroke="#ffffff"
                                strokeWidth="2"
                                className="transition-all"
                              />
                            </g>
                          );
                        })}
                      </g>
                    );
                  })()}

                  {/* X Axis Labels */}
                  {salesSeries.map((s, idx) => {
                    const step = 515 / Math.max(1, salesSeries.length - 1 || 1);
                    const x = 45 + idx * step;
                    const label = (s.month || '').split(' ')[0];
                    const isHovered = hoveredSalesIdx === idx;

                    return (
                      <text
                        key={idx}
                        x={x}
                        y={180}
                        textAnchor="middle"
                        className={`text-[10px] transition-colors ${
                          isHovered
                            ? 'fill-blue-600 dark:fill-blue-400 font-bold'
                            : 'fill-slate-500 dark:fill-slate-400 font-medium'
                        }`}
                      >
                        {label}
                      </text>
                    );
                  })}
                </svg>

                {/* Interactive Tooltip Card */}
                {hoveredSalesIdx !== null && salesSeries[hoveredSalesIdx] && (
                  <div className="mt-2 bg-slate-50 dark:bg-slate-800/80 rounded-lg px-3 py-2 text-xs flex items-center justify-between border border-slate-200 dark:border-slate-700/60">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {salesSeries[hoveredSalesIdx].month}
                    </span>
                    <div className="flex items-center gap-4">
                      <span className="text-slate-600 dark:text-slate-300">
                        Revenue:{' '}
                        <strong className="text-slate-900 dark:text-white">
                          ₹{salesSeries[hoveredSalesIdx].revenue_lakh}L
                        </strong>
                      </span>
                      {salesSeries[hoveredSalesIdx].units_sold != null && (
                        <span className="text-slate-600 dark:text-slate-300">
                          Units:{' '}
                          <strong className="text-slate-900 dark:text-white">
                            {salesSeries[hoveredSalesIdx].units_sold.toLocaleString()}
                          </strong>
                        </span>
                      )}
                      {salesSeries[hoveredSalesIdx].growth_pct != null && (
                        <span
                          className={`font-semibold ${
                            salesSeries[hoveredSalesIdx].growth_pct >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {salesSeries[hoveredSalesIdx].growth_pct >= 0 ? '+' : ''}
                          {salesSeries[hoveredSalesIdx].growth_pct}% MoM
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                No revenue trend data available.
              </div>
            )}
          </div>
        </div>

        {/* 5. PROFITABILITY SECTION (1 Col) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Profitability Breakdown
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Margin economics for {revenuePeriod}
            </p>
          </div>

          <div className="space-y-3">
            {/* Gross Profit */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Gross Profit
              </div>
              <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                {latestFinancialRecord?.gross_profit_lakh != null
                  ? `₹${Number(latestFinancialRecord.gross_profit_lakh).toFixed(2)}L`
                  : 'Not available from uploaded data'}
              </div>
              {latestFinancialRecord?.cogs_lakh != null && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  COGS: ₹{Number(latestFinancialRecord.cogs_lakh).toFixed(2)}L
                </div>
              )}
            </div>

            {/* Gross Margin */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Gross Margin
              </div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {latestFinancialRecord?.profit_margin_pct != null
                  ? `${Number(latestFinancialRecord.profit_margin_pct).toFixed(2)}%`
                  : 'Not available from uploaded data'}
              </div>
              {avgMargin != null && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Weighted Average: {avgMargin}%
                </div>
              )}
            </div>

            {/* Net Profit */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Net Profit
              </div>
              <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                {latestFinancialRecord?.net_profit_lakh != null
                  ? `₹${Number(latestFinancialRecord.net_profit_lakh).toFixed(2)}L`
                  : 'Not available from uploaded data'}
              </div>
              {latestFinancialRecord?.operating_expenses_lakh != null ? (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  OpEx: ₹{Number(latestFinancialRecord.operating_expenses_lakh).toFixed(2)}L
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  OpEx not specified in source data
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 6. PRODUCT PERFORMANCE & 7. AI INSIGHT / DATA COVERAGE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PRODUCT PERFORMANCE (2 Cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Product Performance
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Revenue contribution and margin ranking by product category
              </p>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {topProducts.length} categories
            </span>
          </div>

          {topProducts.length > 0 ? (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Product / Category</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                    <th className="px-4 py-3 text-right">Margin</th>
                    <th className="px-4 py-3 text-right">Units</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {topProducts.map((prod, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="truncate">{prod.category_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-slate-900 dark:text-white">
                        {prod.total_revenue_lakh != null ? `₹${prod.total_revenue_lakh}L` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {prod.avg_margin_pct != null ? `${prod.avg_margin_pct}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-500 dark:text-slate-400">
                        {prod.total_volume_units != null
                          ? `${prod.total_volume_units.toLocaleString()} ${prod.unit_of_measure || ''}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
              No product-level data uploaded yet.
            </div>
          )}
        </div>

        {/* 7. AI BUSINESS INSIGHT & 8. DATA COVERAGE (1 Col) */}
        <div className="space-y-6">
          {/* AI Executive Insight Card */}
          <div className="bg-gradient-to-br from-slate-900 to-blue-950 rounded-xl p-5 text-white border border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
              <Bot className="w-4 h-4 text-blue-400" />
              <span>AI Business Insight</span>
            </div>
            <p className="text-sm font-medium text-slate-200 leading-relaxed">
              Ask your AI Advisor to analyze this performance.
            </p>
            <p className="text-xs text-slate-400">
              Get an instant strategic briefing on product profitability, volume trends, and margin optimization opportunities.
            </p>
            <div className="pt-1">
              <button
                onClick={() =>
                  onOpenAIQuery(
                    `Analyze current business performance and margins for ${
                      summaryData?.company_name || currentUser.companyName
                    }`
                  )
                }
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow transition-all hover:scale-[1.02]"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Analyze with AI</span>
              </button>
            </div>
          </div>

          {/* 8. DATA COVERAGE CARD */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Data Coverage
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Period Covered</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {dataCoverage.dateRange}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Uploaded Datasets</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                  {dataCoverage.datasetCount}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Audited Records</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                  {dataCoverage.totalRecords.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 9. RECENT DATASETS SECTION */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Recent Datasets
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Uploaded source data files for {summaryData?.company_name || currentUser.companyName}
            </p>
          </div>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('datasets')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>Manage Datasets</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {datasets.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {datasets.slice(0, 4).map((d: any, idx: number) => {
              const uploadDateStr = d.uploaded_at
                ? new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric' }).format(
                    new Date(d.uploaded_at)
                  )
                : 'Recent';

              return (
                <div
                  key={idx}
                  className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">
                        {d.original_filename || d.dataset_name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {d.record_count != null ? `${d.record_count.toLocaleString()} records` : ''} ·
                        Imported {uploadDateStr}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                        d.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : d.status === 'PROCESSING'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
            No datasets uploaded yet.
          </div>
        )}
      </div>

      {/* 10. PRIMARY AI CTA */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            <Bot className="w-4 h-4" />
            <span>Ask your AI Advisor</span>
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Analyze sales, margins, products and business performance.
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Inquire in natural language with verified data grounding and automatic executive artifacts.
          </p>
        </div>

        <button
          onClick={() =>
            onOpenAIQuery(
              `Provide an executive business performance analysis for ${
                summaryData?.company_name || currentUser.companyName
              }.`
            )
          }
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-5 py-3 rounded-xl shadow-sm transition-all self-start sm:self-auto hover:scale-[1.02]"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>Open AI Advisor</span>
        </button>
      </div>
    </div>
  );
};
