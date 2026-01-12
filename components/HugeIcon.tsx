import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Chat01Icon,
  ShoppingCart01Icon,
  Wallet01Icon,
  Calendar01Icon,
  Money01Icon,
  UserIcon,
  CheckmarkCircle01Icon,
  AddCircleIcon,
  CameraMicrophone01Icon,
  StopCircleIcon,
  ArrowUp01Icon,
  Remove01Icon,
  RemoveCircleIcon,
  Camera01Icon,
  Image01Icon,
  File01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowDown01Icon,
  CheckmarkBadge01Icon,
  Search01Icon,
  Delete01Icon,
  Chart01Icon,
  Award01Icon,
  SaveMoneyDollarIcon,
  BulbIcon,
  ArrowDataTransferVerticalIcon,
  Download01Icon,
  Upload01Icon,
  Wallet02Icon,
  Mail01Icon,
  LockIcon,
  SmartPhone01Icon,
  Edit01Icon,
  Settings01Icon,
  Add01Icon,
  Notification01Icon,
  Moon01Icon,
  Logout01Icon,
  Mic01Icon,
  SentIcon,
} from '@hugeicons/core-free-icons';

interface HugeIconProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: any;
}

// Mapeamento de nomes de ícones do Ionicons para os componentes do Hugeicons (gratuitos)
const iconMap: { [key: string]: any } = {
  'chatbubbles': Chat01Icon,
  'cart': ShoppingCart01Icon,
  'wallet': Wallet01Icon,
  'calendar': Calendar01Icon,
  'cash': Money01Icon,
  'person': UserIcon,
  'checkmark-circle': CheckmarkCircle01Icon,
  'add-circle': AddCircleIcon,
  'mic': Mic01Icon,
  'stop-circle': StopCircleIcon,
  'arrow-up': ArrowUp01Icon,
  'close': Remove01Icon,
  'close-circle': RemoveCircleIcon,
  'camera': Camera01Icon,
  'images': Image01Icon,
  'document': File01Icon,
  'chevron-back': ArrowLeft01Icon,
  'chevron-forward': ArrowRight01Icon,
  'chevron-up': ArrowUp01Icon,
  'chevron-down': ArrowDown01Icon,
  'checkmark': CheckmarkBadge01Icon,
  'search': Search01Icon,
  'trash-outline': Delete01Icon,
  'arrow-down': ArrowDown01Icon,
  'arrow-down-circle': ArrowDown01Icon, // Fallback - usando ArrowDown
  'arrow-up-circle': ArrowUp01Icon, // Fallback - usando ArrowUp
  'trending-up': ArrowUp01Icon, // Fallback - usando ArrowUp
  'trending-down': ArrowDown01Icon, // Fallback - usando ArrowDown
  'stats-chart': Chart01Icon,
  'podium': Award01Icon,
  'save': SaveMoneyDollarIcon,
  'bulb': BulbIcon,
  'swap-vertical': ArrowDataTransferVerticalIcon,
  'cloud-download': Download01Icon,
  'cloud-upload': Upload01Icon,
  'wallet-outline': Wallet02Icon,
  'person-outline': UserIcon,
  'mail-outline': Mail01Icon,
  'lock-closed-outline': LockIcon,
  'call-outline': SmartPhone01Icon,
  'pencil-outline': Edit01Icon,
  'settings-outline': Settings01Icon,
  'add': Add01Icon,
  'arrow-back': ArrowLeft01Icon,
  'notifications-outline': Notification01Icon,
  'moon': Moon01Icon,
  'moon-outline': Moon01Icon,
  'shield-checkmark-outline': LockIcon, // Usando LockIcon como fallback
  'help-circle-outline': BulbIcon, // Usando BulbIcon como fallback
  'document-text-outline': File01Icon,
  'log-out-outline': Logout01Icon,
  'sparkles': ArrowDataTransferVerticalIcon, // Ícone de reorganizar - usando ArrowDataTransferVertical
  'copy-outline': File01Icon, // Ícone de copiar - usando File
  'copy': File01Icon, // Ícone de copiar - usando File
  'list': ShoppingCart01Icon, // Ícone de lista - usando ShoppingCart
  'list-outline': ShoppingCart01Icon, // Ícone de lista - usando ShoppingCart
  'send': SentIcon,
};

// Componente que renderiza ícones do Hugeicons usando o pacote oficial gratuito
// Documentação: https://hugeicons.com/docs/integrations/react-native/quick-start
export function HugeIcon({ name, size = 24, color = '#000000', strokeWidth = 1.5, style }: HugeIconProps) {
  const IconComponent = iconMap[name];

  if (!IconComponent) {
    // Fallback: retornar null ou um placeholder
    console.warn(`Icon "${name}" not found in HugeIcon map`);
    return null;
  }

  return (
    <HugeiconsIcon
      icon={IconComponent}
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      style={style}
    />
  );
}

// Exportar também como default
export default HugeIcon;
