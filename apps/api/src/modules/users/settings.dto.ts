import { IsEmail, IsIBAN, IsISO31661Alpha2, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';

export class CompanySettingsDto {
  @IsString() @Length(1, 180) companyName!: string;
  @IsString() @Length(1, 180) street!: string;
  @IsString() @Length(1, 30) postalCode!: string;
  @IsString() @Length(1, 120) city!: string;
  @IsISO31661Alpha2() country!: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(60) phone?: string;
  @IsOptional() @IsString() @MaxLength(80) taxId?: string;
  @IsOptional() @IsString() @MaxLength(80) vatId?: string;
  @IsOptional() @IsString() @MaxLength(180) bankName?: string;
  @IsOptional() @IsIBAN() iban?: string;
  @IsOptional() @IsString() @MaxLength(16) bic?: string;
  @IsOptional() @IsString() @MaxLength(2_800_000) @Matches(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/) logoDataUrl?: string;
  @IsString() @Matches(/^[A-Za-z0-9-]{1,20}$/) invoicePrefix!: string;
  @IsString() @Matches(/^[A-Z]{3}$/) defaultCurrency!: string;
  @IsInt() @Min(0) @Max(365) paymentTermsDays!: number;
}
