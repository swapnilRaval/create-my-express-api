'use strict';

/**
 * Every successful response in this API has the same three-key shape:
 *   { success: true, message: string, data: any }
 *
 * Failures are produced by the error middleware, not here, so there is exactly
 * one place that can emit a `success: false` body.
 */

function send(res, statusCode, message, data, extra = {}) {
  return res.status(statusCode).json({
    success: true,
    message,
    data: data === undefined ? null : data,
    ...extra,
  });
}

const ok = (res, message = 'OK', data) => send(res, 200, message, data);
const created = (res, message = 'Created', data) => send(res, 201, message, data);
const accepted = (res, message = 'Accepted', data) => send(res, 202, message, data);
const noContent = (res) => res.status(204).end();

/** For list endpoints: keeps pagination metadata out of `data`. */
const paginated = (res, message, items, { page, limit, total }) =>
  send(res, 200, message, items, {
    meta: {
      page,
      limit,
      total,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
    },
  });

module.exports = { send, ok, created, accepted, noContent, paginated };
