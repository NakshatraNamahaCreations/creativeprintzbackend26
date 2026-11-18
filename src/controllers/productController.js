const Product = require('../models/Product');
const Review = require('../models/Review');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');

// @desc    Get all products with filters
exports.getProducts = async (req, res) => {
  try {
    const {
      category, search, name, minPrice, maxPrice, sort, page = 1, limit = 12,
      isFeatured, isBestSeller, isNewArrival, rating,
    } = req.query;

    const query = { isActive: true };

    // category can be a slug string OR a MongoDB ObjectId
    if (category) {
      const Category = require('../models/Category');
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(category)) {
        query.category = category;
      } else {
        const cat = await Category.findOne({ slug: category, isActive: true });
        if (cat) query.category = cat._id;
        else query.category = null; // no match → return empty
      }
    }
    if (isFeatured) query.isFeatured = true;
    if (isBestSeller) query.isBestSeller = true;
    if (isNewArrival) query.isNewArrival = true;
    if (search) query.$text = { $search: search };
    if (name)   query.name  = { $regex: name, $options: 'i' };
    if (minPrice || maxPrice) {
      query.basePrice = {};
      if (minPrice) query.basePrice.$gte = Number(minPrice);
      if (maxPrice) query.basePrice.$lte = Number(maxPrice);
    }
    if (rating) query.averageRating = { $gte: Number(rating) };

    const sortOptions = {
      newest: { createdAt: -1 },
      'price-asc': { basePrice: 1 },
      'price-desc': { basePrice: -1 },
      popular: { numReviews: -1 },
      rating: { averageRating: -1 },
    };

    const sortBy = sortOptions[sort] || { createdAt: -1 };
    const skip = (Number(page) - 1) * Number(limit);

    const [products, total] = await Promise.all([
      Product.find(query).populate('category', 'name slug').sort(sortBy).skip(skip).limit(Number(limit)),
      Product.countDocuments(query),
    ]);

    res.json({
      success: true,
      products,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)), limit: Number(limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single product
exports.getProduct = async (req, res) => {
  try {
    // Accept either a slug or a MongoDB id (the design studio looks products up by id)
    const mongoose = require('mongoose');
    const key = req.params.slug;
    const match = mongoose.Types.ObjectId.isValid(key) ? { $or: [{ _id: key }, { slug: key }] } : { slug: key };
    const product = await Product.findOne({ ...match, isActive: true })
      .populate('category', 'name slug')
      .populate('templates', 'name thumbnail');

    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const reviews = await Review.find({ product: product._id, isApproved: true })
      .populate('user', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ success: true, product, reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create product (admin)
exports.createProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update product (admin)
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete product (admin)
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Upload product images (admin)
exports.uploadProductImages = async (req, res) => {
  try {
    const uploadPromises = req.files.map((file) =>
      cloudinary.uploader.upload(file.path, { folder: 'creative-printz/products' })
        .then((result) => {
          fs.unlinkSync(file.path);
          return { url: result.secure_url, alt: file.originalname };
        })
    );
    const images = await Promise.all(uploadPromises);
    res.json({ success: true, images });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add review
exports.addReview = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const existing = await Review.findOne({ product: product._id, user: req.user._id });
    if (existing) return res.status(400).json({ success: false, message: 'You already reviewed this product' });

    const review = await Review.create({ ...req.body, product: product._id, user: req.user._id });

    // Update product average rating
    const allReviews = await Review.find({ product: product._id, isApproved: true });
    product.averageRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    product.numReviews = allReviews.length;
    await product.save();

    res.status(201).json({ success: true, review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
