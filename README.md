# ION - Assistente Pessoal Inteligente

<div align="center">

![ION Logo](assets/ion-logo.png)

**Sua assistente pessoal inteligente em um aplicativo mobile completo**

[![React Native](https://img.shields.io/badge/React%20Native-0.81.5-61DAFB?logo=react)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-~54.0.0-000020?logo=expo)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-2.79.0-3ECF8E?logo=supabase)](https://supabase.com/)

</div>

---

## 📱 Sobre o Projeto

O **ION** é uma aplicação mobile desenvolvida para Android e iOS que oferece todas as funcionalidades da assistente pessoal inteligente ION, anteriormente disponível via WhatsApp. O aplicativo proporciona uma experiência completa e intuitiva para gerenciar sua vida pessoal e profissional.

### ✨ Principais Funcionalidades

- 💬 **Chat Inteligente com IA** - Converse naturalmente com a ION através de texto, áudio, imagens e documentos
- 📅 **Gerenciamento de Calendário** - Organize eventos, reuniões e compromissos com visualização mensal
- ⏰ **Sistema de Lembretes** - Crie e gerencie lembretes com recorrência personalizada
- 💰 **Controle Financeiro** - Acompanhe receitas e despesas com categorização e relatórios
- 🛒 **Listas de Compras** - Organize suas compras por categorias
- 👤 **Perfil Personalizado** - Gerencie suas informações e configurações

---

## 🛠️ Tecnologias Utilizadas

### Core
- **React Native** 0.81.5 - Framework mobile multiplataforma
- **Expo** ~54.0.0 - Plataforma de desenvolvimento e build
- **TypeScript** 5.9.2 - Tipagem estática para maior segurança

### Navegação e UI
- **Expo Router** ~6.0.14 - Roteamento baseado em arquivos
- **React Navigation** 7.x - Sistema de navegação
- **Expo Linear Gradient** - Gradientes e efeitos visuais
- **Expo Blur** - Efeitos de blur e glassmorphism

### Backend e Storage
- **Supabase** 2.79.0 - Backend as a Service (BaaS)
- **AsyncStorage** - Persistência local de dados

### Funcionalidades
- **Expo AV** - Reprodução e gravação de áudio
- **Expo Image Picker** - Seleção de imagens da galeria/câmera
- **Expo Document Picker** - Seleção de documentos
- **React Native Calendars** - Componente de calendário
- **date-fns** - Manipulação e formatação de datas

---

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js** (versão 18 ou superior)
- **npm** ou **yarn**
- **Expo CLI** (`npm install -g expo-cli`)
- **Git**

### Para Android
- **Android Studio** e **Android SDK**
- **Java Development Kit (JDK)**

### Para iOS (apenas macOS)
- **Xcode** (versão mais recente)
- **CocoaPods** (`sudo gem install cocoapods`)

### Recomendado
- **Watchman** (`brew install watchman`) - Melhora a performance do Metro bundler

---

## 🚀 Instalação

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/Aether-Tech/ION.git
   cd ION
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente:**
   
   Crie um arquivo `.env` na raiz do projeto:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima_aqui
   ```
   
   > 📖 Para mais detalhes sobre configuração do Supabase, consulte [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

4. **Configure os assets:**
   
   Adicione os seguintes arquivos na pasta `assets/`:
   - `icon.png` - Ícone do app (1024x1024px)
   - `splash.png` - Tela de splash (1284x2778px)
   - `adaptive-icon.png` - Ícone adaptativo Android (1024x1024px)
   - `favicon.png` - Favicon para web (48x48px)

---

## ⚙️ Configuração

### Configuração do Supabase

O app utiliza o Supabase como backend. Siga os passos em [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) para:

1. Criar um projeto no Supabase
2. Configurar as tabelas do banco de dados
3. Configurar políticas de segurança (RLS)
4. Configurar Storage para fotos de perfil

### Configuração do Storage

Para habilitar upload de arquivos, consulte [STORAGE_SETUP.md](./STORAGE_SETUP.md).

---

## ▶️ Executando o Projeto

### ⚠️ Resolvendo o erro "EMFILE: too many open files"

Este erro acontece porque o macOS tem um limite baixo de arquivos abertos. Use uma das soluções abaixo:

**Solução Rápida (Recomendada):**
```bash
# Use o script wrapper que já configura tudo automaticamente
./start.sh              # Modo tunnel (funciona em qualquer rede)
./start.sh --local      # Modo local (mesma rede WiFi)
```

**Solução Permanente:**
```bash
# Configure o limite permanentemente no ~/.zshrc
echo "ulimit -n 10240" >> ~/.zshrc
source ~/.zshrc
```

**Solução Temporária:**
```bash
# Aumentar o limite apenas nesta sessão
ulimit -n 10240 && npm start
```

### 🚀 Iniciar o servidor de desenvolvimento

```bash
# Método recomendado: usar o script wrapper
./start.sh              # Modo tunnel (funciona em qualquer rede)
./start.sh --local      # Modo local (mesma rede WiFi)

# Ou usar npm diretamente (após aumentar ulimit)
ulimit -n 10240 && npm start
```

### 📱 Executar em dispositivos

**Android:**
```bash
npm run android
```

**iOS:**
```bash
npm run ios
```

**Web:**
```bash
npm run web
```

> 💡 **Dica:** O modo `--tunnel` permite que você escaneie o QR code mesmo se o iPhone estiver em uma rede diferente. Se ambos os dispositivos estiverem na mesma rede WiFi, você pode usar `./start.sh --local`.

---

## 📁 Estrutura do Projeto

```
ION-APP/
├── app/                    # Telas e rotas (Expo Router)
│   ├── _layout.tsx         # Layout raiz da aplicação
│   ├── index.tsx           # Tela inicial (redirecionamento)
│   ├── login.tsx           # Tela de login/autenticação
│   ├── edit-profile.tsx    # Tela de edição de perfil
│   └── (tabs)/             # Grupo de telas com navegação por abas
│       ├── _layout.tsx     # Layout das abas
│       ├── chat.tsx        # Tela de chat com IA
│       ├── reminders.tsx   # Tela de lembretes
│       ├── finances.tsx    # Tela de finanças
│       ├── calendar.tsx    # Tela de calendário
│       └── profile.tsx     # Tela de perfil
│
├── assets/                 # Recursos estáticos (imagens, ícones)
├── components/             # Componentes reutilizáveis
│   └── IONLogo.tsx         # Componente do logo
│
├── constants/              # Constantes e configurações
│   └── Colors.ts           # Design system de cores
│
├── contexts/               # Contextos React (estado global)
│   ├── AuthContext.tsx     # Contexto de autenticação
│   └── ThemeContext.tsx    # Contexto de tema
│
├── hooks/                  # Custom hooks
│   └── useAppColors.ts     # Hook para cores do app
│
├── services/               # Serviços e integrações
│   ├── api.ts              # Cliente HTTP e endpoints da API
│   ├── supabase.ts         # Cliente Supabase
│   └── supabaseService.ts  # Serviços do Supabase
│
├── types/                  # Definições de tipos TypeScript
│   └── index.ts            # Tipos globais
│
├── utils/                  # Funções utilitárias
│   └── format.ts           # Funções de formatação (data, moeda, etc)
│
├── android/                # Código nativo Android
├── ios/                    # Código nativo iOS
│
├── app.json                # Configuração do Expo
├── package.json            # Dependências do projeto
├── tsconfig.json           # Configuração TypeScript
├── babel.config.js         # Configuração Babel
└── metro.config.js         # Configuração Metro bundler
```

> 📖 Para mais detalhes sobre a estrutura, consulte [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)

---

## 🎨 Design System

O app utiliza um design system consistente:

### Cores
- **Primary**: `#6366F1` (Roxo principal)
- **Secondary**: `#8B5CF6` (Roxo secundário)
- **Success**: `#10B981` (Verde)
- **Error**: `#EF4444` (Vermelho)
- **Background**: Gradientes lineares

### Componentes
- Gradientes lineares para headers
- Cards com sombras e blur effects
- Botões com estados (ativo/desativado)
- Modais bottom sheet
- FAB (Floating Action Button)

---

## 📚 Documentação Adicional

- [SETUP.md](./SETUP.md) - Guia de configuração detalhado
- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) - Configuração do Supabase
- [STORAGE_SETUP.md](./STORAGE_SETUP.md) - Configuração de Storage
- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) - Estrutura detalhada do projeto

