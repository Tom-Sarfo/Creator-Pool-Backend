import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema0001763086348522 implements MigrationInterface {
    name = 'InitialSchema0001763086348522'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."predictions_choice_enum" AS ENUM('yes', 'no')`);
        await queryRunner.query(`CREATE TYPE "public"."predictions_result_enum" AS ENUM('won', 'lost', 'pending')`);
        await queryRunner.query(`CREATE TABLE "predictions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "poolId" uuid NOT NULL, "predictorId" uuid NOT NULL, "choice" "public"."predictions_choice_enum" NOT NULL, "stake" numeric(10,2) NOT NULL, "potentialPayout" numeric(10,2), "actualPayout" numeric(10,2), "result" "public"."predictions_result_enum" NOT NULL DEFAULT 'pending', "settledAt" TIMESTAMP, "predictedAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b92c9e4db595214b289f5e28adc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."pools_status_enum" AS ENUM('open', 'awaiting_release', 'live_tracking', 'closed', 'settled')`);
        await queryRunner.query(`CREATE TYPE "public"."pools_result_enum" AS ENUM('yes_won', 'no_won', 'pending')`);
        await queryRunner.query(`CREATE TABLE "pools" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "videoId" uuid NOT NULL, "creatorId" uuid NOT NULL, "question" text NOT NULL, "targetViews" integer NOT NULL, "trackingDurationDays" integer NOT NULL DEFAULT '7', "predictionWindowMinutes" integer NOT NULL DEFAULT '15', "status" "public"."pools_status_enum" NOT NULL DEFAULT 'open', "totalStake" numeric(10,2) NOT NULL DEFAULT '0', "creatorPledge" numeric(10,2) NOT NULL DEFAULT '0', "predictorStakes" numeric(10,2) NOT NULL DEFAULT '0', "yesStake" numeric(10,2) NOT NULL DEFAULT '0', "noStake" numeric(10,2) NOT NULL DEFAULT '0', "yesCount" integer NOT NULL DEFAULT '0', "noCount" integer NOT NULL DEFAULT '0', "participants" integer NOT NULL DEFAULT '0', "currentViews" numeric(10,2) NOT NULL DEFAULT '0', "probabilityYes" numeric(10,4) NOT NULL DEFAULT '0', "probabilityNo" numeric(10,4) NOT NULL DEFAULT '0', "yesOdds" numeric(10,2), "noOdds" numeric(10,2), "result" "public"."pools_result_enum" NOT NULL DEFAULT 'pending', "creatorEarnings" numeric(10,2) NOT NULL DEFAULT '0', "closesAt" TIMESTAMP, "publishedAt" TIMESTAMP, "trackingStartedAt" TIMESTAMP, "closedAt" TIMESTAMP, "settledAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6708c86fc389259de3ee43230ee" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."videos_status_enum" AS ENUM('unlisted', 'private', 'public', 'deleted')`);
        await queryRunner.query(`CREATE TYPE "public"."videos_visibility_enum" AS ENUM('unlisted', 'private', 'public')`);
        await queryRunner.query(`CREATE TABLE "videos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "youtubeId" character varying NOT NULL, "title" character varying NOT NULL, "description" text, "thumbnail" character varying NOT NULL, "status" "public"."videos_status_enum" NOT NULL DEFAULT 'unlisted', "visibility" "public"."videos_visibility_enum" NOT NULL DEFAULT 'unlisted', "viewCount" integer NOT NULL DEFAULT '0', "likeCount" integer NOT NULL DEFAULT '0', "commentCount" integer NOT NULL DEFAULT '0', "duration" character varying NOT NULL, "publishedAt" TIMESTAMP, "lastSyncedAt" TIMESTAMP, "views24h" integer, "views48h" integer, "views7d" integer, "views30d" integer, "milestone24hCapturedAt" TIMESTAMP, "milestone48hCapturedAt" TIMESTAMP, "milestone7dCapturedAt" TIMESTAMP, "milestone30dCapturedAt" TIMESTAMP, "hasActivePool" boolean NOT NULL DEFAULT false, "poolCreatedAt" TIMESTAMP, "poolClosedAt" TIMESTAMP, "creatorId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_a755b99e74fb72a10d82347acb4" UNIQUE ("youtubeId"), CONSTRAINT "PK_e4c86c0cf95aff16e9fb8220f6b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('user', 'creator', 'admin')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "name" character varying NOT NULL, "password" character varying, "role" "public"."users_role_enum" NOT NULL, "walletBalance" numeric(10,2) NOT NULL DEFAULT '0', "googleId" character varying, "youtubeChannelId" character varying, "youtubeAccessToken" character varying, "youtubeRefreshToken" character varying, "youtubeTokenExpiresAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "predictions" ADD CONSTRAINT "FK_cd3ebce20d0a2a582bdc8f748aa" FOREIGN KEY ("poolId") REFERENCES "pools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "predictions" ADD CONSTRAINT "FK_d3fb11737cc5bfdefedee5c4506" FOREIGN KEY ("predictorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pools" ADD CONSTRAINT "FK_fa67a375a7e1d5db51eb09f7f90" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pools" ADD CONSTRAINT "FK_67cc8c2320095d3d44094371aac" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "videos" ADD CONSTRAINT "FK_bc33be185fabcc416b0b6cce7cb" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "videos" DROP CONSTRAINT "FK_bc33be185fabcc416b0b6cce7cb"`);
        await queryRunner.query(`ALTER TABLE "pools" DROP CONSTRAINT "FK_67cc8c2320095d3d44094371aac"`);
        await queryRunner.query(`ALTER TABLE "pools" DROP CONSTRAINT "FK_fa67a375a7e1d5db51eb09f7f90"`);
        await queryRunner.query(`ALTER TABLE "predictions" DROP CONSTRAINT "FK_d3fb11737cc5bfdefedee5c4506"`);
        await queryRunner.query(`ALTER TABLE "predictions" DROP CONSTRAINT "FK_cd3ebce20d0a2a582bdc8f748aa"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP TABLE "videos"`);
        await queryRunner.query(`DROP TYPE "public"."videos_visibility_enum"`);
        await queryRunner.query(`DROP TYPE "public"."videos_status_enum"`);
        await queryRunner.query(`DROP TABLE "pools"`);
        await queryRunner.query(`DROP TYPE "public"."pools_result_enum"`);
        await queryRunner.query(`DROP TYPE "public"."pools_status_enum"`);
        await queryRunner.query(`DROP TABLE "predictions"`);
        await queryRunner.query(`DROP TYPE "public"."predictions_result_enum"`);
        await queryRunner.query(`DROP TYPE "public"."predictions_choice_enum"`);
    }

}
