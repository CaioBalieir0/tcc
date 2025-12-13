#!/bin/bash

# Script para parar o projeto TCC
# Para todos os containers Docker

set -e  # Parar em caso de erro

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Parando Projeto TCC ===${NC}\n"

# Parar containers principais
echo -e "${YELLOW}Parando containers principais...${NC}"
docker-compose down

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Containers principais parados${NC}\n"
else
    echo -e "${RED}⚠ Erro ao parar containers (pode não estar rodando)${NC}\n"
fi

echo -e "${GREEN}=== Projeto TCC parado com sucesso ===${NC}"

