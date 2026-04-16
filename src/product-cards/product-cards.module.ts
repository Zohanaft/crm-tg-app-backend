import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductCardsController } from './product-cards.controller';
import { ProductCardsService } from './product-cards.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProductCardsController],
  providers: [ProductCardsService],
  exports: [ProductCardsService],
})
export class ProductCardsModule {}
