import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Circle, Path, G } from 'react-native-svg';
import { HugeIcon } from './HugeIcon';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Chat01Icon } from '@hugeicons/core-free-icons';
import { useAppColors } from '../hooks/useAppColors';

interface AnimatedChatIconProps {
  color: string;
  size?: number;
  focused?: boolean;
}

export function AnimatedChatIcon({ color, size = 32, focused = false }: AnimatedChatIconProps) {
  const Colors = useAppColors();
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const iconColorAnim = useRef(new Animated.Value(0)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const [waveValue, setWaveValue] = useState(0);

  useEffect(() => {
    // Animação de rotação contínua do gradiente
    const rotateAnimation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    );

    // Animação de pulso sutil
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );

    // Animação de cor do ícone (cicla entre as cores do gradiente)
    const colorAnimation = Animated.loop(
      Animated.timing(iconColorAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: false,
      })
    );

    // Animação de onda no outline
    const waveAnimation = Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 4000, // Aumentado de 2000 para 4000 (mais lento)
        useNativeDriver: false,
      })
    );

    // Listener para atualizar o valor da onda
    const waveListener = waveAnim.addListener(({ value }) => {
      setWaveValue(value);
    });

    rotateAnimation.start();
    pulseAnimation.start();
    waveAnimation.start();
    if (!focused) {
      colorAnimation.start();
    }

    return () => {
      rotateAnimation.stop();
      pulseAnimation.stop();
      colorAnimation.stop();
      waveAnimation.stop();
      waveAnim.removeListener(waveListener);
    };
  }, [focused]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Interpolar cor do ícone entre as cores do gradiente
  const iconColor = iconColorAnim.interpolate({
    inputRange: [0, 0.33, 0.66, 1],
    outputRange: [Colors.primary, Colors.ionBlue, Colors.primaryLight, Colors.primary],
  });

  const circleSize = size + 24; // Círculo maior que o ícone (aumentado para mais espaço)
  const radius = circleSize / 2;
  const baseStrokeWidth = 3.5; // Espessura base aumentada
  const waveAmplitude = 1.2; // Amplitude da onda (variação na espessura) - reduzida para manter espessura mínima maior
  const styles = getStyles(size);

  // Criar múltiplos segmentos do círculo com diferentes espessuras para o efeito de onda
  const numSegments = 120; // Muito mais segmentos para eliminar linhas visíveis
  const segmentAngle = (2 * Math.PI) / numSegments;

  // Função para criar um arco SVG suave e curvado
  const createArc = (startAngle: number, endAngle: number, strokeWidth: number, index: number) => {
    // Ajustar o raio para considerar a espessura média do stroke
    const arcRadius = radius - baseStrokeWidth / 2;
    
    // Converter ângulos para coordenadas (começando do topo, -Math.PI/2)
    const adjustedStartAngle = startAngle - Math.PI / 2;
    const adjustedEndAngle = endAngle - Math.PI / 2;
    
    const startX = radius + arcRadius * Math.cos(adjustedStartAngle);
    const startY = radius + arcRadius * Math.sin(adjustedStartAngle);
    const endX = radius + arcRadius * Math.cos(adjustedEndAngle);
    const endY = radius + arcRadius * Math.sin(adjustedEndAngle);
    
    // Usar sempre small arc (0) para manter as curvas suaves
    const largeArcFlag = 0;

    // Para o primeiro segmento (topo), garantir que comece exatamente no topo
    const isFirstSegment = index === 0;
    const adjustedStartX = isFirstSegment ? radius : startX;
    const adjustedStartY = isFirstSegment ? radius - arcRadius : startY;

    return (
      <Path
        key={index}
        d={`M ${adjustedStartX.toFixed(2)} ${adjustedStartY.toFixed(2)} A ${arcRadius.toFixed(2)} ${arcRadius.toFixed(2)} 0 ${largeArcFlag} 1 ${endX.toFixed(2)} ${endY.toFixed(2)}`}
        stroke="url(#gradient)"
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.98}
      />
    );
  };

  // Aumentar o container horizontalmente para evitar crop do efeito de onda
  const containerWidth = circleSize + 8; // Adicionar padding horizontal
  const containerHeight = circleSize;

  return (
    <View style={[styles.container, { width: containerWidth, height: containerHeight }]}>
      {/* Círculo com gradiente animado e efeito de onda (apenas outline) */}
      <Animated.View
        style={[
          styles.circleContainer,
          {
            width: circleSize,
            height: circleSize,
            transform: [{ rotate }],
          },
        ]}
      >
        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark">
          <Svg width={circleSize} height={circleSize}>
            <Defs>
            <SvgLinearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={Colors.primary} stopOpacity="1" />
              <Stop offset="1%" stopColor={Colors.primary} stopOpacity="1" />
              <Stop offset="25%" stopColor={Colors.primary} stopOpacity="0.95" />
              <Stop offset="33%" stopColor={Colors.ionBlue} stopOpacity="1" />
              <Stop offset="50%" stopColor={Colors.ionBlue} stopOpacity="0.95" />
              <Stop offset="66%" stopColor={Colors.primaryLight} stopOpacity="1" />
              <Stop offset="75%" stopColor={Colors.primaryLight} stopOpacity="0.95" />
              <Stop offset="99%" stopColor={Colors.primary} stopOpacity="1" />
              <Stop offset="100%" stopColor={Colors.primary} stopOpacity="1" />
            </SvgLinearGradient>
            </Defs>
            {Array.from({ length: numSegments }).map((_, index) => {
              const startAngle = index * segmentAngle;
              const endAngle = (index + 1) * segmentAngle;
              // Calcular a espessura baseada na posição para criar a onda
              const wavePhase = (index / numSegments + waveValue) * 2 * Math.PI;
              const waveSinValue = Math.sin(wavePhase * 2); // Duas ondas completas ao redor do círculo
              const currentStrokeWidth = Math.max(2.0, baseStrokeWidth + waveSinValue * waveAmplitude); // Garantir espessura mínima
              return createArc(startAngle, endAngle, currentStrokeWidth, index);
            })}
          </Svg>
        </BlurView>
      </Animated.View>

      {/* Ícone central */}
      <Animated.View
        style={[
          styles.iconContainer,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {focused ? (
          <HugeIcon name="chatbubbles" size={size} color="#FFFFFF" strokeWidth={1.5} />
        ) : (
          <HugeIcon name="chatbubbles" size={size} color={color} strokeWidth={1.5} />
        )}
      </Animated.View>
    </View>
  );
}

const getStyles = (iconSize: number) => StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'visible', // Permitir que o efeito seja visível além dos limites
  },
  circleContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconSvg: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

