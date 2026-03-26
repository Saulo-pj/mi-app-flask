from __future__ import annotations

from datetime import date, datetime
from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
    func,
    inspect,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Sede(Base):
    __tablename__ = "Sedes"

    ID_Sede: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    Nombre_Sede: Mapped[str] = mapped_column(String, nullable=False)


class Area(Base):
    __tablename__ = "Areas"

    ID_Area: Mapped[str] = mapped_column(String, primary_key=True)
    Nombre_Area: Mapped[str] = mapped_column(String, nullable=False)


class Turno(Base):
    __tablename__ = "Turnos"

    ID_Turno: Mapped[str] = mapped_column(String, primary_key=True)
    Nombre_Turno: Mapped[str] = mapped_column(String, nullable=False)


class Categoria(Base):
    __tablename__ = "Categorias"

    ID_Categoria: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    Nombre_Categoria: Mapped[str] = mapped_column(String, nullable=False)


class Unidad(Base):
    __tablename__ = "Unidades"

    ID_Unidad: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    Nombre_Unidad: Mapped[str] = mapped_column(String, nullable=False)


class Producto(Base):
    __tablename__ = "Productos"

    ID_Producto: Mapped[str] = mapped_column(String, primary_key=True)
    Nombre_Producto: Mapped[str] = mapped_column(String, nullable=False)
    ID_Area: Mapped[str | None] = mapped_column(ForeignKey("Areas.ID_Area"))
    Subarea: Mapped[str | None] = mapped_column(String)
    ID_Categoria: Mapped[int | None] = mapped_column(ForeignKey("Categorias.ID_Categoria"))
    ID_Unidad: Mapped[int | None] = mapped_column(ForeignKey("Unidades.ID_Unidad"))
    Estado: Mapped[str] = mapped_column(String, default="Activo")


class InventarioSede(Base):
    __tablename__ = "Inventario_Sedes"

    ID_Sede: Mapped[int] = mapped_column(ForeignKey("Sedes.ID_Sede"), primary_key=True)
    ID_Producto: Mapped[str] = mapped_column(ForeignKey("Productos.ID_Producto"), primary_key=True)
    Stock_Actual: Mapped[float] = mapped_column(Float, default=0)
    Punto_Minimo: Mapped[float] = mapped_column(Float, default=0)


class Movimiento(Base):
    __tablename__ = "Movimientos"

    ID_Movimiento: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    Tipo: Mapped[str] = mapped_column(String, nullable=False)
    ID_Producto: Mapped[str] = mapped_column(ForeignKey("Productos.ID_Producto"), nullable=False)
    Cantidad: Mapped[float] = mapped_column(Float, nullable=False)
    Motivo: Mapped[str] = mapped_column(String, nullable=False)
    Usuario: Mapped[str | None] = mapped_column(String, default="")
    Fecha: Mapped[datetime] = mapped_column(DateTime, default=func.now())


class ChecklistPedido(Base):
    __tablename__ = "Checklist_Pedidos"

    ID_Pedido: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ID_Sede: Mapped[int] = mapped_column(ForeignKey("Sedes.ID_Sede"))
    ID_Turno: Mapped[str] = mapped_column(ForeignKey("Turnos.ID_Turno"))
    ID_Area: Mapped[str] = mapped_column(ForeignKey("Areas.ID_Area"))
    ID_Usuario: Mapped[str] = mapped_column(String, default="sin_usuario")
    Fecha: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    Estado_General: Mapped[str] = mapped_column(String, default="Pendiente")

    detalles: Mapped[list[DetallePedido]] = relationship(
        back_populates="pedido", cascade="all, delete-orphan"
    )


class DetallePedido(Base):
    __tablename__ = "Detalle_Pedido"

    ID_Detalle: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ID_Pedido: Mapped[int] = mapped_column(ForeignKey("Checklist_Pedidos.ID_Pedido"))
    ID_Producto: Mapped[str] = mapped_column(ForeignKey("Productos.ID_Producto"))
    Cantidad_Pedida: Mapped[float] = mapped_column(Float, default=0)
    Check_Almacen: Mapped[int] = mapped_column(Integer, default=0)
    Cantidad_Entregada: Mapped[float] = mapped_column(Float, default=0)
    Estado_Sede: Mapped[str] = mapped_column(String, default="Pendiente")

    pedido: Mapped[ChecklistPedido] = relationship(back_populates="detalles")


