import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production-to-a-random-string';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      admin?: {
        id: string;
        email: string;
        name: string;
        role: 'MASTER' | 'OUTLET';
        outletId?: string | null;
      };
      customer?: {
        id: string;
        email: string;
        name: string;
        phone: string;
      };
    }
  }
}

/**
 * Generate a JWT token for admin
 */
export function generateAdminToken(admin: { id: string; email: string; name: string; role: string; outletId?: string | null }) {
  return jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role, type: 'admin' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );
}

/**
 * Generate a JWT token for customer
 */
export function generateCustomerToken(customer: { id: string; email: string }) {
  return jwt.sign(
    { id: customer.id, email: customer.email, type: 'customer' },
    JWT_SECRET,
    { expiresIn: '7d' } as jwt.SignOptions
  );
}

/**
 * Middleware: Require admin authentication
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string; type: string };

    if (decoded.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const admin = await prisma.admin.findUnique({
      where: { id: decoded.id },
    });

    if (!admin || !admin.isActive) {
      return res.status(401).json({ error: 'Invalid or inactive admin account' });
    }

    req.admin = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role as 'MASTER' | 'OUTLET',
      outletId: admin.outletId,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired, please login again' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Middleware: Require MASTER admin role
 */
export async function requireMaster(req: Request, res: Response, next: NextFunction) {
  if (!req.admin) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.admin.role !== 'MASTER') {
    return res.status(403).json({ error: 'Master admin access required' });
  }
  next();
}

/**
 * Middleware: Optional customer authentication (populates req.customer if token present)
 */
export async function optionalCustomerAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; type: string };

    if (decoded.type !== 'customer') {
      return next();
    }

    const customer = await prisma.customer.findUnique({
      where: { id: decoded.id },
    });

    if (customer) {
      req.customer = {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
      };
    }
  } catch {
    // Token invalid/expired — just continue without auth
  }
  next();
}
