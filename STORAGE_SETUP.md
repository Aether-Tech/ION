# Configuração do Storage para Fotos de Perfil

## ⚠️ IMPORTANTE: Este App Não Usa Autenticação do Supabase Auth

Este app utiliza apenas a **chave anônima** do Supabase e não implementa autenticação via Supabase Auth. Isso significa que:

- As políticas de Storage precisam permitir operações **anônimas/públicas**
- Não use políticas que dependem de `auth.uid()` ou autenticação
- Use `bucket_id = 'perfis'` nas políticas em vez de `true` ou condições de autenticação

## Problema Comum: Erro de Permissão

Se você está recebendo erros como:
- "new row violates row-level security"
- "policy"
- "permission denied"

Isso significa que as **políticas de segurança do bucket** não estão configuradas corretamente para operações anônimas.

## Passo a Passo para Configurar

### 1. Criar o Bucket (se ainda não criou)

1. Acesse o painel do Supabase: https://app.supabase.com
2. Selecione seu projeto
3. Vá em **Storage** no menu lateral
4. Clique em **"New bucket"**
5. Configure:
   - **Name**: `perfis`
   - **Public bucket**: ✅ Marque como público
   - **File size limit**: 5MB (ou o valor que preferir)
   - **Allowed MIME types**: `image/jpeg, image/png, image/jpg`
6. Clique em **"Create bucket"**

### 2. Configurar Políticas de Segurança (CRÍTICO!)

⚠️ **Este é o passo mais importante!** Sem as políticas corretas, o upload não funcionará.

1. No painel do Supabase, vá em **Storage** > **Policies**
2. Selecione o bucket **"perfis"**
3. Você verá 4 tipos de operações: **SELECT**, **INSERT**, **UPDATE**, **DELETE**

#### Para cada operação, adicione uma política:

**SELECT (Browse) - Ler arquivos:**
1. Clique em **"New policy"** ao lado de SELECT
2. Escolha **"Create a policy from scratch"**
3. Configure:
   - **Policy name**: `Allow public read`
   - **Allowed operation**: `SELECT`
   - **Policy definition**: Cole o seguinte SQL:
   ```sql
   bucket_id = 'perfis'
   ```
   (Isso permite leitura pública das imagens do bucket perfis)
4. Clique em **"Review"** e depois **"Save policy"**

**INSERT (Upload) - Fazer upload:**
1. Clique em **"New policy"** ao lado de INSERT
2. Escolha **"Create a policy from scratch"**
3. Configure:
   - **Policy name**: `Allow public upload`
   - **Allowed operation**: `INSERT`
   - **Policy definition**: Cole o seguinte SQL:
   ```sql
   bucket_id = 'perfis'
   ```
   ⚠️ **IMPORTANTE**: Como o app não usa autenticação do Supabase Auth, use `bucket_id = 'perfis'` em vez de `true`. Isso permite uploads anônimos para o bucket específico.
   
   **ATENÇÃO**: Se você quiser mais segurança depois, pode usar:
   ```sql
   bucket_id = 'perfis' AND (storage.foldername(name))[1] = auth.uid()::text
   ```
   Mas isso requer que o app use Supabase Auth (que não está configurado atualmente).
   
4. Clique em **"Review"** e depois **"Save policy"**

**UPDATE - Atualizar arquivos:**
1. Clique em **"New policy"** ao lado de UPDATE
2. Escolha **"Create a policy from scratch"**
3. Configure:
   - **Policy name**: `Allow public update`
   - **Allowed operation**: `UPDATE`
   - **Policy definition**: Cole o seguinte SQL:
   ```sql
   bucket_id = 'perfis'
   ```
4. Clique em **"Review"** e depois **"Save policy"**

**DELETE - Deletar arquivos:**
1. Clique em **"New policy"** ao lado de DELETE
2. Escolha **"Create a policy from scratch"**
3. Configure:
   - **Policy name**: `Allow public delete`
   - **Allowed operation**: `DELETE`
   - **Policy definition**: Cole o seguinte SQL:
   ```sql
   bucket_id = 'perfis'
   ```
4. Clique em **"Review"** e depois **"Save policy"**

### 3. Alternativa Rápida (Menos Seguro)

Se você quiser testar rapidamente sem configurar políticas individuais:

1. Vá em **Storage** > **Policies** > **perfis**
2. Procure por um toggle ou opção para **"Disable RLS"** ou **"Allow all operations"**
3. ⚠️ **ATENÇÃO**: Isso remove toda a segurança. Use apenas para testes!

### 4. Verificar se Funcionou

Após configurar as políticas:

1. Tente fazer upload de uma foto novamente no app
2. Verifique os logs no console (você verá logs com 📸)
3. Se ainda der erro, verifique:
   - Se o bucket está marcado como **público**
   - Se todas as políticas foram salvas corretamente
   - Se não há erros de sintaxe SQL nas políticas

## Troubleshooting

### Erro: "Bucket not found"
- Verifique se o bucket foi criado com o nome exato: `perfis`
- Verifique se você está no projeto correto do Supabase

### Erro: "Permission denied" ou "Row-level security"
- As políticas não estão configuradas
- Siga o passo 2 acima

### Erro: "Invalid file type"
- Verifique se o MIME type da imagem está permitido
- Verifique as configurações de "Allowed MIME types" do bucket

### Upload funciona mas a imagem não aparece
- Verifique se o bucket está marcado como **público**
- Verifique se a política SELECT está configurada
- Verifique a URL gerada nos logs

## Exemplo de Política SQL Completa

Se você preferir criar as políticas via SQL diretamente:

```sql
-- Permitir leitura pública (SELECT)
CREATE POLICY "Public Read" ON storage.objects 
FOR SELECT 
USING (bucket_id = 'perfis');

-- Permitir upload público (INSERT)
CREATE POLICY "Public Upload" ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'perfis');

-- Permitir atualização pública (UPDATE)
CREATE POLICY "Public Update" ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'perfis');

-- Permitir exclusão pública (DELETE)
CREATE POLICY "Public Delete" ON storage.objects 
FOR DELETE 
USING (bucket_id = 'perfis');
```

⚠️ **NOTA**: Essas políticas permitem acesso público ao bucket. Se você quiser mais segurança no futuro, precisará implementar autenticação do Supabase Auth no app.

Execute essas queries no SQL Editor do Supabase.

