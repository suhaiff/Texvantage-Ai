import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  Plus,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Mic,
  Volume2,
  VolumeX
} from 'lucide-react';
import { User, ChatMessage, ToolExecutionStep, AIArtifact } from '../types';
import { AIService } from '../services/aiService';
import { getTenantDisplayName } from './Sidebar';
import { KPICard, InteractiveChart, TableArtifactView, FileArtifactDownload } from './ArtifactComponents';

interface AIWorkspaceProps {
  currentUser: User;
  initialQuery?: string | null;
}

export const AIWorkspace: React.FC<AIWorkspaceProps> = ({ currentUser, initialQuery }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [liveSteps, setLiveSteps] = useState<ToolExecutionStep[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});

  const [isRecording, setIsRecording] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      
      recognition.onstart = () => setIsRecording(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputPrompt(prev => (prev ? prev + ' ' + transcript : transcript));
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
      
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
  };

  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const speakText = (text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#_`]/g, '').replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isOwner = currentUser.role === 'OWNER';
  const tenantLabel = getTenantDisplayName(currentUser);
  
  // Track if we have already processed the initial query
  const [processedInitial, setProcessedInitial] = useState(false);

  useEffect(() => {
    if (initialQuery && !processedInitial && messages.length === 0) {
      setProcessedInitial(true);
      handleSend(initialQuery);
    }
  }, [initialQuery, processedInitial, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveSteps, loading, statusMessage]);

  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputPrompt).trim();
    if (!textToSend || loading) return;

    setInputPrompt('');
    setLoading(true);
    setLiveSteps([]);
    setStatusMessage('Analyzing intent...');

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
          if (collectedArtifacts.some(existing => existing.id === artifact.id)) return;
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
          speakText(accumulatedText);
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
                content: `⚠️ **Error**: ${err?.message || 'Failed to stream response.'}`,
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
        'Compare portfolio revenue',
        'Find the highest Q4 margin',
        'Analyze Vardhman Spinning',
        'Generate executive report'
      ];
    }
    return [
      `Generate executive report for ${tenantLabel}`,
      `What datasets have I uploaded?`,
      `What were our total sales and margin this month?`,
      `Break down our product categories and margins`
    ];
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full w-full">
      {isEmpty ? (
        /* HERO LANDING PAGE */
        <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full px-6 animate-in fade-in duration-500 pb-16">
          <div className="text-center mb-10 w-full">
            <div className="text-tv-text-muted mb-2 font-medium">Good morning, Admin.</div>
            <h1 className="text-[42px] sm:text-[52px] font-medium tracking-tight text-tv-text-primary mb-2">
              HOW SHOULD I HELP YOU TODAY?
            </h1>
            <p className="text-[18px] text-tv-text-secondary">
              Your portfolio intelligence is ready when you are.
            </p>
          </div>

          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}
            className="w-full relative bg-tv-surface border border-tv-border rounded-[16px] p-2 shadow-2xl focus-within:ring-1 focus-within:ring-tv-accent transition-all mb-10"
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
                placeholder="Ask about your portfolio..."
                disabled={loading}
                className="flex-1 bg-transparent border-0 resize-none text-[16px] text-tv-text-primary placeholder-tv-text-muted focus:outline-none px-4 py-3 max-h-32"
              />

              {isSpeechSupported && (
                <button
                  type="button"
                  onClick={toggleRecording}
                  disabled={loading}
                  className={`p-3 rounded-[12px] transition-colors shrink-0 cursor-pointer ${
                    isRecording 
                      ? 'bg-rose-500 text-white animate-pulse' 
                      : 'bg-transparent text-tv-text-muted hover:text-tv-text-primary hover:bg-tv-surface'
                  }`}
                  title="Use voice input"
                >
                  <Mic className="w-5 h-5" />
                </button>
              )}

              <button
                type="submit"
                disabled={!inputPrompt.trim() || loading}
                className="bg-tv-accent hover:bg-tv-accent-hover disabled:bg-tv-border disabled:text-tv-text-muted text-slate-900 p-3 rounded-[12px] transition-colors shadow-sm shrink-0 font-bold cursor-pointer"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-5 px-4 pb-2 text-[13px] text-tv-text-muted font-mono">
              <span className="flex items-center gap-1.5 cursor-pointer hover:text-tv-text-primary transition-colors"><Plus className="w-3.5 h-3.5" /> Add data</span>
              <span className="flex items-center gap-1.5 cursor-pointer hover:text-tv-text-primary transition-colors">/ Commands</span>
              <span className="flex items-center gap-1.5 cursor-pointer hover:text-tv-text-primary transition-colors">@ Companies</span>
            </div>
          </form>

          <div className="w-full text-left max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-[14px] font-medium text-tv-text-muted uppercase tracking-wider">Try asking</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {getSuggestions().map((sug, sIdx) => (
                <button
                  key={sIdx}
                  type="button"
                  onClick={() => handleSend(sug)}
                  disabled={loading}
                  className="text-[14px] bg-transparent hover:bg-tv-surface border border-tv-border hover:border-tv-text-secondary text-tv-text-secondary hover:text-tv-text-primary px-4 py-3 rounded-[8px] transition-colors text-left flex items-start gap-2 cursor-pointer"
                >
                  <span className="flex-1 leading-snug">{sug}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* CONVERSATION VIEW */
        <div className="flex flex-col h-full relative">
          <div className="absolute top-0 right-0 p-4 z-10 bg-tv-base/90 backdrop-blur-sm border-b border-tv-border w-full flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-tv-text-primary">Jeevan Infotech AI</span>
              <span className="text-[11px] text-tv-text-muted">Enterprise BI</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setVoiceEnabled(!voiceEnabled);
                  if (voiceEnabled) window.speechSynthesis?.cancel();
                }}
                className={`text-[12px] flex items-center gap-1.5 cursor-pointer transition-colors ${voiceEnabled ? 'text-tv-accent' : 'text-tv-text-secondary hover:text-tv-text-primary'}`}
              >
                {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span>Voice</span>
              </button>
              <button
                onClick={() => setMessages([])}
                className="text-[12px] text-tv-text-secondary hover:text-tv-text-primary flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>New chat</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pt-16 pb-32 px-4 sm:px-6 md:px-8 custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-8">
              {messages.map(msg => {
                const isUser = msg.senderRole === 'user';
                const isExpanded = !!expandedSteps[msg.id];
                const hasSteps = msg.toolSteps && msg.toolSteps.length > 0;
                const hasArtifacts = msg.artifacts && msg.artifacts.length > 0;

                return (
                  <div key={msg.id} className="animate-in fade-in duration-300">
                    {isUser ? (
                      <div className="flex justify-end">
                        <div className="max-w-[85%] sm:max-w-[70%]">
                          <div className="text-[11px] font-bold text-tv-text-muted mb-1 uppercase tracking-wider text-right">You</div>
                          <div className="bg-tv-surface border border-tv-border text-tv-text-primary text-[15px] px-5 py-3.5 rounded-[16px] rounded-tr-[4px] leading-relaxed whitespace-pre-wrap">
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-start">
                        <div className="max-w-full w-full">
                          <div className="text-[11px] font-bold text-tv-text-muted mb-2 uppercase tracking-wider flex items-center gap-1.5">
                            <Bot className="w-3.5 h-3.5 text-tv-accent" />
                            <span>Jeevan Infotech AI</span>
                          </div>

                          <div className="space-y-4 text-tv-text-primary">
                            {/* Hidden/Collapsible Traces */}
                            {hasSteps && (
                              <div className="border border-tv-border rounded-[8px] bg-tv-base overflow-hidden">
                                <button
                                  onClick={() => toggleStepExpand(msg.id)}
                                  className="w-full flex items-center justify-between px-4 py-2.5 bg-tv-surface hover:bg-tv-surface/80 transition-colors cursor-pointer text-[12px] text-tv-text-secondary"
                                >
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    <span>Verified against portfolio records ({msg.toolSteps?.length} source{msg.toolSteps?.length !== 1 ? 's' : ''})</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span>Details</span>
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </div>
                                </button>
                                
                                {isExpanded && (
                                  <div className="p-4 border-t border-tv-border bg-tv-base space-y-2">
                                    <div className="text-[11px] text-tv-text-muted font-mono mb-2">Execution details</div>
                                    {msg.toolSteps?.map((step, idx) => (
                                      <div key={idx} className="flex flex-col gap-1 text-[12px] font-mono bg-tv-surface p-2 rounded">
                                        <div className="flex items-center justify-between">
                                          <span className="text-tv-accent">{step.tool}()</span>
                                          <span className="text-tv-text-muted">{step.timestamp}</span>
                                        </div>
                                        {step.resultSummary && (
                                          <div className="text-tv-text-secondary pl-2 border-l border-tv-border mt-1">
                                            {step.resultSummary}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Message Text */}
                            {msg.content && (
                              <div className="prose prose-invert max-w-none text-[15px] leading-relaxed">
                                {msg.content}
                              </div>
                            )}
                            {!msg.content && msg.isStreaming && (
                              <div className="flex items-center gap-2 text-tv-text-secondary text-[15px]">
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Analyzing...
                              </div>
                            )}

                            {/* Artifacts (Inline) */}
                            {hasArtifacts && (
                              <div className="pt-2 space-y-6">
                                {(() => {
                                  const arts = msg.artifacts || [];
                                  const kpis = arts.filter(a => a.type === 'kpi');
                                  const rest = arts.filter(a => a.type !== 'kpi');
                                  return (
                                    <>
                                      {kpis.length > 0 && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                          {kpis.map(art => (
                                            <KPICard key={art.id} title={art.title} data={art.data as any} />
                                          ))}
                                        </div>
                                      )}
                                      {rest.map(art => {
                                        if (art.type === 'chart') {
                                          return <div key={art.id} className="border border-tv-border rounded-[12px] bg-tv-surface p-4"><InteractiveChart title={art.title} data={art.data as any} /></div>;
                                        }
                                        if (art.type === 'table') {
                                          return <TableArtifactView key={art.id} title={art.title} data={art.data as any} />;
                                        }
                                        if (art.type === 'file') {
                                          return <FileArtifactDownload key={art.id} data={art.data as any} />;
                                        }
                                        return null;
                                      })}
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Loading Indicator */}
              {loading && !messages.find(m => m.senderRole === 'assistant' && m.isStreaming) && (
                <div className="flex justify-start animate-in fade-in duration-300">
                  <div className="max-w-full w-full">
                    <div className="text-[11px] font-bold text-tv-text-muted mb-2 uppercase tracking-wider flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5 text-tv-accent" />
                      <span>Jeevan Infotech AI</span>
                    </div>
                    <div className="flex items-center gap-3 text-[14px] text-tv-text-secondary">
                      <RefreshCw className="w-4 h-4 animate-spin text-tv-accent" />
                      {statusMessage || 'Processing query...'}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} className="h-4" />
            </div>
          </div>

          {/* Sticky Bottom Input */}
          <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-tv-base via-tv-base to-transparent pt-12 pb-6 px-4 sm:px-6 md:px-8">
            <div className="max-w-4xl mx-auto">
              <form
                onSubmit={e => {
                  e.preventDefault();
                  handleSend();
                }}
                className="relative bg-tv-surface border border-tv-border rounded-[14px] p-1.5 shadow-2xl focus-within:ring-1 focus-within:ring-tv-accent transition-all flex items-center gap-2"
              >
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
                  placeholder="Ask a follow-up..."
                  disabled={loading}
                  className="flex-1 bg-transparent border-0 resize-none text-[15px] text-tv-text-primary placeholder-tv-text-muted focus:outline-none px-4 py-2 max-h-32 custom-scrollbar"
                />
                {isSpeechSupported && (
                  <button
                    type="button"
                    onClick={toggleRecording}
                    disabled={loading}
                    className={`p-2.5 rounded-[10px] transition-colors shrink-0 cursor-pointer ${
                      isRecording 
                        ? 'bg-rose-500 text-white animate-pulse' 
                        : 'bg-transparent text-tv-text-muted hover:text-tv-text-primary hover:bg-tv-surface'
                    }`}
                    title="Use voice input"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!inputPrompt.trim() || loading}
                  className="bg-tv-accent hover:bg-tv-accent-hover disabled:bg-tv-border disabled:text-tv-text-muted text-slate-900 p-2.5 rounded-[10px] transition-colors shadow-sm shrink-0 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
