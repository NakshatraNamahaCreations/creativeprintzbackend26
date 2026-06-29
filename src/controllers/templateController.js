const Template = require('../models/Template');

// @desc    Get all active templates (public, filterable by product/category/industry)
exports.getTemplates = async (req, res) => {
  try {
    const { product, category, industry, search } = req.query;
    const query = { isActive: true };
    if (product) query.product = product;
    if (category) query.category = category;
    if (industry) query.industry = industry;
    if (search) query.name = { $regex: search, $options: 'i' };

    const templates = await Template.find(query)
      .populate('category', 'name slug')
      .populate('product', 'name slug')
      .sort({ usageCount: -1, createdAt: -1 });

    res.json({ success: true, templates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single template and increment usage count
exports.getTemplate = async (req, res) => {
  try {
    const template = await Template.findByIdAndUpdate(
      req.params.id,
      { $inc: { usageCount: 1 } },
      { new: true }
    ).populate('category', 'name slug').populate('product', 'name slug');

    if (!template || !template.isActive) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    res.json({ success: true, template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create template (admin)
exports.createTemplate = async (req, res) => {
  try {
    const template = await Template.create(req.body);
    res.status(201).json({ success: true, template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update template (admin)
exports.updateTemplate = async (req, res) => {
  try {
    const template = await Template.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    res.json({ success: true, template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete template (admin)
exports.deleteTemplate = async (req, res) => {
  try {
    await Template.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
