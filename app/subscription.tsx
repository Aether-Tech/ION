import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SubscriptionScreen() {
    const router = useRouter();
    const { logout } = useAuth();
    const {
        isSubscribed,
        isLoading,
        products,
        requestSubscription,
        restorePurchases,
    } = useSubscription();

    const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');

    useEffect(() => {
        // Aguardar verificação completa antes de redirecionar para evitar flash/crash
        if (!isLoading && isSubscribed) {
            router.replace('/(tabs)/chat');
        }
    }, [isSubscribed, isLoading]);

    const handleSubscribe = async () => {
        const skuConfig = {
            monthly: 'ion_premium_monthly',
            yearly: 'ion_premium_yearly'
        };

        const targetSku = skuConfig[selectedPlan];

        // v14: produtos usam campo 'id', não 'productId'
        const product = products.find(p => (p.id === targetSku) || (p.productId === targetSku));

        if (product) {
            // Usar p.id (v14) com fallback para p.productId (versões antigas)
            await requestSubscription(product.id || product.productId);
        } else {
            Alert.alert(
                'Indisponível',
                'Não foi possível carregar os planos de assinatura. Verifique sua conexão com a internet e tente novamente.',
                [{ text: 'OK' }]
            );
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
            // Não navegar aqui — _layout.tsx detecta user=null e redireciona automaticamente.
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    // Helper to get price string safely
    // v14: produtos usam 'id', mas mantemos fallback para 'productId'
    const getPrice = (sku: string, defaultPrice: string) => {
        const product = products.find(p => (p.id === sku) || (p.productId === sku));
        return product ? (product as any).displayPrice || (product as any).localizedPrice || (product as any).price || defaultPrice : defaultPrice;
    };

    const monthlyPrice = getPrice('ion_premium_monthly', 'R$ 49,90');
    const yearlyPrice = getPrice('ion_premium_yearly', 'R$ 478,80');

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleLogout} style={styles.closeButton}>
                        <Ionicons name="close-circle-outline" size={28} color="#9CA3AF" />
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="star" size={50} color="#6366F1" />
                    </View>

                    <Text style={styles.title}>Desbloqueie o ION Premium</Text>
                    <Text style={styles.subtitle}>
                        Tenha acesso ilimitado a todas as funcionalidades e leve sua produtividade para o próximo nível.
                    </Text>

                    <View style={styles.featuresContainer}>
                        <FeatureItem text="Acesso ilimitado ao Chat IA" />
                        <FeatureItem text="Respostas mais rápidas e detalhadas" />
                        <FeatureItem text="Prioridade no suporte" />
                        <FeatureItem text="Sem anúncios" />
                    </View>

                    <View style={styles.plansContainer}>
                        {/* Monthly Plan */}
                        <TouchableOpacity
                            style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardSelected]}
                            onPress={() => setSelectedPlan('monthly')}
                        >
                            <View style={styles.planInfo}>
                                <Text style={styles.planName}>Plano Mensal</Text>
                                <Text style={styles.planPrice}>{monthlyPrice}</Text>
                                <Text style={styles.planPeriod}>Cobrado mensalmente</Text>
                            </View>
                            <View style={[styles.radioButton, selectedPlan === 'monthly' && styles.radioButtonSelected]}>
                                {selectedPlan === 'monthly' && <View style={styles.radioButtonInner} />}
                            </View>
                        </TouchableOpacity>

                        {/* Yearly Plan */}
                        <TouchableOpacity
                            style={[styles.planCard, selectedPlan === 'yearly' && styles.planCardSelected]}
                            onPress={() => setSelectedPlan('yearly')}
                        >
                            <View style={styles.savingsBadge}>
                                <Text style={styles.savingsText}>Economize 20%</Text>
                            </View>
                            <View style={styles.planInfo}>
                                <Text style={styles.planName}>Plano Anual</Text>
                                <Text style={styles.planPrice}>{yearlyPrice}</Text>
                                <Text style={styles.planPeriod}>Cobrado anualmente</Text>
                            </View>
                            <View style={[styles.radioButton, selectedPlan === 'yearly' && styles.radioButtonSelected]}>
                                {selectedPlan === 'yearly' && <View style={styles.radioButtonInner} />}
                            </View>
                        </TouchableOpacity>
                    </View>

                    {products.length === 0 && (
                        <Text style={styles.disclaimer}>*Preços estimados (Emulador)</Text>
                    )}
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.subscribeButton}
                    onPress={handleSubscribe}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={styles.subscribeButtonText}>
                            Assinar {selectedPlan === 'monthly' ? 'Mensalmente' : 'Anualmente'}
                        </Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.restoreButton}
                    onPress={() => restorePurchases()}
                    disabled={isLoading}
                >
                    <Text style={styles.restoreButtonText}>Restaurar Compras</Text>
                </TouchableOpacity>

                <Text style={styles.legalText}>
                    A assinatura é renovada automaticamente. Cancele a qualquer momento nas configurações da Google Play Store.
                </Text>
            </View>
        </SafeAreaView>
    );
}

function FeatureItem({ text }: { text: string }) {
    return (
        <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={24} color="#6366F1" />
            <Text style={styles.featureText}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    scrollContent: {
        paddingBottom: 100,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        padding: 16,
    },
    closeButton: {
        padding: 8,
    },
    content: {
        padding: 24,
        alignItems: 'center',
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 24,
    },
    featuresContainer: {
        width: '100%',
        marginBottom: 32,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    featureText: {
        fontSize: 15,
        color: '#374151',
        marginLeft: 12,
    },
    plansContainer: {
        width: '100%',
        gap: 16,
    },
    planCard: {
        width: '100%',
        padding: 20,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
    },
    planCardSelected: {
        borderColor: '#6366F1',
        backgroundColor: '#EEF2FF',
        borderWidth: 2,
    },
    planInfo: {
        flex: 1,
    },
    planName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    planPrice: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    planPeriod: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: 'normal',
    },
    savingsBadge: {
        position: 'absolute',
        top: -10,
        right: 20,
        backgroundColor: '#10B981',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    savingsText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    radioButton: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 16,
    },
    radioButtonSelected: {
        borderColor: '#6366F1',
    },
    radioButtonInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#6366F1',
    },
    disclaimer: {
        marginTop: 24,
        fontSize: 12,
        color: '#9CA3AF',
        textAlign: 'center',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        padding: 24,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    },
    subscribeButton: {
        backgroundColor: '#6366F1',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    subscribeButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    restoreButton: {
        alignItems: 'center',
        marginBottom: 16,
    },
    restoreButtonText: {
        color: '#6366F1',
        fontSize: 14,
        fontWeight: '600',
    },
    legalText: {
        fontSize: 10,
        color: '#9CA3AF',
        textAlign: 'center',
    },
});
