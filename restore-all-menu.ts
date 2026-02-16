import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function restoreAllMenu() {
  console.log('🔄 Restoring all 17 menu items from original menu...\n');

  try {
    // Get categories
    const setMenuCat = await prisma.category.findFirst({ where: { slug: 'set-menu' } });
    const drinksCat = await prisma.category.findFirst({ where: { slug: 'drinks' } });
    const alaCarteCat = await prisma.category.findFirst({ where: { slug: 'ala-carte' } });

    if (!setMenuCat || !drinksCat || !alaCarteCat) {
      throw new Error('Categories not found! Please run seed first.');
    }

    // Delete existing items
    await prisma.menuItem.deleteMany({});
    console.log('✅ Cleared existing menu items\n');

    // SET MENU (6 items)
    const setMenuItems = [
      {
        name: 'Set A (Crispy/Original)',
        description: 'Set lengkap dengan nasi putih, ayam gepuk (pilih crispy atau original), sambal, dan minuman.',
        price: 12.90,
        image: '/uploads/set-a.jpg',
        categoryId: setMenuCat.id,
        ingredients: 'Nasi Putih, Ayam Gepuk (Crispy/Original), Sambal Level 1/2/3, Sayur',
        freeItem: 'Free: Blue Lemon / Blackcurrent / Ice Lemon Tea (Upgrade ke Mojito +RM5)',
        isFeatured: true,
        hasCustomization: true,
        customizationOptions: JSON.stringify({
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
          }
        })
      },
      {
        name: 'Set B (Crispy/Original)',
        description: 'Set premium dengan nasi putih, ayam gepuk (pilih crispy atau original), sambal, lauk tambahan, dan minuman.',
        price: 13.90,
        image: '/uploads/set-b.jpg',
        categoryId: setMenuCat.id,
        ingredients: 'Nasi Putih, Ayam Gepuk (Crispy/Original), Sambal Level 1/2/3, Sayur, Lauk Tambahan',
        freeItem: 'Free: Blue Lemon / Blackcurrent / Ice Lemon Tea (Upgrade ke Mojito +RM5)',
        isFeatured: true,
        hasCustomization: true,
        customizationOptions: JSON.stringify({
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
          }
        })
      },
      {
        name: 'Set C (Crispy/Original)',
        description: 'Set istimewa dengan nasi putih, ayam gepuk (pilih crispy atau original), sambal, lauk premium, dan minuman.',
        price: 14.90,
        image: '/uploads/set-c.jpg',
        categoryId: setMenuCat.id,
        ingredients: 'Nasi Putih, Ayam Gepuk (Crispy/Original), Sambal Level 1/2/3, Sayur, Lauk Premium, Bergedil',
        freeItem: 'Free: Blue Lemon / Blackcurrent / Ice Lemon Tea (Upgrade ke Mojito +RM5)',
        isFeatured: true,
        hasCustomization: true,
        customizationOptions: JSON.stringify({
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
          }
        })
      },
      {
        name: 'Set Lele Pak Antok',
        description: 'Set istimewa dengan ikan lele goreng garing, nasi putih, sambal, dan minuman.',
        price: 13.90,
        image: '/uploads/set-lele.jpg',
        categoryId: setMenuCat.id,
        ingredients: 'Nasi Putih, Ikan Lele Goreng, Sambal Level 1/2/3, Sayur',
        freeItem: 'Free: Blue Lemon / Blackcurrent / Ice Lemon Tea (Upgrade ke Mojito +RM5)',
        isFeatured: false,
        hasCustomization: true,
        customizationOptions: JSON.stringify({
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
          }
        })
      },
      {
        name: 'Set Bihun Soto',
        description: 'Set bihun soto yang hangat dengan kuah rempah asli, telur rebus, dan sayuran segar.',
        price: 10.00,
        image: '/uploads/set-bihun.jpg',
        categoryId: setMenuCat.id,
        ingredients: 'Bihun, Kuah Soto Rempah, Telur Rebus, Sayur Segar, Keropok',
        freeItem: null,
        isFeatured: false,
        hasCustomization: false,
      },
      {
        name: 'Set Coco Meal',
        description: 'Set nasi dengan ayam dan air kelapa segar yang menyegarkan.',
        price: 10.90,
        image: '/uploads/set-coco.jpg',
        categoryId: setMenuCat.id,
        ingredients: 'Nasi Putih, Ayam Gepuk, Sambal, Sayur',
        freeItem: 'Free: Air Kelapa',
        isFeatured: false,
        hasCustomization: false,
      },
    ];

    for (const item of setMenuItems) {
      await prisma.menuItem.create({ data: item });
      console.log('✅ Created: ' + item.name + ' - RM' + item.price);
    }

    // DRINKS (5 items)
    const drinkItems = [
      {
        name: 'Strawberry Mojito',
        description: 'Minuman segar strawberry mojito dengan mint leaves dan soda.',
        price: 7.90,
        image: '/uploads/strawberry-mojito.jpg',
        categoryId: drinksCat.id,
        ingredients: 'Strawberry, Mint Leaves, Soda, Ice, Lemon',
        freeItem: null,
        isFeatured: false,
        hasCustomization: false,
      },
      {
        name: 'Apple Mojito',
        description: 'Minuman segar apple mojito dengan mint leaves dan soda.',
        price: 7.90,
        image: '/uploads/apple-mojito.jpg',
        categoryId: drinksCat.id,
        ingredients: 'Apple, Mint Leaves, Soda, Ice, Lemon',
        freeItem: null,
        isFeatured: false,
        hasCustomization: false,
      },
      {
        name: 'Blue Lemon Ice',
        description: 'Minuman segar blue lemon yang menyegarkan dengan ice.',
        price: 3.00,
        image: '/uploads/blue-lemon.jpg',
        categoryId: drinksCat.id,
        ingredients: 'Blue Lemon Syrup, Lemon, Ice',
        freeItem: null,
        isFeatured: false,
        hasCustomization: false,
      },
      {
        name: 'Blackcurrent Ice',
        description: 'Minuman segar blackcurrent yang menyegarkan dengan ice.',
        price: 3.00,
        image: '/uploads/blackcurrent.jpg',
        categoryId: drinksCat.id,
        ingredients: 'Blackcurrent Syrup, Ice, Lemon',
        freeItem: null,
        isFeatured: false,
        hasCustomization: false,
      },
      {
        name: 'Ice Lemon Tea',
        description: 'Teh lemon sejuk yang menyegarkan.',
        price: 3.00,
        image: '/uploads/ice-lemon-tea.jpg',
        categoryId: drinksCat.id,
        ingredients: 'Tea, Lemon, Ice, Sugar',
        freeItem: null,
        isFeatured: false,
        hasCustomization: false,
      },
    ];

    for (const item of drinkItems) {
      await prisma.menuItem.create({ data: item });
      console.log('✅ Created: ' + item.name + ' - RM' + item.price);
    }

    // ALA CARTE (6 items)
    const alaCarteItems = [
      {
        name: 'Ayam Original',
        description: 'Ayam gepuk original dengan bumbu rempah khas Yogyakarta yang lembut dan gurih.',
        price: 8.00,
        image: '/uploads/ayam-original.jpg',
        categoryId: alaCarteCat.id,
        ingredients: 'Ayam, Bumbu Rempah Yogyakarta, Santan',
        freeItem: null,
        isFeatured: false,
        hasCustomization: false,
      },
      {
        name: 'Ayam Crispy',
        description: 'Ayam gepuk crispy dengan lapisan tepung yang renyah diluar, lembut didalam.',
        price: 8.00,
        image: '/uploads/ayam-crispy.jpg',
        categoryId: alaCarteCat.id,
        ingredients: 'Ayam, Bumbu Rempah Yogyakarta, Tepung Crispy',
        freeItem: null,
        isFeatured: false,
        hasCustomization: false,
      },
      {
        name: 'Sup Bebola',
        description: 'Sup bebola daging yang hangat dengan sayuran segar.',
        price: 5.90,
        image: '/uploads/sup-bebola.jpg',
        categoryId: alaCarteCat.id,
        ingredients: 'Bebola Daging, Kuah Sup, Sayur (Lobak, Carrot, Tomato)',
        freeItem: null,
        isFeatured: false,
        hasCustomization: false,
      },
      {
        name: 'Pedal/Hati (3pcs)',
        description: 'Pedal dan hati ayam goreng garing (3 keping).',
        price: 3.00,
        image: '/uploads/pedal-hati.jpg',
        categoryId: alaCarteCat.id,
        ingredients: 'Pedal Ayam, Hati Ayam, Tepung Goreng',
        freeItem: null,
        isFeatured: false,
        hasCustomization: false,
      },
      {
        name: 'Kobis Goreng',
        description: 'Kobis goreng yang segar dan sihat.',
        price: 3.00,
        image: '/uploads/kobis.jpg',
        categoryId: alaCarteCat.id,
        ingredients: 'Kobis, Bawang, Minyak Masak, Garam',
        freeItem: null,
        isFeatured: false,
        hasCustomization: false,
      },
      {
        name: 'Bergedil (4pcs)',
        description: 'Bergedil kentang goreng yang sedap dan mengenyangkan (4 biji).',
        price: 5.00,
        image: '/uploads/bergedil.jpg',
        categoryId: alaCarteCat.id,
        ingredients: 'Kentang, Bawang, Tepung, Rempah',
        freeItem: null,
        isFeatured: false,
        hasCustomization: false,
      },
    ];

    for (const item of alaCarteItems) {
      await prisma.menuItem.create({ data: item });
      console.log('✅ Created: ' + item.name + ' - RM' + item.price);
    }

    console.log('\n✨ All 17 menu items restored successfully!');
    console.log('\n📝 Summary:');
    console.log('   - 6 Set Menu items');
    console.log('   - 5 Drink items');
    console.log('   - 6 Ala Carte items');
    console.log('   - Total: 17 items');

  } catch (error) {
    console.error('❌ Error restoring menu:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

restoreAllMenu()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
