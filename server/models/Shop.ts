import mongoose from 'mongoose';
const shopSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  name: { type: String, required: true, trim: true },
  city: { type: String, enum: ['Thodupuzha', 'Muttom'], required: true },
  address: { type: String, required: true },
  category: { type: String, required: true },
  approved: { type: Boolean, default: false },
}, { timestamps: true });
export default mongoose.model('Shop', shopSchema);
