import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';
import { CamposExtraNodo } from './nodos.service';

// Interfaces
export interface EjecucionMantenimiento {
  id: number;
  orden_trabajo_id: number;
  fecha_ejecucion_inicio: string | null;
  fecha_ejecucion_fin: string | null;
  realizada_por: string | null;
  acciones: string | null;
  observaciones: string | null;
  detalles: string | null;
  created_at: string;
  updated_at: string;
  // Opcionales para mostrar datos relacionados
  orden_codigo?: string;
  orden_tipo?: string;
}

export interface EjecucionMantenimientoTarea {
  id: number; // para facilitar operaciones
  tarea_id: number;
  ejecucion_mantenimiento_id: number;
  fecha_ejecucion_fin: string | null;
  acciones: string | null;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
  // Opcionales
  tarea_nombre?: string;
}

export interface EjecucionMantenimientoProducto {
  id: number;
  ejecucion_mantenimiento_id: number;
  producto_id: number;
  cantidad: number;
  detalle: string | null;
  motivo: string | null;
  created_at: string;
  updated_at: string;
  // Opcionales
  producto_nombre?: string;
  producto_part_number?: string;
}

export interface EjecucionMantenimientoReemplazo {
  id: number;
  ejecucion_mantenimiento_id: number;
  producto_id: number;
  nodo_original_id: number;
  nodo_reemplazo_id: number;
  fecha_reemplazo: string;
  motivo: string | null;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
  // Opcionales
  producto_nombre?: string;
  nodo_original_nombre?: string;
  nodo_reemplazo_nombre?: string;
}

@Injectable({
  providedIn: 'root'
})
export class EjecucionMantenimientoService {
  private ejecucionesTable = 'ejecucion_mantenimiento';
  private tareasTable = 'ejecucion_mantenimiento_tarea';
  private productosTable = 'ejecucion_mantenimiento_producto';
  private reemplazosTable = 'ejecucion_mantenimiento_reemplazo';

  constructor() { }

  // ==================== EJECUCIONES (CRUD) ====================

