/**
 * Menu Customization Types
 * Defines the structure for menu item customizations
 */

export interface CustomizationOption {
  value: string;
  label: string;
  priceModifier: number;
}

export interface CustomizationGroup {
  label: string;
  required: boolean;
  options?: CustomizationOption[];
  freeOptions?: CustomizationOption[];
  upgradeOptions?: CustomizationOption[];
}

export interface MenuCustomizationOptions {
  ayamType?: CustomizationGroup;
  sambalLevel?: CustomizationGroup;
  drink?: CustomizationGroup;
}

export interface SelectedCustomization {
  value: string;
  label: string;
  priceModifier: number;
}

export interface OrderItemCustomizations {
  ayamType?: SelectedCustomization;
  sambalLevel?: SelectedCustomization;
  drink?: SelectedCustomization;
}

export interface OrderItem {
  menuItemId: string;
  menuItemName: string;
  basePrice: number;
  quantity: number;
  customizations?: OrderItemCustomizations;
  totalPrice: number; // basePrice + sum of (priceModifier * quantity)
}

export interface CartItem extends OrderItem {
  // Frontend cart may have additional UI fields
  image?: string;
  category?: string;
}
