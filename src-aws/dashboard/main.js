// =================================================================
// ส่วนที่ 1: การตั้งค่าและตัวแปรส่วนกลาง (Global Variables)
// =================================================================
const BASE_URL =
  "XXXXX";
let data = [];
let chart;
let animateDuration = 1500;

// =================================================================
// ส่วนที่ 2: ฟังก์ชันสำหรับดึงข้อมูลจาก API (Data Fetching)
// =================================================================

function fetchChartDataForDailyUsage() {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        const json = JSON.parse(xhr.response);
        const chartData = {
          labels: json.data.usageData.map((el) =>
            formatTimestampForChartAxis(el.timestamp)
          ),
          datasets: [
            {
              label: "Day",
              backgroundColor: "rgb(54, 162, 235)",
              data: json.data.usageData.map((el) => el.dayUse),
            },
            {
              label: "Night",
              backgroundColor: "rgb(29, 41, 81)",
              data: json.data.usageData.map((el) => el.nightUse),
            },
          ],
        };
        resolve(chartData);
      } else {
        console.error("Failed to fetch daily usage data!");
        reject();
      }
    };
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 31);
    const start = parseInt(startDate.getTime() / 1000);
    const end = parseInt(Date.now() / 1000);
    xhr.open("POST", BASE_URL);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(
      JSON.stringify({
        query: `query {
          usageData(startDate: ${start}, endDate: ${end}) {
            timestamp
            dayUse
            nightUse
          }
        }`,
      })
    );
  });
}

function fetchData(since) {
  if (!since) {
    const safeTimeAgo = new Date();
    safeTimeAgo.setMinutes(safeTimeAgo.getMinutes() - (23 * 60 + 50));
    since = safeTimeAgo.getTime() / 1000;
  }
  since = parseInt(since);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        const json = JSON.parse(xhr.response);
        processData(json);
        resolve();
      } else {
        console.error("Failed to fetch real-time data!");
        reject();
      }
    };
    xhr.open("POST", BASE_URL);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(
      JSON.stringify({
        query: `query{ realtime(sinceTimestamp: ${since}){timestamp, reading} }`,
      })
    );
  });
}

async function fetchHistoricalData(startTimestamp, endTimestamp) {
  console.log(
    `Fetching historical data from ${startTimestamp} to ${endTimestamp}`
  );
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        const json = JSON.parse(xhr.response);
        if (json.data && json.data.readings) {
          const formattedData = json.data.readings.map((entry) => {
            return [
              new Date(entry.timestamp * 1000),
              parseFloat(entry.reading),
            ];
          });
          resolve(formattedData);
        } else {
          console.error("Historical data not found in response:", json);
          resolve([]);
        }
      } else {
        console.error("The request for historical data failed!");
        reject();
      }
    };
    xhr.open("POST", BASE_URL);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(
      JSON.stringify({
        query: `query {
          readings(startDate: ${startTimestamp}, endDate: ${endTimestamp}) {
            timestamp
            reading
          }
        }`,
      })
    );
  });
}

// +++ START: ฟังก์ชันใหม่สำหรับเรียก Gemini API +++
async function getEnergyInsights() {
  showModal(); // แสดง Modal พร้อม Loading Spinner

  // 1. รวบรวมข้อมูลจาก Dashboard
  const todayKwh = document.getElementById("stats-kwh").innerText;
  const peakUsage = document.getElementById("stats-max").innerText;
  const standbyPower = document.getElementById("stats-standby").innerText;

  // 2. สร้าง Prompt สำหรับ Gemini
  const prompt = `
        ฉันเป็นผู้ใช้งานระบบ Home Energy Monitor และนี่คือข้อมูลการใช้พลังงานของฉันล่าสุด:
        - การใช้งานรวมวันนี้: ${todayKwh}
        - การใช้งานสูงสุด (Peak): ${peakUsage}
        - พลังงานที่ใช้ตอนสแตนด์บาย (Standby Power): ${standbyPower}

        จากข้อมูลนี้ ช่วยวิเคราะห์พฤติกรรมการใช้พลังงานของฉัน และให้คำแนะนำที่เป็นรูปธรรม 3-5 ข้อเพื่อช่วยให้ฉันประหยัดค่าไฟในเดือนถัดไปได้หรือไม่?
        กรุณาตอบเป็นภาษาไทยในรูปแบบ Markdown ที่อ่านง่าย
    `;

  // 3. เรียกใช้ Gemini API
  let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
  const payload = { contents: chatHistory };
  const apiKey = "XXXX"; // ไม่ต้องใส่ API Key ที่นี่
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

  try {
    // ใช้ Exponential Backoff
    let response;
    let retries = 3;
    let delay = 1000;
    for (let i = 0; i < retries; i++) {
      response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) break;
      await new Promise((res) => setTimeout(res, delay));
      delay *= 2;
    }

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const result = await response.json();

    let text = "ขออภัย, ไม่สามารถรับข้อมูลจาก AI ได้ในขณะนี้";
    if (
      result.candidates &&
      result.candidates.length > 0 &&
      result.candidates[0].content &&
      result.candidates[0].content.parts &&
      result.candidates[0].content.parts.length > 0
    ) {
      text = result.candidates[0].content.parts[0].text;
    }

    // --- START: แก้ไขส่วนนี้ ---
    // 4. แปลง Markdown เป็น HTML แล้วแสดงผล
    const converter = new showdown.Converter();
    const html = converter.makeHtml(text);
    document.getElementById("modal-content-area").innerHTML = html;
    // --- END: แก้ไขส่วนนี้ ---

  } catch (error) {
    console.error("Error fetching AI insights:", error);
    document.getElementById("modal-content-area").innerText =
      "เกิดข้อผิดพลาดในการขอคำแนะนำจาก AI กรุณาลองใหม่อีกครั้ง";
  }
}
// +++ END: ฟังก์ชันใหม่สำหรับเรียก Gemini API +++

