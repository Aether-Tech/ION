import * as FileSystem from 'expo-file-system/legacy';
import { format } from 'date-fns';
import { usuariosService, transacoesService, categoriasService, toDoService, lembretesService, listaComprasService, caixinhasService } from './supabaseService';

// Configuração da API (usada apenas para outras funcionalidades, NÃO para chat)
const API_BASE_URL = 'https://ion.goaether.com.br/api';

// API KEY da OpenAI - Configure via variável de ambiente EXPO_PUBLIC_API_KEY
// Esta é a chave da OpenAI que será usada para o chat com GPT 5 nano
// Remove whitespace and potential non-visible characters/newlines
const API_KEY = (process.env.EXPO_PUBLIC_API_KEY || '').replace(/[\s\n\r\t\uFEFF\xA0]+/g, '');

if (__DEV__) {
  console.log('OpenAI API Configuration:', {
    hasKey: !!API_KEY,
    keyLength: API_KEY ? API_KEY.length : 0,
  });
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Função genérica para fazer requisições
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    // Preparar headers com API KEY se disponível
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    // Adicionar API KEY no header Authorization se disponível
    if (API_KEY) {
      headers['Authorization'] = `Bearer ${API_KEY}`;
      // Também pode ser enviado como header customizado, descomente se necessário:
      // headers['X-API-Key'] = API_KEY;
    }

    const url = `${API_BASE_URL}${endpoint}`;
    console.log(`[API Request] ${options.method || 'GET'} ${url}`);
    if (options.body) {
      console.log(`[API Request Body]`, JSON.parse(options.body as string));
    }

    const response = await fetch(url, {
      headers,
      ...options,
    });

    if (!response.ok) {
      // Tentar ler a mensagem de erro da resposta
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        // Se não conseguir ler JSON, usar status
        errorMessage = `Erro ${response.status}: ${response.statusText || 'Endpoint não encontrado'}`;
      }

      console.error(`[API Error] ${response.status} - ${errorMessage}`);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('[API Error]', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

    // Melhorar mensagens de erro comuns
    let userFriendlyMessage = errorMessage;
    if (errorMessage.includes('404')) {
      userFriendlyMessage = `Endpoint não encontrado (404). Verifique se a API está configurada corretamente.`;
    } else if (errorMessage.includes('401') || errorMessage.includes('403')) {
      userFriendlyMessage = `Erro de autenticação. Verifique sua API KEY.`;
    } else if (errorMessage.includes('500')) {
      userFriendlyMessage = `Erro interno do servidor. Tente novamente mais tarde.`;
    } else if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
      userFriendlyMessage = `Erro de conexão. Verifique sua internet.`;
    }

    return {
      success: false,
      error: userFriendlyMessage,
    };
  }
}

// Serviços de autenticação
export const authService = {
  login: async (phoneNumber: string) => {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber }),
    });
  },

  logout: async () => {
    return request('/auth/logout', {
      method: 'POST',
    });
  },
};

// Função auxiliar para processar datas em português
const parseDateFromPortuguese = (dateString: string | undefined): Date => {
  if (!dateString) {
    return new Date();
  }

  const now = new Date();
  const lowerDate = dateString.toLowerCase().trim();

  // Processar datas relativas comuns
  let targetDate = new Date(now);

  if (lowerDate.includes('amanhã') || lowerDate.includes('amanha') || lowerDate.includes('tomorrow')) {
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (lowerDate.includes('ontem') || lowerDate.includes('yesterday')) {
    targetDate.setDate(targetDate.getDate() - 1);
  } else if (lowerDate.includes('hoje') || lowerDate.includes('today')) {
    // Manter data atual
  } else {
    // Tentar parsear como ISO ou timestamp
    const parsedDate = new Date(dateString);
    if (!isNaN(parsedDate.getTime())) {
      targetDate = parsedDate;
    }
  }

  // Processar horários mencionados
  if (lowerDate.includes('meio dia') || lowerDate.includes('meio-dia') || lowerDate.includes('12h') || lowerDate.includes('12:00')) {
    targetDate.setHours(12, 0, 0, 0);
  } else if (lowerDate.includes('meia noite') || lowerDate.includes('meia-noite') || lowerDate.includes('00h') || lowerDate.includes('0h')) {
    targetDate.setHours(0, 0, 0, 0);
  } else {
    // Tentar extrair horário (ex: "14h", "15:30", "8h30")
    const hourMatch = lowerDate.match(/(\d{1,2})h/);
    const timeMatch = lowerDate.match(/(\d{1,2}):(\d{2})/);

    if (hourMatch) {
      const hour = parseInt(hourMatch[1], 10);
      if (hour >= 0 && hour <= 23) {
        targetDate.setHours(hour, 0, 0, 0);
      }
    } else if (timeMatch) {
      const hour = parseInt(timeMatch[1], 10);
      const minute = parseInt(timeMatch[2], 10);
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        targetDate.setHours(hour, minute, 0, 0);
      }
    } else {
      // Se não há horário específico, usar horário atual mas manter a data
      if (!lowerDate.includes('hoje') && !lowerDate.includes('today') &&
        !lowerDate.includes('amanhã') && !lowerDate.includes('amanha') &&
        !lowerDate.includes('ontem') && !lowerDate.includes('yesterday')) {
        // Se não é uma data relativa e não tem horário, manter horário atual
        targetDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      }
    }
  }

  return targetDate;
};

const normalizeRecurrence = (recurrence?: string | null): string => {
  if (!recurrence) {
    return 'Unico';
  }

  const sanitized = recurrence
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (!sanitized) {
    return 'Unico';
  }

  const mappings: Record<string, string> = {
    unico: 'Unico',
    'sem recorrencia': 'Unico',
    'semrecorrencia': 'Unico',
    once: 'Unico',
    unicoa: 'Unico',
    diario: 'Diario',
    diaria: 'Diario',
    daily: 'Diario',
    semanal: 'Semanal',
    weekly: 'Semanal',
    mensal: 'Mensal',
    monthly: 'Mensal',
  };

  if (mappings[sanitized]) {
    return mappings[sanitized];
  }

  return recurrence;
};

