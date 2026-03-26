import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TareasService, Tarea, TareaNodo } from '../../services/tareas.service';
import { NodosService, Nodo } from '../../services/nodos.service';
interface NodoAsignado extends TareaNodo {
  nodo?: Nodo | null;  // acepta tanto undefined como null
}
@Component({
  selector: 'app-tareas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tareas.html',
  styleUrls: ['./tareas.css']
})
export class Tareas  implements OnInit {
  // Datos principales
  tareas: Tarea[] = [];
  totalRegistros: number = 0;
  loading: boolean = false;

  // Filtros
  filtros = {
    search: '',
    estado: '' as '' | 'activo' | 'inactivo',
    page: 1,
    limit: 10
  };
  totalPaginas: number = 0;

  // Modales
  mostrarModalCrear: boolean = false;
  mostrarModalEditar: boolean = false;
  mostrarModalEliminar: boolean = false;
  mostrarModalAsignar: boolean = false;
  mostrarModalVerNodos: boolean = false;
  tareaSeleccionada: Tarea | null = null;
nodosAsignados: NodoAsignado[] = [];

  // Formulario tarea
  formTarea = {
    nombre: '',
    descripcion: '',
    intervalo_ejecucion_meses: null as number | null,
    duracion_estimada_minutos: null as number | null,
    detalles: '',
    estado: true
  };

  // Para asignación masiva
  arbolNodos: Nodo[] = [];
  seleccionados = new Set<number>(); // ids de nodos seleccionados
  seleccionadosOriginal = new Set<number>(); // para comparar cambios

  constructor(
    private tareasService: TareasService,
    private nodosService: NodosService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.cargarTareas();
    await this.cargarArbolNodos();
  }

