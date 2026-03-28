import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';
import { environment } from '../environments/environment';
import { ChangeDetectorRef } from '@angular/core';

export interface CamposExtraNodo {
  nodo_id: number;
  componente: string | null;
  criticidad: string;
  part_number: string | null;
  codigo: string | null;
  serial_number: string | null;
  cantidad_actual: number;
  estanteria: string | null;
  precio: number | null;
  fecha_instalacion: string | null;
  observaciones: string | null;
  estado: string;
}

export interface Nodo {
  id: number;
  parent_id: number | null;
  tipo_id: number;
  nombre: string;
  descripcion: string | null;
  estado_activo: boolean;
  created_at: string;
  updated_at: string;
  // Propiedades para UI y relaciones
  hijos?: Nodo[];
  colapsado?: boolean;
  campos_extra?: CamposExtraNodo | null;
  tipo_nombre?: string;
  es_equipo?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NodosService {
  
  
async desactivarNodo(id: number, motivo?: string): Promise<void> {
  // Solo actualiza el estado_activo a false
  const { error } = await supabase
    .from(this.tableName)
    .update({ estado_activo: false })
    .eq('id', id);
  if (error) throw error;
  console.log(`✅ Nodo ${id} desactivado`);
}
  // Retornar el nodo raíz
  getArbolOptimizado(arg0: null) {
    throw new Error('Method not implemented.');
  }
  private tableName = 'nodos';
  private camposExtraTable = 'campos_extra_nodo';

  constructor() {}

  // Obtener todos los nodos raíz (parent_id IS NULL)
  async getNodosRaiz(): Promise<Nodo[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*, tipo_nodos(nombre, es_equipo)')
      .is('parent_id', null)
      .eq('estado_activo', true)
      .order('nombre');
    if (error) throw error;
    return (data || []).map(this.mapNodo);
  }

  // Obtener un nodo por ID con sus hijos (un nivel)
  async getNodoConHijos(id: number): Promise<Nodo> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*, tipo_nodos(nombre, es_equipo)')
      .eq('id', id)
      .single();
    if (error) throw error;
    const nodo = this.mapNodo(data);
   const { data: hijos, error: hijosError } = await supabase
  .from(this.tableName)
  .select('*, tipo_nodos(nombre, es_equipo)')
  .eq('parent_id', id)
  .order('nombre');
nodo.hijos = (hijos || []).map(this.mapNodo);
    return nodo;
  }

  // Obtener todo el árbol desde una raíz (recursivo)
async getArbol(rootId: number): Promise<Nodo> {
  const { data, error } = await supabase.rpc('get_arbol', { root_id: rootId });
  if (error) throw error;
  // data es un array plano de nodos, debemos reconstruir el árbol
  return this.buildTreeFromFlat(data, rootId);
}

async crearNodoCompletox(datos: {
  parent_id: number | null;
  tipo_id: number;
  nombre: string;
  part_number?: string | null;
  serial_number?: string | null;
  codigo?: string | null;
  criticidad?: string;
  cantidad_actual?: number;
  estanteria?: string | null;
  precio?: number | null;
  fecha_instalacion?: string | null;
  observaciones_extra?: string | null;
  estado?: string;
}): Promise<number> {
  // 1. Insertar en nodos
  const { data: nodo, error: nodoError } = await supabase
    .from('nodos')
    .insert({
      parent_id: datos.parent_id,
      tipo_id: datos.tipo_id,
      nombre: datos.nombre,
      estado_activo: true,
      descripcion: null
    })
    .select()
    .single();
  if (nodoError) throw nodoError;

  // 2. Insertar en campos_extra_nodo
  const { error: extraError } = await supabase
    .from('campos_extra_nodo')
    .insert({
      nodo_id: nodo.id,
      part_number: datos.part_number || null,
      serial_number: datos.serial_number || null,
      codigo: datos.codigo || null,
      criticidad: datos.criticidad || 'medio',
      cantidad_actual: datos.cantidad_actual ?? 1,
      estanteria: datos.estanteria || null,
      precio: datos.precio || null,
      fecha_instalacion: datos.fecha_instalacion || new Date().toISOString(),
      observaciones: datos.observaciones_extra || null,
      estado: datos.estado || 'activo'
    });
  if (extraError) throw extraError;

  return nodo.id;
}
// Convierte un array plano de nodos (con parent_id) en un árbol jerárquico
private buildTreeFromFlat(flatNodes: any[], rootId: number): Nodo {
  // Crear un mapa de nodos por id
  const nodeMap = new Map<number, Nodo>();
  const nodes = flatNodes.map(item => this.mapNodo(item));

  // Registrar todos los nodos en el mapa
  nodes.forEach(node => {
    nodeMap.set(node.id, node);
    node.hijos = []; // inicializar hijos vacío
  });

  // Construir relaciones
  nodes.forEach(node => {
    if (node.parent_id && node.parent_id !== null && nodeMap.has(node.parent_id)) {
      const parent = nodeMap.get(node.parent_id)!;
      if (!parent.hijos) parent.hijos = [];
      parent.hijos.push(node);
    }
  });

  // Retornar el nodo raíz
  return nodeMap.get(rootId)!;
}



