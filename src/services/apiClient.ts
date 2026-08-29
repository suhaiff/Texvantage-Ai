// Centralized API Client for TexVantage REST & SSE Backend
// Connects to /api endpoints with Authorization: Bearer <token>

const BASE_URL =
  (((import.meta as any).env?.VITE_API_BASE_URL as string) || '').replace(/\/$/, '') + '/api';

function normalizeUserResponse(user: any): any {
  if (!user) return user;
  const companyId = user.companyId ?? user.company_id ?? null;
  const companyName = user.companyName ?? user.company_name ?? '';
  return {
    ...user,
    companyId,
    companyName,
    company_id: companyId,
    company_name: companyName
  };
}

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('texvantage_auth_token');
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('texvantage_auth_token', token);
    } else {
      localStorage.removeItem('texvantage_auth_token');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>)
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    const contentType = response.headers.get('content-type') || '';

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        if (contentType.includes('application/json')) {
          const errorData = await response.json();
          if (errorData.detail) {
            errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
          }
        } else {
          const text = await response.text();
          if (text && text.length < 200 && !text.includes('<!doctype') && !text.includes('<html')) {
            errorMessage = text;
          }
        }
      } catch {
        // Fallback to generic message
      }

      // Auto-logout on 401 Unauthorized
      if (response.status === 401) {
        this.setToken(null);
        window.location.reload();
      }

      throw new Error(errorMessage);
    }

    if (response.status === 204) {
      return {} as T;
    }

    if (!contentType.includes('application/json')) {
      throw new Error(
        'Upload service returned an unexpected response. Please check the API connection.'
      );
    }

    return response.json();
  }

  // ----------------------------------------------------
  // AUTHENTICATION APIs
  // ----------------------------------------------------
  public auth = {
    login: async (email: string, password: string) => {
      const data = await this.request<{
        access_token: string;
        token_type: string;
        user: any;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      data.user = normalizeUserResponse(data.user);
      this.setToken(data.access_token);
      return data;
    },

    getProfile: async () => {
      const profile = await this.request<any>('/auth/me');
      return normalizeUserResponse(profile);
    },

    register: async (data: any) => {
      const response = await this.request<{
        access_token: string;
        token_type: string;
        user: any;
      }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      response.user = normalizeUserResponse(response.user);
      this.setToken(response.access_token);
      return response;
    },

    logout: () => {
      this.setToken(null);
    }
  };

  // ----------------------------------------------------
  // COMPANIES APIs
  // ----------------------------------------------------
  public companies = {
    list: async () => {
      return this.request<any[]>('/companies');
    },

    getById: async (companyId: string) => {
      return this.request<any>(`/companies/${companyId}`);
    }
  };

  // ----------------------------------------------------
  // ANALYTICS APIs
  // ----------------------------------------------------
  public analytics = {
    getSummary: async (companyId?: string) => {
      const params = companyId ? `?company_id=${encodeURIComponent(companyId)}` : '';
      return this.request<any>(`/analytics/summary${params}`);
    },

    getSalesTrend: async (companyId?: string, months: number = 6) => {
      const query = new URLSearchParams();
      if (companyId) query.set('company_id', companyId);
      query.set('months', String(months));
      return this.request<any>(`/analytics/sales-trend?${query.toString()}`);
    },

    getProfitTrend: async (companyId?: string, months: number = 6) => {
      const query = new URLSearchParams();
      if (companyId) query.set('company_id', companyId);
      query.set('months', String(months));
      return this.request<any>(`/analytics/profit-trend?${query.toString()}`);
    },

    getTopProducts: async (companyId?: string, limit: number = 5) => {
      const query = new URLSearchParams();
      if (companyId) query.set('company_id', companyId);
      query.set('limit', String(limit));
      return this.request<any[]>(`/analytics/top-products?${query.toString()}`);
    },

    getFinancials: async (companyId?: string, startDate?: string, endDate?: string) => {
      const query = new URLSearchParams();
      if (companyId) query.set('company_id', companyId);
      if (startDate) query.set('start_date', startDate);
      if (endDate) query.set('end_date', endDate);
      return this.request<any[]>(`/analytics/financials?${query.toString()}`);
    },

    compareCompanies: async (companyIds?: string[], periodMonths: number = 6) => {
      return this.request<any>('/analytics/compare', {
        method: 'POST',
        body: JSON.stringify({
          company_ids: companyIds,
          period_months: periodMonths
        })
      });
    },

    getGlobalSummary: async (periodMonths: number = 6) => {
      return this.request<any>(`/analytics/global-summary?period_months=${periodMonths}`);
    },

    getSchema: async () => {
      return this.request<any>('/analytics/schema');
    }
  };

  // ----------------------------------------------------
  // DATASETS & INGESTION APIs
  // ----------------------------------------------------
  public datasets = {
    list: async (companyId?: string) => {
      const query = companyId ? `?company_id=${encodeURIComponent(companyId)}` : '';
      return this.request<any[]>(`/datasets${query}`);
    },

    upload: async (file: File, datasetName?: string, description?: string, companyId?: string) => {
      const url = `${BASE_URL}/datasets/upload`;
      const formData = new FormData();
      formData.append('file', file);
      if (datasetName) formData.append('dataset_name', datasetName);
      if (description) formData.append('description', description);
      if (companyId) formData.append('company_id', companyId);

      const headers: Record<string, string> = {};
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData
      });

      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          if (contentType.includes('application/json')) {
            const errorData = await response.json();
            if (errorData.detail) {
              errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
            }
          } else {
            const text = await response.text();
            if (text && text.length < 200 && !text.includes('<!doctype') && !text.includes('<html')) {
              errorMessage = text;
            }
          }
        } catch {
          // Fallback
        }
        throw new Error(errorMessage);
      }

      if (!contentType.includes('application/json')) {
        throw new Error(
          'Upload service returned an unexpected response. Please check the API connection.'
        );
      }

      return response.json();
    },

    preview: async (datasetId: string) => {
      return this.request<any>(`/datasets/${datasetId}/preview`);
    },

    mapAndIngest: async (
      datasetId: string,
      mapping: Record<string, string>,
      mode: 'APPEND' | 'REPLACE' = 'APPEND'
    ) => {
      const response = await this.request<any>(`/datasets/${datasetId}/mapping`, {
        method: 'POST',
        body: JSON.stringify({ mapping, mode })
      });
      const json = await response.json();
      return json;
    },

    delete: async (datasetId: string, companyId?: string) => {
      const query = companyId ? `?company_id=${encodeURIComponent(companyId)}` : '';
      return this.request<any>(`/datasets/${datasetId}${query}`, { method: 'DELETE' });
    }
  };

  // ----------------------------------------------------
  // KNOWLEDGE APIs
  // ----------------------------------------------------
  public knowledge = {
    upload: async (file: File, companyId: string) => {
      const url = `${BASE_URL}/knowledge/upload`;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('company_id', companyId);

      const headers: Record<string, string> = {};
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.detail) errorMessage = errorData.detail;
        } catch { }
        throw new Error(errorMessage);
      }
      return response.json();
    }
  };

  // ----------------------------------------------------
  // EXECUTIVE REPORTS & EXPORT APIs (PHASE 5D)
  // ----------------------------------------------------
  public reports = {
    getMetadata: async () => {
      return this.request<any>('/reports/metadata');
    },

    downloadExcel: async (params: {
      reportType?: 'executive' | 'portfolio' | 'comparison';
      companyIds?: string[];
      companyId?: string;
      periodMonths?: number;
      analysisContext?: string;
      title?: string;
    }) => {
      const url = `${BASE_URL}/reports/excel`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          report_type: params.reportType || 'executive',
          company_ids: params.companyIds,
          company_id: params.companyId,
          period_months: params.periodMonths || 6,
          analysis_context: params.analysisContext,
          title: params.title
        })
      });

      if (!response.ok) {
        let errorMsg = 'Failed to generate executive report.';
        try {
          const errJson = await response.json();
          if (errJson.detail) errorMsg = errJson.detail;
        } catch {
          // ignore
        }
        throw new Error(errorMsg);
      }

      // Extract filename from header
      let filename = 'TexVantage_Executive_Report.xlsx';
      const disposition = response.headers.get('Content-Disposition');
      if (disposition) {
        const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/);
        if (utfMatch && utfMatch[1]) {
          filename = decodeURIComponent(utfMatch[1]);
        } else {
          const standardMatch = disposition.match(/filename="?([^";]+)"?/);
          if (standardMatch && standardMatch[1]) {
            filename = standardMatch[1];
          }
        }
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 5000);

      return { filename, sizeBytes: blob.size };
    }
  };

  // ----------------------------------------------------
  // CHAT & SSE STREAMING APIs
  // ----------------------------------------------------
  public chat = {
    getConversations: async () => {
      return this.request<any[]>('/chat/conversations');
    },

    streamMessage: async (
      prompt: string,
      conversationId: string | undefined,
      callbacks: {
        onStatus?: (message: string) => void;
        onToolStart?: (tool: string, args: any) => void;
        onToolComplete?: (tool: string, resultSummary: string, result: any) => void;
        onToken?: (token: string) => void;
        onArtifact?: (artifact: any) => void;
        onDone?: () => void;
        onError?: (error: string) => void;
      }
    ): Promise<void> => {
      const url = `${BASE_URL}/chat/stream`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream'
      };

      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt,
          conversation_id: conversationId
        })
      });

      if (!response.ok) {
        let errText = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errJson = await response.json();
          if (errJson.detail) errText = errJson.detail;
        } catch {
          // ignore
        }

        if (response.status === 401) {
          this.setToken(null);
          window.location.reload();
        }

        if (callbacks.onError) callbacks.onError(errText);
        return;
      }

      if (!response.body) {
        callbacks.onError?.('ReadableStream not supported by browser.');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;

            const payloadStr = trimmed.replace(/^data:\s*/, '');
            if (payloadStr === '[DONE]') {
              callbacks.onDone?.();
              return;
            }

            try {
              const event = JSON.parse(payloadStr);
              if (event.type === 'status') {
                callbacks.onStatus?.(event.message);
              } else if (event.type === 'tool_start') {
                callbacks.onToolStart?.(event.tool, event.arguments);
              } else if (event.type === 'tool_complete') {
                callbacks.onToolComplete?.(event.tool, event.resultSummary, event.result);
              } else if (event.type === 'token') {
                callbacks.onToken?.(event.text || event.content || '');
              } else if (event.type === 'artifact') {
                callbacks.onArtifact?.(event.artifact);
              } else if (event.type === 'done') {
                callbacks.onDone?.();
              } else if (event.type === 'error') {
                callbacks.onError?.(event.message);
              }
            } catch (jsonErr) {
              console.warn('Failed to parse SSE line:', payloadStr, jsonErr);
            }
          }
        }
      } catch (err: any) {
        callbacks.onError?.(err?.message || 'Error while reading stream');
      } finally {
        callbacks.onDone?.();
      }
    }
  };
}

export const apiClient = new ApiClient();
