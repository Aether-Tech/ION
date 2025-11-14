import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as DocumentPicker from 'expo-document-picker';
import { Paths } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subWeeks, subYears, isWithinInterval, startOfQuarter, endOfQuarter, subQuarters, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { useAppColors } from '../../hooks/useAppColors';
import { IONLogo } from '../../components/IONLogo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { transacoesService, categoriasService } from '../../services/supabaseService';
import { Transacao, CategoriaTransacao } from '../../services/supabase';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  date: Date;
  category: string;
  categoria_id?: number;
}

type PeriodType = 'week' | 'month' | 'quarter' | 'year' | 'all';
type SortType = 'date' | 'amount' | 'category' | 'description';

export default function FinancesScreen() {
  const Colors = useAppColors();
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categorias, setCategorias] = useState<CategoriaTransacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortType>('date');
  const [sortAscending, setSortAscending] = useState(false);
  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense');
  const [newDescription, setNewDescription] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Carregar dados do Supabase
  useEffect(() => {
    if (authLoading) return;
    if (!user?.usuarioId) {
      setLoading(false);
      return;
    }
    loadData();
  }, [user?.usuarioId, user, authLoading]);

  const loadData = async () => {
    if (!user?.usuarioId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const transacoesData = await transacoesService.getByUsuarioId(user.usuarioId);
      const transactionsFormatted: Transaction[] = transacoesData.map((t) => ({
        id: t.id.toString(),
        description: t.descricao,
        amount: Number(t.valor),
        type: t.tipo === 'entrada' ? 'income' : 'expense',
        date: new Date(t.data),
        category: '',
        categoria_id: t.categoria_id,
      }));

      const categoriasData = await categoriasService.getByUsuarioId(user.usuarioId);
      setCategorias(categoriasData);

      const transactionsWithCategories = transactionsFormatted.map((t) => {
        const categoria = categoriasData.find((c) => c.id === t.categoria_id);
        return {
          ...t,
          category: categoria?.descricao || 'Sem categoria',
        };
      });

      setTransactions(transactionsWithCategories);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calcular período atual
  const getPeriodRange = (period: PeriodType) => {
    const now = new Date();
    switch (period) {
      case 'week':
        return { start: startOfWeek(now, { locale: ptBR }), end: endOfWeek(now, { locale: ptBR }) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'quarter':
        return { start: startOfQuarter(now), end: endOfQuarter(now) };
      case 'year':
        return { start: startOfYear(now), end: endOfYear(now) };
      default:
        return { start: null, end: null };
    }
  };

  // Filtrar transações por período
  const periodRange = getPeriodRange(selectedPeriod);
  const periodTransactions = useMemo(() => {
    if (selectedPeriod === 'all') return transactions;
    return transactions.filter(t => {
      if (!periodRange.start || !periodRange.end) return true;
      return isWithinInterval(t.date, { start: periodRange.start, end: periodRange.end });
    });
  }, [transactions, selectedPeriod, periodRange]);

  // Calcular período anterior para comparação
  const getPreviousPeriodRange = (period: PeriodType) => {
    const now = new Date();
    switch (period) {
      case 'week':
        const lastWeek = subWeeks(now, 1);
        return { start: startOfWeek(lastWeek, { locale: ptBR }), end: endOfWeek(lastWeek, { locale: ptBR }) };
      case 'month':
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case 'quarter':
        const lastQuarter = subQuarters(now, 1);
        return { start: startOfQuarter(lastQuarter), end: endOfQuarter(lastQuarter) };
      case 'year':
        const lastYear = subYears(now, 1);
        return { start: startOfYear(lastYear), end: endOfYear(lastYear) };
      default:
        return { start: null, end: null };
    }
  };

  const previousPeriodRange = getPreviousPeriodRange(selectedPeriod);
  const previousPeriodTransactions = useMemo(() => {
    if (selectedPeriod === 'all') return [];
    if (!previousPeriodRange.start || !previousPeriodRange.end) return [];
    return transactions.filter(t => 
      isWithinInterval(t.date, { start: previousPeriodRange.start!, end: previousPeriodRange.end! })
    );
  }, [transactions, selectedPeriod, previousPeriodRange]);

  // Calcular métricas do período atual
  const currentIncome = periodTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const currentExpenses = periodTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const currentBalance = currentIncome - currentExpenses;

  // Calcular métricas do período anterior
  const previousIncome = previousPeriodTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const previousExpenses = previousPeriodTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  // Calcular variações percentuais
  const incomeChange = previousIncome > 0 ? ((currentIncome - previousIncome) / previousIncome) * 100 : 0;
  const expensesChange = previousExpenses > 0 ? ((currentExpenses - previousExpenses) / previousExpenses) * 100 : 0;

  // Filtrar e ordenar transações
  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = periodTransactions.filter((transaction) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!transaction.description.toLowerCase().includes(query) &&
            !transaction.category.toLowerCase().includes(query)) return false;
      }
      return true;
    });

    // Ordenar
    // sortAscending = true (seta para cima) = ordem decrescente (maiores/mais recentes primeiro)
    // sortAscending = false (seta para baixo) = ordem crescente (menores/mais antigas primeiro)
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = a.date.getTime() - b.date.getTime();
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        case 'description':
          comparison = a.description.localeCompare(b.description);
          break;
      }
      return sortAscending ? -comparison : comparison;
    });

    return filtered;
  }, [periodTransactions, searchQuery, sortBy, sortAscending]);

  // Calcular insights
  const insights = useMemo(() => {
    const categoryTotals: { [key: string]: number } = {};
    periodTransactions.forEach((t) => {
      if (t.type === 'expense') {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
      }
    });

    const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
    const avgTransaction = periodTransactions.length > 0 
      ? periodTransactions.reduce((sum, t) => sum + t.amount, 0) / periodTransactions.length 
      : 0;
    const largestExpense = periodTransactions
      .filter(t => t.type === 'expense')
      .reduce((max, t) => t.amount > max.amount ? t : max, { amount: 0 } as Transaction);
    const largestIncome = periodTransactions
      .filter(t => t.type === 'income')
      .reduce((max, t) => t.amount > max.amount ? t : max, { amount: 0 } as Transaction);

    const savingsRate = currentIncome > 0 ? (currentBalance / currentIncome) * 100 : 0;

    return {
      topCategory: topCategory ? { name: topCategory[0], amount: topCategory[1] } : null,
      avgTransaction,
      largestExpense: largestExpense.amount > 0 ? largestExpense : null,
      largestIncome: largestIncome.amount > 0 ? largestIncome : null,
      savingsRate,
      transactionCount: periodTransactions.length,
    };
  }, [periodTransactions, currentIncome, currentBalance]);

  // Gerar recomendações
  const recommendations = useMemo(() => {
    const recs: string[] = [];
    
    if (currentBalance < 0) {
      recs.push('⚠️ Seu saldo está negativo. Considere reduzir gastos ou aumentar receitas.');
    }
    
    if (expensesChange > 10) {
      recs.push(`📈 Seus gastos aumentaram ${expensesChange.toFixed(1)}% em relação ao período anterior.`);
    } else if (expensesChange < -10) {
      recs.push(`📉 Ótimo! Seus gastos diminuíram ${Math.abs(expensesChange).toFixed(1)}% em relação ao período anterior.`);
    }

    if (insights.savingsRate < 10 && currentIncome > 0) {
      recs.push('💰 Tente economizar pelo menos 10% da sua renda para construir uma reserva de emergência.');
    }

    if (insights.topCategory && insights.topCategory.amount > currentExpenses * 0.4) {
      recs.push(`🎯 A categoria "${insights.topCategory.name}" representa mais de 40% dos seus gastos. Considere revisar.`);
    }

    if (periodTransactions.length === 0) {
      recs.push('📝 Comece registrando suas transações para ter uma visão completa das suas finanças.');
    }

    return recs;
  }, [currentBalance, expensesChange, insights, currentIncome, currentExpenses, periodTransactions]);

  const hasActiveFilters = () => {
    return searchQuery !== '';
  };

  // Calcular dados do gráfico de categorias
  const getCategoryData = () => {
    const categoryTotals: { [key: string]: number } = {};
    periodTransactions.forEach((t) => {
      if (t.type === 'expense') {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
      }
    });
    return categoryTotals;
  };

  const categoryData = getCategoryData();
  const totalCategoryAmount = Object.values(categoryData).reduce((sum, val) => sum + val, 0);
  const categoryEntries = Object.entries(categoryData).sort((a, b) => b[1] - a[1]);

  // Calcular dados de evolução baseado no período selecionado
  const getEvolutionData = () => {
    const evolutionData: { [key: string]: { income: number; expense: number } } = {};
    
    periodTransactions.forEach((t) => {
      let key: string;
      
      switch (selectedPeriod) {
        case 'week':
        case 'month':
          // Para semana e mês, agrupar por dia
          key = format(t.date, 'dd/MM', { locale: ptBR });
          break;
        case 'quarter':
        case 'year':
        case 'all':
          // Para trimestre, ano e tudo, agrupar por mês
          key = format(t.date, 'MMM/yy', { locale: ptBR });
          break;
        default:
          key = format(t.date, 'MMM/yy', { locale: ptBR });
      }
      
      if (!evolutionData[key]) {
        evolutionData[key] = { income: 0, expense: 0 };
      }
      
      if (t.type === 'income') {
        evolutionData[key].income += t.amount;
      } else {
        evolutionData[key].expense += t.amount;
      }
    });
    
    return evolutionData;
  };

  const evolutionData = getEvolutionData();
  const evolutionEntries = Object.entries(evolutionData).sort((a, b) => {
    // Ordenar baseado no tipo de período
    if (selectedPeriod === 'week' || selectedPeriod === 'month') {
      // Para dias, comparar como datas usando o período atual
      const parseDate = (str: string) => {
        const [day, month] = str.split('/');
        const periodYear = periodRange.start ? periodRange.start.getFullYear() : new Date().getFullYear();
        return new Date(periodYear, parseInt(month) - 1, parseInt(day));
      };
      return parseDate(a[0]).getTime() - parseDate(b[0]).getTime();
    } else {
      // Para meses, usar o parser existente
      const parseMonth = (str: string) => {
        const [month, year] = str.split('/');
        const monthMap: { [key: string]: number } = {
          jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
          jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
        };
        return new Date(2000 + parseInt(year || '0'), monthMap[month.toLowerCase().slice(0, 3)] || 0);
      };
      return parseMonth(a[0]).getTime() - parseMonth(b[0]).getTime();
    }
  });
  
  const maxEvolutionAmount = Math.max(...evolutionEntries.map(([, data]) => Math.max(data.income, data.expense)), 1);
  
  // Gerar labels apropriados para o período
  const getEvolutionLabel = (key: string) => {
    if (selectedPeriod === 'week' || selectedPeriod === 'month') {
      // Para dias, mostrar dia e mês
      return key;
    } else {
      // Para meses, já está formatado
      return key;
    }
  };

  const addTransaction = async () => {
    if (!user?.usuarioId) {
      Alert.alert('Erro', 'Usuário não autenticado');
      return;
    }

    if (!newDescription.trim() || !newAmount.trim()) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos obrigatórios');
      return;
    }

    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Erro', 'Por favor, insira um valor válido');
      return;
    }

    try {
      let categoriaId: number;
      const categoriaNome = newCategory || 'Outros';
      let categoria = categorias.find((c) => c.descricao === categoriaNome);

      if (!categoria) {
        const novaCategoria = await categoriasService.create({
          descricao: categoriaNome,
          usuario_id: user.usuarioId,
          date: null,
        });
        if (novaCategoria) {
          categoria = novaCategoria;
          setCategorias([...categorias, novaCategoria]);
        } else {
          throw new Error('Não foi possível criar a categoria');
        }
      }
      categoriaId = categoria.id;

      const data = new Date();
      const mes = format(data, 'yyyy-MM');
      const transacao = await transacoesService.create({
        data: format(data, 'yyyy-MM-dd'),
        valor: amount,
        descricao: newDescription,
        recebedor: null,
        pagador: null,
        mes,
        categoria_id: categoriaId,
        tipo: transactionType === 'income' ? 'entrada' : 'saida',
        usuario_id: user.usuarioId,
      });

      if (transacao) {
        const transaction: Transaction = {
          id: transacao.id.toString(),
          description: transacao.descricao,
          amount: Number(transacao.valor),
          type: transacao.tipo === 'entrada' ? 'income' : 'expense',
          date: new Date(transacao.data),
          category: categoria.descricao,
          categoria_id: transacao.categoria_id,
        };

        setTransactions([transaction, ...transactions]);
        setNewDescription('');
        setNewAmount('');
        setNewCategory('');
        setModalVisible(false);
      } else {
        throw new Error('Não foi possível criar a transação');
      }
    } catch (error) {
      console.error('Error adding transaction:', error);
      Alert.alert('Erro', 'Não foi possível adicionar a transação');
    }
  };

  const splitCSVLine = (line: string) => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  };

  const parseCSV = (csv: string): Record<string, string>[] => {
    const cleanCsv = csv.replace(/^\uFEFF/, '');
    const lines = cleanCsv
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      return [];
    }

    const headers = splitCSVLine(lines[0]).map((header) => header.toLowerCase());

    return lines.slice(1).map((line) => {
      const values = splitCSVLine(line);
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || '';
      });
      return row;
    });
  };

  const normalizeTransactionType = (typeValue: string): 'income' | 'expense' | null => {
    const normalized = typeValue.trim().toLowerCase();
    if (['income', 'entrada', 'receita', 'ganho'].includes(normalized)) {
      return 'income';
    }
    if (['expense', 'saida', 'despesa', 'gasto'].includes(normalized)) {
      return 'expense';
    }
    return null;
  };

  const parseDateValue = (value: string): Date | null => {
    if (!value) return null;
    const trimmed = value.trim();
    const direct = new Date(trimmed);
    if (!isNaN(direct.getTime())) return direct;

    const formats = ['dd/MM/yyyy', 'MM/dd/yyyy', 'dd-MM-yyyy', 'yyyy-MM-dd'];
    for (const formatString of formats) {
      const parsedDate = parse(trimmed, formatString, new Date());
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }
    return null;
  };

  const getOrCreateCategoria = async (categoriaNome: string): Promise<CategoriaTransacao | null> => {
    if (!user?.usuarioId) {
      return null;
    }
    const normalized = (categoriaNome || 'Outros').trim();
    const existing = categorias.find(
      (categoria) => categoria.descricao.toLowerCase() === normalized.toLowerCase()
    );
    if (existing) {
      return existing;
    }

    const novaCategoria = await categoriasService.create({
      descricao: normalized,
      usuario_id: user.usuarioId,
      date: null,
    });

    if (novaCategoria) {
      setCategorias((prev) => [...prev, novaCategoria]);
      return novaCategoria;
    }
    return null;
  };

  const buildCacheFileUri = (fileName: string) => {
    const legacyFS = FileSystemLegacy as any;
    const baseUri =
      legacyFS?.cacheDirectory ||
      legacyFS?.documentDirectory ||
      Paths?.cache?.uri ||
      Paths?.document?.uri ||
      'file:///';
    const normalizedBase = baseUri.endsWith('/') ? baseUri : `${baseUri}/`;
    return `${normalizedBase}${fileName}`;
  };

  const importFromGoogleSheets = async () => {
    if (!user?.usuarioId) {
      Alert.alert('Erro', 'Usuário não autenticado');
      return;
    }

    try {
      setImporting(true);
      const pickerResult = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
        return;
      }

      const fileUri = pickerResult.assets[0].uri;
      const fileContent = await FileSystemLegacy.readAsStringAsync(fileUri, {
        encoding: 'utf8',
      });
      const rows = parseCSV(fileContent);

      if (rows.length === 0) {
        Alert.alert('Arquivo vazio', 'Não encontramos transações no arquivo selecionado.');
        return;
      }

      let successCount = 0;
      const newTransactions: Transaction[] = [];

      for (const row of rows) {
        const description = row['description'] || row['descricao'] || row['nome'] || '';
        const amountStr = row['amount'] || row['valor'] || '';
        const typeStr = row['type'] || row['tipo'] || '';
        const dateStr = row['date'] || row['data'] || '';
        const categoryStr = row['category'] || row['categoria'] || 'Outros';

        if (!description || !amountStr || !typeStr || !dateStr) {
          continue;
        }

        const type = normalizeTransactionType(typeStr);
        if (!type) {
          continue;
        }

        const amount = parseFloat(amountStr.replace(',', '.'));
        if (isNaN(amount) || amount <= 0) {
          continue;
        }

        const parsedDate = parseDateValue(dateStr);
        if (!parsedDate) {
          continue;
        }

        const categoria = await getOrCreateCategoria(categoryStr);
        if (!categoria) {
          continue;
        }

        const mes = format(parsedDate, 'yyyy-MM');
        const created = await transacoesService.create({
          data: format(parsedDate, 'yyyy-MM-dd'),
          valor: amount,
          descricao: description,
          recebedor: null,
          pagador: null,
          mes,
          categoria_id: categoria.id,
          tipo: type === 'income' ? 'entrada' : 'saida',
          usuario_id: user.usuarioId,
        });

        if (created) {
          const transaction: Transaction = {
            id: created.id.toString(),
            description: created.descricao,
            amount: Number(created.valor),
            type,
            date: new Date(created.data),
            category: categoria.descricao,
            categoria_id: created.categoria_id,
          };
          newTransactions.push(transaction);
          successCount += 1;
        }
      }

      if (newTransactions.length > 0) {
        setTransactions((prev) => [...newTransactions, ...prev]);
      }

      Alert.alert(
        'Importação concluída',
        successCount > 0
          ? `${successCount} transações foram importadas do Google Sheets.`
          : 'Não foi possível importar nenhuma transação. Verifique o arquivo e tente novamente.'
      );
    } catch (error) {
      console.error('Error importing from Google Sheets:', error);
      Alert.alert('Erro', 'Não foi possível importar o arquivo. Verifique o formato e tente novamente.');
    } finally {
      setImporting(false);
    }
  };

  const exportToGoogleSheets = async () => {
    if (transactions.length === 0) {
      Alert.alert('Sem dados', 'Registre uma transação antes de exportar.');
      return;
    }

    try {
      setExporting(true);
      const headers = ['description', 'amount', 'type', 'date', 'category'];
      const rows = transactions.map((transaction) => {
        const values = [
          transaction.description,
          transaction.amount.toFixed(2),
          transaction.type,
          format(transaction.date, 'yyyy-MM-dd'),
          transaction.category,
        ];
        return values
          .map((value) => {
            const safeValue = value ? value.toString() : '';
            return safeValue.includes(',') ? `"${safeValue.replace(/"/g, '""')}"` : safeValue;
          })
          .join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      const fileUri = buildCacheFileUri(`ion-transacoes-${Date.now()}.csv`);
      await FileSystemLegacy.writeAsStringAsync(fileUri, csvContent, {
        encoding: 'utf8',
      });

      const isShareAvailable = await Sharing.isAvailableAsync();
      if (!isShareAvailable) {
        Alert.alert(
          'Compartilhamento indisponível',
          'Não foi possível abrir o menu de compartilhamento neste dispositivo.'
        );
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Exportar para Google Sheets',
        UTI: 'public.comma-separated-values-text',
      });
    } catch (error) {
      console.error('Error exporting to Google Sheets:', error);
      Alert.alert('Erro', 'Não foi possível exportar as transações.');
    } finally {
      setExporting(false);
    }
  };

  const deleteTransaction = (id: string) => {
    Alert.alert(
      'Excluir Transação',
      'Tem certeza que deseja excluir esta transação?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const transactionId = parseInt(id);
              const success = await transacoesService.delete(transactionId);
              if (success) {
                setTransactions(transactions.filter((t) => t.id !== id));
              } else {
                Alert.alert('Erro', 'Não foi possível excluir a transação');
              }
            } catch (error) {
              console.error('Error deleting transaction:', error);
              Alert.alert('Erro', 'Não foi possível excluir a transação');
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatPeriodLabel = (period: PeriodType) => {
    switch (period) {
      case 'week': return 'Semana';
      case 'month': return 'Mês';
      case 'quarter': return 'Trimestre';
      case 'year': return 'Ano';
      case 'all': return 'Tudo';
    }
  };

  const styles = getStyles(Colors);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <LinearGradient
          colors={Colors.backgroundGradient as any}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color={Colors.ionBlue} />
        <Text style={{ color: Colors.textSecondary, marginTop: 16 }}>Carregando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={Colors.backgroundGradient as any}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.blurCircles}>
        <View style={[styles.blurCircle, styles.blurCircle1]} />
        <View style={[styles.blurCircle, styles.blurCircle2]} />
      </View>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerButton}>
            <Ionicons name="wallet" size={28} color={Colors.ionBlue} />
          </View>
          <Text style={styles.headerTitle}>Assistente Financeiro</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Seletor de Período */}
          <View style={styles.periodSelector}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodScroll}>
              {(['week', 'month', 'quarter', 'year', 'all'] as PeriodType[]).map((period) => (
                <TouchableOpacity
                  key={period}
                  style={[
                    styles.periodButton,
                    selectedPeriod === period && styles.periodButtonActive
                  ]}
                  onPress={() => setSelectedPeriod(period)}
                >
                  <Text style={[
                    styles.periodButtonText,
                    selectedPeriod === period && styles.periodButtonTextActive
                  ]}>
                    {formatPeriodLabel(period)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Card de Saldo Principal */}
          <BlurView intensity={20} style={styles.balanceCard}>
            <LinearGradient
              colors={currentBalance >= 0 
                ? [Colors.success + '20', Colors.success + '10'] 
                : [Colors.error + '20', Colors.error + '10']
              }
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.balanceHeader}>
              <View>
                <Text style={styles.balanceLabel}>Saldo do Período</Text>
                <Text style={styles.balancePeriod}>
                  {selectedPeriod !== 'all' && periodRange.start && periodRange.end
                    ? `${format(periodRange.start, 'dd MMM', { locale: ptBR })} - ${format(periodRange.end, 'dd MMM yyyy', { locale: ptBR })}`
                    : 'Todos os períodos'}
                </Text>
              </View>
              <View style={[
                styles.balanceIconContainer,
                { backgroundColor: currentBalance >= 0 ? Colors.success + '30' : Colors.error + '30' }
              ]}>
                <Ionicons 
                  name={currentBalance >= 0 ? "trending-up" : "trending-down"} 
                  size={32} 
                  color={currentBalance >= 0 ? Colors.success : Colors.error} 
                />
              </View>
            </View>
            <Text style={[
              styles.balanceValue,
              { color: currentBalance >= 0 ? Colors.success : Colors.error }
            ]}>
              {formatCurrency(currentBalance)}
            </Text>
            <View style={styles.balanceDetails}>
              <View style={styles.balanceDetailItem}>
                <Ionicons name="arrow-down-circle" size={16} color={Colors.success} />
                <Text style={styles.balanceDetailLabel}>Entradas</Text>
                <Text style={[styles.balanceDetailValue, { color: Colors.success }]}>
                  {formatCurrency(currentIncome)}
                </Text>
                {previousIncome > 0 && (
                  <View style={styles.changeIndicator}>
                    <Ionicons 
                      name={incomeChange >= 0 ? "arrow-up" : "arrow-down"} 
                      size={12} 
                      color={incomeChange >= 0 ? Colors.success : Colors.error} 
                    />
                    <Text style={[
                      styles.changeText,
                      { color: incomeChange >= 0 ? Colors.success : Colors.error }
                    ]}>
                      {Math.abs(incomeChange).toFixed(1)}%
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.balanceDetailItem}>
                <Ionicons name="arrow-up-circle" size={16} color={Colors.error} />
                <Text style={styles.balanceDetailLabel}>Saídas</Text>
                <Text style={[styles.balanceDetailValue, { color: Colors.error }]}>
                  {formatCurrency(currentExpenses)}
                </Text>
                {previousExpenses > 0 && (
                  <View style={styles.changeIndicator}>
                    <Ionicons 
                      name={expensesChange <= 0 ? "arrow-down" : "arrow-up"} 
                      size={12} 
                      color={expensesChange <= 0 ? Colors.success : Colors.error} 
                    />
                    <Text style={[
                      styles.changeText,
                      { color: expensesChange <= 0 ? Colors.success : Colors.error }
                    ]}>
                      {Math.abs(expensesChange).toFixed(1)}%
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </BlurView>

          {/* Cards de Insights */}
          <View style={styles.insightsGrid}>
            <BlurView intensity={20} style={styles.insightCard}>
              <View style={[styles.insightIcon, { backgroundColor: Colors.ionBlue + '20' }]}>
                <Ionicons name="stats-chart" size={24} color={Colors.ionBlue} />
              </View>
              <Text style={styles.insightLabel}>Transações</Text>
              <Text style={styles.insightValue}>{insights.transactionCount}</Text>
              <Text style={styles.insightSubtext}>
                {formatCurrency(insights.avgTransaction)} média
              </Text>
            </BlurView>

            {insights.topCategory && (
              <BlurView intensity={20} style={styles.insightCard}>
                <View style={[styles.insightIcon, { backgroundColor: Colors.warning + '20' }]}>
                  <Ionicons name="podium" size={24} color={Colors.warning} />
                </View>
                <Text style={styles.insightLabel}>Maior Categoria</Text>
                <Text style={styles.insightValue} numberOfLines={1}>
                  {insights.topCategory.name}
                </Text>
                <Text style={styles.insightSubtext}>
                  {formatCurrency(insights.topCategory.amount)}
                </Text>
              </BlurView>
            )}

            {insights.savingsRate > 0 && (
              <BlurView intensity={20} style={styles.insightCard}>
                <View style={[styles.insightIcon, { backgroundColor: Colors.success + '20' }]}>
                  <Ionicons name="save" size={24} color={Colors.success} />
                </View>
                <Text style={styles.insightLabel}>Taxa de Poupança</Text>
                <Text style={styles.insightValue}>{insights.savingsRate.toFixed(1)}%</Text>
                <Text style={styles.insightSubtext}>
                  {insights.savingsRate >= 20 ? 'Excelente!' : insights.savingsRate >= 10 ? 'Bom' : 'Pode melhorar'}
                </Text>
              </BlurView>
            )}
          </View>

          {/* Recomendações */}
          {recommendations.length > 0 && (
            <BlurView intensity={20} style={styles.recommendationsCard}>
              <View style={styles.recommendationsHeader}>
                <Ionicons name="bulb" size={24} color={Colors.warning} />
                <Text style={styles.recommendationsTitle}>Recomendações</Text>
              </View>
              {recommendations.map((rec, index) => (
                <View key={index} style={styles.recommendationItem}>
                  <Text style={styles.recommendationText}>{rec}</Text>
                </View>
              ))}
            </BlurView>
          )}

          {/* Gráfico de Categorias */}
          {categoryEntries.length > 0 && (
            <BlurView intensity={20} style={styles.chartCard}>
              <Text style={styles.chartTitle}>Gastos por Categoria</Text>
              <Text style={styles.chartSubtitle}>{formatCurrency(currentExpenses)}</Text>
              <View style={styles.categoryChartContainer}>
                {categoryEntries.slice(0, 8).map(([category, amount], index) => {
                  const percentage = totalCategoryAmount > 0 ? (amount / totalCategoryAmount) * 100 : 0;
                  const colors = [
                    Colors.success, Colors.ionBlue, '#FFD700', Colors.error,
                    '#FF6B6B', '#4ECDC4', '#9B59B6', '#E67E22'
                  ];
                  return (
                    <View key={category} style={styles.categoryBarItem}>
                      <View style={styles.categoryBarHeader}>
                        <View style={styles.categoryBarLabel}>
                          <View style={[
                            styles.legendDot,
                            { backgroundColor: colors[index % colors.length] }
                          ]} />
                          <Text style={styles.categoryBarName} numberOfLines={1}>{category}</Text>
                        </View>
                        <Text style={styles.categoryBarPercentage}>
                          {percentage.toFixed(0)}%
                        </Text>
                      </View>
                      <View style={styles.categoryBarContainer}>
                        <LinearGradient
                          colors={[colors[index % colors.length], colors[index % colors.length] + 'CC']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[
                            styles.categoryBar,
                            { width: `${percentage}%` }
                          ]}
                        />
                      </View>
                      <Text style={styles.categoryBarAmount}>
                        {formatCurrency(amount)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </BlurView>
          )}

          {/* Gráfico de Evolução Dinâmico */}
          {evolutionEntries.length > 0 && (
            <BlurView intensity={20} style={styles.chartCard}>
              <Text style={styles.chartTitle}>
                {selectedPeriod === 'week' ? 'Evolução Semanal' :
                 selectedPeriod === 'month' ? 'Evolução Mensal' :
                 selectedPeriod === 'quarter' ? 'Evolução Trimestral' :
                 selectedPeriod === 'year' ? 'Evolução Anual' :
                 'Evolução Geral'}
              </Text>
              <Text style={styles.chartSubtitle}>
                {selectedPeriod === 'week' || selectedPeriod === 'month' 
                  ? 'Entradas vs Saídas por Dia' 
                  : 'Entradas vs Saídas por Mês'}
              </Text>
              <View style={styles.evolutionChartContainer}>
                <View style={styles.barChartContainer}>
                  {evolutionEntries.map(([key, data], index) => {
                    const incomeHeight = (data.income / maxEvolutionAmount) * 100;
                    const expenseHeight = (data.expense / maxEvolutionAmount) * 100;
                    return (
                      <View key={key} style={styles.barChartItem}>
                        <View style={styles.barChartBarContainer}>
                          <View style={styles.barChartBars}>
                            {data.income > 0 && (
                              <LinearGradient
                                colors={[Colors.success, Colors.success + 'CC']}
                                start={{ x: 0, y: 1 }}
                                end={{ x: 0, y: 0 }}
                                style={[
                                  styles.barChartBar,
                                  styles.barChartBarIncome,
                                  { height: `${Math.max(incomeHeight, 3)}%` }
                                ]}
                              />
                            )}
                            {data.expense > 0 && (
                              <LinearGradient
                                colors={[Colors.error, Colors.error + 'CC']}
                                start={{ x: 0, y: 1 }}
                                end={{ x: 0, y: 0 }}
                                style={[
                                  styles.barChartBar,
                                  styles.barChartBarExpense,
                                  { height: `${Math.max(expenseHeight, 3)}%` }
                                ]}
                              />
                            )}
                          </View>
                        </View>
                        <Text style={styles.barChartLabel} numberOfLines={1}>
                          {getEvolutionLabel(key)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                <View style={styles.barChartLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
                    <Text style={styles.legendText}>Entradas</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: Colors.error }]} />
                    <Text style={styles.legendText}>Saídas</Text>
                  </View>
                </View>
              </View>
            </BlurView>
          )}

          {/* Busca e Ordenação */}
          <BlurView intensity={20} style={styles.searchCard}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={Colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar transações..."
                placeholderTextColor={Colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery !== '' && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.sortContainer}>
              <Text style={styles.sortLabel}>Ordenar por:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortButtons}>
                {(['date', 'amount', 'category', 'description'] as SortType[]).map((sort) => (
                  <TouchableOpacity
                    key={sort}
                    style={[
                      styles.sortButton,
                      sortBy === sort && styles.sortButtonActive
                    ]}
                    onPress={() => {
                      if (sortBy === sort) {
                        setSortAscending(!sortAscending);
                      } else {
                        setSortBy(sort);
                        setSortAscending(false);
                      }
                    }}
                  >
                    <Text style={[
                      styles.sortButtonText,
                      sortBy === sort && styles.sortButtonTextActive
                    ]}>
                      {sort === 'date' ? 'Data' : sort === 'amount' ? 'Valor' : sort === 'category' ? 'Categoria' : 'Descrição'}
                    </Text>
                    {sortBy === sort && (
                      <Ionicons 
                        name={sortAscending ? "arrow-up" : "arrow-down"} 
                        size={14} 
                        color={Colors.textInverse} 
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </BlurView>

          {/* Lista de Transações */}
          <BlurView intensity={20} style={styles.transactionsCard}>
            <View style={styles.transactionsHeader}>
              <Text style={styles.transactionsTitle}>
                Transações ({filteredAndSortedTransactions.length})
              </Text>
            </View>

            {filteredAndSortedTransactions.length > 0 ? (
              filteredAndSortedTransactions.map((transaction) => (
                <TouchableOpacity
                  key={transaction.id}
                  style={styles.transactionItem}
                  onPress={() => setExpandedTransaction(
                    expandedTransaction === transaction.id ? null : transaction.id
                  )}
                  onLongPress={() => deleteTransaction(transaction.id)}
                >
                  <View style={styles.transactionMain}>
                    <View style={[
                      styles.transactionIcon,
                      { backgroundColor: transaction.type === 'income' ? Colors.success + '20' : Colors.error + '20' }
                    ]}>
                      <Ionicons 
                        name={transaction.type === 'income' ? "arrow-down" : "arrow-up"} 
                        size={20} 
                        color={transaction.type === 'income' ? Colors.success : Colors.error} 
                      />
                    </View>
                    <View style={styles.transactionContent}>
                      <Text style={styles.transactionDescription} numberOfLines={1}>
                        {transaction.description}
                      </Text>
                      <View style={styles.transactionMeta}>
                        <View style={[
                          styles.categoryBadge,
                          { backgroundColor: Colors.backgroundDarkTertiary }
                        ]}>
                          <Text style={styles.categoryBadgeText} numberOfLines={1}>
                            {transaction.category}
                          </Text>
                        </View>
                        <Text style={styles.transactionDate}>
                          {format(transaction.date, 'dd MMM yyyy', { locale: ptBR })}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.transactionAmount}>
                      <Text style={[
                        styles.transactionAmountText,
                        { color: transaction.type === 'income' ? Colors.success : Colors.error }
                      ]}>
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </Text>
                      <Ionicons 
                        name={expandedTransaction === transaction.id ? "chevron-up" : "chevron-down"} 
                        size={16} 
                        color={Colors.textSecondary} 
                      />
                    </View>
                  </View>
                  {expandedTransaction === transaction.id && (
                    <View style={styles.transactionDetails}>
                      <View style={styles.transactionDetailRow}>
                        <Text style={styles.transactionDetailLabel}>Data:</Text>
                        <Text style={styles.transactionDetailValue}>
                          {format(transaction.date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </Text>
                      </View>
                      <View style={styles.transactionDetailRow}>
                        <Text style={styles.transactionDetailLabel}>Categoria:</Text>
                        <Text style={styles.transactionDetailValue}>{transaction.category}</Text>
                      </View>
                      <View style={styles.transactionDetailRow}>
                        <Text style={styles.transactionDetailLabel}>Tipo:</Text>
                        <Text style={[
                          styles.transactionDetailValue,
                          { color: transaction.type === 'income' ? Colors.success : Colors.error }
                        ]}>
                          {transaction.type === 'income' ? 'Receita' : 'Despesa'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => deleteTransaction(transaction.id)}
                      >
                        <Ionicons name="trash-outline" size={18} color={Colors.error} />
                        <Text style={styles.deleteButtonText}>Excluir</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="wallet-outline" size={64} color={Colors.textSecondary} />
                <Text style={styles.emptyStateText}>
                  {hasActiveFilters() 
                    ? 'Nenhuma transação encontrada com os filtros aplicados' 
                    : 'Nenhuma transação registrada neste período'}
                </Text>
                {!hasActiveFilters() && (
                  <TouchableOpacity
                    style={styles.emptyStateButton}
                    onPress={() => setModalVisible(true)}
                  >
                    <Text style={styles.emptyStateButtonText}>Adicionar Primeira Transação</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </BlurView>

          {/* Exportação de Transações */}
          <BlurView intensity={20} style={[styles.integrationCard, styles.integrationCardSpacing]}>
            <View style={styles.integrationHeader}>
              <Ionicons name="swap-vertical" size={24} color={Colors.ionBlue} />
              <Text style={styles.integrationTitle}>Exportar Transações</Text>
            </View>
            <Text style={styles.integrationDescription}>
              Gere um CSV com todas as transações do painel ou importe um arquivo vindo do Google Sheets/Excel para manter tudo sincronizado.
            </Text>
            <View style={styles.integrationButtons}>
              <TouchableOpacity
                style={[styles.integrationButton, styles.integrationButtonSecondary]}
                onPress={importFromGoogleSheets}
                disabled={importing}
              >
                {importing ? (
                  <ActivityIndicator size="small" color={Colors.textPrimary} />
                ) : (
                  <Ionicons name="cloud-download" size={18} color={Colors.textPrimary} />
                )}
                <Text style={styles.integrationButtonText}>
                  {importing ? 'Importando...' : 'Importar CSV'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.integrationButton, styles.integrationButtonPrimary]}
                onPress={exportToGoogleSheets}
                disabled={exporting}
              >
                {exporting ? (
                  <ActivityIndicator size="small" color={Colors.backgroundDark} />
                ) : (
                  <Ionicons name="cloud-upload" size={18} color={Colors.backgroundDark} />
                )}
                <Text style={[styles.integrationButtonText, styles.integrationButtonTextInverse]}>
                  {exporting ? 'Exportando...' : 'Exportar'}
                </Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </ScrollView>

        {/* FAB */}
        <View style={[styles.fabContainer, { bottom: Math.max(insets.bottom, 16) + 60 }]}>
          <TouchableOpacity
            style={styles.fab}
            onPress={() => setModalVisible(true)}
          >
            <IONLogo size={18} variant="icon" />
            <Text style={styles.fabText}>Nova Transação</Text>
          </TouchableOpacity>
        </View>

        {/* Add Transaction Modal */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nova Transação</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={28} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    transactionType === 'income' && styles.typeButtonActive,
                  ]}
                  onPress={() => setTransactionType('income')}
                >
                  <Ionicons
                    name="arrow-down"
                    size={20}
                    color={transactionType === 'income' ? Colors.textInverse : Colors.success}
                  />
                  <Text
                    style={[
                      styles.typeButtonText,
                      transactionType === 'income' && styles.typeButtonTextActive,
                    ]}
                  >
                    Receita
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    transactionType === 'expense' && styles.typeButtonActive,
                  ]}
                  onPress={() => setTransactionType('expense')}
                >
                  <Ionicons
                    name="arrow-up"
                    size={20}
                    color={transactionType === 'expense' ? Colors.textInverse : Colors.error}
                  />
                  <Text
                    style={[
                      styles.typeButtonText,
                      transactionType === 'expense' && styles.typeButtonTextActive,
                    ]}
                  >
                    Despesa
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>Descrição *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: Salário, Almoço..."
                placeholderTextColor={Colors.textSecondary}
                value={newDescription}
                onChangeText={setNewDescription}
              />

              <Text style={styles.modalLabel}>Valor (R$) *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0,00"
                placeholderTextColor={Colors.textSecondary}
                value={newAmount}
                onChangeText={setNewAmount}
                keyboardType="decimal-pad"
              />

              <Text style={styles.modalLabel}>Categoria</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: Trabalho, Alimentação..."
                placeholderTextColor={Colors.textSecondary}
                value={newCategory}
                onChangeText={setNewCategory}
              />

              <TouchableOpacity style={styles.modalButton} onPress={addTransaction}>
                <Text style={styles.modalButtonText}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

function getStyles(Colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    blurCircles: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      zIndex: 0,
    },
    blurCircle: {
      position: 'absolute',
      borderRadius: 9999,
    },
    blurCircle1: {
      width: 300,
      height: 300,
      backgroundColor: Colors.primary,
      top: -100,
      left: -100,
      opacity: 0.2,
    },
    blurCircle2: {
      width: 250,
      height: 250,
      backgroundColor: Colors.ionBlue,
      bottom: -50,
      right: -50,
      opacity: 0.2,
    },
    safeArea: {
      flex: 1,
      zIndex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 16,
      paddingBottom: 12,
      paddingHorizontal: 16,
    },
    headerButton: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: 'bold',
      color: Colors.textPrimary,
      textAlign: 'center',
    },
    listContent: {
      padding: 16,
      paddingBottom: 120,
    },
    periodSelector: {
      marginBottom: 16,
    },
    periodScroll: {
      paddingHorizontal: 4,
      gap: 8,
    },
    periodButton: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.backgroundDarkTertiary,
    },
    periodButtonActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    periodButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    periodButtonTextActive: {
      color: Colors.textInverse,
    },
    integrationCard: {
      marginTop: 28,
      marginBottom: 28,
      borderRadius: 20,
      padding: 20,
      backgroundColor: Colors.glassBackground,
      borderWidth: 1,
      borderColor: Colors.glassBorder,
      gap: 12,
    },
    integrationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    integrationTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: Colors.textPrimary,
    },
    integrationDescription: {
      fontSize: 14,
      color: Colors.textSecondary,
      lineHeight: 20,
    },
    integrationButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    integrationButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      paddingVertical: 14,
      gap: 8,
    },
    integrationButtonPrimary: {
      backgroundColor: Colors.ionBlue,
    },
    integrationButtonSecondary: {
      backgroundColor: Colors.backgroundDarkTertiary,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    integrationButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    integrationButtonTextInverse: {
      color: Colors.backgroundDark,
    },
    integrationCardSpacing: {
      marginTop: 32,
    },
    balanceCard: {
      padding: 24,
      borderRadius: 20,
      backgroundColor: Colors.glassBackground,
      borderWidth: 1,
      borderColor: Colors.glassBorder,
      marginBottom: 16,
      overflow: 'hidden',
    },
    balanceHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    balanceLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.textSecondary,
      marginBottom: 4,
    },
    balancePeriod: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
    balanceIconContainer: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    balanceValue: {
      fontSize: 36,
      fontWeight: 'bold',
      marginBottom: 20,
    },
    balanceDetails: {
      flexDirection: 'row',
      gap: 16,
    },
    balanceDetailItem: {
      flex: 1,
    },
    balanceDetailLabel: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 4,
      marginBottom: 4,
    },
    balanceDetailValue: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    changeIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
    },
    changeText: {
      fontSize: 12,
      fontWeight: '600',
    },
    insightsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 16,
    },
    insightCard: {
      flex: 1,
      minWidth: '30%',
      padding: 16,
      borderRadius: 16,
      backgroundColor: Colors.glassBackground,
      borderWidth: 1,
      borderColor: Colors.glassBorder,
    },
    insightIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    insightLabel: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginBottom: 4,
    },
    insightValue: {
      fontSize: 18,
      fontWeight: 'bold',
      color: Colors.textPrimary,
      marginBottom: 4,
    },
    insightSubtext: {
      fontSize: 11,
      color: Colors.textSecondary,
    },
    recommendationsCard: {
      padding: 20,
      borderRadius: 16,
      backgroundColor: Colors.glassBackground,
      borderWidth: 1,
      borderColor: Colors.glassBorder,
      marginBottom: 16,
    },
    recommendationsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 16,
    },
    recommendationsTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: Colors.textPrimary,
    },
    recommendationItem: {
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: Colors.borderLight,
    },
    recommendationText: {
      fontSize: 14,
      color: Colors.textPrimary,
      lineHeight: 20,
    },
    chartCard: {
      padding: 20,
      borderRadius: 16,
      backgroundColor: Colors.glassBackground,
      borderWidth: 1,
      borderColor: Colors.glassBorder,
      marginBottom: 16,
    },
    chartTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: Colors.textPrimary,
      marginBottom: 4,
    },
    chartSubtitle: {
      fontSize: 14,
      color: Colors.textSecondary,
      marginBottom: 20,
    },
    categoryChartContainer: {
      gap: 16,
    },
    categoryBarItem: {
      marginBottom: 12,
    },
    categoryBarHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    categoryBarLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    legendDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    categoryBarName: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.textPrimary,
      flex: 1,
    },
    categoryBarPercentage: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
    categoryBarContainer: {
      height: 12,
      backgroundColor: Colors.backgroundDarkTertiary,
      borderRadius: 6,
      overflow: 'hidden',
      marginBottom: 6,
    },
    categoryBar: {
      height: '100%',
      borderRadius: 6,
    },
    categoryBarAmount: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
    evolutionChartContainer: {
      marginTop: 8,
    },
    barChartContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: 200,
      gap: 8,
      paddingHorizontal: 8,
      paddingTop: 16,
    },
    barChartItem: {
      flex: 1,
      alignItems: 'center',
      height: '100%',
      justifyContent: 'flex-end',
    },
    barChartBarContainer: {
      width: '100%',
      height: '100%',
      justifyContent: 'flex-end',
      marginBottom: 4,
    },
    barChartBars: {
      width: '100%',
      height: '100%',
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 2,
    },
    barChartBar: {
      width: '48%',
      borderRadius: 4,
      minHeight: 4,
    },
    barChartBarIncome: {
      alignSelf: 'flex-start',
    },
    barChartBarExpense: {
      alignSelf: 'flex-end',
    },
    barChartLabel: {
      fontSize: 10,
      fontWeight: '500',
      color: Colors.textPrimary,
      marginTop: 4,
      textAlign: 'center',
    },
    barChartLegend: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 16,
      marginTop: 12,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendText: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
    searchCard: {
      padding: 16,
      borderRadius: 16,
      backgroundColor: Colors.glassBackground,
      borderWidth: 1,
      borderColor: Colors.glassBorder,
      marginBottom: 16,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.backgroundDarkTertiary,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      gap: 8,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: Colors.textPrimary,
    },
    sortContainer: {
      gap: 8,
    },
    sortLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
    sortButtons: {
      gap: 8,
    },
    sortButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.backgroundDarkTertiary,
      gap: 6,
    },
    sortButtonActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    sortButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    sortButtonTextActive: {
      color: Colors.textInverse,
    },
    transactionsCard: {
      borderRadius: 16,
      backgroundColor: Colors.glassBackground,
      borderWidth: 1,
      borderColor: Colors.glassBorder,
      padding: 16,
    },
    transactionsHeader: {
      marginBottom: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    transactionsTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: Colors.textPrimary,
    },
    transactionItem: {
      backgroundColor: Colors.backgroundDarkTertiary,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    transactionMain: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    transactionIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    transactionContent: {
      flex: 1,
    },
    transactionDescription: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.textPrimary,
      marginBottom: 6,
    },
    transactionMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    categoryBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    categoryBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    transactionDate: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
    transactionAmount: {
      alignItems: 'flex-end',
      gap: 4,
    },
    transactionAmountText: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    transactionDetails: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: Colors.borderLight,
      gap: 12,
    },
    transactionDetailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    transactionDetailLabel: {
      fontSize: 14,
      color: Colors.textSecondary,
    },
    transactionDetailValue: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: Colors.error + '20',
      marginTop: 8,
    },
    deleteButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.error,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
    },
    emptyStateText: {
      fontSize: 16,
      color: Colors.textSecondary,
      textAlign: 'center',
      marginTop: 16,
      marginBottom: 24,
    },
    emptyStateButton: {
      backgroundColor: Colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
    },
    emptyStateButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.textInverse,
    },
    fabContainer: {
      position: 'absolute',
      left: 0,
      right: 0,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    fab: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.ionBlue,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderRadius: 16,
      gap: 12,
      maxWidth: 400,
      shadowColor: Colors.ionBlue,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    fabText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: Colors.backgroundDark,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: Colors.backgroundDark,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 40,
      maxHeight: '85%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: Colors.textPrimary,
    },
    typeSelector: {
      flexDirection: 'row',
      marginBottom: 24,
      gap: 12,
    },
    typeButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: Colors.border,
      backgroundColor: Colors.backgroundDarkTertiary,
      gap: 6,
    },
    typeButtonActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    typeButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    typeButtonTextActive: {
      color: Colors.textInverse,
    },
    modalLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.textPrimary,
      marginBottom: 8,
      marginTop: 16,
    },
    modalInput: {
      backgroundColor: Colors.backgroundDarkTertiary,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: Colors.textPrimary,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    modalButton: {
      backgroundColor: Colors.primary,
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      marginTop: 24,
    },
    modalButtonText: {
      fontSize: 18,
      fontWeight: '600',
      color: Colors.textInverse,
    },
  });
}
