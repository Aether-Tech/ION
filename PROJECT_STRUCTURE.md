# Estrutura do Projeto ION App

## 📁 Estrutura de Diretórios

```
ION-APP/
├── app/                    # Telas e rotas (Expo Router)
│   ├── _layout.tsx         # Layout raiz da aplicação
│   ├── index.tsx           # Tela inicial (redirecionamento)
│   ├── login.tsx           # Tela de login/autenticação
│   └── (tabs)/             # Grupo de telas com navegação por abas
│       ├── _layout.tsx     # Layout das abas
│       ├── chat.tsx         # Tela de chat com IA
│       ├── reminders.tsx   # Tela de lembretes
│       ├── finances.tsx    # Tela de finanças
│       ├── calendar.tsx    # Tela de calendário
│       └── profile.tsx     # Tela de perfil
│
├── assets/                 # Recursos estáticos (imagens, ícones)
│   ├── icon.png
│   ├── splash.png
│   └── ...
│
├── constants/              # Constantes e configurações
│   └── Colors.ts           # Design system de cores
│
├── contexts/               # Contextos React (estado global)
│   └── AuthContext.tsx     # Contexto de autenticação
│
├── services/               # Serviços e integrações
│   └── api.ts              # Cliente HTTP e endpoints da API
│
├── types/                  # Definições de tipos TypeScript
│   └── index.ts            # Tipos globais
│
├── utils/                   # Funções utilitárias
│   └── format.ts           # Funções de formatação (data, moeda, etc)
│
├── app.json                # Configuração do Expo
├── package.json            # Dependências do projeto
├── tsconfig.json           # Configuração TypeScript
├── babel.config.js         # Configuração Babel
└── README.md               # Documentação principal
```

## 🎯 Principais Componentes

### Autenticação
- **AuthContext**: Gerencia estado de autenticação e persistência com AsyncStorage
- **Login Screen**: Tela de login com validação de número de telefone

### Navegação
- **Expo Router**: Sistema de roteamento baseado em arquivos
- **Tabs Navigation**: Navegação por abas na parte inferior

### Telas Principais

1. **Chat**: Interface de conversação com IA
   - Envio e recebimento de mensagens
   - Interface tipo WhatsApp
   - Scroll automático

2. **Lembretes**: Gerenciamento de tarefas e lembretes
   - Criar, editar, excluir
   - Marcar como concluído
   - Formatação de data em português

3. **Finanças**: Controle financeiro
   - Receitas e despesas
   - Resumo financeiro
   - Categorização
   - Formatação de moeda brasileira

4. **Calendário**: Agendamento de eventos
   - Visualização mensal
   - Criação de eventos
   - Marcação de datas com eventos

5. **Perfil**: Configurações do usuário
   - Informações da conta
   - Configurações do app
   - Logout

## 🎨 Design System

### Cores
- **Primary**: #6366F1 (Roxo principal)
- **Secondary**: #8B5CF6 (Roxo secundário)
- **Success**: #10B981 (Verde)
- **Error**: #EF4444 (Vermelho)

### Componentes Reutilizáveis
- Gradientes lineares para headers
- Cards com sombras
- Botões com estados (ativo/desativado)
- Modais bottom sheet
- FAB (Floating Action Button)

## 📱 Funcionalidades

### Implementadas
- ✅ Autenticação local
- ✅ Navegação completa
- ✅ Interface de chat
- ✅ CRUD de lembretes
- ✅ CRUD de finanças
- ✅ CRUD de eventos
- ✅ Perfil do usuário
- ✅ Design responsivo e acessível

### Pendentes (Integração com Backend)
- ⏳ Autenticação real com API
- ⏳ Sincronização de dados
- ⏳ Chat real com IA
- ⏳ Notificações push
- ⏳ Sincronização com Google Calendar

## 🔧 Tecnologias Utilizadas

- **React Native**: Framework mobile
- **Expo**: Plataforma de desenvolvimento
- **TypeScript**: Tipagem estática
- **Expo Router**: Roteamento
- **React Navigation**: Navegação
- **AsyncStorage**: Persistência local
- **date-fns**: Manipulação de datas
- **react-native-calendars**: Componente de calendário
- **expo-linear-gradient**: Gradientes

## 📝 Padrões de Código

- **TypeScript**: Tipagem em todas as interfaces e funções
- **Componentes Funcionais**: Uso de hooks React
- **Estilos**: StyleSheet do React Native
- **Nomenclatura**: camelCase para variáveis, PascalCase para componentes
- **Estrutura**: Separação de responsabilidades (UI, lógica, serviços)

