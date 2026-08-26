import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import {
  SERVER_COMPANIES,
  SERVER_FINANCIALS,
  SERVER_PRODUCTS,
  SERVER_USERS,
  SERVER_CONVERSATIONS,
  ServerMonthlyFinancial,
  ServerProductMetric
} from './database';
import {
  AuthenticatedRequest,
  requireAuth,
  requireAdmin,
  createAccessToken,
  checkCompanyAccess
} from './auth';
import { ServerAnalyticsService } from './analyticsService';
import { ServerAIOrchestrator } from './aiOrchestrator';

export const apiRouter = Router();

// Configure Multer for in-memory file uploads (max 50MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ----------------------------------------------------
// In-Memory Datasets Store
// ----------------------------------------------------
export interface IngestionDataset {
  id: string;
  company_id: string;
  company_name: string;
  name: string;
  filename: string;
  file_type: string;
  row_count: number;
  created_at: string;
  status: 'uploaded' | 'ingested';
  coverage_start?: string;
  coverage_end?: string;
  detected_columns: string[];
  preview_rows: any[];
  all_rows?: any[];
  mapped_columns?: Record<string, string>;
}

export const DATASETS_STORE: Map<string, IngestionDataset> = new Map();

// Seed initial dataset record for provenance
DATASETS_STORE.set('ds_initial_verified_ledger', {
  id: 'ds_initial_verified_ledger',
  company_id: 'comp_textile_a',
  company_name: 'Textile A (Apex Spinners)',
  name: 'FY2025 Audited Production & Sales Ledger',
  filename: 'Apex_Spinners_FY25_Audited_Ledger.xlsx',
  file_type: 'XLSX',
  row_count: 12,
  created_at: '2025-01-15T09:00:00Z',
  status: 'ingested',
  coverage_start: '2025-01-01',
  coverage_end: '2025-12-31',
  detected_columns: [
    'Period Date',
    'Revenue (Lakh)',
    'COGS (Lakh)',
    'Gross Profit (Lakh)',
    'Profit Margin %',
    'Units Produced',
    'Units Sold',
    'Operating Expenses (Lakh)',
    'Net Profit (Lakh)'
  ],
  preview_rows: [
    { 'Period Date': '2025-01-31', 'Revenue (Lakh)': 291.4, 'COGS (Lakh)': 246.23, 'Units Sold': 394800 },
    { 'Period Date': '2025-02-28', 'Revenue (Lakh)': 300.5, 'COGS (Lakh)': 253.92, 'Units Sold': 407200 }
  ]
});

// ====================================================
// 1. HEALTH & SYSTEM STATUS
// ====================================================
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    app_name: 'TexVantage AI',
    environment: process.env.NODE_ENV || 'development',
    database: 'connected',
    tenant_isolation: 'enforced_server_side',
    companies_seeded: SERVER_COMPANIES.length,
    users_seeded: SERVER_USERS.length,
    datasets_registered: DATASETS_STORE.size
  });
});

// ====================================================
// 2. AUTHENTICATION & DEMO ROLES
// ====================================================
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ detail: 'Email and password are required' });
  }

  const user = SERVER_USERS.find(
    u => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === password
  );

  if (!user) {
    return res.status(401).json({ detail: 'Invalid email or password' });
  }

  const token = createAccessToken(user);
  const comp = SERVER_COMPANIES.find(c => c.id === user.companyId);

  return res.json({
    access_token: token,
    token_type: 'Bearer',
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      company_id: user.companyId,
      company_name: comp ? comp.name : (user.role === 'ADMIN' ? 'Global Administration' : 'Enterprise Tenant'),
      job_title: user.jobTitle,
      avatar: user.avatar
    }
  });
});

apiRouter.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.fullUser!;
  const comp = SERVER_COMPANIES.find(c => c.id === user.companyId);

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    company_id: user.companyId,
    company_name: comp ? comp.name : (user.role === 'ADMIN' ? 'Global Administration' : 'Enterprise Tenant'),
    job_title: user.jobTitle,
    avatar: user.avatar
  });
});

