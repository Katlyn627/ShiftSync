import mongoose from 'mongoose';

const schemaOptions = {
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
    }
  }
};

const shiftSwapSchema = new mongoose.Schema({
  shift_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift', required: true },
  requester_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  target_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  reason: { type: String, default: null },
  status: { type: String, default: 'pending', enum: ['pending', 'approved', 'rejected'] },
  manager_notes: { type: String, default: null },
  created_at: { type: Date, default: Date.now },
}, schemaOptions);

export default mongoose.model('ShiftSwap', shiftSwapSchema);
