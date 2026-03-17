import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// react-native-iap v14 usa uma API completamente diferente da v12/v13:
// - getProducts/getSubscriptions → fetchProducts({ skus, type: 'subs' })
// - requestSubscription({ sku }) → requestPurchase({ request: { google: { skus, subscriptionOffers } }, type: 'subs' })
// - purchase.transactionReceipt → purchase.purchaseState === 'purchased' ou purchase.purchaseToken
import * as RNIap from 'react-native-iap';

const SUBSCRIPTION_SKUS = Platform.select({
    ios: ['ion_premium_monthly', 'ion_premium_yearly'],
    android: ['ion_premium_monthly', 'ion_premium_yearly'],
}) || [];

interface SubscriptionContextType {
    isSubscribed: boolean;
    isLoading: boolean;
    products: any[];
    requestSubscription: (sku: string) => Promise<void>;
    restorePurchases: () => Promise<void>;
    checkSubscriptionStatus: () => Promise<boolean | null>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [products, setProducts] = useState<any[]>([]);

    // Setup purchase event listeners ANTES do initConnection
    useEffect(() => {
        let purchaseUpdateSubscription: any = null;
        let purchaseErrorSubscription: any = null;

        try {
            purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(
                async (purchase: any) => {
                    __DEV__ && console.log('[IAP] Purchase updated:', purchase?.productId, 'state:', purchase?.purchaseState);

                    // v14: usa purchaseState ou purchaseToken (não mais transactionReceipt)
                    const isPurchased = purchase?.purchaseState === 'purchased' || !!purchase?.purchaseToken;

                    if (isPurchased) {
                        try {
                            // Finalizar transação para evitar re-entrega
                            await RNIap.finishTransaction({ purchase, isConsumable: false });
                        } catch (finishErr) {
                            console.warn('[IAP] finishTransaction error (non-fatal):', finishErr);
                        }
                        setIsSubscribed(true);
                        await AsyncStorage.setItem('isSubscribed', 'true');
                        __DEV__ && console.log('[IAP] Subscription activated!');
                    }
                }
            );

            purchaseErrorSubscription = RNIap.purchaseErrorListener(
                (error: any) => {
                    __DEV__ && console.warn('[IAP] Purchase error:', error?.code, error?.message);
                    // Ignorar cancelamento do usuário (não é um erro real)
                    if (error?.code !== 'E_USER_CANCELLED' && error?.code !== 'user-cancelled') {
                        Alert.alert('Erro na compra', 'Ocorreu um erro ao processar o pagamento.');
                    }
                }
            );
        } catch (listenerErr) {
            console.warn('[IAP] Failed to setup listeners:', listenerErr);
        }

        // Iniciar conexão IAP
        initIAP();

        return () => {
            purchaseUpdateSubscription?.remove();
            purchaseErrorSubscription?.remove();
            RNIap.endConnection().catch(() => { });
        };
    }, []);

