import { MigrationInterface, QueryRunner } from "typeorm";

export class ViewedEstates1795000000000 implements MigrationInterface {
    name = 'ViewedEstates1795000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "viewed_estates" ("userId" uuid NOT NULL, "estateId" integer NOT NULL, "viewedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_viewed_estates" PRIMARY KEY ("userId", "estateId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_viewed_user_time" ON "viewed_estates" ("userId", "viewedAt")`);
        await queryRunner.query(`ALTER TABLE "viewed_estates" ADD CONSTRAINT "FK_viewed_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "viewed_estates" ADD CONSTRAINT "FK_viewed_estate" FOREIGN KEY ("estateId") REFERENCES "estates"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "viewed_estates" DROP CONSTRAINT "FK_viewed_estate"`);
        await queryRunner.query(`ALTER TABLE "viewed_estates" DROP CONSTRAINT "FK_viewed_user"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_viewed_user_time"`);
        await queryRunner.query(`DROP TABLE "viewed_estates"`);
    }
}
