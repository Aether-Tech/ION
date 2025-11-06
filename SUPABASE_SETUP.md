# Configuração do Supabase

Este app utiliza o Supabase como banco de dados. Para configurar:

## 1. Instalar dependências

```bash
npm install
```

## 2. Configurar credenciais do Supabase

1. Crie um arquivo `.env` na raiz do projeto
2. Adicione as seguintes variáveis de ambiente:

```env
EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima_aqui
```

Você pode encontrar essas credenciais no painel do Supabase:
- Acesse https://app.supabase.com
- Selecione seu projeto
- Vá em Settings > API
- Copie a URL e a chave anon

## 3. Estrutura das Tabelas

O app utiliza as seguintes tabelas do Supabase:

### usuarios
- `id` (serial, primary key)
- `created_at` (timestamp)
- `nome` (text)
- `email` (text, unique)
- `celular` (text)
- `status` (text: 'ativo', 'inativo', 'bloqueado', 'excluido')
- `foto_perfil` (text, nullable) - URL da foto de perfil do usuário

### transacoes
- `id` (serial, primary key)
- `created_at` (timestamp)
- `data` (date)
- `valor` (numeric(10, 2))
- `descricao` (text)
- `recebedor` (text, nullable)
- `mes` (text)
- `categoria_id` (integer, foreign key -> categoria_trasacoes)
- `tipo` (text: 'entrada', 'saida')
- `usuario_id` (integer, foreign key -> usuarios)
- `pagador` (text, nullable)

### categoria_trasacoes
- `id` (bigint, primary key)
- `created_at` (timestamp)
- `descricao` (text)
- `usuario_id` (integer, foreign key -> usuarios)
- `date` (date, nullable)

### to_do
- `id` (bigint, primary key)
- `created_at` (timestamp)
- `item` (text, nullable)
- `categoria` (text, nullable)
- `date` (date, nullable)
- `usuario_id` (integer, foreign key -> usuarios)
- `status` (text, default: 'pendente')

### lembretes
- `id` (bigint, primary key)
- `created_at` (timestamp)
- `data_para_lembrar` (timestamp, nullable)
- `celular` (text, nullable)
- `lembrete` (text, nullable)
- `usuario_id` (integer, foreign key -> usuarios)
- `recorrencia` (text, default: 'Unico')

## 4. Storage - Fotos de Perfil

Para habilitar o upload de fotos de perfil:

1. Acesse **Storage** no painel do Supabase
2. Clique em **"New bucket"**
3. Configure:
   - **Nome**: `perfis`
   - **Public bucket**: Marque como público (para permitir acesso às URLs)
   - **File size limit**: 5MB (ou o que preferir)
   - **Allowed MIME types**: `image/jpeg, image/png, image/jpg`
4. Clique em **"Create bucket"**

### Adicionar coluna foto_perfil na tabela usuarios

Se a coluna `foto_perfil` ainda não existe:

1. Acesse **Table Editor** no painel do Supabase
2. Selecione a tabela `usuarios`
3. Clique em **"Add column"**
4. Configure:
   - **Name**: `foto_perfil`
   - **Type**: `text`
   - **Is nullable**: Sim (marque como nullable)
5. Clique em **"Save"**

## 5. Políticas de Segurança (RLS)

Certifique-se de configurar as políticas Row Level Security (RLS) no Supabase:

- Usuários só podem acessar seus próprios dados
- Configure as políticas para permitir SELECT, INSERT, UPDATE, DELETE apenas para registros onde `usuario_id` corresponde ao usuário autenticado

### Políticas para Storage

Para o bucket `perfis`, configure políticas de acesso:

1. Acesse **Storage** > **Policies** > **perfis**
2. Adicione políticas para permitir:
   - **SELECT (Browse)**: Permitir leitura pública das imagens
   - **INSERT (Upload)**: Permitir upload apenas para usuários autenticados
   - **UPDATE**: Permitir atualização apenas para o próprio usuário
   - **DELETE**: Permitir exclusão apenas para o próprio usuário

## 6. Responsividade

O app foi desenvolvido para ser responsivo e funcionar em:
- Web (navegador)
- Mobile (iOS/Android)
- WhatsApp (via web)

As telas utilizam componentes do React Native que se adaptam automaticamente ao tamanho da tela.

## 7. Testar

Após configurar, execute:

```bash
npm start
```

E teste o app no dispositivo ou navegador de sua escolha.

