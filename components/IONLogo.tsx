import React from 'react';
import { View, StyleSheet, Image, ImageSourcePropType } from 'react-native';

interface IONLogoProps {
  size?: number;
  showText?: boolean;
  variant?: 'icon' | 'full';
}

const logoImage = require('../assets/ion-logo.png') as ImageSourcePropType;

export function IONLogo({ size = 40, showText = false, variant = 'icon' }: IONLogoProps) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Image
        source={logoImage}
        style={[styles.logo, { width: size, height: size }]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 9999,
    overflow: 'hidden',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
});

