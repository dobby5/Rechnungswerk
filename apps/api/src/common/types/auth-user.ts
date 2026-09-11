export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
}

export const PermissionKey = {
  InvoiceRead: 'invoice:read',
  InvoiceWrite: 'invoice:write',
  InvoiceDelete: 'invoice:delete',
  InvoiceExport: 'invoice:export',
  CustomerManage: 'customer:manage',
  UserManage: 'user:manage',
  AuditRead: 'audit:read',
  TrashManage: 'trash:manage',
} as const;

export type PermissionValue = (typeof PermissionKey)[keyof typeof PermissionKey];
