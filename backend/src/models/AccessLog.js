import mongoose from 'mongoose';

const accessLogSchema = new mongoose.Schema(
  {
    uid: {
      type: String,
      required: [true, 'UID is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: [true, 'Device ID is required'],
      trim: true,
      index: true,
    },
    result: {
      type: String,
      enum: {
        values: ['granted', 'denied'],
        message: "Result must be either 'granted' or 'denied'",
      },
      required: [true, 'Result is required'],
      index: true,
    },
    reason: {
      type: String,
      required: [true, 'Reason is required'],
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Compound indexes for sorting and filtering query performance
accessLogSchema.index({ timestamp: -1 });
accessLogSchema.index({ uid: 1, timestamp: -1 });
accessLogSchema.index({ result: 1, timestamp: -1 });

export const AccessLog = mongoose.model('AccessLog', accessLogSchema);
export default AccessLog;
