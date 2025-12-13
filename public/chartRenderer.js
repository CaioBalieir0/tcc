// Cores laranja/preto para os gráficos
const chartColors = {
  postgresql: {
    bg: 'rgba(255, 140, 0, 0.7)', // Laranja escuro
    border: 'rgba(255, 140, 0, 1)',
  },
  cockroachdb: {
    bg: 'rgba(255, 165, 0, 0.7)', // Laranja médio
    border: 'rgba(255, 165, 0, 1)',
  },
  mongodb: {
    bg: 'rgba(255, 200, 0, 0.7)', // Laranja claro
    border: 'rgba(255, 200, 0, 1)',
  },
  redis: {
    bg: 'rgba(255, 100, 0, 0.7)', // Laranja vibrante
    border: 'rgba(255, 100, 0, 1)',
  },
};

// Plugin customizado para mostrar valores no topo das barras
const barValuePlugin = {
  id: 'barValuePlugin',
  afterDraw: (chart) => {
    const ctx = chart.ctx;
    ctx.save();

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);

      meta.data.forEach((bar, index) => {
        const value = dataset.data[index];
        if (value !== null && value !== undefined && !isNaN(value)) {
          const x = bar.x;
          const y = bar.y;

          ctx.fillStyle = '#ff8c00';
          ctx.font = 'bold 12px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';

          // Determinar unidade baseado no título do gráfico
          const title = chart.options.plugins?.title?.text || '';
          const datasetLabel = dataset.label || '';
          let formattedValue;

          if (
            datasetLabel.includes('TPS') ||
            title.includes('TPS') ||
            title.includes('Throughput')
          ) {
            // Formatar TPS
            const tpsValue = parseFloat(value);
            if (tpsValue >= 1000) {
              formattedValue = (tpsValue / 1000).toFixed(2) + 'K TPS';
            } else {
              formattedValue = tpsValue.toFixed(2) + ' TPS';
            }
          } else {
            // Formatar latência em segundos (converter de ms para s)
            const seconds = parseFloat(value) / 1000;
            formattedValue = seconds.toFixed(2) + ' s';
          }

          // Desenhar o valor no topo da barra (5px acima)
          ctx.fillText(formattedValue, x, y - 5);
        }
      });
    });

    ctx.restore();
  },
};

// Registrar o plugin globalmente
Chart.register(barValuePlugin);

// Função para criar card de estatísticas de um banco (para gráficos)
const createStatsCard = (dbName, stats, operationType) => {
  const dbDisplayName = dbName.toUpperCase();
  const operationLabel = operationType === 'insert' ? 'Inserção' : 'Seleção';

  const hasStats = stats && stats.cpu !== undefined;
  const cpu = hasStats ? stats.cpu : 'N/A';
  const memUsed = hasStats ? stats.memory?.used || '0B' : 'N/A';
  const memTotal = hasStats ? stats.memory?.total || '0B' : 'N/A';
  const memPerc = hasStats ? stats.memory?.percentage || '0.00' : 'N/A';

  const card = document.createElement('div');
  card.className = 'bg-black/70 p-4 rounded-lg border border-orange-500/20';
  card.innerHTML = `
    <h4 class="text-orange-400 font-bold text-sm mb-2">${dbDisplayName}</h4>
    <p class="text-orange-500/70 text-xs mb-2">${operationLabel} - Pico Máximo</p>
    <div class="space-y-1 text-xs">
      <div class="flex justify-between items-center">
        <span class="text-gray-400">CPU:</span>
        <span class="text-orange-500 font-semibold">${cpu}${
    hasStats ? '%' : ''
  }</span>
      </div>
      <div class="flex justify-between items-center">
        <span class="text-gray-400">RAM:</span>
        <span class="text-orange-500 font-semibold">${
          hasStats ? `${memUsed} / ${memTotal} (${memPerc}%)` : memUsed
        }</span>
      </div>
    </div>
  `;
  return card;
};

