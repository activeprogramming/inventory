import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';

export interface OrdenTrabajo {
  id: number;
  incidencia_id: number | null;
  nodo_id: number;
  descripcion: string | null;
  fecha_generacion: string;
  estado: 'pendiente' | 'en_proceso' | 'completada' | 'cancelada';
  tipo: 'correctivo' | 'preventivo';
  tecnico_asignado: string | null;
  observaciones: string | null;
  updated_at: string;
  // Campos relacionados (opcionales)
  incidencia_descripcion?: string;
  nodo_nombre?: string;
  nodo_tipo?: string;
}

@Injectable({
  providedIn: 'root'
})
export class OrdenesTrabajoService {
  private tableName = 'ordenes_trabajo';

  constructor() {}

  /**
   * Obtener todas las órdenes de trabajo con paginación y filtros
   */
  async getOrdenes(filters?: {
    search?: string;
    estado?: string;
    tipo?: string;
    nodo_id?: number;
    incidencia_id?: number;
    fecha_desde?: string;
    fecha_hasta?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      let query = supabase
        .from(this.tableName)
        .select('*, incidencias(descripcion), nodos(nombre, tipo_nodos(nombre))', { count: 'exact' })
        .order('fecha_generacion', { ascending: false });

      // Aplicar filtros
      if (filters?.search) {
        query = query.or(`descripcion.ilike.%${filters.search}%,observaciones.ilike.%${filters.search}%`);
      }
      if (filters?.estado && filters.estado !== 'todos') {
        query = query.eq('estado', filters.estado);
      }
      if (filters?.tipo && filters.tipo !== 'todos') {
        query = query.eq('tipo', filters.tipo);
      }
      if (filters?.nodo_id) {
        query = query.eq('nodo_id', filters.nodo_id);
      }
      if (filters?.incidencia_id) {
        query = query.eq('incidencia_id', filters.incidencia_id);
      }
      if (filters?.fecha_desde) {
        query = query.gte('fecha_generacion', filters.fecha_desde);
      }
      if (filters?.fecha_hasta) {
        query = query.lte('fecha_generacion', filters.fecha_hasta);
      }

      // Paginación
      if (filters?.limit && filters?.page) {
        const from = (filters.page - 1) * filters.limit;
        const to = from + filters.limit - 1;
        query = query.range(from, to);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      // Mapear datos con información relacionada
      const ordenes = (data || []).map((item: any) => ({
        ...item,
        incidencia_descripcion: item.incidencias?.descripcion,
        nodo_nombre: item.nodos?.nombre,
        nodo_tipo: item.nodos?.tipo_nodos?.nombre
      }));

      return {
        data: ordenes as OrdenTrabajo[],
        count: count || 0,
        page: filters?.page || 1,
        limit: filters?.limit || 10
      };
    } catch (error: any) {
      console.error('❌ Error en getOrdenes:', error);
      throw this.handleError(error, 'obtener órdenes de trabajo');
    }
  }

  /**
   * Obtener una orden de trabajo por ID
   */
  async getOrdenById(id: number): Promise<OrdenTrabajo> {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*, incidencias(descripcion), nodos(nombre, tipo_nodos(nombre))')
        .eq('id', id)
        .single();

      if (error) throw error;

      return {
        ...data,
        incidencia_descripcion: data.incidencias?.descripcion,
        nodo_nombre: data.nodos?.nombre,
        nodo_tipo: data.nodos?.tipo_nodos?.nombre
      } as OrdenTrabajo;
    } catch (error: any) {
      console.error(`❌ Error obteniendo orden ${id}:`, error);
      throw this.handleError(error, `obtener orden de trabajo ${id}`);
    }
  }

  /**
   * Crear una nueva orden de trabajo (generalmente se usa para preventivos,
   * ya que las correctivas se crean automáticamente al crear incidencia)
   */
  async createOrden(orden: Omit<OrdenTrabajo, 'id' | 'fecha_generacion' | 'updated_at'>): Promise<OrdenTrabajo> {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .insert([{
          incidencia_id: orden.incidencia_id || null,
          nodo_id: orden.nodo_id,
          descripcion: orden.descripcion || null,
          estado: orden.estado || 'pendiente',
          tipo: orden.tipo,
          tecnico_asignado: orden.tecnico_asignado || null,
          observaciones: orden.observaciones || null
        }])
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Orden de trabajo creada con ID ${data.id}`);
      return data as OrdenTrabajo;
    } catch (error: any) {
      console.error('❌ Error creando orden:', error);
      throw this.handleError(error, 'crear orden de trabajo');
    }
  }

  /**
   * Actualizar una orden de trabajo existente
   */
  async updateOrden(id: number, updates: Partial<OrdenTrabajo>): Promise<OrdenTrabajo> {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Orden ${id} actualizada`);
      return data as OrdenTrabajo;
    } catch (error: any) {
      console.error(`❌ Error actualizando orden ${id}:`, error);
      throw this.handleError(error, `actualizar orden de trabajo ${id}`);
    }
  }

  /**
   * Eliminar una orden de trabajo (hard delete)
   */
  async deleteOrden(id: number): Promise<void> {
    try {
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq('id', id);

      if (error) throw error;

      console.log(`✅ Orden ${id} eliminada`);
    } catch (error: any) {
      console.error(`❌ Error eliminando orden ${id}:`, error);
      throw this.handleError(error, `eliminar orden de trabajo ${id}`);
    }
  }

  /**
   * Obtener estadísticas de órdenes (para dashboard)
   */
  async getEstadisticas() {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('estado, tipo');

      if (error) throw error;

      const total = data?.length || 0;
      const pendientes = data?.filter(o => o.estado === 'pendiente').length || 0;
      const enProceso = data?.filter(o => o.estado === 'en_proceso').length || 0;
      const completadas = data?.filter(o => o.estado === 'completada').length || 0;
      const canceladas = data?.filter(o => o.estado === 'cancelada').length || 0;
      const correctivos = data?.filter(o => o.tipo === 'correctivo').length || 0;
      const preventivos = data?.filter(o => o.tipo === 'preventivo').length || 0;

      return { total, pendientes, enProceso, completadas, canceladas, correctivos, preventivos };
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return { total: 0, pendientes: 0, enProceso: 0, completadas: 0, canceladas: 0, correctivos: 0, preventivos: 0 };
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
    if (error.message?.includes('JWT')) {
      return new Error('Error de autenticación. Por favor, inicia sesión nuevamente');
    }

    return new Error(error.message || `Error al ${context}`);
  }
}