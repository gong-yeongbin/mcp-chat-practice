import { Module } from '@nestjs/common';

import { Neo4jService } from './neo4j.service';
import { SchemaService } from './schema.service';

@Module({
  providers: [Neo4jService, SchemaService],
  exports: [Neo4jService, SchemaService],
})
export class Neo4jModule {}
