import { MigrationInterface, QueryRunner } from "typeorm";

export class ComparePreferences1795600000000 implements MigrationInterface {
    name = 'ComparePreferences1795600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "compare_preferences" ("userId" uuid NOT NULL, "hiddenRows" text array NOT NULL DEFAULT '{}', "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_compare_preferences" PRIMARY KEY ("userId"))`);
        await queryRunner.query(`ALTER TABLE "compare_preferences" ADD CONSTRAINT "FK_compare_pref_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "compare_preferences" DROP CONSTRAINT "FK_compare_pref_user"`);
        await queryRunner.query(`DROP TABLE "compare_preferences"`);
    }
}
