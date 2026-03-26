import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrdenesTrabajoService, OrdenTrabajo } from '../../services/ordenes-trabajo.service';
import { EjecucionMantenimientoService, EjecucionMantenimiento, EjecucionMantenimientoTarea, EjecucionMantenimientoProducto, EjecucionMantenimientoReemplazo } from '../../services/ejecucion-mantenimiento.service';
import { NodosService, Nodo } from '../../services/nodos.service';
import { ProductosService } from '../../services/productos.service';
import { Producto } from '../moldes/producto.model';  
import { TareasService, Tarea } from '../../services/tareas.service';

@Component({
  selector: 'app-mantenimientos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mantenimientos.html',
  styleUrls: ['./mantenimientos.css']
})
export class Mantenimientos implements OnInit {
  detalleProducto: string = '';
motivoProducto: string = '';
mostrarModalMotivoReemplazo: boolean = false;
reemplazoPendiente: any = null;
motivoReemplazo: string = '';
observacionesReemplazo: string = '';
ejecucionesDetalladas: any[] = []; 
obtenerRutaNodo(nodoId: number): string {
  const buscar = (nodos: Nodo[], camino: string[]): string | null => {
    for (const n of nodos) {
      const nuevoCamino = [...camino, n.nombre];
      if (n.id === nodoId) return nuevoCamino.join(' / ');
      if (n.hijos) {
        const resultado = buscar(n.hijos, nuevoCamino);
        if (resultado) return resultado;
      }
    }
    return null;
  };
  const ruta = buscar(this.arbolNodos, []);
  return ruta || 'Ubicación no encontrada';
}
  // Listado de órdenes
  ordenes: OrdenTrabajo[] = [];
  totalRegistros: number = 0;
  loading: boolean = false;
  filtros = {
    estado: 'pendiente', // pendiente, en_proceso, todos
    search: '',
    page: 1,
    limit: 10
  };
  totalPaginas: number = 0;

  // Modal de ejecución
  mostrarModalEjecucion: boolean = false;
  ordenSeleccionada: OrdenTrabajo | null = null;
  ejecucionActual: EjecucionMantenimiento | null = null;
  ejecucionEnCurso: boolean = false; // si ya se inició la ejecución
  ejecucionId: number | null = null;

  // Datos del formulario de ejecución
  tareasPreventivas: (Tarea & { completada: boolean; observaciones: string; fecha_fin?: string })[] = [];
  productosConsumidos: { id?: number; producto_id: number; nombre: string; cantidad: number; detalle: string; motivo: string }[] = [];
  reemplazos: { id?: number; producto_id: number; producto_nombre: string; nodo_original_id: number; nodo_original_nombre: string; nodo_reemplazo_id: number; nodo_reemplazo_nombre: string; motivo: string; observaciones: string }[] = [];
  accionesRealizadas: string = '';
  observacionesGenerales: string = '';

  // Para búsqueda de productos (insumos/repuestos)
  mostrarBuscadorProducto: boolean = false;
  tipoProductoSeleccionado: 'consumo' | 'reemplazo' = 'consumo';
  indiceEdicion: number | null = null;
  productosDisponibles: Producto[] = [];
  busquedaProducto: string = '';
  productoSeleccionado: Producto | null = null;
  cantidadSeleccionada: number = 1;

  // Para reemplazo de nodos
  mostrarBuscadorNodoOriginal: boolean = false;
  mostrarBuscadorNodoReemplazo: boolean = false;
  nodoOriginalSeleccionado: Nodo | null = null;
  nodoReemplazoSeleccionado: Nodo | null = null;
  arbolNodos: Nodo[] = [];
// Nuevas propiedades
mostrarModalHistorialEjecuciones: boolean = false;
ejecucionesHistorial: EjecucionMantenimiento[] = [];

// Método para ver ejecuciones
async verEjecuciones(orden: OrdenTrabajo) {
  try {
    const ejecuciones = await this.ejecucionService.getEjecucionesByOrden(orden.id);
    // Cargar detalles de cada ejecución
    const ejecucionesDetalladas = [];
    for (const ej of ejecuciones) {
      const detalle = await this.ejecucionService.getEjecucionById(ej.id);
      ejecucionesDetalladas.push(detalle);
    }
    this.ejecucionesDetalladas = ejecucionesDetalladas;
    this.mostrarModalHistorialEjecuciones = true;
  } catch (error) {
    console.error('Error cargando ejecuciones:', error);
    alert('Error al cargar historial de ejecuciones');
  }
}
   

