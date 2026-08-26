import {
  SERVER_COMPANIES,
  SERVER_FINANCIALS,
  SERVER_PRODUCTS,
  ServerCompany,
  ServerMonthlyFinancial
} from './database';
import { AuthenticatedUserPayload, checkCompanyAccess } from './auth';

export class ServerAnalyticsService {
  static resolveCompanyScope(user: AuthenticatedUserPayload, targetCompanyId?: string): string {
    if (user.role !== 'ADMIN') {
      if (!user.company_id) {
        throw new Error('User has no associated company context');
      }
      if (targetCompanyId && targetCompanyId !== user.company_id) {
        throw new Error(`Access denied: User is not authorized to query company '${targetCompanyId}'.`);
      }
      return user.company_id;
    }

    if (targetCompanyId) {
      return targetCompanyId;
    }

    return SERVER_COMPANIES[0].id;
  }

  static getCompanySummary(user: AuthenticatedUserPayload, targetCompanyId?: string) {
    const compId = this.resolveCompanyScope(user, targetCompanyId);
    const company = SERVER_COMPANIES.find(c => c.id === compId);
    if (!company) {
      throw new Error(`Company '${compId}' not found`);
    }

    const financials = SERVER_FINANCIALS.filter(f => f.companyId === compId).sort((a, b) =>
      a.periodDate.localeCompare(b.periodDate)
    );

    const totalRev = +financials.reduce((acc, f) => acc + (f.revenueLakh || 0), 0).toFixed(2);

    const hasGrossProfit = financials.some(f => f.grossProfitLakh !== null);
    const validGpRecords = financials.filter(f => f.grossProfitLakh !== null);
    const totalGrossProfit = hasGrossProfit
      ? +validGpRecords.reduce((acc, f) => acc + (f.grossProfitLakh ?? 0), 0).toFixed(2)
      : null;

    const avgMargin = (totalGrossProfit !== null && totalRev > 0)
      ? +((totalGrossProfit / totalRev) * 100).toFixed(2)
      : null;

    const hasUnits = financials.some(f => f.unitsSold !== null);
    const validUnitsRecords = financials.filter(f => f.unitsSold !== null);
    const totalUnitsSold = hasUnits
      ? validUnitsRecords.reduce((acc, f) => acc + (f.unitsSold ?? 0), 0)
      : null;

    const latest = financials[financials.length - 1];
    const prev = financials.length >= 2 ? financials[financials.length - 2] : null;

    const momGrowth =
      prev && prev.revenueLakh > 0
        ? +(((latest.revenueLakh - prev.revenueLakh) / prev.revenueLakh) * 100).toFixed(2)
        : 0;

    // Peaks and troughs
    let maxRev = financials[0];
    let minRev = financials[0];
    
    const marginRecords = financials.filter(f => f.profitMarginPct !== null);
    let maxMargin = marginRecords.length > 0 ? marginRecords[0] : null;
    let minMargin = marginRecords.length > 0 ? marginRecords[0] : null;

    financials.forEach(f => {
      if (f.revenueLakh > maxRev.revenueLakh) maxRev = f;
      if (f.revenueLakh < minRev.revenueLakh) minRev = f;
    });

    marginRecords.forEach(f => {
      if (maxMargin && f.profitMarginPct !== null && maxMargin.profitMarginPct !== null && f.profitMarginPct > maxMargin.profitMarginPct) maxMargin = f;
      if (minMargin && f.profitMarginPct !== null && minMargin.profitMarginPct !== null && f.profitMarginPct < minMargin.profitMarginPct) minMargin = f;
    });

    return {
      company_id: company.id,
      company_name: company.name,
      code: company.code,
      specialization: company.specialization,
      city: company.city,
      state: company.state,
      founded_year: company.foundedYear,
      capacity_description: company.annualCapacity,
      period_months: financials.length,
      latest_month: latest ? latest.monthName : 'N/A',
      latest_monthly_revenue_lakh: latest ? latest.revenueLakh : 0,
      latest_profit_margin_pct: latest ? latest.profitMarginPct : null,
      latest_units_sold: latest ? latest.unitsSold : null,
      latest_capacity_utilization_pct: latest ? latest.capacityUtilizationPct : null,
      mom_revenue_growth_pct: momGrowth,
      annual_aggregate: {
        total_revenue_lakh: totalRev,
        total_gross_profit_lakh: totalGrossProfit,
        weighted_profit_margin_pct: avgMargin,
        total_units_sold: totalUnitsSold,
        unit_of_measure: company.volumeUnit
      },
      peaks_and_troughs: {
        peak_revenue_month: maxRev?.monthName,
        peak_revenue_lakh: maxRev?.revenueLakh,
        lowest_revenue_month: minRev?.monthName,
        lowest_revenue_lakh: minRev?.revenueLakh,
        highest_margin_month: maxMargin ? maxMargin.monthName : null,
        highest_margin_pct: maxMargin ? maxMargin.profitMarginPct : null,
        lowest_margin_month: minMargin ? minMargin.monthName : null,
        lowest_margin_pct: minMargin ? minMargin.profitMarginPct : null
      }
    };
  }

