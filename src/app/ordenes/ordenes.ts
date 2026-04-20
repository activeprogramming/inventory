import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrdenesTrabajoService, OrdenTrabajo } from '../../services/ordenes-trabajo.service';
import { NodosService, Nodo } from '../../services/nodos.service';
import { IncidenciasService } from '../../services/incidencias.service';
import { TareasService, Tarea } from '../../services/tareas.service';
import { AuthService } from '../../services/auth.service';
import { UsuariosService } from '../../services/usuarios.service';
@Component({
  selector: 'app-ordenes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ordenes.html',
  styleUrls: ['./ordenes.css']
})
export class Ordenes implements OnInit {
    userPrivileges: string[] = [];
  tareasDeOrden: Tarea[] = [];
  userName: string = 'Usuario';
  async cargarDatosUsuario() {
    try {
      // Obtener sesión actual
      const session = await this.authService.getCurrentSession();

      if (!session?.user) {
        return;
      }

      const userId = session.user.id;

      // Obtener el perfil del usuario
      const perfil = await this.usuariosService.getUsuarioById(userId);

      // Asignar el nombre
      if (perfil?.nombre_completo) {
        this.userName = perfil.nombre_completo;
      }


    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  }
  // Propiedades adicionales
nodoDetalle: Nodo | null = null;
// Dentro de la clase Ordenes, añade este método:
obtenerRutaNodo(nodoId: number): string {
  const buscarRuta = (nodos: Nodo[], camino: string[]): string | null => {
    for (const n of nodos) {
      const nuevoCamino = [...camino, n.nombre];
      if (n.id === nodoId) {
        return nuevoCamino.join(' / ');
      }
      if (n.hijos) {
        const resultado = buscarRuta(n.hijos, nuevoCamino);
        if (resultado) return resultado;
      }
    }
    return null;
  };
  const ruta = buscarRuta(this.arbolNodos, []);
  return ruta || 'Ubicación no encontrada';
}

  tienePrivilegio(privilegeCode: string): boolean {
    return this.userPrivileges.includes(privilegeCode);
  }

// Método para buscar un nodo por ID en el árbol cargado
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
  // En la clase, añade estas propiedades y métodos
mostrarModalIncidencia: boolean = false;
incidenciaDetalle: any = null;

async verIncidencia(orden: OrdenTrabajo) {
  if (!orden.incidencia_id) {
    alert('Esta orden no tiene incidencia asociada');
    return;
  }
  try {
    const incidencia = await this.incidenciasService.getIncidenciaById(orden.incidencia_id);
    this.incidenciaDetalle = incidencia;
    this.mostrarModalIncidencia = true;
  } catch (error) {
    console.error('Error cargando incidencia:', error);
    alert('Error al cargar la incidencia');
  }
}

cerrarModalIncidencia() {
  this.mostrarModalIncidencia = false;
  this.incidenciaDetalle = null;
}
  // Datos principales
  ordenes: OrdenTrabajo[] = [];
  totalRegistros: number = 0;
  loading: boolean = false;

  // Filtros
  filtros = {
    search: '',
    estado: '',
    tipo: '',
    nodo_id: null as number | null,
    fecha_desde: '',
    fecha_hasta: '',
    page: 1,
    limit: 10
  };
  totalPaginas: number = 0;

  // Opciones para selects
  estadosDisponibles = [
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'en_proceso', label: 'En proceso' },
    { value: 'solucionada', label: 'solucionada' },
    { value: 'cancelada', label: 'Cancelada' }
  ];
  tiposDisponibles = [
    { value: 'correctivo', label: 'Correctivo' },
    { value: 'preventivo', label: 'Preventivo' }
  ];

  // Modales
  mostrarModalCrear: boolean = false;
  mostrarModalDetalle: boolean = false;
  mostrarModalEditar: boolean = false;
  mostrarModalEliminar: boolean = false;
  ordenSeleccionada: OrdenTrabajo | null = null;

  // Datos para crear orden (preventiva)
  nuevaOrden = {
    nodo_id: 0,
    nodo_nombre: '',
    descripcion: '',
    tecnico_asignado: '',
    observaciones: ''
  };

  // Datos para editar orden
  editarOrden = {
    descripcion: '',
    estado: '',
    tecnico_asignado: '',
    observaciones: ''
  };

  // Árbol de nodos (todos) para selector
  arbolNodos: Nodo[] = [];
  mostrarSelectorNodo: boolean = false;

  // Para el modal de detalles
  ordenDetalleCompleta: OrdenTrabajo | null = null;