    const initIAP = async () => {
        try {
            await RNIap.initConnection();
            __DEV__ && console.log('[IAP] Connection established');

            // Carregar produtos e verificar status em paralelo para performance
            await Promise.all([
                loadProducts(),
                checkSubscriptionStatus(),
            ]);
        } catch (err) {
            console.warn('[IAP] Init Error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const loadProducts = async () => {
        try {
            // v14 API: fetchProducts substitui getProducts e getSubscriptions
            const items = await RNIap.fetchProducts({
                skus: SUBSCRIPTION_SKUS,
                type: 'subs',
            });
            __DEV__ && console.log('[IAP] Products loaded:', items?.length);
            setProducts(items || []);
        } catch (err) {
            console.warn('[IAP] Load products error:', err);
        }
    };

    // Retorna true se assinatura válida, false se não, null se erro/cache
    const checkSubscriptionStatus = async (): Promise<boolean | null> => {
        try {
            __DEV__ && console.log('[IAP] Checking subscription status...');

            // 1. Cache primeiro para UI rápida
            const cachedStatus = await AsyncStorage.getItem('isSubscribed');
            if (cachedStatus === 'true') {
                setIsSubscribed(true);
            }

            // 2. Verificar na loja (try-catch separado para preservar cache em caso de erro)
            let purchases: any[] = [];
            try {
                purchases = await RNIap.getAvailablePurchases();
                __DEV__ && console.log('[IAP] Available purchases:', purchases?.length);
            } catch (storeErr) {
                console.warn('[IAP] Store unavailable, keeping cached status:', storeErr);
                return null; // Mantém valor do cache
            }

            // v14: verificar productId, purchaseState e isSuspended para confirmar assinatura ativa
            const validSubscription = purchases.some((purchase: any) =>
                SUBSCRIPTION_SKUS.includes(purchase.productId) &&
                !purchase.isSuspendedAndroid && // Excluir se pagamento falhou
                (purchase.purchaseState === 'purchased' || purchase.purchaseState === undefined)
                // purchaseState undefined em algumas versões = compra ativa
            );

            setIsSubscribed(validSubscription);
            await AsyncStorage.setItem('isSubscribed', String(validSubscription));
            __DEV__ && console.log('[IAP] Subscription valid:', validSubscription);
            return validSubscription;

        } catch (err) {
            console.warn('[IAP] Check subscription error:', err);
            return null;
        }
    };

    const requestSubscription = async (sku: string) => {
        try {
            setIsLoading(true);

            if (products.length === 0) {
                Alert.alert(
                    'Produtos Indisponíveis',
                    'Não foi possível carregar os planos. Verifique sua conexão e tente novamente.',
                );
                return;
            }

            // Encontrar o produto pelo SKU
            const product = products.find(
                (p: any) => p.id === sku || p.productId === sku
            );

            if (!product) {
                Alert.alert(
                    'Produto não encontrado',
                    'O plano selecionado não está disponível. Tente novamente.',
                );
                return;
            }

            if (Platform.OS === 'ios') {
                // v14 iOS: requestPurchase com request.apple.sku
                await RNIap.requestPurchase({
                    request: {
                        apple: { sku },
                    },
                    type: 'subs',
                } as any);
            } else {
                // v14 Android: OBRIGATÓRIO passar subscriptionOffers com offerToken
                const androidProduct = product as any;
                const offers: any[] = androidProduct?.subscriptionOfferDetailsAndroid || [];

                if (offers.length === 0) {
                    Alert.alert(
                        'Ofertas Indisponíveis',
                        'Não foi possível carregar as ofertas de assinatura. Tente novamente em alguns instantes.',
                    );
                    return;
                }

                // Usar todas as ofertas disponíveis (a primeira geralmente é a base/padrão)
                const subscriptionOffers = offers.map((offer: any) => ({
                    sku,
                    offerToken: offer.offerToken,
                }));

                await RNIap.requestPurchase({
                    request: {
                        google: {
                            skus: [sku],
                            subscriptionOffers,
                        },
                    },
                    type: 'subs',
                } as any);
            }

        } catch (err: any) {
            __DEV__ && console.warn('[IAP] requestSubscription error:', err?.code, err?.message);
            // Não mostrar erro se usuário cancelou
            if (err?.code !== 'E_USER_CANCELLED' && err?.code !== 'user-cancelled') {
                Alert.alert(
                    'Erro na assinatura',
                    err?.message || 'Não foi possível completar a assinatura. Tente novamente.',
                );
            }
        } finally {
            setIsLoading(false);
        }
    };

    const restorePurchases = async () => {
        try {
            setIsLoading(true);
            const result = await checkSubscriptionStatus();
            if (result === true) {
                Alert.alert('Sucesso', 'Assinatura restaurada com sucesso!');
            } else if (result === false) {
                Alert.alert('Nenhuma assinatura', 'Nenhuma assinatura ativa encontrada para esta conta.');
            }
            // result === null → erro de loja, não mostrar nada (já logado internamente)
        } catch (err: any) {
            Alert.alert('Erro', 'Falha ao restaurar compras. Tente novamente.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SubscriptionContext.Provider value={{
            isSubscribed,
            isLoading,
            products,
            requestSubscription,
            restorePurchases,
            checkSubscriptionStatus,
        }}>
            {children}
        </SubscriptionContext.Provider>
    );
}

export function useSubscription() {
    const context = useContext(SubscriptionContext);
    if (context === undefined) {
        throw new Error('useSubscription must be used within a SubscriptionProvider');
    }
    return context;
}
