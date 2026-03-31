import { Global, Module } from '@nestjs/common';
import { WssInternalService } from './wss-internal.service';

@Global()
@Module({
  providers: [WssInternalService],
  exports: [WssInternalService],
})
export class WssInternalModule {}
