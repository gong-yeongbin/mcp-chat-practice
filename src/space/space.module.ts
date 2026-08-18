import { Module } from '@nestjs/common';

import { EventService } from './event.service';
import { SpaceService } from './space.service';

@Module({
  providers: [SpaceService, EventService],
  exports: [SpaceService, EventService],
})
export class SpaceModule {}
