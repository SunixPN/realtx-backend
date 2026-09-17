import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { SearchSubscriptionEntity } from './entities/search-subscription.entity.js';
import { CreateSubscriptionDto } from './dto/create-subscription.dto.js';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto.js';
import { SubscriptionFiltersDto } from './dto/subscription-filters.dto.js';
import { EstateService } from '../estate/estate.service.js';
import { describeFilters } from './describe-filters.js';

export type SubscriptionItem = {
    id: string;
    name: string;
    filters: Record<string, unknown>;
    summary: string;
    chips: string[];
    total: number;
    fresh: number;
    frequency: SearchSubscriptionEntity['frequency'];
    triggers: SearchSubscriptionEntity['triggers'];
    channels: SearchSubscriptionEntity['channels'];
    quietHours: boolean;
    paused: boolean;
    lastCheckedAt: string | null;
    createdAt: string;
    updatedAt: string;
};

@Injectable()
export class SearchSubscriptionService {
    constructor(
        @InjectRepository(SearchSubscriptionEntity)
        private readonly repo: Repository<SearchSubscriptionEntity>,
        private readonly estateService: EstateService,
    ) {}

    async list(userId: string): Promise<SubscriptionItem[]> {
        const rows = await this.repo.find({
            where: { userId },
            order: { createdAt: 'DESC' },
        });
        return Promise.all(rows.map(row => this.toItem(row)));
    }

    async getOne(userId: string, id: string): Promise<SubscriptionItem> {
        const row = await this.repo.findOne({ where: { id, userId } });
        if (!row) throw new NotFoundException(`Subscription ${id} not found`);
        return this.toItem(row);
    }

    async create(userId: string, dto: CreateSubscriptionDto): Promise<SubscriptionItem> {
        const entity = this.repo.create({
            userId,
            name: dto.name,
            filters: this.serializeFilters(dto.filters),
            frequency: dto.frequency,
            triggers: dto.triggers,
            channels: dto.channels,
            quietHours: dto.quietHours ?? false,
            paused: false,
        });
        const saved = await this.repo.save(entity);
        return this.toItem(saved);
    }

    async update(userId: string, id: string, dto: UpdateSubscriptionDto): Promise<SubscriptionItem> {
        const row = await this.repo.findOne({ where: { id, userId } });
        if (!row) throw new NotFoundException(`Subscription ${id} not found`);

        if (dto.name !== undefined) row.name = dto.name;
        if (dto.filters !== undefined) row.filters = this.serializeFilters(dto.filters);
        if (dto.frequency !== undefined) row.frequency = dto.frequency;
        if (dto.triggers !== undefined) row.triggers = dto.triggers;
        if (dto.channels !== undefined) row.channels = dto.channels;
        if (dto.quietHours !== undefined) row.quietHours = dto.quietHours;
        if (dto.paused !== undefined) row.paused = dto.paused;

        const saved = await this.repo.save(row);
        return this.toItem(saved);
    }

    async setPaused(userId: string, id: string, paused: boolean): Promise<SubscriptionItem> {
        const row = await this.repo.findOne({ where: { id, userId } });
        if (!row) throw new NotFoundException(`Subscription ${id} not found`);
        row.paused = paused;
        const saved = await this.repo.save(row);
        return this.toItem(saved);
    }

    async markSeen(userId: string, id: string): Promise<SubscriptionItem> {
        const row = await this.repo.findOne({ where: { id, userId } });
        if (!row) throw new NotFoundException(`Subscription ${id} not found`);
        if (row.fresh !== 0) {
            row.fresh = 0;
            await this.repo.save(row);
        }
        return this.toItem(row);
    }

    async remove(userId: string, id: string): Promise<void> {
        const result = await this.repo.delete({ id, userId });
        if (!result.affected) throw new NotFoundException(`Subscription ${id} not found`);
    }

    private serializeFilters(filters: SubscriptionFiltersDto): Record<string, unknown> {
        // Отсекаем undefined, чтобы JSONB был компактнее и предсказуемее.
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(filters)) {
            if (v === undefined || v === null) continue;
            if (Array.isArray(v) && v.length === 0) continue;
            out[k] = v;
        }
        return out;
    }

    private async toItem(row: SearchSubscriptionEntity): Promise<SubscriptionItem> {
        const { summary, chips } = describeFilters(row.filters);
        // Приводим JSONB → DTO, чтобы EstateService.countByFilters получил
        // экземпляр с корректными типами (Transform-декораторы уже сработали
        // на этапе сохранения — тут просто структурная типизация).
        const filtersDto = plainToInstance(SubscriptionFiltersDto, row.filters, {
            enableImplicitConversion: false,
        });
        const total = await this.estateService.countByFilters(filtersDto).catch(() => 0);
        return {
            id: row.id,
            name: row.name,
            filters: row.filters,
            summary,
            chips,
            total,
            fresh: row.fresh ?? 0,
            frequency: row.frequency,
            triggers: row.triggers,
            channels: row.channels,
            quietHours: row.quietHours,
            paused: row.paused,
            lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
        };
    }
}
