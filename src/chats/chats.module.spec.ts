import { Test, TestingModule } from '@nestjs/testing';
import { ChatsModule } from './chats.module';

describe('ChatsModule', () => {
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ChatsModule],
    }).compile();
  });

  it('должен успешно скомпилироваться', () => {
    expect(moduleRef).toBeDefined();
  });
});