  async cargarTareas() {
    this.loading = true;
    try {
      let estadoFilter: boolean | undefined;
      if (this.filtros.estado === 'activo') estadoFilter = true;
      else if (this.filtros.estado === 'inactivo') estadoFilter = false;

      const result = await this.tareasService.getTareas({
        search: this.filtros.search || undefined,
        estado: estadoFilter,
        page: this.filtros.page,
        limit: this.filtros.limit
      });
      this.tareas = result.data;
      this.totalRegistros = result.count;
      this.totalPaginas = Math.ceil(this.totalRegistros / this.filtros.limit);
    } catch (error) {
      console.error('Error cargando tareas:', error);
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
  paginaAnterior() {
    if (this.filtros.page > 1) {
      this.filtros.page--;
      this.cargarTareas();
    }
  }

  paginaSiguiente() {
    if (this.filtros.page < this.totalPaginas) {
      this.filtros.page++;
      this.cargarTareas();
    }
  }

  irAPagina(pagina: number) {
    if (pagina >= 1 && pagina <= this.totalPaginas) {
      this.filtros.page = pagina;
      this.cargarTareas();
    }
  }

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

  aplicarFiltros() {
    this.filtros.page = 1;
    this.cargarTareas();
  }

  limpiarFiltros() {
    this.filtros = {
      search: '',
      estado: '',
      page: 1,
      limit: 10
    };
    this.cargarTareas();
  }

  // ========== CRUD TAREAS ==========
  abrirModalCrear() {
    this.formTarea = {
      nombre: '',
      descripcion: '',
      intervalo_ejecucion_meses: null,
      duracion_estimada_minutos: null,
      detalles: '',
      estado: true
    };
    this.mostrarModalCrear = true;
  }

  cerrarModalCrear() {
    this.mostrarModalCrear = false;
  }

  async crearTarea() {
    if (!this.formTarea.nombre.trim()) {
      alert('El nombre es obligatorio');
      return;
    }
    try {
      await this.tareasService.createTarea({
        nombre: this.formTarea.nombre,
        descripcion: this.formTarea.descripcion || null,
        intervalo_ejecucion_meses: this.formTarea.intervalo_ejecucion_meses,
        duracion_estimada_minutos: this.formTarea.duracion_estimada_minutos,
        detalles: this.formTarea.detalles || null,
        estado: this.formTarea.estado
      });
      this.cerrarModalCrear();
      await this.cargarTareas();
      alert('Tarea creada correctamente');
    } catch (error: any) {
      alert('Error al crear: ' + error.message);
    }
  }

  abrirModalEditar(tarea: Tarea) {
    this.tareaSeleccionada = tarea;
    this.formTarea = {
      nombre: tarea.nombre,
      descripcion: tarea.descripcion || '',
      intervalo_ejecucion_meses: tarea.intervalo_ejecucion_meses,
      duracion_estimada_minutos: tarea.duracion_estimada_minutos,
      detalles: tarea.detalles || '',
      estado: tarea.estado
    };
    this.mostrarModalEditar = true;
  }

  cerrarModalEditar() {
    this.mostrarModalEditar = false;
    this.tareaSeleccionada = null;
  }

  async guardarEdicion() {
    if (!this.tareaSeleccionada) return;
    if (!this.formTarea.nombre.trim()) {
      alert('El nombre es obligatorio');
      return;
    }
    try {
      await this.tareasService.updateTarea(this.tareaSeleccionada.id, {
        nombre: this.formTarea.nombre,
        descripcion: this.formTarea.descripcion || null,
        intervalo_ejecucion_meses: this.formTarea.intervalo_ejecucion_meses,
        duracion_estimada_minutos: this.formTarea.duracion_estimada_minutos,
        detalles: this.formTarea.detalles || null,
        estado: this.formTarea.estado
      });
      this.cerrarModalEditar();
      await this.cargarTareas();
      alert('Tarea actualizada');
    } catch (error: any) {
      alert('Error al actualizar: ' + error.message);
    }
  }

  abrirModalEliminar(tarea: Tarea) {
    this.tareaSeleccionada = tarea;
    this.mostrarModalEliminar = true;
  }

  cerrarModalEliminar() {
    this.mostrarModalEliminar = false;
    this.tareaSeleccionada = null;
  }

  async eliminarTarea() {
    if (!this.tareaSeleccionada) return;
    try {
      await this.tareasService.deleteTarea(this.tareaSeleccionada.id);
      this.cerrarModalEliminar();
      await this.cargarTareas();
      alert('Tarea eliminada');
    } catch (error: any) {
      alert('Error al eliminar: ' + error.message);
    }
  }

  // ========== ASIGNACIÓN DE TAREAS A NODOS ==========
  async abrirModalAsignar(tarea: Tarea) {
    this.tareaSeleccionada = tarea;
    // Cargar nodos actualmente asignados
    try {
      const asignaciones = await this.tareasService.getNodosByTarea(tarea.id);
      this.nodosAsignados = asignaciones;
      // Llenar Set con los ids asignados
      this.seleccionados.clear();
      asignaciones.forEach(a => this.seleccionados.add(a.nodo_id));
      this.seleccionadosOriginal = new Set(this.seleccionados);
      this.mostrarModalAsignar = true;
    } catch (error) {
      console.error('Error cargando asignaciones:', error);
      alert('Error al cargar asignaciones');
    }
  }

  cerrarModalAsignar() {
    this.mostrarModalAsignar = false;
    this.tareaSeleccionada = null;
    this.seleccionados.clear();
    this.seleccionadosOriginal.clear();
  }

  // Manejo de checkboxes en el árbol
  toggleNodo(nodo: Nodo, checked: boolean) {
    if (checked) {
      this.seleccionados.add(nodo.id);
    } else {
      this.seleccionados.delete(nodo.id);
    }
    // Opcional: también manejar hijos? No se requiere por ahora.
  }
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
  async guardarAsignaciones() {
    if (!this.tareaSeleccionada) return;
    const tareaId = this.tareaSeleccionada.id;
    // Calcular cambios
    const nuevos = [...this.seleccionados].filter(id => !this.seleccionadosOriginal.has(id));
    const removidos = [...this.seleccionadosOriginal].filter(id => !this.seleccionados.has(id));

    try {
      // Agregar nuevos
      for (const nodoId of nuevos) {
        await this.tareasService.asignarTarea(tareaId, nodoId);
      }
      // Remover los que ya no están
      for (const nodoId of removidos) {
        await this.tareasService.desasignarTarea(tareaId, nodoId);
      }
      this.cerrarModalAsignar();
      alert('Asignaciones actualizadas');
      // Si se quiere refrescar la lista de asignaciones (no necesario para tabla)
    } catch (error: any) {
      alert('Error al guardar asignaciones: ' + error.message);
    }
  }
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

async verNodosAsignados(tarea: Tarea) {
  try {
    const asignaciones = await this.tareasService.getNodosByTarea(tarea.id);
    const asignacionesEnriquecidas: NodoAsignado[] = asignaciones.map(asig => ({
      ...asig,
      nodo: this.buscarNodoEnArbol(asig.nodo_id)
    }));
    this.nodosAsignados = asignacionesEnriquecidas;
    this.tareaSeleccionada = tarea;
    this.mostrarModalVerNodos = true;
  } catch (error) {
    console.error('Error cargando nodos asignados:', error);
    alert('Error al cargar nodos asignados');
  }
}

  cerrarModalVerNodos() {
    this.mostrarModalVerNodos = false;
    this.tareaSeleccionada = null;
    this.nodosAsignados = [];
  }

  // ========== AUXILIARES ==========
  getEstadoTexto(estado: boolean): string {
    return estado ? 'Activo' : 'Inactivo';
  }

  getEstadoBadgeClass(estado: boolean): string {
    return estado ? 'estado-activo' : 'estado-inactivo';
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Para el árbol de nodos
  tieneHijos(nodo: Nodo): boolean {
    return !!(nodo.hijos && nodo.hijos.length);
  }

  trackByFn(index: number, item: any) {
    return item?.id ?? index;
  }

  // Estadísticas
  get totalActivas(): number {
    return this.tareas.filter(t => t.estado === true).length;
  }

  get totalInactivas(): number {
    return this.tareas.filter(t => t.estado === false).length;
  }
}