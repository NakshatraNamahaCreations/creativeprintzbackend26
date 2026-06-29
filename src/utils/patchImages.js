/**
 * patchImages.js
 * Run: node src/utils/patchImages.js
 * Adds Unsplash images to ALL products in the database.
 * Safe to run multiple times — overwrites images every time.
 */
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const Product = require('../models/Product');
require('../models/Category');

const U = (id) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&h=800&q=85`;

// slug → [unsplash-id, ...] — first is the hero/main image
const imageMap = {
  // ── Business Cards ──────────────────────────────────────────────────────────
  'standard-business-cards': [
    '1586281380117-5a60ae2050cc',
    '1553484771-b9a26b9ae27e',
    '1600880292203-757bb62b4baf',
  ],
  'premium-matte-business-cards': [
    '1553484771-b9a26b9ae27e',
    '1586281380117-5a60ae2050cc',
    '1541167760496-1628856ab772',
  ],
  'rounded-corner-business-cards': [
    '1541167760496-1628856ab772',
    '1586281380117-5a60ae2050cc',
  ],
  'letterhead-a4': [
    '1586281380349-632531db7ed4',
    '1581291518857-4d5bcad12a2d',
  ],

  // ── Marketing Materials ──────────────────────────────────────────────────────
  'a5-flyers': [
    '1611532736597-de2d4265fba3',
    '1586281380349-632531db7ed4',
  ],
  'trifold-brochures': [
    '1586281380349-632531db7ed4',
    '1611532736597-de2d4265fba3',
  ],
  'a3-posters': [
    '1541961017-22d6838439d7',
    '1611532736597-de2d4265fba3',
    '1558618666-fcd25c85cd64',
  ],
  'postcards': [
    '1562564055-71e051d33c19',
    '1586281380349-632531db7ed4',
  ],
  'door-hangers': [
    '1611532736597-de2d4265fba3',
    '1586281380349-632531db7ed4',
  ],

  // ── Banners & Signage ────────────────────────────────────────────────────────
  'vinyl-banner': [
    '1558618666-fcd25c85cd64',
    '1540575467063-178a50c2df87',
    '1497366811353-6870744d04b2',
  ],
  'roll-up-banner-stand': [
    '1540575467063-178a50c2df87',
    '1558618666-fcd25c85cd64',
    '1497366811353-6870744d04b2',
  ],
  'foam-board-standee': [
    '1497366811353-6870744d04b2',
    '1540575467063-178a50c2df87',
  ],
  'table-top-banner': [
    '1540575467063-178a50c2df87',
    '1558618666-fcd25c85cd64',
  ],

  // ── Clothing & Bags ──────────────────────────────────────────────────────────
  'custom-printed-t-shirt': [
    '1521572163474-6864f9cf17ab',
    '1503341504253-dff4815485f1',
    '1576566588028-4147f3842f27',
  ],
  'custom-printed-hoodie': [
    '1556821840-3a63f8550d3c',
    '1521572163474-6864f9cf17ab',
    '1503341504253-dff4815485f1',
  ],
  'custom-tote-bag': [
    '1548036161-18aabb3b0f6b',
    '1553062407-98eeb64c6a62',
    '1584917865442-d18eb4bfebf9',
  ],
  'custom-polo-shirt': [
    '1503341504253-dff4815485f1',
    '1521572163474-6864f9cf17ab',
    '1620799139-20a1b36d4f55',
  ],

  // ── Gifts & Mugs ─────────────────────────────────────────────────────────────
  'custom-ceramic-mug': [
    '1514228742587-6b1558fcca3d',
    '1534759846116-5799c33ce22a',
    '1497515114865-3b58b4742e51',
  ],
  'personalised-mouse-pad': [
    '1527864503558-f0c7b682ac59',
    '1519389950473-47ba0277781c',
  ],
  'custom-photo-calendar': [
    '1506784365847-bbad939befd4',
    '1514228742587-6b1558fcca3d',
  ],
  'custom-keychain': [
    '1618005198919-f3f082f6bfca',
    '1514228742587-6b1558fcca3d',
  ],

  // ── Labels & Stickers ─────────────────────────────────────────────────────────
  'custom-die-cut-stickers': [
    '1588345921523-c2dcdb7f1dcd',
    '1616400619175-5beda3a17896',
    '1558618666-fcd25c85cd64',
  ],
  'product-labels-roll': [
    '1616400619175-5beda3a17896',
    '1588345921523-c2dcdb7f1dcd',
  ],
  'round-stickers': [
    '1588345921523-c2dcdb7f1dcd',
    '1616400619175-5beda3a17896',
  ],

  // ── Invitations ───────────────────────────────────────────────────────────────
  'wedding-invitation-cards': [
    '1519225421980-9c3d5b0d2b4c',
    '1511285560929-af7de7b23ff0',
    '1520854221256-17451cc331bf',
  ],
  'birthday-invitation-cards': [
    '1513151233558-d860c5194643',
    '1519225421980-9c3d5b0d2b4c',
  ],
  'thank-you-cards': [
    '1511285560929-af7de7b23ff0',
    '1519225421980-9c3d5b0d2b4c',
  ],
};

// Category-level fallbacks for any products not in imageMap
const categoryFallback = {
  'business-cards':      ['1586281380117-5a60ae2050cc', '1553484771-b9a26b9ae27e'],
  'marketing-materials': ['1611532736597-de2d4265fba3', '1586281380349-632531db7ed4'],
  'banners-signage':     ['1558618666-fcd25c85cd64',    '1540575467063-178a50c2df87'],
  'clothing-bags':       ['1521572163474-6864f9cf17ab', '1503341504253-dff4815485f1'],
  'gifts-mugs':          ['1514228742587-6b1558fcca3d', '1534759846116-5799c33ce22a'],
  'labels-stickers':     ['1588345921523-c2dcdb7f1dcd', '1616400619175-5beda3a17896'],
  'invitations':         ['1519225421980-9c3d5b0d2b4c', '1511285560929-af7de7b23ff0'],
};

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const products = await Product.find({}).populate('category', 'slug');
  let updated = 0;

  for (const p of products) {
    const ids =
      imageMap[p.slug] ||
      (p.category?.slug && categoryFallback[p.category.slug]) ||
      ['1586281380117-5a60ae2050cc'];

    const images = ids.map((id, i) => ({ url: U(id), alt: `${p.name} image ${i + 1}` }));
    await Product.updateOne({ _id: p._id }, { $set: { images } });
    updated++;
    console.log(`  ✓ ${p.name}`);
  }

  console.log(`\n🎉 Done! Updated ${updated} products with images.`);
  process.exit(0);
};

run().catch((err) => { console.error('❌', err.message); process.exit(1); });
