/* prisma/seed.ts */

import { PrismaClient } from "@prisma/client";

const prismaClient = new PrismaClient();

async function main() {
  const employees = [
    // SCOT 北區
    { email: "scot.n1@example.com", name: "北區-王小明", dept: "SCOT 北區", role: "USER" },
    { email: "scot.n2@example.com", name: "北區-陳小美", dept: "SCOT 北區", role: "USER" },
    { email: "scot.n3@example.com", name: "北區-林大華", dept: "SCOT 北區", role: "USER" },
    { email: "scot.n4@example.com", name: "北區-張佳玲", dept: "SCOT 北區", role: "USER" },
    { email: "scot.n5@example.com", name: "北區-許子軒", dept: "SCOT 北區", role: "USER" },

    // SCOT 中區
    { email: "scot.c1@example.com", name: "中區-周冠宇", dept: "SCOT 中區", role: "USER" },
    { email: "scot.c2@example.com", name: "中區-黃詩涵", dept: "SCOT 中區", role: "USER" },
    { email: "scot.c3@example.com", name: "中區-李怡君", dept: "SCOT 中區", role: "USER" },
    { email: "scot.c4@example.com", name: "中區-吳柏勳", dept: "SCOT 中區", role: "USER" },

    // SCOT 南區
    { email: "scot.s1@example.com", name: "南區-郭俊宏", dept: "SCOT 南區", role: "USER" },
    { email: "scot.s2@example.com", name: "南區-蔡雅雯", dept: "SCOT 南區", role: "USER" },
    { email: "scot.s3@example.com", name: "南區-鄭宇辰", dept: "SCOT 南區", role: "USER" },
    { email: "scot.s4@example.com", name: "南區-曾宥翔", dept: "SCOT 南區", role: "USER" },
    { email: "scot.s5@example.com", name: "南區-楊佩蓉", dept: "SCOT 南區", role: "USER" },

    // HR
    { email: "hr.1@example.com", name: "HR-許雅婷", dept: "HR", role: "USER" },
    { email: "hr.2@example.com", name: "HR-周佳穎", dept: "HR", role: "USER" },
    { email: "hr.3@example.com", name: "HR-鄧子晴", dept: "HR", role: "USER" },
    { email: "hr.4@example.com", name: "HR-戴承恩", dept: "HR", role: "USER" },

    // IT
    { email: "it.1@example.com", name: "IT-陳致遠", dept: "IT", role: "USER" },
    { email: "it.2@example.com", name: "IT-林書豪", dept: "IT", role: "USER" },
    { email: "it.3@example.com", name: "IT-張家瑋", dept: "IT", role: "USER" },
    { email: "it.4@example.com", name: "IT-吳怡安", dept: "IT", role: "USER" },
    { email: "it.5@example.com", name: "IT-范子涵", dept: "IT", role: "USER" },
    { email: "it.6@example.com", name: "IT-趙文哲", dept: "IT", role: "USER" },
  ];

  let upserted = 0;

  for (const e of employees) {
    await prismaClient.user.upsert({
      where: { email: e.email },
      update: { name: e.name, dept: e.dept, role: e.role },
      create: { email: e.email, name: e.name, dept: e.dept, role: e.role },
    });

    upserted++;
  }

  console.log(`✅ Seed done. Upserted users: ${upserted}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prismaClient.$disconnect();
  });
