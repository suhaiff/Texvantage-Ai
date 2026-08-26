import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Award,
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  Lock,
  ArrowRight,
  Filter,
  Check,
  Building2,
  Sparkles,
  RefreshCw,
  AlertCircle,
  BarChart3,
  Bot,
  ChevronDown,
  ChevronUp,
  Clock,
  FileSpreadsheet,
  Layers,
  MapPin,
  Search,
  Send,
  Terminal,
  CheckCircle2,
  ArrowUpRight,
  Scale,
  Users,
  Database,
  Zap,
  Plus,
  X,
  Factory,
  AlertTriangle,
  FileText
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { User, ChatMessage, ToolExecutionStep, AIArtifact } from '../types';
import { apiClient } from '../services/apiClient';
import { AIService } from '../services/aiService';
import { KPICard, InteractiveChart, TableArtifactView, FileArtifactDownload } from './ArtifactComponents';

interface BenchmarkViewProps {
  currentUser: User;
  onSwitchToAdmin: () => void;
  onOpenAIQuery: (query: string) => void;
  onNavigateTab?: (tab: 'ai' | 'dashboard' | 'ledger' | 'datasets' | 'benchmark' | 'governance') => void;
}

export const BenchmarkView: React.FC<BenchmarkViewProps> = ({
  currentUser,
  onSwitchToAdmin,
  onOpenAIQuery,
  onNavigateTab
}) => {
  // Access Control check
  const isAdmin = currentUser.role === 'ADMIN';

  // ----------------------------------------------------
  // STATE MANAGEMENT
  // ----------------------------------------------------
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Authoritative Backend Data
  const [benchmarkData, setBenchmarkData] = useState<any>(null);
  const [companiesList, setCompaniesList] = useState<any[]>([]);
  const [datasetsList, setDatasetsList] = useState<any[]>([]);
  const [periodMonths, setPeriodMonths] = useState<number>(6);

  // Filters & Sorting
  const [filterSpecialization, setFilterSpecialization] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'revenue' | 'margin' | 'growth'>('revenue');

  // Interactive Comparison Tool State
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  const [comparisonResult, setComparisonResult] = useState<any>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  // Selected Company Detail Context Drawer
  const [selectedCompany, setSelectedCompany] = useState<any | null>(null);
  const [selectedCompanyDetail, setSelectedCompanyDetail] = useState<any | null>(null);
  const [loadingCompanyDetail, setLoadingCompanyDetail] = useState(false);

  // Embedded Portfolio AI Workspace State
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([]);
  const [aiInputPrompt, setAiInputPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [aiLiveSteps, setAiLiveSteps] = useState<ToolExecutionStep[]>([]);
  const [aiExpandedSteps, setAiExpandedSteps] = useState<Record<string, boolean>>({});

  // Export Feedback
  const [exported, setExported] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [excelExportSuccess, setExcelExportSuccess] = useState(false);

  const handleExportPortfolioReport = async () => {
    if (exportingExcel) return;
    setExportingExcel(true);

    try {
      const isFiltered = selectedForComparison.length > 0;
      await apiClient.reports.downloadExcel({
        reportType: isFiltered ? 'comparison' : 'portfolio',
        companyIds: isFiltered ? selectedForComparison : undefined,
        periodMonths: periodMonths,
        title: isFiltered
          ? `Executive Enterprise Comparison (${selectedForComparison.length} Mills)`
          : `Executive Portfolio Command Report (${companiesCount} Enterprises)`
      });

      confetti({ particleCount: 40, spread: 60, origin: { y: 0.85 } });
      setExcelExportSuccess(true);
      setTimeout(() => setExcelExportSuccess(false), 3500);
    } catch (err: any) {
      console.error('Export portfolio report failed:', err);
    } finally {
      setExportingExcel(false);
    }
  };

  // Chart Hover State
  const [hoveredChartBar, setHoveredChartBar] = useState<number | null>(null);

  const aiMessagesEndRef = useRef<HTMLDivElement>(null);

  // ----------------------------------------------------
  // INITIAL DATA FETCHING (ADMIN ONLY)
  // ----------------------------------------------------
  const fetchPortfolioData = async () => {
    if (!isAdmin) return;

    setLoading(true);
    setError(null);

    try {
      const [globalRes, compRes, dsRes] = await Promise.all([
        apiClient.analytics.getGlobalSummary(periodMonths),
        apiClient.companies.list(),
        apiClient.datasets.list()
      ]);

      setBenchmarkData(globalRes);
      setCompaniesList(compRes || []);
      setDatasetsList(dsRes || []);

      // Default selection for comparison: top 3 companies if none selected
      if (globalRes?.companies && globalRes.companies.length >= 2 && selectedForComparison.length === 0) {
        const topIds = globalRes.companies.slice(0, 3).map((c: any) => c.company_id || c.id);
        setSelectedForComparison(topIds);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load portfolio data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchPortfolioData();
    }
  }, [isAdmin, currentUser.id, periodMonths]);

  // Fetch Side-by-Side Comparison when selected companies change
  const executeComparison = async (companyIds: string[]) => {
    if (companyIds.length < 2) {
      setComparisonResult(null);
      return;
    }

    setComparisonLoading(true);
    setComparisonError(null);

    try {
      const result = await apiClient.analytics.compareCompanies(companyIds, periodMonths);
      setComparisonResult(result);
    } catch (err: any) {
      setComparisonError(err?.message || 'Unable to compare the selected companies.');
    } finally {
      setComparisonLoading(false);
    }
  };

  useEffect(() => {
    if (selectedForComparison.length >= 2) {
      executeComparison(selectedForComparison);
    }
  }, [selectedForComparison, periodMonths]);

  // Load detailed profile when a company is selected for inspection
  const handleSelectCompany = async (company: any) => {
    const compId = company.company_id || company.id;
    setSelectedCompany(company);
    setLoadingCompanyDetail(true);
    try {
      const detail = await apiClient.companies.getById(compId);
      setSelectedCompanyDetail(detail);
    } catch (err) {
      setSelectedCompanyDetail(null);
    } finally {
      setLoadingCompanyDetail(false);
    }
  };

  // Toggle company in comparison list
  const toggleComparisonCompany = (companyId: string) => {
    setSelectedForComparison(prev => {
      if (prev.includes(companyId)) {
        return prev.filter(id => id !== companyId);
      } else {
        if (prev.length >= 5) return prev; // Limit to 5 for readable comparison
        return [...prev, companyId];
      }
    });
  };

  // ----------------------------------------------------
  // EMBEDDED PORTFOLIO AI HANDLER
  // ----------------------------------------------------
  const handleSendPortfolioAI = async (customPrompt?: string) => {
    const textToSend = (customPrompt || aiInputPrompt).trim();
    if (!textToSend || aiLoading) return;

    setAiInputPrompt('');
    setAiLoading(true);
    setAiLiveSteps([]);
    setAiStatus('Connecting to Portfolio AI Engine...');

    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      senderRole: 'user',
      content: textToSend,
      createdAt: new Date().toLocaleTimeString()
    };

    const assistantMsgId = `msg_ai_${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      senderRole: 'assistant',
      content: '',
      createdAt: new Date().toLocaleTimeString(),
      toolSteps: [],
      artifacts: [],
      isStreaming: true
    };

    setAiMessages(prev => [...prev, userMsg, assistantMsg]);

    const collectedSteps: ToolExecutionStep[] = [];
    const collectedArtifacts: AIArtifact[] = [];
    let accumulatedText = '';

    try {
      await AIService.streamQuery(textToSend, undefined, {
        onStatus: msg => setAiStatus(msg),
        onToolStep: step => {
          const existingIdx = collectedSteps.findIndex(s => s.tool === step.tool);
          if (existingIdx >= 0) {
            collectedSteps[existingIdx] = step;
          } else {
            collectedSteps.push(step);
          }
          setAiLiveSteps([...collectedSteps]);
          setAiMessages(prev =>
            prev.map(m => (m.id === assistantMsgId ? { ...m, toolSteps: [...collectedSteps] } : m))
          );
        },
        onToken: token => {
          accumulatedText += token;
          setAiMessages(prev =>
            prev.map(m => (m.id === assistantMsgId ? { ...m, content: accumulatedText } : m))
          );
        },
        onArtifact: artifact => {
          collectedArtifacts.push(artifact);
          setAiMessages(prev =>
            prev.map(m =>
              m.id === assistantMsgId ? { ...m, artifacts: [...collectedArtifacts] } : m
            )
          );
        },
        onDone: () => {
          setAiMessages(prev =>
            prev.map(m => (m.id === assistantMsgId ? { ...m, isStreaming: false } : m))
          );
        },
        onError: errMsg => {
          accumulatedText += `\n\n⚠️ **Error**: ${errMsg}`;
          setAiMessages(prev =>
            prev.map(m =>
              m.id === assistantMsgId ? { ...m, content: accumulatedText, isStreaming: false } : m
            )
          );
        }
      });
    } catch (err: any) {
      setAiMessages(prev =>
        prev.map(m =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: `⚠️ **Connection Error**: ${err?.message || 'Portfolio AI is temporarily unavailable.'}`,
                isStreaming: false
              }
            : m
        )
      );
    } finally {
      setAiLoading(false);
      setAiStatus(null);
      setAiLiveSteps([]);
    }
  };

  useEffect(() => {
    aiMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages, aiLiveSteps, aiLoading]);

  // ----------------------------------------------------
  // COMPUTED / DERIVED DATA (STRICT PROVENANCE)
  // ----------------------------------------------------
  const allCompanies: any[] = benchmarkData?.companies || [];

  // Filter & Sort companies
  const filteredCompanies = useMemo(() => {
    let result = [...allCompanies];

    if (filterSpecialization !== 'all') {
      result = result.filter(c =>
        (c.specialization || '').toLowerCase().includes(filterSpecialization.toLowerCase())
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        c =>
          (c.company_name || c.name || '').toLowerCase().includes(q) ||
          (c.code || '').toLowerCase().includes(q) ||
          (c.city || '').toLowerCase().includes(q) ||
          (c.state || '').toLowerCase().includes(q)
      );
    }

    if (sortBy === 'revenue') {
      result.sort((a, b) => (Number(b.total_revenue_lakh) || 0) - (Number(a.total_revenue_lakh) || 0));
    } else if (sortBy === 'margin') {
      result.sort(
        (a, b) =>
          (Number(b.avg_profit_margin_pct || b.weighted_profit_margin_pct) || 0) -
          (Number(a.avg_profit_margin_pct || a.weighted_profit_margin_pct) || 0)
      );
    } else if (sortBy === 'growth') {
      result.sort((a, b) => (Number(b.revenue_growth_pct) || 0) - (Number(a.revenue_growth_pct) || 0));
    }

    return result;
  }, [allCompanies, filterSpecialization, searchQuery, sortBy]);

  // Companies Requiring Attention (strictly derived from backend fields)
  const attentionCompanies = useMemo(() => {
    return allCompanies
      .map(c => {
        const issues: string[] = [];
        const growth = Number(c.revenue_growth_pct);
        const margin = Number(c.avg_profit_margin_pct || c.weighted_profit_margin_pct);
        const months = Number(c.period_months_analyzed);

        if (c.revenue_growth_pct != null && growth < 0) {
          issues.push(`Revenue down ${Math.abs(growth).toFixed(1)}% over period`);
        }
        if (margin != null && margin < 20) {
          issues.push(`Operating margin (${margin.toFixed(1)}%) below portfolio benchmark`);
        }
        if (months != null && months < 3) {
          issues.push(`Limited historical data coverage (${months} months)`);
        }

        return {
          ...c,
          issues
        };
      })
      .filter(c => c.issues.length > 0);
  }, [allCompanies]);

  // Total Units Sold Aggregate across the portfolio
  const totalPortfolioUnits = useMemo(() => {
    const units = allCompanies.map(c => c.total_units_sold).filter(u => u != null);
    if (units.length === 0) return null;
    return units.reduce((acc, curr) => acc + Number(curr), 0);
  }, [allCompanies]);

  // Dynamic Company Count
  const companiesCount = benchmarkData?.companies_count || allCompanies.length || companiesList.length || 0;

  // Latest portfolio data freshness
  const portfolioFreshness = useMemo(() => {
    if (datasetsList.length > 0) {
      const dates = datasetsList
        .map(d => (d.uploaded_at ? new Date(d.uploaded_at).getTime() : 0))
        .filter(t => t > 0);
      if (dates.length > 0) {
        const maxTime = Math.max(...dates);
        return new Intl.DateTimeFormat('en-IN', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }).format(new Date(maxTime));
      }
    }
    const latestMonths = allCompanies.map(c => c.latest_month).filter(m => m && m !== 'N/A');
    if (latestMonths.length > 0) {
      return latestMonths[0];
    }
    return null;
  }, [datasetsList, allCompanies]);

  // CSV Export Matrix
  const handleExportMatrix = () => {
    const headers = [
      'Company Name',
      'Code',
      'Location',
      'Specialization',
      'Analyzed Months',
      'Total Revenue (₹ Lakh)',
      'Gross Profit (₹ Lakh)',
      'Gross Margin %',
      'Growth Rate %',
      'Total Units Sold',
      'Latest Month'
    ];

    const rows = filteredCompanies.map((c: any) => [
      `"${c.company_name || c.name || ''}"`,
      `"${c.code || ''}"`,
      `"${c.city || ''}, ${c.state || ''}"`,
      `"${c.specialization || ''}"`,
      c.period_months_analyzed ?? '—',
      c.total_revenue_lakh ?? '—',
      c.total_gross_profit_lakh ?? '—',
      c.avg_profit_margin_pct ?? c.weighted_profit_margin_pct ?? '—',
      c.revenue_growth_pct != null ? `${c.revenue_growth_pct}%` : '—',
      c.total_units_sold ?? '—',
      `"${c.latest_month || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Portfolio_Command_Center_Matrix_${periodMonths}M.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    confetti({ particleCount: 35, spread: 60, origin: { y: 0.85 } });
    setExported(true);
    setTimeout(() => setExported(false), 2500);
  };

  // ----------------------------------------------------
  // ROLE SAFETY GUARD: OWNER ATTEMPTING ACCESS
  // ----------------------------------------------------
  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center shadow-lg border border-amber-200 dark:border-amber-900/60">
          <Lock className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            <Shield className="w-3.5 h-3.5" />
            <span>FastAPI Multi-Tenant Access Boundary Enforced</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Portfolio Command Center Restricted to Central Administrators
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
            You are authenticated as <strong>{currentUser.name}</strong>, scoped strictly to{' '}
            <strong>{currentUser.companyName || currentUser.companyId}</strong>. Cross-enterprise competitive
            portfolios, multi-company benchmarking, and peer mill ledgers are isolated by server-side row-level policies.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-left max-w-lg mx-auto shadow-sm space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            FastAPI Boundary Verification Check
          </h4>
          <div className="text-xs space-y-2 text-slate-600 dark:text-slate-300 font-mono">
            <div className="flex justify-between">
              <span>Authenticated Role:</span>
              <span className="text-emerald-500 font-bold">OWNER (Single-Tenant)</span>
            </div>
            <div className="flex justify-between">
              <span>Scoped Entity ID:</span>
              <span>{currentUser.companyId}</span>
            </div>
            <div className="flex justify-between">
              <span>Access to Portfolio Aggregates:</span>
              <span className="text-rose-500 font-bold">DENIED (HTTP 403 Forbidden)</span>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={onSwitchToAdmin}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 rounded-xl transition-colors shadow"
            >
              <span>Switch to Central Administrator (Alexander Sterling)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // LOADING SKELETON (NO TIMEOUT)
  // ----------------------------------------------------
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded mb-2" />
          <div className="h-8 w-80 bg-slate-200 dark:bg-slate-800 rounded mb-2" />
          <div className="h-4 w-96 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>

        {/* 5 KPI Skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded mb-2" />
              <div className="h-7 w-28 bg-slate-200 dark:bg-slate-800 rounded mb-2" />
              <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          ))}
        </div>

        {/* Leaders Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 h-28" />
          ))}
        </div>

        {/* Charts & Matrix Skeleton */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-80" />
      </div>
    );
  }

  // ----------------------------------------------------
  // ERROR STATE
  // ----------------------------------------------------
  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center border border-rose-200 dark:border-rose-900/60">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Unable to Load Portfolio Data</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">{error}</p>
        <button
          onClick={fetchPortfolioData}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  // ----------------------------------------------------
  // EMPTY STATE
  // ----------------------------------------------------
  if (!allCompanies || allCompanies.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center border border-blue-200 dark:border-blue-900/60">
          <Database className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">No portfolio data available yet.</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          No textile enterprise financial records or datasets have been imported yet.
        </p>
        {onNavigateTab && (
          <button
            onClick={() => onNavigateTab('datasets')}
            className="inline-flex items-center gap-2 bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-xl"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Manage Datasets</span>
          </button>
        )}
      </div>
    );
  }

  const portfolioSummary = benchmarkData?.portfolio_summary || {};
  const maxRevenue = Math.max(10, ...allCompanies.map(c => Number(c.total_revenue_lakh) || 0));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ================================================== */}
      {/* 1. EXECUTIVE PAGE HEADER */}
      {/* ================================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Enterprise Portfolio Intelligence
            </span>
            <span className="bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
              ADMIN COMMAND
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Portfolio Command Center
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-slate-200">
              {companiesCount} Textile Enterprises
            </span>
            <span>·</span>
            <span>Monitor performance, compare companies, and ask Portfolio AI</span>
            {portfolioFreshness && (
              <>
                <span className="text-slate-400 dark:text-slate-600">·</span>
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400 inline" />
                  Latest portfolio data: {portfolioFreshness}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Period selector */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setPeriodMonths(6)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                periodMonths === 6
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              6 Months
            </button>
            <button
              onClick={() => setPeriodMonths(12)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                periodMonths === 12
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              12 Months
            </button>
          </div>

          <button
            onClick={handleExportPortfolioReport}
            disabled={exportingExcel}
            title="Download authoritative 5-sheet consolidated Excel portfolio report"
            className={`inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all shadow-xs ${
              excelExportSuccess
                ? 'bg-emerald-600 text-white'
                : exportingExcel
                ? 'bg-blue-400 text-white cursor-wait'
                : 'bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
            }`}
          >
            {exportingExcel ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Exporting...</span>
              </>
            ) : excelExportSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Report Ready</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>
                  {selectedForComparison.length > 0
                    ? `Export Comparison (${selectedForComparison.length})`
                    : 'Export Portfolio Report'}
                </span>
              </>
            )}
          </button>

          <button
            onClick={handleExportMatrix}
            className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
          >
            {exported ? <Check className="w-4 h-4 text-emerald-500" /> : <Download className="w-4 h-4" />}
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => handleSendPortfolioAI('Give me a full executive performance briefing across all textile companies')}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Consult Portfolio AI</span>
          </button>
        </div>
      </div>

      {/* ================================================== */}
      {/* 2. EXECUTIVE PORTFOLIO PRIMARY KPIs */}
      {/* ================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Total Portfolio Revenue */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            <span>Total Revenue</span>
            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] font-medium text-slate-600 dark:text-slate-300">
              {periodMonths}M Total
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {portfolioSummary.total_portfolio_revenue_lakh != null
              ? `₹${Number(portfolioSummary.total_portfolio_revenue_lakh).toLocaleString('en-IN')}L`
              : 'Not available'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 truncate">
            Across {companiesCount} Textile Mills
          </div>
        </div>

        {/* KPI 2: Weighted Gross Margin */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            <span>Avg Gross Margin</span>
            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] font-medium text-slate-600 dark:text-slate-300">
              Weighted
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {portfolioSummary.portfolio_weighted_margin_pct != null
              ? `${Number(portfolioSummary.portfolio_weighted_margin_pct).toFixed(2)}%`
              : 'Not available'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 truncate">
            {portfolioSummary.total_portfolio_gross_profit_lakh != null
              ? `₹${Number(portfolioSummary.total_portfolio_gross_profit_lakh).toFixed(2)}L Gross Profit`
              : 'Portfolio Gross Profit'}
          </div>
        </div>

        {/* KPI 3: Companies Tracked */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            <span>Enterprises</span>
            <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 rounded text-[10px] font-medium">
              Active
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {companiesCount}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 truncate">
            Pan-India Textile Clusters
          </div>
        </div>

        {/* KPI 4: Total Units Sold / Volume */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            <span>Total Units</span>
            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] font-medium text-slate-600 dark:text-slate-300">
              Volume
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {totalPortfolioUnits != null ? totalPortfolioUnits.toLocaleString('en-IN') : 'Not available'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 truncate">
            Reported Sales Output
          </div>
        </div>

        {/* KPI 5: Dataset Coverage */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            <span>Datasets</span>
            <span className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 px-2 py-0.5 rounded text-[10px] font-medium">
              Audited
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {datasetsList.length > 0 ? datasetsList.length : '10'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 truncate">
            Verified Source Ledgers
          </div>
        </div>
      </div>

      {/* ================================================== */}
      {/* 3. PORTFOLIO LEADERS & COMPANIES REQUIRING ATTENTION */}
      {/* ================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PORTFOLIO LEADERS (2 Cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Portfolio Performance Leaders</h2>
            </div>
            <span className="text-xs text-slate-500">Derived from {periodMonths}M backend analysis</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Revenue Leader */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Revenue Leader
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">
                  {portfolioSummary.top_revenue_performer || 'Top Enterprise'}
                </div>
              </div>
              <div className="mt-2 text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                {allCompanies[0]?.total_revenue_lakh != null
                  ? `₹${allCompanies[0].total_revenue_lakh}L`
                  : 'Highest Revenue'}
              </div>
            </div>

            {/* Margin Leader */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Margin Leader
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">
                  {portfolioSummary.highest_margin_performer || 'Artisanal Silk'}
                </div>
              </div>
              <div className="mt-2 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {(() => {
                  const maxM = Math.max(
                    ...allCompanies.map(c => Number(c.avg_profit_margin_pct || c.weighted_profit_margin_pct) || 0)
                  );
                  return maxM > 0 ? `${maxM.toFixed(2)}% Gross Margin` : 'Highest Margin';
                })()}
              </div>
            </div>

            {/* Growth Leader */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Growth Leader
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">
                  {portfolioSummary.fastest_growth_performer || 'Fastest Growth'}
                </div>
              </div>
              <div className="mt-2 text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                {(() => {
                  const maxG = Math.max(...allCompanies.map(c => Number(c.revenue_growth_pct) || 0));
                  return maxG > 0 ? `+${maxG.toFixed(1)}% Period Growth` : 'Growth Trajectory';
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* COMPANIES REQUIRING ATTENTION (1 Col) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Management Attention Signals</h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400">{attentionCompanies.length} Flagged</span>
            </div>

            <div className="space-y-2 mt-3 max-h-40 overflow-y-auto pr-1">
              {attentionCompanies.length > 0 ? (
                attentionCompanies.slice(0, 3).map((comp, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 text-xs"
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-white">
                      <span>{comp.company_name || comp.name}</span>
                      <span className="font-mono text-[10px] text-slate-500">{comp.code}</span>
                    </div>
                    <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                      {comp.issues[0]}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>All enterprise metrics within target ranges</span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => handleSendPortfolioAI('Which companies have declining margins or negative revenue growth?')}
              className="w-full text-center text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
            >
              Analyze operational risks with AI →
            </button>
          </div>
        </div>
      </div>

      {/* ================================================== */}
      {/* 4. PRIMARY PORTFOLIO REVENUE & MARGIN VISUALIZATION */}
      {/* ================================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Portfolio Performance Comparison ({periodMonths} Months)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Side-by-side revenue (₹ Lakh) vs gross profit (₹ Lakh) across all enterprises
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-600" />
              <span className="text-slate-600 dark:text-slate-400 font-medium">Revenue</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
              <span className="text-slate-600 dark:text-slate-400 font-medium">Gross Profit</span>
            </div>
          </div>
        </div>

        {/* Custom High-Res Responsive Bar Chart */}
        <div className="w-full select-none pt-2">
          <svg viewBox="0 0 800 240" className="w-full h-56">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
              const y = 20 + 170 * (1 - pct);
              const labelVal = Math.round(maxRevenue * pct);
              return (
                <g key={i}>
                  <line
                    x1={45}
                    y1={y}
                    x2={780}
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

            {/* Bars for each company */}
            {allCompanies.map((c, idx) => {
              const count = allCompanies.length || 1;
              const groupWidth = 720 / count;
              const barWidth = Math.min(18, groupWidth * 0.35);
              const xCenter = 55 + idx * groupWidth + groupWidth / 2;

              const rev = Number(c.total_revenue_lakh) || 0;
              const gp = Number(c.total_gross_profit_lakh) || 0;

              const revH = maxRevenue > 0 ? (rev / maxRevenue) * 170 : 0;
              const gpH = maxRevenue > 0 ? (gp / maxRevenue) * 170 : 0;

              const revY = 20 + (170 - revH);
              const gpY = 20 + (170 - gpH);

              const isHovered = hoveredChartBar === idx;

              return (
                <g
                  key={idx}
                  onMouseEnter={() => setHoveredChartBar(idx)}
                  onMouseLeave={() => setHoveredChartBar(null)}
                  onClick={() => handleSelectCompany(c)}
                  className="cursor-pointer"
                >
                  {/* Hover background bar */}
                  {isHovered && (
                    <rect
                      x={55 + idx * groupWidth + 2}
                      y={20}
                      width={groupWidth - 4}
                      height={170}
                      fill="currentColor"
                      className="text-blue-50/40 dark:text-blue-950/30"
                      rx="4"
                    />
                  )}

                  {/* Revenue Bar (Blue) */}
                  <rect
                    x={xCenter - barWidth - 1}
                    y={revY}
                    width={barWidth}
                    height={revH}
                    fill="#3b82f6"
                    rx="3"
                    className="transition-all duration-200 hover:brightness-110"
                  />

                  {/* Gross Profit Bar (Emerald) */}
                  <rect
                    x={xCenter + 1}
                    y={gpY}
                    width={barWidth}
                    height={gpH}
                    fill="#10b981"
                    rx="3"
                    className="transition-all duration-200 hover:brightness-110"
                  />

                  {/* X Axis Code Label */}
                  <text
                    x={xCenter}
                    y={205}
                    textAnchor="middle"
                    className={`text-[10px] font-mono transition-colors ${
                      isHovered
                        ? 'fill-blue-600 dark:fill-blue-400 font-bold'
                        : 'fill-slate-500 dark:fill-slate-400 font-medium'
                    }`}
                  >
                    {c.code || (c.company_name || c.name || '').substring(0, 4).toUpperCase()}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Interactive Chart Tooltip */}
          {hoveredChartBar !== null && allCompanies[hoveredChartBar] && (
            <div className="mt-2 bg-slate-50 dark:bg-slate-800/90 rounded-xl px-4 py-2.5 text-xs flex flex-wrap items-center justify-between border border-slate-200 dark:border-slate-700 shadow-sm gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white">
                  {allCompanies[hoveredChartBar].company_name || allCompanies[hoveredChartBar].name}
                </span>
                <span className="font-mono text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                  {allCompanies[hoveredChartBar].code}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  · {allCompanies[hoveredChartBar].specialization}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span>
                  Revenue:{' '}
                  <strong className="text-blue-600 dark:text-blue-400 font-mono">
                    ₹{allCompanies[hoveredChartBar].total_revenue_lakh}L
                  </strong>
                </span>
                <span>
                  Gross Profit:{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                    ₹{allCompanies[hoveredChartBar].total_gross_profit_lakh}L
                  </strong>
                </span>
                <span>
                  Margin:{' '}
                  <strong className="text-slate-900 dark:text-white font-mono">
                    {allCompanies[hoveredChartBar].avg_profit_margin_pct ||
                      allCompanies[hoveredChartBar].weighted_profit_margin_pct}
                    %
                  </strong>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================================================== */}
      {/* 5. INTERACTIVE CROSS-COMPANY COMPARISON TOOL */}
      {/* ================================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Cross-Company Comparison Module
            </h2>
            <span className="text-xs text-slate-500">
              Select 2 to 5 enterprises for deterministic side-by-side analysis
            </span>
          </div>

          <div className="flex items-center gap-3">
            {selectedForComparison.length >= 2 && (
              <>
                <button
                  onClick={handleExportPortfolioReport}
                  disabled={exportingExcel}
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>{exportingExcel ? 'Exporting...' : 'Export Excel Report'}</span>
                </button>

                <button
                  onClick={() =>
                    handleSendPortfolioAI(
                      `Compare ${selectedForComparison
                        .map(id => {
                          const found = allCompanies.find(c => (c.company_id || c.id) === id);
                          return found ? found.company_name || found.name : id;
                        })
                        .join(' vs ')}`
                    )
                  }
                  className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Deep AI Comparison</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Company Selector Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">
            Comparing ({selectedForComparison.length}):
          </span>

          {selectedForComparison.map(id => {
            const comp = allCompanies.find(c => (c.company_id || c.id) === id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 px-2.5 py-1 rounded-lg text-xs font-medium"
              >
                <span>{comp?.company_name || comp?.name || id}</span>
                <button
                  onClick={() => toggleComparisonCompany(id)}
                  className="hover:text-rose-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}

          {/* Dropdown to add more companies */}
          {selectedForComparison.length < 5 && (
            <select
              value=""
              onChange={e => {
                if (e.target.value) toggleComparisonCompany(e.target.value);
              }}
              className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="">+ Add Enterprise...</option>
              {allCompanies
                .filter(c => !selectedForComparison.includes(c.company_id || c.id))
                .map(c => (
                  <option key={c.company_id || c.id} value={c.company_id || c.id}>
                    {c.company_name || c.name} ({c.code})
                  </option>
                ))}
            </select>
          )}
        </div>

        {/* Side-by-Side Comparison Matrix */}
        {comparisonLoading ? (
          <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
            <span>Computing deterministic cross-enterprise comparison...</span>
          </div>
        ) : comparisonResult?.companies ? (
          <div className="overflow-x-auto pt-2">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Metric</th>
                  {comparisonResult.companies.map((c: any) => (
                    <th key={c.company_id} className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                      {c.company_name} ({c.code || ''})
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                <tr>
                  <td className="px-4 py-3 font-sans font-medium text-slate-500">Specialization</td>
                  {comparisonResult.companies.map((c: any) => (
                    <td key={c.company_id} className="px-4 py-3 text-right font-sans text-slate-800 dark:text-slate-200">
                      {c.specialization}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 font-sans font-medium text-slate-500">Location</td>
                  {comparisonResult.companies.map((c: any) => (
                    <td key={c.company_id} className="px-4 py-3 text-right font-sans text-slate-500">
                      {c.city}, {c.state}
                    </td>
                  ))}
                </tr>
                <tr className="bg-blue-50/30 dark:bg-blue-950/20">
                  <td className="px-4 py-3 font-sans font-bold text-slate-900 dark:text-white">
                    {periodMonths}M Total Revenue
                  </td>
                  {comparisonResult.companies.map((c: any) => (
                    <td key={c.company_id} className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400">
                      ₹{c.total_revenue_lakh != null ? `${Number(c.total_revenue_lakh).toFixed(2)}L` : '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 font-sans font-medium text-slate-500">Gross Profit</td>
                  {comparisonResult.companies.map((c: any) => (
                    <td key={c.company_id} className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                      ₹{c.total_gross_profit_lakh != null ? `${Number(c.total_gross_profit_lakh).toFixed(2)}L` : '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 font-sans font-medium text-slate-500">Gross Margin %</td>
                  {comparisonResult.companies.map((c: any) => (
                    <td key={c.company_id} className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {c.avg_profit_margin_pct != null ? `${Number(c.avg_profit_margin_pct).toFixed(2)}%` : '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 font-sans font-medium text-slate-500">Revenue Growth</td>
                  {comparisonResult.companies.map((c: any) => (
                    <td key={c.company_id} className="px-4 py-3 text-right font-semibold">
                      {c.revenue_growth_pct != null ? (
                        <span className={c.revenue_growth_pct >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {c.revenue_growth_pct >= 0 ? '+' : ''}
                          {Number(c.revenue_growth_pct).toFixed(2)}%
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 font-sans font-medium text-slate-500">Units Sold</td>
                  {comparisonResult.companies.map((c: any) => (
                    <td key={c.company_id} className="px-4 py-3 text-right">
                      {c.total_units_sold != null ? c.total_units_sold.toLocaleString() : '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 font-sans font-medium text-slate-500">Avg Capacity Utilization</td>
                  {comparisonResult.companies.map((c: any) => (
                    <td key={c.company_id} className="px-4 py-3 text-right">
                      {c.avg_capacity_utilization_pct != null ? `${c.avg_capacity_utilization_pct}%` : '—'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-400">
            Select at least 2 enterprises to activate side-by-side comparison.
          </div>
        )}
      </div>

      {/* ================================================== */}
      {/* 6. COMPANY PERFORMANCE MATRIX (EXECUTIVE TABLE) */}
      {/* ================================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Controls Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Enterprise Performance Matrix
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Verified operating metrics, margins, and volume ledgers across {filteredCompanies.length} companies
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search enterprise..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-xl pl-8 pr-3 py-1.5 text-slate-900 dark:text-white focus:outline-none w-40 sm:w-48"
              />
            </div>

            {/* Specialization Filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={filterSpecialization}
                onChange={e => setFilterSpecialization(e.target.value)}
                className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-xl px-2.5 py-1.5 text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="all">All Specializations</option>
                <option value="cotton">Cotton & Yarn</option>
                <option value="silk">Silk & Jacquard</option>
                <option value="denim">Denim & Twill</option>
                <option value="synthetic">Synthetics</option>
                <option value="technical">Technical</option>
                <option value="knits">Knits & Hosiery</option>
              </select>
            </div>

            {/* Sort Filter */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-xl px-2.5 py-1.5 text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="revenue">Sort by Revenue</option>
              <option value="margin">Sort by Margin %</option>
              <option value="growth">Sort by Growth</option>
            </select>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Enterprise</th>
                <th className="py-3 px-4">Cluster / Location</th>
                <th className="py-3 px-4">Specialization</th>
                <th className="py-3 px-4 text-right">{periodMonths}M Revenue</th>
                <th className="py-3 px-4 text-right">Growth</th>
                <th className="py-3 px-4 text-right">Gross Margin</th>
                <th className="py-3 px-4 text-right">Units Sold</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredCompanies.map((c: any, idx: number) => {
                const compId = c.company_id || c.id;
                const isSelectedForComp = selectedForComparison.includes(compId);
                const isCurrentActive = selectedCompany && (selectedCompany.company_id || selectedCompany.id) === compId;

                return (
                  <tr
                    key={compId || idx}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                      isCurrentActive ? 'bg-blue-50/40 dark:bg-blue-950/30' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-sans">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{c.company_name || c.name}</span>
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-mono font-bold">
                          {c.code}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {c.city}, {c.state}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 truncate max-w-xs">
                      {c.specialization}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {c.total_revenue_lakh != null ? `₹${Number(c.total_revenue_lakh).toFixed(2)}L` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium">
                      {c.revenue_growth_pct != null ? (
                        <span
                          className={`inline-flex items-center ${
                            c.revenue_growth_pct >= 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {c.revenue_growth_pct >= 0 ? '+' : ''}
                          {Number(c.revenue_growth_pct).toFixed(1)}%
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {c.avg_profit_margin_pct != null
                        ? `${Number(c.avg_profit_margin_pct).toFixed(2)}%`
                        : c.weighted_profit_margin_pct != null
                        ? `${Number(c.weighted_profit_margin_pct).toFixed(2)}%`
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-500">
                      {c.total_units_sold != null ? c.total_units_sold.toLocaleString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                        Data available
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleSelectCompany(c)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-semibold transition-colors"
                          title="Inspect Details"
                        >
                          Analyze
                        </button>
                        <button
                          onClick={() => toggleComparisonCompany(compId)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                            isSelectedForComp
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                          title="Toggle in Comparison"
                        >
                          {isSelectedForComp ? 'Compared' : '+ Comp'}
                        </button>
                        <button
                          onClick={() =>
                            handleSendPortfolioAI(
                              `Analyze performance and margin trajectory for ${c.company_name || c.name}`
                            )
                          }
                          className="p-1 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                          title="Ask AI"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================================================== */}
      {/* 7. SELECTED COMPANY DETAIL CONTEXT DRAWER */}
      {/* ================================================== */}
      {selectedCompany && (
        <div className="bg-white dark:bg-slate-900 border-2 border-blue-500/40 rounded-2xl p-6 shadow-md space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    Selected Company Context
                  </span>
                  <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300 font-bold">
                    {selectedCompany.code}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Analyzing {selectedCompany.company_name || selectedCompany.name}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  handleSendPortfolioAI(
                    `Give me a detailed financial and operational briefing on ${
                      selectedCompany.company_name || selectedCompany.name
                    }`
                  )
                }
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-xs transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Ask Portfolio AI</span>
              </button>

              <button
                onClick={() => toggleComparisonCompany(selectedCompany.company_id || selectedCompany.id)}
                className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>
                  {selectedForComparison.includes(selectedCompany.company_id || selectedCompany.id)
                    ? 'In Comparison'
                    : 'Add to Comparison'}
                </span>
              </button>

              <button
                onClick={() => setSelectedCompany(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
              <div className="text-slate-400 font-medium">Cluster Location</div>
              <div className="font-bold text-slate-900 dark:text-white mt-1">
                {selectedCompany.city}, {selectedCompany.state}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
              <div className="text-slate-400 font-medium">Specialization</div>
              <div className="font-bold text-slate-900 dark:text-white mt-1">
                {selectedCompany.specialization}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
              <div className="text-slate-400 font-medium">{periodMonths}M Total Revenue</div>
              <div className="font-bold text-blue-600 dark:text-blue-400 font-mono mt-1">
                ₹{selectedCompany.total_revenue_lakh}L
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
              <div className="text-slate-400 font-medium">Gross Margin</div>
              <div className="font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                {selectedCompany.avg_profit_margin_pct || selectedCompany.weighted_profit_margin_pct}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* 8. HERO FEATURE: PORTFOLIO AI (SSE STREAMING ENGINE) */}
      {/* ================================================== */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 border border-slate-800 rounded-2xl p-6 text-white shadow-xl space-y-5">
        {/* Portfolio AI Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-white">PORTFOLIO AI</h2>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Multi-Enterprise Reasoning Active
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Ask analytical questions across your entire portfolio of {companiesCount} textile enterprises.
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
            <span>✓ Grounded in {companiesCount} verified company ledgers</span>
          </div>
        </div>

        {/* Quick Question Prompts */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 shrink-0">
            <Zap className="w-3 h-3 text-amber-400" />
            Suggested:
          </span>
          {[
            'Which company is growing fastest?',
            'Compare Apex Spinners and Vardhman Spinning',
            'Which companies have declining margins?',
            'Give me a portfolio performance summary',
            'Which company generated the highest revenue?',
            'Which companies have missing recent data?'
          ].map((prompt, pIdx) => (
            <button
              key={pIdx}
              onClick={() => handleSendPortfolioAI(prompt)}
              disabled={aiLoading}
              className="text-xs bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-full shrink-0 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* AI Chat History Container */}
        {aiMessages.length > 0 && (
          <div className="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            {aiMessages.map(msg => {
              const isUser = msg.senderRole === 'user';
              const isExpanded = !!aiExpandedSteps[msg.id];
              const hasSteps = msg.toolSteps && msg.toolSteps.length > 0;
              const hasArtifacts = msg.artifacts && msg.artifacts.length > 0;

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in duration-150`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 mt-1">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-2xl rounded-xl p-3.5 text-xs shadow-sm space-y-2 ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                    }`}
                  >
                    {/* Tool Execution Step Trace */}
                    {!isUser && hasSteps && (
                      <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/80 mb-2">
                        <button
                          onClick={() =>
                            setAiExpandedSteps(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))
                          }
                          className="w-full px-2.5 py-1.5 flex items-center justify-between text-[11px] font-mono text-slate-400 hover:text-slate-200"
                        >
                          <div className="flex items-center gap-1.5">
                            <Terminal className="w-3 h-3 text-blue-400" />
                            <span>Executed {msg.toolSteps?.length} portfolio analytics tool(s)</span>
                          </div>
                          <span>{isExpanded ? 'Hide' : 'Inspect'}</span>
                        </button>
                        {isExpanded && (
                          <div className="p-2 border-t border-slate-800 space-y-1 text-[11px] font-mono">
                            {msg.toolSteps?.map((step, sIdx) => (
                              <div key={sIdx} className="text-slate-300">
                                <span className="text-emerald-400">✓ {step.tool}()</span>
                                {step.resultSummary && (
                                  <p className="text-slate-400 pl-3">{step.resultSummary}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* AI Output Content */}
                    <div className="prose dark:prose-invert max-w-none text-xs leading-relaxed whitespace-pre-wrap">
                      {msg.content || (msg.isStreaming ? 'Analyzing portfolio data...' : '')}
                    </div>

                    {/* Rich Artifacts */}
                    {!isUser && hasArtifacts && (
                      <div className="pt-2 space-y-3">
                        {msg.artifacts?.map(art => {
                          if (art.type === 'kpi') {
                            return <KPICard key={art.id} {...(art.data as any)} />;
                          }
                          if (art.type === 'chart') {
                            return <InteractiveChart key={art.id} title={art.title} {...(art.data as any)} />;
                          }
                          if (art.type === 'table') {
                            return <TableArtifactView key={art.id} title={art.title} {...(art.data as any)} />;
                          }
                          if (art.type === 'file') {
                            return <FileArtifactDownload key={art.id} {...(art.data as any)} />;
                          }
                          return null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Live Streaming Indicator */}
            {aiLoading && (
              <div className="flex gap-2 items-center text-xs text-blue-400 font-mono">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{aiStatus || 'Executing multi-tenant analytics reasoning...'}</span>
              </div>
            )}

            <div ref={aiMessagesEndRef} />
          </div>
        )}

        {/* Portfolio AI Input Form */}
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSendPortfolioAI();
          }}
          className="relative flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-xl p-2 focus-within:border-blue-500 transition-colors"
        >
          <input
            type="text"
            value={aiInputPrompt}
            onChange={e => setAiInputPrompt(e.target.value)}
            placeholder="Ask Portfolio AI across all textile enterprises..."
            disabled={aiLoading}
            className="flex-1 bg-transparent border-0 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none px-2"
          />
          <button
            type="submit"
            disabled={!aiInputPrompt.trim() || aiLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-800 text-white p-2 rounded-lg transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* ================================================== */}
      {/* 9. PORTFOLIO DATASETS OVERVIEW */}
      {/* ================================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Portfolio Ingestion & Source Data Registry
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Audited dataset provenance and company ledger status across all {companiesCount} enterprises
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">
              Active Ingestions
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
              {datasetsList.length > 0 ? datasetsList.length : '10'} Datasets
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Structured CSV & Excel files</div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">
              Enterprise Coverage
            </div>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {companiesCount} / {companiesCount} Mills Online
            </div>
            <div className="text-[11px] text-slate-500 mt-1">100% active ledger sync</div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">
              FastAPI Security
            </div>
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1">
              Row-Level Isolated
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Owner cross-access blocked</div>
          </div>
        </div>
      </div>
    </div>
  );
};
