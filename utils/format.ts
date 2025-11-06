import { format as dateFormat } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';

/**
 * Formata um número como moeda brasileira
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formata uma data para exibição
 */
export function formatDate(date: Date | string, formatStr: string = "dd 'de' MMMM 'de' yyyy"): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateFormat(dateObj, formatStr, { locale: ptBR });
}

/**
 * Formata uma data e hora para exibição
 */
export function formatDateTime(date: Date | string): string {
  return formatDate(date, "dd 'de' MMMM 'às' HH:mm");
}

/**
 * Formata um número de telefone brasileiro
 */
export function formatPhoneNumber(phone: string): string {
  // Remove caracteres não numéricos
  const cleaned = phone.replace(/\D/g, '');
  
  // Formata: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  } else if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  
  return phone;
}

