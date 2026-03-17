const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } = require('firebase/auth');

// Configuração clonada de services/firebase.ts para rodar no Node independentemente
const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDmnxXzkIiwkN2oS6lvMRshNZ9Oa705K6w',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'ion-app-385dc.firebaseapp.com',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'ion-app-385dc',
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'ion-app-385dc.firebasestorage.app',
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '980123785790',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:980123785790:web:f6034cf3c0d4cbb9a68f6f',
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-22ZC23CC6G',
};

// Credenciais de teste
const TEST_EMAIL = "review@ionapp.ai";
const TEST_PASSWORD = "Ion@Review2026";

async function main() {
    console.log('🔌 Inicializando Firebase com config de Produção...');
    console.log('📦 Project ID:', firebaseConfig.projectId);

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);

    console.log(`\n🔑 Tentando login como: ${TEST_EMAIL}`);

    try {
        const userCredential = await signInWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD);
        console.log('✅ LOGIN SUCESSO! O usuário existe e a senha está correta.');
        console.log('🆔 UID:', userCredential.user.uid);
        console.log('📧 Email Verified:', userCredential.user.emailVerified);
        console.log('\n👍 Tudo pronto. Você pode responder ao Google com essas credenciais.');
    } catch (error) {
        console.log('❌ Login falhou:', error.code, error.message);

        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            console.log('\n⚠️ Usuário não encontrado. Tentando criar...');
            try {
                const newUser = await createUserWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD);
                console.log('✅ USUÁRIO CRIADO COM SUCESSO!');
                console.log('🆔 UID:', newUser.user.uid);
                console.log('\n👍 Agora as credenciais são válidas.');
            } catch (createError) {
                if (createError.code === 'auth/email-already-in-use') {
                    // Isso acontece se a senha estava errada no login, mas o email existe
                    console.log('\n🛑 O usuário JÁ EXISTE, mas a senha estava INCORRETA no passo anterior.');
                    console.log('👉 Ação necessária: Vá no Firebase Console -> Authentication, encontre esse email e DELETE o usuário, ou mude a senha manualmente.');
                } else {
                    console.error('❌ Erro ao criar usuário:', createError);
                }
            }
        } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-login-credentials') {
            // Firebase as vezes retorna invalid-login-credentials para senha errada
            console.log('\n🛑 O usuário existe, mas a senha está INCORRETA.');
            console.log(`Senha tentada: ${TEST_PASSWORD}`);
            console.log('👉 Ação necessária: Vá no Firebase Console -> Authentication e resete a senha ou delete o usuário para recriar.');
        } else {
            console.error('\n❌ Erro desconhecido:', error);
        }
    }
}

main().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
