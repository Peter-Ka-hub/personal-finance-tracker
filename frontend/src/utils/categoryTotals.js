export const UNKNOWN_CATEGORY_NAME = "Nieznana kategoria";

export function groupCategoryTotals(transactions, categoriesById, type) {
  const groups = new Map();

  for (const transaction of transactions) {
    if (transaction.type !== type) continue;

    const category = categoriesById[transaction.categoryId];
    const id = category?.id ?? "unknown";
    if (!groups.has(id)) {
      groups.set(id, {
        id,
        name: category?.name ?? UNKNOWN_CATEGORY_NAME,
        color: category?.color,
        value: 0,
      });
    }
    groups.get(id).value += parseFloat(transaction.amount);
  }

  return [...groups.values()];
}
