import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3000);

  await app.listen(port);
  new Logger('Bootstrap').log(`MCP Streamable HTTP endpoint: http://localhost:${port}/mcp`);
}

void bootstrap();
