import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  Clock,
  Terminal,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Zap,
  Lock,
  Layers,
  ArrowRight
} from 'lucide-react';
import { User, ChatMessage, ToolExecutionStep, AIArtifact } from '../types';
import { AIService } from '../services/aiService';
import { getTenantDisplayName } from './Navbar';
import { KPICard, InteractiveChart, TableArtifactView, FileArtifactDownload } from './ArtifactComponents';

interface AIWorkspaceProps {
  currentUser: User;
}

export const AIWorkspace: React.FC<AIWorkspaceProps> = ({ currentUser }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [liveSteps, setLiveSteps] = useState<ToolExecutionStep[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isOwner = currentUser.role === 'OWNER';
  const tenantLabel = getTenantDisplayName(currentUser);

  // Initialize greeting on persona change
  useEffect(() => {
    const currentTenantLabel = getTenantDisplayName(currentUser);
    const initialGreeting: ChatMessage = {
      id: `init_${Date.now()}`,
      senderRole: 'assistant',
      content: isOwner
        ? `Hello **${currentUser.name}**. I am your executive business intelligence advisor for **${currentTenantLabel}**.\n\nI am connected to the real-time FastAPI analytics engine with row-level security. Ask me about monthly sales, margin trajectories, product economics, or request executive briefing reports.`
        : `Welcome **Alexander Sterling** (Central Portfolio & Operations Director).\n\nI am connected to the central FastAPI orchestrator with access across all **10 Textile Enterprises**. Ask me to benchmark revenue, compare operating margins across mills, or generate consolidated portfolio briefs.`,
      createdAt: new Date().toLocaleTimeString(),
      toolSteps: []
    };

    setMessages([initialGreeting]);
    setLiveSteps([]);
    setStatusMessage(null);
  }, [currentUser.id, currentUser.companyId, currentUser.companyName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveSteps, loading, statusMessage]);

  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputPrompt).trim();
    if (!textToSend || loading) return;

    setInputPrompt('');
    setLoading(true);
    setLiveSteps([]);
    setStatusMessage('Connecting to FastAPI AI Orchestrator...');

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

    setMessages(prev => [...prev, userMsg, assistantMsg]);

    const collectedSteps: ToolExecutionStep[] = [];
    const collectedArtifacts: AIArtifact[] = [];
    let accumulatedText = '';

    try {
      await AIService.streamQuery(textToSend, undefined, {
        onStatus: msg => {
          setStatusMessage(msg);
        },
        onToolStep: step => {
          // Update or add step
          const existingIdx = collectedSteps.findIndex(s => s.tool === step.tool);
          if (existingIdx >= 0) {
            collectedSteps[existingIdx] = step;
          } else {
            collectedSteps.push(step);
          }
          setLiveSteps([...collectedSteps]);
          setMessages(prev =>
            prev.map(m => (m.id === assistantMsgId ? { ...m, toolSteps: [...collectedSteps] } : m))
          );
        },
        onToken: token => {
          accumulatedText += token;
          setMessages(prev =>
            prev.map(m => (m.id === assistantMsgId ? { ...m, content: accumulatedText } : m))
          );
        },
        onArtifact: artifact => {
          collectedArtifacts.push(artifact);
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsgId ? { ...m, artifacts: [...collectedArtifacts] } : m
            )
          );
        },
        onDone: () => {
          setMessages(prev =>
            prev.map(m => (m.id === assistantMsgId ? { ...m, isStreaming: false } : m))
          );
        },
        onError: errMsg => {
          accumulatedText += `\n\n⚠️ **Error**: ${errMsg}`;
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsgId ? { ...m, content: accumulatedText, isStreaming: false } : m
            )
          );
        }
      });
    } catch (err: any) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: `⚠️ **Connection Error**: ${err?.message || 'Failed to stream response from backend server.'}`,
                isStreaming: false
              }
            : m
        )
      );
    } finally {
      setLoading(false);
      setStatusMessage(null);
      setLiveSteps([]);
    }
  };

  const toggleStepExpand = (msgId: string) => {
    setExpandedSteps(prev => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  const getSuggestions = () => {
    if (currentUser.role === 'ADMIN') {
      return [
        'Generate 10-enterprise consolidated executive Excel report',
        'Compare all 10 textile companies by revenue and margin',
        'What datasets have been uploaded across the portfolio?',
        'Which mill had the highest margin in Q4?',
        'Show 12-month summary for Vardhman Spinning'
      ];
    }

    return [
      `Generate executive Excel report for ${tenantLabel}`,
      `What datasets have I uploaded and what period is covered?`,
      `What were our total sales and margin this month?`,
      `What was our month-over-month revenue growth?`,
      `Break down our product categories and margins`
    ];
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-6xl mx-auto px-4 py-4">
      {/* Workspace Header Subtext */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 mb-4 shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Executive AI Intelligence Engine
              </h2>
              <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                FastAPI SSE Connected
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isOwner
                ? `Authorized Tenant: ${tenantLabel} (Row-Level Security Active)`
                : 'Central Portfolio Mode (Access across all 10 Textile Enterprises)'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMessages([])}
            className="text-xs text-slate-400 hover:text-slate-200 p-2 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            title="Clear Chat History"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear Chat</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
        {messages.map(msg => {
          const isUser = msg.senderRole === 'user';
          const isExpanded = !!expandedSteps[msg.id];
          const hasSteps = msg.toolSteps && msg.toolSteps.length > 0;
          const hasArtifacts = msg.artifacts && msg.artifacts.length > 0;

          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in duration-150`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-1">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-3xl rounded-2xl p-4 shadow-sm space-y-3 ${
                  isUser
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none'
                }`}
              >
                {/* Tool Execution Step Trace (Collapsible) */}
                {!isUser && hasSteps && (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950/60 mb-3">
                    <button
                      onClick={() => toggleStepExpand(msg.id)}
                      className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Terminal className="w-3.5 h-3.5 text-blue-500" />
                        <span>
                          FastAPI Engine Traces ({msg.toolSteps?.length} tool
                          {msg.toolSteps && msg.toolSteps.length > 1 ? 's' : ''} executed)
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <span>{isExpanded ? 'Hide' : 'Inspect'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs font-mono">
                        {msg.toolSteps?.map((step, sIdx) => (
                          <div
                            key={sIdx}
                            className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="font-bold text-blue-600 dark:text-blue-400">{step.tool}()</span>
                              </div>
                              <span className="text-[10px] text-slate-400">{step.timestamp}</span>
                            </div>
                            {step.resultSummary && (
                              <p className="text-[11px] text-slate-600 dark:text-slate-400 pl-4 border-l-2 border-slate-300 dark:border-slate-700">
                                {step.resultSummary}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Message Body Content */}
                <div className="prose dark:prose-invert max-w-none text-xs leading-relaxed whitespace-pre-wrap">
                  {msg.content || (msg.isStreaming ? 'Analyzing verified records...' : '')}
                </div>

                {/* Rich Structured Artifacts */}
                {!isUser && hasArtifacts && (
                  <div className="pt-2 space-y-4">
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

                {/* Timestamp & Role Indicator */}
                <div
                  className={`text-[10px] pt-1 flex items-center justify-between ${
                    isUser ? 'text-blue-200' : 'text-slate-400'
                  }`}
                >
                  <span>{isUser ? 'You' : 'TexVantage FastAPI Engine'}</span>
                  <span>{msg.createdAt}</span>
                </div>
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-slate-700 text-white flex items-center justify-center shrink-0 shadow-sm mt-1">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Live Streaming Indicator & In-Progress Steps */}
        {loading && (
          <div className="flex gap-3 justify-start animate-in fade-in duration-150">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-1 animate-pulse">
              <Bot className="w-4 h-4" />
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-bl-none p-4 shadow-sm max-w-2xl w-full space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{statusMessage || 'Processing query with server tools...'}</span>
              </div>

              {/* Live tool step cards */}
              {liveSteps.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {liveSteps.map((step, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50 dark:bg-slate-950/80 p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-mono flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        {step.status === 'running' ? (
                          <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        )}
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {step.tool}()
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {step.status === 'running' ? 'Executing...' : 'Completed'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Prompts */}
      <div className="py-2 flex flex-wrap items-center gap-1.5 overflow-x-auto no-scrollbar">
        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 shrink-0 mr-1">
          <Zap className="w-3 h-3 text-amber-400" />
          Suggested:
        </span>
        {getSuggestions().map((sug, sIdx) => (
          <button
            key={sIdx}
            type="button"
            onClick={() => handleSend(sug)}
            disabled={loading}
            className="text-xs bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-full transition-colors shadow-xs cursor-pointer text-left"
          >
            {sug}
          </button>
        ))}
      </div>

      {/* Chat Input Box */}
      <form
        onSubmit={e => {
          e.preventDefault();
          handleSend();
        }}
        className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-lg focus-within:ring-2 focus-within:ring-blue-500/50 transition-all"
      >
        <div className="flex items-center gap-2">
          <textarea
            rows={1}
            value={inputPrompt}
            onChange={e => setInputPrompt(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              isOwner
                ? `Ask about ${tenantLabel} sales, margins, or economics...`
                : 'Ask for global comparisons, rankings, or 10-mill portfolio briefs...'
            }
            disabled={loading}
            className="flex-1 bg-transparent border-0 resize-none text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none px-3 py-2 max-h-32"
          />

          <button
            type="submit"
            disabled={!inputPrompt.trim() || loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white p-2.5 rounded-xl transition-colors shadow-sm shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
