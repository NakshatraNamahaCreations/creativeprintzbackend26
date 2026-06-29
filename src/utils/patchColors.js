/**
 * patchColors.js
 * Adds color options to existing products in MongoDB.
 * Run once: node src/utils/patchColors.js
 */
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const Product = require('../models/Product');

/* ── Color palettes by product type ─────────────────────────────────────── */
const TSHIRT_COLORS = [
  { label: 'White',        value: 'white',        hex: '#FFFFFF' },
  { label: 'Black',        value: 'black',        hex: '#111111' },
  { label: 'Navy Blue',    value: 'navy',         hex: '#1e3a8a' },
  { label: 'Royal Blue',   value: 'royal-blue',   hex: '#2563EB' },
  { label: 'Red',          value: 'red',          hex: '#DC2626' },
  { label: 'Forest Green', value: 'forest-green', hex: '#166534' },
  { label: 'Grey',         value: 'grey',         hex: '#6B7280' },
  { label: 'Maroon',       value: 'maroon',       hex: '#7F1D1D' },
  { label: 'Yellow',       value: 'yellow',       hex: '#EAB308' },
  { label: 'Pink',         value: 'pink',         hex: '#EC4899' },
];

const MUG_COLORS = [
  { label: 'White',  value: 'white',  hex: '#FFFFFF' },
  { label: 'Black',  value: 'black',  hex: '#111111' },
  { label: 'Red',    value: 'red',    hex: '#DC2626' },
  { label: 'Blue',   value: 'blue',   hex: '#2563EB' },
  { label: 'Green',  value: 'green',  hex: '#16A34A' },
  { label: 'Pink',   value: 'pink',   hex: '#EC4899' },
  { label: 'Yellow', value: 'yellow', hex: '#EAB308' },
  { label: 'Purple', value: 'purple', hex: '#7C3AED' },
];

const BAG_COLORS = [
  { label: 'Natural', value: 'natural', hex: '#D4B483' },
  { label: 'Black',   value: 'black',   hex: '#111111' },
  { label: 'Navy',    value: 'navy',    hex: '#1e3a8a' },
  { label: 'Red',     value: 'red',     hex: '#DC2626' },
  { label: 'Green',   value: 'green',   hex: '#16A34A' },
  { label: 'Pink',    value: 'pink',    hex: '#EC4899' },
];

const CAP_COLORS = [
  { label: 'Black',      value: 'black',      hex: '#111111' },
  { label: 'White',      value: 'white',      hex: '#FFFFFF' },
  { label: 'Navy Blue',  value: 'navy',       hex: '#1e3a8a' },
  { label: 'Red',        value: 'red',        hex: '#DC2626' },
  { label: 'Grey',       value: 'grey',       hex: '#6B7280' },
  { label: 'Khaki',      value: 'khaki',      hex: '#C3A882' },
];

const KEYCHAIN_COLORS = [
  { label: 'Silver',    value: 'silver',  hex: '#C0C0C0' },
  { label: 'Gold',      value: 'gold',    hex: '#D4AF37' },
  { label: 'Black',     value: 'black',   hex: '#111111' },
  { label: 'Rose Gold', value: 'rose-gold', hex: '#B76E79' },
];

const MOUSEPAD_COLORS = [
  { label: 'Black', value: 'black', hex: '#111111' },
  { label: 'White', value: 'white', hex: '#FFFFFF' },
  { label: 'Blue',  value: 'blue',  hex: '#2563EB' },
  { label: 'Red',   value: 'red',   hex: '#DC2626' },
];

const STICKER_COLORS = [
  { label: 'White (matte)',  value: 'white-matte',  hex: '#F5F5F5' },
  { label: 'White (gloss)',  value: 'white-gloss',  hex: '#FFFFFF' },
  { label: 'Clear',          value: 'clear',         hex: '#E0F2FE' },
  { label: 'Holographic',   value: 'holographic',   hex: '#C084FC' },
  { label: 'Gold foil',     value: 'gold-foil',     hex: '#D4AF37' },
  { label: 'Silver foil',   value: 'silver-foil',   hex: '#C0C0C0' },
];

/* ── Mapping: slug → colors ──────────────────────────────────────────────── */
const COLOR_MAP = {
  'custom-printed-t-shirt':      TSHIRT_COLORS,
  'custom-printed-hoodie':       TSHIRT_COLORS,
  'custom-polo-shirt':           TSHIRT_COLORS,
  'custom-tote-bag':             BAG_COLORS,
  'custom-drawstring-bags':      BAG_COLORS,
  'custom-caps':                 CAP_COLORS,
  'custom-ceramic-mug':          MUG_COLORS,
  'custom-keychain':             KEYCHAIN_COLORS,
  'personalised-mouse-pad':      MOUSEPAD_COLORS,
  'custom-die-cut-stickers':     STICKER_COLORS,
  'round-stickers':              STICKER_COLORS,
  'product-labels-roll':         STICKER_COLORS,
  'holographic-stickers':        STICKER_COLORS,
  'window-stickers':             STICKER_COLORS,
  'sheet-stickers':              STICKER_COLORS,
};

async function patchColors() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  let updated = 0;
  let skipped = 0;

  for (const [slug, colors] of Object.entries(COLOR_MAP)) {
    const result = await Product.findOneAndUpdate(
      { slug },
      { $set: { colors } },
      { new: true }
    );
    if (result) {
      console.log(`✓ ${slug} — ${colors.length} colors`);
      updated++;
    } else {
      console.log(`✗ Not found: ${slug}`);
      skipped++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped (not in DB): ${skipped}`);
  await mongoose.disconnect();
}

patchColors().catch((err) => { console.error(err); process.exit(1); });
