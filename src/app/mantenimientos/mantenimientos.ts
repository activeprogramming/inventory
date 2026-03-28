import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrdenesTrabajoService, OrdenTrabajo } from '../../services/ordenes-trabajo.service';
import { EjecucionMantenimientoService, EjecucionMantenimiento, EjecucionMantenimientoTarea, EjecucionMantenimientoProducto, EjecucionMantenimientoReemplazo } from '../../services/ejecucion-mantenimiento.service';
import { NodosService, Nodo } from '../../services/nodos.service';
import { ProductosService } from '../../services/productos.service';
import { Producto } from '../moldes/producto.model';
import { TareasService, Tarea } from '../../services/tareas.service';
interface EnrichedEjecucion {
  ejecucion: EjecucionMantenimiento;
  tareas: EjecucionMantenimientoTarea[];
  productos: EjecucionMantenimientoProducto[];
  reemplazos: EjecucionMantenimientoReemplazo[];
  nodo?: Nodo | null;   // ahora acepta null
}
@Component({
  selector: 'app-mantenimientos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mantenimientos.html',
  styleUrls: ['./mantenimientos.css']
})
export class Mantenimientos implements OnInit {


// Propiedades para el modal de detalle de orden
mostrarModalDetalleOrden: boolean = false;
ordenDetalle: OrdenTrabajo | null = null;
nodoDetalleOrden: Nodo | null = null;
tareasOrden: Tarea[] = [];




  nodoDestacadoId: number | null = null;
  detalleProducto: string = '';
  motivoProducto: string = '';
  mostrarModalMotivoReemplazo: boolean = false;
  reemplazoPendiente: any = null;
  motivoReemplazo: string = '';
  observacionesReemplazo: string = '';
  ejecucionesDetalladas: EnrichedEjecucion[] = [];
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
  tareasPreventivas: (Tarea & { completada: boolean; observaciones: string; acciones: string; fecha_fin?: string })[] = [];
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










  async verDetalleOrden(orden: OrdenTrabajo) {
  this.ordenDetalle = orden;
  // Cargar información completa del nodo (campos extra)
  try {
    this.nodoDetalleOrden = await this.nodosService.getArbol(orden.nodo_id);
  } catch (error) {
    console.error('Error cargando nodo:', error);
  }
  // Cargar tareas preventivas asignadas al nodo (si es preventivo)
  if (orden.tipo === 'preventivo') {
    try {
      const asignaciones = await this.tareasService.getTareasByNodo(orden.nodo_id);
      const tareasCompletas: Tarea[] = [];
      for (const asig of asignaciones) {
        const tarea = await this.tareasService.getTareaById(asig.tarea_id);
        tareasCompletas.push(tarea);
      }
      this.tareasOrden = tareasCompletas;
    } catch (error) {
      console.error('Error cargando tareas:', error);
    }
  } else {
    this.tareasOrden = [];
  }
  this.mostrarModalDetalleOrden = true;
}

cerrarModalDetalleOrden() {
  this.mostrarModalDetalleOrden = false;
  this.ordenDetalle = null;
  this.nodoDetalleOrden = null;
  this.tareasOrden = [];
}
  // Método para ver ejecuciones
async verEjecuciones(orden: OrdenTrabajo) {
  try {
    const ejecuciones = await this.ejecucionService.getEjecucionesByOrden(orden.id);
    const ejecucionesDetalladas: EnrichedEjecucion[] = [];
    const nodo = this.buscarNodoEnArbol(orden.nodo_id);
    for (const ej of ejecuciones) {
      const detalle = await this.ejecucionService.getEjecucionById(ej.id);
      ejecucionesDetalladas.push({
        ...detalle,
        nodo: nodo
      });
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
  ) { }

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
  nodoDetalle: Nodo | null = null;





private async cargarDatosEjecucion(orden: OrdenTrabajo, ejecucionId: number | null) {
  this.ordenSeleccionada = orden;
  this.ejecucionId = ejecucionId;
  this.ejecucionEnCurso = ejecucionId !== null;

  // Limpiar formularios
  this.tareasPreventivas = [];
  this.productosConsumidos = [];
  this.reemplazos = [];
  this.accionesRealizadas = '';
  this.observacionesGenerales = '';

  // Obtener datos completos del nodo (incluye campos extra)
  try {
    this.nodoDetalle = await this.nodosService.getArbol(orden.nodo_id);
  } catch (error) {
    console.error('Error cargando nodo:', error);
  }

  // Si hay una ejecución existente, cargar sus datos
  if (ejecucionId) {
    try {
      const data = await this.ejecucionService.getEjecucionById(ejecucionId);
      this.ejecucionActual = data.ejecucion;

      // Cargar tareas ya completadas (si es preventivo)
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
            acciones: yaRealizada?.acciones || '',
            fecha_fin: yaRealizada?.fecha_ejecucion_fin || undefined,
            bloqueada: !!yaRealizada
          };
        });
      }

      // Productos consumidos
      this.productosConsumidos = data.productos.map(p => ({
        id: p.id,
        producto_id: p.producto_id,
        nombre: p.producto_nombre || '',
        cantidad: p.cantidad,
        detalle: p.detalle || '',
        motivo: p.motivo || ''
      }));

      // Reemplazos realizados
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

    } catch (error) {
      console.error('Error cargando ejecución:', error);
      alert('No se pudo cargar la ejecución');
    }
  } else {
    // Nueva ejecución: cargar tareas preventivas pendientes (si es preventivo)
    if (orden.tipo === 'preventivo') {
      try {
        const tareasAsignadas = await this.tareasService.getTareasByNodo(orden.nodo_id);
        const tareasCompletas: Tarea[] = [];
        for (const ta of tareasAsignadas) {
          const tareaCompleta = await this.tareasService.getTareaById(ta.tarea_id);
          tareasCompletas.push(tareaCompleta);
        }
        this.tareasPreventivas = tareasCompletas.map(t => ({
          ...t,
          completada: false,
          observaciones: '',
          acciones: '',
          fecha_fin: undefined,
          bloqueada: false
        }));
      } catch (error) {
        console.error('Error cargando tareas:', error);
      }
    }
  }

  this.mostrarModalEjecucion = true;
}

