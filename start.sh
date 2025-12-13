#!/bin/bash

# Script para iniciar o projeto TCC de uma vez
# Inicia todos os containers Docker e o servidor Node.js

set -e  # Parar em caso de erro

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Iniciando Projeto TCC ===${NC}\n"

# Verificar se Docker está rodando
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Erro: Docker não está rodando. Por favor, inicie o Docker primeiro.${NC}"
    exit 1
fi

# 1. Iniciar containers principais (PostgreSQL, MongoDB, Redis, CockroachDB Single Node)
echo -e "${YELLOW}[1/2] Iniciando containers principais...${NC}"
docker-compose up -d

if [ $? -ne 0 ]; then
    echo -e "${RED}Erro ao iniciar containers principais${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Containers principais iniciados${NC}\n"

# 2. Aguardar containers ficarem prontos
echo -e "${YELLOW}[2/2] Aguardando containers ficarem prontos...${NC}"
sleep 5

# Verificar se containers principais estão rodando
echo -e "${YELLOW}Verificando containers principais...${NC}"
if docker ps --filter "name=tcc_postgres" --filter "name=tcc_mongo" --filter "name=tcc_redis" --filter "name=tcc_cockroach" --format "{{.Names}}" | grep -q .; then
    echo -e "${GREEN}✓ Containers principais estão rodando${NC}"
else
    echo -e "${RED}⚠ Aviso: Alguns containers principais podem não estar rodando${NC}"
fi

# 3. Verificar se node_modules existe
echo -e "\n${YELLOW}Verificando dependências Node.js...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Instalando dependências...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}Erro ao instalar dependências${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Dependências instaladas${NC}"
else
    echo -e "${GREEN}✓ Dependências já instaladas${NC}"
fi

# 4. Iniciar servidor Node.js
echo -e "\n${GREEN}=== Iniciando Servidor Node.js ===${NC}"
echo -e "${YELLOW}Servidor será iniciado em: http://localhost:3000${NC}\n"
echo -e "${YELLOW}Páginas disponíveis:${NC}"
echo -e "  - Benchmark Principal: http://localhost:3000"
echo -e "  - Comparação 1 vs 3 Nodes: http://localhost:3000/comparison.html"
echo -e "\n${YELLOW}Pressione Ctrl+C para parar o servidor${NC}\n"

# Iniciar servidor
node server.js

