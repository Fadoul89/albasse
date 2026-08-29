import { supabase } from './supabase';

export async function addFictionalReview(
  productId: string,
  authorName: string,
  rating: number,
  comment: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('reviews').insert({
    product_id: productId,
    user_id: null,
    author_name: authorName,
    rating,
    comment,
  });
  return { error: error?.message ?? null };
}

export async function deleteReview(reviewId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
  return { error: error?.message ?? null };
}
