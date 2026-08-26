// Server-Side Authoritative Database Repository
// Contains initial seeded data for the 10 Indian Textile Enterprises

export interface ServerCompany {
  id: string;
  name: string;
  code: string;
  specialization: string;
  city: string;
  state: string;
  foundedYear: number;
  annualCapacity: string;
  revenueBase: number; // in ₹ Lakhs
  marginBase: number; // %
  growthFactor: number;
  volumeBase: number;
  volumeUnit: string;
}

export interface ServerMonthlyFinancial {
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
  operatingExpensesLakh: number | null;
  netProfitLakh: number | null;
  unitsProduced: number | null;
  unitsSold: number | null;
  ordersCount: number | null;
  averageSellingPrice: number | null;
  capacityUtilizationPct: number | null;
  unitOfMeasure: string;
}

export interface ServerProductMetric {
  id: string;
  companyId: string;
  categoryName: string;
  year: number;
  month: number;
  salesVolumeUnits: number;
  unitOfMeasure: string;
  revenueLakh: number;
  profitMarginPct: number;
  topCustomerSegment: string;
}

export interface ServerUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: 'ADMIN' | 'OWNER';
  companyId: string | null;
  jobTitle: string;
  avatar: string;
}

export interface ServerConversation {
  id: string;
  title: string;
  userId: string;
  companyId: string | null;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    senderRole: 'user' | 'assistant' | 'system';
    content: string;
    thinkingSteps?: any[];
    artifacts?: any[];
    createdAt: string;
  }>;
}

export interface ServerAuditLog {
  id: string;
  userId: string;
  companyId: string | null;
  action: string;
  endpoint: string;
  details: string;
  timestamp: string;
}

