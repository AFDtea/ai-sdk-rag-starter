// scripts/setup-schema.ts
import { driver } from '../lib/db/client'

async function setupSchema() {
  const session = driver.session()
  try {
    // Create constraints
    await session.run(`
      CREATE CONSTRAINT resource_id IF NOT EXISTS
      FOR (r:Resource) REQUIRE r.id IS UNIQUE
    `)

    // Create vector index
    await session.run(`
      CALL db.index.vector.createNodeIndex(
        'documentEmbeddings',
        'Resource',
        'embedding',
        1536,
        'cosine'
      )
    `)
    
    console.log('Schema setup complete')
  } catch (error) {
    console.error('Error setting up schema:', error)
  } finally {
    await session.close()
    await driver.close()
  }
}

setupSchema()