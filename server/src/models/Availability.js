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

const availabilitySchema = new mongoose.Schema({
  employee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  day_of_week: { type: Number, required: true },
  start_time: { type: String, required: true },
  end_time: { type: String, required: true },
}, schemaOptions);

availabilitySchema.index({ employee_id: 1, day_of_week: 1 }, { unique: true });

export default mongoose.model('Availability', availabilitySchema);
