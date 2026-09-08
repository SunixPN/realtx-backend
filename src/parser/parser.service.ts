import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { EstateEntity } from '../estate/entities/estate.entity.js';
import {HEADERS} from "./const/headers.js";
import {ApiInfo} from "./const/api-info.js";

@Injectable()
export class ParserService {
  private readonly logger = new Logger(ParserService.name);

  constructor(
    @InjectRepository(EstateEntity)
    private readonly estateRepo: Repository<EstateEntity>,
  ) {}

  async parseAll(): Promise<void> {
    let page = 1;
    let totalPages = 1;
    let saved = 0;

    do {
      this.logger.log(`Страница ${page} / ${totalPages}...`);

      const items = await this.fetchPage(page);
      if (!items || items.length === 0) break;

      await this.upsertMany(items);
      saved += items.length;

      if (page === 1) {
        const firstResponse = await this.fetchRaw(1);
        totalPages = Math.ceil(
          firstResponse.pagination.totalCount / ApiInfo.PAGE_SIZE,
        );
      }

      page++;
    } while (page <= totalPages);

    await this.markInactive();
    this.logger.log(`Готово. Обработано ${saved} объявлений.`);
  }

  private async fetchPage(page: number): Promise<any[]> {
    const res = await this.fetchRaw(page);
    return res?.results ?? [];
  }

  private async fetchRaw(page: number) {
    const response = await axios.post(
        ApiInfo.API_URL,
      {
        operationName: 'searchObjectsV2',
        variables: {
          data: {
            where: {
              categories: [ApiInfo.FLATS_CATEGORY],
              address: { townUuids: [ApiInfo.MINSK_TOWN_UUID] },
            },
            pagination: { page, pageSize: ApiInfo.PAGE_SIZE },
          },
        },
        query: ApiInfo.SEARCH_QUERY,
      },
      { headers: HEADERS, timeout: 15000 },
    );

    return response.data?.data?.searchObjectsV2?.body;
  }

  private async upsertMany(rawItems: any[]): Promise<void> {
    const entities = rawItems.map((r) => this.mapToEntity(r));

    for (const entity of entities) {
      const existing = await this.estateRepo.findOne({
        where: { sourceUuid: entity.sourceUuid },
      });

      if (existing) {
        // Фиксируем изменение цены в историю
        if (existing.price !== entity.price && entity.price !== null) {
          entity.priceHistory = [
            ...existing.priceHistory,
            {
              date: new Date().toISOString(),
              price: existing.price ?? 0,
              currency: existing.priceCurrency ?? 0,
            },
          ];
        } else {
          entity.priceHistory = existing.priceHistory;
        }

        await this.estateRepo.update(existing.id, entity);
      } else {
        await this.estateRepo.save(entity);
      }
    }
  }

  private mapToEntity(r: any): Partial<EstateEntity> {
    const [lng, lat] = Array.isArray(r.location) ? r.location : [null, null];

    return {
      sourceUuid: r.uuid,
      sourceUnid: r.unid ?? null,
      sourceUrl: r.uuid ? `https://realt.by/sale-flats/object/${r.unid}/` : null,
      headline: r.headline ?? null,
      description: r.description ?? null,
      price: r.price ?? null,
      priceCurrency: r.priceCurrency ?? null,
      pricePerM2: r.pricePerM2 ?? null,
      priceChangeDirection: r.priceChangeDirection ?? null,
      priceChangeDate: r.priceChangeDate ? new Date(r.priceChangeDate) : null,
      rooms: r.rooms ?? null,
      areaTotal: r.areaTotal ?? null,
      areaLiving: r.areaLiving ?? null,
      areaKitchen: r.areaKitchen ?? null,
      balconyType: r.balconyType ?? null,
      storey: r.storey ?? null,
      storeys: r.storeys ?? null,
      buildingYear: r.buildingYear ?? null,
      wallMaterial: r.wallMaterial ?? null,
      repairState: r.repairState ?? null,
      address: r.address ?? null,
      townName: r.townName ?? null,
      districtName: r.stateDistrictName ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
      metroStation: r.metroStationName ?? null,
      metroLineId: r.metroLineId ?? null,
      metroTime: r.metroTime ?? null,
      photos: Array.isArray(r.images) ? r.images : [],
      sellerType: r.seller ?? null,
      agencyName: r.agencyName ?? null,
      agencyUuid: r.agencyUuid ?? null,
      publishedAt: r.createdAt ? new Date(r.createdAt) : null,
      sourceUpdatedAt: r.updatedAt ? new Date(r.updatedAt) : null,
      isActive: true,
      priceHistory: [],
    };
  }

  // Помечаем снятые объявления — те что не обновлялись больше 2 суток
  private async markInactive(): Promise<void> {
    const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    await this.estateRepo
      .createQueryBuilder()
      .update()
      .set({ isActive: false })
      .where('updatedAt < :cutoff AND isActive = true', { cutoff })
      .execute();
  }
}
