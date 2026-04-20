// incidencias.component.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IncidenciasService, Incidencia } from '../../services/incidencias.service';
import { NodosService, Nodo } from '../../services/nodos.service';
import { AuthService } from '../../services/auth.service';
import { UsuariosService } from '../../services/usuarios.service';

@Component({
  selector: 'app-incidencias',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './incidencias.html',
  styleUrls: ['./incidencias.css']
})
export class Incidencias implements OnInit {
  // Datos principales
  incidencias: Incidencia[] = [];
  totalRegistros: number = 0;
  loading: boolean = false;

  // Filtros
  filtros = {
    search: '',
    estado: '',
    prioridad: '',
    fecha_desde: '',
    fecha_hasta: '',
    page: 1,
    limit: 10
  };
  totalPaginas: number = 0;

  // Opciones para selects
  estadosDisponibles = [
    { value: 'abierta', label: 'Abierta' },
    { value: 'en_proceso', label: 'En proceso' },
    { value: 'cerrada', label: 'Cerrada' }
  ];
  prioridadesDisponibles = [
    { value: 'baja', label: 'Baja' },
    { value: 'media', label: 'Media' },
    { value: 'alta', label: 'Alta' },
    { value: 'critica', label: 'Crítica' }
  ];
nodoDetalle: Nodo | null = null;
  // Modales
  mostrarModalCrear: boolean = false;
  mostrarModalDetalle: boolean = false;
  mostrarModalEditar: boolean = false;
  mostrarModalEliminar: boolean = false;
  incidenciaSeleccionada: Incidencia | null = null;
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
  userPrivileges: string[] = [];
  // Datos para crear incidencia
  nuevaIncidencia = {
    nodo_id: 0,
    nodo_nombre: '',
    descripcion: '',
    prioridad: 'media',
    reportado_por: '',
    detalles: ''
  };

  // Datos para editar incidencia
  editarIncidencia = {
    descripcion: '',
    estado: '',
    prioridad: '',
    detalles: ''
  };

  // Árbol de nodos equipos para selector
  arbolEquipos: Nodo[] = [];
  mostrarSelectorNodo: boolean = false;

