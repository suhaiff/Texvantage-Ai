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
  MicOff,
  Volume2,
  VolumeX,
  Square,
  MoreVertical,
  Pencil,
  Trash2,
  X
} from 'lucide-react';
import { User, ChatMessage, ToolExecutionStep, AIArtifact } from '../types';
import { AIService } from '../services/aiService';
import { apiClient } from '../services/apiClient';
import { getTenantDisplayName } from './Sidebar';
import { KPICard, InteractiveChart, TableArtifactView, FileArtifactDownload } from './ArtifactComponents';
import { MarkdownRenderer } from './MarkdownRenderer';

interface AIWorkspaceProps {
  currentUser: User;
  initialQuery?: string | null;
  activeConversationId?: string | null;
  setActiveConversationId?: (id: string | null) => void;
  onConversationUpdated?: () => void;
  loadTrigger?: number;
  sidebarOpen?: boolean;
}

const getPoliteClosing = (prompt?: string, companies: any[] = []): string => {
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
  if (p.includes(' vs ') || p.includes('versus') || p.includes('compare')) {
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

  // Dynamic matching for any enterprise in database
  const matchedCompany = companies.find(c => {
    const name = (c.name || c.company_name || '').toLowerCase();
    const code = (c.code || '').toLowerCase();
    return (name && p.includes(name)) || (code && p.includes(code));
  });
  if (matchedCompany) {
    const cName = matchedCompany.name || matchedCompany.company_name;
    const cCode = matchedCompany.code ? ` (${matchedCompany.code})` : '';
    return `Thank you for reviewing ${cName}${cCode} performance! Wishing your operations maximum throughput. Would you like to compare this against other mills or review monthly volume trends?`;
  }

  if (p.includes('portfolio') || p.includes('compare') || p.includes('all compan')) {
    return 'Thank you for consulting TexVantage AI. Wishing your enterprise sustained growth and strategic clarity! Would you like me to examine specific mill margins or prepare an audit-ready financial report?';
  }
  return 'Thank you for consulting TexVantage AI! Wishing your enterprise sustained growth and operational clarity. Please let me know if you need any other assistance or follow-up insights.';
};

const getFollowUpQuestions = (prompt?: string, companies: any[] = []): string[] => {
  const p = (prompt || '').toLowerCase();
  const c0 = companies[0]?.name || companies[0]?.company_name || 'Jeevan Clothing Company';
  const c1 = companies[1]?.name || companies[1]?.company_name || 'Jeevan Sourcing Company';
  
  if (p.includes('top 3') || p.includes('highest margin') || p.includes('most profitable')) {
    return [
      `Show 6-month margin trajectory for ${c0}`,
      'Show lowest margin mills in the portfolio',
      `Compare ${c0} and ${c1}`,
      'Download full portfolio financial report'
    ];
  }
  if (p.includes('highest revenue') || p.includes('revenue leader') || p.includes('top revenue')) {
    return [
      `Break down ${c0} order volume and margins`,
      'Compare top 3 revenue mills vs top 3 margin mills',
      'Show 6-month revenue trajectory across all mills',
      'Download executive financial workbook'
    ];
  }
  if (p.includes('lowest margin') || p.includes('weakest') || p.includes('laggard') || p.includes('decline') || p.includes('why did')) {
    return [
      'Which mills operate with margins below portfolio average?',
      'How can lagging mills expand gross margins?',
      'Show 6-month margin trajectory by company',
      'Download Portfolio Executive Report'
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
  if (p.includes(' vs ') || p.includes('versus') || p.includes('compare')) {
    return [
      `Show 6-month sales trend for ${c0}`,
      `Show 6-month profit trend for ${c1}`,
      'Compare product categories across both mills',
      'Download executive financial comparison'
    ];
  }
  if (p.includes('product') || p.includes('category') || p.includes('fabric mix')) {
    return [
      'Which product category delivers the highest margin?',
      'Recommend production reallocation to boost margins',
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
      `What is capacity utilization across our ${companies.length || 8} mills?`,
      'Show mills operating below benchmark capacity',
      'How does capacity utilization affect margin?',
      'Compare portfolio revenue across all companies'
    ];
  }

  // Dynamic matching for any enterprise in database
  const matchedComp = companies.find(c => {
    const name = (c.name || c.company_name || '').toLowerCase();
    const code = (c.code || '').toLowerCase();
    return (name && p.includes(name)) || (code && p.includes(code));
  });
  if (matchedComp) {
    const name = matchedComp.name || matchedComp.company_name;
    const other = companies.find(c => c.id !== matchedComp.id)?.name || c1;
    return [
      `Compare ${name} and ${other}`,
      `Show 6-month sales trend for ${name}`,
      `Break down top product categories for ${name}`,
      `What is the gross margin of ${name}?`
    ];
  }

  if (p.includes('portfolio') || p.includes('compare') || p.includes('all compan')) {
    return [
      'Show top 3 highest margin mills',
      'Which company had the highest revenue?',
      `Compare ${c0} and ${c1}`,
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

export const AIWorkspace: React.FC<AIWorkspaceProps> = ({
  currentUser,
  initialQuery,
  activeConversationId,
  setActiveConversationId,
  onConversationUpdated,
  loadTrigger,
  sidebarOpen = true
}) => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [liveSteps, setLiveSteps] = useState<ToolExecutionStep[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleSaveRename = async () => {
    const targetId = activeConversationId || loadedIdRef.current;
    if (targetId && renameTitle.trim()) {
      try {
        await apiClient.chat.renameConversation(targetId, renameTitle.trim());
        onConversationUpdated?.();
      } catch (err) {
        console.error('Failed to rename conversation:', err);
      }
    }
    setShowRenameModal(false);
  };

  const isStreamingRef = useRef(false);
  const loadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    const fetchComps = async () => {
      try {
        const comps = await apiClient.companies.list();
        setCompanies(comps);
      } catch {}
    };
    fetchComps();
  }, []);

  // Load existing conversation messages when switching conversations or on load trigger
  useEffect(() => {
    // If we're currently streaming a new response, don't interrupt or reload
    if (isStreamingRef.current) return;

    if (!activeConversationId) {
      setMessages([]);
      loadedIdRef.current = null;
      return;
    }

    const loadConversation = async () => {
      setLoading(true);
      setStatusMessage('Loading conversation history...');
      try {
        const detail = await apiClient.chat.getConversation(activeConversationId);
        if (detail && detail.messages) {
          const loadedMsgs: ChatMessage[] = detail.messages.map((m: any) => ({
            id: m.id,
            senderRole: m.sender_role,
            content: m.content,
            createdAt: m.created_at ? new Date(m.created_at).toLocaleTimeString() : new Date().toLocaleTimeString(),
            artifacts: (m.artifacts || []).map((a: any) => {
              if (a.payload && a.payload.type) {
                return a.payload;
              }
              return {
                id: a.id,
                type: a.artifact_type,
                title: a.title,
                data: a.payload || {}
              };
            }),
            toolSteps: (m.thinking_steps || []).map((step: string) => ({
              tool: step,
              arguments: {},
              status: 'completed',
              resultSummary: step,
              timestamp: m.created_at ? new Date(m.created_at).toLocaleTimeString() : ''
            }))
          }));
          setMessages(loadedMsgs);
          loadedIdRef.current = activeConversationId;
        }
      } catch (err) {
        console.error('Failed to load conversation:', err);
      } finally {
        setLoading(false);
        setStatusMessage(null);
      }
    };
    loadConversation();
  }, [activeConversationId, loadTrigger]);

  const [isRecording, setIsRecording] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const handleSendRef = useRef<any>(null);
  const isSubmittingRef = useRef<boolean>(false);
  const isVoiceSubmittingRef = useRef<boolean>(false);

  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState<string | null>(null);
  const speakTimeoutRef = useRef<any>(null);
  const lastSpokenRef = useRef<{ text: string; time: number; msgId?: string } | null>(null);

  const cleanTextForSpeech = (rawText: string): string => {
    if (!rawText) return '';
    return rawText
      .replace(/```[\s\S]*?```/g, '') // remove code fences
      .replace(/`([^`]+)`/g, '$1') // inline code
      .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '') // images
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // links
      .replace(/^#{1,6}\s+/gm, '') // headings
      .replace(/\|[-:\s|]+\|/g, '') // table dividers
      .replace(/\|\s*([^|\n]+)\s*/g, '$1, ') // tables to commas
      .replace(/[*_~#]/g, '') // markdown emphasis
      .replace(/\s+/g, ' ')
      .replace(/,\s*,/g, ',')
      .trim();
  };

  const stopSpeaking = () => {
    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = null;
    }
    lastSpokenRef.current = null;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
    setIsSpeaking(false);
    setCurrentlySpeakingId(null);
  };

  const speakText = (text: string, msgId?: string, forceVoice: boolean = false) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (!forceVoice && !voiceEnabled) return;

    const cleanText = cleanTextForSpeech(text);
    if (!cleanText) return;

    // Deduplication guard: completely prevent speaking the exact same text or message twice within 2.5s
    const now = Date.now();
    if (
      lastSpokenRef.current &&
      (lastSpokenRef.current.msgId === msgId || lastSpokenRef.current.text === cleanText) &&
      now - lastSpokenRef.current.time < 2500
    ) {
      return;
    }
    lastSpokenRef.current = { text: cleanText, time: now, msgId };

    // Clear any previously pending speak timeout so multiple utterances are never queued simultaneously
    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = null;
    }

    try {
      window.speechSynthesis.cancel();
    } catch (_) {}

    speakTimeoutRef.current = setTimeout(() => {
      speakTimeoutRef.current = null;
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          const preferredVoice = voices.find(v =>
            (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Jenny') || v.name.includes('Aria') || v.name.includes('Zira')) && v.lang.startsWith('en')
          ) || voices.find(v => v.lang.startsWith('en')) || voices[0];

          if (preferredVoice) {
            utterance.voice = preferredVoice;
          }
        }

        utterance.onstart = () => {
          setIsSpeaking(true);
          if (msgId) setCurrentlySpeakingId(msgId);
        };

        utterance.onend = () => {
          setIsSpeaking(false);
          setCurrentlySpeakingId(null);
        };

        utterance.onerror = (e) => {
          console.warn('SpeechSynthesis event error:', e);
          setIsSpeaking(false);
          setCurrentlySpeakingId(null);
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('Speech synthesis execution failed:', err);
        setIsSpeaking(false);
        setCurrentlySpeakingId(null);
      }
    }, 60);
  };

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch (_) {}
      }
    };
  }, []);

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
        if (!event.results || event.results.length === 0) return;
        const transcript = event.results[0]?.[0]?.transcript?.trim();
        if (!transcript) return;

        // Atomic check to prevent double triggers in React
        if (isVoiceSubmittingRef.current || isSubmittingRef.current) return;
        isVoiceSubmittingRef.current = true;

        try {
          recognition.abort();
        } catch (_) {
          try {
            recognition.stop();
          } catch (_) {}
        }
        setIsRecording(false);

        setInputPrompt(transcript);

        if (handleSendRef.current) {
          handleSendRef.current(transcript, { fromVoice: true });
        }

        setTimeout(() => {
          isVoiceSubmittingRef.current = false;
        }, 1500);
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
      
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleRecording = () => {
    stopSpeaking();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
    }
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      isVoiceSubmittingRef.current = false;
      try {
        recognitionRef.current?.start();
      } catch (err) {
        console.error('Speech recognition start failed', err);
      }
    }
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

  const handleSend = async (customPrompt?: string, options?: { fromVoice?: boolean }) => {
    const textToSend = (customPrompt || inputPrompt).trim();
    if (!textToSend || isSubmittingRef.current || loading) return;
    isSubmittingRef.current = true;

    const isFromVoice = !!options?.fromVoice;
    stopSpeaking();

    let hasTurnDoneFired = false;

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
    isStreamingRef.current = true;

    try {
      await AIService.streamQuery(textToSend, activeConversationId || undefined, {
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
        onConversationId: id => {
          loadedIdRef.current = id;
          if (!activeConversationId) {
            setActiveConversationId?.(id);
          }
          onConversationUpdated?.();
        },
        onDone: () => {
          if (hasTurnDoneFired) return;
          hasTurnDoneFired = true;
          isStreamingRef.current = false;
          setMessages(prev =>
            prev.map(m => (m.id === assistantMsgId ? { ...m, isStreaming: false } : m))
          );
          // Auto voice feedback if prompt was spoken or if voice is enabled (reads exactly once)
          if (accumulatedText.trim()) {
            speakText(accumulatedText, assistantMsgId, isFromVoice || voiceEnabled);
          }
          onConversationUpdated?.();
        },
        onError: errMsg => {
          if (hasTurnDoneFired) return;
          hasTurnDoneFired = true;
          isStreamingRef.current = false;
          accumulatedText += `\n\n⚠️ **Error**: ${errMsg}`;
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsgId ? { ...m, content: accumulatedText, isStreaming: false } : m
            )
          );
          if (isFromVoice || voiceEnabled) {
            speakText(`Notice: ${errMsg}`, assistantMsgId, true);
          }
          onConversationUpdated?.();
        }
      });
    } catch (err: any) {
      isStreamingRef.current = false;
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
      isSubmittingRef.current = false;
      isStreamingRef.current = false;
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
      const c0 = companies[0]?.name || companies[0]?.company_name || 'Jeevan Clothing Company';
      const c1 = companies[1]?.name || companies[1]?.company_name || 'Jeevan Sourcing Company';
      return [
        'Compare portfolio revenue',
        'Show top 3 highest margin mills',
        `Analyze ${c0}`,
        `Compare ${c0} and ${c1}`
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
    <div className="flex flex-col h-full w-full relative overflow-hidden">
      {isEmpty ? (
        /* HERO LANDING PAGE */
        <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full px-6 animate-in fade-in duration-700 pb-16 relative">
          {/* Volumetric Purple Ambient Spotlight (Matching Vortasky reference) */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[720px] h-[320px] bg-gradient-to-b from-[#8A5CFF]/28 via-[#6D4AFF]/14 to-transparent blur-[110px] pointer-events-none rounded-full" />

          <div className="text-center mb-8 w-full relative z-10">
            {/* Top Glowing Glass Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-950/60 border border-purple-400/30 text-purple-200 text-[12px] font-semibold mb-5 shadow-[0_0_20px_rgba(160,137,230,0.22)] backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-[#A089E6]" />
              <span>Enterprise Intelligence Partner</span>
            </div>

            <h1 className="text-[40px] sm:text-[54px] font-bold tracking-tight text-white mb-3 leading-tight drop-shadow-[0_2px_25px_rgba(160,137,230,0.25)]">
              HOW SHOULD I HELP YOU TODAY?
            </h1>
            <p className="text-[16px] sm:text-[18px] text-purple-200/70 max-w-xl mx-auto font-normal">
              Your verified textile portfolio intelligence is ready when you are.
            </p>
          </div>

          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}
            className="w-full relative z-10 bg-[#130C2E]/70 backdrop-blur-2xl border border-purple-400/25 rounded-2xl p-2 shadow-[0_25px_70px_rgba(0,0,0,0.6),0_0_40px_rgba(109,74,255,0.18)] focus-within:border-purple-400/60 focus-within:shadow-[0_25px_70px_rgba(0,0,0,0.7),0_0_50px_rgba(160,137,230,0.3)] transition-all duration-300 mb-10"
          >
            {isRecording && (
              <div className="flex items-center justify-between px-3.5 py-2 bg-rose-500/15 border border-rose-500/30 rounded-xl mb-2 text-xs text-rose-200 animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <span className="font-semibold text-white">Listening... Speak now</span>
                  <span className="text-purple-300/70 hidden sm:inline">(Auto-submits and replies with voice)</span>
                </div>
                <button
                  type="button"
                  onClick={() => recognitionRef.current?.stop()}
                  className="text-[11px] font-semibold text-rose-300 hover:text-white cursor-pointer px-2 py-0.5 rounded-md hover:bg-rose-500/20"
                >
                  Cancel
                </button>
              </div>
            )}
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
                placeholder="Ask about your portfolio, margins, sales velocity..."
                disabled={loading}
                className="flex-1 bg-transparent border-0 resize-none text-[15px] sm:text-[16px] text-white placeholder-purple-300/40 focus:outline-none px-4 py-3 max-h-32"
              />

              {isSpeechSupported && (
                <button
                  type="button"
                  onClick={toggleRecording}
                  disabled={loading}
                  className={`p-3 rounded-xl transition-all shrink-0 cursor-pointer ${
                    isRecording 
                      ? 'bg-rose-500 text-white animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.5)]' 
                      : 'bg-transparent text-purple-300/60 hover:text-white hover:bg-white/[0.05]'
                  }`}
                  title={isRecording ? "Stop listening" : "Voice input (replies with voice defaultly)"}
                >
                  {isRecording ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5" />}
                </button>
              )}

              <button
                type="submit"
                disabled={!inputPrompt.trim() || loading}
                className="bg-gradient-to-r from-[#A089E6] to-[#6D4AFF] hover:from-[#B8A4EE] hover:to-[#8155F5] disabled:opacity-40 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-all duration-200 shadow-[0_0_20px_rgba(109,74,255,0.4)] hover:shadow-[0_0_28px_rgba(160,137,230,0.6)] hover:scale-105 active:scale-95 shrink-0 font-bold cursor-pointer"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-5 px-4 pb-1.5 text-[12px] text-purple-300/50 font-mono">
              <span className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors"><Plus className="w-3.5 h-3.5" /> Add data</span>
              <span className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">/ Commands</span>
              <span className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">@ Companies</span>
            </div>
          </form>

          <div className="w-full text-left max-w-2xl relative z-10">
            <div className="flex items-center gap-3 mb-3.5">
              <h3 className="text-[12px] font-bold text-purple-300/50 uppercase tracking-wider">Try asking</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {getSuggestions().map((sug, sIdx) => (
                <button
                  key={sIdx}
                  type="button"
                  onClick={() => handleSend(sug)}
                  disabled={loading}
                  className="group relative text-[13.5px] bg-[#140D2E]/60 hover:bg-[#1E1343]/85 backdrop-blur-xl border border-white/[0.08] hover:border-purple-400/40 text-purple-200/90 hover:text-white px-4 py-3.5 rounded-xl transition-all duration-200 text-left flex items-start gap-2.5 cursor-pointer shadow-md hover:shadow-[0_8px_30px_rgba(109,74,255,0.2)] hover:-translate-y-0.5"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[#A089E6] mt-2 group-hover:scale-125 transition-transform shrink-0 shadow-[0_0_6px_#A089E6]" />
                  <span className="flex-1 leading-snug">{sug}</span>
                  <ArrowRight className="w-4 h-4 text-purple-400/40 group-hover:text-purple-200 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* CONVERSATION VIEW */
        <div className="flex flex-col h-full relative">
          <div className={`absolute top-0 right-0 p-4 z-10 bg-[#0A0617]/80 backdrop-blur-2xl border-b border-white/[0.08] w-full flex justify-between items-center transition-all ${!sidebarOpen ? 'pl-14' : 'pl-4'}`}>
            {/* Header Brand Group - Smoothly hidden when sidebar is open */}
            <div
              className={`flex items-center gap-2.5 transition-all duration-300 ease-in-out ${
                sidebarOpen
                  ? 'opacity-0 max-w-0 pointer-events-none -translate-x-3 overflow-hidden'
                  : 'opacity-100 max-w-[280px] translate-x-0 pointer-events-auto'
              }`}
            >
              <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-[#6D4AFF] to-[#A089E6] p-0.5 shadow-[0_0_10px_rgba(160,137,230,0.3)] flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-[13px] font-bold text-white whitespace-nowrap">Jeevan Infotech AI</span>
              <span className="text-[10px] bg-purple-950/60 border border-purple-400/30 text-purple-300 px-2 py-0.5 rounded-full font-mono shrink-0">
                Verified BI
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setVoiceEnabled(!voiceEnabled);
                  if (voiceEnabled) window.speechSynthesis?.cancel();
                }}
                className={`text-[12px] flex items-center gap-1.5 cursor-pointer transition-colors px-2 py-1 rounded-lg hover:bg-white/[0.04] ${voiceEnabled ? 'text-[#A089E6]' : 'text-purple-300/60 hover:text-white'}`}
              >
                {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span>Voice</span>
              </button>

              {/* Three dots menu replacing New Chat */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  title="Chat options"
                  className="p-1.5 rounded-lg text-purple-300/70 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer border border-transparent hover:border-purple-400/20"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-44 bg-[#140D2E]/95 border border-purple-400/30 rounded-xl shadow-2xl backdrop-blur-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        const firstUserMsg = messages.find(m => m.senderRole === 'user')?.content || '';
                        setRenameTitle(firstUserMsg.slice(0, 40) || 'Analysis Session');
                        setShowRenameModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-purple-200 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <Pencil className="w-3.5 h-3.5 text-[#A089E6]" />
                      <span>Rename Chat</span>
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setActiveConversationId?.(null);
                        setMessages([]);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-purple-200 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <Plus className="w-3.5 h-3.5 text-purple-400" />
                      <span>New Chat</span>
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setMessages([]);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-300 hover:text-rose-200 hover:bg-rose-500/15 rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Clear Messages</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pt-20 pb-36 px-4 sm:px-6 md:px-8 custom-scrollbar">
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
                          <div className="text-[10px] font-bold text-purple-300/60 mb-1 uppercase tracking-wider text-right">You</div>
                          <div className="bg-gradient-to-br from-[#1E143E]/95 to-[#160E30]/95 border border-purple-400/30 text-white text-[15px] px-5 py-3.5 rounded-2xl rounded-tr-sm leading-relaxed whitespace-pre-wrap shadow-[0_4px_25px_rgba(0,0,0,0.4),0_0_20px_rgba(109,74,255,0.12)] backdrop-blur-md">
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-start">
                        <div className="max-w-full w-full">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-[11px] font-bold text-purple-300/70 uppercase tracking-wider flex items-center gap-2">
                              <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-[#6D4AFF] to-[#A089E6] flex items-center justify-center shadow-[0_0_8px_rgba(160,137,230,0.4)]">
                                <Bot className="w-3 h-3 text-white" />
                              </div>
                              <span className="text-white font-semibold">Jeevan Infotech AI</span>
                            </div>

                            {/* Voice Playback Button */}
                            {!msg.isStreaming && msg.content && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (currentlySpeakingId === msg.id) {
                                    stopSpeaking();
                                  } else {
                                    speakText(msg.content, msg.id, true);
                                  }
                                }}
                                title={currentlySpeakingId === msg.id ? "Stop reading" : "Read aloud"}
                                className={`text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer font-medium ${
                                  currentlySpeakingId === msg.id
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.3)] animate-pulse'
                                    : 'text-purple-300/60 hover:text-white hover:bg-white/[0.06] border border-transparent'
                                }`}
                              >
                                {currentlySpeakingId === msg.id ? (
                                  <>
                                    <Square className="w-3 h-3 fill-rose-400 text-rose-400" />
                                    <span>Stop Speaking</span>
                                    <span className="flex gap-0.5 items-center ml-1">
                                      <span className="w-1 h-2 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                      <span className="w-1 h-3.5 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                      <span className="w-1 h-2 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Volume2 className="w-3.5 h-3.5 text-purple-300/80" />
                                    <span>Read aloud</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>

                          <div className="space-y-4 text-white">
                            {/* Hidden/Collapsible Traces */}
                            {hasSteps && (
                              <div className="border border-purple-500/20 rounded-xl bg-[#120B28]/60 backdrop-blur-md overflow-hidden shadow-sm">
                                <button
                                  onClick={() => toggleStepExpand(msg.id)}
                                  className="w-full flex items-center justify-between px-4 py-2.5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors cursor-pointer text-[12px] text-purple-200/80"
                                >
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    <span>Verified against portfolio records ({msg.toolSteps?.length} source{msg.toolSteps?.length !== 1 ? 's' : ''})</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-purple-300/60">
                                    <span>Details</span>
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </div>
                                </button>
                                
                                {isExpanded && (
                                  <div className="p-4 border-t border-purple-500/20 bg-[#0C071C]/70 space-y-2">
                                    <div className="text-[11px] text-purple-300/50 font-mono mb-2">Execution details</div>
                                    {msg.toolSteps?.map((step, idx) => (
                                      <div key={idx} className="flex flex-col gap-1 text-[12px] font-mono bg-white/[0.03] p-2 rounded-lg border border-white/[0.05]">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[#A089E6]">{step.tool}()</span>
                                          <span className="text-purple-300/50">{step.timestamp}</span>
                                        </div>
                                        {step.resultSummary && (
                                          <div className="text-purple-200/70 pl-2 border-l border-purple-500/30 mt-1">
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
                              <div className="flex items-center gap-3 p-4 bg-[#120B28]/70 border border-purple-400/25 rounded-2xl backdrop-blur-xl text-purple-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                                <RefreshCw className="w-4 h-4 animate-spin text-[#A089E6] shrink-0" />
                                <div className="text-[14px]">
                                  <span className="font-medium text-white">Analyzing verified ledger records...</span>
                                  <span className="block text-[12px] text-purple-300/60 mt-0.5">Synthesizing executive portfolio intelligence & metrics</span>
                                </div>
                              </div>
                            ) : null}

                            {/* Artifacts (Visual Analytics & Ledger Records) - Displayed ONLY AFTER Summary Completes */}
                            {hasArtifacts && !msg.isStreaming && (
                              <div className="mt-8 pt-6 border-t border-purple-500/20 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <div className="flex items-center justify-between pb-2 border-b border-purple-500/20">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-[#A089E6] shadow-[0_0_8px_#A089E6]" />
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-purple-200/90">
                                      Visual Analytics & Ledger Records ({msg.artifacts?.length} Artifact{msg.artifacts?.length !== 1 ? 's' : ''})
                                    </h4>
                                  </div>
                                  <span className="text-[11px] text-purple-300/60 font-mono">Interactive View</span>
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
                                            <div key={art.id} className="border border-purple-500/20 rounded-2xl bg-[#120B28]/70 backdrop-blur-xl p-4 shadow-lg hover:border-purple-400/35 transition-all">
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
                              <div className="pt-5 pb-1 space-y-2.5 animate-in fade-in duration-700 border-t border-purple-500/20 mt-6">
                                <div className="flex items-start sm:items-center gap-2 text-[13px] text-purple-200/80">
                                  <Sparkles className="w-3.5 h-3.5 text-[#A089E6] shrink-0 mt-0.5 sm:mt-0" />
                                  <span className="leading-relaxed">{getPoliteClosing(userPromptForMsg, companies)}</span>
                                </div>

                                <div className="flex flex-wrap gap-2 pt-1">
                                  {getFollowUpQuestions(userPromptForMsg, companies).map((chip, cIdx) => (
                                    <button
                                      key={cIdx}
                                      type="button"
                                      onClick={() => handleSend(chip)}
                                      disabled={loading}
                                      className="text-[12px] bg-[#140D2E]/70 hover:bg-[#1E1442]/80 border border-purple-400/25 hover:border-purple-400/60 text-purple-200/90 hover:text-white px-3.5 py-1.5 rounded-full transition-all duration-200 flex items-center gap-1.5 cursor-pointer shadow-[0_2px_10px_rgba(0,0,0,0.3)] hover:shadow-[0_0_15px_rgba(160,137,230,0.25)] group hover:scale-[1.02]"
                                    >
                                      <span className="text-[#A089E6] group-hover:translate-x-0.5 transition-transform font-bold">→</span>
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
                    <div className="text-[11px] font-bold text-purple-300/70 mb-2 uppercase tracking-wider flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-[#6D4AFF] to-[#A089E6] flex items-center justify-center shadow-[0_0_8px_rgba(160,137,230,0.4)]">
                        <Bot className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-white font-semibold">Jeevan Infotech AI</span>
                    </div>
                    <div className="flex items-center gap-3 text-[14px] text-purple-200/90 p-4 bg-[#120B28]/70 border border-purple-400/25 rounded-2xl backdrop-blur-xl shadow-lg">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#A089E6]" />
                      {statusMessage || 'Processing query...'}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} className="h-4" />
            </div>
          </div>

          {/* Sticky Bottom Input */}
          <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#090614] via-[#090614]/90 to-transparent pt-12 pb-6 px-4 sm:px-6 md:px-8 pointer-events-none">
            <div className="max-w-4xl mx-auto pointer-events-auto">
              <form
                onSubmit={e => {
                  e.preventDefault();
                  handleSend();
                }}
                className="relative bg-[#130C2E]/80 backdrop-blur-2xl border border-purple-400/25 rounded-2xl p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.6),0_0_30px_rgba(109,74,255,0.15)] focus-within:border-purple-400/60 focus-within:shadow-[0_20px_50px_rgba(0,0,0,0.7),0_0_40px_rgba(160,137,230,0.25)] transition-all"
              >
                {isRecording && (
                  <div className="flex items-center justify-between px-3.5 py-1.5 bg-rose-500/15 border border-rose-500/30 rounded-xl mb-1 text-xs text-rose-200 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      <span className="font-semibold text-white">Listening... Speak follow-up</span>
                      <span className="text-purple-300/70 hidden sm:inline">(Auto-submits & speaks response)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => recognitionRef.current?.stop()}
                      className="text-[11px] font-semibold text-rose-300 hover:text-white cursor-pointer px-2 py-0.5 rounded-md hover:bg-rose-500/20"
                    >
                      Cancel
                    </button>
                  </div>
                )}
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
                    placeholder="Ask a follow-up..."
                    disabled={loading}
                    className="flex-1 bg-transparent border-0 resize-none text-[15px] text-white placeholder-purple-300/40 focus:outline-none px-4 py-2 max-h-32 custom-scrollbar"
                  />
                  {isSpeechSupported && (
                    <button
                      type="button"
                      onClick={toggleRecording}
                      disabled={loading}
                      className={`p-2.5 rounded-xl transition-all shrink-0 cursor-pointer ${
                        isRecording 
                          ? 'bg-rose-500 text-white animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.5)]' 
                          : 'bg-transparent text-purple-300/60 hover:text-white hover:bg-white/[0.06]'
                      }`}
                      title={isRecording ? "Stop listening" : "Voice input (replies with voice defaultly)"}
                    >
                      {isRecording ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4" />}
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!inputPrompt.trim() || loading}
                    className="bg-gradient-to-r from-[#A089E6] to-[#6D4AFF] hover:from-[#B8A4EE] hover:to-[#8155F5] disabled:opacity-40 disabled:hover:scale-100 disabled:shadow-none text-white p-2.5 rounded-xl transition-all duration-200 shadow-[0_0_15px_rgba(109,74,255,0.35)] hover:shadow-[0_0_25px_rgba(160,137,230,0.55)] hover:scale-105 active:scale-95 shrink-0 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ChatGPT-style Floating Voice Feedback Controller */}
      {isSpeaking && (
        <div className="fixed bottom-24 right-6 z-40 flex items-center gap-3 bg-[#150D32]/95 border border-[#A089E6]/40 backdrop-blur-2xl px-4 py-2.5 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.6),0_0_24px_rgba(160,137,230,0.25)] animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-2.5 bg-[#A089E6] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-4 bg-[#6D4AFF] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-5 bg-[#A089E6] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            <span className="w-1.5 h-2.5 bg-[#6D4AFF] rounded-full animate-bounce" style={{ animationDelay: '450ms' }} />
          </div>
          <span className="text-xs font-semibold text-white tracking-wide">AI Speaking...</span>
          <button
            onClick={stopSpeaking}
            className="ml-1 flex items-center gap-1.5 text-xs font-bold text-rose-300 hover:text-white bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/30 px-2.5 py-1 rounded-xl transition-all cursor-pointer shadow-sm"
            title="Stop speech"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Stop</span>
          </button>
        </div>
      )}

      {/* Rename Conversation Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#140D2E] border border-purple-400/30 rounded-2xl w-full max-w-sm p-5 shadow-2xl relative space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-[#A089E6]" />
                <h3 className="text-sm font-bold text-white">Rename Conversation</h3>
              </div>
              <button
                onClick={() => setShowRenameModal(false)}
                className="p-1 rounded-lg text-purple-300/60 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-purple-300/70">Conversation Title</label>
              <input
                type="text"
                value={renameTitle}
                onChange={e => setRenameTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveRename();
                  }
                }}
                autoFocus
                className="w-full bg-[#0C071C]/80 border border-purple-400/25 focus:border-[#A089E6] rounded-xl px-3.5 py-2 text-sm text-white placeholder-purple-300/40 focus:outline-none transition-colors"
                placeholder="Enter new conversation name..."
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRenameModal(false)}
                className="px-3.5 py-2 text-xs font-semibold text-purple-300/70 hover:text-white rounded-xl hover:bg-white/[0.05] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRename}
                disabled={!renameTitle.trim()}
                className="bg-gradient-to-r from-[#A089E6] to-[#6D4AFF] hover:from-[#B8A4EE] hover:to-[#8155F5] disabled:opacity-40 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-[0_0_12px_rgba(109,74,255,0.3)] cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
