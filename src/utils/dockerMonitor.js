const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Mapeamento dos nomes dos containers para os nomes dos bancos
const containerMap = {
  'tcc_postgres': 'postgresql',
  'tcc_mongo': 'mongodb',
  'tcc_redis': 'redis',
  'tcc_cockroach': 'cockroachdb'
};

// Função para parsear uma linha de stats do Docker
const parseDockerStatsLine = (line) => {
  const parts = line.split('|');
  if (parts.length < 4) return null;
  
  const [name, cpuPerc, memUsage, memPerc] = parts;
  const dbName = containerMap[name?.trim()];
  
  if (!dbName) return null;
  
  // Remover % do CPU e converter para número
  const cpu = parseFloat(cpuPerc?.replace('%', '') || '0') || 0;
  
  // Parse da memória (ex: "123.45MiB / 512MiB")
  const memParts = memUsage?.split(' / ') || ['0B', '0B'];
  const used = memParts[0]?.trim() || '0B';
  const total = memParts[1]?.trim() || '0B';
  const memPercValue = parseFloat(memPerc?.replace('%', '') || '0') || 0;
  
  // Converter memória usada para bytes para comparação
  const usedBytes = parseMemoryToBytes(used);
  
  return {
    dbName,
    cpu,
    memory: {
      used,
      total,
      percentage: memPercValue,
      usedBytes // Para comparação
    }
  };
};

// Função para converter memória (ex: "123.45MiB") para bytes
const parseMemoryToBytes = (memStr) => {
  if (!memStr || memStr === '0B') return 0;
  
  const match = memStr.match(/^([\d.]+)([KMGT]?i?B)$/);
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  
  const multipliers = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024,
    'KIB': 1024,
    'MIB': 1024 * 1024,
    'GIB': 1024 * 1024 * 1024,
    'TIB': 1024 * 1024 * 1024 * 1024
  };
  
  return value * (multipliers[unit] || 1);
};

// Função para obter uma snapshot de stats
const getStatsSnapshot = async (containerName) => {
  try {
    const { stdout } = await execAsync(
      `docker stats --no-stream --format "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}" ${containerName}`
    );
    
    const lines = stdout.trim().split('\n').filter(line => line.trim());
    const stats = {};
    
    lines.forEach(line => {
      const parsed = parseDockerStatsLine(line);
      if (parsed) {
        stats[parsed.dbName] = {
          cpu: parsed.cpu,
          memory: {
            used: parsed.memory.used,
            total: parsed.memory.total,
            percentage: parsed.memory.percentage,
            usedBytes: parsed.memory.usedBytes
          }
        };
      }
    });
    
    return stats;
  } catch (error) {
    console.error(`Erro ao obter stats para ${containerName}:`, error);
    return null;
  }
};

// Função para monitorar stats durante uma operação e capturar picos
const monitorStatsDuringOperation = async (containerName, operationFn) => {
  const monitoringInterval = 100; // Verificar a cada 100ms
  let maxStats = null;
  let monitoring = true;
  
  // Inicializar maxStats com valores padrão
  const initialStats = await getStatsSnapshot(containerName);
  if (initialStats) {
    const dbName = containerMap[containerName];
    if (dbName && initialStats[dbName]) {
      maxStats = {
        cpu: initialStats[dbName].cpu,
        memory: {
          used: initialStats[dbName].memory.used,
          total: initialStats[dbName].memory.total,
          percentage: initialStats[dbName].memory.percentage,
          usedBytes: initialStats[dbName].memory.usedBytes
        }
      };
    }
  }
  
  // Se não conseguiu obter stats iniciais, criar estrutura vazia
  if (!maxStats) {
    maxStats = {
      cpu: 0,
      memory: {
        used: '0B',
        total: '0B',
        percentage: 0,
        usedBytes: 0
      }
    };
  }
  
  // Iniciar monitoramento em paralelo
  const monitorPromise = (async () => {
    while (monitoring) {
      try {
        const stats = await getStatsSnapshot(containerName);
        if (stats) {
          const dbName = containerMap[containerName];
          if (dbName && stats[dbName]) {
            const current = stats[dbName];
            
            // Atualizar pico de CPU
            if (current.cpu > maxStats.cpu) {
              maxStats.cpu = current.cpu;
            }
            
            // Atualizar pico de memória
            if (current.memory.usedBytes > maxStats.memory.usedBytes) {
              maxStats.memory.used = current.memory.used;
              maxStats.memory.total = current.memory.total;
              maxStats.memory.percentage = current.memory.percentage;
              maxStats.memory.usedBytes = current.memory.usedBytes;
            }
          }
        }
      } catch (error) {
        // Ignorar erros durante monitoramento
        console.error('Erro durante monitoramento:', error);
      }
      await new Promise(resolve => setTimeout(resolve, monitoringInterval));
    }
  })();
  
  // Executar a operação
  let operationResult;
  try {
    operationResult = await operationFn();
  } catch (error) {
    monitoring = false;
    throw error;
  }
  
  // Parar monitoramento
  monitoring = false;
  await new Promise(resolve => setTimeout(resolve, monitoringInterval * 2)); // Aguardar última leitura
  
  // Aguardar que o monitoramento termine
  await monitorPromise.catch(() => {}); // Ignorar erros do monitoramento
  
  // Formatar resultado final
  // Se operationResult já tem time, manter; senão, assumir que é o próprio resultado
  const time = operationResult?.time || operationResult;
  
  return {
    time: time,
    stats: {
      cpu: maxStats.cpu.toFixed(2),
      memory: {
        used: maxStats.memory.used,
        total: maxStats.memory.total,
        percentage: maxStats.memory.percentage.toFixed(2)
      }
    }
  };
};

module.exports = {
  monitorStatsDuringOperation,
  getStatsSnapshot,
  containerMap
};

