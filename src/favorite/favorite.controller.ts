import {
    Body,
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
import { FavoriteService } from './favorite.service.js';
import { GetFavoritesDto } from './dto/get-favorites.dto.js';
import { BulkRemoveFavoritesDto } from './dto/bulk-remove.dto.js';

@Controller('favorites')
export class FavoriteController {
    constructor(private readonly favoriteService: FavoriteService) {}

    @Get()
    getFavorites(@CurrentUser() user: { id: string }, @Query() dto: GetFavoritesDto) {
        return this.favoriteService.getFavorites(user.id, dto);
    }

    @Get('ids')
    getFavoriteIds(@CurrentUser() user: { id: string }) {
        return this.favoriteService.getFavoriteIds(user.id);
    }

    // Держим ДО ':estateId', чтобы 'bulk' не перехватил параметр.
    @Delete('bulk')
    @HttpCode(HttpStatus.NO_CONTENT)
    bulkRemove(@CurrentUser() user: { id: string }, @Body() dto: BulkRemoveFavoritesDto) {
        return this.favoriteService.bulkRemove(user.id, dto.ids);
    }

    @Post(':estateId')
    @HttpCode(HttpStatus.OK)
    addFavorite(
        @CurrentUser() user: { id: string },
        @Param('estateId', ParseIntPipe) estateId: number,
    ) {
        return this.favoriteService.addFavorite(user.id, estateId);
    }

    @Delete(':estateId')
    @HttpCode(HttpStatus.NO_CONTENT)
    removeFavorite(
        @CurrentUser() user: { id: string },
        @Param('estateId', ParseIntPipe) estateId: number,
    ) {
        return this.favoriteService.removeFavorite(user.id, estateId);
    }
}