  constructor(
    private ordenesService: OrdenesTrabajoService,
    private ejecucionService: EjecucionMantenimientoService,
    private nodosService: NodosService,
    private productosService: ProductosService,
    private tareasService: TareasService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.cargarOrdenes();
    await this.cargarArbolNodos();
  }

  // ==================== CARGAR DATOS INICIALES ====================
  async cargarOrdenes() {
    this.loading = true;
    try {
      let estadoFilter: string | undefined = undefined;
      if (this.filtros.estado !== 'todos') {
        estadoFilter = this.filtros.estado;
      }
      const result = await this.ordenesService.getOrdenes({
        search: this.filtros.search || undefined,
        estado: estadoFilter,
        page: this.filtros.page,
        limit: this.filtros.limit
      });
      this.ordenes = result.data;
      this.totalRegistros = result.count;
      this.totalPaginas = Math.ceil(this.totalRegistros / this.filtros.limit);
    } catch (error) {
      console.error('Error cargando órdenes:', error);
    } finally {
      this.loading = false;
    }
  }

  async cargarArbolNodos() {
    try {
      const raices = await this.nodosService.getNodosRaiz();
      const arbolesCompletos: Nodo[] = [];
      for (const raiz of raices) {
        const arbol = await this.nodosService.getArbol(raiz.id);
        arbolesCompletos.push(arbol);
      }
      this.arbolNodos = arbolesCompletos;
      this.asignarColapsado(this.arbolNodos);
    } catch (error) {
      console.error('Error cargando árbol de nodos:', error);
    }
  }

  private asignarColapsado(nodos: Nodo[]) {
    nodos.forEach(nodo => {
      nodo.colapsado = false;
      if (nodo.hijos) this.asignarColapsado(nodo.hijos);
    });
  }

  // Paginación
  paginaAnterior() { if (this.filtros.page > 1) { this.filtros.page--; this.cargarOrdenes(); } }
  paginaSiguiente() { if (this.filtros.page < this.totalPaginas) { this.filtros.page++; this.cargarOrdenes(); } }
  irAPagina(pagina: number) { if (pagina >= 1 && pagina <= this.totalPaginas) { this.filtros.page = pagina; this.cargarOrdenes(); } }
  generarRangoPaginas(): number[] {
    const paginas: number[] = [];
    const maxVisibles = 5;
    let inicio = Math.max(1, this.filtros.page - 2);
    let fin = Math.min(this.totalPaginas, inicio + maxVisibles - 1);
    if (fin - inicio + 1 < maxVisibles) {
      inicio = Math.max(1, fin - maxVisibles + 1);
    }
    for (let i = inicio; i <= fin; i++) {
      paginas.push(i);
    }
    return paginas;
  }

  aplicarFiltros() { this.filtros.page = 1; this.cargarOrdenes(); }
  limpiarFiltros() { this.filtros = { estado: 'pendiente', search: '', page: 1, limit: 10 }; this.cargarOrdenes(); }

  // ==================== INICIAR EJECUCIÓN ====================
  async iniciarEjecucion(orden: OrdenTrabajo) {
    this.ordenSeleccionada = orden;
    this.ejecucionEnCurso = false;
    this.ejecucionId = null;
    this.ejecucionActual = null;
    // Limpiar formularios
    this.tareasPreventivas = [];
    this.productosConsumidos = [];
    this.reemplazos = [];
    this.accionesRealizadas = '';
    this.observacionesGenerales = '';

    // Cargar tareas preventivas si la orden es de tipo preventivo
      if (orden.tipo === 'preventivo') {
      try {
        const tareasAsignadas = await this.tareasService.getTareasByNodo(orden.nodo_id);
        // Obtener la tarea completa para cada asignación
        const tareasCompletas: Tarea[] = [];
        for (const ta of tareasAsignadas) {
          const tareaCompleta = await this.tareasService.getTareaById(ta.tarea_id);
          tareasCompletas.push(tareaCompleta);
        }
        this.tareasPreventivas = tareasCompletas.map(t => ({
          ...t,
          completada: false,
          observaciones: '',
          fecha_fin: undefined
        }));
      } catch (error) {
        console.error('Error cargando tareas:', error);
      }
    }

    this.mostrarModalEjecucion = true;
  }