async iniciarEjecucion(orden: OrdenTrabajo) {
  // Verificar si ya existe una ejecución abierta
  const ejecucionExistente = await this.ejecucionService.getOpenEjecucionByOrden(orden.id);
  if (ejecucionExistente) {
    alert('Ya existe una ejecución en curso para esta orden. Se abrirá la ejecución existente.');
    await this.continuarEjecucion(orden);
    return;
  }

  const confirmar = confirm('No se podrá modificar ni actualizar la fecha y hora de inicio una vez que acepte. ¿Desea continuar?');
  if (!confirmar) return;

  try {
    // Crear la ejecución con fecha de inicio actual
    const nuevaEjecucion = await this.ejecucionService.createEjecucion({
      orden_trabajo_id: orden.id,
      fecha_ejecucion_inicio: new Date().toISOString(),
      fecha_ejecucion_fin: null,
      realizada_por: 'Técnico', // podríamos obtener del perfil
      acciones: null,
      observaciones: null,
      detalles: null
    });

    // Actualizar estado de la orden a 'en_proceso'
    await this.ordenesService.updateOrden(orden.id, { estado: 'en_proceso' });

    // Refrescar la lista de órdenes para que el botón cambie a "Continuar"
    await this.cargarOrdenes();

    // Abrir el modal con la ejecución recién creada
    await this.cargarDatosEjecucion(orden, nuevaEjecucion.id);

  } catch (error) {
    console.error('Error iniciando ejecución:', error);
    alert('Error al iniciar la ejecución');
  }
}
async continuarEjecucion(orden: OrdenTrabajo) {
  try {
    const ejecucionId = await this.ejecucionService.getOpenEjecucionByOrden(orden.id);
    if (!ejecucionId) {
      alert('No hay una ejecución en curso para esta orden');
      return;
    }
    await this.cargarDatosEjecucion(orden, ejecucionId);
  } catch (error) {
    console.error('Error cargando ejecución para continuar:', error);
    alert('Error al cargar la ejecución');
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
      producto_id: this.reemplazoPendiente.producto_id,
      producto_nombre: this.reemplazoPendiente.producto_nombre,
      nodo_original_id: this.reemplazoPendiente.nodo_original_id,
      nodo_original_nombre: this.reemplazoPendiente.nodo_original_nombre,
      nodo_reemplazo_id: this.reemplazoPendiente.nodo_reemplazo_id,
      nodo_reemplazo_nombre: this.reemplazoPendiente.nodo_reemplazo_nombre,
      motivo: this.motivoReemplazo,
      observaciones: this.observacionesReemplazo
    };
    if (this.indiceEdicion !== null) {
      this.reemplazos[this.indiceEdicion] = { ...this.reemplazos[this.indiceEdicion], ...nuevoReemplazo };
    } else {
      this.reemplazos.push(nuevoReemplazo);
    }
    this.cerrarModalMotivoReemplazo();
  }
}
  // ==================== GESTIÓN DE TAREAS ====================

async onTareaCompletadaChange(index: number, completada: boolean) {
  const tarea = this.tareasPreventivas[index];
  if (completada && !tarea.completada) {
    if (!this.ejecucionId) {
      alert('Primero debe iniciar la ejecución');
      return;
    }
    const confirmar = confirm('¿Guardar esta tarea como completada?');
    if (!confirmar) return;

    try {
      // Guardar en ejecucion_mantenimiento_tarea
      await this.ejecucionService.addTarea(this.ejecucionId, tarea.id, {
        fecha_ejecucion_fin: new Date().toISOString(),
        observaciones: tarea.observaciones,
        acciones: tarea.acciones
      });

      // Actualizar última ejecución en tarea_nodo usando el servicio
      await this.ejecucionService.updateTareaNodoUltimaEjecucion(tarea.id, this.ordenSeleccionada!.nodo_id);

      // Actualizar estado local
      tarea.completada = true;
      tarea.fecha_fin = new Date().toISOString();
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error guardando tarea:', error);
      alert('Error al guardar la tarea');
    }
  }
}




