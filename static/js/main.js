async function requestJSON(url, options = {}) {
    const resp = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        ...options,
    });
    const contentType = (resp.headers.get('content-type') || '').split(';')[0];
    if ((resp.redirected && resp.url && resp.url.includes('/login')) || resp.status === 401) {
        throw new Error('Sesión inválida o expiró. Vuelve a iniciar sesión.');
    }
    if (contentType === 'text/html') {
        const html = await resp.text();
        const looksLikeLogin = html.includes('id="loginForm"') || html.includes('name="perfil"');
        if (resp.status === 401 || looksLikeLogin) {
            throw new Error('Sesión inválida o expiró. Vuelve a iniciar sesión.');
        }
        const textOnly = html.replace(/<[^>]+>/g, ' ').trim().replace(/\s+/g, ' ');
        const fallback = textOnly || `HTML ${resp.status}`;
        throw new Error(`Respuesta inesperada del servidor: ${fallback}`);
    }
    let data;
    try {
        data = await resp.json();
    } catch (err) {
        throw new Error('Respuesta JSON inválida del servidor.');
    }
    if (!resp.ok) throw new Error(data.error || 'Error de servidor');
    return data;
}

function showToast(message, variant = 'info', timeout = 3000, options = {}) {
    try {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const id = `t-${Date.now()}`;
        const {
            actionText = null,
            onAction = null,
            autoHide = true,
        } = options;
        const actionHtml = actionText
            ? `<div class="toast-action mt-2"><button type="button" class="btn btn-light btn-sm w-100" data-toast-action="true">${actionText}</button></div>`
            : '';
        const toastHtml = `
            <div id="${id}" class="toast text-bg-${variant} border-0 mb-2" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-content d-flex flex-column gap-2">
                <div class="d-flex align-items-start gap-2">
                    <div class="toast-body flex-grow-1">${message}</div>
                    <button type="button" class="btn-close btn-close-white ms-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                ${actionHtml}
                </div>
            </div>`;
        container.insertAdjacentHTML('beforeend', toastHtml);
        const el = document.getElementById(id);
        const toast = new bootstrap.Toast(el, { delay: timeout, autohide: autoHide });
        toast.show();
        if (actionText && typeof onAction === 'function') {
            const actionBtn = el.querySelector('[data-toast-action]');
            if (actionBtn) {
                actionBtn.addEventListener('click', (event) => {
                    event.preventDefault();
                    try {
                        onAction();
                    } finally {
                        toast.hide();
                    }
                });
            }
        }
        el.addEventListener('hidden.bs.toast', () => el.remove());
    } catch (e) {
        console.warn('Toast error', e);
    }
}

const CHECKLIST_ESTADO_CONFIG = {
    Pendiente: { label: 'Pendiente', badge: 'bg-danger', overlay: '', disableSolicitar: false, disableQuitar: false },
    Listo: { label: 'Listo', badge: 'bg-warning text-dark', overlay: 'check-item-listo', disableSolicitar: true, disableQuitar: false },
    Enviado: { label: 'Enviado', badge: 'bg-success', overlay: 'check-item-locked', disableSolicitar: true, disableQuitar: true },
    Recibido: { label: 'Recibido', badge: 'bg-info text-dark', overlay: 'check-item-locked', disableSolicitar: true, disableQuitar: true },
};

let inventorySearchQuery = '';

function buildChecklistItem(item) {
        const estado = item.detalle_estado || 'Pendiente';
        const rootEditable = typeof window !== 'undefined' ? window.checklistEditable !== false : true;
    const config = CHECKLIST_ESTADO_CONFIG[estado] || CHECKLIST_ESTADO_CONFIG.Pendiente;
        const canEdit = rootEditable && estado === 'Pendiente';
        const disableSolicitar = config.disableSolicitar || !canEdit;
        const disableQuitar = config.disableQuitar;
        const disableInput = !canEdit;
        const cantidadValue = typeof item.cantidad_solicitada === 'number' && !Number.isNaN(item.cantidad_solicitada)
            ? item.cantidad_solicitada
            : '';
        const classes = ['check-item'];
        if (config.overlay) classes.push(config.overlay);
        const cardClass = classes.join(' ');

        return `
            <div class="${cardClass}" id="check-item-${item.id_producto}" data-card-producto="${item.id_producto}" data-pedido-id="${item.pedido_id || ''}" data-detalle-id="${item.detalle_id || ''}" data-detalle-estado="${estado}" data-card-editable="${canEdit ? 'true' : 'false'}">
                <div class="d-flex justify-content-between align-items-start gap-2">
                    <div>
                        <div class="producto">${item.nombre_producto}</div>
                        <div class="d-flex gap-2 align-items-center mb-1">
                            <span class="badge ${item.subarea_badge}">${item.subarea}</span>
                        </div>
                        <div class="stock">Stock actual sede: <strong>${item.stock_actual_sede}</strong></div>
                        <div class="unidad small text-muted">Unidad: ${item.unidad || 'Sin unidad'}</div>
                    </div>
                    <span class="badge ${config.badge} estado-item" id="estado-${item.id_producto}" data-estado="${estado}">${config.label}</span>
                </div>
                <div class="row g-2 mt-1">
                    <div class="col-7">
                        <input type="number" min="0" step="0.1" class="form-control input-cantidad" id="cantidad-${item.id_producto}" placeholder="Cantidad" ${disableInput ? 'disabled' : ''} value="${cantidadValue}">
                    </div>
                    <div class="col-5 d-grid gap-2">
                        <button class="btn btn-primary btn-solicitar" data-producto="${item.id_producto}" ${disableSolicitar ? 'disabled' : ''}>Solicitar</button>
                        <button class="btn btn-outline-danger btn-quitar" data-producto="${item.id_producto}" ${disableQuitar ? 'disabled' : ''}>Ocultar</button>
                    </div>
                </div>
            </div>
        `;
}

function getArrivalDetails() {
    const list = window.visibleChecklistItems || [];
    return list
        .filter((item) => item.detalle_estado === 'Enviado' && item.detalle_id && item.check_almacen)
        .map((item) => ({
            ...item,
            cantidad_solicitada: item.cantidad_solicitada || 0,
            cantidad_entregada: item.cantidad_entregada || 0,
        }));
}

function renderArrivalPanel() {
    const panel = document.getElementById('arrivalPanel');
    if (!panel) return;
    const items = getArrivalDetails();
    const list = document.getElementById('arrivalList');
    const empty = document.getElementById('arrivalEmpty');
    const btnConfirmarLlegada = document.getElementById('btnConfirmarLlegada');
    const btnConfirmarRecibidos = document.getElementById('btnConfirmarRecibidos');
    const visible = items.length > 0;
    panel.style.display = visible ? '' : 'none';
    if (list) {
        list.innerHTML = visible
            ? items
                  .map((item) => {
                      const labelId = `arrival-${item.detalle_id}`;
                      const cantidad = Number.isFinite(item.cantidad_entregada)
                          ? Number(item.cantidad_entregada).toFixed(2).replace(/\.00$/, '')
                          : (Number.isFinite(item.cantidad_solicitada)
                              ? Number(item.cantidad_solicitada).toFixed(2).replace(/\.00$/, '')
                              : '');
                      const detailText = cantidad ? `${cantidad} ${item.unidad || ''}` : 'Cantidad pendiente';
                      return `
                          <label class="form-check form-check-inline w-100" for="${labelId}">
                              <input class="form-check-input arrival-checkbox" type="checkbox" id="${labelId}" data-detalle="${item.detalle_id}" data-producto="${item.id_producto}">
                              <span class="form-check-label">${item.nombre_producto} · ${detailText}</span>
                          </label>
                      `;
                  })
                  .join('')
            : '';
    }
    if (empty) {
        empty.classList.toggle('d-none', visible);
    }
    if (btnConfirmarLlegada) {
        btnConfirmarLlegada.disabled = !visible;
    }
    if (btnConfirmarRecibidos) {
        btnConfirmarRecibidos.disabled = !visible;
    }
}

