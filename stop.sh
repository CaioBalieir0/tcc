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

# 1. Parar cluster de 3 nodes
echo -e "${YELLOW}[1/2] Parando cluster de 3 nodes...${NC}"
docker-compose -f docker-compose-comparison.yml down

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Cluster de 3 nodes parado${NC}\n"
else
    echo -e "${RED}⚠ Erro ao parar cluster (pode não estar rodando)${NC}\n"
fi

# 2. Parar containers principais
echo -e "${YELLOW}[2/2] Parando containers principais...${NC}"
docker-compose down

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Containers principais parados${NC}\n"
else
    echo -e "${RED}⚠ Erro ao parar containers (pode não estar rodando)${NC}\n"
fi

echo -e "${GREEN}=== Projeto TCC parado com sucesso ===${NC}"

