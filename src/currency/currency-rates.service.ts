import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { CurrencyRateEntity } from './entities/currency-rate.entity.js';

export const CURRENCY_USD = 840;
export const CURRENCY_BYN = 933;
export const CURRENCY_EUR = 978;

const NBRB_RATES_URL = 'https://api.nbrb.by/exrates/rates?periodicity=0';

type NbrbRate = {
    Cur_ID: number;
    Cur_Abbreviation: string;
    Cur_Scale: number;
    Cur_OfficialRate: number;
    Date: string;
};

export type ConvertibleCurrency = typeof CURRENCY_USD | typeof CURRENCY_BYN | typeof CURRENCY_EUR;

@Injectable()
export class CurrencyRatesService {
    private readonly logger = new Logger(CurrencyRatesService.name);
    private latestCache: CurrencyRateEntity | null = null;

    constructor(
        @InjectRepository(CurrencyRateEntity)
        private readonly ratesRepo: Repository<CurrencyRateEntity>,
    ) {}

    /**
     * Возвращает последнюю запись курсов. Кешируется в памяти до вызова
     * invalidate() (планировщик сбрасывает после апдейта).
     */
    async getLatest(): Promise<CurrencyRateEntity> {
        if (this.latestCache) return this.latestCache;
        const row = await this.ratesRepo.findOne({ where: {}, order: { effectiveOn: 'DESC' } });
        if (!row) throw new NotFoundException('Курсы валют ещё не загружены — запусти CurrencyRatesScheduler');
        this.latestCache = row;
        return row;
    }

    invalidate() {
        this.latestCache = null;
    }

    /**
     * Конвертация цены между USD/BYN/EUR через BYN как pivot.
     * Возвращает округлённое до 2 знаков число либо null, если исходная цена null.
     */
    convert(
        price: number | null,
        from: number | null,
        to: ConvertibleCurrency,
        rates: CurrencyRateEntity,
    ): number | null {
        if (price === null || from === null) return null;
        if (from === to) return this.round2(price);

        const inByn = this.toByn(price, from, rates);
        if (inByn === null) return null;

        const result = this.fromByn(inByn, to, rates);
        return result === null ? null : this.round2(result);
    }

    private toByn(price: number, from: number, rates: CurrencyRateEntity): number | null {
        if (from === CURRENCY_BYN) return price;
        if (from === CURRENCY_USD) return price * Number(rates.usdToByn);
        if (from === CURRENCY_EUR) return price * Number(rates.eurToByn);
        return null;
    }

    private fromByn(byn: number, to: ConvertibleCurrency, rates: CurrencyRateEntity): number | null {
        if (to === CURRENCY_BYN) return byn;
        if (to === CURRENCY_USD) return byn / Number(rates.usdToByn);
        if (to === CURRENCY_EUR) return byn / Number(rates.eurToByn);
        return null;
    }

    private round2(v: number): number {
        return Math.round(v * 100) / 100;
    }

    /**
     * Тянет свежие курсы с публичного API НБ РБ и апсертит запись за сегодня.
     * Отфильтровываем по Cur_Abbreviation (не по Cur_ID — Cur_ID периодически
     * меняется после деноминаций).
     */
    async fetchAndSaveFromNbrb(): Promise<CurrencyRateEntity> {
        const { data } = await axios.get<NbrbRate[]>(NBRB_RATES_URL, { timeout: 10000 });
        if (!Array.isArray(data)) throw new Error('НБ РБ вернул не массив');

        const usd = data.find(r => r.Cur_Abbreviation === 'USD');
        const eur = data.find(r => r.Cur_Abbreviation === 'EUR');
        if (!usd || !eur) throw new Error('В ответе НБ РБ нет USD или EUR');

        const effectiveOn = (usd.Date ?? new Date().toISOString()).slice(0, 10);
        const usdToByn = usd.Cur_OfficialRate / usd.Cur_Scale;
        const eurToByn = eur.Cur_OfficialRate / eur.Cur_Scale;

        const existing = await this.ratesRepo.findOne({ where: { effectiveOn } });
        const payload: Partial<CurrencyRateEntity> = {
            effectiveOn,
            usdToByn: usdToByn.toFixed(6),
            eurToByn: eurToByn.toFixed(6),
        };

        const saved = existing
            ? await this.ratesRepo.save({ ...existing, ...payload })
            : await this.ratesRepo.save(payload);

        this.invalidate();
        this.logger.log(`Курсы за ${effectiveOn}: USD=${usdToByn.toFixed(4)}, EUR=${eurToByn.toFixed(4)}`);
        return saved;
    }
}
