import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('external_auth')
    .addColumn('provider', 'varchar', (col) => col.notNull())
    .addColumn('externalId', 'varchar', (col) => col.notNull())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('updatedAt', 'varchar', (col) => col.notNull())
    .addColumn('meta', 'varchar')
    .addPrimaryKeyConstraint('external_auth_pkey', ['provider', 'externalId'])
    .execute()

  await db.schema
    .createIndex('external_auth_did_idx')
    .on('external_auth')
    .column('did')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('external_auth_did_idx').execute()
  await db.schema.dropTable('external_auth').execute()
}
