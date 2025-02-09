/*
  Warnings:

  - Added the required column `town` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `village` to the `User` table without a default value. This is not possible if the table is not empty.
  - Made the column `name` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `phone` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "town" TEXT NOT NULL,
ADD COLUMN     "village" TEXT NOT NULL,
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "phone" SET NOT NULL;
