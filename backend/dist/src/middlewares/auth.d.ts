import { Request, Response, NextFunction } from 'express';
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
export declare function generateAdminToken(admin: {
    id: string;
    email: string;
    name: string;
    role: string;
    outletId?: string | null;
}): string;
/**
 * Generate a JWT token for customer
 */
export declare function generateCustomerToken(customer: {
    id: string;
    email: string;
}): string;
/**
 * Middleware: Require admin authentication
 */
export declare function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Middleware: Require MASTER admin role
 */
export declare function requireMaster(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Middleware: Optional customer authentication (populates req.customer if token present)
 */
export declare function optionalCustomerAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=auth.d.ts.map