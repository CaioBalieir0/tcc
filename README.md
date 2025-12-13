# Benchmark de Bancos de Dados - TCC

Este projeto é um sistema completo para benchmarking de desempenho de diferentes tipos de bancos de dados, desenvolvido como Trabalho de Conclusão de Curso (TCC). O sistema compara o desempenho de bancos relacionais (SQL), NoSQL (documento), In-Memory e NewSQL através de operações de inserção e seleção de dados.

## 🎯 Objetivo

Analisar e comparar o desempenho de diferentes paradigmas de bancos de dados em cenários reais de aplicação, medindo métricas como latência, throughput (TPS - Transações por Segundo) e consumo de recursos durante operações de CRUD básicas.

## 🗄️ Bancos de Dados Testados

### SQL Relacional

- **PostgreSQL**: Padrão de mercado, ACID, schema rígido
- **CockroachDB**: NewSQL com escalabilidade distribuída, compatível com PostgreSQL

### NoSQL

- **MongoDB**: Banco de documentos, schema flexível, alta velocidade de escrita
- **Redis**: Banco chave-valor In-Memory, latência extremamente baixa

## 🏗️ Arquitetura do Projeto

### Estrutura de Pastas

```
tcc-projeto/
├── .gitignore                    # Arquivos ignorados pelo Git
├── docker-compose.yml           # Configuração dos containers Docker
├── package.json                 # Dependências Node.js
├── server.js                    # Servidor Express principal
├── results.json                 # Resultados dos benchmarks (gerado automaticamente)
├── README.md                    # Este arquivo
│
├── public/                      # Interface Web
│   ├── index.html              # Página principal com dashboard
│   └── chartRenderer.js        # Renderização de gráficos com Chart.js
│
└── src/                        # Código fonte principal
    ├── benchmark.js            # Orquestrador principal dos benchmarks
    │
    ├── benchmarks/             # Scripts específicos das operações
    │   ├── insertBenchmarks.js # Benchmarks de inserção
    │   └── selectBenchmarks.js # Benchmarks de seleção
    │
    ├── config/                 # Configuração dos conectores
    │   └── dbConnectors.js     # Conexões com os bancos de dados
    │
    ├── data/                   # Geração de dados de teste
    │   └── dataGenerator.js    # Gera dados simulados de logs
    │
    ├── setup/                  # Configuração inicial dos bancos
    │   └── setupDatabases.js   # Cria tabelas/coleções nos bancos
    │
    └── utils/                  # Utilitários auxiliares
        └── dockerMonitor.js    # Monitoramento de recursos Docker
```

### Componentes Principais

#### Backend (Node.js + Express)

- **server.js**: Servidor web que serve a interface e executa benchmarks via API REST
- **benchmark.js**: Coordena a execução sequencial dos testes para todos os bancos
- **Docker Compose**: Gerencia os containers dos bancos de dados com limite de recursos

#### Frontend (HTML + Chart.js)

- **Interface responsiva**: Dashboard com visualização em tempo real dos resultados
- **Gráficos interativos**: Comparação visual de latência e throughput
- **Monitoramento ao vivo**: Estatísticas de CPU e memória dos containers

#### Dados de Teste

- **Geração sintética**: Dados de log simulados (timestamps, mensagens, níveis)
- **Volumes controlados**: Testes com 10 e 100 registros para análise de escalabilidade
- **IDs únicos**: UUID v4 para garantir unicidade nos testes

## 🚀 Como Executar

### Pré-requisitos

- Docker e Docker Compose instalados
- Node.js (versão 16 ou superior)
- Navegador web moderno

### Método Rápido (Recomendado)

Use o script de inicialização que faz tudo automaticamente:

```bash
./start.sh
```

Este script irá:
1. Iniciar todos os containers Docker
2. Verificar se estão rodando corretamente
3. Instalar dependências Node.js se necessário
4. Iniciar o servidor web

