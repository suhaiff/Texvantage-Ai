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
  MessageSquare,
  Pencil,
  Trash2,
  PanelLeftClose,
  X,
  CheckCircle2,
  Server,
  User as UserIcon
} from 'lucide-react';
import { User } from '../types';
import { apiClient } from '../services/apiClient';

interface SidebarProps {
  currentUser: User;
  onSelectUser: (user: User | null) => void;
  activeTab: 'ai' | 'dashboard' | 'ledger' | 'datasets' | 'benchmark' | 'governance';
  setActiveTab: (tab: 'ai' | 'dashboard' | 'ledger' | 'datasets' | 'benchmark' | 'governance') => void;
  conversations?: Array<{ id: string; title: string; updated_at?: string }>;
  activeConversationId?: string | null;
  onSelectConversation?: (id: string) => void;
  onNewConversation?: () => void;
  onRenameConversation?: (id: string, newTitle: string) => Promise<void>;
  onDeleteConversation?: (id: string) => Promise<void>;
  onClearAllConversations?: () => Promise<void>;
  isOpen?: boolean;
  onToggleCollapse?: () => void;
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
  setActiveTab,
  conversations = [],
  activeConversationId = null,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
  onClearAllConversations,
  isOpen = true,
  onToggleCollapse
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const handleLogout = () => {
    apiClient.auth.logout();
    onSelectUser(null);
  };

