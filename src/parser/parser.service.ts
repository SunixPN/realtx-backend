import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EstateEntity } from '../estate/entities/estate.entity.js';
import {HEADERS} from "./const/headers.js";
import {ApiInfo} from "./const/api-info.js";
import { getHttpClient } from './utils/http-client.js';
import {
    CurrencyRatesService,
    CURRENCY_USD,
    CURRENCY_BYN,
    CURRENCY_EUR,
} from '../currency/currency-rates.service.js';
import { CurrencyRateEntity } from '../currency/entities/currency-rate.entity.js';
import { DistrictService } from './district.service.js';
import { toOriginalPhoto } from './utils/photo-url.js';

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

  private async fetchPage(page: number): Promise<any[]> {
    const res = await this.fetchRaw(page);
    return res?.results ?? [];
  }

  private async fetchRaw(page: number) {
    const response = await getHttpClient().post(
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
        // Защита от «призраков» — объявлений, которых нет на сайте,
        // но searchObjectsV2 продолжает их возвращать.
        if (!(await this.isSourceUrlAlive(entity.sourceUrl))) {
          this.logger.debug(`Пропускаем фантом: ${entity.sourceUrl}`);
          continue;
        }
        await this.estateRepo.save(entity);
      }
    }
  }

  // Ежедневная валидация: HEAD-проверка всех активных объявлений батчами по 20.
  // Деактивирует те, у кого sourceUrl возвращает 404.
  async validateActiveListings(): Promise<void> {
    const BATCH = 20;
    let offset = 0;
    let deactivated = 0;

    while (true) {
      const listings = await this.estateRepo.find({
        where: { isActive: true },
        select: { id: true, sourceUrl: true },
        skip: offset,
        take: BATCH,
      });

      if (listings.length === 0) break;

      await Promise.all(
        listings.map(async (l) => {
          if (await this.isSourceUrlAlive(l.sourceUrl)) return;
          await this.estateRepo.update(l.id, { isActive: false });
          deactivated++;
        }),
      );

      offset += BATCH;
    }

    this.logger.log(`Валидация завершена. Деактивировано: ${deactivated}`);
  }

  // HEAD-проверка sourceUrl. Возвращает false только при явном 404 — сетевые
  // ошибки считаем «живым», чтобы не удалять хорошие объявления из-за флапа.
  private async isSourceUrlAlive(url: string | null | undefined): Promise<boolean> {
    if (!url) return true;
    try {
      await getHttpClient().head(url, { timeout: 5000, maxRedirects: 3 });
      return true;
    } catch (err: any) {
      if (err.response?.status === 404) return false;
      return true;
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
      photos: Array.isArray(r.images) ? r.images.map(toOriginalPhoto) : [],
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
