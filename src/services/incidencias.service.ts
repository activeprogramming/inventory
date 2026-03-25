import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';
import { environment } from '../environments/environment';

// Interfaces
export interface Incidencia {
  id: number;
  nodo_id: number;
  descripcion: string | null;
  fecha_reporte: string;
  reportado_por: string | null;
  estado: 'abierta' | 'en_proceso' | 'cerrada';
  prioridad: 'baja' | 'media' | 'alta' | 'critica';
  detalles: string | null;
  created_at: string;
  updated_at: string;
  // Opcionales para mostrar datos relacionados
  nodo_nombre?: string;
  nodo_tipo?: string;
}

export interface OrdenTrabajo {
  id: number;
  incidencia_id: number;
  nodo_id: number;
  descripcion: string | null;
  fecha_generacion: string;
  estado: 'pendiente' | 'en_proceso' | 'completada' | 'cancelada';
  tipo: 'correctivo' | 'preventivo';
  tecnico_asignado: string | null;
  observaciones: string | null;
  updated_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class IncidenciasService {
  private tableName = 'incidencias';
  private ordenesTable = 'ordenes_trabajo';

  constructor() {}

  // ==================== INCIDENCIAS ====================

  /**
   * Obtener todas las incidencias con paginación y filtros
   */
  async getIncidencias(filters?: {
    search?: string;
    estado?: string;
    prioridad?: string;
    nodo_id?: number;
    fecha_desde?: string;
    fecha_hasta?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      let query = supabase
        .from(this.tableName)
        .select('*, nodos(nombre, tipo_nodos(nombre))', { count: 'exact' })
        .order('fecha_reporte', { ascending: false });

      // Aplicar filtros
      if (filters?.search) {
        query = query.or(`descripcion.ilike.%${filters.search}%,detalles.ilike.%${filters.search}%`);
      }
      if (filters?.estado && filters.estado !== 'todos') {
        query = query.eq('estado', filters.estado);
      }
      if (filters?.prioridad && filters.prioridad !== 'todos') {
        query = query.eq('prioridad', filters.prioridad);
      }
      if (filters?.nodo_id) {
        query = query.eq('nodo_id', filters.nodo_id);
      }
      if (filters?.fecha_desde) {
        query = query.gte('fecha_reporte', filters.fecha_desde);
      }
      if (filters?.fecha_hasta) {
        query = query.lte('fecha_reporte', filters.fecha_hasta);
      }

      // Paginación
      if (filters?.limit && filters?.page) {
        const from = (filters.page - 1) * filters.limit;
        const to = from + filters.limit - 1;
        query = query.range(from, to);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      // Mapear datos con información del nodo
      const incidencias = (data || []).map((item: any) => ({
        ...item,
        nodo_nombre: item.nodos?.nombre,
        nodo_tipo: item.nodos?.tipo_nodos?.nombre
      }));

      return {
        data: incidencias as Incidencia[],
        count: count || 0,
        page: filters?.page || 1,
        limit: filters?.limit || 10
      };
    } catch (error: any) {
      console.error('❌ Error en getIncidencias:', error);
      throw this.handleError(error, 'obtener incidencias');
    }
  }

  /**
   * Obtener una incidencia por ID
   */
  async getIncidenciaById(id: number): Promise<Incidencia> {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*, nodos(nombre, tipo_nodos(nombre))')
        .eq('id', id)
        .single();

      if (error) throw error;

      return {
        ...data,
        nodo_nombre: data.nodos?.nombre,
        nodo_tipo: data.nodos?.tipo_nodos?.nombre
      } as Incidencia;
    } catch (error: any) {
      console.error(`❌ Error obteniendo incidencia ${id}:`, error);
      throw this.handleError(error, `obtener incidencia ${id}`);
    }
  }

  /**
   * Crear una nueva incidencia y generar automáticamente la orden de trabajo asociada
   */
  async createIncidencia(incidencia: Omit<Incidencia, 'id' | 'created_at' | 'updated_at' | 'fecha_reporte'>) {
    try {
      // Validar que el nodo sea un equipo (opcional, pero puedes implementarlo)
      // Si es necesario, puedes hacer una consulta a nodos con tipo equipo.

      // 1. Insertar incidencia
      const { data: incidenciaData, error: incidenciaError } = await supabase
        .from(this.tableName)
        .insert([{
          nodo_id: incidencia.nodo_id,
          descripcion: incidencia.descripcion || null,
          reportado_por: incidencia.reportado_por || null,
          estado: incidencia.estado || 'abierta',
          prioridad: incidencia.prioridad || 'media',
          detalles: incidencia.detalles || null,
          fecha_reporte: new Date().toISOString()
        }])
        .select()
        .single();

      if (incidenciaError) throw incidenciaError;

      // 2. Crear orden de trabajo asociada
      const ordenData: Omit<OrdenTrabajo, 'id' | 'fecha_generacion' | 'updated_at'> = {
        incidencia_id: incidenciaData.id,
        nodo_id: incidencia.nodo_id,
        descripcion: incidencia.descripcion || `Incidencia #${incidenciaData.id}`,
        estado: 'pendiente',
        tipo: 'correctivo',
        tecnico_asignado: null,
        observaciones: null
      };

      const { error: ordenError } = await supabase
        .from(this.ordenesTable)
        .insert([ordenData]);

      if (ordenError) throw ordenError;

      console.log(`✅ Incidencia creada con ID ${incidenciaData.id} y orden de trabajo asociada`);
      return incidenciaData as Incidencia;
    } catch (error: any) {
      console.error('❌ Error creando incidencia:', error);
      throw this.handleError(error, 'crear incidencia');
    }
  }

  /**
   * Actualizar una incidencia existente
   */
  async updateIncidencia(id: number, updates: Partial<Incidencia>) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Incidencia ${id} actualizada`);
      return data as Incidencia;
    } catch (error: any) {
      console.error(`❌ Error actualizando incidencia ${id}:`, error);
      throw this.handleError(error, `actualizar incidencia ${id}`);
    }
  }

  /**
   * Eliminar incidencia (hard delete) – también elimina la orden de trabajo por ON DELETE CASCADE
   */
  async deleteIncidencia(id: number) {
    try {
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq('id', id);

      if (error) throw error;

      console.log(`✅ Incidencia ${id} eliminada`);
      return true;
    } catch (error: any) {
      console.error(`❌ Error eliminando incidencia ${id}:`, error);
      throw this.handleError(error, `eliminar incidencia ${id}`);
    }
  }

  // ==================== ÓRDENES DE TRABAJO (CRUD básico) ====================

  /**
   * Obtener órdenes de trabajo (pueden filtrarse por incidencia, nodo, estado, etc.)
   */
  async getOrdenesTrabajo(filters?: {
    incidencia_id?: number;
    nodo_id?: number;
    estado?: string;
    tipo?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      let query = supabase
        .from(this.ordenesTable)
        .select('*, incidencias(descripcion), nodos(nombre)', { count: 'exact' })
        .order('fecha_generacion', { ascending: false });

      if (filters?.incidencia_id) {
        query = query.eq('incidencia_id', filters.incidencia_id);
      }
      if (filters?.nodo_id) {
        query = query.eq('nodo_id', filters.nodo_id);
      }
      if (filters?.estado && filters.estado !== 'todos') {
        query = query.eq('estado', filters.estado);
      }
      if (filters?.tipo && filters.tipo !== 'todos') {
        query = query.eq('tipo', filters.tipo);
      }

      if (filters?.limit && filters?.page) {
        const from = (filters.page - 1) * filters.limit;
        const to = from + filters.limit - 1;
        query = query.range(from, to);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      const ordenes = (data || []).map((item: any) => ({
        ...item,
        incidencia_descripcion: item.incidencias?.descripcion,
        nodo_nombre: item.nodos?.nombre
      }));

      return {
        data: ordenes as OrdenTrabajo[],
        count: count || 0,
        page: filters?.page || 1,
        limit: filters?.limit || 10
      };
    } catch (error: any) {
      console.error('❌ Error en getOrdenesTrabajo:', error);
      throw this.handleError(error, 'obtener órdenes de trabajo');
    }
  }

  /**
   * Obtener una orden de trabajo por ID
   */
  async getOrdenTrabajoById(id: number): Promise<OrdenTrabajo> {
    try {
      const { data, error } = await supabase
        .from(this.ordenesTable)
        .select('*, incidencias(descripcion), nodos(nombre)')
        .eq('id', id)
        .single();

      if (error) throw error;

      return {
        ...data,
        incidencia_descripcion: data.incidencias?.descripcion,
        nodo_nombre: data.nodos?.nombre
      } as OrdenTrabajo;
    } catch (error: any) {
      console.error(`❌ Error obteniendo orden de trabajo ${id}:`, error);
      throw this.handleError(error, `obtener orden de trabajo ${id}`);
    }
  }

  /**
   * Actualizar orden de trabajo
   */
  async updateOrdenTrabajo(id: number, updates: Partial<OrdenTrabajo>) {
    try {
      const { data, error } = await supabase
        .from(this.ordenesTable)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Orden de trabajo ${id} actualizada`);
      return data as OrdenTrabajo;
    } catch (error: any) {
      console.error(`❌ Error actualizando orden de trabajo ${id}:`, error);
      throw this.handleError(error, `actualizar orden de trabajo ${id}`);
    }
  }

  // ==================== AUXILIARES ====================

  /**
   * Obtener estadísticas de incidencias (para dashboard)
   */
  async getEstadisticas() {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('estado, prioridad');

      if (error) throw error;

      const total = data?.length || 0;
      const abiertas = data?.filter(i => i.estado === 'abierta').length || 0;
      const enProceso = data?.filter(i => i.estado === 'en_proceso').length || 0;
      const cerradas = data?.filter(i => i.estado === 'cerrada').length || 0;
      const criticas = data?.filter(i => i.prioridad === 'critica').length || 0;
      const altas = data?.filter(i => i.prioridad === 'alta').length || 0;

      return { total, abiertas, enProceso, cerradas, criticas, altas };
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return { total: 0, abiertas: 0, enProceso: 0, cerradas: 0, criticas: 0, altas: 0 };
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