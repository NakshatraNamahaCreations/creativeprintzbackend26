/**
 * patchStationery.js
 * Run: node src/utils/patchStationery.js
 *
 * 1. Creates the "Stationery & Notebooks" category if it doesn't exist
 * 2. Updates existing stationery products with local image URLs
 * 3. Creates missing stationery products in the DB
 */
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const Product  = require('../models/Product');
const Category = require('../models/Category');

// Local image base path (served from React frontend public folder)
const L = (filename) => `/images/products/${filename}`;

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  // ── 1. Ensure stationery-notebooks category exists ──────────────────────────
  let cat = await Category.findOne({ slug: 'stationery-notebooks' });
  if (!cat) {
    cat = await Category.create({
      name: 'Stationery & Notebooks',
      slug: 'stationery-notebooks',
      description: 'Custom notebooks, letterheads, envelopes and office stationery',
    });
    console.log('✅ Created category: Stationery & Notebooks');
  } else {
    console.log('ℹ️  Category already exists: Stationery & Notebooks');
  }
  const catId = cat._id;

  // ── 2. Products to update (already in DB) ────────────────────────────────────
  const toUpdate = [
    {
      slug: 'custom-notebooks',
      images: [{ url: L('custombooks.jpg'),        alt: 'Custom Notebooks' }],
      category: catId,
    },
    {
      slug: 'letterhead-a4',
      images: [{ url: L('letterhead.jpg'),          alt: 'Custom Letterheads' }],
      category: catId,
      name: 'Custom Letterheads',
    },
  ];

  for (const item of toUpdate) {
    const update = { images: item.images, category: item.category };
    if (item.name) update.name = item.name;
    const res = await Product.updateOne({ slug: item.slug }, { $set: update });
    if (res.matchedCount) {
      console.log(`✅ Updated: ${item.slug}`);
    } else {
      console.log(`⚠️  Not found in DB (will create): ${item.slug}`);
    }
  }

  // ── 3. Products to create (not in DB yet) ────────────────────────────────────
  const toCreate = [
    {
      name: 'Spiral Notebooks',
      slug: 'spiral-notebooks',
      shortDescription: 'Wire-o spiral bound notebooks, 120 ruled pages, durable cover',
      description: 'Wire-o spiral bound notebooks with 120 ruled pages, durable printed cover and smooth writing surface. Available in bulk quantities.',
      basePrice: 199, discountPrice: 149,
      isFeatured: true, isBestSeller: false, isNewArrival: true,
      averageRating: 4.5, numReviews: 0,
      minDeliveryDays: 3, maxDeliveryDays: 5,
      images: [{ url: L('spiralnotebooks.jpg'), alt: 'Spiral Notebooks' }],
      quantityOptions: [
        { qty: 10,  price: 199,  discountPrice: 149 },
        { qty: 25,  price: 449,  discountPrice: 349 },
        { qty: 50,  price: 849,  discountPrice: 649 },
      ],
      allowCustomDesign: true,
    },
    {
      name: 'Hardcover Notebooks',
      slug: 'hardcover-notebooks',
      shortDescription: 'Premium hardcover notebooks with 200 pages, lay-flat binding',
      description: 'Premium hardcover notebooks with 200 ruled pages, lay-flat binding and full-colour printed cover. Perfect for corporate gifting.',
      basePrice: 399, discountPrice: 299,
      isFeatured: true, isBestSeller: true, isNewArrival: false,
      averageRating: 4.8, numReviews: 0,
      minDeliveryDays: 4, maxDeliveryDays: 7,
      images: [{ url: L('handcovernotebooks.jpg'), alt: 'Hardcover Notebooks' }],
      quantityOptions: [
        { qty: 5,   price: 399,  discountPrice: 299 },
        { qty: 10,  price: 749,  discountPrice: 549 },
        { qty: 25,  price: 1749, discountPrice: 1299 },
      ],
      allowCustomDesign: true,
    },
    {
      name: 'Pocket Notebooks',
      slug: 'pocket-notebooks',
      shortDescription: 'Compact A6 pocket notebooks, ideal for on-the-go notes',
      description: 'Compact A6 size pocket notebooks with 80 ruled pages. Slim enough to fit in any pocket or bag. Custom cover print available.',
      basePrice: 149, discountPrice: 99,
      isFeatured: false, isBestSeller: true, isNewArrival: false,
      averageRating: 4.6, numReviews: 0,
      minDeliveryDays: 3, maxDeliveryDays: 5,
      images: [{ url: L('pocketnotebooks.jpg'), alt: 'Pocket Notebooks' }],
      quantityOptions: [
        { qty: 10,  price: 149,  discountPrice: 99 },
        { qty: 25,  price: 349,  discountPrice: 249 },
        { qty: 50,  price: 649,  discountPrice: 449 },
      ],
      allowCustomDesign: true,
    },
    {
      name: 'A5 Notebooks',
      slug: 'a5-notebooks',
      shortDescription: 'A5 size notebooks with 160 ruled pages and soft-touch cover',
      description: 'A5 size notebooks with 160 ruled pages, soft-touch laminated cover and ribbon bookmark. Ideal for daily use and corporate branding.',
      basePrice: 249, discountPrice: 179,
      isFeatured: true, isBestSeller: false, isNewArrival: true,
      averageRating: 4.7, numReviews: 0,
      minDeliveryDays: 3, maxDeliveryDays: 5,
      images: [{ url: L('a5notebooks.jpg'), alt: 'A5 Notebooks' }],
      quantityOptions: [
        { qty: 10,  price: 249,  discountPrice: 179 },
        { qty: 25,  price: 549,  discountPrice: 399 },
        { qty: 50,  price: 999,  discountPrice: 749 },
      ],
      allowCustomDesign: true,
    },
    {
      name: 'Office Stationery',
      slug: 'office-stationery',
      shortDescription: 'Complete branded office stationery pack — letterheads, envelopes & more',
      description: 'Complete branded office stationery bundle including letterheads, envelopes, compliment slips and notepads. Perfect for a professional brand identity.',
      basePrice: 1499, discountPrice: 999,
      isFeatured: true, isBestSeller: true, isNewArrival: false,
      averageRating: 4.7, numReviews: 0,
      minDeliveryDays: 4, maxDeliveryDays: 7,
      images: [{ url: L('stationery_promo.png'), alt: 'Office Stationery' }],
      quantityOptions: [
        { qty: 1, price: 1499, discountPrice: 999 },
        { qty: 3, price: 3999, discountPrice: 2699 },
        { qty: 5, price: 5999, discountPrice: 3999 },
      ],
      allowCustomDesign: true,
    },
    {
      name: 'Envelopes',
      slug: 'envelopes',
      shortDescription: 'Custom printed branded envelopes in DL and C5 sizes',
      description: 'Custom printed branded envelopes available in DL and C5 sizes. Printed with your logo, address and brand colours. Premium quality paper.',
      basePrice: 449, discountPrice: 299,
      isFeatured: false, isBestSeller: true, isNewArrival: false,
      averageRating: 4.6, numReviews: 0,
      minDeliveryDays: 3, maxDeliveryDays: 5,
      images: [{ url: L('envelopes.jpg'), alt: 'Envelopes' }],
      quantityOptions: [
        { qty: 50,  price: 449,  discountPrice: 299 },
        { qty: 100, price: 749,  discountPrice: 499 },
        { qty: 250, price: 1499, discountPrice: 999 },
        { qty: 500, price: 2499, discountPrice: 1699 },
      ],
      allowCustomDesign: true,
    },
    {
      name: 'Compliment Slips',
      slug: 'compliment-slips',
      shortDescription: 'A5 / DL compliment slips with your logo and contact details',
      description: 'A5 and DL compliment slips professionally printed with your branding, logo and contact details. 130gsm premium paper.',
      basePrice: 349, discountPrice: 229,
      isFeatured: false, isBestSeller: false, isNewArrival: true,
      averageRating: 4.5, numReviews: 0,
      minDeliveryDays: 3, maxDeliveryDays: 5,
      images: [{ url: L('complimentslips.jpg'), alt: 'Compliment Slips' }],
      quantityOptions: [
        { qty: 100, price: 349,  discountPrice: 229 },
        { qty: 250, price: 699,  discountPrice: 449 },
        { qty: 500, price: 1199, discountPrice: 799 },
      ],
      allowCustomDesign: true,
    },
    {
      name: 'Invoice Books',
      slug: 'invoice-books',
      shortDescription: 'Duplicate / triplicate custom printed invoice books with serial numbering',
      description: 'Custom printed duplicate or triplicate invoice books with sequential serial numbering. 50 sets per book, available in A4 and A5 sizes.',
      basePrice: 799, discountPrice: 549,
      isFeatured: true, isBestSeller: false, isNewArrival: false,
      averageRating: 4.7, numReviews: 0,
      minDeliveryDays: 4, maxDeliveryDays: 7,
      images: [{ url: L('invoice.jpg'), alt: 'Invoice Books' }],
      quantityOptions: [
        { qty: 1, price: 799,  discountPrice: 549 },
        { qty: 3, price: 2099, discountPrice: 1449 },
        { qty: 5, price: 3299, discountPrice: 2299 },
      ],
      allowCustomDesign: true,
    },
    {
      name: 'Receipt Books',
      slug: 'receipt-books',
      shortDescription: 'Custom printed receipt books, duplicate sets with serial numbering',
      description: 'Custom printed receipt books in duplicate sets with sequential serial numbering. 50 sets per book. Your logo and business details printed.',
      basePrice: 699, discountPrice: 479,
      isFeatured: false, isBestSeller: true, isNewArrival: false,
      averageRating: 4.6, numReviews: 0,
      minDeliveryDays: 4, maxDeliveryDays: 7,
      images: [{ url: L('receiptbook.jpg'), alt: 'Receipt Books' }],
      quantityOptions: [
        { qty: 1, price: 699,  discountPrice: 479 },
        { qty: 3, price: 1849, discountPrice: 1249 },
        { qty: 5, price: 2999, discountPrice: 1999 },
      ],
      allowCustomDesign: true,
    },
  ];

  for (const data of toCreate) {
    const existing = await Product.findOne({ slug: data.slug });
    if (existing) {
      await Product.updateOne({ slug: data.slug }, { $set: { images: data.images, category: catId } });
      console.log(`✅ Updated existing: ${data.name}`);
    } else {
      await Product.create({ ...data, category: catId });
      console.log(`✅ Created: ${data.name}`);
    }
  }

  console.log('\n🎉 Done! All stationery & notebook products are set up.');
  process.exit(0);
};

run().catch((err) => { console.error('❌', err.message); process.exit(1); });
