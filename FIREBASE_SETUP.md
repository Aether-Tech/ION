# Configuração do Firebase

Este app utiliza o Firebase Authentication e Firestore para gerenciar usuários e autenticação.

## 1. Credenciais do Firebase

As credenciais do Firebase já estão configuradas no arquivo `services/firebase.ts`. Se necessário, você pode sobrescrever via variáveis de ambiente no arquivo `.env`:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyDmnxXzkIiwkN2oS6lvMRshNZ9Oa705K6w
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=ion-app-385dc.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=ion-app-385dc
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=ion-app-385dc.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=980123785790
EXPO_PUBLIC_FIREBASE_APP_ID=1:980123785790:web:f6034cf3c0d4cbb9a68f6f
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=G-22ZC23CC6G
```

## 2. Configuração no Console do Firebase

### 2.1. Habilitar Email/Password Authentication

1. Acesse o [Console do Firebase](https://console.firebase.google.com/)
2. Selecione o projeto `ion-app-385dc`
3. Vá em **Authentication** > **Sign-in method**
4. Habilite **Email/Password** como método de autenticação
5. Ative "Email link (passwordless sign-in)" se desejar (opcional)

### 2.2. Configurar Firestore Database

1. Vá em **Firestore Database**
2. Crie um banco de dados (modo de produção ou teste)
3. **⚠️ IMPORTANTE**: Configure as regras de segurança (veja `FIRESTORE_RULES_SETUP.md` para instruções detalhadas)

**Regras de Segurança (copie e cole no Firebase Console > Firestore > Regras):**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Regras para a coleção 'users'
    match /users/{userId} {
      // Permitir leitura e escrita apenas se o usuário estiver autenticado
      // e o userId do documento corresponder ao uid do usuário autenticado
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Permitir criação de documento
      allow create: if request.auth != null 
                    && request.auth.uid == userId
                    && request.resource.data.uid == userId;
      
      // Permitir atualização
      allow update: if request.auth != null 
                    && request.auth.uid == userId
                    && request.resource.data.uid == userId;
    }
    
    // Bloquear acesso a todas as outras coleções por padrão
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**⚠️ Se você ver o erro "Missing or insufficient permissions", siga as instruções em `FIRESTORE_RULES_SETUP.md`**

### 2.3. Estrutura da Coleção `users`

O Firestore armazena perfis de usuários na coleção `users` com a seguinte estrutura:

```typescript
{
  uid: string;                    // ID do usuário no Firebase Auth
  phoneNumber: string;            // Número de telefone
  displayName?: string;           // Nome do usuário
  email?: string;                 // Email do usuário
  photoURL?: string;              // URL da foto de perfil
  createdAt: Timestamp;          // Data de criação
  updatedAt: Timestamp;           // Data de atualização
  hasCompletedOnboarding: boolean; // Se completou o onboarding
}
```

## 3. Fluxo de Autenticação

### 3.1. Registro (Novo Usuário)

1. Usuário acessa tela de registro
2. Preenche nome, email e senha
3. Sistema cria conta no Firebase Authentication
4. Sistema detecta que é novo usuário (`hasCompletedOnboarding: false`)
5. Redireciona para tela de onboarding
6. Usuário visualiza slides explicativos
7. Usuário preenche número de telefone no último slide
8. Sistema salva telefone no Firestore e cria usuário no Supabase
9. Marca `hasCompletedOnboarding: true`
10. Redireciona para tela principal

### 3.2. Login de Usuário Existente

1. Usuário insere email e senha na tela de login
2. Firebase autentica com Email/Password
3. Sistema verifica perfil no Firestore
4. Se `hasCompletedOnboarding: true`, busca dados no Supabase usando o telefone
5. Redireciona para tela principal
6. Se `hasCompletedOnboarding: false`, redireciona para onboarding

## 4. Integração com Supabase

O app mantém sincronização entre Firebase e Supabase:

- **Firebase**: Autenticação (Email/Senha) e perfil básico do usuário (com telefone)
- **Supabase**: Dados completos do usuário (nome, email, status, etc.)

Quando um novo usuário completa o onboarding:
1. Email e senha são usados para autenticação no Firebase
2. Número de telefone é coletado durante o onboarding
3. Telefone é salvo no Firestore (`users/{uid}`)
4. Usuário é criado no Supabase com o telefone coletado
5. Número de telefone é vinculado em ambos os sistemas

## 5. Dependências Instaladas

- `firebase`: SDK do Firebase para web/React Native

## 6. Componentes Criados

- `components/Onboarding.tsx`: Componente de onboarding em slides
- `services/firestoreService.ts`: Serviço para gerenciar dados no Firestore
- `app/onboarding.tsx`: Tela de onboarding

## 7. Notas Importantes

- A autenticação é feita com **Email e Senha** (não mais Phone Auth)
- O número de telefone é obrigatório e é coletado durante o onboarding
- O número é usado para vincular o usuário entre Firebase e Supabase
- O onboarding só aparece para novos usuários (`hasCompletedOnboarding: false`)
- Usuários existentes que já completaram o onboarding não verão a tela novamente
- O telefone é necessário para as funcionalidades do app (lembretes, notificações, etc.)

