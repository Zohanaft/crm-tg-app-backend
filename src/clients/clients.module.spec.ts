import { Test, TestingModule } from '@nestjs/testing';
import { ClientsModule } from './clients.module';

describe('ClientsModule', () => {
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ClientsModule],
    }).compile();
  });

  it('должен успешно скомпилироваться', () => {
    expect(moduleRef).toBeDefined();
  });
});