class ChecklistProductoOculto(Base):
    __tablename__ = "Checklist_Productos_Ocultos"

    ID_Sede: Mapped[int] = mapped_column(ForeignKey("Sedes.ID_Sede"), primary_key=True)
    ID_Area: Mapped[str] = mapped_column(ForeignKey("Areas.ID_Area"), primary_key=True)
    ID_Producto: Mapped[str] = mapped_column(ForeignKey("Productos.ID_Producto"), primary_key=True)
    Fecha_Oculto: Mapped[datetime] = mapped_column(DateTime, default=func.now())


class ChecklistHistorico(Base):
    __tablename__ = "Checklist_Historico"

    ID_Historico: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    Fecha: Mapped[date] = mapped_column(Date, nullable=False)
    ID_Sede: Mapped[int] = mapped_column(ForeignKey("Sedes.ID_Sede"))
    ID_Area: Mapped[str] = mapped_column(ForeignKey("Areas.ID_Area"))
    ID_Producto: Mapped[str] = mapped_column(ForeignKey("Productos.ID_Producto"))
    Nombre_Producto: Mapped[str] = mapped_column(String, nullable=False)


class CierreCaja(Base):
    __tablename__ = "Cierres_Caja"

    ID_Cierre: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    Fecha: Mapped[date] = mapped_column(Date, nullable=False)
    ID_Sede: Mapped[int] = mapped_column(ForeignKey("Sedes.ID_Sede"), nullable=False)
    ID_Turno: Mapped[str] = mapped_column(ForeignKey("Turnos.ID_Turno"), nullable=False)
    Monto_Inicial: Mapped[float] = mapped_column(Float, default=0)
    Total_Gastos: Mapped[float] = mapped_column(Float, default=0)
    Gastos_Detalle: Mapped[str] = mapped_column(Text, default="[]")
    POS: Mapped[float] = mapped_column(Float, default=0)
    Yape: Mapped[float] = mapped_column(Float, default=0)
    Plin: Mapped[float] = mapped_column(Float, default=0)
    Efectivo: Mapped[float] = mapped_column(Float, default=0)
    Venta_Sistema: Mapped[float] = mapped_column(Float, default=0)
    Observaciones: Mapped[str] = mapped_column(String, default="")
    Total_Actual: Mapped[float] = mapped_column(Float, default=0)
    Diferencia: Mapped[float] = mapped_column(Float, default=0)


class Ajuste(Base):
    __tablename__ = "Ajustes"

    Clave: Mapped[str] = mapped_column(String, primary_key=True)
    Valor: Mapped[str] = mapped_column(String, nullable=False)


def get_engine(db_path: str = "sqlite:///database.db"):
    return create_engine(db_path, echo=False, future=True)


def init_db(engine) -> None:
    Base.metadata.create_all(engine)
    with engine.connect() as conn:
        inspector = inspect(engine)
        columns = [col["name"] for col in inspector.get_columns("Productos")]
        if "ID_Area" not in columns:
            conn.execute(text("ALTER TABLE Productos ADD COLUMN ID_Area TEXT"))
        if "Subarea" not in columns:
            conn.execute(text("ALTER TABLE Productos ADD COLUMN Subarea TEXT"))
        detalle_columns = [col["name"] for col in inspector.get_columns("Detalle_Pedido")]
        if "Estado_Sede" not in detalle_columns:
            conn.execute(text("ALTER TABLE Detalle_Pedido ADD COLUMN Estado_Sede TEXT DEFAULT 'Pendiente'"))
        conn.commit()


