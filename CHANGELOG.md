# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

## [1.1.0] - 2025-01-XX

### ✨ Adicionado

#### Autenticação e Firebase
- **Integração com Firebase Authentication**
  - Autenticação com Email/Senha
  - Migração de Phone Auth para Email/Password
  - Persistência de sessão com AsyncStorage
  
- **Integração com Firestore**
  - Armazenamento de perfis de usuário no Firestore
  - Coleção `users` com estrutura completa
  - Sincronização entre Firebase e Supabase
  - Serviço `firestoreService.ts` para gerenciamento de dados

- **Sistema de Onboarding**
  - Componente de onboarding em slides (`components/Onboarding.tsx`)
  - Tela de onboarding (`app/onboarding.tsx`)
  - 4 slides explicativos sobre funcionalidades do app
  - Coleta de número de telefone no último slide
  - Validação de formato de telefone brasileiro
  - Fluxo automático para novos usuários
  - Flag `hasCompletedOnboarding` para controlar exibição

#### Documentação
- **FIREBASE_SETUP.md** - Guia completo de configuração do Firebase
  - Instruções de configuração do Firebase Console
  - Configuração de Email/Password Authentication
  - Configuração do Firestore Database
  - Estrutura da coleção `users`
  - Fluxo de autenticação detalhado
  - Integração com Supabase

- **FIRESTORE_RULES_SETUP.md** - Guia de configuração das regras de segurança
  - Solução para erro "Missing or insufficient permissions"
  - Regras de segurança para coleção `users`
  - Instruções passo a passo
  - Explicação das regras implementadas

- **firestore.rules** - Arquivo com regras de segurança do Firestore
  - Regras restritivas para produção
  - Acesso apenas aos próprios dados do usuário
  - Validação de autenticação

### 🎨 Melhorado

#### Interface do Usuário
- **Bottom Navigation Bar**
  - Altura aumentada para 70px + safe area insets
  - Padding ajustado para melhor espaçamento
  - Ícones maiores (32px) para melhor visibilidade
  - `marginTop` nos ícones para melhor alinhamento
  - Posicionamento absoluto ajustado

- **Tela de Chat**
  - Input de mensagem posicionado acima da navbar
  - Margem inferior calculada dinamicamente
  - Respeita altura da navbar quando teclado está fechado
  - Espaçamento otimizado para não ser coberto pela navbar

- **Tela de Finanças**
  - FAB "Nova Transação" posicionado acima da navbar
  - Modal de nova transação com padding inferior ajustado
  - Respeita altura da navbar em todos os estados
  - Melhor experiência visual sem sobreposições

#### Autenticação
- **AuthContext**
  - Integração com Firebase Authentication
  - Verificação de estado de onboarding
  - Redirecionamento automático baseado em estado
  - Sincronização com Supabase após onboarding
  - Gerenciamento de sessão melhorado

- **Fluxo de Autenticação**
  - Registro com Email/Senha
  - Login com Email/Senha
  - Detecção automática de novos usuários
  - Redirecionamento para onboarding quando necessário
  - Criação de usuário no Supabase após onboarding

### 🔧 Mudanças Técnicas

#### Dependências
- Adicionado `firebase` para autenticação e Firestore
- Configuração de persistência com AsyncStorage

#### Estrutura de Arquivos
- `services/firebase.ts` - Configuração e inicialização do Firebase
- `services/firestoreService.ts` - Serviços para gerenciar dados no Firestore
- `components/Onboarding.tsx` - Componente reutilizável de onboarding
- `app/onboarding.tsx` - Tela de onboarding
- `firestore.rules` - Regras de segurança do Firestore

#### Arquivos Modificados
- `contexts/AuthContext.tsx` - Integração com Firebase
- `app/index.tsx` - Lógica de redirecionamento baseada em onboarding
- `app/login.tsx` - Migração para Email/Password
- `app/register.tsx` - Migração para Email/Password
- `app/(tabs)/_layout.tsx` - Ajustes na bottom navigation bar
- `app/(tabs)/chat.tsx` - Ajuste de posicionamento do input
- `app/(tabs)/finances.tsx` - Ajuste de posicionamento do FAB e modal
- `app/_layout.tsx` - Rota de onboarding adicionada
- `README.md` - Documentação atualizada

### 📝 Documentação

- README.md atualizado com:
  - Seção sobre Firebase
  - Links para documentação de setup
  - Estrutura de arquivos atualizada
  - Lista de funcionalidades atualizada

### 🔒 Segurança

- Regras de segurança do Firestore implementadas
- Acesso restrito apenas aos próprios dados do usuário
- Validação de autenticação em todas as operações
- Documentação de boas práticas de segurança

---

## [1.0.0] - 2025-01-XX

### ✨ Funcionalidades Iniciais
- Chat com IA
- Sistema de lembretes
- Controle de finanças
- Calendário
- Perfil do usuário
- Autenticação inicial

[Unreleased]: https://github.com/Aether-Tech/ION/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/Aether-Tech/ION/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Aether-Tech/ION/releases/tag/v1.0.0