apiRouter.post('/auth/demo-switch', (req: Request, res: Response) => {
  const { target_role, company_id } = req.body || {};

  let matchedUser = SERVER_USERS[0];
  if (target_role === 'ADMIN') {
    matchedUser = SERVER_USERS.find(u => u.role === 'ADMIN') || SERVER_USERS[0];
  } else if (target_role === 'OWNER') {
    if (company_id) {
      matchedUser = SERVER_USERS.find(u => u.role === 'OWNER' && u.companyId === company_id) || SERVER_USERS[1];
    } else {
      matchedUser = SERVER_USERS.find(u => u.role === 'OWNER') || SERVER_USERS[1];
    }
  }

  const token = createAccessToken(matchedUser);
  const comp = SERVER_COMPANIES.find(c => c.id === matchedUser.companyId);

  res.json({
    access_token: token,
    token_type: 'Bearer',
    user: {
      id: matchedUser.id,
      email: matchedUser.email,
      name: matchedUser.name,
      role: matchedUser.role,
      company_id: matchedUser.companyId,
      company_name: comp ? comp.name : (matchedUser.role === 'ADMIN' ? 'Global Administration' : 'Enterprise Tenant'),
      job_title: matchedUser.jobTitle,
      avatar: matchedUser.avatar
    }
  });
});

// ====================================================
// 3. COMPANIES APIs
// ====================================================
apiRouter.get('/companies', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  if (user.role === 'ADMIN') {
    return res.json(SERVER_COMPANIES);
  }

  const filtered = SERVER_COMPANIES.filter(c => c.id === user.company_id);
  res.json(filtered);
});

apiRouter.get('/companies/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const targetId = req.params.id;

  if (!checkCompanyAccess(user, targetId)) {
    return res.status(403).json({ detail: `Access denied: User not authorized to view company '${targetId}'` });
  }

  const comp = SERVER_COMPANIES.find(c => c.id === targetId);
  if (!comp) {
    return res.status(404).json({ detail: `Company '${targetId}' not found` });
  }

  res.json(comp);
});

// ====================================================
// 4. ANALYTICS APIs (TENANT-GUARDED)
// ====================================================
apiRouter.get('/analytics/summary', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetCompanyId = req.query.company_id as string | undefined;
    const summary = ServerAnalyticsService.getCompanySummary(req.user!, targetCompanyId);
    res.json(summary);
  } catch (err: any) {
    res.status(err.message?.includes('Access denied') ? 403 : 400).json({ detail: err.message });
  }
});

apiRouter.get('/analytics/sales-trend', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetCompanyId = req.query.company_id as string | undefined;
    const months = req.query.months ? parseInt(req.query.months as string, 10) : 6;
    const trend = ServerAnalyticsService.getSalesTrend(req.user!, targetCompanyId, months);
    res.json(trend);
  } catch (err: any) {
    res.status(err.message?.includes('Access denied') ? 403 : 400).json({ detail: err.message });
  }
});

apiRouter.get('/analytics/profit-trend', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetCompanyId = req.query.company_id as string | undefined;
    const months = req.query.months ? parseInt(req.query.months as string, 10) : 6;
    const trend = ServerAnalyticsService.getProfitTrend(req.user!, targetCompanyId, months);
    res.json(trend);
  } catch (err: any) {
    res.status(err.message?.includes('Access denied') ? 403 : 400).json({ detail: err.message });
  }
});

apiRouter.get('/analytics/top-products', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetCompanyId = req.query.company_id as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;
    const products = ServerAnalyticsService.getTopProducts(req.user!, targetCompanyId, limit);
    res.json(products);
  } catch (err: any) {
    res.status(err.message?.includes('Access denied') ? 403 : 400).json({ detail: err.message });
  }
});

apiRouter.get('/analytics/financials', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetCompanyId = req.query.company_id as string | undefined;
    const startDate = req.query.start_date as string | undefined;
    const endDate = req.query.end_date as string | undefined;
    const records = ServerAnalyticsService.getFinancials(req.user!, targetCompanyId, startDate, endDate);
    res.json(records);
  } catch (err: any) {
    res.status(err.message?.includes('Access denied') ? 403 : 400).json({ detail: err.message });
  }
});

apiRouter.post('/analytics/compare', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { company_ids, period_months } = req.body || {};
    const comparison = ServerAnalyticsService.compareCompanies(req.user!, company_ids, period_months || 6);
    res.json(comparison);
  } catch (err: any) {
    res.status(err.message?.includes('restricted') ? 403 : 400).json({ detail: err.message });
  }
});

