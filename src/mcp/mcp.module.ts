import { Module } from '@nestjs/common';

import { Neo4jModule } from '../neo4j/neo4j.module';
import { SpaceModule } from '../space/space.module';
import { McpController } from './mcp.controller';
import { McpServerFactory } from './mcp-server.factory';
import { SpaceToolsRegistrar } from './tools/space-tools.registrar';

@Module({
  imports: [Neo4jModule, SpaceModule],
  controllers: [McpController],
  providers: [McpServerFactory, SpaceToolsRegistrar],
})
export class McpModule {}
