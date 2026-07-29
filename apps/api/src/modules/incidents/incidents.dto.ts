import { IncidentPriority, IncidentStatus, IncidentType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  Length,
  MaxLength,
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
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() limit?: string;
}
export class StatusDto {
  @IsEnum(IncidentStatus) status!: IncidentStatus;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}
export class AssignmentDto {
  @IsUUID() assignedAdminUserId!: string;
}
export class NoteDto {
  @IsString() @Length(2, 2000) note!: string;
  @IsOptional() @IsBoolean() isVisibleToCitizen?: boolean;
}
