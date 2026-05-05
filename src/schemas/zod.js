const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  comparePrice: z.number().positive().optional(),
  stock: z.number().int().nonnegative(),
  category: z.string().optional(),
  hsnCode: z.string().optional(),
  imageUrl: z.string().optional().or(z.literal('')),
  images: z.array(z.string()).optional(),
  sizes: z.array(z.string()).optional(),
  sizeChartUrl: z.string().optional().or(z.literal('')),
}).refine(data => {
  if (data.comparePrice && data.comparePrice <= data.price) {
    return false;
  }
  return true;
}, {
  message: "Compare price must be greater than price",
  path: ["comparePrice"],
});

const orderSchema = z.object({
  customerName: z.string().min(1),
  customerPhone: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number"),
  customerEmail: z.string().email().optional().or(z.literal('')),
  customerAddress: z.string().optional(),
  deliveryType: z.enum(['DELIVERY', 'PICKUP']),
  paymentMethod: z.enum(['ONLINE', 'COD']),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive().max(20),
    size: z.string().nullable().optional(),
  })).min(1),
});

const cartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().max(20),
  size: z.string().nullable().optional(),
});

const statusUpdateSchema = z.object({
  status: z.enum(['PLACED', 'ACCEPTED', 'READY', 'DELIVERED', 'CANCELLED']),
});

const shopUpdateSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  address: z.string().optional(),
  description: z.string().optional(),
  gstin: z.string().optional(),
  codEnabled: z.boolean().optional(),
});

module.exports = {
  loginSchema,
  registerSchema,
  productSchema,
  orderSchema,
  cartItemSchema,
  statusUpdateSchema,
  shopUpdateSchema,
};
