const { z } = require('zod');

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Nazwa użytkownika musi mieć co najmniej 3 znaki')
    .max(50, 'Nazwa użytkownika może mieć najwyżej 50 znaków'),
  password: z
    .string()
    .min(8, 'Hasło musi mieć co najmniej 8 znaków')
    .max(100, 'Hasło może mieć najwyżej 100 znaków'),
});

// Login only checks presence — we never reveal the password policy here and
// must accept any previously valid password.
const loginSchema = z.object({
  username: z.string().min(1, 'Nazwa użytkownika jest wymagana'),
  password: z.string().min(1, 'Hasło jest wymagane'),
});

module.exports = { registerSchema, loginSchema };
