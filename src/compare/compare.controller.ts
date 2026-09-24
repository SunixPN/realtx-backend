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
    Put,
    Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { CompareService } from './compare.service.js';
import { GetCompareDto } from './dto/get-compare.dto.js';
import { UpdateComparePreferencesDto } from './dto/update-compare-preferences.dto.js';

@Controller('compare')
export class CompareController {
    constructor(private readonly compareService: CompareService) {}

    @Get()
    getCompare(@CurrentUser() user: { id: string }, @Query() dto: GetCompareDto) {
        return this.compareService.getCompare(user.id, dto);
    }

    @Get('ids')
    getCompareIds(@CurrentUser() user: { id: string }) {
        return this.compareService.getCompareIds(user.id);
    }

    @Get('preferences')
    getPreferences(@CurrentUser() user: { id: string }) {
        return this.compareService.getPreferences(user.id);
    }

    @Put('preferences')
    updatePreferences(
        @CurrentUser() user: { id: string },
        @Body() dto: UpdateComparePreferencesDto,
    ) {
        return this.compareService.updatePreferences(user.id, dto);
    }

    @Delete()
    @HttpCode(HttpStatus.NO_CONTENT)
    clearCompare(@CurrentUser() user: { id: string }) {
        return this.compareService.clearCompare(user.id);
    }

    @Post(':estateId')
    @HttpCode(HttpStatus.OK)
    addToCompare(
        @CurrentUser() user: { id: string },
        @Param('estateId', ParseIntPipe) estateId: number,
    ) {
        return this.compareService.addToCompare(user.id, estateId);
    }

    @Delete(':estateId')
    @HttpCode(HttpStatus.NO_CONTENT)
    removeFromCompare(
        @CurrentUser() user: { id: string },
        @Param('estateId', ParseIntPipe) estateId: number,
    ) {
        return this.compareService.removeFromCompare(user.id, estateId);
    }
}
