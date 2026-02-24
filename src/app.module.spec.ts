import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ChatsModule } from './chats/chats.module';
import { ClientsModule } from './clients/clients.module';
import { DealsModule } from './deals/deals.module';
import { MessagesModule } from './messages/messages.module';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import { TelegramModule } from './telegram/telegram.module';
import { UsersModule } from './users/users.module';

describe('AppModule', () => {
  let moduleRef: TestingModule;

  const expectedImportedModules = [
    PrismaModule,
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
    })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: () => Promise.resolve(),
        onModuleDestroy: () => Promise.resolve(),
        $connect: () => Promise.resolve(),
        $disconnect: () => Promise.resolve(),
      })
      .compile();
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
