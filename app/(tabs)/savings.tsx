import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HugeIcon } from '../../components/HugeIcon';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { format, differenceInMonths, differenceInDays, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { useAppColors } from '../../hooks/useAppColors';
import { useAuth } from '../../contexts/AuthContext';
import { caixinhasService } from '../../services/supabaseService';
import { Caixinha } from '../../services/supabase';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SavingsBox {
  id: string;
  nome_caixinha: string;
  valor_meta: number;
  valor_total_arrecadado: number;
  deposito: number | null;
  data_para_concluir: Date | null;
  categoria: string | null;
  createdAt: Date;
}

interface InvestmentType {
  id: string;
  nome: string;
  rendimentoAnual: number; // em porcentagem (ex: 10.5 = 10.5% ao ano)
  risco: 'Baixo' | 'Médio' | 'Alto';
  descricao: string;
  icone: keyof typeof Ionicons.glyphMap;
}

export default function SavingsScreen() {
  const Colors = useAppColors();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [caixinhas, setCaixinhas] = useState<SavingsBox[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [editingCaixinha, setEditingCaixinha] = useState<SavingsBox | null>(null);
  const [selectedCaixinha, setSelectedCaixinha] = useState<SavingsBox | null>(null);
  
  const [newNome, setNewNome] = useState('');
  const [newMeta, setNewMeta] = useState('');
  const [newDataLimite, setNewDataLimite] = useState('');
  const [newCategoria, setNewCategoria] = useState('');
  const [depositValue, setDepositValue] = useState('');
  const [investmentExpanded, setInvestmentExpanded] = useState(false);

  // Carregar dados do Supabase
  useEffect(() => {
    if (authLoading) {
      return;
    }
    
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
      const caixinhasData = await caixinhasService.getByUsuarioId(user.usuarioId);
      
      const caixinhasFormatted: SavingsBox[] = caixinhasData.map((caixinha) => {
        const dataParaConcluir = caixinha.data_para_concluir ? new Date(caixinha.data_para_concluir) : null;
        
        return {
          id: caixinha.id.toString(),
          nome_caixinha: caixinha.nome_caixinha || 'Sem nome',
          valor_meta: caixinha.valor_meta || 0,
          valor_total_arrecadado: caixinha.valor_total_arrecadado || 0,
          deposito: caixinha.deposito,
          data_para_concluir: dataParaConcluir,
          categoria: caixinha.categoria,
          createdAt: new Date(caixinha.created_at),
        };
      });
      
      setCaixinhas(caixinhasFormatted);
    } catch (error) {
      console.error('Error loading savings boxes:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateProgress = (caixinha: SavingsBox): number => {
    if (caixinha.valor_meta === 0) return 0;
    return Math.min((caixinha.valor_total_arrecadado / caixinha.valor_meta) * 100, 100);
  };

  const calculateRemaining = (caixinha: SavingsBox): number => {
    return Math.max(0, caixinha.valor_meta - caixinha.valor_total_arrecadado);
  };

  const calculateMonthlyDeposit = (caixinha: SavingsBox): number => {
    if (!caixinha.data_para_concluir) return 0;
    
    const remaining = calculateRemaining(caixinha);
    const now = new Date();
    const monthsLeft = Math.max(1, differenceInMonths(caixinha.data_para_concluir, now));
    
    return remaining / monthsLeft;
  };

  const isCompleted = (caixinha: SavingsBox): boolean => {
    return caixinha.valor_total_arrecadado >= caixinha.valor_meta;
  };

  // Tipos de investimento
  const investmentTypes: InvestmentType[] = [
    {
      id: 'poupanca',
      nome: 'Poupança',
      rendimentoAnual: 6.17, // CDI médio aproximado
      risco: 'Baixo',
      descricao: 'Seguro e garantido pelo FGC',
      icone: 'shield-checkmark',
    },
    {
      id: 'cdb',
      nome: 'CDB',
      rendimentoAnual: 10.5,
      risco: 'Baixo',
      descricao: 'Certificado de Depósito Bancário',
      icone: 'document-text',
    },
    {
      id: 'tesouro',
      nome: 'Tesouro Direto',
      rendimentoAnual: 11.0,
      risco: 'Baixo',
      descricao: 'Títulos públicos federais',
      icone: 'trending-up',
    },
    {
      id: 'lci-lca',
      nome: 'LCI/LCA',
      rendimentoAnual: 9.5,
      risco: 'Baixo',
      descricao: 'Letras de Crédito Imobiliário/Agronegócio',
      icone: 'home',
    },
    {
      id: 'fundos',
      nome: 'Fundos de Renda Fixa',
      rendimentoAnual: 12.0,
      risco: 'Médio',
      descricao: 'Fundos de investimento conservadores',
      icone: 'pie-chart',
    },
    {
      id: 'acoes',
      nome: 'Ações',
      rendimentoAnual: 15.0,
      risco: 'Alto',
      descricao: 'Investimento em ações da bolsa',
      icone: 'bar-chart',
    },
    {
      id: 'fiis',
      nome: 'Fundos Imobiliários',
      rendimentoAnual: 13.5,
      risco: 'Médio',
      descricao: 'Fundos de investimento imobiliário',
      icone: 'business',
    },
    {
      id: 'cripto',
      nome: 'Criptomoedas',
      rendimentoAnual: 20.0,
      risco: 'Alto',
      descricao: 'Investimento em criptomoedas',
      icone: 'diamond',
    },
  ];

  // Calcular rendimento projetado
  const calculateInvestmentReturn = (
    valorInicial: number,
    rendimentoAnual: number,
    meses: number
  ): number => {
    if (meses <= 0) return valorInicial;
    // Juros compostos mensais
    const taxaMensal = rendimentoAnual / 12 / 100;
    return valorInicial * Math.pow(1 + taxaMensal, meses);
  };

  // Calcular rendimento total de todas as caixinhas
  const totalInvestido = useMemo(() => {
    return caixinhas.reduce((sum, c) => sum + c.valor_total_arrecadado, 0);
  }, [caixinhas]);

  // Calcular tempo médio até a conclusão (para projeção)
  const averageMonthsToComplete = useMemo(() => {
    const caixinhasAtivas = caixinhas.filter(c => !isCompleted(c) && c.data_para_concluir);
    if (caixinhasAtivas.length === 0) return 12; // padrão de 1 ano
    
    const totalMonths = caixinhasAtivas.reduce((sum, c) => {
      if (!c.data_para_concluir) return sum;
      const months = Math.max(1, differenceInMonths(c.data_para_concluir, new Date()));
      return sum + months;
    }, 0);
    
    return Math.max(1, Math.round(totalMonths / caixinhasAtivas.length));
  }, [caixinhas]);

  // Estatísticas gerais
  const stats = useMemo(() => {
    const totalGuardado = caixinhas.reduce((sum, c) => sum + c.valor_total_arrecadado, 0);
    const totalMetas = caixinhas.reduce((sum, c) => sum + c.valor_meta, 0);
    const caixinhasCompletas = caixinhas.filter(c => c.valor_total_arrecadado >= c.valor_meta).length;
    const totalRestante = caixinhas.reduce((sum, c) => sum + Math.max(0, c.valor_meta - c.valor_total_arrecadado), 0);
    const progressoGeral = totalMetas > 0 ? (totalGuardado / totalMetas) * 100 : 0;
    
    return {
      totalGuardado,
      totalMetas,
      caixinhasCompletas,
      totalRestante,
      progressoGeral,
      totalCaixinhas: caixinhas.length,
    };
  }, [caixinhas]);

  // Distribuição por categoria
  const categoryDistribution = useMemo(() => {
    const categoryMap = new Map<string, number>();
    caixinhas.forEach(caixinha => {
      const categoria = caixinha.categoria || 'Sem categoria';
      const current = categoryMap.get(categoria) || 0;
      categoryMap.set(categoria, current + caixinha.valor_total_arrecadado);
    });
    return Array.from(categoryMap.entries())
      .map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total);
  }, [caixinhas]);

  // Componente de gráfico circular
  const CircularProgress = ({ progress, size = 80, strokeWidth = 8, color = Colors.ionBlue, bgColor, textColor }: {
    progress: number;
    size?: number;
    strokeWidth?: number;
    color?: string;
    bgColor?: string;
    textColor?: string;
  }) => {
    const normalizedProgress = Math.min(Math.max(progress, 0), 100);
    
    // Calcular rotação para o círculo de progresso
    const rotation = normalizedProgress >= 50 ? 180 : (normalizedProgress / 50) * 180;
    const secondRotation = normalizedProgress >= 50 ? ((normalizedProgress - 50) / 50) * 180 : 0;
    
    return (
      <View style={{ width: size, height: size, position: 'relative', justifyContent: 'center', alignItems: 'center' }}>
        {/* Círculo de fundo */}
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: bgColor || Colors.backgroundDarkTertiary,
          }}
        />
        {/* Primeira metade do círculo de progresso */}
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: normalizedProgress > 0 ? color : 'transparent',
            borderTopColor: 'transparent',
            borderRightColor: normalizedProgress >= 50 ? color : 'transparent',
            borderBottomColor: 'transparent',
            borderLeftColor: 'transparent',
            transform: [{ rotate: `${rotation}deg` }],
          }}
        />
        {/* Segunda metade do círculo de progresso (quando > 50%) */}
        {normalizedProgress >= 50 ? (
          <View
            style={{
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
              borderColor: color,
              borderTopColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: 'transparent',
              borderLeftColor: 'transparent',
              transform: [{ rotate: `${180 + secondRotation}deg` }],
            }}
          />
        ) : null}
        {/* Texto central */}
        <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: size * 0.22, fontWeight: 'bold', color: textColor || Colors.textPrimary }}>
            {Math.round(normalizedProgress)}%
          </Text>
        </View>
      </View>
    );
  };

  const addCaixinha = async () => {
    if (!user?.usuarioId) {
      Alert.alert('Erro', 'Usuário não autenticado');
      return;
    }

    if (!newNome.trim()) {
      Alert.alert('Erro', 'Por favor, insira um nome para a caixinha');
      return;
    }

    if (!newMeta.trim() || parseFloat(newMeta) <= 0) {
      Alert.alert('Erro', 'Por favor, insira uma meta válida');
      return;
    }

    if (!newDataLimite.trim()) {
      Alert.alert('Erro', 'Por favor, insira uma data limite');
      return;
    }

    try {
      const metaValue = parseFloat(newMeta);
      const dataLimiteDate = new Date(newDataLimite);
      
      if (isAfter(new Date(), dataLimiteDate)) {
        Alert.alert('Erro', 'A data limite deve ser no futuro');
        return;
      }

      const caixinha = await caixinhasService.create({
        nome_caixinha: newNome,
        valor_meta: metaValue,
        valor_total_arrecadado: 0,
        deposito: null,
        data_para_concluir: dataLimiteDate.toISOString(),
        categoria: newCategoria.trim() || null,
        usuario_id: user.usuarioId,
      });

      if (caixinha) {
        setNewNome('');
        setNewMeta('');
        setNewDataLimite('');
        setNewCategoria('');
        setModalVisible(false);
        await loadData();
      } else {
        throw new Error('Não foi possível criar a caixinha');
      }
    } catch (error) {
      console.error('Error adding savings box:', error);
      Alert.alert('Erro', 'Não foi possível criar a caixinha');
    }
  };

  const openEditModal = (caixinha: SavingsBox) => {
    setEditingCaixinha(caixinha);
    setNewNome(caixinha.nome_caixinha);
    setNewMeta(caixinha.valor_meta.toString());
    setNewDataLimite(caixinha.data_para_concluir ? format(caixinha.data_para_concluir, 'yyyy-MM-dd') : '');
    setNewCategoria(caixinha.categoria || '');
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditingCaixinha(null);
    setNewNome('');
    setNewMeta('');
    setNewDataLimite('');
    setNewCategoria('');
  };

  const updateCaixinha = async () => {
    if (!user?.usuarioId || !editingCaixinha) {
      Alert.alert('Erro', 'Usuário não autenticado ou caixinha não encontrada');
      return;
    }

    if (!newNome.trim()) {
      Alert.alert('Erro', 'Por favor, insira um nome para a caixinha');
      return;
    }

    if (!newMeta.trim() || parseFloat(newMeta) <= 0) {
      Alert.alert('Erro', 'Por favor, insira uma meta válida');
      return;
    }

    if (!newDataLimite.trim()) {
      Alert.alert('Erro', 'Por favor, insira uma data limite');
      return;
    }

    try {
      const metaValue = parseFloat(newMeta);
      const dataLimiteDate = new Date(newDataLimite);
      
      if (isAfter(new Date(), dataLimiteDate)) {
        Alert.alert('Erro', 'A data limite deve ser no futuro');
        return;
      }

      const caixinhaId = parseInt(editingCaixinha.id);
      const updated = await caixinhasService.update(caixinhaId, {
        nome_caixinha: newNome,
        valor_meta: metaValue,
        data_para_concluir: dataLimiteDate.toISOString(),
        categoria: newCategoria.trim() || null,
      });

      if (updated) {
        closeEditModal();
        await loadData();
      } else {
        throw new Error('Não foi possível atualizar a caixinha');
      }
    } catch (error) {
      console.error('Error updating savings box:', error);
      Alert.alert('Erro', 'Não foi possível atualizar a caixinha');
    }
  };

  const openDepositModal = (caixinha: SavingsBox) => {
    setSelectedCaixinha(caixinha);
    setDepositValue('');
    setDepositModalVisible(true);
  };

  const closeDepositModal = () => {
    setDepositModalVisible(false);
    setSelectedCaixinha(null);
    setDepositValue('');
  };

  const addDeposit = async () => {
    if (!user?.usuarioId || !selectedCaixinha) {
      Alert.alert('Erro', 'Usuário não autenticado ou caixinha não encontrada');
      return;
    }

    if (!depositValue.trim() || parseFloat(depositValue) <= 0) {
      Alert.alert('Erro', 'Por favor, insira um valor válido');
      return;
    }

    try {
      const depositAmount = parseFloat(depositValue);
      const newValue = (selectedCaixinha.valor_total_arrecadado || 0) + depositAmount;

      const caixinhaId = parseInt(selectedCaixinha.id);
      const updated = await caixinhasService.update(caixinhaId, {
        valor_total_arrecadado: newValue,
        deposito: depositAmount,
      });

      if (updated) {
        closeDepositModal();
        await loadData();
        Alert.alert('Sucesso', `Depósito de R$ ${depositAmount.toFixed(2)} adicionado!`);
      } else {
        throw new Error('Não foi possível adicionar o depósito');
      }
    } catch (error) {
      console.error('Error adding deposit:', error);
      Alert.alert('Erro', 'Não foi possível adicionar o depósito');
    }
  };

  const deleteCaixinha = (id: string) => {
    Alert.alert(
      'Excluir Caixinha',
      'Tem certeza que deseja excluir esta caixinha?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const caixinhaId = parseInt(id);
              const success = await caixinhasService.delete(caixinhaId);
              if (success) {
                setCaixinhas(caixinhas.filter((c) => c.id !== id));
              } else {
                Alert.alert('Erro', 'Não foi possível excluir a caixinha');
              }
            } catch (error) {
              console.error('Error deleting savings box:', error);
              Alert.alert('Erro', 'Não foi possível excluir a caixinha');
            }
          },
        },
      ]
    );
  };

  const renderCaixinha = ({ item }: { item: SavingsBox }) => {
    const progress = calculateProgress(item);
    const remaining = calculateRemaining(item);
    const monthlyDeposit = calculateMonthlyDeposit(item);
    const completed = isCompleted(item);
    const daysLeft = item.data_para_concluir ? Math.max(0, differenceInDays(item.data_para_concluir, new Date())) : null;
    const isUrgent = daysLeft !== null && daysLeft < 30 && !completed;
    const progressColor = completed ? Colors.success : isUrgent ? Colors.error : Colors.ionBlue;

    return (
      <BlurView intensity={20} style={styles.caixinhaCard}>
        <View style={styles.caixinhaHeader}>
          <View style={styles.caixinhaHeaderLeft}>
            <View style={styles.caixinhaTitleRow}>
              {item.categoria ? (
                <View style={styles.categoryTag}>
                  <Text style={styles.categoryTagText}>{item.categoria}</Text>
                </View>
              ) : null}
              <Text style={styles.caixinhaTitle}>{item.nome_caixinha}</Text>
            </View>
            {completed ? (
              <View style={styles.completedBadge}>
                <HugeIcon name="checkmark-circle" size={16} color={Colors.success} />
                <Text style={styles.completedText}>Meta Concluída!</Text>
              </View>
            ) : null}
            {isUrgent && !completed ? (
              <View style={styles.urgentBadge}>
                <HugeIcon name="alert-circle" size={14} color={Colors.error} />
                <Text style={styles.urgentText}>Prazo próximo!</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.actionButtons}>
            {!completed ? (
              <TouchableOpacity
                onPress={() => openDepositModal(item)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.depositButton}
              >
                <HugeIcon name="add-circle-outline" size={24} color={Colors.ionBlue} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() => openEditModal(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.editButton}
            >
              <HugeIcon name="pencil-outline" size={20} color={Colors.ionBlue} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => deleteCaixinha(item.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.deleteButton}
            >
              <HugeIcon name="trash-outline" size={20} color={Colors.error} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.caixinhaContent}>
          <View style={styles.progressCircleContainer}>
            <CircularProgress 
              progress={progress} 
              size={100} 
              strokeWidth={10} 
              color={progressColor}
              bgColor={Colors.backgroundDarkTertiary}
              textColor={Colors.textPrimary}
            />
          </View>
          
          <View style={styles.caixinhaInfo}>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <LinearGradient
                  colors={[progressColor, progressColor + 'AA']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${progress}%` }]}
                />
              </View>
              <View style={styles.valuesRow}>
                <View>
                  <Text style={styles.valueLabel}>Arrecadado</Text>
                  <Text style={styles.valueText}>R$ {(item.valor_total_arrecadado || 0).toFixed(2)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.valueLabel}>Meta</Text>
                  <Text style={styles.valueText}>R$ {(item.valor_meta || 0).toFixed(2)}</Text>
                </View>
              </View>
            </View>

            {!completed ? (
              <View style={styles.detailsGrid}>
                {daysLeft !== null && daysLeft >= 0 ? (
                  <View style={styles.detailItem}>
                    <HugeIcon name="time-outline" size={18} color={isUrgent ? Colors.error : Colors.textSecondary} />
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Tempo restante</Text>
                      <Text style={[styles.detailValue, isUrgent && { color: Colors.error }]}>
                        {String(daysLeft) + ' ' + (daysLeft === 1 ? 'dia' : 'dias')}
                      </Text>
                    </View>
                  </View>
                ) : null}
                <View style={styles.detailItem}>
                  <HugeIcon name="cash-outline" size={18} color={Colors.textSecondary} />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Falta arrecadar</Text>
                    <Text style={styles.detailValue}>R$ {(remaining || 0).toFixed(2)}</Text>
                  </View>
                </View>
                {item.data_para_concluir && monthlyDeposit > 0 ? (
                  <View style={styles.detailItem}>
                    <HugeIcon name="calendar-outline" size={18} color={Colors.textSecondary} />
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Mensal necessário</Text>
                      <Text style={styles.detailValue}>R$ {(monthlyDeposit || 0).toFixed(2)}</Text>
                    </View>
                  </View>
                ) : null}
                {item.deposito && item.deposito > 0 ? (
                  <View style={styles.detailItem}>
                    <HugeIcon name="add-circle" size={18} color={Colors.success} />
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Último depósito</Text>
                      <Text style={styles.detailValue}>R$ {(item.deposito || 0).toFixed(2)}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {completed ? (
              <View style={styles.completedInfo}>
                <LinearGradient
                  colors={[Colors.success + '20', Colors.success + '10']}
                  style={styles.completedGradient}
                >
                  <HugeIcon name="trophy" size={24} color={Colors.success} />
                  <Text style={styles.completedDate}>
                    Parabéns! Meta atingida! 🎉
                  </Text>
                  {item.data_para_concluir ? (
                    <Text style={styles.completedSubtext}>
                      Data limite: {format(item.data_para_concluir, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </Text>
                  ) : null}
                </LinearGradient>
              </View>
            ) : null}
          </View>
        </View>
      </BlurView>
    );
  };

  const sortedCaixinhas = [...caixinhas].sort((a, b) => {
    // Não concluídas primeiro, depois concluídas
    const aCompleted = isCompleted(a);
    const bCompleted = isCompleted(b);
    if (!aCompleted && bCompleted) return -1;
    if (aCompleted && !bCompleted) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  
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
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => router.push('/(tabs)/finances')}
          >
            <HugeIcon name="arrow-back" size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Caixinhas</Text>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setModalVisible(true)}
          >
            <HugeIcon name="add" size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={sortedCaixinhas}
          renderItem={renderCaixinha}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              {/* Título da Lista */}
              <View style={styles.listHeader}>
                <Text style={styles.listHeaderTitle}>Suas Caixinhas</Text>
                <Text style={styles.listHeaderSubtitle}>{sortedCaixinhas.length} {sortedCaixinhas.length === 1 ? 'caixinha' : 'caixinhas'}</Text>
              </View>
            </>
          }
          ListFooterComponent={
            <>
              {/* Cards de Estatísticas */}
              {caixinhas.length > 0 ? (
                <View style={styles.statsContainer}>
                  <BlurView intensity={20} style={styles.statsCard}>
                    <View style={styles.statsHeader}>
                      <HugeIcon name="stats-chart" size={24} color={Colors.ionBlue} />
                      <Text style={styles.statsTitle}>Resumo Geral</Text>
                    </View>
                    <View style={styles.statsGrid}>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>R$ {stats.totalGuardado.toFixed(2)}</Text>
                        <Text style={styles.statLabel}>Total Guardado</Text>
                        <HugeIcon name="wallet" size={20} color={Colors.success} style={styles.statIcon} />
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>R$ {stats.totalMetas.toFixed(2)}</Text>
                        <Text style={styles.statLabel}>Total em Metas</Text>
                        <HugeIcon name="flag" size={20} color={Colors.primary} style={styles.statIcon} />
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>{stats.caixinhasCompletas}/{stats.totalCaixinhas}</Text>
                        <Text style={styles.statLabel}>Concluídas</Text>
                        <HugeIcon name="checkmark-circle" size={20} color={Colors.success} style={styles.statIcon} />
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>R$ {stats.totalRestante.toFixed(2)}</Text>
                        <Text style={styles.statLabel}>Falta Arrecadar</Text>
                        <HugeIcon name="trending-up" size={20} color={Colors.warning} style={styles.statIcon} />
                      </View>
                    </View>
                    <View style={styles.overallProgressContainer}>
                      <Text style={styles.overallProgressLabel}>Progresso Geral</Text>
                      <View style={styles.overallProgressBar}>
                        <LinearGradient
                          colors={[Colors.ionBlue, Colors.primary]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[styles.overallProgressFill, { width: `${stats.progressoGeral}%` }]}
                        />
                      </View>
                      <Text style={styles.overallProgressText}>{stats.progressoGeral.toFixed(1)}%</Text>
                    </View>
                  </BlurView>
                </View>
              ) : null}

              {/* Card de Investimentos */}
              {totalInvestido > 0 ? (
                <BlurView intensity={20} style={styles.investmentCard}>
                  <TouchableOpacity
                    style={styles.investmentHeader}
                    onPress={() => setInvestmentExpanded(!investmentExpanded)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.investmentHeaderLeft}>
                      <HugeIcon name="trending-up" size={24} color={Colors.success} />
                      <View style={styles.investmentHeaderText}>
                        <Text style={styles.investmentTitle}>Simulação de Investimentos</Text>
                        <Text style={styles.investmentSubtitle}>
                          Veja quanto seu dinheiro renderia investido
                        </Text>
                      </View>
                    </View>
                    <HugeIcon
                      name={investmentExpanded ? 'chevron-up' : 'chevron-down'}
                      size={24}
                      color={Colors.textSecondary}
                    />
                  </TouchableOpacity>

                  {investmentExpanded && (
                    <View style={styles.investmentContent}>
                      <View style={styles.investmentSummary}>
                        <Text style={styles.investmentSummaryLabel}>Total investido</Text>
                        <Text style={styles.investmentSummaryValue}>
                          R$ {totalInvestido.toFixed(2)}
                        </Text>
                        <Text style={styles.investmentSummaryNote}>
                          Projeção para {averageMonthsToComplete} {averageMonthsToComplete === 1 ? 'mês' : 'meses'}
                        </Text>
                      </View>

                      <View style={styles.investmentList}>
                        {investmentTypes.map((investment) => {
                          const valorFinal = calculateInvestmentReturn(
                            totalInvestido,
                            investment.rendimentoAnual,
                            averageMonthsToComplete
                          );
                          const rendimento = valorFinal - totalInvestido;
                          const riscoColor =
                            investment.risco === 'Baixo'
                              ? Colors.success
                              : investment.risco === 'Médio'
                              ? Colors.warning
                              : Colors.error;

                          return (
                            <View key={investment.id} style={styles.investmentItem}>
                              <View style={styles.investmentItemHeader}>
                                <View style={styles.investmentItemLeft}>
                                  <View
                                    style={[
                                      styles.investmentIconContainer,
                                      { backgroundColor: riscoColor + '20' },
                                    ]}
                                  >
                                    <HugeIcon
                                      name={investment.icone}
                                      size={20}
                                      color={riscoColor}
                                    />
                                  </View>
                                  <View style={styles.investmentItemInfo}>
                                    <Text style={styles.investmentItemName}>
                                      {investment.nome}
                                    </Text>
                                    <Text style={styles.investmentItemDesc}>
                                      {investment.descricao}
                                    </Text>
                                  </View>
                                </View>
                                <View style={[styles.riskBadge, { backgroundColor: riscoColor + '20' }]}>
                                  <Text style={[styles.riskText, { color: riscoColor }]}>
                                    {investment.risco}
                                  </Text>
                                </View>
                              </View>

                              <View style={styles.investmentReturns}>
                                <View style={styles.returnRow}>
                                  <Text style={styles.returnLabel}>Rendimento médio:</Text>
                                  <Text style={styles.returnValue}>
                                    {investment.rendimentoAnual.toFixed(2)}% a.a.
                                  </Text>
                                </View>
                                <View style={styles.returnRow}>
                                  <Text style={styles.returnLabel}>Valor projetado:</Text>
                                  <Text style={[styles.returnValue, { color: Colors.success }]}>
                                    R$ {valorFinal.toFixed(2)}
                                  </Text>
                                </View>
                                <View style={styles.returnRow}>
                                  <Text style={styles.returnLabel}>Ganho estimado:</Text>
                                  <Text style={[styles.returnValue, { color: Colors.success }]}>
                                    + R$ {rendimento.toFixed(2)}
                                  </Text>
                                </View>
                              </View>

                              <View style={styles.investmentProgressBar}>
                                <LinearGradient
                                  colors={[riscoColor, riscoColor + 'AA']}
                                  start={{ x: 0, y: 0 }}
                                  end={{ x: 1, y: 0 }}
                                  style={[
                                    styles.investmentProgressFill,
                                    {
                                      width: `${Math.min(
                                        (rendimento / totalInvestido) * 100,
                                        100
                                      )}%`,
                                    },
                                  ]}
                                />
                              </View>
                            </View>
                          );
                        })}
                      </View>

                      <View style={styles.investmentDisclaimer}>
                        <HugeIcon name="information-circle" size={16} color={Colors.textSecondary} />
                        <Text style={styles.investmentDisclaimerText}>
                          Valores são estimativas baseadas em rendimentos históricos médios. 
                          Investimentos passados não garantem resultados futuros. 
                          Consulte um consultor financeiro antes de investir.
                        </Text>
                      </View>
                    </View>
                  )}
                </BlurView>
              ) : null}

              {/* Gráfico de Distribuição por Categoria */}
              {categoryDistribution.length > 0 ? (
                <BlurView intensity={20} style={styles.chartCard}>
                  <Text style={styles.chartTitle}>Distribuição por Categoria</Text>
                  <Text style={styles.chartSubtitle}>
                    Total: R$ {categoryDistribution.reduce((sum, cat) => sum + cat.total, 0).toFixed(2)}
                  </Text>
                  <View style={styles.categoryChartContainer}>
                    {categoryDistribution.map((item, index) => {
                      const totalCategory = categoryDistribution.reduce((sum, cat) => sum + cat.total, 0);
                      const percentage = totalCategory > 0 ? (item.total / totalCategory) * 100 : 0;
                      const colors = [
                        Colors.ionBlue, Colors.success, Colors.warning, Colors.error,
                        '#FF6B6B', '#4ECDC4', '#9B59B6', '#E67E22'
                      ];
                      const color = colors[index % colors.length];
                      
                      return (
                        <View key={item.categoria} style={styles.categoryBarItem}>
                          <View style={styles.categoryBarHeader}>
                            <View style={styles.categoryBarLabel}>
                              <View style={[styles.legendDot, { backgroundColor: color }]} />
                              <Text style={styles.categoryBarName} numberOfLines={1}>{item.categoria}</Text>
                            </View>
                            <Text style={styles.categoryBarPercentage}>
                              {percentage.toFixed(0)}%
                            </Text>
                          </View>
                          <View style={styles.categoryBarContainer}>
                            <LinearGradient
                              colors={[color, color + 'CC']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={[styles.categoryBar, { width: `${percentage}%` }]}
                            />
                          </View>
                          <Text style={styles.categoryBarAmount}>
                            R$ {item.total.toFixed(2)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </BlurView>
              ) : null}

              {/* Card de Dicas */}
              <BlurView intensity={20} style={styles.tipsCard}>
                <View style={styles.tipsHeader}>
                  <HugeIcon name="bulb" size={24} color={Colors.warning} />
                  <Text style={styles.tipsTitle}>Dicas para Economizar</Text>
                </View>
                <View style={styles.tipsList}>
                  <View style={styles.tipItem}>
                    <HugeIcon name="checkmark-circle" size={16} color={Colors.success} />
                    <Text style={styles.tipText}>
                      Faça depósitos regulares, mesmo que pequenos. A consistência é a chave!
                    </Text>
                  </View>
                  <View style={styles.tipItem}>
                    <HugeIcon name="checkmark-circle" size={16} color={Colors.success} />
                    <Text style={styles.tipText}>
                      Estabeleça metas realistas com prazos adequados para evitar frustrações.
                    </Text>
                  </View>
                  <View style={styles.tipItem}>
                    <HugeIcon name="checkmark-circle" size={16} color={Colors.success} />
                    <Text style={styles.tipText}>
                      Priorize suas caixinhas: comece pelas mais urgentes ou importantes.
                    </Text>
                  </View>
                  <View style={styles.tipItem}>
                    <HugeIcon name="checkmark-circle" size={16} color={Colors.success} />
                    <Text style={styles.tipText}>
                      Revise seus gastos mensais e identifique oportunidades de economia.
                    </Text>
                  </View>
                </View>
              </BlurView>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <HugeIcon name="wallet-outline" size={64} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>Nenhuma caixinha criada</Text>
              <Text style={styles.emptySubtext}>
                Comece criando sua primeira caixinha para alcançar seus objetivos!
              </Text>
            </View>
          }
        />

        {/* Modal de criar caixinha */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <ScrollView style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nova Caixinha</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <HugeIcon name="close" size={28} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>Nome *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: Viagem, Notebook, Emergência"
                placeholderTextColor={Colors.textSecondary}
                value={newNome}
                onChangeText={setNewNome}
              />

              <Text style={styles.modalLabel}>Meta (R$) *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: 1000, 5000"
                placeholderTextColor={Colors.textSecondary}
                value={newMeta}
                onChangeText={setNewMeta}
                keyboardType="numeric"
              />

              <Text style={styles.modalLabel}>Data Limite *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="YYYY-MM-DD (ex: 2024-12-31)"
                placeholderTextColor={Colors.textSecondary}
                value={newDataLimite}
                onChangeText={setNewDataLimite}
              />
              <Text style={styles.modalHint}>
                Formato: YYYY-MM-DD (ex: 2024-12-31)
              </Text>

              <Text style={styles.modalLabel}>Categoria (opcional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: Viagem, Emergência, Educação"
                placeholderTextColor={Colors.textSecondary}
                value={newCategoria}
                onChangeText={setNewCategoria}
              />
              <Text style={styles.modalHint}>
                Categoria ajuda a organizar suas caixinhas
              </Text>

              <TouchableOpacity style={styles.modalButton} onPress={addCaixinha}>
                <Text style={styles.modalButtonText}>Criar Caixinha</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>

        {/* Modal de edição */}
        <Modal
          visible={editModalVisible}
          animationType="slide"
          transparent
          onRequestClose={closeEditModal}
        >
          <View style={styles.modalOverlay}>
            <ScrollView style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Editar Caixinha</Text>
                <TouchableOpacity onPress={closeEditModal}>
                  <HugeIcon name="close" size={28} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>Nome *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: Viagem, Notebook, Emergência"
                placeholderTextColor={Colors.textSecondary}
                value={newNome}
                onChangeText={setNewNome}
              />

              <Text style={styles.modalLabel}>Meta (R$) *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: 1000, 5000"
                placeholderTextColor={Colors.textSecondary}
                value={newMeta}
                onChangeText={setNewMeta}
                keyboardType="numeric"
              />

              <Text style={styles.modalLabel}>Data Limite *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="YYYY-MM-DD (ex: 2024-12-31)"
                placeholderTextColor={Colors.textSecondary}
                value={newDataLimite}
                onChangeText={setNewDataLimite}
              />
              <Text style={styles.modalHint}>
                Formato: YYYY-MM-DD (ex: 2024-12-31)
              </Text>

              <Text style={styles.modalLabel}>Categoria (opcional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: Viagem, Emergência, Educação"
                placeholderTextColor={Colors.textSecondary}
                value={newCategoria}
                onChangeText={setNewCategoria}
              />
              <Text style={styles.modalHint}>
                Categoria ajuda a organizar suas caixinhas
              </Text>

              <TouchableOpacity style={styles.modalButton} onPress={updateCaixinha}>
                <Text style={styles.modalButtonText}>Salvar Alterações</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>

        {/* Modal de depósito */}
        <Modal
          visible={depositModalVisible}
          animationType="slide"
          transparent
          onRequestClose={closeDepositModal}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Adicionar Depósito</Text>
                    <TouchableOpacity onPress={closeDepositModal}>
                      <HugeIcon name="close" size={28} color={Colors.textPrimary} />
                    </TouchableOpacity>
                  </View>

                  {selectedCaixinha && (
                    <>
                      <Text style={styles.modalLabel}>Caixinha: {selectedCaixinha.nome_caixinha}</Text>
                      <Text style={styles.modalSubtext}>
                        Valor atual: R$ {selectedCaixinha.valor_total_arrecadado.toFixed(2)} / R$ {selectedCaixinha.valor_meta.toFixed(2)}
                      </Text>
                      
                      <Text style={styles.modalLabel}>Valor do Depósito (R$) *</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Ex: 100, 500"
                        placeholderTextColor={Colors.textSecondary}
                        value={depositValue}
                        onChangeText={setDepositValue}
                        keyboardType="numeric"
                        returnKeyType="done"
                        onSubmitEditing={() => {
                          Keyboard.dismiss();
                          if (depositValue.trim() && parseFloat(depositValue) > 0) {
                            addDeposit();
                          }
                        }}
                      />

                      <TouchableOpacity style={styles.modalButton} onPress={addDeposit}>
                        <Text style={styles.modalButtonText}>Adicionar Depósito</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
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
      paddingBottom: 100,
    },
    statsContainer: {
      marginBottom: 16,
    },
    statsCard: {
      padding: 20,
      borderRadius: 20,
      backgroundColor: Colors.glassBackground,
      borderWidth: 1,
      borderColor: Colors.glassBorder,
      marginBottom: 16,
    },
    statsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    statsTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: Colors.textPrimary,
      marginLeft: 10,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 20,
      marginHorizontal: -6,
    },
    statItem: {
      flex: 1,
      minWidth: (SCREEN_WIDTH - 64) / 2 - 6,
      backgroundColor: Colors.backgroundDarkTertiary,
      borderRadius: 12,
      padding: 16,
      position: 'relative',
      overflow: 'hidden',
      margin: 6,
    },
    statIcon: {
      position: 'absolute',
      top: 12,
      right: 12,
      opacity: 0.3,
    },
    statValue: {
      fontSize: 20,
      fontWeight: 'bold',
      color: Colors.textPrimary,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
    overallProgressContainer: {
      marginTop: 8,
    },
    overallProgressLabel: {
      fontSize: 14,
      color: Colors.textSecondary,
      marginBottom: 8,
    },
    overallProgressBar: {
      height: 12,
      backgroundColor: Colors.backgroundDarkTertiary,
      borderRadius: 6,
      overflow: 'hidden',
      marginBottom: 8,
    },
    overallProgressFill: {
      height: '100%',
      borderRadius: 6,
    },
    overallProgressText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: Colors.textPrimary,
      textAlign: 'right',
    },
    chartCard: {
      padding: 20,
      borderRadius: 20,
      backgroundColor: Colors.glassBackground,
      borderWidth: 1,
      borderColor: Colors.glassBorder,
      marginBottom: 16,
    },
    chartTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: Colors.textPrimary,
      marginBottom: 4,
    },
    chartSubtitle: {
      fontSize: 14,
      color: Colors.textSecondary,
      marginBottom: 16,
    },
    categoryChartContainer: {
      marginTop: 4,
    },
    categoryBarItem: {
      marginBottom: 8,
    },
    categoryBarHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    categoryBarLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    legendDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginRight: 8,
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
      height: 10,
      backgroundColor: Colors.backgroundDarkTertiary,
      borderRadius: 5,
      overflow: 'hidden',
      marginBottom: 4,
    },
    categoryBar: {
      height: '100%',
      borderRadius: 5,
    },
    categoryBarAmount: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
    tipsCard: {
      padding: 20,
      borderRadius: 20,
      backgroundColor: Colors.glassBackground,
      borderWidth: 1,
      borderColor: Colors.glassBorder,
      marginBottom: 16,
    },
    tipsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    tipsTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: Colors.textPrimary,
      marginLeft: 10,
    },
    tipsList: {
      marginTop: 4,
    },
    tipItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    tipText: {
      flex: 1,
      fontSize: 14,
      color: Colors.textSecondary,
      lineHeight: 20,
      marginLeft: 12,
    },
    listHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      marginTop: 0,
    },
    listHeaderTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: Colors.textPrimary,
    },
    listHeaderSubtitle: {
      fontSize: 14,
      color: Colors.textSecondary,
    },
    caixinhaCard: {
      padding: 20,
      borderRadius: 20,
      marginBottom: 16,
      backgroundColor: Colors.glassBackground,
      borderWidth: 1,
      borderColor: Colors.glassBorder,
      overflow: 'hidden',
    },
    caixinhaHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    caixinhaHeaderLeft: {
      flex: 1,
    },
    caixinhaTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      marginBottom: 8,
    },
    categoryTag: {
      backgroundColor: Colors.primary + '30',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.primary + '50',
      marginRight: 8,
    },
    categoryTagText: {
      fontSize: 11,
      fontWeight: '600',
      color: Colors.primary,
    },
    caixinhaTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: Colors.textPrimary,
      flex: 1,
    },
    completedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
    },
    completedText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.success,
      marginLeft: 6,
    },
    urgentBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      backgroundColor: Colors.error + '20',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      alignSelf: 'flex-start',
    },
    urgentText: {
      fontSize: 12,
      fontWeight: '600',
      color: Colors.error,
      marginLeft: 6,
    },
    caixinhaContent: {
      flexDirection: 'row',
    },
    progressCircleContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    caixinhaInfo: {
      flex: 1,
    },
    actionButtons: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    depositButton: {
      padding: 8,
      marginLeft: 4,
    },
    editButton: {
      padding: 8,
      marginLeft: 4,
    },
    deleteButton: {
      padding: 8,
      marginLeft: 4,
    },
    progressContainer: {
      marginBottom: 16,
    },
    progressBar: {
      height: 10,
      backgroundColor: Colors.backgroundDarkTertiary,
      borderRadius: 5,
      overflow: 'hidden',
      marginBottom: 10,
    },
    progressFill: {
      height: '100%',
      borderRadius: 5,
    },
    valuesRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    valueLabel: {
      fontSize: 11,
      color: Colors.textSecondary,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    valueText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: Colors.textPrimary,
    },
    detailsGrid: {
      marginTop: 8,
    },
    detailItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: Colors.backgroundDarkTertiary,
      borderRadius: 10,
      marginBottom: 12,
    },
    detailContent: {
      flex: 1,
      marginLeft: 12,
    },
    detailLabel: {
      fontSize: 11,
      color: Colors.textSecondary,
      marginBottom: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    detailValue: {
      fontSize: 15,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    completedInfo: {
      marginTop: 12,
    },
    completedGradient: {
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    completedDate: {
      fontSize: 16,
      color: Colors.success,
      fontWeight: 'bold',
      textAlign: 'center',
      marginTop: 8,
    },
    completedSubtext: {
      fontSize: 12,
      color: Colors.textSecondary,
      textAlign: 'center',
      marginTop: 8,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 64,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: Colors.textPrimary,
      marginTop: 16,
    },
    emptySubtext: {
      fontSize: 14,
      color: Colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
      paddingHorizontal: 32,
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
      maxHeight: '90%',
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
    modalLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.textPrimary,
      marginBottom: 8,
      marginTop: 16,
    },
    modalSubtext: {
      fontSize: 14,
      color: Colors.textSecondary,
      marginBottom: 16,
    },
    modalHint: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: -4,
      marginBottom: 8,
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
    investmentCard: {
      padding: 20,
      borderRadius: 20,
      backgroundColor: Colors.glassBackground,
      borderWidth: 1,
      borderColor: Colors.glassBorder,
      marginBottom: 16,
    },
    investmentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    investmentHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    investmentHeaderText: {
      marginLeft: 12,
      flex: 1,
    },
    investmentTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: Colors.textPrimary,
      marginBottom: 4,
    },
    investmentSubtitle: {
      fontSize: 14,
      color: Colors.textSecondary,
    },
    investmentContent: {
      marginTop: 20,
    },
    investmentSummary: {
      backgroundColor: Colors.backgroundDarkTertiary,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      alignItems: 'center',
    },
    investmentSummaryLabel: {
      fontSize: 12,
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    investmentSummaryValue: {
      fontSize: 28,
      fontWeight: 'bold',
      color: Colors.textPrimary,
      marginBottom: 4,
    },
    investmentSummaryNote: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
    investmentList: {
      marginBottom: 16,
    },
    investmentItem: {
      backgroundColor: Colors.backgroundDarkTertiary,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    investmentItemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    investmentItemLeft: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      flex: 1,
    },
    investmentIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    investmentItemInfo: {
      flex: 1,
    },
    investmentItemName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: Colors.textPrimary,
      marginBottom: 4,
    },
    investmentItemDesc: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
    riskBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
    },
    riskText: {
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    investmentReturns: {
      marginTop: 8,
    },
    returnRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    returnLabel: {
      fontSize: 13,
      color: Colors.textSecondary,
    },
    returnValue: {
      fontSize: 15,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    investmentProgressBar: {
      height: 6,
      backgroundColor: Colors.backgroundDark,
      borderRadius: 3,
      overflow: 'hidden',
      marginTop: 12,
    },
    investmentProgressFill: {
      height: '100%',
      borderRadius: 3,
    },
    investmentDisclaimer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: Colors.backgroundDarkTertiary,
      padding: 12,
      borderRadius: 8,
      marginTop: 8,
    },
    investmentDisclaimerText: {
      flex: 1,
      fontSize: 11,
      color: Colors.textSecondary,
      lineHeight: 16,
      marginLeft: 8,
    },
  });
}

