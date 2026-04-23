import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('Adding likes column to posts table...');
    await prisma.$executeRawUnsafe('ALTER TABLE posts ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;');
    console.log('Successfully added likes column to posts.');
    
    console.log('Checking columns again...');
    const result = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'posts' AND column_name = 'likes';
    `);
    console.log('Result:', result);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
