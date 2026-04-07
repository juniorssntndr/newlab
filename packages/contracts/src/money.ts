import type { CurrencyCode } from './enums';

export interface MoneyDto {
  amount: number;
  currency: CurrencyCode;
}
