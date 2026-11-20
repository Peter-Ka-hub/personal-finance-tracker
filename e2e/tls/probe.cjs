const assert = require('node:assert/strict');
const path = require('node:path');

async function probe(client) {
  if (client === 'auth-https') {
    const { seedCategories } = require(path.join(process.cwd(), 'src/clients/categories'));
    await seedCategories('tls-fixture', [{ name: 'Test', type: 'expense' }]);
    return;
  }

  assert.equal(client, 'postgres');
  const { sequelize } = require(path.join(process.cwd(), 'src/config/db'));
  try {
    await sequelize.authenticate();
    const [[{ ssl }]] = await sequelize.query('SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()');
    assert.equal(ssl, true);
  } finally {
    await sequelize.close();
  }
}

async function check() {
  const client = process.argv[2];
  const expectedError = process.env.EXPECTED_TLS_ERROR;
  if (!expectedError) {
    await probe(client);
    console.log(client, 'accepted the trusted certificate with the correct hostname');
    return;
  }
  const errors = expectedError === 'hostname' ? ['ERR_TLS_CERT_ALTNAME_INVALID'] : [
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
    'SELF_SIGNED_CERT_IN_CHAIN',
  ];
  await assert.rejects(() => probe(client), (error) => {
    const code = error.cause?.code ?? error.parent?.code ?? error.code;
    assert.ok(errors.includes(code), error.stack);
    console.log(client, 'rejected the certificate:', code);
    return true;
  });
}

check().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
