// Thin Client API Interface for Real Backend AI SSE Streaming
// NO regex parsing, NO local tool dispatch, NO fake response construction
// Connects directly to FastAPI /api/chat/stream endpoint

import { apiClient } from './apiClient';
import { AIArtifact, ToolExecutionStep } from '../types';
import { normalizeArtifact } from '../utils/normalizeArtifact';

export interface AIServiceStreamCallbacks {
  onStatus?: (message: string) => void;
  onToolStep?: (step: ToolExecutionStep) => void;
  onToken?: (token: string) => void;
  onArtifact?: (artifact: AIArtifact) => void;
  onDone?: () => void;
  onError?: (error: string) => void;
}

export class AIService {
  /**
   * Connects to backend /api/chat/stream SSE endpoint
   */
  static async streamQuery(
    prompt: string,
    conversationId: string | undefined,
    callbacks: AIServiceStreamCallbacks
  ): Promise<void> {
    await apiClient.chat.streamMessage(prompt, conversationId, {
      onStatus: message => {
        callbacks.onStatus?.(message);
      },
      onToolStart: (tool, args) => {
        callbacks.onToolStep?.({
          tool,
          arguments: args || {},
          status: 'running',
          timestamp: new Date().toLocaleTimeString()
        });
      },
      onToolComplete: (tool, summary, result) => {
        callbacks.onToolStep?.({
          tool,
          arguments: {},
          status: 'completed',
          resultSummary: summary,
          timestamp: new Date().toLocaleTimeString()
        });
      },
      onToken: token => {
        callbacks.onToken?.(token);
      },
      onArtifact: artifact => {
        const normalized = normalizeArtifact(artifact);
        if (normalized) callbacks.onArtifact?.(normalized);
      },
      onDone: () => {
        callbacks.onDone?.();
      },
      onError: error => {
        callbacks.onError?.(error);
      }
    });
  }
}