// Funções auxiliares para executar ações reais
const executeFunctionCall = async (
  functionName: string,
  args: any,
  userId: number | undefined,
  userMessage?: string
): Promise<string> => {
  if (!userId) {
    return 'Erro: Usuário não autenticado. Por favor, faça login novamente.';
  }

  try {
    switch (functionName) {
      case 'create_transaction': {
        const { description, amount, type, category, date } = args;

        if (!description || !amount) {
          return 'Erro: Descrição e valor são obrigatórios para criar uma transação.';
        }

        const transactionAmount = parseFloat(amount);
        if (isNaN(transactionAmount) || transactionAmount <= 0) {
          return 'Erro: O valor deve ser um número positivo.';
        }

        // Inferir tipo baseado na descrição se não fornecido
        let transactionType = type;
        if (!transactionType) {
          // Tentar inferir pelo contexto comum
          const descLower = description.toLowerCase();
          if (descLower.includes('salário') || descLower.includes('salario') ||
            descLower.includes('receita') || descLower.includes('ganho') ||
            descLower.includes('pagamento') || descLower.includes('entrada')) {
            transactionType = 'entrada';
          } else {
            transactionType = 'saida'; // Padrão para despesas
          }
        }

        // Inferir categoria baseado na descrição se não fornecida
        let categoriaNome = category;
        if (!categoriaNome) {
          const descLower = description.toLowerCase();
          if (descLower.includes('almoço') || descLower.includes('almoco') ||
            descLower.includes('jantar') || descLower.includes('lanche') ||
            descLower.includes('comida') || descLower.includes('restaurante')) {
            categoriaNome = 'Alimentação';
          } else if (descLower.includes('transporte') || descLower.includes('uber') ||
            descLower.includes('táxi') || descLower.includes('taxi') ||
            descLower.includes('gasolina') || descLower.includes('combustível')) {
            categoriaNome = 'Transporte';
          } else if (descLower.includes('salário') || descLower.includes('salario') ||
            descLower.includes('trabalho') || descLower.includes('freelance')) {
            categoriaNome = 'Trabalho';
          } else {
            categoriaNome = 'Outros';
          }
        }

        // Buscar ou criar categoria
        let categoriaId: number;
        let categoria = (await categoriasService.getByUsuarioId(userId)).find(
          (c) => c.descricao === categoriaNome
        );

        if (!categoria) {
          const novaCategoria = await categoriasService.create({
            descricao: categoriaNome,
            usuario_id: userId,
            date: null,
          });
          if (novaCategoria) {
            categoria = novaCategoria;
          } else {
            return 'Erro: Não foi possível criar a categoria.';
          }
        }
        categoriaId = categoria.id;

        // Processar data
        const transactionDate = parseDateFromPortuguese(date);

        const mes = format(transactionDate, 'yyyy-MM');
        const transacao = await transacoesService.create({
          data: format(transactionDate, 'yyyy-MM-dd'),
          valor: transactionAmount,
          descricao: description,
          recebedor: null,
          pagador: null,
          mes,
          categoria_id: categoriaId,
          tipo: transactionType === 'income' || transactionType === 'entrada' ? 'entrada' : 'saida',
          usuario_id: userId,
        });

        if (transacao) {
          return `✅ Transação criada com sucesso! ${transactionType === 'income' || transactionType === 'entrada' ? 'Receita' : 'Despesa'} de R$ ${transactionAmount.toFixed(2)} para "${description}" na categoria "${categoriaNome}" em ${format(transactionDate, 'dd/MM/yyyy')}.`;
        } else {
          return 'Erro: Não foi possível criar a transação.';
        }
      }

      case 'list_transactions': {
        const { limit = 10, type, category } = args;
        const transactions = await transacoesService.getByUsuarioId(userId);

        let filtered = transactions;
        if (type && (type === 'income' || type === 'expense')) {
          filtered = filtered.filter(
            (t) => (type === 'income' && t.tipo === 'entrada') || (type === 'expense' && t.tipo === 'saida')
          );
        }

        const categorias = await categoriasService.getByUsuarioId(userId);
        const transactionsWithCategories = filtered.slice(0, limit).map((t) => {
          const cat = categorias.find((c) => c.id === t.categoria_id);
          return {
            ...t,
            categoria: cat?.descricao || 'Sem categoria',
          };
        });

        if (transactionsWithCategories.length === 0) {
          return 'Nenhuma transação encontrada.';
        }

        const transactionsList = transactionsWithCategories
          .map(
            (t) =>
              `- ${t.tipo === 'entrada' ? 'Receita' : 'Despesa'}: ${t.descricao} - R$ ${Number(t.valor).toFixed(2)} (${t.categoria}) - ${format(new Date(t.data), 'dd/MM/yyyy')}`
          )
          .join('\n');

        return `Transações recentes:\n${transactionsList}`;
      }

      case 'create_task': {
        const { title, category, date } = args;

        if (!title) {
          return 'Erro: O título da tarefa é obrigatório.';
        }

        let taskDate: string | null = null;
        if (date) {
          const parsedDate = new Date(date);
          if (!isNaN(parsedDate.getTime())) {
            taskDate = format(parsedDate, 'yyyy-MM-dd');
          }
        }

        const task = await toDoService.create({
          item: title,
          categoria: category || 'Pessoal',
          date: taskDate,
          usuario_id: userId,
          status: 'pendente',
        });

        if (task) {
          return `✅ Tarefa criada com sucesso! "${title}" adicionada à sua lista de tarefas.`;
        } else {
          return 'Erro: Não foi possível criar a tarefa.';
        }
      }

      case 'list_tasks': {
        const { status, limit = 10 } = args;
        let tasks;

        if (status) {
          tasks = await toDoService.getByStatus(userId, status);
        } else {
          tasks = await toDoService.getByUsuarioId(userId);
        }

        const filteredTasks = tasks.slice(0, limit);

        if (filteredTasks.length === 0) {
          return 'Nenhuma tarefa encontrada.';
        }

        const tasksList = filteredTasks
          .map(
            (t) =>
              `- ${t.status === 'concluida' ? '✅' : '⏳'} ${t.item || 'Sem título'} (${t.categoria || 'Sem categoria'})${t.date ? ` - ${format(new Date(t.date), 'dd/MM/yyyy')}` : ''}`
          )
          .join('\n');

        return `Tarefas:\n${tasksList}`;
      }

      case 'create_reminder': {
        const { title, date, recurrence } = args;

        if (!title) {
          return 'Erro: O título do lembrete é obrigatório.';
        }

        if (!date) {
          return 'Erro: A data do lembrete é obrigatória.';
        }

        const temporalRegex = /(hoje|amanh|ontem|depois de amanh|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo|manhã|manha|tarde|noite|\d{1,2}\s*h|\d{1,2}:\d{2}|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2})/;
        const hasTemporalInfo = (text?: string): boolean => {
          if (!text) {
            return false;
          }
          return temporalRegex.test(text.toLowerCase());
        };

        const parseDateCandidate = (value?: string): Date | null => {
          if (!value) {
            return null;
          }

          const direct = new Date(value);
          if (!isNaN(direct.getTime())) {
            return direct;
          }

          if (hasTemporalInfo(value)) {
            const parsed = parseDateFromPortuguese(value);
            return isNaN(parsed.getTime()) ? null : parsed;
          }

          return null;
        };

        let reminderDate = parseDateCandidate(date);

        let messageBasedDate: Date | null = null;
        if (hasTemporalInfo(userMessage)) {
          const parsedFromMessage = parseDateFromPortuguese(userMessage);
          if (!isNaN(parsedFromMessage.getTime())) {
            messageBasedDate = parsedFromMessage;
          }
        }

        if ((!reminderDate || isNaN(reminderDate.getTime())) && messageBasedDate) {
          reminderDate = messageBasedDate;
        }

        if (!reminderDate || isNaN(reminderDate.getTime())) {
          return 'Erro: Não consegui entender a data do lembrete. Informe algo como "hoje às 17h" ou use uma data no formato YYYY-MM-DD.';
        }

        const now = new Date();
        const recurrenceValue = normalizeRecurrence(recurrence);
        const recurrenceLower = recurrenceValue.toLowerCase();

        if (reminderDate.getTime() <= now.getTime()) {
          if (messageBasedDate && messageBasedDate.getTime() > now.getTime()) {
            reminderDate = messageBasedDate;
          }
        }

        if (reminderDate.getTime() <= now.getTime()) {
          if (recurrenceLower === 'diario') {
            while (reminderDate.getTime() <= now.getTime()) {
              reminderDate.setDate(reminderDate.getDate() + 1);
            }
          } else if (recurrenceLower === 'semanal') {
            while (reminderDate.getTime() <= now.getTime()) {
              reminderDate.setDate(reminderDate.getDate() + 7);
            }
          } else if (recurrenceLower === 'mensal') {
            while (reminderDate.getTime() <= now.getTime()) {
              reminderDate.setMonth(reminderDate.getMonth() + 1);
            }
          } else {
            const adjusted = new Date(now);
            adjusted.setHours(reminderDate.getHours(), reminderDate.getMinutes(), 0, 0);
            if (adjusted.getTime() <= now.getTime()) {
              adjusted.setDate(adjusted.getDate() + 1);
            }
            reminderDate = adjusted;
          }
        }

        if (reminderDate.getTime() <= now.getTime()) {
          return 'Erro: A data do lembrete precisa ser no futuro. Ajuste o horário e tente novamente.';
        }

        reminderDate.setSeconds(0, 0);

        const usuario = await usuariosService.getById(userId);
        const reminder = await lembretesService.create({
          lembrete: title,
          data_para_lembrar: reminderDate.toISOString(),
          celular: usuario?.celular || null,
          usuario_id: userId,
          recorrencia: recurrenceValue,
        });

        if (reminder) {
          return `✅ Lembrete criado com sucesso! "${title}" agendado para ${format(reminderDate, 'dd/MM/yyyy HH:mm')}.`;
        } else {
          return 'Erro: Não foi possível criar o lembrete.';
        }
      }

      case 'list_reminders': {
        const { limit = 10 } = args;
        const reminders = await lembretesService.getByUsuarioId(userId);
        const filteredReminders = reminders.slice(0, limit);

        if (filteredReminders.length === 0) {
          return 'Nenhum lembrete encontrado.';
        }

        const remindersList = filteredReminders
          .map(
            (r) =>
              `- ${r.lembrete || 'Sem título'} - ${r.data_para_lembrar ? format(new Date(r.data_para_lembrar), 'dd/MM/yyyy HH:mm') : 'Sem data'} (${r.recorrencia || 'Único'})`
          )
          .join('\n');

        return `Lembretes:\n${remindersList}`;
      }

      case 'create_shopping_item': {
        const { item, category, list, selection, selecao } = args;

        if (!item) {
          return 'Erro: O nome do item é obrigatório.';
        }

        const userSelecoes = await listaComprasService.getSelecoes(userId);

        const extractSelecao = (value: unknown): string | null => {
          if (typeof value !== 'string') {
            return null;
          }
          const trimmed = value.trim();
          return trimmed.length > 0 ? trimmed : null;
        };

        let finalSelecao = extractSelecao(selecao) ?? extractSelecao(selection) ?? extractSelecao(list);

        if (!finalSelecao) {
          if (userSelecoes.length === 0) {
            finalSelecao = null;
          } else if (userSelecoes.length === 1) {
            finalSelecao = userSelecoes[0];
          } else {
            const listas = userSelecoes.map((nome) => `- ${nome}`).join('\n');
            return `Tenho mais de uma lista de compras. Em qual delas devo adicionar o item "${item}"?\nListas disponíveis:\n${listas}\nVocê pode informar uma dessas listas ou dizer "lista padrão" para usar a lista principal.`;
          }
        } else {
          const selecaoNormalized = finalSelecao
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();

          if (selecaoNormalized === 'lista padrao' || selecaoNormalized === 'padrao') {
            finalSelecao = null;
          }
        }

        const finalCategory = category?.toString().trim() || 'Outros';

        const shoppingItem = await listaComprasService.create({
          item,
          categoria: finalCategory,
          usuario_id: userId,
          status: 'pendente',
          selecao: finalSelecao,
        });

        if (shoppingItem) {
          const listaDestino = finalSelecao ? ` na lista "${finalSelecao}"` : '';
          return `✅ Item adicionado à lista de compras${listaDestino}! "${item}" na categoria "${finalCategory}".`;
        } else {
          return 'Erro: Não foi possível adicionar o item à lista de compras.';
        }
      }

      case 'list_shopping_items': {
        const { status, limit = 20 } = args;
        let items;

        if (status) {
          items = await listaComprasService.getByStatus(userId, status);
        } else {
          items = await listaComprasService.getByUsuarioId(userId);
        }

        const filteredItems = items.slice(0, limit);

        if (filteredItems.length === 0) {
          return 'Nenhum item na lista de compras.';
        }

        const itemsList = filteredItems
          .map(
            (i) =>
              `- ${i.status === 'comprado' ? '✅' : '⏳'} ${i.item || 'Sem nome'} (${i.categoria || 'Sem categoria'})`
          )
          .join('\n');

        return `Lista de Compras:\n${itemsList}`;
      }

      case 'create_savings_box': {
        const { name, goal, deadline } = args;

        if (!name) {
          return 'Erro: O nome da caixinha é obrigatório.';
        }

        if (!goal || parseFloat(goal) <= 0) {
          return 'Erro: A meta deve ser um valor positivo.';
        }

        if (!deadline) {
          return 'Erro: A data limite é obrigatória. Use o formato YYYY-MM-DD.';
        }

        const deadlineDate = new Date(deadline);
        if (isNaN(deadlineDate.getTime())) {
          return 'Erro: Data limite inválida. Use o formato YYYY-MM-DD.';
        }

        const caixinha = await caixinhasService.create({
          nome_caixinha: name,
          valor_meta: parseFloat(goal),
          valor_total_arrecadado: 0,
          deposito: null,
          data_para_concluir: deadlineDate.toISOString(),
          categoria: null,
          usuario_id: userId,
        });

        if (caixinha) {
          return `✅ Caixinha criada com sucesso! "${name}" com meta de R$ ${parseFloat(goal).toFixed(2)} até ${format(deadlineDate, 'dd/MM/yyyy')}.`;
        } else {
          return 'Erro: Não foi possível criar a caixinha.';
        }
      }

      case 'add_deposit': {
        const { box_id, amount } = args;

        if (!box_id) {
          return 'Erro: O ID da caixinha é obrigatório.';
        }

        if (!amount || parseFloat(amount) <= 0) {
          return 'Erro: O valor do depósito deve ser positivo.';
        }

        const caixinhas = await caixinhasService.getByUsuarioId(userId);
        const caixinha = caixinhas.find(c => c.id === parseInt(box_id, 10));

        if (!caixinha) {
          return 'Erro: Caixinha não encontrada.';
        }

        const newValue = (caixinha.valor_total_arrecadado || 0) + parseFloat(amount);
        const isCompleted = newValue >= (caixinha.valor_meta || 0);

        const updated = await caixinhasService.update(parseInt(box_id, 10), {
          valor_total_arrecadado: newValue,
          deposito: parseFloat(amount),
        });

        if (updated) {
          if (isCompleted) {
            return `✅ Depósito de R$ ${parseFloat(amount).toFixed(2)} adicionado! Parabéns, você atingiu a meta da caixinha "${caixinha.nome_caixinha}"!`;
          }
          return `✅ Depósito de R$ ${parseFloat(amount).toFixed(2)} adicionado à caixinha "${caixinha.nome_caixinha}". Valor atual: R$ ${newValue.toFixed(2)} / R$ ${(caixinha.valor_meta || 0).toFixed(2)}.`;
        } else {
          return 'Erro: Não foi possível adicionar o depósito.';
        }
      }

      case 'list_savings_boxes': {
        const { limit = 10 } = args;
        const boxes = await caixinhasService.getByUsuarioId(userId);

        const filteredBoxes = boxes.slice(0, limit);

        if (filteredBoxes.length === 0) {
          return 'Nenhuma caixinha encontrada.';
        }

        const boxesList = filteredBoxes
          .map(
            (b) => {
              const valorMeta = b.valor_meta || 0;
              const valorArrecadado = b.valor_total_arrecadado || 0;
              const progress = valorMeta > 0 ? (valorArrecadado / valorMeta) * 100 : 0;
              const remaining = Math.max(0, valorMeta - valorArrecadado);
              const isCompleted = valorArrecadado >= valorMeta;
              return `- ${isCompleted ? '✅' : '💰'} ${b.nome_caixinha || 'Sem nome'}: R$ ${valorArrecadado.toFixed(2)} / R$ ${valorMeta.toFixed(2)} (${progress.toFixed(0)}%)${remaining > 0 ? ` - Falta: R$ ${remaining.toFixed(2)}` : ''}${b.data_para_concluir ? ` - Prazo: ${format(new Date(b.data_para_concluir), 'dd/MM/yyyy')}` : ''}`;
            }
          )
          .join('\n');

        return `Caixinhas:\n${boxesList}`;
      }

      default:
        return `Função desconhecida: ${functionName}`;
    }
  } catch (error) {
    console.error(`Error executing function ${functionName}:`, error);
    return `Erro ao executar ${functionName}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
  }
};

// Serviços de chat - usando OpenAI diretamente (NÃO usa API_BASE_URL)
export const chatService = {
  sendMessage: async (
    phoneNumber: string,
    message: string,
    onStream?: (chunk: string, fullText: string) => void,
    onThinking?: () => void,
    onStartTyping?: () => void,
    userId?: number
  ): Promise<ApiResponse<any>> => {
    // Verificar se tem API KEY da OpenAI
    if (!API_KEY) {
      return {
        success: false,
        error: 'API KEY da OpenAI não configurada. Configure EXPO_PUBLIC_API_KEY no arquivo .env com sua chave da OpenAI',
      };
    }

    try {
      // Mostrar estado de "pensando"
      if (onThinking) {
        onThinking();
      }

      // Pequeno delay para mostrar o estado de pensando
      await new Promise(resolve => setTimeout(resolve, 800));

      // Mostrar estado de "escrevendo"
      if (onStartTyping) {
        onStartTyping();
      }

      // Pequeno delay antes de começar a escrever
      await new Promise(resolve => setTimeout(resolve, 300));

      // Definir as ferramentas (tools) disponíveis
      const tools = [
        {
          type: 'function',
          function: {
            name: 'create_transaction',
            description: 'Criar uma nova transação financeira (receita ou despesa). Use esta função quando o usuário pedir para adicionar um gasto, receita, despesa ou transação financeira.',
            parameters: {
              type: 'object',
              properties: {
                description: {
                  type: 'string',
                  description: 'Descrição da transação (ex: "Almoço", "Salário")',
                },
                amount: {
                  type: 'number',
                  description: 'Valor da transação em reais (ex: 30.50)',
                },
                type: {
                  type: 'string',
                  enum: ['expense', 'income', 'saida', 'entrada'],
                  description: 'Tipo da transação: "expense" ou "saida" para despesas, "income" ou "entrada" para receitas. Se não fornecido, tentar inferir baseado na descrição (gastos são "expense" por padrão)',
                },
                category: {
                  type: 'string',
                  description: 'Categoria da transação (ex: "Alimentação", "Trabalho", "Outros"). Se não fornecida, tentar inferir baseado na descrição (ex: "almoço" -> "Alimentação")',
                },
                date: {
                  type: 'string',
                  description: 'Data da transação no formato ISO (YYYY-MM-DD), timestamp, ou expressões como "hoje", "amanhã", "ontem". Se o usuário mencionar um horário (ex: "meio dia", "12h"), incluir na data. Se não fornecida, usar a data atual',
                },
              },
              required: ['description', 'amount'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'list_transactions',
            description: 'Listar transações financeiras do usuário. Use esta função quando o usuário pedir para ver gastos, receitas, transações ou extrato.',
            parameters: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Número máximo de transações para retornar (padrão: 10)',
                },
                type: {
                  type: 'string',
                  enum: ['income', 'expense'],
                  description: 'Filtrar por tipo: "income" para receitas, "expense" para despesas',
                },
                category: {
                  type: 'string',
                  description: 'Filtrar por categoria',
                },
              },
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'create_task',
            description: 'Criar uma nova tarefa na lista de tarefas. Use esta função quando o usuário pedir para adicionar uma tarefa, item na lista, ou criar um to-do.',
            parameters: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Título/descrição da tarefa',
                },
                category: {
                  type: 'string',
                  description: 'Categoria da tarefa (ex: "Pessoal", "Trabalho", "Saúde")',
                },
                date: {
                  type: 'string',
                  description: 'Data limite da tarefa no formato ISO (YYYY-MM-DD). Opcional',
                },
              },
              required: ['title'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'list_tasks',
            description: 'Listar tarefas do usuário. Use esta função quando o usuário pedir para ver suas tarefas, lista de afazeres ou to-dos.',
            parameters: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  enum: ['pendente', 'concluida'],
                  description: 'Filtrar por status: "pendente" ou "concluida"',
                },
                limit: {
                  type: 'number',
                  description: 'Número máximo de tarefas para retornar (padrão: 10)',
                },
              },
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'create_reminder',
            description: 'Criar um novo lembrete. Use esta função quando o usuário pedir para criar um lembrete, alarme ou notificação para uma data/hora específica.',
            parameters: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Título/descrição do lembrete',
                },
                date: {
                  type: 'string',
                  description: 'Data e hora do lembrete no formato ISO (YYYY-MM-DDTHH:mm:ss) ou timestamp',
                },
                recurrence: {
                  type: 'string',
                  description: 'Recorrência do lembrete (ex: "Unico", "Diario", "Semanal", "Mensal")',
                },
              },
              required: ['title', 'date'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'list_reminders',
            description: 'Listar lembretes do usuário. Use esta função quando o usuário pedir para ver seus lembretes ou alarmes.',
            parameters: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Número máximo de lembretes para retornar (padrão: 10)',
                },
              },
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'create_shopping_item',
            description: 'Adicionar um item à lista de compras. Use esta função quando o usuário pedir para adicionar algo à lista de compras, lista do supermercado ou lista de itens para comprar.',
            parameters: {
              type: 'object',
              properties: {
                item: {
                  type: 'string',
                  description: 'Nome do item a ser adicionado (ex: "Leite", "Pão", "Arroz")',
                },
                category: {
                  type: 'string',
                  enum: ['Alimentos', 'Limpeza', 'Higiene', 'Outros'],
                  description: 'Categoria do item (padrão: "Outros")',
                },
              },
              required: ['item'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'list_shopping_items',
            description: 'Listar itens da lista de compras. Use esta função quando o usuário pedir para ver sua lista de compras, lista do supermercado ou itens para comprar.',
            parameters: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  enum: ['pendente', 'comprado'],
                  description: 'Filtrar por status: "pendente" ou "comprado"',
                },
                limit: {
                  type: 'number',
                  description: 'Número máximo de itens para retornar (padrão: 20)',
                },
              },
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'create_savings_box',
            description: 'Criar uma nova caixinha de economia (meta de poupança). Use esta função quando o usuário pedir para criar uma meta de economia, poupança ou caixinha para guardar dinheiro.',
            parameters: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Nome da caixinha (ex: "Viagem", "Notebook", "Emergência")',
                },
                goal: {
                  type: 'string',
                  description: 'Valor da meta em reais (ex: "1000", "5000")',
                },
                deadline: {
                  type: 'string',
                  description: 'Data limite para atingir a meta no formato YYYY-MM-DD (ex: "2024-12-31")',
                },
              },
              required: ['name', 'goal', 'deadline'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'add_deposit',
            description: 'Adicionar um depósito a uma caixinha de economia. Use esta função quando o usuário pedir para adicionar dinheiro, fazer um depósito ou guardar dinheiro em uma caixinha.',
            parameters: {
              type: 'object',
              properties: {
                box_id: {
                  type: 'string',
                  description: 'ID da caixinha onde adicionar o depósito. Se o usuário mencionar o nome da caixinha, você precisará primeiro listar as caixinhas para encontrar o ID.',
                },
                amount: {
                  type: 'string',
                  description: 'Valor do depósito em reais (ex: "100", "500")',
                },
              },
              required: ['box_id', 'amount'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'list_savings_boxes',
            description: 'Listar caixinhas de economia do usuário. Use esta função quando o usuário pedir para ver suas metas de poupança, caixinhas ou economias.',
            parameters: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  enum: ['ativa', 'concluida'],
                  description: 'Filtrar por status: "ativa" ou "concluida"',
                },
                limit: {
                  type: 'number',
                  description: 'Número máximo de caixinhas para retornar (padrão: 10)',
                },
              },
            },
          },
        },
      ];

      // Criar mensagens da conversa
      const messages: any[] = [
        {
          role: 'system',
          content: `Você é a ION, uma assistente pessoal inteligente e prestativa. Seja amigável, concisa e útil.

Você tem acesso a funções que permitem:
- Criar e listar transações financeiras (gastos e receitas)
- Criar e listar tarefas
- Criar e listar lembretes
- Adicionar e listar itens da lista de compras
- Criar e gerenciar caixinhas de economia (metas de poupança)

Quando o usuário pedir para fazer algo (como adicionar um gasto, criar uma tarefa, etc.), você DEVE usar as funções disponíveis para realmente executar a ação. Não apenas diga que vai fazer - EXECUTE a função.

Exemplos:
- Se o usuário pedir "adicione um gasto de 30 reais para almoço", você deve chamar a função create_transaction
- Se o usuário pedir "quais são meus gastos?", você deve chamar a função list_transactions
- Se o usuário pedir "crie uma tarefa para comprar leite", você deve chamar a função create_task
- Se o usuário pedir "adicione leite à lista de compras", você deve chamar a função create_shopping_item
- Se o usuário pedir "crie uma meta para guardar 1000 reais até dezembro", você deve chamar a função create_savings_box

Sempre confirme ao usuário quando uma ação foi executada com sucesso.`
        },
        {
          role: 'user',
          content: message
        }
      ];

      // Loop para processar múltiplas chamadas de função se necessário
      let fullText = '';
      let maxIterations = 5;
      let iteration = 0;

      while (iteration < maxIterations) {
        // Chamar a API da OpenAI
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: messages,
            tools: tools,
            tool_choice: 'auto', // A OpenAI decide quando usar as funções
            temperature: 1,
            max_tokens: 1000,
          }),
        });

        if (!response.ok) {
          let errorMessage = `Erro ${response.status}`;
          try {
            const errorData = await response.json();

            // LOG DETALHADO DO ERRO DA OPENAI
            console.error('[OpenAI API Error Details]', JSON.stringify(errorData, null, 2));

            errorMessage = errorData.error?.message || errorData.error?.code || errorMessage;

            if (response.status === 401) {
              errorMessage = 'API KEY inválida ou expirada. Verifique se sua chave da OpenAI está correta e ativa.';
            } else if (response.status === 429) {
              errorMessage = 'Limite de requisições excedido. Verifique seus créditos na OpenAI.';
            } else if (response.status === 500) {
              errorMessage = 'Erro no servidor da OpenAI. Tente novamente.';
            }
          } catch (e) {
            errorMessage = `Erro ${response.status}: ${response.statusText || 'Erro desconhecido'}`;
          }

          return { success: false, error: errorMessage };
        }

        const data = await response.json();
        const message = data.choices?.[0]?.message;

        if (!message) {
          break;
        }

        // Adicionar a mensagem do assistente à conversa
        messages.push(message);

        // Verificar se há tool_calls (chamadas de função)
        if (message.tool_calls && message.tool_calls.length > 0) {
          // Executar todas as funções solicitadas
          const lastUserMessage = [...messages].reverse().find((msg: any) => msg.role === 'user')?.content;

          const toolResults = await Promise.all(
            message.tool_calls.map(async (toolCall: any) => {
              const functionName = toolCall.function.name;
              const functionArgs = JSON.parse(toolCall.function.arguments);

              console.log(`[Function Call] ${functionName}`, functionArgs);

              const result = await executeFunctionCall(functionName, functionArgs, userId, lastUserMessage);

              return {
                role: 'tool' as const,
                tool_call_id: toolCall.id,
                content: result,
              };
            })
          );

          // Adicionar os resultados das funções à conversa
          messages.push(...toolResults);

          iteration++;
          continue; // Fazer nova requisição com os resultados
        } else {
          // Não há tool_calls, temos a resposta final
          fullText = message.content || 'Desculpe, não consegui gerar uma resposta.';
          break;
        }
      }

      // Se não conseguimos uma resposta após todas as iterações
      if (!fullText) {
        fullText = 'Desculpe, ocorreu um problema ao processar sua solicitação.';
      }

      // Simular streaming - exibir texto letra por letra
      if (onStream && fullText) {
        let displayedText = '';
        const chars = fullText.split('');

        for (let i = 0; i < chars.length; i++) {
          displayedText += chars[i];

          if (onStream) {
            onStream(chars[i], displayedText);
          }

          const char = chars[i];
          let delay = 20;

          if (char === ' ' || char === '\n') {
            delay = 10;
          } else if (char === '.' || char === '!' || char === '?') {
            delay = 100;
          } else if (char === ',') {
            delay = 60;
          }

          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      return {
        success: true,
        data: {
          message: fullText,
          response: fullText,
          text: fullText
        }
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[Chat Error]', error);
      return {
        success: false,
        error: errorMsg.includes('fetch')
          ? 'Erro de conexão. Verifique sua internet.'
          : errorMsg,
      };
    }
  },

  sendMessageWithImage: async (
    phoneNumber: string,
    message: string,
    imageUri: string,
    onStream?: (chunk: string, fullText: string) => void,
    onThinking?: () => void,
    onStartTyping?: () => void
  ): Promise<ApiResponse<any>> => {
    // Verificar se tem API KEY da OpenAI
    if (!API_KEY) {
      return {
        success: false,
        error: 'API KEY da OpenAI não configurada. Configure EXPO_PUBLIC_API_KEY no arquivo .env com sua chave da OpenAI',
      };
    }

    try {
      // Mostrar estado de "pensando"
      if (onThinking) {
        onThinking();
      }

      // Ler a imagem e converter para base64 usando a API legada (compatível com SDK 54)
      const base64Image = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Determinar o tipo MIME baseado na extensão
      const uriLower = imageUri.toLowerCase();
      let mimeType = 'image/jpeg';
      if (uriLower.includes('.png')) {
        mimeType = 'image/png';
      } else if (uriLower.includes('.gif')) {
        mimeType = 'image/gif';
      } else if (uriLower.includes('.webp')) {
        mimeType = 'image/webp';
      }

      const imageUrl = `data:${mimeType};base64,${base64Image}`;

      // Pequeno delay para mostrar o estado de pensando
      await new Promise(resolve => setTimeout(resolve, 1000)); // Um pouco mais para processar imagem

      // Mostrar estado de "escrevendo"
      if (onStartTyping) {
        onStartTyping();
      }

      // Pequeno delay antes de começar a escrever
      await new Promise(resolve => setTimeout(resolve, 300));

      // Preparar mensagens com conteúdo multimodal
      const messages: any[] = [
        {
          role: 'system',
          content: 'Você é a ION, uma assistente pessoal inteligente e prestativa. Seja amigável, concisa e útil. Quando receber uma imagem, analise-a e forneça informações relevantes sobre ela.'
        }
      ];

      // Adicionar mensagem do usuário com imagem
      const userMessage: any = {
        role: 'user',
        content: []
      };

      // Adicionar texto se houver
      if (message && message.trim()) {
        userMessage.content.push({
          type: 'text',
          text: message
        });
      }

      // Adicionar imagem
      userMessage.content.push({
        type: 'image_url',
        image_url: {
          url: imageUrl
        }
      });

      messages.push(userMessage);

      // Chamar a API Vision da OpenAI (sem streaming - vamos simular)
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o', // Modelo que suporta visão
          messages: messages,
          temperature: 1,
          max_tokens: 500,
          stream: false, // Sem streaming - vamos simular depois
        }),
      });

      if (!response.ok) {
        let errorMessage = `Erro ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorData.error?.code || errorMessage;

          if (response.status === 401) {
            errorMessage = 'API KEY inválida. Verifique sua chave no arquivo .env';
          } else if (response.status === 429) {
            errorMessage = 'Limite de requisições excedido. Tente novamente mais tarde.';
          } else if (response.status === 500) {
            errorMessage = 'Erro no servidor da OpenAI. Tente novamente.';
          }
        } catch (e) {
          errorMessage = `Erro ${response.status}: ${response.statusText || 'Erro desconhecido'}`;
        }

        return { success: false, error: errorMessage };
      }

      // Obter resposta completa
      const data = await response.json();
      const fullText = data.choices?.[0]?.message?.content || 'Desculpe, não consegui processar a imagem.';

      // Simular streaming - exibir texto letra por letra
      if (onStream && fullText) {
        let displayedText = '';
        const chars = fullText.split('');

        for (let i = 0; i < chars.length; i++) {
          displayedText += chars[i];

          // Chamar callback com o texto atual
          if (onStream) {
            onStream(chars[i], displayedText);
          }

          // Delay entre caracteres (velocidade de digitação)
          // Velocidade variável: mais rápido para espaços, mais lento para pontuação
          const char = chars[i];
          let delay = 20; // base delay em ms

          if (char === ' ' || char === '\n') {
            delay = 10; // mais rápido para espaços
          } else if (char === '.' || char === '!' || char === '?') {
            delay = 100; // pausa maior para pontuação
          } else if (char === ',') {
            delay = 60; // pausa média para vírgulas
          }

          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      return {
        success: true,
        data: {
          message: fullText,
          response: fullText,
          text: fullText
        }
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[Chat with Image Error]', error);
      return {
        success: false,
        error: errorMsg.includes('fetch')
          ? 'Erro de conexão. Verifique sua internet.'
          : errorMsg,
      };
    }
  },

  sendMessageWithDocument: async (
    phoneNumber: string,
    message: string,
    documentUri: string,
    documentName: string,
    documentType: string
  ): Promise<ApiResponse<any>> => {
    // Verificar se tem API KEY da OpenAI
    if (!API_KEY) {
      return {
        success: false,
        error: 'API KEY da OpenAI não configurada. Configure EXPO_PUBLIC_API_KEY no arquivo .env com sua chave da OpenAI',
      };
    }

    try {
      const fileExtension = documentName.split('.').pop()?.toLowerCase() || '';
      const textExtensions = ['txt', 'md', 'json', 'csv', 'log', 'xml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h'];
      const pdfExtensions = ['pdf'];

      let documentContent = '';
      let isPdf = pdfExtensions.includes(fileExtension);

      // Tentar ler o conteúdo do documento
      if (textExtensions.includes(fileExtension)) {
        // Arquivos de texto simples
        try {
          documentContent = await FileSystem.readAsStringAsync(documentUri, {
            encoding: FileSystem.EncodingType.UTF8,
          });

          // Limitar o tamanho do conteúdo para não exceder limites da API
          if (documentContent.length > 100000) {
            documentContent = documentContent.substring(0, 100000) + '\n\n... (conteúdo truncado - arquivo muito grande)';
          }
        } catch (readError) {
          console.warn('Could not read document content:', readError);
          documentContent = '[Não foi possível ler o conteúdo do arquivo]';
        }
      } else if (isPdf) {
        // Para PDFs, vamos fazer upload para a OpenAI usando a API de Files
        try {
          console.log('Processing PDF file:', documentName);

          // Ler o arquivo como base64 primeiro para garantir que temos acesso
          const base64Content = await FileSystem.readAsStringAsync(documentUri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          // Converter base64 para blob para upload
          // No React Native, precisamos usar FormData com o formato correto
          const formData = new FormData();

          // No React Native/Expo, o formato correto é usar uri diretamente
          // O name deve ser o nome do arquivo sem caminho
          const fileName = documentName.split('/').pop() || documentName;

          formData.append('file', {
            uri: documentUri,
            type: 'application/pdf',
            name: fileName,
          } as any);
          formData.append('purpose', 'assistants');

          console.log('FormData prepared with:', {
            uri: documentUri,
            type: 'application/pdf',
            name: fileName
          });

          console.log('Uploading PDF to OpenAI...');
          console.log('Document URI:', documentUri);
          console.log('Document Name:', documentName);

          const uploadResponse = await fetch('https://api.openai.com/v1/files', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${API_KEY}`,
              // Não definir Content-Type - React Native define automaticamente para FormData
            },
            body: formData as any,
          });

          console.log('Upload response status:', uploadResponse.status);

          if (uploadResponse.ok) {
            const uploadData = await uploadResponse.json();
            console.log('Upload response data:', JSON.stringify(uploadData, null, 2));
            const fileId = uploadData.id;

            if (!fileId) {
              console.error('No file ID in upload response!');
              throw new Error('Upload response missing file ID');
            }

            console.log('PDF uploaded successfully, fileId:', fileId);
            console.log('FileId validation:', {
              exists: !!fileId,
              type: typeof fileId,
              length: fileId?.length,
              value: fileId
            });

            // Verificar o status do arquivo e aguardar processamento se necessário
            let fileProcessed = false;
            let attempts = 0;
            const maxAttempts = 20; // Aumentar tentativas

            console.log('Waiting for file to be processed...');

            while (!fileProcessed && attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 2000)); // Aguardar 2 segundos

              try {
                const fileStatusResponse = await fetch(`https://api.openai.com/v1/files/${fileId}`, {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                  },
                });

                if (fileStatusResponse.ok) {
                  const fileStatus = await fileStatusResponse.json();
                  console.log(`Attempt ${attempts + 1}: File status:`, fileStatus.status);

                  if (fileStatus.status === 'processed') {
                    fileProcessed = true;
                    console.log('✅ File processed successfully!');
                    documentContent = `[PDF_UPLOADED:${fileId}]`;
                    break;
                  } else if (fileStatus.status === 'error') {
                    console.error('❌ File processing error:', fileStatus);
                    throw new Error('File processing failed');
                  } else if (fileStatus.status === 'pending') {
                    console.log('⏳ File still processing...');
                  }
                } else {
                  console.warn('Failed to check file status:', fileStatusResponse.status);
                }
              } catch (statusError) {
                console.error('Error checking file status:', statusError);
              }

              attempts++;
            }

            if (!fileProcessed) {
              console.warn('⚠️ File processing timeout after', maxAttempts, 'attempts');
              console.warn('Using fileId anyway:', fileId);
              // Mesmo sem estar processado, vamos tentar usar
              documentContent = `[PDF_UPLOADED:${fileId}]`;
            } else {
              console.log('✅ File processed successfully, fileId:', fileId);
            }

          } else {
            const errorText = await uploadResponse.text();
            console.error('❌ Upload error status:', uploadResponse.status);
            console.error('❌ Upload error response:', errorText);

            // Se o upload falhar, vamos tentar uma abordagem alternativa
            // Converter PDF para base64 e enviar como dados
            try {
              console.log('Attempting alternative: reading PDF as base64...');

              // Já temos o base64Content, vamos usar diretamente
              // Limitar o tamanho para não exceder limites da API
              const limitedBase64 = base64Content.length > 5000000
                ? base64Content.substring(0, 5000000)
                : base64Content;

              // Tentar enviar o PDF como imagem/data URL
              // Mas primeiro, vamos marcar como falha de upload
              documentContent = `[PDF_UPLOAD_FAILED:${documentName}]`;
              console.warn('PDF upload failed, will inform user about the issue');
            } catch {
              documentContent = `[PDF: ${documentName}]`;
            }
          }

        } catch (pdfError) {
          console.error('Error processing PDF:', pdfError);
          // Último recurso: tentar ler como texto
          try {
            const fallbackContent = await FileSystem.readAsStringAsync(documentUri, {
              encoding: FileSystem.EncodingType.UTF8,
            });
            if (fallbackContent && fallbackContent.length > 0) {
              documentContent = fallbackContent.substring(0, 100000);
            } else {
              documentContent = `[PDF: ${documentName}]`;
            }
          } catch {
            documentContent = `[PDF: ${documentName}]`;
          }
        }
      } else {
        // Outros arquivos binários
        documentContent = `[Arquivo binário: ${documentName} - Tipo: ${documentType}]`;
      }

      // Preparar mensagem com informações do documento
      let fullMessage = message || '';
      let fileId: string | null = null;
      let useFileAttachment = false;
      let savedFileId: string | null = null; // Salvar fileId para usar no fallback se necessário

      // Verificar se o PDF foi enviado com sucesso
      if (documentContent.startsWith('[PDF_UPLOADED:')) {
        fileId = documentContent.replace('[PDF_UPLOADED:', '').replace(']', '').trim();
        if (fileId && fileId.length > 0) {
          useFileAttachment = true;
          savedFileId = String(fileId).trim(); // Salvar para fallback
          console.log('Using file attachment with fileId:', fileId);
          console.log('FileId length:', fileId.length);
          console.log('FileId type:', typeof fileId);
          fullMessage = (message || 'Analise este documento PDF em detalhes e forneça informações relevantes sobre seu conteúdo.') + `\n\nDocumento: ${documentName}`;
        } else {
          console.error('FileId is empty or invalid!');
          useFileAttachment = false;
          fileId = null;
          savedFileId = null;
          fullMessage += `\n\nDocumento PDF anexado: ${documentName}\nTipo: ${documentType}\n\nHouve um problema ao processar o arquivo. Por favor, trabalhe com as informações disponíveis.`;
        }
      } else if (documentContent.startsWith('[PDF_UPLOAD_FAILED:')) {
        // Se o upload falhou, informar à ION que o arquivo foi anexado mas precisa de ajuda
        console.warn('PDF upload failed, but document was attached');
        fullMessage = (message || '') + `\n\nIMPORTANTE: O usuário anexou um documento PDF chamado "${documentName}". O arquivo foi selecionado pelo usuário, mas houve um problema técnico no upload. Por favor, informe ao usuário que você recebeu a notificação do documento e peça que ele descreva o conteúdo ou faça perguntas específicas sobre o documento. Seja útil e prestativa.`;
      } else if (isPdf) {
        fullMessage += `\n\nIMPORTANTE: O usuário anexou um documento PDF chamado "${documentName}". O arquivo está disponível, mas não foi possível processá-lo automaticamente. Por favor, informe ao usuário que você recebeu o documento e peça que ele descreva o conteúdo ou faça perguntas sobre o documento.`;
      } else if (documentContent && !documentContent.startsWith('[Arquivo binário')) {
        fullMessage += `\n\nDocumento anexado: ${documentName}\nTipo: ${documentType}\n\nConteúdo do documento:\n${documentContent}`;
      } else {
        fullMessage += `\n\nDocumento anexado: ${documentName}\nTipo: ${documentType}\n\nEste é um arquivo binário. Por favor, ajude o usuário com base no nome e tipo do arquivo.`;
      }

      // Preparar o body da requisição
      const requestBody: any = {
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Você é a ION, uma assistente pessoal inteligente e prestativa. Seja amigável, concisa e útil.\n\n⚠️ REGRA CRÍTICA - ANÁLISE DE DOCUMENTOS:\nQuando você receber uma mensagem com attachments contendo file_id e a ferramenta file_search, você DEVE:\n\n1. USAR IMEDIATAMENTE a ferramenta file_search com o file_id fornecido nos attachments\n2. NÃO apenas dizer que vai usar - USE A FERRAMENTA AGORA\n3. O arquivo PDF já foi enviado e processado pela OpenAI\n4. O file_id está presente e funcional nos attachments\n5. Você TEM ACESSO TOTAL ao conteúdo completo do documento\n\n✅ PROCESSO OBRIGATÓRIO:\n1. Execute a ferramenta file_search imediatamente quando ver attachments com file_id\n2. Leia e analise TODO o conteúdo do documento\n3. Extraia informações EXATAS e detalhadas do documento real\n4. Forneça respostas completas baseadas APENAS no conteúdo real do documento\n5. NUNCA invente informações - use apenas o que está no documento\n6. Se não encontrar uma informação, diga explicitamente que não está disponível no documento\n\nIMPORTANTE: Não diga que vai usar a ferramenta. USE-A IMEDIATAMENTE. O file_id está nos attachments e está pronto para uso.'
          }
        ],
        temperature: 1,
        max_tokens: 4000,
      };

      // Se temos um fileId, usar Assistants API que suporta file_search nativamente
      if (useFileAttachment && fileId && fileId.length > 0) {
        console.log('✅ Using Assistants API for file_search');
        console.log('FileId:', fileId);

        const validFileId = String(fileId).trim();

        if (!validFileId || validFileId.length === 0) {
          console.error('❌ Invalid fileId after processing!');
          useFileAttachment = false;
        } else {
          // Usar Assistants API que suporta file_search nativamente
          try {
            // 1. Criar ou obter um assistant com file_search habilitado
            console.log('🔧 Creating/retrieving assistant with file_search...');

            // Criar um assistant temporário para esta conversa
            const assistantResponse = await fetch('https://api.openai.com/v1/assistants', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
                'OpenAI-Beta': 'assistants=v2'
              },
              body: JSON.stringify({
                model: 'gpt-4o',
                name: 'ION Document Assistant',
                instructions: 'Você é a ION, uma assistente pessoal inteligente e prestativa. Seja amigável, concisa e útil. Quando você receber um arquivo, analise completamente seu conteúdo e forneça respostas detalhadas baseadas apenas no que está no documento.',
                tools: [{ type: 'file_search' }],
                tool_resources: {
                  file_search: {
                    vector_store_ids: []
                  }
                }
              })
            });

            let assistantId: string;
            if (assistantResponse.ok) {
              const assistantData = await assistantResponse.json();
              assistantId = assistantData.id;
              console.log('✅ Assistant created:', assistantId);
            } else {
              // Se falhar, tentar criar um thread diretamente com o arquivo
              console.log('⚠️ Assistant creation failed, trying direct approach...');
              throw new Error('Assistant creation failed');
            }

            // 2. Criar um thread
            console.log('🔧 Creating thread...');
            const threadResponse = await fetch('https://api.openai.com/v1/threads', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
                'OpenAI-Beta': 'assistants=v2'
              },
              body: JSON.stringify({
                messages: [
                  {
                    role: 'user',
                    content: fullMessage,
                    attachments: [
                      {
                        file_id: validFileId,
                        tools: [{ type: 'file_search' }]
                      }
                    ]
                  }
                ]
              })
            });

            if (!threadResponse.ok) {
              const errorText = await threadResponse.text();
              console.error('❌ Thread creation failed:', errorText);
              throw new Error('Thread creation failed');
            }

            const threadData = await threadResponse.json();
            const threadId = threadData.id;
            console.log('✅ Thread created:', threadId);

            // 3. Criar um run
            console.log('🔧 Creating run...');
            const runResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
                'OpenAI-Beta': 'assistants=v2'
              },
              body: JSON.stringify({
                assistant_id: assistantId,
                instructions: 'Analise o documento anexado completamente e forneça respostas detalhadas baseadas apenas no conteúdo real do documento.'
              })
            });

            if (!runResponse.ok) {
              const errorText = await runResponse.text();
              console.error('❌ Run creation failed:', errorText);
              throw new Error('Run creation failed');
            }

            const runData = await runResponse.json();
            let runId = runData.id;
            console.log('✅ Run created:', runId);

            // 4. Polling do status do run
            let runStatus = runData.status;
            let attempts = 0;
            const maxAttempts = 30;

            while (runStatus !== 'completed' && runStatus !== 'failed' && attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 1000));

              const statusResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${API_KEY}`,
                  'OpenAI-Beta': 'assistants=v2'
                }
              });

              if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                runStatus = statusData.status;
                console.log(`⏳ Run status (attempt ${attempts + 1}):`, runStatus);
              }

              attempts++;
            }

            if (runStatus !== 'completed') {
              throw new Error(`Run failed or timeout. Status: ${runStatus}`);
            }

            // 5. Obter mensagens do thread
            console.log('📥 Retrieving messages...');
            const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'OpenAI-Beta': 'assistants=v2'
              }
            });

            if (!messagesResponse.ok) {
              throw new Error('Failed to retrieve messages');
            }

            const messagesData = await messagesResponse.json();
            console.log('📥 Messages data:', JSON.stringify(messagesData, null, 2));

            const assistantMessage = messagesData.data
              .filter((msg: any) => msg.role === 'assistant')
              .sort((a: any, b: any) => b.created_at - a.created_at)[0];

            console.log('📥 Assistant message:', JSON.stringify(assistantMessage, null, 2));

            if (!assistantMessage) {
              throw new Error('No assistant message found');
            }

            // Extrair o texto da mensagem - pode estar em diferentes formatos
            let aiMessage = 'Desculpe, não consegui processar o documento.';

            if (assistantMessage.content && Array.isArray(assistantMessage.content)) {
              // Formato array de content items
              const textContent = assistantMessage.content.find((item: any) => item.type === 'text');
              if (textContent && textContent.text) {
                aiMessage = textContent.text.value || textContent.text || aiMessage;
              } else if (assistantMessage.content[0]?.text?.value) {
                aiMessage = assistantMessage.content[0].text.value;
              }
            } else if (assistantMessage.content?.text?.value) {
              aiMessage = assistantMessage.content.text.value;
            } else if (typeof assistantMessage.content === 'string') {
              aiMessage = assistantMessage.content;
            }

            console.log('✅ Successfully retrieved message from Assistants API');
            console.log('📄 Extracted message:', aiMessage.substring(0, 200) + '...');

            return {
              success: true,
              data: {
                message: aiMessage,
                response: aiMessage,
                text: aiMessage
              }
            };

          } catch (assistantError) {
            console.error('❌ Assistants API error:', assistantError);
            console.log('⚠️ Falling back to Chat Completions without attachments...');
            // Fallback para abordagem sem attachments
            useFileAttachment = false;
          }
        }
      }

      // Se não usamos Assistants API ou se falhou, usar Chat Completions normal
      if (!useFileAttachment) {
        requestBody.messages.push({
          role: 'user',
          content: fullMessage
        });
      }

      // Chamar a API da OpenAI (Chat Completions)
      console.log('📤 Sending request to OpenAI with document...');
      console.log('📋 Full request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📥 OpenAI response status:', response.status);

      if (!response.ok) {
        let errorMessage = `Erro ${response.status}`;
        let shouldRetryWithoutAttachments = false;

        try {
          const errorText = await response.text();
          console.error('❌ OpenAI error response (raw):', errorText);
          const errorData = JSON.parse(errorText);
          console.error('❌ OpenAI error response (parsed):', JSON.stringify(errorData, null, 2));
          errorMessage = errorData.error?.message || errorData.error?.code || errorMessage;

          if (response.status === 401) {
            errorMessage = 'API KEY inválida. Verifique sua chave no arquivo .env';
          } else if (response.status === 429) {
            errorMessage = 'Limite de requisições excedido. Tente novamente mais tarde.';
          } else if (response.status === 500) {
            errorMessage = 'Erro no servidor da OpenAI. Tente novamente.';
          } else if (response.status === 400) {
            // Verificar se é erro relacionado a attachments ou file_search
            const errorMsg = errorData.error?.message || '';
            if (errorMsg.includes('file_search') || errorMsg.includes('attachments') || errorMsg.includes('tools')) {
              console.warn('⚠️ Error with attachments/file_search, trying fallback approach...');
              shouldRetryWithoutAttachments = true;
            } else {
              errorMessage = errorMsg || 'Erro no formato da requisição. Verifique os logs.';
            }
          }
        } catch (e) {
          const errorText = await response.text();
          console.error('Error response text:', errorText);
          errorMessage = `Erro ${response.status}: ${response.statusText}`;
        }

        // Se for erro de attachments, tentar sem attachments
        if (shouldRetryWithoutAttachments && useFileAttachment && savedFileId) {
          console.log('🔄 Retrying without attachments, using file_id in message...');

          // Tentar abordagem alternativa: mencionar o file_id na mensagem
          const fallbackMessage = `${fullMessage}\n\nIMPORTANTE: Um arquivo PDF foi enviado e processado pela OpenAI. O file_id é: ${savedFileId}. Por favor, use este file_id para acessar o conteúdo do documento através da API da OpenAI se necessário. Mas por enquanto, trabalhe com as informações que você tem acesso.`;

          const fallbackRequestBody = {
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: 'Você é a ION, uma assistente pessoal inteligente e prestativa. Seja amigável, concisa e útil.'
              },
              {
                role: 'user',
                content: fallbackMessage
              }
            ],
            temperature: 1,
            max_tokens: 4000,
          };

          try {
            const fallbackResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
              },
              body: JSON.stringify(fallbackRequestBody),
            });

            if (fallbackResponse.ok) {
              const fallbackData = await fallbackResponse.json();
              const fallbackMessage = fallbackData.choices?.[0]?.message?.content || 'Desculpe, não consegui processar o documento.';

              return {
                success: true,
                data: {
                  message: fallbackMessage,
                  response: fallbackMessage,
                  text: fallbackMessage
                }
              };
            }
          } catch (fallbackError) {
            console.error('❌ Fallback also failed:', fallbackError);
          }
        }

        return { success: false, error: errorMessage };
      }

      const responseText = await response.text();
      console.log('📥 OpenAI response (raw):', responseText.substring(0, 500) + '...');
      let data = JSON.parse(responseText);
      console.log('📥 OpenAI response data:', JSON.stringify(data, null, 2));

      // Processar tool_calls corretamente - loop até obter resposta final
      let conversationMessages = [...requestBody.messages];
      let aiMessage = '';
      let maxIterations = 5; // Limitar iterações para evitar loops infinitos
      let iteration = 0;

      while (iteration < maxIterations) {
        const message = data.choices?.[0]?.message;

        if (!message) {
          console.error('❌ No message in response');
          break;
        }

        // Adicionar a mensagem do assistente à conversa
        conversationMessages.push(message);

        // Verificar se há tool_calls
        if (message.tool_calls && message.tool_calls.length > 0) {
          console.log(`🔧 Tool calls detected (iteration ${iteration + 1}):`, JSON.stringify(message.tool_calls, null, 2));

          // Para file_search, quando há tool_calls, precisamos adicionar respostas de tool
          // e então fazer uma nova requisição para obter o resultado

          // Adicionar respostas de tool para cada tool_call
          const toolResponses = message.tool_calls.map((toolCall: any) => {
            // Para file_search, a OpenAI processa automaticamente - não precisamos fornecer conteúdo manual
            // Mas precisamos adicionar uma resposta de tool para continuar a conversa
            return {
              role: 'tool',
              tool_call_id: toolCall.id,
              content: '[O arquivo foi processado e está disponível. Por favor, analise o conteúdo completo do documento e forneça uma resposta detalhada baseada no conteúdo real.]'
            };
          });

          // Adicionar as respostas de tool às mensagens
          conversationMessages.push(...toolResponses);

          iteration++;

          // Fazer nova requisição com as mensagens acumuladas incluindo as respostas de tool
          console.log(`🔄 Making follow-up request (iteration ${iteration}) to get file content...`);
          const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${API_KEY}`,
            },
            body: JSON.stringify({
              model: requestBody.model,
              messages: conversationMessages,
              temperature: requestBody.temperature,
              max_tokens: requestBody.max_tokens,
            }),
          });

          if (!followUpResponse.ok) {
            const errorText = await followUpResponse.text();
            console.error('❌ Follow-up error:', errorText);
            // Em caso de erro, tentar usar o content da mensagem atual se disponível
            aiMessage = message.content || 'Erro ao processar o documento.';
            break;
          }

          const followUpText = await followUpResponse.text();
          data = JSON.parse(followUpText);
          console.log(`📥 Follow-up response (iteration ${iteration}):`, JSON.stringify(data, null, 2));

          // Continuar o loop para verificar se há mais tool_calls ou se temos a resposta final
          continue;
        } else {
          // Não há tool_calls, temos a resposta final com o conteúdo processado
          aiMessage = message.content || 'Desculpe, não consegui processar o documento.';
          console.log('✅ Final response received (no tool calls)');
          console.log('📄 Response length:', aiMessage.length);
          break;
        }
      }

      // Se ainda não temos mensagem, usar a última disponível
      if (!aiMessage || aiMessage.trim() === '') {
        aiMessage = data.choices?.[0]?.message?.content || 'Desculpe, não consegui processar o documento.';
        console.warn('⚠️ Using fallback message');
      }

      // Verificar se o modelo disse que vai usar a ferramenta mas não executou tool_calls
      const saysWillUseTool = aiMessage.toLowerCase().includes('vou usar') ||
        aiMessage.toLowerCase().includes('vou utilizar') ||
        aiMessage.toLowerCase().includes('usar a ferramenta') ||
        aiMessage.toLowerCase().includes('usar file_search') ||
        (aiMessage.toLowerCase().includes('analisar') && aiMessage.toLowerCase().includes('ferramenta'));

      const hasToolCalls = data.choices?.[0]?.message?.tool_calls && data.choices[0].message.tool_calls.length > 0;

      if (saysWillUseTool && !hasToolCalls && iteration === 0 && savedFileId) {
        console.warn('⚠️ Modelo disse que vai usar a ferramenta mas não executou tool_calls. Forçando nova tentativa...');

        // Fazer uma nova requisição com instrução mais explícita
        const retryMessage = {
          role: 'user',
          content: 'Por favor, execute a ferramenta file_search AGORA com o file_id dos attachments para acessar o conteúdo do documento. Não apenas diga que vai usar - execute a ferramenta.',
          attachments: [
            {
              file_id: savedFileId,
              tools: [{ type: 'file_search' }]
            }
          ]
        };

        const retryRequestBody = {
          model: requestBody.model,
          messages: [
            ...requestBody.messages,
            {
              role: 'assistant',
              content: aiMessage
            },
            retryMessage
          ],
          temperature: requestBody.temperature,
          max_tokens: requestBody.max_tokens,
        };

        try {
          const retryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${API_KEY}`,
            },
            body: JSON.stringify(retryRequestBody),
          });

          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            console.log('🔄 Retry response:', JSON.stringify(retryData, null, 2));

            if (retryData.choices?.[0]?.message?.tool_calls) {
              // Agora sim executou tool_calls, processar normalmente
              console.log('✅ Retry successful - tool_calls detected');
              // Processar tool_calls do retry
              const retryMessage = retryData.choices[0].message;
              const retryToolResponses = retryMessage.tool_calls.map((toolCall: any) => ({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: '[O arquivo foi processado e está disponível. Por favor, analise o conteúdo completo do documento e forneça uma resposta detalhada baseada no conteúdo real.]'
              }));

              const retryFollowUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${API_KEY}`,
                },
                body: JSON.stringify({
                  model: requestBody.model,
                  messages: [
                    ...requestBody.messages,
                    retryMessage,
                    ...retryToolResponses
                  ],
                  temperature: requestBody.temperature,
                  max_tokens: requestBody.max_tokens,
                }),
              });

              if (retryFollowUpResponse.ok) {
                const retryFollowUpData = await retryFollowUpResponse.json();
                aiMessage = retryFollowUpData.choices?.[0]?.message?.content || aiMessage;
                console.log('✅ Retry follow-up completed');
              }
            } else if (retryData.choices?.[0]?.message?.content) {
              aiMessage = retryData.choices[0].message.content;
            }
          }
        } catch (retryError) {
          console.error('❌ Retry error:', retryError);
        }
      }

      // Se a mensagem ainda menciona que não tem file_id, adicionar instrução adicional
      if (aiMessage.toLowerCase().includes('não receb') ||
        aiMessage.toLowerCase().includes('não tem') ||
        aiMessage.toLowerCase().includes('file_id') ||
        (aiMessage.toLowerCase().includes('anexo') && aiMessage.toLowerCase().includes('não'))) {
        console.warn('⚠️ Modelo ainda menciona problema com file_id. Adicionando instrução adicional...');
        // Não fazer nada, apenas logar - o system prompt já foi atualizado
      }

      return {
        success: true,
        data: {
          message: aiMessage,
          response: aiMessage,
          text: aiMessage
        }
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[Chat with Document Error]', error);
      return {
        success: false,
        error: errorMsg.includes('fetch')
          ? 'Erro de conexão. Verifique sua internet.'
          : errorMsg,
      };
    }
  },

  getHistory: async (phoneNumber: string) => {
    return request(`/chat/history?phoneNumber=${phoneNumber}`);
  },

  transcribeAudio: async (audioUri: string): Promise<ApiResponse<string>> => {
    // Verificar se tem API KEY da OpenAI
    if (!API_KEY) {
      return {
        success: false,
        error: 'API KEY da OpenAI não configurada. Configure EXPO_PUBLIC_API_KEY no arquivo .env com sua chave da OpenAI',
      };
    }

    try {
      // Extrair o nome do arquivo e extensão
      const fileName = audioUri.split('/').pop() || 'audio.m4a';
      const fileExtension = fileName.split('.').pop() || 'm4a';
      const mimeType = fileExtension === 'm4a' ? 'audio/m4a' : `audio/${fileExtension}`;

      // Criar FormData para enviar o arquivo
      const formData = new FormData();

      // Formato correto para React Native
      formData.append('file', {
        uri: audioUri,
        type: mimeType,
        name: fileName,
      } as any);
      formData.append('model', 'whisper-1');
      formData.append('language', 'pt');

      // Chamar a API Whisper da OpenAI para transcrever
      // Nota: Não definir Content-Type, o React Native define automaticamente com boundary correto
      const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          // Não definir Content-Type - React Native define automaticamente para FormData
        },
        body: formData as any,
      });

      if (!transcriptionResponse.ok) {
        let errorMessage = `Erro ${transcriptionResponse.status}`;
        try {
          const errorData = await transcriptionResponse.json();
          errorMessage = errorData.error?.message || errorData.error?.code || errorMessage;

          if (transcriptionResponse.status === 401) {
            errorMessage = 'API KEY inválida. Verifique sua chave no arquivo .env';
          } else if (transcriptionResponse.status === 429) {
            errorMessage = 'Limite de requisições excedido. Tente novamente mais tarde.';
          }
        } catch (e) {
          errorMessage = `Erro ${transcriptionResponse.status}: ${transcriptionResponse.statusText}`;
        }

        return { success: false, error: errorMessage };
      }

      const transcriptionData = await transcriptionResponse.json();
      const transcribedText = transcriptionData.text || '';

      return {
        success: true,
        data: transcribedText,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[Transcription Error]', error);
      return {
        success: false,
        error: errorMsg.includes('fetch')
          ? 'Erro de conexão. Verifique sua internet.'
          : errorMsg,
      };
    }
  },
};

