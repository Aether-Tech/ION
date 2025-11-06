import { useTheme } from '../contexts/ThemeContext';
import { getColors } from '../constants/Colors';

export function useAppColors() {
  const { isDark } = useTheme();
  return getColors(isDark);
}