  const handleSaveRename = async (id: string) => {
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await onRenameConversation?.(id, editTitle.trim());
    } finally {
      setEditingId(null);
    }
  };

  const tenantLabel = getTenantDisplayName(currentUser);
  const isAdmin = currentUser.role === 'ADMIN';

  const navItemClass = (isActive: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 cursor-pointer ${
      isActive
        ? 'bg-gradient-to-r from-purple-950/70 to-purple-900/40 text-white font-semibold border border-purple-400/35 shadow-[0_0_18px_rgba(160,137,230,0.18),inset_0_1px_1px_rgba(255,255,255,0.12)]'
        : 'text-purple-200/65 hover:text-white hover:bg-white/[0.04]'
    }`;

  return (
    <aside
      className={`bg-[#0C081D]/85 backdrop-blur-2xl border-r border-white/[0.07] flex flex-col h-screen shrink-0 transition-all duration-300 ease-in-out relative z-30 ${
        isOpen
          ? 'w-64 opacity-100 translate-x-0 overflow-hidden'
          : 'w-0 opacity-0 -translate-x-full overflow-hidden border-none pointer-events-none'
      }`}
    >
      {/* Header */}
      <div className="p-4 sm:p-5 shrink-0">
        <div className="flex items-center justify-between select-none mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#6D4AFF] to-[#A089E6] p-0.5 shadow-[0_0_20px_rgba(160,137,230,0.35)] flex items-center justify-center shrink-0">
              <div className="w-full h-full rounded-[10px] bg-[#0E0B1A]/40 backdrop-blur-xs flex items-center justify-center">
                <Layers className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="truncate">
              <div className="text-[14px] font-bold tracking-tight text-white truncate flex items-center gap-1.5">
                <span>Jeevan Infotech AI</span>
              </div>
              <div className="text-[10px] text-purple-300/60 font-semibold uppercase tracking-wider mt-0.5">
                Enterprise BI
              </div>
            </div>
          </div>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title="Close sidebar (hide)"
              className="p-1.5 rounded-lg hover:bg-white/[0.06] text-purple-300/60 hover:text-white transition-colors cursor-pointer shrink-0 ml-1"
              aria-label="Close sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* New Analysis Button */}
        <button
          onClick={() => {
            onNewConversation?.();
            setActiveTab('ai');
          }}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#A089E6] via-[#8155F5] to-[#6D4AFF] hover:from-[#B8A4EE] hover:to-[#8155F5] text-white px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200 cursor-pointer shadow-[0_4px_20px_rgba(109,74,255,0.35)] hover:shadow-[0_6px_28px_rgba(109,74,255,0.55)] hover:scale-[1.01] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>New analysis</span>
        </button>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2 flex flex-col gap-6">
        <div>
          <div className="px-3 mb-2 text-[10px] font-bold text-purple-300/50 uppercase tracking-wider">
            Workspace
          </div>
          <nav className="flex flex-col gap-1">
            <button
              onClick={() => setActiveTab('ai')}
              className={navItemClass(activeTab === 'ai')}
            >
              <Bot className={`w-4 h-4 ${activeTab === 'ai' ? 'text-[#A089E6] drop-shadow-[0_0_8px_rgba(160,137,230,0.6)]' : ''}`} />
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
              className={navItemClass(activeTab === 'benchmark') + (!isAdmin ? ' opacity-40 cursor-not-allowed hover:bg-transparent hover:text-purple-300/40' : '')}
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

        {/* Conversations History */}
        <div>
          <div className="px-3 mb-2 flex items-center justify-between text-[10px] font-bold text-purple-300/50 uppercase tracking-wider">
            <span>Conversations</span>
            {conversations.length > 0 && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  if (window.confirm('Clear all conversation history?')) {
                    onClearAllConversations?.();
                  }
                }}
                title="Clear all conversation history"
                className="hover:text-rose-400 transition-colors cursor-pointer lowercase text-[10px]"
              >
                clear all
              </button>
            )}
          </div>
          <nav className="flex flex-col gap-0.5">
            {conversations.length === 0 ? (
              <div className="px-3 py-2 text-xs text-purple-300/40 italic">
                No past conversations
              </div>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`group flex items-center justify-between gap-1 px-3 py-2 rounded-lg text-[13px] transition-all cursor-pointer ${
                    activeConversationId === conv.id
                      ? 'bg-purple-950/60 text-white font-medium border border-purple-400/30 shadow-[0_0_12px_rgba(160,137,230,0.12)]'
                      : 'text-purple-200/60 hover:text-white hover:bg-white/[0.04]'
                  }`}
                  onClick={() => {
                    onSelectConversation?.(conv.id);
                    setActiveTab('ai');
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60 text-purple-300" />
                    {editingId === conv.id ? (
                      <input
                        type="text"
                        autoFocus
                        value={editTitle}
                        onClick={e => e.stopPropagation()}
                        onChange={e => setEditTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveRename(conv.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        onBlur={() => handleSaveRename(conv.id)}
                        className="w-full bg-[#181033] text-xs px-2 py-1 rounded-md border border-purple-400 text-white outline-none"
                      />
                    ) : (
                      <span className="truncate text-left text-xs" title={conv.title}>
                        {conv.title}
                      </span>
                    )}
                  </div>
                  {/* Actions on hover */}
                  {editingId !== conv.id && (
                    <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                      <button
                        title="Rename"
                        onClick={e => {
                          e.stopPropagation();
                          setEditingId(conv.id);
                          setEditTitle(conv.title);
                        }}
                        className="p-1 hover:text-purple-300 transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        title="Delete"
                        onClick={e => {
                          e.stopPropagation();
                          if (window.confirm(`Delete conversation "${conv.title}"?`)) {
                            onDeleteConversation?.(conv.id);
                          }
                        }}
                        className="p-1 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </nav>
        </div>
      </div>

      {/* Footer / User Profile */}
      <div className="p-3 border-t border-white/[0.07] shrink-0 bg-[#0A0617]/40 backdrop-blur-md">
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/[0.06] border border-transparent hover:border-purple-400/20 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              {/* First letter avatar badge - modern AI agent styling */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#6D4AFF] to-[#A089E6] text-white flex items-center justify-center font-bold text-xs shadow-[0_0_12px_rgba(160,137,230,0.35)] border border-purple-300/40 shrink-0">
                {currentUser.name ? currentUser.name.trim().charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="text-left overflow-hidden">
                <div className="text-[13px] font-semibold text-white truncate leading-tight">
                  {currentUser.name}
                </div>
                <div className="text-[10px] text-purple-300/60 truncate flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full ${
                      isAdmin ? 'bg-[#A089E6] shadow-[0_0_6px_#A089E6]' : 'bg-emerald-400'
                    }`}
                  />
                  <span className="truncate">{tenantLabel}</span>
                </div>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-purple-300/60 group-hover:text-white shrink-0 transition-colors" />
          </button>

          {/* Profile Dropdown */}
          {dropdownOpen && (
            <div className="absolute bottom-full left-0 w-full mb-2 bg-[#140D2E]/95 border border-purple-400/30 rounded-xl shadow-2xl backdrop-blur-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="px-3.5 py-3 border-b border-white/[0.08] bg-purple-950/40 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#6D4AFF] to-[#A089E6] text-white flex items-center justify-center font-bold text-xs shadow-[0_0_10px_rgba(160,137,230,0.3)] border border-purple-300/30 shrink-0">
                  {currentUser.name ? currentUser.name.trim().charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="overflow-hidden">
                  <div className="text-[13px] font-semibold text-white truncate">{currentUser.name}</div>
                  <div className="text-[11px] text-purple-300/60 truncate mt-0.5">{currentUser.email}</div>
                </div>
              </div>
              <div className="p-1.5 space-y-1">
                {/* Settings button inside profile dropdown above log out */}
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    setShowSettingsModal(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer text-purple-200/80 hover:text-white hover:bg-white/[0.08]"
                >
                  <Settings className="w-3.5 h-3.5 text-[#A089E6]" />
                  <span className="text-[13px] font-medium">Settings</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer text-rose-300 hover:bg-rose-500/15"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span className="text-[13px] font-medium">Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#140D2E] border border-purple-400/30 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-5 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowSettingsModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-purple-300/60 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-950/70 border border-purple-400/30 flex items-center justify-center text-[#A089E6]">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Application Settings</h3>
                <p className="text-xs text-purple-300/60">Executive identity & system preferences</p>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div className="bg-[#0C071C]/70 border border-purple-400/15 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-300/60">Logged In As</span>
                  <span className="font-semibold text-white">{currentUser.name}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-300/60">Email</span>
                  <span className="font-mono text-purple-200/90">{currentUser.email}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-300/60">Assigned Entity</span>
                  <span className="text-[#A089E6] font-semibold">{tenantLabel}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-300/60">Role</span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-950 border border-purple-400/30 text-[10px] font-mono text-purple-200 uppercase">
                    {currentUser.role}
                  </span>
                </div>
              </div>

              <div className="bg-[#0C071C]/70 border border-purple-400/15 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-300/60">Isolation Boundary</span>
                  <span className="text-emerald-400 flex items-center gap-1 font-semibold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Enforced (Row-Level)
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-300/60">Interface Theme</span>
                  <span className="text-white text-[11px]">Radiant Dark Violet</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-300/60">AI Intelligence Core</span>
                  <span className="text-purple-200 text-[11px] font-mono">Gemini 2.5 Flash Verified</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="bg-gradient-to-r from-[#A089E6] to-[#6D4AFF] hover:from-[#B8A4EE] hover:to-[#8155F5] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-[0_0_12px_rgba(109,74,255,0.3)] cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