  // Crear nodo básico
  async createNodo(nodo: Omit<Nodo, 'id' | 'created_at' | 'updated_at'>): Promise<Nodo> {
    const { data, error } = await supabase
      .from(this.tableName)
      .insert([{
        parent_id: nodo.parent_id || null,
        tipo_id: nodo.tipo_id,
        nombre: nodo.nombre,
        descripcion: nodo.descripcion || null,
        estado_activo: nodo.estado_activo ?? true
      }])
      .select()
      .single();
    if (error) throw error;
    return this.mapNodo(data);
  }

  // Actualizar nodo básico
  async updateNodo(id: number, updates: Partial<Nodo>): Promise<Nodo> {
    const { data, error } = await supabase
      .from(this.tableName)
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return this.mapNodo(data);
  }

  // Eliminar nodo (hard delete, solo si no tiene hijos)
  async deleteNodo(id: number): Promise<void> {
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  // Obtener campos extra de un nodo
  async getCamposExtra(nodoId: number): Promise<CamposExtraNodo | null> {
    const { data, error } = await supabase
      .from(this.camposExtraTable)
      .select('*')
      .eq('nodo_id', nodoId)
      .maybeSingle();
    if (error) throw error;
    return data as CamposExtraNodo | null;
  }

  // Crear o actualizar campos extra
 async upsertCamposExtra(nodoId: number, campos: Partial<CamposExtraNodo>): Promise<void> {
  console.log('upsertCamposExtra llamado con:', { nodoId, campos });
  const { data, error } = await supabase
    .from(this.camposExtraTable)
    .upsert({ nodo_id: nodoId, ...campos }, { onConflict: 'nodo_id' })
    .select();
  if (error) {
    console.error('Error en upsertCamposExtra:', error);
    throw error;
  }
  console.log('upsert exitoso, data:', data);
}

  // Mapear datos de Supabase a Nodo
 private mapNodo(data: any): Nodo {
  // Build campos_extra from available fields
  const camposExtra: CamposExtraNodo = {
    nodo_id: data.id,
    componente: data.componente || null,
    criticidad: data.criticidad || 'medio',
    part_number: data.part_number || null,
    codigo: data.codigo || null,
    serial_number: data.serial_number || null,
    cantidad_actual: data.cantidad_actual ?? 1,
    estanteria: data.estanteria || null,
    precio: data.precio ?? null,
    fecha_instalacion: data.fecha_instalacion || null,
    observaciones: data.observaciones || null,
    estado: data.extra_estado || 'activo'  // using the alias from RPC
  };

  return {
    id: data.id,
    parent_id: data.parent_id,
    tipo_id: data.tipo_id,
    nombre: data.nombre,
    descripcion: data.descripcion,
    estado_activo: data.estado_activo,
    created_at: data.created_at,
    updated_at: data.updated_at,
    tipo_nombre: data.tipo_nombre,   // from RPC
    es_equipo: data.es_equipo,       // from RPC
    hijos: [],
    campos_extra: camposExtra
  };
}
}