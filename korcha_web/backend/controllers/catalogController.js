// backend/controllers/catalogController.js
import { ProductModel } from "../models/ProductModel.js";

export const catalogController = {
  getCatalog(req, res) {
    try {
      const { category, search, limit = 500, offset = 0 } = req.query;
      const data = ProductModel.findAll({
        category,
        search,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      });
      const counts = ProductModel.countByCategory();

      res.status(200).json({
        ...data,
        counts,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getProductById(req, res) {
    try {
      const product = ProductModel.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.status(200).json(product);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};
