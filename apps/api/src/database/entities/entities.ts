import { InvoiceStatus } from '@rechnungswerk/shared';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export type JsonObject = Record<string, unknown>;

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index({ unique: true }) @Column({ length: 254 }) email!: string;
  @Column({ name: 'password_hash', select: false }) passwordHash!: string;
  @Column({ length: 120 }) name!: string;
  @Column({ name: 'is_active', default: true }) isActive!: boolean;
  @OneToMany(() => UserRole, (relation) => relation.user) roles!: UserRole[];
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}

@Entity({ name: 'roles' })
export class Role {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index({ unique: true }) @Column({ length: 80 }) name!: string;
  @Column({ nullable: true, length: 240 }) description!: string | null;
  @OneToMany(() => UserRole, (relation) => relation.role) users!: UserRole[];
  @OneToMany(() => RolePermission, (relation) => relation.role) permissions!: RolePermission[];
}

@Entity({ name: 'permissions' })
export class Permission {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index({ unique: true }) @Column({ length: 100 }) key!: string;
  @Column({ nullable: true, length: 240 }) description!: string | null;
  @OneToMany(() => RolePermission, (relation) => relation.permission) roles!: RolePermission[];
}

@Entity({ name: 'user_roles' })
@Unique(['userId', 'roleId'])
export class UserRole {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId!: string;
  @Column({ name: 'role_id', type: 'uuid' }) roleId!: string;
  @ManyToOne(() => User, (user) => user.roles, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'user_id' }) user!: User;
  @ManyToOne(() => Role, (role) => role.users, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'role_id' }) role!: Role;
}

@Entity({ name: 'role_permissions' })
@Unique(['roleId', 'permissionId'])
export class RolePermission {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'role_id', type: 'uuid' }) roleId!: string;
  @Column({ name: 'permission_id', type: 'uuid' }) permissionId!: string;
  @ManyToOne(() => Role, (role) => role.permissions, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'role_id' }) role!: Role;
  @ManyToOne(() => Permission, (permission) => permission.roles, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'permission_id' }) permission!: Permission;
}

@Entity({ name: 'customers' })
export class Customer {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column({ name: 'owner_id', type: 'uuid' }) ownerId!: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'owner_id' }) owner!: User;
  @Column({ name: 'customer_number', nullable: true, length: 80 }) customerNumber!: string | null;
  @Index() @Column({ length: 180 }) name!: string;
  @Column({ nullable: true, length: 180 }) company!: string | null;
  @Column({ length: 180 }) street!: string;
  @Column({ name: 'postal_code', length: 30 }) postalCode!: string;
  @Column({ length: 120 }) city!: string;
  @Column({ length: 2, default: 'DE' }) country!: string;
  @Column({ nullable: true, length: 254 }) email!: string | null;
  @Column({ nullable: true, length: 60 }) phone!: string | null;
  @Index() @Column({ name: 'archived_at', type: 'timestamptz', nullable: true }) archivedAt!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}

@Entity({ name: 'company_settings' })
export class CompanySettings {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index({ unique: true }) @Column({ name: 'user_id', type: 'uuid' }) userId!: string;
  @OneToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'user_id' }) user!: User;
  @Column({ name: 'company_name', length: 180 }) companyName!: string;
  @Column({ length: 180 }) street!: string;
  @Column({ name: 'postal_code', length: 30 }) postalCode!: string;
  @Column({ length: 120 }) city!: string;
  @Column({ length: 2, default: 'DE' }) country!: string;
  @Column({ nullable: true, length: 254 }) email!: string | null;
  @Column({ nullable: true, length: 60 }) phone!: string | null;
  @Column({ name: 'tax_id', nullable: true, length: 80 }) taxId!: string | null;
  @Column({ name: 'vat_id', nullable: true, length: 80 }) vatId!: string | null;
  @Column({ name: 'bank_name', nullable: true, length: 180 }) bankName!: string | null;
  @Column({ nullable: true, length: 42 }) iban!: string | null;
  @Column({ nullable: true, length: 16 }) bic!: string | null;
  @Column({ name: 'logo_data_url', type: 'text', nullable: true, select: false }) logoDataUrl!: string | null;
  @Column({ name: 'invoice_prefix', length: 20, default: 'RE' }) invoicePrefix!: string;
  @Column({ name: 'default_currency', length: 3, default: 'EUR' }) defaultCurrency!: string;
  @Column({ name: 'payment_terms_days', type: 'int', default: 14 }) paymentTermsDays!: number;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}

