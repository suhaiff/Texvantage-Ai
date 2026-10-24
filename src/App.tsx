import React, { useState, useEffect } from 'react';
import { User } from './types';
import { Sidebar } from './components/Sidebar';
import { AIWorkspace } from './components/AIWorkspace';
import { DashboardView } from './components/DashboardView';
import { LedgerView } from './components/LedgerView';
import { BenchmarkView } from './components/BenchmarkView';
import { SecurityView } from './components/SecurityView';
import { DatasetManager } from './components/DatasetManager';
import { LoginView } from './components/LoginView';
import { RegisterView } from './components/RegisterView';
import { apiClient } from './services/apiClient';
import { RefreshCw, PanelLeftOpen } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'ai' | 'dashboard' | 'ledger' | 'datasets' | 'benchmark' | 'governance'>('ai');
  const [initialAIQuery, setInitialAIQuery] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversationLoadTrigger, setConversationLoadTrigger] = useState<number>(0);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('tv_sidebar_open');
    return saved !== null ? saved === 'true' : true;
  });

  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  const toggleSidebar = () => {
    setSidebarOpen(prev => {
      const next = !prev;
      localStorage.setItem('tv_sidebar_open', String(next));
      return next;
    });
  };

  const fetchConversations = async () => {
    try {
      const list = await apiClient.chat.getConversations();
      setConversations(list || []);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    }
  };

  // Authenticate session on mount with authoritative backend
  useEffect(() => {
    const initAuth = async () => {
      if (!apiClient.getToken()) {
        setInitializing(false);
        return;
      }
      try {
        const profile = await apiClient.auth.getProfile();
        setCurrentUser(profile);
      } catch (err) {
        console.error('Session validation failed:', err);
        apiClient.auth.logout();
      } finally {
        setInitializing(false);
      }
    };
    initAuth();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchConversations();
    }
  }, [currentUser]);

  const handleOpenAIQuery = (query: string) => {
    setInitialAIQuery(query);
    setActiveTab('ai');
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    setActiveTab('ai');
    setInitialAIQuery(null);
    setConversationLoadTrigger(prev => prev + 1);
  };

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setInitialAIQuery(null);
    setActiveTab('ai');
    setConversationLoadTrigger(prev => prev + 1);
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      await apiClient.chat.renameConversation(id, newTitle);
      await fetchConversations();
    } catch (err) {
      console.error('Failed to rename conversation:', err);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await apiClient.chat.deleteConversation(id);
      if (activeConversationId === id) {
        setActiveConversationId(null);
      }
      await fetchConversations();
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const handleClearAllConversations = async () => {
    try {
      await apiClient.chat.clearAllConversations();
      setActiveConversationId(null);
      await fetchConversations();
    } catch (err) {
      console.error('Failed to clear conversations:', err);
    }
  };

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    setActiveTab('ai');
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-tv-base flex flex-col items-center justify-center space-y-4 text-white">
        <RefreshCw className="w-8 h-8 text-tv-accent animate-spin" />
        <p className="text-sm font-mono text-tv-text-muted">Loading...</p>
      </div>
    );
  }

  if (!currentUser) {
    if (authView === 'register') {
      return <RegisterView onRegisterSuccess={handleAuthSuccess} onNavigateToLogin={() => setAuthView('login')} />;
    }
    return <LoginView onLoginSuccess={handleAuthSuccess} onNavigateToRegister={() => setAuthView('register')} />;
  }

  return (
    <div className="min-h-screen bg-tv-base text-tv-text-primary flex flex-row font-sans selection:bg-tv-accent selection:text-slate-900 relative">
      {/* Sidebar Navigation (Collapsible drawer with sliding transition) */}
      <Sidebar
        currentUser={currentUser}
        onSelectUser={user => {
          if (!user) {
            setCurrentUser(null);
            setConversations([]);
            setActiveConversationId(null);
          } else {
            setCurrentUser(user);
          }
        }}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        onClearAllConversations={handleClearAllConversations}
        isOpen={sidebarOpen}
        onToggleCollapse={toggleSidebar}
      />

      {/* Floating Toggle Button when Sidebar is collapsed (ChatGPT style) */}
      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          title="Open sidebar"
          className="fixed top-3.5 left-3.5 z-40 p-2.5 rounded-xl bg-[#130C2E]/85 hover:bg-[#1C123E] border border-purple-400/25 text-purple-200 hover:text-white shadow-[0_4px_20px_rgba(0,0,0,0.5),0_0_15px_rgba(109,74,255,0.25)] backdrop-blur-xl transition-all duration-200 cursor-pointer flex items-center justify-center hover:scale-105 active:scale-95"
          aria-label="Open sidebar"
        >
          <PanelLeftOpen className="w-4 h-4 text-[#A089E6]" />
        </button>
      )}

      {/* Main Tab Views */}
      <main className="flex-1 overflow-y-auto h-screen relative">
        {activeTab === 'ai' && (
          <AIWorkspace
            key={currentUser.id}
            currentUser={currentUser}
            initialQuery={initialAIQuery}
            activeConversationId={activeConversationId}
            setActiveConversationId={setActiveConversationId}
            onConversationUpdated={fetchConversations}
            loadTrigger={conversationLoadTrigger}
            sidebarOpen={sidebarOpen}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardView
            currentUser={currentUser}
            onOpenAIQuery={handleOpenAIQuery}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'ledger' && <LedgerView currentUser={currentUser} />}

        {activeTab === 'datasets' && (
          <DatasetManager
            currentUser={currentUser}
            onOpenAIQuery={handleOpenAIQuery}
            onDataIngested={() => {
              // Trigger any cross-tab refresh if needed
            }}
          />
        )}

        {activeTab === 'benchmark' && (
          <BenchmarkView
            currentUser={currentUser}
            onOpenAIQuery={handleOpenAIQuery}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'governance' && <SecurityView currentUser={currentUser} />}
      </main>
    </div>
  );
}
