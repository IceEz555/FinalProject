// =================================================================
// การตั้งค่าและตัวแปร
// =================================================================
const BASE_URL = "XXXXX";
const KWH_PRICE = 4.0; // สมมติว่าค่าไฟหน่วยละ 4 บาท
let reportChart;
let reportData = [];

// =================================================================
// DOM Elements
// =================================================================
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const generateBtn = document.getElementById('generate-report-btn');
const downloadBtn = document.getElementById('download-csv-btn');
const reportContent = document.getElementById('report-content');
const loadingIndicator = document.getElementById('loading-indicator');

// =================================================================
// ฟังก์ชันหลัก
// =================================================================

/**
 * ตั้งค่าเริ่มต้นเมื่อหน้าเว็บโหลด
 */
function initialize() {
    // ตั้งค่าวันที่เริ่มต้นและสิ้นสุดเป็นสัปดาห์ที่ผ่านมา
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    startDateInput.value = sevenDaysAgo.toISOString().split('T')[0];
    endDateInput.value = today.toISOString().split('T')[0];

    // ผูก Event ให้กับปุ่ม
    generateBtn.addEventListener('click', handleGenerateReport);
    downloadBtn.addEventListener('click', handleDownloadCSV);
}

/**
 * จัดการเมื่อผู้ใช้กดปุ่ม "Generate Report"
 */
async function handleGenerateReport() {
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;

    if (!startDate || !endDate) {
        alert('Please select both a start and end date.');
        return;
    }

    loadingIndicator.style.display = 'block';
    reportContent.classList.add('hidden');
    downloadBtn.disabled = true;

    const startTimestamp = new Date(startDate).getTime() / 1000;
    const endTimestamp = new Date(endDate).getTime() / 1000 + (24 * 60 * 60 - 1); // รวมทั้งวันของวันสิ้นสุด

    try {
        reportData = await fetchUsageData(startTimestamp, endTimestamp);
        if (reportData.length > 0) {
            updateSummaryCards(reportData);
            renderChart(reportData);
            renderTable(reportData);
            reportContent.classList.remove('hidden');
            downloadBtn.disabled = false;
        } else {
            alert('No data found for the selected date range.');
        }
    } catch (error) {
        console.error('Failed to generate report:', error);
        alert('An error occurred while generating the report.');
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

/**
 * ดึงข้อมูลสรุปการใช้งานจาก API
 */
function fetchUsageData(startTimestamp, endTimestamp) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                const json = JSON.parse(xhr.response);
                resolve(json.data.usageData || []);
            } else {
                reject(new Error(`Request failed with status ${xhr.status}`));
            }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.open("POST", BASE_URL);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.send(JSON.stringify({
            query: `query {
                usageData(startDate: ${startTimestamp}, endDate: ${endTimestamp}) {
                    timestamp
                    dayUse
                    nightUse
                }
            }`
        }));
    });
}

/**
 * อัปเดตการ์ดสรุปข้อมูล
 */
function updateSummaryCards(data) {
    const totalKwh = data.reduce((sum, item) => sum + item.dayUse + item.nightUse, 0);
    const estimatedCost = totalKwh * KWH_PRICE;
    const avgKwh = totalKwh / data.length;

    let peakUsage = 0;
    let peakDay = '';
    data.forEach(item => {
        const dailyTotal = item.dayUse + item.nightUse;
        if (dailyTotal > peakUsage) {
            peakUsage = dailyTotal;
            peakDay = new Date(item.timestamp * 1000).toLocaleDateString('en-CA');
        }
    });

    document.getElementById('summary-total-kwh').innerText = `${totalKwh.toFixed(2)} kWh`;
    document.getElementById('summary-est-cost').innerText = `${estimatedCost.toFixed(2)} THB`;
    document.getElementById('summary-avg-kwh').innerText = `${avgKwh.toFixed(2)} kWh`;
    document.getElementById('summary-peak-day').innerText = peakDay;
}

/**
 * วาดกราฟแท่ง
 */
function renderChart(data) {
    const ctx = document.getElementById('report-chart').getContext('2d');
    const chartData = {
        labels: data.map(el => new Date(el.timestamp * 1000).toLocaleDateString('en-CA')),
        datasets: [{
            label: 'Day Usage (kWh)',
            backgroundColor: 'rgb(54, 162, 235)',
            data: data.map(el => el.dayUse.toFixed(2)),
        }, {
            label: 'Night Usage (kWh)',
            backgroundColor: 'rgb(29, 41, 81)',
            data: data.map(el => el.nightUse.toFixed(2)),
        }]
    };

    if (reportChart) {
        reportChart.destroy();
    }

    reportChart = new Chart(ctx, {
        type: 'bar',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                xAxes: [{ stacked: true }],
                yAxes: [{ stacked: true, ticks: { beginAtZero: true } }]
            }
        }
    });
}

/**
 * แสดงข้อมูลในตาราง
 */
function renderTable(data) {
    const tableBody = document.getElementById('report-table-body');
    tableBody.innerHTML = ''; // ล้างข้อมูลเก่า

    data.forEach(item => {
        const date = new Date(item.timestamp * 1000).toLocaleDateString('en-CA');
        const dayUse = item.dayUse.toFixed(3);
        const nightUse = item.nightUse.toFixed(3);
        const total = (item.dayUse + item.nightUse).toFixed(3);

        const row = `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${date}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${dayUse}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${nightUse}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${total}</td>
            </tr>
        `;
        tableBody.innerHTML += row;
    });
}

/**
 * จัดการการดาวน์โหลดไฟล์ CSV
 */
function handleDownloadCSV() {
    if (reportData.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Day_kWh,Night_kWh,Total_kWh\r\n"; // Header

    reportData.forEach(item => {
        const date = new Date(item.timestamp * 1000).toLocaleDateString('en-CA');
        const dayUse = item.dayUse.toFixed(4);
        const nightUse = item.nightUse.toFixed(4);
        const total = (item.dayUse + item.nightUse).toFixed(4);
        csvContent += `${date},${dayUse},${nightUse},${total}\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "energy_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


// =================================================================
// เริ่มการทำงานของ Script
// =================================================================
document.addEventListener('DOMContentLoaded', initialize);
