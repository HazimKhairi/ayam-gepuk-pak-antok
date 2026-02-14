import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const fullCustomizationOptions = {
  ayamType: {
    label: 'Pilih Jenis Ayam',
    required: true,
    options: [
      { value: 'crispy', label: 'Crispy', priceModifier: 0 },
      { value: 'original', label: 'Original', priceModifier: 0 },
    ],
  },
  sambalLevel: {
    label: 'Tahap Pedas Sambal',
    required: true,
    options: [
      { value: '1', label: 'Tahap 1 (Kurang Pedas)', priceModifier: 0 },
      { value: '2', label: 'Tahap 2 (Sederhana)', priceModifier: 0 },
      { value: '3', label: 'Tahap 3 (Pedas)', priceModifier: 0 },
    ],
  },
  drink: {
    label: 'Pilih Minuman',
    required: true,
    freeOptions: [
      { value: 'blue-lemon', label: 'Blue Lemon', priceModifier: 0 },
      { value: 'blackcurrent', label: 'Blackcurrent', priceModifier: 0 },
      { value: 'ice-lemon-tea', label: 'Ice Lemon Tea', priceModifier: 0 },
    ],
    upgradeOptions: [
      { value: 'mojito-apple', label: 'Mojito Apple', priceModifier: 5 },
      { value: 'mojito-strawberry', label: 'Mojito Strawberry', priceModifier: 5 },
    ],
  },
};

async function updateSets() {
  try {
    console.log('🔄 Updating Set menu items...\n');

    // Get all menu items first
    const allItems = await prisma.menuItem.findMany({
      select: { id: true, name: true },
    });

    console.log(`📋 Found ${allItems.length} menu items\n`);

    let updated = 0;

    // Update each Set item
    for (const item of allItems) {
      const nameLower = item.name.toLowerCase();
      if (nameLower.includes('set a') || nameLower.includes('set b') || nameLower.includes('set c')) {
        await prisma.menuItem.update({
          where: { id: item.id },
          data: {
            hasCustomization: true,
            customizationOptions: fullCustomizationOptions as any,
          },
        });
        console.log(`✅ Updated "${item.name}"`);
        updated++;
      }
    }

    console.log(`\n🎉 Updated ${updated} items with customization\n`);

    // Show all customizable items
    const customizableItems = await prisma.menuItem.findMany({
      where: { hasCustomization: true },
      select: { name: true },
    });

    console.log('📦 Customizable items:');
    customizableItems.forEach((item) => console.log(`   - ${item.name}`));

  } catch (error) {
    console.error('❌ Failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateSets()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
