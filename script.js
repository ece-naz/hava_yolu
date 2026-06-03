// Data Models
let passengers = [];
const PASSENGER_COUNT = 1000;

// States Constants
const SATISFIED = 'Satisfied';
const NEUTRAL = 'Neutral';
const DISSATISFIED = 'Dissatisfied';

// Sliders DOM
const modWifi = document.getElementById('mod-wifi');
const modSeat = document.getElementById('mod-seat');
const modFood = document.getElementById('mod-food');
const modEnt = document.getElementById('mod-ent');
const modBook = document.getElementById('mod-book');
const modClean = document.getElementById('mod-clean');
const modDelay = document.getElementById('mod-delay');
const sliders = [modWifi, modSeat, modFood, modEnt, modBook, modClean, modDelay];

// Tabs DOM
const tabManual = document.getElementById('tab-manual');
const tabPreset = document.getElementById('tab-preset');
const viewManual = document.getElementById('view-manual');
const viewPreset = document.getElementById('view-preset');

// Population Filter DOM
const genClass = document.getElementById('gen-class');
const genCustomer = document.getElementById('gen-customer');
const genTravel = document.getElementById('gen-travel');
const btnGenerate = document.getElementById('btn-generate');

// Charts instances
let donutChart, radarChart, transitionChart;

// Sidebar Tabs Logic
tabManual.addEventListener('click', () => {
    tabManual.classList.add('active');
    tabPreset.classList.remove('active');
    viewManual.classList.remove('hidden');
    viewPreset.classList.add('hidden');
});

tabPreset.addEventListener('click', () => {
    tabPreset.classList.add('active');
    tabManual.classList.remove('active');
    viewPreset.classList.remove('hidden');
    viewManual.classList.add('hidden');
});

// Canvas Setup
const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');
let cw, ch;
function resizeCanvas() {
    const parent = canvas.parentElement;
    cw = canvas.width = parent.clientWidth;
    const headerEl = parent.querySelector('.card-header');
    const headerHeight = headerEl ? headerEl.clientHeight : 70;
    ch = canvas.height = parent.clientHeight - headerHeight; 
    calculateZones();
}
window.addEventListener('resize', resizeCanvas);

let zones = {};
function calculateZones() {
    zones = {
        [DISSATISFIED]: { x: cw * 0.2, y: ch * 0.5, r: Math.min(cw*0.1, 80), color: '#ef4444' },
        [NEUTRAL]:      { x: cw * 0.5, y: ch * 0.5, r: Math.min(cw*0.1, 80), color: '#f59e0b' },
        [SATISFIED]:    { x: cw * 0.8, y: ch * 0.5, r: Math.min(cw*0.1, 80), color: '#10b981' }
    };
    particles.forEach(p => p.setTarget());
}

class Particle {
    constructor(passengerData) {
        this.data = passengerData;
        this.state = passengerData.currentState;
        this.speed = 0.04 + Math.random() * 0.04;
        this.radius = 2.5;

        this.setTarget();
        this.x = this.targetX;
        this.y = this.targetY;
    }

    setTarget() {
        if(!zones[this.state]) return;
        const zone = zones[this.state];
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * zone.r * Math.random(); 
        this.targetX = zone.x + Math.cos(angle) * radius;
        this.targetY = zone.y + Math.sin(angle) * radius;
    }

    updateState(newState) {
        if (this.state !== newState) {
            this.state = newState;
            this.setTarget();
        }
    }

    draw() {
        this.x += (this.targetX - this.x) * this.speed;
        this.y += (this.targetY - this.y) * this.speed;
        
        // Jitter
        this.x += (Math.random() - 0.5) * 0.6;
        this.y += (Math.random() - 0.5) * 0.6;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = zones[this.state].color;
        ctx.fill();
        ctx.closePath();
    }
}

let particles = [];