  async continuarEjecucion(ejecucionId: number, orden: OrdenTrabajo) {
    // Cargar la ejecución existente (si hay que continuar)
    try {
      const data = await this.ejecucionService.getEjecucionById(ejecucionId);
      this.ejecucionActual = data.ejecucion;
      this.ejecucionId = ejecucionId;
      this.ejecucionEnCurso = true;
      this.ordenSeleccionada = orden;

      // Cargar tareas ya completadas
       if (orden.tipo === 'preventivo') {
        const tareasAsignadas = await this.tareasService.getTareasByNodo(orden.nodo_id);
        const tareasCompletas: Tarea[] = [];
        for (const ta of tareasAsignadas) {
          const tareaCompleta = await this.tareasService.getTareaById(ta.tarea_id);
          tareasCompletas.push(tareaCompleta);
        }
        this.tareasPreventivas = tareasCompletas.map(t => {
          const yaRealizada = data.tareas.find(tarea => tarea.tarea_id === t.id);
          return {
            ...t,
            completada: !!yaRealizada,
            observaciones: yaRealizada?.observaciones || '',
            fecha_fin: yaRealizada?.fecha_ejecucion_fin || undefined
          };
        });
      }
      this.productosConsumidos = data.productos.map(p => ({
        id: p.id,
        producto_id: p.producto_id,
        nombre: p.producto_nombre || '',
        cantidad: p.cantidad,
        detalle: p.detalle || '',
        motivo: p.motivo || ''
      }));
      this.reemplazos = data.reemplazos.map(r => ({
        id: r.id,
        producto_id: r.producto_id,
        producto_nombre: r.producto_nombre || '',
        nodo_original_id: r.nodo_original_id,
        nodo_original_nombre: r.nodo_original_nombre || '',
        nodo_reemplazo_id: r.nodo_reemplazo_id,
        nodo_reemplazo_nombre: r.nodo_reemplazo_nombre || '',
        motivo: r.motivo || '',
        observaciones: r.observaciones || ''
      }));
      this.accionesRealizadas = data.ejecucion.acciones || '';
      this.observacionesGenerales = data.ejecucion.observaciones || '';

      this.mostrarModalEjecucion = true;
    } catch (error) {
      console.error('Error cargando ejecución:', error);
      alert('No se pudo cargar la ejecución');
    }
  }

  cerrarModalEjecucion() {
    this.mostrarModalEjecucion = false;
    this.ordenSeleccionada = null;
    this.ejecucionId = null;
    this.ejecucionActual = null;
  }
cerrarModalMotivoReemplazo() {
  this.mostrarModalMotivoReemplazo = false;
  this.reemplazoPendiente = null;
  this.motivoReemplazo = '';
  this.observacionesReemplazo = '';
}

confirmarReemplazo() {
  if (this.reemplazoPendiente) {
    const nuevoReemplazo = {
      ...this.reemplazoPendiente,
      motivo: this.motivoReemplazo,
      observaciones: this.observacionesReemplazo
    };
    if (this.indiceEdicion !== null) {
      this.reemplazos[this.indiceEdicion] = { ...this.reemplazos[this.indiceEdicion], ...nuevoReemplazo };
    } else {
      this.reemplazos.push(nuevoReemplazo);
    }
  }
  this.cerrarModalMotivoReemplazo();
}
  // ==================== GESTIÓN DE TAREAS ====================
 
onTareaCompletadaChange(index: number, completada: boolean) {
  this.tareasPreventivas[index].completada = completada;
  if (completada && !this.tareasPreventivas[index].fecha_fin) {
    this.tareasPreventivas[index].fecha_fin = new Date().toISOString();
  }
}
  // ==================== GESTIÓN DE PRODUCTOS (CONSUMO) ====================
 abrirBuscadorProducto(tipo: 'consumo' | 'reemplazo', indice?: number) {
  this.tipoProductoSeleccionado = tipo;
  this.indiceEdicion = indice !== undefined ? indice : null;
  this.busquedaProducto = '';
  this.productoSeleccionado = null;
  this.cantidadSeleccionada = 1;
  this.mostrarBuscadorProducto = true;
  this.buscarProductos();
}

