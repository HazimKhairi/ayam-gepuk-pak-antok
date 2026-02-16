import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addExtrasToSets() {
  console.log('🔄 Adding extras/add-ons to Set menu items...\n');

  try {
    // Define extras that can be added to any Set
    const extrasOptions = {
      label: 'Tambah Extra (Optional)',
      options: [
        { id: 'extra-ayam-original', label: 'Extra Ayam Original (+RM8.00)', priceModifier: 8.00 },
        { id: 'extra-ayam-crispy', label: 'Extra Ayam Crispy (+RM8.00)', priceModifier: 8.00 },
        { id: 'extra-sup-bebola', label: 'Extra Sup Bebola (+RM5.90)', priceModifier: 5.90 },
        { id: 'extra-pedal-hati', label: 'Extra Pedal/Hati 3pcs (+RM3.00)', priceModifier: 3.00 },
        { id: 'extra-kobis', label: 'Extra Kobis Goreng (+RM3.00)', priceModifier: 3.00 },
        { id: 'extra-bergedil', label: 'Extra Bergedil 4pcs (+RM5.00)', priceModifier: 5.00 },
      ],
      required: false,
      multiple: true, // Can select multiple extras
    };

    // Update Set A, B, C with full customization + extras
    const fullCustomizationSets = ['Set A (Crispy/Original)', 'Set B (Crispy/Original)', 'Set C (Crispy/Original)'];

    for (const setName of fullCustomizationSets) {
      const currentItem = await prisma.menuItem.findFirst({ where: { name: setName } });
      if (!currentItem) continue;

      const currentOptions = currentItem.customizationOptions
        ? JSON.parse(currentItem.customizationOptions as string)
        : {};

      const updatedOptions = {
        ayamType: {
          label: 'Jenis Ayam',
          options: [
            { id: 'crispy', label: 'Crispy', priceModifier: 0 },
            { id: 'original', label: 'Original', priceModifier: 0 }
          ],
          required: true
        },
        sambalLevel: {
          label: 'Level Pedas',
          options: [
            { id: 'level1', label: 'Level 1 - Kurang Pedas', priceModifier: 0 },
            { id: 'level2', label: 'Level 2 - Sederhana', priceModifier: 0 },
            { id: 'level3', label: 'Level 3 - Pedas', priceModifier: 0 }
          ],
          required: true
        },
        drink: {
          label: 'Pilih Minuman',
          options: [
            { id: 'blue-lemon', label: 'Blue Lemon Ice (Free)', priceModifier: 0 },
            { id: 'blackcurrent', label: 'Blackcurrent Ice (Free)', priceModifier: 0 },
            { id: 'ice-lemon-tea', label: 'Ice Lemon Tea (Free)', priceModifier: 0 },
            { id: 'mojito-apple', label: 'Mojito Apple (+RM5)', priceModifier: 5 },
            { id: 'mojito-strawberry', label: 'Mojito Strawberry (+RM5)', priceModifier: 5 }
          ],
          required: true
        },
        extras: extrasOptions
      };

      await prisma.menuItem.updateMany({
        where: { name: setName },
        data: {
          customizationOptions: JSON.stringify(updatedOptions),
        },
      });
      console.log('✅ Updated: ' + setName + ' with extras');
    }

    // Update Set Lele with sambal + drink + extras
    const leleItem = await prisma.menuItem.findFirst({ where: { name: 'Set Lele Pak Antok' } });
    if (leleItem) {
      const updatedOptions = {
        sambalLevel: {
          label: 'Level Pedas',
          options: [
            { id: 'level1', label: 'Level 1 - Kurang Pedas', priceModifier: 0 },
            { id: 'level2', label: 'Level 2 - Sederhana', priceModifier: 0 },
            { id: 'level3', label: 'Level 3 - Pedas', priceModifier: 0 }
          ],
          required: true
        },
        drink: {
          label: 'Pilih Minuman',
          options: [
            { id: 'blue-lemon', label: 'Blue Lemon Ice (Free)', priceModifier: 0 },
            { id: 'blackcurrent', label: 'Blackcurrent Ice (Free)', priceModifier: 0 },
            { id: 'ice-lemon-tea', label: 'Ice Lemon Tea (Free)', priceModifier: 0 },
            { id: 'mojito-apple', label: 'Mojito Apple (+RM5)', priceModifier: 5 },
            { id: 'mojito-strawberry', label: 'Mojito Strawberry (+RM5)', priceModifier: 5 }
          ],
          required: true
        },
        extras: extrasOptions
      };

      await prisma.menuItem.updateMany({
        where: { name: 'Set Lele Pak Antok' },
        data: {
          customizationOptions: JSON.stringify(updatedOptions),
        },
      });
      console.log('✅ Updated: Set Lele Pak Antok with extras');
    }

    // Update Set Bihun Soto with extras only
    const bihunItem = await prisma.menuItem.findFirst({ where: { name: 'Set Bihun Soto' } });
    if (bihunItem) {
      const updatedOptions = {
        extras: extrasOptions
      };

      await prisma.menuItem.updateMany({
        where: { name: 'Set Bihun Soto' },
        data: {
          hasCustomization: true,
          customizationOptions: JSON.stringify(updatedOptions),
        },
      });
      console.log('✅ Updated: Set Bihun Soto with extras');
    }

    // Update Set Coco Meal with extras only
    const cocoItem = await prisma.menuItem.findFirst({ where: { name: 'Set Coco Meal' } });
    if (cocoItem) {
      const updatedOptions = {
        extras: extrasOptions
      };

      await prisma.menuItem.updateMany({
        where: { name: 'Set Coco Meal' },
        data: {
          hasCustomization: true,
          customizationOptions: JSON.stringify(updatedOptions),
        },
      });
      console.log('✅ Updated: Set Coco Meal with extras');
    }

    console.log('\n✨ All Set menu items updated with extras options!');
    console.log('\n📝 Extras available:');
    console.log('   - Extra Ayam Original (+RM8.00)');
    console.log('   - Extra Ayam Crispy (+RM8.00)');
    console.log('   - Extra Sup Bebola (+RM5.90)');
    console.log('   - Extra Pedal/Hati 3pcs (+RM3.00)');
    console.log('   - Extra Kobis Goreng (+RM3.00)');
    console.log('   - Extra Bergedil 4pcs (+RM5.00)');

  } catch (error) {
    console.error('❌ Error adding extras:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addExtrasToSets()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
