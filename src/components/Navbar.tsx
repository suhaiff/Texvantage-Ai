import React, { useState } from 'react';
import {
  Building2,
  Shield,
  Layers,
  BarChart3,
  Bot,
  FileSpreadsheet,
  Users,
  ChevronDown,
  Lock,
  Sparkles,
  Award,
  RefreshCw,
  Database,
  Menu,
  X
} from 'lucide-react';
import { User } from '../types';
import { apiClient } from '../services/apiClient';

interface NavbarProps {
  currentUser: User;
  onSelectUser: (user: User | null) => void;
  activeTab: 'ai' | 'dashboard' | 'ledger' | 'datasets' | 'benchmark' | 'governance';
  setActiveTab: (tab: 'ai' | 'dashboard' | 'ledger' | 'datasets' | 'benchmark' | 'governance') => void;
}

export const getTenantDisplayName = (user: User | null | undefined): string => {
  if (!user) return 'Loading authorized tenant...';
  if (user.role === 'ADMIN') return 'Global Portfolio (10 Enterprises)';
  const name = user.companyName || user.company_name;
  if (name && name.trim().length > 0) return name;
  const id = user.companyId || user.company_id;
  if (id && id.trim().length > 0) {
    return id;
  }
  return 'Tenant not assigned';
};

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onSelectUser,
  activeTab,
  setActiveTab
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = () => {
    apiClient.auth.logout();
    onSelectUser(null);
  };

  const isOwner = currentUser.role === 'OWNER';
  const tenantLabel = getTenantDisplayName(currentUser);

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-lg">
      {/* Top Banner: Tenant Isolation Notice */}
      <div className="bg-gradient-to-r from-blue-900/60 via-indigo-900/40 to-slate-900 px-4 py-1.5 text-xs text-slate-300 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2 truncate">
          <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="font-semibold text-emerald-400 shrink-0">FastAPI TenantGuard Active:</span>
          <span className="truncate">
            {currentUser.role === 'ADMIN'
              ? 'Authorized for Global Portfolio (10/10 Textile Enterprises)'
              : `Strict Boundary Enforced: Scoped exclusively to ${tenantLabel}`}
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-400 shrink-0">
          <span>FastAPI REST + SSE</span>
          <span>•</span>
          <span>Server-Side Tool Execution</span>
        </div>
      </div>

      {/* Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand Logo & Name */}
          <div
            className="flex items-center gap-3 cursor-pointer select-none shrink-0"
            onClick={() => setActiveTab(isOwner ? 'dashboard' : 'benchmark')}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-white">TexVantage</span>
                <span className="bg-blue-600/30 text-blue-400 border border-blue-500/30 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded tracking-wide">
                  AI BI
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-none">Enterprise Business Intelligence</p>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1.5 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/60 shadow-inner">
            {/* Overview / Dashboard */}
            <button
              id="nav-tab-overview"
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Overview</span>
            </button>

            {/* My Data (DatasetManager) */}
            <button
              id="nav-tab-mydata"
              onClick={() => setActiveTab('datasets')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'datasets'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Database className="w-4 h-4 text-emerald-400" />
              <span>My Data</span>
            </button>

            {/* AI Advisor */}
            <button
              id="nav-tab-ai"
              onClick={() => setActiveTab('ai')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'ai'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Bot className="w-4 h-4 text-indigo-300" />
              <span>AI Advisor</span>
              <Sparkles className="w-3 h-3 text-amber-300 animate-pulse" />
            </button>

            {/* Financial Ledger */}
            <button
              id="nav-tab-ledger"
              onClick={() => setActiveTab('ledger')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'ledger'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Financial Ledger</span>
            </button>

            {/* Command Center (Admin Only / Restricted) */}
            {currentUser.role === 'ADMIN' ? (
              <button
                id="nav-tab-command-center"
                onClick={() => setActiveTab('benchmark')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'benchmark'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                <Award className="w-4 h-4 text-amber-400" />
                <span>Command Center</span>
              </button>
            ) : (
              <button
                id="nav-tab-command-center-locked"
                onClick={() => setActiveTab('benchmark')}
                title="Admin restricted"
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'benchmark'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
                }`}
              >
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Command Center</span>
              </button>
            )}

            {/* Governance */}
            <button
              id="nav-tab-governance"
              onClick={() => setActiveTab('governance')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'governance'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Governance</span>
            </button>
          </nav>

          {/* User Profile & Demo Switcher */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <button
                id="persona-switcher-btn"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 px-3 py-1.5 rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-7 h-7 rounded-full object-cover border border-slate-600"
                />
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-semibold text-white leading-tight">{currentUser.name}</div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full ${
                        currentUser.role === 'ADMIN' ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                    />
                    <span className="truncate max-w-[140px]">
                      {currentUser.role === 'ADMIN' ? 'Central Admin' : tenantLabel}
                    </span>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />
              </button>

              {/* Dropdown Menu for Profile */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-4 py-4 bg-slate-800/80 border-b border-slate-700">
                    <div className="text-sm font-bold text-white truncate">{currentUser.name}</div>
                    <div className="text-xs text-slate-400 truncate mt-0.5">{currentUser.email}</div>
                  </div>

                  <div className="p-2">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer text-rose-400 hover:bg-rose-500/10"
                    >
                      <Lock className="w-4 h-4" />
                      <span className="text-sm font-medium">Log out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Sub-Navigation Bar — Prominently and ALWAYS visible on all viewports */}
      <div className="bg-slate-950/90 border-t border-slate-800/80 px-4 sm:px-6 lg:px-8 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <nav className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5 w-full">
            {/* Overview / Dashboard */}
            <button
              id="subnav-tab-overview"
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-blue-600 text-white shadow-md ring-1 ring-blue-400/40'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700/80 border border-slate-700/60'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>

            {/* My Data (DatasetManager) */}
            <button
              id="subnav-tab-mydata"
              onClick={() => setActiveTab('datasets')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                activeTab === 'datasets'
                  ? 'bg-blue-600 text-white shadow-md ring-1 ring-blue-400/40'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700/80 border border-slate-700/60'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>My Data</span>
            </button>

            {/* AI Advisor */}
            <button
              id="subnav-tab-ai"
              onClick={() => setActiveTab('ai')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                activeTab === 'ai'
                  ? 'bg-blue-600 text-white shadow-md ring-1 ring-blue-400/40'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700/80 border border-slate-700/60'
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-indigo-300" />
              <span>AI Advisor</span>
              <Sparkles className="w-3 h-3 text-amber-300 animate-pulse" />
            </button>

            {/* Financial Ledger */}
            <button
              id="subnav-tab-ledger"
              onClick={() => setActiveTab('ledger')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                activeTab === 'ledger'
                  ? 'bg-blue-600 text-white shadow-md ring-1 ring-blue-400/40'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700/80 border border-slate-700/60'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Financial Ledger</span>
            </button>

            {/* Command Center (Admin Only / Restricted) */}
            {currentUser.role === 'ADMIN' ? (
              <button
                id="subnav-tab-command-center"
                onClick={() => setActiveTab('benchmark')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  activeTab === 'benchmark'
                    ? 'bg-blue-600 text-white shadow-md ring-1 ring-blue-400/40'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700/80 border border-slate-700/60'
                }`}
              >
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>Command Center</span>
              </button>
            ) : (
              <button
                id="subnav-tab-command-center-locked"
                onClick={() => setActiveTab('benchmark')}
                title="Admin restricted — click to view RBAC boundary"
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  activeTab === 'benchmark'
                    ? 'bg-blue-600 text-white shadow-md ring-1 ring-blue-400/40'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700/80 border border-slate-700/60'
                }`}
              >
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Command Center</span>
              </button>
            )}

            {/* Governance */}
            <button
              id="subnav-tab-governance"
              onClick={() => setActiveTab('governance')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                activeTab === 'governance'
                  ? 'bg-blue-600 text-white shadow-md ring-1 ring-blue-400/40'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700/80 border border-slate-700/60'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Governance</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};