// New Scoring Calculation (Fair Formula based on weighted ratings out of 100)
function calculateScore(data, modifiers = { wifi:0, seat:0, food:0, ent:0, book:0, clean:0, delay:0 }) {
    // 1. Helper to clamp values 0-5
    const getRating = (base, mod) => Math.max(0, Math.min(5, base + mod));
    
    const fWifi = getRating(data.baseWifi, modifiers.wifi);
    const fSeat = getRating(data.baseSeat, modifiers.seat);
    const fFood = getRating(data.baseFood, modifiers.food);
    const fEnt = getRating(data.baseEnt, modifiers.ent);
    const fBook = getRating(data.baseBook, modifiers.book);
    const fClean = getRating(data.baseClean, modifiers.clean);

    // 2. Sum of ratings (Max 6 * 5 = 30)
    let sumRatings = fWifi + fSeat + fFood + fEnt + fBook + fClean;
    
    // Scale ratings to out of 100 Base Satisfaction (e.g., sum=30 -> 100%)
    let baseSat = (sumRatings / 30) * 100;
    
    // 3. Demographics Bonus
    if (data.class === 'Business') baseSat += 10;
    if (data.customerType === 'Loyal Customer') baseSat += 5;
    if (data.travelType === 'Business travel') baseSat += 5;
    
    // 4. Delay Penalty (Positive modifier means MORE delay)
    // Delay subtracts 1 point per 10 minutes.
    let finalDelay = Math.max(0, data.baseDelay + modifiers.delay); 
    if (finalDelay > 0) baseSat -= (finalDelay / 10);
    
    // 5. Fixed Noise for uniqueness
    baseSat += data.fixedNoise;
    
    // 6. Thresholds based on 100 scale
    // If baseSat > 60 -> Satisfied. (A person rating avg 3.5 = 70 baseSat)
    if (baseSat > 65) return SATISFIED;
    if (baseSat >= 45) return NEUTRAL;
    return DISSATISFIED;
}

// Generate Population Based on Filters
function generatePopulation() {
    const filterClass = genClass.value;
    const filterCustomer = genCustomer.value;
    const filterTravel = genTravel.value;
    
    const possibleClasses = ['Eco', 'Eco Plus', 'Business'];
    const possibleCustomers = ['Loyal Customer', 'disloyal Customer'];
    const possibleTravel = ['Personal Travel', 'Business travel'];
    
    passengers = [];
    particles = [];

    // Reset sliders when generating new population
    sliders.forEach(s => s.value = 0);
    updateSliderLabels({ wifi:0, seat:0, food:0, ent:0, book:0, clean:0, delay:0 });

    for (let i = 0; i < PASSENGER_COUNT; i++) {
        // Apply filters or pick random
        const pClass = filterClass === 'all' ? possibleClasses[Math.floor(Math.random() * possibleClasses.length)] : filterClass;
        const pCust = filterCustomer === 'all' ? possibleCustomers[Math.floor(Math.random() * possibleCustomers.length)] : filterCustomer;
        const pTravel = filterTravel === 'all' ? possibleTravel[Math.floor(Math.random() * possibleTravel.length)] : filterTravel;

        let p = {
            id: 'PAX-' + (1000 + i),
            class: pClass,
            customerType: pCust,
            travelType: pTravel,
            
            // Generate base ratings (Business gets slightly better base)
            baseWifi: Math.floor(Math.random() * 6),
            baseSeat: pClass === 'Business' ? Math.floor(Math.random() * 3) + 3 : Math.floor(Math.random() * 6),
            baseFood: Math.floor(Math.random() * 6),
            baseEnt: Math.floor(Math.random() * 6),
            baseBook: Math.floor(Math.random() * 6),
            baseClean: Math.floor(Math.random() * 6),
            
            baseDelay: Math.random() > 0.7 ? Math.floor(Math.random() * 120) + 10 : 0,
            fixedNoise: (Math.random() * 15) - 7.5 // -7.5 to +7.5 points swing
        };
        
        p.initialState = calculateScore(p);
        p.currentState = p.initialState;
        
        passengers.push(p);
        particles.push(new Particle(p));
    }

    updateSimulation();
}

btnGenerate.addEventListener('click', generatePopulation);

// Animation Loop
function animate() {
    ctx.fillStyle = 'rgba(11, 17, 33, 0.4)'; // Clear with trail
    ctx.fillRect(0, 0, cw, ch);
    
    if(zones[DISSATISFIED]) {
        ctx.font = "bold 16px Plus Jakarta Sans";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.fillText("Memnuniyetsiz", zones[DISSATISFIED].x, zones[DISSATISFIED].y - 95);
        ctx.fillText("Nötr", zones[NEUTRAL].x, zones[NEUTRAL].y - 95);
        ctx.fillText("Memnun", zones[SATISFIED].x, zones[SATISFIED].y - 95);
    }

    particles.forEach(p => p.draw());
    requestAnimationFrame(animate);
}

// Stats tracking
let transitionHistory = { neuToSat: 0, disToNeu: 0, disToSat: 0, satToNeu: 0, satToDis: 0, neuToDis: 0 };
let currentCounts = { [SATISFIED]:0, [NEUTRAL]:0, [DISSATISFIED]:0 };

function updateSliderLabels(mods) {
    const formatMod = (val) => val > 0 ? `+${val}` : val;
    document.getElementById('val-wifi').innerText = formatMod(mods.wifi);
    document.getElementById('val-seat').innerText = formatMod(mods.seat);
    document.getElementById('val-food').innerText = formatMod(mods.food);
    document.getElementById('val-ent').innerText = formatMod(mods.ent);
    document.getElementById('val-book').innerText = formatMod(mods.book);
    document.getElementById('val-clean').innerText = formatMod(mods.clean);
    document.getElementById('val-delay').innerText = mods.delay > 0 ? `+${mods.delay}` : mods.delay;
}

