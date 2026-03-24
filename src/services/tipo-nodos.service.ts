// tipo-nodos.service.ts
import { Injectable } from '@angular/core';
import { supabase } from './supabase-client'; // Ajusta la ruta según tu proyecto
import { environment } from '../environments/environment';

export interface TipoNodo {
  id: number;
  nombre: string;
  detalles: string | null;
  es_equipo: boolean;        // true = equipo/componente, false = ubicación
  estado: boolean;           // true = activo, false = inactivo
  created_at: string;
  updated_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class TipoNodosService {
  private tableName = 'tipo_nodos';

  constructor() {
    console.log('✅ TipoNodosService inicializado con environment:', {
      production: environment.production,
      url: environment.supabaseUrl
    });
  }

  // ==================== CRUD COMPLETO ====================

  /**
   * Obtener todos los tipos de nodo con filtros y paginación
   */
  async getTipos(filters?: {
    nombre?: string;
    es_equipo?: boolean;
    estado?: boolean;
    search?: string;
    limit?: number;
    page?: number;
  }) {
    try {
      console.log('📡 Obteniendo tipos de nodo con filtros:', filters);
      
      let query = supabase
        .from(this.tableName)
        .select('*', { count: 'exact' })
        .order('id', { ascending: false });

      // Aplicar filtros exactos
      if (filters?.nombre) {
        query = query.eq('nombre', filters.nombre);
      }
      if (filters?.es_equipo !== undefined) {
        query = query.eq('es_equipo', filters.es_equipo);
      }
      if (filters?.estado !== undefined) {
        query = query.eq('estado', filters.estado);
      }

      // Búsqueda por texto (nombre o detalles)
      if (filters?.search) {
        query = query.or(`nombre.ilike.%${filters.search}%,detalles.ilike.%${filters.search}%`);
      }

      // Paginación
      if (filters?.limit && filters?.page) {
        const from = (filters.page - 1) * filters.limit;
        const to = from + filters.limit - 1;
        query = query.range(from, to);
      }

      const { data, error, count } = await query;
      
      if (error) {
        console.error('❌ Error en getTipos:', error);
        throw error;
      }
      
      console.log(`✅ ${data?.length || 0} tipos de nodo obtenidos`);
      return { 
        data: data as TipoNodo[], 
        count: count || 0,
        page: filters?.page || 1,
        limit: filters?.limit || 10
      };
      
    } catch (error: any) {
      console.error('💥 Error crítico en getTipos:', error);
      throw this.handleError(error, 'obtener tipos de nodo');
    }
  }

  /**
   * Obtener un tipo de nodo por ID
   */
  async getTipoById(id: number): Promise<TipoNodo> {
    try {
      console.log(`📡 Obteniendo tipo de nodo ID: ${id}`);
      
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      console.log(`✅ Tipo de nodo ${id} obtenido:`, data?.nombre);
      return data as TipoNodo;
      
    } catch (error: any) {
      console.error(`❌ Error obteniendo tipo de nodo ${id}:`, error);
      throw this.handleError(error, `obtener tipo de nodo ${id}`);
    }
  }

  /**
   * Crear un nuevo tipo de nodo
   */
  async createTipo(tipo: Omit<TipoNodo, 'id' | 'created_at' | 'updated_at'>) {
    try {
      console.log('➕ Creando nuevo tipo de nodo:', tipo.nombre);
      
      // Verificar si ya existe un tipo con el mismo nombre
      const { data: exists } = await supabase
        .from(this.tableName)
        .select('id')
        .eq('nombre', tipo.nombre)
        .maybeSingle();
      
      if (exists) {
        throw new Error(`Ya existe un tipo de nodo con el nombre "${tipo.nombre}"`);
      }

      // Asegurar valores por defecto
      const newTipo = {
        ...tipo,
        estado: tipo.estado !== undefined ? tipo.estado : true,
        es_equipo: tipo.es_equipo !== undefined ? tipo.es_equipo : false
      };

      const { data, error } = await supabase
        .from(this.tableName)
        .insert([newTipo])
        .select()
        .single();

      if (error) throw error;
      
      console.log(`✅ Tipo de nodo creado: ${data.nombre} (ID: ${data.id})`);
      return data as TipoNodo;
      
    } catch (error: any) {
      console.error('❌ Error creando tipo de nodo:', error);
      throw this.handleError(error, 'crear tipo de nodo');
    }
  }

  /**
   * Actualizar tipo de nodo
   */
  async updateTipo(id: number, updates: Partial<TipoNodo>) {
    try {
      console.log(`✏️ Actualizando tipo de nodo ID: ${id}`, updates);
      
      // Si se actualiza el nombre, verificar que no exista otro con el mismo nombre
      if (updates.nombre) {
        const { data: exists } = await supabase
          .from(this.tableName)
          .select('id')
          .eq('nombre', updates.nombre)
          .neq('id', id)
          .maybeSingle();
        
        if (exists) {
          throw new Error(`Ya existe otro tipo de nodo con el nombre "${updates.nombre}"`);
        }
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      console.log(`✅ Tipo de nodo ${id} actualizado`);
      return data as TipoNodo;
      
    } catch (error: any) {
      console.error(`❌ Error actualizando tipo de nodo ${id}:`, error);
      throw this.handleError(error, `actualizar tipo de nodo ${id}`);
    }
  }

  /**
   * Desactivar tipo de nodo (soft delete, estado = false)
   */
  async desactivarTipo(id: number) {
    try {
      console.log(`⏸️ Desactivando tipo de nodo ID: ${id}`);
      
      // Verificar si hay nodos usando este tipo
      const { data: nodos, error: nodosError } = await supabase
        .from('nodos')
        .select('id')
        .eq('tipo_id', id)
        .limit(1);
      
      if (nodosError) throw nodosError;
      if (nodos && nodos.length > 0) {
        throw new Error('No se puede desactivar el tipo de nodo porque tiene nodos asociados');
      }

      const { error } = await supabase
        .from(this.tableName)
        .update({ estado: false })
        .eq('id', id);

      if (error) throw error;
      
      console.log(`✅ Tipo de nodo ${id} desactivado`);
      return true;
      
    } catch (error: any) {
      console.error(`❌ Error desactivando tipo de nodo ${id}:`, error);
      throw this.handleError(error, `desactivar tipo de nodo ${id}`);
    }
  }

  /**
   * Activar tipo de nodo (estado = true)
   */
  async activarTipo(id: number) {
    try {
      console.log(`▶️ Activando tipo de nodo ID: ${id}`);
      
      const { error } = await supabase
        .from(this.tableName)
        .update({ estado: true })
        .eq('id', id);

      if (error) throw error;
      
      console.log(`✅ Tipo de nodo ${id} activado`);
      return true;
      
    } catch (error: any) {
      console.error(`❌ Error activando tipo de nodo ${id}:`, error);
      throw this.handleError(error, `activar tipo de nodo ${id}`);
    }
  }

  /**
   * Eliminar permanentemente (hard delete) - Solo si no tiene nodos asociados
   */
  async eliminarTipo(id: number) {
    try {
      console.log(`🗑️ Eliminando permanentemente tipo de nodo ID: ${id}`);
      
      // Verificar si hay nodos usando este tipo
      const { data: nodos } = await supabase
        .from('nodos')
        .select('id')
        .eq('tipo_id', id)
        .limit(1);
      
      if (nodos && nodos.length > 0) {
        throw new Error('No se puede eliminar el tipo de nodo porque tiene nodos asociados');
      }

      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      console.log(`✅ Tipo de nodo ${id} eliminado permanentemente`);
      return true;
      
    } catch (error: any) {
      console.error(`❌ Error eliminando tipo de nodo ${id}:`, error);
      throw this.handleError(error, `eliminar tipo de nodo ${id}`);
    }
  }

  // ==================== MÉTODOS ESPECÍFICOS ====================

  /**
   * Obtener tipos de nodo activos para dropdowns
   */
  async getTiposActivos() {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('id, nombre, es_equipo')
        .eq('estado', true)
        .order('nombre');

      if (error) throw error;
      return data;
      
    } catch (error: any) {
      console.error('❌ Error obteniendo tipos activos:', error);
      return [];
    }
  }

  /**
   * Obtener solo tipos que representan equipos (es_equipo = true)
   */
  async getTiposEquipo() {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('es_equipo', true)
        .eq('estado', true)
        .order('nombre');

      if (error) throw error;
      return data as TipoNodo[];
      
    } catch (error: any) {
      console.error('❌ Error obteniendo tipos de equipo:', error);
      return [];
    }
  }

