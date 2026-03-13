import { Module } from '@nestjs/common';
import { PgListenService } from './pg-listen.service';
import { PlanExpiredHandler } from './plan-expired.handler';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [PgListenService, PlanExpiredHandler],
  exports: [PgListenService],
})
export class PgListenModule {}
