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

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password_hash: { type: String, default: null },
  google_id: { type: String, default: null, unique: true, sparse: true },
  employee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  is_manager: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
}, schemaOptions);

export default mongoose.model('User', userSchema);