// En la parte donde se manejan productos (dentro de la clase Mantenimientos)
 
private buscarNodoEnArbol(id: number): Nodo | null {
  const buscar = (nodos: Nodo[]): Nodo | null => {
    for (const n of nodos) {
      if (n.id === id) return n;
      if (n.hijos) {
        const encontrado = buscar(n.hijos);
        if (encontrado) return encontrado;
      }
    }
    return null;
  };
  return buscar(this.arbolNodos);
}
async eliminarProducto(index: number) {
  const prod = this.productosConsumidos[index];
  if (prod.id) {
    try {
      await this.ejecucionService.removeProducto(prod.id);
      this.productosConsumidos.splice(index, 1);
    } catch (error) {
      console.error('Error eliminando producto:', error);
      alert('Error al eliminar producto');
    }
  } else {
    this.productosConsumidos.splice(index, 1);
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
async agregarProducto() {
  if (!this.productoSeleccionado) {
    alert('Seleccione un producto');
    return;
  }
  if (this.cantidadSeleccionada <= 0) {
    alert('Cantidad debe ser mayor a 0');
    return;
  }
  if (this.tipoProductoSeleccionado === 'consumo') {
    try {
      // Guardar inmediatamente en BD
      const nuevo = await this.ejecucionService.addProducto(
        this.ejecucionId!,
        this.productoSeleccionado.id,
        this.cantidadSeleccionada,
        this.detalleProducto,
        this.motivoProducto
      );
      // Agregar al array local con el ID devuelto
      this.productosConsumidos.push({
        id: nuevo.id,
        producto_id: nuevo.producto_id,
        nombre: this.productoSeleccionado.nombre,
        cantidad: nuevo.cantidad,
        detalle: nuevo.detalle || '',
        motivo: nuevo.motivo || ''
      });
      // Reset campos
      this.detalleProducto = '';
      this.motivoProducto = '';
      this.mostrarBuscadorProducto = false;
      this.productoSeleccionado = null;
      this.cantidadSeleccionada = 1;
      this.indiceEdicion = null;
    } catch (error) {
      console.error('Error guardando producto:', error);
      alert('Error al guardar el producto');
    }
  } else {
    this.productoSeleccionadoTemp = this.productoSeleccionado;
    this.mostrarBuscadorProducto = false;
    this.abrirSeleccionNodoOriginal();
  }
}
 

  // ==================== GESTIÓN DE REEMPLAZOS ====================
  productoSeleccionadoTemp: Producto | null = null;
  reemplazoEnEdicion: any = null;

abrirSeleccionNodoOriginal() {
  this.nodoDestacadoId = this.ordenSeleccionada?.nodo_id ?? null; // guarda el ID del nodo de la orden
  this.mostrarBuscadorNodoOriginal = true;
  this.nodoOriginalSeleccionado = null;
}
  cerrarBuscadorNodoOriginal() {
  this.mostrarBuscadorNodoOriginal = false;
  this.nodoOriginalSeleccionado = null;
  this.nodoDestacadoId = null; // limpia el resaltado
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

async eliminarReemplazo(index: number) {
  const reemp = this.reemplazos[index];
  if (reemp.id) {
    try {
      await this.ejecucionService.removeReemplazo(reemp.id);
      this.reemplazos.splice(index, 1);
    } catch (error) {
      console.error('Error eliminando reemplazo:', error);
      alert('Error al eliminar reemplazo');
    }
  } else {
    this.reemplazos.splice(index, 1);
  }
}
  // ==================== FINALIZAR EJECUCIÓN ====================
async finalizarEjecucion() {
  if (!this.ordenSeleccionada || !this.ejecucionId) {
    alert('No hay una ejecución en curso');
    return;
  }

  try {
    // Los productos ya se guardaron individualmente, los reemplazos se guardan ahora
    await this.ejecucionService.finalizarEjecucion(
      this.ejecucionId,
      this.observacionesGenerales,
      this.accionesRealizadas,
      [],                       // tareas ya guardadas individualmente
      [],                       // productos ya guardados individualmente
      this.reemplazos           // reemplazos pendientes se guardan aquí
    );

    // Actualizar stock (descuento)
    await this.actualizarStockProductos(this.productosConsumidos);
    await this.actualizarStockPorReemplazos(this.reemplazos);
    for (const reemplazo of this.reemplazos) {
      await this.nodosService.desactivarNodo(reemplazo.nodo_original_id);
    }

    alert('Ejecución finalizada correctamente');
    this.cerrarModalEjecucion();
    await this.cargarOrdenes();
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