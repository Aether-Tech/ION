#!/bin/bash

# Script para aumentar o limite de arquivos abertos no macOS
# Execute este script antes de rodar npm start

echo "Aumentando limite de arquivos abertos..."
ulimit -n 10240

echo "Limite atual: $(ulimit -n)"
echo ""
echo "Recomendado: Instalar Watchman para melhor performance"
echo "Execute: brew install watchman"
echo ""
echo "Agora você pode rodar: npm start"

