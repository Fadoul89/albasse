import { useCallback, useMemo, useState } from 'react';
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { gridLayout, type GridLayout } from '../lib/productGrid';

// La grille des articles selon la largeur MESURÉE de la liste (onLayout) ; avant la mesure : la largeur de la fenêtre.
// pad : la marge de chaque côté de la liste (celle de son contentContainerStyle, ou 0 si la liste est déjà dans un cadre avec marge).
export function useProductGrid(pad?: number): GridLayout & { onLayout: (e: LayoutChangeEvent) => void } {
  const { width: windowWidth } = useWindowDimensions();
  const [measured, setMeasured] = useState<number | null>(null);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    setMeasured((prev) => (prev === w ? prev : w));
  }, []);
  const layout = useMemo(() => gridLayout(measured ?? windowWidth, { pad }), [measured, windowWidth, pad]);
  return { ...layout, onLayout };
}
