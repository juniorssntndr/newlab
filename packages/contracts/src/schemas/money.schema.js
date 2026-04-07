import { z } from 'zod';
import { currencyCodeSchema } from './enums.schema.js';

export const moneySchema = z.object({
  amount: z.number().finite(),
  currency: currencyCodeSchema
});
