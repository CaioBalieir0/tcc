const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const { runBenchmark } = require('./src/benchmark');

const execAsync = promisify(exec);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsing JSON
app.use(express.json());

// Servir arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Rota para o arquivo results.json (na raiz do projeto)
app.get('/results.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'results.json'));
});

// Função para obter estatísticas dos containers Docker
const getDockerStats = async () => {
  try {
    // Mapeamento dos nomes dos containers para os nomes dos bancos
    const containerMap = {
      'tcc_postgres': 'postgresql',
      'tcc_mongo': 'mongodb',
      'tcc_redis': 'redis',
      'tcc_cockroach': 'cockroachdb'
    };

    // Executar docker stats --no-stream para obter uma captura única
    // Filtrar apenas os containers do TCC
    const containerNames = Object.keys(containerMap).join(' ');
    const { stdout } = await execAsync(
      `docker stats --no-stream --format "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}" ${containerNames}`
    );

    // Inicializar com valores padrão para todos os bancos
    const stats = {
      postgresql: { cpu: '0.00', memory: { used: '0B', total: '0B', percentage: '0.00' } },
      mongodb: { cpu: '0.00', memory: { used: '0B', total: '0B', percentage: '0.00' } },
      redis: { cpu: '0.00', memory: { used: '0B', total: '0B', percentage: '0.00' } },
      cockroachdb: { cpu: '0.00', memory: { used: '0B', total: '0B', percentage: '0.00' } }
    };

    const lines = stdout.trim().split('\n').filter(line => line.trim());

    lines.forEach(line => {
      const parts = line.split('|');
      if (parts.length >= 4) {
        const [name, cpuPerc, memUsage, memPerc] = parts;
        const dbName = containerMap[name?.trim()];
        
        if (dbName) {
          // Remover % do CPU e converter para número
          const cpu = parseFloat(cpuPerc?.replace('%', '') || '0') || 0;
          
          // Parse da memória (ex: "123.45MiB / 512MiB")
          const memParts = memUsage?.split(' / ') || ['0B', '0B'];
          const used = memParts[0]?.trim() || '0B';
          const total = memParts[1]?.trim() || '0B';
          const memPercValue = parseFloat(memPerc?.replace('%', '') || '0') || 0;
          
          stats[dbName] = {
            cpu: cpu.toFixed(2),
            memory: {
              used: used,
              total: total,
              percentage: memPercValue.toFixed(2)
            }
          };
        }
      }
    });

    return stats;
  } catch (error) {
    console.error('Erro ao obter estatísticas do Docker:', error);
    // Retornar dados vazios em caso de erro
    return {
      postgresql: { cpu: '0.00', memory: { used: '0B', total: '0B', percentage: '0.00' } },
      mongodb: { cpu: '0.00', memory: { used: '0B', total: '0B', percentage: '0.00' } },
      redis: { cpu: '0.00', memory: { used: '0B', total: '0B', percentage: '0.00' } },
      cockroachdb: { cpu: '0.00', memory: { used: '0B', total: '0B', percentage: '0.00' } }
    };
  }
};

// Rota para obter estatísticas dos containers
app.get('/api/docker-stats', async (req, res) => {
  try {
    const stats = await getDockerStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erro ao obter estatísticas do Docker' 
    });
  }
});

// Rota para executar o benchmark
app.post('/api/run-benchmark', async (req, res) => {
  try {
    console.log('Iniciando benchmark...');
    console.log(`[DEBUG] process.cwd(): ${process.cwd()}`);
    console.log(`[DEBUG] __dirname: ${__dirname}`);
    
    // Responder imediatamente e executar benchmark em background
    res.json({ success: true, message: 'Benchmark iniciado' });
    
    // Executar benchmark em background
    runBenchmark()
      .then(() => {
        console.log('Benchmark concluído com sucesso!');
      })
      .catch((error) => {
        console.error('Erro ao executar benchmark:', error);
        console.error('Stack:', error.stack);
      });
  } catch (error) {
    console.error('Erro ao iniciar benchmark:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erro desconhecido ao iniciar benchmark' 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
