import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Eye,
  ArrowRight,
  Database,
  RefreshCw,
  Layers,
  Sparkles,
  ShieldAlert,
  Calendar,
  DollarSign,
  TrendingUp,
  Download,
  Check
} from 'lucide-react';
import { User } from '../types';
import { apiClient } from '../services/apiClient';

interface DatasetManagerProps {
  currentUser: User;
  onOpenAIQuery?: (query: string) => void;
  onDataIngested?: () => void;
}

interface DatasetItem {
  id: string;
  company_id: string;
  dataset_name: string;
  original_filename: string;
  file_format: string;
  record_count: number;
  file_size: number;
  status: string;
  description?: string;
  uploaded_at: string;
  date_range_start?: string;
  date_range_end?: string;
  error_message?: string;
}

interface ColumnPreview {
  column_name: string;
  data_type: string;
  suggested_field?: string;
  confidence?: 'high' | 'medium' | 'low' | 'unknown_unit' | 'identifier';
  confidence_label?: string;
  is_identifier?: boolean;
  requires_unit_confirmation?: boolean;
  sample_value?: string;
}

interface PreviewData {
  dataset_id: string;
  dataset_name: string;
  original_filename: string;
  file_format: string;
  total_rows: number;
  columns: ColumnPreview[];
  sample_rows: Record<string, any>[];
  suggested_mappings: Record<string, string>;
}

const TARGET_BUSINESS_FIELDS = [
  { key: 'ignore', label: '— Ignore Column —', required: false, description: 'Do not import this column' },
  { key: 'date', label: 'Period Date / Month *', required: true, description: 'E.g. 2026-08-01 or OrderDate' },
  { key: 'revenue_raw', label: 'Sales / Revenue (Standard Currency) *', required: true, description: 'Raw transaction amount (auto-indexed to Lakhs)' },
  { key: 'revenue_lakh', label: 'Revenue (₹ Lakh INR Explicit)', required: false, description: 'Pre-scaled in Lakhs (1 Lakh = 100,000)' },
  { key: 'units_sold', label: 'Units Sold / Quantity', required: false, description: 'Quantity sold in meters/kg/units' },
  { key: 'category_name', label: 'Product / Fabric Category', required: false, description: 'Category classification' },
  { key: 'cogs_lakh', label: 'COGS (₹ Lakh INR)', required: false, description: 'Direct manufacturing costs in Lakhs' },
  { key: 'cogs_raw', label: 'COGS (Standard Currency)', required: false, description: 'Raw cost of goods sold' },
  { key: 'gross_profit_lakh', label: 'Gross Profit (₹ Lakh INR)', required: false, description: 'Gross profit (leaves null if absent)' },
  { key: 'unit_price', label: 'Unit Price', required: false, description: 'Price per unit/item' },
  { key: 'customer_segment', label: 'Customer / Market Segment', required: false, description: 'Target market / client tier' }
];

