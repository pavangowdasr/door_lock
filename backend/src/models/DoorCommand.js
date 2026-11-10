import mongoose from 'mongoose';

const doorCommandSchema = new mongoose.Schema(
  {
    commandId: {
      type: String,
      required: [true, 'Command ID is required'],
      unique: true,
      index: true,
      trim: true,
    },
    deviceId: {
      type: String,
      required: [true, 'Device ID is required'],
      index: true,
      trim: true,
    },
    type: {
      type: String,
      enum: {
        values: ['unlock', 'lock'],
        message: "Command type must be either 'unlock' or 'lock'",
      },
      required: [true, 'Command type is required'],
    },
    durationMs: {
      type: Number,
      default: 3000,
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'acknowledged', 'executed', 'failed', 'expired'],
        message: "Status must be 'pending', 'acknowledged', 'executed', 'failed', or 'expired'",
      },
      default: 'pending',
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    executedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Compound index for pending command polling
doorCommandSchema.index({ deviceId: 1, status: 1, expiresAt: 1 });

export const DoorCommand = mongoose.model('DoorCommand', doorCommandSchema);
export default DoorCommand;
