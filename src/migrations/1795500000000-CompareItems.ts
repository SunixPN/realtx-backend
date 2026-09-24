import { MigrationInterface, QueryRunner } from "typeorm";

export class CompareItems1795500000000 implements MigrationInterface {
    name = 'CompareItems1795500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "compare_items" ("userId" uuid NOT NULL, "estateId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_compare_items" PRIMARY KEY ("userId", "estateId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_compare_user_created" ON "compare_items" ("userId", "createdAt")`);
        await queryRunner.query(`ALTER TABLE "compare_items" ADD CONSTRAINT "FK_compare_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "compare_items" ADD CONSTRAINT "FK_compare_estate" FOREIGN KEY ("estateId") REFERENCES "estates"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "compare_items" DROP CONSTRAINT "FK_compare_estate"`);
        await queryRunner.query(`ALTER TABLE "compare_items" DROP CONSTRAINT "FK_compare_user"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_compare_user_created"`);
        await queryRunner.query(`DROP TABLE "compare_items"`);
    }
}
