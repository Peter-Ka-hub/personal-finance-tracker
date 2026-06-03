const { z } = require('zod');

const transactionSchema = z.object({
  type: z.enum(['income', 'expense'], {
    message: "Typ musi być 'income' lub 'expense'",
  }),
  amount: z.coerce.number().positive('Kwota musi być dodatnia'),
  categoryId: z.coerce.string().min(1, 'Kategoria jest wymagana'),
  description: z.string().trim().min(1, 'Opis jest wymagany').max(255),
  date: z.string().min(1, 'Data jest wymagana'),
});

module.exports = { transactionSchema };
