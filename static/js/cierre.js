document.addEventListener("DOMContentLoaded", () => {
    const context = window.cierreContext || {};
    const closingForm = document.getElementById("cierreForm");
    const montoInicialInput = document.getElementById("cierreMontoInicial");
    const ventaSistemaInput = document.getElementById("cierreVentaSistema");
    const posInput = document.getElementById("cierrePos");
    const yapeInput = document.getElementById("cierreYape");
    const plinInput = document.getElementById("cierrePlin");
    const efectivoInput = document.getElementById("cierreEfectivo");
    const observacionesInput = document.getElementById("cierreObservaciones");
    const gastosContainer = document.getElementById("cierreGastos");
    const gastoTemplate = document.getElementById("cierreGastoTemplate");
    const addGastoButton = document.getElementById("cierreAddGasto");

    const summaryIngresos = document.getElementById("cierreTotalIngresos");
    const summaryGastos = document.getElementById("cierreTotalGastos");
    const summarySubtotal = document.getElementById("cierreSubtotal");
    const summaryTotalActual = document.getElementById("cierreTotalActual");
    const summaryDiferencia = document.getElementById("cierreDiferencia");
    const diferenciaHint = document.getElementById("cierreDiferenciaHint");

    const closingData = context.closingData || {
        monto_inicial: 0,
        pos: 0,
        yape: 0,
        plin: 0,
        efectivo: 0,
        venta_sistema: 0,
        gastos: [],
        observaciones: "",
    };

    function formatAmount(value) {
        const numero = Number(value || 0);
        if (Number.isNaN(numero)) {
            return "0.00";
        }
        return numero.toFixed(2);
    }

    function createExpenseRow(data = { descripcion: "", monto: 0 }) {
        if (!gastoTemplate || !gastosContainer) return null;
        const fragment = gastoTemplate.content.firstElementChild.cloneNode(true);
        const descripcionInput = fragment.querySelector("[data-field='descripcion']");
        const montoInput = fragment.querySelector("[data-field='monto']");
        const removeButton = fragment.querySelector("[data-action='remove-gasto']");
        if (descripcionInput) {
            descripcionInput.value = data.descripcion || "";
            descripcionInput.addEventListener("keydown", handleInvestmentsNavigation);
        }
        if (montoInput) {
            montoInput.value = data.monto ? formatAmount(data.monto) : "";
            montoInput.addEventListener("input", () => {
                updateSummary();
            });
            montoInput.addEventListener("keydown", handleGastoAutoAdd);
            montoInput.addEventListener("keydown", handleInvestmentsNavigation);
        }
        if (removeButton) {
            removeButton.addEventListener("click", () => {
                fragment.remove();
                updateSummary();
            });
        }
        return fragment;
    }

    function populateGastos(list) {
        if (!gastosContainer) return;
        gastosContainer.innerHTML = "";
        const records = Array.isArray(list) ? list : [];
        if (!records.length) {
            const autoRow = createExpenseRow();
            if (autoRow) {
                gastosContainer.appendChild(autoRow);
            }
            return;
        }
        records.forEach((item) => {
            const row = createExpenseRow(item);
            if (row) {
                gastosContainer.appendChild(row);
            }
        });
    }

    function gatherExpenses() {
        if (!gastosContainer) return [];
        const rows = gastosContainer.querySelectorAll(".cierre-gasto-row");
        return Array.from(rows)
            .map((row) => {
                const desc = row.querySelector("[data-field='descripcion']");
                const monto = row.querySelector("[data-field='monto']");
                const descripcion = desc ? desc.value.trim() : "";
                const montoValor = monto ? parseFloat(monto.value || "0") : 0;
                if (!descripcion && !montoValor) {
                    return null;
                }
                return { descripcion, monto: Number.isNaN(montoValor) ? 0 : montoValor };
            })
            .filter(Boolean);
    }

    function parseInput(input) {
        if (!input) return 0;
        const value = parseFloat(input.value || "0");
        return Number.isNaN(value) ? 0 : value;
    }

    function updateSummary() {
        const montoInicial = parseInput(montoInicialInput);
        const pos = parseInput(posInput);
        const yape = parseInput(yapeInput);
        const plin = parseInput(plinInput);
        const efectivo = parseInput(efectivoInput);
        const ventaSistema = parseInput(ventaSistemaInput);
        const ingresos = pos + yape + plin + efectivo;
        const gastos = gatherExpenses();
        const totalGastos = gastos.reduce((acc, item) => acc + (item?.monto || 0), 0);
        const subtotal = ingresos + totalGastos;
        const totalActual = subtotal - montoInicial;
        const diferencia = totalActual - ventaSistema;

        if (summaryIngresos) {
            summaryIngresos.textContent = formatAmount(ingresos);
        }
        if (summaryGastos) {
            summaryGastos.textContent = formatAmount(totalGastos);
        }
        if (summarySubtotal) {
            summarySubtotal.textContent = formatAmount(subtotal);
        }
        if (summaryTotalActual) {
            summaryTotalActual.textContent = formatAmount(totalActual);
        }
        if (summaryDiferencia) {
            summaryDiferencia.textContent = formatAmount(diferencia);
            summaryDiferencia.classList.remove("text-success", "text-danger", "text-muted");
            if (diferencia > 0) {
                summaryDiferencia.classList.add("text-success");
            } else if (diferencia < 0) {
                summaryDiferencia.classList.add("text-danger");
            } else {
                summaryDiferencia.classList.add("text-muted");
            }
        }
        if (diferenciaHint) {
            if (Math.abs(diferencia) < 0.01) {
                diferenciaHint.textContent = "Diferencia mínima, todo cuadra.";
            } else if (diferencia > 0) {
                diferenciaHint.textContent = "Falta entregar dinero al banco.";
            } else {
                diferenciaHint.textContent = "Revisa los ingresos listados (ticket o depósitos).";
            }
        }
    }

    function handleGastoAutoAdd(event) {
        if (event.key !== "Enter" || event.shiftKey || !gastosContainer) return;
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (target.dataset.field !== "monto") return;
        const row = target.closest(".cierre-gasto-row");
        if (!row || row !== gastosContainer.lastElementChild) return;
        const descripcionInput = row.querySelector("[data-field='descripcion']");
        const descripcion = descripcionInput ? descripcionInput.value.trim() : "";
        const montoValue = (target.value || "").trim();
        if (!descripcion && !montoValue) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const nextRow = createExpenseRow();
        if (nextRow) {
            gastosContainer.appendChild(nextRow);
            updateSummary();
            const nextDescripcion = nextRow.querySelector("[data-field='descripcion']");
            nextDescripcion?.focus();
        }
    }

    function handleInvestmentsNavigation(event) {
        if (!closingForm) return;
        if (event.key !== "Enter") return;
        if (event.shiftKey) return;
        const target = event.target;
        if (!(target instanceof HTMLElement) || target.tagName === "TEXTAREA") return;
        const focusables = Array.from(
            closingForm.querySelectorAll("input[type='text'],input[type='number']")
        ).filter((el) => !el.hasAttribute("disabled"));
        const index = focusables.indexOf(target);
        if (index >= 0 && index < focusables.length - 1) {
            event.preventDefault();
            focusables[index + 1].focus();
        }
    }

    if (closingForm) {
        closingForm.addEventListener("keydown", handleInvestmentsNavigation);
    }

    if (addGastoButton) {
        addGastoButton.addEventListener("click", () => {
            const row = createExpenseRow();
            if (row) {
                gastosContainer.appendChild(row);
                updateSummary();
            }
        });
    }

    [montoInicialInput, ventaSistemaInput, posInput, yapeInput, plinInput, efectivoInput].forEach((input) => {
        if (!input) return;
        input.addEventListener("input", updateSummary);
    });

    if (closingForm) {
        closingForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const payload = {
                id_sede: document.getElementById("cierreIdSede")?.value,
                id_turno: document.getElementById("cierreIdTurno")?.value,
                fecha: document.getElementById("cierreFecha")?.value,
                monto_inicial: parseInput(montoInicialInput),
                pos: parseInput(posInput),
                yape: parseInput(yapeInput),
                plin: parseInput(plinInput),
                efectivo: parseInput(efectivoInput),
                venta_sistema: parseInput(ventaSistemaInput),
                observaciones: observacionesInput?.value || "",
                gastos: gatherExpenses(),
            };
            try {
                const response = await requestJSON("/api/cierre-caja", {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
                if (response?.cierre) {
                    window.cierreContext.closingData = response.cierre;
                    populateGastos(response.cierre.gastos);
                    updateSummary();
                }
                showToast("Cierre guardado", "success");
            } catch (error) {
                showToast(error.message || "No se pudo guardar el cierre", "danger");
            }
        });
    }

    populateGastos(closingData.gastos);
    updateSummary();
});
