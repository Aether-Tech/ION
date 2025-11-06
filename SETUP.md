# Guia de Configuração - ION App

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- Node.js (versão 18 ou superior)
- npm ou yarn
- Expo CLI (`npm install -g expo-cli`)
- Para Android: Android Studio e Android SDK
- Para iOS: Xcode (apenas macOS)

## 🚀 Instalação

1. **Instale as dependências:**
   ```bash
   npm install
   ```

2. **Configure os assets:**
   Você precisa adicionar os seguintes arquivos na pasta `assets/`:
   - `icon.png` - Ícone do app (1024x1024px)
   - `splash.png` - Tela de splash (1284x2778px)
   - `adaptive-icon.png` - Ícone adaptativo Android (1024x1024px)
   - `favicon.png` - Favicon para web (48x48px)

3. **Configure a API:**
   Edite o arquivo `services/api.ts` e ajuste a constante `API_BASE_URL` com a URL correta da sua API.

## 🏃 Executando o App

### Modo Desenvolvimento
```bash
npm start
```

### Android
```bash
npm run android
```

### iOS
```bash
npm run ios
```

### Web
```bash
npm run web
```

## 📱 Funcionalidades Implementadas

- ✅ Autenticação com número de telefone
- ✅ Chat com IA (interface pronta, integração com API pendente)
- ✅ Sistema de lembretes
- ✅ Controle de finanças (receitas e despesas)
- ✅ Calendário com eventos
- ✅ Perfil do usuário

## 🔌 Integração com API

O app está preparado para se conectar com a API. As funções de integração estão comentadas no código e podem ser ativadas quando a API estiver disponível.

Endpoints esperados:
- `POST /api/auth/login` - Autenticação
- `POST /api/chat/message` - Enviar mensagem
- `GET /api/chat/history` - Histórico de mensagens
- `GET /api/reminders` - Listar lembretes
- `POST /api/reminders` - Criar lembrete
- `GET /api/finances/transactions` - Listar transações
- `POST /api/finances/transactions` - Criar transação
- `GET /api/calendar/events` - Listar eventos
- `POST /api/calendar/events` - Criar evento

## 🎨 Design System

O app utiliza um design system consistente com:
- Cores primárias: Roxo (#6366F1) e Gradientes
- Tipografia: System fonts (SF Pro no iOS, Roboto no Android)
- Componentes: Reutilizáveis e acessíveis
- Layout: Clean e intuitivo para todas as idades

## 📝 Próximos Passos

1. Adicionar os assets (ícones e splash screen)
2. Configurar a URL da API real
3. Implementar autenticação real com backend
4. Adicionar notificações push
5. Implementar sincronização offline
6. Adicionar testes automatizados

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

