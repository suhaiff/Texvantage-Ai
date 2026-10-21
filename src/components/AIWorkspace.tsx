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
import { MarkdownRenderer } from './MarkdownRenderer';

interface AIWorkspaceProps {
  currentUser: User;
  initialQuery?: string | null;
}

const getPoliteClosing = (prompt?: string): string => {
  const p = (prompt || '').toLowerCase();
  
  if (p.includes('top 3') || p.includes('highest margin') || p.includes('most profitable')) {
    return 'Thank you for reviewing our highest margin textile mills. Wishing your enterprise sustained profitability and operational excellence! Would you like to explore turnaround strategies for lagging mills or compare production volumes?';
  }
  if (p.includes('highest revenue') || p.includes('revenue leader') || p.includes('top revenue')) {
    return 'Thank you for exploring our top revenue generators. Wishing your business expanding market share and commercial success! Would you like to analyze profit margin conversion or review monthly shipment velocity?';
  }
  if (p.includes('lowest margin') || p.includes('weakest') || p.includes('laggard') || p.includes('decline') || p.includes('why did')) {
    return 'Thank you for examining operational turnaround areas. Wishing your team swift recovery and efficiency gains! Would you like to drill into plant capacity utilization or analyze raw material COGS structures?';
  }
  if (p.includes('total revenue') || p.includes('across all') || p.includes('portfolio revenue')) {
    return 'Thank you for consulting portfolio financial aggregates. Wishing your leadership team strategic clarity and strong fiscal stewardship! Would you like an enterprise-by-enterprise breakdown or a downloadable audit workbook?';
  }
  if (p.includes(' vs ') || p.includes('versus') || p.includes('compare apex and boutique')) {
    return 'Thank you for reviewing this enterprise comparative analysis. Wishing both facilities peak manufacturing throughput! Would you like to compare their 12-month margin trajectories or fabric category economics?';
  }
  if (p.includes('product') || p.includes('category') || p.includes('fabric mix')) {
    return 'Thank you for reviewing product category economics. Wishing your sales lines high-margin order wins! Would you like a breakdown of customer segments or recommendations for production capacity shifts?';
  }
  if (p.includes('trend') || p.includes('monthly') || p.includes('sales trend')) {
    return 'Thank you for evaluating monthly financial trajectories. Wishing your business consistent growth and healthy cash flows! Would you like to forecast the upcoming quarter or analyze seasonal peak drivers?';
  }
  if (p.includes('capacity utilization') || p.includes('cogs') || p.includes('explain')) {
    return 'Thank you for consulting TexVantage business principles. Wishing your management team operational rigor and benchmark performance! Would you like to inspect real portfolio figures or identify optimization levers?';
  }
  if (p.includes('apex') || p.includes('vardhman') || p.includes('spin')) {
    return 'Thank you for reviewing Textile A (Apex Spinners) performance! Wishing your operations maximum throughput. Would you like to compare this against other mills or review monthly volume trends?';
  }
  if (p.includes('boutique') || p.includes('silk')) {
    return 'Thank you for reviewing Textile B (Boutique Silks & Jacquard) performance! Wishing your luxury weaving lines high market prestige. Would you like to analyze high-end product categories or export orders?';
  }
  if (p.includes('crest') || p.includes('organic')) {
    return 'Thank you for reviewing Textile C (Crest Organic Cottons) performance! Wishing your sustainable fabric lines continued expansion. Would you like to inspect monthly growth velocity?';
  }
  if (p.includes('delta') || p.includes('synthetic')) {
    return 'Thank you for reviewing Textile D (Delta Synthetic Mills) performance! Wishing your facility a structured turnaround. Would you like to review capacity utilization or cost reduction options?';
  }
  if (p.includes('frontier') || p.includes('technical')) {
    return 'Thank you for reviewing Textile F (Frontier Technical Textiles) performance! Wishing your engineered textile operations sustained high margins. Would you like to evaluate expansion options?';
  }
  if (p.includes('jupiter') || p.includes('garment')) {
    return 'Thank you for reviewing Textile J (Jupiter Garment Exports) performance! Wishing your export lines maximum order book depth. Would you like to evaluate volume versus margin dynamics?';
  }
  if (p.includes('portfolio') || p.includes('compare') || p.includes('all compan')) {
    return 'Thank you for consulting TexVantage AI. Wishing your enterprise sustained growth and strategic clarity! Would you like me to examine specific mill margins or prepare an audit-ready financial report?';
  }
  return 'Thank you for consulting TexVantage AI! Wishing your enterprise sustained growth and operational clarity. Please let me know if you need any other assistance or follow-up insights.';
};

