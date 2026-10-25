// Ce qui compte comme une vente dans les chiffres de l'administration (chiffre d'affaires, nombre de commandes, produits les plus vendus,
// performance par source, total par client) : seulement les commandes LIVRÉES, et jamais celles signalées comme fausses.
// Les commandes en attente, en préparation, expédiées ou annulées restent visibles dans la liste des commandes mais ne comptent pas.
export const countsAsSale = (o: { status: string; is_flagged_fake?: boolean | null }) => o.status === 'delivered' && !o.is_flagged_fake;

export const salesTotal = (orders: { status: string; is_flagged_fake?: boolean | null; total: number | string }[]) =>
  orders.filter(countsAsSale).reduce((sum, o) => sum + Number(o.total), 0);
