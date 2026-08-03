import { IncidentPriority, IncidentStatus, IncidentType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateIncidentDto {
  @IsString() @Length(2, 120) reporterName!: string;
  @IsPhoneNumber('TH') reporterPhone!: string;
  @IsEnum(IncidentType) type!: IncidentType;
  @IsString() @Length(10, 3000) description!: string;
  @IsLatitude() latitude!: string;
  @IsLongitude() longitude!: string;
  @IsString() @Length(3, 500) address!: string;
  @IsOptional() @IsString() subdistrict?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsEnum(IncidentPriority) priority?: IncidentPriority;
}
export class IncidentQueryDto {
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsEnum(IncidentStatus) status?: IncidentStatus;
  @IsOptional() @IsEnum(IncidentType) type?: IncidentType;
  @IsOptional() @IsEnum(IncidentPriority) priority?: IncidentPriority;
  @IsOptional() @IsUUID() assignedAdminUserId?: string;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional()
  @IsIn([
    'reportedAt',
    'createdAt',
    'updatedAt',
    'caseCode',
    'priority',
    'status',
  ])
  sortBy?:
    | 'reportedAt'
    | 'createdAt'
    | 'updatedAt'
    | 'caseCode'
    | 'priority'
    | 'status';
  @IsOptional() @IsIn(['asc', 'desc']) sortOrder?: 'asc' | 'desc';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
export class NoteDto {
  @IsString() @Length(2, 2000) note!: string;
  @IsOptional() @IsBoolean() isVisibleToCitizen?: boolean;
}
