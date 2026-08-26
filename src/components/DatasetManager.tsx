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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [targetCompanyId, setTargetCompanyId] = useState(currentUser.companyId || 'comp_textile_a');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv', 'json'].includes(ext || '')) {
      setError('Unsupported file type. Please upload .xlsx, .xls, .csv, or .json.');
      return;
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
      const res = await apiClient.datasets.upload(
        selectedFile,
        customName || selectedFile.name,
        customDesc,
        currentUser.role === 'ADMIN' ? targetCompanyId : undefined
      );

      setUploadProgress(100);
      setActiveDatasetId(res.dataset_id);
      
      // Load preview for mapping
      await loadPreviewAndOpenMapping(res.dataset_id);
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
    link.setAttribute('download', 'TexVantage_Sample_Q3_Q4_Financials.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold">
              <Database className="w-3.5 h-3.5" />
              <span>Phase 4A Real Data Ingestion Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Enterprise Dataset Management
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl">
              Upload multi-format manufacturing and sales ledgers (.xlsx, .xls, .csv, .json).
              New data accumulates historical business records for instant AI analytics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleDownloadSample}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition shadow-sm"
            >
              <Download className="w-4 h-4 text-blue-400" />
              <span>Download Sample CSV</span>
            </button>

            {activeView === 'list' ? (
              <button
                onClick={() => {
                  setActiveView('upload');
                  setError(null);
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 transition"
              >
                <Upload className="w-4 h-4" />
                <span>Upload New Dataset</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setActiveView('list');
                  setSelectedFile(null);
                  setError(null);
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              >
                Back to Datasets List
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Global Alerts / Messages */}
      {error && (
        <div className="bg-rose-950/40 border border-rose-800/80 p-4 rounded-2xl flex items-start gap-3 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-rose-200">Operation Error</p>
            <p className="text-xs text-rose-300 mt-0.5">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-xs text-rose-400 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {ingestSuccessMsg && (
        <div className="bg-emerald-950/40 border border-emerald-800/80 p-4 rounded-2xl flex items-start gap-3 text-emerald-300 text-sm animate-in fade-in duration-200">
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
                <span className="bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded-full border border-slate-700 font-mono">
                  {datasets.length}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {currentUser.role === 'ADMIN'
                  ? 'All uploaded business datasets across the 10 textile mills'
                  : `Datasets registered for ${currentUser.companyName || currentUser.companyId}`}
              </p>
            </div>

            <button
              onClick={fetchDatasets}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-slate-800"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {loading ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
              <p className="text-sm font-mono text-slate-400">Loading verified datasets...</p>
            </div>
          ) : datasets.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-400">
                <FileSpreadsheet className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white">No Datasets Uploaded Yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Get started by uploading your mill's Excel or CSV financial ledger to populate historical
                performance and unlock AI Advisor insights.
              </p>
              <button
                onClick={() => setActiveView('upload')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20"
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
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                    : 'bg-purple-500/20 text-purple-300 border-purple-500/30';

                return (
                  <div
                    key={ds.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 space-y-4 transition flex flex-col justify-between group shadow-lg"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${formatBadgeColor}`}>
                          {ds.file_format}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                            ds.status === 'COMPLETED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : ds.status === 'FAILED'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {ds.status}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition line-clamp-1">
                          {ds.dataset_name}
                        </h4>
                        <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                          {ds.original_filename}
                        </p>
                      </div>

                      {ds.description && (
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {ds.description}
                        </p>
                      )}

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Records</span>
                          <span className="font-semibold text-white font-mono">{ds.record_count} months</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Date Range</span>
                          <span className="font-semibold text-slate-300 text-[11px]">
                            {ds.date_range_start && ds.date_range_end
                              ? `${ds.date_range_start.slice(0, 7)} ~ ${ds.date_range_end.slice(0, 7)}`
                              : 'Historical'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                      <button
                        onClick={() => loadPreviewAndOpenMapping(ds.id)}
                        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold px-3 py-1.5 rounded-lg hover:bg-slate-800 transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview / Map</span>
                      </button>

                      <div className="flex items-center gap-1">
                        {onOpenAIQuery && (
                          <button
                            onClick={() => onOpenAIQuery(`Analyze the data trends from ${ds.dataset_name}`)}
                            title="Ask AI Advisor about this dataset"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition"
                          >
                            <Sparkles className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteDataset(ds.id)}
                          title="Delete Dataset"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
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
        <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-400" />
              <span>Upload Business Ledger</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Supports Excel (.xlsx, .xls), CSV (.csv), and JSON (.json) files up to 25MB.
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
                  ? 'border-blue-500 bg-blue-500/10'
                  : selectedFile
                  ? 'border-emerald-500/60 bg-emerald-500/5'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-800/40 hover:bg-slate-800/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.json"
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
                  <div className="text-xs text-slate-400 font-mono">
                    {(selectedFile.size / 1024).toFixed(1)} KB • Click or drop to replace
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-semibold text-white">
                    Drop your spreadsheet or click to browse
                  </div>
                  <div className="text-xs text-slate-400">
                    Excel (.xlsx, .xls), CSV (.csv), or JSON (.json)
                  </div>
                </div>
              )}
            </div>

            {/* Admin Company Selector if user is ADMIN */}
            {currentUser.role === 'ADMIN' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Target Textile Mill (Tenant)
                </label>
                <select
                  value={targetCompanyId}
                  onChange={e => setTargetCompanyId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="comp_textile_a">Mill A — Vardhman Spinning & Weaving</option>
                  <option value="comp_textile_b">Mill B — Arvind Silks & Couture</option>
                  <option value="comp_textile_c">Mill C — Raymond Eco Cottons</option>
                  <option value="comp_textile_d">Mill D — Reliance Petro-Poly Fab</option>
                  <option value="comp_textile_e">Mill E — Welspun Denim Dynamics</option>
                  <option value="comp_textile_f">Mill F — Trident Technical Weaves</option>
                  <option value="comp_textile_g">Mill G — Bombay Dyeing Home Linen</option>
                  <option value="comp_textile_h">Mill H — Banaras Zari Heritage</option>
                  <option value="comp_textile_i">Mill I — Kankatala Fine Worsted</option>
                  <option value="comp_textile_j">Mill J — Alok Fast Fashion Knits</option>
                </select>
              </div>
            )}

            {/* Custom Dataset Name & Description */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Dataset Name</label>
                <input
                  type="text"
                  placeholder="e.g. Q3 2026 Production & Financial Ledger"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Description (Optional)</label>
                <textarea
                  placeholder="Notes on source ERP, audited status, or product line coverage..."
                  rows={2}
                  value={customDesc}
                  onChange={e => setCustomDesc(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            {/* Submit Action */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setActiveView('list');
                  setSelectedFile(null);
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!selectedFile || uploading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow-lg shadow-blue-500/20 transition"
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
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded">
                  Step 2 of 2: Schema Mapping & Validation
                </span>
                <h2 className="text-xl font-bold text-white mt-1">{previewData.dataset_name}</h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {previewData.original_filename} • {previewData.total_rows} rows detected • Format: {previewData.file_format}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveView('list')}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>

          {/* Sample Rows Preview */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-400" />
                <span>Raw Data Preview (First 5 Rows)</span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {previewData.columns.length} columns detected
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-xl max-h-60">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700 sticky top-0">
                  <tr>
                    {previewData.columns.map(col => (
                      <th key={col.column_name} className="px-3.5 py-2.5 whitespace-nowrap">
                        <div>{col.column_name}</div>
                        <span className="text-[9px] font-mono text-slate-500 uppercase">
                          {col.data_type}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                  {previewData.sample_rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      {previewData.columns.map(col => (
                        <td key={col.column_name} className="px-3.5 py-2 whitespace-nowrap text-slate-300">
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
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                <span>Map Columns to Standard Financial Fields</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
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
                        ? 'bg-slate-800/40 border-slate-700/50'
                        : col.confidence === 'unknown_unit'
                        ? 'bg-amber-950/20 border-amber-500/40'
                        : currentMappedField !== 'ignore'
                        ? 'bg-slate-800/80 border-blue-500/40'
                        : 'bg-slate-800/60 border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white block truncate">
                            {col.column_name}
                          </span>
                          <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                            {col.data_type}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block truncate">
                          Sample: {col.sample_value || 'None'}
                        </span>
                      </div>

                      {/* Confidence Badge */}
                      {col.confidence === 'high' && (
                        <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                          Auto-detected
                        </span>
                      )}
                      {col.confidence === 'medium' && (
                        <span className="text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                          Review recommended
                        </span>
                      )}
                      {col.confidence === 'unknown_unit' && (
                        <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-amber-400" />
                          <span>Requires confirmation</span>
                        </span>
                      )}
                      {col.confidence === 'identifier' && (
                        <span className="text-[10px] font-semibold bg-slate-700/60 text-slate-400 border border-slate-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                          Identifier (Ignored)
                        </span>
                      )}
                    </div>

                    {col.confidence === 'unknown_unit' && (
                      <p className="text-[11px] text-amber-300/90 leading-tight bg-amber-950/40 p-2 rounded-lg border border-amber-800/40">
                        Currency unit not specified in header. Choose 'Standard Currency' or explicit '₹ Lakh INR'.
                      </p>
                    )}

                    {col.confidence === 'identifier' && (
                      <p className="text-[11px] text-slate-400 leading-tight">
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
                        className={`w-full text-xs rounded-xl px-3 py-2 border font-medium focus:outline-none transition ${
                          currentMappedField !== 'ignore'
                            ? 'bg-blue-900/30 border-blue-500/50 text-blue-200'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
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
            <div className="pt-6 border-t border-slate-800 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Ingestion Strategy & Data Retention
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => setIngestionMode('APPEND')}
                  className={`p-4 rounded-2xl border cursor-pointer transition space-y-2 ${
                    ingestionMode === 'APPEND'
                      ? 'bg-blue-600/10 border-blue-500 text-white'
                      : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span>Accumulate / Append (Recommended)</span>
                    </span>
                    {ingestionMode === 'APPEND' && <Check className="w-4 h-4 text-blue-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Maintains full existing historical ledger. Merges/upserts monthly periods from this upload
                    so AI can analyze historical timelines (e.g. July + August + September).
                  </p>
                </div>

                <div
                  onClick={() => setIngestionMode('REPLACE')}
                  className={`p-4 rounded-2xl border cursor-pointer transition space-y-2 ${
                    ingestionMode === 'REPLACE'
                      ? 'bg-amber-500/10 border-amber-500 text-white'
                      : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                      <span>Replace Company Ledger</span>
                    </span>
                    {ingestionMode === 'REPLACE' && <Check className="w-4 h-4 text-amber-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Overwrites past monthly financials for this company with only this dataset's rows.
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
                    I confirm I want to overwrite all existing historical data for this textile mill.
                  </label>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setActiveView('list')}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmIngestion}
                disabled={ingesting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white shadow-lg shadow-blue-500/25 transition"
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
