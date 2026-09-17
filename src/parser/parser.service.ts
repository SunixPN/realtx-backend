import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EstateEntity } from '../estate/entities/estate.entity.js';
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

  async ingestBatch(rawItems: any[], isFullDump: boolean): Promise<{ received: number }> {
    const rates = await this.currencyRates.getLatest();
    await this.upsertMany(rawItems, rates);
    if (isFullDump) {
      await this.markInactive();
    }
    this.logger.log(`Ingest: ${rawItems.length} items (fullDump=${isFullDump})`);
    return { received: rawItems.length };
  }

  private async upsertMany(rawItems: any[], rates: CurrencyRateEntity): Promise<void> {
    const entities = rawItems.map((r) => this.mapToEntity(r, rates));

    for (const entity of entities) {
      const existing = await this.estateRepo.findOne({
        where: { sourceUuid: entity.sourceUuid },
      });

      if (existing) {
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
