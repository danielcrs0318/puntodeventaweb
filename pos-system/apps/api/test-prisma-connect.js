const { PrismaClient } = require('@prisma/client');
(async function(){
  const urls = ['mysql://root:1234@localhost:3306/posdb', 'mysql://root:1234@127.0.0.1:3306/posdb'];
  for (const url of urls) {
    console.log('testing', url);
    const client = new PrismaClient({ datasources: { db: { url } } });
    try {
      await client.$connect();
      console.log('connected', url);
    } catch (e) {
      console.error('failed', url, e.message);
      console.error(e);
    } finally {
      await client.$disconnect().catch(()=>{});
    }
  }
})();
