const form = document.getElementById("simulationForm");
const errorMessage = document.getElementById("errorMessage");
const resultsBody = document.getElementById("resultsBody");
const downloadCsvBtn = document.getElementById("downloadCsvBtn");
const openReportsBtn = document.getElementById("openReportsBtn");

const sliderIds = [
  "onlineBoarding",
  "wifiService",
  "inflightEntertainment",
  "seatComfort"
];

const simulationState = {
  records: []
};

const featureWeights = {
  onlineBoarding: 0.43,
  classWeight: 0.22,
  wifiService: 0.12,
  inflightEntertainment: 0.11,
  seatComfort: 0.08,
  delayPenalty: 0.04
};

const classScoreMap = {
  Business: 1.0,
  "Eco Plus": 0.62,
  Eco: 0.36
};

sliderIds.forEach((id) => {
  const slider = document.getElementById(id);
  const valueSpan = document.getElementById(`${id}Value`);
  slider.addEventListener("input", () => {
    valueSpan.textContent = slider.value;
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  errorMessage.textContent = "";

  const input = collectInputs();
  const validationError = validateInput(input);
  if (validationError) {
    errorMessage.textContent = validationError;
    return;
  }

  simulationState.records = runSimulation(input, 1000);
  localStorage.setItem("airlineSimulationRecords", JSON.stringify(simulationState.records));
  renderDashboard(simulationState.records);
  renderTable(simulationState.records);
  downloadCsvBtn.disabled = false;
  openReportsBtn.disabled = false;
});

downloadCsvBtn.addEventListener("click", () => {
  if (!simulationState.records.length) return;
  downloadAsCsv(simulationState.records);
});

openReportsBtn.addEventListener("click", () => {
  if (!simulationState.records.length) return;
  window.open("raporlar.html", "_blank");
});

function collectInputs() {
  return {
    onlineBoarding: Number(document.getElementById("onlineBoarding").value),
    wifiService: Number(document.getElementById("wifiService").value),
    inflightEntertainment: Number(document.getElementById("inflightEntertainment").value),
    seatComfort: Number(document.getElementById("seatComfort").value),
    departureDelay: Number(document.getElementById("departureDelay").value),
    flightClass: document.getElementById("flightClass").value
  };
}

function validateInput(input) {
  if (Number.isNaN(input.departureDelay)) {
    return "Kalkış gecikmesi alanı sayısal bir değer olmalıdır.";
  }
  if (input.departureDelay < 0) {
    return "Kalkış gecikmesi negatif olamaz.";
  }
  if (input.departureDelay > 600) {
    return "Kalkış gecikmesi 600 dakikadan büyük olamaz.";
  }
  return "";
}

function runSimulation(config, size) {
  const records = [];
  for (let i = 1; i <= size; i += 1) {
    const passenger = generatePassenger(i, config);
    const baseline = evaluateSatisfaction(passenger, false);
    const improved = evaluateSatisfaction(passenger, true);
    const converted = baseline === "Neutral or Dissatisfied" && improved === "Satisfied";

    records.push({
      ...passenger,
      baseline_satisfaction: baseline,
      satisfaction: improved,
      convertedFromNeutral: converted ? "Yes" : "No"
    });
  }
  return records;
}

function generatePassenger(id, config) {
  const classValue = Math.random() < 0.65 ? config.flightClass : randomClass();

  const age = randomInt(18, 75);
  const gender = Math.random() < 0.5 ? "Male" : "Female";
  const customerType = Math.random() < 0.64 ? "Loyal Customer" : "disloyal Customer";
  const typeOfTravel = Math.random() < 0.57 ? "Business travel" : "Personal Travel";
  const flightDistance = randomInt(250, 5500);

  const onlineBoarding = noisyScore(config.onlineBoarding, 1.2);
  const wifiService = noisyScore(config.wifiService, 1.3);
  const inflightEntertainment = noisyScore(config.inflightEntertainment, 1.2);
  const seatComfort = noisyScore(config.seatComfort, 1.2);
  const departureDelay = Math.max(0, Math.round(config.departureDelay + randomNormal(0, 12)));
  const arrivalDelay = Math.max(0, Math.round(departureDelay + randomNormal(2, 8)));

  return {
    ID: id,
    Gender: gender,
    "Customer Type": customerType,
    Age: age,
    "Type of Travel": typeOfTravel,
    Class: classValue,
    "Flight Distance": flightDistance,
    "Inflight wifi service": wifiService,
    "Online boarding": onlineBoarding,
    "Seat comfort": seatComfort,
    "Inflight entertainment": inflightEntertainment,
    "Departure Delay in Minutes": departureDelay,
    "Arrival Delay in Minutes": arrivalDelay
  };
}

function evaluateSatisfaction(passenger, withImprovements) {
  const onlineBoardingScore = passenger["Online boarding"] / 5;
  const wifiScore = passenger["Inflight wifi service"] / 5;
  const entertainmentScore = passenger["Inflight entertainment"] / 5;
  const comfortScore = passenger["Seat comfort"] / 5;
  const classScore = classScoreMap[passenger.Class] || 0.4;
  const delay = passenger["Departure Delay in Minutes"];

  const delayPenalty = Math.min(1, delay / 180);

  let score =
    featureWeights.onlineBoarding * onlineBoardingScore +
    featureWeights.classWeight * classScore +
    featureWeights.wifiService * wifiScore +
    featureWeights.inflightEntertainment * entertainmentScore +
    featureWeights.seatComfort * comfortScore -
    featureWeights.delayPenalty * delayPenalty;

  // Notebook vurgusuna göre Online Boarding düşükse mutsuzluk baskın davranır.
  if (onlineBoardingScore <= 0.2 && passenger["Customer Type"] === "disloyal Customer") {
    const unhappyProbability = withImprovements ? 0.65 : 0.98;
    return Math.random() < unhappyProbability ? "Neutral or Dissatisfied" : "Satisfied";
  }

  if (withImprovements) {
    if (score < 0.74 && onlineBoardingScore < 0.8) score += 0.07;
    if (score < 0.74 && wifiScore < 0.8) score += 0.04;
    if (score < 0.74 && comfortScore < 0.8) score += 0.03;
    if (delay < 20) score += 0.02;
  }

  return score >= 0.74 ? "Satisfied" : "Neutral or Dissatisfied";
}

function renderDashboard(records) {
  const total = records.length;
  const satisfiedCount = records.filter((r) => r.satisfaction === "Satisfied").length;
  const neutralCount = total - satisfiedCount;
  const baselineNeutral = records.filter((r) => r.baseline_satisfaction === "Neutral or Dissatisfied").length;
  const convertedCount = records.filter((r) => r.convertedFromNeutral === "Yes").length;

  const satisfiedRate = (satisfiedCount / total) * 100;
  const neutralRate = (neutralCount / total) * 100;
  const convertedRate = baselineNeutral > 0 ? (convertedCount / baselineNeutral) * 100 : 0;

  document.getElementById("satisfiedRateText").textContent = `%${satisfiedRate.toFixed(1)}`;
  document.getElementById("neutralRateText").textContent = `%${neutralRate.toFixed(1)}`;
  document.getElementById("convertedText").textContent = `${convertedCount} / ${baselineNeutral}`;
  document.getElementById("convertedRateText").textContent = `%${convertedRate.toFixed(1)} dönüşüm`;

  document.getElementById("satisfiedRateBar").style.width = `${satisfiedRate.toFixed(1)}%`;
  document.getElementById("neutralRateBar").style.width = `${neutralRate.toFixed(1)}%`;
}

function renderTable(records) {
  const rows = records.slice(0, 50);
  if (!rows.length) {
    resultsBody.innerHTML = '<tr><td colspan="11" class="placeholder">Kayıt bulunamadı.</td></tr>';
    return;
  }

  const html = rows
    .map(
      (r) => `
      <tr>
        <td>${r.ID}</td>
        <td>${r.Gender}</td>
        <td>${r["Customer Type"]}</td>
        <td>${r.Age}</td>
        <td>${r.Class}</td>
        <td>${r["Online boarding"]}</td>
        <td>${r["Inflight wifi service"]}</td>
        <td>${r["Inflight entertainment"]}</td>
        <td>${r["Seat comfort"]}</td>
        <td>${r["Departure Delay in Minutes"]}</td>
        <td>${translateSatisfaction(r.satisfaction)}</td>
      </tr>
    `
    )
    .join("");

  resultsBody.innerHTML = html;
}

function downloadAsCsv(records) {
  const columns = [
    { key: "ID", label: "ID", formatter: (v) => v },
    { key: "Gender", label: "Cinsiyet", formatter: translateGender },
    { key: "Customer Type", label: "Müşteri Tipi", formatter: translateCustomerType },
    { key: "Age", label: "Yas", formatter: (v) => v },
    { key: "Type of Travel", label: "Seyahat Turu", formatter: translateTravelType },
    { key: "Class", label: "Sinif", formatter: translateClass },
    { key: "Flight Distance", label: "Ucus Mesafesi", formatter: (v) => v },
    { key: "Inflight wifi service", label: "Ucus Ici Wi-Fi Hizmeti", formatter: (v) => v },
    { key: "Online boarding", label: "Online Binis", formatter: (v) => v },
    { key: "Seat comfort", label: "Koltuk Konforu", formatter: (v) => v },
    { key: "Inflight entertainment", label: "Ucus Ici Eglence", formatter: (v) => v },
    { key: "Departure Delay in Minutes", label: "Kalkis Gecikmesi (Dakika)", formatter: (v) => v },
    { key: "Arrival Delay in Minutes", label: "Varis Gecikmesi (Dakika)", formatter: (v) => v },
    { key: "baseline_satisfaction", label: "Baslangic Memnuniyet", formatter: translateSatisfaction },
    { key: "satisfaction", label: "Memnuniyet", formatter: translateSatisfaction },
    { key: "convertedFromNeutral", label: "Notrden Memnuna Donusum", formatter: translateConverted }
  ];

  const lines = [columns.map((col) => col.label).join(",")];
  records.forEach((record) => {
    const row = columns.map((col) => {
      const rawValue = record[col.key];
      return escapeCsvValue(col.formatter(rawValue));
    });
    lines.push(row.join(","));
  });

  const csvBlob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(csvBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "havayolu_yolcu_memnuniyeti_simulasyon.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function translateSatisfaction(value) {
  return value === "Satisfied" ? "Memnun" : "Nötr / Memnuniyetsiz";
}

function translateGender(value) {
  if (value === "Male") return "Erkek";
  if (value === "Female") return "Kadin";
  return value;
}

function translateCustomerType(value) {
  if (value === "Loyal Customer") return "Sadik Musteri";
  if (value === "disloyal Customer") return "Sadik Olmayan Musteri";
  return value;
}

function translateTravelType(value) {
  if (value === "Business travel") return "Is Seyahati";
  if (value === "Personal Travel") return "Kisisel Seyahat";
  return value;
}

function translateClass(value) {
  if (value === "Business") return "Is";
  if (value === "Eco Plus") return "Ekonomi Plus";
  if (value === "Eco") return "Ekonomi";
  return value;
}

function translateConverted(value) {
  return value === "Yes" ? "Evet" : "Hayir";
}

function randomClass() {
  const p = Math.random();
  if (p < 0.22) return "Business";
  if (p < 0.4) return "Eco Plus";
  return "Eco";
}

function noisyScore(base, spread) {
  return clamp(Math.round(base + randomNormal(0, spread)), 1, 5);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomNormal(mean = 0, stdDev = 1) {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdDev + mean;
}
