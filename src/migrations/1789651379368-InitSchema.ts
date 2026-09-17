import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1789651379368 implements MigrationInterface {
    name = 'InitSchema1789651379368'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "estates" ("id" SERIAL NOT NULL, "sourceUuid" character varying NOT NULL, "sourceUnid" character varying, "sourceCode" integer, "sourceUrl" character varying, "headline" character varying, "description" text, "price" numeric(12,2), "priceCurrency" integer, "pricePerM2" numeric(10,2), "priceUsd" numeric(12,2), "priceByn" numeric(12,2), "priceEur" numeric(12,2), "pricePerM2Usd" numeric(10,2), "pricePerM2Byn" numeric(10,2), "pricePerM2Eur" numeric(10,2), "priceChangeDirection" integer, "priceChangeDate" TIMESTAMP WITH TIME ZONE, "rooms" integer, "areaTotal" numeric(6,2), "areaLiving" numeric(6,2), "areaKitchen" numeric(6,2), "balconyType" integer, "storey" integer, "storeys" integer, "buildingYear" integer, "wallMaterial" integer, "repairState" integer, "address" character varying, "townName" character varying, "districtName" character varying, "lat" numeric(10,7), "lng" numeric(10,7), "metroStation" character varying, "metroLineId" integer, "metroTime" integer, "photos" jsonb NOT NULL DEFAULT '[]', "sellerType" integer, "agencyName" character varying, "agencyUuid" character varying, "priceHistory" jsonb NOT NULL DEFAULT '[]', "isActive" boolean NOT NULL DEFAULT true, "publishedAt" TIMESTAMP WITH TIME ZONE, "sourceUpdatedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_bc5990c9182c7f0ef180158b1ad" UNIQUE ("sourceUuid"), CONSTRAINT "PK_e6e88990dece2b27b551fe6c7b2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tokenHash" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "userAgent" character varying, "ipAddress" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_c25bc63d248ca90e8dcc1d92d06" UNIQUE ("tokenHash"), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_610102b60fea1455310ccd299d" ON "refresh_tokens"  ("userId") `);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying, "email" character varying, "emailVerified" boolean NOT NULL DEFAULT false, "phone" character varying, "phoneVerified" boolean NOT NULL DEFAULT false, "city" character varying, "passwordHash" character varying, "googleId" character varying, "telegramId" bigint, "currency" character varying NOT NULL DEFAULT 'USD', "theme" character varying NOT NULL DEFAULT 'system', "language" character varying NOT NULL DEFAULT 'ru', "notifyByEmail" boolean NOT NULL DEFAULT true, "notifyByTelegram" boolean NOT NULL DEFAULT false, "weeklyDigest" boolean NOT NULL DEFAULT false, "syncHistory" boolean NOT NULL DEFAULT true, "personalRecommendations" boolean NOT NULL DEFAULT true, "role" character varying NOT NULL DEFAULT 'user', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "lastLoginAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE ("phone"), CONSTRAINT "UQ_f382af58ab36057334fb262efd5" UNIQUE ("googleId"), CONSTRAINT "UQ_df18d17f84763558ac84192c754" UNIQUE ("telegramId"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "email_verification_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tokenHash" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_90489f8f3368c45f461e90efbe5" UNIQUE ("tokenHash"), CONSTRAINT "PK_417a095bbed21c2369a6a01ab9a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_10f285d038feb767bf7c2da14b" ON "email_verification_tokens"  ("userId") `);
        await queryRunner.query(`CREATE TABLE "password_reset_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tokenHash" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_1143abb8c3fad8b06dd857a8c9c" UNIQUE ("tokenHash"), CONSTRAINT "PK_d16bebd73e844c48bca50ff8d3d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d6a19d4b4f6c62dcd29daa497e" ON "password_reset_tokens"  ("userId") `);
        await queryRunner.query(`CREATE TABLE "currency_rates" ("id" SERIAL NOT NULL, "effectiveOn" date NOT NULL, "usdToByn" numeric(12,6) NOT NULL, "eurToByn" numeric(12,6) NOT NULL, "fetchedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_43636e55d92705f102d2a6e75a0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4945ec9b28f6e6c676268e0375" ON "currency_rates"  ("effectiveOn") `);
        await queryRunner.query(`CREATE TABLE "favorites" ("userId" uuid NOT NULL, "estateId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c64d71cb1a57f1c2b650536d1a9" PRIMARY KEY ("userId", "estateId"))`);
        await queryRunner.query(`CREATE TABLE "search_subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "name" character varying(120) NOT NULL, "filters" jsonb NOT NULL, "frequency" character varying(16) NOT NULL DEFAULT 'instant', "triggers" text array NOT NULL DEFAULT ARRAY['new']::text[], "channels" text array NOT NULL DEFAULT ARRAY['email']::text[], "quietHours" boolean NOT NULL DEFAULT false, "paused" boolean NOT NULL DEFAULT false, "lastCheckedAt" TIMESTAMP WITH TIME ZONE, "fresh" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_581de19e1022f83a2a949fad2a9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7a7410eaaace7e5e3cde343363" ON "search_subscriptions"  ("userId", "createdAt") `);
        await queryRunner.query(`CREATE TABLE "app_settings" ("key" character varying(128) NOT NULL, "value" text NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_975c2db59c65c05fd9c6b63a2ab" PRIMARY KEY ("key"))`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "FK_10f285d038feb767bf7c2da14b3" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "FK_d6a19d4b4f6c62dcd29daa497e2" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "favorites" ADD CONSTRAINT "FK_e747534006c6e3c2f09939da60f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "favorites" ADD CONSTRAINT "FK_a3a0c1cfd4d635fecd2f8d48f2c" FOREIGN KEY ("estateId") REFERENCES "estates"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "search_subscriptions" ADD CONSTRAINT "FK_24132f39719dff84478d3a00604" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "search_subscriptions" DROP CONSTRAINT "FK_24132f39719dff84478d3a00604"`);
        await queryRunner.query(`ALTER TABLE "favorites" DROP CONSTRAINT "FK_a3a0c1cfd4d635fecd2f8d48f2c"`);
        await queryRunner.query(`ALTER TABLE "favorites" DROP CONSTRAINT "FK_e747534006c6e3c2f09939da60f"`);
        await queryRunner.query(`ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "FK_d6a19d4b4f6c62dcd29daa497e2"`);
        await queryRunner.query(`ALTER TABLE "email_verification_tokens" DROP CONSTRAINT "FK_10f285d038feb767bf7c2da14b3"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_610102b60fea1455310ccd299de"`);
        await queryRunner.query(`DROP TABLE "app_settings"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7a7410eaaace7e5e3cde343363"`);
        await queryRunner.query(`DROP TABLE "search_subscriptions"`);
        await queryRunner.query(`DROP TABLE "favorites"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4945ec9b28f6e6c676268e0375"`);
        await queryRunner.query(`DROP TABLE "currency_rates"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d6a19d4b4f6c62dcd29daa497e"`);
        await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_10f285d038feb767bf7c2da14b"`);
        await queryRunner.query(`DROP TABLE "email_verification_tokens"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_610102b60fea1455310ccd299d"`);
        await queryRunner.query(`DROP TABLE "refresh_tokens"`);
        await queryRunner.query(`DROP TABLE "estates"`);
    }

}