  static getSalesTrend(user: AuthenticatedUserPayload, targetCompanyId?: string, months: number = 6) {
    const compId = this.resolveCompanyScope(user, targetCompanyId);
    let financials = SERVER_FINANCIALS.filter(f => f.companyId === compId).sort((a, b) =>
      a.periodDate.localeCompare(b.periodDate)
    );

    if (months && financials.length > months) {
      financials = financials.slice(-months);
    }

    const totalRev = +financials.reduce((acc, f) => acc + f.revenueLakh, 0).toFixed(2);
    const avgRev = financials.length > 0 ? +(totalRev / financials.length).toFixed(2) : 0;

    const series = financials.map((f, idx) => {
      const prev = idx > 0 ? financials[idx - 1] : null;
      const growth =
        prev && prev.revenueLakh > 0
          ? +(((f.revenueLakh - prev.revenueLakh) / prev.revenueLakh) * 100).toFixed(2)
          : 0;
      const change = prev ? +(f.revenueLakh - prev.revenueLakh).toFixed(2) : 0;

      return {
        month: f.monthName,
        period_date: f.periodDate,
        revenue_lakh: f.revenueLakh,
        units_sold: f.unitsSold,
        growth_pct: growth,
        change_lakh: change
      };
    });

    return {
      company_id: compId,
      period_months: financials.length,
      total_period_revenue_lakh: totalRev,
      avg_monthly_revenue_lakh: avgRev,
      series
    };
  }

  static getProfitTrend(user: AuthenticatedUserPayload, targetCompanyId?: string, months: number = 6) {
    const compId = this.resolveCompanyScope(user, targetCompanyId);
    let financials = SERVER_FINANCIALS.filter(f => f.companyId === compId).sort((a, b) =>
      a.periodDate.localeCompare(b.periodDate)
    );

    if (months && financials.length > months) {
      financials = financials.slice(-months);
    }

    const hasProfit = financials.some(f => f.grossProfitLakh !== null);
    const validGpRecords = financials.filter(f => f.grossProfitLakh !== null);
    const totalProfit = hasProfit ? +validGpRecords.reduce((acc, f) => acc + (f.grossProfitLakh ?? 0), 0).toFixed(2) : null;
    const totalRev = +financials.reduce((acc, f) => acc + f.revenueLakh, 0).toFixed(2);
    const avgMargin = (totalProfit !== null && totalRev > 0) ? +((totalProfit / totalRev) * 100).toFixed(2) : null;

    const series = financials.map((f, idx) => {
      const prev = idx > 0 ? financials[idx - 1] : null;
      const profitGrowth =
        prev && prev.grossProfitLakh !== null && prev.grossProfitLakh > 0 && f.grossProfitLakh !== null
          ? +(((f.grossProfitLakh - prev.grossProfitLakh) / prev.grossProfitLakh) * 100).toFixed(2)
          : null;

      return {
        month: f.monthName,
        gross_profit_lakh: f.grossProfitLakh,
        profit_margin_pct: f.profitMarginPct,
        profit_growth_pct: profitGrowth
      };
    });

    return {
      company_id: compId,
      period_months: financials.length,
      total_period_gross_profit_lakh: totalProfit,
      avg_margin_pct: avgMargin,
      series
    };
  }