function updateSimulation() {
    const mods = {
        wifi: parseInt(modWifi.value),
        seat: parseInt(modSeat.value),
        food: parseInt(modFood.value),
        ent: parseInt(modEnt.value),
        book: parseInt(modBook.value),
        clean: parseInt(modClean.value),
        delay: parseInt(modDelay.value)
    };

    updateSliderLabels(mods);

    transitionHistory = { neuToSat:0, disToNeu:0, disToSat:0, satToNeu:0, satToDis:0, neuToDis:0 };
    currentCounts = { [SATISFIED]:0, [NEUTRAL]:0, [DISSATISFIED]:0 };
    
    let sums = { wifi:0, seat:0, food:0, ent:0, book:0, clean:0 };

    passengers.forEach((p, index) => {
        const oldState = p.initialState; 
        const newState = calculateScore(p, mods);
        
        sums.wifi += Math.max(0, Math.min(5, p.baseWifi + mods.wifi));
        sums.seat += Math.max(0, Math.min(5, p.baseSeat + mods.seat));
        sums.food += Math.max(0, Math.min(5, p.baseFood + mods.food));
        sums.ent += Math.max(0, Math.min(5, p.baseEnt + mods.ent));
        sums.book += Math.max(0, Math.min(5, p.baseBook + mods.book));
        sums.clean += Math.max(0, Math.min(5, p.baseClean + mods.clean));

        // Tally transitions relative to INITIAL state (state when population was generated)
        if (oldState === NEUTRAL && newState === SATISFIED) transitionHistory.neuToSat++;
        if (oldState === NEUTRAL && newState === DISSATISFIED) transitionHistory.neuToDis++;
        if (oldState === DISSATISFIED && newState === NEUTRAL) transitionHistory.disToNeu++;
        if (oldState === DISSATISFIED && newState === SATISFIED) transitionHistory.disToSat++;
        if (oldState === SATISFIED && newState === NEUTRAL) transitionHistory.satToNeu++;
        if (oldState === SATISFIED && newState === DISSATISFIED) transitionHistory.satToDis++;
        
        if (p.currentState !== newState) {
            p.currentState = newState;
            particles[index].updateState(newState);
        }
        currentCounts[newState]++;
    });

    const averages = [
        sums.wifi / PASSENGER_COUNT,
        sums.seat / PASSENGER_COUNT,
        sums.food / PASSENGER_COUNT,
        sums.ent / PASSENGER_COUNT,
        sums.book / PASSENGER_COUNT,
        sums.clean / PASSENGER_COUNT
    ];

    updateUIStats(currentCounts);
    updateCharts(currentCounts, averages);
    renderTable(mods);
}

function updateUIStats(counts) {
    document.getElementById('stat-sat').innerText = counts[SATISFIED];
    document.getElementById('stat-neu').innerText = counts[NEUTRAL];
    document.getElementById('stat-dis').innerText = counts[DISSATISFIED];

    const flowText = document.getElementById('flow-stats');
    let totalPositive = transitionHistory.neuToSat + transitionHistory.disToNeu + transitionHistory.disToSat;
    let totalNegative = transitionHistory.satToNeu + transitionHistory.neuToDis + transitionHistory.satToDis;

    if (totalPositive === 0 && totalNegative === 0) {
        flowText.innerHTML = `<p>Orijinal kitleye göre değişiklik yok.</p>`;
    } else {
        flowText.innerHTML = `
            <p><strong class="up">▲ Olumlu Yönde Geçiş:</strong> Toplam ${totalPositive} kişi</p>
            <p><strong class="down">▼ Olumsuz Yönde Geçiş:</strong> Toplam ${totalNegative} kişi</p>
        `;
    }
}

