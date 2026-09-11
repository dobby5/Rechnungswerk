import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1770000000000 implements MigrationInterface {
  name = 'InitialSchema1770000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);
    await queryRunner.query(`CREATE TYPE "invoice_status" AS ENUM ('DRAFT','FINALIZED','SENT','PAID','CANCELLED')`);

    await queryRunner.query(`CREATE TABLE "users" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "email" varchar(254) NOT NULL UNIQUE,
      "password_hash" varchar NOT NULL, "name" varchar(120) NOT NULL, "is_active" boolean NOT NULL DEFAULT true,
      "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE TABLE "roles" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "name" varchar(80) NOT NULL UNIQUE, "description" varchar(240)
    )`);
    await queryRunner.query(`CREATE TABLE "permissions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "key" varchar(100) NOT NULL UNIQUE, "description" varchar(240)
    )`);
    await queryRunner.query(`CREATE TABLE "user_roles" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE, UNIQUE("user_id","role_id")
    )`);
    await queryRunner.query(`CREATE TABLE "role_permissions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
      "permission_id" uuid NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE, UNIQUE("role_id","permission_id")
    )`);
    await queryRunner.query(`CREATE TABLE "customers" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "customer_number" varchar(80), "name" varchar(180) NOT NULL, "company" varchar(180), "street" varchar(180) NOT NULL,
      "postal_code" varchar(30) NOT NULL, "city" varchar(120) NOT NULL, "country" varchar(2) NOT NULL DEFAULT 'DE',
      "email" varchar(254), "phone" varchar(60), "archived_at" timestamptz,
      "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE INDEX "idx_customers_owner" ON "customers"("owner_id")`);
    await queryRunner.query(`CREATE INDEX "idx_customers_name" ON "customers"("name")`);
    await queryRunner.query(`CREATE INDEX "idx_customers_archived" ON "customers"("archived_at")`);

    await queryRunner.query(`CREATE TABLE "company_settings" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
      "company_name" varchar(180) NOT NULL, "street" varchar(180) NOT NULL, "postal_code" varchar(30) NOT NULL,
      "city" varchar(120) NOT NULL, "country" varchar(2) NOT NULL DEFAULT 'DE', "email" varchar(254), "phone" varchar(60),
      "tax_id" varchar(80), "vat_id" varchar(80), "bank_name" varchar(180), "iban" varchar(42), "bic" varchar(16),
      "logo_data_url" text, "invoice_prefix" varchar(20) NOT NULL DEFAULT 'RE', "default_currency" varchar(3) NOT NULL DEFAULT 'EUR',
      "payment_terms_days" integer NOT NULL DEFAULT 14, "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE TABLE "invoice_sequences" (
      "year" integer PRIMARY KEY, "current_value" integer NOT NULL DEFAULT 0
    )`);
    await queryRunner.query(`CREATE TABLE "invoices" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
      "customer_id" uuid REFERENCES "customers"("id") ON DELETE SET NULL, "invoice_number" varchar(60) NOT NULL UNIQUE,
      "invoice_date" date NOT NULL, "service_start" date NOT NULL, "service_end" date, "due_date" date NOT NULL,
      "status" invoice_status NOT NULL DEFAULT 'DRAFT', "currency" varchar(3) NOT NULL DEFAULT 'EUR', "reference" varchar(120),
      "introduction_text" text, "closing_text" text, "internal_notes" text, "company_snapshot" jsonb NOT NULL,
      "customer_snapshot" jsonb NOT NULL, "net_minor" bigint NOT NULL, "tax_minor" bigint NOT NULL, "gross_minor" bigint NOT NULL,
      "current_version" integer NOT NULL DEFAULT 1 CHECK ("current_version" > 0), "search_text" text NOT NULL,
      "finalized_at" timestamptz, "deleted_at" timestamptz, "deleted_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "purge_after" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE INDEX "idx_invoices_owner" ON "invoices"("owner_id")`);
    await queryRunner.query(`CREATE INDEX "idx_invoices_status" ON "invoices"("status")`);
    await queryRunner.query(`CREATE INDEX "idx_invoices_due" ON "invoices"("due_date")`);
    await queryRunner.query(`CREATE INDEX "idx_invoices_deleted" ON "invoices"("deleted_at")`);
    await queryRunner.query(`CREATE INDEX "idx_invoices_purge" ON "invoices"("purge_after")`);
    await queryRunner.query(`CREATE INDEX "idx_invoices_search_trgm" ON "invoices" USING gin ("search_text" gin_trgm_ops)`);

    await queryRunner.query(`CREATE TABLE "invoice_items" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
      "position" integer NOT NULL, "description" text NOT NULL, "quantity" numeric(14,4) NOT NULL CHECK ("quantity" > 0),
      "unit" varchar(30) NOT NULL, "unit_price_minor" bigint NOT NULL, "discount_basis_points" integer NOT NULL DEFAULT 0,
      "tax_rate_basis_points" integer NOT NULL, "net_minor" bigint NOT NULL, "tax_minor" bigint NOT NULL, "gross_minor" bigint NOT NULL,
      CHECK ("discount_basis_points" BETWEEN 0 AND 10000), CHECK ("tax_rate_basis_points" BETWEEN 0 AND 10000),
      UNIQUE("invoice_id","position")
    )`);
    await queryRunner.query(`CREATE INDEX "idx_invoice_items_invoice" ON "invoice_items"("invoice_id")`);
    await queryRunner.query(`CREATE TABLE "invoice_versions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
      "version_number" integer NOT NULL, "changed_by_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
      "change_reason" text, "snapshot" jsonb NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(),
      UNIQUE("invoice_id","version_number")
    )`);
    await queryRunner.query(`CREATE INDEX "idx_invoice_versions_invoice" ON "invoice_versions"("invoice_id")`);
    await queryRunner.query(`CREATE TABLE "invoice_status_history" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
      "from_status" invoice_status, "to_status" invoice_status NOT NULL,
      "changed_by_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT, "reason" text,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE INDEX "idx_status_history_invoice" ON "invoice_status_history"("invoice_id")`);
    await queryRunner.query(`CREATE TABLE "document_templates" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "owner_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
      "name" varchar(120) NOT NULL, "is_default" boolean NOT NULL DEFAULT false, "config" jsonb NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE TABLE "audit_logs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "action" varchar(100) NOT NULL, "entity_type" varchar(80) NOT NULL, "entity_id" varchar(80),
      "metadata" jsonb NOT NULL DEFAULT '{}', "request_id" varchar(80), "ip_hash" varchar(64),
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE INDEX "idx_audit_user" ON "audit_logs"("user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_audit_action" ON "audit_logs"("action")`);
    await queryRunner.query(`CREATE INDEX "idx_audit_entity" ON "audit_logs"("entity_type","entity_id")`);
    await queryRunner.query(`CREATE TABLE "refresh_tokens" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "token_hash" varchar(64) NOT NULL, "expires_at" timestamptz NOT NULL, "revoked_at" timestamptz,
      "replaced_by_id" uuid, "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE INDEX "idx_refresh_user" ON "refresh_tokens"("user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_refresh_expiry" ON "refresh_tokens"("expires_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "document_templates" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice_status_history" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice_versions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice_items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoices" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice_sequences" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "company_settings" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customers" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_roles" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permissions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "invoice_status"`);
  }
}
