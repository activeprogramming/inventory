import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TipoNodosService, TipoNodo } from '../../services/tipo-nodos.service';

interface FiltrosTipoNodo {
  search: string;
  estado: string; // 'todos', 'activo', 'inactivo'
  page: number;
  limit: number;
}

@Component({
  selector: 'app-tiponodo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tiponodo.html',
  styleUrls: ['./tiponodo.css']
})
export class Tiponodo implements OnInit {
  // Datos principales
  registros: TipoNodo[] = [];
  totalRegistros: number = 0;
  loading: boolean = false;
  userPrivileges: string[] = [];

  // Filtros
  filtros: FiltrosTipoNodo = {
    search: '',
    estado: 'todos',
    page: 1,
    limit: 20
  };

  totalPaginas: number = 0;

  // Modal y formularios
  mostrarModalNuevo: boolean = false;
  mostrarModalDetalle: boolean = false;
  mostrarModalEditar: boolean = false;
  mostrarModalEliminar: boolean = false;

  registroSeleccionado: TipoNodo | null = null;

  // Formulario nuevo registro
  nuevoRegistro = {
    nombre: '',
    detalles: '',
    es_equipo: false,
    estado: true
  };

  // Formulario editar registro
  editarRegistro = {
    nombre: '',
    detalles: '',
    es_equipo: false,
    estado: true
  };

  // Opciones para select de estado
  estadosDisponibles = ['activo', 'inactivo'];

  constructor(private tipoNodosService: TipoNodosService) {}

