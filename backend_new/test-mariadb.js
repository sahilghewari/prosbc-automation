import mariadb from 'mariadb';

mariadb.createConnection({
  host: '208.76.96.150',
  user: 'app',
  password: 'MAkula123!',
  database: 'sbcapp',
  port: 3306,
  connectTimeout: 5000
})
.then(conn => {
  console.log('Connected!');
  conn.end();
})
.catch(err => {
  console.error('Connection failed:', err);
});