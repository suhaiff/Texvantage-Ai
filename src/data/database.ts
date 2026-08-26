// Presentation metadata stubs for the persona switcher UI
// Contains NO business financials, NO ledger records, NO product data, NO margins
// All authoritative data is retrieved from FastAPI / backend endpoints via Bearer token

import { User, Company } from '../types';

export interface DemoPersona {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'OWNER';
  companyId: string | null;
  companyName: string;
  companyCode: string;
  jobTitle: string;
  avatar: string;
}

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    id: 'usr_admin_01',
    email: 'admin@demo.local',
    name: 'Alexander Sterling',
    role: 'ADMIN',
    companyId: null,
    companyName: 'Global Portfolio',
    companyCode: 'GLOBAL',
    jobTitle: 'Central Portfolio & Operations Director',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_owner_a',
    email: 'owner.a@demo.local',
    name: 'Rajesh V. Singhania',
    role: 'OWNER',
    companyId: 'comp_textile_a',
    companyName: 'Textile A (Apex Spinners)',
    companyCode: 'TEX-A',
    jobTitle: 'Managing Director & Principal Owner',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_owner_b',
    email: 'owner.b@demo.local',
    name: 'Pooja B. Mehta',
    role: 'OWNER',
    companyId: 'comp_textile_b',
    companyName: 'Textile B (Boutique Silks & Jacquard)',
    companyCode: 'TEX-B',
    jobTitle: 'Chief Executive Officer',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_owner_c',
    email: 'owner.c@demo.local',
    name: 'Karthik Subramanian',
    role: 'OWNER',
    companyId: 'comp_textile_c',
    companyName: 'Textile C (Crest Organic Cottons)',
    companyCode: 'TEX-C',
    jobTitle: 'Founder & Managing Director',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_owner_d',
    email: 'owner.d@demo.local',
    name: 'Mahesh C. Rathi',
    role: 'OWNER',
    companyId: 'comp_textile_d',
    companyName: 'Textile D (Delta Synthetic Mills)',
    companyCode: 'TEX-D',
    jobTitle: 'Chairman & Managing Director',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_owner_e',
    email: 'owner.e@demo.local',
    name: 'Ananya S. Patel',
    role: 'OWNER',
    companyId: 'comp_textile_e',
    companyName: 'Textile E (Empire Denim Fabrics)',
    companyCode: 'TEX-E',
    jobTitle: 'Executive Director & COO',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_owner_f',
    email: 'owner.f@demo.local',
    name: 'Dr. Sameer Kulkarni',
    role: 'OWNER',
    companyId: 'comp_textile_f',
    companyName: 'Textile F (Frontier Technical Textiles)',
    companyCode: 'TEX-F',
    jobTitle: 'Chief Technology Officer & Director',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_owner_g',
    email: 'owner.g@demo.local',
    name: 'Gurpreet Singh Ahuja',
    role: 'OWNER',
    companyId: 'comp_textile_g',
    companyName: 'Textile G (Global Home Weaves)',
    companyCode: 'TEX-G',
    jobTitle: 'Managing Partner',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_owner_h',
    email: 'owner.h@demo.local',
    name: 'Devi Prasad Mishra',
    role: 'OWNER',
    companyId: 'comp_textile_h',
    companyName: 'Textile H (Heritage Handloom Crafts)',
    companyCode: 'TEX-H',
    jobTitle: 'Master Weaver & Proprietor',
    avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_owner_i',
    email: 'owner.i@demo.local',
    name: 'Simran K. Oberoi',
    role: 'OWNER',
    companyId: 'comp_textile_i',
    companyName: 'Textile I (Imperial Woollens & Worsteds)',
    companyCode: 'TEX-I',
    jobTitle: 'President & CEO',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_owner_j',
    email: 'owner.j@demo.local',
    name: 'Subhash Chandra Bose Roy',
    role: 'OWNER',
    companyId: 'comp_textile_j',
    companyName: 'Textile J (Jute & Eco-Fiber Solutions)',
    companyCode: 'TEX-J',
    jobTitle: 'Managing Director',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80'
  }
];
