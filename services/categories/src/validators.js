const { z } = require('zod');

const categorySchema = z.object({
  name: z.string().trim().min(1, 'Nazwa kategorii jest wymagana').max(50),
  type: z.enum(['income', 'expense'], {
    message: "Typ musi być 'income' lub 'expense'",
  }),
  color: z.string().trim().max(20).optional(),
  icon: z.string().trim().max(40).optional(),
});

module.exports = { categorySchema };
