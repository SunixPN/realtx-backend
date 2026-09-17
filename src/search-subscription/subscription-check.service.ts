import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { SearchSubscriptionEntity, type SubscriptionFrequency } from './entities/search-subscription.entity.js';
import { SubscriptionFiltersDto } from './dto/subscription-filters.dto.js';
import { EstateService } from '../estate/estate.service.js';
import { UserEntity } from '../user/entities/user.entity.js';
import { SubscriptionMailer, type SubscriptionMatch } from './subscription-mailer.service.js';
import { describeFilters } from './describe-filters.js';

// Верхний предел объектов в одном письме — иначе дайджест превратится в
// портянку. Всё что не влезло — увидят в следующий раз (lastCheckedAt не
// сдвигается за пределы возвращённого окна... точнее сдвигается, но объекты
// с меньшей ценой попадают следующим циклом только если снова изменятся —
// поэтому берём с запасом).
const MAX_MATCHES_PER_EMAIL = 20;

// Первичный чек: если у подписки нет lastCheckedAt (никогда не проверялась),
// берём окно назад на N дней — чтобы юзер увидел свежие объекты сразу, а не
// ждал следующего появления.
const INITIAL_LOOKBACK_HOURS = 24;

export type CheckSummary = {
    checked: number;
    notified: number;
    skipped: number;
    matches: number;
    errors: number;
};

@Injectable()
export class SubscriptionCheckService {
    private readonly logger = new Logger(SubscriptionCheckService.name);

    constructor(
        @InjectRepository(SearchSubscriptionEntity)
        private readonly subRepo: Repository<SearchSubscriptionEntity>,
        @InjectRepository(UserEntity)
        private readonly userRepo: Repository<UserEntity>,
        private readonly estateService: EstateService,
        private readonly mailer: SubscriptionMailer,
    ) {}

    /**
     * Проверяет все активные подписки указанных частот и рассылает письма.
     * Если `frequencies` не задан — проверяет все (для ручного триггера).
     */
    async runCheck(frequencies?: SubscriptionFrequency[]): Promise<CheckSummary> {
        const qb = this.subRepo.createQueryBuilder('s').where('s.paused = false');
        if (frequencies?.length) {
            qb.andWhere('s.frequency IN (:...freq)', { freq: frequencies });
        }
        const subs = await qb.getMany();

        const summary: CheckSummary = { checked: 0, notified: 0, skipped: 0, matches: 0, errors: 0 };

        for (const sub of subs) {
            summary.checked++;
            try {
                const notified = await this.checkOne(sub, summary);
                if (notified) summary.notified++;
            } catch (e) {
                summary.errors++;
                this.logger.error(`Ошибка проверки подписки ${sub.id}: ${(e as Error).message}`);
            }
        }

        this.logger.log(
            `Проверка подписок: checked=${summary.checked} notified=${summary.notified} skipped=${summary.skipped} matches=${summary.matches} errors=${summary.errors}`,
        );
        return summary;
    }

    private async checkOne(sub: SearchSubscriptionEntity, summary: CheckSummary): Promise<boolean> {
        const user = await this.userRepo.findOne({ where: { id: sub.userId } });
        // Нет пользователя / нет email / не подтверждён / выключил email —
        // просто пропускаем, lastCheckedAt тоже НЕ обновляем: захочет
        // подтвердить email — получит накопленное.
        if (!user || !user.email || !user.emailVerified || !user.notifyByEmail) {
            summary.skipped++;
            return false;
        }
        if (!sub.channels.includes('email')) {
            summary.skipped++;
            return false;
        }

        const since = sub.lastCheckedAt
            ? sub.lastCheckedAt
            : new Date(Date.now() - INITIAL_LOOKBACK_HOURS * 3600 * 1000);

        const filtersDto = plainToInstance(SubscriptionFiltersDto, sub.filters, {
            enableImplicitConversion: false,
        });

        const matches = await this.estateService.findMatchingSince(
            filtersDto,
            since,
            sub.triggers,
            MAX_MATCHES_PER_EMAIL,
        );

        // Сдвигаем lastCheckedAt в любом случае — если совпадений нет, всё
        // равно фиксируем факт проверки, чтобы не сканировать одно и то же
        // окно снова и снова.
        sub.lastCheckedAt = new Date();

        if (matches.length === 0) {
            await this.subRepo.save(sub);
            return false;
        }

        summary.matches += matches.length;
        sub.fresh = (sub.fresh ?? 0) + matches.length;

        const { summary: filtersSummary } = describeFilters(sub.filters);
        await this.mailer.sendDigest({
            to: user.email,
            userName: user.name,
            subscriptionId: sub.id,
            subscriptionName: sub.name,
            filtersSummary,
            matches: matches as SubscriptionMatch[],
            displayCurrency: (sub.filters as { currency?: 'USD' | 'BYN' | 'EUR' }).currency ?? user.currency,
        });

        await this.subRepo.save(sub);
        return true;
    }
}
