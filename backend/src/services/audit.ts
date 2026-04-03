import { query } from '../config/database';

interface AuditParams {
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  changes?: Record<string, unknown>;
  ipAddress?: string | string[];
  userAgent?: string | string[];
}

export async function logAudit(params: AuditParams) {
  await query(
    `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      params.userId || null,
      params.action,
      params.entityType || null,
      params.entityId || null,
      params.changes ? JSON.stringify(params.changes) : null,
      Array.isArray(params.ipAddress) ? params.ipAddress[0] : (params.ipAddress || null),
      Array.isArray(params.userAgent) ? params.userAgent[0] : (params.userAgent || null),
    ]
  );
}
