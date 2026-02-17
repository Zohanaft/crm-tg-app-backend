import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { ChatsModule } from './chats/chats.module';
import { MessagesModule } from './messages/messages.module';
import { DealsModule } from './deals/deals.module';
import { TelegramModule } from './telegram/telegram.module';

describe('AppModule', () => {
  let moduleRef: TestingModule;

  const expectedImportedModules = [
    AuthModule,
    UsersModule,
    ClientsModule,
    ChatsModule,
    MessagesModule,
    DealsModule,
    TelegramModule,
  ] as const;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  });

  it('должен успешно скомпилироваться с подключёнными модулями', () => {
    expect(moduleRef).toBeDefined();
  });

  it('должен экспортировать AppController и AppService', () => {
    expect(moduleRef.get(AppController)).toBeDefined();
    expect(moduleRef.get(AppService)).toBeDefined();
  });

  it('должен включать все фичевые модули в imports', () => {
    const imports = Reflect.getMetadata('imports', AppModule) as unknown[];
    expect(imports).toBeDefined();
    expect(imports).toEqual(expect.arrayContaining([...expectedImportedModules]));
    expect(imports).toHaveLength(expectedImportedModules.length);
  });

  expectedImportedModules.forEach((ModuleClass) => {
    it(`должен включать ${ModuleClass.name}`, () => {
      const imports = Reflect.getMetadata('imports', AppModule) as unknown[];
      expect(imports).toContain(ModuleClass);
    });
  });
});
