import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { SearchSubscriptionEntity } from './entities/search-subscription.entity.js';
import { UserEntity } from '../user/entities/user.entity.js';
import { SearchSubscriptionController } from './search-subscription.controller.js';
import { SearchSubscriptionService } from './search-subscription.service.js';
import { SubscriptionCheckService } from './subscription-check.service.js';
import { SubscriptionMailer } from './subscription-mailer.service.js';
import { SearchSubscriptionScheduler } from './search-subscription.scheduler.js';
import { EstateModule } from '../estate/estate.module.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([SearchSubscriptionEntity, UserEntity]),
        ScheduleModule.forRoot(),
        EstateModule,
    ],
    controllers: [SearchSubscriptionController],
    providers: [
        SearchSubscriptionService,
        SubscriptionCheckService,
        SubscriptionMailer,
        SearchSubscriptionScheduler,
    ],
    exports: [SubscriptionCheckService],
})
export class SearchSubscriptionModule {}