**Para parar o projeto:**
```bash
./stop.sh
```

### Método Manual

1. **Clone o repositório e navegue até a pasta:**

   ```bash
   cd tcc-projeto
   ```

2. **Instale as dependências:**

   ```bash
   npm install
   ```

3. **Inicie os bancos de dados:**

   ```bash
   docker-compose up -d
   ```

   Este comando inicia os containers:

   - PostgreSQL (porta 5432)
   - MongoDB (porta 27017)
   - Redis (porta 6379)
   - CockroachDB (porta 26257, dashboard em 8080)

4. **Execute o servidor:**

   ```bash
   node server.js
   ```

5. **Acesse a interface web:**

   - Abra http://localhost:3000 no navegador
   - A interface mostrará estatísticas dos containers em tempo real

6. **Execute o benchmark:**
   - Clique no botão "Executar Benchmark" na interface
   - Aguarde a conclusão dos testes (pode levar alguns minutos)
   - Visualize os resultados nos gráficos gerados

## 📊 Resultados e Métricas

### Métricas Coletadas

- **Latência**: Tempo médio por operação (ms)
- **Throughput**: Transações por segundo (TPS)
- **Recursos**: CPU e memória utilizados pelos containers durante os testes

### Estrutura dos Resultados

Os resultados são salvos em `results.json` com a seguinte estrutura:

```json
{
  "10": {
    "postgresql": {
      "insert": { "time": 125.45, "stats": {...} },
      "select": { "time": 15.23, "stats": {...} }
    },
    "mongodb": {
      "insert": { "time": 89.12, "stats": {...} },
      "select": { "time": 12.34, "stats": {...} }
    }
    // ... outros bancos
  },
  "100": {
    // ... mesmo para 100 registros
  }
}
```

## 🔧 Configurações Técnicas

### Limites de Recursos

Todos os containers são configurados com:

- **CPU**: 1 core
- **Memória**: 512MB

### Volumes de Teste

- **10 registros**: Teste de baixa carga
- **100 registros**: Teste de carga moderada

### Operações Testadas

- **INSERT**: Inserção em lote dos registros gerados
- **SELECT**: Consulta por ID único (simulando acesso por chave primária)

## 📈 Interpretação dos Resultados

### Quando usar cada tipo de banco:

- **PostgreSQL/CockroachDB**: Para aplicações que precisam de ACID, joins complexos e consistência forte
- **MongoDB**: Para dados não estruturados, desenvolvimento ágil e escalabilidade horizontal
- **Redis**: Para cache, sessões, contadores e dados efêmeros com acesso ultra-rápido

### Considerações de Performance:

- Bancos In-Memory (Redis) geralmente têm menor latência
- Bancos relacionais oferecem melhor consistência
- NewSQL (CockroachDB) tenta equilibrar ambos os mundos

## 🛠️ Desenvolvimento

### Scripts Disponíveis

```bash
npm test  # Executa testes (não implementado)
node server.js  # Inicia o servidor
```

### Estrutura de Dados

Os dados de teste simulam logs de aplicação com campos:

- `id`: UUID único
- `timestamp`: Data/hora do log
- `level`: Nível (INFO, ERROR, WARN)
- `message`: Mensagem do log
- `source`: Origem do log

## 📝 Notas Técnicas

- O projeto utiliza drivers oficiais para cada banco de dados
- Monitoramento de recursos via Docker Stats API
- Interface web responsiva com Tailwind CSS
- Gráficos interativos com Chart.js
- Salvamento incremental dos resultados durante a execução

## 🤝 Contribuição

Este é um projeto acadêmico desenvolvido para fins educacionais. Para sugestões ou melhorias, considere os seguintes aspectos:

- Adição de mais tipos de operações (UPDATE, DELETE)
- Suporte a mais bancos de dados
- Métricas adicionais de performance
- Interface mais avançada para análise de resultados

---

**Desenvolvido como Trabalho de Conclusão de Curso** 📚
