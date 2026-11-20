// Validate and replace the selected request data with the parsed fields.
const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    return res.status(400).json({
      message: 'Nieprawidłowe dane wejściowe',
      errors: result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
  }
  req[source] = result.data;
  next();
};

module.exports = validate;
