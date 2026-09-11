import { ArrayMinSize, IsArray, IsBoolean, IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @Length(2, 120) name!: string;
  @IsString() @Length(12, 200) password!: string;
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) roleNames!: string[];
}

export class UpdateUserDto {
  @IsOptional() @IsString() @Length(2, 120) name?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() @ArrayMinSize(1) @IsString({ each: true }) roleNames?: string[];
}