  /**
   * Obtener solo tipos que representan ubicaciones (es_equipo = false)
   */
  async getTiposUbicacion() {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('es_equipo', false)
        .eq('estado', true)
        .order('nombre');

      if (error) throw error;
      return data as TipoNodo[];
      
    } catch (error: any) {
      console.error('❌ Error obteniendo tipos de ubicación:', error);
      return [];
    }
  }

  /**
   * Verificar si existe tipo con mismo nombre
   */
  async checkNombreExists(nombre: string, excludeId?: number): Promise<boolean> {
    try {
      let query = supabase
        .from(this.tableName)
        .select('id')
        .eq('nombre', nombre);

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return (data?.length || 0) > 0;
      
    } catch (error) {
      console.error('❌ Error verificando nombre:', error);
      return false;
    }
  }

  /**
   * Estadísticas de tipos de nodo
   */
  async getEstadisticas() {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('estado, es_equipo');

      if (error) throw error;

      const total = data?.length || 0;
      const activos = data?.filter(t => t.estado === true).length || 0;
      const inactivos = data?.filter(t => t.estado === false).length || 0;
      const equipos = data?.filter(t => t.es_equipo === true).length || 0;
      const ubicaciones = data?.filter(t => t.es_equipo === false).length || 0;

      return { total, activos, inactivos, equipos, ubicaciones };
      
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return { total: 0, activos: 0, inactivos: 0, equipos: 0, ubicaciones: 0 };
    }
  }

  // ==================== MANEJO DE ERRORES ====================

  private handleError(error: any, context: string): Error {
    console.error(`[${context}] Error:`, error);
    
    // Errores comunes de Supabase
    if (error.code === '23505') {
      return new Error('Ya existe un tipo de nodo con ese nombre');
    }
    
    if (error.code === '42501') {
      return new Error('No tienes permisos para realizar esta acción');
    }
    
    if (error.code === '42P01') {
      return new Error('La tabla de tipos de nodo no existe');
    }
    
    if (error.message?.includes('JWT')) {
      return new Error('Error de autenticación. Por favor, inicia sesión nuevamente');
    }
    
    // Mensaje personalizado para el usuario
    return new Error(error.message || `Error al ${context}`);
  }
}