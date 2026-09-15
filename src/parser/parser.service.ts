import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { EstateEntity } from '../estate/entities/estate.entity.js';
import {HEADERS} from "./const/headers.js";
import {ApiInfo} from "./const/api-info.js";
import {
    CurrencyRatesService,
    CURRENCY_USD,
    CURRENCY_BYN,
    CURRENCY_EUR,
} from '../currency/currency-rates.service.js';
import { CurrencyRateEntity } from '../currency/entities/currency-rate.entity.js';
import { DistrictService } from './district.service.js';

@Injectable()
export class ParserService {
  private readonly logger = new Logger(ParserService.name);

  constructor(
    @InjectRepository(EstateEntity)
    private readonly estateRepo: Repository<EstateEntity>,
    private readonly currencyRates: CurrencyRatesService,
    private readonly districts: DistrictService,
  ) {}

  async parseAll(): Promise<void> {
    let page = 1;
    let totalPages = 1;
    let saved = 0;

    // Берём актуальные курсы один раз на весь запуск — реалистично, что
    // за 5-10 минут парсинга курс не меняется, а fetchAndSaveFromNbrb уже
    // прокрутил cron в 05:15.
    const rates = await this.currencyRates.getLatest();

    do {
      this.logger.log(`Страница ${page} / ${totalPages}...`);

      const items = await this.fetchPage(page);
      if (!items || items.length === 0) break;

      await this.upsertMany(items, rates);
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

  /**
   * Пересчитывает districtName у всех записей по (lat, lng). Нужно один раз
   * после подключения DistrictService — до этого districtName содержал
   * "Минский" (район области из realt.by), из-за чего фильтр по городским
   * районам на фронте не работал.
   */
  async backfillDistricts(): Promise<{ updated: number; unresolved: number }> {
    const items = await this.estateRepo.find({
      select: { id: true, lat: true, lng: true, districtName: true },
    });
    let updated = 0;
    let unresolved = 0;
    for (const it of items) {
      const resolved = this.districts.resolveByCoords(it.lat, it.lng);
      if (resolved == null) unresolved++;
      if (resolved !== it.districtName) {
        await this.estateRepo.update(it.id, { districtName: resolved });
        updated++;
      }
    }
    this.logger.log(`Backfill районов: обновлено ${updated}, без района ${unresolved} из ${items.length}`);
    return { updated, unresolved };
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

  private async upsertMany(rawItems: any[], rates: CurrencyRateEntity): Promise<void> {
    const entities = rawItems.map((r) => this.mapToEntity(r, rates));

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

  private mapToEntity(r: any, rates: CurrencyRateEntity): Partial<EstateEntity> {
    const [lng, lat] = Array.isArray(r.location) ? r.location : [null, null];

    const price = r.price ?? null;
    const priceCurrency = r.priceCurrency ?? null;
    const pricePerM2 = r.pricePerM2 ?? null;

    const priceUsd = this.currencyRates.convert(price, priceCurrency, CURRENCY_USD, rates);
    const priceByn = this.currencyRates.convert(price, priceCurrency, CURRENCY_BYN, rates);
    const priceEur = this.currencyRates.convert(price, priceCurrency, CURRENCY_EUR, rates);
    const perM2Usd = this.currencyRates.convert(pricePerM2, priceCurrency, CURRENCY_USD, rates);
    const perM2Byn = this.currencyRates.convert(pricePerM2, priceCurrency, CURRENCY_BYN, rates);
    const perM2Eur = this.currencyRates.convert(pricePerM2, priceCurrency, CURRENCY_EUR, rates);

    // realt.by отдаёт `code` неконсистентно: у части объявлений это числовой
    // ID (4106745), у части — короткий буквенный (SITEIXQMS76E). В entity
    // sourceCode типа int, поэтому строка туда не сохраняется. Числовой
    // URL смотрится «нормально», fallback — на unid.
    const numericCode =
      typeof r.code === 'number' && Number.isFinite(r.code)
        ? r.code
        : typeof r.code === 'string' && /^\d+$/.test(r.code)
          ? Number(r.code)
          : null;
    const urlToken = numericCode ?? r.unid ?? null;

    return {
      sourceUuid: r.uuid,
      sourceUnid: r.unid ?? null,
      sourceCode: numericCode,
      sourceUrl: urlToken ? `https://realt.by/sale-flats/object/${urlToken}/` : null,
      headline: r.headline ?? null,
      description: r.description ?? null,
      price,
      priceCurrency,
      pricePerM2,
      priceUsd,
      priceByn,
      priceEur,
      pricePerM2Usd: perM2Usd,
      pricePerM2Byn: perM2Byn,
      pricePerM2Eur: perM2Eur,
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
      // realt.by отдаёт stateDistrictName = район области ("Минский район"),
      // а не городской район Минска. Городской район считаем сами по (lat, lng)
      // через GeoJSON-границы OSM — это то, чем фильтруется фронт.
      districtName: this.districts.resolveByCoords(lat, lng),
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
