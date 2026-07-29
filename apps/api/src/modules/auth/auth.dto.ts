import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class FacebookLoginDto {
  @IsString() @MinLength(3) accessToken!: string;
  @IsOptional() @IsString() fullName?: string;
}
export class AdminLoginDto {
  @IsString() username!: string;
  @IsString() @MinLength(8) password!: string;
  @IsOptional() @IsBoolean() rememberMe?: boolean;
}
export class RefreshDto {
  @IsString() refreshToken!: string;
}
export class ChangePasswordDto {
  @IsString() currentPassword!: string;
  @IsString() @MinLength(12) newPassword!: string;
}
