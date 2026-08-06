import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { PrincipalKinds, Roles } from '../../common/auth';
import type { AuthenticatedRequest } from '../../common/auth';
import { CreateIncidentDto, IncidentQueryDto, NoteDto } from './incidents.dto';
import { IncidentsService } from './incidents.service';

@ApiTags('Citizen Incidents')
@ApiBearerAuth()
@PrincipalKinds('citizen')
@Controller('incidents')
export class CitizenIncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateIncidentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.incidents.create(req.user.sub, dto, idempotencyKey);
  }

  @Get('me')
  mine(@Req() req: AuthenticatedRequest, @Query() query: IncidentQueryDto) {
    return this.incidents.mine(req.user.sub, query);
  }

  @Get('me/:id')
  detailByOwnedRoute(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.incidents.detailForCitizen(id, req.user.sub);
  }

  @Get('code/:caseCode')
  code(@Req() req: AuthenticatedRequest, @Param('caseCode') caseCode: string) {
    return this.incidents.detailForCitizen(caseCode, req.user.sub, true);
  }

  @Get(':id')
  detail(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.incidents.detailForCitizen(id, req.user.sub);
  }

  @Post(':id/images')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['files'],
    },
  })
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      limits: { fileSize: 10 * 1024 * 1024, files: 5 },
    }),
  )
  images(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.incidents.addImages(id, req.user.sub, files);
  }
}

@ApiTags('Admin Incidents')
@ApiBearerAuth()
@Roles(
  AdminRole.SUPER_ADMIN,
  AdminRole.SUPERVISOR,
  AdminRole.OFFICER,
  AdminRole.VIEWER,
)
@Controller('admin/incidents')
export class AdminIncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest, @Query() query: IncidentQueryDto) {
    return this.incidents.listAdmin(query, req.user);
  }

  @Get('map-points')
  mapPoints(@Req() req: AuthenticatedRequest) {
    return this.incidents.listMapPoints(req.user);
  }

  @Get(':id')
  detail(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.incidents.adminDetail(id, req.user);
  }

  @Patch(':id/accept')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.SUPERVISOR, AdminRole.OFFICER)
  accept(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.incidents.accept(id, req.user);
  }

  @Patch(':id/complete')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.SUPERVISOR, AdminRole.OFFICER)
  complete(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.incidents.complete(id, req.user);
  }

  @Post(':id/notes')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.SUPERVISOR, AdminRole.OFFICER)
  note(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: NoteDto,
  ) {
    return this.incidents.note(id, req.user, dto);
  }
}
