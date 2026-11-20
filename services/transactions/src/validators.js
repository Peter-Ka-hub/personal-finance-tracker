const { z } = require('zod');

const amountSchema = z.union([z.number(), z.string().trim()])
  .refine((value) => /^-?\d+(?:\.\d{1,2})?$/.test(String(value)),
    'Kwota musi mieć najwyżej dwie cyfry po przecinku')
  .transform(Number)
  .pipe(z.number().positive('Kwota musi być dodatnia').max(99999999.99));
const idParamsSchema = z.object({ id: z.guid() });

const transactionSchema = z.object({
  type: z.enum(['income', 'expense'], {
    message: "Typ musi być 'income' lub 'expense'",
  }),
  amount: amountSchema,
  categoryId: z.guid(),
  description: z.string().trim().min(1, 'Opis jest wymagany').max(255),
  date: z.iso.date().refine((value) => !value.startsWith('0000-'), 'Data musi mieć rok od 0001'),
});

module.exports = { transactionSchema, idParamsSchema };
