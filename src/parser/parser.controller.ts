import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ParserService } from './parser.service.js';

@Controller('parser')
export class ParserController {
  constructor(private readonly parserService: ParserService) {}

  @Post('run')
  @HttpCode(HttpStatus.ACCEPTED)
  async run() {
    // Запускаем в фоне — не ждём завершения, сразу отвечаем
    this.parserService.parseAll().catch(console.error);
    return { message: 'Парсинг запущен' };
  }
}
