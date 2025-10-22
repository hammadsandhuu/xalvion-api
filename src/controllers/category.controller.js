const Category = require("../models/category.model");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const APIFeatures = require("../utils/apiFeatures");
const { cloudinary } = require("../../config/cloudinary");
const successResponse = require("../utils/successResponse");

// ========================
// Recursive helper to populate all nested children
// ========================
const populateChildrenRecursively = async (category) => {
  await category
    .populate({
      path: "children",
      populate: { path: "createdBy", select: "name email" },
    })
    .execPopulate();

  if (category.children && category.children.length > 0) {
    for (let child of category.children) {
      await populateChildrenRecursively(child);
    }
  }

  return category;
};

// ========================
// GET ALL CATEGORIES (WITH FULL NESTED CHILDREN)
// ========================
exports.getAllCategories = catchAsync(async (req, res, next) => {
  const filter = { parent: null }; // Only top-level categories
  if (req.query.type) filter.type = req.query.type;

  let categories = await Category.find(filter).populate("createdBy", "name email");

  // Recursively populate all children
  for (let i = 0; i < categories.length; i++) {
    categories[i] = await populateChildrenRecursively(categories[i]);
  }

  return successResponse(
    res,
    { categories },
    "Categories fetched successfully with nested children"
  );
});

// ========================
// GET SINGLE CATEGORY (WITH FULL NESTED CHILDREN)
// ========================
exports.getCategory = catchAsync(async (req, res, next) => {
  let category = await Category.findOne({ slug: req.params.slug }).populate("createdBy", "name email");

  if (!category) return next(new AppError("No category found with that slug", 404));

  category = await populateChildrenRecursively(category);

  return successResponse(res, { category }, "Category fetched successfully with nested children");
});

// ========================
// CREATE CATEGORY
// ========================
exports.createCategory = catchAsync(async (req, res, next) => {
  if (req.files && req.files.length) {
    req.body.images = req.files.map(file => ({
      url: file.path,
      altText: req.body.altText || "",
      type: file.fieldname,
    }));
  }

  req.body.createdBy = req.user.id;

  const newCategory = await Category.create(req.body);

  return successResponse(res, { category: newCategory }, "Category created successfully", 201);
});

// ========================
// UPDATE CATEGORY
// ========================
exports.updateCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findById(req.params.id);
  if (!category) return next(new AppError("No category found with that ID", 404));

  if (req.files && req.files.length) {
    if (category.images && category.images.length) {
      for (const img of category.images) {
        if (img.id) await cloudinary.uploader.destroy(img.id);
      }
    }

    req.body.images = req.files.map(file => ({
      url: file.path,
      altText: req.body.altText || "",
      type: file.fieldname,
    }));
  }

  const updatedCategory = await Category.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  return successResponse(res, { category: updatedCategory }, "Category updated successfully");
});

// ========================
// DELETE CATEGORY
// ========================
exports.deleteCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findById(req.params.id);
  if (!category) return next(new AppError("No category found with that ID", 404));

  if (category.images && category.images.length) {
    for (const img of category.images) {
      if (img.id) await cloudinary.uploader.destroy(img.id);
    }
  }

  await Category.findByIdAndDelete(req.params.id);

  return successResponse(res, null, "Category deleted successfully", 204);
});

// ========================
// CREATE SUBCATEGORY
// ========================
exports.createSubCategory = catchAsync(async (req, res, next) => {
  req.body.parent = req.params.parentId;
  req.body.createdBy = req.user.id;

  if (req.files && req.files.length) {
    req.body.images = req.files.map(file => ({
      url: file.path,
      altText: req.body.altText || "",
      type: file.fieldname,
    }));
  }

  const subCategory = await Category.create(req.body);

  return successResponse(res, { subCategory }, "Subcategory created successfully", 201);
});

// ========================
// UPDATE SUBCATEGORY
// ========================
exports.updateSubCategory = catchAsync(async (req, res, next) => {
  const subCategory = await Category.findById(req.params.id);
  if (!subCategory) return next(new AppError("No subcategory found with that ID", 404));

  if (req.files && req.files.length) {
    if (subCategory.images && subCategory.images.length) {
      for (const img of subCategory.images) {
        if (img.id) await cloudinary.uploader.destroy(img.id);
      }
    }

    req.body.images = req.files.map(file => ({
      url: file.path,
      altText: req.body.altText || "",
      type: file.fieldname,
    }));
  }

  const updatedSubCategory = await Category.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  return successResponse(res, { subCategory: updatedSubCategory }, "Subcategory updated successfully");
});

// ========================
// DELETE SUBCATEGORY
// ========================
exports.deleteSubCategory = catchAsync(async (req, res, next) => {
  const subCategory = await Category.findById(req.params.id);
  if (!subCategory) return next(new AppError("No subcategory found with that ID", 404));

  if (subCategory.images && subCategory.images.length) {
    for (const img of subCategory.images) {
      if (img.id) await cloudinary.uploader.destroy(img.id);
    }
  }

  await Category.findByIdAndDelete(req.params.id);

  return successResponse(res, null, "Subcategory deleted successfully", 204);
});

// ========================
// GET ALL SUBCATEGORIES (OPTIONAL FILTER BY PARENT)
// ========================
exports.getAllSubCategories = catchAsync(async (req, res, next) => {
  const filter = {};
  if (req.query.parentId) filter.parent = req.query.parentId;

  const total = await Category.countDocuments(filter);

  const features = new APIFeatures(
    Category.find(filter)
      .populate("createdBy", "name email")
      .populate("parent", "name slug type"),
    req.query
  );

  features.sort().limitFields().paginate(total);

  const subCategories = await features.query;

  return successResponse(
    res,
    { subCategories, pagination: features.pagination },
    "Subcategories fetched successfully"
  );
});
