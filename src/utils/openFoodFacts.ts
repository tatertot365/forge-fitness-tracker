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
      headers: { 'User-Agent': 'Forge/1.0 (https://forge.tatertot365.com)' },
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
  const hasServing = n['energy-kcal_serving'] != null || n['energy-kj_serving'] != null;
  const suffix = hasServing ? '_serving' : '_100g';
  const kcal = n[`energy-kcal${suffix}`];
  const kj = n[`energy-kj${suffix}`];
  const calories = kcal != null ? kcal : kj != null ? kj / 4.184 : null;

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
    caloriesPerServing: Math.round(calories ?? 0),
    proteinPerServing: round1(n[`proteins${suffix}`] ?? 0),
    fatPerServing: round1(n[`fat${suffix}`] ?? 0),
    carbsPerServing: round1(n[`carbohydrates${suffix}`] ?? 0),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ─── Text search ───────────────────────────────────────────────────────
//
// Uses Search-a-licious (search.openfoodfacts.org), NOT the endpoints that
// look like the obvious choice:
//   - cgi/search.pl returns 503 consistently; it is retired.
//   - /api/v2/search accepts `search_terms` but silently IGNORES it, answering
//     200 with the entire database (4.6M hits) in arbitrary order. That failure
//     is invisible without checking relevance, so do not "simplify" to it.
//
// Search hits carry only per-100g nutrition -- no serving_size, even when
// requested -- so every result is expressed per 100 g and the caller is
// responsible for portioning.

export type FoodSearchItem = {
  code: string;
  name: string;
  brand: string | null;
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
};

export async function searchFoodDatabase(
  query: string,
  pageSize = 25,
): Promise<FoodSearchItem[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url =
    `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}` +
    `&page_size=${pageSize}`;

  let data: any;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Forge/1.0 (https://forge.tatertot365.com)' },
    });
    if (!res.ok) {
      throw new Error(`Search unavailable (${res.status}).`);
    }
    data = await res.json();
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Search unavailable')) throw e;
    throw new Error('Network error — check your connection and try again.');
  }

  const hits: any[] = Array.isArray(data?.hits) ? data.hits : [];
  const out: FoodSearchItem[] = [];
  for (const h of hits) {
    const n = h?.nutriments ?? {};
    const kcal = n['energy-kcal_100g'];
    const kj = n['energy_100g'];
    const calories = kcal != null ? kcal : kj != null ? kj / 4.184 : null;
    // Roughly one hit in ten carries no nutrition at all. Showing those means
    // tapping a result and silently logging zeroes.
    if (calories == null) continue;

    const name = typeof h?.product_name === 'string' ? h.product_name.trim() : '';
    if (!name) continue;

    // `brands` comes back as an array from this endpoint but as a
    // comma-joined string elsewhere in the API.
    const rawBrand = h?.brands;
    const brand = Array.isArray(rawBrand)
      ? rawBrand[0] ?? null
      : typeof rawBrand === 'string' && rawBrand.trim() !== ''
        ? rawBrand.split(',')[0].trim()
        : null;

    out.push({
      code: String(h?.code ?? ''),
      name,
      brand,
      caloriesPer100g: Math.round(calories),
      proteinPer100g: round1(n['proteins_100g'] ?? 0),
      fatPer100g: round1(n['fat_100g'] ?? 0),
      carbsPer100g: round1(n['carbohydrates_100g'] ?? 0),
    });
  }
  return out;
}