export const SERVER_COMPANIES: ServerCompany[] = [
  {
    id: 'comp_textile_a',
    name: 'Textile A (Apex Spinners)',
    code: 'TEX-A',
    specialization: 'High-Volume Cotton Yarn & Blended Ring Spun',
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    foundedYear: 1998,
    annualCapacity: '24,000 Metric Tons Combed Cotton / Year',
    revenueBase: 310.0,
    marginBase: 15.5,
    growthFactor: 1.02,
    volumeBase: 420000,
    volumeUnit: 'kg'
  },
  {
    id: 'comp_textile_b',
    name: 'Textile B (Boutique Silks & Jacquard)',
    code: 'TEX-B',
    specialization: 'Luxury Mulberry Silk & High-End Jacquard Weaves',
    city: 'Surat',
    state: 'Gujarat',
    foundedYear: 2005,
    annualCapacity: '3.5 Million Meters Luxury Jacquard Fabric / Year',
    revenueBase: 215.0,
    marginBase: 30.5,
    growthFactor: 1.03,
    volumeBase: 85000,
    volumeUnit: 'meters'
  },
  {
    id: 'comp_textile_c',
    name: 'Textile C (Crest Organic Cottons)',
    code: 'TEX-C',
    specialization: 'GOTS-Certified Organic Knits & Sustainable Textiles',
    city: 'Tirupur',
    state: 'Tamil Nadu',
    foundedYear: 2012,
    annualCapacity: '18 Million Knitted Garment Pieces / Year',
    revenueBase: 180.0,
    marginBase: 21.0,
    growthFactor: 1.06,
    volumeBase: 250000,
    volumeUnit: 'pieces'
  },
  {
    id: 'comp_textile_d',
    name: 'Textile D (Delta Synthetic Mills)',
    code: 'TEX-D',
    specialization: 'Polyester Filament & Legacy Suiting Weaves',
    city: 'Bhilwara',
    state: 'Rajasthan',
    foundedYear: 1992,
    annualCapacity: '12,000 Metric Tons Polyester Blends / Year',
    revenueBase: 195.0,
    marginBase: 11.0,
    growthFactor: 0.97,
    volumeBase: 310000,
    volumeUnit: 'kg'
  },
  {
    id: 'comp_textile_e',
    name: 'Textile E (Empire Denim Fabrics)',
    code: 'TEX-E',
    specialization: 'Heavy Ring-Spun Indigo Denim & Stretch Twill',
    city: 'Ahmedabad',
    state: 'Gujarat',
    foundedYear: 2001,
    annualCapacity: '45 Million Meters Premium Denim / Year',
    revenueBase: 290.0,
    marginBase: 13.5,
    growthFactor: 1.01,
    volumeBase: 550000,
    volumeUnit: 'meters'
  },
  {
    id: 'comp_textile_f',
    name: 'Textile F (Frontier Technical Textiles)',
    code: 'TEX-F',
    specialization: 'Medical Non-Wovens, Geotextiles & Fire-Retardant Fabric',
    city: 'Pune',
    state: 'Maharashtra',
    foundedYear: 2016,
    annualCapacity: '8 Million Square Meters Engineered Technical Textiles',
    revenueBase: 165.0,
    marginBase: 27.0,
    growthFactor: 1.05,
    volumeBase: 120000,
    volumeUnit: 'sq meters'
  },
  {
    id: 'comp_textile_g',
    name: 'Textile G (Global Home Weaves)',
    code: 'TEX-G',
    specialization: 'Terry Towels, Bed Linens & Institutional Hospitality',
    city: 'Panipat',
    state: 'Haryana',
    foundedYear: 1995,
    annualCapacity: '15,000 Metric Tons Terry & Jacquard Home Furnishings',
    revenueBase: 235.0,
    marginBase: 18.0,
    growthFactor: 1.025,
    volumeBase: 280000,
    volumeUnit: 'kg'
  },
  {
    id: 'comp_textile_h',
    name: 'Textile H (Heritage Handloom Crafts)',
    code: 'TEX-H',
    specialization: 'Artisanal Ikat, Chanderi & Khadi Hand-Woven Textiles',
    city: 'Varanasi',
    state: 'Uttar Pradesh',
    foundedYear: 1988,
    annualCapacity: '650,000 Meters Traditional Artisan Silk & Brocade',
    revenueBase: 95.0,
    marginBase: 34.0,
    growthFactor: 1.04,
    volumeBase: 38000,
    volumeUnit: 'meters'
  },
  {
    id: 'comp_textile_i',
    name: 'Textile I (Imperial Woollens & Worsteds)',
    code: 'TEX-I',
    specialization: 'Fine Merino Wool Suitings, Tweeds & Winter Shawls',
    city: 'Ludhiana',
    state: 'Punjab',
    foundedYear: 1982,
    annualCapacity: '4.2 Million Meters Worsted Wool & Cashmere Blends',
    revenueBase: 220.0,
    marginBase: 22.5,
    growthFactor: 1.015,
    volumeBase: 92000,
    volumeUnit: 'meters'
  },
  {
    id: 'comp_textile_j',
    name: 'Textile J (Jute & Eco-Fiber Solutions)',
    code: 'TEX-J',
    specialization: 'Industrial Hessian, Geo-Jute & Biodegradable Packaging',
    city: 'Kolkata',
    state: 'West Bengal',
    foundedYear: 1978,
    annualCapacity: '35,000 Metric Tons Diversified Jute Products / Year',
    revenueBase: 140.0,
    marginBase: 12.0,
    growthFactor: 1.035,
    volumeBase: 480000,
    volumeUnit: 'kg'
  }
];

export const SERVER_USERS: ServerUser[] = [
  {
    id: 'usr_admin_01',
    email: 'admin@demo.local',
    name: 'Alexander Sterling',
    passwordHash: 'admin123',
    role: 'ADMIN',
    companyId: null,
    jobTitle: 'Central Portfolio & Operations Director',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_owner_a',
    email: 'owner.a@demo.local',
    name: 'Rajesh V. Singhania',
    passwordHash: 'owner123',
    role: 'OWNER',
    companyId: 'comp_textile_a',
    jobTitle: 'Managing Director & Principal Owner',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_owner_b',
    email: 'owner.b@demo.local',
    name: 'Pooja B. Mehta',
    passwordHash: 'owner123',
    role: 'OWNER',
    companyId: 'comp_textile_b',
    jobTitle: 'Chief Executive Officer',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_owner_c',
    email: 'owner.c@demo.local',
    name: 'Karthik Subramanian',
    passwordHash: 'owner123',
    role: 'OWNER',
    companyId: 'comp_textile_c',
    jobTitle: 'Founder & Managing Director',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_owner_d',
    email: 'owner.d@demo.local',
    name: 'Mahesh C. Rathi',
    passwordHash: 'owner123',
    role: 'OWNER',
    companyId: 'comp_textile_d',
    jobTitle: 'Chairman & Managing Director',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_owner_e',
    email: 'owner.e@demo.local',
    name: 'Ananya S. Patel',
    passwordHash: 'owner123',
    role: 'OWNER',
    companyId: 'comp_textile_e',
    jobTitle: 'Executive Director & COO',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_owner_f',
    email: 'owner.f@demo.local',
    name: 'Dr. Sameer Kulkarni',
    passwordHash: 'owner123',
    role: 'OWNER',
    companyId: 'comp_textile_f',
    jobTitle: 'Chief Technology Officer & Director',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_owner_g',
    email: 'owner.g@demo.local',
    name: 'Gurpreet Singh Ahuja',
    passwordHash: 'owner123',
    role: 'OWNER',
    companyId: 'comp_textile_g',
    jobTitle: 'Managing Partner',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_owner_h',
    email: 'owner.h@demo.local',
    name: 'Devi Prasad Mishra',
    passwordHash: 'owner123',
    role: 'OWNER',
    companyId: 'comp_textile_h',
    jobTitle: 'Master Weaver & Proprietor',
    avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_owner_i',
    email: 'owner.i@demo.local',
    name: 'Simran K. Oberoi',
    passwordHash: 'owner123',
    role: 'OWNER',
    companyId: 'comp_textile_i',
    jobTitle: 'President & CEO',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_owner_j',
    email: 'owner.j@demo.local',
    name: 'Subhash Chandra Bose Roy',
    passwordHash: 'owner123',
    role: 'OWNER',
    companyId: 'comp_textile_j',
    jobTitle: 'Managing Director',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80'
  }
];

