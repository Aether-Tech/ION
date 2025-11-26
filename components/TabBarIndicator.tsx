import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname } from 'expo-router';

interface TabBarIndicatorProps {
  tabCount: number;
  tabBarWidth: number;
}

const tabRoutes = ['shopping', 'finances', 'chat', 'calendar', 'profile'];

export function TabBarIndicator({ tabCount, tabBarWidth }: TabBarIndicatorProps) {
  const pathname = usePathname();
  
  // ===== DIMENSÕES DA BOLHA =====
  const bubbleWidth = 65;
  const bubbleHeight = 50;
  
  // ===== POSIÇÃO DA BOLHA - VALORES RELATIVOS À LARGURA DA NAVBAR =====
  // Estes valores são em porcentagem (0-100%) da largura total da navbar
  // A posição é calculada como: (valor / 100) * larguraDaNavbar
  // 
  // Exemplo: Se a navbar tem 300px de largura e o valor é 20%:
  //   Posição = (20 / 100) * 300 = 60px da parede esquerda
  //
  // Valores negativos movem a bolha para a esquerda (fora da navbar)
  // Valores acima de 100% movem a bolha para a direita (fora da navbar)
  //
  // ⚠️ EDITE ESTES VALORES PARA AJUSTAR A POSIÇÃO DA BOLHA ⚠️
  const positionPercentFromLeft = [
    2,   // shopping (índice 0) - posição relativa à largura da navbar
    20.5,    // finances (índice 1) - posição relativa à largura da navbar
    41,    // chat (índice 2) - posição relativa à largura da navbar
    61,    // calendar (índice 3) - posição relativa à largura da navbar
    79.5,    // profile (índice 4) - posição relativa à largura da navbar
  ];
  // ================================================================
  
  // Calcular posição inicial baseada na porcentagem
  const getInitialX = () => {
    const route = pathname.split('/').pop() || '';
    const index = tabRoutes.indexOf(route);
    const activeIndex = index >= 0 ? index : 0;
    // Posição = porcentagem * largura da navbar
    return (positionPercentFromLeft[activeIndex] / 100) * tabBarWidth;
  };
  
  const translateX = useRef(new Animated.Value(getInitialX())).current;
  const scaleY = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Extrair o nome da rota do pathname
    const route = pathname.split('/').pop() || '';
    const index = tabRoutes.indexOf(route);
    const activeIndex = index >= 0 ? index : 0;
    
    // Calcular posição baseada na porcentagem da parede esquerda
    const targetX = (positionPercentFromLeft[activeIndex] / 100) * tabBarWidth;

    console.log('TabBarIndicator - activeIndex:', activeIndex, 'tabBarWidth:', tabBarWidth, 'percent:', positionPercentFromLeft[activeIndex], 'targetX:', targetX);

    // Animação paralela: movimento horizontal + escala vertical
    Animated.parallel([
      // Afinar durante o movimento (scaleY menor) e voltar ao normal
      Animated.sequence([
        Animated.timing(scaleY, {
          toValue: 0.8, // Afina para 80% da altura (menos afinamento)
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleY, {
          toValue: 1, // Volta ao normal
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      // Movimento horizontal com bounce mais sutil
      Animated.spring(translateX, {
        toValue: targetX,
        useNativeDriver: true,
        tension: 65, // Aumentado para movimento mais direto
        friction: 10, // Aumentado para reduzir bounce
      }),
    ]).start();
  }, [pathname, tabBarWidth, tabCount, translateX, scaleY]);

  return (
    <Animated.View
      style={[
        styles.indicator,
        {
          transform: [
            { translateX },
            { scaleY },
          ],
        },
      ]}
    >
      <View style={styles.bubble}>
        <BlurView intensity={1} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(9, 14, 24, 0.1)', 'rgba(255, 255, 255, 0.08)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  indicator: {
    position: 'absolute',
    // ⚠️ POSIÇÃO VERTICAL - Ajuste este valor para mover a bolha para cima/baixo
    // Navbar tem 64px de altura, bolha tem 50px
    // top: 6 significa 6px do topo da navbar
    // Para centralizar: (64 - 50) / 2 = 7px
    top: 6,
    left: 0,
    // ⚠️ DIMENSÕES DA BOLHA - Ajuste estes valores para mudar o tamanho
    width: 65, // Largura da bolha
    height: 52, // Altura da bolha
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  bubble: {
    width: 65,
    height: 50,
    borderRadius: 20, // Navbar tem 28, então 20 fica levemente menor e mais arredondado (bolha)
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(15,20,30,0.00)',
  },
});

