# Configuração das Regras do Firestore

## ⚠️ Problema: "Missing or insufficient permissions"

Se você está vendo o erro `FirebaseError: Missing or insufficient permissions`, significa que as regras de segurança do Firestore não estão configuradas corretamente.

## 🔧 Como Configurar as Regras

### Passo 1: Acessar o Console do Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Selecione o projeto `ion-app-385dc`
3. No menu lateral, clique em **Firestore Database**

### Passo 2: Configurar as Regras

1. Clique na aba **Regras** (Rules) no topo da página
2. Você verá um editor de regras
3. **Substitua** o conteúdo atual pelas regras abaixo:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Regras para a coleção 'users'
    match /users/{userId} {
      // Permitir leitura e escrita apenas se:
      // 1. O usuário estiver autenticado (request.auth != null)
      // 2. O userId do documento corresponder ao uid do usuário autenticado
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

### Passo 3: Publicar as Regras

1. Clique no botão **Publicar** (Publish) no topo do editor
2. Aguarde a confirmação de que as regras foram publicadas

### Passo 4: Verificar

Após publicar, as regras devem funcionar imediatamente. Teste novamente o app.

## 📋 Explicação das Regras

### Regra Principal: `match /users/{userId}`

Esta regra aplica-se à coleção `users` onde cada documento tem um ID (`userId`).

**Condições:**
- `request.auth != null`: O usuário deve estar autenticado
- `request.auth.uid == userId`: O ID do documento deve corresponder ao ID do usuário autenticado

**Permissões:**
- `allow read, write`: Permite leitura e escrita
- `allow create`: Permite criar novos documentos (com validação adicional)
- `allow update`: Permite atualizar documentos existentes

### Regra de Segurança: `match /{document=**}`

Esta regra bloqueia acesso a todas as outras coleções que não sejam `users`, garantindo que apenas dados autorizados sejam acessíveis.

## 🧪 Testar as Regras

### Modo de Teste (Desenvolvimento)

Se você quiser testar rapidamente sem autenticação, pode usar regras temporárias (⚠️ **NÃO USE EM PRODUÇÃO**):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.time < timestamp.date(2025, 12, 31);
    }
  }
}
```

⚠️ **IMPORTANTE**: Estas regras permitem acesso total até 31/12/2025. Use apenas para desenvolvimento e teste!

## 🔒 Regras de Produção

Para produção, sempre use as regras restritivas que permitem acesso apenas aos próprios dados do usuário.

## 📝 Arquivo de Regras

As regras também estão salvas no arquivo `firestore.rules` na raiz do projeto para referência.

## ❓ Problemas Comuns

### Erro persiste após configurar regras

1. Verifique se você clicou em **Publicar**
2. Aguarde alguns segundos para as regras propagarem
3. Verifique se o usuário está realmente autenticado no Firebase
4. Verifique se o `uid` do documento corresponde ao `uid` do usuário autenticado

### Como verificar se o usuário está autenticado

Adicione um log temporário no código:

```typescript
import { auth } from './services/firebase';

console.log('User authenticated:', auth.currentUser?.uid);
```

### Regras não estão funcionando

1. Verifique a sintaxe das regras (use o botão "Validar" no editor)
2. Certifique-se de que está editando o banco de dados correto
3. Verifique se há erros de sintaxe no console do Firebase


