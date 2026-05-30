export type ItemFormData = {
  name: string;
  quantity: number;
  minQuantity: number;
  memo: string;
  locationId: string | null;
  categoryId: string | null;
  alarmAt: Date | null;
  alarmMessage: string;
  barcode: string | null;
  imageUri: string | null;
};
