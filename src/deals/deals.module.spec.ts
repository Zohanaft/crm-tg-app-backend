import { Test, TestingModule } from '@nestjs/testing';
import { DealsModule } from './deals.module';

describe('DealsModule', () => {
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [DealsModule],
    }).compile();
  });

  it('должен успешно скомпилироваться', () => {
    expect(moduleRef).toBeDefined();
  });
});
