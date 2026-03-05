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

const shiftSchema = new mongoose.Schema({
  schedule_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Schedule', required: true },
  employee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  date: { type: String, required: true },
  start_time: { type: String, required: true },
  end_time: { type: String, required: true },
  role: { type: String, required: true },
  status: { type: String, default: 'scheduled', enum: ['scheduled', 'swapped', 'cancelled'] },
  created_at: { type: Date, default: Date.now },
}, schemaOptions);

export default mongoose.model('Shift', shiftSchema);
