// Storage is handled directly via Drizzle ORM in routes.ts
// This file is kept for template compatibility

export interface IStorage {}
export class MemStorage implements IStorage {}
export const storage = new MemStorage();
