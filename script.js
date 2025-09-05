document.addEventListener('DOMContentLoaded', () => {
    // Seletores de elementos
    const tableBody = document.getElementById('crypto-table-body');
    const loader = document.getElementById('loader');
    const athChartTitle = document.getElementById('ath-chart-title');
    const athChartCanvas = document.getElementById('athChart');
    const winnersLosersContainer = document.getElementById('winners-losers-container');
    const coinDetailsCard = document.getElementById('coin-details-card');

    // Variáveis de estado
    let activeCoinId = 'bitcoin';
    let athChart;
    let marketDataCache = [];

    // Constantes da API
    const API_BASE = 'https://api.coingecko.com/api/v3';
    const getMarketURL = (currency = 'brl') => `${API_BASE}/coins/markets?vs_currency=${currency}&order=market_cap_desc&per_page=50&page=1&sparkline=false`;

    // Funções de formatação
    const formatCurrency = (number, notation = 'standard') => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: notation, maximumFractionDigits: notation === 'compact' ? 2 : 2 }).format(number);
    const formatPercentage = (number) => `${number.toFixed(2)}%`;

    async function fetchData(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("Fetch error:", error);
            return null;
        }
    }

    // --- FUNÇÕES DE RENDERIZAÇÃO ---
    function renderTable(coins) {
        tableBody.innerHTML = '';
        coins.forEach(coin => {
            const row = document.createElement('tr');
            row.dataset.coinId = coin.id;
            if (coin.id === activeCoinId) row.classList.add('active');
            const changeClass = coin.price_change_percentage_24h >= 0 ? 'positive' : 'negative';
            row.innerHTML = `
                <td>${coin.market_cap_rank}</td>
                <td><div class="coin-info"><img src="${coin.image}" alt="${coin.name}"><div><span class="coin-name">${coin.name}</span><span class="coin-symbol">${coin.symbol}</span></div></div></td>
                <td>${formatCurrency(coin.current_price)}</td>
                <td class="${changeClass}">${formatPercentage(coin.price_change_percentage_24h)}</td>
                <td>${formatCurrency(coin.market_cap, 'compact')}</td>
            `;
            tableBody.appendChild(row);
        });
    }
    
    // ATUALIZADO: Lógica para gerar o novo visual da lista
    function renderWinnersLosersList(marketData) {
        const sortedData = [...marketData].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
        const winners = sortedData.slice(0, 3);
        const losers = sortedData.slice(-3).reverse();

        // Base para o cálculo da barra. Uma variação de 20% preenche 100% da barra.
        const MAX_CHANGE_FOR_BAR = 20.0;

        const createListHTML = (list, title) => {
            let itemsHTML = list.map(coin => {
                const isPositive = coin.price_change_percentage_24h >= 0;
                // Calcula a largura da barra, limitando a 100%
                const barWidth = Math.min(100, (Math.abs(coin.price_change_percentage_24h) / MAX_CHANGE_FOR_BAR) * 100);

                return `
                    <div class="wl-item">
                        <div class="wl-coin-info">
                            <img src="${coin.image}" alt="${coin.name}">
                            <span class="wl-coin-symbol">${coin.symbol.toUpperCase()}</span>
                        </div>
                        <div class="wl-change-info">
                            <div class="wl-bar-container">
                                <div class="wl-bar-fill ${isPositive ? 'positive' : 'negative'}" style="width: ${barWidth}%;"></div>
                            </div>
                            <span class="wl-percentage ${isPositive ? 'positive' : 'negative'}">
                                ${formatPercentage(coin.price_change_percentage_24h)}
                            </span>
                        </div>
                    </div>
                `;
            }).join('');

            return `<div class="wl-section"><h3 class="wl-title">${title}</h3>${itemsHTML}</div>`;
        };
        
        winnersLosersContainer.innerHTML = createListHTML(winners, 'Ganhadoras') + createListHTML(losers, 'Perdedoras');
    }

    function renderPriceVsAthChart(coin) {
        if (athChart) athChart.destroy();
        const { current_price, ath } = coin;
        if (!ath || ath <= 0) return; 

        athChart = new Chart(athChartCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Preço'],
                datasets: [
                    {
                        label: 'Preço Atual',
                        data: [current_price],
                        backgroundColor: 'rgba(52, 152, 219, 0.7)',
                        borderColor: 'rgba(52, 152, 219, 1)',
                        borderWidth: 1,
                    },
                    {
                        label: 'Distância para o Recorde',
                        data: [ath - current_price],
                        backgroundColor: 'rgba(238, 242, 246, 1)',
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                           label: function(context) {
                                if (context.dataset.label === 'Preço Atual') {
                                    const percentage = (current_price / ath * 100).toFixed(1);
                                    return `Atual: ${formatCurrency(current_price)} (${percentage}%)`;
                                }
                                return `Recorde: ${formatCurrency(ath)}`;
                           }
                        }
                    }
                },
                scales: {
                    y: { display: false, stacked: true },
                    x: { 
                        stacked: true,
                        max: ath,
                        ticks: {
                            callback: (value) => formatCurrency(value, 'compact')
                        }
                    }
                }
            }
        });
    }

    function renderCoinDetails(coin) {
        if (!coin) return;
        const changeClass = coin.price_change_percentage_24h >= 0 ? 'positive' : 'negative';
        coinDetailsCard.innerHTML = `
            <div class="details-card-header">
                <img src="${coin.image}" alt="${coin.name}">
                <span class="coin-name">${coin.name}</span>
            </div>
            <div class="details-grid">
                <div class="detail-item"><span class="detail-label">Preço Atual</span><span class="detail-value">${formatCurrency(coin.current_price)}</span></div>
                <div class="detail-item"><span class="detail-label">Variação 24h</span><span class="detail-value ${changeClass}">${formatPercentage(coin.price_change_percentage_24h)}</span></div>
                <div class="detail-item"><span class="detail-label">Máx. 24h</span><span class="detail-value">${formatCurrency(coin.high_24h)}</span></div>
                <div class="detail-item"><span class="detail-label">Mín. 24h</span><span class="detail-value">${formatCurrency(coin.low_24h)}</span></div>
                <div class="detail-item"><span class="detail-label">Volume 24h</span><span class="detail-value">${formatCurrency(coin.total_volume, 'compact')}</span></div>
                <div class="detail-item"><span class="detail-label">Cap. Mercado</span><span class="detail-value">${formatCurrency(coin.market_cap, 'compact')}</span></div>
            </div>
        `;
    }

    function updateDashboard(coinId) {
        activeCoinId = coinId;
        const coin = marketDataCache.find(c => c.id === coinId);
        if (coin) {
            renderCoinDetails(coin);
            athChartTitle.textContent = `Preço vs. Recorde: ${coin.name}`;
            renderPriceVsAthChart(coin);
        }
        document.querySelectorAll('#crypto-table-body tr').forEach(r => r.classList.toggle('active', r.dataset.coinId === coinId));
    }

    tableBody.addEventListener('click', (event) => {
        const row = event.target.closest('tr');
        if (row && row.dataset.coinId !== activeCoinId) {
            updateDashboard(row.dataset.coinId);
        }
    });

    async function init() {
        const marketData = await fetchData(getMarketURL());
        if (marketData) {
            marketDataCache = marketData;
            renderTable(marketData);
            renderWinnersLosersList(marketData);
            updateDashboard(activeCoinId);
        }
        loader.style.opacity = '0';
        setTimeout(() => { loader.style.display = 'none'; }, 500);
    }

    init();
});