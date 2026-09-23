import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { EstateService } from "./estate.service.js";
import { FilterEstatesDto } from "./dto/filter-estates.dto.js";
import { MapPointFilterDto } from "./dto/map-point-filter.dto.js";
import { GetEstateDto } from "./dto/get-estate.dto.js";
import { HouseEstatesDto } from "./dto/house-estates.dto.js";
import { SuggestDto } from "./dto/suggest.dto.js";
import { DistrictProfitabilityDto } from "./dto/district-profitability.dto.js";
import { Public } from "../auth/decorators/public.decorator.js";
import { OptionalAuth } from "../auth/decorators/optional-auth.decorator.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import type { UserEntity } from "../user/entities/user.entity.js";

@Controller('estate')
export class EstateController {
    constructor(private readonly estateService: EstateService) {}

    @OptionalAuth()
    @Post('search')
    search(@Body() dto: FilterEstatesDto, @CurrentUser() user: UserEntity | null) {
        return this.estateService.getAnyEstates(dto, user?.id);
    }

    // Подсказки для строки поиска: метро + адреса. Метро приоритетнее.
    @Public()
    @Get('suggest')
    suggest(@Query() dto: SuggestDto) {
        return this.estateService.suggest(dto.q, dto.limit ?? 10);
    }

    @OptionalAuth()
    @Get('map-points')
    mapPoints(@Query() dto: MapPointFilterDto, @CurrentUser() user: UserEntity | null) {
        return this.estateService.getMapPoints(dto, user?.id);
    }

    @Public()
    @Get('district-profitability')
    districtProfitability(@Query() dto: DistrictProfitabilityDto) {
        return this.estateService.getDistrictProfitability(dto);
    }

    @Public()
    @Get('districts-geojson')
    districtsGeoJSON() {
        return this.estateService.getDistrictsGeoJSON();
    }

    // «Квартиры в одном доме» — bbox из cluster'а Mapbox с фронта.
    // Держим ДО ':id', чтобы 'house' не был перехвачен параметром id.
    @OptionalAuth()
    @Get('house')
    house(@Query() dto: HouseEstatesDto, @CurrentUser() user: UserEntity | null) {
        return this.estateService.getHouseEstates(dto, user?.id);
    }

    @OptionalAuth()
    @Get(':id')
    getById(
        @Param('id', ParseIntPipe) id: number,
        @Query() dto: GetEstateDto,
        @CurrentUser() user: UserEntity | null,
    ) {
        return this.estateService.getById(id, dto, user?.id);
    }
}