const MONTHS_SEQUENCE = [
  { year: 2025, month: 1, name: 'Jan 2025', date: '2025-01-31', factor: 0.94 },
  { year: 2025, month: 2, name: 'Feb 2025', date: '2025-02-28', factor: 0.96 },
  { year: 2025, month: 3, name: 'Mar 2025', date: '2025-03-31', factor: 1.05 },
  { year: 2025, month: 4, name: 'Apr 2025', date: '2025-04-30', factor: 0.98 },
  { year: 2025, month: 5, name: 'May 2025', date: '2025-05-31', factor: 1.01 },
  { year: 2025, month: 6, name: 'Jun 2025', date: '2025-06-30', factor: 1.03 },
  { year: 2025, month: 7, name: 'Jul 2025', date: '2025-07-31', factor: 0.97 },
  { year: 2025, month: 8, name: 'Aug 2025', date: '2025-08-31', factor: 1.02 },
  { year: 2025, month: 9, name: 'Sep 2025', date: '2025-09-30', factor: 1.06 },
  { year: 2025, month: 10, name: 'Oct 2025', date: '2025-10-31', factor: 1.15 }, // Diwali festive peak
  { year: 2025, month: 11, name: 'Nov 2025', date: '2025-11-30', factor: 1.12 },
  { year: 2025, month: 12, name: 'Dec 2025', date: '2025-12-31', factor: 1.08 }
];

function generateServerFinancials(): ServerMonthlyFinancial[] {
  const records: ServerMonthlyFinancial[] = [];

  for (const company of SERVER_COMPANIES) {
    let currentRev = company.revenueBase;
    let currentVol = company.volumeBase;

    MONTHS_SEQUENCE.forEach((m, idx) => {
      const growthMultiplier = Math.pow(company.growthFactor, idx / 2);
      const monthlyRevenue = +(currentRev * m.factor * growthMultiplier).toFixed(2);
      const marginVariance = (Math.sin(idx) * 1.5).toFixed(2);
      const currentMargin = +(company.marginBase + parseFloat(marginVariance)).toFixed(2);

      const grossProfit = +((monthlyRevenue * currentMargin) / 100).toFixed(2);
      const cogs = +(monthlyRevenue - grossProfit).toFixed(2);
      const opex = +(grossProfit * 0.45).toFixed(2);
      const netProfit = +(grossProfit - opex).toFixed(2);
      const unitsSold = Math.round(currentVol * m.factor * growthMultiplier);
      const unitsProduced = Math.round(unitsSold * 1.03);
      const ordersCount = Math.round(unitsSold / 1200) + 15;
      const asp = unitsSold > 0 ? +((monthlyRevenue * 100000) / unitsSold).toFixed(2) : 0;
      const capacityUtil = Math.min(98.5, Math.max(68.0, +(75 + Math.sin(idx * 0.8) * 14).toFixed(1)));

      records.push({
        id: `fin_${company.code.toLowerCase()}_${m.year}_${String(m.month).padStart(2, '0')}`,
        companyId: company.id,
        year: m.year,
        month: m.month,
        monthName: m.name,
        periodDate: m.date,
        revenueLakh: monthlyRevenue,
        costOfGoodsSoldLakh: cogs,
        grossProfitLakh: grossProfit,
        profitMarginPct: currentMargin,
        operatingExpensesLakh: opex,
        netProfitLakh: netProfit,
        unitsProduced: unitsProduced,
        unitsSold: unitsSold,
        ordersCount: ordersCount,
        averageSellingPrice: asp,
        capacityUtilizationPct: capacityUtil,
        unitOfMeasure: company.volumeUnit
      });
    });
  }

  return records;
}

