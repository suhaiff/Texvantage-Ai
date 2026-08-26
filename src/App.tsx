import React, { useState, useEffect } from 'react';
import { User } from './types';
import { Navbar } from './components/Navbar';
import { AIWorkspace } from './components/AIWorkspace';
import { DashboardView } from './components/DashboardView';
import { LedgerView } from './components/LedgerView';
import { BenchmarkView } from './components/BenchmarkView';
import { SecurityView } from './components/SecurityView';
import { DatasetManager } from './components/DatasetManager';
import { LoginView } from './components/LoginView';
import { RegisterView } from './components/RegisterView';
import { apiClient } from './services/apiClient';
import { RefreshCw } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'ai' | 'dashboard' | 'ledger' | 'datasets' | 'benchmark' | 'governance'>('dashboard');
  const [initialAIQuery, setInitialAIQuery] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  const [authView, setAuthView] = useState<'login' | 'register'>('login');

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

  const handleOpenAIQuery = (query: string) => {
    setInitialAIQuery(query);
    setActiveTab('ai');
  };

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    setActiveTab(user.role === 'ADMIN' ? 'benchmark' : 'dashboard');
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4 text-white">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-sm font-mono text-slate-400">Loading...</p>
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
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Top Navigation & Persona Switcher */}
      <Navbar
        currentUser={currentUser}
        onSelectUser={user => {
          if (!user) {
            setCurrentUser(null);
          } else {
            setCurrentUser(user);
          }
        }}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Tab Views */}
      <main className="flex-1">
        {activeTab === 'ai' && <AIWorkspace key={currentUser.id} currentUser={currentUser} />}

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
