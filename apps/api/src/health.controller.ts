import { Controller, Get } from '@nestjs/common';
import type { Health } from '@talentshowcase/types';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): Health {
    return {
      status: 'ok',
      services: {
        api: 'up',
      },
      timestamp: new Date().toISOString(),
    };
  }
}