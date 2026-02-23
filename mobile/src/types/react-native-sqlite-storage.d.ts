declare module 'react-native-sqlite-storage' {
  interface SQLiteDatabase {
    executeSql(
      sql: string,
      params?: (string | number | null)[],
    ): Promise<[{ rows: { length: number; item(i: number): Record<string, unknown> }; insertId?: number }]>;
    close(): Promise<void>;
  }

  interface DatabaseOptions {
    name: string;
    location?: string;
    createFromLocation?: string;
  }

  function openDatabase(options: DatabaseOptions): Promise<SQLiteDatabase>;
  function enablePromise(enable: boolean): void;

  export default { openDatabase, enablePromise };
  export { SQLiteDatabase };
}
