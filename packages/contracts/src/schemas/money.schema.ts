import { z } from 'zod';
import { currencyCodeSchema } from './enums.schema';

export const moneySchema = z.object({
  amount: z.number().finite(),
  currency: currencyCodeSchema
});
