import { Test, TestingModule } from '@nestjs/testing';
import { TelegramModule } from './telegram.module';

describe('TelegramModule', () => {
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [TelegramModule],
    }).compile();
  });

  it('должен успешно скомпилироваться', () => {
    expect(moduleRef).toBeDefined();
  });
});
