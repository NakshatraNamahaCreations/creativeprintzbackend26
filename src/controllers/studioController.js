const StudioDesign = require('../models/StudioDesign');

const MAX_PREVIEW_LENGTH = 3 * 1024 * 1024;
const STATUSES = ['draft', 'sent', 'in-progress', 'printed', 'cancelled'];

// Keep only digits so "+91 98765-43210" and "9876543210" match
const normalizePhone = (phone = '') => String(phone).replace(/\D/g, '').slice(-10);
const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

const cleanCustomer = (customer = {}) => ({
  name: String(customer.name || '').trim(),
  phone: normalizePhone(customer.phone),
  email: normalizeEmail(customer.email),
});

const pickFields = (body) => {
  const fields = {};
  ['name', 'notes', 'productType', 'productLabel', 'sizeLabel', 'width', 'height', 'canvasData', 'previewImage']
    .forEach((key) => { if (body[key] !== undefined) fields[key] = body[key]; });
  if (fields.previewImage && fields.previewImage.length > MAX_PREVIEW_LENGTH) delete fields.previewImage;
  return fields;
};

// Owner check: the phone on the request must match the one the design was saved with
const findOwnedDesign = async (id, phone) => {
  if (!/^[0-9a-fA-F]{24}$/.test(id)) return null;
  const design = await StudioDesign.findById(id);
  if (!design || design.customer.phone !== normalizePhone(phone)) return null;
  return design;
};

// POST /api/studio
exports.createDesign = async (req, res, next) => {
  try {
    const customer = cleanCustomer(req.body.customer);
    if (customer.phone.length < 10) {
      return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit phone number' });
    }
    const design = await StudioDesign.create({ ...pickFields(req.body), customer });
    res.status(201).json({ success: true, design: { _id: design._id, designCode: design.designCode, status: design.status } });
  } catch (error) {
    next(error);
  }
};

// PUT /api/studio/:id
exports.updateDesign = async (req, res, next) => {
  try {
    const design = await findOwnedDesign(req.params.id, req.body.customer?.phone);
    if (!design) return res.status(404).json({ success: false, message: 'Design not found' });
    Object.assign(design, pickFields(req.body));
    const customer = cleanCustomer(req.body.customer);
    design.customer.name = customer.name;
    design.customer.email = customer.email;
    await design.save();
    res.json({ success: true, design: { _id: design._id, designCode: design.designCode, status: design.status } });
  } catch (error) {
    next(error);
  }
};

// GET /api/studio/find?phone=&email=
exports.findDesigns = async (req, res, next) => {
  try {
    const phone = normalizePhone(req.query.phone);
    const email = normalizeEmail(req.query.email);
    if (phone.length < 10 || !email) {
      return res.status(400).json({ success: false, message: 'Phone number and email are required' });
    }
    const designs = await StudioDesign.find({ 'customer.phone': phone, 'customer.email': email })
      .select('designCode name productLabel sizeLabel previewImage status updatedAt')
      .sort('-updatedAt')
      .limit(50);
    res.json({ success: true, designs });
  } catch (error) {
    next(error);
  }
};

// GET /api/studio/:id?phone=
exports.getDesign = async (req, res, next) => {
  try {
    const design = await findOwnedDesign(req.params.id, req.query.phone);
    if (!design) return res.status(404).json({ success: false, message: 'Design not found' });
    res.json({ success: true, design });
  } catch (error) {
    next(error);
  }
};

// POST /api/studio/:id/send
exports.sendForPrinting = async (req, res, next) => {
  try {
    const design = await findOwnedDesign(req.params.id, req.body.customer?.phone);
    if (!design) return res.status(404).json({ success: false, message: 'Design not found' });
    const customer = cleanCustomer(req.body.customer);
    if (!customer.name) return res.status(400).json({ success: false, message: 'Please enter your name' });
    design.customer.name = customer.name;
    design.customer.email = customer.email;
    if (req.body.notes !== undefined) design.notes = req.body.notes;
    design.status = 'sent';
    design.sentAt = new Date();
    await design.save();
    res.json({ success: true, design: { _id: design._id, designCode: design.designCode, status: design.status } });
  } catch (error) {
    next(error);
  }
};

