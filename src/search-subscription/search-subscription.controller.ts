import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { SearchSubscriptionService } from './search-subscription.service.js';
import { CreateSubscriptionDto } from './dto/create-subscription.dto.js';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto.js';
import { TogglePauseDto } from './dto/toggle-pause.dto.js';

@Controller('search-subscriptions')
export class SearchSubscriptionController {
    constructor(
        private readonly service: SearchSubscriptionService,
    ) {}

    @Get()
    list(@CurrentUser() user: { id: string }) {
        return this.service.list(user.id);
    }

    @Post()
    create(
        @CurrentUser() user: { id: string },
        @Body() dto: CreateSubscriptionDto,
    ) {
        return this.service.create(user.id, dto);
    }

    @Patch(':id')
    update(
        @CurrentUser() user: { id: string },
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateSubscriptionDto,
    ) {
        return this.service.update(user.id, id, dto);
    }

    @Post(':id/mark-seen')
    @HttpCode(HttpStatus.OK)
    markSeen(
        @CurrentUser() user: { id: string },
        @Param('id', ParseUUIDPipe) id: string,
    ) {
        return this.service.markSeen(user.id, id);
    }

    @Patch(':id/pause')
    togglePause(
        @CurrentUser() user: { id: string },
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: TogglePauseDto,
    ) {
        return this.service.setPaused(user.id, id, dto.paused);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(
        @CurrentUser() user: { id: string },
        @Param('id', ParseUUIDPipe) id: string,
    ) {
        return this.service.remove(user.id, id);
    }
}
