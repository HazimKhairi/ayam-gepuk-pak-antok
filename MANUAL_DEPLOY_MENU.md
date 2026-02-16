# Manual Deployment: Menu Details Update

## Option 1: Automated Script (Recommended)
```bash
./deploy-menu-updates.sh
```

## Option 2: Manual Steps

### 1. Upload Script to VPS
```bash
scp backend/update-menu-details.ts root@72.62.243.23:/var/www/agpa/backend/
```

### 2. SSH into VPS
```bash
ssh root@72.62.243.23
```

### 3. Navigate to Backend Directory
```bash
cd /var/www/agpa/backend
```

### 4. Run Update Script
```bash
npx ts-node update-menu-details.ts
```

### Expected Output:
```
🔄 Updating menu items with detailed information...

✅ Updated: Set A (Crispy/Original)
✅ Updated: Set B (Crispy/Original)
✅ Updated: Set C (Crispy/Original)
✅ Updated: Set Lele Pak Antok
✅ Updated: Set Bihun Soto
✅ Updated: Set Coco Meal
✅ Updated: Strawberry Mojito
✅ Updated: Apple Mojito
✅ Updated: Blue Lemon Ice
✅ Updated: Blackcurrent Ice
✅ Updated: Ice Lemon Tea
✅ Updated: Ayam Original
✅ Updated: Ayam Crispy
✅ Updated: Sup Bebola
✅ Updated: Pedal/Hati (3pcs)
✅ Updated: Kobis Goreng
✅ Updated: Bergedil (4pcs)

✨ All menu items updated successfully!

📝 Summary:
   - 6 Set Menu items
   - 5 Drink items
   - 6 Ala Carte items
   - Total: 17 items updated
```

### 5. Clean Up (Optional)
```bash
rm update-menu-details.ts
```

### 6. Exit SSH
```bash
exit
```

## Verification

### Test Cart Dropdown:
1. Go to https://agpa.nextapmy.com/menu
2. Add "Set A (Crispy/Original)" to cart
3. Click cart icon
4. Should see:
   - ✅ Description: "Set lengkap dengan nasi putih..."
   - ✅ Termasuk: "Nasi Putih, Ayam Gepuk..."
   - ✅ 🎁 Free: "Blue Lemon / Blackcurrent..."

### Test Checkout Page:
1. Click "Proceed to Checkout"
2. Check Order Summary on the right
3. Should see same detailed information

## Troubleshooting

### If script fails to run:
1. Check if TypeScript is installed: `npm list typescript`
2. Install if needed: `npm install -D typescript ts-node`
3. Verify database connection in `.env` file

### If no details showing on frontend:
1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard refresh (Ctrl+F5)
3. Check browser console for errors

## Rollback (If Needed)
If you need to remove the details:
```bash
npx ts-node -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function rollback() {
  await prisma.menuItem.updateMany({
    data: {
      description: null,
      ingredients: null,
      freeItem: null,
    }
  });
  console.log('✅ Rolled back menu details');
  await prisma.\$disconnect();
}
rollback();
"
```
