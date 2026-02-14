import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Full customization options for Set A, B, C
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

// Drink-only customization for Bihun Soto
const drinkOnlyCustomization = {
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

async function addCustomizationToMenu() {
  try {
    console.log('🔄 Starting menu customization migration...\n');

    // Get all menu items
    const allItems = await prisma.menuItem.findMany({
      select: { id: true, name: true, hasCustomization: true },
    });

    console.log(`📋 Found ${allItems.length} menu items in database\n`);

    // Update Set A, B, C with full customization
    const setMenuNames = ['Nasi Set A', 'Nasi Set B', 'NASI SET C', 'Set Lele Pak Antok'];
    let updatedFull = 0;

    for (const name of setMenuNames) {
      const item = allItems.find((i) => i.name.toLowerCase().includes(name.toLowerCase().substring(0, 8)));
      if (item) {
        await prisma.menuItem.update({
          where: { id: item.id },
          data: {
            hasCustomization: true,
            customizationOptions: fullCustomizationOptions as any,
          },
        });
        console.log(`✅ Updated "${item.name}" with full customization`);
        updatedFull++;
      } else {
        console.log(`⚠️  Item "${name}" not found - skipping`);
      }
    }

    // Update Bihun Soto with drink-only customization
    const bihunItem = allItems.find((i) => i.name.toLowerCase().includes('bihun soto'));
    if (bihunItem) {
      await prisma.menuItem.update({
        where: { id: bihunItem.id },
        data: {
          hasCustomization: true,
          customizationOptions: drinkOnlyCustomization as any,
        },
      });
      console.log(`✅ Updated "${bihunItem.name}" with drink customization`);
      updatedFull++;
    }

    // Set Coco Meal should have NO customization
    const cocoItem = allItems.find((i) => i.name.toLowerCase().includes('coco meal'));
    if (cocoItem && cocoItem.hasCustomization) {
      await prisma.menuItem.update({
        where: { id: cocoItem.id },
        data: {
          hasCustomization: false,
          customizationOptions: Prisma.DbNull,
        },
      });
      console.log(`✅ Updated "${cocoItem.name}" - removed customization`);
    }

    console.log(`\n🎉 Migration complete!`);
    console.log(`   - ${updatedFull} items updated with customization`);
    console.log(`   - Items with customization can now be customized by customers\n`);

    // Show summary
    const customizableItems = await prisma.menuItem.findMany({
      where: { hasCustomization: true },
      select: { name: true },
    });

    console.log('📦 Customizable menu items:');
    customizableItems.forEach((item) => console.log(`   - ${item.name}`));

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
addCustomizationToMenu()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