// Função para criar seção de estatísticas por volume e operação
const createStatsSection = (volume, databases, results, operationType) => {
  const section = document.createElement('div');
  section.className = 'mt-4 pt-4 border-t border-orange-500/20';

  const operationLabel = operationType === 'insert' ? 'Inserção' : 'Seleção';
  const title = document.createElement('h3');
  title.className = 'text-orange-500 font-semibold text-sm mb-3';
  title.textContent = `Recursos do Sistema (${operationLabel}) - ${volume.toLocaleString()} registros`;
  section.appendChild(title);

  const statsGrid = document.createElement('div');
  statsGrid.className = 'grid grid-cols-2 md:grid-cols-4 gap-3';

  databases.forEach((dbName) => {
    const dbData = results[dbName];
    const operationData = dbData?.[operationType];

    // Só mostrar se a operação foi executada
    if (operationData && operationData !== null) {
      const stats = operationData?.stats || null;
      const statsCard = createStatsCard(dbName, stats, operationType);
      statsGrid.appendChild(statsCard);
    }
  });

  // Só adicionar seção se houver cards
  if (statsGrid.children.length > 0) {
    section.appendChild(statsGrid);
    return section;
  }

  // Retornar null se não houver dados
  return null;
};

// Variável para armazenar os charts e permitir atualização
let chartInstances = {};

// Função para calcular TPS (Transactions Per Second)
const calculateTPS = (volume, timeInMs) => {
  if (!timeInMs || timeInMs === 0) return 0;
  const timeInSeconds = timeInMs / 1000;
  return volume / timeInSeconds;
};

// Função para criar um gráfico de latência
const createLatencyChart = (
  canvasId,
  labels,
  data,
  volume,
  colors,
  operationType
) => {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  // Destruir chart anterior se existir
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }

  const operationLabel = operationType === 'insert' ? 'Inserção' : 'Seleção';

  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: `Latência (ms) - ${volume.toLocaleString()} registros`,
          data: data,
          backgroundColor: colors.map((c) => c.bg),
          borderColor: colors.map((c) => c.border),
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false,
        },
        title: {
          display: true,
          text: `${volume.toLocaleString()} Registros - ${operationLabel}`,
          color: '#ff8c00',
          font: {
            size: 14,
            weight: 'bold',
          },
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#ff8c00',
          bodyColor: '#ffffff',
          borderColor: '#ff8c00',
          borderWidth: 1,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: '#ff8c00',
          },
          grid: {
            color: 'rgba(255, 140, 0, 0.1)',
          },
          title: {
            display: true,
            text: 'Tempo (ms)',
            color: '#ff8c00',
            font: {
              size: 12,
              weight: 'bold',
            },
          },
        },
        x: {
          ticks: {
            color: '#ff8c00',
          },
          grid: {
            color: 'rgba(255, 140, 0, 0.1)',
          },
        },
      },
    },
  });
};

// Função para criar um gráfico de TPS
const createTPSChart = (
  canvasId,
  labels,
  data,
  volume,
  colors,
  operationType
) => {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  // Destruir chart anterior se existir
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }

  const operationLabel = operationType === 'insert' ? 'Inserção' : 'Seleção';

  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: `TPS - ${volume.toLocaleString()} registros`,
          data: data,
          backgroundColor: colors.map((c) => c.bg),
          borderColor: colors.map((c) => c.border),
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false,
        },
        title: {
          display: true,
          text: `${volume.toLocaleString()} Registros - ${operationLabel}`,
          color: '#ff8c00',
          font: {
            size: 14,
            weight: 'bold',
          },
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#ff8c00',
          bodyColor: '#ffffff',
          borderColor: '#ff8c00',
          borderWidth: 1,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: '#ff8c00',
          },
          grid: {
            color: 'rgba(255, 140, 0, 0.1)',
          },
          title: {
            display: true,
            text: 'TPS (Transações/seg)',
            color: '#ff8c00',
            font: {
              size: 12,
              weight: 'bold',
            },
          },
        },
        x: {
          ticks: {
            color: '#ff8c00',
          },
          grid: {
            color: 'rgba(255, 140, 0, 0.1)',
          },
        },
      },
    },
  });
};