  ngOnInit() {
    this.cargarRegistros();
    this.loadUserPrivileges();
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

  async cargarRegistros() {
    this.loading = true;
    try {
      const resultado = await this.tipoNodosService.getTipos({
        search: this.filtros.search,
        estado: this.filtros.estado === 'todos',
        page: this.filtros.page,
        limit: this.filtros.limit
      });

      this.registros = resultado.data || [];
      this.totalRegistros = resultado.count || 0;
      this.totalPaginas = Math.ceil(this.totalRegistros / this.filtros.limit);
    } catch (error) {
      console.error('Error cargando tipos de nodo:', error);
      this.registros = [];
      this.totalRegistros = 0;
    } finally {
      this.loading = false;
    }
  }

  // Métodos de filtrado
  aplicarFiltros() {
    this.filtros.page = 1;
    this.cargarRegistros();
  }

  limpiarFiltros() {
    this.filtros = {
      search: '',
      estado: 'todos',
      page: 1,
      limit: 20
    };
    this.cargarRegistros();
  }

  // Métodos de paginación
  paginaAnterior() {
    if (this.filtros.page > 1) {
      this.filtros.page--;
      this.cargarRegistros();
    }
  }

  paginaSiguiente() {
    if (this.filtros.page < this.totalPaginas) {
      this.filtros.page++;
      this.cargarRegistros();
    }
  }

  irAPagina(pagina: number) {
    if (pagina >= 1 && pagina <= this.totalPaginas) {
      this.filtros.page = pagina;
      this.cargarRegistros();
    }
  }

  generarRangoPaginas(): number[] {
    const paginas: number[] = [];
    const maxPaginasVisibles = 3;
    const mitad = Math.floor(maxPaginasVisibles / 2);
    let inicio = this.filtros.page - mitad;
    let fin = this.filtros.page + mitad;

    if (inicio < 1) {
      fin += 1 - inicio;
      inicio = 1;
    }
    if (fin > this.totalPaginas) {
      inicio -= fin - this.totalPaginas;
      fin = this.totalPaginas;
    }
    inicio = Math.max(1, inicio);

    for (let i = inicio; i <= fin; i++) {
      if (i >= 1 && i <= this.totalPaginas && !paginas.includes(i)) {
        paginas.push(i);
      }
    }
    return paginas;
  }

  // Modales
  abrirModalNuevo() {
    this.nuevoRegistro = {
      nombre: '',
      detalles: '',
      es_equipo: false,
      estado: true
    };
    this.mostrarModalNuevo = true;
  }

  cerrarModalNuevo() {
    this.mostrarModalNuevo = false;
  }

  abrirModalDetalle(registro: TipoNodo) {
    this.registroSeleccionado = registro;
    this.mostrarModalDetalle = true;
  }

  cerrarModalDetalle() {
    this.mostrarModalDetalle = false;
    this.registroSeleccionado = null;
  }

  abrirModalEditar(registro: TipoNodo) {
    if (!this.tienePrivilegio('tiponodo.Editar')) {
      alert('No tienes permisos para editar tipos de nodo');
      return;
    }
    this.registroSeleccionado = registro;
    this.editarRegistro = {
      nombre: registro.nombre,
      detalles: registro.detalles || '',
      es_equipo: registro.es_equipo || false,
      estado: registro.estado ?? true
    };
    this.mostrarModalEditar = true;
  }

  cerrarModalEditar() {
    this.mostrarModalEditar = false;
    this.registroSeleccionado = null;
  }

  abrirModalEliminar(registro: TipoNodo) {
    if (!this.tienePrivilegio('tiponodo.Editar')) {
      alert('No tienes permisos para eliminar tipos de nodo');
      return;
    }
    this.registroSeleccionado = registro;
    this.mostrarModalEliminar = true;
  }

  cerrarModalEliminar() {
    this.mostrarModalEliminar = false;
    this.registroSeleccionado = null;
  }

  // CRUD
  async crearNuevoRegistro() {
    if (!this.validarNuevoRegistro()) {
      return;
    }

    try {
      const nuevo = {
        nombre: this.nuevoRegistro.nombre,
        detalles: this.nuevoRegistro.detalles || null,
        es_equipo: this.nuevoRegistro.es_equipo,
        estado: this.nuevoRegistro.estado
      };

      await this.tipoNodosService.createTipo(nuevo);
      this.cerrarModalNuevo();
      await this.cargarRegistros();
      alert('Tipo de nodo creado exitosamente');
    } catch (error: any) {
      console.error('Error creando tipo de nodo:', error);
      alert(`Error al crear: ${error.message}`);
    }
  }

  async actualizarRegistro() {
    if (!this.registroSeleccionado) return;

    try {
      const updates: Partial<TipoNodo> = {
        nombre: this.editarRegistro.nombre,
        detalles: this.editarRegistro.detalles || null,
        es_equipo: this.editarRegistro.es_equipo,
        estado: this.editarRegistro.estado
      };

      await this.tipoNodosService.updateTipo(this.registroSeleccionado.id, updates);
      this.cerrarModalEditar();
      await this.cargarRegistros();
      alert('Tipo de nodo actualizado exitosamente');
    } catch (error: any) {
      console.error('Error actualizando tipo de nodo:', error);
      alert(`Error al actualizar: ${error.message}`);
    }
  }

  async eliminarRegistroConfirmado() {
    if (!this.registroSeleccionado) return;

    try {
      await this.tipoNodosService.eliminarTipo(this.registroSeleccionado.id);
      this.cerrarModalEliminar();
      await this.cargarRegistros();
      alert('Tipo de nodo eliminado exitosamente');
    } catch (error: any) {
      console.error('Error eliminando tipo de nodo:', error);
      alert(`Error al eliminar: ${error.message}`);
    }
  }

  // Validaciones
  validarNuevoRegistro(): boolean {
    if (!this.nuevoRegistro.nombre.trim()) {
      alert('El nombre es obligatorio');
      return false;
    }
    return true;
  }

  // Métodos auxiliares
  getEstadoTexto(estado: boolean | null): string {
    if (estado === null) return 'Desconocido';
    return estado ? 'Activo' : 'Inactivo';
  }

  getEstadoBadgeClass(estado: boolean | null): string {
    if (estado === null) return 'estado-default';
    return estado ? 'estado-completado' : 'estado-cancelado';
  }

  getEsEquipoTexto(esEquipo: boolean | null): string {
    if (esEquipo === null) return 'No especificado';
    return esEquipo ? 'Equipo' : 'Ubicación';
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
}