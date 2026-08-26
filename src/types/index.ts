export type UserRole = 'ADMIN' | 'OWNER';

export interface Company {
  id: string;
  name: string;
  code: string;
  specialization: string;
  city: string;
  state: string;
  foundedYear: number;
  annualCapacity: string;
  revenueBase: number; // ₹ Lakhs
  marginBase: number; // %
  growthFactor: number;
  volumeBase: number;
  volumeUnit: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId: string | null;
  companyName?: string;
  company_id?: string | null;
  company_name?: string;
  jobTitle: string;
  avatar?: string;
}

export interface MonthlyFinancial {
  id: string;
  companyId: string;
  year: number;
  month: number;
  monthName: string;
  periodDate: string; // YYYY-MM-DD
  revenueLakh: number;
  costOfGoodsSoldLakh: number | null;
  grossProfitLakh: number | null;
  profitMarginPct: number | null;
  unitsSold: number | null;
  unitOfMeasure: string;
  averageSellingPrice: number | null;
  operatingExpensesLakh?: number | null;
  netProfitLakh?: number | null;
  unitsProduced?: number | null;
  capacityUtilizationPct?: number | null;
  ordersCount?: number | null;
  rawMaterialCostLakh?: number | null;
  energyCostLakh?: number | null;
}

export interface ProductMetric {
  id: string;
  companyId: string;
  categoryName: string;
  revenueSharePct: number;
  unitOfMeasure: string;
  grossMarginPct: number;
  targetMarket: string;
  annualVolume: number;
  annualRevenueLakh: number;
}

export interface KPIArtifactData {
  metric: string;
  value: string;
  rawValue?: number;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  period: string;
  subtext?: string;
}

export interface ChartSeries {
  key: string;
  name: string;
  color: string;
  type?: 'bar' | 'line' | 'area' | 'donut';
}

export interface ChartArtifactData {
  chartType: 'bar' | 'line' | 'area' | 'donut';
  xKey: string;
  series: ChartSeries[];
  dataPoints: Array<Record<string, any>>;
}

export interface TableColumn {
  key: string;
  label: string;
  format?: 'currency' | 'percent' | 'number' | 'growth' | 'text';
}

export interface TableArtifactData {
  columns: TableColumn[];
  rows: Array<Record<string, any>>;
}

export interface FileArtifactData {
  filename: string;
  format: 'xlsx' | 'pdf' | 'csv';
  size: string;
  description: string;
  downloadUrl?: string;
  reportType?: 'executive' | 'portfolio' | 'comparison';
  companyIds?: string[];
  companyId?: string;
  periodMonths?: number;
  analysisContext?: string;
}

export interface AIArtifact {
  id: string;
  type: 'kpi' | 'chart' | 'table' | 'file';
  title: string;
  data: KPIArtifactData | ChartArtifactData | TableArtifactData | FileArtifactData;
}

export interface ToolExecutionStep {
  tool: string;
  arguments: Record<string, any>;
  status: 'running' | 'completed' | 'failed';
  resultSummary?: string;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  senderRole: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  toolSteps?: ToolExecutionStep[];
  artifacts?: AIArtifact[];
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  userId: string;
  companyId: string | null;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}