// =================================================================
// ส่วนที่ 3: ฟังก์ชันสำหรับประมวลผลและแสดงผลข้อมูล (Data Processing & Rendering)
// =================================================================

function processData(rawData) {
  if (!rawData || !rawData.data || !rawData.data.realtime) {
    return;
  }
  for (const entry of rawData.data.realtime) {
    const date = entry.timestamp * 1000;
    if (data.length > 1 && date < data[data.length - 1][0].getTime()) {
      continue;
    }
    const watts = parseFloat(entry.reading);
    data.push([new Date(date), watts]);
  }
  if (data.length === 0) {
    console.log("No data to process. Exiting.");
    return;
  }
  if (chart) {
    chart.updateOptions({
      file: data,
    });
  }
  const $current = document.getElementById("stats-current");
  const $todayKwh = document.getElementById("stats-kwh");
  const $standbyPower = document.getElementById("stats-standby");
  const $max = document.getElementById("stats-max");
  const $lastreading = document.getElementById("last-reading");

  const latestEntry = rawData.data.realtime[rawData.data.realtime.length - 1];
  const latestDate = new Date(0);
  latestDate.setUTCSeconds(latestEntry.timestamp);
  $lastreading.innerHTML = latestDate.toLocaleString();

  const totalKwh = calculateKWH(data);
  $current.innerHTML = data[data.length - 1][1] + " W";
  $todayKwh.innerHTML = Math.round(totalKwh * 100) / 100 + " kWh";

  const readings = data.map((el) => el[1]);
  const standbyWatts = jStat.mode(readings);
  $standbyPower.innerHTML = parseInt(standbyWatts) + " W";
  $max.innerHTML = jStat.max(readings) + " W";

  const hours =
    (data[data.length - 1][0].getTime() - data[0][0].getTime()) / 1000 / 3600;
  const standbyKwh = (standbyWatts / 1000) * hours;
  initStandbyChart({
    activePower: totalKwh - standbyKwh,
    standbyPower: standbyKwh,
  });
}

function initStandbyChart({ activePower, standbyPower }) {
  const barChartData = {
    labels: ["Active", "Standby"],
    datasets: [
      {
        data: [activePower, standbyPower],
        backgroundColor: ["#4f46e5", "#d1d5db"],
        borderWidth: 0,
      },
    ],
  };
  const ctx = document.getElementById("chart-standby").getContext("2d");
  new Chart(ctx, {
    type: "doughnut",
    data: barChartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      legend: {
        position: "bottom",
      },
      animation: { duration: animateDuration },
    },
  });
  animateDuration = 0;
}

async function initUsageChart() {
  const chartdata = await fetchChartDataForDailyUsage();
  const ctx = document.getElementById("canvas").getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: chartdata,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      legend: { display: false },
      scales: {
        xAxes: [{ stacked: true, gridLines: { display: false } }],
        yAxes: [{ stacked: true, gridLines: { display: false } }],
      },
    },
  });
}

// =================================================================
// ส่วนที่ 4: ฟังก์ชันหลักและตัวควบคุม (Main Controller & Initializer)
// =================================================================

async function initChart() {
  await fetchData();
  chart = new Dygraph(document.getElementById("graphdiv"), data, {
    colors: ["#8B5CF6"],
    legend: "always",
    labels: ["Timestamp", "Watts"],
    underlayCallback: highlightNightHours,
    drawCallback: updateMetricsForSelectedRange,
    showRoller: true,
    rollPeriod: 14,
  });

  document
    .getElementById("btnYesterday")
    .addEventListener("click", async () => {
      toggleLoadingIndicator(true);
      const start = new Date();
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      const startTimestamp = Math.floor(start.getTime() / 1000);
      const endTimestamp = Math.floor(end.getTime() / 1000);
      const historicalData = await fetchHistoricalData(
        startTimestamp,
        endTimestamp
      );
      if (chart && historicalData.length > 0) {
        chart.updateOptions({
          file: historicalData,
          dateWindow: null,
        });
      } else {
        alert(
          "ไม่พบข้อมูลการใช้งานของเมื่อวาน (No data returned for yesterday)"
        );
      }
      toggleLoadingIndicator(false);
    });

  document.getElementById("btnToday").addEventListener("click", async () => {
    toggleLoadingIndicator(true);
    data = [];
    await fetchData();
    if (chart) {
      chart.updateOptions({ dateWindow: null });
    }
    toggleLoadingIndicator(false);
  });

  // +++ START: ผูก Event ให้กับปุ่ม AI Insights และ Modal +++
  document
    .getElementById("get-insights-btn")
    .addEventListener("click", getEnergyInsights);
  document
    .getElementById("close-modal-btn")
    .addEventListener("click", hideModal);
  document
    .getElementById("ai-modal")
    .addEventListener("click", function (event) {
      if (event.target === this) {
        hideModal();
      }
    });
  // +++ END: ผูก Event ให้กับปุ่ม AI Insights และ Modal +++

  setInterval(async () => {
    if (data.length > 0) {
      await fetchData(data[data.length - 1][0].getTime() / 1000);
    }
  }, 30 * 1000);
}