export const DatasetManager: React.FC<DatasetManagerProps> = ({
  currentUser,
  onOpenAIQuery,
  onDataIngested
}) => {
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'list' | 'upload' | 'mapping'>('list');

  // Upload Form State
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [targetCompanyId, setTargetCompanyId] = useState(currentUser.companyId || '');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadType, setUploadType] = useState<'dataset' | 'knowledge'>('dataset');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mapping & Ingestion State
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [mappingConfig, setMappingConfig] = useState<Record<string, string>>({});
  const [ingestionMode, setIngestionMode] = useState<'APPEND' | 'REPLACE'>('APPEND');
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingestSuccessMsg, setIngestSuccessMsg] = useState<string | null>(null);

  // Load Datasets
  const fetchDatasets = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.datasets.list(currentUser.role === 'ADMIN' ? undefined : currentUser.companyId || undefined);
      setDatasets(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch datasets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
    const fetchCompanies = async () => {
      try {
        const comps = await apiClient.companies.list();
        setCompanies(comps);
        if (comps.length > 0 && !currentUser.companyId) {
          setTargetCompanyId(prev => prev || comps[0].id);
        }
      } catch {}
    };
    fetchCompanies();
  }, [currentUser]);

  // Handle Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (uploadType === 'dataset') {
      if (!['xlsx', 'xls', 'csv', 'json'].includes(ext)) {
        setError('Unsupported file type. Please upload .xlsx, .xls, .csv, or .json.');
        return;
      }
    } else {
      if (!['pdf', 'txt'].includes(ext)) {
        setError('Unsupported file type for Knowledge. Please upload .pdf or .txt.');
        return;
      }
    }
    setSelectedFile(file);
    if (!customName) {
      const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[_|-]/g, ' ');
      setCustomName(baseName.charAt(0).toUpperCase() + baseName.slice(1));
    }
    setError(null);
  };

  // Perform Upload & Parse
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(30);
    setError(null);

    try {
      setUploadProgress(60);
      const companyId = currentUser.role === 'ADMIN' ? targetCompanyId : currentUser.companyId;
      
      if (uploadType === 'knowledge') {
        await apiClient.knowledge.upload(selectedFile, companyId || '');
        setUploadProgress(100);
        alert('Knowledge document uploaded and processed successfully! AI can now use this information.');
        setActiveView('list');
        setSelectedFile(null);
        setCustomName('');
        setCustomDesc('');
        setUploading(false);
      } else {
        const res = await apiClient.datasets.upload(
          selectedFile,
          customName || selectedFile.name,
          customDesc,
          companyId
        );

        setUploadProgress(100);
        setActiveDatasetId(res.dataset_id);
        
        // Load preview for mapping
        await loadPreviewAndOpenMapping(res.dataset_id);
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      setUploading(false);
    }
  };

  const loadPreviewAndOpenMapping = async (datasetId: string) => {
    try {
      const preview = await apiClient.datasets.preview(datasetId);
      setPreviewData(preview);
      setActiveDatasetId(datasetId);
      setMappingConfig(preview.suggested_mappings || {});
      setActiveView('mapping');
      setUploading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load dataset preview');
      setUploading(false);
    }
  };

  // Handle Ingestion Confirmation
  const handleConfirmIngestion = async () => {
    if (!activeDatasetId) return;

    // Check mandatory fields
    const mappedValues = Object.values(mappingConfig);
    if (!mappedValues.includes('date')) {
      setError("Please map a column to 'Period Date / Month' to establish historical chronology.");
      return;
    }
    const hasRevenueMapping = mappedValues.includes('revenue') || mappedValues.includes('revenue_raw') || mappedValues.includes('revenue_lakh');
    if (!hasRevenueMapping) {
      setError("Please map a column to 'Sales / Revenue' for financial indexing.");
      return;
    }

    if (ingestionMode === 'REPLACE' && !confirmReplace) {
      setError('Please acknowledge the replacement safety confirmation.');
      return;
    }

    setIngesting(true);
    setError(null);

    try {
      const result = await apiClient.datasets.mapAndIngest(
        activeDatasetId,
        mappingConfig,
        ingestionMode
      );

      setIngestSuccessMsg(
        `Successfully ingested ${result.records_imported} monthly records (${result.date_range_start} to ${result.date_range_end}). Historical data is now active in AI Advisor and Analytics!`
      );
      
      await fetchDatasets();
      onDataIngested?.();
      
      // Reset view after brief pause
      setTimeout(() => {
        setActiveView('list');
        setSelectedFile(null);
        setCustomName('');
        setCustomDesc('');
        setConfirmReplace(false);
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Data ingestion failed');
    } finally {
      setIngesting(false);
    }
  };

  // Delete Dataset
  const handleDeleteDataset = async (datasetId: string) => {
    if (!confirm('Are you sure you want to remove this dataset registration?')) return;
    try {
      await apiClient.datasets.delete(datasetId);
      await fetchDatasets();
    } catch (err: any) {
      setError(err.message || 'Failed to delete dataset');
    }
  };

  // Sample CSV generator for instant testing
  const handleDownloadSample = () => {
    const csvContent = `Period,Monthly Sales Revenue (Lakh INR),Cost of Goods (Lakh),Units Sold,Product Category,Target Market\n2026-09-01,368.50,250.20,52000,Combed Cotton 40s,Tier-1 Knitters\n2026-10-01,385.00,260.00,54500,Organic Jersey 30s,European Export\n2026-11-01,410.20,275.80,58000,Poly Blend Suiting,Domestic Uniforms\n`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'Jeevan_Infotech_AI_Sample_Q3_Q4_Financials.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-[#130C2E]/70 backdrop-blur-xl border border-purple-400/20 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#8A5CFF]/15 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/60 border border-purple-400/30 text-[#A089E6] text-xs font-semibold">
              <Database className="w-3.5 h-3.5" />
              <span>Real-Time Business Knowledge Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Knowledge & Dataset Management
            </h1>
            <p className="text-sm text-purple-200/70 max-w-2xl leading-relaxed">
              Upload business documents (PDF or TXT) to teach the AI domain rules, or multi-format manufacturing and sales ledgers (.xlsx, .csv).
              The AI automatically synthesizes this knowledge to query the connected database with verified grounding.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleDownloadSample}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#1F1640]/70 hover:bg-[#281D52]/80 text-purple-200 border border-purple-400/20 transition shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#A089E6]" />
              <span>Download Sample CSV</span>
            </button>

            {activeView === 'list' ? (
              <button
                onClick={() => {
                  setActiveView('upload');
                  setError(null);
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#A089E6] to-[#6D4AFF] hover:from-[#B8A4EE] hover:to-[#8155F5] text-white shadow-[0_0_15px_rgba(109,74,255,0.35)] hover:shadow-[0_0_25px_rgba(160,137,230,0.5)] transition hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Data & Knowledge</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setActiveView('list');
                  setSelectedFile(null);
                  setError(null);
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#1F1640]/70 hover:bg-[#281D52]/80 text-purple-200 border border-purple-400/20 transition cursor-pointer"
              >
                Back to Datasets List
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Global Alerts / Messages */}
      {error && (
        <div className="bg-rose-950/40 border border-rose-800/80 p-4 rounded-2xl flex items-start gap-3 text-rose-300 text-sm backdrop-blur-md">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-rose-200">Operation Error</p>
            <p className="text-xs text-rose-300 mt-0.5">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-xs text-rose-400 hover:underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {ingestSuccessMsg && (
        <div className="bg-emerald-950/40 border border-emerald-800/80 p-4 rounded-2xl flex items-start gap-3 text-emerald-300 text-sm backdrop-blur-md animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-emerald-200">Data Successfully Ingested</p>
            <p className="text-xs text-emerald-300 mt-0.5">{ingestSuccessMsg}</p>
          </div>
        </div>
      )}

      {/* VIEW 1: DATASETS LISTING */}
      {activeView === 'list' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Active Datasets</span>
                <span className="bg-purple-950/60 text-[#A089E6] text-xs px-2.5 py-0.5 rounded-full border border-purple-400/30 font-mono">
                  {datasets.length}
                </span>
              </h2>
              <p className="text-xs text-purple-300/60 mt-0.5">
                {currentUser.role === 'ADMIN'
                  ? 'All uploaded business datasets across connected enterprises'
                  : `Datasets registered for ${currentUser.companyName || currentUser.companyId}`}
              </p>
            </div>

            <button
              onClick={fetchDatasets}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-purple-300/70 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-white/[0.05] cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {loading ? (
            <div className="bg-[#130C2E]/70 backdrop-blur-xl border border-purple-400/20 rounded-2xl p-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-[#A089E6] animate-spin mx-auto" />
              <p className="text-sm font-mono text-purple-300/60">Loading verified datasets...</p>
            </div>
          ) : datasets.length === 0 ? (
            <div className="bg-[#130C2E]/70 backdrop-blur-xl border border-purple-400/20 rounded-3xl p-12 text-center space-y-4 shadow-[0_4px_25px_rgba(0,0,0,0.3)]">
              <div className="w-14 h-14 rounded-2xl bg-purple-950/60 border border-purple-400/30 flex items-center justify-center mx-auto text-[#A089E6]">
                <FileSpreadsheet className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white">No Datasets Uploaded Yet</h3>
              <p className="text-xs text-purple-200/70 max-w-md mx-auto leading-relaxed">
                Get started by uploading your Excel or CSV financial ledger to populate historical
                performance and unlock AI Advisor insights.
              </p>
              <button
                onClick={() => setActiveView('upload')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#A089E6] to-[#6D4AFF] hover:from-[#B8A4EE] hover:to-[#8155F5] text-white shadow-[0_0_15px_rgba(109,74,255,0.35)] transition cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload First Dataset</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {datasets.map(ds => {
                const formatBadgeColor =
                  ds.file_format === 'XLSX' || ds.file_format === 'XLS'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : ds.file_format === 'CSV'
                    ? 'bg-purple-500/20 text-purple-200 border-purple-400/30'
                    : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';

                return (
                  <div
                    key={ds.id}
                    className="bg-[#130C2E]/70 backdrop-blur-xl border border-purple-400/20 hover:border-purple-400/40 rounded-2xl p-5 space-y-4 transition-all duration-300 flex flex-col justify-between group shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_30px_rgba(160,137,230,0.15)]"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${formatBadgeColor}`}>
                          {ds.file_format}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            ds.status === 'COMPLETED'
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                              : ds.status === 'FAILED'
                              ? 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
                              : 'bg-amber-950/60 text-amber-400 border border-amber-800/40'
                          }`}
                        >
                          {ds.status}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-[#A089E6] transition line-clamp-1">
                          {ds.dataset_name}
                        </h4>
                        <p className="text-[11px] font-mono text-purple-300/50 truncate mt-0.5">
                          {ds.original_filename}
                        </p>
                      </div>

                      {ds.description && (
                        <p className="text-xs text-purple-200/70 line-clamp-2 leading-relaxed">
                          {ds.description}
                        </p>
                      )}

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-purple-500/15 text-xs">
                        <div>
                          <span className="text-[10px] text-purple-300/50 block">Records</span>
                          <span className="font-semibold text-white font-mono">{ds.record_count} months</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-purple-300/50 block">Date Range</span>
                          <span className="font-semibold text-purple-200 text-[11px]">
                            {ds.date_range_start && ds.date_range_end
                              ? `${ds.date_range_start.slice(0, 7)} ~ ${ds.date_range_end.slice(0, 7)}`
                              : 'Historical'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-purple-500/15 flex items-center justify-between gap-2">
                      <button
                        onClick={() => loadPreviewAndOpenMapping(ds.id)}
                        className="flex items-center gap-1.5 text-xs text-[#A089E6] hover:text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-white/[0.05] transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview / Map</span>
                      </button>

                      <div className="flex items-center gap-1">
                        {onOpenAIQuery && (
                          <button
                            onClick={() => onOpenAIQuery(`Analyze the data trends from ${ds.dataset_name}`)}
                            title="Ask AI Advisor about this dataset"
                            className="p-1.5 rounded-lg text-purple-300/60 hover:text-amber-300 hover:bg-white/[0.05] transition cursor-pointer"
                          >
                            <Sparkles className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteDataset(ds.id)}
                          title="Delete Dataset"
                          className="p-1.5 rounded-lg text-purple-300/40 hover:text-rose-400 hover:bg-white/[0.05] transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: FILE UPLOAD FORM */}
      {activeView === 'upload' && (
        <div className="max-w-3xl mx-auto bg-[#130C2E]/80 backdrop-blur-xl border border-purple-400/25 rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_4px_35px_rgba(0,0,0,0.5)]">
          <div className="border-b border-purple-500/20 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#A089E6]" />
              <span>Upload Data & Knowledge</span>
            </h2>
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => setUploadType('dataset')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  uploadType === 'dataset'
                    ? 'bg-gradient-to-r from-[#A089E6] to-[#6D4AFF] text-white shadow-[0_0_12px_rgba(109,74,255,0.35)]'
                    : 'bg-[#1A1238] text-purple-300/70 hover:bg-[#221848]'
                }`}
              >
                Business Ledger (CSV / Excel)
              </button>
              <button
                type="button"
                onClick={() => setUploadType('knowledge')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  uploadType === 'knowledge'
                    ? 'bg-gradient-to-r from-[#A089E6] to-[#6D4AFF] text-white shadow-[0_0_12px_rgba(109,74,255,0.35)]'
                    : 'bg-[#1A1238] text-purple-300/70 hover:bg-[#221848]'
                }`}
              >
                Business Knowledge (PDF / TXT)
              </button>
            </div>
            <p className="text-xs text-purple-200/70 mt-3 leading-relaxed">
              {uploadType === 'dataset' 
                ? 'Supports Excel (.xlsx, .xls), CSV (.csv), and JSON (.json) files up to 25MB.'
                : 'Supports PDF (.pdf) and Text (.txt) files. AI will use this knowledge to understand your business and query the database directly.'}
            </p>
          </div>

          <form onSubmit={handleUploadSubmit} className="space-y-6">
            {/* Drag and Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3 ${
                dragActive
                  ? 'border-purple-400 bg-purple-500/10'
                  : selectedFile
                  ? 'border-emerald-500/60 bg-emerald-500/5'
                  : 'border-purple-400/30 hover:border-purple-400/60 bg-[#0C071C]/50 hover:bg-[#0C071C]/80'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={uploadType === 'dataset' ? ".xlsx,.xls,.csv,.json" : ".pdf,.txt"}
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelected(e.target.files[0]);
                  }
                }}
              />

              {selectedFile ? (
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="font-semibold text-white text-sm">{selectedFile.name}</div>
                  <div className="text-xs text-purple-300/60 font-mono">
                    {(selectedFile.size / 1024).toFixed(1)} KB • Click or drop to replace
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-purple-950/60 border border-purple-400/30 text-[#A089E6] flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-semibold text-white">
                    Drop your {uploadType === 'dataset' ? 'spreadsheet' : 'document'} or click to browse
                  </div>
                  <div className="text-xs text-purple-300/60">
                    {uploadType === 'dataset' ? 'Excel (.xlsx, .xls), CSV (.csv), or JSON (.json)' : 'PDF (.pdf) or Text (.txt)'}
                  </div>
                </div>
              )}
            </div>

            {/* Admin Company Selector if user is ADMIN */}
            {currentUser.role === 'ADMIN' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-purple-200">
                  Target Enterprise (Tenant)
                </label>
                <select
                  value={targetCompanyId}
                  onChange={e => setTargetCompanyId(e.target.value)}
                  className="w-full bg-[#1A1238] border border-purple-400/25 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-400"
                >
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Custom Dataset Name & Description */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-purple-200">Dataset Name</label>
                <input
                  type="text"
                  placeholder="e.g. Q3 2026 Production & Financial Ledger"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  className="w-full bg-[#1A1238] border border-purple-400/25 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-purple-300/40 focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-purple-200">Description (Optional)</label>
                <textarea
                  placeholder="Notes on source ERP, audited status, or product line coverage..."
                  rows={2}
                  value={customDesc}
                  onChange={e => setCustomDesc(e.target.value)}
                  className="w-full bg-[#1A1238] border border-purple-400/25 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-purple-300/40 focus:outline-none focus:border-purple-400 resize-none"
                />
              </div>
            </div>

            {/* Submit Action */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-purple-500/20">
              <button
                type="button"
                onClick={() => {
                  setActiveView('list');
                  setSelectedFile(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-purple-300/60 hover:text-white hover:bg-white/[0.05] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!selectedFile || uploading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#A089E6] to-[#6D4AFF] hover:from-[#B8A4EE] hover:to-[#8155F5] disabled:opacity-50 text-white shadow-[0_0_15px_rgba(109,74,255,0.35)] transition cursor-pointer"
              >
                {uploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Parsing File... {uploadProgress}%</span>
                  </>
                ) : (
                  <>
                    <span>Upload & Preview Data</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VIEW 3: PREVIEW & COLUMN MAPPING STEP */}
      {activeView === 'mapping' && previewData && (
        <div className="space-y-8">
          {/* Header */}
          <div className="bg-[#130C2E]/70 backdrop-blur-xl border border-purple-400/20 rounded-3xl p-6 space-y-4 shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#A089E6] bg-purple-950/60 border border-purple-400/30 px-2.5 py-0.5 rounded-full">
                  Step 2 of 2: Schema Mapping & Validation
                </span>
                <h2 className="text-xl font-bold text-white mt-1.5">{previewData.dataset_name}</h2>
                <p className="text-xs text-purple-300/60 font-mono mt-0.5">
                  {previewData.original_filename} • {previewData.total_rows} rows detected • Format: {previewData.file_format}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveView('list')}
                  className="px-3.5 py-1.5 rounded-xl text-xs text-purple-300/60 hover:text-white hover:bg-white/[0.05] transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>

          {/* Sample Rows Preview */}
          <div className="bg-[#130C2E]/70 backdrop-blur-xl border border-purple-400/20 rounded-3xl p-6 space-y-4 shadow-[0_4px_30px_rgba(0,0,0,0.4)] overflow-hidden">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#A089E6]" />
                <span>Raw Data Preview (First 5 Rows)</span>
              </h3>
              <span className="text-xs text-purple-300/60 font-mono">
                {previewData.columns.length} columns detected
              </span>
            </div>

            <div className="overflow-x-auto border border-purple-500/20 rounded-xl max-h-60 custom-scrollbar">
              <table className="w-full text-left text-xs text-purple-200">
                <thead className="bg-[#0C071C]/80 text-purple-300/70 font-semibold border-b border-purple-400/20 sticky top-0">
                  <tr>
                    {previewData.columns.map(col => (
                      <th key={col.column_name} className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-white">{col.column_name}</div>
                        <span className="text-[10px] font-mono text-purple-400/60 uppercase">
                          {col.data_type}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-500/10 font-mono text-[11px]">
                  {previewData.sample_rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.04]">
                      {previewData.columns.map(col => (
                        <td key={col.column_name} className="px-4 py-2.5 whitespace-nowrap text-purple-200/90">
                          {String(row[col.column_name] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Column Mapping Interface */}
          <div className="bg-[#130C2E]/70 backdrop-blur-xl border border-purple-400/20 rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#A089E6]" />
                <span>Map Columns to Standard Financial Fields</span>
              </h3>
              <p className="text-xs text-purple-200/70 mt-1">
                Confirm or adjust which column corresponds to each analytical business field.
                Period Date and Revenue are mandatory for historical indexing.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {previewData.columns.map(col => {
                const currentMappedField = mappingConfig[col.column_name] || 'ignore';

                return (
                  <div
                    key={col.column_name}
                    className={`border rounded-2xl p-4 space-y-3 transition ${
                      col.confidence === 'identifier'
                        ? 'bg-[#120B28]/50 border-purple-500/20'
                        : col.confidence === 'unknown_unit'
                        ? 'bg-amber-950/20 border-amber-500/40'
                        : currentMappedField !== 'ignore'
                        ? 'bg-[#180E38]/80 border-purple-400/40'
                        : 'bg-[#120B28]/60 border-purple-500/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white block truncate">
                            {col.column_name}
                          </span>
                          <span className="text-[10px] bg-purple-950/70 text-purple-300 border border-purple-400/25 px-1.5 py-0.5 rounded font-mono">
                            {col.data_type}
                          </span>
                        </div>
                        <span className="text-[10px] text-purple-300/50 font-mono block truncate">
                          Sample: {col.sample_value || 'None'}
                        </span>
                      </div>

                      {/* Confidence Badge */}
                      {col.confidence === 'high' && (
                        <span className="text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 px-2 py-0.5 rounded-full whitespace-nowrap">
                          Auto-detected
                        </span>
                      )}
                      {col.confidence === 'medium' && (
                        <span className="text-[10px] font-semibold bg-purple-950/60 text-[#A089E6] border border-purple-400/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                          Review recommended
                        </span>
                      )}
                      {col.confidence === 'unknown_unit' && (
                        <span className="text-[10px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/40 px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-amber-400" />
                          <span>Requires confirmation</span>
                        </span>
                      )}
                      {col.confidence === 'identifier' && (
                        <span className="text-[10px] font-semibold bg-purple-950/40 text-purple-300/50 border border-purple-500/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                          Identifier (Ignored)
                        </span>
                      )}
                    </div>

                    {col.confidence === 'unknown_unit' && (
                      <p className="text-[11px] text-amber-300/90 leading-tight bg-amber-950/40 p-2.5 rounded-xl border border-amber-800/40">
                        Currency unit not specified in header. Choose 'Standard Currency' or explicit '₹ Lakh INR'.
                      </p>
                    )}

                    {col.confidence === 'identifier' && (
                      <p className="text-[11px] text-purple-300/60 leading-tight">
                        Safe default: Identifier is ignored to prevent incorrect metric interpretations.
                      </p>
                    )}

                    <div>
                      <select
                        value={currentMappedField}
                        onChange={e => {
                          setMappingConfig({
                            ...mappingConfig,
                            [col.column_name]: e.target.value
                          });
                        }}
                        className={`w-full text-xs rounded-xl px-3 py-2 border font-medium focus:outline-none transition cursor-pointer ${
                          currentMappedField !== 'ignore'
                            ? 'bg-purple-950/60 border-purple-400/50 text-[#A089E6]'
                            : 'bg-[#1A1238] border-purple-400/25 text-purple-300/70'
                        }`}
                      >
                        {TARGET_BUSINESS_FIELDS.map(f => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Ingestion Mode Configuration */}
            <div className="pt-6 border-t border-purple-500/20 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300/60">
                Ingestion Strategy & Data Retention
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => setIngestionMode('APPEND')}
                  className={`p-4 rounded-2xl border cursor-pointer transition space-y-2 ${
                    ingestionMode === 'APPEND'
                      ? 'bg-purple-950/60 border-purple-400 text-white shadow-[0_0_15px_rgba(160,137,230,0.15)]'
                      : 'bg-[#120B28]/60 border-purple-500/20 text-purple-300/60 hover:border-purple-400/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span>Accumulate / Append (Recommended)</span>
                    </span>
                    {ingestionMode === 'APPEND' && <Check className="w-4 h-4 text-[#A089E6]" />}
                  </div>
                  <p className="text-[11px] text-purple-200/70 leading-relaxed">
                    Maintains full existing historical ledger. Merges and updates monthly periods from this upload
                    so AI can analyze multi-month historical trends.
                  </p>
                </div>

                <div
                  onClick={() => setIngestionMode('REPLACE')}
                  className={`p-4 rounded-2xl border cursor-pointer transition space-y-2 ${
                    ingestionMode === 'REPLACE'
                      ? 'bg-amber-950/40 border-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                      : 'bg-[#120B28]/60 border-purple-500/20 text-purple-300/60 hover:border-purple-400/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                      <span>Replace Company Ledger</span>
                    </span>
                    {ingestionMode === 'REPLACE' && <Check className="w-4 h-4 text-amber-400" />}
                  </div>
                  <p className="text-[11px] text-purple-200/70 leading-relaxed">
                    Overwrites past monthly financials for this enterprise with only this dataset's rows.
                    Use only when replacing corrupted legacy records.
                  </p>
                </div>
              </div>

              {ingestionMode === 'REPLACE' && (
                <div className="bg-amber-950/30 border border-amber-800/80 p-4 rounded-xl flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="confirmReplaceCheck"
                    checked={confirmReplace}
                    onChange={e => setConfirmReplace(e.target.checked)}
                    className="w-4 h-4 rounded border-amber-600 text-amber-500 focus:ring-amber-500"
                  />
                  <label htmlFor="confirmReplaceCheck" className="text-xs text-amber-200 cursor-pointer">
                    I confirm I want to overwrite all existing historical data for this enterprise.
                  </label>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-purple-500/20">
              <button
                type="button"
                onClick={() => setActiveView('list')}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-purple-300/60 hover:text-white hover:bg-white/[0.05] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmIngestion}
                disabled={ingesting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#A089E6] to-[#6D4AFF] hover:from-[#B8A4EE] hover:to-[#8155F5] disabled:opacity-50 text-white shadow-[0_0_15px_rgba(109,74,255,0.35)] transition cursor-pointer"
              >
                {ingesting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Ingesting & Persisting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Ingest Data into Engine</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
