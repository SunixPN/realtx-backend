import {
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseIntPipe,
    Post,
    Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ViewedService } from './viewed.service.js';
import { GetViewedDto } from './dto/get-viewed.dto.js';

@Controller('viewed')
export class ViewedController {
    constructor(private readonly viewedService: ViewedService) {}

    @Get()
    getViewed(@CurrentUser() user: { id: string }, @Query() dto: GetViewedDto) {
        return this.viewedService.getViewed(user.id, dto);
    }

    @Get('ids')
    getViewedIds(@CurrentUser() user: { id: string }) {
        return this.viewedService.getViewedIds(user.id);
    }

    // Явная запись факта просмотра. Клиент дёргает на маунте деталки, а не
    // сервер при GET /estate/:id — иначе Next.js RSC-префетч со страницы
    // /viewed сдвигал бы viewedAt и порядок истории «прыгал» на рефреше.
    @Post(':estateId')
    @HttpCode(HttpStatus.NO_CONTENT)
    logView(
        @CurrentUser() user: { id: string },
        @Param('estateId', ParseIntPipe) estateId: number,
    ) {
        return this.viewedService.logView(user.id, estateId);
    }

    // DELETE / — очистка всей истории. Держим ДО ':estateId', чтобы роутер
    // не подставил '' как параметр.
    @Delete()
    @HttpCode(HttpStatus.NO_CONTENT)
    clearAll(@CurrentUser() user: { id: string }) {
        return this.viewedService.clearAll(user.id);
    }

    @Delete(':estateId')
    @HttpCode(HttpStatus.NO_CONTENT)
    removeViewed(
        @CurrentUser() user: { id: string },
        @Param('estateId', ParseIntPipe) estateId: number,
    ) {
        return this.viewedService.removeViewed(user.id, estateId);
    }
}
