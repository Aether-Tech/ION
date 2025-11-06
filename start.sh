#!/bin/bash

# Script wrapper para iniciar o Expo com limites aumentados
# Uso: ./start.sh [--local]

# Aumenta o limite de arquivos abertos
ulimit -n 10240

# Verifica se o limite foi aplicado
CURRENT_LIMIT=$(ulimit -n)
echo "Limite de arquivos abertos: $CURRENT_LIMIT"

# Inicia o Expo
if [ "$1" == "--local" ]; then
  echo "Iniciando em modo local..."
  exec expo start
else
  echo "Iniciando em modo tunnel..."
  exec expo start --tunnel
fi

