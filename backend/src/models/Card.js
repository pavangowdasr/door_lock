import mongoose from 'mongoose';
import { normalizeUID } from '../utils/normalizeUID.js';

const cardSchema = new mongoose.Schema(
  {
    uid: {
      type: String,
      required: [true, 'RFID UID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
      set: (val) => {
        if (typeof val === 'string') {
          return normalizeUID(val);
        }
        return val;
      },
    },
    label: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'revoked'],
        message: "Status must be either 'active' or 'revoked'",
      },
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const Card = mongoose.model('Card', cardSchema);
export default Card;
