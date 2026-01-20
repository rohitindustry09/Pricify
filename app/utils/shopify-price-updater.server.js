// app/utils/shopify-price-updater.server.js

/**
 * Update Shopify variant prices using the productVariantsBulkUpdate mutation.
 *
 * Each "change" must be: { productId, variantId, newPrice }
 *
 * @param {import('@shopify/shopify-api').AdminApiClient} admin
 * @param {{ productId: string; variantId: string; newPrice: number }[]} changes
 * @returns {Promise<{ ok: boolean; updated: number; errors: { productId: string; messages: string }[] }>}
 */
export async function updateVariantPrices(admin, changes) {
  // Group changes by productId because productVariantsBulkUpdate is per-product
  const byProduct = new Map();

  for (const change of changes) {
    const { productId, variantId, newPrice } = change;
    if (!productId || !variantId || !newPrice || Number(newPrice) <= 0) {
      continue;
    }

    const list = byProduct.get(productId) || [];
    list.push(change);
    byProduct.set(productId, list);
  }

  const mutation = `#graphql
    mutation BulkUpdateProductVariants(
      $productId: ID!
      $variants: [ProductVariantsBulkInput!]!
    ) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        product {
          id
        }
        productVariants {
          id
          price
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  let updated = 0;
  const errors = [];

  for (const [productId, productChanges] of byProduct.entries()) {
    try {
      const variantsInput = productChanges.map((c) => ({
        id: c.variantId,
        price: Number(c.newPrice).toFixed(2), // Decimal as string
      }));

      const res = await admin.graphql(mutation, {
        variables: {
          productId,
          variants: variantsInput,
        },
      });

      const json = await res.json();
      const result = json.data?.productVariantsBulkUpdate;
      const userErrors = result?.userErrors ?? [];

      if (userErrors.length > 0) {
        errors.push({
          productId,
          messages: userErrors
            .map(
              (e) =>
                `${Array.isArray(e.field) ? e.field.join(".") : ""}: ${
                  e.message
                }`,
            )
            .join(", "),
        });
      } else {
        // Count all variants for that product as updated
        updated += productChanges.length;
      }
    } catch (err) {
      errors.push({
        productId,
        messages: String(err?.message || err),
      });
    }
  }

  return {
    ok: errors.length === 0,
    updated,
    errors,
  };
}