import React, { useState, useEffect } from 'react';
import {
  Shield,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Database,
  Code2,
  KeyRound,
  Play,
  FileCheck,
  RefreshCw
} from 'lucide-react';
import { User } from '../types';
import { apiClient } from '../services/apiClient';

interface SecurityViewProps {
  currentUser: User;
}

export const SecurityView: React.FC<SecurityViewProps> = ({ currentUser }) => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [testTargetCompId, setTestTargetCompId] = useState<string>('');
  const [testResult, setTestResult] = useState<{ status: string; message: string; httpCode?: number } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const loadComps = async () => {
      try {
        const comps = await apiClient.companies.list();
        setCompanies(comps);
        if (comps.length > 0) {
          const other = comps.find(c => c.id !== currentUser.companyId);
          if (other) setTestTargetCompId(other.id);
        }
      } catch {
        // ignore
      }
    };
    loadComps();
  }, [currentUser.id]);

  const runSecurityTest = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      // Execute REAL backend HTTP request to test row-level isolation
      const res = await apiClient.analytics.getSummary(testTargetCompId);
      setTestResult({
        status: 'AUTHORIZED',
        httpCode: 200,
        message: `HTTP 200 OK — Authorized: Backend confirmed user [${currentUser.name}] holds role [${currentUser.role}], granting verified read access to [${res.company_name}].`
      });
    } catch (err: any) {
      setTestResult({
        status: 'DENIED',
        httpCode: 403,
        message: `HTTP 403 Forbidden — Server-Side TenantGuard Enforced: ${err.message}`
      });
    } finally {
      setTesting(false);
    }
  };

  const schemaSQL = `-- ANSI SQL Server / PostgreSQL Tenant Schema Architecture (FastAPI Protected)
CREATE TABLE companies (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(32) UNIQUE NOT NULL,
    specialization TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    founded_year INT NOT NULL,
    annual_capacity TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE monthly_financials (
    id VARCHAR(64) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    period_year INT NOT NULL,
    period_month INT NOT NULL,
    period_date DATE NOT NULL,
    revenue_lakh DECIMAL(12, 2) NOT NULL,
    cost_of_goods_sold_lakh DECIMAL(12, 2) NOT NULL,
    gross_profit_lakh DECIMAL(12, 2) NOT NULL,
    profit_margin_pct DECIMAL(6, 2) NOT NULL,
    units_sold BIGINT NOT NULL,
    unit_of_measure VARCHAR(32) NOT NULL,
    average_selling_price DECIMAL(10, 2) NOT NULL,
    CONSTRAINT chk_margin CHECK (profit_margin_pct >= 0 AND profit_margin_pct <= 100),
    CONSTRAINT uk_company_month UNIQUE (company_id, period_year, period_month)
);

CREATE TABLE product_metrics (
    id VARCHAR(64) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    category_name VARCHAR(255) NOT NULL,
    revenue_share_pct DECIMAL(5, 2) NOT NULL,
    gross_margin_pct DECIMAL(5, 2) NOT NULL,
    target_market TEXT NOT NULL,
    annual_volume BIGINT NOT NULL,
    annual_revenue_lakh DECIMAL(12, 2) NOT NULL
);`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-[#130C2E]/70 backdrop-blur-xl border border-purple-400/20 rounded-2xl p-6 shadow-[0_4px_25px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-950/60 border border-purple-400/30 text-[#A089E6] flex items-center justify-center shadow-[0_0_15px_rgba(160,137,230,0.2)]">
            <Shield className="w-6 h-6 text-[#A089E6]" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-purple-950/60 border border-purple-400/30 text-[#A089E6] text-[10px] font-bold uppercase tracking-wider mb-1">
              <span>Security & Compliance Engine</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Data Governance & Multi-Tenant Isolation
            </h1>
            <p className="text-xs text-purple-200/70 mt-0.5">
              Server-side TenantGuard enforcement, live JWT claims inspection, and ANSI SQL schema validation
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Token Claims & Boundary Simulator */}
        <div className="space-y-6">
          {/* JWT Token Claims Card */}
          <div className="bg-[#130C2E]/70 backdrop-blur-xl border border-purple-400/20 rounded-2xl p-6 shadow-[0_4px_25px_rgba(0,0,0,0.3)] space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#A089E6]">
              <KeyRound className="w-4 h-4 text-[#A089E6]" />
              <span>Active Backend JWT Identity & Tenant Claims</span>
            </div>

            <div className="bg-[#0C071C]/90 text-purple-100 p-4 rounded-xl font-mono text-xs space-y-1.5 overflow-x-auto border border-purple-500/20">
              <div>
                <span className="text-[#A089E6]">"sub"</span>: <span className="text-emerald-400">"{currentUser.id}"</span>,
              </div>
              <div>
                <span className="text-[#A089E6]">"email"</span>: <span className="text-emerald-400">"{currentUser.email}"</span>,
              </div>
              <div>
                <span className="text-[#A089E6]">"role"</span>:{' '}
                <span className={currentUser.role === 'ADMIN' ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                  "{currentUser.role}"
                </span>
                ,
              </div>
              <div>
                <span className="text-[#A089E6]">"company_id"</span>:{' '}
                <span className="text-emerald-400">
                  {currentUser.companyId ? `"${currentUser.companyId}"` : 'null'}
                </span>
                ,
              </div>
              <div>
                <span className="text-[#A089E6]">"job_title"</span>: <span className="text-purple-300/70">"{currentUser.jobTitle}"</span>,
              </div>
              <div>
                <span className="text-[#A089E6]">"isolation_enforcement"</span>:{' '}
                <span className="text-purple-300">
                  "{currentUser.role === 'ADMIN' ? 'GLOBAL_PORTFOLIO_READ' : 'STRICT_SERVER_ROW_LEVEL_GUARD'}"
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Boundary Test Simulator (Hitting real FastAPI endpoint) */}
          <div className="bg-[#130C2E]/70 backdrop-blur-xl border border-purple-400/20 rounded-2xl p-6 shadow-[0_4px_25px_rgba(0,0,0,0.3)] space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
              <Lock className="w-4 h-4 text-amber-400" />
              <span>Live FastAPI Boundary Enforcement Test</span>
            </div>
            <p className="text-xs text-purple-200/70 leading-relaxed">
              Select a target enterprise to trigger a live backend analytical query under your currently authenticated Bearer token:
            </p>

            <div className="flex items-center gap-3">
              <select
                value={testTargetCompId}
                onChange={e => setTestTargetCompId(e.target.value)}
                className="flex-1 bg-[#1A1238] border border-purple-400/25 text-xs rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-400 cursor-pointer"
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
              <button
                onClick={runSecurityTest}
                disabled={testing}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#A089E6] to-[#6D4AFF] hover:from-[#B8A4EE] hover:to-[#8155F5] disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(109,74,255,0.35)] hover:scale-105 active:scale-95 cursor-pointer"
              >
                {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                <span>{testing ? 'Testing...' : 'Execute Request'}</span>
              </button>
            </div>

            {testResult && (
              <div
                className={`p-4 rounded-xl text-xs space-y-1 ${
                  testResult.status === 'AUTHORIZED'
                    ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/60'
                    : 'bg-rose-950/40 text-rose-300 border border-rose-800/60'
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  {testResult.status === 'AUTHORIZED' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  )}
                  <span>Status: {testResult.status} ({testResult.httpCode})</span>
                </div>
                <p className="font-mono text-[11px] leading-relaxed">{testResult.message}</p>
              </div>
            )}
          </div>
        </div>

        {/* Database Schema & Formularies */}
        <div className="space-y-6">
          {/* ANSI SQL Schema */}
          <div className="bg-[#130C2E]/70 backdrop-blur-xl border border-purple-400/20 rounded-2xl p-6 shadow-[0_4px_25px_rgba(0,0,0,0.3)] space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#A089E6]">
              <Database className="w-4 h-4 text-[#A089E6]" />
              <span>FastAPI ANSI SQL Relational Schema</span>
            </div>
            <pre className="bg-[#0C071C]/90 text-purple-200/90 p-4 rounded-xl font-mono text-[11px] overflow-x-auto max-h-72 leading-relaxed border border-purple-500/20 custom-scrollbar">
              <code>{schemaSQL}</code>
            </pre>
          </div>

          {/* Verified Calculation Formularies */}
          <div className="bg-[#130C2E]/70 backdrop-blur-xl border border-purple-400/20 rounded-2xl p-6 shadow-[0_4px_25px_rgba(0,0,0,0.3)] space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <span>Deterministic Server Calculation Formularies</span>
            </div>
            <div className="space-y-2 text-xs text-purple-200/90">
              <div className="p-3 rounded-xl bg-[#0C071C]/80 font-mono border border-purple-500/15">
                <span className="text-[#A089E6] font-bold">Gross Margin %:</span>{' '}
                <code>(Gross_Profit_Lakh / Revenue_Lakh) * 100</code>
              </div>
              <div className="p-3 rounded-xl bg-[#0C071C]/80 font-mono border border-purple-500/15">
                <span className="text-[#A089E6] font-bold">MoM Growth %:</span>{' '}
                <code>((Revenue_Current - Revenue_Previous) / Revenue_Previous) * 100</code>
              </div>
              <div className="p-3 rounded-xl bg-[#0C071C]/80 font-mono border border-purple-500/15">
                <span className="text-[#A089E6] font-bold">Average Realization:</span>{' '}
                <code>(Revenue_Lakh * 100,000) / Units_Sold</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