  async buscarProductos() {
    try {
      const result = await this.productosService.getProductos({
        search: this.busquedaProducto,
        limit: 50,
        page: 1
      });
      this.productosDisponibles = result.data;
    } catch (error) {
      console.error('Error buscando productos:', error);
    }
  }

  seleccionarProducto(producto: Producto) {
    this.productoSeleccionado = producto;
  }

agregarProducto() {
  if (!this.productoSeleccionado) {
    alert('Seleccione un producto');
    return;
  }
  if (this.cantidadSeleccionada <= 0) {
    alert('Cantidad debe ser mayor a 0');
    return;
  }
  if (this.tipoProductoSeleccionado === 'consumo') {
    const nuevoProducto = {
      producto_id: this.productoSeleccionado.id,
      nombre: this.productoSeleccionado.nombre,
      cantidad: this.cantidadSeleccionada,
      detalle: this.detalleProducto,
      motivo: this.motivoProducto
    };
    if (this.indiceEdicion !== null) {
      this.productosConsumidos[this.indiceEdicion] = {
        ...this.productosConsumidos[this.indiceEdicion],
        ...nuevoProducto
      };
    } else {
      this.productosConsumidos.push(nuevoProducto);
    }
    // Reset fields
    this.detalleProducto = '';
    this.motivoProducto = '';
    this.mostrarBuscadorProducto = false;
    this.productoSeleccionado = null;
    this.cantidadSeleccionada = 1;
    this.indiceEdicion = null;
  } else {
    this.productoSeleccionadoTemp = this.productoSeleccionado;
    this.mostrarBuscadorProducto = false;
    this.abrirSeleccionNodoOriginal();
  }
}

  eliminarProducto(index: number) {
    this.productosConsumidos.splice(index, 1);
  }

  // ==================== GESTIÓN DE REEMPLAZOS ====================
  productoSeleccionadoTemp: Producto | null = null;
  reemplazoEnEdicion: any = null;

  abrirSeleccionNodoOriginal() {
    this.mostrarBuscadorNodoOriginal = true;
    this.nodoOriginalSeleccionado = null;
  }

  cerrarBuscadorNodoOriginal() {
    this.mostrarBuscadorNodoOriginal = false;
    this.nodoOriginalSeleccionado = null;
  }
async seleccionarNodoOriginal(nodo: Nodo) {
  if (!nodo.es_equipo) {
    alert('Debe seleccionar un equipo o componente');
    return;
  }
  this.nodoOriginalSeleccionado = nodo;
  this.cerrarBuscadorNodoOriginal();

  if (this.productoSeleccionadoTemp) {
    try {
      if (this.productoSeleccionadoTemp.cantidad_actual <= 0) {
        alert('El producto no tiene stock disponible');
        return;
      }

      // Crear nodo nuevo
      const nuevoNodoId = await this.nodosService.crearNodoCompletox({
        parent_id: nodo.parent_id,
        tipo_id: nodo.tipo_id,
        nombre: this.productoSeleccionadoTemp.nombre,
        part_number: this.productoSeleccionadoTemp.part_number,
        serial_number: this.productoSeleccionadoTemp.serial_number,
        codigo: this.productoSeleccionadoTemp.codigo,
        criticidad: this.productoSeleccionadoTemp.criticidad,
        cantidad_actual: 1,
        estanteria: this.productoSeleccionadoTemp.estanteria,
        precio: this.productoSeleccionadoTemp.precio,
        fecha_instalacion: new Date().toISOString(),
        observaciones_extra: this.productoSeleccionadoTemp.observaciones,
        estado: 'activo'
      });

      // Guardar datos temporales del reemplazo
      this.reemplazoPendiente = {
        producto_id: this.productoSeleccionadoTemp.id,
        producto_nombre: this.productoSeleccionadoTemp.nombre,
        nodo_original_id: nodo.id,
        nodo_original_nombre: nodo.nombre,
        nodo_reemplazo_id: nuevoNodoId,
        nodo_reemplazo_nombre: this.productoSeleccionadoTemp.nombre
      };

      // Abrir modal para motivo y observaciones
      this.mostrarModalMotivoReemplazo = true;
    } catch (error) {
      console.error('Error creando nodo nuevo:', error);
      alert('No se pudo crear el nodo de reemplazo');
    }
  } else {
    alert('Primero seleccione un producto');
  }
}
 // Método para cerrar el modal de historial
cerrarModalHistorial() {
  this.mostrarModalHistorialEjecuciones = false;
  this.ejecucionesHistorial = [];
}
  abrirSeleccionNodoReemplazo() {
    this.mostrarBuscadorNodoReemplazo = true;
    this.nodoReemplazoSeleccionado = null;
  }