// Serviços de lembretes
export const remindersService = {
  getAll: async (phoneNumber: string) => {
    return request(`/reminders?phoneNumber=${phoneNumber}`);
  },

  create: async (phoneNumber: string, reminder: any) => {
    return request('/reminders', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, ...reminder }),
    });
  },

  update: async (id: string, reminder: any) => {
    return request(`/reminders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(reminder),
    });
  },

  delete: async (id: string) => {
    return request(`/reminders/${id}`, {
      method: 'DELETE',
    });
  },
};

// Serviços de finanças
export const financesService = {
  getTransactions: async (phoneNumber: string) => {
    return request(`/finances/transactions?phoneNumber=${phoneNumber}`);
  },

  createTransaction: async (phoneNumber: string, transaction: any) => {
    return request('/finances/transactions', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, ...transaction }),
    });
  },

  deleteTransaction: async (id: string) => {
    return request(`/finances/transactions/${id}`, {
      method: 'DELETE',
    });
  },
};

// Serviços de calendário
export const calendarService = {
  getEvents: async (phoneNumber: string) => {
    return request(`/calendar/events?phoneNumber=${phoneNumber}`);
  },

  createEvent: async (phoneNumber: string, event: any) => {
    return request('/calendar/events', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, ...event }),
    });
  },

  updateEvent: async (id: string, event: any) => {
    return request(`/calendar/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(event),
    });
  },

  deleteEvent: async (id: string) => {
    return request(`/calendar/events/${id}`, {
      method: 'DELETE',
    });
  },
};