// =================================================================
// ส่วนที่ 5: ฟังก์ชันเสริม (Helper Functions)
// =================================================================

// +++ START: ฟังก์ชันสำหรับควบคุม Modal +++
function showModal() {
  const modal = document.getElementById("ai-modal");
  const modalBackdrop = modal;
  const modalContent = modal.querySelector(".modal-content");

  // Reset content to loading spinner
  modal.querySelector("#modal-content-area").innerHTML = `
        <div class="flex items-center justify-center h-32">
            <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-500"></div>
        </div>`;

  modal.classList.remove("hidden");
  setTimeout(() => {
    modalBackdrop.classList.remove("opacity-0");
    modalContent.classList.remove("scale-95");
  }, 10);
}

function hideModal() {
  const modal = document.getElementById("ai-modal");
  const modalBackdrop = modal;
  const modalContent = modal.querySelector(".modal-content");

  modalBackdrop.classList.add("opacity-0");
  modalContent.classList.add("scale-95");
  setTimeout(() => {
    modal.classList.add("hidden");
  }, 300);
}
// +++ END: ฟังก์ชันสำหรับควบคุม Modal +++

// --- START: แก้ไขฟังก์ชันนี้ให้ทำงานกับ spinner ใหม่ ---
function toggleLoadingIndicator(show) {
  const spinner = document.getElementById("spinner");
  if (spinner) { // เพิ่มการตรวจสอบว่า element มีอยู่จริงหรือไม่
    if (show) {
      spinner.classList.remove("hidden");
    } else {
      spinner.classList.add("hidden");
    }
  }
}
// --- END: แก้ไขฟังก์ชันนี้ ---

function formatTimestampForChartAxis(rawTimestamp) {
  const date = new Date(rawTimestamp * 1000);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return date.getDate() + " " + months[date.getMonth()];
}

function calculateKWH(dataset) {
  let total = 0;
  for (let i = 0; i < dataset.length - 1; i++) {
    const current = dataset[i];
    const next = dataset[i + 1];
    const seconds = (next[0].getTime() - current[0].getTime()) / 1000;
    total += (current[1] * seconds * (1 / 3600)) / 1000;
  }
  return total;
}

function updateMetricsForSelectedRange(chart, initial_draw) {
  let startDate = 0;
  let endDate = Number.MAX_SAFE_INTEGER;
  if (chart.dateWindow_) {
    startDate = chart.dateWindow_[0];
    endDate = chart.dateWindow_[1];
  }
  const dataInScope = data.filter((el) => el[0] > startDate && el[0] < endDate);
  const metrics = { usage: calculateKWH(dataInScope) };
  const $kwh = document.getElementById("usage-kwh");
  $kwh.innerHTML = parseFloat(metrics.usage).toFixed(2) + " kWh";
}

function highlightNightHours(canvas, area, chart) {
  let foundStart = false;
  let foundEnd = false;
  let startHighlight = null;
  let endHighlight = null;
  canvas.fillStyle = "rgba(229, 231, 235, 0.5)";
  for (let i = 0; i < chart.file_.length; i++) {
    const entry = chart.file_[i];
    const date = entry[0];
    endHighlight = chart.toDomXCoord(date);
    if (foundStart === false && isNightTarif(date)) {
      foundStart = true;
      startHighlight = chart.toDomXCoord(date);
    }
    if (foundStart === true && isNightTarif(date) === false) {
      foundEnd = true;
    }
    if (foundStart === true && foundEnd === true) {
      const width = endHighlight - startHighlight;
      canvas.fillRect(startHighlight, area.y, width, area.h);
      foundStart = false;
      foundEnd = false;
    }
    i += 30;
  }
  if (foundStart && foundEnd === false) {
    const lastPosition = chart.toDomXCoord(
      chart.file_[chart.file_.length - 1][0]
    );
    const width = lastPosition - startHighlight;
    canvas.fillRect(startHighlight, area.y, width, area.h);
  }
}

function isNightTarif(dateObj) {
  if (
    (dateObj.getHours() >= 21 && dateObj.getHours() <= 23) ||
    (dateObj.getHours() >= 0 && dateObj.getHours() <= 5)
  ) {
    return true;
  }
  if (dateObj.getDay() === 0 || dateObj.getDay() === 6) {
    return true;
  }
  return false;
}