  cerrarBuscadorNodoReemplazo() {
    this.mostrarBuscadorNodoReemplazo = false;
    this.nodoReemplazoSeleccionado = null;
  }

  seleccionarNodoReemplazo(nodo: Nodo) {
    if (!nodo.es_equipo) {
      alert('Debe seleccionar un equipo o componente');
      return;
    }
    this.nodoReemplazoSeleccionado = nodo;
    this.cerrarBuscadorNodoReemplazo();
    // Ahora tenemos producto, nodo original y nodo reemplazo -> crear reemplazo
    const nuevoReemplazo = {
      producto_id: this.productoSeleccionadoTemp!.id,
      producto_nombre: this.productoSeleccionadoTemp!.nombre,
      nodo_original_id: this.nodoOriginalSeleccionado!.id,
      nodo_original_nombre: this.nodoOriginalSeleccionado!.nombre,
      nodo_reemplazo_id: this.nodoReemplazoSeleccionado!.id,
      nodo_reemplazo_nombre: this.nodoReemplazoSeleccionado!.nombre,
      motivo: '',
      observaciones: ''
    };
    if (this.indiceEdicion !== null) {
      this.reemplazos[this.indiceEdicion] = { ...this.reemplazos[this.indiceEdicion], ...nuevoReemplazo };
    } else {
      this.reemplazos.push(nuevoReemplazo);
    }
    this.productoSeleccionadoTemp = null;
    this.nodoOriginalSeleccionado = null;
    this.nodoReemplazoSeleccionado = null;
    this.indiceEdicion = null;
  }

  editarReemplazo(index: number) {
    const r = this.reemplazos[index];
    this.indiceEdicion = index;
    // Buscar producto por id (necesitamos cargar producto para seleccionarlo)
    this.productosService.getProductoById(r.producto_id).then(prod => {
      this.productoSeleccionadoTemp = prod;
    }).catch(console.error);
    // Simular selección de nodos (ya tenemos los nombres, pero para el flujo hay que seleccionar nuevamente)
    this.nodoOriginalSeleccionado = { id: r.nodo_original_id, nombre: r.nodo_original_nombre } as Nodo;
    this.nodoReemplazoSeleccionado = { id: r.nodo_reemplazo_id, nombre: r.nodo_reemplazo_nombre } as Nodo;
    // Abrir directamente el selector de nodo original (o reemplazo) con preselección
    this.abrirSeleccionNodoOriginal(); // modificar según necesidad
  }

  eliminarReemplazo(index: number) {
    this.reemplazos.splice(index, 1);
  }

