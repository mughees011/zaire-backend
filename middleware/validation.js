const { z } = require('zod');

// Schema for generic billing/checkout requests
const checkoutSchema = z.object({
  plan: z.string().min(1),
  priceId: z.string().min(1),
}).passthrough();

// Schema for basic chat sessions / messages
const sessionSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
}).passthrough();

// Middleware generator
function validateBody(schema) {
  return (req, res, next) => {
    try {
      if (req.body) {
        req.body = schema.parse(req.body);
      }
      next();
    } catch (err) {
      console.error('[VALIDATION ERROR]', err.errors);
      res.status(400).json({ success: false, error: 'Invalid request payload format', details: err.errors });
    }
  };
}

module.exports = {
  checkoutSchema,
  sessionSchema,
  validateBody
};
