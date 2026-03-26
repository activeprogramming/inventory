import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';

export interface Tarea {
  id: number;
  nombre: string;
  descripcion: string | null;
  intervalo_ejecucion_meses: number | null;
  duracion_estimada_minutos: number | null;
  detalles: string | null;
  estado: boolean;
  created_at: string;
  updated_at: string;
}

export interface TareaNodo {
  tarea_id: number;
  nodo_id: number;
  ultima_ejecucion: string | null;
  orden_ejecucion: number | null;
  detalles: string | null;
  estado: boolean | null;
  created_at: string;
  updated_at: string;
  // Opcionales para mostrar datos relacionados
  tarea_nombre?: string;
  nodo_nombre?: string;
  nodo_tipo?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TareasService {
  private tareasTable = 'tareas';
  private tareaNodoTable = 'tarea_nodo';

  constructor() {}

  // ==================== TAREAS (CRUD) ====================

  /**
   * Obtener todas las tareas con paginación y filtros
   */
  async getTareas(filters?: {
    search?: string;
    estado?: boolean;
    intervalo_min?: number;
    intervalo_max?: number;
    page?: number;
    limit?: number;
  }) {
    try {
      let query = supabase
        .from(this.tareasTable)
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (filters?.search) {
        query = query.or(`nombre.ilike.%${filters.search}%,descripcion.ilike.%${filters.search}%`);
      }
      if (filters?.estado !== undefined) {
        query = query.eq('estado', filters.estado);
      }
      if (filters?.intervalo_min !== undefined) {
        query = query.gte('intervalo_ejecucion_meses', filters.intervalo_min);
      }
      if (filters?.intervalo_max !== undefined) {
        query = query.lte('intervalo_ejecucion_meses', filters.intervalo_max);
      }

      if (filters?.limit && filters?.page) {
        const from = (filters.page - 1) * filters.limit;
        const to = from + filters.limit - 1;
        query = query.range(from, to);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        data: data as Tarea[],
        count: count || 0,
        page: filters?.page || 1,
        limit: filters?.limit || 10
      };
    } catch (error: any) {
      console.error('❌ Error en getTareas:', error);
      throw this.handleError(error, 'obtener tareas');
    }
  }

  /**
   * Obtener una tarea por ID
   */
  async getTareaById(id: number): Promise<Tarea> {
    try {
      const { data, error } = await supabase
        .from(this.tareasTable)
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Tarea;
    } catch (error: any) {
      console.error(`❌ Error obteniendo tarea ${id}:`, error);
      throw this.handleError(error, `obtener tarea ${id}`);
    }
  }

  /**
   * Crear una nueva tarea
   */
  async createTarea(tarea: Omit<Tarea, 'id' | 'created_at' | 'updated_at'>): Promise<Tarea> {
    try {
      const { data, error } = await supabase
        .from(this.tareasTable)
        .insert([{
          nombre: tarea.nombre,
          descripcion: tarea.descripcion || null,
          intervalo_ejecucion_meses: tarea.intervalo_ejecucion_meses,
          duracion_estimada_minutos: tarea.duracion_estimada_minutos,
          detalles: tarea.detalles || null,
          estado: tarea.estado ?? true
        }])
        .select()
        .single();
      if (error) throw error;
      console.log(`✅ Tarea creada: ${data.nombre} (ID: ${data.id})`);
      return data as Tarea;
    } catch (error: any) {
      console.error('❌ Error creando tarea:', error);
      throw this.handleError(error, 'crear tarea');
    }
  }

  /**
   * Actualizar una tarea existente
   */
  async updateTarea(id: number, updates: Partial<Tarea>): Promise<Tarea> {
    try {
      const { data, error } = await supabase
        .from(this.tareasTable)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      console.log(`✅ Tarea ${id} actualizada`);
      return data as Tarea;
    } catch (error: any) {
      console.error(`❌ Error actualizando tarea ${id}:`, error);
      throw this.handleError(error, `actualizar tarea ${id}`);
    }
  }

  /**
   * Eliminar tarea (hard delete) – solo si no tiene asignaciones
   */
  async deleteTarea(id: number): Promise<void> {
    try {
      // Verificar si tiene asignaciones
      const { count, error: countError } = await supabase
        .from(this.tareaNodoTable)
        .select('*', { count: 'exact', head: true })
        .eq('tarea_id', id);
      if (countError) throw countError;
      if (count && count > 0) {
        throw new Error('No se puede eliminar la tarea porque está asignada a uno o más nodos');
      }

      const { error } = await supabase
        .from(this.tareasTable)
        .delete()
        .eq('id', id);
      if (error) throw error;
      console.log(`✅ Tarea ${id} eliminada`);
    } catch (error: any) {
      console.error(`❌ Error eliminando tarea ${id}:`, error);
      throw this.handleError(error, `eliminar tarea ${id}`);
    }
  }

  // ==================== TAREA_NODO (ASIGNACIONES) ====================

  /**
   * Obtener todas las asignaciones (tarea_nodo) con paginación y filtros
   */
  async getAsignaciones(filters?: {
    tarea_id?: number;
    nodo_id?: number;
    page?: number;
    limit?: number;
  }) {
    try {
      let query = supabase
        .from(this.tareaNodoTable)
        .select('*, tareas(nombre), nodos(nombre, tipo_nodos(nombre))', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (filters?.tarea_id) {
        query = query.eq('tarea_id', filters.tarea_id);
      }
      if (filters?.nodo_id) {
        query = query.eq('nodo_id', filters.nodo_id);
      }

      if (filters?.limit && filters?.page) {
        const from = (filters.page - 1) * filters.limit;
        const to = from + filters.limit - 1;
        query = query.range(from, to);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const asignaciones = (data || []).map((item: any) => ({
        ...item,
        tarea_nombre: item.tareas?.nombre,
        nodo_nombre: item.nodos?.nombre,
        nodo_tipo: item.nodos?.tipo_nodos?.nombre
      }));

      return {
        data: asignaciones as TareaNodo[],
        count: count || 0,
        page: filters?.page || 1,
        limit: filters?.limit || 10
      };
    } catch (error: any) {
      console.error('❌ Error en getAsignaciones:', error);
      throw this.handleError(error, 'obtener asignaciones');
    }
  }

  /**
   * Asignar una tarea a un nodo (crear registro en tarea_nodo)
   */
  async asignarTarea(tarea_id: number, nodo_id: number, datos?: Partial<TareaNodo>): Promise<TareaNodo> {
    try {
      // Verificar si ya existe la asignación
      const { data: existe, error: existeError } = await supabase
        .from(this.tareaNodoTable)
        .select('*')
        .eq('tarea_id', tarea_id)
        .eq('nodo_id', nodo_id)
        .maybeSingle();
      if (existeError) throw existeError;
      if (existe) {
        throw new Error('La tarea ya está asignada a este nodo');
      }

      const { data, error } = await supabase
        .from(this.tareaNodoTable)
        .insert([{
          tarea_id,
          nodo_id,
          ultima_ejecucion: datos?.ultima_ejecucion || null,
          orden_ejecucion: datos?.orden_ejecucion || null,
          detalles: datos?.detalles || null,
          estado: datos?.estado ?? true
        }])
        .select()
        .single();
      if (error) throw error;
      console.log(`✅ Tarea ${tarea_id} asignada al nodo ${nodo_id}`);
      return data as TareaNodo;
    } catch (error: any) {
      console.error('❌ Error asignando tarea:', error);
      throw this.handleError(error, 'asignar tarea');
    }
  }

  /**
   * Desasignar una tarea de un nodo (eliminar registro)
   */
  async desasignarTarea(tarea_id: number, nodo_id: number): Promise<void> {
    try {
      const { error } = await supabase
        .from(this.tareaNodoTable)
        .delete()
        .eq('tarea_id', tarea_id)
        .eq('nodo_id', nodo_id);
      if (error) throw error;
      console.log(`✅ Tarea ${tarea_id} desasignada del nodo ${nodo_id}`);
    } catch (error: any) {
      console.error('❌ Error desasignando tarea:', error);
      throw this.handleError(error, 'desasignar tarea');
    }
  }

  /**
   * Actualizar una asignación (ej. ultima_ejecucion, orden_ejecucion, etc.)
   */
  async updateAsignacion(tarea_id: number, nodo_id: number, updates: Partial<TareaNodo>): Promise<TareaNodo> {
    try {
      const { data, error } = await supabase
        .from(this.tareaNodoTable)
        .update(updates)
        .eq('tarea_id', tarea_id)
        .eq('nodo_id', nodo_id)
        .select()
        .single();
      if (error) throw error;
      console.log(`✅ Asignación tarea ${tarea_id} - nodo ${nodo_id} actualizada`);
      return data as TareaNodo;
    } catch (error: any) {
      console.error('❌ Error actualizando asignación:', error);
      throw this.handleError(error, 'actualizar asignación');
    }
  }

  /**
   * Obtener tareas asignadas a un nodo específico
   */
  async getTareasByNodo(nodo_id: number): Promise<(TareaNodo & { tarea_nombre: string })[]> {
    try {
      const { data, error } = await supabase
        .from(this.tareaNodoTable)
        .select('*, tareas(nombre, intervalo_ejecucion_meses, duracion_estimada_minutos)')
        .eq('nodo_id', nodo_id)
        .order('orden_ejecucion', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []).map((item: any) => ({
        ...item,
        tarea_nombre: item.tareas?.nombre,
        intervalo_ejecucion_meses: item.tareas?.intervalo_ejecucion_meses,
        duracion_estimada_minutos: item.tareas?.duracion_estimada_minutos
      }));
    } catch (error: any) {
      console.error('❌ Error obteniendo tareas del nodo:', error);
      throw this.handleError(error, 'obtener tareas del nodo');
    }
  }

  /**
   * Obtener nodos a los que está asignada una tarea
   */
  async getNodosByTarea(tarea_id: number): Promise<(TareaNodo & { nodo_nombre: string })[]> {
    try {
      const { data, error } = await supabase
        .from(this.tareaNodoTable)
        .select('*, nodos(nombre, tipo_nodos(nombre))')
        .eq('tarea_id', tarea_id)
       .order('orden_ejecucion', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []).map((item: any) => ({
        ...item,
        nodo_nombre: item.nodos?.nombre,
        nodo_tipo: item.nodos?.tipo_nodos?.nombre
      }));
    } catch (error: any) {
      console.error('❌ Error obteniendo nodos de la tarea:', error);
      throw this.handleError(error, 'obtener nodos de la tarea');
    }
  }

  // ==================== AUXILIARES ====================

  /**
   * Estadísticas de tareas (activas/inactivas)
   */
  async getEstadisticas() {
    try {
      const { data, error } = await supabase
        .from(this.tareasTable)
        .select('estado');
      if (error) throw error;
      const total = data?.length || 0;
      const activas = data?.filter(t => t.estado === true).length || 0;
      const inactivas = total - activas;
      return { total, activas, inactivas };
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return { total: 0, activas: 0, inactivas: 0 };
    }
  }

  // ==================== MANEJO DE ERRORES ====================

  private handleError(error: any, context: string): Error {
    console.error(`[${context}] Error:`, error);
    if (error.code === '23505') {
      return new Error('Ya existe una asignación con esos datos');
    }
    if (error.code === '23503') {
      return new Error('No se puede eliminar porque hay dependencias');
    }
    if (error.code === '42501') {
      return new Error('No tienes permisos para realizar esta acción');
    }
    return new Error(error.message || `Error al ${context}`);
  }
}