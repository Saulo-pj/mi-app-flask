# Restaurante App (Flask + SQLite)

Aplicación web para pedidos internos entre sedes y almacén central.

## Stack
- Backend: Flask + SQLAlchemy + SQLite
- Frontend: HTML + Bootstrap + JavaScript (fetch/AJAX)
- Base de datos: `database.db` (se crea automáticamente)

## Estructura
- `app.py`: rutas web y API
- `models.py`: esquema relacional en SQLAlchemy
- `templates/login.html`: acceso por perfil
- `templates/checklist.html`: vista celular (sede/turno/área)
- `templates/almacen.html`: panel de despacho y catálogo
- `static/js/main.js`: lógica de botones sin recarga
- `static/css/style.css`: estilos

## Flujo principal
1. Usuario de sede entra por `Login` con sede + turno + área.
2. En checklist solicita productos por cantidad.
3. Presiona `Enviar Pedido`.
4. Almacén central visualiza pedidos, marca `Listo`, define cantidad entregada y procesa.
5. El sistema ejecuta transacción:
   - Resta stock en sede central (`ID_Sede=1`)
   - Suma stock en sede solicitante.

## Ejecución local
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```
Abrir: `http://127.0.0.1:5000`

## Datos iniciales
Al primer arranque se generan:
- Sede `1`: Almacén Central
- Sedes `20` y `30`
- Áreas y turnos de ejemplo
- Productos demo y stock inicial

## Subir a GitHub
```bash
git init
git add .
git commit -m "MVP restaurante app"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/restaurante_app.git
git push -u origin main
```

## Despliegue en PythonAnywhere (Flask)
1. Crear cuenta y abrir consola Bash.
2. Clonar repo:
```bash
git clone https://github.com/TU_USUARIO/restaurante_app.git
cd restaurante_app
```
3. Crear virtualenv e instalar:
```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
4. En la pestaña **Web**, crear una app Flask manual y apuntar al archivo WSGI.
5. En WSGI, cargar tu app así:
```python
import sys
path = '/home/TU_USUARIO/restaurante_app'
if path not in sys.path:
    sys.path.append(path)

from app import app as application
```
6. Recargar la app web desde PythonAnywhere.

## Nota de producción
- Cambiar `SECRET_KEY` por variable de entorno real.
- Para múltiples sedes y concurrencia alta, migrar a PostgreSQL/MySQL.
