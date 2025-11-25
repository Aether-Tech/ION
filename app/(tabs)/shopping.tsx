import { useState, useEffect } from 'react';
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
  Keyboard,
  TouchableWithoutFeedback,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HugeIcon } from '../../components/HugeIcon';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { useAppColors } from '../../hooks/useAppColors';
import { useAuth } from '../../contexts/AuthContext';
import { listaComprasService } from '../../services/supabaseService';
import { ItemCompra } from '../../services/supabase';

interface ShoppingItem {
  id: string;
  item: string;
  categoria?: string;
  completed: boolean;
  createdAt: Date;
  selecao?: string | null;
}

type ShoppingCategory = 'Alimentos' | 'Limpeza' | 'Higiene' | 'Outros' | string;

// Mapeamento de ícones para categorias
const getCategoryIcon = (category: string): keyof typeof Ionicons.glyphMap => {
  const categoryLower = category.toLowerCase();
  
  // Categorias padrão
  if (categoryLower === 'alimentos') {
    return 'restaurant';
  }
  if (categoryLower === 'limpeza') {
    return 'sparkles';
  }
  if (categoryLower === 'higiene') {
    return 'water';
  }
  if (categoryLower === 'outros') {
    return 'cube';
  }
  
  // Categorias customizadas - tentar detectar pelo nome
  if (categoryLower.includes('alimento') || categoryLower.includes('comida') || categoryLower.includes('bebida')) {
    return 'restaurant';
  }
  if (categoryLower.includes('limpeza') || categoryLower.includes('limpar') || categoryLower.includes('detergente')) {
    return 'sparkles';
  }
  if (categoryLower.includes('higiene') || categoryLower.includes('banho') || categoryLower.includes('sabonete')) {
    return 'water';
  }
  if (categoryLower.includes('padaria') || categoryLower.includes('pão')) {
    return 'basket';
  }
  
  return 'cube';
};