  constructor(
    private ordenesService: OrdenesTrabajoService,
    private nodosService: NodosService,
    private incidenciasService: IncidenciasService,
    private cdr: ChangeDetectorRef,
        private authService: AuthService,
            private usuariosService: UsuariosService ,
  private tareasService: TareasService
  ) {}
async cargarTareasDeOrden(orden: OrdenTrabajo) {
  if (orden.tipo !== 'preventivo') {
    this.tareasDeOrden = [];
    return;
  }
  try {
    // Obtiene las tareas completas a partir de los IDs guardados en la descripción
    this.tareasDeOrden = await this.ordenesService.getTareasCompletasByOrdenId(orden.id);
  } catch (error) {
    console.error('Error cargando tareas de la orden:', error);
    this.tareasDeOrden = [];
  }
}

private loadUserPrivileges() {
    try {
      const privilegiosGuardados = localStorage.getItem('user_privileges');
      if (privilegiosGuardados) {
        this.userPrivileges = JSON.parse(privilegiosGuardados);
        console.log('✅ Privilegios cargados en TipoNodo:', this.userPrivileges);
      }
    } catch (error) {
      console.error('❌ Error cargando privilegios:', error);
      this.userPrivileges = [];
    }
  }

  async ngOnInit() {
    this.cargarDatosUsuario();
    this.loadUserPrivileges();
    await this.cargarOrdenes();
    await this.cargarArbolNodos();
     try {
    const creadas = await this.ordenesService.generarOrdenesPreventivas();
    console.log(`✅ Órdenes preventivas generadas: ${creadas}`);
  } catch (error) {
    console.error('Error generando órdenes preventivas', error);
  }
  }

