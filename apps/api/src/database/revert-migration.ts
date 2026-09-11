import { appDataSource } from './data-source';

async function main(): Promise<void> {
  await appDataSource.initialize();
  await appDataSource.undoLastMigration({ transaction: 'all' });
  await appDataSource.destroy();
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Migration revert failed');
  process.exit(1);
});
