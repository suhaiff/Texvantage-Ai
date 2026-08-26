import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { SERVER_USERS, ServerUser } from './database';

const JWT_SECRET = process.env.JWT_SECRET || 'texvantage-super-secret-key-production-2025';
const JWT_EXPIRES_IN = '24h';

export interface AuthenticatedUserPayload {
  sub: string;
  email: string;
  role: 'ADMIN' | 'OWNER';
  company_id: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUserPayload;
  fullUser?: ServerUser;
}

export function createAccessToken(user: ServerUser): string {
  const payload: AuthenticatedUserPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    company_id: user.companyId
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): AuthenticatedUserPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthenticatedUserPayload;
  } catch (err) {
    return null;
  }
}

// Middleware: Authenticate Bearer Token
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ detail: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ detail: 'Invalid or expired token' });
  }

  const user = SERVER_USERS.find(u => u.id === decoded.sub);
  if (!user) {
    return res.status(401).json({ detail: 'Authenticated user no longer exists' });
  }

  req.user = decoded;
  req.fullUser = user;
  next();
}

// Middleware: Require Central Admin
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ detail: 'Access forbidden: Global Administrator privileges required' });
  }
  next();
}

// Tenant Guard: Check Company Access
export function checkCompanyAccess(user: AuthenticatedUserPayload, targetCompanyId: string): boolean {
  if (user.role === 'ADMIN') return true;
  return user.company_id === targetCompanyId;
}
