import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useFavoritesStore } from '../store/favoritesStore';

export function FavoritesSync() {
  const profileId = useAuthStore((s) => s.profile?.id);
  const load = useFavoritesStore((s) => s.load);

  useEffect(() => {
    if (profileId) load(profileId);
  }, [profileId]);

  return null;
}
