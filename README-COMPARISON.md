# Benchmark de Comparação - CockroachDB 1 Node vs 3 Nodes

Este documento explica como usar o benchmark de comparação entre CockroachDB single-node e cluster de 3 nodes.

## Configuração

### 1. Iniciar os bancos de dados principais

```bash
docker-compose up -d
```

Isso iniciará:
- PostgreSQL
- MongoDB
- Redis
- CockroachDB (single-node)

### 2. Iniciar o cluster de 3 nodes (para comparação)

```bash
docker-compose -f docker-compose-comparison.yml up -d
```

Isso iniciará:
- CockroachDB Cluster Node 1 (porta 26258)
- CockroachDB Cluster Node 2 (porta 26259)
- CockroachDB Cluster Node 3 (porta 26260)

**Nota sobre avisos:**
- O aviso sobre "orphan containers" é normal quando você usa dois docker-compose separados. Pode ser ignorado.
- O código tenta inicializar o cluster automaticamente na primeira execução do benchmark. Se você ver o erro "ERROR: cluster has already been initialized", significa que o cluster já foi inicializado anteriormente e está tudo certo.

### 3. Inicializar o cluster manualmente (opcional)

Se precisar inicializar manualmente na primeira vez:

```bash
docker exec tcc_cockroach_cluster_node1 cockroach init --insecure --host=cockroach-cluster-node1
```

Se o cluster já estiver inicializado, você verá o erro "ERROR: cluster has already been initialized" - isso é normal e esperado.

## Parar os serviços

### Parar bancos principais
```bash
docker-compose down
```

### Parar cluster de comparação
```bash
docker-compose -f docker-compose-comparison.yml down
```

## Acessar a interface

- **Benchmark Principal**: http://localhost:3000
- **Comparação 1 vs 3 Nodes**: http://localhost:3000/comparison.html

## Dashboards CockroachDB

- **Single Node**: http://localhost:8080
- **Cluster Node 1**: http://localhost:8081
- **Cluster Node 2**: http://localhost:8082
- **Cluster Node 3**: http://localhost:8083

