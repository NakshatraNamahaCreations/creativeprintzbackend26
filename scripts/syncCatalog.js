/*
 * Adds products the website shows but the database does not have yet, so they can be
 * added to the cart and ordered:
 *   - the website's built-in sample products (frontend/src/data/sampleProducts.js)
 *   - the items on the Mugs & Gifts and Visiting Cards pages (slug "mg-<id>" / "vc-<id>")
 *
 * Safe by design: it only INSERTS products whose slug is missing; it never edits or deletes
 * existing products or categories (missing categories are created). Every product it adds
 * is tagged with tags: ['catalog-sync'] so they are easy to find or remove later.
 *
 *   node scripts/syncCatalog.js            → dry run, lists what would be added
 *   node scripts/syncCatalog.js --apply    → adds them
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');

const APPLY = process.argv.includes('--apply');
const FRONT = path.join(__dirname, '..', '..', 'frontend', 'src');

// Load the plain-object data out of the frontend source files
const evalArray = (file, startMarker, endMarker) => {
  const src = fs.readFileSync(path.join(FRONT, file), 'utf8');
  const a = src.indexOf(startMarker);
  const b = src.indexOf(endMarker, a);
  if (a < 0 || b < 0) throw new Error(`could not read ${file}`);
  // eslint-disable-next-line no-new-func
  return new Function(`return ${src.slice(a + startMarker.length - 1, b + endMarker.length - 1)};`)();
};
const sampleProducts = evalArray('data/sampleProducts.js', 'const sampleProducts = [', '\n];');
const mugsGifts = Object.values(evalArray('pages/MugsGifts/index.js', 'const PRODUCTS = {', '\n};'));
const visitingCards = Object.values(evalArray('pages/VisitingCard/index.js', 'const PRODUCTS = {', '\n};'));

const kebab = (s) => s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
const CATEGORY_NAMES = {
  'business-cards': 'Business Cards', 'gifts-mugs': 'Gifts & Mugs', 'stationery-notebooks': 'Stationery & Notebooks',
};

// Picture from the header menu (frontend/public/images/menu/<name>.jpg) when one exists
const MENU_DIR = path.join(FRONT, '..', 'public', 'images', 'menu');
const menuSlug = (label) => label.toLowerCase().replace(/®/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const menuPicture = (...names) => {
  const hit = names.filter(Boolean).map(menuSlug).find((n) => fs.existsSync(path.join(MENU_DIR, `${n}.jpg`)));
  return hit ? [{ url: `/images/menu/${hit}.jpg`, alt: names[0] }] : [];
};

// Mugs & Gifts / Visiting Cards page items → product documents
const fromPageItem = (p, prefix, categorySlug) => {
  const first = p.pricing[0];
  return {
    images: menuPicture(p.name, p.fullName),
    _id: `${prefix}-${p.id}`,
    name: p.fullName,
    slug: `${prefix}-${kebab(p.id)}`,
    shortDescription: p.desc,
    description: p.desc,
    basePrice: first.price,
    category: { slug: p.tab === 'Stationery' ? 'stationery-and-notebooks' : categorySlug },
    quantityOptions: p.pricing.map((t) => ({ qty: t.qty, price: t.price })),
    sizes: (p.sizes || []).map((s) => ({ label: s, value: s })),
    finishes: (p.finishes || []).map((s) => ({ label: s, value: s })),
    isNewArrival: p.badge === 'NEW',
    allowCustomDesign: true,
  };
};
const pageItems = [
  ...mugsGifts.map((p) => fromPageItem(p, 'mg', 'gifts-mugs')),
  ...visitingCards.map((p) => fromPageItem(p, 'vc', 'business-cards')),
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const existing = new Set((await Product.find({}, 'slug').lean()).map((p) => p.slug));
  const categories = new Map((await Category.find({}).lean()).map((c) => [c.slug, c]));

  const fixCat = (p) => (p.category?.slug === 'stationery-notebooks' ? { ...p, category: { ...p.category, slug: 'stationery-and-notebooks' } } : p);
  const wanted = [...sampleProducts, ...pageItems].map(fixCat).filter((p) => p.slug && !existing.has(p.slug));
  const seen = new Set();
  const toAdd = wanted.filter((p) => !seen.has(p.slug) && seen.add(p.slug));

  // --fill-images: give products this script added earlier the picture they were missing
  if (process.argv.includes('--fill-images')) {
    const added = await Product.find({ tags: 'catalog-sync', 'images.0': { $exists: false } }, 'slug name').lean();
    const bySlug = new Map(pageItems.map((p) => [p.slug, p]));
    const updates = added.map((d) => ({ d, images: bySlug.get(d.slug)?.images?.length ? bySlug.get(d.slug).images : menuPicture(d.name) })).filter((u) => u.images.length);
    console.log(`${updates.length} of ${added.length} added products without a picture can get one${APPLY ? '' : ' (dry run)'}`);
    updates.forEach((u) => console.log(`  ${u.d.slug.padEnd(28)} → ${u.images[0].url}`));
    if (APPLY) for (const u of updates) await Product.updateOne({ _id: u.d._id, tags: 'catalog-sync' }, { $set: { images: u.images } });
    await mongoose.disconnect();
    return;
  }

  const missingCats = [...new Set(toAdd.map((p) => p.category?.slug).filter((s) => s && !categories.has(s)))];
  console.log(`${toAdd.length} products to add, ${missingCats.length} categories to create${APPLY ? '' : ' (dry run)'}`);
  toAdd.forEach((p) => console.log(`  + ${p.slug.padEnd(40)} ${p.name}  [${p.category?.slug}]`));
  missingCats.forEach((s) => console.log(`  + category ${s}`));

  if (APPLY) {
    for (const slug of missingCats) {
      const name = CATEGORY_NAMES[slug] || toAdd.find((p) => p.category?.slug === slug)?.category?.name || slug;
      const cat = await Category.create({ name, slug, isActive: true });
      categories.set(slug, cat);
    }
    // insertMany keeps each slug exactly as the website links to it (save() would rebuild it from the name)
    await Product.insertMany(toAdd.map(({ _id, category, ...doc }) => ({
      ...doc,
      description: doc.description || doc.shortDescription || doc.name,
      category: categories.get(category?.slug)?._id,
      discountPercentage: doc.discountPrice && doc.basePrice ? Math.round(((doc.basePrice - doc.discountPrice) / doc.basePrice) * 100) : undefined,
      tags: [...(doc.tags || []), 'catalog-sync'],
      isActive: true,
    })));
    console.log('done');
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
