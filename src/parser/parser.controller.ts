import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ParserService } from './parser.service.js';
import { Public } from '../auth/decorators/public.decorator.js';

@Controller('parser')
export class ParserController {
  constructor(private readonly parserService: ParserService) {}

  @Public()
  @Post('run')
  @HttpCode(HttpStatus.ACCEPTED)
  async run() {
    this.parserService.parseAll().catch(console.error);
    return { message: 'Парсинг запущен' };
  }

  @Public()
  @Post('validate')
  @HttpCode(HttpStatus.ACCEPTED)
  async validate() {
    this.parserService.validateActiveListings().catch(console.error);
    return { message: 'Валидация запущена' };
  }
}