function syncChecklistItemState(prodId, estado) {
    const items = window.visibleChecklistItems || [];
    const item = items.find((thing) => thing.id_producto === prodId);
    if (item) {
        item.detalle_estado = estado;
    }
}

function renderSubareas() {
    const areaId = document.body.dataset.areaId;
    const config = window.subareasConfig || {};
    const subareas = config[areaId] || [];
    const body = document.getElementById('subareasBody');
    if (!body) return;

    body.innerHTML = subareas
        .map((sub) => `
            <tr>
                <td>${areaId === 'COC' ? 'Cocina' : 'Salón'}</td>
                <td>${sub.nombre}</td>
                <td><span class="badge ${sub.badge}">${sub.nombre}</span></td>
            </tr>
        `)
        .join('');

    // subarea select removed from checklist template; nothing que hacer aquí
}

function populateSubareaSelect() {
    const subareaSelect = document.getElementById('nuevoProdSubarea');
    if (!subareaSelect) return;
    const areaId = document.body.dataset.areaId;
    const config = window.subareasConfig || {};
    const list = areaId ? (config[areaId] || []) : [];
    if (!list.length) {
        subareaSelect.innerHTML = '<option value="">Sin subárea disponible</option>';
        subareaSelect.disabled = true;
        return;
    }
    subareaSelect.disabled = false;
    const options = list
        .map((item) => `<option value="${item.nombre}">${item.nombre}</option>`)
        .join('');
    subareaSelect.innerHTML = options;
}

async function cargarChecklistItems() {
    const container = document.getElementById('checklistItems');
    const items = await requestJSON('/api/checklist/items');
    window.visibleChecklistItems = items;
    container.innerHTML = items.map(buildChecklistItem).join('');
    return items;
}

async function cargarCatalogoChecklist() {
    const catalogo = await requestJSON('/api/checklist/catalogo');
    window.catalogItems = catalogo;
    const sugBox = document.getElementById('prod-suggestions');
    if (sugBox) {
        sugBox.innerHTML = catalogo
            .map((i) => `<button type="button" class="list-group-item list-group-item-action" data-id="${i.id_producto}">${i.nombre_producto}</button>`)
            .join('');
        sugBox.style.display = 'none';
    }
    return catalogo;
}