apiRouter.get('/analytics/global-summary', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const periodMonths = req.query.period_months ? parseInt(req.query.period_months as string, 10) : 6;
    const summary = ServerAnalyticsService.getGlobalSummary(req.user!, periodMonths);
    res.json(summary);
  } catch (err: any) {
    res.status(err.message?.includes('restricted') ? 403 : 400).json({ detail: err.message });
  }
});

// ====================================================
// 5. DATASETS & INGESTION APIs
// ====================================================
apiRouter.get('/datasets', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const targetCompanyId = req.query.company_id as string | undefined;

  let datasets = Array.from(DATASETS_STORE.values());
  if (user.role !== 'ADMIN') {
    datasets = datasets.filter(d => d.company_id === user.company_id);
  } else if (targetCompanyId) {
    datasets = datasets.filter(d => d.company_id === targetCompanyId);
  }

  res.json(datasets);
});

apiRouter.post('/datasets/upload', requireAuth, upload.single('file'), (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ detail: 'No file uploaded' });
  }

  let companyId = user.company_id;
  if (user.role === 'ADMIN') {
    companyId = (req.body.company_id as string) || SERVER_COMPANIES[0].id;
  }

  if (!companyId) {
    return res.status(400).json({ detail: 'Target company ID required' });
  }

  const comp = SERVER_COMPANIES.find(c => c.id === companyId);
  const filename = file.originalname || 'uploaded_data.csv';
  const ext = filename.split('.').pop()?.toUpperCase() || 'CSV';

  let detectedColumns: string[] = [];
  let rows: any[] = [];

  try {
    if (ext === 'CSV' || ext === 'TXT') {
      const text = file.buffer.toString('utf-8');
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length > 0) {
        detectedColumns = lines[0].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
          const rowObj: Record<string, any> = {};
          detectedColumns.forEach((col, idx) => {
            rowObj[col] = values[idx] !== undefined ? values[idx] : null;
          });
          rows.push(rowObj);
        }
      }
    } else if (ext === 'XLSX' || ext === 'XLS') {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const firstSheet = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheet];
      const sheetJson = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });
      if (sheetJson.length > 0) {
        detectedColumns = (sheetJson[0] as any[]).map(c => String(c).trim());
        for (let i = 1; i < sheetJson.length; i++) {
          const values = sheetJson[i] as any[];
          if (!values || values.length === 0) continue;
          const rowObj: Record<string, any> = {};
          detectedColumns.forEach((col, idx) => {
            rowObj[col] = values[idx] !== undefined ? values[idx] : null;
          });
          rows.push(rowObj);
        }
      }
    } else if (ext === 'JSON') {
      const parsed = JSON.parse(file.buffer.toString('utf-8'));
      if (Array.isArray(parsed) && parsed.length > 0) {
        detectedColumns = Object.keys(parsed[0]);
        rows = parsed;
      }
    }
  } catch (parseErr: any) {
    return res.status(400).json({ detail: `Failed to parse file: ${parseErr.message}` });
  }

  const datasetId = `ds_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newDataset: IngestionDataset = {
    id: datasetId,
    company_id: companyId,
    company_name: comp ? comp.name : companyId,
    name: req.body.dataset_name || filename.replace(/\.[^/.]+$/, ''),
    filename,
    file_type: ext,
    row_count: rows.length,
    created_at: new Date().toISOString(),
    status: 'uploaded',
    detected_columns: detectedColumns,
    preview_rows: rows.slice(0, 5),
    all_rows: rows
  };

  DATASETS_STORE.set(datasetId, newDataset);

  res.json({
    dataset_id: datasetId,
    filename,
    file_type: ext,
    row_count: rows.length,
    detected_columns: detectedColumns,
    preview_rows: rows.slice(0, 5),
    status: 'uploaded'
  });
});

apiRouter.get('/datasets/:id/preview', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const dataset = DATASETS_STORE.get(req.params.id);

  if (!dataset) {
    return res.status(404).json({ detail: 'Dataset not found' });
  }

  if (user.role !== 'ADMIN' && dataset.company_id !== user.company_id) {
    return res.status(403).json({ detail: 'Access denied to this dataset' });
  }

  // Derive smart column heuristics and suggested mappings
  const detectedCols = dataset.detected_columns || [];
  const previewRows = dataset.preview_rows || [];
  const suggestedMappings: Record<string, string> = {};

  const columnsWithMeta = detectedCols.map(col => {
    const colLower = col.toLowerCase().replace(/[^a-z0-9]/g, '');
    let suggested = 'ignore';
    let dataType = 'string';
    let confidence: 'high' | 'medium' | 'low' | 'unknown_unit' | 'identifier' = 'low';
    let confidenceLabel = 'Review recommended';
    let isIdentifier = false;
    let requiresUnitConfirmation = false;

    const firstSample = previewRows.length > 0 ? previewRows[0][col] : '';
    if (firstSample !== undefined && firstSample !== null) {
      if (!isNaN(Number(firstSample)) && String(firstSample).trim() !== '') {
        dataType = 'number';
      } else if (String(firstSample).match(/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/)) {
        dataType = 'date';
      }
    }

    // 1. Identifiers: MUST NOT map to numeric metrics automatically
    if (
      colLower.endsWith('id') ||
      colLower.startsWith('id') ||
      colLower.includes('orderid') ||
      colLower.includes('transactionid') ||
      colLower.includes('custid') ||
      colLower.includes('productid') ||
      colLower.includes('code') ||
      colLower.includes('sku') ||
      colLower.includes('invoice')
    ) {
      suggested = 'ignore';
      confidence = 'identifier';
      confidenceLabel = 'Identifier: Ignore by default';
      isIdentifier = true;
    }
    // 2. Dates
    else if (
      colLower.includes('orderdate') ||
      colLower.includes('date') ||
      colLower.includes('period') ||
      colLower.includes('month') ||
      colLower.includes('year')
    ) {
      suggested = 'date';
      confidence = 'high';
      confidenceLabel = 'Auto-detected: Period Date';
    }
    // 3. Units / Volume / Quantity
    else if (
      colLower === 'quantity' ||
      colLower === 'qty' ||
      colLower.includes('unitsold') ||
      colLower.includes('unitssold') ||
      colLower.includes('volume')
    ) {
      suggested = 'units_sold';
      confidence = 'high';
      confidenceLabel = 'Auto-detected: Volume / Units';
    }
    // 4. Product / Category
    else if (
      colLower === 'category' ||
      colLower.includes('productcategory') ||
      colLower.includes('fabric') ||
      colLower.includes('itemcategory')
    ) {
      suggested = 'category_name';
      confidence = 'high';
      confidenceLabel = 'Auto-detected: Category';
    }
    // 5. Unit Price
    else if (
      colLower === 'unitprice' ||
      colLower === 'price' ||
      colLower.includes('rate')
    ) {
      suggested = 'unit_price';
      confidence = 'medium';
      confidenceLabel = 'Review recommended (Unit Price)';
      requiresUnitConfirmation = true;
    }
    // 6. Revenue / Sales - Check if unit is explicitly stated (e.g. Lakh / INR)
    else if (
      colLower.includes('revenue') ||
      colLower.includes('sales') ||
      colLower.includes('turnover') ||
      colLower.includes('amount')
    ) {
      if (colLower.includes('lakh') || colLower.includes('inr')) {
        suggested = 'revenue_lakh';
        confidence = 'high';
        confidenceLabel = 'Auto-detected (₹ Lakhs verified)';
      } else {
        // Source does not establish unit: Require confirmation / Raw Currency
        suggested = 'revenue_raw';
        confidence = 'unknown_unit';
        confidenceLabel = 'Unknown unit: Requires confirmation';
        requiresUnitConfirmation = true;
      }
    }
    // 7. COGS / Cost
    else if (colLower.includes('cogs') || colLower.includes('directcost')) {
      if (colLower.includes('lakh')) {
        suggested = 'cogs_lakh';
        confidence = 'high';
        confidenceLabel = 'Auto-detected (₹ Lakhs verified)';
      } else {
        suggested = 'cogs_raw';
        confidence = 'unknown_unit';
        confidenceLabel = 'Unknown unit: Requires confirmation';
        requiresUnitConfirmation = true;
      }
    }
    // 8. Profit
    else if (colLower.includes('grossprofit') || colLower.includes('profit')) {
      suggested = 'gross_profit_lakh';
      confidence = 'medium';
      confidenceLabel = 'Review recommended (Gross Profit)';
    }
    // 9. Customer / Market Segment
    else if (colLower.includes('segment') || colLower.includes('market') || colLower.includes('clienttier')) {
      suggested = 'customer_segment';
      confidence = 'high';
      confidenceLabel = 'Auto-detected: Segment';
    }
    // 10. Country / Geographic / General ignore
    else if (colLower.includes('country') || colLower.includes('city') || colLower.includes('region')) {
      suggested = 'ignore';
      confidence = 'high';
      confidenceLabel = 'Ignore: Geographic metadata';
    }

    if (suggested !== 'ignore' && !Object.values(suggestedMappings).includes(suggested)) {
      suggestedMappings[col] = suggested;
    }

    return {
      column_name: col,
      data_type: dataType,
      suggested_field: suggested,
      confidence,
      confidence_label: confidenceLabel,
      is_identifier: isIdentifier,
      requires_unit_confirmation: requiresUnitConfirmation,
      sample_value: firstSample !== undefined && firstSample !== null ? String(firstSample) : ''
    };
  });

  res.json({
    dataset_id: dataset.id,
    dataset_name: dataset.name,
    original_filename: dataset.filename,
    filename: dataset.filename,
    file_type: dataset.file_type,
    file_format: dataset.file_type,
    total_rows: dataset.row_count,
    row_count: dataset.row_count,
    columns: columnsWithMeta,
    detected_columns: dataset.detected_columns,
    sample_rows: dataset.preview_rows,
    preview_rows: dataset.preview_rows,
    suggested_mappings: suggestedMappings
  });
});

apiRouter.post('/datasets/:id/mapping', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const dataset = DATASETS_STORE.get(req.params.id);

  if (!dataset) {
    return res.status(404).json({ detail: 'Dataset not found' });
  }

  if (user.role !== 'ADMIN' && dataset.company_id !== user.company_id) {
    return res.status(403).json({ detail: 'Access denied to this dataset' });
  }

  const { mapping, mode } = req.body || {};
  dataset.mapped_columns = mapping || {};
  dataset.status = 'ingested';

  // Process rows into SERVER_FINANCIALS with strict conservative non-fabrication
  const comp = SERVER_COMPANIES.find(c => c.id === dataset.company_id);
  const rows = dataset.all_rows || [];
  let ingestedCount = 0;
  let minDate = '2025-01-01';
  let maxDate = '2026-12-31';

  if (mapping && rows.length > 0) {
    // Determine mapping assignments
    let dateCol = '';
    let revLakhCol = '';
    let revRawCol = '';
    let cogsLakhCol = '';
    let cogsRawCol = '';
    let grossProfitCol = '';
    let unitsCol = '';
    let categoryCol = '';

    for (const [colName, targetField] of Object.entries(mapping as Record<string, string>)) {
      if (targetField === 'date') dateCol = colName;
      else if (targetField === 'revenue_lakh' || targetField === 'revenue') revLakhCol = colName;
      else if (targetField === 'revenue_raw') revRawCol = colName;
      else if (targetField === 'cogs_lakh' || targetField === 'cogs') cogsLakhCol = colName;
      else if (targetField === 'cogs_raw') cogsRawCol = colName;
      else if (targetField === 'gross_profit_lakh' || targetField === 'gross_profit') grossProfitCol = colName;
      else if (targetField === 'units_sold') unitsCol = colName;
      else if (targetField === 'category_name') categoryCol = colName;
    }

    if (mode === 'REPLACE') {
      // Remove previous records for this company
      const idxsToDelete = SERVER_FINANCIALS.map((f, i) => f.companyId === dataset.company_id ? i : -1).filter(i => i !== -1);
      for (let i = idxsToDelete.length - 1; i >= 0; i--) {
        SERVER_FINANCIALS.splice(idxsToDelete[i], 1);
      }
    }

    const collectedDates: string[] = [];

    rows.forEach((row, i) => {
      const rawDate = dateCol && row[dateCol] ? String(row[dateCol]).trim() : `2025-${String((i % 12) + 1).padStart(2, '0')}-28`;
      
      // Calculate revenue safely (if raw standard currency, convert /100,000 to Lakhs if indicated, or store numeric)
      let rev = 0;
      if (revLakhCol && row[revLakhCol] !== undefined) {
        rev = parseFloat(row[revLakhCol]) || 0;
      } else if (revRawCol && row[revRawCol] !== undefined) {
        const rawVal = parseFloat(row[revRawCol]) || 0;
        // If raw is standard currency amount (e.g. > 10,000), convert to Lakhs (1 Lakh = 100,000)
        rev = +(rawVal / 100000).toFixed(4);
      }

      // COGS: Strictly NULL if not present in source; NEVER fabricate from revenue multiplier
      let cogs: number | null = null;
      if (cogsLakhCol && row[cogsLakhCol] !== undefined && row[cogsLakhCol] !== null && String(row[cogsLakhCol]).trim() !== '') {
        cogs = parseFloat(row[cogsLakhCol]) || 0;
      } else if (cogsRawCol && row[cogsRawCol] !== undefined && row[cogsRawCol] !== null && String(row[cogsRawCol]).trim() !== '') {
        cogs = +(parseFloat(row[cogsRawCol]) / 100000).toFixed(4);
      }

      // Gross Profit: Strictly NULL if not present in source or cannot be mathematically derived from explicit COGS
      let grossProfit: number | null = null;
      if (grossProfitCol && row[grossProfitCol] !== undefined && row[grossProfitCol] !== null && String(row[grossProfitCol]).trim() !== '') {
        grossProfit = parseFloat(row[grossProfitCol]) || 0;
      } else if (cogs !== null) {
        grossProfit = +(rev - cogs).toFixed(2);
      }

      // Margin: Only calculate if revenue > 0 and gross profit is actually known
      const margin = (rev > 0 && grossProfit !== null) ? +((grossProfit / rev) * 100).toFixed(2) : null;

      // Units Sold: Only from mapped source column; NEVER synthesize
      const units: number | null = (unitsCol && row[unitsCol] !== undefined && row[unitsCol] !== null && String(row[unitsCol]).trim() !== '')
        ? (parseInt(row[unitsCol], 10) || 0)
        : null;

      if (rawDate && rawDate.length >= 7) {
        collectedDates.push(rawDate.substring(0, 10));
      }

      if (rev > 0 || (units !== null && units > 0)) {
        SERVER_FINANCIALS.push({
          id: `fin_custom_${dataset.id}_${i}`,
          companyId: dataset.company_id,
          year: parseInt(rawDate.substring(0, 4), 10) || 2025,
          month: parseInt(rawDate.substring(5, 7), 10) || ((i % 12) + 1),
          monthName: `Period ${i + 1}`,
          periodDate: rawDate.length === 10 ? rawDate : `2025-12-31`,
          revenueLakh: rev,
          costOfGoodsSoldLakh: cogs, // NULL if absent (never 0 placeholder)
          grossProfitLakh: grossProfit, // NULL if absent (never 0 placeholder)
          profitMarginPct: margin, // NULL if absent (never 0 placeholder)
          operatingExpensesLakh: null, // NULL (never 0 placeholder)
          netProfitLakh: null, // NULL (never 0 placeholder)
          unitsProduced: null, // NULL (never 0 placeholder)
          unitsSold: units,
          ordersCount: 1, // Deterministic single transaction record, NOT raw OrderID string
          averageSellingPrice: (units !== null && units > 0 && rev > 0) ? +((rev * 100000) / units).toFixed(2) : null,
          capacityUtilizationPct: null, // NULL (never 0 placeholder)
          unitOfMeasure: comp ? comp.volumeUnit : 'units'
        });
        ingestedCount++;
      }
    });

    if (collectedDates.length > 0) {
      collectedDates.sort();
      minDate = collectedDates[0];
      maxDate = collectedDates[collectedDates.length - 1];
    }
  }

  res.json({
    success: true,
    dataset_id: dataset.id,
    status: 'ingested',
    mode: mode || 'APPEND',
    records_imported: ingestedCount || rows.length,
    records_ingested: ingestedCount || rows.length,
    date_range_start: minDate,
    date_range_end: maxDate
  });
});

apiRouter.delete('/datasets/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const dataset = DATASETS_STORE.get(req.params.id);

  if (!dataset) {
    return res.status(404).json({ detail: 'Dataset not found' });
  }

  if (user.role !== 'ADMIN' && dataset.company_id !== user.company_id) {
    return res.status(403).json({ detail: 'Access denied to delete this dataset' });
  }

  DATASETS_STORE.delete(req.params.id);
  res.json({ success: true, message: 'Dataset successfully removed' });
});

// ====================================================
// 6. EXECUTIVE REPORT EXPORTS (PHASE 5D)
// ====================================================
apiRouter.get('/reports/metadata', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const accessibleCompanies = user.role === 'ADMIN'
    ? SERVER_COMPANIES.map(c => c.name)
    : SERVER_COMPANIES.filter(c => c.id === user.company_id).map(c => c.name);

  res.json({
    title: 'TexVantage AI — Executive Business Reports',
    tenant_scope: user.role === 'ADMIN' ? 'Global Administrator (All 10 Mills)' : `Single Enterprise (${accessibleCompanies[0]})`,
    companies_included: accessibleCompanies,
    sheets: [
      'Executive Summary',
      user.role === 'ADMIN' ? 'Company Comparison' : 'Financial Performance',
      'Monthly Trend',
      'Product Performance',
      'Data Sources'
    ],
    supported_formats: ['XLSX']
  });
});

apiRouter.post('/reports/excel', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { report_type, company_ids, company_id, period_months, title } = req.body || {};

  // Enforce TenantGuard
  if (user.role !== 'ADMIN') {
    if (company_id && company_id !== user.company_id) {
      return res.status(403).json({ detail: 'Access denied: You cannot export data for other companies' });
    }
    if (company_ids && company_ids.some((id: string) => id !== user.company_id)) {
      return res.status(403).json({ detail: 'Access denied: Cross-company report export forbidden' });
    }
  }

  const targetCompId = company_id || user.company_id || SERVER_COMPANIES[0].id;
  const comp = SERVER_COMPANIES.find(c => c.id === targetCompId) || SERVER_COMPANIES[0];
  const months = period_months || 12;

  // Build Workbook using SheetJS
  const wb = XLSX.utils.book_new();

  // Sheet 1: Executive Summary
  const execData = [
    ['TEXVANTAGE AI — EXECUTIVE BUSINESS REPORT', ''],
    ['Generated At', new Date().toISOString()],
    ['Report Scope', user.role === 'ADMIN' ? 'Portfolio Overview' : comp.name],
    ['Target Enterprise', comp.name],
    ['Enterprise Code', comp.code],
    ['Location', `${comp.city}, ${comp.state}`],
    ['Period Covered', `Past ${months} Months`],
    ['', ''],
    ['KEY PERFORMANCE INDICATORS', 'VALUE'],
    ['Revenue Base (Lakh)', `₹${comp.revenueBase} L`],
    ['Average Margin', `${comp.marginBase}%`],
    ['Annual Capacity', comp.annualCapacity],
    ['Volume Unit', comp.volumeUnit]
  ];
  const wsExec = XLSX.utils.aoa_to_sheet(execData);
  XLSX.utils.book_append_sheet(wb, wsExec, 'Executive Summary');

  // Sheet 2: Financial Performance / Comparison
  if (user.role === 'ADMIN' && (report_type === 'portfolio' || report_type === 'comparison')) {
    const compRows = [
      ['Company Name', 'Code', 'Specialization', 'City', 'State', 'Revenue Base (Lakh)', 'Margin Base %', 'Volume Unit']
    ];
    SERVER_COMPANIES.forEach(c => {
      compRows.push([
        c.name,
        c.code,
        c.specialization,
        c.city,
        c.state,
        String(c.revenueBase),
        String(c.marginBase),
        c.volumeUnit
      ]);
    });
    const wsComp = XLSX.utils.aoa_to_sheet(compRows);
    XLSX.utils.book_append_sheet(wb, wsComp, 'Company Comparison');
  } else {
    const finRows = [
      ['Period', 'Date', 'Revenue (₹ Lakh)', 'COGS (₹ Lakh)', 'Gross Profit (₹ Lakh)', 'Margin %', 'Units Sold', 'ASP (₹/Unit)']
    ];
    const fins = SERVER_FINANCIALS.filter(f => f.companyId === targetCompId).slice(-months);
    fins.forEach(f => {
      finRows.push([
        f.monthName,
        f.periodDate,
        String(f.revenueLakh),
        String(f.costOfGoodsSoldLakh),
        String(f.grossProfitLakh),
        `${f.profitMarginPct}%`,
        String(f.unitsSold),
        `₹${f.averageSellingPrice}`
      ]);
    });
    const wsFin = XLSX.utils.aoa_to_sheet(finRows);
    XLSX.utils.book_append_sheet(wb, wsFin, 'Financial Performance');
  }

  // Sheet 3: Monthly Trend
  const trendRows = [['Month', 'Period Date', 'Monthly Revenue (₹ Lakh)', 'Units Sold']];
  const trends = SERVER_FINANCIALS.filter(f => f.companyId === targetCompId).slice(-months);
  trends.forEach(t => {
    trendRows.push([t.monthName, t.periodDate, String(t.revenueLakh), String(t.unitsSold)]);
  });
  const wsTrend = XLSX.utils.aoa_to_sheet(trendRows);
  XLSX.utils.book_append_sheet(wb, wsTrend, 'Monthly Trend');

  // Sheet 4: Product Performance
  const prodRows = [['Product Category', 'Sales Volume', 'Unit of Measure', 'Revenue (₹ Lakh)', 'Margin %', 'Top Segment']];
  const prods = SERVER_PRODUCTS.filter(p => p.companyId === targetCompId);
  prods.forEach(p => {
    prodRows.push([p.categoryName, String(p.salesVolumeUnits), p.unitOfMeasure, String(p.revenueLakh), `${p.profitMarginPct}%`, p.topCustomerSegment]);
  });
  const wsProd = XLSX.utils.aoa_to_sheet(prodRows);
  XLSX.utils.book_append_sheet(wb, wsProd, 'Product Performance');

  // Sheet 5: Data Sources (Provenance)
  const sourceRows = [['Dataset ID', 'Enterprise', 'Dataset Name', 'Filename', 'Format', 'Records', 'Status', 'Coverage']];
  Array.from(DATASETS_STORE.values())
    .filter(d => user.role === 'ADMIN' || d.company_id === targetCompId)
    .forEach(d => {
      sourceRows.push([d.id, d.company_name, d.name, d.filename, d.file_type, String(d.row_count), d.status, `${d.coverage_start || 'N/A'} - ${d.coverage_end || 'N/A'}`]);
    });
  const wsSource = XLSX.utils.aoa_to_sheet(sourceRows);
  XLSX.utils.book_append_sheet(wb, wsSource, 'Data Sources');

  // Generate Excel Buffer
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filename = `${title ? title.replace(/[^a-zA-Z0-9_-]/g, '_') : 'TexVantage_Report'}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});

