'use strict';

/**
 * Multer upload middleware.
 *
 * The original filename is never used on disk. It is attacker-controlled and
 * can contain "../", null bytes, or a second extension ("avatar.png.php").
 * Files are stored under a random UUID plus an extension taken from a
 * whitelist, and the extension is chosen from the detected MIME type rather
 * than copied from the upload.
 *
 * MIME type is a header the client sets, so this is a convenience filter, not
 * a security boundary. If uploads are untrusted, verify magic bytes after the
 * write and re-encode images before serving them.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const multer = require('multer');
const env = require('../config/env');
const ApiError = require('../utils/apiError');

const UPLOAD_ROOT = env.UPLOAD_DIR; // already absolute, resolved in config/env.js

const IMAGE_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

const DOCUMENT_TYPES = new Map([
  ['application/pdf', '.pdf'],
  ['text/plain', '.txt'],
  ['text/csv', '.csv'],
]);

// Created once at startup; recursive:true is a no-op when it already exists
// and works identically on Windows and POSIX.
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

function buildStorage(subfolder) {
  return multer.diskStorage({
    destination(_req, _file, cb) {
      const dir = path.join(UPLOAD_ROOT, subfolder);
      fs.mkdir(dir, { recursive: true }, (err) => cb(err, dir));
    },
    filename(_req, file, cb) {
      const allowed = new Map([...IMAGE_TYPES, ...DOCUMENT_TYPES]);
      const extension = allowed.get(file.mimetype) || '.bin';
      cb(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
    },
  });
}

function buildFilter(allowedTypes) {
  return (_req, file, cb) => {
    if (allowedTypes.has(file.mimetype)) return cb(null, true);
    return cb(
      ApiError.badRequest(
        `Unsupported file type "${file.mimetype}". Allowed: ${[...allowedTypes.keys()].join(', ')}`,
      ),
    );
  };
}

/**
 * @param {object} [options]
 * @param {string} [options.subfolder='misc']  directory under UPLOAD_DIR
 * @param {Map}    [options.allowedTypes]      MIME type -> extension
 * @param {number} [options.maxSizeMb]         per-file cap
 * @param {number} [options.maxFiles]          cap for the .array() form
 */
function createUploader({
  subfolder = 'misc',
  allowedTypes = IMAGE_TYPES,
  maxSizeMb = env.MAX_UPLOAD_SIZE_MB,
  maxFiles = 5,
} = {}) {
  return multer({
    storage: buildStorage(subfolder),
    fileFilter: buildFilter(allowedTypes),
    limits: {
      fileSize: Math.round(maxSizeMb * 1024 * 1024),
      files: maxFiles,
      // Caps the number of non-file fields so a multipart body cannot be used
      // to exhaust memory with thousands of tiny text parts.
      fields: 20,
    },
  });
}

const profileImageUpload = createUploader({
  subfolder: 'avatars',
  allowedTypes: IMAGE_TYPES,
  maxSizeMb: Math.min(env.MAX_UPLOAD_SIZE_MB, 2),
  maxFiles: 1,
});

/** Turns an absolute stored path into the public URL served by app.js. */
function toPublicPath(absolutePath) {
  const relative = path.relative(UPLOAD_ROOT, absolutePath).split(path.sep).join('/');
  return `/uploads/${relative}`;
}

/** Best-effort delete, used when replacing an avatar. Never throws. */
async function removeUploadedFile(publicPath) {
  if (!publicPath || !publicPath.startsWith('/uploads/')) return;
  const target = path.join(UPLOAD_ROOT, publicPath.slice('/uploads/'.length));
  // Refuse to delete anything that resolved outside the upload root.
  if (!path.resolve(target).startsWith(UPLOAD_ROOT)) return;
  await fs.promises.rm(target, { force: true }).catch(() => {});
}

module.exports = {
  createUploader,
  profileImageUpload,
  toPublicPath,
  removeUploadedFile,
  IMAGE_TYPES,
  DOCUMENT_TYPES,
  UPLOAD_ROOT,
};
