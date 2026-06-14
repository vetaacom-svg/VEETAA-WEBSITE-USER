export interface SubCategoryRow {
  id: string;
  name: string;
  category_id: string;
  parent_id?: string | null;
  created_at?: string;
}

export interface SubCategoryNode {
  id: string;
  name: string;
  categoryId: string;
  children: SubCategoryNode[];
}

export function normalizeSubCategoryName(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .trim();
}

/** Arbre : racines (parent_id null) + enfants. */
export function buildSubCategoryTree(rows: SubCategoryRow[], categoryId: string): SubCategoryNode[] {
  const normCat = normalizeSubCategoryName(categoryId);
  const scoped = rows.filter((r) => normalizeSubCategoryName(r.category_id) === normCat);
  const byId = new Map<string, SubCategoryNode>();

  for (const r of scoped) {
    byId.set(r.id, {
      id: r.id,
      name: r.name,
      categoryId: r.category_id,
      children: [],
    });
  }

  const roots: SubCategoryNode[] = [];
  for (const r of scoped) {
    const node = byId.get(r.id)!;
    const parentId = r.parent_id?.trim();
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: SubCategoryNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}

/** Sous-catégories sans parent (affichage niveau 1). */
export function flatSubCategoriesForCategory(rows: SubCategoryRow[], categoryId: string): SubCategoryRow[] {
  const tree = buildSubCategoryTree(rows, categoryId);
  if (tree.length > 0) return tree.map((n) => ({ id: n.id, name: n.name, category_id: n.categoryId }));

  return rows
    .filter((r) => normalizeSubCategoryName(r.category_id) === normalizeSubCategoryName(categoryId))
    .filter((r) => !r.parent_id);
}

export function childSubCategories(
  rows: SubCategoryRow[],
  categoryId: string,
  parentId: string | null
): SubCategoryRow[] {
  if (!parentId) return [];
  const normParent = parentId.trim();
  const fromDb = rows.filter(
    (r) =>
      normalizeSubCategoryName(r.category_id) === normalizeSubCategoryName(categoryId) &&
      String(r.parent_id || '').trim() === normParent
  );
  if (fromDb.length > 0) return fromDb;

  const tree = buildSubCategoryTree(rows, categoryId);
  const parent = tree.find((n) => n.id === normParent);
  if (!parent?.children.length) return [];
  return parent.children.map((c) => ({
    id: c.id,
    name: c.name,
    category_id: c.categoryId,
    parent_id: normParent,
  }));
}

/** Noms à matcher sur store.sub_category (parent + tous ses enfants). */
export function subCategoryMatchNames(
  rows: SubCategoryRow[],
  categoryId: string,
  selected: { id: string; name: string; isChild: boolean }
): string[] {
  const norm = normalizeSubCategoryName(selected.name);
  if (!selected.isChild) {
    const kids = childSubCategories(rows, categoryId, selected.id);
    if (kids.length > 0) {
      return [norm, ...kids.map((k) => normalizeSubCategoryName(k.name))];
    }
    return [norm];
  }
  return [norm];
}

export function storeMatchesSubCategoryFilter(
  storeSubCategory: unknown,
  allowedNames: string[]
): boolean {
  if (allowedNames.length === 0) return true;
  const s = normalizeSubCategoryName(storeSubCategory);
  return allowedNames.some((n) => n === s);
}
