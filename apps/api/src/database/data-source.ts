import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ENTITIES } from './entities/entities';
import { InitialSchema1770000000000 } from './migrations/1770000000000-InitialSchema';

export function createDataSource(): DataSource {
  return new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: ENTITIES,
    migrations: [InitialSchema1770000000000],
    synchronize: false,
    logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const appDataSource = createDataSource();
