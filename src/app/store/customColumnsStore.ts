/**
 * Zustand store for custom column definitions
 * Allows users to create, edit, and delete custom columns per view
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { ValidationRule } from '../utils/validators';

export type CustomColumnType = 'text' | 'number' | 'date' | 'choice' | 'lookup';

export interface CustomColumn {
  id: string;
  viewId: string;
  name: string;
  displayName: string;
  type: CustomColumnType;
  description?: string;
  required?: boolean;
  rules?: ValidationRule[];
  defaultValue?: any;
  options?: string[]; // For 'choice' type
  lookupField?: string; // For 'lookup' type
  width?: number;
  isVisible?: boolean;
  position?: number; // Column order
  createdAt: string;
  updatedAt: string;
}

export interface CustomColumnsStore {
  columns: CustomColumn[];
  addColumn: (viewId: string, column: Omit<CustomColumn, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateColumn: (columnId: string, updates: Partial<CustomColumn>) => void;
  deleteColumn: (columnId: string) => void;
  getColumnsByView: (viewId: string) => CustomColumn[];
  getColumn: (columnId: string) => CustomColumn | undefined;
  reorderColumns: (viewId: string, columnIds: string[]) => void;
  setColumnVisibility: (columnId: string, visible: boolean) => void;
  importColumns: (viewId: string, columns: CustomColumn[]) => void;
  exportColumns: (viewId: string) => CustomColumn[];
  resetColumns: (viewId: string) => void;
}

export const useCustomColumnsStore = create<CustomColumnsStore>()(
  persist(
    (set, get) => ({
      columns: [],

      addColumn: (_viewId: string, column: Omit<CustomColumn, 'id' | 'createdAt' | 'updatedAt'>) => {
        const id = uuidv4();
        const now = new Date().toISOString();
        const newColumn: CustomColumn = {
          ...column,
          id,
          createdAt: now,
          updatedAt: now
        };

        set((state) => ({
          columns: [...state.columns, newColumn]
        }));

        return id;
      },

      updateColumn: (columnId: string, updates: Partial<CustomColumn>) => {
        set((state) => ({
          columns: state.columns.map((col) =>
            col.id === columnId
              ? {
                  ...col,
                  ...updates,
                  updatedAt: new Date().toISOString()
                }
              : col
          )
        }));
      },

      deleteColumn: (columnId: string) => {
        set((state) => ({
          columns: state.columns.filter((col) => col.id !== columnId)
        }));
      },

      getColumnsByView: (viewId: string) => {
        return get()
          .columns.filter((col) => col.viewId === viewId)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      },

      getColumn: (columnId: string) => {
        return get().columns.find((col) => col.id === columnId);
      },

      reorderColumns: (viewId: string, columnIds: string[]) => {
        set((state) => ({
          columns: state.columns.map((col) => {
            if (col.viewId === viewId) {
              const index = columnIds.indexOf(col.id);
              return { ...col, position: index >= 0 ? index : col.position ?? 0 };
            }
            return col;
          })
        }));
      },

      setColumnVisibility: (columnId: string, visible: boolean) => {
        set((state) => ({
          columns: state.columns.map((col) =>
            col.id === columnId ? { ...col, isVisible: visible } : col
          )
        }));
      },

      importColumns: (viewId: string, columns: CustomColumn[]) => {
        set((state) => {
          const newColumns = columns.map((col) => ({
            ...col,
            id: uuidv4(),
            viewId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }));
          return {
            columns: [...state.columns, ...newColumns]
          };
        });
      },

      exportColumns: (viewId: string) => {
        return get()
          .columns.filter((col) => col.viewId === viewId)
          .map((col) => ({
            ...col,
            id: uuidv4() // Generate new IDs for import
          }));
      },

      resetColumns: (viewId: string) => {
        set((state) => ({
          columns: state.columns.filter((col) => col.viewId !== viewId)
        }));
      }
    }),
    {
      name: 'css-custom-columns-store'
    }
  )
);
