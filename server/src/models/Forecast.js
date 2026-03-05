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

const forecastSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true },
  expected_revenue: { type: Number, required: true },
  expected_covers: { type: Number, default: 0 },
}, schemaOptions);

export default mongoose.model('Forecast', forecastSchema);
