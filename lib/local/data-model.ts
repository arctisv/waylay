/* Record ids, typed by the table they belong to. Every id is a string; the
   table name documents which kind of record it points at. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the name is documentation.
export type Id<TableName extends string> = string;
