// Generic request-body validator backed by a Zod schema. On failure responds
// with 400 and the list of field errors; on success replaces req.body with the
// parsed (and coerced) data so controllers receive clean input.
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      message: 'Nieprawidłowe dane wejściowe',
      errors: result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
  }
  req.body = result.data;
  next();
};

module.exports = validate;
