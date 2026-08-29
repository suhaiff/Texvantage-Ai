import React, { useState } from 'react';
import {
  Layers,
  BarChart3,
  Bot,
  FileSpreadsheet,
  Database,
  Award,
  Shield,
  Plus,
  Settings,
  ChevronDown,
  Lock,
  MessageSquare
} from 'lucide-react';
import { User } from '../types';
import { apiClient } from '../services/apiClient';

interface SidebarProps {
  currentUser: User;
  onSelectUser: (user: User | null) => void;
  activeTab: 'ai' | 'dashboard' | 'ledger' | 'datasets' | 'benchmark' | 'governance';
  setActiveTab: (tab: 'ai' | 'dashboard' | 'ledger' | 'datasets' | 'benchmark' | 'governance') => void;
}

export const getTenantDisplayName = (user: User | null | undefined): string => {
  if (!user) return 'Loading...';
  if (user.role === 'ADMIN') return 'Global Portfolio';
  const name = user.companyName || user.company_name;
  if (name && name.trim().length > 0) return name;
  const id = user.companyId || user.company_id;
  if (id && id.trim().length > 0) return id;
  return 'Tenant not assigned';
};

export const Sidebar: React.FC<SidebarProps> = ({
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

  const tenantLabel = getTenantDisplayName(currentUser);
  const isAdmin = currentUser.role === 'ADMIN';

  const navItemClass = (isActive: boolean) =>
    `flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-colors cursor-pointer ${
      isActive
        ? 'bg-tv-surface text-tv-text-primary shadow-sm ring-1 ring-tv-border'
        : 'text-tv-text-secondary hover:text-tv-text-primary hover:bg-tv-surface/50'
    }`;

  return (
    <aside className="w-64 bg-tv-sidebar border-r border-tv-border flex flex-col h-screen overflow-hidden shrink-0">
      {/* Header */}
      <div className="p-4 sm:p-5 shrink-0">
        <div className="flex items-center gap-3 select-none mb-6">
          <div className="w-8 h-8 rounded-md bg-tv-surface border border-tv-border flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4 text-tv-text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-tv-text-primary">Jeevan Infotech AI</div>
            <div className="text-[10px] text-tv-text-muted font-medium uppercase tracking-wider mt-0.5">
              Enterprise BI
            </div>
          </div>
        </div>

        {/* New Analysis Button */}
        <button
          onClick={() => setActiveTab('ai')}
          className="w-full flex items-center justify-center gap-2 bg-tv-accent hover:bg-tv-accent-hover text-slate-900 px-4 py-2 rounded-md text-[13px] font-semibold transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New analysis</span>
        </button>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2 flex flex-col gap-6">
        <div>
          <div className="px-3 mb-2 text-[10px] font-semibold text-tv-text-muted uppercase tracking-wider">
            Workspace
          </div>
          <nav className="flex flex-col gap-0.5">
            <button
              onClick={() => setActiveTab('ai')}
              className={navItemClass(activeTab === 'ai')}
            >
              <Bot className="w-4 h-4" />
              <span>AI Advisor</span>
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={navItemClass(activeTab === 'dashboard')}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Overview</span>
            </button>
            <button
              onClick={() => setActiveTab('datasets')}
              className={navItemClass(activeTab === 'datasets')}
            >
              <Database className="w-4 h-4" />
              <span>Knowledge</span>
            </button>
            <button
              onClick={() => setActiveTab('ledger')}
              className={navItemClass(activeTab === 'ledger')}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Financial</span>
            </button>
            <button
              onClick={() => setActiveTab('benchmark')}
              disabled={!isAdmin}
              title={!isAdmin ? "Admin restricted" : undefined}
              className={navItemClass(activeTab === 'benchmark') + (!isAdmin ? ' opacity-50 cursor-not-allowed hover:bg-transparent hover:text-tv-text-secondary' : '')}
            >
              {isAdmin ? <Award className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              <span>Command Center</span>
            </button>
            <button
              onClick={() => setActiveTab('governance')}
              className={navItemClass(activeTab === 'governance')}
            >
              <Shield className="w-4 h-4" />
              <span>Governance</span>
            </button>
          </nav>
        </div>

        {/* Conversations History (Mock) */}
        <div>
          <div className="px-3 mb-2 text-[10px] font-semibold text-tv-text-muted uppercase tracking-wider">
            Conversations
          </div>
          <nav className="flex flex-col gap-0.5">
            {['Vardhman analysis', 'Q4 margin review', 'Portfolio summary'].map((title, i) => (
              <button
                key={i}
                className="flex items-center gap-3 px-3 py-1.5 rounded-md text-[13px] text-tv-text-muted hover:text-tv-text-primary hover:bg-tv-surface/30 transition-colors cursor-pointer text-left truncate"
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-50" />
                <span className="truncate">{title}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Footer / User Profile */}
      <div className="p-3 border-t border-tv-border shrink-0">
        <button
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] text-tv-text-secondary hover:text-tv-text-primary hover:bg-tv-surface transition-colors cursor-pointer text-left mb-2"
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span>Settings</span>
        </button>

        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-tv-surface transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-6 h-6 rounded-full object-cover border border-tv-border"
              />
              <div className="text-left overflow-hidden">
                <div className="text-[13px] font-medium text-tv-text-primary truncate leading-tight">
                  {currentUser.name}
                </div>
                <div className="text-[10px] text-tv-text-muted truncate flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full ${
                      isAdmin ? 'bg-tv-accent' : 'bg-emerald-400'
                    }`}
                  />
                  <span className="truncate">{tenantLabel}</span>
                </div>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-tv-text-muted group-hover:text-tv-text-primary shrink-0" />
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div className="absolute bottom-full left-0 w-full mb-1 bg-tv-surface border border-tv-border rounded-md shadow-xl overflow-hidden z-50">
              <div className="px-3 py-3 border-b border-tv-border bg-tv-base/50">
                <div className="text-[13px] font-semibold text-tv-text-primary truncate">{currentUser.name}</div>
                <div className="text-[11px] text-tv-text-muted truncate mt-0.5">{currentUser.email}</div>
              </div>
              <div className="p-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors cursor-pointer text-rose-400 hover:bg-rose-400/10"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span className="text-[13px] font-medium">Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
