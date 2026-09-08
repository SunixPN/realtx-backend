import {Body, Controller, Post} from '@nestjs/common';
import {EstateService} from "./estate.service.js";
import {FilterEstatesDto} from "./dto/filter-estates.dto.js";

@Controller('estate')
export class EstateController {
    constructor(private readonly estateService: EstateService) {}

    @Post("search")
    getAny(@Body() dto: FilterEstatesDto) {
        return this.estateService.getAnyEstates(dto)
    }
}
