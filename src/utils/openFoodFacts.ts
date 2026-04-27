export type FoodFactsResult =
  | {
      found: true;
      productName: string;
      servingDescription: string;
      caloriesPerServing: number;
      proteinPerServing: number;
      fatPerServing: number;
      carbsPerServing: number;
    }
  | {
      found: false;
      productName?: string; // present when the product exists but has no nutrition data
    };

export async function lookupBarcode(barcode: string): Promise<FoodFactsResult> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,serving_size,nutriments`;

  let data: any;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Forge-Trainer/1.0 (personal fitness app)' },
    });
    data = await res.json();
  } catch {
    throw new Error('Network error — check your connection and try again.');
  }

  if (data.status !== 1 || !data.product) {
    return { found: false };
  }

  const product = data.product;
  const n = product.nutriments ?? {};
  const productName: string = (product.product_name ?? '').trim();

  // Prefer per-serving values; fall back to per-100g
  const hasServing = n['energy-kcal_serving'] != null;
  const suffix = hasServing ? '_serving' : '_100g';
  const calories = n[`energy-kcal${suffix}`] ?? n[`energy-kj${suffix}`] != null
    ? n[`energy-kcal${suffix}`]
    : null;

  if (calories == null && n[`proteins${suffix}`] == null) {
    // Product found but no usable nutrition data
    return { found: false, productName: productName || undefined };
  }

  const servingDescription = hasServing
    ? ((product.serving_size ?? '').trim() || '1 serving')
    : '100 g';

  return {
    found: true,
    productName: productName || 'Unknown product',
    servingDescription,
    caloriesPerServing: Math.round(n[`energy-kcal${suffix}`] ?? 0),
    proteinPerServing: round1(n[`proteins${suffix}`] ?? 0),
    fatPerServing: round1(n[`fat${suffix}`] ?? 0),
    carbsPerServing: round1(n[`carbohydrates${suffix}`] ?? 0),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
