// Pure Frontend API Wrapper for Backend Analytics Endpoints
// Contains NO math, NO client-side business calculations, NO mock datasets
// All metrics, aggregations, trends, and rankings come exclusively from FastAPI backend

import { apiClient } from './apiClient';

export class AnalyticsEngine {
  /**
   * Retrieves deterministic company executive summary and KPI cards from backend
   */
  static async getCompanySummary(companyId?: string) {
    return apiClient.analytics.getSummary(companyId);
  }

  /**
   * ADMIN ONLY: Retrieves aggregated portfolio KPIs across all 10 mills
   */
  static async getGlobalSummary(periodMonths: number = 6) {
    return apiClient.analytics.getGlobalSummary(periodMonths);
  }

  /**
   * Retrieves audited monthly financial statement records from backend
   */
  static async getFinancialsForCompany(companyId?: string, startDate?: string, endDate?: string) {
    return apiClient.analytics.getFinancials(companyId, startDate, endDate);
  }

  /**
   * Retrieves chronological sales and unit volume trend series
   */
  static async getSalesTrend(companyId?: string, months: number = 6) {
    return apiClient.analytics.getSalesTrend(companyId, months);
  }

  /**
   * Retrieves chronological profit and gross margin trend series
   */
  static async getProfitTrend(companyId?: string, months: number = 6) {
    return apiClient.analytics.getProfitTrend(companyId, months);
  }

  /**
   * Retrieves top revenue product categories and margin economics
   */
  static async getProductMetrics(companyId?: string, limit: number = 5) {
    return apiClient.analytics.getTopProducts(companyId, limit);
  }

  /**
   * ADMIN ONLY: Cross-company side-by-side benchmark matrix
   */
  static async compareCompanies(companyIds?: string[], periodMonths: number = 6) {
    return apiClient.analytics.compareCompanies(companyIds, periodMonths);
  }
}