  /**
   * Obtener todas las ejecuciones con paginación y filtros
   */
  async getEjecuciones(filters?: {
    orden_trabajo_id?: number;
    page?: number;
    limit?: number;
  }) {
    try {
      let query = supabase
        .from(this.ejecucionesTable)
        .select('*, ordenes_trabajo(codigo_ot, tipo)', { count: 'exact' })
        .order('fecha_ejecucion_inicio', { ascending: false, nullsFirst: false });

      if (filters?.orden_trabajo_id) {
        query = query.eq('orden_trabajo_id', filters.orden_trabajo_id);
      }

      if (filters?.limit && filters?.page) {
        const from = (filters.page - 1) * filters.limit;
        const to = from + filters.limit - 1;
        query = query.range(from, to);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const ejecuciones = (data || []).map((item: any) => ({
        ...item,
        orden_codigo: item.ordenes_trabajo?.codigo_ot,
        orden_tipo: item.ordenes_trabajo?.tipo
      }));

      return {
        data: ejecuciones as EjecucionMantenimiento[],
        count: count || 0,
        page: filters?.page || 1,
        limit: filters?.limit || 10
      };
    } catch (error: any) {
      console.error('❌ Error en getEjecuciones:', error);
      throw this.handleError(error, 'obtener ejecuciones');
    }
  }

  /**
   * Obtener una ejecución por ID con todas sus relaciones
   */
  async getEjecucionById(id: number): Promise<{
    ejecucion: EjecucionMantenimiento;
    tareas: EjecucionMantenimientoTarea[];
    productos: EjecucionMantenimientoProducto[];
    reemplazos: EjecucionMantenimientoReemplazo[];
  }> {
    try {
      // 1. Obtener la ejecución
      const { data: ejecucion, error: eError } = await supabase
        .from(this.ejecucionesTable)
        .select('*, ordenes_trabajo( tipo)')
        .eq('id', id)
        .single();
      if (eError) throw eError;

      // 2. Obtener tareas
      const { data: tareas, error: tError } = await supabase
        .from(this.tareasTable)
        .select('*, tareas(nombre)')
        .eq('ejecucion_mantenimiento_id', id);
      if (tError) throw tError;

      // 3. Obtener productos
      const { data: productos, error: pError } = await supabase
        .from(this.productosTable)
        .select('*, productos(nombre, part_number)')
        .eq('ejecucion_mantenimiento_id', id);
      if (pError) throw pError;

      // 4. Obtener reemplazos
      const { data: reemplazos, error: rError } = await supabase
        .from(this.reemplazosTable)
        .select('*, productos(nombre, part_number), nodos_original:nodos!nodo_original_id(nombre), nodos_reemplazo:nodos!nodo_reemplazo_id(nombre)')
        .eq('ejecucion_mantenimiento_id', id);
      if (rError) throw rError;

      const ejecucionEnriquecida = {
        ...ejecucion,
        orden_codigo: ejecucion.ordenes_trabajo?.codigo_ot,
        orden_tipo: ejecucion.ordenes_trabajo?.tipo
      };

      return {
        ejecucion: ejecucionEnriquecida,
        tareas: (tareas || []).map((t: any) => ({ ...t, tarea_nombre: t.tareas?.nombre })),
        productos: (productos || []).map((p: any) => ({ ...p, producto_nombre: p.productos?.nombre, producto_part_number: p.productos?.part_number })),
        reemplazos: (reemplazos || []).map((r: any) => ({
          ...r,
          producto_nombre: r.productos?.nombre,
          nodo_original_nombre: r.nodos_original?.nombre,
          nodo_reemplazo_nombre: r.nodos_reemplazo?.nombre
        }))
      };
    } catch (error: any) {
      console.error(`❌ Error obteniendo ejecución ${id}:`, error);
      throw this.handleError(error, `obtener ejecución ${id}`);
    }
  }

  /**
   * Crear una nueva ejecución de mantenimiento
   */
  async createEjecucion(ejecucion: Omit<EjecucionMantenimiento, 'id' | 'created_at' | 'updated_at'>): Promise<EjecucionMantenimiento> {
    try {
      const { data, error } = await supabase
        .from(this.ejecucionesTable)
        .insert([{
          orden_trabajo_id: ejecucion.orden_trabajo_id,
          fecha_ejecucion_inicio: ejecucion.fecha_ejecucion_inicio || null,
          fecha_ejecucion_fin: ejecucion.fecha_ejecucion_fin || null,
          realizada_por: ejecucion.realizada_por || null,
          acciones: ejecucion.acciones || null,
          observaciones: ejecucion.observaciones || null,
          detalles: ejecucion.detalles || null
        }])
        .select()
        .single();
      if (error) throw error;
      console.log(`✅ Ejecución creada con ID ${data.id}`);
      return data as EjecucionMantenimiento;
    } catch (error: any) {
      console.error('❌ Error creando ejecución:', error);
      throw this.handleError(error, 'crear ejecución');
    }
  }

  /**
   * Actualizar una ejecución existente
   */
  async updateEjecucion(id: number, updates: Partial<EjecucionMantenimiento>): Promise<EjecucionMantenimiento> {
    try {
      const { data, error } = await supabase
        .from(this.ejecucionesTable)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      console.log(`✅ Ejecución ${id} actualizada`);
      return data as EjecucionMantenimiento;
    } catch (error: any) {
      console.error(`❌ Error actualizando ejecución ${id}:`, error);
      throw this.handleError(error, `actualizar ejecución ${id}`);
    }
  }

  /**
   * Eliminar una ejecución (hard delete) – cascada por ON DELETE CASCADE
   */
  async deleteEjecucion(id: number): Promise<void> {
    try {
      const { error } = await supabase
        .from(this.ejecucionesTable)
        .delete()
        .eq('id', id);
      if (error) throw error;
      console.log(`✅ Ejecución ${id} eliminada`);
    } catch (error: any) {
      console.error(`❌ Error eliminando ejecución ${id}:`, error);
      throw this.handleError(error, `eliminar ejecución ${id}`);
    }
  }

  // ==================== TAREAS DE LA EJECUCIÓN ====================

  /**
   * Agregar una tarea a la ejecución (usado en preventivos)
   */
  async addTarea(ejecucionId: number, tareaId: number, data?: Partial<EjecucionMantenimientoTarea>): Promise<EjecucionMantenimientoTarea> {
    try {
      const { data: added, error } = await supabase
        .from(this.tareasTable)
        .insert([{
          ejecucion_mantenimiento_id: ejecucionId,
          tarea_id: tareaId,
          fecha_ejecucion_fin: data?.fecha_ejecucion_fin || null,
          acciones: data?.acciones || null,
          observaciones: data?.observaciones || null
        }])
        .select()
        .single();
      if (error) throw error;
      console.log(`✅ Tarea ${tareaId} agregada a ejecución ${ejecucionId}`);
      return added as EjecucionMantenimientoTarea;
    } catch (error: any) {
      console.error('❌ Error agregando tarea:', error);
      throw this.handleError(error, 'agregar tarea');
    }
  }

  /**
   * Actualizar una tarea de la ejecución
   */
  async updateTarea(ejecucionId: number, tareaId: number, updates: Partial<EjecucionMantenimientoTarea>): Promise<EjecucionMantenimientoTarea> {
    try {
      const { data, error } = await supabase
        .from(this.tareasTable)
        .update(updates)
        .eq('ejecucion_mantenimiento_id', ejecucionId)
        .eq('tarea_id', tareaId)
        .select()
        .single();
      if (error) throw error;
      console.log(`✅ Tarea ${tareaId} actualizada en ejecución ${ejecucionId}`);
      return data as EjecucionMantenimientoTarea;
    } catch (error: any) {
      console.error('❌ Error actualizando tarea:', error);
      throw this.handleError(error, 'actualizar tarea');
    }
  }

  /**
   * Eliminar una tarea de la ejecución
   */
  async removeTarea(ejecucionId: number, tareaId: number): Promise<void> {
    try {
      const { error } = await supabase
        .from(this.tareasTable)
        .delete()
        .eq('ejecucion_mantenimiento_id', ejecucionId)
        .eq('tarea_id', tareaId);
      if (error) throw error;
      console.log(`✅ Tarea ${tareaId} eliminada de ejecución ${ejecucionId}`);
    } catch (error: any) {
      console.error('❌ Error eliminando tarea:', error);
      throw this.handleError(error, 'eliminar tarea');
    }
  }

  // ==================== PRODUCTOS CONSUMIDOS ====================

  /**
   * Agregar un producto consumido durante la ejecución
   */
  async addProducto(ejecucionId: number, productoId: number, cantidad: number, detalle?: string, motivo?: string): Promise<EjecucionMantenimientoProducto> {
    try {
      const { data, error } = await supabase
        .from(this.productosTable)
        .insert([{
          ejecucion_mantenimiento_id: ejecucionId,
          producto_id: productoId,
          cantidad,
          detalle: detalle || null,
          motivo: motivo || null
        }])
        .select()
        .single();
      if (error) throw error;
      console.log(`✅ Producto ${productoId} agregado a ejecución ${ejecucionId}`);
      return data as EjecucionMantenimientoProducto;
    } catch (error: any) {
      console.error('❌ Error agregando producto:', error);
      throw this.handleError(error, 'agregar producto');
    }
  }

  /**
   * Actualizar un producto consumido
   */
  async updateProducto(productoId: number, updates: Partial<EjecucionMantenimientoProducto>): Promise<EjecucionMantenimientoProducto> {
    try {
      const { data, error } = await supabase
        .from(this.productosTable)
        .update(updates)
        .eq('id', productoId)
        .select()
        .single();
      if (error) throw error;
      console.log(`✅ Producto ${productoId} actualizado`);
      return data as EjecucionMantenimientoProducto;
    } catch (error: any) {
      console.error('❌ Error actualizando producto:', error);
      throw this.handleError(error, 'actualizar producto');
    }
  }

  /**
   * Eliminar un producto consumido
   */
  async removeProducto(productoId: number): Promise<void> {
    try {
      const { error } = await supabase
        .from(this.productosTable)
        .delete()
        .eq('id', productoId);
      if (error) throw error;
      console.log(`✅ Producto ${productoId} eliminado`);
    } catch (error: any) {
      console.error('❌ Error eliminando producto:', error);
      throw this.handleError(error, 'eliminar producto');
    }
  }

  // ==================== REEMPLAZOS ====================

  /**
   * Agregar un reemplazo de nodo
   */
  async addReemplazo(ejecucionId: number, productoId: number, nodoOriginalId: number, nodoReemplazoId: number, motivo?: string, observaciones?: string): Promise<EjecucionMantenimientoReemplazo> {
    try {
      const { data, error } = await supabase
        .from(this.reemplazosTable)
        .insert([{
          ejecucion_mantenimiento_id: ejecucionId,
          producto_id: productoId,
          nodo_original_id: nodoOriginalId,
          nodo_reemplazo_id: nodoReemplazoId,
          fecha_reemplazo: new Date().toISOString(),
          motivo: motivo || null,
          observaciones: observaciones || null
        }])
        .select()
        .single();
      if (error) throw error;
      console.log(`✅ Reemplazo agregado a ejecución ${ejecucionId}`);
      return data as EjecucionMantenimientoReemplazo;
    } catch (error: any) {
      console.error('❌ Error agregando reemplazo:', error);
      throw this.handleError(error, 'agregar reemplazo');
    }
  }

  /**
   * Actualizar un reemplazo
   */
  async updateReemplazo(reemplazoId: number, updates: Partial<EjecucionMantenimientoReemplazo>): Promise<EjecucionMantenimientoReemplazo> {
    try {
      const { data, error } = await supabase
        .from(this.reemplazosTable)
        .update(updates)
        .eq('id', reemplazoId)
        .select()
        .single();
      if (error) throw error;
      console.log(`✅ Reemplazo ${reemplazoId} actualizado`);
      return data as EjecucionMantenimientoReemplazo;
    } catch (error: any) {
      console.error('❌ Error actualizando reemplazo:', error);
      throw this.handleError(error, 'actualizar reemplazo');
    }
  }

  /**
   * Eliminar un reemplazo
   */
  async removeReemplazo(reemplazoId: number): Promise<void> {
    try {
      const { error } = await supabase
        .from(this.reemplazosTable)
        .delete()
        .eq('id', reemplazoId);
      if (error) throw error;
      console.log(`✅ Reemplazo ${reemplazoId} eliminado`);
    } catch (error: any) {
      console.error('❌ Error eliminando reemplazo:', error);
      throw this.handleError(error, 'eliminar reemplazo');
    }
  }

  // ==================== MÉTODOS AUXILIARES ====================

  /**
   * Obtener todas las ejecuciones de una orden de trabajo
   */
  async getEjecucionesByOrden(ordenTrabajoId: number): Promise<EjecucionMantenimiento[]> {
    try {
      const { data, error } = await supabase
        .from(this.ejecucionesTable)
        .select('*, ordenes_trabajo(tipo)')
        .eq('orden_trabajo_id', ordenTrabajoId)
        .order('fecha_ejecucion_inicio', { ascending: false });
      if (error) throw error;
      return (data || []).map((item: any) => ({
        ...item,
        orden_tipo: item.ordenes_trabajo?.tipo
      })) as EjecucionMantenimiento[];
    } catch (error: any) {
      console.error('❌ Error obteniendo ejecuciones de orden:', error);
      throw this.handleError(error, 'obtener ejecuciones de orden');
    }
  }
  // ==================== MANEJO DE ERRORES ====================

  private handleError(error: any, context: string): Error {
    console.error(`[${context}] Error:`, error);
    if (error.code === '23503') {
      return new Error('No se puede eliminar porque hay otros registros que dependen de este');
    }
    if (error.code === '42501') {
      return new Error('No tienes permisos para realizar esta acción');
    }
    return new Error(error.message || `Error al ${context}`);
  }
  // Agrega estos métodos a tu servicio (dentro de la clase)

  /**
   * Iniciar una ejecución (registrar hora de inicio)
   */
  async iniciarEjecucion(ordenTrabajoId: number, realizadaPor: string, detalles?: string): Promise<EjecucionMantenimiento> {
    try {
      // Verificar si la orden ya tiene una ejecución abierta (sin fecha_fin)
      const { data: ejecucionAbierta, error: checkError } = await supabase
        .from(this.ejecucionesTable)
        .select('id')
        .eq('orden_trabajo_id', ordenTrabajoId)
        .is('fecha_ejecucion_fin', null)
        .maybeSingle();
      if (checkError) throw checkError;
      if (ejecucionAbierta) {
        throw new Error('Ya existe una ejecución en curso para esta orden');
      }

      // Crear nueva ejecución
      const ejecucion = await this.createEjecucion({
        orden_trabajo_id: ordenTrabajoId,
        fecha_ejecucion_inicio: new Date().toISOString(),
        fecha_ejecucion_fin: null,
        realizada_por: realizadaPor,
        acciones: null,
        observaciones: null,
        detalles: detalles || null
      });

      // Actualizar estado de la orden a 'en_proceso'
      await this.updateOrdenEstado(ordenTrabajoId, 'en_proceso');

      return ejecucion;
    } catch (error: any) {
      console.error('❌ Error iniciando ejecución:', error);
      throw this.handleError(error, 'iniciar ejecución');
    }
  }

  /**
   * Finalizar una ejecución (registrar hora de fin, actualizar estados)
   */
  async finalizarEjecucion(
    ejecucionId: number,
    observaciones?: string,
    acciones?: string,
    tareasRealizadas?: { tarea_id: number, fecha_ejecucion_fin?: string, observaciones?: string }[],
    productosConsumidos?: { producto_id: number, cantidad: number, detalle?: string, motivo?: string }[],
    reemplazosRealizados?: { producto_id: number, nodo_original_id: number, nodo_reemplazo_id: number, motivo?: string, observaciones?: string }[]
  ): Promise<EjecucionMantenimiento> {
    try {
      // 1. Obtener la ejecución y su orden
      const { data: ejecucionData, error: getError } = await supabase
        .from(this.ejecucionesTable)
        .select('*, ordenes_trabajo(*)')
        .eq('id', ejecucionId)
        .single();
      if (getError) throw getError;
      const ejecucion = ejecucionData;
      const orden = ejecucion.ordenes_trabajo;

      // 2. Actualizar ejecución con fecha fin, acciones y observaciones
      const { data: updatedEjecucion, error: updateError } = await supabase
        .from(this.ejecucionesTable)
        .update({
          fecha_ejecucion_fin: new Date().toISOString(),
          observaciones: observaciones || null,
          acciones: acciones || null
        })
        .eq('id', ejecucionId)
        .select()
        .single();
      if (updateError) throw updateError;

      // 3. Registrar tareas realizadas (si es preventivo)
      if (tareasRealizadas && tareasRealizadas.length) {
        for (const tarea of tareasRealizadas) {
          // Agregar a ejecucion_mantenimiento_tarea
          await this.addTarea(ejecucionId, tarea.tarea_id, {
            fecha_ejecucion_fin: tarea.fecha_ejecucion_fin || new Date().toISOString(),
            observaciones: tarea.observaciones || null
          });
          // Actualizar ultima_ejecucion en tarea_nodo
          const { data: updatedRows, error: tnError } = await supabase
            .from('tarea_nodo')
            .update({ ultima_ejecucion: new Date().toISOString() })
            .eq('tarea_id', tarea.tarea_id)
            .eq('nodo_id', orden.nodo_id)
            .select();
          if (tnError) console.warn('Error actualizando tarea_nodo:', tnError);
          else if (updatedRows.length === 0) console.warn(`No se encontró tarea_nodo para tarea ${tarea.tarea_id} y nodo ${orden.nodo_id}`);
        }
      }

      // 4. Registrar productos consumidos
      if (productosConsumidos && productosConsumidos.length) {
        for (const prod of productosConsumidos) {
          await this.addProducto(ejecucionId, prod.producto_id, prod.cantidad, prod.detalle, prod.motivo);
          // (Opcional) Actualizar stock del producto
          // await this.updateProductoStock(prod.producto_id, -prod.cantidad);
        }
      }

      // 5. Registrar reemplazos
      if (reemplazosRealizados && reemplazosRealizados.length) {
        for (const rep of reemplazosRealizados) {
          await this.addReemplazo(ejecucionId, rep.producto_id, rep.nodo_original_id, rep.nodo_reemplazo_id, rep.motivo, rep.observaciones);
          // (Opcional) Actualizar stock del producto y estados de nodos
          // await this.updateProductoStock(rep.producto_id, -1);
          // await this.updateNodoEstado(rep.nodo_original_id, 'desmontado');
          // await this.updateNodoEstado(rep.nodo_reemplazo_id, 'activo');
        }
      }

      // 6. Actualizar estado de la orden a 'completada'
      await this.updateOrdenEstado(orden.id, 'completada');

      // 7. Si la orden es correctiva y tiene incidencia, cerrar incidencia
      if (orden.tipo === 'correctivo' && orden.incidencia_id) {
        const { error: incError } = await supabase
          .from('incidencias')
          .update({ estado: 'cerrada' })
          .eq('id', orden.incidencia_id);
        if (incError) console.warn('No se pudo cerrar la incidencia:', incError);
      }

      console.log(`✅ Ejecución ${ejecucionId} finalizada correctamente`);
      return updatedEjecucion as EjecucionMantenimiento;
    } catch (error: any) {
      console.error('❌ Error finalizando ejecución:', error);
      throw this.handleError(error, 'finalizar ejecución');
    }
  }

  /**
   * Método auxiliar para actualizar el estado de una orden de trabajo
   */
  private async updateOrdenEstado(ordenId: number, estado: 'pendiente' | 'en_proceso' | 'completada' | 'cancelada'): Promise<void> {
    const { error } = await supabase
      .from('ordenes_trabajo')
      .update({ estado })
      .eq('id', ordenId);
    if (error) throw error;
    console.log(`✅ Orden ${ordenId} actualizada a estado: ${estado}`);
  }




  async registrarReemplazoConCreacionNodo(
    { ejecucionId, productoId, nodoOriginalId, motivo, observaciones, nuevoNodoData }: {
      ejecucionId: number; productoId: number; nodoOriginalId: number; motivo?: string; observaciones?: string;
      // además, necesitamos datos para crear el nuevo nodo
      nuevoNodoData: { parent_id: number; tipo_id: number; nombre: string; part_number?: string; serial_number?: string; codigo?: string; criticidad?: string; cantidad_actual?: number; estanteria?: string; precio?: number; fecha_instalacion?: string; observaciones_extra?: string; estado?: string; };
    }): Promise<{ reemplazo: EjecucionMantenimientoReemplazo; nuevoNodoId: number }> {
    // 1. Crear el nuevo nodo
    const { data: nodoNuevo, error: nodoError } = await supabase
      .from('nodos')
      .insert({
        parent_id: nuevoNodoData.parent_id,
        tipo_id: nuevoNodoData.tipo_id,
        nombre: nuevoNodoData.nombre,
        descripcion: null,
        estado_activo: true
      })
      .select()
      .single();
    if (nodoError) throw nodoError;

    // 2. Insertar campos extra del nuevo nodo
    const camposExtra: Partial<CamposExtraNodo> = {
      part_number: nuevoNodoData.part_number,
      serial_number: nuevoNodoData.serial_number,
      codigo: nuevoNodoData.codigo,
      criticidad: nuevoNodoData.criticidad,
      cantidad_actual: nuevoNodoData.cantidad_actual,
      estanteria: nuevoNodoData.estanteria,
      precio: nuevoNodoData.precio,
      fecha_instalacion: nuevoNodoData.fecha_instalacion,
      observaciones: nuevoNodoData.observaciones_extra,
      estado: nuevoNodoData.estado
    };
    const { error: extraError } = await supabase
      .from('campos_extra_nodo')
      .upsert({ nodo_id: nodoNuevo.id, ...camposExtra }, { onConflict: 'nodo_id' });
    if (extraError) throw extraError;

    // 3. Registrar el reemplazo
    const reemplazo = await this.addReemplazo(
      ejecucionId,
      productoId,
      nodoOriginalId,
      nodoNuevo.id,
      motivo,
      observaciones
    );

    return { reemplazo, nuevoNodoId: nodoNuevo.id };
  }
}