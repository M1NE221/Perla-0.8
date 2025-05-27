export interface SaleData {
  id: string;
  product: string;
  amount: number;
  price: number;
  totalPrice: number;
  client?: string;
  paymentMethod?: string;
  date: string; // ISO yyyy-MM-dd
  createdAt: any; // Firebase Timestamp
  updatedAt: any;
}
