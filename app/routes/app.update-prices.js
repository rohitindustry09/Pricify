import shopify from "../shopify.server";
import { updateVariantPrices } from "../utils/shopify-price-updater.server";

export async function action({ request }) {
  const { admin } = await shopify.authenticate.admin(request);

  const formData = await request.formData();
  const raw = formData.get("changes");

  let changes = [];
  try {
    changes = JSON.parse(raw || "[]");
  } catch (e) {
    return {
      ok: false,
      error: "Invalid JSON in 'changes'",
      updated: 0,
      errors: [],
    };
  }

  if (!Array.isArray(changes) || changes.length === 0) {
    return {
      ok: false,
      error: "No changes provided",
      updated: 0,
      errors: [],
    };
  }

  const result = await updateVariantPrices(admin, changes);
  return result; // React Router will JSON-serialize this
}