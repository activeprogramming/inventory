import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NodosService, Nodo, CamposExtraNodo } from '../../services/nodos.service';
import { TipoNodosService, TipoNodo } from '../../services/tipo-nodos.service';
import { ChangeDetectorRef } from '@angular/core';
@Component({
  selector: 'app-nodos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nodos.html',
  styleUrls: ['./nodos.css']
})
export class Nodos implements OnInit {
  // Lista de nodos raíz (para la tabla)
  nodosRaiz: Nodo[] = [];
  loading: boolean = false;
  esEquipoSeleccionado(): boolean {
    const tipoId = Number(this.formData.tipo_id); // forzar número
    if (!this.tiposNodo || this.tiposNodo.length === 0) return false;
    const tipo = this.tiposNodo.find(t => Number(t.id) === tipoId);
    return tipo?.es_equipo === true;
  }
  // Tipos de nodo disponibles
  tiposNodo: TipoNodo[] = [];

  // Modal de árbol (vertical)
  mostrarModalArbol: boolean = false;
  nodoRaizActual: Nodo | null = null;
  arbolActual: Nodo | null = null;

  // Modal de formulario de nodo (para crear/editar)
  mostrarModalForm: boolean = false;
  modoForm: 'crear' | 'editar' = 'crear';
  nodoForm: Nodo | null = null; // el nodo que se está editando (si es editar)
  padreForm: Nodo | null = null; // padre del nuevo nodo (si es crear)
  // Datos del formulario
  formData = {
    nombre: '',
    descripcion: '',
    tipo_id: 1,
    estado_activo: true,
    // Campos extra
    part_number: '',
    serial_number: '',
    codigo: '',
    criticidad: 'medio',
    cantidad_actual: 1,
    estanteria: '',
    precio: null as number | null,
    fecha_instalacion: '',
    observaciones: '',
    estado: 'activo'
  };