  static getTopProducts(user: AuthenticatedUserPayload, targetCompanyId?: string, limit: number = 5) {
    const compId = this.resolveCompanyScope(user, targetCompanyId);
    const products = SERVER_PRODUCTS.filter(p => p.companyId === compId);

    const sorted = [...products].sort((a, b) => b.revenueLakh - a.revenueLakh).slice(0, limit);

    return sorted.map(p => ({
      category_name: p.categoryName,
      total_revenue_lakh: p.revenueLakh,
      total_volume_units: p.salesVolumeUnits,
      unit_of_measure: p.unitOfMeasure,
      avg_margin_pct: p.profitMarginPct,
      top_customer_segment: p.topCustomerSegment
    }));
  }

  static getFinancials(
    user: AuthenticatedUserPayload,
    targetCompanyId?: string,
    startDate?: string,
    endDate?: string
  ) {
    const compId = this.resolveCompanyScope(user, targetCompanyId);
    let financials = SERVER_FINANCIALS.filter(f => f.companyId === compId);

    if (startDate) {
      financials = financials.filter(f => f.periodDate >= startDate);
    }
    if (endDate) {
      financials = financials.filter(f => f.periodDate <= endDate);
    }

    return financials.sort((a, b) => a.periodDate.localeCompare(b.periodDate));
  }

  static compareCompanies(user: AuthenticatedUserPayload, companyIds?: string[], periodMonths: number = 6) {
    if (user.role !== 'ADMIN') {
      throw new Error('Cross-company comparison is restricted to Global Administrators.');
    }

    const targetCompanies = companyIds && companyIds.length > 0
      ? SERVER_COMPANIES.filter(c => companyIds.includes(c.id))
      : SERVER_COMPANIES;

    const companySummaries = targetCompanies.map(c => {
      const fins = SERVER_FINANCIALS.filter(f => f.companyId === c.id)
        .sort((a, b) => a.periodDate.localeCompare(b.periodDate))
        .slice(-periodMonths);

      const rev = +fins.reduce((acc, f) => acc + f.revenueLakh, 0).toFixed(2);
      const profit = +fins.reduce((acc, f) => acc + f.grossProfitLakh, 0).toFixed(2);
      const margin = rev > 0 ? +((profit / rev) * 100).toFixed(2) : 0;
      const latest = fins[fins.length - 1];

      return {
        id: c.id,
        name: c.name,
        code: c.code,
        specialization: c.specialization,
        city: c.city,
        state: c.state,
        total_revenue_lakh: rev,
        total_gross_profit_lakh: profit,
        weighted_profit_margin_pct: margin,
        latest_monthly_revenue_lakh: latest ? latest.revenueLakh : 0,
        latest_profit_margin_pct: latest ? latest.profitMarginPct : 0,
        capacity_description: c.annualCapacity
      };
    });

    // Sort by revenue descending
    companySummaries.sort((a, b) => b.total_revenue_lakh - a.total_revenue_lakh);

    return {
      period_months: periodMonths,
      companies_count: companySummaries.length,
      companies: companySummaries
    };
  }

  static getGlobalSummary(user: AuthenticatedUserPayload, periodMonths: number = 6) {
    if (user.role !== 'ADMIN') {
      throw new Error('Global portfolio analytics is restricted to Global Administrators.');
    }

    const comparison = this.compareCompanies(user, undefined, periodMonths);
    const totalRev = +comparison.companies.reduce((acc, c) => acc + c.total_revenue_lakh, 0).toFixed(2);
    const totalProfit = +comparison.companies.reduce((acc, c) => acc + c.total_gross_profit_lakh, 0).toFixed(2);
    const avgMargin = totalRev > 0 ? +((totalProfit / totalRev) * 100).toFixed(2) : 0;

    return {
      period_months: periodMonths,
      total_portfolio_revenue_lakh: totalRev,
      total_portfolio_gross_profit_lakh: totalProfit,
      portfolio_average_margin_pct: avgMargin,
      total_mills: SERVER_COMPANIES.length,
      top_performing_company: comparison.companies[0],
      highest_margin_company: [...comparison.companies].sort((a, b) => b.weighted_profit_margin_pct - a.weighted_profit_margin_pct)[0],
      companies: comparison.companies
    };
  }
}
