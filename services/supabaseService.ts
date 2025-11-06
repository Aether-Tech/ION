import { supabase, Usuario, Transacao, CategoriaTransacao, ToDo, Lembrete } from './supabase';

// Serviços para Usuarios
export const usuariosService = {
  // Buscar usuário por celular
  getByCelular: async (celular: string): Promise<Usuario | null> => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('celular', celular)
        .eq('status', 'ativo')
        .single();

      // Se não encontrou (erro PGRST116 = not found), retornar null
      if (error) {
        if (error.code === 'PGRST116') {
          // Usuário não encontrado
          return null;
        }
        console.error('Error fetching user:', error);
        return null;
      }
      return data;
    } catch (error) {
      console.error('Exception fetching user:', error);
      return null;
    }
  },

  // Buscar usuário por ID
  getById: async (id: number): Promise<Usuario | null> => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching user:', error);
      return null;
    }
    return data;
  },

  // Criar novo usuário
  create: async (usuario: Omit<Usuario, 'id' | 'created_at'>): Promise<Usuario | null> => {
    const { data, error } = await supabase
      .from('usuarios')
      .insert([usuario])
      .select()
      .single();

    if (error) {
      console.error('Error creating user:', error);
      return null;
    }
    return data;
  },

  // Atualizar usuário
  update: async (id: number, updates: Partial<Usuario>): Promise<Usuario | null> => {
    const { data, error } = await supabase
      .from('usuarios')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating user:', error);
      return null;
    }
    return data;
  },
};

// Serviços para Transacoes
export const transacoesService = {
  // Buscar todas as transações do usuário
  getByUsuarioId: async (usuarioId: number): Promise<Transacao[]> => {
    try {
      const { data, error } = await supabase
        .from('transacoes')
        .select('*')
        .eq('usuario_id', usuarioId)
        .order('data', { ascending: false });

      if (error) {
        console.error('Error fetching transactions:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('Exception fetching transactions:', error);
      return [];
    }
  },

  // Buscar transações por mês
  getByMes: async (usuarioId: number, mes: string): Promise<Transacao[]> => {
    const { data, error } = await supabase
      .from('transacoes')
      .select('*')
      .eq('usuario_id', usuarioId)
      .eq('mes', mes)
      .order('data', { ascending: false });

    if (error) {
      console.error('Error fetching transactions by month:', error);
      return [];
    }
    return data || [];
  },

  // Criar nova transação
  create: async (transacao: Omit<Transacao, 'id' | 'created_at'>): Promise<Transacao | null> => {
    const { data, error } = await supabase
      .from('transacoes')
      .insert([transacao])
      .select()
      .single();

    if (error) {
      console.error('Error creating transaction:', error);
      return null;
    }
    return data;
  },

  // Atualizar transação
  update: async (id: number, updates: Partial<Transacao>): Promise<Transacao | null> => {
    const { data, error } = await supabase
      .from('transacoes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating transaction:', error);
      return null;
    }
    return data;
  },

  // Deletar transação
  delete: async (id: number): Promise<boolean> => {
    const { error } = await supabase
      .from('transacoes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting transaction:', error);
      return false;
    }
    return true;
  },
};

// Serviços para Categorias de Transações
export const categoriasService = {
  // Buscar todas as categorias do usuário
  getByUsuarioId: async (usuarioId: number): Promise<CategoriaTransacao[]> => {
    try {
      const { data, error } = await supabase
        .from('categoria_trasacoes')
        .select('*')
        .eq('usuario_id', usuarioId)
        .order('descricao', { ascending: true });

      if (error) {
        console.error('Error fetching categories:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('Exception fetching categories:', error);
      return [];
    }
  },

  // Criar nova categoria
  create: async (categoria: Omit<CategoriaTransacao, 'id' | 'created_at'>): Promise<CategoriaTransacao | null> => {
    const { data, error } = await supabase
      .from('categoria_trasacoes')
      .insert([categoria])
      .select()
      .single();

    if (error) {
      console.error('Error creating category:', error);
      return null;
    }
    return data;
  },

  // Atualizar categoria
  update: async (id: number, updates: Partial<CategoriaTransacao>): Promise<CategoriaTransacao | null> => {
    const { data, error } = await supabase
      .from('categoria_trasacoes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating category:', error);
      return null;
    }
    return data;
  },

  // Deletar categoria
  delete: async (id: number): Promise<boolean> => {
    const { error } = await supabase
      .from('categoria_trasacoes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting category:', error);
      return false;
    }
    return true;
  },
};

// Serviços para ToDo (Tarefas)
export const toDoService = {
  // Buscar todas as tarefas do usuário
  getByUsuarioId: async (usuarioId: number): Promise<ToDo[]> => {
    try {
      const { data, error } = await supabase
        .from('to_do')
        .select('*')
        .eq('usuario_id', usuarioId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching todos:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('Exception fetching todos:', error);
      return [];
    }
  },

  // Buscar tarefas por status
  getByStatus: async (usuarioId: number, status: string): Promise<ToDo[]> => {
    const { data, error } = await supabase
      .from('to_do')
      .select('*')
      .eq('usuario_id', usuarioId)
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching todos by status:', error);
      return [];
    }
    return data || [];
  },

  // Criar nova tarefa
  create: async (todo: Omit<ToDo, 'id' | 'created_at'>): Promise<ToDo | null> => {
    const { data, error } = await supabase
      .from('to_do')
      .insert([todo])
      .select()
      .single();

    if (error) {
      console.error('Error creating todo:', error);
      return null;
    }
    return data;
  },

  // Atualizar tarefa
  update: async (id: number, updates: Partial<ToDo>): Promise<ToDo | null> => {
    const { data, error } = await supabase
      .from('to_do')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating todo:', error);
      return null;
    }
    return data;
  },

  // Deletar tarefa
  delete: async (id: number): Promise<boolean> => {
    const { error } = await supabase
      .from('to_do')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting todo:', error);
      return false;
    }
    return true;
  },
};

// Serviços para Lembretes
export const lembretesService = {
  // Buscar todos os lembretes do usuário
  getByUsuarioId: async (usuarioId: number): Promise<Lembrete[]> => {
    try {
      const { data, error } = await supabase
        .from('lembretes')
        .select('*')
        .eq('usuario_id', usuarioId)
        .order('data_para_lembrar', { ascending: true });

      if (error) {
        console.error('Error fetching reminders:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('Exception fetching reminders:', error);
      return [];
    }
  },

  // Criar novo lembrete
  create: async (lembrete: Omit<Lembrete, 'id' | 'created_at'>): Promise<Lembrete | null> => {
    const { data, error } = await supabase
      .from('lembretes')
      .insert([lembrete])
      .select()
      .single();

    if (error) {
      console.error('Error creating reminder:', error);
      return null;
    }
    return data;
  },

  // Atualizar lembrete
  update: async (id: number, updates: Partial<Lembrete>): Promise<Lembrete | null> => {
    const { data, error } = await supabase
      .from('lembretes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating reminder:', error);
      return null;
    }
    return data;
  },

  // Deletar lembrete
  delete: async (id: number): Promise<boolean> => {
    const { error } = await supabase
      .from('lembretes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting reminder:', error);
      return false;
    }
    return true;
  },
};