  async cargarOrdenes() {
    this.loading = true;
    try {
      const result = await this.ordenesService.getOrdenes({
        search: this.filtros.search || undefined,
        estado: this.filtros.estado || undefined,
        tipo: this.filtros.tipo || undefined,
        nodo_id: this.filtros.nodo_id || undefined,
        fecha_desde: this.filtros.fecha_desde || undefined,
        fecha_hasta: this.filtros.fecha_hasta || undefined,
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
private filtrarActivos(nodos: Nodo[]): Nodo[] {
  return nodos
    .filter(nodo => nodo.estado_activo === true)
    .map(nodo => ({
      ...nodo,
      hijos: nodo.hijos ? this.filtrarActivos(nodo.hijos) : []
    }));
}
 async cargarArbolNodos() {
  try {
    const raices = await this.nodosService.getNodosRaiz();
    const arbolesCompletos: Nodo[] = [];
    for (const raiz of raices) {
      const arbol = await this.nodosService.getArbol(raiz.id);
      arbolesCompletos.push(arbol);
    }
    // Filtrar nodos inactivos
    const arbolesActivos = this.filtrarActivos(arbolesCompletos);
    this.arbolNodos = arbolesActivos;
    this.asignarColapsado(this.arbolNodos);
  } catch (error) {
    console.error('Error cargando árbol de nodos:', error);
  }
}

  private asignarColapsado(nodos: Nodo[]) {
    nodos.forEach(nodo => {
      nodo.colapsado = false;
      if (nodo.hijos && nodo.hijos.length) {
        this.asignarColapsado(nodo.hijos);
      }
    });
  }

  // Métodos de paginación
  paginaAnterior() {
    if (this.filtros.page > 1) {
      this.filtros.page--;
      this.cargarOrdenes();
    }
  }

  paginaSiguiente() {
    if (this.filtros.page < this.totalPaginas) {
      this.filtros.page++;
      this.cargarOrdenes();
    }
  }

  irAPagina(pagina: number) {
    if (pagina >= 1 && pagina <= this.totalPaginas) {
      this.filtros.page = pagina;
      this.cargarOrdenes();
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
    this.cargarOrdenes();
  }

  limpiarFiltros() {
    this.filtros = {
      search: '',
      estado: '',
      tipo: '',
      nodo_id: null,
      fecha_desde: '',
      fecha_hasta: '',
      page: 1,
      limit: 10
    };
    this.cargarOrdenes();
  }

  // ========== CRUD ==========
  abrirModalCrear() {
    this.nuevaOrden = {
      nodo_id: 0,
      nodo_nombre: '',
      descripcion: '',
      tecnico_asignado: this.userName,
      observaciones: ''
    };
    this.mostrarModalCrear = true;
  }

  cerrarModalCrear() {
    this.mostrarModalCrear = false;
  }

  abrirSelectorNodo() {
    this.mostrarSelectorNodo = true;
  }

  cerrarSelectorNodo() {
    this.mostrarSelectorNodo = false;
  }

  seleccionarNodo(nodo: Nodo) {
    this.nuevaOrden.nodo_id = nodo.id;
    this.nuevaOrden.nodo_nombre = nodo.nombre;
    this.cerrarSelectorNodo();
  }

  async crearOrden() {
    if (!this.nuevaOrden.nodo_id) {
      alert('Debe seleccionar un nodo');
      return;
    }
    if (!this.nuevaOrden.descripcion.trim()) {
      alert('La descripción es obligatoria');
      return;
    }

    try {
      await this.ordenesService.createOrden({
        incidencia_id: null,
        nodo_id: this.nuevaOrden.nodo_id,
        descripcion: this.nuevaOrden.descripcion,
        estado: 'pendiente',
        tipo: 'preventivo',
        tecnico_asignado: this.nuevaOrden.tecnico_asignado || null,
        observaciones: this.nuevaOrden.observaciones || null
      });
      this.cerrarModalCrear();
      await this.cargarOrdenes();
      alert('Orden preventiva creada correctamente');
    } catch (error: any) {
      alert('Error al crear orden: ' + error.message);
    }
  }

abrirModalDetalle(orden: OrdenTrabajo) {
  this.ordenSeleccionada = orden;
  // Buscar el nodo completo con sus campos extra
  this.nodoDetalle = this.buscarNodoEnArbol(orden.nodo_id);
  this.cargarTareasDeOrden(orden);
  this.mostrarModalDetalle = true;
}
 cerrarModalDetalle() {
  this.mostrarModalDetalle = false;
  this.ordenSeleccionada = null;
  this.nodoDetalle = null;
}

 mostrarMensajeAutoAsignacion: boolean = false;
 abrirModalEditar(orden: OrdenTrabajo) {
  this.ordenSeleccionada = orden;
  const tecnicoActual = orden.tecnico_asignado?.trim() || '';
  console.log('tecnicoActual:', tecnicoActual);
  console.log('currentUserName:', this,this.userName);
  // Mostrar mensaje solo si el campo estaba vacío
  this.mostrarMensajeAutoAsignacion = !tecnicoActual;
  console.log('mostrarMensajeAutoAsignacion:', this.mostrarMensajeAutoAsignacion);
  this.editarOrden = {
    descripcion: orden.descripcion || '',
    estado: orden.estado,
    tecnico_asignado: tecnicoActual || this.userName || 'Técnico',
    observaciones: orden.observaciones || ''
  };
  this.mostrarModalEditar = true;
}

  cerrarModalEditar() {
    this.mostrarModalEditar = false;
    this.ordenSeleccionada = null;
    this.mostrarMensajeAutoAsignacion = false; // reiniciar
  }

  async guardarEdicion() {
    if (!this.ordenSeleccionada) return;

    try {
      await this.ordenesService.updateOrden(this.ordenSeleccionada.id, {
        descripcion: this.editarOrden.descripcion,
        estado: this.editarOrden.estado as 'pendiente' | 'en_proceso' | 'solucionada' | 'cancelada',
        tecnico_asignado: this.editarOrden.tecnico_asignado || null,
        observaciones: this.editarOrden.observaciones || null
      });
      this.cerrarModalEditar();
      await this.cargarOrdenes();
      alert('Orden actualizada');
    } catch (error: any) {
      alert('Error al actualizar: ' + error.message);
    }
  }

  abrirModalEliminar(orden: OrdenTrabajo) {
    this.ordenSeleccionada = orden;
    this.mostrarModalEliminar = true;
  }

  cerrarModalEliminar() {
    this.mostrarModalEliminar = false;
    this.ordenSeleccionada = null;
  }

  async eliminarOrden() {
    if (!this.ordenSeleccionada) return;
    try {
      await this.ordenesService.deleteOrden(this.ordenSeleccionada.id);
      this.cerrarModalEliminar();
      await this.cargarOrdenes();
      alert('Orden eliminada');
    } catch (error: any) {
      alert('Error al eliminar: ' + error.message);
    }
  }

  // Auxiliares
  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getColorEstado(estado: string): string {
    switch (estado) {
      case 'pendiente': return 'estado-pendiente';
      case 'en_proceso': return 'estado-proceso';
      case 'solucionada': return 'estado-solucionada';
      case 'cancelada': return 'estado-cancelada';
      default: return 'estado-default';
    }
  }

  getColorTipo(tipo: string): string {
    return tipo === 'correctivo' ? 'tipo-correctivo' : 'tipo-preventivo';
  }

  // Para el árbol de selección de nodos
  tieneHijos(nodo: Nodo): boolean {
    return !!(nodo.hijos && nodo.hijos.length);
  }

  trackByFn(index: number, item: any) {
    return item?.id ?? index;
  }

  // Estadísticas (simples)
  get totalPendientes(): number {
    return this.ordenes?.filter(o => o.estado === 'pendiente').length ?? 0;
  }

  get totalEnProceso(): number {
    return this.ordenes?.filter(o => o.estado === 'en_proceso').length ?? 0;
  }

  get totalCompletadas(): number {
    return this.ordenes?.filter(o => o.estado === 'solucionada').length ?? 0;
  }
}