'use strict';

/**
 * Request validation with Zod.
 *
 * Why Zod over Joi / express-validator:
 *   - schemas are plain values you can import into services and tests, not a
 *     chain of middleware bolted onto a route
 *   - `.strict()` rejects unknown keys, which stops mass-assignment (a client
 *     POSTing `role: "admin"` to /register)
 *   - one dependency, no plugin ecosystem needed, and it moves to TypeScript
 *     without a rewrite
 *
 * Express 5 note: `req.query` is a getter with no setter, so the validated
 * query CANNOT be assigned back onto the request. Validated output therefore
 * lands on `req.validated`, and only `req.body` (which is still writable) is
 * replaced in place for convenience.
 */

const ApiError = require('../utils/apiError');

const SOURCES = ['body', 'params', 'query'];

function formatIssues(issues, source) {
  return issues.map((issue) => ({
    field: [source, ...issue.path].join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * @param {{body?: import('zod').ZodType, params?: import('zod').ZodType, query?: import('zod').ZodType}} schemas
 */
function validate(schemas) {
  return (req, _res, next) => {
    const errors = [];
    const validated = {};

    for (const source of SOURCES) {
      const schema = schemas[source];
      if (!schema) continue;

      const result = schema.safeParse(req[source]);
      if (result.success) validated[source] = result.data;
      else errors.push(...formatIssues(result.error.issues, source));
    }

    if (errors.length) {
      return next(ApiError.unprocessable('Validation failed', errors));
    }

    req.validated = validated;
    // body is a normal writable property; query and params are not in Express 5.
    if (validated.body !== undefined) req.body = validated.body;

    return next();
  };
}

module.exports = validate;