---

## 🔧 Scripts Disponíveis

```bash
# Iniciar servidor de desenvolvimento
npm start                  # Modo padrão
npm run start:local        # Modo local (sem tunnel)

# Executar em plataformas específicas
npm run android            # Android
npm run ios                # iOS
npm run web                # Web

# Scripts auxiliares
./start.sh                 # Wrapper com configuração automática
./start.sh --local         # Wrapper modo local
./fix-limits.sh            # Script para corrigir limites do sistema
```

---

## 🐛 Troubleshooting

### Erro ao instalar dependências
```bash
rm -rf node_modules package-lock.json
npm install
```

### Erro no Expo
```bash
npx expo install --fix
```

### Limpar cache
```bash
npx expo start -c
```

### Erro "EMFILE: too many open files"
Consulte a seção [Executando o Projeto](#-executando-o-projeto) acima.

### Problemas com iOS
```bash
cd ios
pod install
cd ..
npm run ios
```

### Problemas com Android
Certifique-se de que o Android SDK está configurado corretamente e que o emulador está rodando.

---

## 🚧 Status do Projeto

### ✅ Funcionalidades Implementadas
- [x] Autenticação com número de telefone
- [x] Chat com IA (interface completa)
- [x] Sistema de lembretes (CRUD completo)
- [x] Controle de finanças (receitas e despesas)
- [x] Calendário com eventos
- [x] Perfil do usuário
- [x] Upload de fotos de perfil
- [x] Envio de mensagens de áudio
- [x] Envio de imagens e documentos
- [x] Design responsivo e acessível

### 🔄 Em Desenvolvimento
- [ ] Integração completa com API de IA
- [ ] Notificações push
- [ ] Sincronização offline
- [ ] Sincronização com Google Calendar
- [ ] Modo escuro

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Para contribuir:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

---

## 📄 Licença

© 2025 ION / Aether Tech. Todos os direitos reservados.

Este projeto é proprietário e confidencial.

---

## 👥 Equipe

Desenvolvido com ❤️ pela equipe **Aether Tech**

---

## 📞 Suporte

Para suporte, abra uma issue no repositório ou entre em contato com a equipe de desenvolvimento.

---

<div align="center">

**Feito com ❤️ usando React Native e Expo**

</div>