const loadAndRenderCharts = async () => {
  try {
    const response = await fetch('/results.json?t=' + Date.now()); // Cache busting
    if (!response.ok) {
      throw new Error('Arquivo results.json não encontrado');
    }
    const results = await response.json();

    const insertLatencyDiv = document.getElementById('insertLatencyCharts');
    const insertTPSDiv = document.getElementById('insertTPSCharts');
    const selectLatencyDiv = document.getElementById('selectLatencyCharts');
    const selectTPSDiv = document.getElementById('selectTPSCharts');
    const noDataMessage = document.getElementById('noDataMessage');

    // Limpar apenas se não houver dados
    if (Object.keys(results).length === 0) {
      insertLatencyDiv.innerHTML = '';
      insertTPSDiv.innerHTML = '';
      selectLatencyDiv.innerHTML = '';
      selectTPSDiv.innerHTML = '';
      noDataMessage.classList.remove('hidden');
      return;
    }

    noDataMessage.classList.add('hidden');

    // Renderizar seção de hardware
    renderHardwareSection(results);

    // Ordenar volumes para garantir ordem consistente
    const volumes = Object.keys(results).sort(
      (a, b) => parseInt(a) - parseInt(b)
    );

    for (const volume of volumes) {
      const data = results[volume];
      const volumeNum = parseInt(volume);

      // Preparar dados para inserção - Latência
      const insertLatencyData = Object.keys(data)
        .map((db) => {
          const insertResult = data[db]?.insert;
          if (!insertResult || insertResult === null) return null;
          return insertResult?.time || insertResult || 0;
        })
        .filter((val) => val !== null);

      const insertLatencyLabels = Object.keys(data)
        .filter((db) => {
          const insertResult = data[db]?.insert;
          return insertResult && insertResult !== null;
        })
        .map((db) => db.toUpperCase());

      // Preparar dados para inserção - TPS (manter mesma ordem dos labels de latência)
      const insertTPSPairs = Object.keys(data)
        .map((db) => {
          const insertResult = data[db]?.insert;
          if (!insertResult || insertResult === null) return null;
          const time = insertResult?.time || insertResult || 0;
          const tps = calculateTPS(volumeNum, time);
          return { db, tps, time };
        })
        .filter((item) => item !== null && item.tps > 0);

      const insertTPSData = insertTPSPairs.map((item) => item.tps);
      const insertTPSLabels = insertTPSPairs.map((item) =>
        item.db.toUpperCase()
      );
      const insertTPSColors = insertTPSPairs.map((item) => ({
        bg: chartColors[item.db]?.bg || 'rgba(255, 140, 0, 0.7)',
        border: chartColors[item.db]?.border || 'rgba(255, 140, 0, 1)',
      }));

      const insertColors = Object.keys(data)
        .filter((db) => {
          const insertResult = data[db]?.insert;
          return insertResult && insertResult !== null;
        })
        .map((db) => ({
          bg: chartColors[db]?.bg || 'rgba(255, 140, 0, 0.7)',
          border: chartColors[db]?.border || 'rgba(255, 140, 0, 1)',
        }));

      // Preparar dados para seleção - Latência
      const selectLatencyData = Object.keys(data)
        .map((db) => {
          const selectResult = data[db]?.select;
          if (!selectResult || selectResult === null) return null;
          return selectResult?.time || selectResult || 0;
        })
        .filter((val) => val !== null);

      const selectLatencyLabels = Object.keys(data)
        .filter((db) => {
          const selectResult = data[db]?.select;
          return selectResult && selectResult !== null;
        })
        .map((db) => db.toUpperCase());

      // Preparar dados para seleção - TPS (manter mesma ordem dos labels de latência)
      const selectTPSPairs = Object.keys(data)
        .map((db) => {
          const selectResult = data[db]?.select;
          if (!selectResult || selectResult === null) return null;
          const time = selectResult?.time || selectResult || 0;
          const tps = calculateTPS(volumeNum, time);
          return { db, tps, time };
        })
        .filter((item) => item !== null && item.tps > 0);

      const selectTPSData = selectTPSPairs.map((item) => item.tps);
      const selectTPSLabels = selectTPSPairs.map((item) =>
        item.db.toUpperCase()
      );
      const selectTPSColors = selectTPSPairs.map((item) => ({
        bg: chartColors[item.db]?.bg || 'rgba(255, 140, 0, 0.7)',
        border: chartColors[item.db]?.border || 'rgba(255, 140, 0, 1)',
      }));

      const selectColors = Object.keys(data)
        .filter((db) => {
          const selectResult = data[db]?.select;
          return selectResult && selectResult !== null;
        })
        .map((db) => ({
          bg: chartColors[db]?.bg || 'rgba(255, 140, 0, 0.7)',
          border: chartColors[db]?.border || 'rgba(255, 140, 0, 1)',
        }));

      // Criar container para gráfico de latência de inserção
      let insertLatencyContainer = document.getElementById(
        `insertLatencyContainer-${volume}`
      );
      if (!insertLatencyContainer) {
        insertLatencyContainer = document.createElement('div');
        insertLatencyContainer.id = `insertLatencyContainer-${volume}`;
        insertLatencyContainer.className =
          'bg-black/50 p-6 rounded-lg border border-orange-500/30 shadow-lg';
        insertLatencyDiv.appendChild(insertLatencyContainer);
      } else {
        insertLatencyContainer.innerHTML = '';
      }

      const insertLatencyCanvas = document.createElement('canvas');
      insertLatencyCanvas.id = `insertLatencyChart-${volume}`;
      insertLatencyContainer.appendChild(insertLatencyCanvas);

      // Criar gráfico de latência de inserção
      if (insertLatencyData.length > 0) {
        chartInstances[`insertLatencyChart-${volume}`] = createLatencyChart(
          `insertLatencyChart-${volume}`,
          insertLatencyLabels,
          insertLatencyData,
          volumeNum,
          insertColors,
          'insert'
        );
      }

      // Criar container para gráfico de TPS de inserção
      let insertTPSContainer = document.getElementById(
        `insertTPSContainer-${volume}`
      );
      if (!insertTPSContainer) {
        insertTPSContainer = document.createElement('div');
        insertTPSContainer.id = `insertTPSContainer-${volume}`;
        insertTPSContainer.className =
          'bg-black/50 p-6 rounded-lg border border-orange-500/30 shadow-lg';
        insertTPSDiv.appendChild(insertTPSContainer);
      } else {
        insertTPSContainer.innerHTML = '';
      }

      const insertTPSCanvas = document.createElement('canvas');
      insertTPSCanvas.id = `insertTPSChart-${volume}`;
      insertTPSContainer.appendChild(insertTPSCanvas);

      // Criar gráfico de TPS de inserção
      if (insertTPSData.length > 0) {
        chartInstances[`insertTPSChart-${volume}`] = createTPSChart(
          `insertTPSChart-${volume}`,
          insertTPSLabels,
          insertTPSData,
          volumeNum,
          insertTPSColors,
          'insert'
        );
      }

      // Criar container para gráfico de latência de seleção
      let selectLatencyContainer = document.getElementById(
        `selectLatencyContainer-${volume}`
      );
      if (!selectLatencyContainer) {
        selectLatencyContainer = document.createElement('div');
        selectLatencyContainer.id = `selectLatencyContainer-${volume}`;
        selectLatencyContainer.className =
          'bg-black/50 p-6 rounded-lg border border-orange-500/30 shadow-lg';
        selectLatencyDiv.appendChild(selectLatencyContainer);
      } else {
        selectLatencyContainer.innerHTML = '';
      }

      const selectLatencyCanvas = document.createElement('canvas');
      selectLatencyCanvas.id = `selectLatencyChart-${volume}`;
      selectLatencyContainer.appendChild(selectLatencyCanvas);

      // Criar gráfico de latência de seleção
      if (selectLatencyData.length > 0) {
        chartInstances[`selectLatencyChart-${volume}`] = createLatencyChart(
          `selectLatencyChart-${volume}`,
          selectLatencyLabels,
          selectLatencyData,
          volumeNum,
          selectColors,
          'select'
        );
      }

      // Criar container para gráfico de TPS de seleção
      let selectTPSContainer = document.getElementById(
        `selectTPSContainer-${volume}`
      );
      if (!selectTPSContainer) {
        selectTPSContainer = document.createElement('div');
        selectTPSContainer.id = `selectTPSContainer-${volume}`;
        selectTPSContainer.className =
          'bg-black/50 p-6 rounded-lg border border-orange-500/30 shadow-lg';
        selectTPSDiv.appendChild(selectTPSContainer);
      } else {
        selectTPSContainer.innerHTML = '';
      }

      const selectTPSCanvas = document.createElement('canvas');
      selectTPSCanvas.id = `selectTPSChart-${volume}`;
      selectTPSContainer.appendChild(selectTPSCanvas);

      // Criar gráfico de TPS de seleção
      if (selectTPSData.length > 0) {
        chartInstances[`selectTPSChart-${volume}`] = createTPSChart(
          `selectTPSChart-${volume}`,
          selectTPSLabels,
          selectTPSData,
          volumeNum,
          selectTPSColors,
          'select'
        );
      }
    }
  } catch (error) {
    console.error('Erro ao carregar ou renderizar os gráficos:', error);
    const insertLatencyDiv = document.getElementById('insertLatencyCharts');
    const insertTPSDiv = document.getElementById('insertTPSCharts');
    const selectLatencyDiv = document.getElementById('selectLatencyCharts');
    const selectTPSDiv = document.getElementById('selectTPSCharts');
    const noDataMessage = document.getElementById('noDataMessage');

    if (insertLatencyDiv) insertLatencyDiv.innerHTML = '';
    if (insertTPSDiv) insertTPSDiv.innerHTML = '';
    if (selectLatencyDiv) selectLatencyDiv.innerHTML = '';
    if (selectTPSDiv) selectTPSDiv.innerHTML = '';
    noDataMessage.classList.remove('hidden');
    noDataMessage.innerHTML = `
      <p class="text-orange-400 text-lg mb-2">⚠️ Erro ao carregar resultados</p>
      <p class="text-gray-500 text-sm">${error.message}</p>
      <p class="text-gray-500 text-sm mt-2">Clique em "Executar Benchmark" para gerar os resultados.</p>
    `;
  }
};

