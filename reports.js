const backToMainBtn = document.getElementById("backToMainBtn");
const reportsInfoText = document.getElementById("reportsInfoText");
const chartsSection = document.getElementById("chartsSection");

backToMainBtn.addEventListener("click", () => {
  window.location.href = "index.html";
});

const storedRecords = localStorage.getItem("airlineSimulationRecords");
const records = storedRecords ? JSON.parse(storedRecords) : [];

if (!records.length) {
  reportsInfoText.textContent = "Rapor üretmek için önce ana sayfada simülasyonu çalıştırın.";
  chartsSection.style.display = "none";
} else {
  reportsInfoText.textContent = `${records.length} yolcu kaydı üzerinden grafik raporu oluşturuldu.`;
  renderSatisfactionChart(records);
  renderClassChart(records);
  renderDelayChart(records);
}

function renderSatisfactionChart(data) {
  const satisfied = data.filter((r) => r.satisfaction === "Satisfied").length;
  const neutral = data.length - satisfied;
  const ctx = document.getElementById("satisfactionChart");

  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Memnun", "Nötr / Memnuniyetsiz"],
      datasets: [
        {
          data: [satisfied, neutral],
          backgroundColor: ["#18b47a", "#e85c5c"],
          borderColor: ["#173255", "#173255"],
          borderWidth: 1
        }
      ]
    },
    options: baseChartOptions()
  });
}

function renderClassChart(data) {
  const classes = ["Business", "Eco Plus", "Eco"];
  const labels = ["Is", "Ekonomi Plus", "Ekonomi"];
  const rates = classes.map((className) => {
    const classRows = data.filter((r) => r.Class === className);
    if (!classRows.length) return 0;
    const satisfied = classRows.filter((r) => r.satisfaction === "Satisfied").length;
    return Number(((satisfied / classRows.length) * 100).toFixed(1));
  });

  const ctx = document.getElementById("classChart");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Memnuniyet (%)",
          data: rates,
          backgroundColor: ["#d4af37", "#4c89d9", "#2f6ab7"]
        }
      ]
    },
    options: axisChartOptions()
  });
}

function renderDelayChart(data) {
  const bins = [
    { label: "0-15", min: 0, max: 15 },
    { label: "16-30", min: 16, max: 30 },
    { label: "31-60", min: 31, max: 60 },
    { label: "61-120", min: 61, max: 120 },
    { label: "120+", min: 121, max: Infinity }
  ];

  const labels = bins.map((b) => b.label);
  const values = bins.map((bin) => {
    const grouped = data.filter((r) => {
      const delay = r["Departure Delay in Minutes"];
      return delay >= bin.min && delay <= bin.max;
    });
    if (!grouped.length) return 0;
    const satisfied = grouped.filter((r) => r.satisfaction === "Satisfied").length;
    return Number(((satisfied / grouped.length) * 100).toFixed(1));
  });

  const ctx = document.getElementById("delayChart");
  new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Memnuniyet (%)",
          data: values,
          borderColor: "#d4af37",
          backgroundColor: "rgba(212, 175, 55, 0.2)",
          fill: true,
          tension: 0.28
        }
      ]
    },
    options: axisChartOptions()
  });
}

function baseChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "#dbe7fb"
        }
      }
    }
  };
}

function axisChartOptions() {
  return {
    ...baseChartOptions(),
    scales: {
      y: {
        min: 0,
        max: 100,
        ticks: { color: "#cdd9ee" },
        grid: { color: "rgba(180, 205, 240, 0.12)" }
      },
      x: {
        ticks: { color: "#cdd9ee" },
        grid: { display: false }
      }
    }
  };
}