// Chart Initializations
function initCharts() {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = 'Plus Jakarta Sans';

    const ctxDonut = document.getElementById('donutChart').getContext('2d');
    donutChart = new Chart(ctxDonut, {
        type: 'doughnut',
        data: {
            labels: ['Memnun', 'Nötr', 'Memnuniyetsiz'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'right' } }
        }
    });

    const ctxRadar = document.getElementById('radarChart').getContext('2d');
    radarChart = new Chart(ctxRadar, {
        type: 'radar',
        data: {
            labels: ['Wi-Fi', 'Koltuk', 'Yemek', 'Eğlence', 'Rzv.', 'Temizlik'],
            datasets: [{
                label: 'Ortalama Kalite',
                data: [0, 0, 0, 0, 0, 0],
                backgroundColor: 'rgba(59, 130, 246, 0.3)',
                borderColor: '#3b82f6',
                pointBackgroundColor: '#3b82f6'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: 'rgba(255,255,255,0.1)' },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    pointLabels: { color: '#f8fafc', font: { size: 10 } },
                    min: 0, max: 5
                }
            },
            plugins: { legend: { display: false } }
        }
    });

    const ctxTrans = document.getElementById('transitionChart').getContext('2d');
    transitionChart = new Chart(ctxTrans, {
        type: 'bar',
        data: {
            labels: ['Nötr>Mem', 'Mem' + 'siz>Nötr', 'Mem>Nötr', 'Nötr>Mem' + 'siz'],
            datasets: [{
                label: 'Kişi Sayısı',
                data: [0, 0, 0, 0],
                backgroundColor: ['#10b981', '#10b981', '#ef4444', '#ef4444'],
                borderRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function updateCharts(counts, averages) {
    donutChart.data.datasets[0].data = [counts[SATISFIED], counts[NEUTRAL], counts[DISSATISFIED]];
    donutChart.update();

    radarChart.data.datasets[0].data = averages;
    radarChart.update();

    transitionChart.data.datasets[0].data = [
        transitionHistory.neuToSat,
        transitionHistory.disToNeu,
        transitionHistory.satToNeu,
        transitionHistory.neuToDis
    ];
    transitionChart.update();
}

// Render 50 Random Passengers Table
function renderTable(mods) {
    const tbody = document.querySelector('#dataTable tbody');
    tbody.innerHTML = '';
    const sample = passengers.slice(0, 50);

    sample.forEach(p => {
        const tr = document.createElement('tr');
        const finalWifi = Math.max(0, Math.min(5, p.baseWifi + mods.wifi));
        const finalFood = Math.max(0, Math.min(5, p.baseFood + mods.food));
        const finalSeat = Math.max(0, Math.min(5, p.baseSeat + mods.seat));
        const finalClean = Math.max(0, Math.min(5, p.baseClean + mods.clean));
        const finalDelay = Math.max(0, p.baseDelay + mods.delay);

        tr.innerHTML = `
            <td><strong>${p.id}</strong></td>
            <td>${p.class}</td>
            <td>${p.customerType === 'Loyal Customer' ? 'Sadık' : 'Değil'}</td>
            <td>${p.travelType === 'Business travel' ? 'İş' : 'Kişisel'}</td>
            <td>${finalWifi}</td>
            <td>${finalFood}</td>
            <td>${finalSeat}</td>
            <td>${finalClean}</td>
            <td>${finalDelay}</td>
            <td><span class="badge-status status-${p.initialState}">${p.initialState}</span></td>
            <td><span class="badge-status status-${p.currentState}">${p.currentState}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// Export CSV Logic
function downloadCsv() {
    const mods = {
        wifi: parseInt(modWifi.value),
        seat: parseInt(modSeat.value),
        food: parseInt(modFood.value),
        ent: parseInt(modEnt.value),
        book: parseInt(modBook.value),
        clean: parseInt(modClean.value),
        delay: parseInt(modDelay.value)
    };

    const headers = [
        'ID', 'Class', 'Customer Type', 'Type of Travel', 
        'Inflight wifi service', 'Ease of Online booking', 'Food and drink', 
        'Seat comfort', 'Inflight entertainment', 'Cleanliness', 
        'Departure/Arrival Delay in Minutes', 'Initial Satisfaction', 'Final Satisfaction'
    ];

    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n";
    
    passengers.forEach(p => {
        let row = [
            p.id, p.class, p.customerType, p.travelType,
            Math.max(0, Math.min(5, p.baseWifi + mods.wifi)),
            Math.max(0, Math.min(5, p.baseBook + mods.book)),
            Math.max(0, Math.min(5, p.baseFood + mods.food)),
            Math.max(0, Math.min(5, p.baseSeat + mods.seat)),
            Math.max(0, Math.min(5, p.baseEnt + mods.ent)),
            Math.max(0, Math.min(5, p.baseClean + mods.clean)),
            Math.max(0, p.baseDelay + mods.delay),
            p.initialState,
            p.currentState
        ];
        csvContent += row.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Yolcu_Memnuniyeti_Veri_Seti.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

document.getElementById('exportCsvBtnTop').addEventListener('click', downloadCsv);

// Input Listeners
sliders.forEach(slider => slider.addEventListener('input', updateSimulation));

// Bootstrap
setTimeout(() => {
    resizeCanvas();
    initCharts();
    generatePopulation(); // Initializes and renders
    animate();
}, 100);
