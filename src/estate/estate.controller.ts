import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { EstateService } from "./estate.service.js";
import { FilterEstatesDto } from "./dto/filter-estates.dto.js";
import { MapPointFilterDto } from "./dto/map-point-filter.dto.js";
import { GetEstateDto } from "./dto/get-estate.dto.js";
import { HouseEstatesDto } from "./dto/house-estates.dto.js";
import { SuggestDto } from "./dto/suggest.dto.js";
import { Public } from "../auth/decorators/public.decorator.js";

@Controller('estate')
export class EstateController {
    constructor(private readonly estateService: EstateService) {}

    @Public()
    @Post('search')
    search(@Body() dto: FilterEstatesDto) {
        return this.estateService.getAnyEstates(dto);
    }

    // Подсказки для строки поиска: метро + адреса. Метро приоритетнее.
    @Public()
    @Get('suggest')
    suggest(@Query() dto: SuggestDto) {
        return this.estateService.suggest(dto.q, dto.limit ?? 10);
    }

    @Public()
    @Get('map-points')
    mapPoints(@Query() dto: MapPointFilterDto) {
        return this.estateService.getMapPoints(dto);
    }

    // «Квартиры в одном доме» — bbox из cluster'а Mapbox с фронта.
    // Держим ДО ':id', чтобы 'house' не был перехвачен параметром id.
    @Public()
    @Get('house')
    house(@Query() dto: HouseEstatesDto) {
        return this.estateService.getHouseEstates(dto);
    }

    @Public()
    @Get(':id')
    getById(@Param('id', ParseIntPipe) id: number, @Query() dto: GetEstateDto) {
        return this.estateService.getById(id, dto);
    }
}
