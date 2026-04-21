-- AlterTable
ALTER TABLE "routes"
ADD COLUMN "is_public" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "routes_is_public_idx" ON "routes"("is_public");

-- CreateEnum
CREATE TYPE "RouteVoteValue" AS ENUM ('up', 'down');

-- CreateTable
CREATE TABLE "route_votes" (
    "id" TEXT NOT NULL,
    "route_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "value" "RouteVoteValue" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_comments" (
    "id" TEXT NOT NULL,
    "route_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "route_votes_route_id_user_id_key" ON "route_votes"("route_id", "user_id");

-- CreateIndex
CREATE INDEX "route_votes_route_id_idx" ON "route_votes"("route_id");

-- CreateIndex
CREATE INDEX "route_votes_user_id_idx" ON "route_votes"("user_id");

-- CreateIndex
CREATE INDEX "route_comments_route_id_idx" ON "route_comments"("route_id");

-- CreateIndex
CREATE INDEX "route_comments_user_id_idx" ON "route_comments"("user_id");

-- CreateIndex
CREATE INDEX "route_comments_parent_id_idx" ON "route_comments"("parent_id");

-- AddForeignKey
ALTER TABLE "route_votes" ADD CONSTRAINT "route_votes_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_votes" ADD CONSTRAINT "route_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_comments" ADD CONSTRAINT "route_comments_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_comments" ADD CONSTRAINT "route_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_comments" ADD CONSTRAINT "route_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "route_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