const getFollowUpQuestions = (prompt?: string): string[] => {
  const p = (prompt || '').toLowerCase();
  
  if (p.includes('top 3') || p.includes('highest margin') || p.includes('most profitable')) {
    return [
      'Why does Boutique Silks lead with 33.16% margin?',
      'Show lowest margin mills in the portfolio',
      'Compare Apex Spinners and Boutique Silks',
      'Download full portfolio financial report'
    ];
  }
  if (p.includes('highest revenue') || p.includes('revenue leader') || p.includes('top revenue')) {
    return [
      'Break down Jupiter Garments volume and margins',
      'Compare top 3 revenue mills vs top 3 margin mills',
      'Show 6-month revenue trajectory across all mills',
      'Download executive financial workbook'
    ];
  }
  if (p.includes('lowest margin') || p.includes('weakest') || p.includes('laggard') || p.includes('decline') || p.includes('why did')) {
    return [
      'What is capacity utilization at Delta Synthetic Mills?',
      'How can Empire Denim expand gross margins?',
      'Compare Delta Synthetic vs portfolio average',
      'Show 6-month margin trajectory by company'
    ];
  }
  if (p.includes('total revenue') || p.includes('across all') || p.includes('portfolio revenue')) {
    return [
      'Show top 3 highest margin mills',
      'Which company had the highest revenue?',
      'Break down top product categories and margins',
      'Download Portfolio Executive Report'
    ];
  }
  if (p.includes(' vs ') || p.includes('versus') || p.includes('compare apex and boutique')) {
    return [
      'Show 6-month sales trend for Apex Spinners',
      'Show 6-month profit trend for Boutique Silks',
      'Compare product categories across both mills',
      'Download executive financial comparison'
    ];
  }
  if (p.includes('product') || p.includes('category') || p.includes('fabric mix')) {
    return [
      'Which product category delivers the highest margin?',
      'Recommend capacity reallocation to boost margins',
      'Compare category revenue across mills',
      'Download category economics workbook'
    ];
  }
  if (p.includes('trend') || p.includes('monthly') || p.includes('sales trend')) {
    return [
      'What caused the peak and trough revenue swings?',
      'Show profit and margin trend for the same period',
      'Compare monthly growth rates across mills',
      'Download monthly ledger report'
    ];
  }
  if (p.includes('capacity utilization') || p.includes('cogs') || p.includes('explain')) {
    return [
      'What is capacity utilization across our 10 mills?',
      'Show mills operating below 75% capacity',
      'How does capacity utilization affect margin?',
      'Compare portfolio revenue across all companies'
    ];
  }
  if (p.includes('apex') || p.includes('vardhman') || p.includes('spin')) {
    return [
      'Compare Apex Spinners and Boutique Silks',
      'Show 6-month sales trend for Apex Spinners',
      'Break down top product categories for Apex Spinners',
      'What is the gross margin of Apex Spinners?'
    ];
  }
  if (p.includes('boutique') || p.includes('silk')) {
    return [
      'Compare Boutique Silks vs portfolio average',
      'What are the top luxury silk categories?',
      'Show 6-month profit trend for Boutique Silks',
      'Download executive report for Boutique Silks'
    ];
  }
  if (p.includes('delta') || p.includes('synthetic')) {
    return [
      'Why did Delta Synthetic Mills decline?',
      'What is capacity utilization at Delta Synthetic?',
      'Compare Delta Synthetic vs portfolio average',
      'Show 6-month sales trend for Delta Synthetic'
    ];
  }
  if (p.includes('frontier') || p.includes('technical')) {
    return [
      'Show 6-month sales trend for Frontier Technical Textiles',
      'Compare Frontier Technical vs Boutique Silks',
      'Break down product categories for Frontier Technical',
      'Download financial report'
    ];
  }
  if (p.includes('jupiter') || p.includes('garment')) {
    return [
      'Why does Jupiter Garment have 14.15% margin?',
      'Compare Jupiter Garment vs Apex Spinners',
      'Show 6-month sales trend for Jupiter Garments',
      'Download executive financial workbook'
    ];
  }
  if (p.includes('portfolio') || p.includes('compare') || p.includes('all compan')) {
    return [
      'Show top 3 highest margin mills',
      'Which company had the highest revenue?',
      'Why did Delta Synthetic Mills decline?',
      'Generate full executive financial report'
    ];
  }
  return [
    'Compare portfolio revenue across all companies',
    'Show top 3 highest margin mills',
    'Which company had the highest revenue?',
    'Generate full executive financial report'
  ];
};

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
  const handleSendRef = useRef<any>(null);

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
        setInputPrompt(prev => {
          const combined = prev ? prev + ' ' + transcript : transcript;
          // Auto-send after a tiny delay to let UI reflect
          setTimeout(() => {
            if (handleSendRef.current) {
              handleSendRef.current(combined);
            }
          }, 100);
          return combined;
        });
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

  useEffect(() => {
    handleSendRef.current = handleSend;
  });

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
        'Show top 3 highest margin mills',
        'Analyze Apex Spinners',
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
              {messages.map((msg, msgIdx) => {
                const isUser = msg.senderRole === 'user';
                const isExpanded = !!expandedSteps[msg.id];
                const hasSteps = msg.toolSteps && msg.toolSteps.length > 0;
                const hasArtifacts = msg.artifacts && msg.artifacts.length > 0;
                const prevUserMsg = messages
                  .slice(0, msgIdx)
                  .reverse()
                  .find(m => m.senderRole === 'user');
                const userPromptForMsg = prevUserMsg?.content || '';

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

                            {/* Message Text (ChatGPT / Claude / AI Studio Styled Markdown) */}
                            {msg.content ? (
                              <MarkdownRenderer
                                content={msg.content}
                                isStreaming={msg.isStreaming}
                              />
                            ) : msg.isStreaming ? (
                              <div className="flex items-center gap-3 p-3.5 bg-tv-surface/70 border border-tv-border/80 rounded-[12px] text-tv-text-secondary">
                                <RefreshCw className="w-4 h-4 animate-spin text-tv-accent shrink-0" />
                                <div className="text-[14px]">
                                  <span className="font-medium text-tv-text-primary">Analyzing verified ledger records...</span>
                                  <span className="block text-[12px] text-tv-text-muted mt-0.5">Synthesizing executive portfolio intelligence & metrics</span>
                                </div>
                              </div>
                            ) : null}



                            {/* Artifacts (Visual Analytics & Ledger Records) - Displayed ONLY AFTER Summary Completes */}
                            {hasArtifacts && !msg.isStreaming && (
                              <div className="mt-8 pt-6 border-t border-tv-border/80 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <div className="flex items-center justify-between pb-2 border-b border-tv-border/50">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-tv-accent" />
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-tv-text-secondary">
                                      Visual Analytics & Ledger Records ({msg.artifacts?.length} Artifact{msg.artifacts?.length !== 1 ? 's' : ''})
                                    </h4>
                                  </div>
                                  <span className="text-[11px] text-tv-text-muted font-mono">Interactive View</span>
                                </div>

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
                                          return (
                                            <div key={art.id} className="border border-tv-border rounded-[12px] bg-tv-surface p-4 shadow-sm">
                                              <InteractiveChart title={art.title} data={art.data as any} />
                                            </div>
                                          );
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

                            {/* Polite Single-Line Closing & Contextual Follow-Up Prompts — shown AFTER artifacts */}
                            {!msg.isStreaming && msg.content && (
                              <div className="pt-5 pb-1 space-y-2.5 animate-in fade-in duration-700 border-t border-tv-border/40 mt-6">
                                <div className="flex items-start sm:items-center gap-2 text-[13px] text-tv-text-secondary">
                                  <Sparkles className="w-3.5 h-3.5 text-tv-accent shrink-0 mt-0.5 sm:mt-0" />
                                  <span className="leading-relaxed">{getPoliteClosing(userPromptForMsg)}</span>
                                </div>

                                <div className="flex flex-wrap gap-2 pt-1">
                                  {getFollowUpQuestions(userPromptForMsg).map((chip, cIdx) => (
                                    <button
                                      key={cIdx}
                                      type="button"
                                      onClick={() => handleSend(chip)}
                                      disabled={loading}
                                      className="text-[12px] bg-tv-surface hover:bg-tv-base border border-tv-border hover:border-tv-accent/50 text-tv-text-secondary hover:text-tv-text-primary px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs group hover:scale-[1.02]"
                                    >
                                      <span className="text-tv-accent group-hover:translate-x-0.5 transition-transform font-bold">→</span>
                                      <span>{chip}</span>
                                    </button>
                                  ))}
                                </div>
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
