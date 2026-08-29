import { AIArtifact } from '../types';

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? (value as Record<string, any>) : {};
}

export function normalizeArtifact(raw: any): AIArtifact | null {
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== 'object') return null;

  const type = (raw.type || raw.artifact_type) as AIArtifact['type'];
  if (!type) return null;

  const data = asRecord(raw.data);
  const title = raw.title || data.filename || 'Insight';

  if (type === 'kpi') {
    return {
      id: raw.id || `kpi_${Date.now()}`,
      type,
      title,
      data: {
        metric: data.metric || title,
        value: data.value ?? '—',
        rawValue: data.rawValue ?? data.raw_value,
        change: data.change || '',
        changeType: data.changeType || data.change_type || 'neutral',
        period: data.period || '',
        subtext: data.subtext
      }
    };
  }

  if (type === 'chart') {
    const series = Array.isArray(data.series) ? data.series : [];
    const dataPoints = data.dataPoints || data.data_points || [];
    const chartType = data.chartType || data.chart_type || 'bar';
    return {
      id: raw.id || `chart_${Date.now()}`,
      type,
      title,
      data: {
        chartType,
        xKey: data.xKey || data.x_key || 'month',
        series: series.map((s: any) => ({
          key: s.key,
          name: s.name || s.key,
          color: s.color || '#3B82F6',
          type: s.type || chartType
        })),
        dataPoints
      }
    };
  }

  if (type === 'table') {
    return {
      id: raw.id || `table_${Date.now()}`,
      type,
      title,
      data: {
        columns: data.columns || [],
        rows: data.rows || []
      }
    };
  }

  if (type === 'file') {
    return {
      id: raw.id || `file_${Date.now()}`,
      type,
      title,
      data: {
        filename: data.filename || title,
        format: data.format || 'xlsx',
        size: data.size || '',
        description: data.description || '',
        downloadUrl: data.downloadUrl || data.download_url,
        reportType: data.reportType || data.report_type,
        companyIds: data.companyIds || data.company_ids,
        companyId: data.companyId || data.company_id,
        periodMonths: data.periodMonths || data.period_months,
        analysisContext: data.analysisContext || data.analysis_context
      }
    };
  }

  return null;
}