@Entity({ name: 'invoice_sequences' })
export class InvoiceSequence {
  @PrimaryColumn({ type: 'int' }) year!: number;
  @Column({ name: 'current_value', type: 'int', default: 0 }) currentValue!: number;
}

@Entity({ name: 'invoices' })
@Check(`"current_version" > 0`)
export class Invoice {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column({ name: 'owner_id', type: 'uuid' }) ownerId!: string;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'owner_id' }) owner!: User;
  @Column({ name: 'customer_id', type: 'uuid', nullable: true }) customerId!: string | null;
  @ManyToOne(() => Customer, { onDelete: 'SET NULL', nullable: true }) @JoinColumn({ name: 'customer_id' }) customer!: Customer | null;
  @Index({ unique: true }) @Column({ name: 'invoice_number', length: 60 }) invoiceNumber!: string;
  @Column({ name: 'invoice_date', type: 'date' }) invoiceDate!: string;
  @Column({ name: 'service_start', type: 'date' }) serviceStart!: string;
  @Column({ name: 'service_end', type: 'date', nullable: true }) serviceEnd!: string | null;
  @Index() @Column({ name: 'due_date', type: 'date' }) dueDate!: string;
  @Index() @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.DRAFT }) status!: InvoiceStatus;
  @Column({ length: 3, default: 'EUR' }) currency!: string;
  @Column({ nullable: true, length: 120 }) reference!: string | null;
  @Column({ name: 'introduction_text', type: 'text', nullable: true }) introductionText!: string | null;
  @Column({ name: 'closing_text', type: 'text', nullable: true }) closingText!: string | null;
  @Column({ name: 'internal_notes', type: 'text', nullable: true }) internalNotes!: string | null;
  @Column({ name: 'company_snapshot', type: 'jsonb' }) companySnapshot!: JsonObject;
  @Column({ name: 'customer_snapshot', type: 'jsonb' }) customerSnapshot!: JsonObject;
  @Column({ name: 'net_minor', type: 'bigint' }) netMinor!: string;
  @Column({ name: 'tax_minor', type: 'bigint' }) taxMinor!: string;
  @Column({ name: 'gross_minor', type: 'bigint' }) grossMinor!: string;
  @Column({ name: 'current_version', type: 'int', default: 1 }) currentVersion!: number;
  @Column({ name: 'search_text', type: 'text' }) searchText!: string;
  @Column({ name: 'finalized_at', type: 'timestamptz', nullable: true }) finalizedAt!: Date | null;
  @Index() @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true }) deletedAt!: Date | null;
  @Column({ name: 'deleted_by_id', type: 'uuid', nullable: true }) deletedById!: string | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' }) @JoinColumn({ name: 'deleted_by_id' }) deletedBy!: User | null;
  @Index() @Column({ name: 'purge_after', type: 'timestamptz', nullable: true }) purgeAfter!: Date | null;
  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: true }) items!: InvoiceItem[];
  @OneToMany(() => InvoiceVersion, (version) => version.invoice) versions!: InvoiceVersion[];
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}

