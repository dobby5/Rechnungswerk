import { plainToInstance, Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min, validateSync } from 'class-validator';

class Environment {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV = 'development';

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string;

  @IsString()
  ACCESS_TOKEN_TTL = '15m';

  @IsInt()
  @Min(1)
  REFRESH_TOKEN_TTL_DAYS = 7;

  @IsInt()
  @Min(1)
  TRASH_RETENTION_DAYS = 30;

  @IsInt()
  @Min(1)
  PORT = 3000;

  @IsString()
  APP_ORIGIN = 'http://localhost:8080';

  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  COOKIE_SECURE = false;

  @IsOptional()
  @IsEmail()
  ADMIN_EMAIL?: string;

  @IsOptional()
  @IsString()
  ADMIN_PASSWORD?: string;

  @IsOptional()
  @IsString()
  ADMIN_NAME?: string;
}

export function validateEnvironment(raw: Record<string, unknown>): Environment {
  const config = plainToInstance(Environment, raw, { enableImplicitConversion: true });
  const errors = validateSync(config, { skipMissingProperties: false });
  if (errors.length) {
    throw new Error(`Invalid environment: ${errors.map((error) => Object.values(error.constraints ?? {}).join(', ')).join('; ')}`);
  }
  if (config.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
  return config;
}
