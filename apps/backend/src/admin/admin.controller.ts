import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { AdminService } from './admin.service';
import type { AuthUser } from '../auth/jwt.strategy';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('requests')
  getRequests() {
    return this.admin.getRequests();
  }

  @Post('requests/:id/approve')
  approveRequest(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: AuthUser },
    @Body() body: { temporaryPassword?: string },
  ) {
    const password = body.temporaryPassword ?? this.admin.generateTemporaryPassword();
    return this.admin.approveRequest(id, req.user.id, password);
  }

  @Post('requests/:id/reject')
  rejectRequest(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: AuthUser },
    @Body() body: { reason?: string },
  ) {
    return this.admin.rejectRequest(id, req.user.id, body.reason);
  }

  @Get('users')
  getUsers() {
    return this.admin.getUsers();
  }

  @Delete('users/:id')
  revokeUser(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: AuthUser },
  ) {
    return this.admin.revokeUser(id, req.user.id);
  }

  @Post('users/:id/restore')
  restoreUser(@Param('id', ParseIntPipe) id: number) {
    return this.admin.restoreUser(id);
  }
}