async function initChecklist() {
    renderSubareas();
    populateSubareaSelect();
    const container = document.getElementById('checklistItems');
    const rootEditable = typeof window !== 'undefined' ? window.checklistEditable !== false : true;
    const [items, catalogo] = await Promise.all([
        cargarChecklistItems(),
        cargarCatalogoChecklist(),
    ]);
    const pedidoIdAttr = document.body.dataset.pedidoId || document.getElementById('btnEnviarPedido')?.dataset.pedidoId;
    const currentPedidoId = pedidoIdAttr ? parseInt(pedidoIdAttr, 10) : null;
    renderArrivalPanel();

    const hiddenStorageKey = currentPedidoId ? `hiddenChecklist_${currentPedidoId}` : null;
    const hiddenProducts = new Set();
    function persistHiddenProducts() {
        if (!hiddenStorageKey) return;
        localStorage.setItem(hiddenStorageKey, JSON.stringify([...hiddenProducts]));
    }
    function loadHiddenProducts() {
        if (!hiddenStorageKey) return [];
        const stored = localStorage.getItem(hiddenStorageKey);
        if (!stored) return [];
        try {
            const parsed = JSON.parse(stored);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }
    loadHiddenProducts().forEach((prodId) => hiddenProducts.add(prodId));
    function hideChecklistCard(prodId) {
        const card = document.getElementById(`check-item-${prodId}`) || container.querySelector(`[data-card-producto="${prodId}"]`);
        if (card) {
            card.classList.add('d-none');
        }
    }
    function applyHiddenChecklistCards() {
        hiddenProducts.forEach((prodId) => hideChecklistCard(prodId));
    }
    applyHiddenChecklistCards();

    // sugerencias personalizadas con navegación por teclado
    const nombreInput = document.getElementById('nuevoProdNombre');
    const sugBox = document.getElementById('prod-suggestions');
    const cantidadInput = document.getElementById('nuevoProdCantidad');
    const quickAddPreview = document.getElementById('quickAddPreview');
    let suggestions = window.catalogItems || catalogo || [];
    let selIndex = -1;
    let selectedProductId = null;

    container.addEventListener('keydown', async (ev) => {
        if (ev.key !== 'Enter') return;
        const inp = ev.target.closest('.input-cantidad');
        if (!inp || inp.disabled) return;
        const card = inp.closest('.check-item');
        if (!card || card.dataset.cardEditable !== 'true') return;
        ev.preventDefault();
        const prodId = inp.id.replace('cantidad-','');
        const cantidad = parseFloat(inp.value || '0');
        try {
            if (!currentPedidoId) throw new Error('No se encontró el pedido actual');
            const resp = await requestJSON('/api/pedidos/solicitar', {
                method: 'POST',
                body: JSON.stringify({ pedido_id: currentPedidoId, id_producto: prodId, cantidad }),
            });
            updateCardEstado(prodId, 'Listo', { cantidad });
            applyEstadoGeneral(resp.estado || 'Pendiente');
            const inputs = [...container.querySelectorAll('.input-cantidad')];
            const idx = inputs.indexOf(inp);
            const next = idx >= 0 ? inputs[idx + 1] : null;
            if (next) next.focus();
        } catch (err) {
            alert(err.message);
        }
    });

    function updateQuickAddPreview() {
        if (!quickAddPreview) return;
        const cantidadVal = parseFloat(cantidadInput?.value || '0');
        const nombreVal = (nombreInput?.value || '').trim();
        if (cantidadVal > 0) {
            const target = nombreVal ? `"${nombreVal}"` : 'el insumo seleccionado';
            quickAddPreview.textContent = `Cantidad seleccionada para ${target}: ${cantidadVal}`;
        } else {
            quickAddPreview.textContent = '';
        }
    }

    function filterSuggestions(q) {
        const ql = (q || '').toLowerCase();
        const src = window.catalogItems || suggestions || [];
        return src.filter(s => s.nombre_producto.toLowerCase().includes(ql));
    }

    function renderSuggestions(list) {
        if (!sugBox) return;
        if (!list.length) { sugBox.style.display = 'none'; return; }
        sugBox.innerHTML = list.map((s, i) => `<button type="button" class="list-group-item list-group-item-action" data-id="${s.id_producto}" data-name="${s.nombre_producto}">${s.nombre_producto}</button>`).join('');
        selIndex = -1;
        sugBox.style.display = 'block';
    }

    function selectSuggestionByIndex(list, index) {
        const item = list[index];
        if (!item) return;
        handleSuggestionSelect(item);
    }

    function handleSuggestionSelect(item) {
        // si existe producto: rellenar campos y enfocar cantidad; si no, mostrar opciones de creación
        const prodId = item.id_producto;
        if (prodId) {
            selectedProductId = prodId;
            if (nombreInput) nombreInput.value = item.nombre_producto;
            if (sugBox) sugBox.style.display = 'none';
            if (cantidadInput) cantidadInput.focus();
            updateQuickAddPreview();
            hideCreationPanel();
        } else {
            selectedProductId = null;
            // producto no encontrado en inventario: mostrar opciones para crear
            promptMissingProduct();
        }
    }

    const newCatUnitBox = document.getElementById('newCatUnitBox');
    const passwordInput = document.getElementById('nuevoProdPassword');
        const btnAgregarChecklist = document.getElementById('btnCrearProductoChecklist');
        let creationPanelVisible = false;

    function showCreationPanel() {
        if (newCatUnitBox) newCatUnitBox.classList.add('visible');
        creationPanelVisible = true;
        if (btnAgregarChecklist) btnAgregarChecklist.style.display = 'none';
        newCatUnitBox.classList.add('visible');
        creationPanelVisible = true;
    }

    function hideCreationPanel() {
        if (newCatUnitBox) newCatUnitBox.classList.remove('visible');
        creationPanelVisible = false;
        if (btnAgregarChecklist) btnAgregarChecklist.style.display = '';
    }

    function revealNewProductCreation() {
        showCreationPanel();
        const catSel = document.getElementById('nuevoProdCategoria');
        if (catSel) catSel.focus();
    }

    function promptMissingProduct() {
        showToast('No existe producto. Pulsa "Crear producto" si quieres registrarlo.', 'warning', 5000, {
            actionText: 'Crear nuevo producto',
            onAction: revealNewProductCreation,
            autoHide: false,
        });
    }

    function resetQuickAddFields() {
        if (nombreInput) nombreInput.value = '';
        if (cantidadInput) cantidadInput.value = '';
        selectedProductId = null;
        hideCreationPanel();
        if (passwordInput) passwordInput.value = '';
        updateQuickAddPreview();
    }

    function ensureChecklistCard(prodId) {
        let card = document.getElementById(`check-item-${prodId}`);
        if (card) return card;
        const catalogo = window.catalogItems || [];
        const data = catalogo.find((item) => item.id_producto === prodId);
        if (!data) return null;
        container.insertAdjacentHTML('beforeend', buildChecklistItem(data));
        card = document.getElementById(`check-item-${prodId}`);
        if (hiddenProducts.has(prodId)) {
            hideChecklistCard(prodId);
        }
        return card;
    }

    function updateCardEstado(prodId, estado, options = {}) {
        const card = document.getElementById(`check-item-${prodId}`) || container.querySelector(`[data-card-producto="${prodId}"]`);
        if (!card) return;
        const config = CHECKLIST_ESTADO_CONFIG[estado] || CHECKLIST_ESTADO_CONFIG.Pendiente;
        const badge = card.querySelector('.estado-item');
        const input = card.querySelector('.input-cantidad');
        const btnSolicitar = card.querySelector('.btn-solicitar');
        const btnQuitar = card.querySelector('.btn-quitar');
        card.dataset.detalleEstado = estado;
        const canEdit = rootEditable && estado === 'Pendiente';
        card.dataset.cardEditable = canEdit ? 'true' : 'false';
        card.classList.remove('check-item-listo', 'check-item-locked');
        if (config.overlay) card.classList.add(config.overlay);

        if (badge) {
            badge.textContent = config.label;
            badge.dataset.estado = estado;
            badge.className = `badge ${config.badge} estado-item`;
        }
        if (input) {
            input.disabled = !canEdit;
            if (typeof options.cantidad === 'number' && !Number.isNaN(options.cantidad)) {
                input.value = options.cantidad;
            } else if (estado === 'Pendiente') {
                input.value = '';
            }
        }
        if (btnSolicitar) btnSolicitar.disabled = config.disableSolicitar || !canEdit;
        if (btnQuitar) btnQuitar.disabled = config.disableQuitar;
        syncChecklistItemState(prodId, estado);
        renderArrivalPanel();
    }

    function applyEstadoGeneral(estado) {
        const estadoTexto = document.getElementById('estadoTexto');
        const estadoGeneral = document.getElementById('estadoGeneral');
        if (estadoTexto) estadoTexto.textContent = estado;
        if (estadoGeneral) {
            estadoGeneral.classList.remove('alert-danger', 'alert-warning', 'alert-success');
            const mappedClass = estado === 'Enviado'
                ? 'alert-success'
                : (estado === 'Parcial' ? 'alert-warning' : 'alert-danger');
            estadoGeneral.classList.add(mappedClass);
        }
    }

    function stageQuantityForProduct(prodId, cantidad) {
        let input = document.getElementById(`cantidad-${prodId}`);
        if (!input) {
            const card = ensureChecklistCard(prodId);
            if (!card) {
                showToast('No se encontró el insumo en la lista actual', 'danger');
                return false;
            }
            input = card.querySelector('.input-cantidad');
        }
        const card = input.closest('.check-item');
        if (card && card.dataset.cardEditable !== 'true') {
            showToast('Ese insumo ya fue enviado', 'warning');
            return false;
        }
        input.value = cantidad;
        input.classList.add('staged');
        setTimeout(() => input.classList.remove('staged'), 600);
        input.focus();
        return true;
    }

    function markItemPending(prodId) {
        updateCardEstado(prodId, 'Pendiente');
    }

    if (nombreInput) {
        nombreInput.addEventListener('input', (ev) => {
            selectedProductId = null;
            const q = ev.target.value;
            const list = filterSuggestions(q);
            renderSuggestions(list);
            updateQuickAddPreview();
        });

        nombreInput.addEventListener('keydown', async (ev) => {
            if (!sugBox) return;
            const visible = sugBox.style.display !== 'none';
            const currentList = filterSuggestions(nombreInput.value);
            if (ev.key === 'ArrowDown') {
                ev.preventDefault();
                if (!visible) renderSuggestions(currentList);
                selIndex = Math.min(currentList.length - 1, selIndex + 1);
                // highlight
                [...sugBox.children].forEach((n, i) => n.classList.toggle('active', i === selIndex));
            } else if (ev.key === 'ArrowUp') {
                ev.preventDefault();
                selIndex = Math.max(0, selIndex - 1);
                [...sugBox.children].forEach((n, i) => n.classList.toggle('active', i === selIndex));
            } else if (ev.key === 'Enter') {
                ev.preventDefault();
                if (visible && selIndex >= 0) {
                    selectSuggestionByIndex(currentList, selIndex);
                    hideCreationPanel();
                } else {
                    // si el texto coincide exactamente con un producto, seleccionarlo
                    const exact = (window.catalogItems || suggestions || []).find(s => s.nombre_producto.toLowerCase() === nombreInput.value.trim().toLowerCase());
                    if (exact) {
                        handleSuggestionSelect(exact);
                        hideCreationPanel();
                    } else {
                        // no existe: notificar y mostrar controles para crear categoría/unidad
                        promptMissingProduct();
                    }
                }
            } else if (ev.key === 'Escape') {
                if (sugBox) sugBox.style.display = 'none';
            }
        });

        // click en sugerencia
        if (sugBox) {
            sugBox.addEventListener('click', (ev) => {
                const btn = ev.target.closest('.list-group-item');
                if (!btn) return;
                const id = btn.dataset.id;
                const name = btn.dataset.name || btn.textContent.trim();
                const found = (window.catalogItems || suggestions || []).find(s => s.id_producto === id || s.nombre_producto === name);
                if (found) handleSuggestionSelect(found);
                else {
                    promptMissingProduct();
                }
                if (newCatUnitBox && found) hideCreationPanel();
            });

            // hide on blur
            nombreInput.addEventListener('blur', () => setTimeout(() => { if (sugBox) sugBox.style.display = 'none'; }, 150));
        }
    }

    if (cantidadInput) {
        cantidadInput.addEventListener('input', updateQuickAddPreview);
        cantidadInput.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') {
                ev.preventDefault();
                const b = document.getElementById('btnCrearProductoChecklist');
                if (b) b.click();
            }
        });
    }

    // el select de subárea fue eliminado del checklist; no es necesario manejar Enter aquí

    updateQuickAddPreview();

    container.addEventListener('click', async (event) => {
        const card = event.target.closest('.check-item');
        if (!card) return;
        const removeBtn = event.target.closest('.btn-quitar');
        if (removeBtn) {
            const prodId = removeBtn.dataset.producto;
            if (!prodId) return;
            if (!hiddenProducts.has(prodId)) {
                hiddenProducts.add(prodId);
                persistHiddenProducts();
            }
            hideChecklistCard(prodId);
            showToast('Insumo oculto de la lista de hoy', 'info');
            return;
        }

        const btn = event.target.closest('.btn-solicitar');
        if (!btn) return;
    if (card.dataset.cardEditable !== 'true') return;

        const idProducto = btn.dataset.producto;
        const input = document.getElementById(`cantidad-${idProducto}`);
        const cantidad = parseFloat(input.value || '0');

        try {
            if (!currentPedidoId) throw new Error('No se encontró el pedido actual');
            const resp = await requestJSON('/api/pedidos/solicitar', {
                method: 'POST',
                body: JSON.stringify({ pedido_id: currentPedidoId, id_producto: idProducto, cantidad }),
            });
            updateCardEstado(idProducto, 'Listo', { cantidad });
            applyEstadoGeneral(resp.estado || 'Pendiente');
        } catch (error) {
            alert(error.message);
        }
    });

    const btnEnviar = document.getElementById('btnEnviarPedido');
    btnEnviar.addEventListener('click', async () => {
        if (btnEnviar.disabled) return;
        const pedidoId = parseInt(btnEnviar.dataset.pedidoId, 10);
        try {
            const res = await requestJSON('/api/pedidos/enviar', {
                method: 'POST',
                body: JSON.stringify({ pedido_id: pedidoId }),
            });
            const enviados = Array.isArray(res.enviados) ? res.enviados : [];
            if (!enviados.length) {
                showToast('No hay insumos listos para enviar', 'warning');
                return;
            }
            enviados.forEach((prodId) => updateCardEstado(prodId, 'Enviado'));
            applyEstadoGeneral(res.estado || 'Parcial');
            showToast('Pedido enviado correctamente', 'success');
        } catch (error) {
            alert(error.message);
        }
    });

    function markDetalleAsRecibido(detalleId) {
        if (!detalleId) return;
        const lista = window.visibleChecklistItems || [];
        const detalle = lista.find((item) => item.detalle_id === detalleId);
        if (detalle) {
            updateCardEstado(detalle.id_producto, 'Recibido');
        }
    }

    function signalArrivalConfirmation() {
        if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
        try {
            localStorage.setItem('checklistArrivalConfirmed', Date.now().toString());
        } catch (err) {
            console.warn('No se pudo notificar la confirmación de llegada', err);
        }
    }

    async function handleConfirmArrival() {
        if (!currentPedidoId) return showToast('No se encontró el pedido actual', 'warning');
        const checkboxes = [...document.querySelectorAll('#arrivalPanel .arrival-checkbox:checked')];
        const detalleIds = checkboxes
            .map((checkbox) => parseInt(checkbox.dataset.detalle, 10))
            .filter((id) => Number.isFinite(id));
        if (!detalleIds.length) {
            return showToast('Selecciona al menos un insumo para confirmar', 'warning');
        }
        const btn = document.getElementById('btnConfirmarLlegada');
        if (btn) btn.disabled = true;
        try {
            const resp = await requestJSON('/api/pedidos/llegada', {
                method: 'POST',
                body: JSON.stringify({ pedido_id: currentPedidoId, detalle_ids: detalleIds }),
            });
            detalleIds.forEach(markDetalleAsRecibido);
            if (resp.estado) applyEstadoGeneral(resp.estado);
            const toastMessage = resp.message || 'Llegadas confirmadas';
            const toastVariant = resp.updated === 0 ? 'info' : 'success';
            showToast(toastMessage, toastVariant);
            if (resp.updated !== 0) signalArrivalConfirmation();
        } catch (error) {
            showToast(error.message || 'Error', 'danger');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async function handleConfirmAllRecibidos() {
        if (!currentPedidoId) return showToast('No se encontró el pedido actual', 'warning');
        const btn = document.getElementById('btnConfirmarRecibidos');
        if (btn) btn.disabled = true;
        try {
            const resp = await requestJSON('/api/pedidos/confirmar-recibidos', {
                method: 'POST',
                body: JSON.stringify({ pedido_id: currentPedidoId }),
            });
            const pendientes = (window.visibleChecklistItems || []).filter(
                (item) => item.detalle_estado === 'Enviado'
            );
            pendientes.forEach((item) => updateCardEstado(item.id_producto, 'Recibido'));
            if (resp.estado) applyEstadoGeneral(resp.estado);
            const toastMessage = resp.message || 'Todos los insumos marcados como recibidos';
            const toastVariant = resp.updated === 0 ? 'info' : 'success';
            showToast(toastMessage, toastVariant);
            if (resp.updated !== 0) signalArrivalConfirmation();
        } catch (error) {
            showToast(error.message || 'Error', 'danger');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    const btnConfirmarLlegada = document.getElementById('btnConfirmarLlegada');
    const btnConfirmarRecibidos = document.getElementById('btnConfirmarRecibidos');
    if (btnConfirmarLlegada) {
        btnConfirmarLlegada.addEventListener('click', handleConfirmArrival);
    }
    if (btnConfirmarRecibidos) {
        btnConfirmarRecibidos.addEventListener('click', handleConfirmAllRecibidos);
    }

    const msg = document.getElementById('checklistMsg');
    const btnCrear = document.getElementById('btnCrearProductoChecklist');
    if (btnCrear) {
        btnCrear.addEventListener('click', async () => {
            try {
                const nombre = (nombreInput?.value || '').trim();
                if (!nombre) return showToast('Escribe el nombre del insumo', 'warning');
                const cantidad = parseFloat(cantidadInput?.value || '0');
                if (!cantidad || cantidad <= 0) return showToast('Ingresa la cantidad a solicitar', 'warning');

                const catalogo = window.catalogItems || [];
                let producto = null;
                if (selectedProductId) {
                    producto = catalogo.find((s) => s.id_producto === selectedProductId);
                }
                if (!producto) {
                    producto = catalogo.find((s) => s.nombre_producto.toLowerCase() === nombre.toLowerCase());
                }

                if (producto && producto.id_producto) {
                    const staged = stageQuantityForProduct(producto.id_producto, cantidad);
                    if (staged) {
                        showToast('Cantidad registrada. Usa el botón Solicitar cuando estés listo.', 'success');
                        resetQuickAddFields();
                    }
                    return;
                }

                // no existe: mostrar opciones para crear
                promptMissingProduct();
            } catch (error) {
                showToast(error.message || 'Error', 'danger');
            }
        });
    }

    // showToast está definido a nivel superior

    // cargar categorías y unidades para el checklist
    async function cargarCategoriasYUnidades() {
        try {
            const cats = await requestJSON('/api/catalogo/categorias');
            const unis = await requestJSON('/api/catalogo/unidades');
            const catSel = document.getElementById('nuevoProdCategoria');
            const uniSel = document.getElementById('nuevoProdUnidad');
            if (catSel) catSel.innerHTML = cats.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
            if (uniSel) uniSel.innerHTML = unis.map(u => `<option value="${u.id}">${u.nombre}</option>`).join('');
        } catch (err) {
            // ignorar; el servidor puede requerir autorización para algunos endpoints
            console.warn('No se pudieron cargar categorías/unidades:', err.message);
        }
    }

    // crear categoria/unidad desde checklist (intenta POST; si 401 sugiere usar panel Almacén)
    // Crear producto desde el checklist cuando se mostraron las opciones
    const btnCrearProdFromChecklist = document.getElementById('btnCrearProductoFromChecklist');
    if (btnCrearProdFromChecklist) {
        btnCrearProdFromChecklist.addEventListener('click', async () => {
            if (!creationPanelVisible) {
                showCreationPanel();
                return;
            }
            const nombre = (document.getElementById('nuevoProdNombre').value || '').trim();
            if (!nombre) return showToast('Nombre del producto obligatorio', 'warning');
            const catEl = document.getElementById('nuevoProdCategoria');
            const uniEl = document.getElementById('nuevoProdUnidad');
            const subEl = document.getElementById('nuevoProdSubarea');
            const payload = { nombre };
            if (catEl && catEl.value) payload.id_categoria = parseInt(catEl.value, 10);
            if (uniEl && uniEl.value) payload.id_unidad = parseInt(uniEl.value, 10);
            if (subEl) {
                const subValue = subEl.value || subEl.options[0]?.value || '';
                if (subValue) payload.subarea = subValue;
            }
            const passwordVal = (passwordInput?.value || '').trim();
            if (!passwordVal) {
                return showToast('Ingresa la contraseña del almacén para crear el producto', 'warning');
            }
            payload.password = passwordVal;
            try {
                await requestJSON('/api/checklist/productos', { method: 'POST', body: JSON.stringify(payload) });
                showToast('Producto creado', 'success');
                resetQuickAddFields();
                await cargarChecklistItems();
                renderArrivalPanel();
                await cargarCatalogoChecklist();
                suggestions = window.catalogItems || suggestions;
            } catch (err) {
                if (err.message.includes('No autorizado')) {
                    showToast('No tienes permisos para crear productos desde aquí. Usa el panel de Almacén.', 'warning');
                } else {
                    showToast(err.message || 'Error', 'danger');
                }
            }
        });
    }

    // inicializar selects
    cargarCategoriasYUnidades();
}

function rowPedidoDetalle(d) {
    const processed = !!d.check_almacen;
    const entrega = (typeof d.cantidad_entregada === 'number' && !Number.isNaN(d.cantidad_entregada))
        ? d.cantidad_entregada
        : d.cantidad_pedida;
    const checkboxAttrs = processed ? 'checked disabled' : '';
    const inputAttrs = processed ? 'readonly tabindex="-1"' : '';
    return `
        <tr data-detalle="${d.id_detalle}" data-producto="${d.id_producto}" data-cantidad-pedida="${d.cantidad_pedida}" class="${processed ? 'pedido-row-locked' : ''}">
            <td>${d.producto}</td>
            <td><span class="badge ${d.subarea_badge || 'bg-secondary'}">${d.subarea || 'Sin subárea'}</span></td>
            <td>${d.cantidad_pedida}</td>
            <td>${d.stock_central}</td>
            <td class="text-center"><input type="checkbox" class="form-check-input chk-listo" ${checkboxAttrs}></td>
            <td><input type="number" min="0" step="0.1" class="form-control form-control-sm input-entrega" value="${entrega}" ${inputAttrs}></td>
        </tr>
    `;
}

function formatCantidad(value) {
    const num = Number(value || 0);
    if (Number.isNaN(num)) return '0';
    return Number.isInteger(num) ? String(num) : num.toFixed(2);
}

function rowProcesadoDetalle(item) {
    const pedida = Number(item.cantidad_pedida || 0);
    const entregada = Number(item.cantidad_entregada || 0);
    const diferencia = entregada - pedida;
    const diffClass = diferencia === 0 ? 'text-muted' : diferencia > 0 ? 'text-success' : 'text-danger';
    const fecha = formatPedidoFecha(item.fecha);
    return `
        <tr>
            <td>${item.sede}</td>
            <td>${item.turno || 'Sin turno'}</td>
            <td>${item.producto}</td>
            <td>${formatCantidad(pedida)}</td>
            <td>${formatCantidad(entregada)}</td>
            <td class="${diffClass}">${formatCantidad(diferencia)}</td>
            <td>${fecha || '-'}</td>
        </tr>
    `;
}

function stockStatusBadge(stock, minimo) {
    const current = Number(stock || 0);
    const minVal = Number(minimo || 0);
    if (minVal <= 0) return { label: 'Sin mínimo', className: 'bg-secondary' };
    if (current <= 0) return { label: 'Sin stock', className: 'bg-danger' };
    const ratio = current / minVal;
    if (ratio <= 1) return { label: 'Crítico', className: 'bg-warning text-dark' };
    if (ratio <= 2) return { label: 'Alerta', className: 'bg-info text-dark' };
    return { label: 'Abastecido', className: 'bg-success' };
}

function formatPedidoFecha(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const day = date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' });
    const time = date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    return `${day} ${time}`;
}

function buildPedidoCard(p) {
    const enviados = p.detalles.filter((d) => d.check_almacen).length;
    const total = p.detalles.length;
    const disabled = enviados === total || !total;
    const fechaLabel = formatPedidoFecha(p.fecha);
    return `
        <div class="pedido-card" data-pedido-group="${p.id_pedido}">
            <div class="d-flex justify-content-between flex-wrap gap-2 mb-2">
                <div>
                    <div class="fw-semibold">${p.sede}</div>
                    <div class="small text-muted">${p.turno || 'Sin turno'}${fechaLabel ? ` · ${fechaLabel}` : ''}</div>
                </div>
                <div class="small text-muted align-self-center">${enviados}/${total} enviados</div>
            </div>
            <div class="table-responsive">
                <table class="table table-sm align-middle mb-2">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Subárea</th>
                            <th>Pedida</th>
                            <th>Stock Central</th>
                            <th>Listo</th>
                            <th>Entregar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${p.detalles.map((d) => rowPedidoDetalle(d)).join('')}
                    </tbody>
                </table>
            </div>
            <div class="d-flex justify-content-between align-items-center mt-2">
                <span class="small text-muted">Solo se procesan los insumos marcados.</span>
                <button class="btn btn-primary btn-procesar-grupo" data-pedido="${p.id_pedido}" ${disabled ? 'disabled' : ''}>Procesar envío</button>
            </div>
        </div>
    `;
}

function renderPedidosAlmacen(pedidos) {
    const wrapper = document.getElementById('almacenPedidosWrapper');
    if (!wrapper) return;
    if (!pedidos.length) {
        wrapper.innerHTML = '<div class="alert alert-light mb-0">No hay pedidos para esta fecha.</div>';
        return;
    }
    wrapper.innerHTML = pedidos.map((p) => buildPedidoCard(p)).join('');
}

function refreshSubareasForProduct() {
    const areaSelect = document.getElementById('prodArea');
    const subareaSelect = document.getElementById('prodSubarea');
    if (!areaSelect || !subareaSelect) return;

    const areaId = areaSelect.value;
    const list = (window.subareasConfig && window.subareasConfig[areaId]) || [];
    subareaSelect.innerHTML = list
        .map((item) => `<option value="${item.nombre}">${item.nombre}</option>`)
        .join('');
}

async function cargarPedidosAlmacen(fecha) {
    const query = fecha ? `?fecha=${encodeURIComponent(fecha)}` : '';
    const pedidos = await requestJSON(`/api/almacen/pedidos${query}`);
    renderPedidosAlmacen(pedidos);
    return pedidos;
}


async function crearCatalogo(url, payload) {
    await requestJSON(url, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

function initAlmacen() {
    refreshSubareasForProduct();
    const inventarioSearch = document.getElementById('inventarioSearch');
    const filterCategoria = document.getElementById('filterCategoria');
    const filterSubarea = document.getElementById('filterSubarea');
    const filterUnidad = document.getElementById('filterUnidad');
    if (inventarioSearch) {
        inventarioSearch.addEventListener('input', (event) => {
            inventorySearchQuery = event.target.value || '';
            applyInventoryFilter();
        });
    }
    [filterCategoria, filterSubarea, filterUnidad].forEach((select) => {
        if (!select) return;
        select.addEventListener('change', () => applyInventoryFilter());
    });

    const dateInput = document.getElementById('almacenFechaFiltro');
    const dateBtn = document.getElementById('btnAlmacenFiltrar');
    const dateLabel = document.getElementById('almacenFechaResumen');
    const arrivalAlerts = document.getElementById('arrivalAlerts');
    const arrivalAlertList = document.getElementById('arrivalAlertList');
    const btnRefreshAlertas = document.getElementById('btnRefreshAlertas');
    const btnVerProcesados = document.getElementById('btnVerProcesados');
    const procesadosModalEl = document.getElementById('modalProcesados');
    const procesadosBody = document.getElementById('procesadosBody');
    const procesadosEmpty = document.getElementById('procesadosEmpty');
    const procesadosModal = procesadosModalEl ? new bootstrap.Modal(procesadosModalEl) : null;
    const movimientosBody = document.getElementById('movimientosBody');
    const btnRefreshMovimientos = document.getElementById('btnRefreshMovimientos');
    const movimientosBtnLabel = btnRefreshMovimientos?.textContent?.trim() || 'Actualizar';
    const movimientosModalEntradas = document.getElementById('movimientosRegistradosEntradas');
    const movimientosModalSalidas = document.getElementById('movimientosRegistradosSalidas');
    const movimientosModalEl = document.getElementById('modalMovimientosRegistrados');
    const defaultDate = document.body.dataset.defaultDate || new Date().toISOString().split('T')[0];
    let selectedDate = defaultDate;
    if (dateInput && !dateInput.value) dateInput.value = defaultDate;

    const formatDateLabel = (isoDate) => {
        if (!isoDate) return '';
        const parts = isoDate.split('-');
        if (parts.length !== 3) return isoDate;
        const [year, month, day] = parts;
        return `${day}/${month}/${year}`;
    };

    const updateDateLabel = () => {
        if (dateLabel) dateLabel.textContent = formatDateLabel(selectedDate);
    };

    function renderArrivalAlerts(items) {
        if (!arrivalAlerts) return;
        if (!items.length) {
            arrivalAlerts.classList.add('d-none');
            if (arrivalAlertList) arrivalAlertList.innerHTML = '';
            return;
        }
        arrivalAlerts.classList.remove('d-none');
            if (arrivalAlertList) {
            arrivalAlertList.innerHTML = items
                .map((item) => {
                    const cantidad = formatCantidad(item.cantidad_entregada || item.cantidad_pedida);
                    const fecha = item.fecha ? formatPedidoFecha(item.fecha) : '';
                    return `
                        <li class="d-flex justify-content-between align-items-start gap-3 py-2 border-bottom">
                            <div>
                                <strong>${item.producto}</strong>
                                <div class="small text-muted">${item.sede} · ${item.turno || 'Sin turno'}</div>
                                <div class="small text-muted">${cantidad} · ${fecha || 'Fecha desconocida'}</div>
                            </div>
                            <span class="badge bg-danger">Pendiente</span>
                        </li>
                    `;
                })
                .join('');
        }
    }

    async function loadArrivalAlerts(fecha) {
        const query = fecha ? `?fecha=${encodeURIComponent(fecha)}` : '';
        try {
            const alerts = await requestJSON(`/api/almacen/alertas/llegadas${query}`);
            renderArrivalAlerts(alerts);
        } catch (error) {
            showToast(error.message || 'No se pudieron cargar las alertas', 'danger');
        }
    }

    const renderMovimientos = (items = []) => {
        if (!movimientosBody) return;
        if (!items.length) {
            movimientosBody.innerHTML = '<tr><td colspan="7" class="text-muted text-center">No hay movimientos registrados para esta fecha.</td></tr>';
            return;
        }
        movimientosBody.innerHTML = items
            .map((item) => {
                const fechaLabel = formatPedidoFecha(item.fecha);
                return `
                    <tr>
                        <td>${item.producto || '-'}</td>
                        <td class="text-capitalize">${item.tipo || '-'}</td>
                        <td>${formatCantidad(item.cantidad)}</td>
                        <td>${item.unidad || '-'}</td>
                        <td>${item.motivo || '-'}</td>
                        <td>${item.usuario || '-'}</td>
                        <td>${fechaLabel || '-'}</td>
                    </tr>
                `;
            })
            .join('');
        renderMovimientosModalTables(items);
    };

    const renderMovimientosModalTables = (items = []) => {
        if (!movimientosModalEntradas || !movimientosModalSalidas) return;
        const entradas = items.filter((item) => (item.tipo || '').toLowerCase() === 'entrada');
        const salidas = items.filter((item) => (item.tipo || '').toLowerCase() === 'salida');
        const buildRows = (collection, emptyText) => {
            if (!collection.length) {
                return `<tr><td colspan="5" class="text-muted text-center">${emptyText}</td></tr>`;
            }
            return collection
                .map((entry) => {
                    const fechaLabel = formatPedidoFecha(entry.fecha);
                    return `
                        <tr>
                            <td>${entry.producto || '-'}</td>
                            <td>${formatCantidad(entry.cantidad)}</td>
                            <td>${entry.motivo || '-'}</td>
                            <td>${entry.usuario || '-'}</td>
                            <td>${fechaLabel || '-'}</td>
                        </tr>
                    `;
                })
                .join('');
        };
        movimientosModalEntradas.innerHTML = buildRows(entradas, 'Sin entradas registradas');
        movimientosModalSalidas.innerHTML = buildRows(salidas, 'Sin salidas registradas');
    };

    const loadMovimientos = async (fecha) => {
        if (!movimientosBody) return;
        if (btnRefreshMovimientos) {
            btnRefreshMovimientos.disabled = true;
            btnRefreshMovimientos.textContent = 'Actualizando...';
        }
        try {
            const query = fecha ? `?fecha=${encodeURIComponent(fecha)}` : '';
            const items = await requestJSON(`/api/almacen/movimientos${query}`);
            renderMovimientos(items);
            return items;
        } catch (error) {
            showToast(error.message || 'No se pudieron cargar los movimientos', 'danger');
        } finally {
            if (btnRefreshMovimientos) {
                btnRefreshMovimientos.disabled = false;
                btnRefreshMovimientos.textContent = movimientosBtnLabel;
            }
        }
    };

    const reloadPedidos = async () => {
        await cargarPedidosAlmacen(selectedDate);
        await loadArrivalAlerts(selectedDate);
        await loadMovimientos(selectedDate);
        updateDateLabel();
        const url = new URL(window.location.href);
        url.searchParams.set('fecha', selectedDate);
        window.history.replaceState({}, '', url);
    };

    reloadPedidos().catch((error) => alert(error.message));

    window.addEventListener('storage', (event) => {
        if (event.key !== 'checklistArrivalConfirmed') return;
        loadArrivalAlerts(selectedDate).catch((error) => {
            console.warn('No se pudieron recargar las alertas tras confirmar llegada', error);
        });
    });

    if (movimientosModalEl) {
        movimientosModalEl.addEventListener('shown.bs.modal', () => {
            loadMovimientos(selectedDate).catch((error) => showToast(error.message || 'No se pudieron cargar los movimientos', 'danger'));
        });
    }

    const abrirProcesados = async () => {
        if (!btnVerProcesados || !procesadosBody) return;
        btnVerProcesados.disabled = true;
        btnVerProcesados.textContent = 'Cargando...';
        try {
            const query = selectedDate ? `?fecha=${encodeURIComponent(selectedDate)}` : '';
            const items = await requestJSON(`/api/almacen/procesados${query}`);
            if (!items.length) {
                procesadosBody.innerHTML = '';
                if (procesadosEmpty) procesadosEmpty.classList.remove('d-none');
            } else {
                procesadosBody.innerHTML = items.map((item) => rowProcesadoDetalle(item)).join('');
                if (procesadosEmpty) procesadosEmpty.classList.add('d-none');
            }
            procesadosModal?.show();
        } catch (error) {
            showToast(error.message || 'Error', 'danger');
        } finally {
            btnVerProcesados.disabled = false;
            btnVerProcesados.textContent = 'Ver enviados';
        }
    };

    if (dateInput) {
        dateInput.addEventListener('change', () => {
            if (dateInput.value) selectedDate = dateInput.value;
        });
    }

    if (dateBtn) {
        dateBtn.addEventListener('click', () => {
            if (dateInput && dateInput.value) selectedDate = dateInput.value;
            reloadPedidos().catch((error) => alert(error.message));
        });
    }

    if (btnVerProcesados) {
        btnVerProcesados.addEventListener('click', () => {
            abrirProcesados().catch((error) => showToast(error.message || 'Error', 'danger'));
        });
    }

    if (btnRefreshAlertas) {
        btnRefreshAlertas.addEventListener('click', () => {
            loadArrivalAlerts(selectedDate).catch((error) => showToast(error.message || 'Error', 'danger'));
        });
    }

    if (btnRefreshMovimientos) {
        btnRefreshMovimientos.addEventListener('click', () => {
            loadMovimientos(selectedDate).catch((error) => showToast(error.message || 'Error', 'danger'));
        });
    }

    const pedidosWrapper = document.getElementById('almacenPedidosWrapper');
    if (pedidosWrapper) {
        pedidosWrapper.addEventListener('click', async (event) => {
            const btn = event.target.closest('.btn-procesar-grupo');
            if (!btn) return;
            const group = btn.closest('[data-pedido-group]');
            if (!group) return;
            const pedidoId = parseInt(btn.dataset.pedido, 10);
            if (!pedidoId) {
                showToast('Pedido inválido', 'danger');
                return;
            }
            const rows = [...group.querySelectorAll('tbody tr')];
            const detalles = [];
            for (const row of rows) {
                const chk = row.querySelector('.chk-listo');
                if (!chk || chk.disabled || !chk.checked) continue;
                const idDetalle = parseInt(row.dataset.detalle, 10);
                if (!idDetalle) continue;
                const inputEntrega = row.querySelector('.input-entrega');
                if (!inputEntrega) continue;
                const rawValue = inputEntrega.value ?? '';
                let cantidad = parseFloat(rawValue);
                if (rawValue === '' || Number.isNaN(cantidad)) {
                    cantidad = parseFloat(row.dataset.cantidadPedida || '0');
                    if (!Number.isNaN(cantidad)) {
                        inputEntrega.value = cantidad;
                    }
                }
                if (Number.isNaN(cantidad) || cantidad < 0) {
                    showToast('Cantidad inválida en un insumo', 'warning');
                    return;
                }
                detalles.push({
                    id_detalle: idDetalle,
                    cantidad_entregada: cantidad,
                    check_almacen: true,
                });
            }

            if (!detalles.length) {
                showToast('Selecciona al menos un insumo para procesar', 'warning');
                return;
            }

            btn.disabled = true;
            btn.innerText = 'Procesando...';
            try {
                await requestJSON('/api/almacen/procesar', {
                    method: 'POST',
                    body: JSON.stringify({ pedido_id: pedidoId, detalles }),
                });
                showToast('Envío procesado', 'success');
                await reloadPedidos();
            } catch (error) {
                showToast(error.message || 'Error', 'danger');
            } finally {
                btn.disabled = false;
                btn.innerText = 'Procesar envío';
            }
        });
    }

    const prodArea = document.getElementById('prodArea');
    if (prodArea) {
        prodArea.addEventListener('change', refreshSubareasForProduct);
    }

    const inventoryExportBtn = document.getElementById('btnExportInventario');
    const inventoryImportBtn = document.getElementById('btnImportInventario');
    const inventoryFileInput = document.getElementById('inventarioFileInput');
    const inventoryFeedback = document.getElementById('inventoryImportFeedback');
    const exportLabel = inventoryExportBtn?.textContent?.trim() || 'Exportar Excel';
    const importLabel = inventoryImportBtn?.textContent?.trim() || 'Importar Excel';
    let inventoryFeedbackTimer;

    function showInventoryFeedback(message) {
        if (!inventoryFeedback) return;
        inventoryFeedback.textContent = message;
        inventoryFeedback.classList.remove('d-none');
        if (inventoryFeedbackTimer) {
            clearTimeout(inventoryFeedbackTimer);
        }
        inventoryFeedbackTimer = window.setTimeout(() => {
            inventoryFeedback.classList.add('d-none');
        }, 5000);
    }

    if (inventoryExportBtn) {
        inventoryExportBtn.addEventListener('click', async () => {
            inventoryExportBtn.disabled = true;
            inventoryExportBtn.textContent = 'Generando...';
            try {
                const resp = await fetch('/api/inventario/productos/export');
                if (!resp.ok) {
                    const data = await resp.json().catch(() => ({}));
                    throw new Error(data.error || 'No se pudo exportar el inventario');
                }
                const blob = await resp.blob();
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'inventario.xlsx';
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(url);
                showToast('Inventario listo para descargar', 'success');
            } catch (error) {
                showToast(error.message || 'Error', 'danger');
            } finally {
                inventoryExportBtn.disabled = false;
                inventoryExportBtn.textContent = exportLabel;
            }
        });
    }

    if (inventoryImportBtn && inventoryFileInput) {
        inventoryImportBtn.addEventListener('click', () => inventoryFileInput.click());
        inventoryFileInput.addEventListener('change', async () => {
            const file = inventoryFileInput.files?.[0];
            if (!file) return;
            inventoryImportBtn.disabled = true;
            inventoryImportBtn.textContent = 'Importando...';
            try {
                const payload = new FormData();
                payload.append('file', file);
                const resp = await fetch('/api/inventario/productos/import', {
                    method: 'POST',
                    body: payload,
                });
                const data = await resp.json().catch(() => ({}));
                if (!resp.ok) {
                    throw new Error(data.error || 'Error al importar inventario');
                }
                showToast(data.message || 'Inventario actualizado', 'success');
                showInventoryFeedback(data.message || 'Todo salió bien');
                await cargarProductosCatalogo();
            } catch (error) {
                showToast(error.message || 'Error', 'danger');
            } finally {
                inventoryImportBtn.disabled = false;
                inventoryImportBtn.textContent = importLabel;
                inventoryFileInput.value = '';
            }
        });
    }

    document.getElementById('btnCrearCategoria').addEventListener('click', async () => {
        try {
            await crearCatalogo('/api/catalogo/categorias', { nombre: document.getElementById('catNombre').value });
            showToast('Categoría creada', 'success');
            location.reload();
        } catch (error) {
            showToast(error.message || 'Error', 'danger');
        }
    });

    document.getElementById('btnCrearUnidad').addEventListener('click', async () => {
        try {
            await crearCatalogo('/api/catalogo/unidades', { nombre: document.getElementById('uniNombre').value });
            showToast('Unidad creada', 'success');
            location.reload();
        } catch (error) {
            showToast(error.message || 'Error', 'danger');
        }
    });

    document.getElementById('btnCrearProducto').addEventListener('click', async () => {
        try {
            const puntoMinInput = document.getElementById('prodPuntoMinimo');
            let puntoMinimoVal = 5;
            if (puntoMinInput && puntoMinInput.value !== '') {
                const parsed = parseFloat(puntoMinInput.value);
                if (!Number.isNaN(parsed)) puntoMinimoVal = parsed;
            }
            await crearCatalogo('/api/catalogo/productos', {
                nombre: document.getElementById('prodNombre').value,
                id_area: document.getElementById('prodArea').value,
                subarea: document.getElementById('prodSubarea').value,
                id_categoria: parseInt(document.getElementById('prodCategoria').value, 10),
                id_unidad: parseInt(document.getElementById('prodUnidad').value, 10),
                stock: parseFloat(document.getElementById('prodStock').value || '0'),
                punto_minimo: puntoMinimoVal,
            });
            showToast('Producto creado', 'success');
            location.reload();
        } catch (error) {
            showToast(error.message || 'Error', 'danger');
        }
    });

    async function cargarProductosCatalogo() {
        try {
            const productos = await requestJSON('/api/catalogo/productos');
            const body = document.getElementById('productosTableBody');
            body.innerHTML = productos.map((p) => {
                const status = stockStatusBadge(p.stock_central, p.punto_minimo);
                return `
                        <tr data-id="${p.id_producto}" data-category="${(p.categoria_nombre || '').toLowerCase()}" data-subarea="${(p.subarea || '').toLowerCase()}" data-unit="${(p.unidad_nombre || '').toLowerCase()}">
                        <td>${p.id_producto}</td>
                        <td>${p.nombre}</td>
                        <td>${p.categoria_nombre || ''}</td>
                        <td>${p.subarea || ''}</td>
                        <td>${p.unidad_nombre || ''}</td>
                        <td>${formatCantidad(p.punto_minimo)}</td>
                        <td>${formatCantidad(p.stock_central)}</td>
                        <td><span class="badge ${status.className}">${status.label}</span></td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary btn-edit-prod">Editar</button>
                            <button class="btn btn-sm btn-outline-danger btn-del-prod ms-1">Eliminar</button>
                        </td>
                    </tr>
                `;
            }).join('');
                applyInventoryFilter();

            body.querySelectorAll('.btn-edit-prod').forEach((btn) => {
                btn.addEventListener('click', async (e) => {
                    const tr = e.target.closest('tr');
                    const id = tr.dataset.id;
                    try {
                        const p = await requestJSON(`/api/catalogo/productos/${id}`);
                        // poblar modal
                        document.getElementById('modalProdId').value = p.id_producto;
                        document.getElementById('modalNombre').value = p.nombre || '';
                        // clonar opciones de selects existentes
                        document.getElementById('modalArea').innerHTML = document.getElementById('prodArea').innerHTML;
                        document.getElementById('modalCategoria').innerHTML = document.getElementById('prodCategoria').innerHTML;
                        document.getElementById('modalUnidad').innerHTML = document.getElementById('prodUnidad').innerHTML;
                        document.getElementById('modalArea').value = p.id_area || document.getElementById('modalArea').value;
                        // refrescar subareas para modal
                        const areaId = document.getElementById('modalArea').value;
                        const list = (window.subareasConfig && window.subareasConfig[areaId]) || [];
                        document.getElementById('modalSubarea').innerHTML = list.map((item) => `<option value="${item.nombre}">${item.nombre}</option>`).join('');
                        document.getElementById('modalSubarea').value = p.subarea || '';
                        document.getElementById('modalCategoria').value = p.id_categoria || document.getElementById('modalCategoria').value;
                        document.getElementById('modalUnidad').value = p.id_unidad || document.getElementById('modalUnidad').value;
                        document.getElementById('modalStock').value = p.stock_central || 0;
                        document.getElementById('modalPuntoMinimo').value = (typeof p.punto_minimo === 'number' ? p.punto_minimo : (p.punto_minimo || 0));

                        const modalEl = document.getElementById('modalEditProducto');
                        const modal = new bootstrap.Modal(modalEl);
                        modal.show();

                        // guardar handler
                        document.getElementById('modalSaveBtn').onclick = async () => {
                            try {
                                const payload = {
                                    nombre: document.getElementById('modalNombre').value,
                                    id_area: document.getElementById('modalArea').value,
                                    subarea: document.getElementById('modalSubarea').value,
                                    id_categoria: parseInt(document.getElementById('modalCategoria').value, 10),
                                    id_unidad: parseInt(document.getElementById('modalUnidad').value, 10),
                                    stock: parseFloat(document.getElementById('modalStock').value || '0'),
                                };
                                const puntoMinInput = document.getElementById('modalPuntoMinimo');
                                if (puntoMinInput && puntoMinInput.value !== '') {
                                    const parsed = parseFloat(puntoMinInput.value);
                                    if (!Number.isNaN(parsed)) {
                                        payload.punto_minimo = parsed;
                                    }
                                }
                                await requestJSON(`/api/catalogo/productos/${id}`, {
                                    method: 'PUT',
                                    body: JSON.stringify(payload),
                                });
                                    showToast('Producto actualizado', 'success');
                                await cargarProductosCatalogo();
                                modal.hide();
                            } catch (err) {
                                alert(err.message);
                            }
                        };
                        // actualizar subareas al cambiar área dentro del modal
                        document.getElementById('modalArea').addEventListener('change', (ev) => {
                            const aid = ev.target.value;
                            const l = (window.subareasConfig && window.subareasConfig[aid]) || [];
                            document.getElementById('modalSubarea').innerHTML = l.map((it) => `<option value="${it.nombre}">${it.nombre}</option>`).join('');
                        });
                    } catch (err) {
                        alert(err.message);
                    }
                });
            });

            // delete handlers
            body.querySelectorAll('.btn-del-prod').forEach((btn) => {
                btn.addEventListener('click', async (e) => {
                    const tr = e.target.closest('tr');
                    const id = tr.dataset.id;
                    if (!confirm('Eliminar producto ' + id + '? Esta acción no se puede deshacer.')) return;
                    try {
                        await requestJSON(`/api/catalogo/productos/${id}`, { method: 'DELETE' });
                        showToast('Producto eliminado', 'success');
                        await cargarProductosCatalogo();
                    } catch (err) {
                        alert(err.message);
                    }
                });
            });
        } catch (err) {
            console.error(err);
        }
    }

    // cargar lista de productos al iniciar
    cargarProductosCatalogo();
}

function applyInventoryFilter() {
    const query = inventorySearchQuery.trim().toLowerCase();
    const categoryValue = (document.getElementById('filterCategoria')?.value || '').trim().toLowerCase();
    const subareaValue = (document.getElementById('filterSubarea')?.value || '').trim().toLowerCase();
    const unitValue = (document.getElementById('filterUnidad')?.value || '').trim().toLowerCase();
    const rows = document.querySelectorAll('#productosTableBody tr');
    rows.forEach((row) => {
        const text = row.textContent.toLowerCase();
        const matchesSearch = !query || text.includes(query);
        const matchesCategory = !categoryValue || (row.dataset.category || '') === categoryValue;
        const matchesSubarea = !subareaValue || (row.dataset.subarea || '') === subareaValue;
        const matchesUnit = !unitValue || (row.dataset.unit || '') === unitValue;
        row.style.display = matchesSearch && matchesCategory && matchesSubarea && matchesUnit ? '' : 'none';
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;
    if (page === 'checklist') initChecklist().catch((error) => alert(error.message));
    if (page === 'almacen') initAlmacen();
});
