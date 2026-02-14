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

async function updateAllSets() {
  try {
    console.log('🔄 Updating all Set menu items with customization...\n');

    // Update all items where name contains "Set" (case insensitive)
    const result = await prisma.menuItem.updateMany({
      where: {
        OR: [
          { name: { contains: 'Set A', mode: 'insensitive' } },
          { name: { contains: 'Set B', mode: 'insensitive' } },
          { name: { contains: 'Set C', mode: 'insensitive' } },
        ],
      },
      data: {
        hasCustomization: true,
        customizationOptions: fullCustomizationOptions as any,
      },
    });

    console.log(`✅ Updated ${result.count} menu items with customization\n`);

    // Show all customizable items
    const customizableItems = await prisma.menuItem.findMany({
      where: { hasCustomization: true },
      select: { id: true, name: true },
    });

    console.log('📦 Customizable menu items:');
    customizableItems.forEach((item) => console.log(`   - ${item.name}`));
    console.log('\n✅ Migration complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateAllSets()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
