import { colors } from '../theme';
import type { OrderStatus } from '../types/order';

export const ORDER_STATUSES: OrderStatus[] = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'En attente',
  paid: 'Payée',
  processing: 'En préparation',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: colors.gold,
  paid: colors.success,
  processing: colors.gold,
  shipped: colors.goldLight,
  delivered: colors.success,
  cancelled: colors.red,
};