// POST /api/studio/ai-image  { prompt, width, height }
// Fetches the image on the server and returns it as a data URL so the canvas stays exportable.
exports.generateAiImage = async (req, res) => {
  const prompt = String(req.body.prompt || '').trim().slice(0, 400);
  if (!prompt) return res.status(400).json({ success: false, message: 'Describe the image you want' });
  const width = Math.min(Math.max(parseInt(req.body.width, 10) || 768, 256), 1024);
  const height = Math.min(Math.max(parseInt(req.body.height, 10) || 768, 256), 1024);
  const seed = Math.floor(Math.random() * 1e6);
  // enhance=false keeps the customer's words exactly as typed.
  // With POLLINATIONS_API_KEY (from enter.pollinations.ai) the image comes from the keyed API:
  // the chosen model (POLLINATIONS_IMAGE_MODEL, default flux), no logo, no shared wait.
  // Without a key the old free endpoint is used: a smaller model, a logo, and about one
  // picture every 45 s for the whole site.
  const key = process.env.POLLINATIONS_API_KEY;
  const model = process.env.POLLINATIONS_IMAGE_MODEL || 'flux';
  const query = `width=${width}&height=${height}&seed=${seed}&enhance=false&nologo=true&safe=true`;
  const url = key
    ? `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?model=${encodeURIComponent(model)}&${query}`
    : `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${query}`;

  try {
    const headers = key ? { Authorization: `Bearer ${key}` } : {};
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(90000) });
    const contentType = response.headers.get('content-type') || '';
    // 402/429 = "one image every 45 s" free limit, 503 = free service overloaded: both are temporary
    if ([402, 429, 503].includes(response.status)) {
      const body = await response.text().catch(() => '');
      // the account has run out of credit: retrying won't help, so say so (and log it for the owner)
      if (/INSUFFICIENT_BALANCE/.test(body)) {
        console.error('Pollinations: out of balance for model', model, '- top up at https://enter.pollinations.ai');
        return res.status(503).json({ success: false, message: 'AI images are paused right now. Please try again later or contact us.' });
      }
      let wait = parseInt(response.headers.get('retry-after'), 10);
      if (!wait) wait = parseInt((body.match(/retry after (\d+)\s*s/i) || [])[1], 10);
      // tell the studio how long to wait so it can retry by itself
      const retryAfter = Math.min(Math.max(wait || 15, 5), 60);
      return res.status(503).json({ success: false, retryAfter, message: `The AI is busy. Please try again in about ${retryAfter} seconds.` });
    }
    if (!response.ok || !contentType.startsWith('image/')) {
      return res.status(503).json({ success: false, message: 'AI image service is busy. Please try again in a moment.' });
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    res.json({ success: true, image: `data:${contentType.split(';')[0]};base64,${buffer.toString('base64')}` });
  } catch (error) {
    res.status(503).json({ success: false, message: 'AI image service is busy. Please try again in a moment.' });
  }
};

// GET /api/studio/admin/all  (admin)
exports.getAllDesigns = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status && STATUSES.includes(req.query.status)) filter.status = req.query.status;
    const designs = await StudioDesign.find(filter).select('-canvasData').sort('-updatedAt').limit(200);
    res.json({ success: true, designs });
  } catch (error) {
    next(error);
  }
};

// GET /api/studio/admin/:id  (admin, includes canvas data for print export)
exports.getDesignAdmin = async (req, res, next) => {
  try {
    if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) return res.status(404).json({ success: false, message: 'Design not found' });
    const design = await StudioDesign.findById(req.params.id);
    if (!design) return res.status(404).json({ success: false, message: 'Design not found' });
    res.json({ success: true, design });
  } catch (error) {
    next(error);
  }
};

// PUT /api/studio/admin/:id/status  (admin)
exports.updateStatus = async (req, res, next) => {
  try {
    if (!STATUSES.includes(req.body.status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) return res.status(404).json({ success: false, message: 'Design not found' });
    const design = await StudioDesign.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true }).select('-canvasData');
    if (!design) return res.status(404).json({ success: false, message: 'Design not found' });
    res.json({ success: true, design });
  } catch (error) {
    next(error);
  }
};
