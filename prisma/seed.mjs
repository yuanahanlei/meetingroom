import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create mock user from env (or default)
  const email = process.env.APP_DEFAULT_USER_EMAIL || "lei@example.com";
  const name = process.env.APP_DEFAULT_USER_NAME || "LEI";
  const dept = process.env.APP_DEFAULT_USER_DEPT || "SCOT 北區";
  const role = (process.env.APP_DEFAULT_USER_ROLE || "USER") === "ADMIN" ? Role.ADMIN : Role.USER;

  await prisma.user.upsert({
    where: { email },
    update: { name, dept, role },
    create: { email, name, dept, role },
  });

  const rooms = [
    { floor: "B1", name: "A", capacity: 10, features: ["TV", "Whiteboard"] },
    { floor: "B1", name: "B", capacity: 12, features: ["TV"] },
    { floor: "B1", name: "C", capacity: 8, features: ["Whiteboard"] },
    { floor: "B1", name: "D", capacity: 6, features: [] },
    { floor: "B1", name: "E", capacity: 20, features: ["TV", "Video"] },
    { floor: "1F", name: "會議室", capacity: 10, features: ["TV"] },
    { floor: "2F", name: "會議室", capacity: 12, features: ["Whiteboard"] },
    { floor: "4F", name: "中間會議室", capacity: 20, features: ["TV", "Video", "Whiteboard"] },
    { floor: "4F", name: "左邊會議室", capacity: 8, features: ["Whiteboard"] },
    { floor: "6F", name: "會議室", capacity: 10, features: ["TV"] },
  ].map(r => ({
    floor: r.floor,
    name: r.floor === "B1" ? `B1-${r.name}` : r.name,
    capacity: r.capacity,
    features: r.features,
    isActive: true,
  }));

  for (const room of rooms) {
    await prisma.room.upsert({
      where: { id: room.id || "___" }, // will never match
      update: {},
      create: room,
    }).catch(async () => {
      // Upsert by unique isn't possible because we don't have a unique field.
      // So do find-first by name+floor and create if not exists.
      const existing = await prisma.room.findFirst({ where: { name: room.name, floor: room.floor } });
      if (!existing) await prisma.room.create({ data: room });
    });
  }

  console.log("Seed complete.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
