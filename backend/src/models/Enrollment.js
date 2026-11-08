import mongoose from 'mongoose';

const enrollmentSchema = new mongoose.Schema(
  {
    enrollmentId: {
      type: String,
      required: [true, 'Enrollment ID is required'],
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
    status: {
      type: String,
      enum: {
        values: ['waiting', 'scanned', 'completed', 'cancelled', 'expired'],
        message: "Status must be 'waiting', 'scanned', 'completed', 'cancelled', or 'expired'",
      },
      default: 'waiting',
      index: true,
    },
    scannedUid: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
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
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Compound index for active device lookups
enrollmentSchema.index({ deviceId: 1, status: 1, expiresAt: 1 });

export const Enrollment = mongoose.model('Enrollment', enrollmentSchema);
export default Enrollment;
