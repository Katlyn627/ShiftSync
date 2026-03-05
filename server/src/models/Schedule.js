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

const scheduleSchema = new mongoose.Schema({
  week_start: { type: String, required: true },
  labor_budget: { type: Number, default: 5000 },
  status: { type: String, default: 'draft', enum: ['draft', 'published'] },
  created_at: { type: Date, default: Date.now },
}, schemaOptions);

export default mongoose.model('Schedule', scheduleSchema);
