import { IsEmail, IsISO31661Alpha2, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CustomerDto {
  @IsOptional() @IsString() @MaxLength(80) customerNumber?: string;
  @IsString() @Length(1, 180) name!: string;
  @IsOptional() @IsString() @MaxLength(180) company?: string;
  @IsString() @Length(1, 180) street!: string;
  @IsString() @Length(1, 30) postalCode!: string;
  @IsString() @Length(1, 120) city!: string;
  @IsISO31661Alpha2() country!: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(60) phone?: string;
}
