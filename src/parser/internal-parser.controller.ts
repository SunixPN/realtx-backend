import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { ParserService } from './parser.service.js';
import { InternalTokenGuard } from './internal-token.guard.js';

@Controller('internal/parser')
@Public()
@UseGuards(InternalTokenGuard)
export class InternalParserController {
  constructor(private readonly parserService: ParserService) {}

  @Post('ingest')
  @HttpCode(HttpStatus.OK)
  ingest(@Body() body: { items: any[]; isFullDump?: boolean }) {
    return this.parserService.ingestBatch(body.items ?? [], body.isFullDump ?? false);
  }
}
