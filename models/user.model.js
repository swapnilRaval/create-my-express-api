'use strict';

/**
 * User model.
 *
 * Password handling rules enforced here:
 *   - `select: false` means the hash is never loaded unless a query explicitly
 *     asks for it, so it cannot leak through a stray res.json(user).
 *   - The pre-save hook hashes only when the password field actually changed,
 *     so updating a display name does not re-hash (and thereby invalidate) the
 *     stored digest.
 *   - toJSON deletes the hash and the reset-token fields as a second line of
 *     defence.
 */

const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { hashPassword, comparePassword, isHashed } = require('../helpers/password.helper');

const ROLES = ['user', 'admin'];

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: 60,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: 60,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      enum: ROLES,
      default: 'user',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    profileImage: {
      type: String,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    passwordResetToken: { type: String, default: null, select: false },
    passwordResetExpires: { type: Date, default: null, select: false },
  },
  {
    // Adds createdAt / updatedAt and keeps them maintained automatically.
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.password;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

userSchema.virtual('fullName').get(function fullName() {
  return `${this.firstName} ${this.lastName}`.trim();
});

userSchema.pre('save', async function hashIfChanged(next) {
  if (!this.isModified('password')) return next();
  // Defensive: never hash a value that is already a bcrypt digest.
  if (isHashed(this.password)) return next();
  try {
    this.password = await hashPassword(this.password);
    return next();
  } catch (err) {
    return next(err);
  }
});

userSchema.methods.comparePassword = function compare(candidate) {
  return comparePassword(candidate, this.password);
};

/**
 * Creates a single-use reset token. The raw token is returned to the caller
 * (it goes in the email link); only its SHA-256 digest is stored, so a leaked
 * database dump does not hand out working reset links.
 */
userSchema.methods.createPasswordResetToken = function createToken(ttlMinutes = 30) {
  const raw = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(raw).digest('hex');
  this.passwordResetExpires = new Date(Date.now() + ttlMinutes * 60 * 1000);
  return raw;
};

userSchema.statics.hashResetToken = function hashResetToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
};

userSchema.statics.ROLES = ROLES;

module.exports = mongoose.model('User', userSchema);
