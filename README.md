# smoke-test

A Node.js + Express REST API with MongoDB, JWT authentication and a modular
service layer. Generated with [`create-my-express-api`](https://www.npmjs.com/package/create-my-express-api) v1.0.0.

## Features

- Express 5 with a clear separation between the app (`app.js`) and the server (`www`)
- MongoDB via Mongoose, with connection handling and graceful shutdown
- JWT authentication: register, login, current user, forgot/reset password
- Password hashing with bcryptjs, hashed on save and never returned by the API
- Request validation with Zod, including strict schemas that reject unknown keys
- Centralised error handling with one response shape for the whole API
- Winston application logs with Morgan HTTP logs piped through them
- Security defaults: helmet, CORS, rate limiting, body size caps
- Multer file uploads with MIME filtering and generated filenames
- Nodemailer email with EJS templates
- Server-rendered EJS pages for the index and HTML error page
- Jest + Supertest tests running against an in-memory MongoDB

## Tech stack

| Concern         | Choice                          |
| --------------- | ------------------------------- |
| Runtime         | Node.js 18.17+                  |
| Framework       | Express 5                       |
| Database        | MongoDB + Mongoose 9            |
| Auth            | jsonwebtoken + bcryptjs         |
| Validation      | Zod 4                           |
| Logging         | Winston + Morgan                |
| Views / email   | EJS + Nodemailer                |
| Uploads         | Multer 2                        |
| Tests           | Jest + Supertest + mongodb-memory-server |
| Module system   | CommonJS                        |

### Why CommonJS

`require` is synchronous and conditional, which this codebase relies on, and
`__dirname` is available without a `import.meta.url` dance. Every dependency
here ships CommonJS entry points, Jest needs no experimental VM flags, and
`nodemon`/stack traces behave predictably. If you want ESM later, convert in one
pass and set `"type": "module"` - mixing the two is where the pain lives.

## Folder structure

```
smoke-test/
├── app.js                    Express app: middleware, routes, error handling
├── www                       Server entry: config, DB connect, listen, shutdown
├── nodemon.json              Dev watcher configuration
├── jest.config.js            Test runner configuration
├── .env / .env.example       Environment configuration
│
├── config/
│   ├── env.js                Reads and validates process.env (Zod)
│   ├── db.js                 Mongoose connection + disconnection
│   └── mail.js               Nodemailer transport (lazy, cached)
│
├── controllers/              HTTP layer - no business logic
├── services/                 Business logic - no Express types
├── models/                   Mongoose schemas
├── routes/                   Route table
├── middlewares/              auth, validation, uploads, errors, 404, rate limit
├── helpers/                  response, jwt, password, email helpers
├── utils/                    logger, ApiError, asyncHandler
├── validators/               Zod schemas
├── views/                    EJS: index, errors, email templates
├── public/                   Static assets
├── uploads/                  Uploaded files (git-ignored)
└── tests/                    Jest + Supertest suites
```

The controller/service split is the load-bearing part: controllers translate
HTTP to arguments and back, services hold rules and know nothing about Express.
That is what lets you call `authService.register()` from a seed script or a
queue worker without faking a request object.

## Installation

```bash
npm install
```

## Environment setup

```bash
# macOS / Linux
cp .env.example .env

# Windows (CMD)
copy .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

The generator already wrote a `.env` with a random `JWT_SECRET`. Set `MONGO_URI`
before starting. Generate a new secret at any time with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Configuration is read once in `config/env.js` and validated. A missing or
malformed variable stops the process at boot with a readable message instead of
failing mysteriously later.

## MongoDB setup

Local:

```bash
# Docker is the least painful option on every platform
docker run -d --name mongo -p 27017:27017 mongo:7

# then in .env
MONGO_URI=mongodb://127.0.0.1:27017/smoke-test
```

Atlas: create a cluster, add your IP to the access list, create a database user,
and paste the SRV string:

```
MONGO_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/smoke-test?retryWrites=true&w=majority
```

URL-encode any special characters in the password (`@` becomes `%40`).

## Running

```bash
npm run dev     # nodemon, restarts on change
npm start       # node ./www
```

Then:

```bash
curl http://localhost:3000/health
```

In production, run `www` under a supervisor (systemd, PM2, or your container
platform) and set `NODE_ENV=production`. That switches logs to JSON, enables
file transports under `logs/`, and stops stack traces appearing in responses.

## API endpoints

All responses share one shape.

Success:

```json
{ "success": true, "message": "User logged in successfully", "data": { } }
```

Failure:

```json
{ "success": false, "message": "Invalid email or password", "errors": [] }
```

| Method | Path                          | Auth      | Description                       |
| ------ | ----------------------------- | --------- | --------------------------------- |
| GET    | `/health`                     | -         | Liveness + database state         |
| GET    | `/`                           | -         | Rendered index page               |
| POST   | `/api/auth/register`          | -         | Create an account                 |
| POST   | `/api/auth/login`             | -         | Exchange credentials for a token  |
| POST   | `/api/auth/forgot-password`   | -         | Request a reset token             |
| POST   | `/api/auth/reset-password`    | -         | Consume a reset token             |
| GET    | `/api/auth/me`                | Bearer    | Current user                      |
| GET    | `/api/users/profile`          | Bearer    | Read your profile                 |
| PUT    | `/api/users/profile`          | Bearer    | Update your profile               |
| PATCH  | `/api/users/profile/password` | Bearer    | Change password                   |
| POST   | `/api/users/profile-image`    | Bearer    | Upload an avatar                  |
| GET    | `/api/users`                  | Admin     | Paginated user list               |
| GET    | `/api/users/:id`              | Admin     | Fetch one user                    |

## Authentication flow

1. `POST /api/auth/register` or `/login` returns `data.token`.
2. Send it on every protected request:

   ```
   Authorization: Bearer <token>
   ```

3. `middlewares/auth.middleware.js` verifies the signature, then re-loads the
   user from MongoDB. The token is only a claim - a user deleted or deactivated
   after the token was issued is rejected immediately.
4. `401` means the caller is unauthenticated; `403` means authenticated but not
   permitted. Do not conflate them - clients use the difference to decide
   whether refreshing is worth trying.

The payload contains the user id and role only. A JWT is signed, not encrypted:
anything you put in it is readable by whoever holds it.

Worked example:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"firstName":"Ada","lastName":"Lovelace","email":"ada@example.com","password":"Password123"}' \
  | node -pe "JSON.parse(require('fs').readFileSync(0)).data.token")

curl http://localhost:3000/api/auth/me -H "Authorization: Bearer $TOKEN"
```

To create your first admin, register normally and then promote in the shell:

```bash
node -e "require('dotenv').config();const m=require('mongoose');m.connect(process.env.MONGO_URI).then(async()=>{await m.connection.collection('users').updateOne({email:'ada@example.com'},{\$set:{role:'admin'}});await m.disconnect();console.log('promoted')})"
```

## File uploads

```bash
curl -X POST http://localhost:3000/api/users/profile-image \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@./avatar.png"
```

The original filename is never used on disk. Files are stored as
`<timestamp>-<uuid><ext>` under `uploads/avatars/`, where the extension comes
from a MIME whitelist rather than from the upload. MIME type is a
client-supplied header, so treat the filter as a convenience, not a security
boundary - for genuinely untrusted uploads, verify magic bytes and re-encode
images before serving them.

Add another uploader with `createUploader()` in
`middlewares/upload.middleware.js`; it takes a subfolder, an allowed-type map,
a size cap and a file count.

## Email configuration

Set the `MAIL_*` variables in `.env`. Leaving `MAIL_HOST` empty puts Nodemailer
into `jsonTransport`, which serialises the message instead of sending it - so
development and CI work with no SMTP server and nothing fails silently.

```js
const { sendEmail } = require('./helpers/email.helper');

await sendEmail({
  to: 'user@example.com',
  subject: 'Invoice ready',
  template: 'welcome',              // views/emails/welcome.ejs
  data: { firstName: 'Ada', loginUrl: 'https://example.com/login' },
});
```

Template variables are the keys of `data`, plus `appName` and `appUrl` which
are injected for every template. Add a new template by dropping
`views/emails/<name>.ejs` in place and passing `template: '<name>'`.

For local SMTP, Mailpit or Mailtrap both work:

```
MAIL_HOST=localhost
MAIL_PORT=1025
MAIL_SECURE=false
```

## EJS usage

`app.js` sets the view engine and the views directory:

```js
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
```

`GET /` renders `views/index.ejs` through `controllers/home.controller.js`.
HTML error pages render `views/errors/error.ejs`, but only for non-`/api`
routes where the client actually prefers HTML - API clients always get JSON.

## Error handling

Nothing formats an error except `middlewares/error.middleware.js`. Handlers
throw; the middleware translates. It understands `ApiError`, Mongoose
`CastError` and `ValidationError`, duplicate-key (`11000`), JWT errors, Multer
errors, and body-parser failures.

```js
const ApiError = require('./utils/apiError');

if (!invoice) throw ApiError.notFound('Invoice not found');
```

In development the response includes a stack. In production, any error not
marked `isOperational` is reduced to a plain 500 so internals never leak.

`utils/asyncHandler.js` wraps async handlers. Express 5 already forwards
rejected promises, so it is defensive rather than required - it is kept because
it makes intent explicit and keeps controllers portable to Express 4.

## Logging

Winston is the only log pipeline; Morgan writes HTTP lines into it at the
`http` level. Development gets colourised single lines, production gets JSON on
stdout plus rotating files under `logs/`.

A redaction pass strips anything keyed `password`, `token`, `authorization`,
`secret` and similar before formatting. Treat that as a safety net, not
permission to log request bodies.

```js
const logger = require('./utils/logger');
logger.info('Invoice issued', { invoiceId, amount });
```

## Testing

```bash
npm test
npm run test:watch
```

Tests run against `mongodb-memory-server`, so no external database is needed.
The first run downloads a mongod binary into `node_modules/.cache` - if your
network blocks that, point `MONGOMS_SYSTEM_BINARY` at an installed mongod.

Covered: health and 404 envelopes, security headers, registration, password
hashing, weak-password rejection, mass-assignment rejection, duplicate email,
login success and failure symmetry, `/me` with valid, missing, malformed and
tampered tokens, profile read/update, the "unrelated update must not re-hash the
password" invariant, and role-based 403s.

Add a test file as `tests/<name>.test.js` and reuse `tests/helpers.js` for
connect/clear/disconnect.

## Deployment notes

- Set `NODE_ENV=production`, a real `JWT_SECRET`, and an explicit `CORS_ORIGIN`.
- Keep `app.set('trust proxy', 1)` in step with how many proxies sit in front;
  set it wrong and rate limiting either buckets everyone together or trusts a
  client-supplied header.
- The default rate-limit store is in-memory, so counters are per process. Behind
  more than one instance, move to the Redis store.
- Local disk uploads do not survive a container restart and are not shared
  between instances. Move to S3 or equivalent before scaling out.
- Run behind a process supervisor; `www` exits non-zero on fatal errors so the
  supervisor can restart it.
- Health probe: `GET /health`.

## How to extend

Adding a resource takes five files and follows the existing grain:

1. `models/thing.model.js` - the Mongoose schema
2. `validators/thing.validator.js` - Zod schemas
3. `services/thing.service.js` - the rules, no Express
4. `controllers/thing.controller.js` - `asyncHandler` + response helpers
5. `routes/thing.routes.js` - then mount it in `routes/index.js`

Conventions worth keeping: throw `ApiError`, never format an error response in
a controller; keep `req`/`res` out of services; use an allow-list for anything
that writes to a model; and never use `findByIdAndUpdate` for passwords, since
it bypasses the pre-save hashing hook.
