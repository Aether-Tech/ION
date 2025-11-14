import React, { useState } from 'react';
import { View, StyleSheet, Text, Image, ImageSourcePropType } from 'react-native';

interface IONLogoProps {
  size?: number;
  showText?: boolean;
  variant?: 'icon' | 'full';
}

const logoImage = require('../assets/ion-logo.png') as ImageSourcePropType;

export function IONLogo({ size = 40, showText = false, variant = 'icon' }: IONLogoProps) {
  const initials = variant === 'full' ? 'ION' : 'I';
  const [failedToLoad, setFailedToLoad] = useState(false);
  const shouldShowLabel = showText || variant === 'full';
  const shouldShowFallback = failedToLoad;

  return (
    <View style={styles.container}>
      {shouldShowFallback ? (
        <View
          style={[
            styles.badge,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
        >
          <Text style={[styles.initials, { fontSize: size * 0.45 }]}>{initials}</Text>
        </View>
      ) : (
        <Image
          source={logoImage}
          onError={() => setFailedToLoad(true)}
          style={[
            styles.logo,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
          resizeMode="contain"
        />
      )}
      {shouldShowLabel && <Text style={styles.label}>ION</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    overflow: 'hidden',
  },
  badge: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#004AAD',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
});

