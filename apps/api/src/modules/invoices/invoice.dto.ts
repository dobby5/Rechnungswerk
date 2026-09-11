import { InvoiceStatus } from '@rechnungswerk/shared';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID,
  Length, Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';

export class InvoiceItemDto {
  @IsString() @Length(1, 2000) description!: string;
  @IsString() @Matches(/^\d{1,10}(?:\.\d{1,4})?$/) quantity!: string;
  @IsString() @Length(1, 30) unit!: string;
  @IsString() @Matches(/^\d{1,16}$/) unitPriceMinor!: string;
  @IsInt() @Min(0) @Max(10_000) discountBasisPoints = 0;
  @IsInt() @Min(0) @Max(10_000) taxRateBasisPoints!: number;
}

export class SaveInvoiceDto {
  @IsUUID() customerId!: string;
  @IsOptional() @IsString() @MaxLength(60) invoiceNumber?: string;
  @IsDateString() invoiceDate!: string;
  @IsDateString() serviceStart!: string;
  @IsOptional() @IsDateString() serviceEnd?: string;
  @IsDateString() dueDate!: string;
  @IsString() @Matches(/^[A-Z]{3}$/) currency!: string;
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
  @IsOptional() @IsString() @MaxLength(5000) introductionText?: string;
  @IsOptional() @IsString() @MaxLength(5000) closingText?: string;
  @IsOptional() @IsString() @MaxLength(5000) internalNotes?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => InvoiceItemDto) items!: InvoiceItemDto[];
  @IsOptional() @IsInt() @Min(1) expectedVersion?: number;
  @IsOptional() @IsString() @MaxLength(1000) changeReason?: string;
}

export class ChangeStatusDto {
  @IsEnum(InvoiceStatus) status!: InvoiceStatus;
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
  @IsInt() @Min(1) expectedVersion!: number;
}

export class RestoreVersionDto {
  @IsString() @Length(3, 1000) reason!: string;
  @IsInt() @Min(1) expectedVersion!: number;
}

export class BatchExportDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsUUID(undefined, { each: true }) invoiceIds!: string[];
  @IsOptional() @IsEnum(['pdf', 'docx', 'both']) format: 'pdf' | 'docx' | 'both' = 'both';
}
