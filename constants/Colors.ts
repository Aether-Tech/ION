/**
 * Design System - Cores
 * Cores principais do app ION (Dark e Light Theme com Glassmorphism)
 */

// Cores base (sempre as mesmas)
export const BaseColors = {
  // Cores primárias
  primary: '#2b6cee',
  primaryDark: '#4D82F5',
  primaryLight: '#4D9FFF',
  ionBlue: '#00BFFF',
  
  // Cores de feedback
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
};

// Cores para modo escuro
const darkColors = {
  // Cores de fundo
  background: '#0A192F',
  backgroundSecondary: '#101622',
  backgroundTertiary: '#1c1f27',
  backgroundGradient: ['#0A192F', '#000000'],
  
  // Glassmorphism
  glassBackground: 'rgba(28, 31, 39, 0.5)',
  glassBackgroundLight: 'rgba(28, 31, 39, 0.4)',
  glassBorder: 'rgba(0, 191, 255, 0.1)',
  glassBorderPrimary: 'rgba(43, 108, 238, 0.1)',
  
  // Cores de texto
  textPrimary: '#E6F1FF',
  textSecondary: '#9da6b9',
  textTertiary: 'rgba(255, 255, 255, 0.6)',
  textInverse: '#FFFFFF',
  
  // Cores de borda
  border: 'rgba(255, 255, 255, 0.1)',
  borderLight: 'rgba(255, 255, 255, 0.05)',
  
  // Gradientes
  gradientPrimary: ['#0A192F', '#000000'],
  gradientSecondary: ['#2b6cee', '#00BFFF'],
};

// Cores para modo claro
const lightColors = {
  // Cores de fundo
  background: '#FFFFFF',
  backgroundSecondary: '#F6F6F8',
  backgroundTertiary: '#F0F0F2',
  backgroundGradient: ['#FFFFFF', '#F0F4FF'],
  
  // Glassmorphism (mais sutil no modo claro)
  glassBackground: 'rgba(255, 255, 255, 0.8)',
  glassBackgroundLight: 'rgba(255, 255, 255, 0.6)',
  glassBorder: 'rgba(43, 108, 238, 0.2)',
  glassBorderPrimary: 'rgba(43, 108, 238, 0.3)',
  
  // Cores de texto
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textTertiary: 'rgba(0, 0, 0, 0.6)',
  textInverse: '#FFFFFF',
  
  // Cores de borda
  border: 'rgba(0, 0, 0, 0.1)',
  borderLight: 'rgba(0, 0, 0, 0.05)',
  
  // Gradientes
  gradientPrimary: ['#FFFFFF', '#F0F4FF'],
  gradientSecondary: ['#2b6cee', '#00BFFF'],
};

// Função para obter cores baseadas no tema
export function getColors(isDark: boolean = true) {
  const themeColors = isDark ? darkColors : lightColors;
  return {
    ...BaseColors,
    ...themeColors,
    // Mantém compatibilidade com nomes antigos
    backgroundDark: themeColors.background,
    backgroundDarkSecondary: themeColors.backgroundSecondary,
    backgroundDarkTertiary: themeColors.backgroundTertiary,
  };
}

// Export padrão para compatibilidade (modo escuro)
export const Colors = getColors(true);

