// backend/models/ProductModel.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.join(__dirname, "catalog_500.json");

let productsCache = [];
try {
  const raw = fs.readFileSync(catalogPath, "utf-8");
  productsCache = JSON.parse(raw);
} catch (e) {
  console.warn("Could not read catalog_500.json, using fallback", e.message);
}

export const ProductModel = {
  findAll({ category, search, limit = 500, offset = 0 } = {}) {
    let result = [...productsCache];

    if (category && category !== "all") {
      result = result.filter((p) => p.category === category);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.nameAm && p.nameAm.includes(q)) ||
          p.subcategory.toLowerCase().includes(q)
      );
    }

    const total = result.length;
    const paginated = result.slice(offset, offset + limit);

    return {
      total,
      limit,
      offset,
      products: paginated,
    };
  },

  findById(id) {
    return productsCache.find((p) => p.id === id) || null;
  },

  countByCategory() {
    return {
      clothes: productsCache.filter((p) => p.category === "clothes").length,
      electronics: productsCache.filter((p) => p.category === "electronics").length,
      cosmetics: productsCache.filter((p) => p.category === "cosmetics").length,
      total: productsCache.length,
    };
  },
};
