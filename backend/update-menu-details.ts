import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateMenuDetails() {
  console.log('🔄 Updating menu items with detailed information...\n');

  try {
    // SET MENU - All have customization options
    const setMenuUpdates = [
      {
        name: 'Set A (Crispy/Original)',
        description: 'Set lengkap dengan nasi putih, ayam gepuk (pilih crispy atau original), sambal, dan minuman.',
        ingredients: 'Nasi Putih, Ayam Gepuk (Crispy/Original), Sambal Level 1/2/3, Sayur',
        freeItem: 'Free: Blue Lemon / Blackcurrent / Ice Lemon Tea (Upgrade ke Mojito +RM5)',
      },
      {
        name: 'Set B (Crispy/Original)',
        description: 'Set premium dengan nasi putih, ayam gepuk (pilih crispy atau original), sambal, lauk tambahan, dan minuman.',
        ingredients: 'Nasi Putih, Ayam Gepuk (Crispy/Original), Sambal Level 1/2/3, Sayur, Lauk Tambahan',
        freeItem: 'Free: Blue Lemon / Blackcurrent / Ice Lemon Tea (Upgrade ke Mojito +RM5)',
      },
      {
        name: 'Set C (Crispy/Original)',
        description: 'Set istimewa dengan nasi putih, ayam gepuk (pilih crispy atau original), sambal, lauk premium, dan minuman.',
        ingredients: 'Nasi Putih, Ayam Gepuk (Crispy/Original), Sambal Level 1/2/3, Sayur, Lauk Premium, Bergedil',
        freeItem: 'Free: Blue Lemon / Blackcurrent / Ice Lemon Tea (Upgrade ke Mojito +RM5)',
      },
      {
        name: 'Set Lele Pak Antok',
        description: 'Set istimewa dengan ikan lele goreng garing, nasi putih, sambal, dan minuman.',
        ingredients: 'Nasi Putih, Ikan Lele Goreng, Sambal Level 1/2/3, Sayur',
        freeItem: 'Free: Blue Lemon / Blackcurrent / Ice Lemon Tea (Upgrade ke Mojito +RM5)',
      },
      {
        name: 'Set Bihun Soto',
        description: 'Set bihun soto yang hangat dengan kuah rempah asli, telur rebus, dan sayuran segar.',
        ingredients: 'Bihun, Kuah Soto Rempah, Telur Rebus, Sayur Segar, Keropok',
        freeItem: null,
      },
      {
        name: 'Set Coco Meal',
        description: 'Set nasi dengan ayam dan air kelapa segar yang menyegarkan.',
        ingredients: 'Nasi Putih, Ayam Gepuk, Sambal, Sayur',
        freeItem: 'Free: Air Kelapa',
      },
    ];

    for (const update of setMenuUpdates) {
      await prisma.menuItem.updateMany({
        where: { name: update.name },
        data: {
          description: update.description,
          ingredients: update.ingredients,
          freeItem: update.freeItem,
        },
      });
      console.log(`✅ Updated: ${update.name}`);
    }

    // DRINKS
    const drinkUpdates = [
      {
        name: 'Strawberry Mojito',
        description: 'Minuman segar strawberry mojito dengan mint leaves dan soda.',
        ingredients: 'Strawberry, Mint Leaves, Soda, Ice, Lemon',
        freeItem: null,
      },
      {
        name: 'Apple Mojito',
        description: 'Minuman segar apple mojito dengan mint leaves dan soda.',
        ingredients: 'Apple, Mint Leaves, Soda, Ice, Lemon',
        freeItem: null,
      },
      {
        name: 'Blue Lemon Ice',
        description: 'Minuman segar blue lemon yang menyegarkan dengan ice.',
        ingredients: 'Blue Lemon Syrup, Lemon, Ice',
        freeItem: null,
      },
      {
        name: 'Blackcurrent Ice',
        description: 'Minuman segar blackcurrent yang menyegarkan dengan ice.',
        ingredients: 'Blackcurrent Syrup, Ice, Lemon',
        freeItem: null,
      },
      {
        name: 'Ice Lemon Tea',
        description: 'Teh lemon sejuk yang menyegarkan.',
        ingredients: 'Tea, Lemon, Ice, Sugar',
        freeItem: null,
      },
    ];

    for (const update of drinkUpdates) {
      await prisma.menuItem.updateMany({
        where: { name: update.name },
        data: {
          description: update.description,
          ingredients: update.ingredients,
          freeItem: update.freeItem,
        },
      });
      console.log(`✅ Updated: ${update.name}`);
    }

    // ALA CARTE
    const alaCarteUpdates = [
      {
        name: 'Ayam Original',
        description: 'Ayam gepuk original dengan bumbu rempah khas Yogyakarta yang lembut dan gurih.',
        ingredients: 'Ayam, Bumbu Rempah Yogyakarta, Santan',
        freeItem: null,
      },
      {
        name: 'Ayam Crispy',
        description: 'Ayam gepuk crispy dengan lapisan tepung yang renyah diluar, lembut didalam.',
        ingredients: 'Ayam, Bumbu Rempah Yogyakarta, Tepung Crispy',
        freeItem: null,
      },
      {
        name: 'Sup Bebola',
        description: 'Sup bebola daging yang hangat dengan sayuran segar.',
        ingredients: 'Bebola Daging, Kuah Sup, Sayur (Lobak, Carrot, Tomato)',
        freeItem: null,
      },
      {
        name: 'Pedal/Hati (3pcs)',
        description: 'Pedal dan hati ayam goreng garing (3 keping).',
        ingredients: 'Pedal Ayam, Hati Ayam, Tepung Goreng',
        freeItem: null,
      },
      {
        name: 'Kobis Goreng',
        description: 'Kobis goreng yang segar dan sihat.',
        ingredients: 'Kobis, Bawang, Minyak Masak, Garam',
        freeItem: null,
      },
      {
        name: 'Bergedil (4pcs)',
        description: 'Bergedil kentang goreng yang sedap dan mengenyangkan (4 biji).',
        ingredients: 'Kentang, Bawang, Tepung, Rempah',
        freeItem: null,
      },
    ];

    for (const update of alaCarteUpdates) {
      await prisma.menuItem.updateMany({
        where: { name: update.name },
        data: {
          description: update.description,
          ingredients: update.ingredients,
          freeItem: update.freeItem,
        },
      });
      console.log(`✅ Updated: ${update.name}`);
    }

    console.log('\n✨ All menu items updated successfully!');
    console.log('\n📝 Summary:');
    console.log(`   - ${setMenuUpdates.length} Set Menu items`);
    console.log(`   - ${drinkUpdates.length} Drink items`);
    console.log(`   - ${alaCarteUpdates.length} Ala Carte items`);
    console.log(`   - Total: ${setMenuUpdates.length + drinkUpdates.length + alaCarteUpdates.length} items updated`);

  } catch (error) {
    console.error('❌ Error updating menu:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateMenuDetails()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