  constructor(
    private incidenciasService: IncidenciasService,
    private nodosService: NodosService,
        private authService: AuthService,
            private usuariosService: UsuariosService,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit() {
    await this.cargarIncidencias();
    await this.cargarArbolEquipos();
    this.loadUserPrivileges();
    this.cargarDatosUsuario();
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
 tienePrivilegio(privilegeCode: string): boolean {
    return this.userPrivileges.includes(privilegeCode);
  }
  async cargarIncidencias() {
    this.loading = true;
    try {
      const result = await this.incidenciasService.getIncidencias({
        search: this.filtros.search || undefined,
        estado: this.filtros.estado || undefined,
        prioridad: this.filtros.prioridad || undefined,
        fecha_desde: this.filtros.fecha_desde || undefined,
        fecha_hasta: this.filtros.fecha_hasta || undefined,
        page: this.filtros.page,
        limit: this.filtros.limit
      });
      this.incidencias = result.data;
      this.totalRegistros = result.count;
      this.totalPaginas = Math.ceil(this.totalRegistros / this.filtros.limit);
    } catch (error) {
      console.error('Error cargando incidencias:', error);
    } finally {
      this.loading = false;
    }
  }



 // Método auxiliar para eliminar nodos inactivos del árbol
private filtrarActivos(nodos: Nodo[]): Nodo[] {
  return nodos
    .filter(nodo => nodo.estado_activo === true)
    .map(nodo => ({
      ...nodo,
      hijos: nodo.hijos ? this.filtrarActivos(nodo.hijos) : []
    }));
}

async cargarArbolEquipos() {
  try {
    console.log('📡 Cargando árbol completo...');
    const raices = await this.nodosService.getNodosRaiz();
    const arbolesCompletos: Nodo[] = [];
    for (const raiz of raices) {
      const arbol = await this.nodosService.getArbol(raiz.id);
      arbolesCompletos.push(arbol);
    }
    // Filtrar nodos inactivos
    const arbolesActivos = this.filtrarActivos(arbolesCompletos);
    // Guardamos el árbol ya filtrado (solo activos)
    this.arbolEquipos = arbolesActivos;
    this.asignarColapsado(this.arbolEquipos);
    console.log('Árbol cargado (solo activos):', this.arbolEquipos);
  } catch (error) {
    console.error('Error cargando árbol:', error);
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
      this.cargarIncidencias();
    }
  }

  paginaSiguiente() {
    if (this.filtros.page < this.totalPaginas) {
      this.filtros.page++;
      this.cargarIncidencias();
    }
  }

  irAPagina(pagina: number) {
    if (pagina >= 1 && pagina <= this.totalPaginas) {
      this.filtros.page = pagina;
      this.cargarIncidencias();
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
    this.cargarIncidencias();
  }

  // Dentro de la clase Incidencias, agrega este método:
obtenerRutaNodox(nodoId: number): string {
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
  const ruta = buscarRuta(this.arbolEquipos, []);
  return ruta || 'Ubicación no encontrada';
}

  limpiarFiltros() {
    this.filtros = {
      search: '',
      estado: '',
      prioridad: '',
      fecha_desde: '',
      fecha_hasta: '',
      page: 1,
      limit: 10
    };
    this.cargarIncidencias();
  }
  /**
   * Obtiene la ruta jerárquica desde la raíz hasta el nodo seleccionado.
   * @param nodo Nodo seleccionado
   * @param arbol Árbol completo donde buscar
   * @returns String con la ruta separada por " / "
   */
  private obtenerRutaNodo(nodo: Nodo, arbol: Nodo[]): string {
    // Búsqueda recursiva para encontrar el nodo y construir la ruta
    const buscar = (nodos: Nodo[], rutaActual: string[]): string | null => {
      for (const n of nodos) {
        const nuevaRuta = [...rutaActual, n.nombre];
        if (n.id === nodo.id) {
          return nuevaRuta.join(' / ');
        }
        if (n.hijos && n.hijos.length) {
          const resultado = buscar(n.hijos, nuevaRuta);
          if (resultado) return resultado;
        }
      }
      return null;
    };

    const ruta = buscar(arbol, []);
    return ruta || nodo.nombre; // fallback al nombre solo
  }
  // ========== CRUD ==========
  abrirModalCrear() {
    this.nuevaIncidencia = {
      nodo_id: 0,
      nodo_nombre: '',
      descripcion: '',
      prioridad: 'media',
      reportado_por: this.userName,
      detalles: ''
    };
    this.mostrarModalCrear = true;
  }

  cerrarModalCrear() {
    this.mostrarModalCrear = false;
  }

  abrirSelectorNodo() {
    console.log('Abriendo selector, arbolEquipos length:', this.arbolEquipos.length);
    this.mostrarSelectorNodo = true;
  }

  cerrarSelectorNodo() {
    this.mostrarSelectorNodo = false;
  }

  seleccionarNodo(nodo: Nodo) {
    if (nodo.es_equipo) {
      this.nuevaIncidencia.nodo_id = nodo.id;
      this.nuevaIncidencia.nodo_nombre = nodo.nombre;

       
      this.cerrarSelectorNodo();
    } else {
      alert('Solo puede seleccionar equipos o componentes');
    }
  }

  async crearIncidencia() {
    if (!this.nuevaIncidencia.nodo_id) {
      alert('Debe seleccionar un nodo');
      return;
    }
    if (!this.nuevaIncidencia.descripcion.trim()) {
      alert('La descripción es obligatoria');
      return;
    }

    try {
      await this.incidenciasService.createIncidencia({
        nodo_id: this.nuevaIncidencia.nodo_id,
        descripcion: this.nuevaIncidencia.descripcion,
        reportado_por: this.nuevaIncidencia.reportado_por || null,
        prioridad: this.nuevaIncidencia.prioridad as 'baja' | 'media' | 'alta' | 'critica',
        detalles: this.nuevaIncidencia.detalles || null,
        estado: 'abierta'
      });
      this.cerrarModalCrear();
      await this.cargarIncidencias();
      alert('Incidencia creada correctamente');
    } catch (error: any) {
      alert('Error al crear incidencia: ' + error.message);
    }
  }

  abrirModalDetalle(incidencia: Incidencia) {
  this.incidenciaSeleccionada = incidencia;
  // Buscar el nodo completo en arbolEquipos (recursivamente)
  const buscarNodo = (nodos: Nodo[], id: number): Nodo | null => {
    for (const n of nodos) {
      if (n.id === id) return n;
      if (n.hijos) {
        const encontrado = buscarNodo(n.hijos, id);
        if (encontrado) return encontrado;
      }
    }
    return null;
  };
  this.nodoDetalle = buscarNodo(this.arbolEquipos, incidencia.nodo_id);
  this.mostrarModalDetalle = true;
}

  cerrarModalDetalle() {
  this.mostrarModalDetalle = false;
  this.incidenciaSeleccionada = null;
  this.nodoDetalle = null;
}

  abrirModalEditar(incidencia: Incidencia) {
    this.incidenciaSeleccionada = incidencia;
    this.editarIncidencia = {
      descripcion: incidencia.descripcion || '',
      estado: incidencia.estado,
      prioridad: incidencia.prioridad,
      detalles: incidencia.detalles || ''
    };
    this.mostrarModalEditar = true;
  }

  cerrarModalEditar() {
    this.mostrarModalEditar = false;
    this.incidenciaSeleccionada = null;
  }

  async guardarEdicion() {
    if (!this.incidenciaSeleccionada) return;

    try {
      await this.incidenciasService.updateIncidencia(this.incidenciaSeleccionada.id, {
        descripcion: this.editarIncidencia.descripcion,
        estado: this.editarIncidencia.estado as 'abierta' | 'en_proceso' | 'cerrada',
        prioridad: this.editarIncidencia.prioridad as 'baja' | 'media' | 'alta' | 'critica',
        detalles: this.editarIncidencia.detalles
      });
      this.cerrarModalEditar();
      await this.cargarIncidencias();
      alert('Incidencia actualizada');
    } catch (error: any) {
      alert('Error al actualizar: ' + error.message);
    }
  }

  abrirModalEliminar(incidencia: Incidencia) {
    this.incidenciaSeleccionada = incidencia;
    this.mostrarModalEliminar = true;
  }

  cerrarModalEliminar() {
    this.mostrarModalEliminar = false;
    this.incidenciaSeleccionada = null;
  }

  async eliminarIncidencia() {
    if (!this.incidenciaSeleccionada) return;
    try {
      await this.incidenciasService.deleteIncidencia(this.incidenciaSeleccionada.id);
      this.cerrarModalEliminar();
      await this.cargarIncidencias();
      alert('Incidencia eliminada');
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
      case 'abierta': return 'estado-abierta';
      case 'en_proceso': return 'estado-proceso';
      case 'cerrada': return 'estado-cerrada';
      default: return 'estado-default';
    }
  }

  getColorPrioridad(prioridad: string): string {
    switch (prioridad) {
      case 'baja': return 'prioridad-baja';
      case 'media': return 'prioridad-media';
      case 'alta': return 'prioridad-alta';
      case 'critica': return 'prioridad-critica';
      default: return 'prioridad-default';
    }
  }

  // Para el árbol de selección de nodos
  esEquipo(nodo: Nodo): boolean {
    return nodo.es_equipo === true;
  }



  trackByFn(index: number, item: Nodo) {
    return item.id;
  }

  get abiertasCount(): number {
    return this.incidencias?.filter(i => i.estado === 'abierta').length ?? 0;
  }

  get enProcesoCount(): number {
    return this.incidencias?.filter(i => i.estado === 'en_proceso').length ?? 0;
  }

  get cerradasCount(): number {
    return this.incidencias?.filter(i => i.estado === 'cerrada').length ?? 0;
  }
}