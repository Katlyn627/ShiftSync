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

const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, required: true },
  hourly_rate: { type: Number, default: 15.0 },
  weekly_hours_max: { type: Number, default: 40 },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  photo_url: { type: String, default: null },
  created_at: { type: Date, default: Date.now },
}, schemaOptions);

export default mongoose.model('Employee', employeeSchema);
