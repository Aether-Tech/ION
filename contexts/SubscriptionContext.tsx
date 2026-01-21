import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform, Alert } from 'react-native';
// Safe import for IAP to avoid crashes if native modules are missing
let RNIap: any;
try {
    RNIap = require('react-native-iap');
} catch (err) {
    console.warn('RNIap could not be loaded (missing native modules?):', err);
    // Mock implementation
    RNIap = {
        initConnection: async () => { console.log('Mock IAP: initConnection'); return true; },
        endConnection: async () => { console.log('Mock IAP: endConnection'); },
        getProducts: async () => [],
        getSubscriptions: async () => [],
        getAvailablePurchases: async () => [],
        requestPurchase: async () => { throw new Error('IAP not available'); },
        requestSubscription: async () => { throw new Error('IAP not available'); },
        finishTransaction: async () => { },
        purchaseUpdatedListener: () => ({ remove: () => { } }),
        purchaseErrorListener: () => ({ remove: () => { } }),
    };
}
import AsyncStorage from '@react-native-async-storage/async-storage';

// Placeholder Product ID - Replace with real one from Play Console
const SUBSCRIPTION_SKUS = Platform.select({
    ios: ['ion_premium_monthly', 'ion_premium_yearly'],
    android: ['ion_premium_monthly', 'ion_premium_yearly'],
}) || [];

interface SubscriptionContextType {
    isSubscribed: boolean;
    isLoading: boolean;
    products: any[]; // Using any to avoid type mismatches
    requestSubscription: (sku: string) => Promise<void>;
    restorePurchases: () => Promise<void>;
    checkSubscriptionStatus: () => Promise<void>;
    simulateSubscription: (status: boolean) => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [products, setProducts] = useState<any[]>([]);

    useEffect(() => {
        initIAP();

        // Cleanup on unmount
        return () => {
            RNIap.endConnection();
        };
    }, []);

    const initIAP = async () => {
        try {
            const connect = await RNIap.initConnection();
            console.log('IAP Connected:', connect);

            await loadProducts();
            await checkSubscriptionStatus();

        } catch (err) {
            console.warn('IAP Init Error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const loadProducts = async () => {
        try {
            // Trying generic getProducts or getSubscriptions wrapped in any
            // @ts-ignore
            const items = await RNIap.getProducts({ skus: SUBSCRIPTION_SKUS });
            console.log('IAP Products loaded:', items);
            setProducts(items);
        } catch (err) {
            console.warn('IAP Load Products Error (retrying with getSubscriptions):', err);
            try {
                // @ts-ignore
                const items = await RNIap.getSubscriptions({ skus: SUBSCRIPTION_SKUS });
                setProducts(items);
            } catch (subErr) {
                console.warn('IAP Subscriptions Load Failed:', subErr);
            }
        }
    };

    const checkSubscriptionStatus = async () => {
        try {
            console.log('Checking subscription status...');

            // 1. Check cached status first for speed
            const cachedStatus = await AsyncStorage.getItem('isSubscribed');
            if (cachedStatus === 'true') {
                setIsSubscribed(true);
            }

            // 2. Mock check for implementation
            const mockStatus = await AsyncStorage.getItem('mock_isSubscribed');
            if (mockStatus === 'true') {
                setIsSubscribed(true);
                return;
            }

            // 3. Verify with Store
            const purchases = await RNIap.getAvailablePurchases();
            console.log('Available purchases:', purchases);

            let validSubscription = false;

            purchases.forEach((purchase: any) => {
                if (SUBSCRIPTION_SKUS.includes(purchase.productId)) {
                    validSubscription = true;
                }
            });

            setIsSubscribed(validSubscription);
            await AsyncStorage.setItem('isSubscribed', String(validSubscription));

        } catch (err) {
            console.warn('Check Subscription Error:', err);
        }
    };

    const requestSubscription = async (sku: string) => {
        try {
            setIsLoading(true);

            // MOCK MODE for Emulator or if no products
            if (products.length === 0) {
                console.log('No products found (Emulator?), using MOCK purchase');
                await simulateSubscription(true);
                Alert.alert('Modo de Teste', 'Assinatura simulada com sucesso!');
                return;
            }

            if (Platform.OS === 'ios') {
                // @ts-ignore
                await RNIap.requestPurchase({ sku });
            } else {
                // @ts-ignore
                await RNIap.requestSubscription({ sku });
            }

        } catch (err: any) {
            console.warn('Purchase Error:', err);
            Alert.alert('Erro na assinatura', err.message || 'Não foi possível completar a assinatura.');
        } finally {
            setIsLoading(false);
        }
    };

    const restorePurchases = async () => {
        try {
            setIsLoading(true);
            await checkSubscriptionStatus();
            Alert.alert('Restaurar', 'Compras restauradas com sucesso.');
        } catch (err: any) {
            Alert.alert('Erro', 'Falha ao restaurar compras.');
        } finally {
            setIsLoading(false);
        }
    };

    const simulateSubscription = async (status: boolean) => {
        setIsSubscribed(status);
        await AsyncStorage.setItem('isSubscribed', String(status));
        await AsyncStorage.setItem('mock_isSubscribed', String(status));
        console.log('Simulated Subscription:', status);
    };

    // Setup Listeners
    useEffect(() => {
        const purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(
            async (purchase: any) => {
                const receipt = purchase.transactionReceipt;
                if (receipt) {
                    console.log('Purchase successful!', purchase);
                    // Tell the store that we have delivered what has been paid for.
                    await RNIap.finishTransaction({ purchase, isConsumable: false });

                    setIsSubscribed(true);
                    await AsyncStorage.setItem('isSubscribed', 'true');
                }
            }
        );

        const purchaseErrorSubscription = RNIap.purchaseErrorListener(
            (error: any) => {
                console.warn('PurchaseErrorListener:', error);
                Alert.alert('Erro na compra', 'Ocorreu um erro ao processar o pagamento.');
            }
        );

        return () => {
            if (purchaseUpdateSubscription) {
                purchaseUpdateSubscription.remove();
            }
            if (purchaseErrorSubscription) {
                purchaseErrorSubscription.remove();
            }
        }
    }, []);

    return (
        <SubscriptionContext.Provider value={{
            isSubscribed,
            isLoading,
            products,
            requestSubscription,
            restorePurchases,
            checkSubscriptionStatus,
            simulateSubscription
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