  // ==================== FINALIZAR EJECUCIÓN ====================
  async finalizarEjecucion() {
    if (!this.ordenSeleccionada) return;

    try {
      let ejecucionId = this.ejecucionId;

      // Si no existe ejecución aún, crear una nueva (iniciar)
      if (!ejecucionId) {
        const nuevaEjecucion = await this.ejecucionService.createEjecucion({
          orden_trabajo_id: this.ordenSeleccionada.id,
          fecha_ejecucion_inicio: new Date().toISOString(),
          fecha_ejecucion_fin: null,
          realizada_por: 'Técnico', // podríamos obtener del perfil
          acciones: this.accionesRealizadas,
          observaciones: this.observacionesGenerales,
          detalles: null
        });
        ejecucionId = nuevaEjecucion.id;
      }

      // Preparar datos para finalizar
      const tareasRealizadas = this.tareasPreventivas.filter(t => t.completada).map(t => ({
        tarea_id: t.id,
        fecha_ejecucion_fin: t.fecha_fin || new Date().toISOString(),
        observaciones: t.observaciones
      }));

      const productosConsumidos = this.productosConsumidos.map(p => ({
        producto_id: p.producto_id,
        cantidad: p.cantidad,
        detalle: p.detalle,
        motivo: p.motivo
      }));

      const reemplazosRealizados = this.reemplazos.map(r => ({
        producto_id: r.producto_id,
        nodo_original_id: r.nodo_original_id,
        nodo_reemplazo_id: r.nodo_reemplazo_id,
        motivo: r.motivo,
        observaciones: r.observaciones
      }));

      await this.ejecucionService.finalizarEjecucion(
        ejecucionId,
        this.observacionesGenerales,
        this.accionesRealizadas,
        tareasRealizadas,
        productosConsumidos,
        reemplazosRealizados
      );

      // Actualizar stock de productos (manualmente, ya que finalizarEjecucion no lo hace)
      await this.actualizarStockProductos(productosConsumidos);
      await this.actualizarStockPorReemplazos(reemplazosRealizados);

      // Actualizar estado de nodos en reemplazos (desmontar original, activar reemplazo)
      for (const reemplazo of reemplazosRealizados) {
        await this.nodosService.desactivarNodo(reemplazo.nodo_original_id);
        // No activar automáticamente el nuevo nodo porque ya debe estar activo al crearse
      }

      alert('Ejecución finalizada correctamente');
      this.cerrarModalEjecucion();
      await this.cargarOrdenes(); // refrescar lista
    } catch (error) {
      console.error('Error finalizando ejecución:', error);
      alert('Error al finalizar la ejecución');
    }
  }

  private async actualizarStockProductos(productos: any[]) {
    for (const p of productos) {
      // Obtener producto actual para saber si es seriado o no
      const producto = await this.productosService.getProductoById(p.producto_id);
      if (producto.serial_number) {
        // Producto seriado: buscar el registro específico (ya sabemos el id)
        await this.productosService.updateProducto(p.producto_id, { cantidad_actual: 0 });
        // o eliminar? Depende de la lógica, usualmente se descuenta.
      } else {
        // No seriado: restar cantidad
        const nuevaCantidad = producto.cantidad_actual - p.cantidad;
        await this.productosService.updateProducto(p.producto_id, { cantidad_actual: nuevaCantidad });
      }
    }
  }

  private async actualizarStockPorReemplazos(reemplazos: any[]) {
    for (const r of reemplazos) {
      // El producto usado como repuesto debe descontarse del stock
      const producto = await this.productosService.getProductoById(r.producto_id);
      if (producto.serial_number) {
        // Producto seriado: descontar la unidad específica
        await this.productosService.updateProducto(r.producto_id, { cantidad_actual: 0 });
      } else {
        await this.productosService.updateProducto(r.producto_id, { cantidad_actual: producto.cantidad_actual - 1 });
      }
    }
  }

  // ==================== ÁRBOL DE NODOS PARA SELECCIÓN ====================
  tieneHijos(nodo: Nodo): boolean { return !!(nodo.hijos && nodo.hijos.length); }
  trackByFn(index: number, item: any) { return item?.id ?? index; }

  // Métodos auxiliares para el template (los ya definidos)
  formatearFecha(fecha: string): string { return new Date(fecha).toLocaleString('es-ES'); }
  getColorEstado(estado: string): string {
    switch (estado) {
      case 'pendiente': return 'estado-pendiente';
      case 'en_proceso': return 'estado-proceso';
      case 'completada': return 'estado-completada';
      default: return 'estado-default';
    }
  }
}