// Variável para controlar o polling
let pollingInterval = null;
let isBenchmarkRunning = false;
let lastUpdateTime = 0;

// Função para iniciar polling durante o benchmark
const startPolling = () => {
  if (pollingInterval) return; // Já está fazendo polling

  console.log('Iniciando polling...');
  pollingInterval = setInterval(() => {
    loadAndRenderCharts();
    checkBenchmarkStatus();
  }, 1000); // Atualizar a cada 1 segundo
};

// Função para parar polling
const stopPolling = () => {
  if (pollingInterval) {
    console.log('Parando polling...');
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  // Fazer uma última atualização após um pequeno delay
  setTimeout(() => {
    loadAndRenderCharts();
  }, 1000);
};

// Função para verificar se o benchmark ainda está rodando
const checkBenchmarkStatus = async () => {
  if (!isBenchmarkRunning) return; // Só verificar se o benchmark está rodando

  try {
    // Verificar se o arquivo results.json foi modificado recentemente
    const response = await fetch('/results.json?t=' + Date.now());
    if (response.ok) {
      const results = await response.json();
      // Se ainda houver valores null, o benchmark ainda está rodando
      let hasNullValues = false;
      for (const volume in results) {
        for (const db in results[volume]) {
          const dbData = results[volume][db];
          if (dbData && (dbData.insert === null || dbData.select === null)) {
            hasNullValues = true;
            break;
          }
        }
        if (hasNullValues) break;
      }

      // Se não há mais valores null e o benchmark estava rodando, parar polling
      if (!hasNullValues) {
        console.log('Benchmark concluído - parando polling em 3 segundos...');
        setTimeout(() => {
          stopPolling();
          isBenchmarkRunning = false;
          const btn = document.getElementById('runBenchmarkBtn');
          const btnText = document.getElementById('btnText');
          const btnLoader = document.getElementById('btnLoader');
          if (btn) {
            btn.disabled = false;
            btnText.classList.remove('hidden');
            btnLoader.classList.add('hidden');
          }
        }, 3000); // Aguardar 3 segundos para garantir que tudo foi salvo
      }
    }
  } catch (error) {
    // Ignorar erros silenciosamente durante a verificação
  }
};

// Função para executar o benchmark
const runBenchmark = async () => {
  const btn = document.getElementById('runBenchmarkBtn');
  const btnText = document.getElementById('btnText');
  const btnLoader = document.getElementById('btnLoader');

  if (isBenchmarkRunning) return;

  btn.disabled = true;
  btnText.classList.add('hidden');
  btnLoader.classList.remove('hidden');
  isBenchmarkRunning = true;

  // Limpar gráficos anteriores
  const insertLatencyDiv = document.getElementById('insertLatencyCharts');
  const insertTPSDiv = document.getElementById('insertTPSCharts');
  const selectLatencyDiv = document.getElementById('selectLatencyCharts');
  const selectTPSDiv = document.getElementById('selectTPSCharts');

  if (insertLatencyDiv) insertLatencyDiv.innerHTML = '';
  if (insertTPSDiv) insertTPSDiv.innerHTML = '';
  if (selectLatencyDiv) selectLatencyDiv.innerHTML = '';
  if (selectTPSDiv) selectTPSDiv.innerHTML = '';
  chartInstances = {};

  // Iniciar polling
  startPolling();

  try {
    const response = await fetch('/api/run-benchmark', {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Erro ao executar benchmark');
    }

    const result = await response.json();

    if (result.success) {
      // Não parar polling imediatamente - deixar checkBenchmarkStatus decidir
      // O polling continuará até que não haja mais valores null
      btn.disabled = false;
      btnText.classList.remove('hidden');
      btnLoader.classList.add('hidden');
      // isBenchmarkRunning será setado para false pelo checkBenchmarkStatus
    } else {
      throw new Error(result.error || 'Erro desconhecido');
    }
  } catch (error) {
    console.error('Erro ao executar benchmark:', error);
    stopPolling();
    alert('Erro ao executar benchmark: ' + error.message);
    btn.disabled = false;
    btnText.classList.remove('hidden');
    btnLoader.classList.add('hidden');
    isBenchmarkRunning = false;
  }
};

// Função para criar card de hardware de um banco
const createHardwareCard = (dbName, insertStats, selectStats) => {
  const dbDisplayName = dbName.toUpperCase();
  const dbFullNames = {
    POSTGRESQL: 'PostgreSQL',
    MONGODB: 'MongoDB',
    COCKROACHDB: 'CockroachDB',
    REDIS: 'Redis',
  };
  const fullName = dbFullNames[dbDisplayName] || dbDisplayName;

  const hasInsertStats = insertStats && insertStats.cpu !== undefined;
  const hasSelectStats = selectStats && selectStats.cpu !== undefined;

  const card = document.createElement('div');
  card.className = 'bg-black/70 p-4 rounded-lg border border-orange-500/20';
  card.innerHTML = `
    <h4 class="text-orange-400 font-bold text-sm mb-3 text-center">${fullName}</h4>
    
    <!-- Inserção -->
    <div class="mb-3">
      <h5 class="text-orange-500/80 text-xs font-semibold mb-2">Inserção - Pico Máximo</h5>
      ${
        hasInsertStats
          ? `
        <div class="space-y-1 text-xs">
          <div class="flex justify-between items-center">
            <span class="text-gray-400">CPU:</span>
            <span class="text-orange-500 font-semibold">${
              insertStats.cpu
            }%</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-400">RAM:</span>
            <span class="text-orange-500 font-semibold">${
              insertStats.memory?.used || '0B'
            } / ${insertStats.memory?.total || '0B'}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-400">Uso:</span>
            <span class="text-orange-400 font-semibold">${
              insertStats.memory?.percentage || '0.00'
            }%</span>
          </div>
        </div>
      `
          : '<p class="text-gray-500 text-xs text-center">N/A</p>'
      }
    </div>
    
    <!-- Barra divisória -->
    <div class="border-t border-orange-500/30 my-3"></div>
    
    <!-- Seleção -->
    <div>
      <h5 class="text-orange-500/80 text-xs font-semibold mb-2">Seleção - Pico Máximo</h5>
      ${
        hasSelectStats
          ? `
        <div class="space-y-1 text-xs">
          <div class="flex justify-between items-center">
            <span class="text-gray-400">CPU:</span>
            <span class="text-orange-500 font-semibold">${
              selectStats.cpu
            }%</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-400">RAM:</span>
            <span class="text-orange-500 font-semibold">${
              selectStats.memory?.used || '0B'
            } / ${selectStats.memory?.total || '0B'}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-400">Uso:</span>
            <span class="text-orange-400 font-semibold">${
              selectStats.memory?.percentage || '0.00'
            }%</span>
          </div>
        </div>
      `
          : '<p class="text-gray-500 text-xs text-center">N/A</p>'
      }
    </div>
  `;
  return card;
};

// Função para renderizar seção de hardware
const renderHardwareSection = (results) => {
  const hardwareSection = document.getElementById('hardwareSection');
  if (!hardwareSection) return;

  hardwareSection.innerHTML = '';

  // Pegar o primeiro volume disponível para obter os bancos
  const volumes = Object.keys(results).sort(
    (a, b) => parseInt(a) - parseInt(b)
  );
  if (volumes.length === 0) {
    hardwareSection.innerHTML =
      '<p class="text-gray-400 text-center">Nenhum dado de hardware disponível ainda.</p>';
    return;
  }

  const firstVolume = volumes[0];
  const databases = Object.keys(results[firstVolume]);
  const dbOrder = ['postgresql', 'mongodb', 'cockroachdb', 'redis'];

  // Criar grid de cards
  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-2 md:grid-cols-4 gap-4';

  dbOrder.forEach((dbName) => {
    if (!databases.includes(dbName)) return;

    // Buscar pico máximo de insert e select de todos os volumes
    let maxInsertStats = null;
    let maxSelectStats = null;
    let maxInsertCpu = 0;
    let maxSelectCpu = 0;

    volumes.forEach((volume) => {
      const dbData = results[volume][dbName];

      // Verificar stats de insert - pegar o pico máximo de CPU
      if (dbData?.insert?.stats) {
        const insertStats = dbData.insert.stats;
        const cpu = parseFloat(insertStats.cpu) || 0;
        if (cpu > maxInsertCpu) {
          maxInsertCpu = cpu;
          maxInsertStats = insertStats;
        }
      }

      // Verificar stats de select - pegar o pico máximo de CPU
      if (dbData?.select?.stats) {
        const selectStats = dbData.select.stats;
        const cpu = parseFloat(selectStats.cpu) || 0;
        if (cpu > maxSelectCpu) {
          maxSelectCpu = cpu;
          maxSelectStats = selectStats;
        }
      }
    });

    const card = createHardwareCard(dbName, maxInsertStats, maxSelectStats);
    grid.appendChild(card);
  });

  hardwareSection.appendChild(grid);
};

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  // Carregar gráficos iniciais
  loadAndRenderCharts();

  // Adicionar listener ao botão
  const runBenchmarkBtn = document.getElementById('runBenchmarkBtn');
  if (runBenchmarkBtn) {
    runBenchmarkBtn.addEventListener('click', runBenchmark);
  }
});