const PRODUCT_CATEGORIES_MAP: Record<string, string[]> = {
  comp_textile_a: ['30s Combed Cotton Yarn', '40s Compact Ring-Spun', 'Carded Hosiery Yarn', 'Polyester-Cotton Blends (65/35)'],
  comp_textile_b: ['Mulberry Silk Sarees (Zari)', 'Jacquard Brocade Fabric', 'Pure Chiffon & Georgette', 'Bridal Silk Lengths'],
  comp_textile_c: ['100% GOTS Organic Cotton Knits', 'Recycled Poly-Cotton Jersey', 'Bamboo-Cotton Ribbed Knit', 'Fair-Trade Dyed Fabrics'],
  comp_textile_d: ['Polyester-Viscose Suiting', 'Texturized Poly Weft Filament', 'Industrial Filter Fabrics', 'Uniform Poly-Twill'],
  comp_textile_e: ['14oz Heavy Indigo Denim', '11oz Comfort Stretch Denim', 'Cross-Hatch Slub Denim', 'Recycled Eco-Wash Denim'],
  comp_textile_f: ['Hydrophobic Non-Woven Surgical', 'Geotextile Road Stabilization', 'FR Nomex Flame Retardant Twill', 'Conductive Anti-Static Shield'],
  comp_textile_g: ['600 GSM Egyptian Cotton Towels', 'Percale 300-TC Bed Sheets', 'Waffle Weave Hotel Robes', 'Microfiber Institutional Linens'],
  comp_textile_h: ['Varanasi Pure Katan Silk', 'Traditional Chanderi Tissue', 'Hand-Spun Khadi Muslin', 'Hand-Block Printed Dupattas'],
  comp_textile_i: ['Super 120s Merino Wool Suiting', 'Classic Houndstooth Tweed', 'Pure Cashmere Shawl Lengths', 'Flannel Wool Overcoating'],
  comp_textile_j: ['Heavy Burlap Hessian Cloth', 'High-Tensile Geo-Jute Mesh', 'Bleached Eco Jute Shopping Twill', 'Biodegradable Agro-Mulch Net']
};

function generateServerProducts(): ServerProductMetric[] {
  const products: ServerProductMetric[] = [];
  const shares = [0.42, 0.28, 0.18, 0.12];

  for (const company of SERVER_COMPANIES) {
    const cats = PRODUCT_CATEGORIES_MAP[company.id] || ['Category A', 'Category B', 'Category C', 'Category D'];
    cats.forEach((cat, idx) => {
      const share = shares[idx] || 0.1;
      const catRevenue = +(company.revenueBase * 12 * share).toFixed(2);
      const catVolume = Math.round(company.volumeBase * 12 * share);
      const marginDelta = (idx === 0 ? 2.5 : idx === 1 ? 0.5 : idx === 2 ? -1.5 : -3.0);
      const catMargin = +(company.marginBase + marginDelta).toFixed(2);

      products.push({
        id: `prod_${company.code.toLowerCase()}_${idx + 1}`,
        companyId: company.id,
        categoryName: cat,
        year: 2025,
        month: 12,
        salesVolumeUnits: catVolume,
        unitOfMeasure: company.volumeUnit,
        revenueLakh: catRevenue,
        profitMarginPct: catMargin,
        topCustomerSegment: idx % 2 === 0 ? 'Tier-1 Exporters & Retail Brands' : 'Domestic Institutional Wholesale'
      });
    });
  }

  return products;
}

// In-memory Server-Side State
export const SERVER_FINANCIALS = generateServerFinancials();
export const SERVER_PRODUCTS = generateServerProducts();
export const SERVER_CONVERSATIONS: Map<string, ServerConversation> = new Map();
export const SERVER_AUDIT_LOGS: ServerAuditLog[] = [];