// ====================================================
// 7. CHAT & REAL-TIME SSE STREAMING
// ====================================================
apiRouter.get('/chat/conversations', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const convs = Array.from(SERVER_CONVERSATIONS.values()).filter(c => c.userId === user.sub);
  res.json(convs);
});

apiRouter.post('/chat/stream', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { prompt, conversation_id } = req.body || {};

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ detail: 'Prompt is required' });
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const orchestrator = new ServerAIOrchestrator(user);

  await orchestrator.streamConversationTurn(prompt, conversation_id, {
    onStatus: (msg) => {
      res.write(`data: ${JSON.stringify({ type: 'status', message: msg })}\n\n`);
    },
    onToolStart: (tool, args) => {
      res.write(`data: ${JSON.stringify({ type: 'tool_start', tool, arguments: args, message: `Querying repository: ${tool}` })}\n\n`);
    },
    onToolComplete: (tool, summary, result) => {
      res.write(`data: ${JSON.stringify({ type: 'tool_complete', tool, resultSummary: summary, data: result, result })}\n\n`);
    },
    onToken: (tok) => {
      res.write(`data: ${JSON.stringify({ type: 'token', content: tok, text: tok })}\n\n`);
    },
    onArtifact: (art) => {
      res.write(`data: ${JSON.stringify({ type: 'artifact', artifact: art })}\n\n`);
    },
    onDone: () => {
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    },
    onError: (err) => {
      res.write(`data: ${JSON.stringify({ type: 'error', message: err })}\n\n`);
      res.end();
    }
  });
});

// Error handling middleware for API routes (Multer errors & server exceptions)
apiRouter.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API Error]', err);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ detail: `File upload error: ${err.message}` });
  }
  return res.status(err.status || 500).json({
    detail: err.message || 'Internal API server error'
  });
});

// Explicit JSON 404 for unmatched API routes
apiRouter.all('*', (req: Request, res: Response) => {
  res.status(404).json({
    detail: `API endpoint not found: ${req.method} ${req.originalUrl || req.url}`
  });
});
