const { createClient } = require('@libsql/client');

let client = null;

function getTurso() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) {
      throw new Error('Turso not configured - set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN');
    }
    client = createClient({ url, authToken });
  }
  return client;
}

module.exports = { getTurso };
