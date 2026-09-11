import 'reflect-metadata';
import * as argon2 from 'argon2';
import { appDataSource } from './data-source';
import { CompanySettings, Permission, Role, RolePermission, User, UserRole } from './entities/entities';
import { PermissionKey } from '../common/types/auth-user';

const permissionDescriptions: Record<string, string> = {
  [PermissionKey.InvoiceRead]: 'Eigene Rechnungen lesen',
  [PermissionKey.InvoiceWrite]: 'Eigene Rechnungen verwalten',
  [PermissionKey.InvoiceDelete]: 'Eigene Rechnungen in den Papierkorb verschieben',
  [PermissionKey.InvoiceExport]: 'Eigene Rechnungsdokumente exportieren',
  [PermissionKey.CustomerManage]: 'Eigene Kunden verwalten',
  [PermissionKey.UserManage]: 'Benutzer und Rollen verwalten',
  [PermissionKey.AuditRead]: 'Audit-Protokoll einsehen',
  [PermissionKey.TrashManage]: 'Papierkorb systemweit verwalten',
};

async function main(): Promise<void> {
  await appDataSource.initialize();
  await appDataSource.transaction(async (manager) => {
    const permissionRepo = manager.getRepository(Permission);
    const permissions: Permission[] = [];
    for (const [key, description] of Object.entries(permissionDescriptions)) {
      let permission = await permissionRepo.findOne({ where: { key } });
      permission ??= permissionRepo.create({ key, description });
      permissions.push(await permissionRepo.save(permission));
    }

    const roleRepo = manager.getRepository(Role);
    let adminRole = await roleRepo.findOne({ where: { name: 'Administrator' } });
    adminRole ??= await roleRepo.save(roleRepo.create({ name: 'Administrator', description: 'Vollzugriff' }));
    let userRole = await roleRepo.findOne({ where: { name: 'Benutzer' } });
    userRole ??= await roleRepo.save(roleRepo.create({ name: 'Benutzer', description: 'Eigene Rechnungen und Kunden' }));

    const normalKeys = new Set([PermissionKey.InvoiceRead, PermissionKey.InvoiceWrite, PermissionKey.InvoiceDelete, PermissionKey.InvoiceExport, PermissionKey.CustomerManage]);
    const rolePermissionRepo = manager.getRepository(RolePermission);
    for (const permission of permissions) {
      await rolePermissionRepo.upsert({ roleId: adminRole.id, permissionId: permission.id }, ['roleId', 'permissionId']);
      if (normalKeys.has(permission.key as never)) {
        await rolePermissionRepo.upsert({ roleId: userRole.id, permissionId: permission.id }, ['roleId', 'permissionId']);
      }
    }

    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set before seeding');
    }
    if (password.length < 12) throw new Error('ADMIN_PASSWORD must contain at least 12 characters');
    const userRepo = manager.getRepository(User);
    let admin = await userRepo.findOne({ where: { email } });
    if (!admin) {
      admin = await userRepo.save(userRepo.create({
        email,
        name: process.env.ADMIN_NAME ?? 'Systemadministration',
        passwordHash: await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 }),
        isActive: true,
      }));
      await manager.getRepository(UserRole).save({ userId: admin.id, roleId: adminRole.id });
      await manager.getRepository(CompanySettings).save({
        userId: admin.id, companyName: 'Meine Firma', street: 'Musterstraße 1', postalCode: '10115', city: 'Berlin', country: 'DE',
        email, invoicePrefix: 'RE', defaultCurrency: 'EUR', paymentTermsDays: 14,
      });
    }
  });
  await appDataSource.destroy();
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Seed failed');
  process.exit(1);
});
