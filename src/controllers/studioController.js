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
  const prompt = String(req.body.prompt || '').trim().slice(0, 1200);
  if (!prompt) return res.status(400).json({ success: false, message: 'Describe the image you want' });
  // Keep the page's shape: the short side at least 768 px (the text models need it), the long side at most 1536 px
  let width = Math.max(parseInt(req.body.width, 10) || 1024, 64);
  let height = Math.max(parseInt(req.body.height, 10) || 1024, 64);
  let k = Math.max(768 / Math.min(width, height), 1);
  k = Math.min(k * Math.max(width, height), 1536) / Math.max(width, height);
  width = Math.round((width * k) / 16) * 16;
  height = Math.round((height * k) / 16) * 16;
  const seed = Math.floor(Math.random() * 1e6);
  // enhance=false keeps the customer's words exactly as typed.
  const query = `width=${width}&height=${height}&seed=${seed}&enhance=false&nologo=true&safe=true`;
  const key = process.env.POLLINATIONS_API_KEY;
  // The text models follow this: print the customer's words exactly as typed
  const designPrompt = /["“”]/.test(prompt)
    ? `${prompt}. Print-ready design. Print the quoted words exactly as given and spelled correctly, without the quote marks.`
    : `${prompt}. Print-ready design.`;

  // Without a key: the old free endpoint (smaller model, logo, about one picture every 45 s for the whole site).
  if (!key) {
    try {
      const response = await fetch(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${query}`, { signal: AbortSignal.timeout(90000) });
      const contentType = response.headers.get('content-type') || '';
      if ([402, 429, 503].includes(response.status)) {
        const body = await response.text().catch(() => '');
        let wait = parseInt(response.headers.get('retry-after'), 10);
        if (!wait) wait = parseInt((body.match(/retry after (\d+)\s*s/i) || [])[1], 10);
        const retryAfter = Math.min(Math.max(wait || 15, 5), 60);
        return res.status(503).json({ success: false, retryAfter, message: `The AI is busy. Please try again in about ${retryAfter} seconds.` });
      }
      if (!response.ok || !contentType.startsWith('image/')) throw new Error('bad response');
      const buffer = Buffer.from(await response.arrayBuffer());
      return res.json({ success: true, image: `data:${contentType.split(';')[0]};base64,${buffer.toString('base64')}` });
    } catch {
      return res.status(503).json({ success: false, message: 'AI image service is busy. Please try again in a moment.' });
    }
  }

  // With a key: try models in order. The first two draw the words in the prompt as clean,
  // readable lettering (posters, welcome boards, invitations); flux is next. The last two are free
  // community models, used when the account has no credit left (simpler designs; people's names may
  // come out as "NAME"). POLLINATIONS_IMAGE_MODEL (comma-separated) overrides the list.
  const models = (process.env.POLLINATIONS_IMAGE_MODEL || 'microsoft/mai-image-2.7-flash,tongyi-mai/z-image-turbo,flux,community/scriptsnsenses-sys/lucid-origin:free,community/scriptsnsenses-sys/flux-2-dev-free')
    .split(',').map((m) => m.trim()).filter(Boolean);
  let blocked = false;
  let retryAfter = 0;
  for (const model of models) {
    try {
      // POST (not the /image/{prompt} link): the link version blanks out people's names (they come back as {NAME})
      const response = await fetch('https://gen.pollinations.ai/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: model.startsWith('community/') ? `${designPrompt} Flat graphic design artwork filling the whole frame edge to edge, front view, no mockup, no photo of a sign, no wall, no room.` : designPrompt, size: `${width}x${height}`, n: 1, response_format: 'b64_json' }),
        signal: AbortSignal.timeout(60000),
      });
      const body = await response.text().catch(() => '');
      if (response.ok) {
        let item;
        try { item = JSON.parse(body).data?.[0]; } catch { item = null; }
        let b64 = item?.b64_json;
        let type = 'image/png';
        if (!b64 && item?.url) {
          const img = await fetch(item.url, { signal: AbortSignal.timeout(60000) });
          if (img.ok) { type = (img.headers.get('content-type') || type).split(';')[0]; b64 = Buffer.from(await img.arrayBuffer()).toString('base64'); }
        }
        if (b64) {
          if (b64.startsWith('/9j/')) type = 'image/jpeg';
          else if (b64.startsWith('UklGR')) type = 'image/webp';
          return res.json({ success: true, model, image: `data:${type};base64,${b64}` });
        }
      }
      if (/INSUFFICIENT_BALANCE/.test(body)) console.error('Pollinations: out of balance for model', model, '- top up at https://enter.pollinations.ai');
      else console.error('Pollinations', model, response.status, body.slice(0, 160));
      if (/moderation/i.test(body)) blocked = true;
      if (response.status === 429) {
        const wait = parseInt(response.headers.get('retry-after'), 10) || parseInt((body.match(/retry after (\d+)\s*s/i) || [])[1], 10);
        retryAfter = Math.min(Math.max(wait || 15, 5), 60);
      }
    } catch (error) {
      console.error('Pollinations', model, error.message);
    }
  }
  if (retryAfter) return res.status(503).json({ success: false, retryAfter, message: `The AI is busy. Please try again in about ${retryAfter} seconds.` });
  if (blocked) return res.status(422).json({ success: false, message: 'The AI could not make this picture. Please reword your description and try again.' });
  res.status(503).json({ success: false, message: 'AI image service is busy. Please try again in a moment.' });
};

// AI picture jobs. The picture can take 15-60 s, longer than the Netlify proxy waits (about 26 s),
// so the studio starts a job and asks every few seconds whether it is ready.
const aiJobs = new Map();
const AI_JOB_TTL = 10 * 60 * 1000;

// POST /api/studio/ai-image/jobs  { prompt, width, height }  ->  { jobId }
exports.startAiImageJob = (req, res) => {
  const prompt = String(req.body.prompt || '').trim();
  if (!prompt) return res.status(400).json({ success: false, message: 'Describe the image you want' });
  const now = Date.now();
  for (const [id, job] of aiJobs) if (now - job.t > AI_JOB_TTL) aiJobs.delete(id);
  const id = require('crypto').randomBytes(12).toString('hex');
  aiJobs.set(id, { done: false, t: now });
  const finish = (code, body) => aiJobs.set(id, { done: true, code, body, t: Date.now() });
  // run the normal handler with a stand-in response that stores the result
  const jobRes = { code: 200, status(c) { this.code = c; return this; }, json(body) { finish(this.code, body); return this; } };
  Promise.resolve(exports.generateAiImage({ body: { ...req.body } }, jobRes))
    .catch(() => finish(503, { success: false, message: 'AI image service is busy. Please try again in a moment.' }));
  res.json({ success: true, jobId: id });
};

// GET /api/studio/ai-image/jobs/:id  ->  { pending: true } until ready, then the picture (or the error)
exports.getAiImageJob = (req, res) => {
  res.set('Cache-Control', 'no-store');
  const job = aiJobs.get(req.params.id);
  if (!job) return res.status(404).json({ success: false, message: 'This request expired. Please press Generate again.' });
  if (!job.done) return res.json({ success: true, pending: true });
  aiJobs.delete(req.params.id);
  res.status(job.code).json(job.body);
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
