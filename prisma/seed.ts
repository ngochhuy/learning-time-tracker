import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DIRECT_URL hoặc DATABASE_URL chưa được cấu hình.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "dev@learning.local" },
    update: {},
    create: {
      id: "dev-user",
      name: "Người học",
      email: "dev@learning.local",
      emailVerified: true,
      settings: { create: {} },
    },
  });

  const categoryNames = ["Tiếng Anh", "Lập trình", "Nghiên cứu"];
  for (const name of categoryNames) {
    await prisma.category.upsert({
      where: {
        userId_normalizedName: {
          userId: user.id,
          normalizedName: name.toLocaleLowerCase("vi-VN"),
        },
      },
      update: {},
      create: {
        userId: user.id,
        name,
        normalizedName: name.toLocaleLowerCase("vi-VN"),
      },
    });
  }
}

main()
  .finally(async () => prisma.$disconnect());