export default function ShoppingScreen() {
  const Colors = useAppColors();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [newItem, setNewItem] = useState('');
  const [newCategory, setNewCategory] = useState<ShoppingCategory>('Alimentos');
  const [customCategory, setCustomCategory] = useState('');
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  
  // Estados para gerenciar seleções (listas)
  const [selectedSelecao, setSelectedSelecao] = useState<string | null>(null); // null = "Todos" ou "Sem lista"
  const [selecoes, setSelecoes] = useState<string[]>([]);
  const [selecoesModalVisible, setSelecoesModalVisible] = useState(false);
  const [newSelecaoName, setNewSelecaoName] = useState('');
  const [editingSelecao, setEditingSelecao] = useState<string | null>(null);
  const [editingSelecaoName, setEditingSelecaoName] = useState('');
  const [isReorganizing, setIsReorganizing] = useState(false);
  const [isReorganized, setIsReorganized] = useState(false);
  const [reorganizedOrder, setReorganizedOrder] = useState<Map<string, number>>(new Map());

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
  }, [user?.usuarioId, user, authLoading, selectedSelecao]);

  const loadData = async () => {
    if (!user?.usuarioId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      // Resetar estado de reorganização ao carregar novos dados
      setIsReorganized(false);
      setReorganizedOrder(new Map());
      
      // Carregar itens baseado na seleção atual
      const itemsData = selectedSelecao === null
        ? await listaComprasService.getBySelecao(user.usuarioId, null)
        : await listaComprasService.getBySelecao(user.usuarioId, selectedSelecao);
      
      // Filtrar itens placeholder (não mostrar para o usuário)
      const itemsFormatted: ShoppingItem[] = itemsData
        .filter((item) => !item.item?.startsWith('__LISTA_PLACEHOLDER_'))
        .map((item) => {
          const completed = item.status === 'comprado' || item.status === 'completo';
          
          return {
            id: item.id.toString(),
            item: item.item || 'Sem nome',
            categoria: item.categoria as ShoppingCategory | undefined,
            completed,
            createdAt: new Date(item.created_at),
            selecao: item.selecao || null,
          };
        });
      
      setItems(itemsFormatted);
      
      // Extrair categorias customizadas (que não são as padrões)
      const defaultCategories = ['Alimentos', 'Limpeza', 'Higiene', 'Outros'];
      const uniqueCustomCategories = Array.from(
        new Set(
          itemsData
            .map(item => item.categoria)
            .filter((cat): cat is string => 
              !!cat && !defaultCategories.includes(cat)
            )
        )
      );
      setCustomCategories(uniqueCustomCategories);
      
      // Carregar seleções disponíveis
      const selecoesData = await listaComprasService.getSelecoes(user.usuarioId);
      setSelecoes(selecoesData);
    } catch (error) {
      console.error('Error loading shopping items:', error);
    } finally {
      setLoading(false);
    }
  };

  const addItem = async () => {
    if (!user?.usuarioId) {
      Alert.alert('Erro', 'Usuário não autenticado');
      return;
    }

    if (!newItem.trim()) {
      Alert.alert('Erro', 'Por favor, insira um item para a lista');
      return;
    }

    const finalCategory = newCategory === 'Outros' && customCategory.trim() 
      ? customCategory.trim() 
      : newCategory;

    if (!finalCategory || (newCategory === 'Outros' && !customCategory.trim())) {
      Alert.alert('Erro', 'Por favor, insira uma categoria');
      return;
    }

    try {
      const item = await listaComprasService.create({
        item: newItem,
        categoria: finalCategory,
        usuario_id: user.usuarioId,
        status: 'pendente',
        selecao: selectedSelecao,
      });

      if (item) {
        const shoppingItem: ShoppingItem = {
          id: item.id.toString(),
          item: item.item || 'Sem nome',
          categoria: finalCategory,
          completed: false,
          createdAt: new Date(item.created_at),
        };

        setItems([...items, shoppingItem]);
        closeAddModal();
        await loadData();
      } else {
        throw new Error('Não foi possível criar o item');
      }
    } catch (error) {
      console.error('Error adding item:', error);
      Alert.alert('Erro', 'Não foi possível adicionar o item');
    }
  };

  const openEditModal = (item: ShoppingItem) => {
    setEditingItem(item);
    setNewItem(item.item);
    const itemCategory = item.categoria || 'Alimentos';
    const defaultCategories = ['Alimentos', 'Limpeza', 'Higiene', 'Outros'];
    if (defaultCategories.includes(itemCategory)) {
      setNewCategory(itemCategory);
      setShowCustomCategoryInput(false);
      setCustomCategory('');
    } else {
      setNewCategory('Outros');
      setCustomCategory(itemCategory);
      setShowCustomCategoryInput(true);
    }
    // Não alterar a seleção atual ao editar - o item mantém sua seleção original
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    Keyboard.dismiss();
    setEditModalVisible(false);
    setEditingItem(null);
    setNewItem('');
    setNewCategory('Alimentos');
    setCustomCategory('');
    setShowCustomCategoryInput(false);
  };

  const closeAddModal = () => {
    Keyboard.dismiss();
    setModalVisible(false);
    setNewItem('');
    setNewCategory('Alimentos');
    setCustomCategory('');
    setShowCustomCategoryInput(false);
  };

  const createSelecao = async () => {
    if (!newSelecaoName.trim()) {
      Alert.alert('Erro', 'Por favor, insira um nome para a lista');
      return;
    }

    const trimmedName = newSelecaoName.trim();

    if (selecoes.includes(trimmedName)) {
      Alert.alert('Erro', 'Já existe uma lista com esse nome');
      return;
    }

    if (!user?.usuarioId) {
      Alert.alert('Erro', 'Usuário não autenticado');
      return;
    }

    try {
      // Criar um item placeholder para persistir a lista
      // Este item pode ser deletado depois se necessário, mas garante que a lista existe
      const placeholderItem = await listaComprasService.create({
        item: `__LISTA_PLACEHOLDER_${trimmedName}__`,
        categoria: null,
        usuario_id: user.usuarioId,
        status: 'pendente',
        selecao: trimmedName,
      });

      if (placeholderItem) {
        // Atualizar listas locais
        setSelecoes([...selecoes, trimmedName]);
        setSelectedSelecao(trimmedName);
        setNewSelecaoName('');
        setSelecoesModalVisible(false);
        await loadData();
      } else {
        Alert.alert('Erro', 'Não foi possível criar a lista');
      }
    } catch (error) {
      console.error('Error creating selecao:', error);
      Alert.alert('Erro', 'Não foi possível criar a lista');
    }
  };

  const deleteSelecao = async (selecaoName: string) => {
    Alert.alert(
      'Excluir Lista',
      `Tem certeza que deseja excluir a lista "${selecaoName}"? Os itens dessa lista não serão excluídos, apenas ficarão sem lista.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              // Buscar todos os itens dessa seleção e remover a seleção deles
              if (!user?.usuarioId) return;
              
              const itemsToUpdate = await listaComprasService.getBySelecao(user.usuarioId, selecaoName);
              
              // Atualizar todos os itens para remover a seleção e deletar placeholders
              for (const item of itemsToUpdate) {
                if (item.item?.startsWith('__LISTA_PLACEHOLDER_')) {
                  // Deletar item placeholder
                  await listaComprasService.delete(item.id);
                } else {
                  // Remover seleção de itens normais
                  await listaComprasService.update(item.id, { selecao: null });
                }
              }
              
              // Atualizar lista local
              setSelecoes(selecoes.filter(s => s !== selecaoName));
              
              // Se a lista excluída era a selecionada, voltar para null
              if (selectedSelecao === selecaoName) {
                setSelectedSelecao(null);
              }
              
              await loadData();
            } catch (error) {
              console.error('Error deleting selecao:', error);
              Alert.alert('Erro', 'Não foi possível excluir a lista');
            }
          },
        },
      ]
    );
  };

  const startEditSelecao = (selecaoName: string) => {
    setEditingSelecao(selecaoName);
    setEditingSelecaoName(selecaoName);
  };

  const cancelEditSelecao = () => {
    setEditingSelecao(null);
    setEditingSelecaoName('');
  };

  const saveEditSelecao = async () => {
    if (!editingSelecao || !editingSelecaoName.trim()) {
      Alert.alert('Erro', 'Por favor, insira um nome válido para a lista');
      return;
    }

    const newName = editingSelecaoName.trim();

    // Verificar se o novo nome já existe (e não é o nome atual)
    if (newName !== editingSelecao && selecoes.includes(newName)) {
      Alert.alert('Erro', 'Já existe uma lista com esse nome');
      return;
    }

    if (!user?.usuarioId) {
      Alert.alert('Erro', 'Usuário não autenticado');
      return;
    }

    try {
      // Buscar todos os itens dessa seleção
      const itemsToUpdate = await listaComprasService.getBySelecao(user.usuarioId, editingSelecao);
      
      // Atualizar todos os itens com o novo nome da lista
      for (const item of itemsToUpdate) {
        await listaComprasService.update(item.id, { selecao: newName });
      }
      
      // Atualizar lista local
      const updatedSelecoes = selecoes.map(s => s === editingSelecao ? newName : s);
      setSelecoes(updatedSelecoes);
      
      // Se a lista editada era a selecionada, atualizar a seleção
      if (selectedSelecao === editingSelecao) {
        setSelectedSelecao(newName);
      }
      
      setEditingSelecao(null);
      setEditingSelecaoName('');
      await loadData();
    } catch (error) {
      console.error('Error updating selecao:', error);
      Alert.alert('Erro', 'Não foi possível atualizar o nome da lista');
    }
  };

  const updateItem = async () => {
    if (!user?.usuarioId || !editingItem) {
      Alert.alert('Erro', 'Usuário não autenticado ou item não encontrado');
      return;
    }

    if (!newItem.trim()) {
      Alert.alert('Erro', 'Por favor, insira um item para a lista');
      return;
    }

    const finalCategory = newCategory === 'Outros' && customCategory.trim() 
      ? customCategory.trim() 
      : newCategory;

    if (!finalCategory || (newCategory === 'Outros' && !customCategory.trim())) {
      Alert.alert('Erro', 'Por favor, insira uma categoria');
      return;
    }

    try {
      const itemId = parseInt(editingItem.id);
      // Manter a seleção original do item ao editar, a menos que o usuário mude explicitamente
      const updated = await listaComprasService.update(itemId, {
        item: newItem,
        categoria: finalCategory,
        // Manter a seleção original do item
        selecao: editingItem.selecao,
      });

      if (updated) {
        closeEditModal();
        await loadData();
      } else {
        throw new Error('Não foi possível atualizar o item');
      }
    } catch (error) {
      console.error('Error updating item:', error);
      Alert.alert('Erro', 'Não foi possível atualizar o item');
    }
  };

  const toggleComplete = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const newStatus = !item.completed ? 'comprado' : 'pendente';
    
    try {
      const itemId = parseInt(id);
      const updated = await listaComprasService.update(itemId, { 
        status: newStatus,
      });
      
      if (updated) {
        setItems(items.map((i) =>
          i.id === id ? { 
            ...i, 
            completed: !i.completed,
          } : i
        ));
      } else {
        throw new Error('Não foi possível atualizar o item');
      }
    } catch (error) {
      console.error('Error updating item:', error);
      Alert.alert('Erro', 'Não foi possível atualizar o item');
    }
  };

  const deleteItem = (id: string) => {
    Alert.alert(
      'Excluir Item',
      'Tem certeza que deseja excluir este item?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const itemId = parseInt(id);
              const success = await listaComprasService.delete(itemId);
              if (success) {
                setItems(items.filter((i) => i.id !== id));
              } else {
                Alert.alert('Erro', 'Não foi possível excluir o item');
              }
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Erro', 'Não foi possível excluir o item');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: ShoppingItem }) => (
    <BlurView intensity={20} style={styles.itemCard}>
      <TouchableOpacity
        style={styles.itemContent}
        onPress={() => toggleComplete(item.id)}
      >
        <View style={styles.checkboxContainer}>
          <View style={[styles.checkbox, item.completed && styles.checkboxChecked]}>
            {item.completed && (
              <HugeIcon name="checkmark" size={16} color={Colors.textInverse} />
            )}
          </View>
        </View>
        <View style={styles.itemTextContainer}>
          <Text
            style={[
              styles.itemTitle,
              item.completed && styles.itemTitleCompleted,
            ]}
          >
            {item.item}
          </Text>
          {item.categoria && (
            <View style={styles.categoryBadgeContainer}>
              <Text style={styles.categoryBadgeText}>{item.categoria}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
      <View style={styles.actionButtons}>
        <TouchableOpacity
          onPress={() => openEditModal(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.editButton}
        >
          <HugeIcon name="pencil-outline" size={20} color={Colors.ionBlue} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => deleteItem(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.deleteButton}
        >
          <HugeIcon name="trash-outline" size={20} color={Colors.error} />
        </TouchableOpacity>
      </View>
    </BlurView>
  );

  // Ordem inteligente de supermercado (categorias organizadas por proximidade)
  const getCategoryOrder = (category: string | undefined): number => {
    if (!category) return 999;
    
    const categoryLower = category.toLowerCase();
    
    // Ordem típica de um supermercado
    if (categoryLower.includes('hortifruti') || categoryLower.includes('fruta') || categoryLower.includes('verdura') || categoryLower.includes('legume')) return 1;
    if (categoryLower.includes('açougue') || categoryLower.includes('carne') || categoryLower.includes('frango') || categoryLower.includes('peixe')) return 2;
    if (categoryLower.includes('laticínio') || categoryLower.includes('leite') || categoryLower.includes('queijo') || categoryLower.includes('iogurte')) return 3;
    if (categoryLower.includes('padaria') || categoryLower.includes('pão') || categoryLower.includes('bolo')) return 4;
    if (categoryLower === 'alimentos' || categoryLower.includes('arroz') || categoryLower.includes('feijão') || categoryLower.includes('macarrão') || categoryLower.includes('óleo')) return 5;
    if (categoryLower.includes('bebida') || categoryLower.includes('refrigerante') || categoryLower.includes('suco') || categoryLower.includes('água')) return 6;
    if (categoryLower === 'limpeza' || categoryLower.includes('detergente') || categoryLower.includes('sabão') || categoryLower.includes('desinfetante')) return 7;
    if (categoryLower === 'higiene' || categoryLower.includes('sabonete') || categoryLower.includes('shampoo') || categoryLower.includes('pasta')) return 8;
    return 9; // Outros
  };

  const reorganizeList = async () => {
    if (!user?.usuarioId) {
      Alert.alert('Erro', 'Usuário não autenticado');
      return;
    }

    if (items.length === 0) {
      Alert.alert('Info', 'Não há itens para reorganizar');
      return;
    }

    setIsReorganizing(true);

    try {
      // Separar itens completos e pendentes
      const pendingItems = items.filter(item => !item.completed);
      const completedItems = items.filter(item => item.completed);

      // Reorganizar itens pendentes
      const reorganizedPending = [...pendingItems].sort((a, b) => {
        const orderA = getCategoryOrder(a.categoria);
        const orderB = getCategoryOrder(b.categoria);
        
        // Primeiro por ordem de categoria
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        
        // Se mesma categoria, ordenar alfabeticamente
        return (a.item || '').localeCompare(b.item || '', 'pt-BR');
      });

      // Reorganizar itens completos (manter no final)
      const reorganizedCompleted = [...completedItems].sort((a, b) => {
        const orderA = getCategoryOrder(a.categoria);
        const orderB = getCategoryOrder(b.categoria);
        
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        
        return (a.item || '').localeCompare(b.item || '', 'pt-BR');
      });

      // Combinar: pendentes primeiro, depois completos
      const reorganizedItems = [...reorganizedPending, ...reorganizedCompleted];

      // Criar mapa de ordem para manter a organização
      const orderMap = new Map<string, number>();
      reorganizedItems.forEach((item, index) => {
        orderMap.set(item.id, index);
      });

      // Atualizar estados
      setReorganizedOrder(orderMap);
      setIsReorganized(true);
      
      Alert.alert(
        '✨ Lista Reorganizada!',
        'Sua lista foi reorganizada de forma inteligente, agrupando itens por proximidade no mercado.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error reorganizing list:', error);
      Alert.alert('Erro', 'Não foi possível reorganizar a lista');
    } finally {
      setIsReorganizing(false);
    }
  };

  const copyListToClipboard = () => {
    // Filtrar apenas itens pendentes (não comprados)
    const pendingItems = sortedItems.filter(item => !item.completed);

    if (pendingItems.length === 0) {
      Alert.alert('Info', 'Não há itens pendentes para copiar');
      return;
    }

    try {
      // Formatar lista de compras apenas com itens pendentes
      let listText = '🛒 *Lista de Compras';
      if (selectedSelecao) {
        listText += ` - ${selectedSelecao}`;
      }
      listText += '*\n\n';

      // Agrupar itens pendentes por categoria
      listText += '*📋 Itens para Comprar:*\n';
      
      // Agrupar por categoria
      const itemsByCategory = new Map<string, ShoppingItem[]>();
      pendingItems.forEach(item => {
        const category = item.categoria || 'Outros';
        if (!itemsByCategory.has(category)) {
          itemsByCategory.set(category, []);
        }
        itemsByCategory.get(category)!.push(item);
      });

      // Ordenar categorias pela ordem do supermercado
      const sortedCategories = Array.from(itemsByCategory.keys()).sort((a, b) => {
        return getCategoryOrder(a) - getCategoryOrder(b);
      });

      // Adicionar itens por categoria
      sortedCategories.forEach(category => {
        const categoryItems = itemsByCategory.get(category)!;
        listText += `\n*${category}:*\n`;
        categoryItems.forEach(item => {
          listText += `• ${item.item}\n`;
        });
      });

      // Copiar para o clipboard
      Clipboard.setString(listText);

      Alert.alert(
        '✅ Lista Copiada!',
        'A lista de compras foi copiada para a área de transferência. Você pode colar no WhatsApp agora!',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error copying list:', error);
      Alert.alert('Erro', 'Não foi possível copiar a lista');
    }
  };

  // Mostrar todos os itens (pendentes primeiro, depois comprados)
  // Se reorganizado, usar a ordem reorganizada; caso contrário, usar ordem padrão
  const sortedItems = [...items].sort((a, b) => {
    // Sempre manter completos no final
    if (a.completed && !b.completed) return 1;
    if (!a.completed && b.completed) return -1;
    
    // Se foi reorganizado, usar a ordem reorganizada
    if (isReorganized && reorganizedOrder.has(a.id) && reorganizedOrder.has(b.id)) {
      const orderA = reorganizedOrder.get(a.id) || 0;
      const orderB = reorganizedOrder.get(b.id) || 0;
      return orderA - orderB;
    }
    
    // Ordem padrão: por data de criação
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
      {/* Background blur elements */}
      <View style={styles.blurCircles}>
        <View style={[styles.blurCircle, styles.blurCircle1]} />
        <View style={[styles.blurCircle, styles.blurCircle2]} />
      </View>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerButton}>
            <HugeIcon name="cart" size={28} color={Colors.ionBlue} />
          </View>
          <Text style={styles.headerTitle}>Lista de Compras</Text>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setModalVisible(true)}
          >
            <HugeIcon name="add" size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Seletor de Lista */}
        <View style={styles.selecaoContainer}>
          <TouchableOpacity
            style={styles.selecaoButton}
            onPress={() => setSelecoesModalVisible(true)}
          >
            <HugeIcon name="list" size={20} color={Colors.ionBlue} />
            <Text style={styles.selecaoButtonText}>
              {selectedSelecao || 'Sem lista'}
            </Text>
            <HugeIcon name="chevron-down" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
          {items.length > 0 && (
            <>
              <TouchableOpacity
                style={styles.magicButton}
                onPress={reorganizeList}
                disabled={isReorganizing}
              >
                {isReorganizing ? (
                  <ActivityIndicator size="small" color={Colors.ionBlue} />
                ) : (
                  <HugeIcon name="sparkles" size={24} color={Colors.ionBlue} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={copyListToClipboard}
              >
                <HugeIcon name="copy-outline" size={24} color={Colors.ionBlue} />
              </TouchableOpacity>
            </>
          )}
        </View>

        <FlatList
          data={sortedItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <HugeIcon name="cart-outline" size={64} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>Nenhum item na lista</Text>
            </View>
          }
        />

        {/* Modal de adicionar item */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent
          onRequestClose={closeAddModal}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Novo Item</Text>
                    <TouchableOpacity onPress={closeAddModal}>
                      <HugeIcon name="close" size={28} color={Colors.textPrimary} />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.modalLabel}>Item *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Ex: Leite, Pão, Arroz"
                    placeholderTextColor={Colors.textSecondary}
                    value={newItem}
                    onChangeText={setNewItem}
                    onSubmitEditing={Keyboard.dismiss}
                    blurOnSubmit={true}
                  />

                  <Text style={styles.modalLabel}>Categoria *</Text>
                  <View style={styles.categorySelector}>
                    {(['Alimentos', 'Limpeza', 'Higiene', 'Outros'] as ShoppingCategory[]).map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.categoryButton,
                          newCategory === cat && styles.categoryButtonActive,
                        ]}
                        onPress={() => {
                          Keyboard.dismiss();
                          setNewCategory(cat);
                          if (cat === 'Outros') {
                            setShowCustomCategoryInput(true);
                          } else {
                            setShowCustomCategoryInput(false);
                            setCustomCategory('');
                          }
                        }}
                      >
                        <HugeIcon
                          name={getCategoryIcon(cat)}
                          size={18}
                          color={newCategory === cat ? Colors.textInverse : Colors.textPrimary}
                          style={styles.categoryIcon}
                        />
                        <Text
                          style={[
                            styles.categoryButtonText,
                            newCategory === cat && styles.categoryButtonTextActive,
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {showCustomCategoryInput && (
                    <View style={styles.customCategoryContainer}>
                      {customCategories.length > 0 && (
                        <View style={styles.customCategoriesList}>
                          <Text style={styles.customCategoriesLabel}>Categorias criadas:</Text>
                          <View style={styles.customCategoriesButtons}>
                            {customCategories.map((cat) => (
                              <TouchableOpacity
                                key={cat}
                                style={[
                                  styles.customCategoryButton,
                                  customCategory === cat && styles.customCategoryButtonActive,
                                ]}
                                onPress={() => {
                                  setCustomCategory(cat);
                                  Keyboard.dismiss();
                                }}
                              >
                                <HugeIcon
                                  name={getCategoryIcon(cat)}
                                  size={16}
                                  color={customCategory === cat ? Colors.textInverse : Colors.textPrimary}
                                  style={styles.categoryIcon}
                                />
                                <Text
                                  style={[
                                    styles.customCategoryButtonText,
                                    customCategory === cat && styles.customCategoryButtonTextActive,
                                  ]}
                                >
                                  {cat}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      )}
                      <Text style={styles.modalLabel}>Ou escreva uma nova categoria:</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Ex: Bebidas, Padaria, etc."
                        placeholderTextColor={Colors.textSecondary}
                        value={customCategory}
                        onChangeText={setCustomCategory}
                        onSubmitEditing={Keyboard.dismiss}
                        blurOnSubmit={true}
                      />
                    </View>
                  )}

                  <TouchableOpacity style={styles.modalButton} onPress={addItem}>
                    <Text style={styles.modalButtonText}>Adicionar</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Modal de edição */}
        <Modal
          visible={editModalVisible}
          animationType="slide"
          transparent
          onRequestClose={closeEditModal}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Editar Item</Text>
                    <TouchableOpacity onPress={closeEditModal}>
                      <HugeIcon name="close" size={28} color={Colors.textPrimary} />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.modalLabel}>Item *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Ex: Leite, Pão, Arroz"
                    placeholderTextColor={Colors.textSecondary}
                    value={newItem}
                    onChangeText={setNewItem}
                    onSubmitEditing={Keyboard.dismiss}
                    blurOnSubmit={true}
                  />

                  <Text style={styles.modalLabel}>Categoria *</Text>
                  <View style={styles.categorySelector}>
                    {(['Alimentos', 'Limpeza', 'Higiene', 'Outros'] as ShoppingCategory[]).map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.categoryButton,
                          newCategory === cat && styles.categoryButtonActive,
                        ]}
                        onPress={() => {
                          Keyboard.dismiss();
                          setNewCategory(cat);
                          if (cat === 'Outros') {
                            setShowCustomCategoryInput(true);
                          } else {
                            setShowCustomCategoryInput(false);
                            setCustomCategory('');
                          }
                        }}
                      >
                        <HugeIcon
                          name={getCategoryIcon(cat)}
                          size={18}
                          color={newCategory === cat ? Colors.textInverse : Colors.textPrimary}
                          style={styles.categoryIcon}
                        />
                        <Text
                          style={[
                            styles.categoryButtonText,
                            newCategory === cat && styles.categoryButtonTextActive,
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {showCustomCategoryInput && (
                    <View style={styles.customCategoryContainer}>
                      {customCategories.length > 0 && (
                        <View style={styles.customCategoriesList}>
                          <Text style={styles.customCategoriesLabel}>Categorias criadas:</Text>
                          <View style={styles.customCategoriesButtons}>
                            {customCategories.map((cat) => (
                              <TouchableOpacity
                                key={cat}
                                style={[
                                  styles.customCategoryButton,
                                  customCategory === cat && styles.customCategoryButtonActive,
                                ]}
                                onPress={() => {
                                  setCustomCategory(cat);
                                  Keyboard.dismiss();
                                }}
                              >
                                <HugeIcon
                                  name={getCategoryIcon(cat)}
                                  size={16}
                                  color={customCategory === cat ? Colors.textInverse : Colors.textPrimary}
                                  style={styles.categoryIcon}
                                />
                                <Text
                                  style={[
                                    styles.customCategoryButtonText,
                                    customCategory === cat && styles.customCategoryButtonTextActive,
                                  ]}
                                >
                                  {cat}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      )}
                      <Text style={styles.modalLabel}>Ou escreva uma nova categoria:</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Ex: Bebidas, Padaria, etc."
                        placeholderTextColor={Colors.textSecondary}
                        value={customCategory}
                        onChangeText={setCustomCategory}
                        onSubmitEditing={Keyboard.dismiss}
                        blurOnSubmit={true}
                      />
                    </View>
                  )}

                  <TouchableOpacity style={styles.modalButton} onPress={updateItem}>
                    <Text style={styles.modalButtonText}>Salvar Alterações</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Modal de Gerenciar Seleções */}
        <Modal
          visible={selecoesModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => {
            Keyboard.dismiss();
            setSelecoesModalVisible(false);
          }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Gerenciar Listas</Text>
                    <TouchableOpacity
                      onPress={() => {
                        Keyboard.dismiss();
                        setSelecoesModalVisible(false);
                      }}
                    >
                      <HugeIcon name="close" size={28} color={Colors.textPrimary} />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.modalLabel}>Selecionar Lista:</Text>
                  <View style={styles.selecoesList}>
                    <TouchableOpacity
                      style={[
                        styles.selecaoItem,
                        selectedSelecao === null && styles.selecaoItemActive,
                      ]}
                      onPress={() => {
                        setSelectedSelecao(null);
                        setSelecoesModalVisible(false);
                      }}
                    >
                      <HugeIcon
                        name="list-outline"
                        size={20}
                        color={selectedSelecao === null ? Colors.textInverse : Colors.textPrimary}
                      />
                      <Text
                        style={[
                          styles.selecaoItemText,
                          selectedSelecao === null && styles.selecaoItemTextActive,
                        ]}
                      >
                        Sem lista
                      </Text>
                      {selectedSelecao === null && (
                        <HugeIcon name="checkmark" size={20} color={Colors.textInverse} />
                      )}
                    </TouchableOpacity>

                    {selecoes.map((selecao) => (
                      <View key={selecao} style={styles.selecaoItemContainer}>
                        {editingSelecao === selecao ? (
                          <View style={styles.editSelecaoContainer}>
                            <TextInput
                              style={styles.editSelecaoInput}
                              value={editingSelecaoName}
                              onChangeText={setEditingSelecaoName}
                              placeholder="Nome da lista"
                              placeholderTextColor={Colors.textSecondary}
                              autoFocus
                            />
                            <TouchableOpacity
                              onPress={saveEditSelecao}
                              style={styles.saveEditButton}
                            >
                              <HugeIcon name="checkmark" size={20} color={Colors.textInverse} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={cancelEditSelecao}
                              style={styles.cancelEditButton}
                            >
                              <HugeIcon name="close" size={20} color={Colors.textPrimary} />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={[
                              styles.selecaoItem,
                              selectedSelecao === selecao && styles.selecaoItemActive,
                            ]}
                            onPress={() => {
                              setSelectedSelecao(selecao);
                              setSelecoesModalVisible(false);
                            }}
                          >
                            <HugeIcon
                              name="list"
                              size={20}
                              color={selectedSelecao === selecao ? Colors.textInverse : Colors.textPrimary}
                            />
                            <Text
                              style={[
                                styles.selecaoItemText,
                                selectedSelecao === selecao && styles.selecaoItemTextActive,
                              ]}
                            >
                              {selecao}
                            </Text>
                            <View style={styles.selecaoItemActions}>
                              {selectedSelecao === selecao && (
                                <HugeIcon name="checkmark" size={20} color={Colors.textInverse} />
                              )}
                              <TouchableOpacity
                                onPress={() => startEditSelecao(selecao)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                style={styles.editSelecaoButton}
                              >
                                <HugeIcon name="pencil-outline" size={18} color={Colors.ionBlue} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => deleteSelecao(selecao)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                style={styles.deleteSelecaoButton}
                              >
                                <HugeIcon name="trash-outline" size={18} color={Colors.error} />
                              </TouchableOpacity>
                            </View>
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>

                  <Text style={styles.modalLabel}>Criar Nova Lista:</Text>
                  <View style={styles.createSelecaoContainer}>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Ex: Casa, Restaurante, etc."
                      placeholderTextColor={Colors.textSecondary}
                      value={newSelecaoName}
                      onChangeText={setNewSelecaoName}
                      onSubmitEditing={createSelecao}
                      blurOnSubmit={true}
                    />
                    <TouchableOpacity
                      style={styles.createSelecaoButton}
                      onPress={createSelecao}
                    >
                      <HugeIcon name="add" size={24} color={Colors.textInverse} />
                    </TouchableOpacity>
                  </View>
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
    itemCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 16,
      marginBottom: 12,
      backgroundColor: Colors.glassBackground,
      borderWidth: 1,
      borderColor: Colors.glassBorder,
      overflow: 'hidden',
    },
    itemContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    checkboxContainer: {
      marginRight: 16,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: Colors.textSecondary,
      backgroundColor: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxChecked: {
      backgroundColor: Colors.ionBlue,
      borderColor: Colors.ionBlue,
    },
    itemTextContainer: {
      flex: 1,
    },
    itemTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.textPrimary,
      marginBottom: 4,
    },
    itemTitleCompleted: {
      textDecorationLine: 'line-through',
      opacity: 0.5,
    },
    categoryBadgeContainer: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: Colors.backgroundDarkTertiary,
      marginTop: 4,
    },
    categoryBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: Colors.ionBlue,
    },
    actionButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    editButton: {
      padding: 8,
    },
    deleteButton: {
      padding: 8,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 64,
    },
    emptyText: {
      fontSize: 16,
      color: Colors.textSecondary,
      marginTop: 16,
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
    categorySelector: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 16,
      justifyContent: 'center',
    },
    categoryButton: {
      flex: 1,
      minWidth: '45%',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: Colors.border,
      backgroundColor: Colors.backgroundDarkTertiary,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    categoryButtonActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    categoryIcon: {
      marginRight: 0,
    },
    categoryButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    categoryButtonTextActive: {
      color: Colors.textInverse,
    },
    customCategoryContainer: {
      marginTop: 8,
      marginBottom: 16,
    },
    customCategoriesList: {
      marginBottom: 16,
    },
    customCategoriesLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.textSecondary,
      marginBottom: 8,
    },
    customCategoriesButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    customCategoryButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.backgroundDarkTertiary,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    customCategoryButtonActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    customCategoryButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    customCategoryButtonTextActive: {
      color: Colors.textInverse,
    },
    selecaoContainer: {
      paddingHorizontal: 16,
      paddingBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    selecaoButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: Colors.backgroundDarkTertiary,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: Colors.border,
      gap: 8,
    },
    magicButton: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: Colors.backgroundDarkTertiary,
      borderWidth: 1,
      borderColor: Colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copyButton: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: Colors.backgroundDarkTertiary,
      borderWidth: 1,
      borderColor: Colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selecaoButtonText: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    selecoesList: {
      marginBottom: 16,
      gap: 8,
    },
    selecaoItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: Colors.backgroundDarkTertiary,
      borderWidth: 1,
      borderColor: Colors.border,
      gap: 12,
    },
    selecaoItemActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    selecaoItemText: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    selecaoItemTextActive: {
      color: Colors.textInverse,
    },
    selecaoItemActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    deleteSelecaoButton: {
      padding: 4,
    },
    createSelecaoContainer: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    createSelecaoButton: {
      backgroundColor: Colors.primary,
      borderRadius: 12,
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selecaoItemContainer: {
      marginBottom: 8,
    },
    editSelecaoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    editSelecaoInput: {
      flex: 1,
      backgroundColor: Colors.backgroundDarkTertiary,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      fontSize: 16,
      color: Colors.textPrimary,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    saveEditButton: {
      backgroundColor: Colors.primary,
      borderRadius: 12,
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelEditButton: {
      backgroundColor: Colors.backgroundDarkTertiary,
      borderRadius: 12,
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    editSelecaoButton: {
      padding: 4,
    },
  });
}

