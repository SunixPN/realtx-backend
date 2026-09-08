import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {EstateEntity} from "./entities/estate.entity.js";
import {FilterEstatesDto} from "./dto/filter-estates.dto.js";

@Injectable()
export class EstateService {
    constructor(
        @InjectRepository(EstateEntity)
        private readonly estateRepo: Repository<EstateEntity>,
    ) {}

    async getAnyEstates (dto: FilterEstatesDto) {
        const qb = this.estateRepo.createQueryBuilder("e")

        if (dto.priceMax != undefined) qb.andWhere(`e.price <= :priceMax`, { priceMax: dto.priceMax })
        if (dto.priceMin != undefined) qb.andWhere(`e.price >= :priceMin`, { priceMin: dto.priceMin })

        if (dto.priceCurrency !== undefined) qb.andWhere('e.priceCurrency = :cur', { cur: dto.priceCurrency });

        if (dto.rooms?.length) {
            const has5plus = dto.rooms.includes(5);
            const exact = dto.rooms.filter(r => r < 5);
            if (has5plus && exact.length) {
                qb.andWhere('(e.rooms IN (:...exact) OR e.rooms >= 5)', { exact });
            } else if (has5plus) {
                qb.andWhere('e.rooms >= 5');
            } else {
                qb.andWhere('e.rooms IN (:...rooms)', { rooms: dto.rooms });
            }
        }

        if (dto.areaMin !== undefined) qb.andWhere('e.areaTotal >= :areaMin', { areaMin: dto.areaMin });
        if (dto.areaMax !== undefined) qb.andWhere('e.areaTotal <= :areaMax', { areaMax: dto.areaMax });

        if (dto.storeyMin !== undefined) qb.andWhere('e.storey >= :sMin', { sMin: dto.storeyMin });
        if (dto.storeyMax !== undefined) qb.andWhere('e.storey <= :sMax', { sMax: dto.storeyMax });
        if (dto.notFirstOrLast) qb.andWhere('e.storey > 1 AND e.storey < e.storeys');

        if (dto.buildingYearMin !== undefined) qb.andWhere('e.buildingYear >= :yMin', { yMin: dto.buildingYearMin });
        if (dto.buildingYearMax !== undefined) qb.andWhere('e.buildingYear <= :yMax', { yMax: dto.buildingYearMax });

        if (dto.wallMaterial?.length) qb.andWhere('e.wallMaterial IN (:...wm)', { wm: dto.wallMaterial });
        if (dto.repairState?.length) qb.andWhere('e.repairState IN (:...rs)', { rs: dto.repairState });
        if (dto.districts?.length) qb.andWhere('e.districtName IN (:...d)', { d: dto.districts });

        if (dto.metroTimeMax !== undefined) qb.andWhere('e.metroTime <= :mt', { mt: dto.metroTimeMax });

        if (dto.ownerOnly) qb.andWhere('e.agencyUuid IS NULL');

        qb.andWhere('e.isActive = :active', { active: dto.isActive ?? true });

        qb.orderBy(`e.${dto.sortBy}`, dto.sortOrder)
            .skip((dto.page! - 1) * dto.limit!)
            .take(dto.limit!);

        const [items, total] = await qb.getManyAndCount();
        return { total, page: dto.page, limit: dto.limit, estates: items };
    }
}
