import { Test, TestingModule } from '@nestjs/testing';
import { MessagesModule } from './messages.module';

describe('MessagesModule', () => {
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [MessagesModule],
    }).compile();
  });

  it('должен успешно скомпилироваться', () => {
    expect(moduleRef).toBeDefined();
  });
});
