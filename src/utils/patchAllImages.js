/**
 * patchAllImages.js
 * Run: node src/utils/patchAllImages.js
 * Updates every DB product with its correct image — local file where available,
 * unique Unsplash photo otherwise. Fixes the "all products show same image" problem.
 */
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const Product = require('../models/Product');
require('../models/Category');

// Local images from frontend/public/images/products/
const L = (f) => `/images/products/${f}`;
// Unsplash images (only for products with no local image)
const U = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&h=800&q=85`;

// slug → image url(s)
const imageMap = {
  // ── Business Cards ────────────────────────────────────────────────────────
  'standard-business-cards':         [L('business-cards-standard.png')],
  'premium-matte-business-cards':    [L('business-cards-premium-matte.png')],
  'rounded-corner-business-cards':   [L('business-cards-standard.png')],
  'soft-touch-matte-cards':          [L('business-cards-premium-matte.png')],
  'foil-visiting-cards':             [L('business-cards-standard.png')],

  // ── Marketing Materials ───────────────────────────────────────────────────
  'a5-flyers':                       [L('a5-flyers.png')],
  'a4-flyers':                       [L('a5-flyers.png')],
  'trifold-brochures':               [L('trifold-brochures.png')],
  'a3-posters':                      [L('a3-posters.png')],
  'postcards':                       [U('1562564055-71e051d33c19')],
  'door-hangers':                    [U('1586281380349-632531db7ed4')],

  // ── Banners & Signage ─────────────────────────────────────────────────────
  'vinyl-banner':                    [L('vinyl-banner.png')],
  'roll-up-banner-stand':            [L('roll-up-banner-stand.png')],
  'foam-board-standee':              [U('1497366811353-6870744d04b2')],
  'table-top-banner':                [U('1540575467063-178a50c2df87')],

  // ── Clothing & Bags ───────────────────────────────────────────────────────
  'custom-printed-t-shirt':          [L('custom-printed-t-shirt.png')],
  'custom-printed-hoodie':           [L('custom-printed-hoodie.png')],
  'custom-polo-shirt':               [L('polo-tshirt.png')],
  'custom-tote-bag':                 [L('bags_promo.png')],
  'custom-drawstring-bags':          [L('bags_promo.png')],
  'custom-paper-bags':               [L('bags_promo.png')],
  'custom-caps-hats':                [U('1521572163474-6864f9cf17ab')],
  'custom-hang-tags':                [L('boxes_promo.png')],

  // ── Gifts & Mugs ──────────────────────────────────────────────────────────
  'custom-ceramic-mug':              [L('custom-ceramic-mug.png')],
  'personalised-mouse-pad':          [U('1527864503558-f0c7b682ac59')],
  'custom-photo-calendar':           [U('1506784365847-bbad939befd4')],
  'custom-keychain':                 [U('1618005198919-f3f082f6bfca')],
  'custom-photo-frame':              [U('1605106702842-01a887a31122')],
  'custom-coasters':                 [U('1495474472287-4d71bcdd2085')],
  'custom-phone-case':               [U('1598327105666-5b89351aff97')],

  // ── Labels & Stickers ─────────────────────────────────────────────────────
  'custom-die-cut-stickers':         [L('custom-die-cut-stickers.png')],
  'round-stickers':                  [L('custom-die-cut-stickers.png')],
  'sheet-stickers':                  [U('1588345921523-c2dcdb7f1dcd')],
  'holographic-stickers':            [U('1616400619175-5beda3a17896')],
  'product-labels-roll':             [U('1530026405845-a3e6e2531c08')],
  'self-adhesive-tapes':             [U('1589939705384-5185137a7f0f')],
  'return-address-labels':           [U('1555421689-d68471e189f2')],
  'window-stickers':                 [U('1558618666-fcd25c85cd64')],
  'product-packaging-labels':        [U('1527718850663-66f84e9f97f8')],

  // ── Invitations ───────────────────────────────────────────────────────────
  'wedding-invitation-cards':        [L('wedding-invitation-cards.png')],
  'birthday-invitation-cards':       [U('1513151233558-d860c5194643')],
  'thank-you-cards':                 [U('1542744094-3a31f272c490')],

  // ── Stationery & Notebooks ────────────────────────────────────────────────
  'custom-notebooks':                [L('custombooks.jpg')],
  'letterhead-a4':                   [L('letterhead.jpg')],
  'custom-letterheads':              [L('letterhead.jpg')],
  'spiral-notebooks':                [L('spiralnotebooks.jpg')],
  'hardcover-notebooks':             [L('handcovernotebooks.jpg')],
  'pocket-notebooks':                [L('pocketnotebooks.jpg')],
  'a5-notebooks':                    [L('a5notebooks.jpg')],
  'office-stationery':               [L('stationery_promo.png')],
  'envelopes':                       [L('envelopes.jpg')],
  'compliment-slips':                [L('complimentslips.jpg')],
  'invoice-books':                   [L('invoice.jpg')],
  'receipt-books':                   [L('receiptbook.jpg')],
};

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const products = await Product.find({}).populate('category', 'slug');
  let updated = 0;
  let skipped = 0;

  for (const p of products) {
    const urls = imageMap[p.slug];
    if (!urls) {
      console.log(`⚠️  No mapping for: ${p.name} (${p.slug})`);
      skipped++;
      continue;
    }
    const images = urls.map((url, i) => ({ url, alt: `${p.name}${i > 0 ? ` image ${i + 1}` : ''}` }));
    await Product.updateOne({ _id: p._id }, { $set: { images } });
    console.log(`✅ ${p.name}`);
    updated++;
  }

  console.log(`\n🎉 Done! Updated: ${updated} | Skipped: ${skipped}`);
  process.exit(0);
};

run().catch((err) => { console.error('❌', err.message); process.exit(1); });
