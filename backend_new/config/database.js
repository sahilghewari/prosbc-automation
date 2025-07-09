import { Sequelize } from 'sequelize';

const sequelize = new Sequelize(
  process.env.DB_NAME || 'yourdatabase',
  process.env.DB_USER || 'prosbc',
  process.env.DB_PASSWORD || 'sahil',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mariadb',
    port: process.env.DB_PORT || 3306,
    logging: false,
  }
);

const database = {
  sequelize,
  connect: async () => {
    try {
      await sequelize.authenticate();
      console.log('✅ Connected to MariaDB!');
    } catch (err) {
      console.error('❌ Unable to connect to MariaDB:', err);
      throw err;
    }
  },
  disconnect: async () => {
    await sequelize.close();
  },
};

export default database;
