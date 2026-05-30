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

export type ItemWithRelations = {
  id: string;
  name: string;
  quantity: number;
  minQuantity: number;
  locationName: string | null;
  categoryName: string | null;
  memo: string | null;
  updatedAt: string;
  alarmAt: string | null;
  barcode: string | null;
  imageUri: string | null;
};
