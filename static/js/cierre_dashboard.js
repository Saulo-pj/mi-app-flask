document.addEventListener("DOMContentLoaded", () => {
    const data = window.dashboardContext;
    if (!data) {
        return;
    }

    const palette = ["#0d6efd", "#198754", "#6610f2", "#0dcaf0", "#fd7e14", "#dc3545"];

    const buildGroupedBarChart = () => {
        const ctx = document.getElementById("dashboardBarSedeTurno");
        if (!ctx || !data.sedeOrder || !data.turnoOrder) return;
        const labels = data.sedeOrder.map((item) => item.name);
        const getValue = (sedeId, turnoId) => {
            const entry = data.bySedeTurno?.[`${sedeId}:${turnoId}`];
            return Number((entry?.value ?? 0).toFixed?.(2) ?? entry?.value ?? 0);
        };
        const datasets = data.turnoOrder.map((turno, idx) => ({
            label: turno.name,
            data: data.sedeOrder.map((sede) => getValue(sede.id, turno.id)),
            backgroundColor: palette[idx % palette.length],
            borderRadius: 6,
        }));
        new Chart(ctx, {
            type: "bar",
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true },
                },
                plugins: {
                    legend: { position: "top" },
                },
            },
        });
    };

    const buildPieChart = (elementId, values, labels, colors = palette) => {
        const ctx = document.getElementById(elementId);
        if (!ctx || !values.length) return;
        new Chart(ctx, {
            type: "pie",
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "bottom" } },
            },
        });
    };

    const buildIncomesGastosChart = () => {
        const ctx = document.getElementById("dashboardBarIngresosGastos");
        if (!ctx || !data.incomes_vs_gastos) return;
        const values = [data.incomes_vs_gastos.ingresos ?? 0, data.incomes_vs_gastos.gastos ?? 0];
        new Chart(ctx, {
            type: "bar",
            data: {
                labels: ["Ingresos", "Gastos"],
                datasets: [{
                    label: "Monto",
                    data: values,
                    backgroundColor: ["#0d6efd", "#dc3545"],
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true } },
                plugins: { legend: { display: false } },
            },
        });
    };

    const buildTrendChart = () => {
        const ctx = document.getElementById("dashboardLineTrend");
        if (!ctx || !data.trend) return;
        new Chart(ctx, {
            type: "line",
            data: {
                labels: data.trend.labels || [],
                datasets: [
                    {
                        label: "Ingresos",
                        data: data.trend.ingresos || [],
                        borderColor: "#0d6efd",
                        backgroundColor: "rgba(13, 110, 253, 0.1)",
                        fill: true,
                        tension: 0.3,
                    },
                    {
                        label: "Gastos",
                        data: data.trend.gastos || [],
                        borderColor: "#fd7e14",
                        backgroundColor: "rgba(253, 126, 20, 0.1)",
                        fill: true,
                        tension: 0.3,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true } },
            },
        });
    };

    buildGroupedBarChart();

    const paymentValues = [
        data.payments?.pos ?? 0,
        data.payments?.yape ?? 0,
        data.payments?.plin ?? 0,
        data.payments?.efectivo ?? 0,
    ];
    buildPieChart(
        "dashboardPiePayments",
        paymentValues,
        ["POS", "Yape", "Plin", "Efectivo"],
        ["#fd7e14", "#6610f2", "#0dcaf0", "#198754"]
    );

    const distributionValues = data.distribution?.map((item) => item.value ?? 0) ?? [];
    const distributionLabels = data.distribution?.map((item) => item.label ?? "") ?? [];
    buildPieChart("dashboardPieDistribution", distributionValues, distributionLabels);

    buildIncomesGastosChart();
    buildTrendChart();
});
