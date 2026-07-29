import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { Roles } from '../../common/auth';
import type { AuthenticatedRequest } from '../../common/auth';
import { PrismaService } from '../core/prisma.service';
import {
  AssignmentDto,
  CreateIncidentDto,
  IncidentQueryDto,
  NoteDto,
  StatusDto,
} from './incidents.dto';
import { IncidentsService } from './incidents.service';
import { UploadService } from './upload.service';

@ApiTags('Citizen Incidents')
@ApiBearerAuth()
@Controller('incidents')
export class CitizenIncidentsController {
  constructor(
    private readonly incidents: IncidentsService,
    private readonly upload: UploadService,
    private readonly prisma: PrismaService,
  ) {}
  @Post() create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateIncidentDto,
  ) {
    return this.incidents.create(req.user.sub, dto);
  }
  @Get('me') mine(@Req() req: AuthenticatedRequest) {
    return this.incidents.mine(req.user.sub);
  }
  @Get('code/:caseCode') code(
    @Req() req: AuthenticatedRequest,
    @Param('caseCode') code: string,
  ) {
    return this.incidents.detailForCitizen(code, req.user.sub, true);
  }
  @Get(':id') detail(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.incidents.detailForCitizen(id, req.user.sub);
  }
  @Post(':id/images')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      limits: { fileSize: 10 * 1024 * 1024, files: 5 },
    }),
  )
  async images(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    await this.incidents.detailForCitizen(id, req.user.sub);
    const existing = await this.prisma.incidentImage.count({
      where: { incidentId: id },
    });
    if (!files?.length || existing + files.length > 5)
      throw new Error('ต้องมีรูปอย่างน้อย 1 รูป และรวมไม่เกิน 5 รูป');
    const results = [];
    for (const file of files) {
      const stored = await this.upload.save(file);
      results.push(
        await this.prisma.incidentImage.create({
          data: {
            incidentId: id,
            fileName: stored.storageKey.split('/').at(-1)!,
            originalName: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
            storageProvider: 'local',
            ...stored,
          },
        }),
      );
    }
    return results;
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
  @Get() list(
    @Req() req: AuthenticatedRequest,
    @Query() query: IncidentQueryDto,
  ) {
    return this.incidents.listAdmin(query, req.user);
  }
  @Get(':id') detail(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.incidents.adminDetail(id, req.user);
  }
  @Patch(':id/status')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.SUPERVISOR, AdminRole.OFFICER)
  status(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: StatusDto,
  ) {
    return this.incidents.status(id, req.user.sub, dto);
  }
  @Patch(':id/assignment')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.SUPERVISOR)
  assignment(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: AssignmentDto,
  ) {
    return this.incidents.assign(id, req.user.sub, dto);
  }
  @Post(':id/notes')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.SUPERVISOR, AdminRole.OFFICER)
  note(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: NoteDto,
  ) {
    return this.incidents.note(id, req.user.sub, dto);
  }
}
