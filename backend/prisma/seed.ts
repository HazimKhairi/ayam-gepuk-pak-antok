import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Safety check: prevent running seed in production
  if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: Cannot run seed in production! This will DELETE all data.');
    process.exit(1);
  }

  console.log('Starting seed...');

  // Clear existing data
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.timeSlot.deleteMany();
  await prisma.table.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.outlet.deleteMany();
  await prisma.review.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.setting.deleteMany();

  // Customization options for sets with ayam + sambal + drink
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
      label: 'Pilih Level Sambal',
      required: true,
      options: [
        { value: '1', label: 'Level 1', priceModifier: 0 },
        { value: '2', label: 'Level 2', priceModifier: 0 },
        { value: '3', label: 'Level 3', priceModifier: 0 },
      ],
    },
    drink: {
      label: 'Pilih Minuman',
      required: true,
      freeOptions: [
        { value: 'blue-lemon', label: 'Blue Lemon Ice', priceModifier: 0 },
        { value: 'blackcurrent', label: 'Blackcurrent Ice', priceModifier: 0 },
        { value: 'ice-lemon-tea', label: 'Ice Lemon Tea', priceModifier: 0 },
      ],
      upgradeOptions: [
        { value: 'mojito-apple', label: 'Mojito Apple', priceModifier: 5 },
        { value: 'mojito-strawberry', label: 'Strawberry Mojito', priceModifier: 5 },
      ],
    },
  };

  // Customization options for Set Bihun Soto (drink only)
  const drinkOnlyCustomization = {
    drink: {
      label: 'Pilih Minuman',
      required: true,
      freeOptions: [
        { value: 'blue-lemon', label: 'Blue Lemon Ice', priceModifier: 0 },
        { value: 'blackcurrent', label: 'Blackcurrent Ice', priceModifier: 0 },
        { value: 'ice-lemon-tea', label: 'Ice Lemon Tea', priceModifier: 0 },
      ],
      upgradeOptions: [
        { value: 'mojito-apple', label: 'Mojito Apple', priceModifier: 5 },
        { value: 'mojito-strawberry', label: 'Strawberry Mojito', priceModifier: 5 },
      ],
    },
  };

  // Create Menu Items - Updated from Senarai Menu AGPA.pdf
  const menuItems = await Promise.all([
    // SET MENU
    prisma.menuItem.create({
      data: {
        name: 'Set A (Crispy/Original)',
        description: 'Nasi, Ayam (Crispy/Original), Sambal Level 1-3, Timun, Kobis & Salad',
        price: 12.90,
        image: '/uploads/set-a.png',
        category: 'Set Menu',
        ingredients: 'Nasi Putih, Ayam (Crispy/Original), Sambal Gepuk Level 1-3, Timun, Kobis & Salad Segar',
        freeItem: 'Percuma: Blue Lemon, Blackcurrent, Ice Lemon Tea (Mojito Apple/Strawberry +RM5)',
        isFeatured: true,
        rating: 4.8,
        reviewCount: 342,
        hasCustomization: true,
        customizationOptions: fullCustomizationOptions,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: 'Set B (Crispy/Original)',
        description: 'Nasi, Ayam (Crispy/Original), Sambal Level 1-3, Timun, Tempe & Tauhu, Kobis & Salad',
        price: 13.90,
        image: '/uploads/set-b.png',
        category: 'Set Menu',
        ingredients: 'Nasi Putih, Ayam (Crispy/Original), Sambal Gepuk Level 1-3, Timun, Tempe Goreng, Tauhu Goreng, Kobis & Salad',
        freeItem: 'Percuma: Blue Lemon, Blackcurrent, Ice Lemon Tea (Mojito Apple/Strawberry +RM5)',
        isFeatured: true,
        rating: 4.9,
        reviewCount: 215,
        hasCustomization: true,
        customizationOptions: fullCustomizationOptions,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: 'Set C (Crispy/Original)',
        description: 'Nasi, Ayam (Crispy/Original), Sambal Level 1-3, Lauk Premium',
        price: 14.90,
        image: '/uploads/set-c.png',
        category: 'Set Menu',
        ingredients: 'Nasi Putih, Ayam (Crispy/Original), Sambal Gepuk Level 1-3, Lauk-Lauk Premium',
        freeItem: 'Percuma: Blue Lemon, Blackcurrent, Ice Lemon Tea (Mojito Apple/Strawberry +RM5)',
        isFeatured: true,
        rating: 4.9,
        reviewCount: 180,
        hasCustomization: true,
        customizationOptions: fullCustomizationOptions,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: 'Set Lele Pak Antok',
        description: 'Ikan Lele Goreng Berempah dengan Sambal Level 1-3',
        price: 13.90,
        image: '/uploads/set-lele.png',
        category: 'Set Menu',
        ingredients: 'Nasi Putih, Ikan Lele Goreng Berempah, Sambal Gepuk Level 1-3, Timun, Kobis & Salad',
        freeItem: 'Percuma: Blue Lemon, Blackcurrent, Ice Lemon Tea (Mojito Apple/Strawberry +RM5)',
        isFeatured: false,
        rating: 4.7,
        reviewCount: 95,
        hasCustomization: true,
        customizationOptions: fullCustomizationOptions,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: 'Set Bihun Soto',
        description: 'Bihun Soto dengan kuah berempah yang sedap dan menyelerakan',
        price: 10.00,
        image: '/uploads/bihun-soto.png',
        category: 'Set Menu',
        ingredients: 'Bihun, Kuah Soto Berempah, Ayam, Sayur-Sayuran',
        freeItem: 'Percuma: Blue Lemon, Blackcurrent, Ice Lemon Tea (Mojito Apple/Strawberry +RM5)',
        isFeatured: false,
        rating: 4.6,
        reviewCount: 120,
        hasCustomization: true,
        customizationOptions: drinkOnlyCustomization,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: 'Set Coco Meal',
        description: 'Kombo Set dengan Minuman Coklat Premium',
        price: 10.90,
        image: '/uploads/coco-meal.png',
        category: 'Set Menu',
        ingredients: 'Nasi, Ayam, Sambal, Coklat Premium Special',
        freeItem: 'None',
        isFeatured: true,
        rating: 5.0,
        reviewCount: 85,
        hasCustomization: false,
        customizationOptions: null,
      },
    }),
    // ALA CARTE - DRINKS
    prisma.menuItem.create({
      data: {
        name: 'Strawberry Mojito',
        description: 'Minuman segar dengan perisa strawberry yang menyegarkan',
        price: 7.90,
        image: '/uploads/strawberry-mojito.png',
        category: 'Drinks',
        ingredients: 'Strawberry Fresh, Mint Leaves, Soda',
        freeItem: 'None',
        isFeatured: false,
        rating: 4.8,
        reviewCount: 65,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: 'Apple Mojito',
        description: 'Minuman segar dengan perisa apple yang menyegarkan',
        price: 7.90,
        image: '/uploads/apple-mojito.png',
        category: 'Drinks',
        ingredients: 'Apple Fresh, Mint Leaves, Soda',
        freeItem: 'None',
        isFeatured: false,
        rating: 4.8,
        reviewCount: 58,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: 'Blue Lemon Ice',
        description: 'Minuman limau biru yang segar dan menyejukkan',
        price: 3.00,
        image: '/uploads/blue-lemon.png',
        category: 'Drinks',
        ingredients: 'Lemon, Blue Syrup, Ice',
        freeItem: 'None',
        isFeatured: false,
        rating: 4.5,
        reviewCount: 142,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: 'Blackcurrent Ice',
        description: 'Minuman blackcurrent yang segar dan menyejukkan',
        price: 3.00,
        image: '/uploads/blackcurrent.png',
        category: 'Drinks',
        ingredients: 'Blackcurrent Syrup, Ice',
        freeItem: 'None',
        isFeatured: false,
        rating: 4.5,
        reviewCount: 138,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: 'Ice Lemon Tea',
        description: 'Teh limau ais yang klasik dan menyegarkan',
        price: 3.00,
        image: '/uploads/ice-lemon-tea.png',
        category: 'Drinks',
        ingredients: 'Tea, Lemon, Ice',
        freeItem: 'None',
        isFeatured: false,
        rating: 4.6,
        reviewCount: 165,
      },
    }),
    // ALA CARTE - FOOD
    prisma.menuItem.create({
      data: {
        name: 'Ayam Original',
        description: 'Ayam Original sahaja (tanpa nasi)',
        price: 8.00,
        image: '/uploads/ayam-original.png',
        category: 'Ala Carte',
        ingredients: 'Ayam Original Berempah',
        freeItem: 'None',
        isFeatured: false,
        rating: 4.7,
        reviewCount: 95,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: 'Ayam Crispy',
        description: 'Ayam Crispy sahaja (tanpa nasi)',
        price: 8.00,
        image: '/uploads/ayam-crispy.png',
        category: 'Ala Carte',
        ingredients: 'Ayam Crispy Berempah',
        freeItem: 'None',
        isFeatured: false,
        rating: 4.7,
        reviewCount: 88,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: 'Sup Bebola',
        description: 'Sup bebola panas yang sedap dan berkhasiat',
        price: 5.90,
        image: '/uploads/sup-bebola.png',
        category: 'Ala Carte',
        ingredients: 'Bebola Daging, Kuah Sup, Sayur-Sayuran',
        freeItem: 'None',
        isFeatured: false,
        rating: 4.5,
        reviewCount: 72,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: 'Pedal/Hati (3pcs)',
        description: 'Pedal atau Hati Ayam Goreng (3 keping)',
        price: 3.00,
        image: '/uploads/pedal-hati.png',
        category: 'Ala Carte',
        ingredients: 'Pedal/Hati Ayam Goreng Berempah',
        freeItem: 'None',
        isFeatured: false,
        rating: 4.4,
        reviewCount: 45,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: 'Kobis Goreng',
        description: 'Kobis goreng yang sedap dan rangup',
        price: 3.00,
        image: '/uploads/kobis-goreng.png',
        category: 'Ala Carte',
        ingredients: 'Kobis Segar Digoreng',
        freeItem: 'None',
        isFeatured: false,
        rating: 4.3,
        reviewCount: 52,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: 'Bergedil (4pcs)',
        description: 'Bergedil kentang yang lembut dan sedap (4 biji)',
        price: 5.00,
        image: '/uploads/bergedil.png',
        category: 'Ala Carte',
        ingredients: 'Kentang, Bawang, Rempah Ratus',
        freeItem: 'None',
        isFeatured: false,
        rating: 4.6,
        reviewCount: 68,
      },
    }),
  ]);

  console.log(\`✅ Created \${menuItems.length} menu items\`);

  // Create 6 outlets with updated information from Client_New_Information.md
  const outlets = await Promise.all([
    prisma.outlet.create({
      data: {
        name: 'Ayam Gepuk Pak Antok - Masjid Tanah',
        address: 'MT 1395, PUSAT PERDAGANGAN FASA 2, 78300 Masjid Tanah, Malacca',
        phone: '016-736 5242',
        googleMapsUrl: 'https://www.google.com/maps/dir//RESTORAN+AYAM+GEPUK+PAK+ANTOK+MASJID+TANAH,+MT+1395,+PUSAT+PERDAGANGAN+FASA+2,+78300+Masjid+Tanah,+Malacca/@6.0438708,102.2891321,3645m/data=!3m1!1e3!4m8!4m7!1m0!1m5!1m1!1s0x31d1ff006cb4e1e3:0xe4f1d0450d42b175!2m2!1d102.111713!2d2.3509041?hl=en-MY&entry=ttu&g_ep=EgoyMDI2MDIwOC4wIKXMDSoASAFQAw%3D%3D',
        openTime: '10:00',
        closeTime: '17:00',
        deliveryFee: 6.00,
        maxCapacity: 128,
        deliveryEnabled: false,
      },
    }),
    prisma.outlet.create({
      data: {
        name: 'Ayam Gepuk Pak Antok - Bukit Beruang',
        address: '23A & 23A-1, Jalan Bukit Beruang Utama 2, Taman Bukit Beruang Utama, 75450 Ayer Keroh, Malacca',
        phone: '011-5933 0949',
        googleMapsUrl: 'https://www.google.com/maps?sca_esv=52c5a2861f1d2a5f&hl=en-MY&sxsrf=ANbL-n467DL-2b1g7yjCxwCfersPaOXeGQ:1770787335462&gs_lp=Egxnd3Mtd2l6LXNlcnAiFnBhayBhbnRvayBidWtpdCBiZXJ1YW4qAggAMgUQABiABDIGEAAYFhgeMgYQABgWGB4yBhAAGBYYHjIGEAAYFhgeMggQABiABBiiBDIFEAAY7wUyCBAAGIAEGKIEMgUQABjvBTIIEAAYgAQYogRI7yVQlxBYgxtwAngAkAEAmAGVAqAByQ2qAQU0LjguMbgBA8gBAPgBAZgCDqAC6QzCAgoQABiwAxjWBBhHwgILEAAYgAQYhgMYigWYAwCIBgGQBgiSBwU0LjkuMaAHlVayBwUyLjkuMbgH3wzCBwYwLjEyLjLIByWACAA&um=1&ie=UTF-8&fb=1&gl=my&sa=X&geocode=KWX7c1Iw5dExMToJd3MSYI0F&daddr=Restoran+Ayam+Gepuk+Pak+Antok+(Cawangan+Bukit+Beruang,+23A+%26+23A-1,+Jalan+Bukit+Beruang+Utama+2,+Taman+Bukit+Beruang+Utama,+75450+Ayer+Keroh,+Malacca',
        openTime: '10:00',
        closeTime: '17:00',
        deliveryFee: 5.00,
        maxCapacity: 91,
        deliveryEnabled: false,
      },
    }),
    prisma.outlet.create({
      data: {
        name: 'Ayam Gepuk Pak Antok - Larkin',
        address: 'LOT 14 & 14-01, 2/2, Jalan Garuda, Larkin Jaya, 80530 Johor Bahru, Johor Darul Ta\'zim',
        phone: '010-658 5242',
        googleMapsUrl: 'https://www.google.com/maps?sca_esv=52c5a2861f1d2a5f&hl=en-MY&sxsrf=ANbL-n6Vt__eUBDozCIoipSKLQrwQ_gLrA:1770787452596&uact=5&gs_lp=Egxnd3Mtd2l6LXNlcnAiEHBhayBhbnRvayBsYXJraW4yBRAAGIAEMgYQABgWGB4yBhAAGBYYHjIGEAAYFhgeMgYQABgWGB4yCxAAGIAEGIYDGIoFMgsQABiABBiGAxiKBTILEAAYgAQYhgMYigUyCBAAGIAEGKIEMggQABiABBiiBEjuGVCXBli8F3ACeACQAQCYAZQBoAHsCqoBBDEwLjS4AQPIAQD4AQGYAg-gAt4KwgIKEAAYsAMY1gQYR8ICChAjGIAEGCcYigXCAgUQABjvBcICCxAuGIAEGMcBGK8BwgIHEAAYgAQYCpgDAIgGAZAGCJIHAzkuNqAH9WmyBwM3Lja4B9cKwgcGMC4xMi4zyAcjgAgA&um=1&ie=UTF-8&fb=1&gl=my&sa=X&geocode=KVOW3cqBbdoxMRntV23kJT_E&daddr=LOT+14+%26+14-01,+2/2,+Jalan+Garuda,+Larkin+Jaya,+80530+Johor+Bahru,+Johor+Darul+Ta%27zim',
        openTime: '10:00',
        closeTime: '17:00',
        deliveryFee: 7.00,
        maxCapacity: 112,
        deliveryEnabled: false,
      },
    }),
    prisma.outlet.create({
      data: {
        name: 'Ayam Gepuk Pak Antok - Lagenda',
        address: '3, Jln Lagenda 9, 75300 Melaka',
        phone: '011-1675 5242',
        googleMapsUrl: 'https://www.google.com/maps/dir//RESTORAN+AYAM+GEPUK+PAK+ANTOK,+3,+Jln+Lagenda+9,+75300+Malacca/@6.0438708,102.2891321,3645m/data=!3m1!1e3!4m8!4m7!1m0!1m5!1m1!1s0x31d1f10022c31b37:0xaa9591e8be5e4ae9!2m2!1d102.2444288!2d2.2185651?hl=en-MY&entry=ttu&g_ep=EgoyMDI2MDIwOC4wIKXMDSoASAFQAw%3D%3D',
        openTime: '10:00',
        closeTime: '17:00',
        deliveryFee: 5.00,
        maxCapacity: 116,
        deliveryEnabled: false,
      },
    }),
    prisma.outlet.create({
      data: {
        name: 'Ayam Gepuk Pak Antok - Merlimau',
        address: 'JC 159, BANDAR BARU MERLIMAU UTARA, 77300 Merlimau, Melaka',
        phone: '017-570 7407',
        googleMapsUrl: 'https://www.google.com/maps?sca_esv=52c5a2861f1d2a5f&hl=en-MY&sxsrf=ANbL-n78oMphrTv6tm45ySpNava09xk5mg:1770787490722&uact=5&gs_lp=Egxnd3Mtd2l6LXNlcnAiEnBhayBhbnRvayBtZXJsaW1hdTIFEAAYgAQyChAAGIAEGAoYywEyBhAAGBYYHjIGEAAYFhgeMgsQABiABBiGAxiKBTILEAAYgAQYhgMYigUyCxAAGIAEGIYDGIoFMgsQABiABBiGAxiKBTIIEAAYgAQYogQyBRAAGO8FSL0ZULoGWLkXcAJ4AJABAJgBcaABoAaqAQM4LjG4AQPIAQD4AQGYAgqgAqsGwgIKEAAYsAMY1gQYR8ICChAjGIAEGCcYigXCAhAQLhiABBhDGMcBGIoFGK8BwgILEC4YgAQYxwEYrwHCAhoQLhiABBjHARivARiXBRjcBBjeBBjgBNgBAcICCBAAGKIEGIkFmAMAiAYBkAYIugYGCAEQARgUkgcDOC4yoAfdQLIHAzYuMrgHpgbCBwkwLjcuMi4wLjHIBz-ACAA&um=1&ie=UTF-8&fb=1&gl=my&sa=X&geocode=KZ9l9QN469ExMQfAGtMJ_rSm&daddr=JC+159,+BANDAR+BARU+MERLIMAU+UTARA,+77300+Merlimau,+Melaka',
        openTime: '10:00',
        closeTime: '17:00',
        deliveryFee: 6.00,
        maxCapacity: 100,
        deliveryEnabled: false,
      },
    }),
    prisma.outlet.create({
      data: {
        name: 'Ayam Gepuk Pak Antok - Jasin',
        address: 'JC 1886, 1886-1, JALAN BESTARI 5 BANDAR JASIN, BESTARI SEKSYEN 2, 77200 Bemban, Melaka',
        phone: '017-639 9317',
        googleMapsUrl: 'https://www.google.com/maps?s=web&hl=en-MY&sca_esv=52c5a2861f1d2a5f&lqi=Cg9wYWsgYW50b2sgamFzaW5aESIPcGFrIGFudG9rIGphc2lukgEKcmVzdGF1cmFudA&phdesc=m5BaeqwkkxY&vet=12ahUKEwiA-sjm2dCSAxVO6jgGHedTAaEQ1YkKegQIIxAB..i&cs=1&um=1&ie=UTF-8&fb=1&gl=my&sa=X&geocode=KXegbs3959ExMaoFgDA2KGDe&daddr=JC+1886,+1886-1,+JALAN+BESTARI+5+BANDAR+JASIN,+BESTARI+SEKSYEN+2,+77200+Bemban,+Melaka',
        openTime: '10:00',
        closeTime: '17:00',
        deliveryFee: 6.00,
        maxCapacity: 100,
        deliveryEnabled: false,
      },
    }),
  ]);

  console.log(\`✅ Created \${outlets.length} outlets\`);

  // Create tables for each outlet (12 tables per outlet for internal admin use)
  const tableConfigs = [
    { tableNo: '1A', capacity: 4, zone: 'Regular' },
    { tableNo: '1B', capacity: 4, zone: 'Regular' },
    { tableNo: '1C', capacity: 4, zone: 'Regular' },
    { tableNo: '1D', capacity: 4, zone: 'Regular' },
    { tableNo: '2A', capacity: 6, zone: 'Regular' },
    { tableNo: '2B', capacity: 6, zone: 'Regular' },
    { tableNo: '2C', capacity: 6, zone: 'Regular' },
    { tableNo: '2D', capacity: 6, zone: 'Regular' },
    { tableNo: '1E', capacity: 4, zone: 'VIP' },
    { tableNo: '1F', capacity: 4, zone: 'VIP' },
    { tableNo: '1G', capacity: 4, zone: 'Smoking Room' },
    { tableNo: '1H', capacity: 4, zone: 'Outdoor' },
  ];

  for (const outlet of outlets) {
    for (const config of tableConfigs) {
      await prisma.table.create({
        data: {
          outletId: outlet.id,
          ...config,
        },
      });
    }
  }

  console.log(\`✅ Created \${tableConfigs.length * outlets.length} tables\`);

  // Create time slots for each outlet (Takeaway hours: 14:00-23:00 initially, can extend to 00:00)
  // Booking window for dine-in: 10:00-17:00 (handled by outlet openTime/closeTime)
  const timeSlots = [
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
    '20:00', '20:30', '21:00', '21:30', '22:00', '22:30',
    '23:00',
  ];

  for (const outlet of outlets) {
    for (const time of timeSlots) {
      await prisma.timeSlot.create({
        data: {
          outletId: outlet.id,
          time,
          maxOrders: 10,
        },
      });
    }
  }

  console.log(\`✅ Created \${timeSlots.length * outlets.length} time slots\`);

  // Create master admin with properly hashed password
  const hashedAdminPassword = await bcrypt.hash('Admin@123', 12);
  await prisma.admin.create({
    data: {
      email: 'admin@ayamgepuk.com',
      password: hashedAdminPassword,
      name: 'Master Admin',
      role: 'MASTER',
    },
  });

  console.log('✅ Created master admin');

  // Create settings (including SST 6% and social media links)
  await prisma.setting.createMany({
    data: [
      { key: 'sst_rate', value: '6' },
      { key: 'booking_window_days', value: '0' }, // Same-day only
      { key: 'reminder_minutes_before', value: '60' },
      { key: 'table_lock_minutes', value: '10' },
      { key: 'instagram_url', value: 'https://www.instagram.com/ayamgepukpakantok.hq/?hl=en' },
      { key: 'tiktok_url', value: 'https://www.tiktok.com/@ayamgepukpakantok' },
    ],
  });

  console.log('✅ Created system settings (including social media links)');

  // Create Reviews
  await prisma.review.createMany({
    data: [
      {
        name: 'Nizam Rahman',
        role: 'Influencer',
        content: 'Tak payah cakap banyak, kalau sampai keluar ayat "aku mampu cakap sedap", you tau lah level dia. Sekali cuba, susah nak move on!',
        image: 'NR',
        rating: 5,
        isFeatured: true,
      },
      {
        name: 'Amira Othman',
        role: 'Artist',
        content: 'Bukan biasa-biasa! Pedasnya bikin nagih!! Suapan kedua makan nasi je pun dah sedap. Korang kena try!',
        image: 'AO',
        rating: 5,
        isFeatured: true,
      },
      {
        name: 'Ari Lesmana',
        role: 'Musician',
        content: 'Suasana penuh rasa & irama. Good vibes, great music & even better food! Memang terbaik.',
        image: 'AL',
        rating: 5,
        isFeatured: true,
      },
    ],
  });

  console.log('✅ Created celebrity reviews');
  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
