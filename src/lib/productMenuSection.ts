type ProductRow = {
  sub_category?: string | null;
  product_sub_categories?: { id?: string; name?: string } | { id?: string; name?: string }[] | null;
  sub_categories?: { id?: string; name?: string; parent_id?: string | null } | null;
};

const MENU_OTHER = 'Autres';

export function normalizeMenuSectionKey(name: string): string {
  return String(name || MENU_OTHER)
    .toLowerCase()
    .trim() || MENU_OTHER;
}

export function resolveProductMenuSection(row: ProductRow): string {
  const psc = row.product_sub_categories;
  if (psc && typeof psc === 'object' && !Array.isArray(psc) && psc.name) {
    return String(psc.name).trim();
  }
  if (Array.isArray(psc) && psc[0]?.name) {
    return String(psc[0].name).trim();
  }
  if (row.sub_categories?.name) {
    return String(row.sub_categories.name).trim();
  }
  if (row.sub_category?.trim()) {
    return String(row.sub_category).trim();
  }
  return MENU_OTHER;
}

export interface MenuSectionGroup<T> {
  key: string;
  label: string;
  products: T[];
}

/** Regroupe les produits par section menu (clé normalisée, libellé d’origine). */
export function groupProductsByMenuSection<T extends { menuSection?: string }>(
  products: T[]
): MenuSectionGroup<T>[] {
  const map = new Map<string, MenuSectionGroup<T>>();

  for (const p of products) {
    const label = (p.menuSection || MENU_OTHER).trim() || MENU_OTHER;
    const key = normalizeMenuSectionKey(label);
    const existing = map.get(key);
    if (existing) {
      existing.products.push(p);
    } else {
      map.set(key, { key, label, products: [p] });
    }
  }

  const sections = Array.from(map.values());
  sections.sort((a, b) => {
    if (a.key === normalizeMenuSectionKey(MENU_OTHER)) return 1;
    if (b.key === normalizeMenuSectionKey(MENU_OTHER)) return -1;
    return a.label.localeCompare(b.label, 'fr');
  });
  return sections;
}

/** Onglets : uniquement les sections qui ont au moins un produit dans CE magasin. */
export function menuSectionsForStore<T extends { menuSection?: string }>(
  products: T[]
): MenuSectionGroup<T>[] {
  return groupProductsByMenuSection(products);
}

export { MENU_OTHER };