def seed_data(session: Session) -> None:
    expected_sedes = {1: "Almacén Central", 17: "Sede 17", 20: "Sede 20"}
    expected_areas = {"COC": "Cocina", "SAL": "Salón"}
    expected_turnos = {"DIA": "Día", "NOC": "Noche"}

    current_sedes = {s.ID_Sede: s.Nombre_Sede for s in session.query(Sede).all()}
    current_areas = {a.ID_Area: a.Nombre_Area for a in session.query(Area).all()}
    current_turnos = {t.ID_Turno: t.Nombre_Turno for t in session.query(Turno).all()}

    data_matches = (
        current_sedes == expected_sedes
        and current_areas == expected_areas
        and current_turnos == expected_turnos
    )

    if current_sedes and not data_matches:
        session.query(DetallePedido).delete()
        session.query(ChecklistPedido).delete()
        session.query(InventarioSede).delete()
        session.query(Producto).delete()
        session.query(Categoria).delete()
        session.query(Unidad).delete()
        session.query(Area).delete()
        session.query(Turno).delete()
        session.query(Sede).delete()
        session.query(CierreCaja).delete()
        session.commit()

    if data_matches and session.query(Producto).count() > 0:
        return

    sede_central = Sede(ID_Sede=1, Nombre_Sede="Almacén Central")
    sede_17 = Sede(ID_Sede=17, Nombre_Sede="Sede 17")
    sede_20 = Sede(ID_Sede=20, Nombre_Sede="Sede 20")

    areas = [
        Area(ID_Area="COC", Nombre_Area="Cocina"),
        Area(ID_Area="SAL", Nombre_Area="Salón"),
    ]
    turnos = [
        Turno(ID_Turno="DIA", Nombre_Turno="Día"),
        Turno(ID_Turno="NOC", Nombre_Turno="Noche"),
    ]
    categorias = [Categoria(Nombre_Categoria="Preparados"), Categoria(Nombre_Categoria="Secos")]
    unidades = [Unidad(Nombre_Unidad="kg"), Unidad(Nombre_Unidad="unidad")]

    session.add_all([sede_central, sede_17, sede_20, *areas, *turnos, *categorias, *unidades])
    session.flush()

    productos = [
        Producto(
            ID_Producto="PROD0001",
            Nombre_Producto="Frejol Preparado",
            ID_Area="COC",
            Subarea="Cocina caliente",
            ID_Categoria=categorias[0].ID_Categoria,
            ID_Unidad=unidades[0].ID_Unidad,
        ),
        Producto(
            ID_Producto="PROD0002",
            Nombre_Producto="Lechuga Lavada",
            ID_Area="COC",
            Subarea="Cocina fría",
            ID_Categoria=categorias[0].ID_Categoria,
            ID_Unidad=unidades[0].ID_Unidad,
        ),
        Producto(
            ID_Producto="PROD0003",
            Nombre_Producto="Detergente",
            ID_Area="COC",
            Subarea="Lavadero",
            ID_Categoria=categorias[1].ID_Categoria,
            ID_Unidad=unidades[1].ID_Unidad,
        ),
        Producto(
            ID_Producto="PROD0004",
            Nombre_Producto="Mise en Place Base",
            ID_Area="COC",
            Subarea="Mise en place",
            ID_Categoria=categorias[0].ID_Categoria,
            ID_Unidad=unidades[0].ID_Unidad,
        ),
        Producto(
            ID_Producto="PROD0005",
            Nombre_Producto="Servilletas",
            ID_Area="SAL",
            Subarea="Salón",
            ID_Categoria=categorias[1].ID_Categoria,
            ID_Unidad=unidades[1].ID_Unidad,
        ),
    ]
    session.add_all(productos)
    session.flush()

    inventario = []
    for producto in productos:
        inventario.append(
            InventarioSede(
                ID_Sede=1,
                ID_Producto=producto.ID_Producto,
                Stock_Actual=150,
                Punto_Minimo=20,
            )
        )
        inventario.append(
            InventarioSede(
                ID_Sede=20,
                ID_Producto=producto.ID_Producto,
                Stock_Actual=0,
                Punto_Minimo=5,
            )
        )
        inventario.append(
            InventarioSede(
                ID_Sede=17,
                ID_Producto=producto.ID_Producto,
                Stock_Actual=0,
                Punto_Minimo=5,
            )
        )

    session.add_all(inventario)
    session.commit()
