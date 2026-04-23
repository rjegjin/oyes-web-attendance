import { prisma } from "./src/lib/prisma";
async function run() {
  const events = await prisma.event.findMany();
  console.log(events);
}
run();
