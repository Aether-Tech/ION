import { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { HugeIcon } from './HugeIcon';
import { useAppColors } from '../hooks/useAppColors';
import { IONLogo } from './IONLogo';

const { width } = Dimensions.get('window');

interface WelcomeSlide {
    title: string;
    description: string;
    icon: string;
    color: string;
}

const slides: WelcomeSlide[] = [
    {
        title: 'Bem-vindo ao ION',
        description: 'Sua assistente pessoal inteligente que te ajuda a organizar sua vida de forma simples e eficiente.',
        icon: 'sparkles',
        color: '#00BFFF',
    },
    {
        title: 'Tarefas e Lembretes',
        description: 'Gerencie suas tarefas e receba lembretes inteligentes no melhor horário para você.',
        icon: 'checkmark-circle',
        color: '#6366F1',
    },
    {
        title: 'Controle Financeiro',
        description: 'Acompanhe suas finanças, receitas e despesas de forma organizada e visual.',
        icon: 'wallet',
        color: '#10B981',
    },
    {
        title: 'Lista de Compras',
        description: 'Organize suas compras e nunca mais esqueça de comprar algo importante.',
        icon: 'cart',
        color: '#F59E0B',
    },
    {
        title: 'Chat Inteligente',
        description: 'Converse com a ION e receba sugestões personalizadas para melhorar seu dia a dia.',
        icon: 'chatbubbles',
        color: '#8B5CF6',
    },
];

export function WelcomeIntro() {
    const router = useRouter();
    const Colors = useAppColors();
    const [currentSlide, setCurrentSlide] = useState(0);
    const scrollViewRef = useRef<ScrollView>(null);

    const handleNext = () => {
        if (currentSlide < slides.length) {
            const nextSlide = currentSlide + 1;
            setCurrentSlide(nextSlide);
            scrollViewRef.current?.scrollTo({
                x: nextSlide * width,
                animated: true,
            });
        }
    };

    const handlePrevious = () => {
        if (currentSlide > 0) {
            const previousSlide = currentSlide - 1;
            setCurrentSlide(previousSlide);
            scrollViewRef.current?.scrollTo({
                x: previousSlide * width,
                animated: true,
            });
        }
    };

    const handleLogin = () => {
        router.replace('/login');
    };

    const handleRegister = () => {
        router.replace('/register');
    };

    const styles = getStyles(Colors);

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={Colors.backgroundGradient as any}
                style={StyleSheet.absoluteFill}
            />

            {/* Header com botão de Entrar/Pular */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.skipButton} onPress={handleLogin}>
                    <Text style={styles.skipButtonText}>Entrar</Text>
                    <HugeIcon name="arrow-right-01" size={16} color={Colors.primary} strokeWidth={2} />
                </TouchableOpacity>
            </View>

            {/* Indicadores de slide */}
            <View style={styles.indicators}>
                {slides.map((_, index) => (
                    <View
                        key={index}
                        style={[
                            styles.indicator,
                            index === currentSlide && styles.indicatorActive,
                        ]}
                    />
                ))}
                {/* Indicador para o slide final (Ação) */}
                <View
                    style={[
                        styles.indicator,
                        currentSlide === slides.length && styles.indicatorActive,
                    ]}
                />
            </View>

            {/* Slides */}
            <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEnabled={false}
                style={styles.scrollView}
            >
                {slides.map((slide, index) => (
                    <View key={index} style={styles.slide}>
                        <View style={styles.slideContent}>
                            <View style={[styles.iconContainer, { backgroundColor: `${slide.color}20` }]}>
                                <HugeIcon name={slide.icon as any} size={64} color={slide.color} strokeWidth={2} />
                            </View>
                            <Text style={styles.slideTitle}>{slide.title}</Text>
                            <Text style={styles.slideDescription}>{slide.description}</Text>
                        </View>
                    </View>
                ))}

                {/* Último slide com Ações (Criar Conta / Entrar) */}
                <View style={styles.slide}>
                    <View style={styles.slideContent}>
                        <View style={[styles.iconContainer, { backgroundColor: `${Colors.ionBlue}20` }]}>
                            <IONLogo size={80} />
                        </View>
                        <Text style={styles.slideTitle}>Pronto para começar?</Text>
                        <Text style={styles.slideDescription}>
                            Crie uma conta para sincronizar seus dados ou entre se já tiver uma.
                        </Text>

                        <View style={styles.actionContainer}>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.primaryButton]}
                                onPress={handleRegister}
                            >
                                <Text style={styles.primaryButtonText}>Criar conta</Text>
                                <HugeIcon name="user-add" size={20} color={Colors.textInverse} strokeWidth={2} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionButton, styles.secondaryButton]}
                                onPress={handleLogin}
                            >
                                <Text style={styles.secondaryButtonText}>Já tenho uma conta</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* Botões de navegação (Apenas para deslizar entre slides, some no último) */}
            {currentSlide < slides.length && (
                <View style={styles.navigation}>
                    {currentSlide > 0 ? (
                        <TouchableOpacity
                            style={styles.navButton}
                            onPress={handlePrevious}
                        >
                            <HugeIcon name="chevron-back" size={24} color={Colors.textPrimary} strokeWidth={1.5} />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.navSpacer} /> // Placeholder para manter alinhamento
                    )}

                    <TouchableOpacity
                        style={[styles.navButton, styles.navButtonPrimary]}
                        onPress={handleNext}
                    >
                        <HugeIcon name="chevron-forward" size={24} color={Colors.textInverse} strokeWidth={1.5} />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

function getStyles(Colors: ReturnType<typeof useAppColors>) {
    return StyleSheet.create({
        container: {
            flex: 1,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            paddingHorizontal: 24,
            paddingTop: 60,
            zIndex: 100,
            elevation: 10,
        },
        skipButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 20,
            backgroundColor: Colors.glassBackground,
            borderWidth: 1,
            borderColor: Colors.glassBorder,
        },
        skipButtonText: {
            fontSize: 14,
            fontWeight: '600',
            color: Colors.primary,
        },
        indicators: {
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            paddingTop: 40,
            paddingBottom: 20,
            gap: 8,
        },
        indicator: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: Colors.textSecondary,
            opacity: 0.3,
        },
        indicatorActive: {
            width: 24,
            backgroundColor: Colors.ionBlue,
            opacity: 1,
        },
        scrollView: {
            flex: 1,
        },
        slide: {
            width,
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 32,
        },
        slideContent: {
            alignItems: 'center',
            maxWidth: 400,
            width: '100%',
        },
        iconContainer: {
            width: 140,
            height: 140,
            borderRadius: 70,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 40,
        },
        slideTitle: {
            fontSize: 32,
            fontWeight: 'bold',
            color: Colors.textPrimary,
            textAlign: 'center',
            marginBottom: 16,
        },
        slideDescription: {
            fontSize: 18,
            color: Colors.textSecondary,
            textAlign: 'center',
            lineHeight: 28,
            marginBottom: 32,
        },
        actionContainer: {
            width: '100%',
            gap: 16,
            marginTop: 20,
        },
        actionButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            paddingVertical: 16,
            paddingHorizontal: 24,
            borderRadius: 16,
        },
        primaryButton: {
            backgroundColor: Colors.primary,
            shadowColor: Colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
        },
        secondaryButton: {
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderColor: Colors.border,
        },
        primaryButtonText: {
            fontSize: 18,
            fontWeight: 'bold',
            color: Colors.textInverse,
        },
        secondaryButtonText: {
            fontSize: 18,
            fontWeight: '600',
            color: Colors.textPrimary,
        },
        navigation: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 32,
            paddingBottom: 50,
            paddingTop: 20,
        },
        navSpacer: {
            width: 56, // Same size as navButton
        },
        navButton: {
            width: 56,
            height: 56,
            borderRadius: 28,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: Colors.backgroundDarkTertiary,
            borderWidth: 1,
            borderColor: Colors.border,
        },
        navButtonPrimary: {
            backgroundColor: Colors.primary,
            borderColor: Colors.primary,
        },
    });
}
