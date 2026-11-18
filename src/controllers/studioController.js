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
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true`;

  try {
    // Free tier allows ~1 image per 45s per server IP; set POLLINATIONS_API_KEY to remove the limit
    const headers = process.env.POLLINATIONS_API_KEY ? { Authorization: `Bearer ${process.env.POLLINATIONS_API_KEY}` } : {};
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(90000) });
    const contentType = response.headers.get('content-type') || '';
    if (response.status === 402 || response.status === 429) {
      return res.status(503).json({ success: false, message: 'AI image limit reached. Please wait about a minute and try again.' });
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