  constructor(
    private nodosService: NodosService,
    private tipoNodosService: TipoNodosService,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit() {
    await this.cargarTipos();
    await this.cargarNodosRaiz();
  }

  async cargarTipos() {
    try {
      const { data } = await this.tipoNodosService.getTipos({ limit: 100 });
      this.tiposNodo = data || []; 
    } catch (error) {
      console.error('❌ Error cargando tipos de nodo:', error);
    }
  }

  async cargarNodosRaiz() {
    this.loading = true;
    try {
      this.nodosRaiz = await this.nodosService.getNodosRaiz();
    } catch (error) { 
    } finally {
      this.loading = false;
    }
  }

  // ---------- Gestión de nodos raíz (tabla) ----------
  async crearNodoRaiz() {
    this.abrirFormularioNodo(null);
  }
  async editarArbolRaiz(nodo: Nodo) {
    this.loading = true;
    this.mostrarModalArbol = true;
    try {
      this.nodoRaizActual = nodo;
      this.arbolActual = await this.nodosService.getArbol(nodo.id);
      // Inicializar colapsado en false
      const setColapsado = (n: Nodo) => {
        n.colapsado = false;
        if (n.hijos && n.hijos.length) n.hijos.forEach(setColapsado);
      };
      if (this.arbolActual) setColapsado(this.arbolActual);
      this.cdr.detectChanges(); // forzar render
    } catch (error) { 
    } finally {
      this.loading = false;
    }
  }

  async eliminarNodoRaiz(nodo: Nodo) {
    if (!confirm(`¿Eliminar el nodo raíz "${nodo.nombre}" y todos sus hijos?`)) return;
    try {
      await this.nodosService.deleteNodo(nodo.id);
      await this.cargarNodosRaiz();
    } catch (error) { 
      alert('No se puede eliminar porque tiene hijos');
    }
  }
  onTipoCambio() {
    this.cdr.detectChanges(); // Fuerza la actualización
  }
  cerrarModalArbol() {
    this.mostrarModalArbol = false;
    this.nodoRaizActual = null;
    this.arbolActual = null;
  }

  // ---------- Formulario de nodo (modal) ----------
  async abrirFormularioNodo(padre: Nodo | null, nodo?: Nodo) {
    // 1. Asegurar que los tipos estén cargados
    if (!this.tiposNodo.length) {
      await this.cargarTipos();
    }

    this.modoForm = nodo ? 'editar' : 'crear';
    this.padreForm = padre;
    this.nodoForm = nodo || null;

    if (nodo) { 
      // 2. Cargar datos del nodo en el formulario
      this.formData = {
        nombre: nodo.nombre,
        descripcion: nodo.descripcion || '',
        tipo_id: nodo.tipo_id,
        estado_activo: nodo.estado_activo,
        part_number: nodo.campos_extra?.part_number || '',
        serial_number: nodo.campos_extra?.serial_number || '',
        codigo: nodo.campos_extra?.codigo || '',
        criticidad: nodo.campos_extra?.criticidad || 'medio',
        cantidad_actual: nodo.campos_extra?.cantidad_actual ?? 1,
        estanteria: nodo.campos_extra?.estanteria || '',
        precio: nodo.campos_extra?.precio ?? null,
        fecha_instalacion: nodo.campos_extra?.fecha_instalacion
      ? new Date(nodo.campos_extra.fecha_instalacion).toISOString().split('T')[0]
      : '',
        observaciones: nodo.campos_extra?.observaciones || '',
        estado: nodo.campos_extra?.estado || 'activo'
      };

      // 3. Si el tipo no existe en la lista, asignar uno válido
      const tipoExiste = this.tiposNodo.some(t => t.id === this.formData.tipo_id);
      if (!tipoExiste && this.tiposNodo.length) {
        this.formData.tipo_id = this.tiposNodo[0].id;
      }
    } else {
      this.resetFormulario();
    }

    // 4. Forzar la actualización de la vista para que el select y campos extra se muestren correctamente
    this.cdr.detectChanges();

    this.mostrarModalForm = true;
  }

 resetFormulario() {
  const tipoDefecto = this.obtenerTipoUbicacionDefecto();
  const hoy = new Date().toISOString().split('T')[0]; // formato yyyy-mm-dd
  this.formData = {
    nombre: '',
    descripcion: '',
    tipo_id: tipoDefecto,
    estado_activo: true,
    part_number: '',
    serial_number: '',
    codigo: '',
    criticidad: 'medio',
    cantidad_actual: 1,
    estanteria: '',
    precio: null,
    fecha_instalacion: hoy,  // 👈 asignamos la fecha actual
    observaciones: '',
    estado: 'activo'
  };
}
  private obtenerTipoUbicacionDefecto(): number {
    const ubicacion = this.tiposNodo.find(t => t.es_equipo === false);
    return ubicacion?.id || this.tiposNodo[0]?.id || 1;
  }
  cerrarFormulario() {
    this.mostrarModalForm = false;
    this.nodoForm = null;
    this.padreForm = null;
  }

  async guardarNodo() {
    if (!this.formData.nombre.trim()) {
      alert('El nombre es obligatorio');
      return;
    }

    try {
      const datosBasicos = {
        parent_id: this.padreForm?.id ?? null,
        tipo_id: this.formData.tipo_id,
        nombre: this.formData.nombre,
        descripcion: this.formData.descripcion || null,
        estado_activo: this.formData.estado_activo
      };

      let nodoGuardado: Nodo;

      if (this.modoForm === 'crear') {
        nodoGuardado = await this.nodosService.createNodo(datosBasicos);
      } else {
        nodoGuardado = await this.nodosService.updateNodo(this.nodoForm!.id, datosBasicos);
      }
 
      if (this.esEquipoSeleccionado()) {
        const camposExtra: Partial<CamposExtraNodo> = {
          part_number: this.formData.part_number || null,
          serial_number: this.formData.serial_number || null,
          codigo: this.formData.codigo || null,
          criticidad: this.formData.criticidad,
          cantidad_actual: this.formData.cantidad_actual,
          estanteria: this.formData.estanteria || null,
          precio: this.formData.precio,
          fecha_instalacion: this.formData.fecha_instalacion || null,
          observaciones: this.formData.observaciones || null,
          estado: this.formData.estado
        };
        
        await this.nodosService.upsertCamposExtra(nodoGuardado.id, camposExtra);
      }

      // Recargar la vista afectada
      if (this.mostrarModalArbol) {
        // Si estábamos en el árbol, recargar el árbol completo desde la raíz actual
        if (this.nodoRaizActual) {
          this.arbolActual = await this.nodosService.getArbol(this.nodoRaizActual.id);
        }
      } else {
        // Si no, recargar solo los nodos raíz (tabla)
        await this.cargarNodosRaiz();
      }

      this.cerrarFormulario();
    } catch (error) { 
      alert('Error al guardar el nodo');
    }
  }

  // Método para eliminar un nodo dentro del árbol
  async eliminarNodoArbol(nodo: Nodo, parent: Nodo | null) {
    if (!confirm(`¿Eliminar "${nodo.nombre}" y todos sus hijos?`)) return;
    try {
      await this.nodosService.deleteNodo(nodo.id);
      // Actualizar la estructura local del árbol
      if (parent && parent.hijos) {
        parent.hijos = parent.hijos.filter(h => h.id !== nodo.id);
      } else if (this.arbolActual && this.arbolActual.id === nodo.id) {
        // Si se elimina la raíz actual, cerrar el modal
        this.cerrarModalArbol();
        await this.cargarNodosRaiz();
      } else {
        // Recargar árbol completo desde la raíz
        if (this.nodoRaizActual) {
          this.arbolActual = await this.nodosService.getArbol(this.nodoRaizActual.id);
        }
      }
    } catch (error) { 
      alert('No se puede eliminar porque tiene hijos');
    }
  }

  // Saber si un nodo es equipo (para mostrar campos extra)
  esEquipo(nodo: Nodo): boolean {
  const tipo = this.tiposNodo.find(t => t.id === nodo.tipo_id);
  const result = tipo?.es_equipo === true; 
  return result;
}

  getTipoNombre(tipoId: number): string {
    const tipo = this.tiposNodo.find(t => t.id === tipoId);
    return tipo?.nombre || 'Desconocido';
  }
}