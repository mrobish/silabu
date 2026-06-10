export type AuditEvent = 
  | 'login_success'
  | 'login_failed'
  | 'register'
  | 'verify_email'
  | 'password_reset_request'
  | 'password_reset_complete'
  | 'logout'
  | 'refresh'
  | 'google_link';

export interface AuditLogEntry {
  userId?: string;
  email?: string;
  event: AuditEvent;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export function extractClientInfo(req: any): { ipAddress: string; userAgent: string } {
  const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                    req.headers['x-real-ip'] || 
                    req.socket?.remoteAddress || 
                    'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  return { ipAddress, userAgent };
}