@Entity({ name: 'invoice_items' })
@Check(`"quantity" > 0`)
@Check(`"discount_basis_points" BETWEEN 0 AND 10000`)
@Check(`"tax_rate_basis_points" BETWEEN 0 AND 10000`)
export class InvoiceItem {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column({ name: 'invoice_id', type: 'uuid' }) invoiceId!: string;
  @ManyToOne(() => Invoice, (invoice) => invoice.items, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'invoice_id' }) invoice!: Invoice;
  @Column({ type: 'int' }) position!: number;
  @Column({ type: 'text' }) description!: string;
  @Column({ type: 'numeric', precision: 14, scale: 4 }) quantity!: string;
  @Column({ length: 30 }) unit!: string;
  @Column({ name: 'unit_price_minor', type: 'bigint' }) unitPriceMinor!: string;
  @Column({ name: 'discount_basis_points', type: 'int', default: 0 }) discountBasisPoints!: number;
  @Column({ name: 'tax_rate_basis_points', type: 'int' }) taxRateBasisPoints!: number;
  @Column({ name: 'net_minor', type: 'bigint' }) netMinor!: string;
  @Column({ name: 'tax_minor', type: 'bigint' }) taxMinor!: string;
  @Column({ name: 'gross_minor', type: 'bigint' }) grossMinor!: string;
}

@Entity({ name: 'invoice_versions' })
@Unique(['invoiceId', 'versionNumber'])
export class InvoiceVersion {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column({ name: 'invoice_id', type: 'uuid' }) invoiceId!: string;
  @ManyToOne(() => Invoice, (invoice) => invoice.versions, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'invoice_id' }) invoice!: Invoice;
  @Column({ name: 'version_number', type: 'int' }) versionNumber!: number;
  @Column({ name: 'changed_by_id', type: 'uuid' }) changedById!: string;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'changed_by_id' }) changedBy!: User;
  @Column({ name: 'change_reason', type: 'text', nullable: true }) changeReason!: string | null;
  @Column({ type: 'jsonb' }) snapshot!: JsonObject;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}

@Entity({ name: 'invoice_status_history' })
export class InvoiceStatusHistory {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column({ name: 'invoice_id', type: 'uuid' }) invoiceId!: string;
  @ManyToOne(() => Invoice, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'invoice_id' }) invoice!: Invoice;
  @Column({ name: 'from_status', type: 'enum', enum: InvoiceStatus, nullable: true }) fromStatus!: InvoiceStatus | null;
  @Column({ name: 'to_status', type: 'enum', enum: InvoiceStatus }) toStatus!: InvoiceStatus;
  @Column({ name: 'changed_by_id', type: 'uuid' }) changedById!: string;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'changed_by_id' }) changedBy!: User;
  @Column({ type: 'text', nullable: true }) reason!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}

@Entity({ name: 'document_templates' })
export class DocumentTemplate {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'owner_id', type: 'uuid', nullable: true }) ownerId!: string | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' }) @JoinColumn({ name: 'owner_id' }) owner!: User | null;
  @Column({ length: 120 }) name!: string;
  @Column({ name: 'is_default', default: false }) isDefault!: boolean;
  @Column({ type: 'jsonb' }) config!: JsonObject;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}

@Entity({ name: 'audit_logs' })
export class AuditLog {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column({ name: 'user_id', type: 'uuid', nullable: true }) userId!: string | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' }) @JoinColumn({ name: 'user_id' }) user!: User | null;
  @Index() @Column({ length: 100 }) action!: string;
  @Index() @Column({ name: 'entity_type', length: 80 }) entityType!: string;
  @Index() @Column({ name: 'entity_id', length: 80, nullable: true }) entityId!: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata!: JsonObject;
  @Column({ name: 'request_id', length: 80, nullable: true }) requestId!: string | null;
  @Column({ name: 'ip_hash', length: 64, nullable: true }) ipHash!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}

@Entity({ name: 'refresh_tokens' })
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column({ name: 'user_id', type: 'uuid' }) userId!: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'user_id' }) user!: User;
  @Column({ name: 'token_hash', length: 64 }) tokenHash!: string;
  @Index() @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt!: Date;
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true }) revokedAt!: Date | null;
  @Column({ name: 'replaced_by_id', type: 'uuid', nullable: true }) replacedById!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}

export const ENTITIES = [
  User, Role, Permission, UserRole, RolePermission, Customer, CompanySettings, InvoiceSequence,
  Invoice, InvoiceItem, InvoiceVersion, InvoiceStatusHistory, DocumentTemplate, AuditLog, RefreshToken,
];
