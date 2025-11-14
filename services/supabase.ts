import { createClient } from '@supabase/supabase-js';

// Configure estas variáveis com suas credenciais do Supabase
// Você pode criar um arquivo .env ou usar variáveis de ambiente
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

console.log('Supabase config', {
  url: SUPABASE_URL,
  anonKeyPreview: SUPABASE_ANON_KEY ? `${SUPABASE_ANON_KEY.slice(0, 6)}...` : '',
});

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️ Supabase credentials not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Tipos baseados nas tabelas do banco de dados
export interface Usuario {
  id: number;
  created_at: string;
  nome: string;
  email: string;
  celular: string;
  status: 'ativo' | 'inativo' | 'bloqueado' | 'excluido';
  foto_perfil?: string | null;
}

export interface Transacao {
  id: number;
  created_at: string;
  data: string; // formato date
  valor: number;
  descricao: string;
  recebedor: string | null;
  mes: string;
  categoria_id: number;
  tipo: 'entrada' | 'saida';
  usuario_id: number;
  pagador: string | null;
}

export interface CategoriaTransacao {
  id: number;
  created_at: string;
  descricao: string;
  usuario_id: number;
  date: string | null; // formato date
}

export interface ToDo {
  id: number;
  created_at: string;
  item: string | null;
  categoria: string | null;
  date: string | null; // formato date
  usuario_id: number | null;
  status: string | null; // default 'pendente'
  completed_at?: string | null; // timestamp quando foi concluída
}

export interface Lembrete {
  id: number;
  created_at: string;
  data_para_lembrar: string | null; // timestamp with time zone
  celular: string | null;
  lembrete: string | null;
  usuario_id: number | null;
  recorrencia: string | null; // default 'Unico'
}

export interface ItemCompra {
  id: number;
  created_at: string;
  item: string | null;
  categoria: string | null;
  usuario_id: number | null;
  status: string | null; // default 'pendente', 'comprado'
  selecao: string | null; // nome da lista/seleção (ex: 'Casa', 'Restaurante')
}

export interface Caixinha {
  id: number;
  created_at: string;
  nome_caixinha: string | null;
  valor_meta: number | null; // valor da meta em reais
  valor_total_arrecadado: number | null; // valor total arrecadado
  deposito: number | null; // último depósito ou depósito único
  data_para_concluir: string | null; // data limite para atingir a meta (timestamp)
  categoria: string | null;
  usuario_id: number | null;
}

