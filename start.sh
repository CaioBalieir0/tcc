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
echo -e "${YELLOW}[1/3] Iniciando containers principais...${NC}"
docker-compose up -d

if [ $? -ne 0 ]; then
    echo -e "${RED}Erro ao iniciar containers principais${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Containers principais iniciados${NC}\n"

# 2. Iniciar cluster de 3 nodes (para comparação)
echo -e "${YELLOW}[2/3] Iniciando cluster de 3 nodes...${NC}"
docker-compose -f docker-compose-comparison.yml up -d

if [ $? -ne 0 ]; then
    echo -e "${RED}Erro ao iniciar cluster de 3 nodes${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Cluster de 3 nodes iniciado${NC}\n"

# 3. Aguardar containers ficarem prontos
echo -e "${YELLOW}[3/3] Aguardando containers ficarem prontos...${NC}"
sleep 5

# Verificar se containers principais estão rodando
echo -e "${YELLOW}Verificando containers principais...${NC}"
if docker ps --filter "name=tcc_postgres" --filter "name=tcc_mongo" --filter "name=tcc_redis" --filter "name=tcc_cockroach" --format "{{.Names}}" | grep -q .; then
    echo -e "${GREEN}✓ Containers principais estão rodando${NC}"
else
    echo -e "${RED}⚠ Aviso: Alguns containers principais podem não estar rodando${NC}"
fi

# Verificar se cluster está rodando
echo -e "${YELLOW}Verificando cluster de 3 nodes...${NC}"
if docker ps --filter "name=tcc_cockroach_cluster" --format "{{.Names}}" | grep -q .; then
    echo -e "${GREEN}✓ Cluster de 3 nodes está rodando${NC}"
else
    echo -e "${RED}⚠ Aviso: Cluster pode não estar rodando${NC}"
fi

# 4. Inicializar cluster (se necessário)
echo -e "\n${YELLOW}Verificando se cluster precisa ser inicializado...${NC}"
if docker exec tcc_cockroach_cluster_node1 cockroach sql --insecure --execute="SHOW DATABASES;" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Cluster já está inicializado${NC}"
else
    echo -e "${YELLOW}Inicializando cluster...${NC}"
    sleep 3
    if docker exec tcc_cockroach_cluster_node1 cockroach init --insecure --host=cockroach-cluster-node1 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Cluster inicializado com sucesso${NC}"
    else
        # Pode já estar inicializado, ignorar erro
        echo -e "${YELLOW}⚠ Cluster pode já estar inicializado${NC}"
    fi
fi

# 5. Verificar se node_modules existe
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

# 6. Iniciar servidor Node.js
echo -e "\n${GREEN}=== Iniciando Servidor Node.js ===${NC}"
echo -e "${YELLOW}Servidor será iniciado em: http://localhost:3000${NC}\n"
echo -e "${YELLOW}Páginas disponíveis:${NC}"
echo -e "  - Benchmark Principal: http://localhost:3000"
echo -e "  - Comparação 1 vs 3 Nodes: http://localhost:3000/comparison.html"
echo -e "  - Teste de Caos: http://localhost:3000/chaos.html"
echo -e "\n${YELLOW}Pressione Ctrl+C para parar o servidor${NC}\n"

# Iniciar servidor
node server.js

